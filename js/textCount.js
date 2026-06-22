/**
 * Toplam metin sayısı — metinlerDB.js yerine (ana sayfa performansı).
 * metinlerDB güncellenince: npm run update:text-count
 */
(function (global) {
    const TOTAL_TEXT_COUNT = 89;

    function getTotalTextCount() {
        return TOTAL_TEXT_COUNT;
    }

    global.getTotalTextCount = getTotalTextCount;
})(typeof window !== 'undefined' ? window : globalThis);
