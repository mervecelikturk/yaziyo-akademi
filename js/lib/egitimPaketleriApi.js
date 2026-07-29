/**
 * YAZİYO — Eğitim Paketleri veri katmanı (Supabase ↔ UI)
 */
import { supabase } from './supabase.js';

export const EGITIM_KATEGORILERI = [
    'KPSS',
    'TYT/AYT',
    'Klavye',
    'Mülakat',
    'Dil',
    'Hızlı Tekrar',
    'Premium',
    'Genel'
];

export const BADGE_OPTIONS = {
    new: { label: 'Yeni', cls: 'ep-badge ep-badge-new' },
    popular: { label: 'Popüler', cls: 'ep-badge ep-badge-popular' },
    best: { label: 'En İyi', cls: 'ep-badge ep-badge-best' }
};

/**
 * Admin'in pakete atayabileceği platform yetkileri (detaylı seçim).
 * Satın alan kullanıcıda bu özellikler aktif kabul edilir.
 */
export const PAKET_YETKILERI = [
    {
        group: 'Eğitimlerim',
        items: [
            { id: 'egitimlerim', label: 'Eğitimlerim paneli' },
            { id: 'egitimlerim-gorevler', label: 'Görevlerim' },
            { id: 'egitimlerim-ilerleme', label: 'İlerleme grafiği' },
            { id: 'egitimlerim-takvim', label: 'Takvim' },
            { id: 'egitimlerim-etut', label: 'Etüt odaları' },
            { id: 'egitimlerim-belgeler', label: 'Belgelerim' },
            { id: 'egitimlerim-koc', label: 'Koç / mentor desteği' },
            { id: 'egitimlerim-canli-destek', label: 'Canlı destek' }
        ]
    },
    {
        group: 'Klavye & Ders',
        items: [
            { id: 'klavye-calismasi', label: 'Klavye çalışması' },
            { id: 'hiz-testi', label: 'Hız testi' },
            { id: 'ozel-metin-calismasi', label: 'Özel metin çalışması' },
            { id: 'klavye-sinavi', label: 'Klavye sınavı' },
            { id: 'dersler', label: 'Dersler' },
            { id: 'kpss-calismasi', label: 'KPSS çalışması' }
        ]
    },
    {
        group: 'Mülakat',
        items: [
            { id: 'sozlu-mulakat', label: 'Sözlü mülakat' },
            { id: 'mulakat-simulasyonu', label: 'Mülakat simülasyonu' }
        ]
    },
    {
        group: 'Oyunlar',
        items: [
            { id: 'klavye-duellosu', label: 'Klavye düellosu' },
            { id: 'kelime-evi', label: 'Kelime evi' },
            { id: 'araba-yarisi', label: 'Araba yarışı' }
        ]
    }
];

export function allYetkiIds() {
    return PAKET_YETKILERI.flatMap((g) => g.items.map((i) => i.id));
}

export function isTableMissingError(error) {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    return (
        error.code === 'PGRST205'
        || error.code === 'PGRST116'
        || msg.includes('egitim_paketleri')
        || msg.includes('schema cache')
    );
}

function parseJsonArray(value) {
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
        } catch {
            return value.split('\n').map((s) => s.trim()).filter(Boolean);
        }
    }
    return [];
}

function clampInt(value, min, max, fallback) {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

export function isPaketSoldOut(pkg) {
    if (!pkg) return true;
    const max = clampInt(pkg.maxSales, 1, 100, 100);
    const sold = Math.max(0, Number(pkg.salesCount) || 0);
    return sold >= max;
}

function parseYetkiler(value) {
    const allowed = new Set(allYetkiIds());
    return parseJsonArray(value).filter((id) => allowed.has(id));
}

export function mapPaketFromDb(row) {
    if (!row) return null;
    const ratingCount = Math.max(0, Number(row.degerlendirme_sayisi) || 0);
    const ratingAvg = row.ortalama_puan == null || ratingCount === 0
        ? null
        : Number(row.ortalama_puan);
    return {
        id: row.id,
        title: row.baslik,
        description: row.aciklama || '',
        category: row.kategori || 'Genel',
        price: Number(row.fiyat) || 0,
        badge: row.badge || null,
        popular: !!row.populer,
        featured: !!row.one_cikan,
        active: !!row.aktif,
        features: parseJsonArray(row.ozellikler),
        modules: parseJsonArray(row.moduller),
        learn: parseJsonArray(row.ogrenilecekler),
        coverUrl: row.kapak_url || '',
        contentUrl: row.icerik_url || '',
        sortOrder: row.sira ?? 0,
        maxSales: clampInt(row.max_satis, 1, 100, 100),
        validityDays: clampInt(row.gecerlilik_gun, 1, 3650, 30),
        salesCount: Math.max(0, Number(row.satis_sayisi) || 0),
        yetkiler: parseYetkiler(row.yetkiler),
        ratingAvg,
        ratingCount,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

export function mapPaketToDb(item) {
    return {
        baslik: (item.title || '').trim(),
        aciklama: (item.description || '').trim(),
        kategori: (item.category || 'Genel').trim(),
        fiyat: Number(item.price) || 0,
        badge: item.badge || null,
        ozellikler: parseJsonArray(item.features),
        moduller: parseJsonArray(item.modules),
        ogrenilecekler: parseJsonArray(item.learn),
        kapak_url: (item.coverUrl || '').trim(),
        icerik_url: (item.contentUrl || '').trim(),
        one_cikan: !!item.featured,
        populer: !!item.popular,
        aktif: item.active !== false,
        sira: parseInt(item.sortOrder, 10) || 0,
        max_satis: clampInt(item.maxSales, 1, 100, 100),
        gecerlilik_gun: clampInt(item.validityDays, 1, 3650, 30),
        yetkiler: parseYetkiler(item.yetkiler)
    };
}

export async function fetchPublishedPaketler(client = supabase) {
    if (!client) return { data: [], error: null };

    const { data, error } = await client
        .from('egitim_paketleri')
        .select('*')
        .eq('aktif', true)
        .order('sira', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) return { data: [], error };
    return { data: (data || []).map(mapPaketFromDb), error: null };
}

export async function fetchAllPaketlerAdmin(client = supabase) {
    if (!client) return { data: [], error: null };

    const { data, error } = await client
        .from('egitim_paketleri')
        .select('*')
        .order('sira', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) return { data: [], error };
    return { data: (data || []).map(mapPaketFromDb), error: null };
}

export async function upsertPaket(item, client = supabase) {
    if (!client) return { data: null, error: new Error('Supabase bağlantısı yok') };

    const payload = mapPaketToDb(item);
    if (!payload.baslik) {
        return { data: null, error: new Error('Paket başlığı zorunludur') };
    }

    if (item.id) {
        const { data, error } = await client
            .from('egitim_paketleri')
            .update(payload)
            .eq('id', item.id)
            .select('*')
            .single();
        return { data: mapPaketFromDb(data), error };
    }

    const { data, error } = await client
        .from('egitim_paketleri')
        .insert(payload)
        .select('*')
        .single();
    return { data: mapPaketFromDb(data), error };
}

export async function deletePaket(id, client = supabase) {
    if (!client || !id) return { error: new Error('Geçersiz istek') };

    const { error } = await client
        .from('egitim_paketleri')
        .delete()
        .eq('id', id);

    return { error };
}

/**
 * Paket satın alımı — satış limiti doluysa "Şu an aktif değil" döner.
 */
export async function purchasePaket(paketId, client = supabase) {
    if (!client || !paketId) {
        return { data: null, error: new Error('Geçersiz istek') };
    }

    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) {
        return {
            data: { success: false, code: 'auth', message: 'Satın almak için giriş yapmalısınız.' },
            error: null
        };
    }

    const { data, error } = await client.rpc('satin_al_egitim_paketi', {
        p_paket_id: paketId
    });

    if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('satin_al_egitim_paketi') || msg.includes('schema cache') || error.code === 'PGRST202') {
            return {
                data: null,
                error: new Error('Satın alma sistemi henüz kurulmamış. sql/024_egitim_paketi_satis.sql dosyasını çalıştırın.')
            };
        }
        return { data: null, error };
    }

    return { data, error: null };
}

export async function fetchAdminBildirimler(client = supabase, limit = 20) {
    if (!client) return { data: [], error: null };

    const { data, error } = await client
        .from('yonetici_bildirimleri')
        .select('id, baslik, mesaj, tur, paket_id, kullanici_id, okundu, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) return { data: [], error };
    return { data: data || [], error: null };
}

export async function markAdminBildirimOkundu(id, client = supabase) {
    if (!client || !id) return { error: new Error('Geçersiz istek') };
    const { error } = await client
        .from('yonetici_bildirimleri')
        .update({ okundu: true })
        .eq('id', id);
    return { error };
}

export async function markAllAdminBildirimOkundu(client = supabase) {
    if (!client) return { error: new Error('Geçersiz istek') };
    const { error } = await client
        .from('yonetici_bildirimleri')
        .update({ okundu: true })
        .eq('okundu', false);
    return { error };
}

/** Yıldız HTML — değerlendirme yoksa boş string (hiçbir şey yazılmaz) */
export function ratingStarsHtml(avg, count, { size = 'sm' } = {}) {
    if (avg == null || !count || count <= 0) return '';
    const n = Math.max(0, Math.min(5, Number(avg)));
    const full = Math.floor(n);
    const half = n - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    const cls = size === 'lg' ? 'text-base' : 'text-xs';
    let stars = '';
    for (let i = 0; i < full; i++) stars += '<i class="fa-solid fa-star text-yaziyo-gold"></i>';
    if (half) stars += '<i class="fa-solid fa-star-half-stroke text-yaziyo-gold"></i>';
    for (let i = 0; i < empty; i++) stars += '<i class="fa-regular fa-star text-yaziyo-gold/50"></i>';
    return `<span class="inline-flex items-center gap-1 ${cls}" title="${n.toFixed(1)} / 5 (${count} değerlendirme)">
        <span class="inline-flex gap-0.5">${stars}</span>
        <span class="font-semibold text-light-text-secondary dark:text-dark-text-secondary">${n.toFixed(1)}</span>
    </span>`;
}

export async function submitPaketDegerlendirme(paketId, puan, yorum = '', client = supabase) {
    if (!client || !paketId) return { data: null, error: new Error('Geçersiz istek') };
    const { data, error } = await client.rpc('egitim_paketi_degerlendir', {
        p_paket_id: paketId,
        p_puan: Number(puan),
        p_yorum: String(yorum || '').slice(0, 500)
    });
    if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('egitim_paketi_degerlendir') || error.code === 'PGRST202') {
            return {
                data: null,
                error: new Error('Değerlendirme sistemi henüz kurulmamış. sql/026_paket_yetki_degerlendirme.sql dosyasını çalıştırın.')
            };
        }
        return { data: null, error };
    }
    return { data, error: null };
}

export async function fetchKullaniciPaketDegerlendirme(paketId, userId, client = supabase) {
    if (!client || !paketId || !userId) return { data: null, error: null };
    const { data, error } = await client
        .from('egitim_paketi_degerlendirmeler')
        .select('id, puan, yorum, created_at')
        .eq('paket_id', paketId)
        .eq('kullanici_id', userId)
        .maybeSingle();
    return { data, error };
}
