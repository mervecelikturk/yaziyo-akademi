/** Ad/soyad: yalnızca Unicode harfler (Türkçe dahil); boşluk, sayı ve sembol yok. */
export const NAME_PART_PATTERN = /^[\p{L}]+$/u;

export function sanitizeNameInput(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/[^\p{L}]/gu, '');
}

export function isValidNamePart(value) {
    const trimmed = (value || '').trim();
    return trimmed.length > 0 && NAME_PART_PATTERN.test(trimmed);
}

export function validateNameFields(name, surname) {
    const ad = (name || '').trim();
    const soyad = (surname || '').trim();

    if (!ad) return 'Ad alanı zorunludur.';
    if (!soyad) return 'Soyad alanı zorunludur.';
    if (!isValidNamePart(ad)) {
        return 'Ad yalnızca harflerden oluşmalıdır (boşluk, sayı ve sembol kullanılamaz).';
    }
    if (!isValidNamePart(soyad)) {
        return 'Soyad yalnızca harflerden oluşmalıdır (boşluk, sayı ve sembol kullanılamaz).';
    }
    return null;
}

export function bindNameInput(input) {
    if (!input || input.dataset.yaziyoNameBound === '1') return;
    input.dataset.yaziyoNameBound = '1';

    input.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
        }
    });

    input.addEventListener('input', () => {
        const sanitized = sanitizeNameInput(input.value);
        if (sanitized !== input.value) {
            input.value = sanitized;
        }
    });

    input.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = e.clipboardData?.getData('text') || '';
        const sanitized = sanitizeNameInput(text);
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        input.value = input.value.slice(0, start) + sanitized + input.value.slice(end);
        const pos = start + sanitized.length;
        input.setSelectionRange(pos, pos);
    });
}
