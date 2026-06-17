/**
 * Node.js / Express — oda adı doğrulama
 * @example
 *   const { validateRoomNameMiddleware } = require('./js/server/roomNameValidation.cjs');
 *   app.post('/api/rooms', validateRoomNameMiddleware('ad'), handler);
 */
const fs = require('fs');
const path = require('path');

const TERMS = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../data/profanityTerms.json'), 'utf8')
);

const ROOM_NAME_MIN = 3;
const ROOM_NAME_MAX = 20;
const ROOM_NAME_PATTERN = /^[\p{L}\p{N} ]+$/u;
const SEPARATOR_RE = /[\s.\*\-_+#@!?,;:'"\/\\|()[\]{}<>~`%^&=]+/g;
const EXCESSIVE_REPEAT_RE = /(.)\1{4,}/u;
const LEET_MAP = { '@': 'a', '4': 'a', '3': 'e', '1': 'i', '!': 'i', '|': 'i', '0': 'o', '5': 's', '$': 's', '7': 't' };
const TR_FOLD = { ş: 's', ğ: 'g', ı: 'i', ö: 'o', ü: 'u', ç: 'c', Ş: 's', Ğ: 'g', İ: 'i', I: 'i', Ö: 'o', Ü: 'u', Ç: 'c' };

const NORMALIZED_BLOCKLIST = [...new Set(TERMS.map(normalizeText).filter((t) => t.length >= 3))];

function normalizeText(text) {
    if (text == null || text === '') return '';
    let s = String(text).toLowerCase().replace(/[\u0300-\u036f]/g, '');
    s = s.split('').map((ch) => TR_FOLD[ch] ?? ch).join('');
    s = s.replace(SEPARATOR_RE, '');
    s = s.split('').map((ch) => LEET_MAP[ch] ?? ch).join('');
    s = s.replace(/[^a-z0-9]/g, '');
    return s.replace(/(.)\1{2,}/g, '$1$1');
}

function containsProfanity(text) {
    const n = normalizeText(text);
    if (!n) return false;
    return NORMALIZED_BLOCKLIST.some((term) => term.length >= 3 && n.includes(term));
}

function validateRoomName(raw) {
    const value = (raw ?? '').trim();
    if (!value) return { valid: false, value, error: 'Oda adı boş olamaz.', code: 'EMPTY' };
    if (value.length < ROOM_NAME_MIN) return { valid: false, value, error: `Oda adı en az ${ROOM_NAME_MIN} karakter olmalı.`, code: 'TOO_SHORT' };
    if (value.length > ROOM_NAME_MAX) return { valid: false, value, error: `Oda adı en fazla ${ROOM_NAME_MAX} karakter olabilir.`, code: 'TOO_LONG' };
    if (!ROOM_NAME_PATTERN.test(value)) return { valid: false, value, error: 'Yalnızca harf, rakam ve boşluk kullanılabilir.', code: 'INVALID_CHARS' };
    if (EXCESSIVE_REPEAT_RE.test(value)) return { valid: false, value, error: 'Ardışık tekrarlayan karakterler kullanılamaz.', code: 'EXCESSIVE_REPEAT' };
    if (containsProfanity(value)) return { valid: false, value, error: 'Bu oda adı topluluk kurallarına uygun değil. Lütfen farklı bir ad seçin.', code: 'PROFANITY' };
    return { valid: true, value, error: null, code: null };
}

function validateRoomNameMiddleware(field = 'ad') {
    return (req, res, next) => {
        const result = validateRoomName(req.body?.[field]);
        if (!result.valid) {
            return res.status(400).json({ ok: false, error: result.error, code: result.code });
        }
        req.sanitizedRoomName = result.value;
        next();
    };
}

module.exports = {
    normalizeText,
    containsProfanity,
    validateRoomName,
    validateRoomNameMiddleware,
    ROOM_NAME_MIN,
    ROOM_NAME_MAX,
};
