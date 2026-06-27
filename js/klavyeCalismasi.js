/* ============================================ */
/* KLAVYE ÇALIŞMASI (DÜZ METİN / ODAK MODU) JS  */
/* ============================================ */

/* === METİNLER BURAYA EKLENECEK === */
// Kullanıcı buraya kendi metinlerini (gerçek sınav metinlerini) ekleyecek
// Yapı: grup -> tur -> { id: "Metin Adı", content: "..." }
/** metinlerDB artık js/metinlerDB.js dosyasından yüklenmektedir. */

// Türlerin formatlı (okunabilir) isimleri
const turIsimleri = {
    "hikaye": "Hikaye",
    "tekerleme": "Tekerleme",
    "harfler": "Harfler",
    "tersten_metin": "Tersten Metin",
    "renkler": "Renkler",
    "hayvanlar": "Hayvanlar",
    "isimler": "İsimler",
    "bitkiler": "Bitkiler",
    "2025": "2025 Yılı",
    "2024": "2024 Yılı",
    "2023": "2023 Yılı",
    "2022": "2022 Yılı",
    "2021": "2021 Yılı",
    "2020": "2020 Yılı",
    "2019": "2019 Yılı",
    "2018": "2018 Yılı",
    "2017-1": "2017 1 Yılı",
    "2017-2": "2017 2 Yılı",
    "2016": "2016 Yılı",
    "2015-1": "2015 1 Yılı",
    "2015-2": "2015 2 Yılı",
    "2014": "2014 Yılı",
    "almanca": "Almanca",
    "fransizca": "Fransızca",
    "ingilizce": "İngilizce",
    "ispanyolca": "İspanyolca",
    "italyanca": "İtalyanca",
    "portekizce": "Portekizce"
};

/** İmlasız modda yok sayılan karakterler (noktalama, sembol, rakam) */
const IMLASIZ_IGNORE_PATTERN = /[.,\/#!$%\^&\*;:{}=\-_~()'’"“”\d]/g;

const MAX_WORD_LOOKAHEAD = 12;
const KLAVYE_3DK_SURE = 180;

function isImlasizMode() {
    const el = document.getElementById('punctuation-select');
    return el ? el.value === "imlasiz" : true;
}

/** Kelime / metin karşılaştırması için normalizasyon */
function normalizeForComparison(str, isImlasiz) {
    if (!str) return "";
    if (isImlasiz) {
        return str.toLocaleLowerCase('tr-TR').replace(IMLASIZ_IGNORE_PATTERN, "");
    }
    return str;
}

function parseWordsFromInput(input) {
    const trimmed = input.trim();
    if (!trimmed) return [];
    return trimmed.split(/\s+/).filter(w => w.length > 0);
}

/** Boşluğa basılana kadar yazılan kısmi kelimede aynı kelime indeksinde kalır */
function getActiveWordIndexFromInput(input, wordCount = Infinity) {
    if (!input || !input.trim()) return 0;
    const words = parseWordsFromInput(input);
    if (!words.length) return 0;
    const idx = input.endsWith(' ') ? words.length : words.length - 1;
    const max = Math.max(0, wordCount - 1);
    return Math.min(idx, max);
}

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

function isMistakeErrorLabelForSave(value) {
    if (!value || typeof value !== 'string') return true;
    const v = value.trim();
    if (!v || v.startsWith('(')) return true;
    return Object.values(ERROR_LABELS).includes(v);
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

/** Tek kelime için resmi hata türü sınıflandırması (en fazla 1 kelime hatası) */
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

/** İleride eşleşen orijinal kelime indeksini bul (atlama / yeniden hizalama) */
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

    // Sonraki kelime sıradaki orijinal kelimeyse bu bölme değil, ayrı kelimelerdir
    if (o + 1 < originalWords.length) {
        const nextOrigNorm = normalizeForComparison(originalWords[o + 1], isImlasiz);
        const nextTypedNorm = normalizeForComparison(typedWords[t + 1], isImlasiz);
        if (nextTypedNorm === nextOrigNorm) {
            return null;
        }
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

        // Parçalardan biri ilerideki orijinal kelimeyle eşleşiyorsa bölme değil
        if (o + 1 < originalWords.length) {
            const nextOrigNorm = normalizeForComparison(originalWords[o + 1], isImlasiz);
            const partNorm = normalizeForComparison(typedWords[i], isImlasiz);
            if (partNorm === nextOrigNorm) {
                return null;
            }
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

/**
 * Resmi sınav kurallarına göre metin değerlendirmesi.
 * Yazılmayan kısım değerlendirilmez; atlanan kelime hata sayılmaz.
 */
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
            const nextNorm = normalizeForComparison(originalWords[o + 1], isImlasiz);
            if (nextNorm) {
                const mergedNorm = normE + nextNorm;
                if (mergedNorm !== normE && normT === mergedNorm) {
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

function evaluateWordAlignment(originalWords, typedWords, isImlasiz, options = {}) {
    const userInput = typedWords.join(' ');
    const result = evaluateExamText(originalWords, userInput, isImlasiz, options);
    return {
        correct: result.correct,
        wrong: result.wrong,
        mistakes: result.mistakes,
        origStatus: result.origStatus,
        netWords: result.netWords,
        steps: result.steps
    };
}

function getAlignmentSteps(originalWords, typedWords, isImlasiz, options = {}) {
    const result = evaluateExamText(originalWords, typedWords.join(' '), isImlasiz, options);
    return {
        steps: result.steps,
        correct: result.correct,
        wrong: result.wrong,
        mistakes: result.mistakes,
        origStatus: result.origStatus,
        lastOrigIndex: 0
    };
}

/** Kelime hizalamasına göre tuş istatistikleri (atlama / fazla kelime kayması yok) */
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
    "ozel": {
        label: "Özel Metinler",
        groups: [
            { id: "hikaye", label: "Hikaye" },
            { id: "tekerleme", label: "Tekerleme" },
            { id: "harfler", label: "Harfler" },
            { id: "tersten_metin", label: "Tersten Metin" },
            { id: "renkler", label: "Renkler" },
            { id: "hayvanlar", label: "Hayvanlar" },
            { id: "isimler", label: "İsimler" },
            { id: "bitkiler", label: "Bitkiler" }
        ]
    },
    "zabit": {
        label: "Zabıt Katipliği",
        groups: [
            { id: "2025", label: "2025" },
            { id: "2023", label: "2023" },
            { id: "2022", label: "2022" },
            { id: "2021", label: "2021" },
            { id: "2019", label: "2019" },
            { id: "2018", label: "2018" },
            { id: "2017_kasim", label: "2017 Kasım" },
            { id: "2017_eylul", label: "2017 Eylül" },
            { id: "2016", label: "2016" },
            { id: "2015_gys", label: "2015 GYS" },
            { id: "2015", label: "2015" },
            { id: "2014", label: "2014" }
        ]
    },
    "icra": {
        label: "İcra Katipliği",
        groups: [
            { id: "2021", label: "2021" },
            { id: "2019", label: "2019" },
            { id: "2018", label: "2018" },
            { id: "2017", label: "2017" },
            { id: "2016", label: "2016" },
            { id: "2015", label: "2015" },
            { id: "2014", label: "2014" }
        ]
    },
    "cte": {
        label: "CTE Katipliği",
        groups: [
            { id: "2021", label: "2021" },
            { id: "2019", label: "2019" },
            { id: "2018", label: "2018" },
            { id: "2015", label: "2015" }
        ]
    },
    "yargitay": {
        label: "Yargıtay Metinleri",
        groups: [
            { id: "yargitay_metni", label: "Yargıtay Metni" }
        ]
    },
    "danistay": {
        label: "Danıştay Metinleri",
        groups: [
            { id: "danistay_metni", label: "Danıştay Metni" }
        ]
    },
    "hsk": {
        label: "HSK Metinleri",
        groups: [
            { id: "2024", label: "2024" },
            { id: "2021", label: "2021" },
            { id: "2019", label: "2019" }
        ]
    },
    "yabanci": {
        label: "Yabancı",
        groups: [
            { id: "almanca", label: "Almanca" },
            { id: "fransizca", label: "Fransızca" },
            { id: "ingilizce", label: "İngilizce" },
            { id: "ispanyolca", label: "İspanyolca" },
            { id: "italyanca", label: "İtalyanca" },
            { id: "portekizce", label: "Portekizce" }
        ]
    }
};

document.addEventListener('DOMContentLoaded', () => {
    /* ============================================ */
    /* DROPDOWN CASCADE MANTIĞI                    */
    /* ============================================ */
    const categorySelect = document.getElementById('category-select');
    const groupSelect = document.getElementById('group-select');
    const textSelect = document.getElementById('text-select');
    const startBtn = document.getElementById('start-btn');

    const groupTrigger = document.getElementById('group-select-trigger');
    const groupOptions = document.getElementById('group-select-options');
    const groupLabel = document.getElementById('group-select-label');
    
    const textTrigger = document.getElementById('text-select-trigger');
    const textOptions = document.getElementById('text-select-options');
    const textLabel = document.getElementById('text-select-label');

    // Dropdown Toggle (Aç/Kapat)
    function closeAllDropdowns() {
        if(groupOptions) groupOptions.classList.add('hidden');
        if(textOptions) textOptions.classList.add('hidden');
        if(groupTrigger) groupTrigger.querySelector('i').classList.remove('rotate-180');
        if(textTrigger) textTrigger.querySelector('i').classList.remove('rotate-180');
    }

    if(groupTrigger) {
        groupTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = groupOptions.classList.contains('hidden');
            closeAllDropdowns();
            if(isHidden) {
                groupOptions.classList.remove('hidden');
                groupTrigger.querySelector('i').classList.add('rotate-180');
            }
        });
    }

    if(textTrigger) {
        textTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = textOptions.classList.contains('hidden');
            closeAllDropdowns();
            if(isHidden) {
                textOptions.classList.remove('hidden');
                textTrigger.querySelector('i').classList.add('rotate-180');
            }
        });
    }

    // Dışarı tıklandığında kapat (Click-Outside)
    document.addEventListener('click', closeAllDropdowns);

    // Kategori değiştiğinde Grup dropdown'ını güncelle
    function updateGroups() {
        const category = categorySelect.value;
        const groups = CATEGORIES[category] ? CATEGORIES[category].groups : [];

        if(groupSelect) groupSelect.innerHTML = '';
        if(groupOptions) groupOptions.innerHTML = '';
        if(groupLabel) groupLabel.textContent = "Seçiniz...";

        if(groups.length === 0) {
            if(groupSelect) {
                const option = document.createElement('option');
                option.textContent = "Seçenek Bulunamadı";
                groupSelect.appendChild(option);
            }

            if(groupOptions) {
                const item = document.createElement('div');
                item.className = "px-4 py-2 text-yaziyo-text-secondary text-sm italic";
                item.textContent = "Seçenek Bulunamadı";
                groupOptions.appendChild(item);
            }
            updateTexts();
            return;
        }

        groups.forEach(g => {
            // Hidden Select
            if(groupSelect) {
                const option = document.createElement('option');
                option.value = g.id;
                option.textContent = g.label;
                groupSelect.appendChild(option);
            }

            // Özel UI
            if(groupOptions) {
                const item = document.createElement('div');
                item.className = "px-4 py-2 hover:bg-yaziyo-gold hover:text-slate-900 cursor-pointer transition-colors text-sm border-b border-yaziyo-border last:border-b-0";
                item.textContent = g.label;
                item.addEventListener('click', () => {
                    groupSelect.value = g.id;
                    groupLabel.textContent = g.label;
                    groupSelect.dispatchEvent(new Event('change'));
                });
                groupOptions.appendChild(item);
            }
        });

        // İlkini varsayılan seç
        if(groups.length > 0 && groupSelect && groupLabel) {
            groupSelect.value = groups[0].id;
            groupLabel.textContent = groups[0].label;
        }

        updateTexts();
    }

    // Grup değiştiğinde Text dropdown'ını güncelle
    function updateTexts() {
        if(!groupSelect) return;
        const category = categorySelect.value;
        const group = groupSelect.value;
        const texts = metinlerDB[category] && metinlerDB[category][group] ? metinlerDB[category][group] : [];

        if(textSelect) textSelect.innerHTML = '';
        if(textOptions) textOptions.innerHTML = '';
        if(textLabel) textLabel.textContent = "Metin Seçin";

        if (texts.length === 0) {
            if(textSelect) {
                const option = document.createElement('option');
                option.textContent = "Metin Bulunamadı";
                textSelect.appendChild(option);
            }

            if(textOptions) {
                const item = document.createElement('div');
                item.className = "px-4 py-2 text-yaziyo-text-secondary text-sm italic";
                item.textContent = "Metin Bulunamadı";
                textOptions.appendChild(item);
            }
            return;
        }

        texts.forEach((itemData, index) => {
            const val = index;
            const text = itemData.id;

            // 1. Hidden Select
            if(textSelect) {
                const option = document.createElement('option');
                option.value = val;
                option.textContent = text;
                textSelect.appendChild(option);
            }

            // 2. Özel UI
            if(textOptions) {
                const item = document.createElement('div');
                item.className = "px-4 py-2 hover:bg-yaziyo-gold hover:text-slate-900 cursor-pointer transition-colors text-sm border-b border-yaziyo-border last:border-b-0";
                item.textContent = text;
                item.addEventListener('click', () => {
                    textSelect.value = val;
                    textLabel.textContent = text;
                    textSelect.dispatchEvent(new Event('change'));
                });
                textOptions.appendChild(item);
            }
        });

        if(texts.length > 0 && textSelect && textLabel) {
             textSelect.value = "0";
             textLabel.textContent = texts[0].id;
        }
    }

    // Event Listenerlar
    if(categorySelect) {
        categorySelect.addEventListener('change', updateGroups);
    }
    
    // Hidden select değişimini dinle (Özel UI'dan tetikleniyor)
    if(groupSelect) {
        groupSelect.addEventListener('change', updateTexts);
    }

    // İlk açılış doldurması
    if(categorySelect) {
        updateGroups();
    }


    /* ============================================ */
    /* ÇALIŞMA MOTORU (BAŞLAMA, SAYIM, KAYDIRMA)   */
    /* ============================================ */
    const workspaceScreen = document.getElementById('workspace-screen');
    const countdownOverlay = document.getElementById('countdown-overlay');
    const countdownNumber = document.getElementById('countdown-number');

    const textContentDiv = document.getElementById('text-content');
    const userInput = document.getElementById('user-input');
    const timerDisplay = document.getElementById('timer-display');
    const endTestBtn = document.getElementById('end-test-btn');

    // === ÇALIŞMA MODU ELEMENTLERİ ===
    const liveStats = document.getElementById('live-stats');
    const liveCorrect = document.getElementById('live-correct');
    const liveWrong = document.getElementById('live-wrong');
    const liveAccuracy = document.getElementById('live-accuracy');
    const toggleTimerBtn = document.getElementById('toggle-timer-btn');
    const timerToggleIcon = document.getElementById('timer-toggle-icon');
    const timerContainer = document.getElementById('timer-container');

    let isTestRunning = false;
    let timerInterval = null;
    let timeRemaining = 0;
    let initialTimeVal = 0; // Testin başladığı süre (saniye cinsinden)
    let currentActiveText = ""; // Kıyaslama (Diff) için asıl metin
    let currentMode = "app"; // app, exam, practice

    // Strict Match Variables
    let wordsArray = [];
    let currentWordIndex = 0;

    let correctWords = 0;
    let wrongWords = 0;
    let skippedWords = 0;
    let mistakes = [];

    // Tuş istatistikleri (Kelime sisteminden bağımsız)
    let totalKeys = 0;
    let correctKeys = 0;
    let wrongKeys = 0;
    let originalWordsForSession = [];

    // Audio Context (mobilde kullanıcı dokunuşu sırasında etkinleştirilmeli)
    let audioCtx = null;

    async function ensureAudioCtx() {
        if (!audioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) audioCtx = new Ctx();
        }
        if (audioCtx?.state === 'suspended') {
            try {
                await audioCtx.resume();
            } catch (_) {}
        }
        return audioCtx;
    }

    async function playBeep(freq, duration) {
        const ctx = await ensureAudioCtx();
        if (!ctx || ctx.state !== 'running') return;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + duration / 1000);
    }

    async function primeBackgroundAudio() {
        const selectedSound = document.getElementById('sound-select')?.value;
        if (!selectedSound || selectedSound === 'none' || !soundFiles[selectedSound]) return;

        bgAudio.src = soundFiles[selectedSound];
        const prevVolume = bgAudio.volume;
        bgAudio.volume = 0.01;
        try {
            await bgAudio.play();
            bgAudio.pause();
            bgAudio.currentTime = 0;
        } catch (_) {
            /* mobilde sessiz başlatma engellenirse geri sayım sonrası tekrar denenecek */
        } finally {
            bgAudio.volume = prevVolume || 1;
        }
    }

    let bgAudio = new Audio();
    bgAudio.loop = true;
    const soundUrl = (file) =>
        window.YaziyoPaths?.assetHref?.(`sound effect/${file}`)
        ?? `../../sound effect/${file}`;
    const soundFiles = {
        'keyboard1': soundUrl('keyboard1.mp3'),
        'keyboard2': soundUrl('keyboard2.mp3'),
        'bird': soundUrl('bird.mp3'),
        'clock': soundUrl('clock.mp3'),
        'rain': soundUrl('rain.mp3'),
        'steps': soundUrl('steps.mp3'),
        'waves': soundUrl('waves.mp3'),
        'kafe': soundUrl('kafe.mp3'),
        'somine': soundUrl('somine.mp3'),
        'odak': soundUrl('odak.mp3'),
    };

    // Modal
    const resultModal = document.getElementById('result-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const restartBtn = document.getElementById('restart-btn');
    const saveResultBtn = document.getElementById('save-result-btn');
    const saveToast = document.getElementById('save-toast');

    const textWarningModal = document.getElementById('text-warning-modal');
    const textWarningPanel = document.getElementById('text-warning-panel');
    const textWarningMessage = document.getElementById('text-warning-message');
    const textWarningOkBtn = document.getElementById('text-warning-ok-btn');
    let textWarningEscHandler = null;

    function showTextWarningModal(message) {
        if (!textWarningModal) return;

        if (textWarningMessage) {
            textWarningMessage.textContent = message || 'Lütfen geçerli bir metin seçiniz.';
        }

        textWarningModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        requestAnimationFrame(() => {
            textWarningPanel?.classList.remove('scale-95', 'opacity-0');
            textWarningPanel?.classList.add('scale-100', 'opacity-100');
        });

        if (textWarningEscHandler) {
            document.removeEventListener('keydown', textWarningEscHandler);
        }
        textWarningEscHandler = (e) => {
            if (e.key === 'Escape') hideTextWarningModal();
        };
        document.addEventListener('keydown', textWarningEscHandler);

        textWarningOkBtn?.focus();
    }

    function hideTextWarningModal() {
        if (!textWarningModal) return;

        textWarningPanel?.classList.remove('scale-100', 'opacity-100');
        textWarningPanel?.classList.add('scale-95', 'opacity-0');

        setTimeout(() => {
            textWarningModal.classList.add('hidden');
            if (!workspaceScreen || workspaceScreen.classList.contains('hidden')) {
                document.body.style.overflow = 'auto';
            }
        }, 200);

        if (textWarningEscHandler) {
            document.removeEventListener('keydown', textWarningEscHandler);
            textWarningEscHandler = null;
        }
    }

    textWarningModal?.querySelectorAll('[data-close-text-warning]').forEach((el) => {
        el.addEventListener('click', hideTextWarningModal);
    });
    textWarningOkBtn?.addEventListener('click', hideTextWarningModal);

    let resultSaved = false;
    let pendingSavePayload = null;
    let sessionMetinAdi = '';
    let sessionKategori = '';
    let sessionGrup = '';

    function prepareWordsDOM(rawText) {
        let processedText = rawText.trim().replace(/\s+/g, " ");
        wordsArray = processedText.split(' ').filter(w => w.length > 0);

        let domHtml = '';
        wordsArray.forEach((w, idx) => {
            domHtml += '<span id="word-' + idx + '" class="inline-block transition-all duration-200">' + w + '</span> ';
        });
        textContentDiv.innerHTML = domHtml;
        window.YaziyoTypingScroll?.resetTypingPanels({
            referenceEl: textContentDiv,
            userInputEl: userInput,
            referenceMoveMode: 'transform',
        });
    }

    function getDisplayText() {
        return (currentActiveText || '').trim().replace(/\s+/g, ' ');
    }

    function syncTypingScroll() {
        const scrollLib = window.YaziyoTypingScroll;
        if (!scrollLib) return;
        scrollLib.syncTypingPanels({
            referenceEl: textContentDiv,
            referenceContainer: document.getElementById('text-display-card'),
            referenceFullText: getDisplayText(),
            userInputEl: userInput,
            typedLen: userInput.value.length,
            referenceMoveMode: 'transform',
        });
    }

    /** BAŞLA BUTONU TIKLANDIĞINDA */
    startBtn.addEventListener('click', async () => {
        if (!audioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) audioCtx = new Ctx();
        }
        if (audioCtx?.state === 'suspended') {
            audioCtx.resume();
        }
        await ensureAudioCtx();
        await primeBackgroundAudio();

        const category = categorySelect.value;
        const group = groupSelect.value;
        const textIndex = textSelect.value;
        const timeVal = parseInt(document.getElementById('time-select').value);
        currentMode = document.getElementById('display-mode-select').value;

        const catDef = CATEGORIES[category];
        sessionKategori = catDef ? catDef.label : category;
        sessionGrup = groupLabel ? groupLabel.textContent : group;
        sessionMetinAdi = textLabel ? textLabel.textContent : '';
        resultSaved = false;
        pendingSavePayload = null;

        const textEntry = metinlerDB[category]?.[group]?.[textIndex];
        const selectedText = textEntry?.text?.trim();

        if (!textEntry || !selectedText) {
            const warningMsg = textEntry && !selectedText
                ? 'Seçilen metin henüz yüklenmemiş. Lütfen başka bir metin seçiniz.'
                : 'Lütfen geçerli bir metin seçiniz.';
            showTextWarningModal(warningMsg);
            return;
        }

        currentActiveText = textEntry.text;
        
        originalWordsForSession = currentActiveText.trim().split(/\s+/).filter(w => w.length > 0);

        prepareWordsDOM(currentActiveText);

        currentWordIndex = 0;
        correctWords = 0;
        wrongWords = 0;
        skippedWords = 0;
        mistakes = [];
        totalKeys = 0;
        correctKeys = 0;
        wrongKeys = 0;
        userInput.value = "";
        userInput.readOnly = true;
        timeRemaining = timeVal;
        initialTimeVal = timeVal;
        updateTimerDisplay();

        // Mod bazlı hazırlıklar
        const workspaceTitle = document.getElementById('workspace-title');
        workspaceScreen.classList.remove('practice-mode');
        if(liveStats) liveStats.classList.add('hidden');
        if(workspaceTitle) workspaceTitle.classList.remove('hidden');
        toggleTimerBtn.classList.add('hidden');
        timerContainer.classList.remove('hidden');

        if (currentMode === 'exam') {
            if(workspaceTitle) workspaceTitle.classList.add('hidden');
        }

        if (currentMode === 'practice' || currentMode === 'app') {
            // === ÇALIŞMA VE UYGULAMA MODU EKRANI ===
            if (currentMode === 'practice') workspaceScreen.classList.add('practice-mode');
            if(liveStats) liveStats.classList.remove('hidden');
            toggleTimerBtn.classList.remove('hidden');
            updateLiveStats();
        }

        workspaceScreen.classList.remove('hidden');
        document.body.style.overflow = "hidden";

        startCountdown();
    });

    /** 3-2-1 Geri Sayımı */
    function startCountdown() {
        countdownOverlay.classList.remove('hidden');
        const workspaceContent = document.getElementById('workspace-content');
        if (workspaceContent) workspaceContent.classList.add('hidden');

        if (countdownOverlay.classList.contains('opacity-0')) {
            countdownOverlay.classList.replace('opacity-0', 'opacity-100');
        } else {
            countdownOverlay.classList.add('opacity-100');
        }

        countdownNumber.textContent = '3';
        countdownNumber.classList.remove('is-start');
        playBeep(440, 150);

        setTimeout(() => {
            countdownNumber.textContent = '2';
            countdownNumber.classList.remove('is-start');
            playBeep(440, 150);
        }, 1000);

        setTimeout(() => {
            countdownNumber.textContent = '1';
            countdownNumber.classList.remove('is-start');
            playBeep(440, 150);
        }, 2000);

        setTimeout(() => {
            countdownNumber.textContent = 'BAŞLA!';
            countdownNumber.classList.add('is-start', 'text-green-500');
            countdownNumber.classList.remove('text-yaziyo-gold');
            playBeep(880, 400);
        }, 3000);

        setTimeout(() => {
            finishCountdown();
        }, 4000);
    }

    function finishCountdown() {
        countdownOverlay.classList.replace('opacity-100', 'opacity-0');
        setTimeout(() => countdownOverlay.classList.add('hidden'), 300);
        countdownNumber.classList.add('text-yaziyo-gold');
        countdownNumber.classList.remove('text-green-500', 'is-start');

        const workspaceContent = document.getElementById('workspace-content');
        if (workspaceContent) workspaceContent.classList.remove('hidden');

        userInput.readOnly = false;
        userInput.focus();
        isTestRunning = true;

        import('./lib/keyPressTracker.js').then(({ startKeyPressSession }) => {
            const kbType = document.getElementById('keyboard-type-select')?.value || 'q';
            startKeyPressSession(kbType);
        });

        if (currentMode === 'practice') {
            highlightActiveWord(0);
        }

        timerInterval = setInterval(handleTick, 1000);
        const selectedSound = document.getElementById('sound-select').value;
        if (selectedSound !== 'none' && soundFiles[selectedSound]) {
            if (!bgAudio.src) {
                bgAudio.src = soundFiles[selectedSound];
            }
            bgAudio.play().catch(e => console.error("Ses çalınamadı:", e));
        }
    }

    function handleTick() {
        if (!isTestRunning) return;
        timeRemaining--;
        updateTimerDisplay();
        if (timeRemaining <= 0) {
            endTest();
        }
    }

    function updateTimerDisplay() {
        const m = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
        const s = (timeRemaining % 60).toString().padStart(2, '0');
        timerDisplay.textContent = m + ":" + s;

        if (timeRemaining <= 10 && timeRemaining > 0) {
            timerDisplay.classList.add('timer-warning');
        } else {
            timerDisplay.classList.remove('timer-warning');
        }
    }

    /** CANLI TAKİP VE RENKLİ VURGU (Çalışma Modu) */
    function highlightActiveWord(index) {
        // Eski aktifi temizle
        const allSpans = textContentDiv.querySelectorAll('span');
        allSpans.forEach(s => s.classList.remove('word-active', 'bg-yellow-200/50', 'rounded', 'px-1'));

        const activeSpan = document.getElementById('word-' + index);
        if (activeSpan) {
            activeSpan.classList.add('word-active');
            if (currentMode === 'practice') {
                activeSpan.classList.add('bg-yellow-200/50', 'rounded', 'px-1');
            }
        }
    }

    function updateLiveStats() {
        liveCorrect.textContent = correctWords;
        liveWrong.textContent = wrongWords;
        const net = Math.max(0, correctWords - wrongWords);
        const total = correctWords + wrongWords;
        const acc = total > 0 ? Math.round((net / total) * 100) : 100;
        liveAccuracy.textContent = acc + "%";
    }

    userInput.addEventListener('input', (e) => {
        if (!isTestRunning || (currentMode !== 'practice' && currentMode !== 'app')) return;

        const typedText = userInput.value;
        const isImlasiz = isImlasizMode();
        const activeWordIdx = getActiveWordIndexFromInput(typedText, wordsArray.length);

        const liveAlignment = evaluateExamText(wordsArray, typedText, isImlasiz, {});
        correctWords = liveAlignment.correct;
        wrongWords = liveAlignment.wrong;

        wordsArray.forEach((w, idx) => {
            const span = document.getElementById('word-' + idx);
            if (!span) return;

            span.classList.remove('word-correct', 'word-wrong');
            const status = liveAlignment.origStatus[idx];
            if (status === 'correct') {
                span.classList.add('word-correct');
            } else if (status === 'wrong') {
                span.classList.add('word-wrong');
            }
        });

        updateLiveStats();
        highlightActiveWord(activeWordIdx);
        syncTypingScroll();
    });

    /** Tuş istatistikleri kelime hizalamasına göre yeniden hesaplanır */
    userInput.addEventListener('input', (e) => {
        if (!isTestRunning) return;

        const stats = calculateKeyStatsFromAlignment(
            originalWordsForSession,
            userInput.value,
            isImlasizMode()
        );
        totalKeys = stats.totalKeys;
        correctKeys = stats.correctKeys;
        wrongKeys = stats.wrongKeys;
    });

    /** Sınav modu: referans metin + yazım alanı kaydırma (renklendirme yok) */
    userInput.addEventListener('input', () => {
        if (!isTestRunning || currentMode === 'practice' || currentMode === 'app') return;
        syncTypingScroll();
    });

    /** SÜREYİ GİZLE/GÖSTER (Çalışma Modu) */
    toggleTimerBtn.addEventListener('click', () => {
        if (timerContainer.classList.contains('hidden')) {
            timerContainer.classList.remove('hidden');
            timerToggleIcon.classList.replace('fa-eye-slash', 'fa-eye');
        } else {
            timerContainer.classList.add('hidden');
            timerToggleIcon.classList.replace('fa-eye', 'fa-eye-slash');
        }
    });

    /** TESTİ BİTİRMEK VE SONUÇ EKRANI */
    function endTest() {
        if (!isTestRunning) return;
        isTestRunning = false;
        clearInterval(timerInterval);
        userInput.readOnly = true;

        bgAudio.pause();
        bgAudio.currentTime = 0;

        const timeElapsedSecond = initialTimeVal - timeRemaining;
        const timeElapsedMinute = timeElapsedSecond / 60;

        const isImlasiz = isImlasizMode();
        const originalWords = originalWordsForSession;
        const typedWords = parseWordsFromInput(userInput.value);
        const incompleteLastWord = timeRemaining <= 0 &&
            isIncompleteLastWord(originalWords, typedWords, isImlasiz);
        const examOptions = { incompleteLastWord };

        const keyStats = calculateKeyStatsFromAlignment(
            originalWords, userInput.value, isImlasiz, examOptions
        );
        totalKeys = keyStats.totalKeys;
        correctKeys = keyStats.correctKeys;
        wrongKeys = keyStats.wrongKeys;

        const wordResult = evaluateExamText(
            originalWords, userInput.value, isImlasiz, examOptions
        );
        const correct = wordResult.correct;
        const wrong = wordResult.wrong;
        const netWords = wordResult.netWords;
        mistakes = wordResult.mistakes;

        const evaluatedWordCount = correct + wrong;
        const userTotalWords = typedWords.length;

        const wpm = timeElapsedMinute > 0 ? Math.round(netWords / timeElapsedMinute) : 0;
        const accuracyPercent = evaluatedWordCount > 0
            ? Math.round((correct / evaluatedWordCount) * 100)
            : 100;
        const errorRatePercent = 100 - accuracyPercent;

        const m = Math.floor(timeElapsedSecond / 60).toString().padStart(2, '0');
        const s = (timeElapsedSecond % 60).toString().padStart(2, '0');

        document.getElementById('result-time').textContent = m + ":" + s;
        document.getElementById('result-wpm').textContent = wpm;
        document.getElementById('result-real-wpm').textContent = wpm;
        document.getElementById('result-accuracy').textContent = accuracyPercent + "%";
        document.getElementById('result-error-rate').textContent = errorRatePercent + "%";

        // Tuş İstatistikleri (Artık anlık takip sisteminden gelen sayaçlar kullanılıyor)
        document.getElementById('result-total-keys').textContent = totalKeys;
        document.getElementById('result-correct-keys').textContent = correctKeys;
        document.getElementById('result-wrong-keys').textContent = wrongKeys;

        document.getElementById('result-total-words').textContent = userTotalWords;
        document.getElementById('result-correct-words').textContent = correct;
        document.getElementById('result-wrong-words').textContent = wrong;

        const mistakesSection = document.getElementById('mistakes-section');
        const mistakesList = document.getElementById('mistakes-list');
        mistakesList.innerHTML = "";

        const displayMistakes = mistakes.filter(m =>
            m.errorType !== ERROR_LABELS.INCOMPLETE_LAST
        );

        if (displayMistakes.length > 0) {
            mistakesSection.classList.remove('hidden');
            displayMistakes.forEach(mis => {
                const badge = document.createElement('div');
                badge.className = "flex flex-col border border-red-200 bg-red-50 rounded-lg px-2 py-1 text-xs sm:text-sm";
                const spanWrong = document.createElement('span');
                spanWrong.className = "text-red-500 line-through font-semibold";
                const spanRight = document.createElement('span');
                spanRight.className = "text-yaziyo-green font-bold mt-1 border-t border-red-200/50 pt-1";

                if (mis.errorType === ERROR_LABELS.SKIPPED) {
                    spanWrong.textContent = "(Atlandı)";
                    spanRight.textContent = mis.original;
                } else {
                    spanWrong.textContent = mis.user || "[Boş Bırakıldı]";
                    spanRight.textContent = mis.errorType || mis.original;
                }

                badge.appendChild(spanWrong);
                badge.appendChild(spanRight);
                mistakesList.appendChild(badge);
            });
        } else {
            mistakesSection.classList.add('hidden');
        }

        const timeElapsedSecondFinal = initialTimeVal - timeRemaining;
        const gecerli3dk = initialTimeVal === KLAVYE_3DK_SURE &&
            timeRemaining === 0 &&
            timeElapsedSecondFinal >= KLAVYE_3DK_SURE;

        const mistakesForSave = mistakes
            .filter(m => m.errorType !== ERROR_LABELS.INCOMPLETE_LAST)
            .map(m => ({
                user: m.user,
                original: m.original,
                expected: m.expected || (!isMistakeErrorLabelForSave(m.original) ? m.original : null),
                errorType: m.errorType || m.original,
            }));

        pendingSavePayload = {
            netKelime: netWords,
            sureSaniye: timeElapsedSecondFinal,
            dogru: correct,
            yanlis: wrong,
            metinAdi: sessionMetinAdi,
            kategori: sessionKategori,
            grup: sessionGrup,
            yanlisKelimeler: mistakesForSave,
            gecerli3dk,
            netKelime3dk: gecerli3dk ? netWords : 0,
        };

        workspaceScreen.classList.add('hidden');
        document.body.style.overflow = "auto";
        resultModal.classList.remove('hidden');

        updateSaveButtonState();
        checkUserGoalsAfterPractice(netWords);
    }

    async function updateSaveButtonState() {
        if (!saveResultBtn) return;

        if (resultSaved) {
            saveResultBtn.disabled = true;
            saveResultBtn.innerHTML = '<i class="fa-solid fa-check"></i><span>Kaydedildi</span>';
            saveResultBtn.classList.add('!bg-green-600/20', '!border-green-500/40');
            return;
        }

        saveResultBtn.classList.remove('!bg-green-600/20', '!border-green-500/40');
        try {
            const { isUserLoggedIn } = await import('./userStats.js');
            const loggedIn = await isUserLoggedIn(window.yaziyoSupabase);
            saveResultBtn.disabled = !loggedIn || !pendingSavePayload;
            const labelText = loggedIn ? 'Sonucu Kaydet' : 'Giriş Yapın (Kaydet)';
            saveResultBtn.innerHTML = `<i class="fa-solid fa-bookmark"></i><span>${labelText}</span>`;
        } catch {
            saveResultBtn.disabled = true;
        }
    }

    function showSaveToast(message, isError = false) {
        if (!saveToast) return;
        const toastText = document.getElementById('save-toast-text');
        const toastIcon = saveToast.querySelector('i');
        if (toastText) toastText.textContent = message;
        if (toastIcon) {
            toastIcon.className = isError
                ? 'fa-solid fa-circle-exclamation text-red-400'
                : 'fa-solid fa-circle-check text-yaziyo-green';
        }
        saveToast.classList.remove('hidden');
        requestAnimationFrame(() => {
            saveToast.classList.remove('translate-y-4', 'opacity-0');
            saveToast.classList.add('translate-y-0', 'opacity-100');
        });
        setTimeout(() => {
            saveToast.classList.remove('translate-y-0', 'opacity-100');
            saveToast.classList.add('translate-y-4', 'opacity-0');
            setTimeout(() => saveToast.classList.add('hidden'), 500);
        }, 3000);
    }

    async function checkUserGoalsAfterPractice(correctWordCount) {
        if (!window.yaziyoSupabase) return;
        const sureDakika = Math.round(initialTimeVal / 60);
        try {
            const { checkGoalCompletion } = await import('./userGoals.js');
            const { onGoalsCompleted } = await import('./notifications.js');
            const completed = await checkGoalCompletion(
                window.yaziyoSupabase,
                'klavye',
                sureDakika,
                correctWordCount
            );
            if (completed.length > 0) {
                await onGoalsCompleted(window.yaziyoSupabase, completed);
            }
        } catch (err) {
            console.warn('Hedef kontrolü atlandı:', err);
        }
    }

    endTestBtn.addEventListener('click', endTest);

    function closeResultModal() {
        resultModal.classList.add('hidden');
        const workspaceContent = document.getElementById('workspace-content');
        if (workspaceContent) workspaceContent.classList.add('hidden'); // Kapandığında tekrar gizli kalsın
    }

    closeModalBtn.addEventListener('click', closeResultModal);

    restartBtn.addEventListener('click', () => {
        closeResultModal();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    if (saveResultBtn) {
        saveResultBtn.addEventListener('click', async () => {
            if (resultSaved || saveResultBtn.disabled || !pendingSavePayload) return;

            const originalHtml = saveResultBtn.innerHTML;
            saveResultBtn.disabled = true;
            saveResultBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Kaydediliyor...</span>';

            try {
                const { saveKlavyeCalismasiSonucu, isUserLoggedIn } = await import('./userStats.js');

                if (!await isUserLoggedIn(window.yaziyoSupabase)) {
                    throw new Error('Sonucu kaydetmek için giriş yapmalısınız');
                }

                await saveKlavyeCalismasiSonucu(window.yaziyoSupabase, pendingSavePayload);

                try {
                    const { saveHeatmapFromPracticeSession } = await import('./lib/keyboardHeatmapApi.js');
                    await saveHeatmapFromPracticeSession(window.yaziyoSupabase, {
                        metinAdi: pendingSavePayload.metinAdi,
                        kategori: pendingSavePayload.kategori,
                        sourceType: 'klavye_calismasi',
                    });
                } catch (heatmapErr) {
                    console.warn('Isı haritası kaydı atlandı:', heatmapErr);
                }

                resultSaved = true;
                let msg = 'Sonuç profilinize kaydedildi';
                if (pendingSavePayload.gecerli3dk) {
                    msg += ` (3 dk: ${pendingSavePayload.netKelime3dk} net kelime)`;
                }
                showSaveToast(msg);
                updateSaveButtonState();
            } catch (err) {
                console.error('Sonuç kaydetme hatası:', err);
                showSaveToast(err.message || 'Kayıt başarısız oldu', true);
                saveResultBtn.disabled = false;
                saveResultBtn.innerHTML = originalHtml;
            }
        });
    }

    userInput.addEventListener('keydown', (e) => {
        if (isTestRunning && e.key) {
            import('./lib/keyPressTracker.js').then((m) => m.recordKeyPress(e.key));
        }
        if (e.key === 'Escape' && isTestRunning) {
            e.preventDefault();
            endTest();
        }
    });

    // Kapatma butonu ESC ile aynı işi yapar
    const closeWorkspaceBtn = document.getElementById('close-workspace-btn');
    if (closeWorkspaceBtn) {
        closeWorkspaceBtn.addEventListener('click', () => {
            if (isTestRunning) {
                endTest();
            } else {
                workspaceScreen.classList.add('hidden');
                document.body.style.overflow = "auto";
            }
        });
    }

    // ESC Tuşu ile herhangi bir durumda çıkış (Global listener)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !workspaceScreen.classList.contains('hidden')) {
            if (isTestRunning) {
                endTest();
            } else {
                workspaceScreen.classList.add('hidden');
                document.body.style.overflow = "auto";
            }
        }
    });
});
