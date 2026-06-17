/**
 * YAZİYO — Becayiş veri katmanı (Supabase ↔ UI)
 */
import { supabase } from './supabase.js';

export function isBecayisTableMissingError(error) {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    return (
        error.code === 'PGRST205'
        || error.code === 'PGRST116'
        || msg.includes('becayis')
        || msg.includes('schema cache')
        || msg.includes('could not find the function')
    );
}

function normalizeJsonArray(data) {
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

export async function fetchBecayisStats() {
    const { data, error } = await supabase.rpc('get_becayis_stats');
    if (error) throw error;
    return data || { toplam: 0, aktif_talepler: 0, bu_ay: 0 };
}

export async function searchBecayisIlanlari({ il = null, unvan = null } = {}) {
    const { data, error } = await supabase.rpc('search_becayis_ilanlari', {
        p_il: il || null,
        p_unvan: unvan || null,
    });
    if (error) throw error;
    return normalizeJsonArray(data);
}

export async function createBecayisIlani(payload) {
    const { data, error } = await supabase.rpc('create_becayis_ilani', {
        p_mevcut_il: payload.mevcutIl,
        p_mevcut_adliye: payload.mevcutAdliye,
        p_hedef_il: payload.hedefIl,
        p_hedef_adliye: payload.hedefAdliye,
        p_unvan: payload.unvan,
        p_atama_yili: payload.atamaYili,
        p_sebep: payload.sebep || null,
    });
    if (error) throw error;
    return data;
}

export async function sendBecayisTalebi(ilanId, payload) {
    const { data, error } = await supabase.rpc('send_becayis_talebi', {
        p_ilan_id: ilanId,
        p_mevcut_adliye: payload.mevcutAdliye,
        p_unvan: payload.unvan,
        p_atama_yili: payload.atamaYili,
        p_sebep: payload.sebep || null,
    });
    if (error) throw error;
    return data;
}

export async function fetchGelenTalepler() {
    const { data, error } = await supabase.rpc('get_gelen_becayis_talepleri');
    if (error) throw error;
    return normalizeJsonArray(data);
}

export async function respondBecayisTalebi(talepId, action, epostaPaylas = false) {
    const { data, error } = await supabase.rpc('respond_becayis_talebi', {
        p_talep_id: talepId,
        p_action: action,
        p_eposta_paylas: epostaPaylas,
    });
    if (error) throw error;
    return data;
}
