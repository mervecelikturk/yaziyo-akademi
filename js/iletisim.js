/**
 * YAZİYO - İletişim formu (Supabase)
 * Giriş yapmamış kullanıcı, mesajdan önce e-postasını doğrular.
 */
import { supabase } from './lib/supabase.js';
import { ensureSession } from './authVerification.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function initContactForm() {
    const contactForm = document.getElementById('contact-form');
    const submitBtn = document.getElementById('submit-btn');
    const emailInput = document.getElementById('contact-email');
    const verifyBox = document.getElementById('email-verify-box');
    const verifyBtn = document.getElementById('email-verify-btn');
    const verifyStatus = document.getElementById('email-verify-status');
    const codeRow = document.getElementById('email-code-row');
    const codeInput = document.getElementById('email-code');
    const codeBtn = document.getElementById('email-code-btn');
    if (!contactForm || !submitBtn || !emailInput) return;

    const btnText = submitBtn.querySelector('.btn-text');
    const successIcon = submitBtn.querySelector('.success-icon');

    let loggedInEmail = '';
    let verifiedEmail = '';
    let lookupSeq = 0;
    let lookupTimer = 0;

    function normalizeEmail(value) {
        return String(value || '').trim().toLowerCase();
    }

    function setStatus(message, kind) {
        if (!verifyStatus) return;
        verifyStatus.textContent = message || '';
        verifyStatus.classList.toggle('hidden', !message);
        verifyStatus.classList.remove('text-red-500', 'text-green-600', 'dark:text-green-400');
        if (kind === 'error') verifyStatus.classList.add('text-red-500');
        if (kind === 'ok') verifyStatus.classList.add('text-green-600', 'dark:text-green-400');
    }

    function isVerified() {
        if (loggedInEmail) return true;
        const current = normalizeEmail(emailInput.value);
        return !!current && current === verifiedEmail;
    }

    function syncSubmitState() {
        const ready = isVerified();
        submitBtn.disabled = !ready;
        submitBtn.classList.toggle('opacity-50', !ready);
        submitBtn.classList.toggle('cursor-not-allowed', !ready);
        submitBtn.title = ready ? '' : 'Mesaj göndermek için e-postanızı doğrulayın';
    }

    function markNeedsVerification() {
        verifiedEmail = '';
        if (codeInput) codeInput.value = '';
        codeRow?.classList.add('hidden');
        if (verifyBtn) {
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'E-postamı doğrula';
            verifyBtn.classList.remove('hidden');
        }
        setStatus('');
        syncSubmitState();
    }

    function markVerified(email, message) {
        verifiedEmail = normalizeEmail(email);
        emailInput.value = emailInput.value.trim();
        codeRow?.classList.add('hidden');
        if (verifyBtn) verifyBtn.classList.add('hidden');
        setStatus(message || 'E-posta doğrulandı. Mesajınızı gönderebilirsiniz.', 'ok');
        syncSubmitState();
    }

    async function emailKayitliMi(email) {
        const { data, error } = await supabase.rpc('eposta_kayitli_mi', { p_email: email });
        if (!error && data === true) return true;

        const lookup = await supabase
            .from('kullanicilar')
            .select('id')
            .ilike('email', email)
            .limit(1);
        return !lookup.error && Array.isArray(lookup.data) && lookup.data.length > 0;
    }

    async function skipIfRegistered() {
        const email = normalizeEmail(emailInput.value);
        if (loggedInEmail || !EMAIL_RE.test(email) || !supabase) return false;
        const seq = ++lookupSeq;
        const known = await emailKayitliMi(email);
        if (seq !== lookupSeq || normalizeEmail(emailInput.value) !== email) return false;
        if (!known) return false;
        markVerified(email, 'Bu e-posta sistemde kayıtlı. Doğrulama gerekmez.');
        return true;
    }

    function verifyErrorText(error) {
        const msg = error?.message || '';
        if (/rate limit|too many|only request this after/i.test(msg)) {
            return 'Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.';
        }
        if (/signups not allowed|signup.*disabled|user not allowed/i.test(msg)) {
            return 'Bu adrese kod gönderilemedi. Supabase’te Email sağlayıcısında kayıtlar açık olmalı.';
        }
        if (/error sending|smtp|not authorized|mail/i.test(msg)) {
            return 'Doğrulama e-postası gönderilemedi. Supabase e-posta gönderimini ve deneme adresini kontrol edin.';
        }
        if (/token|otp|invalid|expired|verifier/i.test(msg)) {
            return 'Kod geçersiz veya süresi dolmuş. Yeni kod isteyin.';
        }
        if (/redirect|url/i.test(msg)) {
            return 'Yönlendirme adresi Supabase’te izinli değil. Redirect URLs listesine iletişim sayfasını ekleyin.';
        }
        return msg
            ? `Doğrulama tamamlanamadı: ${msg}`
            : 'Doğrulama tamamlanamadı. Lütfen tekrar deneyin.';
    }

    async function sendVerificationCode() {
        const email = normalizeEmail(emailInput.value);
        if (!EMAIL_RE.test(email)) {
            setStatus('Geçerli bir e-posta adresi yazın.', 'error');
            emailInput.focus();
            return;
        }

        if (!supabase) {
            setStatus('Doğrulama başlatılamadı. Sayfayı yenileyip tekrar deneyin.', 'error');
            return;
        }

        if (await skipIfRegistered()) return;

        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Gönderiliyor...';
        setStatus('');

        const redirectTo = `${window.location.origin}${window.location.pathname}?dogrulama=1`;
        let { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                shouldCreateUser: true,
                emailRedirectTo: redirectTo,
            },
        });
        if (error && /redirect|url/i.test(error.message || '')) {
            ({ error } = await supabase.auth.signInWithOtp({
                email,
                options: { shouldCreateUser: true },
            }));
        }

        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Kodu yeniden gönder';
        if (error) {
            console.error('İletişim e-posta kodu gönderilemedi:', error);
            setStatus(verifyErrorText(error), 'error');
            return;
        }

        codeRow?.classList.remove('hidden');
        if (codeInput) codeInput.value = '';
        setStatus('E-postanıza gelen kodu girin. Bağlantıya tıklamanız gerekmez.', 'ok');
        codeInput?.focus();
    }

    async function confirmVerificationCode() {
        const email = normalizeEmail(emailInput.value);
        const token = String(codeInput?.value || '').replace(/\D/g, '');
        if (!EMAIL_RE.test(email)) {
            setStatus('Geçerli bir e-posta adresi yazın.', 'error');
            return;
        }
        if (token.length < 6) {
            setStatus('E-postadaki kodu yazın.', 'error');
            return;
        }
        if (!supabase) return;

        codeBtn.disabled = true;
        let data = null;
        let error = null;
        for (const type of ['email', 'magiclink', 'signup']) {
            const result = await supabase.auth.verifyOtp({ email, token, type });
            data = result.data;
            error = result.error;
            if (!error) break;
        }
        codeBtn.disabled = false;

        const confirmedEmail = data?.user?.email || data?.session?.user?.email || '';
        if (error || !confirmedEmail) {
            console.error('İletişim e-posta kodu doğrulanamadı:', error);
            setStatus(verifyErrorText(error), 'error');
            return;
        }

        try { await supabase.auth.signOut(); } catch (_) { /* doğrulama oturumu */ }
        markVerified(confirmedEmail);
    }

    emailInput.addEventListener('input', () => {
        if (loggedInEmail) return;
        if (normalizeEmail(emailInput.value) !== verifiedEmail) {
            markNeedsVerification();
        }
        window.clearTimeout(lookupTimer);
        lookupTimer = window.setTimeout(() => { void skipIfRegistered(); }, 400);
    });
    emailInput.addEventListener('blur', () => { void skipIfRegistered(); });

    verifyBtn?.addEventListener('click', sendVerificationCode);
    codeBtn?.addEventListener('click', confirmVerificationCode);
    codeInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            confirmVerificationCode();
        }
    });

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!isVerified() && !(await skipIfRegistered())) {
            setStatus('Mesaj göndermek için e-postanızı doğrulayın.', 'error');
            return;
        }

        if (!supabase) {
            alert('Mesaj gönderilemedi. Lütfen sayfayı yenileyip tekrar deneyin.');
            return;
        }

        const formData = new FormData(contactForm);
        const ad = (formData.get('firstname') || '').toString().trim();
        const soyad = (formData.get('lastname') || '').toString().trim();
        const eposta = loggedInEmail || normalizeEmail(formData.get('email'));
        const mesaj = (formData.get('message') || '').toString().trim().slice(0, 256);

        submitBtn.style.pointerEvents = 'none';
        if (btnText) btnText.textContent = 'GÖNDERİLİYOR...';

        const { error } = await supabase.from('iletisim_mesajlari').insert({
            ad,
            soyad,
            eposta,
            mesaj,
        });

        if (error) {
            console.error('İletişim mesajı kaydedilemedi:', error);
            if (btnText) btnText.textContent = 'MESAJ GÖNDER';
            submitBtn.style.pointerEvents = 'auto';
            alert('Mesajınız gönderilemedi. Lütfen daha sonra tekrar deneyin.');
            return;
        }

        if (btnText) btnText.style.opacity = '0';
        successIcon?.classList.remove('hidden');

        setTimeout(() => {
            contactForm.reset();
            successIcon?.classList.add('hidden');
            if (btnText) {
                btnText.style.opacity = '1';
                btnText.textContent = 'MESAJ GÖNDER';
            }
            submitBtn.style.pointerEvents = 'auto';
            if (loggedInEmail) {
                emailInput.value = loggedInEmail;
                emailInput.readOnly = true;
                syncSubmitState();
            } else {
                emailInput.readOnly = false;
                markNeedsVerification();
            }
        }, 3000);
    });

    (async () => {
        const fromVerifyLink = new URLSearchParams(window.location.search).get('dogrulama') === '1';
        const session = await ensureSession(supabase);

        if (fromVerifyLink && session.ok && session.user?.email) {
            emailInput.value = session.user.email;
            verifyBox?.classList.remove('hidden');
            markVerified(session.user.email);
            try { await supabase.auth.signOut(); } catch (_) { /* doğrulama oturumu */ }
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }

        if (session.ok && session.user?.email) {
            loggedInEmail = normalizeEmail(session.user.email);
            verifiedEmail = loggedInEmail;
            emailInput.value = session.user.email;
            emailInput.readOnly = true;
            verifyBox?.classList.add('hidden');
            syncSubmitState();
            return;
        }

        verifyBox?.classList.remove('hidden');
        markNeedsVerification();
    })();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContactForm);
} else {
    initContactForm();
}
