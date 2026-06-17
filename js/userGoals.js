/**
 * YAZİYO - Kullanıcı hedefleri (Supabase)
 *
 * NOT: Yazma/okuma işlemleri Supabase JS SDK yerine doğrudan REST API üzerinden
 * yapılır. SDK her istekte dahili oturum kilidini (navigator.locks) alır ve bu
 * kilit bazı durumlarda deadlock'a girip istekleri sonsuza dek bekletebilir.
 * Doğrudan fetch ile bu sorun tamamen baypas edilir.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './lib/supabase.js';

const TUR_LABELS = { hiz: 'Hız Testi', klavye: 'Klavye Çalışması' };
const REST_URL = `${SUPABASE_URL}/rest/v1/kullanici_hedefleri`;

/** localStorage + sessionStorage içinden Supabase oturumunu (token + user) okur */
function readStoredSession() {
    const stores = [localStorage, sessionStorage];
    for (const store of stores) {
        for (let i = 0; i < store.length; i++) {
            const key = store.key(i);
            if (!key || !/^sb-.*-auth-token$/.test(key)) continue;
            try {
                const parsed = JSON.parse(store.getItem(key));
                const accessToken = parsed?.access_token || parsed?.currentSession?.access_token;
                const userId = parsed?.user?.id || parsed?.currentSession?.user?.id;
                if (accessToken) return { accessToken, userId: userId || null };
            } catch (_) { /* sonraki anahtara geç */ }
        }
    }
    return { accessToken: null, userId: null };
}

/** Doğrudan REST isteği (zaman aşımlı) */
async function restRequest(method, { path = '', body = null, headers = {}, accessToken } = {}) {
    if (!SUPABASE_ANON_KEY?.trim()) {
        throw new Error('Supabase API anahtarı tanımlı değil');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
        const res = await fetch(REST_URL + path, {
            method,
            signal: controller.signal,
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                ...headers,
            },
            body: body ? JSON.stringify(body) : undefined,
        });

        const text = await res.text();
        let payload = null;
        try { payload = text ? JSON.parse(text) : null; } catch (_) { payload = text; }

        if (!res.ok) {
            const err = new Error(payload?.message || `İstek başarısız (HTTP ${res.status})`);
            err.code = payload?.code;
            err.status = res.status;
            err.details = payload?.details;
            err.hint = payload?.hint;
            throw err;
        }
        return payload;
    } catch (e) {
        if (e.name === 'AbortError') {
            throw new Error('İstek zaman aşımına uğradı, bağlantınızı kontrol edin');
        }
        throw e;
    } finally {
        clearTimeout(timer);
    }
}

/** Kullanıcının hedeflerini listeler (aktif + tamamlanan) */
export async function loadUserGoals() {
    const { accessToken } = readStoredSession();
    const data = await restRequest('GET', {
        path: '?select=id,tur,sure_dakika,hedef_kelime,tamamlandi,tamamlanma_tarihi,created_at&order=created_at.desc',
        accessToken,
    });
    return Array.isArray(data) ? data : [];
}

/** Yeni hedef ekler */
export async function createUserGoal(_supabase, { tur, sureDakika, hedefKelime, userId } = {}) {
    const sure = parseInt(sureDakika, 10);
    const kelime = parseInt(hedefKelime, 10);

    if (!['hiz', 'klavye'].includes(tur)) throw new Error('Geçersiz hedef türü');
    if (!sure || kelime <= 0) throw new Error('Lütfen geçerli bir değer girin');
    if (tur === 'hiz' && ![1, 3, 5].includes(sure)) throw new Error('Hız testi için süre 1, 3 veya 5 dakika olmalıdır');
    if (tur === 'klavye' && ![1, 3, 5, 10].includes(sure)) throw new Error('Klavye çalışması için geçersiz süre');

    const maxLimit = tur === 'klavye' && sure === 10 ? 10000 : 1000;
    if (kelime > maxLimit) throw new Error(`Hedef en fazla ${maxLimit} kelime olabilir`);

    const stored = readStoredSession();
    const kullaniciId = userId || stored.userId;
    if (!stored.accessToken || !kullaniciId) {
        throw new Error('Oturum bulunamadı, lütfen tekrar giriş yapın');
    }

    try {
        const data = await restRequest('POST', {
            body: { kullanici_id: kullaniciId, tur, sure_dakika: sure, hedef_kelime: kelime },
            headers: { Prefer: 'return=representation' },
            accessToken: stored.accessToken,
        });
        return Array.isArray(data) ? data[0] : data;
    } catch (err) {
        if (err.code === '23505') throw new Error('Bu süre için zaten aktif bir hedefiniz var');
        throw err;
    }
}

/** Hedefi siler */
export async function deleteUserGoal(_supabase, goalId) {
    const { accessToken } = readStoredSession();
    await restRequest('DELETE', {
        path: `?id=eq.${encodeURIComponent(goalId)}`,
        accessToken,
    });
}

/**
 * Test / çalışma sonucuna göre hedefleri kontrol eder; tamamlananlar için bildirim oluşturur.
 * (RPC çağrısı SDK üzerinden yapılır; kritik bir kullanıcı etkileşimi değildir.)
 * @returns {Promise<object[]>} Yeni tamamlanan hedefler
 */
export async function checkGoalCompletion(supabase, tur, sureDakika, dogruKelime) {
    if (!supabase) return [];

    const sure = parseInt(sureDakika, 10);
    const kelime = Math.max(0, parseInt(dogruKelime, 10) || 0);

    const { data, error } = await supabase.rpc('kontrol_hedef_tamamlama', {
        p_tur: tur,
        p_sure_dakika: sure,
        p_dogru_kelime: kelime,
    });

    if (error) {
        console.error('Hedef kontrol hatası:', error);
        return [];
    }

    const raw = data?.tamamlanan ?? data;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

export function getGoalTypeLabel(tur) {
    return TUR_LABELS[tur] || tur;
}

export function formatGoalDate(isoDate) {
    if (!isoDate) return '—';
    return new Date(isoDate).toLocaleDateString('tr-TR');
}
