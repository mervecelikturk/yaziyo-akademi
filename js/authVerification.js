/**
 * YAZİYO - Kimlik doğrulama yardımcıları
 * Kayıt sonrası e-posta doğrulaması zorunludur.
 */

import { supabase } from './lib/supabase.js';
import { isEmailConfirmed, getEmailConfirmRedirectUrl, getOAuthRedirectUrl } from './lib/authConfig.js';
import { clearAllSupabaseAuthKeys, setStoredVerifiedUser } from './lib/authStorage.js';

export { isEmailConfirmed };

/** Sunucudan güncel kullanıcı (oturum varsa, e-posta onaylı) */
export async function getCurrentUser(client = supabase) {
    if (!client) return null;

    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return null;

    if (!isEmailConfirmed(user)) {
        await forceAuthCleanup(client);
        return null;
    }

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

/** Geçerli oturumu döner (e-posta onayı zorunlu) */
export async function ensureSession(client = supabase) {
    if (!client) {
        return { ok: false, reason: 'no_client' };
    }

    const { data: { session } } = await client.auth.getSession();
    if (session?.user) {
        if (!isEmailConfirmed(session.user)) {
            await forceAuthCleanup(client);
            return { ok: false, reason: 'email_not_confirmed' };
        }
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
            emailRedirectTo: getEmailConfirmRedirectUrl(),
        },
    });

    if (error) throw error;

    if (isDuplicateSignupResponse(data)) {
        throw new Error('Bu e-posta zaten kayıtlı. Giriş yapın.');
    }

    if (data?.user && !isEmailConfirmed(data.user)) {
        await forceAuthCleanup(client);
    } else if (data?.user && isEmailConfirmed(data.user) && data.session) {
        setStoredVerifiedUser(data.user);
    }

    return data;
}

export async function signIn(client, { email, password }) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;

    if (data?.user && !isEmailConfirmed(data.user)) {
        await forceAuthCleanup(client);
        const err = new Error('E-posta adresiniz henüz doğrulanmadı. Gelen kutunuzu kontrol edin.');
        err.code = 'email_not_confirmed';
        throw err;
    }

    if (data?.user) {
        setStoredVerifiedUser(data.user);
    }

    return data;
}

export async function signInWithGoogle(client) {
    if (!client) {
        throw new Error('Sistem bağlantısı kurulamadı.');
    }

    const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: getOAuthRedirectUrl(),
            queryParams: {
                access_type: 'offline',
                prompt: 'select_account',
            },
        },
    });

    if (error) throw error;
    return data;
}

export async function resendSignupConfirmation(client, email) {
    if (!client || !email) {
        throw new Error('Geçersiz istek.');
    }

    const { error } = await client.auth.resend({
        type: 'signup',
        email,
        options: {
            emailRedirectTo: getEmailConfirmRedirectUrl(),
        },
    });

    if (error) throw error;
}

export async function verifySignupToken(client, tokenHash) {
    if (!client || !tokenHash) {
        throw new Error('Doğrulama bağlantısı geçersiz.');
    }

    const { data, error } = await client.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'signup',
    });

    if (error) throw error;

    if (data?.user && !isEmailConfirmed(data.user)) {
        throw new Error('E-posta doğrulaması tamamlanamadı. Lütfen tekrar deneyin.');
    }

    if (data?.user) {
        setStoredVerifiedUser(data.user);
    }

    return data;
}

export function formatAuthError(error) {
    if (!error) return 'Beklenmeyen bir hata oluştu.';
    const msg = error.message || String(error);

    if (error.code === 'email_not_confirmed' || /email not confirmed|email_not_confirmed/i.test(msg)) {
        return 'E-posta adresiniz henüz doğrulanmadı. Gelen kutunuzdaki bağlantıya tıklayın.';
    }
    if (/provider is not enabled|unsupported provider|OAuth/i.test(msg)) {
        return 'Google ile giriş şu an kullanılamıyor. Lütfen e-posta ile giriş yapın.';
    }
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
    if (/pkce|code verifier/i.test(msg)) {
        return 'Bu link farklı bir cihaz veya tarayıcıda açıldı. Lütfen yeni bir sıfırlama linki isteyin.';
    }
    return msg;
}
