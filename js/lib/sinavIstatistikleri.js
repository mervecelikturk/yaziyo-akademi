/**
 * Sınav İstatistiği — sonuç ekranına eklenen ek istatistikler.
 * Mevcut sonuç hesaplamalarına dokunmaz; yalnızca gösterim için kullanılır.
 */
(function (global) {
    'use strict';

    var SKIPPED_LABEL = 'Atlanan Kelime';
    var SKIP_WARN_THRESHOLD = 20;
    var SKIP_INVALID_THRESHOLD = 22;
    var WRONG_PCT_INVALID_THRESHOLD = 25;

    function toInt(n) {
        var v = Number(n);
        return Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
    }

    /**
     * Yanlış kelime yüzdesi = (yanlış / toplam) × 100
     * @param {number} wrongWords
     * @param {number} totalWords
     * @returns {number}
     */
    function calcWrongWordPercent(wrongWords, totalWords) {
        var wrong = toInt(wrongWords);
        var total = toInt(totalWords);
        if (total <= 0) return 0;
        return Math.round((wrong / total) * 100);
    }

    /**
     * evaluateExamText mistakes listesinden atlanan kelime sayısı
     * @param {Array<{errorType?: string}>|null|undefined} mistakes
     * @param {string} [skippedLabel]
     * @returns {number}
     */
    function countSkippedFromMistakes(mistakes, skippedLabel) {
        if (!Array.isArray(mistakes)) return 0;
        var label = skippedLabel || SKIPPED_LABEL;
        var n = 0;
        for (var i = 0; i < mistakes.length; i++) {
            if (mistakes[i] && mistakes[i].errorType === label) n++;
        }
        return n;
    }

    /**
     * evaluateExamText steps listesinden atlanan kelime sayısı
     * @param {Array<{type?: string}>|null|undefined} steps
     * @returns {number}
     */
    function countSkippedFromSteps(steps) {
        if (!Array.isArray(steps)) return 0;
        var n = 0;
        for (var i = 0; i < steps.length; i++) {
            if (steps[i] && steps[i].type === 'skipped') n++;
        }
        return n;
    }

    function el(id, root) {
        if (root && typeof root.querySelector === 'function') {
            var found = root.querySelector('#' + id);
            if (found) return found;
        }
        return document.getElementById(id);
    }

    function setText(id, text, root) {
        var node = el(id, root);
        if (node) node.textContent = text;
    }

    function setHidden(id, hidden, root) {
        var node = el(id, root);
        if (!node) return;
        node.classList.toggle('hidden', !!hidden);
    }

    /**
     * Sonuç ekranındaki Sınav İstatistiği alanını doldurur.
     * Beklenen id'ler (prefix ile):
     *  - {p}result-exam-wrong-pct
     *  - {p}result-exam-backspace
     *  - {p}result-exam-skipped
     *  - {p}result-exam-skipped-bang
     *  - {p}result-exam-alert-skip
     *  - {p}result-exam-alert-error
     *  - {p}result-exam-alerts (opsiyonel sarmalayıcı)
     *
     * @param {{
     *   wrongWords: number,
     *   totalWords: number,
     *   backspaceCount: number,
     *   skippedWords: number,
     *   idPrefix?: string,
     *   root?: ParentNode|null
     * }} opts
     */
    function fillExamStats(opts) {
        opts = opts || {};
        var prefix = opts.idPrefix || '';
        var root = opts.root || null;
        var wrong = toInt(opts.wrongWords);
        var total = toInt(opts.totalWords);
        var backspace = toInt(opts.backspaceCount);
        var skipped = toInt(opts.skippedWords);
        var wrongPct = calcWrongWordPercent(wrong, total);

        setText(prefix + 'result-exam-wrong-pct', wrongPct + '%', root);
        setText(prefix + 'result-exam-backspace', String(backspace), root);
        setText(prefix + 'result-exam-skipped', String(skipped), root);

        var showBang = skipped > SKIP_WARN_THRESHOLD;
        setHidden(prefix + 'result-exam-skipped-bang', !showBang, root);

        var showSkipAlert = skipped >= SKIP_INVALID_THRESHOLD;
        var showErrorAlert = wrongPct >= WRONG_PCT_INVALID_THRESHOLD;
        setHidden(prefix + 'result-exam-alert-skip', !showSkipAlert, root);
        setHidden(prefix + 'result-exam-alert-error', !showErrorAlert, root);

        var alertsWrap = el(prefix + 'result-exam-alerts', root);
        if (alertsWrap) {
            alertsWrap.classList.toggle('hidden', !(showSkipAlert || showErrorAlert));
        }
    }

    var api = {
        SKIPPED_LABEL: SKIPPED_LABEL,
        SKIP_WARN_THRESHOLD: SKIP_WARN_THRESHOLD,
        SKIP_INVALID_THRESHOLD: SKIP_INVALID_THRESHOLD,
        WRONG_PCT_INVALID_THRESHOLD: WRONG_PCT_INVALID_THRESHOLD,
        calcWrongWordPercent: calcWrongWordPercent,
        countSkippedFromMistakes: countSkippedFromMistakes,
        countSkippedFromSteps: countSkippedFromSteps,
        fillExamStats: fillExamStats
    };

    global.YaziyoSinavIstatistikleri = api;
})(typeof window !== 'undefined' ? window : globalThis);
