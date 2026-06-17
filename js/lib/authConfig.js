/**
 * YAZİYO - Auth yapılandırması (şifre sıfırlama yönlendirmeleri)
 * Production'da SITE_URL ortam değişkeni / Supabase Dashboard Site URL ile eşleşmeli.
 */

/** Canlı site kökü (file:// veya bilinmeyen origin için yedek) */
export const DEFAULT_SITE_URL = 'https://yaziyo.com';

export const AUTH_PAGES = {
    login: 'girisKayit.html',
    adminLogin: 'adminGiris.html',
    resetPassword: 'sifre-sifirla.html',
};

/**
 * Çalışma anındaki site kökü (https://... veya localhost)
 */
export function getSiteOrigin() {
    if (typeof window === 'undefined') {
        return DEFAULT_SITE_URL.replace(/\/$/, '');
    }
    const { origin } = window.location;
    if (origin && origin !== 'null' && !origin.startsWith('file:')) {
        return origin.replace(/\/$/, '');
    }
    const stored = localStorage.getItem('yaziyo-site-url');
    if (stored) return stored.replace(/\/$/, '');
    return DEFAULT_SITE_URL.replace(/\/$/, '');
}

/**
 * pages/ altındaki bir auth sayfasının tam URL'si
 */
export function resolveAuthPageUrl(pageFile) {
    if (typeof window === 'undefined') {
        return `${DEFAULT_SITE_URL.replace(/\/$/, '')}/pages/${pageFile}`;
    }
    const origin = getSiteOrigin();
    const { pathname } = window.location;
    const pagesMarker = '/pages/';
    const idx = pathname.indexOf(pagesMarker);
    if (idx >= 0) {
        const base = pathname.slice(0, idx + pagesMarker.length);
        return `${origin}${base}${pageFile}`;
    }
    const dir = pathname.endsWith('/')
        ? pathname
        : pathname.replace(/\/[^/]*$/, '/');
    const basePath = dir.includes('/pages') ? dir : `${dir}pages/`;
    return `${origin}${basePath}${pageFile}`;
}

export function getLoginPageUrl() {
    return resolveAuthPageUrl(AUTH_PAGES.login);
}

/** Şifre sıfırlama mailindeki redirect */
export function getPasswordResetRedirectUrl() {
    return resolveAuthPageUrl(AUTH_PAGES.resetPassword);
}

/** Şifre sıfırlama maili yeniden gönderme bekleme süresi */
export const RESET_EMAIL_COOLDOWN_SEC = 60;
