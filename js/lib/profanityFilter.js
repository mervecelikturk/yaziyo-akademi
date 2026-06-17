/**
 * YAZİYO — Oda adı moderasyonu (normalize + profanity + kurallar)
 */
import { PROFANITY_TERMS } from './profanityTerms.js';

export const ROOM_NAME_MIN = 3;
export const ROOM_NAME_MAX = 20;

/** Görünen ad: harf, rakam, boşluk (Türkçe dahil) */
export const ROOM_NAME_PATTERN = /^[\p{L}\p{N} ]+$/u;

const SEPARATOR_RE = /[\s.\*\-_+#@!?,;:'"\/\\|()[\]{}<>~`%^&=]+/g;
const EXCESSIVE_REPEAT_RE = /(.)\1{4,}/u;
const LEET_MAP = {
    '@': 'a', '4': 'a',
    '3': 'e',
    '1': 'i', '!': 'i', '|': 'i',
    '0': 'o',
    '5': 's', '$': 's',
    '7': 't',
};

const TR_FOLD = {
    ş: 's', ğ: 'g', ı: 'i', ö: 'o', ü: 'u', ç: 'c',
    Ş: 's', Ğ: 'g', İ: 'i', I: 'i', Ö: 'o', Ü: 'u', Ç: 'c',
};

/** Liste yüklemede bir kez normalize edilir (O(1) lookup hazırlığı) */
const NORMALIZED_BLOCKLIST = [...new Set(
    PROFANITY_TERMS
        .map((t) => normalizeText(t))
        .filter((t) => t.length >= 3)
)];

const SHORT_BLOCKLIST = [...new Set(
    PROFANITY_TERMS
        .map((t) => normalizeText(t))
        .filter((t) => t.length > 0 && t.length < 3)
)];

/**
 * Bypass denemelerini tek diziye indirger.
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text) {
    if (text == null || text === '') return '';

    let s = String(text).toLowerCase();

    s = s.replace(/[\u0300-\u036f]/g, '');
    s = s.split('').map((ch) => TR_FOLD[ch] ?? ch).join('');

    s = s.replace(SEPARATOR_RE, '');

    s = s.split('').map((ch) => LEET_MAP[ch] ?? ch).join('');

    s = s.replace(/[^a-z0-9]/g, '');

    // aaa -> aa (3+ tekrar)
    s = s.replace(/(.)\1{2,}/g, '$1$1');

    return s;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function containsProfanity(text) {
    const normalized = normalizeText(text);
    if (!normalized) return false;

    for (let i = 0; i < SHORT_BLOCKLIST.length; i++) {
        if (normalized === SHORT_BLOCKLIST[i]) return true;
    }

    for (let i = 0; i < NORMALIZED_BLOCKLIST.length; i++) {
        const term = NORMALIZED_BLOCKLIST[i];
        if (term.length >= 3 && normalized.includes(term)) return true;
    }

    return false;
}

/**
 * @param {string} raw
 * @returns {{ valid: boolean, value: string, error: string|null, code: string|null }}
 */
export function validateRoomName(raw) {
    const value = (raw ?? '').trim();

    if (!value) {
        return { valid: false, value, error: 'Oda adı boş olamaz.', code: 'EMPTY' };
    }

    if (value.length < ROOM_NAME_MIN) {
        return {
            valid: false,
            value,
            error: `Oda adı en az ${ROOM_NAME_MIN} karakter olmalı.`,
            code: 'TOO_SHORT',
        };
    }

    if (value.length > ROOM_NAME_MAX) {
        return {
            valid: false,
            value,
            error: `Oda adı en fazla ${ROOM_NAME_MAX} karakter olabilir.`,
            code: 'TOO_LONG',
        };
    }

    if (!ROOM_NAME_PATTERN.test(value)) {
        return {
            valid: false,
            value,
            error: 'Yalnızca harf, rakam ve boşluk kullanılabilir.',
            code: 'INVALID_CHARS',
        };
    }

    if (EXCESSIVE_REPEAT_RE.test(value)) {
        return {
            valid: false,
            value,
            error: 'Ardışık tekrarlayan karakterler kullanılamaz.',
            code: 'EXCESSIVE_REPEAT',
        };
    }

    if (containsProfanity(value)) {
        return {
            valid: false,
            value,
            error: 'Bu oda adı topluluk kurallarına uygun değil. Lütfen farklı bir ad seçin.',
            code: 'PROFANITY',
        };
    }

    return { valid: true, value, error: null, code: null };
}

/**
 * Oda adı input’una canlı doğrulama bağlar.
 * @param {Object} opts
 * @param {HTMLInputElement} opts.input
 * @param {HTMLElement} [opts.errorEl]
 * @param {HTMLButtonElement} [opts.submitBtn]
 * @param {(result: ReturnType<typeof validateRoomName>) => void} [opts.onChange]
 */
export function attachRoomNameInput(opts) {
    const { input, errorEl, submitBtn, onChange } = opts;
    if (!input) return () => {};

    let touched = false;
    let timer = null;

    const apply = () => {
        const result = validateRoomName(input.value);
        if (onChange) onChange(result);

        if (errorEl) {
            if (touched && !result.valid) {
                errorEl.textContent = result.error || '';
                errorEl.classList.remove('hidden');
                input.classList.add('is-error', 'border-red-500/60');
                input.setAttribute('aria-invalid', 'true');
            } else {
                errorEl.textContent = '';
                errorEl.classList.add('hidden');
                input.classList.remove('is-error', 'border-red-500/60');
                input.removeAttribute('aria-invalid');
            }
        }

        if (submitBtn) {
            const isProfanity = result.code === 'PROFANITY';
            submitBtn.disabled = !result.valid && !isProfanity;
            submitBtn.classList.toggle('opacity-50', !result.valid);
            submitBtn.classList.toggle('pointer-events-none', !result.valid && !isProfanity);
            submitBtn.dataset.roomInvalid = result.valid ? '' : result.code || 'invalid';
        }

        return result;
    };

    const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(apply, 120);
    };

    input.addEventListener('input', () => {
        touched = true;
        schedule();
    });

    input.addEventListener('blur', () => {
        touched = true;
        apply();
    });

    const initial = apply();
    if (submitBtn && !initial.valid) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'pointer-events-none');
    }

    return apply;
}

/** Klasik script (IIFE) entegrasyonu için global */
if (typeof window !== 'undefined') {
    window.YaziyoRoomName = {
        normalizeText,
        containsProfanity,
        validateRoomName,
        attachRoomNameInput,
        ROOM_NAME_MIN,
        ROOM_NAME_MAX,
        ROOM_NAME_PATTERN,
    };
}
