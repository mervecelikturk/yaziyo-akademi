/**
 * YAZİYO — Sözlü Mülakat veri katmanı (Supabase ↔ UI)
 */
import { supabase } from './supabase.js';

export const SORU_KATEGORILERI = [
    { id: 'tarih', label: 'Tarih' },
    { id: 'vatandaslik', label: 'Vatandaşlık' },
    { id: 'guncel', label: 'Güncel Bilgiler' },
    { id: 'ataturk', label: 'Atatürk İlkeleri' },
    { id: 'egitim', label: 'Eğitim Bilimleri' },
    { id: 'genel', label: 'Genel Kültür' }
];

export const SORU_BILDIRIM_PREFIX = '[SORU BİLDİRİMİ]';

/** @deprecated Sabit 5/10 modları için MULAKAT_MODLARI kullanın */
export const MULAKAT_SORU_SAYISI = 5;
/** @deprecated getMinDogru(count) kullanın */
export const MULAKAT_MIN_DOGRU = 3;

/** Sabit mülakat kartları: 5 ve 10 soruluk */
export const MULAKAT_MODLARI = [
    {
        id: '5',
        title: '5 Soruluk Mülakat',
        topic: 'Soru bankasından rastgele 5 soru',
        sourceType: 'rastgele',
        questionCount: 5,
        minCorrect: 3
    },
    {
        id: '10',
        title: '10 Soruluk Mülakat',
        topic: 'Soru bankasından rastgele 10 soru',
        sourceType: 'rastgele',
        questionCount: 10,
        minCorrect: 6
    }
];

const PREV_IDS_STORAGE_KEY = 'yaziyo-sozlu-mulakat-prev-ids';

export const SORU_KAYNAKLARI = [
    { id: 'cikmis', label: 'Çıkmış Sorular' },
    { id: 'cikabilir', label: 'Çıkabilecek Zor Sorular' },
    { id: 'rastgele', label: 'Rastgele Sorular' }
];

export function getMinDogru(questionCount) {
    const mode = MULAKAT_MODLARI.find((m) => m.questionCount === questionCount);
    if (mode) return mode.minCorrect;
    return Math.max(1, Math.ceil(questionCount * 0.6));
}

export function getPreviousQuestionIds(modeId) {
    try {
        const raw = localStorage.getItem(PREV_IDS_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        const ids = parsed?.[String(modeId)];
        return Array.isArray(ids) ? ids.map(String) : [];
    } catch {
        return [];
    }
}

export function savePreviousQuestionIds(modeId, ids) {
    try {
        const raw = localStorage.getItem(PREV_IDS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        const next = (parsed && typeof parsed === 'object') ? parsed : {};
        next[String(modeId)] = (ids || []).map(String);
        localStorage.setItem(PREV_IDS_STORAGE_KEY, JSON.stringify(next));
    } catch { /* ignore */ }
}

function setKey(ids) {
    return [...ids].map(String).sort().join(',');
}

function shuffleArray(items) {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Havuzdan rastgele N soru seçer.
 * Mümkünse bir önceki mülakatla aynı soru setini vermez.
 */
export function pickRandomSorular(pool, count, previousIds = []) {
    const usable = (pool || []).filter((q) => q && q.active !== false && (q.options || []).length >= 5);
    if (usable.length < count) {
        return { questions: [], error: new Error(`Yeterli soru yok (en az ${count} yayında soru gerekli)`) };
    }

    const prevKey = setKey(previousIds || []);
    const canAvoidSame = usable.length > count || prevKey === '';

    for (let attempt = 0; attempt < 40; attempt += 1) {
        const picked = shuffleArray(usable).slice(0, count);
        const ids = picked.map((q) => q.id);
        if (!canAvoidSame || setKey(ids) !== prevKey) {
            return { questions: picked, error: null };
        }
    }

    // Havuz çok küçükse aynı set kaçınılmaz; en azından sırayı karıştır
    return { questions: shuffleArray(usable).slice(0, count), error: null };
}

function parseOptions(value) {
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
        } catch { /* ignore */ }
        return value.split('\n').map((s) => s.trim()).filter(Boolean);
    }
    return [];
}

export function isTableMissingError(error) {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    return (
        error.code === 'PGRST205'
        || error.code === 'PGRST116'
        || msg.includes('sozlu_mulakat')
        || msg.includes('schema cache')
    );
}

export function isPaketTableMissingError(error) {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    return isTableMissingError(error) || msg.includes('sozlu_mulakat_paketleri');
}

export function getSoruKaynagiLabel(id) {
    return SORU_KAYNAKLARI.find((k) => k.id === id)?.label || id;
}

function parseUuidArray(value) {
    if (!Array.isArray(value)) return [];
    return value.map(String).filter(Boolean);
}

export function mapPaketFromDb(row, questionsById = new Map()) {
    if (!row) return null;
    const questionIds = parseUuidArray(row.soru_ids);
    const questions = questionIds
        .map((id) => questionsById.get(id))
        .filter(Boolean);
    return {
        id: row.id,
        title: row.baslik,
        topic: row.konu || '',
        sourceType: row.soru_kaynagi || 'cikmis',
        questionIds,
        questions,
        active: !!row.aktif,
        sortOrder: row.sira ?? 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

export function mapPaketToDb(item) {
    const ids = parseUuidArray(item.questionIds);
    return {
        baslik: (item.title || '').trim(),
        konu: (item.topic || '').trim(),
        soru_kaynagi: item.sourceType === 'cikabilir' ? 'cikabilir' : 'cikmis',
        soru_ids: ids,
        aktif: item.active !== false,
        sira: parseInt(item.sortOrder, 10) || 0
    };
}

async function attachQuestionsToPaketler(rows, client) {
    const allIds = new Set();
    (rows || []).forEach((row) => {
        parseUuidArray(row.soru_ids).forEach((id) => allIds.add(id));
    });
    if (!allIds.size) {
        return (rows || []).map((row) => mapPaketFromDb(row));
    }

    const { data: sorular, error } = await client
        .from('sozlu_mulakat_sorulari')
        .select('*')
        .in('id', [...allIds]);

    if (error) return { data: [], error };

    const byId = new Map((sorular || []).map((s) => [s.id, mapSoruFromDb(s)]));
    return {
        data: (rows || []).map((row) => mapPaketFromDb(row, byId)),
        error: null
    };
}

export async function fetchPublishedPaketler(client = supabase) {
    if (!client) return { data: [], error: null };

    const { data, error } = await client
        .from('sozlu_mulakat_paketleri')
        .select('*')
        .eq('aktif', true)
        .order('sira', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) return { data: [], error };
    const attached = await attachQuestionsToPaketler(data, client);
    if (attached.error) return { data: [], error: attached.error };
    return {
        data: (attached.data || [])
            .map((p) => ({
                ...p,
                questions: (p.questions || []).filter((q) => q.active)
            }))
            .filter((p) => p.questions.length === MULAKAT_SORU_SAYISI),
        error: null
    };
}

export async function fetchAllPaketlerAdmin(client = supabase) {
    if (!client) return { data: [], error: null };

    const { data, error } = await client
        .from('sozlu_mulakat_paketleri')
        .select('*')
        .order('sira', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) return { data: [], error };
    const attached = await attachQuestionsToPaketler(data, client);
    if (attached.error) return { data: [], error: attached.error };
    return { data: attached.data || [], error: null };
}

export async function upsertPaket(item, client = supabase) {
    if (!client) return { data: null, error: new Error('Supabase bağlantısı yok') };

    const payload = mapPaketToDb(item);
    if (!payload.baslik) return { data: null, error: new Error('Mülakat adı zorunludur') };

    const ids = parseUuidArray(item.questionIds);
    if (ids.length !== MULAKAT_SORU_SAYISI) {
        return { data: null, error: new Error(`Tam ${MULAKAT_SORU_SAYISI} soru seçilmelidir`) };
    }

    if (item.id) {
        const { data, error } = await client
            .from('sozlu_mulakat_paketleri')
            .update(payload)
            .eq('id', item.id)
            .select('*')
            .single();
        if (error) return { data: null, error };
        const attached = await attachQuestionsToPaketler([data], client);
        return { data: attached.data?.[0] || null, error: null };
    }

    const { data, error } = await client
        .from('sozlu_mulakat_paketleri')
        .insert(payload)
        .select('*')
        .single();
    if (error) return { data: null, error };
    const attached = await attachQuestionsToPaketler([data], client);
    return { data: attached.data?.[0] || null, error: null };
}

export async function deletePaket(id, client = supabase) {
    if (!client || !id) return { error: new Error('Geçersiz istek') };
    const { error } = await client.from('sozlu_mulakat_paketleri').delete().eq('id', id);
    return { error };
}

export function getCategoryLabel(id) {
    return SORU_KATEGORILERI.find((c) => c.id === id)?.label || id;
}

export function mapSoruFromDb(row) {
    if (!row) return null;
    const options = parseOptions(row.secenekler);
    return {
        id: row.id,
        category: row.kategori,
        question: row.soru,
        options,
        correctIndex: row.dogru_indeks ?? 0,
        explanation: row.aciklama || '',
        lawNote: row.mevzuat_notu || '',
        active: !!row.aktif,
        sortOrder: row.sira ?? 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

export function mapSoruToDb(item) {
    const options = parseOptions(item.options);
    return {
        kategori: item.category || 'genel',
        soru: (item.question || '').trim(),
        secenekler: options,
        dogru_indeks: Math.min(Math.max(parseInt(item.correctIndex, 10) || 0, 0), Math.max(options.length - 1, 0)),
        aciklama: (item.explanation || '').trim(),
        mevzuat_notu: (item.lawNote || '').trim(),
        aktif: item.active !== false,
        sira: parseInt(item.sortOrder, 10) || 0
    };
}

export async function fetchPublishedSorular(client = supabase) {
    if (!client) return { data: [], error: null };

    const { data, error } = await client
        .from('sozlu_mulakat_sorulari')
        .select('*')
        .eq('aktif', true)
        .order('sira', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) return { data: [], error };
    return { data: (data || []).map(mapSoruFromDb), error: null };
}

export async function fetchAllSorularAdmin(client = supabase) {
    if (!client) return { data: [], error: null };

    const { data, error } = await client
        .from('sozlu_mulakat_sorulari')
        .select('*')
        .order('sira', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) return { data: [], error };
    return { data: (data || []).map(mapSoruFromDb), error: null };
}

export async function upsertSoru(item, client = supabase) {
    if (!client) return { data: null, error: new Error('Supabase bağlantısı yok') };

    const payload = mapSoruToDb(item);
    if (!payload.soru) return { data: null, error: new Error('Soru metni zorunludur') };
    if (!payload.secenekler || payload.secenekler.length < 2) {
        return { data: null, error: new Error('En az 2 şık gerekli') };
    }

    if (item.id) {
        const { data, error } = await client
            .from('sozlu_mulakat_sorulari')
            .update(payload)
            .eq('id', item.id)
            .select('*')
            .single();
        return { data: mapSoruFromDb(data), error };
    }

    const { data, error } = await client
        .from('sozlu_mulakat_sorulari')
        .insert(payload)
        .select('*')
        .single();
    return { data: mapSoruFromDb(data), error };
}

export async function deleteSoru(id, client = supabase) {
    if (!client || !id) return { error: new Error('Geçersiz istek') };
    const { error } = await client.from('sozlu_mulakat_sorulari').delete().eq('id', id);
    return { error };
}

export async function reportSoruToAdmin({ question, user, note = '' }, client = supabase) {
    if (!client || !question) return { error: new Error('Geçersiz istek') };

    const fullName = (user?.user_metadata?.site_full_name || user?.user_metadata?.full_name || user?.email || 'Kullanıcı').trim();
    const parts = fullName.split(/\s+/).filter(Boolean);
    const ad = parts[0] || 'Kullanıcı';
    const soyad = parts.length > 1 ? parts.slice(1).join(' ') : '-';
    const eposta = user?.email || 'bilinmiyor@yaziyo.local';

    const letters = ['A', 'B', 'C', 'D', 'E'];
    const opts = (question.options || []).map((o, i) => `${letters[i]}) ${o}`).join('\n');

    const mesaj = [
        SORU_BILDIRIM_PREFIX,
        '',
        `Soru ID: ${question.id}`,
        `Kategori: ${getCategoryLabel(question.category)}`,
        '',
        '--- Soru ---',
        question.question,
        '',
        '--- Şıklar ---',
        opts,
        '',
        `Doğru şık: ${letters[question.correctIndex] || '?'}`,
        note ? `\n--- Kullanıcı Notu ---\n${note.trim()}` : ''
    ].join('\n');

    const { error } = await client.from('iletisim_mesajlari').insert({
        ad,
        soyad,
        eposta,
        mesaj
    });

    return { error };
}
