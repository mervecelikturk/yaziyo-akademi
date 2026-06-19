/**
 * YAZİYO — Ana sayfa platform istatistikleri (Supabase)
 */
import { supabase } from './supabase.js';

/**
 * Kayıtlı kullanıcı (aday) sayısını döndürür.
 * Önce public RPC dener; yoksa doğrudan tablo sayımına düşer.
 */
export async function fetchPlatformUserCount() {
    if (!supabase) return null;

    const { data: rpcData, error: rpcError } = await supabase.rpc('get_kullanici_sayisi');
    if (!rpcError && rpcData != null) {
        return Number(rpcData) || 0;
    }

    const { count, error } = await supabase
        .from('kullanicilar')
        .select('id', { count: 'exact', head: true });

    if (error) {
        throw error;
    }

    return count ?? 0;
}

/**
 * Yayında (aktif) mülakat sorusu sayısını döndürür.
 */
export async function fetchPlatformMulakatSoruCount() {
    if (!supabase) return null;

    const { data: rpcData, error: rpcError } = await supabase.rpc('get_mulakat_soru_sayisi');
    if (!rpcError && rpcData != null) {
        return Number(rpcData) || 0;
    }

    const { count, error } = await supabase
        .from('sozlu_mulakat_sorulari')
        .select('id', { count: 'exact', head: true })
        .eq('aktif', true);

    if (error) {
        throw error;
    }

    return count ?? 0;
}
