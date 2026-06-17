/**
 * Ana sayfa istatistik kartları — metinlerDB'den gerçek metin sayısı
 */
(function () {
    const el = document.getElementById('metin-sayisi-gosterge');
    if (!el || typeof getTotalTextCount !== 'function') return;

    const count = getTotalTextCount();
    if (count > 0) {
        el.setAttribute('data-target', String(count));
    }
})();
