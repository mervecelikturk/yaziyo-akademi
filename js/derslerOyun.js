import { loadDersProgress, saveDersProgress, isDersUserLoggedIn } from './lib/derslerApi.js';
import { getFingerMap, getHandForFinger, normalizePressedKey, getKeyReach, FINGER_LABELS } from './lib/keyboardLayouts.js';

const PASS_RATE = 50;
const SETTINGS_KEY = 'dlo-lesson-settings';
const core = () => window.YaziyoKlavyeCore;
const scroll = () => window.YaziyoTypingScroll;
const texts = () => window.YaziyoDerslerMetinleri;

const params = new URLSearchParams(window.location.search);
const track = texts().resolveTrack(params);
const layoutId = track === 'q' ? 'q' : 'f';
const fingerMap = getFingerMap(layoutId);

let progress = { tamamlanan_ders: 0, son_ders_no: 1 };
let activeLessonNo = null;
let isRunning = false;
let timerStarted = false;
let timerInterval = null;
let elapsedSec = 0;
let currentText = '';
let wordsArray = [];
let resultSaved = false;
let lastResult = null;
let lessonSettings = loadSettings();
let backspaceCount = 0;
let strokeLog = [];
let prevTyped = '';
let lessonStartMs = 0;
let drillMode = false;
let sourceLessonNo = null;
let lastDrillKey = null;
let confettiInstance = null;

function loadSettings() {
    try {
        const raw = sessionStorage.getItem(SETTINGS_KEY);
        if (!raw) return { highlightKeys: true };
        const parsed = JSON.parse(raw);
        return { highlightKeys: parsed.highlightKeys !== false };
    } catch {
        return { highlightKeys: true };
    }
}

function persistSettings() {
    try {
        sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(lessonSettings));
    } catch { /* ignore */ }
}

const els = {
    setup: document.getElementById('dlo-setup'),
    trackTitle: document.getElementById('dlo-track-title'),
    progressLabel: document.getElementById('dlo-progress-label'),
    lessonSelect: document.getElementById('dlo-lesson-select'),
    textContent: document.getElementById('dlo-text-content'),
    textCard: document.getElementById('dlo-text-card'),
    input: document.getElementById('dlo-input'),
    timerWrap: document.getElementById('dlo-timer-wrap'),
    timer: document.getElementById('dlo-timer'),
    exam: document.getElementById('dlo-exam'),
    examExit: document.getElementById('dlo-exam-exit'),
    lessonDd: document.getElementById('dlo-lesson-dd'),
    lessonDdBtn: document.getElementById('dlo-lesson-dd-btn'),
    lessonDdLabel: document.getElementById('dlo-lesson-dd-label'),
    lessonDdMenu: document.getElementById('dlo-lesson-dd-menu'),
    optKeys: document.getElementById('dlo-opt-keys'),
    settingsStart: document.getElementById('dlo-settings-start'),
    result: document.getElementById('dlo-result'),
    resultHero: document.getElementById('dlo-result-hero'),
    resultRate: document.getElementById('dlo-result-rate'),
    resultMessage: document.getElementById('dlo-result-message'),
    resultTime: document.getElementById('dlo-result-time'),
    resultAdvice: document.getElementById('dlo-result-advice'),
    statCorrect: document.getElementById('dlo-stat-correct'),
    statWrong: document.getElementById('dlo-stat-wrong'),
    statWordsTotal: document.getElementById('dlo-stat-words-total'),
    statKeysOk: document.getElementById('dlo-stat-keys-ok'),
    statKeysErr: document.getElementById('dlo-stat-keys-err'),
    statKeysTotal: document.getElementById('dlo-stat-keys-total'),
    statWrongPct: document.getElementById('dlo-stat-wrong-pct'),
    statSkipped: document.getElementById('dlo-stat-skipped'),
    statBackspace: document.getElementById('dlo-stat-backspace'),
    btnSave: document.getElementById('dlo-btn-save'),
    btnNext: document.getElementById('dlo-btn-next'),
    btnRetry: document.getElementById('dlo-btn-retry'),
    btnPrev: document.getElementById('dlo-btn-prev'),
    btnBack: document.getElementById('dlo-btn-back'),
    btnDrill: document.getElementById('dlo-btn-drill'),
    btnClose: document.getElementById('dlo-result-close'),
    toast: document.getElementById('dlo-toast'),
    confetti: document.getElementById('dlo-confetti'),
};

function showToast(msg) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.add('is-visible');
    setTimeout(() => els.toast.classList.remove('is-visible'), 2800);
}

function formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function fingerIdsForChar(ch) {
    if (!ch) return [];
    if (ch === ' ' || ch === '\u00a0') return ['thumb'];
    const key = normalizePressedKey(ch) ?? String(ch).toLocaleLowerCase('tr-TR');
    const fingerId = fingerMap[key] || fingerMap[ch] || fingerMap[String(ch).toLocaleLowerCase('tr-TR')];
    const ids = [];
    if (fingerId) ids.push(fingerId);
    const lower = String(ch).toLocaleLowerCase('tr-TR');
    const isLetter = /\p{L}/u.test(ch);
    if (isLetter && ch !== lower && fingerId) {
        const hand = getHandForFinger(fingerId);
        if (hand === 'left') ids.push('right_pinky');
        else if (hand === 'right') ids.push('left_pinky');
    }
    return ids;
}

function currentLessonChar(typed, ref) {
    const refChars = [...ref];
    const typedChars = [...typed];
    if (!refChars.length) return null;
    const idx = Math.min(typedChars.length, refChars.length);
    if (idx >= refChars.length) return null;
    return refChars[idx];
}

function updateHandHighlight() {
    const tips = document.querySelectorAll('.dlo-tip');
    tips.forEach((el) => {
        el.classList.remove('is-active');
        el.setAttribute('fill', 'none');
        el.removeAttribute('data-reach');
    });
    if (!isRunning) return;
    const ref = currentText.trim().replace(/\s+/g, ' ');
    const typed = els.input?.value || '';
    const ch = currentLessonChar(typed, ref);
    if (!ch) return;
    const ids = fingerIdsForChar(ch);
    if (!ids.length) return;
    const letterFinger = ids[0];
    const key = normalizePressedKey(ch) ?? String(ch).toLocaleLowerCase('tr-TR');
    const letterReach = getKeyReach(layoutId, key);
    const active = new Set(ids);
    tips.forEach((el) => {
        const finger = el.getAttribute('data-finger');
        if (!active.has(finger)) return;
        el.classList.add('is-active');
        el.setAttribute('fill', '#f97316');
        const isShiftPinky = ids.length > 1 && finger !== letterFinger && finger !== 'thumb';
        el.setAttribute('data-reach', isShiftPinky ? 'down' : letterReach);
    });
}

function setLessonDropdownOpen(open) {
    if (!els.lessonDd) return;
    els.lessonDd.classList.toggle('is-open', open);
    els.lessonDdBtn?.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (els.lessonDdMenu) {
        if (open) els.lessonDdMenu.removeAttribute('hidden');
        else els.lessonDdMenu.setAttribute('hidden', '');
    }
}

function lessonState(no) {
    const completed = progress.tamamlanan_ders;
    if (no <= completed) return 'completed';
    if (no === completed + 1) return 'available';
    return 'locked';
}

function letterFrequencyStats(words) {
    const freq = new Map();
    words.join('').split('').forEach((ch) => {
        if (!/\p{L}/u.test(ch)) return;
        const key = ch.toLocaleLowerCase('tr-TR');
        freq.set(key, (freq.get(key) || 0) + 1);
    });
    if (!freq.size) return { most: '—' };
    let most = '';
    let max = -1;
    freq.forEach((count, letter) => {
        if (count > max) {
            max = count;
            most = letter;
        }
    });
    return { most };
}

function formatKeyLabel(ch) {
    if (!ch) return '';
    if (ch === ' ') return 'Boşluk';
    if (ch === '\n') return 'Enter';
    return ch.toLocaleUpperCase('tr-TR');
}

function logNewStrokes(prev, next) {
    if (next.length <= prev.length) return;
    const ref = currentText.trim().replace(/\s+/g, ' ');
    const refChars = [...ref];
    const prevChars = [...prev];
    const added = [...next].slice(prevChars.length);
    const now = Date.now();
    if (!lessonStartMs) lessonStartMs = now;
    added.forEach((ch, i) => {
        const idx = prevChars.length + i;
        const expected = refChars[idx] ?? '';
        const ok = ch === expected;
        const key = normalizePressedKey(expected || ch) || '';
        strokeLog.push({
            t: now - lessonStartMs,
            kind: ok ? 'ok' : 'err',
            char: ch,
            expected,
            finger: fingerMap[key] || null,
        });
    });
}

function worstErrorKey(log) {
    const counts = new Map();
    log.forEach((s) => {
        if (s.kind !== 'err' || !s.expected) return;
        counts.set(s.expected, (counts.get(s.expected) || 0) + 1);
    });
    let key = '';
    let max = 0;
    counts.forEach((n, k) => {
        if (n > max) {
            max = n;
            key = k;
        }
    });
    return max > 0 ? { key, count: max } : null;
}

function worstErrorFinger(log) {
    const counts = new Map();
    log.forEach((s) => {
        if (s.kind !== 'err' || !s.finger || s.finger === 'thumb') return;
        counts.set(s.finger, (counts.get(s.finger) || 0) + 1);
    });
    let id = '';
    let max = 0;
    counts.forEach((n, k) => {
        if (n > max) {
            max = n;
            id = k;
        }
    });
    return max > 0 ? { id, label: FINGER_LABELS[id] || id, count: max } : null;
}

function buildAdvice(result) {
    const cpm = result.sure_saniye > 0
        ? Math.round((result.keysTotal / result.sure_saniye) * 60)
        : 0;
    const finger = result.worstFinger?.label;
    const errPct = result.wrongKeyPct;

    if (result.passed && cpm >= 140 && errPct < 8) {
        return 'Harika hız! Ritmin dengeli; aynı tempolu çalışmaya devam et.';
    }
    if (finger && result.worstFinger.count >= 2 && cpm >= 90) {
        return `Harika hız! Ancak ${finger.toLocaleLowerCase('tr-TR')} parmağını kullanırken biraz daha dikkatli olmalısın.`;
    }
    if (finger && result.worstFinger.count >= 2) {
        return `${finger} en çok hatayı üretiyor; yuvaya dönüp o tuşu yavaş ve doğru vurmayı dene.`;
    }
    if (result.backspaceCount > 12) {
        return 'Silme tuşunu sık kullanıyorsun; hata olursa durup doğru tuşa bakarak yazmayı dene.';
    }
    if (result.skippedWords > 2) {
        return 'Atlanan kelime sayısı yüksek; metni sırayla ve atlamadan yazmayı hedefle.';
    }
    if (errPct >= 20) {
        return 'Doğruluk hızdan önce gelir; bir süre daha yavaş ama hatasız yazmayı dene.';
    }
    if (result.passed) {
        return 'Dersi geçtin. Bir sonraki derse geçmeden önce hatalı tuşu bir tur daha pekiştirebilirsin.';
    }
    return 'Dersi geçmek için doğruluğu yüzde 50’nin üzerine çıkar; parmaklarını yuvada tutarak tekrar et.';
}

function buildKeyDrill(key, sourceText) {
    const pool = [...new Set([...(sourceText || '').toLocaleLowerCase('tr-TR')].filter((c) => /\p{L}/u.test(c)))];
    if (key && key !== ' ' && !pool.includes(key.toLocaleLowerCase('tr-TR'))) {
        pool.unshift(key.toLocaleLowerCase('tr-TR'));
    }
    if (!pool.length) pool.push(key === ' ' ? 'a' : key);
    const focus = key === ' ' ? pool[0] : key.toLocaleLowerCase('tr-TR');
    const words = [];
    for (let i = 0; i < 20; i += 1) {
        const len = i < 8 ? 3 : (i < 14 ? 4 : 5);
        const chars = [focus];
        while (chars.length < len) {
            chars.push(pool[(i + chars.length) % pool.length]);
        }
        if (i % 2 === 1) chars.reverse();
        words.push(chars.join(''));
    }
    return words.join(' ');
}

function launchPassConfetti() {
    if (typeof confetti !== 'function') return;
    try {
        if (!confettiInstance && els.confetti) {
            confettiInstance = confetti.create(els.confetti, { resize: true, useWorker: true });
        }
    } catch {
        confettiInstance = confetti;
    }
    const fire = confettiInstance || confetti;
    const colors = ['#D97706', '#FBBF24', '#F5E6D3', '#ea580c', '#22c55e'];
    const end = Date.now() + 1600;
    (function frame() {
        fire({ particleCount: 5, angle: 60, spread: 58, origin: { x: 0.12, y: 0.35 }, colors });
        fire({ particleCount: 5, angle: 120, spread: 58, origin: { x: 0.88, y: 0.35 }, colors });
        if (Date.now() < end) requestAnimationFrame(frame);
    }());
}

function goToSetup(selectNo) {
    hideResult();
    showSetup();
    fillLessonSelect(selectNo);
}

function startCurriculumLesson(no) {
    drillMode = false;
    sourceLessonNo = no;
    fillLessonSelect(no);
    readSettingsFromForm();
    startLesson(no);
}

function startKeyDrillSession(key) {
    const lessonNo = lastResult?.ders_no || sourceLessonNo || activeLessonNo;
    if (!lessonNo || !key) return;
    const source = getLesson(lessonNo)?.content || '';
    drillMode = true;
    lastDrillKey = key;
    sourceLessonNo = lessonNo;
    activeLessonNo = lessonNo;
    currentText = buildKeyDrill(key, source);
    resultSaved = false;
    lastResult = null;
    backspaceCount = 0;
    strokeLog = [];
    prevTyped = '';
    lessonStartMs = 0;
    hideResult();
    prepareWordsDOM(currentText);
    openExamScreen();
    if (els.input) {
        els.input.value = '';
        els.input.readOnly = false;
    }
    isRunning = true;
    timerStarted = false;
    elapsedSec = 0;
    els.timerWrap?.classList.remove('is-visible');
    if (els.timer) els.timer.textContent = '00:00';
    updateHandHighlight();
    els.input?.focus();
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function prepareWordsDOM(rawText) {
    const processed = rawText.trim().replace(/\s+/g, ' ');
    wordsArray = processed.split(' ').filter(Boolean);
    const parts = [];
    let charIdx = 0;

    wordsArray.forEach((word, wi) => {
        const chars = [...word].map((ch) => {
            const span = `<span class="dlo-char" data-idx="${charIdx}">${escapeHtml(ch)}</span>`;
            charIdx += 1;
            return span;
        }).join('');
        parts.push(`<span id="dlo-word-${wi}" class="dlo-word">${chars}</span>`);
        if (wi < wordsArray.length - 1) {
            parts.push(`<span class="dlo-char dlo-char-space" data-idx="${charIdx}"> </span>`);
            charIdx += 1;
        }
    });

    els.textContent.innerHTML = parts.join('');
    updateCharHighlight('');
    scroll()?.resetTypingPanels({
        referenceEl: els.textContent,
        userInputEl: els.input,
        referenceMoveMode: 'transform',
    });
}

function updateCharHighlight(typed) {
    const ref = currentText.trim().replace(/\s+/g, ' ');
    const typedLen = typed.length;
    const chars = els.textContent.querySelectorAll('.dlo-char');

    chars.forEach((el, i) => {
        el.classList.remove('dlo-char-correct', 'dlo-char-wrong', 'dlo-char-current', 'dlo-char-pending');

        if (i < typedLen) {
            if (typed[i] === ref[i]) el.classList.add('dlo-char-correct');
            else el.classList.add('dlo-char-wrong');
        } else if (i === typedLen && typedLen < ref.length) {
            el.classList.add('dlo-char-current');
        } else {
            el.classList.add('dlo-char-pending');
        }
    });
    updateHandHighlight();
}

function syncScroll() {
    scroll()?.syncTypingPanels({
        referenceEl: els.textContent,
        referenceContainer: els.textCard,
        referenceFullText: currentText.trim().replace(/\s+/g, ' '),
        userInputEl: els.input,
        typedLen: els.input.value.length,
        referenceMoveMode: 'transform',
    });
}

function highlightActiveWord(index) {
    els.textContent.querySelectorAll('.dlo-word').forEach((s) => s.classList.remove('word-active'));
    document.getElementById(`dlo-word-${index}`)?.classList.add('word-active');
}

function isTextComplete(input) {
    const ref = currentText.trim().replace(/\s+/g, ' ');
    const typed = input.trim().replace(/\s+/g, ' ');
    if (!ref || !typed) return false;
    return typed.length >= ref.length;
}

function guideIndex(typed, ref) {
    const n = Math.min(typed.length, ref.length);
    for (let i = 0; i < n; i += 1) {
        if (typed[i] !== ref[i]) return i;
    }
    return typed.length;
}

function startTimer() {
    if (timerStarted) return;
    timerStarted = true;
    els.timerWrap?.classList.add('is-visible');
    timerInterval = setInterval(() => {
        elapsedSec += 1;
        if (els.timer) els.timer.textContent = formatTime(elapsedSec);
    }, 1000);
}

function onTypingInput() {
    if (!isRunning) return;

    if (!timerStarted && els.input.value.length > 0) startTimer();

    const inputVal = els.input.value;
    logNewStrokes(prevTyped, inputVal);
    prevTyped = inputVal;
    const C = core();

    updateCharHighlight(inputVal);
    updateHandHighlight();

    const activeIdx = C.getActiveWordIndexFromInput(inputVal, wordsArray.length);
    highlightActiveWord(activeIdx);
    syncScroll();

    if (isTextComplete(inputVal)) {
        finishLesson();
    }
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function showSetup() {
    isRunning = false;
    timerStarted = false;
    stopTimer();
    elapsedSec = 0;
    if (els.timer) els.timer.textContent = '00:00';
    els.timerWrap?.classList.remove('is-visible');
    closeExamScreen();
    els.setup?.classList.remove('is-hidden');
    if (els.input) {
        els.input.value = '';
        els.input.readOnly = true;
    }
    updateHandHighlight();
    activeLessonNo = null;
    if (els.result?.classList.contains('hidden')) {
        document.body.style.overflow = '';
    }
    syncStartButton();
}

function openExamScreen() {
    els.setup?.classList.add('is-hidden');
    els.exam?.classList.add('is-open');
    els.exam?.removeAttribute('hidden');
    els.exam?.setAttribute(
        'data-highlight',
        lessonSettings.highlightKeys ? 'on' : 'off',
    );
    document.body.style.overflow = 'hidden';
}

function closeExamScreen() {
    els.exam?.classList.remove('is-open');
    els.exam?.setAttribute('hidden', '');
}

function getLesson(no) {
    return (texts().tracks[track] || []).find((l) => l.no === no);
}

function selectLesson(no, label) {
    if (els.lessonSelect) els.lessonSelect.value = String(no);
    if (els.lessonDdLabel) els.lessonDdLabel.textContent = label;
    els.lessonDdMenu?.querySelectorAll('.dlo-lesson-dd-item').forEach((btn) => {
        btn.classList.toggle('is-selected', Number(btn.dataset.no) === no);
    });
    setLessonDropdownOpen(false);
    syncStartButton();
}

function fillLessonSelect(preferredNo) {
    const lessons = texts().tracks[track] || [];
    const menu = els.lessonDdMenu;
    if (!menu || !els.lessonSelect) return;

    menu.innerHTML = '';
    let defaultNo = preferredNo || progress.tamamlanan_ders + 1;
    if (defaultNo > texts().TOTAL) defaultNo = texts().TOTAL;
    if (lessonState(defaultNo) === 'locked') defaultNo = Math.max(1, progress.tamamlanan_ders);

    let selectedLabel = 'Ders seçin';
    let selectedNo = 0;

    lessons.forEach((lesson) => {
        const state = lessonState(lesson.no);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dlo-lesson-dd-item';
        btn.dataset.no = String(lesson.no);
        btn.setAttribute('role', 'option');

        let label = lesson.title;
        if (state === 'locked') {
            label = `${lesson.title} (Kilitli)`;
            btn.disabled = true;
        } else if (state === 'completed') {
            label = `${lesson.title} ✓`;
        }
        btn.textContent = label;

        if (!btn.disabled && (lesson.no === defaultNo || !selectedNo)) {
            selectedNo = lesson.no;
            selectedLabel = label;
        }

        if (!btn.disabled) {
            btn.addEventListener('click', () => selectLesson(lesson.no, label));
        }
        menu.appendChild(btn);
    });

    if (selectedNo) selectLesson(selectedNo, selectedLabel);
    else {
        els.lessonSelect.value = '';
        if (els.lessonDdLabel) els.lessonDdLabel.textContent = 'Ders seçin';
        syncStartButton();
    }

    if (els.progressLabel) {
        els.progressLabel.textContent = `${progress.tamamlanan_ders} / ${texts().TOTAL} tamamlandı`;
    }
}

function syncStartButton() {
    const no = Number(els.lessonSelect?.value || 0);
    const lesson = getLesson(no);
    const locked = !lesson || lessonState(no) === 'locked' || !lesson.content?.trim();
    if (els.settingsStart) els.settingsStart.disabled = locked;
}

function startLesson(no) {
    const lesson = getLesson(no);
    if (!lesson) return;

    if (lessonState(no) === 'locked') {
        showToast('Önce bir önceki dersi tamamlayın.');
        return;
    }

    if (!lesson.content?.trim()) {
        showToast('Bu dersin metni henüz eklenmedi.');
        return;
    }

    activeLessonNo = no;
    if (!drillMode) sourceLessonNo = no;
    currentText = lesson.content;
    resultSaved = false;
    lastResult = null;
    backspaceCount = 0;
    strokeLog = [];
    prevTyped = '';
    lessonStartMs = 0;
    prepareWordsDOM(currentText);

    openExamScreen();

    els.input.value = '';
    els.input.readOnly = false;
    isRunning = true;
    timerStarted = false;
    elapsedSec = 0;
    els.timerWrap?.classList.remove('is-visible');
    if (els.timer) els.timer.textContent = '00:00';
    updateHandHighlight();
    els.input.focus();
}

function computeResult() {
    const C = core();
    const alignment = C.evaluateExamText(wordsArray, els.input.value, false, {
        incompleteLastWord: true,
    });
    const lessonTotal = wordsArray.length;
    const typedTotal = (C.parseWordsFromInput
        ? C.parseWordsFromInput(els.input.value)
        : String(els.input.value || '').trim().split(/\s+/).filter(Boolean)
    ).length;
    const correct = alignment.correct;
    const wrong = alignment.wrong;
    const rate = lessonTotal > 0 ? Math.round((correct / lessonTotal) * 100) : 0;
    const completedFully = isTextComplete(els.input.value);
    const passed = !drillMode && rate >= PASS_RATE && completedFully;
    const skippedWords = window.YaziyoSinavIstatistikleri
        ? window.YaziyoSinavIstatistikleri.countSkippedFromMistakes(alignment.mistakes)
        : 0;
    const keysOk = strokeLog.filter((s) => s.kind === 'ok').length;
    const keysErr = strokeLog.filter((s) => s.kind === 'err').length;
    const keysTotal = keysOk + keysErr;
    const wrongKeyPct = keysTotal > 0 ? Math.round((keysErr / keysTotal) * 100) : 0;
    const wrongWordPct = window.YaziyoSinavIstatistikleri
        ? window.YaziyoSinavIstatistikleri.calcWrongWordPercent(wrong, typedTotal)
        : (typedTotal > 0 ? Math.round((wrong / typedTotal) * 100) : 0);
    const dersNo = sourceLessonNo || activeLessonNo;

    return {
        correct,
        wrong,
        total: typedTotal,
        rate,
        passed,
        canUnlockNext: passed,
        completedFully,
        ders_no: dersNo,
        sure_saniye: elapsedSec,
        skippedWords,
        backspaceCount,
        keysOk,
        keysErr,
        keysTotal,
        wrongKeyPct,
        wrongWordPct,
        worstKey: worstErrorKey(strokeLog),
        worstFinger: worstErrorFinger(strokeLog),
        strokeLog: strokeLog.slice(),
        drillMode,
    };
}

function showResult(result) {
    lastResult = result;
    if (els.resultRate) els.resultRate.textContent = `${result.rate}%`;
    if (els.resultTime) els.resultTime.textContent = `Toplam süre: ${formatTime(result.sure_saniye)}`;
    if (els.statCorrect) els.statCorrect.textContent = String(result.correct);
    if (els.statWrong) els.statWrong.textContent = String(result.wrong);
    if (els.statWordsTotal) els.statWordsTotal.textContent = String(result.total);
    if (els.statKeysOk) els.statKeysOk.textContent = String(result.keysOk);
    if (els.statKeysErr) els.statKeysErr.textContent = String(result.keysErr);
    if (els.statKeysTotal) els.statKeysTotal.textContent = String(result.keysTotal);
    if (els.statWrongPct) els.statWrongPct.textContent = `${result.wrongWordPct}%`;
    if (els.statSkipped) els.statSkipped.textContent = String(result.skippedWords);
    if (els.statBackspace) els.statBackspace.textContent = String(result.backspaceCount);

    els.resultHero?.classList.remove('is-pass', 'is-fail');
    if (result.drillMode) {
        const drillOk = result.rate >= PASS_RATE && result.completedFully;
        els.resultHero?.classList.add(drillOk ? 'is-pass' : 'is-fail');
        if (els.resultMessage) {
            els.resultMessage.textContent = drillOk
                ? 'Tuş çalışması tamamlandı. Ana derse dönebilir veya tekrar edebilirsin.'
                : 'Tuş çalışması bitti. Aynı tuşu tekrar edebilir veya ana derse dönebilirsin.';
        }
    } else if (result.passed) {
        els.resultHero?.classList.add('is-pass');
        if (els.resultMessage) els.resultMessage.textContent = 'Tebrikler! Dersi başarıyla tamamladınız.';
    } else if (result.rate >= PASS_RATE && !result.completedFully) {
        els.resultHero?.classList.add('is-fail');
        if (els.resultMessage) els.resultMessage.textContent = 'Metni tamamlamadan bitirdiniz. Sonraki ders açılmaz; metni sonuna kadar yazın.';
    } else {
        els.resultHero?.classList.add('is-fail');
        if (els.resultMessage) els.resultMessage.textContent = 'Başarı oranı %50\'nin altında. Dersi yeniden deneyin.';
    }

    if (els.resultAdvice) els.resultAdvice.textContent = buildAdvice(result);

    const nextNo = (result.ders_no || 0) + 1;
    const prevNo = (result.ders_no || 0) - 1;
    const nextOpen = nextNo <= texts().TOTAL && lessonState(nextNo) !== 'locked';
    if (els.btnNext) {
        els.btnNext.disabled = !nextOpen;
        els.btnNext.textContent = result.ders_no >= texts().TOTAL ? 'Tüm dersler tamamlandı' : 'Sonraki ders';
    }
    if (els.btnPrev) els.btnPrev.disabled = prevNo < 1;

    if (els.btnSave) {
        els.btnSave.disabled = resultSaved || result.drillMode;
        els.btnSave.textContent = resultSaved ? 'Kaydedildi ✓' : 'Sonucu kaydet';
    }

    if (els.btnDrill) {
        const worst = result.worstKey;
        const drillKey = result.drillMode ? lastDrillKey : worst?.key;
        if (drillKey) {
            els.btnDrill.classList.remove('hidden');
            els.btnDrill.textContent = `En hatalı tuşu tekrarla (${formatKeyLabel(drillKey)})`;
            els.btnDrill.dataset.key = drillKey;
        } else {
            els.btnDrill.classList.add('hidden');
            delete els.btnDrill.dataset.key;
        }
    }

    els.result?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    if (result.passed && !result.drillMode) launchPassConfetti();
}

function hideResult() {
    els.result.classList.add('hidden');
    document.body.style.overflow = '';
}

async function finishLesson() {
    if (!isRunning || !activeLessonNo) return;
    isRunning = false;
    stopTimer();
    els.timerWrap?.classList.remove('is-visible');
    els.input.readOnly = true;
    updateHandHighlight();

    const result = computeResult();
    if (result.canUnlockNext && result.ders_no > progress.tamamlanan_ders) {
        progress.tamamlanan_ders = result.ders_no;
        progress.son_ders_no = result.ders_no;
    }
    showSetup();
    fillLessonSelect(result.ders_no);
    showResult(result);

    if (result.canUnlockNext) {
        try {
            const saved = await saveDersProgress(track, {
                ders_no: result.ders_no,
                tamamlanan_ders: result.ders_no,
                son_ders_no: result.ders_no,
                dogru_kelime: result.correct,
                yanlis_kelime: result.wrong,
                sure_saniye: result.sure_saniye,
                basari_yuzde: result.rate,
                tamamlandi: true,
                sonuc_kaydet: false,
            });
            progress.tamamlanan_ders = saved.tamamlanan_ders ?? result.ders_no;
            progress.son_ders_no = saved.son_ders_no ?? result.ders_no;
            fillLessonSelect(result.ders_no + 1);
        } catch (e) {
            console.warn(e);
            progress.tamamlanan_ders = Math.max(progress.tamamlanan_ders, result.ders_no);
            progress.son_ders_no = result.ders_no;
            fillLessonSelect(result.ders_no + 1);
        }
    }
}

function readSettingsFromForm() {
    lessonSettings = {
        highlightKeys: Boolean(els.optKeys?.checked),
    };
    persistSettings();
}

els.input?.addEventListener('input', onTypingInput);
els.input?.addEventListener('keyup', onTypingInput);

els.input?.addEventListener('keydown', (e) => {
    if (isRunning && e.key === 'Backspace') {
        backspaceCount++;
    }
});

els.examExit?.addEventListener('click', () => {
    if (isRunning) finishLesson();
});

els.lessonDdBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !els.lessonDd?.classList.contains('is-open');
    setLessonDropdownOpen(open);
});

document.addEventListener('click', (e) => {
    if (!els.lessonDd?.classList.contains('is-open')) return;
    if (els.lessonDd.contains(/** @type {Node} */ (e.target))) return;
    setLessonDropdownOpen(false);
});

els.settingsStart?.addEventListener('click', () => {
    readSettingsFromForm();
    const no = Number(els.lessonSelect?.value || 0);
    if (no) {
        drillMode = false;
        startLesson(no);
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (els.lessonDd?.classList.contains('is-open')) {
            e.preventDefault();
            setLessonDropdownOpen(false);
            return;
        }
        if (!els.result.classList.contains('hidden')) {
            hideResult();
            showSetup();
            fillLessonSelect(lastResult?.ders_no);
            return;
        }
        if (isRunning) {
            e.preventDefault();
            finishLesson();
        }
        return;
    }

    if (e.key === 'Enter' && !isRunning && els.setup && !els.setup.classList.contains('is-hidden')) {
        if (els.lessonDd?.classList.contains('is-open')) return;
        if (document.activeElement === els.lessonDdBtn) return;
        if (els.settingsStart && !els.settingsStart.disabled) {
            e.preventDefault();
            els.settingsStart.click();
        }
    }
});

els.btnClose?.addEventListener('click', () => {
    goToSetup(lastResult?.ders_no);
});

els.btnBack?.addEventListener('click', () => {
    goToSetup(lastResult?.ders_no);
});

els.btnRetry?.addEventListener('click', () => {
    const no = lastResult?.ders_no;
    if (!no) return;
    hideResult();
    startCurriculumLesson(no);
});

els.btnNext?.addEventListener('click', () => {
    const next = (lastResult?.ders_no || 0) + 1;
    if (next > texts().TOTAL || lessonState(next) === 'locked') return;
    hideResult();
    startCurriculumLesson(next);
});

els.btnPrev?.addEventListener('click', () => {
    const prev = (lastResult?.ders_no || 0) - 1;
    if (prev < 1) return;
    hideResult();
    startCurriculumLesson(prev);
});

els.btnDrill?.addEventListener('click', () => {
    const key = els.btnDrill?.dataset.key || lastResult?.worstKey?.key;
    if (!key) return;
    startKeyDrillSession(key);
});

els.btnSave?.addEventListener('click', async () => {
    if (!lastResult || resultSaved || lastResult.drillMode) return;

    const loggedIn = await isDersUserLoggedIn();
    if (!loggedIn) {
        showToast('Kaydetmek için giriş yapın.');
        return;
    }

    try {
        els.btnSave.disabled = true;
        const saved = await saveDersProgress(track, {
            ders_no: lastResult.ders_no,
            tamamlanan_ders: progress.tamamlanan_ders,
            son_ders_no: lastResult.ders_no,
            dogru_kelime: lastResult.correct,
            yanlis_kelime: lastResult.wrong,
            sure_saniye: lastResult.sure_saniye,
            basari_yuzde: lastResult.rate,
            tamamlandi: lastResult.passed,
            sonuc_kaydet: true,
        });
        resultSaved = true;
        els.btnSave.textContent = 'Kaydedildi ✓';
        if (saved.toplam_kelime != null) {
            showToast(`+${lastResult.correct} kelime profile eklendi.`);
        } else {
            showToast('Sonuç kaydedildi.');
        }
    } catch (e) {
        els.btnSave.disabled = false;
        showToast(e.message || 'Kayıt başarısız.');
    }
});

async function boot() {
    document.title = `${texts().trackLabel(track)} — YAZİYO`;
    if (els.trackTitle) els.trackTitle.textContent = texts().trackLabel(track);

    const back = document.getElementById('dlo-back-link');
    if (back) back.href = '../dersler/';

    if (els.optKeys) els.optKeys.checked = lessonSettings.highlightKeys;

    progress = await loadDersProgress(track);
    if (els.progressLabel) {
        els.progressLabel.textContent = `${progress.tamamlanan_ders} / ${texts().TOTAL} tamamlandı`;
    }

    showSetup();
    fillLessonSelect();
}

boot();
