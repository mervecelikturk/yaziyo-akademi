/**
 * Türkçe Q / F klavye fiziksel düzenleri ve on parmak parmak/el eşlemesi
 */

/** @typedef {{ id: string, label: string, width?: number }} KeyboardKeyDef */
/** @typedef {{ id: string, label: string, keys: KeyboardKeyDef[] }} KeyboardRow */

/** @type {Record<'q'|'f', { id: string, label: string, rows: KeyboardRow[] }>} */
export const KEYBOARD_LAYOUTS = {
    q: {
        id: 'q',
        label: 'Q Klavye (Türkçe)',
        rows: [
            {
                id: 'r1', label: '', keys: [
                    { id: '`', label: 'é', width: 1 },
                    { id: '1', label: '1' }, { id: '2', label: '2' }, { id: '3', label: '3' },
                    { id: '4', label: '4' }, { id: '5', label: '5' }, { id: '6', label: '6' },
                    { id: '7', label: '7' }, { id: '8', label: '8' }, { id: '9', label: '9' },
                    { id: '0', label: '0' }, { id: '*', label: '*' }, { id: '-', label: '-' },
                ],
            },
            {
                id: 'r2', label: '', keys: [
                    { id: 'q', label: 'Q' }, { id: 'w', label: 'W' }, { id: 'e', label: 'E' },
                    { id: 'r', label: 'R' }, { id: 't', label: 'T' }, { id: 'y', label: 'Y' },
                    { id: 'u', label: 'U' }, { id: 'ı', label: 'I' }, { id: 'o', label: 'O' },
                    { id: 'p', label: 'P' }, { id: 'ğ', label: 'Ğ' }, { id: 'ü', label: 'Ü' },
                ],
            },
            {
                id: 'r3', label: '', keys: [
                    { id: 'a', label: 'A' }, { id: 's', label: 'S' }, { id: 'd', label: 'D' },
                    { id: 'f', label: 'F' }, { id: 'g', label: 'G' }, { id: 'h', label: 'H' },
                    { id: 'j', label: 'J' }, { id: 'k', label: 'K' }, { id: 'l', label: 'L' },
                    { id: 'ş', label: 'Ş' }, { id: 'i', label: 'İ' },
                ],
            },
            {
                id: 'r4', label: '', keys: [
                    { id: '<', label: '<' }, { id: 'z', label: 'Z' }, { id: 'x', label: 'X' },
                    { id: 'c', label: 'C' }, { id: 'v', label: 'V' }, { id: 'b', label: 'B' },
                    { id: 'n', label: 'N' }, { id: 'm', label: 'M' }, { id: 'ö', label: 'Ö' },
                    { id: 'ç', label: 'Ç' },
                ],
            },
            {
                id: 'r5', label: '', keys: [
                    { id: ' ', label: 'Boşluk', width: 6 },
                ],
            },
        ],
    },
    f: {
        id: 'f',
        label: 'F Klavye (Türkçe)',
        rows: [
            {
                id: 'r1', label: '', keys: [
                    { id: '+', label: '+' }, { id: '1', label: '1' }, { id: '2', label: '2' },
                    { id: '3', label: '3' }, { id: '4', label: '4' }, { id: '5', label: '5' },
                    { id: '6', label: '6' }, { id: '7', label: '7' }, { id: '8', label: '8' },
                    { id: '9', label: '9' }, { id: '0', label: '0' }, { id: '/', label: '/' },
                    { id: '-', label: '-' }, { id: ',', label: ',' },
                ],
            },
            {
                id: 'r2', label: '', keys: [
                    { id: 'f', label: 'F' }, { id: 'g', label: 'G' }, { id: 'ğ', label: 'Ğ' },
                    { id: 'i', label: 'İ' }, { id: 'o', label: 'O' }, { id: 'd', label: 'D' },
                    { id: 'n', label: 'N' }, { id: 'h', label: 'H' }, { id: 'p', label: 'P' },
                    { id: 'q', label: 'Q' }, { id: 'w', label: 'W' },
                ],
            },
            {
                id: 'r3', label: '', keys: [
                    { id: 'u', label: 'U' }, { id: 'ı', label: 'I' }, { id: 'a', label: 'A' },
                    { id: 'e', label: 'E' }, { id: 't', label: 'T' }, { id: 'k', label: 'K' },
                    { id: 'm', label: 'M' }, { id: 'l', label: 'L' }, { id: 'y', label: 'Y' },
                    { id: 'ü', label: 'Ü' }, { id: 'z', label: 'Z' }, { id: 's', label: 'S' },
                ],
            },
            {
                id: 'r4', label: '', keys: [
                    { id: 'j', label: 'J' }, { id: 'ö', label: 'Ö' }, { id: 'v', label: 'V' },
                    { id: 'c', label: 'C' }, { id: 'ç', label: 'Ç' }, { id: 'b', label: 'B' },
                    { id: '.', label: '.' },
                ],
            },
            {
                id: 'r5', label: '', keys: [
                    { id: ' ', label: 'Boşluk', width: 6 },
                ],
            },
        ],
    },
};

/** On parmak — Q klavye parmak ataması */
const Q_FINGER_MAP = {
    '`': 'left_pinky', '1': 'left_pinky', 'q': 'left_pinky', 'a': 'left_pinky', 'z': 'left_pinky', '<': 'left_pinky', 'ö': 'left_pinky',
    '2': 'left_ring', 'w': 'left_ring', 's': 'left_ring', 'x': 'left_ring',
    '3': 'left_middle', 'e': 'left_middle', 'd': 'left_middle', 'c': 'left_middle',
    '4': 'left_index', 'r': 'left_index', 'f': 'left_index', 'v': 'left_index',
    '5': 'left_index', 't': 'left_index', 'g': 'left_index', 'b': 'left_index',
    '6': 'right_index', 'y': 'right_index', 'h': 'right_index', 'n': 'right_index',
    '7': 'right_index', 'u': 'right_index', 'j': 'right_index', 'm': 'right_index',
    '8': 'right_middle', 'ı': 'right_middle', 'k': 'right_middle', 'ş': 'right_middle',
    '9': 'right_ring', 'o': 'right_ring', 'l': 'right_ring', 'i': 'right_ring',
    '0': 'right_pinky', 'p': 'right_pinky', 'ğ': 'right_pinky', 'ü': 'right_pinky', 'ç': 'right_pinky',
    '*': 'right_pinky', '-': 'right_pinky',
    ' ': 'thumb',
};

/** On parmak — F klavye parmak ataması (Türkçe F standart) */
const F_FINGER_MAP = {
    '+': 'left_pinky', '1': 'left_pinky', 'j': 'left_pinky', 'ö': 'left_ring',
    '2': 'left_ring', '3': 'left_middle', 'v': 'left_middle', 'c': 'left_middle', 'ç': 'left_index',
    '4': 'left_index', '5': 'left_index', 'f': 'left_index', 'g': 'left_index', 'b': 'left_index',
    '6': 'right_index', '7': 'right_index', 'd': 'right_index', 'n': 'right_index', 'h': 'right_index', '.': 'right_index',
    '8': 'right_middle', 'i': 'right_middle', 'o': 'right_middle',
    '9': 'right_ring', 'q': 'right_ring', 'w': 'right_ring',
    '0': 'right_pinky', '/': 'right_pinky', '-': 'right_pinky', ',': 'right_pinky',
    'u': 'left_middle', 'ı': 'left_middle', 'a': 'left_index', 'e': 'left_middle',
    't': 'right_index', 'k': 'right_index', 'm': 'right_index', 'l': 'right_index', 'y': 'right_index', 'ü': 'right_index', 'z': 'right_index', 's': 'right_index',
    'p': 'right_pinky', 'ğ': 'right_pinky',
    ' ': 'thumb',
};

export const FINGER_LABELS = {
    left_pinky: 'Sol Serçe',
    left_ring: 'Sol Yüzük',
    left_middle: 'Sol Orta',
    left_index: 'Sol İşaret',
    right_index: 'Sağ İşaret',
    right_middle: 'Sağ Orta',
    right_ring: 'Sağ Yüzük',
    right_pinky: 'Sağ Serçe',
    thumb: 'Başparmak',
};

/**
 * @param {string} layoutId
 * @returns {Record<string, string>}
 */
export function getFingerMap(layoutId) {
    return layoutId === 'f' ? F_FINGER_MAP : Q_FINGER_MAP;
}

/**
 * @param {string} fingerId
 * @returns {'left'|'right'|'center'}
 */
export function getHandForFinger(fingerId) {
    if (fingerId === 'thumb') return 'center';
    if (fingerId.startsWith('left_')) return 'left';
    return 'right';
}

/**
 * @param {string} layoutId
 * @returns {import('./keyboardLayouts.js').KeyboardKeyDef[]}
 */
export function getAllLayoutKeys(layoutId) {
    const layout = KEYBOARD_LAYOUTS[layoutId === 'f' ? 'f' : 'q'];
    return layout.rows.flatMap((row) => row.keys);
}

/**
 * Klavye olayını layout tuş kimliğine normalleştirir
 * @param {string} rawKey
 * @returns {string|null}
 */
export function normalizePressedKey(rawKey) {
    if (!rawKey) return null;
    if (rawKey === ' ') return ' ';
    if (rawKey.length !== 1) return null;

    let char = rawKey;
    const trLower = char.toLocaleLowerCase('tr-TR');
    const map = {
        i: 'i', İ: 'i', I: 'ı', ı: 'ı',
        ş: 'ş', Ş: 'ş', ğ: 'ğ', Ğ: 'ğ',
        ü: 'ü', Ü: 'ü', ö: 'ö', Ö: 'ö',
        ç: 'ç', Ç: 'ç',
    };
    if (map[char]) return map[char];
    return trLower;
}

export function getLayoutLabel(layoutId) {
    return KEYBOARD_LAYOUTS[layoutId === 'f' ? 'f' : 'q'].label;
}
