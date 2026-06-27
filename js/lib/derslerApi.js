/**
 * Ders ilerleme — Supabase + localStorage yedek
 */
import { initSupabaseClient, getSupabaseClient } from './supabase.js';

const LS_PREFIX = 'yaziyo-ders-progress:';

function lsKey(track) {
    return `${LS_PREFIX}${track}`;
}

export function loadLocalProgress(track) {
    try {
        const raw = localStorage.getItem(lsKey(track));
        if (!raw) return { tamamlanan_ders: 0, son_ders_no: 1 };
        const p = JSON.parse(raw);
        return {
            tamamlanan_ders: Math.max(0, Number(p.tamamlanan_ders) || 0),
            son_ders_no: Math.max(1, Number(p.son_ders_no) || 1),
        };
    } catch {
        return { tamamlanan_ders: 0, son_ders_no: 1 };
    }
}

export function saveLocalProgress(track, data) {
    localStorage.setItem(lsKey(track), JSON.stringify({
        tamamlanan_ders: data.tamamlanan_ders ?? 0,
        son_ders_no: data.son_ders_no ?? 1,
    }));
}

export async function loadDersProgress(track) {
    await initSupabaseClient();
    const supabase = getSupabaseClient();
    if (!supabase) return loadLocalProgress(track);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return loadLocalProgress(track);

    const { data, error } = await supabase.rpc('get_ders_ilerleme', { p_track: track });
    if (error) {
        console.warn('Ders ilerleme RPC yok, localStorage kullanılıyor:', error.message);
        return loadLocalProgress(track);
    }

    return {
        tamamlanan_ders: data?.tamamlanan_ders ?? 0,
        son_ders_no: data?.son_ders_no ?? 1,
    };
}

export async function saveDersProgress(track, payload) {
    const next = {
        tamamlanan_ders: payload.tamamlanan_ders ?? 0,
        son_ders_no: payload.son_ders_no ?? 1,
    };
    saveLocalProgress(track, next);

    await initSupabaseClient();
    const supabase = getSupabaseClient();
    if (!supabase) return { ...next, toplam_kelime: null, saved: false };

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { ...next, toplam_kelime: null, saved: false };

    const { data, error } = await supabase.rpc('save_ders_sonucu', {
        p_track: track,
        p_ders_no: payload.ders_no,
        p_dogru_kelime: payload.dogru_kelime ?? 0,
        p_yanlis_kelime: payload.yanlis_kelime ?? 0,
        p_sure_saniye: payload.sure_saniye ?? 0,
        p_basari_yuzde: payload.basari_yuzde ?? 0,
        p_tamamlandi: payload.tamamlandi === true,
        p_sonuc_kaydet: payload.sonuc_kaydet === true,
    });

    if (error) throw error;

    return {
        tamamlanan_ders: data?.tamamlanan_ders ?? next.tamamlanan_ders,
        son_ders_no: data?.son_ders_no ?? next.son_ders_no,
        toplam_kelime: data?.toplam_kelime ?? null,
        saved: payload.sonuc_kaydet === true,
    };
}

export async function isDersUserLoggedIn() {
    await initSupabaseClient();
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    const { data: { session } } = await supabase.auth.getSession();
    return !!session?.user;
}
