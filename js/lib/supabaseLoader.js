/**
 * Supabase CDN yükleyici.
 *
 * Bu söz ASLA askıda kalmamalı: `lib/supabase.js` modül seviyesinde bunu
 * beklediği için sonuçlanmayan bir söz, ona bağlı bütün modülleri (sayfanın
 * tamamını) çalışmadan bırakır. iPhone Safari'de içerik engelleyicisi betiği
 * boş yanıtla döndürdüğünde tam olarak bu oluyordu: betik "yüklendi" ama
 * window.supabase tanımsız kalıyor, beklenen load olayı bir daha gelmiyor.
 */

const SUPABASE_CDNS = [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://unpkg.com/@supabase/supabase-js@2',
];

/** Sayfadaki mevcut betiğe tanınan süre (normalde milisaniyeler içinde hazır) */
const EXISTING_SCRIPT_TIMEOUT_MS = 2000;

/** Her CDN denemesi için üst sınır */
const INJECT_TIMEOUT_MS = 5000;

let loadPromise = null;

function clientReady() {
    return typeof window !== 'undefined' && !!window.supabase?.createClient;
}

/** İstemci global'i tanımlanana kadar yokla; süre dolarsa false döner. */
function waitForClient(timeoutMs) {
    if (clientReady()) return Promise.resolve(true);

    return new Promise((resolve) => {
        const startedAt = Date.now();
        const timer = window.setInterval(() => {
            if (clientReady()) {
                window.clearInterval(timer);
                resolve(true);
                return;
            }
            if (Date.now() - startedAt >= timeoutMs) {
                window.clearInterval(timer);
                resolve(false);
            }
        }, 50);
    });
}

/** Betiği ekler; yükleme, hata ve zaman aşımı hâllerinin hepsinde sonuçlanır. */
function injectScript(src, timeoutMs) {
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = src;
        script.dataset.yaziyoSupabaseCdn = '1';

        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            resolve(clientReady());
        };

        const timer = window.setTimeout(finish, timeoutMs);
        script.onload = finish;
        script.onerror = finish;

        document.head.appendChild(script);
    });
}

/**
 * Supabase CDN betiğini yükler (tek seferlik). Başarısızlıkta hata fırlatır;
 * çağıran taraf (initSupabaseClient) bunu yakalayıp null istemci döndürür.
 */
export function ensureSupabaseCdnLoaded() {
    if (clientReady()) return Promise.resolve();
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
        const existing = document.querySelector(
            'script[data-yaziyo-supabase-cdn], script[src*="@supabase/supabase-js"]',
        );
        if (existing && await waitForClient(EXISTING_SCRIPT_TIMEOUT_MS)) return;

        for (const src of SUPABASE_CDNS) {
            if (await injectScript(src, INJECT_TIMEOUT_MS)) return;
        }

        // Sonraki çağrının yeniden denemesine izin ver
        loadPromise = null;
        throw new Error('Supabase istemcisi yüklenemedi (CDN engellenmiş olabilir)');
    })();

    return loadPromise;
}
