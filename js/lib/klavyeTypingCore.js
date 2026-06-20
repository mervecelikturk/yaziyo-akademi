/* ============================================================ */
/* YAZİYO - Klavye Yazım Değerlendirme Çekirdeği (paylaşımlı)  */
/* klavyeCalismasi.js ile aynı mantık — Kelime Evi vb. kullanır */
/* ============================================================ */
(function () {
    'use strict';

    const IMLASIZ_IGNORE_PATTERN = /[.,\/#!$%\^&\*;:{}=\-_~()'’"“”\d]/g;
    const MAX_WORD_LOOKAHEAD = 12;
    const KLAVYE_3DK_SURE = 180;

    const ERROR_LABELS = {
        EXTRA_STROKE: 'Fazla Vuruş',
        MISSING_STROKE: 'Eksik Vuruş',
        SWAP: 'Harf Yer Değiştirme',
        CHAR: 'Karakter Hatası',
        SPLIT: 'Kelime Bölme',
        MERGE: 'Kelime Birleştirme',
        EXTRA_SPACE: 'Fazla Boşluk',
        MIXED: 'Karışık Hata',
        EXTRA_WORD: 'Fazla Kelime',
        SKIPPED: 'Atlanan Kelime',
        INCOMPLETE_LAST: 'Eksik Son Kelime'
    };

    function normalizeForComparison(str, isImlasiz) {
        if (!str) return '';
        if (isImlasiz) {
            return str.toLocaleLowerCase('tr-TR').replace(IMLASIZ_IGNORE_PATTERN, '');
        }
        return str;
    }

    function parseWordsFromInput(input) {
        const trimmed = input.trim();
        if (!trimmed) return [];
        return trimmed.split(/\s+/).filter(w => w.length > 0);
    }

    function getActiveWordIndexFromInput(input, wordCount = Infinity) {
        if (!input || !input.trim()) return 0;
        const words = parseWordsFromInput(input);
        if (!words.length) return 0;
        const idx = input.endsWith(' ') ? words.length : words.length - 1;
        const max = Math.max(0, wordCount - 1);
        return Math.min(idx, max);
    }

    function hasExtraDoubleSpace(input) {
        return /\s{2,}/.test(input);
    }

    function isSubsequence(short, long) {
        let i = 0;
        for (let j = 0; j < long.length && i < short.length; j++) {
            if (short[i] === long[j]) i++;
        }
        return i === short.length;
    }

    function isAdjacentSwap(a, b) {
        if (a.length !== b.length) return false;
        const diffs = [];
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) diffs.push(i);
        }
        if (diffs.length !== 2) return false;
        const [i, j] = diffs;
        return a[i] === b[j] && a[j] === b[i];
    }

    function classifyWordError(expected, typed, isImlasiz) {
        const e = normalizeForComparison(expected, isImlasiz);
        const t = normalizeForComparison(typed, isImlasiz);
        if (e === t) return null;

        if (!isImlasiz) {
            if (typed.length > expected.length && e === normalizeForComparison(typed.slice(0, expected.length), false)) {
                const suffix = typed.slice(expected.length);
                if (/^[^\p{L}]+$/u.test(suffix)) return 'MIXED';
            }
            if (/\d/.test(typed) && !/\d/.test(expected)) return 'MIXED';
            if (expected.length === typed.length) {
                for (let i = 0; i < expected.length; i++) {
                    if (/\p{L}/u.test(expected[i]) && !/\p{L}/u.test(typed[i])) return 'CHAR';
                }
            }
        }

        if (t.length === e.length + 1 && (t.startsWith(e) || t.endsWith(e) || isSubsequence(e, t))) {
            return 'EXTRA_STROKE';
        }
        if (t.length === e.length - 1 && (e.startsWith(t) || e.endsWith(t) || isSubsequence(t, e))) {
            return 'MISSING_STROKE';
        }
        if (t.length === e.length && isAdjacentSwap(e, t)) return 'SWAP';

        if (Math.abs(t.length - e.length) === 1) {
            if (t.length > e.length && isSubsequence(e, t)) return 'EXTRA_STROKE';
            if (t.length < e.length && isSubsequence(t, e)) return 'MISSING_STROKE';
        }

        return 'MIXED';
    }

    function findForwardWordMatch(originalWords, o, typedNorm, isImlasiz) {
        const end = Math.min(originalWords.length, o + MAX_WORD_LOOKAHEAD + 1);
        for (let k = o + 1; k < end; k++) {
            if (normalizeForComparison(originalWords[k], isImlasiz) === typedNorm) {
                return k;
            }
        }
        return -1;
    }

    function tryWordSplit(originalWords, o, typedWords, t, isImlasiz) {
        if (t + 1 >= typedWords.length) return null;

        if (o + 1 < originalWords.length) {
            const nextOrigNorm = normalizeForComparison(originalWords[o + 1], isImlasiz);
            const nextTypedNorm = normalizeForComparison(typedWords[t + 1], isImlasiz);
            if (nextTypedNorm === nextOrigNorm) return null;
        }

        const expectedNorm = normalizeForComparison(originalWords[o], isImlasiz);
        let acc = '';
        const parts = [];

        for (let i = t; i < typedWords.length && parts.length < 8; i++) {
            parts.push(typedWords[i]);
            acc += normalizeForComparison(typedWords[i], isImlasiz);
            if (parts.length < 2) continue;
            if (acc === expectedNorm) {
                return { consumed: parts.length, parts, spellingCorrect: true, errorCount: 1 };
            }
            if (o + 1 < originalWords.length) {
                const nextOrigNorm = normalizeForComparison(originalWords[o + 1], isImlasiz);
                const partNorm = normalizeForComparison(typedWords[i], isImlasiz);
                if (partNorm === nextOrigNorm) return null;
            }
            if (acc.length > expectedNorm.length + 2) {
                return { consumed: parts.length, parts, spellingCorrect: false, errorCount: parts.length };
            }
        }
        return null;
    }

    function isIncompleteLastWord(originalWords, typedWords, isImlasiz) {
        if (!originalWords.length || !typedWords.length) return false;
        const lastOrig = normalizeForComparison(originalWords[originalWords.length - 1], isImlasiz);
        const lastTyped = normalizeForComparison(typedWords[typedWords.length - 1], isImlasiz);
        return lastOrig.startsWith(lastTyped) && lastTyped.length < lastOrig.length;
    }

    function evaluateExamText(originalWords, userInput, isImlasiz, options = {}) {
        const typedWords = parseWordsFromInput(userInput);
        const origStatus = originalWords.map(() => null);
        const steps = [];
        let correct = 0;
        let wrong = 0;
        const mistakes = [];
        let o = 0;
        let t = 0;
        const incompleteLastWord = options.incompleteLastWord === true;
        const lastOrigIdx = originalWords.length - 1;

        if (hasExtraDoubleSpace(userInput)) {
            wrong++;
            mistakes.push({
                user: '(fazla boşluk)',
                original: ERROR_LABELS.EXTRA_SPACE,
                errorType: ERROR_LABELS.EXTRA_SPACE
            });
            steps.push({ type: 'extra_space' });
        }

        while (t < typedWords.length) {
            if (o >= originalWords.length) {
                wrong++;
                mistakes.push({
                    user: typedWords[t],
                    original: ERROR_LABELS.EXTRA_WORD,
                    errorType: ERROR_LABELS.EXTRA_WORD
                });
                steps.push({ type: 'extra', typed: typedWords[t] });
                t++;
                continue;
            }

            const typed = typedWords[t];
            const expected = originalWords[o];
            const normT = normalizeForComparison(typed, isImlasiz);
            const normE = normalizeForComparison(expected, isImlasiz);

            if (o + 1 < originalWords.length) {
                const mergedNorm = normE + normalizeForComparison(originalWords[o + 1], isImlasiz);
                if (normT === mergedNorm) {
                    origStatus[o] = 'wrong';
                    origStatus[o + 1] = 'wrong';
                    wrong++;
                    mistakes.push({
                        user: typed,
                        original: expected + ' ' + originalWords[o + 1],
                        errorType: ERROR_LABELS.MERGE
                    });
                    steps.push({ type: 'merge', typed, original: expected, originalNext: originalWords[o + 1] });
                    o += 2;
                    t++;
                    continue;
                }
            }

            if (normT === normE) {
                correct++;
                origStatus[o] = 'correct';
                steps.push({ type: 'match', typed, original: expected });
                o++;
                t++;
                continue;
            }

            const foundAt = findForwardWordMatch(originalWords, o, normT, isImlasiz);
            if (foundAt > o) {
                for (let s = o; s < foundAt; s++) {
                    origStatus[s] = 'skipped';
                    mistakes.push({
                        user: '(Atlandı)',
                        original: originalWords[s],
                        errorType: ERROR_LABELS.SKIPPED
                    });
                    steps.push({ type: 'skipped', original: originalWords[s] });
                }
                correct++;
                origStatus[foundAt] = 'correct';
                steps.push({ type: 'skip_match', typed, original: originalWords[foundAt] });
                o = foundAt + 1;
                t++;
                continue;
            }

            if (t + 1 < typedWords.length &&
                normalizeForComparison(typedWords[t + 1], isImlasiz) === normE) {
                wrong++;
                mistakes.push({
                    user: typed,
                    original: ERROR_LABELS.EXTRA_WORD,
                    errorType: ERROR_LABELS.EXTRA_WORD
                });
                steps.push({ type: 'extra', typed });
                t++;
                continue;
            }

            const splitResult = tryWordSplit(originalWords, o, typedWords, t, isImlasiz);
            if (splitResult) {
                origStatus[o] = 'wrong';
                if (splitResult.spellingCorrect) {
                    wrong++;
                    mistakes.push({
                        user: splitResult.parts.join(' '),
                        original: expected,
                        errorType: ERROR_LABELS.SPLIT
                    });
                    steps.push({ type: 'split', typed: splitResult.parts.join(' '), original: expected, parts: splitResult.parts });
                } else {
                    wrong += splitResult.errorCount;
                    splitResult.parts.forEach(part => {
                        mistakes.push({
                            user: part,
                            original: ERROR_LABELS.MIXED,
                            errorType: ERROR_LABELS.MIXED
                        });
                    });
                    steps.push({ type: 'split_wrong', parts: splitResult.parts, original: expected });
                }
                o++;
                t += splitResult.consumed;
                continue;
            }

            if (incompleteLastWord && o === lastOrigIdx && normE.startsWith(normT) && normT.length < normE.length) {
                origStatus[o] = 'incomplete';
                mistakes.push({
                    user: typed,
                    original: expected,
                    errorType: ERROR_LABELS.INCOMPLETE_LAST
                });
                steps.push({ type: 'incomplete_last', typed, original: expected });
                o++;
                t++;
                continue;
            }

            const errKey = classifyWordError(expected, typed, isImlasiz) || 'MIXED';
            const label = ERROR_LABELS[errKey];
            origStatus[o] = 'wrong';
            wrong++;
            mistakes.push({ user: typed, original: label, errorType: label, expected });
            steps.push({ type: 'wrong', typed, original: expected, errorType: errKey });
            o++;
            t++;
        }

        const netWords = Math.max(0, correct - wrong);
        return { correct, wrong, mistakes, origStatus, steps, netWords };
    }

    function compareWordKeystrokes(typed, expected, isImlasiz) {
        let correct = 0;
        let wrong = 0;
        let total = 0;

        if (isImlasiz) {
            const tNorm = normalizeForComparison(typed, true);
            const eNorm = normalizeForComparison(expected, true);
            for (let i = 0; i < tNorm.length; i++) {
                total++;
                if (i < eNorm.length && tNorm[i] === eNorm[i]) correct++;
                else wrong++;
            }
            if (tNorm.length < eNorm.length) {
                const missing = eNorm.length - tNorm.length;
                wrong += missing;
                total += missing;
            }
        } else {
            for (let i = 0; i < typed.length; i++) {
                total++;
                if (i < expected.length && typed[i] === expected[i]) correct++;
                else wrong++;
            }
            if (typed.length < expected.length) {
                const missing = expected.length - typed.length;
                wrong += missing;
                total += missing;
            }
        }
        return { correct, wrong, total };
    }

    function countExtraWordKeystrokes(typed, isImlasiz) {
        if (isImlasiz) {
            const len = normalizeForComparison(typed, true).length;
            return { correct: 0, wrong: len, total: len };
        }
        return { correct: 0, wrong: typed.length, total: typed.length };
    }

    function compareIncompleteWordKeystrokes(typed, expected, isImlasiz) {
        const e = normalizeForComparison(expected, isImlasiz);
        const t = normalizeForComparison(typed, isImlasiz);
        let correct = 0;
        let wrong = 0;
        let total = 0;
        for (let i = 0; i < t.length; i++) {
            total++;
            if (i < e.length && t[i] === e[i]) correct++;
            else wrong++;
        }
        return { correct, wrong, total };
    }

    function calculateKeyStatsFromAlignment(originalWords, userInput, isImlasiz, options = {}) {
        const { steps } = evaluateExamText(originalWords, userInput, isImlasiz, options);
        let correctKeys = 0;
        let wrongKeys = 0;
        let totalKeys = 0;

        for (const step of steps) {
            if (step.type === 'match' || step.type === 'skip_match') {
                const r = compareWordKeystrokes(step.typed, step.original, isImlasiz);
                correctKeys += r.correct;
                wrongKeys += r.wrong;
                totalKeys += r.total;
            } else if (step.type === 'wrong') {
                const r = compareWordKeystrokes(step.typed, step.original, isImlasiz);
                correctKeys += r.correct;
                wrongKeys += r.wrong;
                totalKeys += r.total;
            } else if (step.type === 'incomplete_last') {
                const r = compareIncompleteWordKeystrokes(step.typed, step.original, isImlasiz);
                correctKeys += r.correct;
                wrongKeys += r.wrong;
                totalKeys += r.total;
            } else if (step.type === 'merge') {
                const mergedExpected = step.original + step.originalNext;
                const r = compareWordKeystrokes(step.typed, mergedExpected, isImlasiz);
                correctKeys += r.correct;
                wrongKeys += r.wrong;
                totalKeys += r.total;
            } else if (step.type === 'split') {
                const r = compareWordKeystrokes(step.typed, step.original, isImlasiz);
                correctKeys += r.correct;
                wrongKeys += r.wrong;
                totalKeys += r.total;
            } else if (step.type === 'split_wrong' && step.parts) {
                step.parts.forEach(part => {
                    const r = countExtraWordKeystrokes(part, isImlasiz);
                    wrongKeys += r.wrong;
                    totalKeys += r.total;
                });
            } else if (step.type === 'extra') {
                const r = countExtraWordKeystrokes(step.typed, isImlasiz);
                wrongKeys += r.wrong;
                totalKeys += r.total;
            }
        }

        const spaceRuns = userInput.match(/ +/g) || [];
        spaceRuns.forEach(sp => {
            totalKeys += sp.length;
            if (sp.length === 1) correctKeys++;
            else wrongKeys += sp.length;
        });

        return { correctKeys, wrongKeys, totalKeys };
    }

    const CATEGORIES = {
        ozel: {
            label: 'Özel Metinler',
            groups: [
                { id: 'hikaye', label: 'Hikaye' }, { id: 'tekerleme', label: 'Tekerleme' },
                { id: 'harfler', label: 'Harfler' }, { id: 'tersten_metin', label: 'Tersten Metin' },
                { id: 'renkler', label: 'Renkler' }, { id: 'hayvanlar', label: 'Hayvanlar' },
                { id: 'isimler', label: 'İsimler' }, { id: 'bitkiler', label: 'Bitkiler' }
            ]
        },
        zabit: {
            label: 'Zabıt Katipliği',
            groups: [
                { id: '2025', label: '2025' }, { id: '2023', label: '2023' }, { id: '2022', label: '2022' },
                { id: '2021', label: '2021' }, { id: '2019', label: '2019' }, { id: '2018', label: '2018' },
                { id: '2017_kasim', label: '2017 Kasım' }, { id: '2017_eylul', label: '2017 Eylül' },
                { id: '2016', label: '2016' }, { id: '2015_gys', label: '2015 GYS' },
                { id: '2015', label: '2015' }, { id: '2014', label: '2014' }
            ]
        },
        icra: {
            label: 'İcra Katipliği',
            groups: [
                { id: '2021', label: '2021' }, { id: '2019', label: '2019' }, { id: '2018', label: '2018' },
                { id: '2017', label: '2017' }, { id: '2016', label: '2016' },
                { id: '2015', label: '2015' }, { id: '2014', label: '2014' }
            ]
        },
        cte: {
            label: 'CTE Katipliği',
            groups: [
                { id: '2021', label: '2021' }, { id: '2019', label: '2019' },
                { id: '2018', label: '2018' }, { id: '2015', label: '2015' }
            ]
        },
        yargitay: { label: 'Yargıtay Metinleri', groups: [{ id: 'yargitay_metni', label: 'Yargıtay Metni' }] },
        danistay: { label: 'Danıştay Metinleri', groups: [{ id: 'danistay_metni', label: 'Danıştay Metni' }] },
        hsk: {
            label: 'HSK Metinleri',
            groups: [{ id: '2024', label: '2024' }, { id: '2021', label: '2021' }, { id: '2019', label: '2019' }]
        },
        yabanci: {
            label: 'Yabancı',
            groups: [
                { id: 'almanca', label: 'Almanca' }, { id: 'fransizca', label: 'Fransızca' },
                { id: 'ingilizce', label: 'İngilizce' }, { id: 'ispanyolca', label: 'İspanyolca' },
                { id: 'italyanca', label: 'İtalyanca' }, { id: 'portekizce', label: 'Portekizce' }
            ]
        }
    };

    window.YaziyoKlavyeCore = {
        IMLASIZ_IGNORE_PATTERN,
        MAX_WORD_LOOKAHEAD,
        KLAVYE_3DK_SURE,
        ERROR_LABELS,
        CATEGORIES,
        normalizeForComparison,
        parseWordsFromInput,
        getActiveWordIndexFromInput,
        isIncompleteLastWord,
        evaluateExamText,
        calculateKeyStatsFromAlignment
    };
})();
