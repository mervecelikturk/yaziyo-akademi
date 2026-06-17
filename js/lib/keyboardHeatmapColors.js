/**
 * Isı haritası renk skalası
 * 0 → boş | %1–5 sarı | %5–10 turuncu | %10–20 kırmızı | %20+ koyu kırmızı
 */

/** @typedef {'empty'|'yellow'|'orange'|'red'|'dark-red'} HeatLevel */

/**
 * @param {number} percentage
 * @returns {HeatLevel}
 */
export function getHeatLevel(percentage) {
    const p = Number(percentage) || 0;
    if (p <= 0) return 'empty';
    if (p < 5) return 'yellow';
    if (p < 10) return 'orange';
    if (p < 20) return 'red';
    return 'dark-red';
}

/**
 * @param {HeatLevel} level
 * @returns {string} CSS custom properties / class suffix
 */
export function getHeatLevelClass(level) {
    return `kh-key--${level}`;
}

/**
 * @param {number} percentage
 * @returns {string}
 */
export function getHeatLevelLabel(percentage) {
    const level = getHeatLevel(percentage);
    const labels = {
        empty: 'Kullanım yok',
        yellow: 'Düşük (%1–5)',
        orange: 'Orta (%5–10)',
        red: 'Yüksek (%10–20)',
        'dark-red': 'Çok yüksek (%20+)',
    };
    return labels[level];
}

export const HEAT_LEGEND = [
    { level: 'empty', label: '0%' },
    { level: 'yellow', label: '%1–5' },
    { level: 'orange', label: '%5–10' },
    { level: 'red', label: '%10–20' },
    { level: 'dark-red', label: '%20+' },
];
