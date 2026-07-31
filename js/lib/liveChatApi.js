/**
 * YAZİYO — Live Chat veri katmanı (Supabase Realtime)
 * Kullanıcı: yalnızca metin | Admin: metin, görsel, dosya, ses, link
 */
import { supabase } from './supabase.js';

const ONLINE_MS = 75_000;
const HEARTBEAT_MS = 20_000;
const TYPING_MS = 4_000;
const BUCKET = 'live-chat';

export function isLiveChatMissingError(error) {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    return (
        error.code === 'PGRST205'
        || error.code === 'PGRST202'
        || msg.includes('live_chat_')
        || msg.includes('schema cache')
    );
}

export function formatLastSeen(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';

    const now = new Date();
    const istanbul = (date) => date.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
    const time = d.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Istanbul',
    });

    if (istanbul(d) === istanbul(now)) return time;

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (istanbul(d) === istanbul(yesterday)) return `Dün ${time}`;

    const date = d.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'Europe/Istanbul',
    });
    return `${date} ${time}`;
}

export function formatMessageTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Istanbul',
    });
}

export function formatAudioDuration(sec) {
    const n = Math.max(0, Math.round(Number(sec) || 0));
    const m = Math.floor(n / 60);
    const s = n % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatMessageDateLabel(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const sameDay = (a, b) =>
        a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();

    if (sameDay(d, today)) return 'Bugün';
    if (sameDay(d, yesterday)) return 'Dün';
    return d.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Istanbul',
    });
}

export function isPresenceOnline(presence) {
    if (!presence) return false;
    if (presence.cevrimici !== true) return false;
    const t = new Date(presence.updated_at).getTime();
    if (!Number.isFinite(t)) return false;
    return Date.now() - t < ONLINE_MS;
}

/**
 * WhatsApp tarzı tek satır durum:
 * - Çevrimiçi → son görülme gösterme
 * - Değilse → Son görülme: ...
 */
export function formatPresenceView(presence) {
    if (isPresenceOnline(presence)) {
        return {
            online: true,
            statusText: 'Çevrimiçi',
            showLastSeen: false,
            lastSeenText: '',
        };
    }
    const last = presence?.son_gorulme || presence?.updated_at || null;
    if (last) {
        return {
            online: false,
            statusText: `Son görülme: ${formatLastSeen(last)}`,
            showLastSeen: false,
            lastSeenText: '',
        };
    }
    return {
        online: false,
        statusText: 'Çevrimdışı',
        showLastSeen: false,
        lastSeenText: '',
    };
}

export function isTypingActive(presence, konusmaId) {
    if (!presence?.yaziyor_konusma_id || !konusmaId) return false;
    if (presence.yaziyor_konusma_id !== konusmaId) return false;
    const t = new Date(presence.yaziyor_at).getTime();
    return Number.isFinite(t) && Date.now() - t < TYPING_MS;
}

/** Kullanıcının konuşmasını getir / oluştur */
export async function ensureUserConversation(userId, client = supabase) {
    if (!client || !userId) return { data: null, error: new Error('Oturum gerekli') };

    const { data: existing, error: readErr } = await client
        .from('live_chat_konusmalar')
        .select('*')
        .eq('kullanici_id', userId)
        .maybeSingle();

    if (readErr) return { data: null, error: readErr };
    if (existing) return { data: existing, error: null };

    const { data, error } = await client
        .from('live_chat_konusmalar')
        .insert({ kullanici_id: userId })
        .select('*')
        .single();

    if (error?.code === '23505') {
        const retry = await client
            .from('live_chat_konusmalar')
            .select('*')
            .eq('kullanici_id', userId)
            .maybeSingle();
        return { data: retry.data, error: retry.error };
    }
    return { data, error };
}

export async function fetchMessages(konusmaId, { limit = 120 } = {}, client = supabase) {
    if (!client || !konusmaId) return { data: [], error: null };
    const { data, error } = await client
        .from('live_chat_mesajlar')
        .select('*')
        .eq('konusma_id', konusmaId)
        .order('created_at', { ascending: true })
        .limit(limit);
    return { data: data || [], error };
}

export async function sendTextMessage(konusmaId, text, { isAdmin = false } = {}, client = supabase) {
    const icerik = String(text || '').trim();
    if (!client || !konusmaId || !icerik) {
        return { data: null, error: new Error('Mesaj boş olamaz') };
    }

    const { data: { user } } = await client.auth.getUser();
    if (!user) return { data: null, error: new Error('Oturum gerekli') };

    const row = {
        konusma_id: konusmaId,
        gonderen_id: user.id,
        gonderen_rol: isAdmin ? 'admin' : 'kullanici',
        tip: 'text',
        icerik: icerik.slice(0, 4000),
    };

    const { data, error } = await client
        .from('live_chat_mesajlar')
        .insert(row)
        .select('*')
        .single();
    return { data, error };
}

export async function sendLinkMessage(konusmaId, url, label = '', client = supabase) {
    const link = String(url || '').trim();
    if (!client || !konusmaId || !link) {
        return { data: null, error: new Error('Bağlantı gerekli') };
    }
    if (!/^https?:\/\/(meet\.google\.com|[\w.-]*zoom\.us)\//i.test(link)
        && !/^https?:\/\/.+/i.test(link)) {
        return { data: null, error: new Error('Geçerli bir bağlantı girin') };
    }

    const { data: { user } } = await client.auth.getUser();
    if (!user) return { data: null, error: new Error('Oturum gerekli') };

    const title = String(label || '').trim();
    const icerik = title ? `${title}\n${link}` : link;

    const { data, error } = await client
        .from('live_chat_mesajlar')
        .insert({
            konusma_id: konusmaId,
            gonderen_id: user.id,
            gonderen_rol: 'admin',
            tip: 'link',
            icerik: icerik.slice(0, 4000),
        })
        .select('*')
        .single();
    return { data, error };
}

async function uploadChatFile(konusmaId, userFolderId, file, tip, client, extras = {}) {
    const { data: { user } } = await client.auth.getUser();
    if (!user) return { data: null, error: new Error('Oturum gerekli') };

    const safeName = String(file.name || 'dosya')
        .replace(/[^\w.\-ğüşıöçĞÜŞİÖÇ ]+/gi, '_')
        .slice(0, 80);
    const path = `${userFolderId}/${konusmaId}/${Date.now()}_${safeName}`;

    const { error: upErr } = await client.storage
        .from(BUCKET)
        .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || undefined,
        });
    if (upErr) return { data: null, error: upErr };

    const sureSn = extras.sure_sn != null ? Math.max(0, Math.round(Number(extras.sure_sn) || 0)) : null;
    let icerik = extras.icerik;
    if (!icerik) {
        if (tip === 'image') icerik = 'Görsel';
        else if (tip === 'audio') {
            icerik = sureSn != null
                ? `Ses · ${formatAudioDuration(sureSn)} · ${sureSn} sn`
                : 'Ses kaydı';
        } else icerik = safeName;
    }

    const row = {
        konusma_id: konusmaId,
        gonderen_id: user.id,
        gonderen_rol: 'admin',
        tip,
        icerik,
        dosya_url: path,
        dosya_adi: safeName,
        dosya_mime: file.type || null,
    };
    if (sureSn != null) row.sure_sn = sureSn;

    let { data, error } = await client
        .from('live_chat_mesajlar')
        .insert(row)
        .select('*')
        .single();

    // sure_sn kolonu henüz yoksa (029 çalıştırılmamış) yeniden dene
    if (error && sureSn != null && String(error.message || '').includes('sure_sn')) {
        delete row.sure_sn;
        ({ data, error } = await client
            .from('live_chat_mesajlar')
            .insert(row)
            .select('*')
            .single());
        if (data) data.sure_sn = sureSn;
    }

    if (error) {
        await client.storage.from(BUCKET).remove([path]).catch(() => {});
    }
    return { data, error };
}

export async function sendImageMessage(konusmaId, userFolderId, file, client = supabase) {
    if (!file?.type?.startsWith('image/')) {
        return { data: null, error: new Error('Geçerli bir görsel seçin') };
    }
    return uploadChatFile(konusmaId, userFolderId, file, 'image', client);
}

export async function sendFileMessage(konusmaId, userFolderId, file, client = supabase) {
    if (!file) return { data: null, error: new Error('Dosya seçin') };
    return uploadChatFile(konusmaId, userFolderId, file, 'file', client);
}

export async function sendAudioMessage(konusmaId, userFolderId, blob, fileName = 'ses.webm', durationSec = null, client = supabase) {
    if (!blob) return { data: null, error: new Error('Ses kaydı yok') };
    const file = new File([blob], fileName, { type: blob.type || 'audio/webm' });
    return uploadChatFile(konusmaId, userFolderId, file, 'audio', client, {
        sure_sn: durationSec,
    });
}

/** Admin mesajı her iki taraftan siler (+ storage dosyası) */
export async function deleteChatMessage(message, client = supabase) {
    if (!client || !message?.id) return { error: new Error('Mesaj gerekli') };

    if (message.dosya_url && !/^https?:\/\//i.test(message.dosya_url)) {
        await client.storage.from(BUCKET).remove([message.dosya_url]).catch(() => {});
    }

    const { error } = await client
        .from('live_chat_mesajlar')
        .delete()
        .eq('id', message.id);

    return { error };
}

export async function getSignedFileUrl(path, client = supabase) {
    if (!client || !path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    const { data, error } = await client.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60);
    if (error) {
        console.warn('Live chat signed URL:', error.message || error);
        return null;
    }
    return data?.signedUrl || null;
}

export async function markMessagesSeen(konusmaId, viewerRole, client = supabase) {
    if (!client || !konusmaId || !viewerRole) return { error: null };
    const targetRole = viewerRole === 'admin' ? 'kullanici' : 'admin';
    const now = new Date().toISOString();

    const { error } = await client
        .from('live_chat_mesajlar')
        .update({ goruldu: true, goruldu_at: now })
        .eq('konusma_id', konusmaId)
        .eq('gonderen_rol', targetRole)
        .eq('goruldu', false);

    return { error };
}

export async function fetchUnreadCountForUser(konusmaId, client = supabase) {
    if (!client || !konusmaId) return 0;
    const { count, error } = await client
        .from('live_chat_mesajlar')
        .select('id', { count: 'exact', head: true })
        .eq('konusma_id', konusmaId)
        .eq('gonderen_rol', 'admin')
        .eq('goruldu', false);
    if (error) return 0;
    return count || 0;
}

export async function upsertPresence(payload, client = supabase) {
    if (!client) return { error: new Error('İstemci yok') };
    const { data: { user } } = await client.auth.getUser();
    if (!user) return { error: new Error('Oturum gerekli') };

    const online = payload.cevrimici !== false;
    const now = new Date().toISOString();

    // Çevrimiçiyken son_gorulme'yi her ping'de ezme; çevrimdışı olunca güncelle
    let sonGorulme = now;
    if (online) {
        const { data: existing } = await client
            .from('live_chat_presence')
            .select('son_gorulme')
            .eq('kullanici_id', user.id)
            .maybeSingle();
        sonGorulme = existing?.son_gorulme || now;
    }

    const row = {
        kullanici_id: user.id,
        cevrimici: online,
        son_gorulme: sonGorulme,
        yaziyor_konusma_id: payload.yaziyor_konusma_id ?? null,
        yaziyor_at: payload.yaziyor_konusma_id ? now : null,
        updated_at: now,
    };

    const { error } = await client
        .from('live_chat_presence')
        .upsert(row, { onConflict: 'kullanici_id' });
    return { error };
}

export async function clearTyping(client = supabase) {
    return upsertPresence({ cevrimici: true, yaziyor_konusma_id: null }, client);
}

export async function fetchPresence(userId, client = supabase) {
    if (!client || !userId) return { data: null, error: null };
    const { data, error } = await client
        .from('live_chat_presence')
        .select('*')
        .eq('kullanici_id', userId)
        .maybeSingle();
    return { data, error };
}

/** Aktif admin presence (en güncel) — security definer RPC */
export async function fetchAdminPresence(client = supabase) {
    if (!client) return { data: null, error: null };

    const { data, error } = await client.rpc('live_chat_admin_presence');
    if (error) {
        if (isLiveChatMissingError(error)) return { data: null, error };
        console.warn('Admin presence:', error.message || error);
        return { data: null, error };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return { data: row || null, error: null };
}

export async function isAdminUserId(userId, client = supabase) {
    if (!client || !userId) return false;
    const { data, error } = await client.rpc('live_chat_is_admin_id', { p_uid: userId });
    if (error) return false;
    return !!data;
}

export async function fetchCoachName(userId, client = supabase) {
    if (!client || !userId) return 'Koçunuz';
    const { data } = await client
        .from('egitimlerim_profiller')
        .select('koc_adi')
        .eq('kullanici_id', userId)
        .maybeSingle();
    const name = (data?.koc_adi || '').trim();
    return name || 'Koçunuz';
}

/* ---------- Admin ---------- */

export async function fetchAdminConversations(client = supabase) {
    if (!client) return { data: [], error: null };

    const { data: convos, error } = await client
        .from('live_chat_konusmalar')
        .select('*')
        .order('son_mesaj_at', { ascending: false, nullsFirst: false });

    if (error) return { data: [], error };

    const ids = (convos || []).map((c) => c.kullanici_id);
    let usersById = {};
    if (ids.length) {
        const { data: users } = await client
            .from('kullanicilar')
            .select('id, email, full_name')
            .in('id', ids);
        usersById = Object.fromEntries((users || []).map((u) => [u.id, u]));
    }

    // Okunmamış kullanıcı mesajları
    const withMeta = await Promise.all((convos || []).map(async (c) => {
        const { count } = await client
            .from('live_chat_mesajlar')
            .select('id', { count: 'exact', head: true })
            .eq('konusma_id', c.id)
            .eq('gonderen_rol', 'kullanici')
            .eq('goruldu', false);
        const u = usersById[c.kullanici_id];
        return {
            ...c,
            unread: count || 0,
            user_name: (u?.full_name || '').trim() || u?.email || 'Kullanıcı',
            user_email: u?.email || '',
        };
    }));

    return { data: withMeta, error: null };
}

export function subscribeConversation(konusmaId, handlers = {}, client = supabase) {
    if (!client || !konusmaId) return () => {};

    const channel = client
        .channel(`live-chat-msg:${konusmaId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'live_chat_mesajlar',
                filter: `konusma_id=eq.${konusmaId}`,
            },
            (payload) => handlers.onInsert?.(payload.new),
        )
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'live_chat_mesajlar',
                filter: `konusma_id=eq.${konusmaId}`,
            },
            (payload) => handlers.onUpdate?.(payload.new, payload.old),
        )
        .on(
            'postgres_changes',
            {
                event: 'DELETE',
                schema: 'public',
                table: 'live_chat_mesajlar',
                filter: `konusma_id=eq.${konusmaId}`,
            },
            (payload) => handlers.onDelete?.(payload.old),
        )
        .subscribe();

    return () => {
        client.removeChannel(channel);
    };
}

export function subscribePresence(handlers = {}, client = supabase) {
    if (!client) return () => {};

    const channel = client
        .channel('live-chat-presence')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'live_chat_presence',
            },
            (payload) => handlers.onChange?.(payload.new || payload.old, payload.eventType),
        )
        .subscribe();

    return () => {
        client.removeChannel(channel);
    };
}

export function subscribeConversationList(handlers = {}, client = supabase) {
    if (!client) return () => {};

    const channel = client
        .channel('live-chat-convos')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'live_chat_konusmalar' },
            () => handlers.onChange?.(),
        )
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'live_chat_mesajlar' },
            () => handlers.onChange?.(),
        )
        .subscribe();

    return () => {
        client.removeChannel(channel);
    };
}

export { ONLINE_MS, HEARTBEAT_MS, TYPING_MS, BUCKET };
