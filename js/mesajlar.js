/**
 * YAZİYO - Admin mesajlar (iletişim formu)
 */
import { supabase } from './lib/supabase.js';

let allMessages = [];
let showUnreadOnly = false;
let activeReplyMessage = null;

const tbody = () => document.getElementById('messages-tbody');
const modal = () => document.getElementById('message-modal');
const modalBackdrop = () => document.getElementById('message-backdrop');
const modalContent = () => document.getElementById('message-content');
const replyModal = () => document.getElementById('reply-modal');
const replyBackdrop = () => document.getElementById('reply-backdrop');
const replyContent = () => document.getElementById('reply-content');
const deleteModal = () => document.getElementById('delete-message-modal');
const deleteBackdrop = () => document.getElementById('delete-message-backdrop');
const deleteContent = () => document.getElementById('delete-message-content');

let pendingDeleteId = null;

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatDateTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).replace(',', ' -');
}

function truncate(text, max = 80) {
    const t = (text || '').trim();
    if (t.length <= max) return t;
    return t.slice(0, max) + '...';
}

function showLoading() {
    const el = tbody();
    if (!el) return;
    el.innerHTML = `
        <tr>
            <td colspan="6" class="px-6 py-24 text-center">
                <div class="flex flex-col items-center gap-4">
                    <i class="fa-solid fa-circle-notch fa-spin text-4xl text-yaziyo-gold"></i>
                    <p class="text-sm text-light-text-secondary dark:text-dark-text-secondary">Mesajlar yükleniyor...</p>
                </div>
            </td>
        </tr>
    `;
}

function showSetupRequired() {
    const el = tbody();
    if (!el) return;
    el.innerHTML = `
        <tr>
            <td colspan="6" class="px-6 py-12">
                <div class="max-w-2xl mx-auto bg-orange-500/5 border border-orange-500/20 rounded-2xl p-8 text-center">
                    <i class="fa-solid fa-database text-4xl text-orange-500 mb-4"></i>
                    <h3 class="text-xl font-poppins font-bold mb-2">Veritabanı Kurulumu Gerekli</h3>
                    <p class="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
                        İletişim mesajları tablosu henüz oluşturulmamış. Supabase SQL Editor'da
                        <code class="text-yaziyo-gold">supabase/migrations/006_iletisim_mesajlari.sql</code>
                        dosyasını çalıştırın.
                    </p>
                </div>
            </td>
        </tr>
    `;
}

function showError(msg) {
    const el = tbody();
    if (!el) return;
    el.innerHTML = `
        <tr>
            <td colspan="6" class="px-6 py-16 text-center text-red-500 text-sm">${escapeHtml(msg)}</td>
        </tr>
    `;
}

function isHesapSilTalebi(mesaj) {
    return String(mesaj || '').trim().startsWith('[HESAP SİLME TALEBİ]');
}

function isSoruBildirimi(mesaj) {
    return String(mesaj || '').trim().startsWith('[SORU BİLDİRİMİ]');
}

function messageTypeLabel(mesaj) {
    if (isHesapSilTalebi(mesaj)) {
        return `<span class="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 mb-1">Hesap Silme</span>`;
    }
    if (isSoruBildirimi(mesaj)) {
        return `<span class="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 mb-1">Soru Bildirimi</span>`;
    }
    return '';
}

function statusBadge(m) {
    if (m.cevaplandi) {
        return `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800/50">
            <i class="fa-solid fa-check text-[8px]"></i>
            Cevaplandı
        </span>`;
    }
    if (!m.okundu) {
        return `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-900/50">
            <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            Okunmadı
        </span>`;
    }
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
        Okundu
    </span>`;
}

function renderTable() {
    const el = tbody();
    if (!el) return;

    const list = showUnreadOnly ? allMessages.filter((m) => !m.okundu && !m.cevaplandi) : allMessages;

    if (list.length === 0) {
        el.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-20 text-center">
                    <i class="fa-solid fa-inbox text-5xl mb-4 text-light-text-secondary dark:text-dark-text-secondary opacity-20"></i>
                    <p class="text-light-text-secondary dark:text-dark-text-secondary font-medium">
                        ${showUnreadOnly ? 'Okunmamış mesaj bulunmuyor.' : 'Henüz iletişim mesajı yok.'}
                    </p>
                </td>
            </tr>
        `;
        return;
    }

    el.innerHTML = list.map((m) => {
        const fullName = `${m.ad || ''} ${m.soyad || ''}`.trim() || 'İsimsiz';
        return `
            <tr class="hover:bg-light-bg/30 dark:hover:bg-dark-bg/20 transition-colors duration-200" data-id="${m.id}">
                <td class="px-6 py-4 text-sm whitespace-nowrap">${escapeHtml(formatDateTime(m.created_at))}</td>
                <td class="px-6 py-4 text-sm font-medium">${escapeHtml(fullName)}</td>
                <td class="px-6 py-4 text-sm text-light-text-secondary dark:text-dark-text-secondary">${escapeHtml(m.eposta)}</td>
                <td class="px-6 py-4 text-sm text-light-text-secondary dark:text-dark-text-secondary max-w-[200px]">
                    ${messageTypeLabel(m.mesaj)}
                    <span class="block truncate">${escapeHtml(truncate(m.mesaj))}</span>
                </td>
                <td class="px-6 py-4">${statusBadge(m)}</td>
                <td class="px-6 py-4 text-right">
                    <div class="flex flex-wrap justify-end items-center gap-1.5">
                        <button type="button" class="view-msg-btn px-2.5 py-1.5 rounded-lg bg-yaziyo-gold/10 text-yaziyo-gold hover:bg-yaziyo-gold hover:text-slate-900 text-[10px] font-bold transition-all duration-300" data-id="${m.id}">Görüntüle</button>
                        <button type="button" class="reply-msg-btn px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-bold hover:bg-blue-500 hover:text-white transition-all duration-300" data-id="${m.id}">Cevapla</button>
                        <button type="button" class="delete-msg-btn px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 text-[10px] font-bold hover:bg-red-500 hover:text-white transition-all duration-300" data-id="${m.id}">Sil</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

export async function fetchMessages() {
    if (!supabase) {
        showError('Supabase bağlantısı kurulamadı.');
        return;
    }

    showLoading();

    const { data, error } = await supabase
        .from('iletisim_mesajlari')
        .select('id, ad, soyad, eposta, mesaj, okundu, cevaplandi, cevap, cevap_tarihi, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        if (error.code === 'PGRST205' || error.code === 'PGRST116' || (error.message && error.message.includes('iletisim_mesajlari'))) {
            showSetupRequired();
            return;
        }
        console.error('Mesajlar yüklenemedi:', error);
        showError('Mesajlar yüklenirken bir hata oluştu.');
        return;
    }

    allMessages = data || [];
    renderTable();
}

async function markAsRead(id) {
    const msg = allMessages.find((m) => m.id === id);
    if (!msg || msg.okundu || !supabase) return;

    const { error } = await supabase
        .from('iletisim_mesajlari')
        .update({ okundu: true })
        .eq('id', id);

    if (!error) {
        msg.okundu = true;
        renderTable();
    }
}

function openMessageModal(msg) {
    const m = modal();
    const backdrop = modalBackdrop();
    const content = modalContent();
    if (!m || !backdrop || !content) return;

    document.getElementById('modal-sender-name').textContent = `${msg.ad || ''} ${msg.soyad || ''}`.trim();
    document.getElementById('modal-sender-email').textContent = msg.eposta || '-';
    document.getElementById('modal-date').textContent = formatDateTime(msg.created_at);

    const bodyEl = document.getElementById('modal-message-body');
    let bodyText = msg.mesaj || '';
    if (msg.cevaplandi && msg.cevap) {
        bodyText += `\n\n———\nGönderilen cevap (${formatDateTime(msg.cevap_tarihi)}):\n${msg.cevap}`;
    }
    bodyEl.textContent = bodyText;

    m.classList.remove('hidden');
    m.classList.add('flex');

    requestAnimationFrame(() => {
        backdrop.classList.remove('opacity-0');
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    });

    markAsRead(msg.id);
}

export function closeMessageModal() {
    const m = modal();
    const backdrop = modalBackdrop();
    const content = modalContent();
    if (!m || !backdrop || !content) return;

    backdrop.classList.add('opacity-0');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');

    setTimeout(() => {
        m.classList.remove('flex');
        m.classList.add('hidden');
    }, 300);
}

function setReplyFeedback({ error = '', success = '' } = {}) {
    const errEl = document.getElementById('reply-error');
    const okEl = document.getElementById('reply-success');
    if (!errEl || !okEl) return;

    if (error) {
        errEl.textContent = error;
        errEl.classList.remove('hidden');
    } else {
        errEl.classList.add('hidden');
        errEl.textContent = '';
    }

    if (success) {
        okEl.textContent = success;
        okEl.classList.remove('hidden');
    } else {
        okEl.classList.add('hidden');
        okEl.textContent = '';
    }
}

function updateReplyCharCount() {
    const textarea = document.getElementById('reply-text');
    const counter = document.getElementById('reply-char-count');
    if (!textarea || !counter) return;
    counter.textContent = `${textarea.value.length} / 2000`;
}

export function openReplyModal(msg) {
    const m = replyModal();
    const backdrop = replyBackdrop();
    const content = replyContent();
    if (!m || !backdrop || !content) return;

    activeReplyMessage = msg;
    const fullName = `${msg.ad || ''} ${msg.soyad || ''}`.trim() || 'İsimsiz';

    document.getElementById('reply-recipient').textContent = `${fullName} · ${msg.eposta || ''}`;
    document.getElementById('reply-original-preview').textContent = msg.mesaj || '';

    const textarea = document.getElementById('reply-text');
    if (textarea) {
        textarea.value = msg.cevap || '';
        textarea.disabled = false;
    }

    const sendBtn = document.getElementById('reply-send-btn');
    if (sendBtn) sendBtn.disabled = false;

    setReplyFeedback();
    updateReplyCharCount();

    m.classList.remove('hidden');
    m.classList.add('flex');

    requestAnimationFrame(() => {
        backdrop.classList.remove('opacity-0');
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
        textarea?.focus();
    });

    markAsRead(msg.id);
}

export function closeReplyModal() {
    const m = replyModal();
    const backdrop = replyBackdrop();
    const content = replyContent();
    if (!m || !backdrop || !content) return;

    backdrop.classList.add('opacity-0');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');

    setTimeout(() => {
        m.classList.remove('flex');
        m.classList.add('hidden');
        activeReplyMessage = null;
    }, 300);
}

async function sendReply() {
    if (!activeReplyMessage || !supabase) return;

    const textarea = document.getElementById('reply-text');
    const sendBtn = document.getElementById('reply-send-btn');
    const label = sendBtn?.querySelector('.reply-btn-label');
    const cevap = (textarea?.value || '').trim();

    if (!cevap) {
        setReplyFeedback({ error: 'Lütfen bir cevap yazın.' });
        return;
    }

    setReplyFeedback();
    if (sendBtn) sendBtn.disabled = true;
    if (label) label.textContent = 'Gönderiliyor...';

    const { data, error } = await supabase.rpc('gonder_iletisim_cevabi', {
        p_mesaj_id: activeReplyMessage.id,
        p_cevap: cevap,
    });

    if (sendBtn) sendBtn.disabled = false;
    if (label) label.textContent = 'Gönder';

    if (error) {
        console.error('Cevap gönderilemedi:', error);
        const msg = error.message?.includes('Could not find the function')
            ? 'Veritabanı fonksiyonu bulunamadı. 007_iletisim_cevap_bildirim.sql dosyasını Supabase\'de çalıştırın.'
            : (error.message || 'Cevap gönderilemedi.');
        setReplyFeedback({ error: msg });
        return;
    }

    if (data && data.success === false) {
        setReplyFeedback({ error: data.message || 'Bildirim gönderilemedi.' });
        return;
    }

    const msg = allMessages.find((m) => m.id === activeReplyMessage.id);
    if (msg) {
        msg.okundu = true;
        msg.cevaplandi = true;
        msg.cevap = cevap;
        msg.cevap_tarihi = new Date().toISOString();
    }

    renderTable();
    setReplyFeedback({ success: 'Cevap gönderildi. Kullanıcıya bildirim iletildi.' });

    setTimeout(() => closeReplyModal(), 1500);
}

function setDeleteModalError(message = '') {
    const errEl = document.getElementById('delete-message-error');
    if (!errEl) return;
    if (message) {
        errEl.textContent = message;
        errEl.classList.remove('hidden');
    } else {
        errEl.textContent = '';
        errEl.classList.add('hidden');
    }
}

export function openDeleteMessageModal(id) {
    const msg = allMessages.find((m) => m.id === id);
    if (!msg) return;

    const m = deleteModal();
    const backdrop = deleteBackdrop();
    const content = deleteContent();
    if (!m || !backdrop || !content) return;

    pendingDeleteId = id;
    setDeleteModalError();

    const fullName = `${msg.ad || ''} ${msg.soyad || ''}`.trim() || 'İsimsiz';
    const previewEl = document.getElementById('delete-message-preview');
    if (previewEl) {
        previewEl.textContent = `${fullName} · ${truncate(msg.mesaj, 120)}`;
    }

    const confirmBtn = document.getElementById('delete-message-confirm-btn');
    const label = confirmBtn?.querySelector('.delete-confirm-label');
    if (confirmBtn) confirmBtn.disabled = false;
    if (label) label.textContent = 'Evet, Sil';

    m.classList.remove('hidden');
    m.classList.add('flex');

    requestAnimationFrame(() => {
        backdrop.classList.remove('opacity-0');
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    });
}

export function closeDeleteMessageModal() {
    const m = deleteModal();
    const backdrop = deleteBackdrop();
    const content = deleteContent();
    if (!m || !backdrop || !content) return;

    backdrop.classList.add('opacity-0');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');

    setTimeout(() => {
        m.classList.remove('flex');
        m.classList.add('hidden');
        pendingDeleteId = null;
        setDeleteModalError();
    }, 300);
}

async function confirmDeleteMessage() {
    if (!pendingDeleteId || !supabase) return;

    const confirmBtn = document.getElementById('delete-message-confirm-btn');
    const label = confirmBtn?.querySelector('.delete-confirm-label');
    const id = pendingDeleteId;

    setDeleteModalError();
    if (confirmBtn) confirmBtn.disabled = true;
    if (label) label.textContent = 'Siliniyor...';

    const { error } = await supabase.from('iletisim_mesajlari').delete().eq('id', id);

    if (confirmBtn) confirmBtn.disabled = false;
    if (label) label.textContent = 'Evet, Sil';

    if (error) {
        console.error('Mesaj silinemedi:', error);
        setDeleteModalError('Mesaj silinemedi. Lütfen tekrar deneyin.');
        return;
    }

    allMessages = allMessages.filter((m) => m.id !== id);
    renderTable();
    closeDeleteMessageModal();
}

document.addEventListener('DOMContentLoaded', () => {
    fetchMessages();

    const refreshBtn = document.getElementById('refresh-messages-btn');
    refreshBtn?.addEventListener('click', () => {
        const icon = refreshBtn.querySelector('i');
        icon?.classList.add('fa-spin');
        fetchMessages().finally(() => {
            setTimeout(() => icon?.classList.remove('fa-spin'), 600);
        });
    });

    const filterBtn = document.getElementById('filter-unread-btn');
    filterBtn?.addEventListener('click', () => {
        showUnreadOnly = !showUnreadOnly;
        filterBtn.textContent = showUnreadOnly ? 'Tümünü Göster' : 'Okunmamışları Göster';
        renderTable();
    });

    tbody()?.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.view-msg-btn');
        const replyBtn = e.target.closest('.reply-msg-btn');
        const deleteBtn = e.target.closest('.delete-msg-btn');

        if (viewBtn) {
            const msg = allMessages.find((m) => m.id === viewBtn.dataset.id);
            if (msg) openMessageModal(msg);
        }
        if (replyBtn) {
            const msg = allMessages.find((m) => m.id === replyBtn.dataset.id);
            if (msg) openReplyModal(msg);
        }
        if (deleteBtn) {
            openDeleteMessageModal(deleteBtn.dataset.id);
        }
    });

    modalBackdrop()?.addEventListener('click', closeMessageModal);
    replyBackdrop()?.addEventListener('click', closeReplyModal);
    deleteBackdrop()?.addEventListener('click', closeDeleteMessageModal);

    document.querySelectorAll('[data-close-message-modal]').forEach((btn) => {
        btn.addEventListener('click', closeMessageModal);
    });

    document.querySelectorAll('[data-close-reply-modal]').forEach((btn) => {
        btn.addEventListener('click', closeReplyModal);
    });

    document.querySelectorAll('[data-close-delete-modal]').forEach((btn) => {
        btn.addEventListener('click', closeDeleteMessageModal);
    });

    document.getElementById('delete-message-confirm-btn')?.addEventListener('click', confirmDeleteMessage);

    document.getElementById('reply-send-btn')?.addEventListener('click', sendReply);

    document.getElementById('reply-text')?.addEventListener('input', updateReplyCharCount);
});

window.closeMessageModal = closeMessageModal;
window.closeReplyModal = closeReplyModal;
window.closeDeleteMessageModal = closeDeleteMessageModal;
