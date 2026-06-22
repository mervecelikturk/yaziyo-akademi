/**
 * YAZİYO - Auth yapılandırması (şifre sıfırlama yönlendirmeleri)
 * Production'da SITE_URL ortam değişkeni / Supabase Dashboard Site URL ile eşleşmeli.
 */

/** Canlı site kökü (file:// veya bilinmeyen origin için yedek) */
export const DEFAULT_SITE_URL = 'https://yaziyoakademi.com';

export const AUTH_PAGES = {
    login: 'girisKayit.html',
    adminLogin: 'adminGiris.html',
    resetPassword: 'sifre-sifirla.html',
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

/**
 * Şifre sıfırlama mailindeki redirect — her zaman canlı site (e-posta linki localhost'a gitmesin)
 */
export function getPasswordResetRedirectUrl() {
    return `${DEFAULT_SITE_URL.replace(/\/$/, '')}/pages/${AUTH_PAGES.resetPassword}`;
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
    `${DEFAULT_SITE_URL}/pages/sifre-sifirla.html`,
    `${DEFAULT_SITE_URL}/pages/girisKayit.html`,
    `${DEFAULT_SITE_URL}/pages/girisKayit.html?verified=1`,
    `${DEFAULT_SITE_URL}/pages/girisKayit.html?oauth=1`,
    'http://127.0.0.1:5500/pages/sifre-sifirla.html',
    'http://127.0.0.1:5500/pages/girisKayit.html',
    'http://127.0.0.1:5500/pages/girisKayit.html?verified=1',
    'http://127.0.0.1:5500/pages/girisKayit.html?oauth=1',
    'http://localhost:5500/pages/sifre-sifirla.html',
    'http://localhost:5500/pages/girisKayit.html',
    'http://localhost:5500/pages/girisKayit.html?verified=1',
    'http://localhost:5500/pages/girisKayit.html?oauth=1',
    'http://127.0.0.1:8080/pages/sifre-sifirla.html',
    'http://127.0.0.1:8080/pages/girisKayit.html',
    'http://127.0.0.1:8080/pages/girisKayit.html?verified=1',
    'http://127.0.0.1:8080/pages/girisKayit.html?oauth=1',
    'http://localhost:8080/pages/sifre-sifirla.html',
    'http://localhost:8080/pages/girisKayit.html',
    'http://localhost:8080/pages/girisKayit.html?verified=1',
    'http://localhost:8080/pages/girisKayit.html?oauth=1',
    'http://127.0.0.1:3000/pages/sifre-sifirla.html',
    'http://127.0.0.1:3000/pages/girisKayit.html',
    'http://127.0.0.1:3000/pages/girisKayit.html?verified=1',
    'http://127.0.0.1:3000/pages/girisKayit.html?oauth=1',
    'http://localhost:3000/pages/sifre-sifirla.html',
    'http://localhost:3000/pages/girisKayit.html',
    'http://localhost:3000/pages/girisKayit.html?verified=1',
    'http://localhost:3000/pages/girisKayit.html?oauth=1',
];

/** Şifre sıfırlama maili yeniden gönderme bekleme süresi */
export const RESET_EMAIL_COOLDOWN_SEC = 60;
