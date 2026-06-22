const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

let loadPromise = null;

/**
 * Supabase CDN betiğini yalnızca gerektiğinde yükler (tek seferlik).
 */
export function ensureSupabaseCdnLoaded() {
    if (typeof window !== 'undefined' && window.supabase?.createClient) {
        return Promise.resolve();
    }
    if (loadPromise) return loadPromise;

    loadPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-yaziyo-supabase-cdn]');
        if (existing) {
            if (window.supabase?.createClient) {
                resolve();
                return;
            }
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('Supabase CDN yüklenemedi')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = SUPABASE_CDN;
        script.dataset.yaziyoSupabaseCdn = '1';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Supabase CDN yüklenemedi'));
        document.head.appendChild(script);
    });

    return loadPromise;
}
