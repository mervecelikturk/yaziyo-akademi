import { yaziyoAuthStorage } from './authStorage.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseConfig.js';
import { ensureSupabaseCdnLoaded } from './supabaseLoader.js';

/**
 * Supabase Client — giriş/kayıt sayfaları (implicit akış)
 */
let supabase = null;
let initPromise = null;

function isPasswordRecoveryPage() {
    return typeof window !== 'undefined'
        && /sifre-sifirla\.html$/i.test(window.location.pathname.replace(/\\/g, '/'));
}

function buildSupabaseClient() {
    if (typeof window === 'undefined' || !window.supabase?.createClient) {
        return null;
    }
    if (!SUPABASE_ANON_KEY?.trim()) {
        console.error('❌ Supabase API anahtarı tanımlı değil.');
        return null;
    }

    const key = SUPABASE_ANON_KEY.trim();
    return window.supabase.createClient(SUPABASE_URL, key, {
        auth: {
            flowType: 'implicit',
            detectSessionInUrl: true,
            autoRefreshToken: true,
            persistSession: true,
            storage: yaziyoAuthStorage,
        },
        global: {
            headers: {
                apikey: key,
            },
        },
    });
}

function assignGlobalClient(client) {
    supabase = client;
    if (typeof window !== 'undefined' && client) {
        window.yaziyoSupabase = client;
    }
    return client;
}

export function initSupabaseClient() {
    if (isPasswordRecoveryPage()) {
        return Promise.resolve(null);
    }
    if (supabase) {
        return Promise.resolve(supabase);
    }
    if (!initPromise) {
        initPromise = ensureSupabaseCdnLoaded()
            .then(() => assignGlobalClient(buildSupabaseClient()))
            .catch((error) => {
                console.error('❌ Supabase CDN yüklenemedi:', error);
                initPromise = null;
                return null;
            });
    }
    return initPromise;
}

export function getSupabaseClient() {
    if (isPasswordRecoveryPage()) {
        return null;
    }
    if (!supabase) {
        assignGlobalClient(buildSupabaseClient());
    }
    return supabase;
}

if (!isPasswordRecoveryPage()) {
    await initSupabaseClient();
}

export { supabase, SUPABASE_URL, SUPABASE_ANON_KEY };
