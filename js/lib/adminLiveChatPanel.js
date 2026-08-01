/**
 * YAZİYO — Admin Live Chat paneli (paylaşılan)
 * admin-live-chat sayfası + admin-egitimlerim sekmesi
 */
import {
    ensureUserConversation,
    fetchAdminConversations,
    fetchMessages,
    sendTextMessage,
    sendLinkMessage,
    sendImageMessage,
    sendFileMessage,
    sendAudioMessage,
    deleteChatMessage,
    formatAudioDuration,
    markMessagesSeen,
    upsertPresence,
    clearTyping,
    fetchPresence,
    subscribeConversation,
    subscribePresence,
    subscribeConversationList,
    isTypingActive,
    formatPresenceView,
    formatMessageTime,
    formatMessageDateLabel,
    getSignedFileUrl,
    isLiveChatMissingError,
    HEARTBEAT_MS,
} from './liveChatApi.js';
import { buildAudioPlayerHtml, bindAudioPlayerRoot, formatAudioDurationLabel } from './liveChatAudioUi.js';

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

function formatShortTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Istanbul',
    });
}

/**
 * @param {object} options
 * @param {(msg: string, type?: string) => void} options.showToast
 * @param {(userId: string) => void} [options.onUserSelect] — konuşma seçilince kullanıcı select senkronu
 * @param {string} [options.rootSelector='#alc-app']
 */
export function createAdminLiveChatPanel(options = {}) {
    const showToast = options.showToast || (() => {});
    const onUserSelect = options.onUserSelect || null;

    const els = {};
    let conversations = [];
    let active = null;
    let messages = [];
    let userPresence = null;
    let unsubMsg = () => {};
    let unsubPresence = () => {};
    let unsubList = () => {};
    let typingTimer = null;
    let heartbeatTimer = null;
    let presenceUiTimer = null;
    let mediaRecorder = null;
    let audioChunks = [];
    let recordStartedAt = 0;
    let recordTickTimer = null;
    let recordSeconds = 0;
    let started = false;
    let eventsBound = false;
    /** @type {null | { kind: 'image'|'file'|'audio', file: File|Blob, name: string, mime?: string, durationSec?: number, previewUrl?: string }} */
    let pendingAttach = null;
    const signedCache = new Map();

    function stopRecordTicker() {
        clearInterval(recordTickTimer);
        recordTickTimer = null;
    }

    function startRecordTicker() {
        recordStartedAt = Date.now();
        recordSeconds = 0;
        stopRecordTicker();
        const paint = () => {
            recordSeconds = Math.floor((Date.now() - recordStartedAt) / 1000);
            if (els.btnAudio) {
                els.btnAudio.innerHTML = `<i class="fa-solid fa-stop"></i> ${formatAudioDuration(recordSeconds)}`;
            }
        };
        paint();
        recordTickTimer = setInterval(paint, 250);
    }

    function cacheEls() {
        els.missing = document.getElementById('alc-missing');
        els.app = document.getElementById('alc-app');
        els.search = document.getElementById('alc-search');
        els.list = document.getElementById('alc-convo-list');
        els.placeholder = document.getElementById('alc-chat-placeholder');
        els.chatActive = document.getElementById('alc-chat-active');
        els.chatCard = els.chatActive?.closest('.alc-chat-card')
            || els.placeholder?.closest('.alc-chat-card')
            || document.querySelector('#alc-app .alc-chat-card');
        els.userName = document.getElementById('alc-user-name');
        els.userDot = document.getElementById('alc-user-dot');
        els.userStatus = document.getElementById('alc-user-status');
        els.userLast = document.getElementById('alc-user-last');
        els.userEmail = document.getElementById('alc-user-email');
        els.messages = document.getElementById('alc-messages');
        els.typing = document.getElementById('alc-typing');
        els.form = document.getElementById('alc-form');
        els.input = document.getElementById('alc-input');
        els.send = document.getElementById('alc-send');
        els.btnAttach = document.getElementById('alc-btn-attach');
        els.btnAudio = document.getElementById('alc-btn-audio');
        els.btnLink = document.getElementById('alc-btn-link');
        els.fileAttach = document.getElementById('alc-file-attach');
        els.pending = document.getElementById('alc-pending');
        els.pendingPreview = document.getElementById('alc-pending-preview');
        els.pendingCancel = document.getElementById('alc-pending-cancel');
        els.pendingSend = document.getElementById('alc-pending-send');
        els.linkModal = document.getElementById('alc-link-modal');
        els.linkLabel = document.getElementById('alc-link-label');
        els.linkUrl = document.getElementById('alc-link-url');
        els.linkCancel = document.getElementById('alc-link-cancel');
        els.linkSend = document.getElementById('alc-link-send');
        return !!els.app;
    }

    function syncSendEnabled() {
        const hasText = !!(els.input?.value || '').trim();
        if (els.send) els.send.disabled = !(hasText || pendingAttach);
    }

    function clearPendingAttach() {
        if (pendingAttach?.previewUrl) {
            try { URL.revokeObjectURL(pendingAttach.previewUrl); } catch (_) { /* ignore */ }
        }
        pendingAttach = null;
        if (els.pending) els.pending.classList.add('hidden');
        if (els.pendingPreview) els.pendingPreview.innerHTML = '';
        syncSendEnabled();
    }

    function setPendingAttach(next) {
        clearPendingAttach();
        pendingAttach = next;
        if (!els.pending || !els.pendingPreview || !next) return;

        let html = '';
        if (next.kind === 'image' && next.previewUrl) {
            html = `
                <img src="${escapeHtml(next.previewUrl)}" alt="Önizleme" class="alc-pending-img">
                <div class="alc-pending-meta">
                    <strong>Görsel hazır</strong>
                    <span>${escapeHtml(next.name)}</span>
                    <span class="alc-pending-hint">Göndermek için Gönder’e basın</span>
                </div>`;
        } else if (next.kind === 'audio') {
            const dur = formatAudioDurationLabel(next.durationSec || 0);
            html = `
                <div class="alc-pending-audio-icon"><i class="fa-solid fa-microphone"></i></div>
                <div class="alc-pending-meta">
                    <strong>Ses kaydı hazır</strong>
                    <span>${escapeHtml(dur)}</span>
                    <span class="alc-pending-hint">Göndermek için Gönder’e basın</span>
                </div>`;
        } else {
            html = `
                <div class="alc-pending-audio-icon"><i class="fa-solid fa-paperclip"></i></div>
                <div class="alc-pending-meta">
                    <strong>Dosya hazır</strong>
                    <span>${escapeHtml(next.name)}</span>
                    <span class="alc-pending-hint">Göndermek için Gönder’e basın</span>
                </div>`;
        }

        els.pendingPreview.innerHTML = html;
        els.pending.classList.remove('hidden');
        syncSendEnabled();
    }

    async function sendPendingAttach() {
        if (!active || !pendingAttach) return false;
        const draft = pendingAttach;
        const { kind, file, name, durationSec } = draft;

        els.pendingSend && (els.pendingSend.disabled = true);
        let result;
        if (kind === 'image') {
            result = await sendImageMessage(active.id, active.kullanici_id, file);
        } else if (kind === 'audio') {
            const ext = (file.type || '').includes('ogg') ? 'ogg' : 'webm';
            result = await sendAudioMessage(
                active.id,
                active.kullanici_id,
                file,
                name || `ses_${Date.now()}.${ext}`,
                durationSec,
            );
        } else {
            result = await sendFileMessage(active.id, active.kullanici_id, file);
        }

        els.pendingSend && (els.pendingSend.disabled = false);

        if (result.error) {
            showToast(result.error.message || 'Gönderilemedi', 'error');
            return false;
        }
        if (result.data) {
            if (kind === 'audio' && result.data.sure_sn == null && durationSec != null) {
                result.data.sure_sn = durationSec;
            }
            upsertLocalMessage(result.data);
            await renderMessages();
            await loadConversations();
        }
        clearPendingAttach();
        showToast(kind === 'audio'
            ? `Ses gönderildi (${formatAudioDurationLabel(durationSec || 0)})`
            : 'Gönderildi');
        return true;
    }

    function showMissing() {
        els.missing?.classList.remove('hidden');
        els.app?.classList.add('hidden');
    }

    function renderList() {
        if (!els.list) return;
        const q = (els.search?.value || '').trim().toLowerCase();
        const filtered = conversations.filter((c) => {
            if (!q) return true;
            return (c.user_name || '').toLowerCase().includes(q)
                || (c.user_email || '').toLowerCase().includes(q)
                || (c.son_mesaj_ozet || '').toLowerCase().includes(q);
        });

        if (!filtered.length) {
            els.list.innerHTML = `<p class="p-4 text-sm text-light-text-secondary">Konuşma yok.</p>`;
            return;
        }

        els.list.innerHTML = filtered.map((c) => `
            <button type="button" class="alc-convo${active?.id === c.id ? ' active' : ''}" data-convo="${c.id}">
                <div class="alc-convo-top">
                    <span class="alc-convo-name">${escapeHtml(c.user_name)}</span>
                    <span class="flex items-center gap-2">
                        ${c.unread ? `<span class="alc-unread">${c.unread > 99 ? '99+' : c.unread}</span>` : ''}
                        <span class="alc-convo-time">${escapeHtml(formatShortTime(c.son_mesaj_at))}</span>
                    </span>
                </div>
                <p class="alc-convo-preview">${escapeHtml(c.son_mesaj_ozet || 'Henüz mesaj yok')}</p>
            </button>
        `).join('');
    }

    function updateUserPresenceUI() {
        if (!active) return;
        const view = formatPresenceView(userPresence);
        els.userDot?.classList.toggle('on', view.online);
        if (els.userStatus) els.userStatus.textContent = view.statusText;
        // Çevrimiçiyken son görülme satırını tamamen gizle
        if (els.userLast) {
            els.userLast.hidden = true;
            els.userLast.textContent = '';
        }
        const typing = isTypingActive(userPresence, active.id);
        if (els.typing) {
            els.typing.hidden = !typing;
            els.typing.textContent = typing ? `${active.user_name} yazıyor...` : '';
        }
    }

    async function resolveMedia(msg) {
        if (!msg.dosya_url) return null;
        if (signedCache.has(msg.dosya_url)) return signedCache.get(msg.dosya_url);
        const url = await getSignedFileUrl(msg.dosya_url);
        if (url) signedCache.set(msg.dosya_url, url);
        return url;
    }

    async function renderMessages() {
        if (!els.messages) return;
        if (!messages.length) {
            els.messages.innerHTML = `<div class="alc-chat-empty" style="min-height:12rem">Henüz mesaj yok. İlk mesajı siz gönderin.</div>`;
            return;
        }

        // Medya URL'lerini paralel çöz — sıralı await gecikmesini kaldır
        await Promise.all(
            messages
                .filter((m) => m.dosya_url && (m.tip === 'image' || m.tip === 'audio' || m.tip === 'file'))
                .map((m) => resolveMedia(m)),
        );

        let html = '';
        let lastDay = '';
        for (const msg of messages) {
            const day = formatMessageDateLabel(msg.created_at);
            if (day !== lastDay) {
                lastDay = day;
                html += `<div class="alc-day"><span>${escapeHtml(day)}</span></div>`;
            }
            const mine = msg.gonderen_rol === 'admin';
            let body = '';
            if (msg.tip === 'image') {
                const url = msg.dosya_url ? signedCache.get(msg.dosya_url) : null;
                body = url
                    ? `<img class="alc-media-img" src="${escapeHtml(url)}" alt="Görsel" loading="lazy">`
                    : escapeHtml(msg.icerik || 'Görsel');
            } else if (msg.tip === 'audio') {
                const url = msg.dosya_url ? signedCache.get(msg.dosya_url) : null;
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
                    ? buildAudioPlayerHtml(url, durSec != null ? durSec : 'Ses', 'alc')
                    : `<span class="alc-audio-dur"><i class="fa-solid fa-microphone"></i> ${escapeHtml(formatAudioDurationLabel(durSec || 0))}</span>`;
            } else if (msg.tip === 'file') {
                const url = msg.dosya_url ? signedCache.get(msg.dosya_url) : null;
                const name = escapeHtml(msg.dosya_adi || msg.icerik || 'Dosya');
                body = url
                    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-paperclip"></i> ${name}</a>`
                    : name;
            } else {
                body = linkify(msg.icerik || '');
            }

            const seen = mine && msg.goruldu ? '<span>Görüldü</span>' : '';
            html += `
                <div class="alc-row ${mine ? 'mine' : 'theirs'}" data-msg-id="${escapeHtml(msg.id)}">
                    <div class="alc-bubble">
                        <div class="alc-bubble-top">
                            <div class="alc-body">${body}</div>
                            <button type="button" class="alc-del-msg" data-del-msg="${escapeHtml(msg.id)}" title="Mesajı sil" aria-label="Mesajı sil">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                        <div class="alc-meta">
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

    function removeLocalMessage(id) {
        if (!id) return;
        messages = messages.filter((m) => m.id !== id);
    }

    async function handleDeleteMessage(id) {
        const msg = messages.find((m) => m.id === id);
        if (!msg) return;
        if (!confirm('Bu mesaj her iki taraftan da silinecek. Emin misiniz?')) return;
        const { error } = await deleteChatMessage(msg);
        if (error) {
            showToast(error.message || 'Mesaj silinemedi', 'error');
            return;
        }
        removeLocalMessage(id);
        await renderMessages();
        await loadConversations();
        showToast('Mesaj silindi');
    }

    function upsertLocalMessage(msg) {
        if (!msg?.id) return;
        const idx = messages.findIndex((m) => m.id === msg.id);
        if (idx >= 0) messages[idx] = { ...messages[idx], ...msg };
        else messages.push(msg);
        messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    async function loadConversations() {
        const { data, error } = await fetchAdminConversations();
        if (error) {
            if (isLiveChatMissingError(error)) {
                showMissing();
                return { ok: false, missing: true };
            }
            showToast(error.message || 'Konuşmalar yüklenemedi', 'error');
            return { ok: false };
        }
        conversations = data || [];
        if (active) {
            active = conversations.find((c) => c.id === active.id) || active;
        }
        renderList();
        return { ok: true };
    }

    async function selectConversation(id, { syncSelect = true } = {}) {
        let convo = conversations.find((c) => c.id === id);
        if (!convo) {
            await loadConversations();
            convo = conversations.find((c) => c.id === id);
        }
        if (!convo) return;

        unsubMsg();
        active = convo;
        messages = [];
        userPresence = null;

        if (els.placeholder) {
            els.placeholder.classList.add('hidden');
            els.placeholder.setAttribute('hidden', '');
            els.placeholder.style.display = 'none';
        }
        if (els.chatActive) {
            els.chatActive.classList.remove('hidden');
            els.chatActive.removeAttribute('hidden');
            els.chatActive.style.display = '';
        }
        els.chatCard?.classList.add('alc-chat-open');
        if (els.userName) els.userName.textContent = convo.user_name;
        if (els.userEmail) els.userEmail.textContent = convo.user_email || '';
        renderList();

        if (syncSelect && onUserSelect && convo.kullanici_id) {
            onUserSelect(convo.kullanici_id);
        }

        const [{ data }, { data: presence }] = await Promise.all([
            fetchMessages(convo.id),
            fetchPresence(convo.kullanici_id),
        ]);
        messages = data || [];
        userPresence = presence;
        updateUserPresenceUI();
        await markMessagesSeen(convo.id, 'admin');
        messages = messages.map((m) => (
            m.gonderen_rol === 'kullanici' ? { ...m, goruldu: true } : m
        ));
        await renderMessages();
        await loadConversations();

        unsubMsg = subscribeConversation(convo.id, {
            onInsert: async (msg) => {
                upsertLocalMessage(msg);
                if (msg.gonderen_rol === 'kullanici') {
                    await markMessagesSeen(convo.id, 'admin');
                    msg.goruldu = true;
                }
                await renderMessages();
                await loadConversations();
            },
            onUpdate: async (msg) => {
                upsertLocalMessage(msg);
                await renderMessages();
            },
            onDelete: async (old) => {
                removeLocalMessage(old?.id);
                await renderMessages();
                await loadConversations();
            },
        });

        els.input?.focus();
    }

    /** Seçili kullanıcı için konuşmayı aç (yoksa oluştur) */
    async function openForUser(userId, userMeta = {}) {
        if (!userId) {
            showToast('Önce kullanıcı seçin', 'error');
            return;
        }
        const { data: convo, error } = await ensureUserConversation(userId);
        if (error) {
            if (isLiveChatMissingError(error)) {
                showMissing();
                return;
            }
            showToast(error.message || 'Konuşma açılamadı', 'error');
            return;
        }
        await loadConversations();
        let row = conversations.find((c) => c.id === convo.id);
        if (!row) {
            row = {
                ...convo,
                unread: 0,
                user_name: userMeta.user_name || userMeta.full_name || userMeta.email || 'Kullanıcı',
                user_email: userMeta.email || '',
            };
            conversations = [row, ...conversations.filter((c) => c.id !== row.id)];
        } else if (userMeta.user_name || userMeta.full_name) {
            row.user_name = userMeta.user_name || userMeta.full_name || row.user_name;
            row.user_email = userMeta.email || row.user_email;
        }
        await selectConversation(row.id, { syncSelect: false });
    }

    async function heartbeat() {
        await upsertPresence({
            cevrimici: true,
            yaziyor_konusma_id: active && document.activeElement === els.input && els.input.value.trim()
                ? active.id
                : null,
        });
        if (active) {
            const { data } = await fetchPresence(active.kullanici_id);
            if (data) {
                userPresence = data;
                updateUserPresenceUI();
            }
        }
    }

    function openLinkModal() {
        els.linkModal?.classList.add('open');
        els.linkModal?.setAttribute('aria-hidden', 'false');
        els.linkUrl?.focus();
    }

    function closeLinkModal() {
        els.linkModal?.classList.remove('open');
        els.linkModal?.setAttribute('aria-hidden', 'true');
        if (els.linkLabel) els.linkLabel.value = '';
        if (els.linkUrl) els.linkUrl.value = '';
    }

    async function toggleAudio() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            stopRecordTicker();
            const elapsed = Math.max(1, Math.floor((Date.now() - recordStartedAt) / 1000));
            recordSeconds = elapsed;
            mediaRecorder.stop();
            els.btnAudio?.classList.remove('recording');
            if (els.btnAudio) els.btnAudio.innerHTML = '<i class="fa-solid fa-microphone"></i> Ses';
            return;
        }
        if (!active) {
            showToast('Önce bir konuşma seçin', 'error');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunks = [];
            const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
            mediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
            mediaRecorder.ondataavailable = (e) => {
                if (e.data?.size) audioChunks.push(e.data);
            };
            mediaRecorder.onstop = () => {
                stream.getTracks().forEach((t) => t.stop());
                stopRecordTicker();
                const durationSec = Math.max(1, recordSeconds || Math.floor((Date.now() - recordStartedAt) / 1000));
                const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
                if (!blob.size) {
                    showToast('Ses kaydı boş', 'error');
                    return;
                }
                const ext = (blob.type || '').includes('ogg') ? 'ogg' : 'webm';
                setPendingAttach({
                    kind: 'audio',
                    file: blob,
                    name: `ses_${Date.now()}.${ext}`,
                    mime: blob.type || 'audio/webm',
                    durationSec,
                });
                showToast(`Kayıt hazır (${formatAudioDurationLabel(durationSec)}). Gönder’e basın.`);
            };
            mediaRecorder.start();
            els.btnAudio?.classList.add('recording');
            startRecordTicker();
        } catch (err) {
            stopRecordTicker();
            showToast('Mikrofon izni gerekli', 'error');
            console.warn(err);
        }
    }

    function bindEvents() {
        if (eventsBound) return;
        eventsBound = true;

        els.list?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-convo]');
            if (!btn) return;
            selectConversation(btn.dataset.convo);
        });

        els.messages?.addEventListener('click', (e) => {
            const del = e.target.closest('[data-del-msg]');
            if (!del) return;
            handleDeleteMessage(del.dataset.delMsg);
        });

        els.search?.addEventListener('input', renderList);

        els.input?.addEventListener('input', () => {
            syncSendEnabled();
            els.input.style.height = 'auto';
            els.input.style.height = `${Math.min(els.input.scrollHeight, 112)}px`;
            clearTimeout(typingTimer);
            const has = !!els.input.value.trim();
            if (has && active) {
                upsertPresence({ cevrimici: true, yaziyor_konusma_id: active.id });
                typingTimer = setTimeout(() => clearTyping(), 2800);
            } else {
                clearTyping();
            }
        });

        els.input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                els.form?.requestSubmit();
            }
        });

        els.form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!active) return;

            if (pendingAttach) {
                els.send.disabled = true;
                await sendPendingAttach();
                syncSendEnabled();
                return;
            }

            const text = els.input.value.trim();
            if (!text) return;
            els.send.disabled = true;
            const { data, error } = await sendTextMessage(active.id, text, { isAdmin: true });
            if (error) {
                showToast(error.message || 'Gönderilemedi', 'error');
                syncSendEnabled();
                return;
            }
            els.input.value = '';
            els.input.style.height = 'auto';
            clearTyping();
            if (data) {
                upsertLocalMessage(data);
                await renderMessages();
                await loadConversations();
            }
            syncSendEnabled();
        });

        els.btnAttach?.addEventListener('click', () => {
            if (!active) return showToast('Önce bir konuşma seçin', 'error');
            els.fileAttach?.click();
        });
        els.btnAudio?.addEventListener('click', toggleAudio);
        els.btnLink?.addEventListener('click', () => {
            if (!active) return showToast('Önce bir konuşma seçin', 'error');
            openLinkModal();
        });

        els.fileAttach?.addEventListener('change', () => {
            const file = els.fileAttach.files?.[0];
            els.fileAttach.value = '';
            if (!file || !active) return;
            const isImage = (file.type || '').startsWith('image/');
            const previewUrl = isImage ? URL.createObjectURL(file) : null;
            setPendingAttach({
                kind: isImage ? 'image' : 'file',
                file,
                name: file.name || (isImage ? 'görsel' : 'dosya'),
                mime: file.type || '',
                previewUrl: previewUrl || undefined,
            });
            showToast(isImage
                ? 'Görsel seçildi. Göndermek için Gönder’e basın.'
                : 'Dosya seçildi. Göndermek için Gönder’e basın.');
        });

        els.pendingCancel?.addEventListener('click', () => clearPendingAttach());
        els.pendingSend?.addEventListener('click', async () => {
            if (!active || !pendingAttach) return;
            await sendPendingAttach();
        });

        els.linkCancel?.addEventListener('click', closeLinkModal);
        els.linkModal?.addEventListener('click', (e) => {
            if (e.target === els.linkModal) closeLinkModal();
        });
        els.linkSend?.addEventListener('click', async () => {
            if (!active) return;
            const { data, error } = await sendLinkMessage(
                active.id,
                els.linkUrl?.value || '',
                els.linkLabel?.value || '',
            );
            if (error) return showToast(error.message || 'Bağlantı paylaşılamadı', 'error');
            closeLinkModal();
            if (data) {
                upsertLocalMessage(data);
                await renderMessages();
                await loadConversations();
            }
            showToast('Bağlantı paylaşıldı');
        });

        const goOffline = () => {
            upsertPresence({ cevrimici: false, yaziyor_konusma_id: null });
        };
        window.addEventListener('pagehide', goOffline);
        window.addEventListener('beforeunload', goOffline);
        document.addEventListener('visibilitychange', () => {
            // Sekme değiştirince hemen offline yapma
            if (document.visibilityState === 'visible' && started) heartbeat();
            else if (document.visibilityState === 'hidden') clearTyping();
        });
    }

    async function start() {
        if (!cacheEls()) return { ok: false, reason: 'missing-dom' };
        bindEvents();

        const result = await loadConversations();
        if (result?.missing) return { ok: false, missing: true };

        if (!started) {
            started = true;
            await upsertPresence({ cevrimici: true, yaziyor_konusma_id: null });
            heartbeatTimer = setInterval(heartbeat, HEARTBEAT_MS);
            presenceUiTimer = setInterval(updateUserPresenceUI, 10_000);

            unsubList = subscribeConversationList({
                onChange: () => loadConversations(),
            });

            unsubPresence = subscribePresence({
                onChange: (row) => {
                    if (!active || !row) return;
                    if (row.kullanici_id !== active.kullanici_id) return;
                    userPresence = row;
                    updateUserPresenceUI();
                },
            });
        }

        return { ok: true };
    }

    function destroy() {
        unsubMsg();
        unsubPresence();
        unsubList();
        clearInterval(heartbeatTimer);
        clearInterval(presenceUiTimer);
        clearTimeout(typingTimer);
        upsertPresence({ cevrimici: false, yaziyor_konusma_id: null });
        started = false;
    }

    return {
        start,
        destroy,
        loadConversations,
        selectConversation,
        openForUser,
        getActive: () => active,
    };
}
