import { loadDersProgress, saveDersProgress, isDersUserLoggedIn } from './lib/derslerApi.js';
import { FINGER_LABELS, getFingerMap, normalizePressedKey } from './lib/keyboardLayouts.js';

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
    nextKeyValue: document.getElementById('dlo-next-key-value'),
    nextKeyFinger: document.getElementById('dlo-next-key-finger'),
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
    statCorrect: document.getElementById('dlo-stat-correct'),
    statWrong: document.getElementById('dlo-stat-wrong'),
    statMost: document.getElementById('dlo-stat-most'),
    btnSave: document.getElementById('dlo-btn-save'),
    btnContinue: document.getElementById('dlo-btn-continue'),
    btnRetry: document.getElementById('dlo-btn-retry'),
    btnRedo: document.getElementById('dlo-btn-redo'),
    btnClose: document.getElementById('dlo-result-close'),
    toast: document.getElementById('dlo-toast'),
    resultKazanim: document.getElementById('dlo-result-kazanim'),
    resultKazanimText: document.getElementById('dlo-result-kazanim-text'),
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

function formatKeyLabel(ch) {
    if (ch === ' ') return 'Boşluk';
    if (ch === '\n') return 'Enter';
    return String(ch).toLocaleUpperCase('tr-TR');
}

function fingerLabelForChar(ch) {
    const key = normalizePressedKey(ch) ?? String(ch).toLocaleLowerCase('tr-TR');
    const fingerId = fingerMap[key];
    return fingerId ? (FINGER_LABELS[fingerId] || '—') : '—';
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

function updateNextKeyHint() {
    if (!isRunning) {
        if (els.nextKeyValue) els.nextKeyValue.textContent = '—';
        if (els.nextKeyFinger) els.nextKeyFinger.textContent = '—';
        return;
    }
    const ref = currentText.trim().replace(/\s+/g, ' ');
    const typed = els.input.value;
    const idx = guideIndex(typed, ref);
    if (idx >= ref.length) {
        if (els.nextKeyValue) els.nextKeyValue.textContent = '—';
        if (els.nextKeyFinger) els.nextKeyFinger.textContent = '—';
        return;
    }
    const ch = ref[idx];
    if (els.nextKeyValue) els.nextKeyValue.textContent = formatKeyLabel(ch);
    if (els.nextKeyFinger) els.nextKeyFinger.textContent = fingerLabelForChar(ch);
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
    const C = core();

    updateCharHighlight(inputVal);
    updateNextKeyHint();

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
    if (els.nextKeyValue) els.nextKeyValue.textContent = '—';
    if (els.nextKeyFinger) els.nextKeyFinger.textContent = '—';
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
    currentText = lesson.content;
    resultSaved = false;
    lastResult = null;
    prepareWordsDOM(currentText);

    openExamScreen();

    els.input.value = '';
    els.input.readOnly = false;
    isRunning = true;
    timerStarted = false;
    elapsedSec = 0;
    els.timerWrap?.classList.remove('is-visible');
    if (els.timer) els.timer.textContent = '00:00';
    updateNextKeyHint();
    els.input.focus();
}

function computeResult() {
    const C = core();
    const alignment = C.evaluateExamText(wordsArray, els.input.value, false, {
        incompleteLastWord: true,
    });
    const total = wordsArray.length;
    const correct = alignment.correct;
    const wrong = alignment.wrong;
    const rate = total > 0 ? Math.round((correct / total) * 100) : 0;
    const freq = letterFrequencyStats(wordsArray);
    const completedFully = isTextComplete(els.input.value);
    const passed = rate >= PASS_RATE && completedFully;

    return {
        correct,
        wrong,
        total,
        rate,
        passed,
        canUnlockNext: passed,
        completedFully,
        freq,
        ders_no: activeLessonNo,
        sure_saniye: elapsedSec,
        kazanim: getLesson(activeLessonNo)?.kazanim || '',
    };
}

function showResult(result) {
    lastResult = result;
    els.resultRate.textContent = `${result.rate}%`;
    els.statCorrect.textContent = String(result.correct);
    els.statWrong.textContent = String(result.wrong);
    els.statMost.textContent = result.freq.most;

    els.resultHero.classList.remove('is-pass', 'is-fail');
    els.btnContinue.classList.add('hidden');
    els.btnRetry.classList.add('hidden');
    els.btnRedo.classList.add('hidden');

    if (result.passed) {
        els.resultHero.classList.add('is-pass');
        els.resultMessage.textContent = 'Tebrikler! Dersi başarıyla tamamladınız.';
        els.btnContinue.classList.remove('hidden');
        els.btnRetry.classList.remove('hidden');
        els.btnContinue.textContent = result.ders_no < texts().TOTAL ? 'Devam Et →' : 'Tüm Dersler Tamamlandı';
    } else if (result.rate >= PASS_RATE && !result.completedFully) {
        els.resultHero.classList.add('is-fail');
        els.resultMessage.textContent = 'Metni tamamlamadan bitirdiniz. Sonraki ders açılmaz; metni sonuna kadar yazın.';
        els.btnRedo.classList.remove('hidden');
    } else {
        els.resultHero.classList.add('is-fail');
        els.resultMessage.textContent = 'Başarı oranı %50\'nin altında. Dersi yeniden deneyin.';
        els.btnRedo.classList.remove('hidden');
    }

    els.btnSave.disabled = resultSaved;
    els.btnSave.textContent = resultSaved ? 'Kaydedildi ✓' : 'Sonuçları Kaydet';

    if (els.resultKazanim && els.resultKazanimText) {
        if (result.kazanim) {
            els.resultKazanimText.textContent = result.kazanim;
            els.resultKazanim.classList.remove('hidden');
        } else {
            els.resultKazanim.classList.add('hidden');
        }
    }

    els.result.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
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
    if (els.nextKeyValue) els.nextKeyValue.textContent = '—';
    if (els.nextKeyFinger) els.nextKeyFinger.textContent = '—';

    const result = computeResult();
    showSetup();
    fillLessonSelect(result.ders_no);
    showResult(result);

    if (result.canUnlockNext && result.ders_no > progress.tamamlanan_ders) {
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
    if (no) startLesson(no);
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
    hideResult();
    showSetup();
    fillLessonSelect(lastResult?.ders_no);
});

els.btnRedo?.addEventListener('click', () => {
    hideResult();
    const no = lastResult?.ders_no;
    if (!no) return;
    fillLessonSelect(no);
    readSettingsFromForm();
    startLesson(no);
});

els.btnRetry?.addEventListener('click', () => {
    hideResult();
    const no = lastResult?.ders_no;
    if (!no) return;
    fillLessonSelect(no);
    readSettingsFromForm();
    startLesson(no);
});

els.btnContinue?.addEventListener('click', () => {
    hideResult();
    if (!lastResult?.canUnlockNext) {
        showSetup();
        fillLessonSelect();
        return;
    }
    const next = (lastResult?.ders_no || 0) + 1;
    if (next <= texts().TOTAL && lessonState(next) !== 'locked') {
        fillLessonSelect(next);
        readSettingsFromForm();
        startLesson(next);
    } else {
        showSetup();
        fillLessonSelect();
    }
});

els.btnSave?.addEventListener('click', async () => {
    if (!lastResult || resultSaved) return;

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
            showToast('Sonuçlar kaydedildi.');
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
