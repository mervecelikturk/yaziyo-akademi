/**
 * YAZİYO — Eğitimlerim Live Chat floating widget
 * Yalnızca /egitimlerim rotasında ve paket sahibi kullanıcıda aktif.
 */
import { supabase } from './lib/supabase.js';
import {
    ensureUserConversation,
    fetchMessages,
    sendTextMessage,
    markMessagesSeen,
    fetchUnreadCountForUser,
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

export async function mountLiveChatWidget(user) {
    if (!user?.id) return null;
    if (document.getElementById('lc-root')) return null;

    const { data: convo, error: convoErr } = await ensureUserConversation(user.id);
    if (convoErr) {
        if (!isLiveChatMissingError(convoErr)) {
            console.warn('Live chat konuşma:', convoErr.message || convoErr);
        }
        return null;
    }
    if (!convo) return null;

    const coachName = await fetchCoachName(user.id);
    let messages = [];
    let unread = 0;
    let adminPresence = null;
    let open = false;
    let unsubMsg = () => {};
    let unsubPresence = () => {};
    let typingTimer = null;
    let heartbeatTimer = null;
    let presenceUiTimer = null;
    const signedCache = new Map();

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
            <div class="lc-messages" id="lc-messages"></div>
            <div class="lc-typing" id="lc-typing" hidden>Yazıyor...</div>
            <form class="lc-composer" id="lc-form">
                <textarea class="lc-input" id="lc-input" rows="1" maxlength="4000"
                    placeholder="Mesaj yaz..." aria-label="Mesaj"></textarea>
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
        els.fabCount.textContent = has ? `(${label})` : '';
        els.fab.setAttribute('aria-label', has
            ? `Koçuma yaz, ${unread} okunmamış mesaj`
            : 'Koçuma yaz');
    }

    function updatePresenceUI() {
        const view = formatPresenceView(adminPresence);
        els.onlineDot.classList.toggle('on', view.online);
        els.statusText.textContent = view.statusText;

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

    async function renderMessages() {
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
            const mine = msg.gonderen_rol === 'kullanici';
            let body = '';
            if (msg.tip === 'text') {
                body = linkify(msg.icerik || '');
            } else if (msg.tip === 'link') {
                body = linkify(msg.icerik || '');
            } else if (msg.tip === 'image') {
                const url = await resolveMedia(msg);
                body = url
                    ? `<img class="lc-media-img" src="${escapeHtml(url)}" alt="Görsel" loading="lazy">`
                    : escapeHtml(msg.icerik || 'Görsel');
            } else if (msg.tip === 'audio') {
                const url = await resolveMedia(msg);
                let durSec = msg.sure_sn;
                if (durSec == null) {
                    const m = String(msg.icerik || '').match(/(\d+)\s*sn/i)
                        || String(msg.icerik || '').match(/(\d+):(\d{2})/);
                    if (m) {
                        durSec = m[2] != null
                            ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
                            : parseInt(m[1], 10);
                    }
                }
                body = url
                    ? buildAudioPlayerHtml(url, durSec != null ? durSec : 'Ses', 'lc')
                    : `<span class="lc-audio-dur">🎤 ${escapeHtml(formatAudioDurationLabel(durSec || 0))}</span>`;
            } else if (msg.tip === 'file') {
                const url = await resolveMedia(msg);
                const name = escapeHtml(msg.dosya_adi || msg.icerik || 'Dosya');
                body = url
                    ? `<a class="lc-file-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-paperclip"></i> ${name}</a>`
                    : `<span class="lc-file-link"><i class="fa-solid fa-paperclip"></i> ${name}</span>`;
            } else {
                body = linkify(msg.icerik || '');
            }

            const seen = mine && msg.goruldu
                ? '<span class="lc-seen">Görüldü</span>'
                : '';
            html += `
                <div class="lc-row ${mine ? 'mine' : 'theirs'}">
                    <div class="lc-bubble">
                        <div class="lc-body">${body}</div>
                        <div class="lc-meta">
                            <span>${escapeHtml(formatMessageTime(msg.created_at))}</span>
                            ${seen}
                        </div>
                    </div>
                </div>`;
        }
        els.messages.innerHTML = html;
        bindAudioPlayerRoot(els.messages);
        els.messages.scrollTop = els.messages.scrollHeight;
    }

    function upsertLocalMessage(msg) {
        if (!msg?.id) return;
        const idx = messages.findIndex((m) => m.id === msg.id);
        if (idx >= 0) messages[idx] = { ...messages[idx], ...msg };
        else messages.push(msg);
        messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    function removeLocalMessage(id) {
        if (!id) return;
        messages = messages.filter((m) => m.id !== id);
    }

    async function refreshUnread() {
        if (open) {
            setUnread(0);
            return;
        }
        const n = await fetchUnreadCountForUser(convo.id);
        setUnread(n);
    }

    async function openPanel() {
        open = true;
        els.panel.classList.add('open');
        els.panel.setAttribute('aria-hidden', 'false');
        els.fab.setAttribute('aria-expanded', 'true');
        await markMessagesSeen(convo.id, 'kullanici');
        messages = messages.map((m) => (
            m.gonderen_rol === 'admin' ? { ...m, goruldu: true } : m
        ));
        setUnread(0);
        await renderMessages();
        els.input.focus();
        await upsertPresence({ cevrimici: true, yaziyor_konusma_id: null });
    }

    function closePanel() {
        open = false;
        els.panel.classList.remove('open');
        els.panel.setAttribute('aria-hidden', 'true');
        els.fab.setAttribute('aria-expanded', 'false');
        clearTyping();
        refreshUnread();
    }

    function togglePanel() {
        if (open) closePanel();
        else openPanel();
    }

    async function loadInitial() {
        const [{ data }, { data: presence }] = await Promise.all([
            fetchMessages(convo.id),
            fetchAdminPresence(),
        ]);
        messages = data || [];
        adminPresence = presence;
        updatePresenceUI();
        await renderMessages();
        await refreshUnread();
    }

    async function heartbeat() {
        await upsertPresence({
            cevrimici: true,
            yaziyor_konusma_id: open && document.activeElement === els.input && els.input.value.trim()
                ? convo.id
                : null,
        });
        // Presence bayatladıysa yeniden çek
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
        els.send.disabled = !has;
        els.input.style.height = 'auto';
        els.input.style.height = `${Math.min(els.input.scrollHeight, 104)}px`;
        clearTimeout(typingTimer);
        if (has && open) {
            upsertPresence({ cevrimici: true, yaziyor_konusma_id: convo.id });
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
        const text = els.input.value.trim();
        if (!text) return;
        els.send.disabled = true;
        const { data, error } = await sendTextMessage(convo.id, text, { isAdmin: false });
        if (error) {
            console.warn('Mesaj gönderilemedi:', error.message || error);
            els.send.disabled = false;
            return;
        }
        els.input.value = '';
        els.input.style.height = 'auto';
        clearTyping();
        if (data) {
            upsertLocalMessage(data);
            await renderMessages();
        }
        els.send.disabled = true;
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && open) closePanel();
    });

    unsubMsg = subscribeConversation(convo.id, {
        onInsert: async (msg) => {
            upsertLocalMessage(msg);
            if (open) {
                if (msg.gonderen_rol === 'admin') {
                    await markMessagesSeen(convo.id, 'kullanici');
                    msg.goruldu = true;
                }
                await renderMessages();
            } else if (msg.gonderen_rol === 'admin') {
                await refreshUnread();
            } else {
                await renderMessages();
            }
        },
        onUpdate: async (msg) => {
            upsertLocalMessage(msg);
            if (open) await renderMessages();
        },
        onDelete: async (old) => {
            removeLocalMessage(old?.id);
            await renderMessages();
            await refreshUnread();
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

    await upsertPresence({ cevrimici: true, yaziyor_konusma_id: null });
    await loadInitial();
    heartbeatTimer = setInterval(heartbeat, HEARTBEAT_MS);
    // Heartbeat gelmese bile süre dolunca UI'ı çevrimdışına çek
    presenceUiTimer = setInterval(updatePresenceUI, 10_000);

    const goOffline = () => {
        upsertPresence({ cevrimici: false, yaziyor_konusma_id: null });
    };
    window.addEventListener('pagehide', goOffline);
    window.addEventListener('beforeunload', goOffline);
    document.addEventListener('visibilitychange', () => {
        // Sekme değiştirince hemen offline yapma (yanlış "çevrimdışı" hatası)
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
