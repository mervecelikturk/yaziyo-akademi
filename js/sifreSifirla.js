/**
 * YAZİYO - Şifre sıfırlama (e-posta linki sonrası)
 */

import { supabase } from './lib/supabase.js';
import { isPasswordValid, PASSWORD_RULES, getPasswordStrength } from './passwordRules.js';
import { formatAuthError } from './authVerification.js';
import { setRememberMe } from './lib/authStorage.js';

function getClient() {
    return window.yaziyoSupabase || supabase;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('auth-toast-container');
    if (!container) {
        alert(message);
        return;
    }
    const toast = document.createElement('div');
    toast.className = `auth-toast auth-toast--${type}`;
    const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation' };
    toast.innerHTML = `<span class="auth-toast__icon"><i class="fa-solid ${icons[type] || 'fa-circle-info'}"></i></span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

async function waitForRecoverySession(client) {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));

    if (query.get('error') || hash.get('error')) {
        throw new Error(
            decodeURIComponent(query.get('error_description') || hash.get('error_description') || 'Geçersiz link')
        );
    }

    const code = query.get('code');
    if (code) {
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (error) throw error;
    }

    const { data: { session } } = await client.auth.getSession();
    if (session) return session;

    return new Promise((resolve, reject) => {
        let done = false;
        const timeout = setTimeout(() => {
            if (!done) {
                done = true;
                reject(new Error('Sıfırlama linkinin süresi dolmuş veya geçersiz.'));
            }
        }, 12000);

        const { data: { subscription } } = client.auth.onAuthStateChange((event, sess) => {
            if (done) return;
            if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && sess)) {
                done = true;
                clearTimeout(timeout);
                subscription.unsubscribe();
                resolve(sess);
            }
        });
    });
}

async function handleResetPasswordSubmit(e) {
    e.preventDefault();
    const client = getClient();
    const pw = document.getElementById('reset-password')?.value || '';
    const confirm = document.getElementById('reset-password-confirm')?.value || '';
    const btn = document.getElementById('reset-password-submit');

    if (pw !== confirm) {
        showToast('Şifreler uyuşmuyor.', 'error');
        return;
    }
    if (!isPasswordValid(pw)) {
        showToast('Şifre güvenlik kurallarını karşılamıyor.', 'warning');
        return;
    }

    try {
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'KAYDEDİLİYOR...';
        }
        const { error } = await client.auth.updateUser({ password: pw });
        if (error) throw error;

        setRememberMe(true);
        showToast('Şifreniz güncellendi. Giriş sayfasına yönlendiriliyorsunuz...', 'success');
        setTimeout(() => {
            window.location.href = 'girisKayit.html?reset=success';
        }, 1500);
    } catch (err) {
        showToast(formatAuthError(err), 'error');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'ŞİFREMİ GÜNCELLE';
        }
    }
}

function initPasswordUi() {
    const pwInput = document.getElementById('reset-password');
    const bar = document.getElementById('reset-strength-bar');
    const text = document.getElementById('reset-strength-text');
    if (!pwInput) return;

    pwInput.addEventListener('input', () => {
        const pw = pwInput.value;
        const rules = ['length', 'upper', 'lower', 'number'];
        rules.forEach((rule) => {
            const el = document.querySelector(`[data-reset-rule="${rule}"]`);
            if (!el) return;
            const icon = el.querySelector('i');
            const ok = PASSWORD_RULES[rule](pw);
            if (ok) {
                el.classList.add('text-green-500');
                el.classList.remove('text-red-500');
                icon?.classList.replace('fa-circle-xmark', 'fa-circle-check');
            } else if (pw.length > 0) {
                el.classList.add('text-red-500');
                el.classList.remove('text-green-500');
                icon?.classList.replace('fa-circle-check', 'fa-circle-xmark');
            }
        });
        const strength = getPasswordStrength(pw);
        if (bar) {
            bar.style.width = `${strength.percent}%`;
            bar.className = `h-full transition-all duration-500 ${strength.class}`;
        }
        if (text) {
            text.textContent = strength.label;
            text.className = `text-[10px] font-bold uppercase ${strength.textClass}`;
        }
    });
}

async function initPage() {
    const loading = document.getElementById('reset-loading');
    const formWrap = document.getElementById('reset-form-wrap');
    const errorWrap = document.getElementById('reset-error-wrap');
    const client = getClient();

    document.getElementById('reset-password-form')?.addEventListener('submit', handleResetPasswordSubmit);
    document.getElementById('toggle-reset-password')?.addEventListener('click', () => togglePw('reset-password', 'toggle-reset-password'));
    document.getElementById('toggle-reset-password-confirm')?.addEventListener('click', () =>
        togglePw('reset-password-confirm', 'toggle-reset-password-confirm')
    );
    initPasswordUi();

    if (!client) {
        loading?.classList.add('hidden');
        errorWrap?.classList.remove('hidden');
        return;
    }

    try {
        await waitForRecoverySession(client);
        loading?.classList.add('hidden');
        formWrap?.classList.remove('hidden');
    } catch (err) {
        loading?.classList.add('hidden');
        errorWrap?.classList.remove('hidden');
        const msg = document.getElementById('reset-error-message');
        if (msg) msg.textContent = formatAuthError(err);
    }
}

function togglePw(inputId, btnId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(btnId)?.querySelector('i');
    if (!input || !icon) return;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    icon.classList.toggle('fa-eye', !isPass);
    icon.classList.toggle('fa-eye-slash', isPass);
}

document.addEventListener('DOMContentLoaded', initPage);
