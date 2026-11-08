/**
 * Profil çalışma tercihleri.
 * Klavye türü ayarlanmamışsa varsayılan Q.
 * Çalışma sayfalarındaki seçimler bu tercihlerle açılır; oturum içinde değiştirilebilir.
 */
export const KEYBOARD_PREF_KEY = 'yaziyo-klavye-layout';
export const KEYBOARD_PREF_META = 'site_klavye_layout';
export const PRACTICE_PREF_KEY = 'yaziyo-calisma-ayarlari';

export const PRACTICE_DEFAULTS = {
    imla: 'imlasiz',
    ekran: 'exam',
    sure: '180',
    ses: 'none',
};

const PRACTICE_OPTIONS = {
    imla: ['imlasiz', 'imlali'],
    ekran: ['practice', 'app', 'exam', 'exam2', 'exam3'],
    sure: ['60', '180', '300', '600', 'suresiz'],
    ses: ['none', 'keyboard1', 'keyboard2', 'rain', 'waves', 'bird', 'clock', 'steps', 'kafe', 'somine', 'odak'],
};

const PRACTICE_SELECTS = {
    imla: '#punctuation-select, #edit-calisma-imla',
    ekran: '#display-mode-select, #edit-calisma-ekran',
    sure: '#time-select, #edit-calisma-sure',
    ses: '#sound-select, #edit-calisma-ses',
};

export function normalizeKeyboardLayout(value) {
    return String(value || '').trim().toLowerCase() === 'f' ? 'f' : 'q';
}

export function getStoredKeyboardLayout() {
    try {
        if (typeof document !== 'undefined' && !document.documentElement.classList.contains('is-logged-in')) {
            return 'q';
        }
        return normalizeKeyboardLayout(localStorage.getItem(KEYBOARD_PREF_KEY));
    } catch {
        return 'q';
    }
}

export function setStoredKeyboardLayout(layout) {
    const next = normalizeKeyboardLayout(layout);
    try {
        localStorage.setItem(KEYBOARD_PREF_KEY, next);
    } catch {
        /* ignore */
    }
    return next;
}

export function getKeyboardLayoutFromUser(user) {
    const raw = user?.user_metadata?.[KEYBOARD_PREF_META];
    if (raw == null || String(raw).trim() === '') return 'q';
    return normalizeKeyboardLayout(raw);
}

function isLoggedIn() {
    return typeof document !== 'undefined' && document.documentElement.classList.contains('is-logged-in');
}

function pickAllowed(value, allowed, fallback) {
    const next = String(value ?? '').trim();
    return allowed.includes(next) ? next : fallback;
}

export function normalizePracticeSettings(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    return {
        imla: pickAllowed(src.imla, PRACTICE_OPTIONS.imla, PRACTICE_DEFAULTS.imla),
        ekran: pickAllowed(src.ekran, PRACTICE_OPTIONS.ekran, PRACTICE_DEFAULTS.ekran),
        sure: pickAllowed(src.sure, PRACTICE_OPTIONS.sure, PRACTICE_DEFAULTS.sure),
        ses: pickAllowed(src.ses, PRACTICE_OPTIONS.ses, PRACTICE_DEFAULTS.ses),
    };
}

export function getStoredPracticeSettings() {
    if (!isLoggedIn()) return { ...PRACTICE_DEFAULTS };
    try {
        return normalizePracticeSettings(JSON.parse(localStorage.getItem(PRACTICE_PREF_KEY) || '{}'));
    } catch {
        return { ...PRACTICE_DEFAULTS };
    }
}

export function setStoredPracticeSettings(settings) {
    const next = normalizePracticeSettings(settings);
    try {
        localStorage.setItem(PRACTICE_PREF_KEY, JSON.stringify(next));
    } catch {
        /* ignore */
    }
    return next;
}

export function getPracticeSettingsFromUser(user) {
    const meta = user?.user_metadata || {};
    return normalizePracticeSettings({
        imla: meta.site_calisma_imla,
        ekran: meta.site_calisma_ekran,
        sure: meta.site_calisma_sure,
        ses: meta.site_calisma_ses,
    });
}

function applySelectValue(root, selector, value) {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll(selector).forEach((sel) => {
        if (sel.tagName !== 'SELECT') return;
        const hasOption = [...sel.options].some((opt) => opt.value === value);
        if (hasOption) sel.value = value;
    });
}

export function applyPreferredKeyboardSelects(root = document) {
    if (!root?.querySelectorAll) return getStoredKeyboardLayout();
    const layout = getStoredKeyboardLayout();
    root.querySelectorAll('#keyboard-type-select, [data-keyboard-layout-select]').forEach((sel) => {
        if (sel.tagName !== 'SELECT') return;
        const hasOption = [...sel.options].some((opt) => opt.value === layout);
        if (hasOption) sel.value = layout;
    });
    return layout;
}

export function applyPreferredPracticeSelects(root = document) {
    const settings = getStoredPracticeSettings();
    Object.entries(PRACTICE_SELECTS).forEach(([key, selector]) => {
        applySelectValue(root, selector, settings[key]);
    });
    return settings;
}

export function syncKeyboardPreferenceFromUser(user) {
    if (!user) {
        setStoredKeyboardLayout('q');
        setStoredPracticeSettings(PRACTICE_DEFAULTS);
    } else {
        setStoredKeyboardLayout(getKeyboardLayoutFromUser(user));
        setStoredPracticeSettings(getPracticeSettingsFromUser(user));
    }
    applyPreferredKeyboardSelects();
    applyPreferredPracticeSelects();
    return getStoredKeyboardLayout();
}

if (typeof window !== 'undefined') {
    window.YaziyoKeyboardPreference = {
        KEYBOARD_PREF_KEY,
        KEYBOARD_PREF_META,
        normalizeKeyboardLayout,
        getStoredKeyboardLayout,
        setStoredKeyboardLayout,
        getKeyboardLayoutFromUser,
        applyPreferredKeyboardSelects,
        PRACTICE_PREF_KEY,
        PRACTICE_DEFAULTS,
        normalizePracticeSettings,
        getStoredPracticeSettings,
        setStoredPracticeSettings,
        getPracticeSettingsFromUser,
        applyPreferredPracticeSelects,
        syncKeyboardPreferenceFromUser,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            applyPreferredKeyboardSelects();
            applyPreferredPracticeSelects();
        });
    } else {
        applyPreferredKeyboardSelects();
        applyPreferredPracticeSelects();
    }
}
