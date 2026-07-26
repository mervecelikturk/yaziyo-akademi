/**
 * YAZİYO — Sayfa aktif/pasif durumu (Supabase)
 */
import { getSupabaseClient, initSupabaseClient } from './supabase.js';

const TABLE = 'site_page_status';

export function isPageStatusTableMissing(error) {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    return (
        error.code === 'PGRST205'
        || error.code === '42P01'
        || msg.includes(TABLE)
        || msg.includes('schema cache')
        || msg.includes('does not exist')
    );
}

async function getClient() {
    await initSupabaseClient();
    return getSupabaseClient() || (typeof window !== 'undefined' ? window.yaziyoSupabase : null);
}

/**
 * Uzak durum map'i: { [pageId]: boolean } | null (tablo yok / hata)
 */
export async function fetchRemotePageStatusMap() {
    const client = await getClient();
    if (!client) return null;

    const { data, error } = await client
        .from(TABLE)
        .select('page_id, is_active');

    if (error) {
        if (isPageStatusTableMissing(error)) {
            console.warn('site_page_status tablosu yok. sql/site_page_status.sql dosyasını çalıştırın.');
            return null;
        }
        console.warn('Sayfa durumu okunamadı:', error.message || error);
        return null;
    }

    const map = {};
    (data || []).forEach((row) => {
        if (row?.page_id) map[row.page_id] = row.is_active !== false;
    });
    return map;
}

/** Tek sayfa durumunu kaydet (upsert) */
export async function upsertRemotePageStatus(pageId, isActive) {
    const client = await getClient();
    if (!client || !pageId) {
        return { ok: false, error: new Error('Supabase istemcisi yok') };
    }

    const { error } = await client
        .from(TABLE)
        .upsert(
            {
                page_id: pageId,
                is_active: !!isActive,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'page_id' }
        );

    if (error) {
        return { ok: false, error, missingTable: isPageStatusTableMissing(error) };
    }
    return { ok: true };
}

/** Birden fazla sayfa durumunu kaydet */
export async function upsertRemotePageStatusBulk(statusMap) {
    const client = await getClient();
    if (!client || !statusMap) {
        return { ok: false, error: new Error('Supabase istemcisi yok') };
    }

    const rows = Object.entries(statusMap).map(([page_id, is_active]) => ({
        page_id,
        is_active: is_active !== false,
        updated_at: new Date().toISOString(),
    }));

    if (!rows.length) return { ok: true };

    const { error } = await client
        .from(TABLE)
        .upsert(rows, { onConflict: 'page_id' });

    if (error) {
        return { ok: false, error, missingTable: isPageStatusTableMissing(error) };
    }
    return { ok: true };
}
