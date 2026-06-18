import { yaziyoAuthStorage } from './authStorage.js';

const SUPABASE_URL = 'https://eqyfnlapipnzojxhispd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_QgTAB5ivUASyNL1aaWB0iQ_uzrfsa2t';

/**
 * Supabase Client — implicit akış (statik site / e-posta linkleri cihazlar arası)
 * PKCE yalnızca linkin açıldığı tarayıcıda code verifier olduğunda çalışır;
 * şifre sıfırlama maili telefonda açıldığında PKCE hata verir.
 */
let supabase = null;

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
    if (!supabase) {
        supabase = buildSupabaseClient();
        if (typeof window !== 'undefined') {
            window.yaziyoSupabase = supabase;
        }
    }
    return supabase;
}

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

if (typeof window !== 'undefined') {
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
