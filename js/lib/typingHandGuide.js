/**
 * On parmak yazım — sıradaki tuş / parmak ipucu
 */
import { getFingerMap, normalizePressedKey, FINGER_LABELS } from './keyboardLayouts.js';

function formatHintChar(char) {
    if (char === ' ') return 'Boşluk';
    if (char === '\n') return 'Enter';
    return char.toLocaleUpperCase('tr-TR');
}

/**
 * @param {{ layoutId: 'f'|'q' }} opts
 */
export function createTypingHandGuide({ layoutId }) {
    let fingerMap = getFingerMap(layoutId === 'f' ? 'f' : 'q');

    function setLayout(id) {
        fingerMap = getFingerMap(id === 'f' ? 'f' : 'q');
    }

    function fingerForChar(char) {
        if (!char) return null;
        const key = normalizePressedKey(char) ?? char.toLocaleLowerCase('tr-TR');
        return fingerMap[key] || null;
    }

    /**
     * @param {string} referenceText
     * @param {number} typedLen
     * @returns {{ char: string|null, finger: string|null, label: string, displayChar: string }}
     */
    function updateFromReference(referenceText, typedLen) {
        const ref = (referenceText || '').trim().replace(/\s+/g, ' ');
        if (!ref || typedLen >= ref.length) {
            return { char: null, finger: null, label: '', displayChar: '' };
        }

        const char = ref[typedLen];
        const finger = fingerForChar(char);

        return {
            char,
            finger,
            label: finger ? (FINGER_LABELS[finger] || '') : '',
            displayChar: formatHintChar(char),
        };
    }

    return { setLayout, updateFromReference };
}
