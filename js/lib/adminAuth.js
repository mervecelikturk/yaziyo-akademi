/**
 * YAZİYO - Yönetici oturumu ve yetki kontrolü
 */

import { supabase } from './supabase.js';
import { ensureSession } from '../authVerification.js';
import {
    setRememberMe,
    isRememberMeEnabled,
    setStoredVerifiedUser,
} from './authStorage.js';

export const ADMIN_SESSION_KEY = 'yaziyo-admin-verified';
export const ADMIN_USER_KEY = 'yaziyo-admin-user';

export function setAdminSession(user) {
    const store = isRememberMeEnabled() ? localStorage : sessionStorage;
    const other = store === localStorage ? sessionStorage : localStorage;
    const payload = {
        id: user.id,
        email: user.email,
        verified_at: new Date().toISOString(),
    };
    other.removeItem(ADMIN_SESSION_KEY);
    other.removeItem(ADMIN_USER_KEY);
    store.setItem(ADMIN_SESSION_KEY, 'true');
    store.setItem(ADMIN_USER_KEY, JSON.stringify(payload));
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
export async function performAdminLogout(client = supabase) {
    clearAdminSession();
    const { forceAuthCleanup } = await import('../authVerification.js');
    await forceAuthCleanup(client);
}

/** Admin paneli sayfaları için oturum + yetki doğrulama */
export async function requireAdminAccess(redirectTo = 'adminGiris.html') {
    const client = supabase;
    if (!client) return false;

    if (!hasAdminSession()) {
        window.location.href = redirectTo;
        return false;
    }

    const result = await ensureSession(client);
    if (!result.ok || !result.user) {
        clearAdminSession();
        window.location.href = redirectTo;
        return false;
    }

    const isAdmin = await checkIsAdmin(client, result.user);
    if (!isAdmin) {
        clearAdminSession();
        window.location.href = redirectTo;
        return false;
    }

    setStoredVerifiedUser(result.user);
    return true;
}
