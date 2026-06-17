/**
 * Isı haritası bonus analizleri (top/bottom tuşlar, el, parmak)
 */
import { getFingerMap, getHandForFinger, FINGER_LABELS } from './keyboardLayouts.js';

/**
 * @typedef {{ key: string, total_count: number, percentage: number }} KeyStatEntry
 */

/**
 * @param {Record<string, { total_count?: number, percentage?: number }>} keyStats
 * @param {string} layoutId
 */
export function computeHeatmapAnalytics(keyStats, layoutId) {
    const fingerMap = getFingerMap(layoutId);
    const entries = Object.entries(keyStats || {})
        .map(([key, stat]) => ({
            key,
            total_count: Number(stat?.total_count) || 0,
            percentage: Number(stat?.percentage) || 0,
        }))
        .filter((e) => e.total_count > 0);

    const totalPresses = entries.reduce((s, e) => s + e.total_count, 0);

    const sorted = [...entries].sort((a, b) => b.total_count - a.total_count);
    const top5 = sorted.slice(0, 5);
    const bottom5 = [...sorted].reverse().slice(0, 5);

    let leftHand = 0;
    let rightHand = 0;
    let thumb = 0;
    /** @type {Record<string, number>} */
    const fingerCounts = {};

    entries.forEach(({ key, total_count }) => {
        const finger = fingerMap[key] || 'unknown';
        fingerCounts[finger] = (fingerCounts[finger] || 0) + total_count;
        const hand = getHandForFinger(finger);
        if (hand === 'left') leftHand += total_count;
        else if (hand === 'right') rightHand += total_count;
        else thumb += total_count;
    });

    const handTotal = leftHand + rightHand + thumb || 1;
    const fingerDistribution = Object.entries(fingerCounts)
        .filter(([id]) => id !== 'unknown')
        .map(([id, count]) => ({
            id,
            label: FINGER_LABELS[id] || id,
            count,
            percentage: Math.round((count / handTotal) * 1000) / 10,
        }))
        .sort((a, b) => b.count - a.count);

    return {
        total_presses: totalPresses,
        top5,
        bottom5,
        hand_usage: {
            left: Math.round((leftHand / handTotal) * 1000) / 10,
            right: Math.round((rightHand / handTotal) * 1000) / 10,
            thumb: Math.round((thumb / handTotal) * 1000) / 10,
        },
        finger_distribution: fingerDistribution,
    };
}

/**
 * @param {object} analytics
 * @param {Record<string, object>} keyStats
 * @param {string} layoutId
 */
export function enrichAnalytics(analytics, keyStats, layoutId) {
    if (analytics?.top5?.length) return analytics;
    return computeHeatmapAnalytics(keyStats, layoutId);
}

export function formatKeyDisplay(key) {
    if (key === ' ') return 'Boşluk';
    if (key === '<') return '<';
    return key.toLocaleUpperCase('tr-TR');
}
