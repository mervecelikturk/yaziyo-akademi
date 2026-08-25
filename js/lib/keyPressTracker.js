/**
 * Oturum bazlı tuş basım takibi (klavye çalışması / özel metin)
 */
import { normalizePressedKey } from './keyboardLayouts.js';

let sessionId = null;
let keyboardLayout = 'q';
/** @type {Map<string, number>} */
let keyCounts = new Map();
let isActive = false;
let lastPressAt = 0;
/** @type {Map<string, { sum: number, count: number }>} */
let letterStats = new Map();

const LETTER_RE = /^[a-zçğıöşü]$/i;
const MIN_LETTER_MS = 40;
const MAX_LETTER_MS = 1500;

function isLetterKey(key) {
    return typeof key === 'string' && LETTER_RE.test(key);
}

/**
 * @param {'q'|'f'|string} layout
 */
export function startKeyPressSession(layout = 'q') {
    sessionId = crypto.randomUUID();
    keyboardLayout = layout === 'f' ? 'f' : 'q';
    keyCounts = new Map();
    letterStats = new Map();
    lastPressAt = 0;
    isActive = true;
}

export function stopKeyPressSession() {
    isActive = false;
}

/**
 * @param {string} rawKey
 */
export function recordKeyPress(rawKey) {
    if (!isActive || !sessionId) return;
    const key = normalizePressedKey(rawKey);
    if (!key) return;
    keyCounts.set(key, (keyCounts.get(key) || 0) + 1);

    const now = (typeof performance !== 'undefined' && performance.now)
        ? performance.now()
        : Date.now();
    if (lastPressAt > 0 && isLetterKey(key)) {
        const dt = now - lastPressAt;
        if (dt >= MIN_LETTER_MS && dt <= MAX_LETTER_MS) {
            const cur = letterStats.get(key) || { sum: 0, count: 0 };
            cur.sum += dt;
            cur.count += 1;
            letterStats.set(key, cur);
        }
    }
    lastPressAt = now;
}

export function resetKeyPressSession() {
    sessionId = null;
    keyCounts = new Map();
    letterStats = new Map();
    lastPressAt = 0;
    isActive = false;
    keyboardLayout = 'q';
}

/**
 * Harf başına ortalama basış aralığı (ms). En az 2 örnek gerekir.
 * @returns {Record<string, number>}
 */
export function getLetterTimingAverages() {
    const out = {};
    letterStats.forEach((v, key) => {
        if (v.count >= 2) out[key] = Math.round(v.sum / v.count);
    });
    return out;
}

/**
 * @returns {{ sessionId: string, keyboardLayout: string, keys: { key: string, count: number }[], totalPresses: number, letterMs: Record<string, number> } | null}
 */
export function getKeyPressSessionPayload() {
    if (!sessionId || keyCounts.size === 0) return null;

    const keys = Array.from(keyCounts.entries()).map(([key, count]) => ({ key, count }));
    const totalPresses = keys.reduce((sum, item) => sum + item.count, 0);

    return {
        sessionId,
        keyboardLayout,
        keys,
        totalPresses,
        letterMs: getLetterTimingAverages(),
    };
}

export function hasActiveKeyPressSession() {
    return isActive && sessionId !== null && keyCounts.size > 0;
}

if (typeof window !== 'undefined') {
    window.YaziyoKeyPressTracker = {
        startKeyPressSession,
        stopKeyPressSession,
        recordKeyPress,
        resetKeyPressSession,
        getKeyPressSessionPayload,
        getLetterTimingAverages,
        hasActiveKeyPressSession,
    };
}
