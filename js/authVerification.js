/**
 * YAZİYO - Kimlik doğrulama yardımcıları
 * E-posta onayı yoktur: kayıt sonrası kullanıcı doğrudan giriş yapar.
 */

import { supabase } from './lib/supabase.js';
import { clearAllSupabaseAuthKeys, setStoredVerifiedUser } from './lib/authStorage.js';

/** Sunucudan güncel kullanıcı (oturum varsa) */
export async function getCurrentUser(client = supabase) {
    if (!client) return null;

    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return null;
    setStoredVerifiedUser(user);
    return user;
}

/** Oturumu tamamen kapat */
export async function forceAuthCleanup(client = supabase) {
    clearAllSupabaseAuthKeys();
    if (typeof window !== 'undefined') {
        window.name = '';
    }

    if (client) {
        try {
            await Promise.race([
                client.auth.signOut({ scope: 'global' }),
                new Promise((resolve) => window.setTimeout(resolve, 1200)),
            ]);
        } catch (_) { /* ignore */ }
    }
}

/** Supabase kayıt yanıtı: e-posta zaten kayıtlı (enumeration koruması) */
export function isDuplicateSignupResponse(data) {
    const user = data?.user;
    if (!user) return false;
    return Array.isArray(user.identities) && user.identities.length === 0;
}

/** Geçerli oturumu döner (e-posta onayı gerektirmez) */
export async function ensureSession(client = supabase) {
    if (!client) {
        return { ok: false, reason: 'no_client' };
    }

    const { data: { session } } = await client.auth.getSession();
    if (session?.user) {
        setStoredVerifiedUser(session.user);
        return { ok: true, session, user: session.user };
    }

    const user = await getCurrentUser(client);
    if (user) {
        return { ok: true, session: null, user };
    }

    return { ok: false, reason: 'no_session' };
}

export async function signUp(client, { email, password, fullName }) {
    const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: fullName },
        },
    });

    if (error) throw error;

    if (isDuplicateSignupResponse(data)) {
        throw new Error('Bu e-posta zaten kayıtlı. Giriş yapın.');
    }

    if (data?.user) {
        setStoredVerifiedUser(data.user);
    }
    return data;
}

export async function signIn(client, { email, password }) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data?.user) {
        setStoredVerifiedUser(data.user);
    }
    return data;
}

export function formatAuthError(error) {
    if (!error) return 'Beklenmeyen bir hata oluştu.';
    const msg = error.message || String(error);

    if (/invalid login credentials/i.test(msg)) {
        return 'E-posta veya şifre hatalı.';
    }
    if (/user already registered|zaten kayıtlı/i.test(msg)) {
        return msg;
    }
    if (/rate limit|too many requests/i.test(msg)) {
        return 'Çok fazla deneme. Lütfen birkaç dakika sonra tekrar deneyin.';
    }
    if (/password/i.test(msg) && /weak|short|least/i.test(msg)) {
        return 'Şifre güvenlik kurallarını karşılamıyor.';
    }
    return msg;
}
