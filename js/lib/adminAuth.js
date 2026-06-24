/**
 * YAZİYO - Yönetici oturumu ve yetki kontrolü
 */

import { getSupabaseClient, initSupabaseClient } from './supabase.js';
import { ensureSession } from '../authVerification.js';
import {
    setStoredVerifiedUser,
} from './authStorage.js';

export const ADMIN_SESSION_KEY = 'yaziyo-admin-verified';
export const ADMIN_USER_KEY = 'yaziyo-admin-user';

export function setAdminSession(user) {
    const payload = {
        id: user.id,
        email: user.email,
        verified_at: new Date().toISOString(),
    };
    // Yönetici bayrağı localStorage'da — yenilemede kaybolmasın
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    sessionStorage.removeItem(ADMIN_USER_KEY);
    localStorage.setItem(ADMIN_SESSION_KEY, 'true');
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(payload));
}

export function clearAdminSession() {
    [localStorage, sessionStorage].forEach((s) => {
        s.removeItem(ADMIN_SESSION_KEY);
        s.removeItem(ADMIN_USER_KEY);
    });
}

export function hasAdminSession() {
    const check = (store) =>
        store.getItem(ADMIN_SESSION_KEY) === 'true' && !!store.getItem(ADMIN_USER_KEY);
    return check(localStorage) || check(sessionStorage);
}

export function getAdminSessionUser() {
    const raw =
        localStorage.getItem(ADMIN_USER_KEY) || sessionStorage.getItem(ADMIN_USER_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function getAdminLoginUrl() {
    return window.YaziyoAdminPaths?.getAdminLoginRedirectUrl?.()
        || '../admin-paneli/';
}

async function resolveAdminSession(client, retries) {
    const maxRetries = retries ?? (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches ? 5 : 2);
    let result = await ensureSession(client);
    let attempt = 0;

    while (!result.ok && attempt < maxRetries) {
        attempt += 1;
        const delay = window.matchMedia('(max-width: 1023px)').matches ? 250 * attempt : 150 * attempt;
        await new Promise((resolve) => window.setTimeout(resolve, delay));
        result = await ensureSession(client);
    }

    return result;
}

/**
 * Yönetici mi? — public.yonetici_hesaplari (kullanicilar ile ayrı)
 * İstemci yalnızca kendi satırını okuyabilir (RLS).
 */
export async function checkIsAdmin(client, user) {
    if (!user || !client) return false;

    try {
        const { data, error } = await client
            .from('yonetici_hesaplari')
            .select('id, active')
            .eq('id', user.id)
            .maybeSingle();

        if (!error && data?.active === true) return true;
    } catch (_) {
        /* Tablo henüz yoksa Dashboard metadata yedek */
    }

    const metaRole = user.app_metadata?.role;
    if (metaRole === 'admin' || metaRole === 'yaziyo_admin') return true;

    return false;
}

/** Çıkış: Supabase oturumu + yönetici bayrağı */
export async function performAdminLogout(client = getSupabaseClient()) {
    clearAdminSession();
    const { forceAuthCleanup } = await import('../authVerification.js');
    await forceAuthCleanup(client);
}

/** Admin paneli sayfaları için oturum + yetki doğrulama */
export async function requireAdminAccess(redirectTo) {
    await initSupabaseClient();
    const client = getSupabaseClient();
    const loginUrl = redirectTo || getAdminLoginUrl();

    if (!client) {
        window.location.replace(loginUrl);
        return false;
    }

    if (!hasAdminSession()) {
        window.location.replace(loginUrl);
        return false;
    }

    const result = await resolveAdminSession(client);
    if (!result.ok || !result.user) {
        clearAdminSession();
        window.location.replace(loginUrl);
        return false;
    }

    const isAdmin = await checkIsAdmin(client, result.user);
    if (!isAdmin) {
        clearAdminSession();
        window.location.replace(loginUrl);
        return false;
    }

    setStoredVerifiedUser(result.user);
    return true;
}
