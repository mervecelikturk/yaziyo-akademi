/**
 * YAZİYO - Auth yapılandırması (şifre sıfırlama yönlendirmeleri)
 * Production'da SITE_URL ortam değişkeni / Supabase Dashboard Site URL ile eşleşmeli.
 */

/** Canlı site kökü (file:// veya bilinmeyen origin için yedek) */
export const DEFAULT_SITE_URL = 'https://yaziyoakademi.com';

export const AUTH_PAGES = {
    login: 'giris-kayit',
    adminLogin: 'admin-paneli',
    resetPassword: 'sifre-sifirla',
};

/** Kullanıcı e-postası Supabase tarafından onaylanmış mı */
export function isEmailConfirmed(user) {
    if (!user) return false;
    if (user.email_confirmed_at || user.confirmed_at) return true;
    const provider = user.app_metadata?.provider;
    return provider === 'google' || provider === 'github';
}

/**
 * Google OAuth dönüş adresi
 */
export function getOAuthRedirectUrl() {
    return `${getLoginPageUrl()}?oauth=1`;
}

/**
 * Kayıt sonrası e-posta doğrulama linkinin yönleneceği adres
 */
export function getEmailConfirmRedirectUrl() {
    return `${resolveAuthPageUrl(AUTH_PAGES.login)}?verified=1`;
}

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
export function resolveAuthPageUrl(pageSlug) {
    if (typeof window === 'undefined') {
        return `${DEFAULT_SITE_URL.replace(/\/$/, '')}/pages/${pageSlug}/`;
    }
    const origin = getSiteOrigin();
    const { pathname } = window.location;
    const pagesMarker = '/pages/';
    const idx = pathname.indexOf(pagesMarker);
    if (idx >= 0) {
        const base = pathname.slice(0, idx + pagesMarker.length);
        return `${origin}${base}${pageSlug}/`;
    }
    const dir = pathname.endsWith('/')
        ? pathname
        : pathname.replace(/\/[^/]*$/, '/');
    const basePath = dir.includes('/pages') ? dir : `${dir}pages/`;
    return `${origin}${basePath}${pageSlug}/`;
}

export function getLoginPageUrl() {
    return resolveAuthPageUrl(AUTH_PAGES.login);
}

/**
 * Şifre sıfırlama mailindeki redirect — her zaman canlı site (e-posta linki localhost'a gitmesin)
 */
export function getPasswordResetRedirectUrl() {
    return `${DEFAULT_SITE_URL.replace(/\/$/, '')}/pages/${AUTH_PAGES.resetPassword}/`;
}

/**
 * Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
 * Canlı ve geliştirme ortamları için tam URL listesi (sonuna / eklemeyin).
 *
 * Site URL mutlaka: https://yaziyoakademi.com (localhost:3000 OLMAMALI)
 *
 * E-posta şablonu: supabase/reset_password_email_template.html
 * (ConfirmationURL değil — token_hash linki kullanın)
 */
export const SUPABASE_AUTH_REDIRECT_URLS = [
    `${DEFAULT_SITE_URL}/pages/sifre-sifirla/`,
    `${DEFAULT_SITE_URL}/pages/giris-kayit/`,
    `${DEFAULT_SITE_URL}/pages/giris-kayit/?verified=1`,
    `${DEFAULT_SITE_URL}/pages/giris-kayit/?oauth=1`,
    'http://127.0.0.1:5500/pages/sifre-sifirla/',
    'http://127.0.0.1:5500/pages/giris-kayit/',
    'http://127.0.0.1:5500/pages/giris-kayit/?verified=1',
    'http://127.0.0.1:5500/pages/giris-kayit/?oauth=1',
    'http://localhost:5500/pages/sifre-sifirla/',
    'http://localhost:5500/pages/giris-kayit/',
    'http://localhost:5500/pages/giris-kayit/?verified=1',
    'http://localhost:5500/pages/giris-kayit/?oauth=1',
    'http://127.0.0.1:8080/pages/sifre-sifirla/',
    'http://127.0.0.1:8080/pages/giris-kayit/',
    'http://127.0.0.1:8080/pages/giris-kayit/?verified=1',
    'http://127.0.0.1:8080/pages/giris-kayit/?oauth=1',
    'http://localhost:8080/pages/sifre-sifirla/',
    'http://localhost:8080/pages/giris-kayit/',
    'http://localhost:8080/pages/giris-kayit/?verified=1',
    'http://localhost:8080/pages/giris-kayit/?oauth=1',
    'http://127.0.0.1:3000/pages/sifre-sifirla/',
    'http://127.0.0.1:3000/pages/giris-kayit/',
    'http://127.0.0.1:3000/pages/giris-kayit/?verified=1',
    'http://127.0.0.1:3000/pages/giris-kayit/?oauth=1',
    'http://localhost:3000/pages/sifre-sifirla/',
    'http://localhost:3000/pages/giris-kayit/',
    'http://localhost:3000/pages/giris-kayit/?verified=1',
    'http://localhost:3000/pages/giris-kayit/?oauth=1',
];

/** Şifre sıfırlama maili yeniden gönderme bekleme süresi */
export const RESET_EMAIL_COOLDOWN_SEC = 60;
