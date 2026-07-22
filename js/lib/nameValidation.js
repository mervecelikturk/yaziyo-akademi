/**
 * YAZİYO — Ad / soyad doğrulama
 * Kayıt ve admin kullanıcı oluşturma için ortak kurallar.
 */

export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 30;

/** Harf + tek boşluklu kelimeler (Türkçe / İngilizce Unicode harfler) */
export const NAME_PATTERN = /^[\p{L}]+(?: [\p{L}]+)*$/u;

const VOWEL_PATTERN = /[aeıioöuüAEIİOÖUÜâêîôûÂÊÎÔÛ]/u;

/**
 * Yasaklı / anlamsız isimler — yeni terim eklemek için diziye yazmanız yeterli.
 * Karşılaştırma Türkçe küçük harf + boşluksuz biçimle yapılır.
 */
export const BLOCKED_NAMES = [
    'admin',
    'test',
    'deneme',
    'kullanici',
    'kullanıcı',
    'user',
    'isim',
    'ad',
    'soyad',
    'asdf',
    'qwerty',
    'abc',
    'abcd',
    'null',
    'undefined',
    'bos',
    'boş',
    'aaaa',
    'xxxx',
    'bbbb',
    'cccc',
    'guest',
    'misafir',
    'anonim',
    'anonymous',
    'none',
    'yok',
    'asd',
    'qwe',
    'zzz',
    'xxx',
    'name',
    'fullname',
];

function blockedSet() {
    return new Set(BLOCKED_NAMES.map((t) => String(t).toLocaleLowerCase('tr-TR')));
}

/** Baş/son boşlukları siler, ardışık boşlukları teke indirir. */
export function normalizeName(value) {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/\s+/g, ' ');
}

/** Yazım sırasında yalnızca harf ve boşluk bırakır. */
export function sanitizeNameInput(value) {
    if (typeof value !== 'string') return '';
    let v = value.replace(/[^\p{L}\s]/gu, '');
    v = v.replace(/^\s+/, '');
    v = v.replace(/\s{2,}/g, ' ');
    return v;
}

function isBlockedName(normalized) {
    const lower = normalized.toLocaleLowerCase('tr-TR');
    const set = blockedSet();
    if (set.has(lower)) return true;
    if (set.has(lower.replace(/\s+/g, ''))) return true;
    return lower.split(/\s+/).some((word) => set.has(word));
}

function isRepeatedChars(normalized) {
    const compact = normalized.replace(/\s+/g, '');
    if (compact.length < 2) return false;
    return /^(.)\1+$/u.test(compact);
}

/**
 * Tek bir ad veya soyad alanını doğrular.
 * @returns {string|null} Hata mesajı veya null
 */
export function validateNamePart(value, label = 'İsim') {
    const name = normalizeName(value);

    if (!name) {
        return `${label} alanı zorunludur.`;
    }
    if (name.length < NAME_MIN_LENGTH) {
        return `${label} en az ${NAME_MIN_LENGTH} karakter olmalıdır.`;
    }
    if (name.length > NAME_MAX_LENGTH) {
        return `${label} en fazla ${NAME_MAX_LENGTH} karakter olabilir.`;
    }
    if (!NAME_PATTERN.test(name)) {
        return 'İsim sadece harflerden oluşmalıdır.';
    }
    if (isBlockedName(name) || isRepeatedChars(name)) {
        return 'Bu isim kullanılamaz.';
    }
    if (!VOWEL_PATTERN.test(name)) {
        return 'Geçerli bir isim giriniz.';
    }
    return null;
}

export function isValidNamePart(value) {
    return validateNamePart(value) === null;
}

/**
 * Ad + soyad birlikte doğrular.
 * @returns {string|null}
 */
export function validateNameFields(name, surname) {
    const ad = normalizeName(name);
    const soyad = normalizeName(surname);

    const adErr = validateNamePart(ad, 'Ad');
    if (adErr) return adErr;

    const soyadErr = validateNamePart(soyad, 'Soyad');
    if (soyadErr) return soyadErr;

    return null;
}

/**
 * Birleşik "Ad Soyad" (metadata) için savunma doğrulaması.
 * @returns {string|null}
 */
export function validateFullNameString(fullName) {
    const n = normalizeName(fullName);
    if (!n) return 'Geçerli bir isim giriniz.';
    if (!NAME_PATTERN.test(n)) return 'İsim sadece harflerden oluşmalıdır.';

    const words = n.split(' ');
    if (words.length < 2) return 'Ad ve soyad giriniz.';

    for (const word of words) {
        const err = validateNamePart(word, 'İsim');
        if (err) {
            if (err.includes('zorunludur')) return 'Geçerli bir isim giriniz.';
            return err;
        }
    }
    return null;
}

/** Input'a canlı sanitizasyon bağlar (harf + boşluk). */
export function bindNameInput(input) {
    if (!input || input.dataset.yaziyoNameBound === '1') return;
    input.dataset.yaziyoNameBound = '1';

    input.addEventListener('input', () => {
        const sanitized = sanitizeNameInput(input.value);
        if (sanitized !== input.value) {
            const pos = input.selectionStart ?? sanitized.length;
            input.value = sanitized;
            const nextPos = Math.min(pos, sanitized.length);
            try {
                input.setSelectionRange(nextPos, nextPos);
            } catch { /* ignore */ }
        }
    });

    input.addEventListener('blur', () => {
        input.value = normalizeName(input.value);
    });

    input.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = e.clipboardData?.getData('text') || '';
        const sanitized = sanitizeNameInput(text);
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        const next = sanitizeNameInput(input.value.slice(0, start) + sanitized + input.value.slice(end));
        input.value = next;
        const pos = Math.min(start + sanitized.length, next.length);
        try {
            input.setSelectionRange(pos, pos);
        } catch { /* ignore */ }
    });
}

if (typeof window !== 'undefined') {
    window.YaziyoNameValidation = {
        NAME_MIN_LENGTH,
        NAME_MAX_LENGTH,
        BLOCKED_NAMES,
        NAME_PATTERN,
        normalizeName,
        sanitizeNameInput,
        isValidNamePart,
        validateNamePart,
        validateNameFields,
        validateFullNameString,
        bindNameInput,
    };
}
