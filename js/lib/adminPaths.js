/**
 * Yönetici paneli sayfa yolları (auth.js ile döngüsel import olmaması için ayrı dosya)
 */
(function (global) {
    const ADMIN_PANEL_PAGES = new Set([
        'admin.html',
        'kullanicilar.html',
        'icerikekle.html',
        'sinavekle.html',
        'adminhaberler.html',
        'adminegitimpaketleri.html',
        'adminsozlumulakat.html',
        'adminmulakatsimulasyonu.html',
        'mesajlar.html',
    ]);

    const ALLOWED_LOGIN_REDIRECT = /^(admin[a-zA-Z]*|kullanicilar|mesajlar|icerikEkle|sinavEkle)\.html$/i;

    function currentPageFile() {
        return (global.location.pathname.split('/').pop() || 'admin.html').split('?')[0];
    }

    function isAdminPanelPage() {
        return ADMIN_PANEL_PAGES.has(currentPageFile().toLowerCase());
    }

    function getAdminLoginRedirectUrl() {
        const current = currentPageFile();
        if (current.toLowerCase() !== 'admingiris.html' && ALLOWED_LOGIN_REDIRECT.test(current)) {
            return `adminGiris.html?redirect=${encodeURIComponent(current)}`;
        }
        return 'adminGiris.html';
    }

    function resolveAdminRedirectTarget(fallback = 'admin.html') {
        const params = new URLSearchParams(global.location.search);
        const next = params.get('redirect');
        if (next && ALLOWED_LOGIN_REDIRECT.test(next)) {
            return next;
        }
        return fallback;
    }

    global.YaziyoAdminPaths = {
        isAdminPanelPage,
        getAdminLoginRedirectUrl,
        resolveAdminRedirectTarget,
        currentPageFile,
    };
}(typeof window !== 'undefined' ? window : globalThis));
