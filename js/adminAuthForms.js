/**
 * YAZİYO - Yönetici giriş formu
 */

import { supabase } from './lib/supabase.js';
import {
    signIn,
    formatAuthError,
    forceAuthCleanup,
} from './authVerification.js';
import { prepareAuthStorageForLogin, initRememberMeCheckbox } from './lib/authStorage.js';
import {
    checkIsAdmin,
    setAdminSession,
    hasAdminSession,
    clearAdminSession,
} from './lib/adminAuth.js';

function getClient() {
    return window.yaziyoSupabase || supabase;
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
    const params = new URLSearchParams(window.location.search);
    const next = params.get('redirect');
    if (next && /^admin[a-zA-Z]*\.html$/.test(next)) return next;
    return 'admin.html';
}

export async function handleAdminLogin(e) {
    e.preventDefault();
    const client = getClient();
    if (!client) {
        showToast('Sistem henüz hazır değil. Sayfayı yenileyin.', 'error');
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

    const remember = document.getElementById('admin-remember-me')?.checked === true;
    prepareAuthStorageForLogin(remember);

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
            window.location.href = getRedirectTarget();
        }, 600);
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

async function initAdminLoginPage() {
    initRememberMeCheckbox('admin-remember-me');

    if (hasAdminSession()) {
        const client = getClient();
        if (client) {
            const { data: { user } } = await client.auth.getUser();
            if (user && (await checkIsAdmin(client, user))) {
                window.location.href = getRedirectTarget();
                return;
            }
        }
        clearAdminSession();
    }

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

document.addEventListener('DOMContentLoaded', initAdminLoginPage);
window.handleAdminLogin = handleAdminLogin;
