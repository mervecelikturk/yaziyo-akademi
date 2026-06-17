/**
 * Oturum bazlı tuş basım takibi (klavye çalışması / özel metin)
 */
import { normalizePressedKey } from './keyboardLayouts.js';

let sessionId = null;
let keyboardLayout = 'q';
/** @type {Map<string, number>} */
let keyCounts = new Map();
let isActive = false;

/**
 * @param {'q'|'f'|string} layout
 */
export function startKeyPressSession(layout = 'q') {
    sessionId = crypto.randomUUID();
    keyboardLayout = layout === 'f' ? 'f' : 'q';
    keyCounts = new Map();
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
}

export function resetKeyPressSession() {
    sessionId = null;
    keyCounts = new Map();
    isActive = false;
    keyboardLayout = 'q';
}

/**
 * @returns {{ sessionId: string, keyboardLayout: string, keys: { key: string, count: number }[], totalPresses: number } | null}
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
        hasActiveKeyPressSession,
    };
}
