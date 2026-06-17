/**
 * YAZİYO - Şifre kuralları (kayıt & şifre sıfırlama)
 */

// Türkçe dahil tüm Unicode büyük/küçük harfler (Ş, İ, Ğ vb.)
const HAS_UPPER = /[\p{Lu}]/u;
const HAS_LOWER = /[\p{Ll}]/u;

export const PASSWORD_RULES = {
    length: (pw) => pw.length >= 8 && pw.length <= 64,
    upper: (pw) => HAS_UPPER.test(pw),
    lower: (pw) => HAS_LOWER.test(pw),
    number: (pw) => /[0-9]/.test(pw),
    noSpace: (pw) => !/\s/.test(pw),
};

export function isPasswordValid(password) {
    return Object.values(PASSWORD_RULES).every((rule) => rule(password));
}

export function getPasswordStrength(password) {
    const checks = ['length', 'upper', 'lower', 'number'].map((k) => PASSWORD_RULES[k](password));
    const met = checks.filter(Boolean).length;
    if (met <= 1) return { label: 'Zayıf', class: 'bg-red-500', textClass: 'text-red-500', percent: 25 };
    if (met <= 3) return { label: 'Orta', class: 'bg-yellow-500', textClass: 'text-yellow-500', percent: 60 };
    return { label: 'Güçlü', class: 'bg-green-500', textClass: 'text-green-500', percent: 100 };
}
