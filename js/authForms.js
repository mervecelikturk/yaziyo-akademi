/**
 * YAZİYO - Giriş / Kayıt formu
 */

import { supabase, initSupabaseClient } from './lib/supabase.js';
import {
    getPasswordResetRedirectUrl,
    RESET_EMAIL_COOLDOWN_SEC,
    isEmailConfirmed,
} from './lib/authConfig.js';
import {
    initRememberMeCheckbox,
    prepareAuthStorageForLogin,
    setStoredVerifiedUser,
    mirrorSessionToWindowName,
    clearAllSupabaseAuthKeys,
} from './lib/authStorage.js';
import {
    signUp,
    signIn,
    formatAuthError,
    resendSignupConfirmation,
    verifySignupToken,
    forceAuthCleanup,
    signInWithGoogle,
} from './authVerification.js';

const { homeHref } = window.YaziyoPaths || { homeHref: () => '../index.html' };

let resetEmailCooldownTimer = null;
let resetEmailCooldownLeft = 0;
let verifyEmailCooldownTimer = null;
let verifyEmailCooldownLeft = 0;
let pendingVerifyEmail = '';

function getClient() {
    return window.yaziyoSupabase || supabase;
}

async function ensureAuthClient() {
    await initSupabaseClient();
    const client = getClient();
    if (!client) {
        throw new Error('Sistem bağlantısı kurulamadı.');
    }
    return client;
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

function hideAllAuthPanels() {
    document.getElementById('forgot-password-panel')?.classList.add('hidden');
    document.getElementById('verify-email-panel')?.classList.add('hidden');
    document.getElementById('register-form-container')?.classList.add('hidden');
}

function showLoginFormOnly() {
    hideAllAuthPanels();
    const login = document.getElementById('login-form-container');
    login?.classList.remove('hidden');
    login?.classList.add('block');
    document.getElementById('auth-tabs')?.classList.remove('hidden');
    if (window.switchTab) window.switchTab('login');
}

function showForgotPasswordPanel(prefillEmail = '') {
    hideAllAuthPanels();
    const panel = document.getElementById('forgot-password-panel');
    const login = document.getElementById('login-form-container');
    login?.classList.add('hidden');
    panel?.classList.remove('hidden');
    panel?.classList.add('block');
    document.getElementById('auth-tabs')?.classList.add('hidden');
    const input = document.getElementById('forgot-email');
    if (input && prefillEmail) input.value = prefillEmail;
    document.getElementById('forgot-success-msg')?.classList.add('hidden');
    document.getElementById('forgot-form-fields')?.classList.remove('hidden');
}

function showVerifyEmailPanel(email) {
    pendingVerifyEmail = (email || '').trim().toLowerCase();
    hideAllAuthPanels();
    const panel = document.getElementById('verify-email-panel');
    const login = document.getElementById('login-form-container');
    login?.classList.add('hidden');
    panel?.classList.remove('hidden');
    panel?.classList.add('block');
    document.getElementById('auth-tabs')?.classList.add('hidden');

    const display = document.getElementById('verify-sent-email');
    if (display) display.textContent = pendingVerifyEmail || 'e-posta adresiniz';
    updateVerifyEmailButton();
}

function updateVerifyEmailButton() {
    const btn = document.getElementById('verify-resend-btn');
    const label = document.getElementById('verify-resend-label');
    if (!btn) return;
    if (verifyEmailCooldownLeft > 0) {
        btn.disabled = true;
        if (label) label.textContent = `Tekrar gönder (${verifyEmailCooldownLeft}s)`;
    } else {
        btn.disabled = false;
        if (label) label.textContent = 'Doğrulama e-postasını tekrar gönder';
    }
}

function startVerifyEmailCooldown(sec = RESET_EMAIL_COOLDOWN_SEC) {
    verifyEmailCooldownLeft = sec;
    updateVerifyEmailButton();
    if (verifyEmailCooldownTimer) clearInterval(verifyEmailCooldownTimer);
    verifyEmailCooldownTimer = setInterval(() => {
        verifyEmailCooldownLeft -= 1;
        updateVerifyEmailButton();
        if (verifyEmailCooldownLeft <= 0) {
            clearInterval(verifyEmailCooldownTimer);
            verifyEmailCooldownTimer = null;
        }
    }, 1000);
}

async function handleResendVerificationEmail() {
    const client = getClient();
    const email = pendingVerifyEmail || document.getElementById('login-email')?.value?.trim().toLowerCase();
    const btn = document.getElementById('verify-resend-btn');

    if (!email) {
        showToast('E-posta adresi bulunamadı.', 'warning');
        return;
    }
    if (btn?.disabled) return;

    try {
        if (btn) btn.disabled = true;
        await resendSignupConfirmation(client, email);
        showToast('Doğrulama e-postası tekrar gönderildi.', 'success');
        startVerifyEmailCooldown();
    } catch (err) {
        showToast(formatAuthError(err), 'error');
        updateVerifyEmailButton();
    }
}

function scrubAuthUrl() {
    if (window.location.search || window.location.hash) {
        const clean = window.location.pathname.split('/').pop() || 'girisKayit.html';
        window.history.replaceState({}, document.title, clean);
    }
}

/** E-posta doğrulandıktan sonra oturum açmadan giriş formunu göster */
async function completeEmailVerification(client) {
    await forceAuthCleanup(client);
    clearAllSupabaseAuthKeys();
    scrubAuthUrl();
    showLoginFormOnly();
    showToast('E-postanız doğrulandı! Artık giriş yapabilirsiniz.', 'success');
}

async function handleEmailConfirmationFromUrl() {
    let client;
    try {
        client = await ensureAuthClient();
    } catch {
        return false;
    }

    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash') || params.get('token');
    const type = params.get('type');

    if (tokenHash && (type === 'signup' || type === 'email' || type === 'magiclink')) {
        try {
            const data = await verifySignupToken(client, tokenHash);
            if (data?.user && isEmailConfirmed(data.user)) {
                await completeEmailVerification(client);
                return true;
            }
        } catch (err) {
            showToast(formatAuthError(err), 'error');
            scrubAuthUrl();
        }
        return true;
    }

    if (params.get('verified') === '1') {
        await completeEmailVerification(client);
        return true;
    }

    if (window.location.hash.includes('access_token') || params.has('code')) {
        let session = null;
        for (let attempt = 0; attempt < 15; attempt += 1) {
            const { data: { session: current } } = await client.auth.getSession();
            if (current?.user) {
                session = current;
                break;
            }
            await new Promise((resolve) => window.setTimeout(resolve, 200));
        }

        if (session?.user && isEmailConfirmed(session.user)) {
            const isOAuthReturn = params.get('oauth') === '1';
            if (isOAuthReturn) {
                persistSession({ session, user: session.user });
                scrubAuthUrl();
                showToast('Google ile giriş başarılı! Yönlendiriliyorsunuz...', 'success');
                redirectToHome();
                return true;
            }
            await completeEmailVerification(client);
            return true;
        }
    }

    return false;
}

function updateResetEmailButton() {
    const btn = document.getElementById('forgot-submit-btn');
    const label = document.getElementById('forgot-submit-label');
    if (!btn) return;
    if (resetEmailCooldownLeft > 0) {
        btn.disabled = true;
        if (label) label.textContent = `Tekrar gönder (${resetEmailCooldownLeft}s)`;
    } else {
        btn.disabled = false;
        if (label) label.textContent = 'Sıfırlama linki gönder';
    }
}

function startResetEmailCooldown(sec = RESET_EMAIL_COOLDOWN_SEC) {
    resetEmailCooldownLeft = sec;
    updateResetEmailButton();
    if (resetEmailCooldownTimer) clearInterval(resetEmailCooldownTimer);
    resetEmailCooldownTimer = setInterval(() => {
        resetEmailCooldownLeft -= 1;
        updateResetEmailButton();
        if (resetEmailCooldownLeft <= 0) {
            clearInterval(resetEmailCooldownTimer);
            resetEmailCooldownTimer = null;
        }
    }, 1000);
}

async function handleForgotPassword(e) {
    e.preventDefault();
    const client = getClient();
    const email = document.getElementById('forgot-email')?.value?.trim().toLowerCase();
    const btn = document.getElementById('forgot-submit-btn');

    if (!email) {
        showToast('E-posta adresi girin.', 'warning');
        return;
    }
    if (btn?.disabled) return;

    try {
        if (btn) btn.disabled = true;
        const { error } = await client.auth.resetPasswordForEmail(email, {
            redirectTo: getPasswordResetRedirectUrl(),
        });
        if (error) throw error;

        document.getElementById('forgot-form-fields')?.classList.add('hidden');
        const success = document.getElementById('forgot-success-msg');
        success?.classList.remove('hidden');
        const display = document.getElementById('forgot-sent-email');
        if (display) display.textContent = email;

        showToast('Şifre sıfırlama linki e-postanıza gönderildi.', 'success');
        startResetEmailCooldown();
    } catch (err) {
        showToast(formatAuthError(err), 'error');
        updateResetEmailButton();
    }
}

function redirectToHome() {
    window.location.href = homeHref();
}

/** Başarılı giriş/kayıt sonrası oturumu doğru depoya yazar */
function persistSession(data) {
    if (data?.user) {
        setStoredVerifiedUser(data.user);
    }
    mirrorSessionToWindowName(data?.session ?? null);
}

export async function handleLogin(e) {
    e.preventDefault();
    const client = getClient();
    if (!client) {
        showToast('Sistem henüz hazır değil. Sayfayı yenileyin.', 'error');
        return;
    }

    const email = document.getElementById('login-email')?.value?.trim();
    const password = document.getElementById('login-password')?.value;
    const submitBtn = e.target?.querySelector('button[type="submit"]');

    if (!email || !password) {
        showToast('E-posta ve şifre zorunludur.', 'warning');
        return;
    }

    // Checkbox: işaretli → localStorage, işaretsiz → sessionStorage (şifre saklanmaz)
    const remember = document.getElementById('remember-me')?.checked === true;
    prepareAuthStorageForLogin(remember);

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.dataset.originalText = submitBtn.textContent;
            submitBtn.textContent = 'GİRİŞ YAPILIYOR...';
        }

        const data = await signIn(client, { email, password });

        if (data?.session || data?.user) {
            persistSession(data);
            showToast('Giriş başarılı! Yönlendiriliyorsunuz...', 'success');
            redirectToHome();
        }
    } catch (err) {
        const message = formatAuthError(err);
        showToast(message, 'error');
        if (err?.code === 'email_not_confirmed' || /doğrulanmadı|email not confirmed/i.test(`${message} ${err?.message || ''}`)) {
            await forceAuthCleanup(client);
            showVerifyEmailPanel(email);
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = submitBtn.dataset.originalText || 'GİRİŞ YAP';
        }
    }
}

export async function handleRegister(e) {
    e.preventDefault();
    const client = getClient();
    if (!client) {
        showToast('Sistem henüz hazır değil. Sayfayı yenileyin.', 'error');
        return;
    }

    const btn = document.getElementById('reg-submit-btn');
    const name = document.getElementById('reg-name')?.value?.trim();
    const surname = document.getElementById('reg-surname')?.value?.trim();
    const email = document.getElementById('reg-email')?.value?.trim().toLowerCase();
    const password = document.getElementById('reg-password')?.value;
    const confirm = document.getElementById('reg-password-confirm')?.value;

    if (password !== confirm) {
        showToast('Şifreler uyuşmuyor.', 'error');
        return;
    }

    const termsAccepted = document.getElementById('terms-accept')?.checked === true;
    if (!termsAccepted) {
        showToast('Üyelik oluşturmak için sözleşmeyi kabul etmelisiniz.', 'warning');
        return;
    }

    // Kayıtta Beni Hatırla yok; oturum yalnızca bu sekme için (sessionStorage)
    prepareAuthStorageForLogin(false);

    try {
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'KAYDEDİLİYOR...';
        }

        const data = await signUp(client, {
            email,
            password,
            fullName: `${name} ${surname}`.trim(),
        });

        if (data?.session && data?.user && isEmailConfirmed(data.user)) {
            persistSession(data);
            showToast('Kayıt başarılı! Yönlendiriliyorsunuz...', 'success');
            redirectToHome();
            return;
        }

        await forceAuthCleanup(client);
        clearAllSupabaseAuthKeys();
        showVerifyEmailPanel(email);
        showToast('Kayıt alındı. Devam etmek için e-postanızdaki doğrulama bağlantısına tıklayın.', 'success');
    } catch (err) {
        showToast(formatAuthError(err), 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'KAYIT OL';
        }
    }
}

async function handleGoogleSignIn(event) {
    event?.preventDefault?.();

    const btn = document.getElementById('google-sign-in-btn');
    if (btn?.disabled) return;

    if (isRegisterTabActive() && document.getElementById('terms-accept')?.checked !== true) {
        showToast('Google ile devam etmek için sözleşmeyi kabul etmelisiniz.', 'warning');
        return;
    }

    const remember = document.getElementById('remember-me')?.checked === true;
    prepareAuthStorageForLogin(remember);

    const label = btn?.querySelector('span');
    const originalLabel = label?.textContent || 'Google ile Giriş Yap';

    try {
        if (btn) {
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
        }
        if (label) label.textContent = 'Google\'a yönlendiriliyor...';

        const client = await ensureAuthClient();
        await signInWithGoogle(client);
    } catch (err) {
        showToast(formatAuthError(err), 'error');
        if (btn) {
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
        }
        if (label) label.textContent = originalLabel;
    }
}

function isRegisterTabActive() {
    return document.getElementById('tab-register')?.classList.contains('text-yaziyo-gold') === true;
}

function bindGoogleSignInButton() {
    const btn = document.getElementById('google-sign-in-btn');
    if (!btn || btn.dataset.yaziyoGoogleBound === '1') return;
    btn.dataset.yaziyoGoogleBound = '1';
    btn.addEventListener('click', handleGoogleSignIn);
}

let _closeTermsModal = null;

function initTermsModal() {
    const modal = document.getElementById('terms-modal');
    if (!modal) return;

    const close = () => {
        modal.classList.remove('is-open');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            document.body.style.overflow = '';
        }, 300);
    };

    _closeTermsModal = close;

    const open = () => {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        requestAnimationFrame(() => modal.classList.add('is-open'));
        document.body.style.overflow = 'hidden';
    };

    document.getElementById('terms-open-link')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        open();
    });

    document.getElementById('terms-modal-close')?.addEventListener('click', () => {
        _closeTermsModal?.();
    });

    document.getElementById('terms-modal-backdrop')?.addEventListener('click', () => {
        _closeTermsModal?.();
    });

    document.getElementById('terms-modal-accept')?.addEventListener('click', () => {
        const checkbox = document.getElementById('terms-accept');
        if (checkbox) checkbox.checked = true;
        window.dispatchEvent(new Event('terms-accept-changed'));
        _closeTermsModal?.();
    });

    document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape' && modal.classList.contains('flex') && !modal.classList.contains('hidden')) {
            _closeTermsModal?.();
        }
    });
}

function initAuthFormsPage() {
    bindGoogleSignInButton();
    initRememberMeCheckbox();
    initTermsModal();

    handleEmailConfirmationFromUrl().then((handled) => {
        if (handled) return;

        const params = new URLSearchParams(window.location.search);

        if (params.get('reset') === 'success') {
            showToast('Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.', 'success');
            window.history.replaceState({}, '', 'girisKayit.html');
        }

        if (params.get('forgot') === '1') {
            const loginEmail = document.getElementById('login-email')?.value;
            showForgotPasswordPanel(loginEmail || '');
        }
    });

    document.getElementById('forgot-password-link')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        const email = document.getElementById('login-email')?.value?.trim();
        showForgotPasswordPanel(email);
    });

    document.getElementById('forgot-password-form')?.addEventListener('submit', handleForgotPassword);
    document.getElementById('back-from-forgot-btn')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        showLoginFormOnly();
    });

    document.getElementById('verify-resend-btn')?.addEventListener('click', handleResendVerificationEmail);
    document.getElementById('back-from-verify-btn')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        showLoginFormOnly();
    });
}

function bootAuthFormsPage() {
    if (bootAuthFormsPage.done) return;
    bootAuthFormsPage.done = true;
    initAuthFormsPage();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAuthFormsPage);
} else {
    bootAuthFormsPage();
}

bindGoogleSignInButton();

window.handleGoogleSignIn = handleGoogleSignIn;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
