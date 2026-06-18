/**
 * YAZİYO - Şifre sıfırlama (e-posta linki sonrası)
 *
 * E-posta linki token_hash içermeli (supabase/reset_password_email_template.html).
 * ?code= (PKCE) linkleri yalnızca sıfırlama isteğinin yapıldığı tarayıcıda çalışır.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './lib/supabaseConfig.js';
import { recoveryAuthStorage } from './lib/recoveryAuthStorage.js';
import { isPasswordValid, PASSWORD_RULES, getPasswordStrength } from './passwordRules.js';
import { formatAuthError } from './authVerification.js';
import { logPasswordResetComplete } from './lib/passwordResetApi.js';

const { pageHref } = window.YaziyoPaths || { pageHref: (f) => f };

let recoveryClient = null;

function buildRecoveryClient() {
    if (typeof window === 'undefined' || !window.supabase?.createClient) {
        return null;
    }
    const key = SUPABASE_ANON_KEY?.trim();
    if (!key) return null;

    return window.supabase.createClient(SUPABASE_URL, key, {
        auth: {
            flowType: 'pkce',
            detectSessionInUrl: true,
            autoRefreshToken: true,
            persistSession: true,
            storage: recoveryAuthStorage,
        },
        global: {
            headers: { apikey: key },
        },
    });
}

function getClient() {
    if (!recoveryClient) {
        recoveryClient = buildRecoveryClient();
    }
    return recoveryClient;
}

function loginUrl(query = '') {
    return pageHref('girisKayit.html') + query;
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

function showPanel(name) {
    ['reset-loading', 'reset-form-wrap', 'reset-error-wrap', 'reset-success-wrap'].forEach((id) => {
        document.getElementById(id)?.classList.add('hidden');
    });
    document.getElementById(name)?.classList.remove('hidden');
}

function scrubRecoveryUrl() {
    if (window.location.search || window.location.hash) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

function getRecoveryTokenHash(query) {
    return query.get('token_hash') || query.get('token') || null;
}

function describeRecoveryLink(query) {
    if (query.get('token_hash') || query.get('token')) return 'token_hash (doğru format)';
    if (query.get('code')) return 'code (eski PKCE format — yeni mail gerekli)';
    return 'parametre yok';
}

async function verifyRecoveryToken(client, tokenHash) {
    const { data, error } = await client.auth.verifyOtp({
        token_hash: decodeURIComponent(tokenHash),
        type: 'recovery',
    });
    if (error) throw error;
    return data?.session ?? null;
}

async function waitForRecoverySession(client) {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));

    if (query.get('error') || hash.get('error')) {
        throw new Error(
            decodeURIComponent(query.get('error_description') || hash.get('error_description') || 'Geçersiz link'),
        );
    }

    const tokenHash = getRecoveryTokenHash(query);
    if (tokenHash) {
        const session = await verifyRecoveryToken(client, tokenHash);
        scrubRecoveryUrl();
        if (session) return session;
    }

    const code = query.get('code');
    if (code && !tokenHash) {
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (error) {
            if (/pkce|code verifier/i.test(error.message || '')) {
                throw new Error(
                    'Bu sıfırlama linki eski formatta ve farklı cihazda açılamaz. Lütfen yeni bir sıfırlama linki isteyin; gelen maildeki linki telefonunuzun tarayıcısında (Chrome/Safari) açın.',
                );
            }
            throw error;
        }
        scrubRecoveryUrl();
    }

    if (hash.get('access_token') && hash.get('type') === 'recovery') {
        await new Promise((resolve) => setTimeout(resolve, 200));
        scrubRecoveryUrl();
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
        }, 15000);

        const { data: { subscription } } = client.auth.onAuthStateChange((event, sess) => {
            if (done) return;
            if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && sess)) {
                done = true;
                clearTimeout(timeout);
                subscription.unsubscribe();
                scrubRecoveryUrl();
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
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> KAYDEDİLİYOR...';
        }

        const { error } = await client.auth.updateUser({ password: pw });
        if (error) throw error;

        await logPasswordResetComplete(client);

        showPanel('reset-success-wrap');

        setTimeout(async () => {
            try {
                await client.auth.signOut({ scope: 'global' });
            } catch {
                /* ignore */
            }
            window.location.href = loginUrl('?reset=success');
        }, 2200);
    } catch (err) {
        showToast(formatAuthError(err), 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> ŞİFREMİ GÜNCELLE';
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
        ['length', 'upper', 'lower', 'number'].forEach((rule) => {
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
            } else {
                el.classList.remove('text-green-500', 'text-red-500');
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

function togglePw(inputId, btnId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(btnId)?.querySelector('i');
    if (!input || !icon) return;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    icon.classList.toggle('fa-eye', !isPass);
    icon.classList.toggle('fa-eye-slash', isPass);
}

async function initPage() {
    document.getElementById('reset-password-form')?.addEventListener('submit', handleResetPasswordSubmit);
    document.getElementById('toggle-reset-password')?.addEventListener('click', () =>
        togglePw('reset-password', 'toggle-reset-password'),
    );
    document.getElementById('toggle-reset-password-confirm')?.addEventListener('click', () =>
        togglePw('reset-password-confirm', 'toggle-reset-password-confirm'),
    );
    initPasswordUi();

    const client = getClient();
    if (!client) {
        showPanel('reset-error-wrap');
        return;
    }

    try {
        await waitForRecoverySession(client);
        showPanel('reset-form-wrap');
        document.getElementById('reset-password')?.focus();
    } catch (err) {
        showPanel('reset-error-wrap');
        const msg = document.getElementById('reset-error-message');
        const linkType = describeRecoveryLink(new URLSearchParams(window.location.search));
        const detail = formatAuthError(err);
        if (msg) {
            msg.textContent = linkType.includes('code')
                ? `${detail} (Maildeki link hâlâ ?code= formatında. Supabase şablonunu kaydedip yeni mail isteyin.)`
                : detail;
        }
    }
}

document.addEventListener('DOMContentLoaded', initPage);
