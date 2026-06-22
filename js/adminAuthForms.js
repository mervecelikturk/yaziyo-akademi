/**
 * YAZİYO - Yönetici giriş formu
 */

import { getSupabaseClient, initSupabaseClient } from './lib/supabase.js';
import {
    signIn,
    formatAuthError,
    forceAuthCleanup,
} from './authVerification.js';
import { prepareAuthStorageForLogin } from './lib/authStorage.js';
import {
    checkIsAdmin,
    setAdminSession,
    hasAdminSession,
    clearAdminSession,
} from './lib/adminAuth.js';

async function getClient() {
    await initSupabaseClient();
    return getSupabaseClient();
}

function showAdminLoginForm() {
    document.documentElement.classList.remove('admin-login-check');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('auth-toast-container');
    if (!container) {
        if (type === 'error') alert(message);
        return;
    }

    const toast = document.createElement('div');
    toast.className = `auth-toast auth-toast--${type}`;
    const icons = {
        success: 'fa-circle-check',
        error: 'fa-circle-xmark',
        warning: 'fa-triangle-exclamation',
        info: 'fa-circle-info',
    };
    toast.innerHTML = `
        <span class="auth-toast__icon"><i class="fa-solid ${icons[type] || icons.info}"></i></span>
        <span class="auth-toast__text">${escapeHtml(message)}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(1rem)';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function getRedirectTarget() {
    return window.YaziyoAdminPaths?.resolveAdminRedirectTarget?.('admin.html') || 'admin.html';
}

function shouldSkipAutoRedirect() {
    return /[?&](yeniden|cikis)=1/.test(window.location.search);
}

async function verifyExistingAdminSession(client) {
    const { data: { session } } = await client.auth.getSession();
    let user = session?.user || null;

    if (!user) {
        const { data: { user: fetchedUser } } = await client.auth.getUser();
        user = fetchedUser || null;
    }

    if (!user) return false;
    return checkIsAdmin(client, user);
}

function redirectToAdminPanel() {
    window.location.replace(getRedirectTarget());
}

export async function handleAdminLogin(e) {
    e.preventDefault();

    let client;
    try {
        client = await getClient();
    } catch {
        client = null;
    }

    if (!client) {
        showToast('Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip sayfayı yenileyin.', 'error');
        return;
    }

    const email = document.getElementById('admin-login-email')?.value?.trim().toLowerCase();
    const password = document.getElementById('admin-login-password')?.value;
    const submitBtn = document.getElementById('admin-login-submit');
    const consent = document.getElementById('admin-consent')?.checked;

    if (!email || !password) {
        showToast('E-posta ve şifre zorunludur.', 'warning');
        return;
    }

    if (!consent) {
        showToast('Devam etmek için yetki onayını işaretleyin.', 'warning');
        return;
    }

    prepareAuthStorageForLogin(true);

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Doğrulanıyor...';
        }

        const data = await signIn(client, { email, password });
        const user = data?.user;
        if (!user) throw new Error('Oturum oluşturulamadı.');

        const isAdmin = await checkIsAdmin(client, user);
        if (!isAdmin) {
            await forceAuthCleanup(client);
            clearAdminSession();
            showToast('Bu hesabın yönetici paneline erişim yetkisi yok.', 'error');
            return;
        }

        setAdminSession(user);
        showToast('Giriş başarılı. Panele yönlendiriliyorsunuz...', 'success');

        setTimeout(() => {
            redirectToAdminPanel();
        }, 400);
    } catch (err) {
        showToast(formatAuthError(err), 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML =
                '<i class="fa-solid fa-shield-halved mr-2"></i> YÖNETİCİ GİRİŞİ';
        }
    }
}

function bindLoginFormEvents() {
    document.getElementById('toggle-admin-password')?.addEventListener('click', (ev) => {
        const input = document.getElementById('admin-login-password');
        const icon = ev.currentTarget.querySelector('i');
        if (!input || !icon) return;
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.replace('fa-eye-slash', 'fa-eye');
        }
    });

    document.getElementById('admin-login-form')?.addEventListener('submit', handleAdminLogin);
}

async function initAdminLoginPage() {
    const skipAutoRedirect = shouldSkipAutoRedirect();

    if (!hasAdminSession() || skipAutoRedirect) {
        showAdminLoginForm();
        bindLoginFormEvents();
        return;
    }

    try {
        await initSupabaseClient();
        const client = getSupabaseClient();

        if (client && (await verifyExistingAdminSession(client))) {
            redirectToAdminPanel();
            return;
        }
    } catch (err) {
        console.warn('Yönetici oturumu doğrulanamadı:', err);
    }

    clearAdminSession();
    showAdminLoginForm();
    bindLoginFormEvents();
}

initAdminLoginPage();
window.handleAdminLogin = handleAdminLogin;
