/**
 * YAZİYO - Bildirim paneli ve sesli uyarı
 */

const SOUND_URL = new URL('../sound effect/bildirim.mp3', import.meta.url).href;

const MAX_NOTIFICATIONS = 10;

let notificationAudio = null;
let _notificationSupabase = null;

function getNotificationAudio() {
    if (!notificationAudio) {
        notificationAudio = new Audio(SOUND_URL);
        notificationAudio.volume = 0.85;
    }
    return notificationAudio;
}

export function playNotificationSound() {
    try {
        const audio = getNotificationAudio();
        audio.currentTime = 0;
        audio.play().catch(() => {});
    } catch (e) {
        console.warn('Bildirim sesi çalınamadı:', e);
    }
}

/**
 * Bildirimleri Supabase'den yükler
 */
export async function loadNotifications(supabase) {
    if (!supabase) return [];

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return [];

    const { data, error } = await supabase
        .from('bildirimler')
        .select('id, baslik, mesaj, okundu, created_at, tur')
        .eq('kullanici_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(MAX_NOTIFICATIONS);

    if (error) {
        console.error('Bildirim yükleme hatası:', error);
        return [];
    }

    return data || [];
}

/**
 * Kullanıcının en fazla MAX_NOTIFICATIONS bildirimini tutar, eskilerini siler
 */
export async function trimNotificationsToMax(supabase, max = MAX_NOTIFICATIONS) {
    if (!supabase) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data: rows, error: fetchError } = await supabase
        .from('bildirimler')
        .select('id')
        .eq('kullanici_id', session.user.id)
        .order('created_at', { ascending: false });

    if (fetchError || !rows || rows.length <= max) return;

    const toDelete = rows.slice(max).map((r) => r.id);
    if (!toDelete.length) return;

    const { error: deleteError } = await supabase
        .from('bildirimler')
        .delete()
        .in('id', toDelete)
        .eq('kullanici_id', session.user.id);

    if (deleteError) {
        console.error('Eski bildirim temizleme hatası:', deleteError);
    }
}

/**
 * Tek bildirimi siler
 */
export async function deleteNotification(supabase, notificationId) {
    if (!supabase || !notificationId) return false;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;

    const { error } = await supabase
        .from('bildirimler')
        .delete()
        .eq('id', notificationId)
        .eq('kullanici_id', session.user.id);

    if (error) {
        console.error('Bildirim silme hatası:', error);
        return false;
    }

    return true;
}

/**
 * Tüm bildirimleri okundu işaretle
 */
export async function markAllNotificationsRead(supabase) {
    if (!supabase) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    await supabase
        .from('bildirimler')
        .update({ okundu: true })
        .eq('kullanici_id', session.user.id)
        .eq('okundu', false);
}

function ensureNotificationListContainer() {
    const content = document.getElementById('notification-content');
    if (!content) return null;

    let list = document.getElementById('notification-list');
    if (list) return list;

    const paragraphs = content.querySelectorAll('p');
    paragraphs.forEach((p, i) => {
        if (!p.id) {
            p.id = i === 0 ? 'notification-empty-msg' : 'notification-footer-msg';
        }
    });

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
    if (document.body.dataset.hideNotificationBadge === 'true') {
        badge.classList.add('hidden');
        badge.classList.remove('animate-pulse');
        return;
    }
    if (unreadCount > 0) {
        badge.classList.remove('hidden');
        badge.classList.add('animate-pulse');
    } else {
        badge.classList.add('hidden');
        badge.classList.remove('animate-pulse');
    }
}

/**
 * Bildirim panelini DOM'a render eder
 */
export function renderNotificationPanel(notifications) {
    const list = ensureNotificationListContainer();
    const emptyMsg = document.getElementById('notification-empty-msg');
    if (!list || !emptyMsg) return;

    const unread = notifications.filter((n) => !n.okundu).length;
    updateNotificationBadge(unread);

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
        const icon = n.tur === 'hedef'
            ? 'fa-bullseye text-yaziyo-gold'
            : n.tur === 'iletisim'
                ? 'fa-envelope text-yaziyo-gold'
                : n.tur === 'becayis'
                    ? 'fa-right-left text-yaziyo-gold'
                    : 'fa-bell text-yaziyo-gold';

        return `<div class="p-3 rounded-xl border border-light-border dark:border-dark-border ${unreadClass} flex items-start gap-2" data-notification-id="${n.id}">
            <i class="fa-solid ${icon} mt-1 shrink-0"></i>
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

    bindNotificationDeleteHandlers();
}

function bindNotificationDeleteHandlers() {
    const list = document.getElementById('notification-list');
    if (!list || list.dataset.deleteBound === 'true') return;
    list.dataset.deleteBound = 'true';

    list.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-notification-delete]');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();

        const id = btn.getAttribute('data-notification-delete');
        if (!id || !_notificationSupabase) return;

        btn.disabled = true;
        const ok = await deleteNotification(_notificationSupabase, id);
        if (!ok) {
            btn.disabled = false;
            return;
        }

        const notifications = await loadNotifications(_notificationSupabase);
        renderNotificationPanel(notifications);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Hedef tamamlandığında bildirimleri yeniler ve ses çalar
 */
export async function onGoalsCompleted(supabase, completedGoals = []) {
    if (!completedGoals.length) return;

    playNotificationSound();

    await trimNotificationsToMax(supabase);
    const notifications = await loadNotifications(supabase);
    renderNotificationPanel(notifications);

    window.dispatchEvent(new CustomEvent('yaziyo:notifications-updated', {
        detail: { completedGoals, unread: notifications.filter((n) => !n.okundu).length },
    }));
}

/**
 * Oturum açıkken bildirimleri yükle ve paneli hazırla
 */
export async function initNotifications(supabase) {
    if (!supabase) return;
    _notificationSupabase = supabase;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        updateNotificationBadge(0);
        return;
    }

    await trimNotificationsToMax(supabase);
    const notifications = await loadNotifications(supabase);
    renderNotificationPanel(notifications);
}

/**
 * Modal açılmadan önce bildirimleri tazele ve okundu işaretle
 */
export async function refreshNotificationsForModal(supabase) {
    _notificationSupabase = supabase;
    await trimNotificationsToMax(supabase);
    const notifications = await loadNotifications(supabase);
    renderNotificationPanel(notifications);
    await markAllNotificationsRead(supabase);
    updateNotificationBadge(0);
    return notifications;
}

// Global erişim (main.js ve profil inline script)
if (typeof window !== 'undefined') {
    window.YaziyoNotifications = {
        initNotifications,
        loadNotifications,
        renderNotificationPanel,
        refreshNotificationsForModal,
        onGoalsCompleted,
        playNotificationSound,
        markAllNotificationsRead,
        deleteNotification,
        trimNotificationsToMax,
    };
}
