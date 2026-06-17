/**
 * YAZİYO — Oyun sayfaları için uyarı modali (sonuç/şifre modalı tasarımı)
 */
const VARIANTS = {
    moderation: {
        title: 'Oda Adı Uygun Değil',
        icon: 'fa-shield-halved',
        headerIconClass: 'yr-result-header-icon--moderation',
        stageIconClass: 'yr-result-dialog-stage-icon--moderation',
    },
    warning: {
        title: 'Uyarı',
        icon: 'fa-triangle-exclamation',
        headerIconClass: '',
        stageIconClass: 'yr-result-dialog-stage-icon--warning',
    },
    error: {
        title: 'Hata',
        icon: 'fa-circle-xmark',
        headerIconClass: 'yr-result-header-icon--error',
        stageIconClass: 'yr-result-dialog-stage-icon--error',
    },
};

let modalRoot = null;
let onCloseCallback = null;
let escHandler = null;

function ensureModal() {
    if (modalRoot) return modalRoot;

    const root = document.createElement('div');
    root.id = 'yaziyo-alert-modal';
    root.className = 'hidden fixed inset-0 z-[340] flex items-center justify-center p-4';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML = `
        <div class="yr-result-backdrop" data-yaziyo-alert-close></div>
        <div class="yr-result-panel yr-modal-enter w-full max-w-sm">
            <div class="yr-result-header">
                <div class="flex items-center gap-3 min-w-0">
                    <div data-yaziyo-alert-icon-wrap class="yr-result-header-icon">
                        <i data-yaziyo-alert-icon class="fa-solid"></i>
                    </div>
                    <span data-yaziyo-alert-title class="yr-result-header-title"></span>
                </div>
            </div>
            <div class="yr-result-body text-center">
                <div class="yr-result-stage yr-result-dialog-stage">
                    <i data-yaziyo-alert-stage-icon class="fa-solid yr-result-dialog-stage-icon"></i>
                </div>
                <p data-yaziyo-alert-message class="yr-result-sub mb-5"></p>
                <div class="yr-result-actions">
                    <button type="button" data-yaziyo-alert-ok class="yr-result-btn-primary yr-result-btn-full">
                        <i class="fa-solid fa-check"></i> Tamam
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(root);

    const close = () => hideYaziyoAlert();

    root.querySelectorAll('[data-yaziyo-alert-close]').forEach((el) => {
        el.addEventListener('click', close);
    });
    root.querySelector('[data-yaziyo-alert-ok]')?.addEventListener('click', close);

    modalRoot = root;
    return root;
}

function applyHeaderIconVariant(wrap, variantKey) {
    const base = 'yr-result-header-icon';
    const extra = VARIANTS[variantKey]?.headerIconClass || '';
    wrap.className = extra ? `${base} ${extra}` : base;
}

function applyStageIconVariant(icon, variantKey) {
    const v = VARIANTS[variantKey] || VARIANTS.warning;
    icon.className = `fa-solid ${v.icon} yr-result-dialog-stage-icon ${v.stageIconClass}`.trim();
}

/**
 * @param {Object} opts
 * @param {string} opts.message
 * @param {string} [opts.title]
 * @param {'moderation'|'warning'|'error'} [opts.variant]
 * @param {() => void} [opts.onClose]
 */
export function showYaziyoAlert(opts = {}) {
    const { message, title, variant = 'warning', onClose } = opts;
    if (!message) return;

    const v = VARIANTS[variant] || VARIANTS.warning;
    const root = ensureModal();
    const iconWrap = root.querySelector('[data-yaziyo-alert-icon-wrap]');
    const headerIcon = root.querySelector('[data-yaziyo-alert-icon]');
    const stageIcon = root.querySelector('[data-yaziyo-alert-stage-icon]');
    const titleEl = root.querySelector('[data-yaziyo-alert-title]');
    const msgEl = root.querySelector('[data-yaziyo-alert-message]');

    onCloseCallback = onClose || null;

    applyHeaderIconVariant(iconWrap, variant);
    headerIcon.className = `fa-solid ${v.icon}`;
    applyStageIconVariant(stageIcon, variant);
    titleEl.textContent = title || v.title;
    msgEl.textContent = message;

    root.classList.remove('hidden');
    root.classList.add('flex');

    if (escHandler) document.removeEventListener('keydown', escHandler);
    escHandler = (e) => {
        if (e.key === 'Escape') hideYaziyoAlert();
    };
    document.addEventListener('keydown', escHandler);

    root.querySelector('[data-yaziyo-alert-ok]')?.focus();
}

export function hideYaziyoAlert() {
    if (!modalRoot) return;

    modalRoot.classList.add('hidden');
    modalRoot.classList.remove('flex');

    if (onCloseCallback) {
        onCloseCallback();
        onCloseCallback = null;
    }

    if (escHandler) {
        document.removeEventListener('keydown', escHandler);
        escHandler = null;
    }
}

/** Oda adı / küfür uyarısı kısayolu */
export function showRoomNameModerationAlert(message, onClose) {
    showYaziyoAlert({
        message: message || 'Bu oda adı topluluk kurallarına uygun değil. Lütfen farklı bir ad seçin.',
        variant: 'moderation',
        onClose,
    });
}

export function isModerationErrorMessage(msg) {
    if (!msg) return false;
    const m = String(msg).toLowerCase();
    return m.includes('topuluk kuralları') || m.includes('uygun değil') || m.includes('karakter');
}

if (typeof window !== 'undefined') {
    window.YaziyoAlert = {
        show: showYaziyoAlert,
        hide: hideYaziyoAlert,
        showRoomNameModeration: showRoomNameModerationAlert,
        isModerationError: isModerationErrorMessage,
    };
}
