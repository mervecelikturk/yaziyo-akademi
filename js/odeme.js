/**
 * YAZİYO — Ödeme sayfası
 * Kart verisi sunucuya gönderilmez ve console'a yazılmaz.
 */
import {
    loadCheckoutContext,
    startPayment,
    validateCardForm,
    formatCardNumber,
    formatExpiry,
    detectCardBrand,
    cvvLength,
    sanitizeCardName,
    formatCheckoutAmount,
    PaymentErrorCode,
} from './lib/paymentService.js';

const els = {};
let checkout = null;
let submitting = false;
let currentBrand = null;

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
    els.cardNumber = document.getElementById('pay-card-number');
    els.expiry = document.getElementById('pay-expiry');
    els.cvv = document.getElementById('pay-cvv');
    els.brand = document.getElementById('pay-card-brand');
    els.cvvHelp = document.getElementById('pay-cvv-help');
    els.cvvTip = document.getElementById('pay-cvv-tip');
    els.submit = document.getElementById('pay-submit');
    els.formAlert = document.getElementById('pay-form-alert');
    els.toast = document.getElementById('pay-toast');
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
    const checkout = els.checkout;
    const others = {
        auth: els.authGate,
        error: els.errorBox,
        success: els.success,
    };

    Object.values(others).forEach((el) => {
        if (el) el.hidden = true;
    });

    if (name === 'loading' || name === 'checkout') {
        if (checkout) checkout.hidden = false;
        if (overlay) overlay.hidden = name !== 'loading';
        if (els.summaryBody) els.summaryBody.hidden = name === 'loading';
        return;
    }

    if (checkout) checkout.hidden = true;
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
        cardNumber: els.cardNumber?.value || '',
        expiry: els.expiry?.value || '',
        cvv: els.cvv?.value || '',
    };
}

function applyValidation(result, { touchedOnly } = {}) {
    const map = {
        firstName: els.firstName,
        lastName: els.lastName,
        cardNumber: els.cardNumber,
        expiry: els.expiry,
        cvv: els.cvv,
    };
    Object.entries(map).forEach(([key, input]) => {
        if (!input) return;
        if (touchedOnly && input.dataset.touched !== '1') return;
        const msg = result.errors[key] || '';
        const hasValue = String(input.value || '').trim().length > 0;
        setFieldState(input, fieldErrorEl(input), msg, hasValue && !msg);
    });
}

function updatePayButton(result) {
    if (!els.submit) return;
    const past = result?.expiryPast === true;
    els.submit.disabled = submitting || past;
}

function updateBrand(digits) {
    const brand = detectCardBrand(digits);
    currentBrand = brand;
    if (!els.brand) return;
    els.brand.dataset.brand = brand || '';
    els.brand.innerHTML = brandIcon(brand);
    els.brand.hidden = !brand;
    if (els.cvv) {
        els.cvv.maxLength = cvvLength(brand);
        els.cvv.setAttribute('placeholder', brand === 'amex' ? '••••' : '•••');
    }
}

function brandIcon(brand) {
    const logos = {
        visa: '../../images/odeme/visa.png',
        mastercard: '../../images/odeme/mastercard.png',
        amex: '../../images/odeme/amex.png',
        troy: '../../images/odeme/troy.png',
    };
    const src = logos[brand];
    if (!src) return '';
    const labels = {
        visa: 'Visa',
        mastercard: 'Mastercard',
        amex: 'American Express',
        troy: 'TROY',
    };
    return `<img src="${src}" alt="${labels[brand]}" title="${labels[brand]}">`;
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

function bindCardInputs() {
    const onFirstName = (e) => {
        if (!isTypingEvent(e)) return;
        e.target.value = sanitizeCardName(e.target.value);
    };
    const onLastName = (e) => {
        if (!isTypingEvent(e)) return;
        e.target.value = sanitizeCardName(e.target.value);
    };
    const onCardNumber = (e) => {
        const digits = e.target.value.replace(/\D/g, '');
        updateBrand(digits);
        if (!isTypingEvent(e)) return;
        e.target.value = formatCardNumber(digits, currentBrand);
        if (e.target.dataset.touched === '1') {
            applyValidation(validateCardForm(readFormFields()), { touchedOnly: true });
        }
        updatePayButton(validateCardForm(readFormFields()));
    };
    const onExpiry = (e) => {
        if (!isTypingEvent(e)) {
            updatePayButton(validateCardForm(readFormFields()));
            return;
        }
        e.target.value = formatExpiry(e.target.value);
        const result = validateCardForm(readFormFields());
        if (e.target.dataset.touched === '1') applyValidation(result, { touchedOnly: true });
        updatePayButton(result);
    };
    const onCvv = (e) => {
        if (!isTypingEvent(e)) return;
        const max = cvvLength(currentBrand);
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, max);
        if (e.target.dataset.touched === '1') {
            applyValidation(validateCardForm(readFormFields()), { touchedOnly: true });
        }
    };

    els.firstName?.addEventListener('input', onFirstName);
    els.lastName?.addEventListener('input', onLastName);
    els.cardNumber?.addEventListener('input', onCardNumber);
    els.expiry?.addEventListener('input', onExpiry);
    els.cvv?.addEventListener('input', onCvv);

    [els.firstName, els.lastName, els.cardNumber, els.expiry, els.cvv].forEach((input) => {
        input?.addEventListener('blur', () => {
            if (input === els.cardNumber) {
                const digits = input.value.replace(/\D/g, '');
                updateBrand(digits);
                input.value = formatCardNumber(digits, currentBrand);
            } else if (input === els.expiry) {
                input.value = formatExpiry(input.value);
            } else if (input === els.firstName || input === els.lastName) {
                input.value = sanitizeCardName(input.value);
            }
            input.dataset.touched = '1';
            applyValidation(validateCardForm(readFormFields()), { touchedOnly: true });
            updatePayButton(validateCardForm(readFormFields()));
        });
    });
}

function bindCvvHelp() {
    if (!els.cvvHelp || !els.cvvTip) return;

    const open = () => {
        els.cvvTip.hidden = false;
        els.cvvHelp.setAttribute('aria-expanded', 'true');
    };
    const close = () => {
        els.cvvTip.hidden = true;
        els.cvvHelp.setAttribute('aria-expanded', 'false');
    };

    els.cvvHelp.addEventListener('mouseenter', open);
    els.cvvHelp.addEventListener('mouseleave', close);
    els.cvvHelp.addEventListener('focus', open);
    els.cvvHelp.addEventListener('blur', close);
    els.cvvHelp.addEventListener('click', (e) => {
        e.preventDefault();
        if (els.cvvTip.hidden) open();
        else close();
    });
    document.addEventListener('click', (e) => {
        if (!els.cvvHelp.contains(e.target) && !els.cvvTip.contains(e.target)) close();
    });
}

async function onSubmit(e) {
    e.preventDefault();
    showFormAlert('');

    [els.firstName, els.lastName, els.cardNumber, els.expiry, els.cvv].forEach((input) => {
        if (input) input.dataset.touched = '1';
    });

    const result = validateCardForm(readFormFields());
    applyValidation(result);
    updatePayButton(result);

    if (!result.valid) {
        showFormAlert('Kart bilgilerinizi kontrol edip tekrar deneyebilirsiniz.');
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

    submitting = true;
    if (els.submit) {
        els.submit.disabled = true;
        els.submit.dataset.originalText = els.submit.textContent;
        els.submit.textContent = 'İşleniyor...';
    }

    try {
        const payResult = await startPayment({
            packageId: checkout?.package?.id,
        });
        if (payResult?.ok && payResult.order) {
            showSuccess(payResult.order);
            return;
        }
        const message = payResult?.message
            || (payResult?.code === PaymentErrorCode.PROVIDER_NOT_READY
                ? 'Ödeme henüz aktif değil.'
                : 'Ödeme gerçekleştirilemedi. Kart bilgilerinizi kontrol edip tekrar deneyebilirsiniz.');
        if (payResult?.code === PaymentErrorCode.PROVIDER_NOT_READY) {
            showToast(message, 'error');
        } else {
            showFormAlert(message);
        }
    } catch {
        showFormAlert('Ödeme gerçekleştirilemedi. Kart bilgilerinizi kontrol edip tekrar deneyebilirsiniz.');
    } finally {
        submitting = false;
        if (els.submit) {
            els.submit.textContent = els.submit.dataset.originalText || 'Ödeme Yap';
            updatePayButton(validateCardForm(readFormFields()));
        }
    }
}

function showSuccess(order) {
    if (els.successOrder) els.successOrder.textContent = `#${order.orderNumber}`;
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

async function init() {
    cacheElements();
    if (els.authLink) els.authLink.href = loginHref();

    bindCardInputs();
    bindCvvHelp();
    bindNetwork();
    els.form?.addEventListener('submit', onSubmit);

    showView('loading');

    const ctx = await loadCheckoutContext(paketIdFromUrl());
    if (!ctx.ok) {
        if (ctx.code === PaymentErrorCode.AUTH) {
            showView('auth');
            return;
        }
        showPageError(ctx.message);
        return;
    }

    checkout = ctx;
    fillPackageSummary(ctx.package, formatCheckoutAmount(ctx.amount));
    showView('checkout');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
