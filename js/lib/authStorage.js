/**
 * YAZİYO - Beni Hatırla oturum depolama
 *
 * Supabase oturum token'ları (access_token, refresh_token) asla şifreyle birlikte saklanmaz.
 * Şifre yalnızca giriş anında Supabase API'sine gönderilir; tarayıcıda tutulmaz.
 *
 * Beni Hatırla AÇIK  → localStorage  → tarayıcı kapatılıp açılsa da oturum devam eder
 * Beni Hatırla KAPALI → sessionStorage → sekme/tarayıcı tamamen kapanınca oturum silinir
 */
import { isEmailConfirmed } from './authConfig.js';

/** Kullanıcının "Beni Hatırla" tercihi (yalnızca 'true' / 'false' string) */
export const REMEMBER_ME_KEY = 'yaziyo-remember-me';

/** UI hızlandırma için saklanan kullanıcı özeti (şifre içermez) */
export const AUTH_STATE_KEY = 'yaziyo-verified-auth-user';

/** Beni Hatırla işaretli mi? */
export function isRememberMeEnabled() {
    return localStorage.getItem(REMEMBER_ME_KEY) === 'true';
}

/** Tercihi kaydet (giriş öncesi veya checkbox değişince) */
export function setRememberMe(enabled) {
    localStorage.setItem(REMEMBER_ME_KEY, enabled ? 'true' : 'false');
}

/** Aktif depolama: remember=true → localStorage, remember=false → sessionStorage */
function getActiveStore() {
    return isRememberMeEnabled() ? localStorage : sessionStorage;
}

/** Pasif depolama (tercih değişince eski veriyi temizlemek için) */
function getInactiveStore() {
    return isRememberMeEnabled() ? sessionStorage : localStorage;
}

/**
 * Supabase createClient auth.storage adaptörü.
 * Supabase oturumunu yalnızca aktif depoya yazar; diğer depodaki aynı anahtarı siler.
 */
export const yaziyoAuthStorage = {
    getItem(key) {
        // Yalnızca aktif depodan oku — pasif depodaki eski oturumu geri getirme (güvenlik)
        return getActiveStore().getItem(key);
    },
    setItem(key, value) {
        const store = getActiveStore();
        const other = getInactiveStore();
        other.removeItem(key);
        store.setItem(key, value);
    },
    removeItem(key) {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    },
};

/** Her iki depodaki Supabase oturum anahtarlarını temizle */
export function clearAllSupabaseAuthKeys() {
    [localStorage, sessionStorage].forEach((store) => {
        const keys = [];
        for (let i = 0; i < store.length; i++) {
            const key = store.key(i);
            if (
                key &&
                (key === AUTH_STATE_KEY ||
                    key.includes('auth-token') ||
                    key.includes('supabase') ||
                    key.startsWith('sb-'))
            ) {
                keys.push(key);
            }
        }
        keys.forEach((k) => store.removeItem(k));
    });
}

/**
 * Giriş / kayıt öncesi çağrılır.
 * Tercihi kaydeder, eski oturum kalıntılarını siler; yeni oturum doğru depoya yazılır.
 */
export function prepareAuthStorageForLogin(remember) {
    setRememberMe(remember);
    clearAllSupabaseAuthKeys();
    if (typeof window !== 'undefined') {
        window.name = '';
    }
}

/** Kullanıcı özetini aktif depoya yazar (yalnızca e-postası onaylı kullanıcılar) */
export function setStoredVerifiedUser(user) {
    if (!user) return;

    const confirmed = isEmailConfirmed(user);
    if (!confirmed) return;

    const payload = {
        id: user.id,
        email: user.email,
        created_at: user.created_at || null,
        email_confirmed_at: user.email_confirmed_at || user.confirmed_at || null,
        confirmed_at: user.confirmed_at || user.email_confirmed_at || null,
        user_metadata: user.user_metadata || {},
        app_metadata: user.app_metadata || {},
        saved_at: new Date().toISOString(),
    };
    const store = getActiveStore();
    getInactiveStore().removeItem(AUTH_STATE_KEY);
    store.setItem(AUTH_STATE_KEY, JSON.stringify(payload));
}

/** Aktif depodan kullanıcı özetini oku */
export function getStoredVerifiedUser() {
    const raw = getActiveStore().getItem(AUTH_STATE_KEY);
    if (!raw) return null;

    try {
        const user = JSON.parse(raw);
        if (!user?.id || !user?.email) {
            return null;
        }
        if (!isEmailConfirmed(user)) {
            return null;
        }
        return user;
    } catch (_) {
        localStorage.removeItem(AUTH_STATE_KEY);
        sessionStorage.removeItem(AUTH_STATE_KEY);
        return null;
    }
}

/**
 * Beni Hatırla açıkken sayfalar arası geçişte oturumu taşımak için window.name'e yazar.
 * window.name sekme kapanınca silinir; kalıcılık localStorage'daki Supabase token'larından gelir.
 */
export function mirrorSessionToWindowName(session) {
    if (typeof window === 'undefined') return;
    if (isRememberMeEnabled() && session?.access_token && session?.refresh_token) {
        window.name = JSON.stringify({ yaziyoSession: session });
    } else {
        window.name = '';
    }
}

/** Giriş sayfasındaki checkbox'ı son tercihe göre ayarla */
export function initRememberMeCheckbox(checkboxId = 'remember-me') {
    const checkbox = document.getElementById(checkboxId);
    if (!checkbox) return;

    // Varsayılan: işaretsiz (opt-in). Daha önce true seçildiyse işaretli gelir.
    const stored = localStorage.getItem(REMEMBER_ME_KEY);
    checkbox.checked = stored === 'true';

    checkbox.addEventListener('change', () => {
        setRememberMe(checkbox.checked);
    });
}
