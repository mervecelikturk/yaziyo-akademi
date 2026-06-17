/**
 * YAZİYO — Haberler veri katmanı (Supabase ↔ UI)
 */
import { supabase } from './supabase.js';

export const HABER_CATEGORIES = {
    'admin-duyuru': { label: 'Admin Duyurusu', badgeClass: 'haber-badge-blue', color: 'blue' },
    'resmi-gazete': { label: 'Resmi Gazete', badgeClass: 'haber-badge-red', color: 'red' },
    'sistem': { label: 'Sistem Güncellemesi', badgeClass: 'haber-badge-blue', color: 'blue' },
    'sinav': { label: 'Sınav', badgeClass: 'haber-badge-orange', color: 'orange' },
    'kamu-alim': { label: 'Kamu Personel Alımı', badgeClass: 'haber-badge-red', color: 'red' }
};

export const GRADIENT_PRESETS = [
    { value: 'from-blue-600/80 via-indigo-700/70 to-dark-bg', label: 'Mavi — Sistem' },
    { value: 'from-sky-600/70 to-blue-900/80', label: 'Açık Mavi — Duyuru' },
    { value: 'from-orange-500/70 to-amber-800/80', label: 'Turuncu — Sınav' },
    { value: 'from-red-600/60 to-rose-900/80', label: 'Kırmızı — Alım' },
    { value: 'from-red-700/70 to-rose-950/90', label: 'Koyu Kırmızı — Gazete' },
    { value: 'from-cyan-600/60 to-slate-800/90', label: 'Camgöbeği' },
    { value: 'from-amber-500/60 to-orange-900/85', label: 'Kehribar' },
    { value: 'from-blue-500/50 to-indigo-900/80', label: 'İndigo' }
];

export function isTableMissingError(error) {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    return (
        error.code === 'PGRST205'
        || error.code === 'PGRST116'
        || msg.includes('haberler')
        || msg.includes('resmi_gazete')
        || msg.includes('schema cache')
    );
}

export function normalizeSourceUrl(raw) {
    const value = (raw || '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    if (/^www\./i.test(value)) return `https://${value}`;
    return value;
}

/** Kaynak URL: source_url öncelikli; eski kayıtlarda slug içindeki http(s) adresi */
export function resolveSourceUrl(item) {
    if (!item) return '';
    const fromColumn = normalizeSourceUrl(item.sourceUrl);
    if (fromColumn && /^https?:\/\//i.test(fromColumn)) return fromColumn;
    const slug = (item.slug || '').trim();
    if (/^https?:\/\//i.test(slug) || /^www\./i.test(slug)) {
        return normalizeSourceUrl(slug);
    }
    return '';
}

export function formatDateDisplay(isoOrDate) {
    if (!isoOrDate) return '—';
    try {
        const s = String(isoOrDate);
        const d = new Date(s.length === 10 ? `${s}T12:00:00` : s);
        return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
        return String(isoOrDate);
    }
}

export function mapNewsFromDb(row) {
    if (!row) return null;
    return {
        id: row.id,
        category: row.category,
        title: row.title,
        excerpt: row.excerpt,
        content: row.content || '',
        slug: row.slug || '',
        sourceUrl: row.source_url || '',
        date: formatDateDisplay(row.publish_date),
        publishDate: row.publish_date,
        views: row.views ?? 0,
        author: row.author,
        imageGradient: row.image_gradient,
        featured: !!row.featured,
        pinned: !!row.pinned,
        isNew: !!row.is_new,
        published: !!row.published,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

export function mapNewsToDb(item) {
    return {
        category: item.category,
        title: item.title.trim(),
        excerpt: item.excerpt.trim(),
        content: (item.content || '').trim(),
        slug: (item.slug || '').trim() || null,
        source_url: normalizeSourceUrl(item.sourceUrl) || null,
        publish_date: item.publishDate || item.date,
        views: parseInt(item.views, 10) || 0,
        author: (item.author || 'Admin Merve').trim(),
        image_gradient: item.imageGradient,
        featured: !!item.featured,
        pinned: !!item.pinned,
        is_new: !!item.isNew,
        published: !!item.published
    };
}

export function mapRgFromDb(row) {
    if (!row) return null;
    return {
        id: row.id,
        kararNo: row.karar_no,
        date: formatDateDisplay(row.publish_date),
        publishDate: row.publish_date,
        category: row.category,
        excerpt: row.excerpt,
        pdfUrl: row.pdf_url || '',
        published: row.published !== false,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

export function mapRgToDb(item) {
    return {
        karar_no: item.kararNo.trim(),
        publish_date: item.publishDate || item.date,
        category: item.category.trim(),
        excerpt: item.excerpt.trim(),
        pdf_url: (item.pdfUrl || '').trim(),
        published: item.published !== false
    };
}

/** Kullanıcı sayfası: yalnızca yayındaki içerik */
export async function fetchPublishedHaberler() {
    if (!supabase) return { news: [], resmiGazete: [], error: { message: 'Supabase bağlantısı yok' } };

    const [newsRes, rgRes] = await Promise.all([
        supabase
            .from('haberler')
            .select('*')
            .eq('published', true)
            .order('publish_date', { ascending: false }),
        supabase
            .from('resmi_gazete')
            .select('*')
            .eq('published', true)
            .order('publish_date', { ascending: false })
    ]);

    const error = newsRes.error || rgRes.error;
    if (error) {
        return { news: [], resmiGazete: [], error };
    }

    return {
        news: (newsRes.data || []).map(mapNewsFromDb),
        resmiGazete: (rgRes.data || []).map(mapRgFromDb),
        error: null
    };
}

/** Admin: tüm kayıtlar */
export async function fetchAllHaberlerAdmin() {
    if (!supabase) return { news: [], resmiGazete: [], error: { message: 'Supabase bağlantısı yok' } };

    const [newsRes, rgRes] = await Promise.all([
        supabase.from('haberler').select('*').order('publish_date', { ascending: false }),
        supabase.from('resmi_gazete').select('*').order('publish_date', { ascending: false })
    ]);

    const error = newsRes.error || rgRes.error;
    if (error) {
        return { news: [], resmiGazete: [], error };
    }

    return {
        news: (newsRes.data || []).map(mapNewsFromDb),
        resmiGazete: (rgRes.data || []).map(mapRgFromDb),
        error: null
    };
}

export async function upsertHaber(id, payload) {
    const row = mapNewsToDb(payload);
    if (id) {
        return supabase.from('haberler').update(row).eq('id', id).select().single();
    }
    return supabase.from('haberler').insert(row).select().single();
}

export async function deleteHaber(id) {
    return supabase.from('haberler').delete().eq('id', id);
}

export async function upsertResmiGazete(id, payload) {
    const row = mapRgToDb(payload);
    if (id) {
        return supabase.from('resmi_gazete').update(row).eq('id', id).select().single();
    }
    return supabase.from('resmi_gazete').insert(row).select().single();
}

export async function deleteResmiGazete(id) {
    return supabase.from('resmi_gazete').delete().eq('id', id);
}

export async function incrementHaberViews(haberId) {
    if (!supabase || !haberId) return;
    await supabase.rpc('increment_haber_views', { haber_id: haberId });
}
