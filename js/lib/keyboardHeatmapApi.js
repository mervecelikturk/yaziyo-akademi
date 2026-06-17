/**
 * Klavye ısı haritası — Supabase RPC + önbellek
 */
import { computeHeatmapAnalytics, enrichAnalytics } from './keyboardHeatmapAnalytics.js';

const CACHE_TTL_MS = 60_000;
/** @type {Map<string, { ts: number, data: unknown }>} */
const cache = new Map();

function cacheKey(name, ...parts) {
    return [name, ...parts].join(':');
}

function getCached(key) {
    const hit = cache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.ts > CACHE_TTL_MS) {
        cache.delete(key);
        return null;
    }
    return hit.data;
}

function setCache(key, data) {
    cache.set(key, { ts: Date.now(), data });
}

export function invalidateHeatmapCache() {
    cache.clear();
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} payload
 */
export async function saveKeyboardHeatmapSession(supabase, payload) {
    if (!supabase) throw new Error('Veritabanı bağlantısı kurulamadı');
    if (!payload?.sessionId || !payload.keys?.length) return null;

    const layout = payload.keyboardLayout === 'f' ? 'f' : 'q';
    const analytics = computeHeatmapAnalytics(
        Object.fromEntries(payload.keys.map(({ key, count }) => [key, { total_count: count }])),
        layout
    );

    const { data, error } = await supabase.rpc('save_keyboard_heatmap_session', {
        p_session_id: payload.sessionId,
        p_keyboard_layout: layout,
        p_keys: payload.keys,
        p_metin_adi: payload.metinAdi || '',
        p_kategori: payload.kategori || '',
        p_source_type: payload.sourceType || 'klavye_calismasi',
    });

    if (error) throw error;

    invalidateHeatmapCache();

    return { ...data, analytics };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} [limit]
 */
export async function loadHeatmapSessions(supabase, limit = 10) {
    if (!supabase) return [];

    const key = cacheKey('sessions', limit);
    const cached = getCached(key);
    if (cached) return cached;

    const { data, error } = await supabase.rpc('get_keyboard_heatmap_sessions', {
        p_limit: limit,
    });

    if (error) {
        console.error('Isı haritası oturumları yüklenemedi:', error);
        return [];
    }

    const sessions = (data || []).map((s) => ({
        ...s,
        analytics: enrichAnalytics(s.analytics, s.key_stats, s.keyboard_layout),
    }));

    setCache(key, sessions);
    return sessions;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} layoutId
 * @param {string|null} sessionId
 */
export async function loadHeatmapAggregate(supabase, layoutId, sessionId = null) {
    if (!supabase) return null;

    const layout = layoutId === 'f' ? 'f' : 'q';
    const key = cacheKey('aggregate', layout, sessionId || 'all');
    const cached = getCached(key);
    if (cached) return cached;

    const { data, error } = await supabase.rpc('get_keyboard_heatmap_aggregate', {
        p_keyboard_layout: layout,
        p_session_id: sessionId,
    });

    if (error) {
        console.error('Isı haritası aggregate yüklenemedi:', error);
        return null;
    }

    const result = {
        ...data,
        analytics: computeHeatmapAnalytics(data.key_stats || {}, layout),
    };

    setCache(key, result);
    return result;
}

/**
 * Aktif oturum takibinden ısı haritası kaydet
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ metinAdi?: string, kategori?: string, sourceType?: string }} meta
 */
export async function saveHeatmapFromPracticeSession(supabase, meta = {}) {
    const { getKeyPressSessionPayload, resetKeyPressSession } = await import('./keyPressTracker.js');
    const payload = getKeyPressSessionPayload();
    if (!payload || !supabase) return null;

    try {
        const result = await saveKeyboardHeatmapSession(supabase, {
            sessionId: payload.sessionId,
            keyboardLayout: payload.keyboardLayout,
            keys: payload.keys,
            metinAdi: meta.metinAdi || '',
            kategori: meta.kategori || '',
            sourceType: meta.sourceType || 'klavye_calismasi',
        });
        resetKeyPressSession();
        return result;
    } catch (err) {
        console.warn('Isı haritası kaydedilemedi:', err);
        resetKeyPressSession();
        return null;
    }
}

if (typeof window !== 'undefined') {
    window.YaziyoHeatmapApi = {
        saveKeyboardHeatmapSession,
        saveHeatmapFromPracticeSession,
        loadHeatmapSessions,
        loadHeatmapAggregate,
        invalidateHeatmapCache,
    };
}
