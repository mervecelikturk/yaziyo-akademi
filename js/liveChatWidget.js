/**
 * YAZİYO — Eğitimlerim Live Chat floating widget
 * Yalnızca /egitimlerim rotasında ve paket sahibi kullanıcıda aktif.
 * FAB hemen çizilir; konuşma/mesajlar arka planda yüklenir.
 */
import { supabase } from './lib/supabase.js';
import {
    ensureUserConversation,
    fetchMessages,
    sendTextMessage,
    markMessagesSeen,
    upsertPresence,
    clearTyping,
    fetchAdminPresence,
    fetchCoachName,
    subscribeConversation,
    subscribePresence,
    isTypingActive,
    formatPresenceView,
    formatMessageTime,
    formatMessageDateLabel,
    getSignedFileUrl,
    isLiveChatMissingError,
    HEARTBEAT_MS,
} from './lib/liveChatApi.js';
import { buildAudioPlayerHtml, bindAudioPlayerRoot, formatAudioDurationLabel } from './lib/liveChatAudioUi.js';

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}

function linkify(text) {
    const escaped = escapeHtml(text);
    return escaped.replace(
        /(https?:\/\/[^\s<]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
    );
}

function mediaPlaceholder(tip) {
    if (tip === 'image') return '<span class="lc-media-pending">Görsel yükleniyor…</span>';
    if (tip === 'audio') return '<span class="lc-media-pending">Ses yükleniyor…</span>';
    return '<span class="lc-media-pending">Dosya yükleniyor…</span>';
}

function parseAudioDuration(msg) {
    let durSec = msg.sure_sn;
    if (durSec != null) return durSec;
    const m = String(msg.icerik || '').match(/(\d+)\s*sn/i)
        || String(msg.icerik || '').match(/(\d+):(\d{2})/);
    if (!m) return null;
    return m[2] != null
        ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
        : parseInt(m[1], 10);
}

function buildMediaBody(msg, url) {
    if (msg.tip === 'image') {
        return url
            ? `<img class="lc-media-img" src="${escapeHtml(url)}" alt="Görsel" loading="lazy">`
            : escapeHtml(msg.icerik || 'Görsel');
    }
    if (msg.tip === 'audio') {
        const durSec = parseAudioDuration(msg);
        return url
            ? buildAudioPlayerHtml(url, durSec != null ? durSec : 'Ses', 'lc')
            : `<span class="lc-audio-dur">🎤 ${escapeHtml(formatAudioDurationLabel(durSec || 0))}</span>`;
    }
    if (msg.tip === 'file') {
        const name = escapeHtml(msg.dosya_adi || msg.icerik || 'Dosya');
        return url
            ? `<a class="lc-file-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-paperclip"></i> ${name}</a>`
            : `<span class="lc-file-link"><i class="fa-solid fa-paperclip"></i> ${name}</span>`;
    }
    return linkify(msg.icerik || '');
}

export async function mountLiveChatWidget(user) {
    if (!user?.id) return null;
    if (document.getElementById('lc-root')) return null;

    let coachName = 'Koçunuz';
    let convo = null;
    let messages = [];
    let unread = 0;
    let adminPresence = null;
    let open = false;
    let ready = false;
    let renderToken = 0;
    let markSeenPromise = null;
    /** Bu oturumda kullanıcı tarafından görülen admin mesajları (rozet geri gelmesin) */
    const seenAdminIds = new Set();
    let unsubMsg = () => {};
    let unsubPresence = () => {};
    let typingTimer = null;
    let heartbeatTimer = null;
    let presenceUiTimer = null;
    const signedCache = new Map();

    // FAB'ı ağ beklemeden hemen göster
    const root = document.createElement('div');
    root.id = 'lc-root';
    root.className = 'lc-root';
    root.innerHTML = `
        <div class="lc-panel" id="lc-panel" role="dialog" aria-label="Koç sohbeti" aria-hidden="true">
            <div class="lc-header">
                <div class="lc-header-main">
                    <div class="lc-header-name">
                        <span class="lc-online-dot" id="lc-online-dot" aria-hidden="true"></span>
                        <span id="lc-coach-name">${escapeHtml(coachName)}</span>
                    </div>
                    <p class="lc-header-status" id="lc-status-text">Bağlanıyor...</p>
                </div>
                <button type="button" class="lc-close" id="lc-close" aria-label="Sohbeti kapat">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="lc-messages" id="lc-messages">
                <div class="lc-empty lc-loading-state">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    Sohbet yükleniyor...
                </div>
            </div>
            <div class="lc-typing" id="lc-typing" hidden>Yazıyor...</div>
            <form class="lc-composer" id="lc-form">
                <textarea class="lc-input" id="lc-input" rows="1" maxlength="4000"
                    placeholder="Mesaj yaz..." aria-label="Mesaj" disabled></textarea>
                <button type="submit" class="lc-send" id="lc-send" aria-label="Gönder" disabled>
                    <i class="fa-solid fa-paper-plane"></i>
                </button>
            </form>
        </div>
        <button type="button" class="lc-fab" id="lc-fab" aria-label="Koçuma yaz" aria-expanded="false">
            <span class="lc-fab-emoji" aria-hidden="true">💬</span>
            <span class="lc-fab-count" id="lc-fab-count"></span>
            <span class="lc-fab-badge" id="lc-fab-badge"></span>
        </button>
    `;
    document.body.appendChild(root);

    const els = {
        panel: root.querySelector('#lc-panel'),
        fab: root.querySelector('#lc-fab'),
        fabCount: root.querySelector('#lc-fab-count'),
        fabBadge: root.querySelector('#lc-fab-badge'),
        close: root.querySelector('#lc-close'),
        messages: root.querySelector('#lc-messages'),
        typing: root.querySelector('#lc-typing'),
        form: root.querySelector('#lc-form'),
        input: root.querySelector('#lc-input'),
        send: root.querySelector('#lc-send'),
        onlineDot: root.querySelector('#lc-online-dot'),
        statusText: root.querySelector('#lc-status-text'),
        coachName: root.querySelector('#lc-coach-name'),
    };

    function setUnread(n) {
        unread = Math.max(0, n | 0);
        const has = unread > 0;
        els.fab.classList.toggle('has-unread', has);
        const label = has ? String(unread > 99 ? '99+' : unread) : '';
        els.fabBadge.textContent = label;
        els.fabBadge.hidden = !has;
        els.fabCount.textContent = has ? `(${label})` : '';
        els.fab.setAttribute('aria-label', has
            ? `Koçuma yaz, ${unread} okunmamış mesaj`
            : 'Koçuma yaz');
    }

    function isAdminUnread(msg) {
        if (!msg || msg.gonderen_rol !== 'admin') return false;
        if (msg.goruldu === true) return false;
        if (msg.id && seenAdminIds.has(msg.id)) return false;
        return true;
    }

    /** Yalnızca admin'den gelen ve henüz görülmemiş mesajlar */
    function countLocalUnread() {
        return messages.reduce((n, m) => (isAdminUnread(m) ? n + 1 : n), 0);
    }

    function syncUnreadBadge() {
        if (open) {
            setUnread(0);
            return;
        }
        setUnread(countLocalUnread());
    }

    function rememberSeenAdmin(msgOrId) {
        const id = typeof msgOrId === 'string' ? msgOrId : msgOrId?.id;
        if (id) seenAdminIds.add(id);
    }

    function markAdminMessagesSeenLocal() {
        messages = messages.map((m) => {
            if (m.gonderen_rol !== 'admin') return m;
            rememberSeenAdmin(m);
            return { ...m, goruldu: true };
        });
    }

    /** Sunucudan gelen listeyi oturumda görülenlerle birleştir */
    function mergeMessagesFromServer(list) {
        return (list || []).map((m) => {
            if (m.gonderen_rol === 'admin' && m.goruldu === true) {
                rememberSeenAdmin(m);
                return m;
            }
            if (m.gonderen_rol === 'admin' && (open || seenAdminIds.has(m.id))) {
                rememberSeenAdmin(m);
                return { ...m, goruldu: true };
            }
            return m;
        });
    }

    function markSeenOnServer() {
        if (!convo) return Promise.resolve();
        const run = markMessagesSeen(convo.id, 'kullanici')
            .finally(() => {
                if (markSeenPromise === run) markSeenPromise = null;
            });
        markSeenPromise = run;
        return run;
    }

    function updatePresenceUI() {
        const view = formatPresenceView(adminPresence);
        els.onlineDot.classList.toggle('on', view.online);
        els.statusText.textContent = view.statusText;

        if (!convo) return;
        const typing = isTypingActive(adminPresence, convo.id);
        els.typing.hidden = !typing;
        if (typing) els.typing.textContent = `${coachName} yazıyor...`;
    }

    async function resolveMedia(msg) {
        if (!msg.dosya_url) return null;
        if (signedCache.has(msg.dosya_url)) return signedCache.get(msg.dosya_url);
        const url = await getSignedFileUrl(msg.dosya_url);
        if (url) signedCache.set(msg.dosya_url, url);
        return url;
    }

    function buildMessageHtml(msg, mediaUrl = null) {
        const mine = msg.gonderen_rol === 'kullanici';
        let body = '';
        if (msg.tip === 'text' || msg.tip === 'link') {
            body = linkify(msg.icerik || '');
        } else if (msg.tip === 'image' || msg.tip === 'audio' || msg.tip === 'file') {
            if (mediaUrl || !msg.dosya_url) {
                body = buildMediaBody(msg, mediaUrl);
            } else if (signedCache.has(msg.dosya_url)) {
                body = buildMediaBody(msg, signedCache.get(msg.dosya_url));
            } else {
                body = mediaPlaceholder(msg.tip);
            }
        } else {
            body = linkify(msg.icerik || '');
        }

        const seen = mine && msg.goruldu
            ? '<span class="lc-seen">Görüldü</span>'
            : '';
        return `
            <div class="lc-row ${mine ? 'mine' : 'theirs'}" data-msg-id="${escapeHtml(msg.id)}">
                <div class="lc-bubble">
                    <div class="lc-body">${body}</div>
                    <div class="lc-meta">
                        <span>${escapeHtml(formatMessageTime(msg.created_at))}</span>
                        ${seen}
                    </div>
                </div>
            </div>`;
    }

    function paintMessages(opts = {}) {
        const { scroll = true } = opts;
        if (!messages.length) {
            els.messages.innerHTML = `
                <div class="lc-empty">
                    <i class="fa-regular fa-comments"></i>
                    Koçunuza buradan yazabilirsiniz.
                </div>`;
            return;
        }

        let html = '';
        let lastDay = '';
        for (const msg of messages) {
            const day = formatMessageDateLabel(msg.created_at);
            if (day !== lastDay) {
                lastDay = day;
                html += `<div class="lc-day"><span>${escapeHtml(day)}</span></div>`;
            }
            html += buildMessageHtml(msg);
        }
        els.messages.innerHTML = html;
        bindAudioPlayerRoot(els.messages);
        if (scroll) els.messages.scrollTop = els.messages.scrollHeight;
    }

    async function hydrateMedia() {
        const token = ++renderToken;
        const need = messages.filter((m) =>
            m.dosya_url
            && (m.tip === 'image' || m.tip === 'audio' || m.tip === 'file')
            && !signedCache.has(m.dosya_url));
        if (!need.length) return;

        await Promise.all(need.map((m) => resolveMedia(m)));
        if (token !== renderToken) return;

        // Sadece medya gövdelerini yerinde güncelle — tüm listeyi yeniden çizme
        for (const msg of need) {
            const url = signedCache.get(msg.dosya_url);
            if (!url) continue;
            const row = els.messages.querySelector(`[data-msg-id="${msg.id}"] .lc-body`);
            if (!row) continue;
            row.innerHTML = buildMediaBody(msg, url);
        }
        bindAudioPlayerRoot(els.messages);
    }

    function upsertLocalMessage(msg) {
        if (!msg?.id) return;
        let next = { ...msg };
        // Oturumda görülen / panel açıkken gelen admin mesajı okunmamış sayılmasın
        if (next.gonderen_rol === 'admin') {
            if (next.goruldu === true || open || seenAdminIds.has(next.id)) {
                next.goruldu = true;
                rememberSeenAdmin(next);
            }
        }
        const idx = messages.findIndex((m) => m.id === next.id);
        if (idx >= 0) messages[idx] = { ...messages[idx], ...next };
        else messages.push(next);
        messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    function removeLocalMessage(id) {
        if (!id) return;
        messages = messages.filter((m) => m.id !== id);
    }

    async function openPanel() {
        open = true;
        els.panel.classList.add('open');
        els.panel.setAttribute('aria-hidden', 'false');
        els.fab.setAttribute('aria-expanded', 'true');
        // Panel açılınca okunmamışlar hemen temizlenir ve oturumda hatırlanır
        markAdminMessagesSeenLocal();
        setUnread(0);

        if (!ready) {
            els.messages.innerHTML = `
                <div class="lc-empty lc-loading-state">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    Sohbet yükleniyor...
                </div>`;
        } else {
            paintMessages();
            hydrateMedia();
            markSeenOnServer().catch(() => {});
            els.input.focus();
        }

        if (convo) {
            upsertPresence({ cevrimici: true, yaziyor_konusma_id: null }, supabase, user.id);
        }
    }

    function closePanel() {
        open = false;
        els.panel.classList.remove('open');
        els.panel.setAttribute('aria-hidden', 'true');
        els.fab.setAttribute('aria-expanded', 'false');
        clearTyping();
        // Görülen mesajlar için rozet geri gelmesin; yalnızca kapalıyken YENİ admin mesajı gelirse çıkar
        markAdminMessagesSeenLocal();
        setUnread(0);
        markSeenOnServer().catch(() => {});
    }

    function togglePanel() {
        if (open) closePanel();
        else openPanel();
    }

    async function loadConversationData() {
        const [{ data }, { data: presence }] = await Promise.all([
            fetchMessages(convo.id),
            fetchAdminPresence(),
        ]);
        // Geç gelen yükleme, oturumda görülenleri tekrar "okunmamış" yapmasın
        messages = mergeMessagesFromServer(data || []);
        adminPresence = presence;
        updatePresenceUI();

        if (open) {
            markAdminMessagesSeenLocal();
            setUnread(0);
            paintMessages();
            hydrateMedia();
            markSeenOnServer().catch(() => {});
            els.input.focus();
        } else {
            syncUnreadBadge();
            hydrateMedia();
        }
    }

    async function heartbeat() {
        if (!convo) return;
        await upsertPresence({
            cevrimici: true,
            yaziyor_konusma_id: open && document.activeElement === els.input && els.input.value.trim()
                ? convo.id
                : null,
        }, supabase, user.id);
        const { data } = await fetchAdminPresence();
        if (data) {
            adminPresence = data;
            updatePresenceUI();
        }
    }

    els.fab.addEventListener('click', togglePanel);
    els.close.addEventListener('click', closePanel);

    els.input.addEventListener('input', () => {
        const has = !!els.input.value.trim();
        els.send.disabled = !has || !ready;
        els.input.style.height = 'auto';
        els.input.style.height = `${Math.min(els.input.scrollHeight, 104)}px`;
        clearTimeout(typingTimer);
        if (has && open && convo) {
            upsertPresence({ cevrimici: true, yaziyor_konusma_id: convo.id }, supabase, user.id);
            typingTimer = setTimeout(() => clearTyping(), 2800);
        } else {
            clearTyping();
        }
    });

    els.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            els.form.requestSubmit();
        }
    });

    els.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!ready || !convo) return;
        const text = els.input.value.trim();
        if (!text) return;
        els.send.disabled = true;

        // Optimistic bubble
        const tempId = `tmp-${Date.now()}`;
        const optimistic = {
            id: tempId,
            konusma_id: convo.id,
            gonderen_id: user.id,
            gonderen_rol: 'kullanici',
            tip: 'text',
            icerik: text,
            goruldu: false,
            created_at: new Date().toISOString(),
        };
        upsertLocalMessage(optimistic);
        els.input.value = '';
        els.input.style.height = 'auto';
        clearTyping();
        paintMessages();

        const { data, error } = await sendTextMessage(convo.id, text, {
            isAdmin: false,
            userId: user.id,
        });
        if (error) {
            console.warn('Mesaj gönderilemedi:', error.message || error);
            removeLocalMessage(tempId);
            paintMessages();
            els.send.disabled = false;
            return;
        }
        removeLocalMessage(tempId);
        if (data) upsertLocalMessage(data);
        paintMessages();
        els.send.disabled = true;
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && open) closePanel();
    });

    // Ağ: konuşma + koç adı paralel
    const [convoRes, name] = await Promise.all([
        ensureUserConversation(user.id),
        fetchCoachName(user.id),
    ]);

    coachName = name || 'Koçunuz';
    els.coachName.textContent = coachName;

    if (convoRes.error) {
        if (!isLiveChatMissingError(convoRes.error)) {
            console.warn('Live chat konuşma:', convoRes.error.message || convoRes.error);
        }
        root.remove();
        return null;
    }
    if (!convoRes.data) {
        root.remove();
        return null;
    }

    convo = convoRes.data;
    ready = true;
    els.input.disabled = false;

    unsubMsg = subscribeConversation(convo.id, {
        onInsert: (msg) => {
            if (open && msg.gonderen_rol === 'admin') {
                msg = { ...msg, goruldu: true };
                rememberSeenAdmin(msg);
            }
            upsertLocalMessage(msg);
            if (open) {
                if (msg.gonderen_rol === 'admin') {
                    markSeenOnServer().catch(() => {});
                }
                paintMessages();
                hydrateMedia();
                setUnread(0);
            } else if (msg.gonderen_rol === 'admin') {
                // Kapalıyken gelen YENİ admin mesajı → rozet
                syncUnreadBadge();
            }
        },
        onUpdate: (msg) => {
            upsertLocalMessage(msg);
            if (open) {
                paintMessages({ scroll: false });
                setUnread(0);
            } else {
                // Görüldü güncellemesi rozeti düşürür; eski okunmamışı geri getirmez
                syncUnreadBadge();
            }
        },
        onDelete: (old) => {
            if (old?.id) seenAdminIds.delete(old.id);
            removeLocalMessage(old?.id);
            if (open) {
                paintMessages({ scroll: false });
                setUnread(0);
            } else {
                syncUnreadBadge();
            }
        },
    }, supabase);

    let presenceRefreshTimer = null;
    unsubPresence = subscribePresence({
        onChange: (row) => {
            if (!row?.kullanici_id || row.kullanici_id === user.id) return;
            clearTimeout(presenceRefreshTimer);
            presenceRefreshTimer = setTimeout(async () => {
                const { data } = await fetchAdminPresence();
                if (data) {
                    adminPresence = data;
                    updatePresenceUI();
                }
            }, 200);
        },
    }, supabase);

    // Presence + mesajlar arka planda; FAB zaten görünür
    upsertPresence({ cevrimici: true, yaziyor_konusma_id: null }, supabase, user.id);
    loadConversationData().catch((err) => {
        console.warn('Live chat mesajları:', err?.message || err);
        if (open) {
            els.messages.innerHTML = `
                <div class="lc-empty">
                    <i class="fa-regular fa-comments"></i>
                    Mesajlar yüklenemedi. Tekrar deneyin.
                </div>`;
        }
    });

    heartbeatTimer = setInterval(heartbeat, HEARTBEAT_MS);
    presenceUiTimer = setInterval(updatePresenceUI, 10_000);

    const goOffline = () => {
        upsertPresence({ cevrimici: false, yaziyor_konusma_id: null }, supabase, user.id);
    };
    window.addEventListener('pagehide', goOffline);
    window.addEventListener('beforeunload', goOffline);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') heartbeat();
        else clearTyping();
    });

    return () => {
        unsubMsg();
        unsubPresence();
        clearInterval(heartbeatTimer);
        clearInterval(presenceUiTimer);
        clearTimeout(typingTimer);
        goOffline();
        root.remove();
    };
}
