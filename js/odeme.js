/**
 * YAZİYO — Ödeme sayfası
 * Kart verisi bu sayfada toplanmaz; iyzico Checkout Form / 3D Secure kullanılır.
 */
import {
    loadCheckoutContext,
    startPayment,
    confirmPaymentFromProvider,
    validateBuyerForm,
    formatPhoneInput,
    sanitizeCardName,
    formatCheckoutAmount,
    mountIyzicoCheckout,
    PaymentErrorCode,
} from './lib/paymentService.js';

const els = {};
let checkout = null;
let submitting = false;

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}

function paketIdFromUrl() {
    return new URLSearchParams(window.location.search).get('paket') || '';
}

function loginHref() {
    const id = paketIdFromUrl();
    const next = `../odeme/${id ? `?paket=${id}` : ''}`;
    return `../giris-kayit/?next=${encodeURIComponent(next)}`;
}

function cacheElements() {
    els.loading = document.getElementById('pay-loading');
    els.summaryBody = document.getElementById('pay-summary-body');
    els.authGate = document.getElementById('pay-auth-gate');
    els.authLink = document.getElementById('pay-auth-link');
    els.errorBox = document.getElementById('pay-error');
    els.errorText = document.getElementById('pay-error-text');
    els.checkout = document.getElementById('pay-checkout');
    els.success = document.getElementById('pay-success');
    els.form = document.getElementById('pay-form');
    els.firstName = document.getElementById('pay-first-name');
    els.lastName = document.getElementById('pay-last-name');
    els.phone = document.getElementById('pay-phone');
    els.submit = document.getElementById('pay-submit');
    els.formAlert = document.getElementById('pay-form-alert');
    els.toast = document.getElementById('pay-toast');
    els.iyzicoBox = document.getElementById('iyzipay-checkout-form');
    els.amountEls = document.querySelectorAll('[data-pay-amount]');
    els.pkgTitleEls = document.querySelectorAll('[data-pay-pkg-title]');
    els.pkgDesc = document.getElementById('pay-pkg-desc');
    els.pkgFeatures = document.getElementById('pay-pkg-features');
    els.pkgValidity = document.getElementById('pay-pkg-validity');
    els.pkgCategory = document.getElementById('pay-pkg-category');
    els.successOrder = document.getElementById('pay-success-order');
    els.successPkg = document.getElementById('pay-success-pkg');
}

function showView(name) {
    const overlay = els.loading;
    const checkoutEl = els.checkout;
    const others = {
        auth: els.authGate,
        error: els.errorBox,
        success: els.success,
    };

    Object.values(others).forEach((el) => {
        if (el) el.hidden = true;
    });

    if (name === 'loading' || name === 'checkout') {
        if (checkoutEl) checkoutEl.hidden = false;
        if (overlay) overlay.hidden = name !== 'loading';
        if (els.summaryBody) els.summaryBody.hidden = name === 'loading';
        return;
    }

    if (checkoutEl) checkoutEl.hidden = true;
    if (overlay) overlay.hidden = true;
    const target = others[name];
    if (target) target.hidden = false;
}

function showToast(msg, type = 'error') {
    const t = els.toast;
    if (!t) return;
    t.textContent = msg;
    t.className = `pay-toast ${type === 'error' ? 'is-error' : 'is-ok'}`;
    t.hidden = false;
    t.style.bottom = 'max(1rem, env(safe-area-inset-bottom, 0px))';
    clearTimeout(showToast._t1);
    clearTimeout(showToast._t2);
    showToast._t1 = setTimeout(() => t.classList.add('is-hiding'), 2800);
    showToast._t2 = setTimeout(() => {
        t.hidden = true;
        t.classList.remove('is-hiding');
    }, 3200);
}

function setFieldState(input, errorEl, message, ok) {
    if (!input) return;
    input.classList.toggle('is-error', !!message);
    input.classList.toggle('is-valid', !message && !!ok);
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (errorEl) {
        errorEl.textContent = message || '';
        errorEl.hidden = !message;
    }
}

function fieldErrorEl(input) {
    if (!input) return null;
    const id = input.getAttribute('aria-describedby');
    if (id) return document.getElementById(id.split(' ')[0]);
    return input.parentElement?.querySelector('.pay-field-error') || null;
}

function readFormFields() {
    return {
        firstName: els.firstName?.value || '',
        lastName: els.lastName?.value || '',
        phone: els.phone?.value || '',
    };
}

function applyValidation(result, { touchedOnly } = {}) {
    const map = {
        firstName: els.firstName,
        lastName: els.lastName,
        phone: els.phone,
    };
    Object.entries(map).forEach(([key, input]) => {
        if (!input) return;
        if (touchedOnly && input.dataset.touched !== '1') return;
        const msg = result.errors[key] || '';
        const hasValue = String(input.value || '').trim().length > 0;
        setFieldState(input, fieldErrorEl(input), msg, hasValue && !msg);
    });
}

function isTypingEvent(e) {
    return e.type === 'input' && (
        e.inputType === 'insertText'
        || e.inputType === 'insertFromPaste'
        || e.inputType === 'deleteContentBackward'
        || e.inputType === 'deleteContentForward'
        || e.inputType === 'deleteByCut'
        || e.inputType === 'deleteContent'
    );
}

function splitAccountName(fullName) {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function prefillBuyer(user) {
    const { firstName, lastName } = splitAccountName(user?.name || '');
    if (els.firstName && !els.firstName.value) els.firstName.value = firstName;
    if (els.lastName && !els.lastName.value) els.lastName.value = lastName;
}

function bindBuyerInputs() {
    const onName = (e) => {
        if (!isTypingEvent(e)) return;
        e.target.value = sanitizeCardName(e.target.value);
    };
    const onPhone = (e) => {
        if (!isTypingEvent(e)) return;
        e.target.value = formatPhoneInput(e.target.value);
        if (e.target.dataset.touched === '1') {
            applyValidation(validateBuyerForm(readFormFields()), { touchedOnly: true });
        }
    };

    els.firstName?.addEventListener('input', onName);
    els.lastName?.addEventListener('input', onName);
    els.phone?.addEventListener('input', onPhone);

    [els.firstName, els.lastName, els.phone].forEach((input) => {
        input?.addEventListener('blur', () => {
            if (input === els.firstName || input === els.lastName) {
                input.value = sanitizeCardName(input.value);
            } else if (input === els.phone) {
                input.value = formatPhoneInput(input.value);
            }
            input.dataset.touched = '1';
            applyValidation(validateBuyerForm(readFormFields()), { touchedOnly: true });
        });
    });
}

function fillPackageSummary(pkg, amountLabel) {
    els.pkgTitleEls.forEach((el) => {
        el.textContent = pkg.title;
    });
    els.amountEls.forEach((el) => {
        el.textContent = amountLabel;
    });
    if (els.pkgDesc) els.pkgDesc.textContent = pkg.description || '';
    if (els.pkgCategory) els.pkgCategory.textContent = pkg.category || '';
    if (els.pkgValidity) {
        els.pkgValidity.textContent = pkg.validityDays
            ? `Satın alındıktan sonra ${pkg.validityDays} gün geçerlidir.`
            : '';
    }
    if (els.pkgFeatures) {
        const list = (pkg.features || []).slice(0, 6);
        els.pkgFeatures.innerHTML = list.length
            ? list.map((f) => `<li><i class="fa-solid fa-check"></i><span>${escapeHtml(f)}</span></li>`).join('')
            : '<li class="pay-feature-empty">Paket detayları ödeme özetinde yer alır.</li>';
    }
}

function showFormAlert(message) {
    if (!els.formAlert) return;
    if (!message) {
        els.formAlert.hidden = true;
        els.formAlert.textContent = '';
        return;
    }
    els.formAlert.hidden = false;
    els.formAlert.textContent = message;
}

function setSubmitting(on) {
    submitting = on;
    if (!els.submit) return;
    els.submit.disabled = on;
    if (on) {
        els.submit.dataset.originalText = els.submit.textContent;
        els.submit.textContent = 'İşleniyor...';
    } else {
        els.submit.textContent = els.submit.dataset.originalText || 'Ödeme Yap';
    }
}

function openIyzicoCheckout(payResult) {
    if (payResult.paymentPageUrl) {
        window.location.assign(payResult.paymentPageUrl);
        return true;
    }
    if (els.iyzicoBox && mountIyzicoCheckout(payResult.checkoutFormContent, els.iyzicoBox)) {
        els.iyzicoBox.hidden = false;
        if (els.submit) els.submit.hidden = true;
        return true;
    }
    return false;
}

async function onSubmit(e) {
    e.preventDefault();
    showFormAlert('');

    [els.firstName, els.lastName, els.phone].forEach((input) => {
        if (input) input.dataset.touched = '1';
    });

    const result = validateBuyerForm(readFormFields());
    applyValidation(result);

    if (!result.valid) {
        showFormAlert('Bilgilerinizi kontrol edip tekrar deneyebilirsiniz.');
        const firstError = els.form?.querySelector('.pay-input.is-error');
        firstError?.focus();
        return;
    }

    if (submitting) {
        showToast('Ödeme isteğiniz zaten iletildi. Lütfen sonucu bekleyin.');
        return;
    }

    if (!navigator.onLine) {
        showFormAlert('İnternet bağlantınız kesildi. Lütfen bağlantınızı kontrol edip tekrar deneyin.');
        return;
    }

    setSubmitting(true);

    try {
        const payResult = await startPayment({
            packageId: checkout?.package?.id,
            buyer: {
                firstName: result.firstName,
                lastName: result.lastName,
                phone: result.phone,
            },
        });
        if (payResult?.ok && openIyzicoCheckout(payResult)) {
            return;
        }
        const message = payResult?.message
            || (payResult?.code === PaymentErrorCode.PROVIDER_NOT_READY
                ? 'Ödeme henüz aktif değil.'
                : 'Ödeme gerçekleştirilemedi. Lütfen tekrar deneyin.');
        if (payResult?.code === PaymentErrorCode.PROVIDER_NOT_READY) {
            showToast(message, 'error');
        } else {
            showFormAlert(message);
        }
    } catch {
        showFormAlert('Ödeme gerçekleştirilemedi. Lütfen tekrar deneyin.');
    } finally {
        setSubmitting(false);
    }
}

function showSuccess(order) {
    if (els.successOrder) els.successOrder.textContent = `#${order.orderNumber || '—'}`;
    if (els.successPkg) els.successPkg.textContent = order.packageTitle || checkout?.package?.title || '';
    showView('success');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindNetwork() {
    window.addEventListener('offline', () => {
        showFormAlert('İnternet bağlantınız kesildi. Lütfen bağlantınızı kontrol edip tekrar deneyin.');
    });
    window.addEventListener('online', () => {
        if (els.formAlert?.textContent.includes('İnternet bağlantınız')) {
            showFormAlert('');
        }
    });
}

function showPageError(message) {
    if (els.errorText) els.errorText.textContent = message;
    showView('error');
}

function cleanResultParams() {
    const url = new URL(window.location.href);
    ['sonuc', 'kod', 'siparis', 'token', 'conversationId'].forEach((key) => url.searchParams.delete(key));
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, '', next);
}

async function handleProviderReturn(params) {
    const sonuc = params.get('sonuc');
    const token = params.get('token');
    if (sonuc === 'ok') {
        showSuccess({
            orderNumber: params.get('siparis') || '—',
            packageTitle: checkout?.package?.title || '',
        });
        cleanResultParams();
        return true;
    }
    if (sonuc === 'hata') {
        const code = params.get('kod');
        showView('checkout');
        showFormAlert(
            code === 'threeds_cancelled'
                ? '3D Secure işlemi iptal edildi. Ödeme tamamlanmadı.'
                : code === 'orphan'
                    ? 'Ödemeniz alınmış olabilir. Sipariş durumunuz kısa süre içinde güncellenecektir.'
                    : 'Ödeme gerçekleştirilemedi. Kart bilgilerinizi kontrol edip tekrar deneyebilirsiniz.',
        );
        cleanResultParams();
        return true;
    }
    if (token) {
        const confirmed = await confirmPaymentFromProvider({
            token,
            conversationId: params.get('conversationId') || '',
        });
        if (confirmed?.ok && confirmed.order) {
            showSuccess(confirmed.order);
            cleanResultParams();
            return true;
        }
        showView('checkout');
        showFormAlert(confirmed?.message || 'Ödeme sonucu doğrulanamadı.');
        cleanResultParams();
        return true;
    }
    return false;
}

async function init() {
    cacheElements();
    if (els.authLink) els.authLink.href = loginHref();

    bindBuyerInputs();
    bindNetwork();
    els.form?.addEventListener('submit', onSubmit);

    showView('loading');

    const params = new URLSearchParams(window.location.search);
    const returnedOk = params.get('sonuc') === 'ok';
    const ctx = await loadCheckoutContext(paketIdFromUrl());

    if (returnedOk) {
        checkout = ctx.ok ? ctx : null;
        showSuccess({
            orderNumber: params.get('siparis') || '—',
            packageTitle: ctx.ok ? ctx.package.title : '',
        });
        cleanResultParams();
        return;
    }

    if (!ctx.ok) {
        if (ctx.code === PaymentErrorCode.AUTH) {
            showView('auth');
            return;
        }
        if (ctx.code === PaymentErrorCode.ALREADY_OWNED) {
            showPageError('Bu paketi zaten satın aldınız.');
            return;
        }
        showPageError(ctx.message);
        return;
    }

    checkout = ctx;
    fillPackageSummary(ctx.package, formatCheckoutAmount(ctx.amount));
    prefillBuyer(ctx.user);
    showView('checkout');

    if (await handleProviderReturn(params)) return;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
