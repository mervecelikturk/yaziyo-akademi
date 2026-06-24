/**
 * Ana sayfa istatistik kartları — gerçek metin, kullanıcı ve mülakat soru sayıları
 */
import { initSupabaseClient } from './lib/supabase.js';
import { fetchPlatformUserCount, fetchPlatformMulakatSoruCount } from './lib/platformStatsApi.js';

(function initTextCount() {
    const el = document.getElementById('metin-sayisi-gosterge');
    if (!el || typeof getTotalTextCount !== 'function') return;

    const count = getTotalTextCount();
    if (count > 0) {
        el.setAttribute('data-target', String(count));
    }
})();

async function initStatCount({ elementId, fetchCount, readyDatasetKey, readyEvent }) {
    const el = document.getElementById(elementId);
    if (!el) return;

    try {
        await initSupabaseClient();
        const count = await fetchCount();
        if (count != null && count >= 0) {
            el.setAttribute('data-target', String(count));
        }
    } catch (err) {
        console.warn(`${elementId} yüklenemedi:`, err);
    } finally {
        document.documentElement.dataset[readyDatasetKey] = '1';
        document.dispatchEvent(new CustomEvent(readyEvent));
    }
}

initStatCount({
    elementId: 'aday-sayisi-gosterge',
    fetchCount: fetchPlatformUserCount,
    readyDatasetKey: 'adaySayisiReady',
    readyEvent: 'yaziyo:aday-sayisi-ready',
});

initStatCount({
    elementId: 'mulakat-soru-sayisi-gosterge',
    fetchCount: fetchPlatformMulakatSoruCount,
    readyDatasetKey: 'mulakatSoruSayisiReady',
    readyEvent: 'yaziyo:mulakat-soru-sayisi-ready',
});
