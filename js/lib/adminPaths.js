/**
 * Yönetici paneli sayfa yolları (auth.js ile döngüsel import olmaması için ayrı dosya)
 */
(function (global) {
    const ADMIN_PANEL_SLUGS = new Set([
        'admin',
        'kullanicilar',
        'icerik-ekle',
        'sinav-ekle',
        'admin-haberler',
        'admin-egitim-paketleri',
        'admin-sozlu-mulakat',
        'admin-mulakat-simulasyonu',
        'mesajlar',
    ]);

    const ALLOWED_LOGIN_REDIRECT = /^(admin(?:-[a-z0-9-]+)?|kullanicilar|mesajlar|icerik-ekle|sinav-ekle)$/i;

    function currentPageSlug() {
        return global.YaziyoPaths?.currentPageSlug?.()
            || (() => {
                const parts = global.location.pathname.replace(/\\/g, '/').split('/').filter(Boolean);
                const idx = parts.indexOf('pages');
                return idx >= 0 && parts[idx + 1] ? parts[idx + 1].toLowerCase() : 'admin';
            })();
    }

    function isAdminPanelPage() {
        return ADMIN_PANEL_SLUGS.has(currentPageSlug());
    }

    function getAdminLoginRedirectUrl() {
        const current = currentPageSlug();
        if (current !== 'admin-paneli' && ALLOWED_LOGIN_REDIRECT.test(current)) {
            return `../admin-paneli/?redirect=${encodeURIComponent(current)}`;
        }
        return '../admin-paneli/';
    }

    function resolveAdminRedirectTarget(fallback = 'admin') {
        const params = new URLSearchParams(global.location.search);
        const next = params.get('redirect');
        if (next && ALLOWED_LOGIN_REDIRECT.test(next)) {
            return `../${next}/`;
        }
        return `../${fallback}/`;
    }

    global.YaziyoAdminPaths = {
        isAdminPanelPage,
        getAdminLoginRedirectUrl,
        resolveAdminRedirectTarget,
        currentPageSlug,
    };
}(typeof window !== 'undefined' ? window : globalThis));
