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

export function mapPaketFromDb(row) {
    if (!row) return null;
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
        sira: parseInt(item.sortOrder, 10) || 0
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
