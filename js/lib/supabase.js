import { yaziyoAuthStorage } from './authStorage.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseConfig.js';

/**
 * Supabase Client — giriş/kayıt sayfaları (implicit akış)
 */
let supabase = null;

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

export function getSupabaseClient() {
    if (isPasswordRecoveryPage()) {
        return null;
    }
    if (!supabase) {
        supabase = buildSupabaseClient();
        if (typeof window !== 'undefined') {
            window.yaziyoSupabase = supabase;
        }
    }
    return supabase;
}

if (!isPasswordRecoveryPage()) {
    try {
        supabase = buildSupabaseClient();
        if (supabase) {
            console.log('✅ Supabase client başarıyla oluşturuldu.');
        } else {
            console.error('❌ Supabase CDN bulunamadı veya yüklenmedi!');
        }
    } catch (error) {
        console.error('❌ Supabase client oluşturulurken hata:', error);
    }
}

if (typeof window !== 'undefined' && !isPasswordRecoveryPage()) {
    window.yaziyoSupabase = supabase;
    window.addEventListener('DOMContentLoaded', () => {
        if (!supabase) {
            supabase = buildSupabaseClient();
            window.yaziyoSupabase = supabase;
            if (supabase) {
                console.log('✅ Supabase client (gecikmeli) oluşturuldu.');
            }
        }
    });
}

export { supabase, SUPABASE_URL, SUPABASE_ANON_KEY };
