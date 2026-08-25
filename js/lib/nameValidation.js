/**
 * YAZİYO — Ad / soyad doğrulama
 * Kayıt ve admin kullanıcı oluşturma için ortak kurallar.
 * Boşluk, rakam ve sembol yok; en az 3 harf; Türkçe isim/soyisim listesi.
 */

import { isKnownTurkishGivenName, isKnownTurkishSurname } from './turkishNames.js';

export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 30;

/** Yalnızca Unicode harfler (boşluk / rakam / sembol yok) */
export const NAME_PATTERN = /^[\p{L}]+$/u;

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

/** Baş/son boşlukları siler; ad/soyad alanında iç boşluk bırakılmaz. */
export function normalizeName(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, '').trim();
}

/** Yazım sırasında yalnızca harf bırakır (boşluk, rakam, sembol silinir). */
export function sanitizeNameInput(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/[^\p{L}]/gu, '');
}

function isBlockedName(normalized) {
    const lower = normalized.toLocaleLowerCase('tr-TR');
    const set = blockedSet();
    if (set.has(lower)) return true;
    if (set.has(lower.replace(/\s+/g, ''))) return true;
    return false;
}

function isRepeatedChars(normalized) {
    const compact = normalized.replace(/\s+/g, '');
    if (compact.length < 2) return false;
    return /^(.)\1+$/u.test(compact);
}

function letterCount(name) {
    const letters = name.match(/\p{L}/gu);
    return letters ? letters.length : 0;
}

function isAdLabel(label) {
    const l = String(label || '').toLocaleLowerCase('tr-TR');
    return l === 'ad' || l === 'isim' || l.includes('adınız');
}

function isSoyadLabel(label) {
    const l = String(label || '').toLocaleLowerCase('tr-TR');
    return l === 'soyad' || l.includes('soyad');
}

function whitelistError(label) {
    if (isSoyadLabel(label)) {
        return 'Soyad, Türkçede kullanılan bir soyisim olmalıdır.';
    }
    return 'Ad, Türkçede kullanılan bir isim olmalıdır.';
}

function matchesWhitelist(name, label) {
    if (isSoyadLabel(label)) return isKnownTurkishSurname(name);
    if (isAdLabel(label) || label === 'İsim') return isKnownTurkishGivenName(name);
    return isKnownTurkishGivenName(name) || isKnownTurkishSurname(name);
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
    if (letterCount(name) < NAME_MIN_LENGTH) {
        return `${label} en az ${NAME_MIN_LENGTH} harf olmalıdır.`;
    }
    if (name.length > NAME_MAX_LENGTH) {
        return `${label} en fazla ${NAME_MAX_LENGTH} karakter olabilir.`;
    }
    if (!NAME_PATTERN.test(name)) {
        return `${label} yalnızca harflerden oluşmalıdır; boşluk, sayı veya sembol kullanılamaz.`;
    }
    if (isBlockedName(name) || isRepeatedChars(name)) {
        return 'Bu isim kullanılamaz.';
    }
    if (!VOWEL_PATTERN.test(name)) {
        return 'Geçerli bir isim giriniz.';
    }
    if (!matchesWhitelist(name, label)) {
        return whitelistError(label);
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
    const raw = typeof fullName === 'string' ? fullName.trim().replace(/\s+/g, ' ') : '';
    if (!raw) return 'Geçerli bir isim giriniz.';

    const words = raw.split(' ');
    if (words.length < 2) return 'Ad ve soyad giriniz.';

    const ad = words[0];
    const soyad = words.slice(1).join('');
    if (words.length > 2 || soyad.includes(' ')) {
        return 'Ad ve soyad boşluksuz, tek parça olmalıdır.';
    }

    const adErr = validateNamePart(ad, 'Ad');
    if (adErr) return adErr;
    const soyadErr = validateNamePart(soyad, 'Soyad');
    if (soyadErr) return soyadErr;
    return null;
}

/** Input'a canlı sanitizasyon bağlar (yalnızca harf; boşluk/sayı/sembol yok). */
export function bindNameInput(input) {
    if (!input || input.dataset.yaziyoNameBound === '1') return;
    input.dataset.yaziyoNameBound = '1';

    input.setAttribute('inputmode', 'text');
    input.setAttribute('autocomplete', input.getAttribute('autocomplete') || 'off');
    input.setAttribute('spellcheck', 'false');

    input.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.code === 'Space' || e.key === 'Spacebar') {
            e.preventDefault();
        }
        if (e.key.length === 1 && /[0-9]/.test(e.key)) {
            e.preventDefault();
        }
    });

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
