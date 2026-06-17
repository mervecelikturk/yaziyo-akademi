/**
 * YAZİYO — Mülakat Simülasyonu paketleri (Supabase ↔ UI)
 * Her paket: 3 dk klavye metni + 5 sözlü mülakat sorusu
 */
import { supabase } from './supabase.js';
import { mapSoruFromDb } from './sozluMulakatApi.js';

export const SIM_TABLE = 'mulakat_simulasyonlari';
export const ATTEMPT_TABLE = 'mulakat_simulasyon_denemeleri';
export const ORAL_QUESTION_COUNT = 5;
export const DEFAULT_KEYBOARD_SEC = 180;
export const DEFAULT_MIN_WORDS = 90;
export const DEFAULT_MIN_ORAL_CORRECT = 3;

export function isTableMissingError(error) {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    return (
        error.code === 'PGRST205'
        || error.code === 'PGRST116'
        || msg.includes('mulakat_simulasyon')
        || msg.includes('mulakat_simulasyon_deneme')
        || msg.includes('schema cache')
    );
}

export function countWords(text) {
    return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function parseQuestionIds(value) {
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
        } catch { /* ignore */ }
    }
    return [];
}

export function mapSimulasyonFromDb(row) {
    if (!row) return null;
    return {
        id: row.id,
        title: row.baslik,
        description: row.aciklama || '',
        keyboardText: row.klavye_metni,
        keyboardDurationSec: row.klavye_sure_saniye ?? DEFAULT_KEYBOARD_SEC,
        minWords: row.min_kelime ?? DEFAULT_MIN_WORDS,
        questionIds: parseQuestionIds(row.soru_ids),
        active: !!row.aktif,
        sortOrder: row.sira ?? 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        questions: row.questions || []
    };
}

export function mapSimulasyonToDb(item) {
    const ids = parseQuestionIds(item.questionIds);
    return {
        baslik: (item.title || '').trim(),
        aciklama: (item.description || '').trim(),
        klavye_metni: (item.keyboardText || '').trim(),
        klavye_sure_saniye: Math.min(Math.max(parseInt(item.keyboardDurationSec, 10) || DEFAULT_KEYBOARD_SEC, 60), 600),
        min_kelime: Math.min(Math.max(parseInt(item.minWords, 10) || DEFAULT_MIN_WORDS, 30), 500),
        soru_ids: ids,
        aktif: item.active !== false,
        sira: parseInt(item.sortOrder, 10) || 0
    };
}

export async function fetchQuestionsByIds(ids, client = supabase) {
    const list = parseQuestionIds(ids);
    if (!client || !list.length) return [];
    const { data, error } = await client
        .from('sozlu_mulakat_sorulari')
        .select('*')
        .in('id', list)
        .eq('aktif', true);
    if (error) return [];
    const mapped = (data || []).map(mapSoruFromDb);
    const order = new Map(list.map((id, i) => [id, i]));
    return mapped.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
}

async function attachQuestions(simulations, client) {
    const allIds = [...new Set(simulations.flatMap((s) => s.questionIds))];
    if (!allIds.length) return simulations.map((s) => ({ ...s, questions: [] }));

    const { data, error } = await client
        .from('sozlu_mulakat_sorulari')
        .select('*')
        .in('id', allIds);
    if (error) return simulations.map((s) => ({ ...s, questions: [] }));

    const byId = new Map((data || []).map((row) => [row.id, mapSoruFromDb(row)]));
    return simulations.map((sim) => ({
        ...sim,
        questions: sim.questionIds.map((id) => byId.get(id)).filter(Boolean)
    }));
}

export async function fetchPublishedSimulasyonlar(client = supabase) {
    if (!client) return { data: [], error: null };

    const { data, error } = await client
        .from(SIM_TABLE)
        .select('*')
        .eq('aktif', true)
        .order('sira', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) return { data: [], error };

    let list = (data || []).map(mapSimulasyonFromDb).filter((s) => s.questionIds.length === ORAL_QUESTION_COUNT);
    list = await attachQuestions(list, client);
    list = list.filter((s) => s.questions.length === ORAL_QUESTION_COUNT);
    return { data: list, error: null };
}

export async function fetchAllSimulasyonlarAdmin(client = supabase) {
    if (!client) return { data: [], error: null };

    const { data, error } = await client
        .from(SIM_TABLE)
        .select('*')
        .order('sira', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) return { data: [], error };
    const list = (data || []).map(mapSimulasyonFromDb);
    const withQuestions = await attachQuestions(list, client);
    return { data: withQuestions, error: null };
}

export async function upsertSimulasyon(item, client = supabase) {
    if (!client) return { data: null, error: new Error('Supabase bağlantısı yok') };

    const payload = mapSimulasyonToDb(item);
    if (!payload.baslik) return { data: null, error: new Error('Başlık zorunludur') };
    if (!payload.klavye_metni) return { data: null, error: new Error('Klavye metni zorunludur') };
    if (payload.soru_ids.length !== ORAL_QUESTION_COUNT) {
        return { data: null, error: new Error(`Tam ${ORAL_QUESTION_COUNT} sözlü mülakat sorusu seçilmelidir`) };
    }

    if (item.id) {
        const { data, error } = await client
            .from(SIM_TABLE)
            .update(payload)
            .eq('id', item.id)
            .select('*')
            .single();
        if (error) return { data: null, error };
        const mapped = mapSimulasyonFromDb(data);
        const [withQ] = await attachQuestions([mapped], client);
        return { data: withQ, error: null };
    }

    const { data, error } = await client
        .from(SIM_TABLE)
        .insert(payload)
        .select('*')
        .single();
    if (error) return { data: null, error };
    const mapped = mapSimulasyonFromDb(data);
    const [withQ] = await attachQuestions([mapped], client);
    return { data: withQ, error: null };
}

export async function deleteSimulasyon(id, client = supabase) {
    if (!client || !id) return { error: new Error('Geçersiz istek') };
    const { error } = await client.from(SIM_TABLE).delete().eq('id', id);
    return { error };
}

function mapDenemeFromDb(row) {
    if (!row) return null;
    const sim = row.simulasyon || row.mulakat_simulasyonlari;
    return {
        id: row.id,
        simulasyonId: row.simulasyon_id,
        simTitle: sim?.baslik || 'Simülasyon',
        wordCount: row.kelime_sayisi ?? 0,
        keyboardPassed: !!row.klavye_gecildi,
        oralCorrect: row.sozlu_dogru,
        success: !!row.basarili,
        stage: row.asama,
        createdAt: row.created_at
    };
}

/** Kullanıcının simülasyon denemesini kaydet */
export async function saveSimulasyonDenemesi(payload, client = supabase) {
    if (!client) return { data: null, error: new Error('Supabase bağlantısı yok') };
    const { data, error } = await client.rpc('save_mulakat_simulasyon_denemesi', {
        p_simulasyon_id: payload.simulasyonId,
        p_kelime_sayisi: payload.wordCount ?? 0,
        p_klavye_gecildi: !!payload.keyboardPassed,
        p_sozlu_dogru: payload.oralCorrect ?? null,
        p_basarili: !!payload.success,
        p_asama: payload.stage || 'tamamlandi'
    });
    if (error) return { data: null, error };
    return { data, error: null };
}

/** Kullanıcının son denemeleri */
export async function fetchUserDenemeleri(limit = 8, client = supabase) {
    if (!client) return { data: [], error: null };

    const { data, error } = await client
        .from(ATTEMPT_TABLE)
        .select(`
            id, simulasyon_id, kelime_sayisi, klavye_gecildi, sozlu_dogru, basarili, asama, created_at,
            simulasyon:simulasyon_id ( baslik )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) return { data: [], error };
    return { data: (data || []).map(mapDenemeFromDb), error: null };
}
