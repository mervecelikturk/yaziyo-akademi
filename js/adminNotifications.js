/**
 * YAZİYO — Admin bildirim paneli
 * Kullanıcı bildirim paneli ile aynı görünüm.
 * Türler: paket satışı, rütbe atlama, gelen mesaj.
 */

import { getSupabaseClient, initSupabaseClient } from './lib/supabase.js';
import {
    fetchAdminBildirimler,
    markAllAdminBildirimOkundu,
    deleteAdminBildirim,
} from './lib/egitimPaketleriApi.js';
import { playNotificationSound } from './notifications.js';

const MAX_NOTIFICATIONS = 10;
export const ADMIN_NAV_NOTIFICATION_TYPES = ['paket_satis', 'rutbe', 'iletisim'];

let _client = null;
let _modalUiBound = false;
let _deleteBound = false;
let _realtimeChannel = null;
let _lastUnread = 0;

function isAdminHeaderPage() {
    return document.getElementById('main-header')?.dataset?.yaziyoAdminHeader === '1';
}

function pageHref(file) {
    return window.YaziyoPaths?.pageHref?.(file) || `../${String(file).replace(/\.html$/i, '')}/`;
}

function notificationHref(tur) {
    if (tur === 'paket_satis') return pageHref('adminEgitimPaketleri.html');
    if (tur === 'rutbe') return pageHref('kullanicilar.html');
    if (tur === 'iletisim') return pageHref('mesajlar.html');
    return '';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
}

function ensureNotificationModal() {
    if (document.getElementById('notification-modal')) return;

    const wrap = document.createElement('div');
    wrap.innerHTML = `
    <div id="notification-modal" class="fixed inset-0 z-[100] hidden items-center justify-center">
        <div id="notification-backdrop"
            class="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 transition-opacity duration-300"></div>
        <div id="notification-content"
            class="relative w-full max-w-sm mx-4 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-xl shadow-2xl p-6 transform scale-95 opacity-0 transition-all duration-300 flex flex-col items-center">
            <button id="notification-close"
                class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg hover:text-red-500 transition-all duration-300"
                aria-label="Kapat">
                <i class="fa-solid fa-xmark text-lg"></i>
            </button>
            <div class="w-16 h-16 rounded-full bg-yaziyo-gold/10 flex items-center justify-center text-yaziyo-gold text-3xl mb-5 shadow-glow-gold">
                <i class="fa-solid fa-bell"></i>
            </div>
            <h3 class="text-xl font-poppins font-bold text-light-text dark:text-dark-text mb-2 transition-colors duration-300 text-center">
                Bildirimler</h3>
            <p id="notification-empty-msg"
                class="text-light-text-secondary dark:text-dark-text-secondary font-inter text-center mb-6 transition-colors duration-300 text-sm">
                Henüz yeni bildiriminiz yok.
            </p>
            <div class="w-full h-px bg-light-border dark:border-dark-border mb-4 transition-colors duration-300"></div>
            <p id="notification-footer-msg" class="hidden text-xs text-yaziyo-gold font-inter font-medium tracking-wide text-center"></p>
        </div>
    </div>`;
    document.body.appendChild(wrap.firstElementChild);
}

function ensureNotificationListContainer() {
    const content = document.getElementById('notification-content');
    if (!content) return null;

    let list = document.getElementById('notification-list');
    if (list) return list;

    const footer = document.getElementById('notification-footer-msg');
    if (footer) footer.classList.add('hidden');

    list = document.createElement('div');
    list.id = 'notification-list';
    list.className = 'w-full max-h-64 overflow-y-auto space-y-2 mb-4 text-left hidden';

    const emptyMsg = document.getElementById('notification-empty-msg');
    if (emptyMsg) {
        emptyMsg.parentNode.insertBefore(list, emptyMsg);
    } else {
        content.appendChild(list);
    }
    return list;
}

function updateNotificationBadge(unreadCount) {
    const badge = document.querySelector('#notification-btn span.absolute');
    if (!badge) return;
    if (unreadCount > 0) {
        badge.classList.remove('hidden');
        badge.classList.add('animate-pulse');
    } else {
        badge.classList.add('hidden');
        badge.classList.remove('animate-pulse');
    }
}

function notificationIcon(tur) {
    if (tur === 'paket_satis') return 'fa-box-open text-yaziyo-gold';
    if (tur === 'rutbe') return 'fa-medal text-yaziyo-gold';
    if (tur === 'iletisim') return 'fa-envelope text-yaziyo-gold';
    return 'fa-bell text-yaziyo-gold';
}

export function renderAdminNotificationPanel(notifications) {
    const list = ensureNotificationListContainer();
    const emptyMsg = document.getElementById('notification-empty-msg');
    const footerMsg = document.getElementById('notification-footer-msg');
    if (!list || !emptyMsg) return;

    if (footerMsg) {
        footerMsg.classList.add('hidden');
        footerMsg.innerHTML = '';
    }

    const unread = notifications.filter((n) => !n.okundu).length;
    updateNotificationBadge(unread);
    _lastUnread = unread;

    if (notifications.length === 0) {
        list.classList.add('hidden');
        list.innerHTML = '';
        emptyMsg.classList.remove('hidden');
        emptyMsg.textContent = 'Henüz yeni bildiriminiz yok.';
        return;
    }

    emptyMsg.classList.add('hidden');
    list.classList.remove('hidden');
    list.innerHTML = notifications.map((n) => {
        const date = new Date(n.created_at).toLocaleString('tr-TR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
        const unreadClass = n.okundu ? '' : 'border-yaziyo-gold/40 bg-yaziyo-gold/5';
        const href = notificationHref(n.tur);
        return `<div class="p-3 rounded-xl border border-light-border dark:border-dark-border ${unreadClass} flex items-start gap-2 ${href ? 'cursor-pointer' : ''}" data-notification-id="${n.id}" ${href ? `data-notification-href="${escapeHtml(href)}"` : ''}>
            <i class="fa-solid ${notificationIcon(n.tur)} mt-1 shrink-0"></i>
            <div class="min-w-0 flex-1">
                <p class="font-poppins font-bold text-sm text-light-text dark:text-dark-text">${escapeHtml(n.baslik)}</p>
                <p class="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1 leading-relaxed">${escapeHtml(n.mesaj)}</p>
                <p class="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-2 opacity-70">${date}</p>
            </div>
            <button type="button"
                class="notification-delete-btn shrink-0 p-1.5 text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-lg transition-colors"
                data-notification-delete="${n.id}"
                title="Bildirimi sil"
                aria-label="Bildirimi sil">
                <i class="fa-solid fa-trash-can text-sm"></i>
            </button>
        </div>`;
    }).join('');

    bindNotificationListHandlers();
}

function bindNotificationListHandlers() {
    const list = document.getElementById('notification-list');
    if (!list || _deleteBound) return;
    _deleteBound = true;

    list.addEventListener('click', async (e) => {
        const delBtn = e.target.closest('[data-notification-delete]');
        if (delBtn) {
            e.preventDefault();
            e.stopPropagation();
            const id = delBtn.getAttribute('data-notification-delete');
            if (!id || !_client) return;
            delBtn.disabled = true;
            const { error } = await deleteAdminBildirim(id, _client);
            if (error) {
                delBtn.disabled = false;
                return;
            }
            const notifications = await loadAdminNotifications(_client);
            renderAdminNotificationPanel(notifications);
            return;
        }

        const card = e.target.closest('[data-notification-href]');
        const href = card?.getAttribute('data-notification-href');
        if (href) {
            window.location.href = href;
        }
    });
}

export async function loadAdminNotifications(client = _client) {
    if (!client) return [];
    const { data, error } = await fetchAdminBildirimler(
        client,
        MAX_NOTIFICATIONS,
        ADMIN_NAV_NOTIFICATION_TYPES,
    );
    if (error) {
        console.error('Admin bildirim yükleme hatası:', error);
        return [];
    }
    return data || [];
}

export async function initAdminNotifications(client) {
    if (!client) return;
    _client = client;
    ensureNotificationModal();

    const notifications = await loadAdminNotifications(client);
    renderAdminNotificationPanel(notifications);
}

export async function refreshAdminNotificationsForModal(client = _client) {
    if (!client) return [];
    _client = client;
    const notifications = await loadAdminNotifications(client);
    renderAdminNotificationPanel(notifications);
    await markAllAdminBildirimOkundu(client, ADMIN_NAV_NOTIFICATION_TYPES);
    updateNotificationBadge(0);
    _lastUnread = 0;
    return notifications;
}

export async function openAdminNotificationModal() {
    ensureNotificationModal();
    const notificationModal = document.getElementById('notification-modal');
    const notificationBackdrop = document.getElementById('notification-backdrop');
    const notificationContent = document.getElementById('notification-content');
    if (!notificationModal) return;

    if (_client) {
        await refreshAdminNotificationsForModal(_client);
    }

    notificationModal.classList.remove('hidden');
    notificationModal.classList.add('flex');

    requestAnimationFrame(() => {
        notificationBackdrop?.classList.remove('opacity-0');
        notificationContent?.classList.remove('scale-95', 'opacity-0');
        notificationContent?.classList.add('scale-100', 'opacity-100');
    });
}

export function closeAdminNotificationModal() {
    const notificationModal = document.getElementById('notification-modal');
    const notificationBackdrop = document.getElementById('notification-backdrop');
    const notificationContent = document.getElementById('notification-content');
    if (!notificationModal) return;

    notificationBackdrop?.classList.add('opacity-0');
    notificationContent?.classList.remove('scale-100', 'opacity-100');
    notificationContent?.classList.add('scale-95', 'opacity-0');

    setTimeout(() => {
        notificationModal.classList.remove('flex');
        notificationModal.classList.add('hidden');
    }, 300);
}

export function bindAdminNotificationModal() {
    if (_modalUiBound || typeof document === 'undefined') return;
    _modalUiBound = true;
    ensureNotificationModal();

    const emptyMsg = document.getElementById('notification-empty-msg');
    if (emptyMsg) emptyMsg.textContent = 'Henüz yeni bildiriminiz yok.';
    document.getElementById('notification-footer-msg')?.classList.add('hidden');

    document.addEventListener('click', (e) => {
        if (!isAdminHeaderPage()) return;
        if (e.target.closest('#notification-btn')) {
            e.preventDefault();
            openAdminNotificationModal();
            return;
        }
        if (e.target.closest('#notification-close') || e.target.id === 'notification-backdrop') {
            closeAdminNotificationModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (!isAdminHeaderPage()) return;
        const modal = document.getElementById('notification-modal');
        if (modal && !modal.classList.contains('hidden')) {
            closeAdminNotificationModal();
        }
    });
}

function subscribeRealtime(client) {
    if (!client || _realtimeChannel) return;
    try {
        _realtimeChannel = client
            .channel('yonetici-bildirimleri-nav')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'yonetici_bildirimleri' },
                async (payload) => {
                    const tur = payload?.new?.tur;
                    if (tur && !ADMIN_NAV_NOTIFICATION_TYPES.includes(tur)) return;
                    playNotificationSound();
                    const notifications = await loadAdminNotifications(client);
                    renderAdminNotificationPanel(notifications);
                },
            )
            .subscribe();
    } catch (err) {
        console.warn('Admin bildirim aboneliği kurulamadı:', err);
    }
}

async function boot() {
    if (!isAdminHeaderPage()) return;

    bindAdminNotificationModal();
    await initSupabaseClient();
    const client = getSupabaseClient();
    if (!client) return;

    for (let i = 0; i < 10; i += 1) {
        const { data: { session } } = await client.auth.getSession();
        if (session) {
            await initAdminNotifications(client);
            subscribeRealtime(client);
            break;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }

    window.addEventListener('focus', async () => {
        if (!_client) return;
        const notifications = await loadAdminNotifications(_client);
        renderAdminNotificationPanel(notifications);
    });
}

if (typeof window !== 'undefined') {
    window.YaziyoAdminNotifications = {
        initAdminNotifications,
        loadAdminNotifications,
        renderAdminNotificationPanel,
        openAdminNotificationModal,
        closeAdminNotificationModal,
        bindAdminNotificationModal,
    };
    boot();
}
