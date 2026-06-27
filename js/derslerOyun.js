import { loadDersProgress, saveDersProgress, isDersUserLoggedIn } from './lib/derslerApi.js';
import { createTypingHandGuide } from './lib/typingHandGuide.js';

const PASS_RATE = 50;
const core = () => window.YaziyoKlavyeCore;
const scroll = () => window.YaziyoTypingScroll;
const texts = () => window.YaziyoDerslerMetinleri;

const params = new URLSearchParams(window.location.search);
const track = texts().resolveTrack(params);

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

function isHandGuideTrack(t) {
    return t === 'f' || t === 'q';
}

function keyboardLayoutForTrack(t) {
    return t === 'q' ? 'q' : 'f';
}

const fingerGuide = isHandGuideTrack(track)
    ? createTypingHandGuide({ layoutId: keyboardLayoutForTrack(track) })
    : null;

const els = {
    trackTitle: document.getElementById('dlo-track-title'),
    progressLabel: document.getElementById('dlo-progress-label'),
    lessonList: document.getElementById('dlo-lesson-list'),
    main: document.getElementById('dlo-main'),
    workspace: document.getElementById('dlo-workspace'),
    empty: document.getElementById('dlo-empty'),
    textContent: document.getElementById('dlo-text-content'),
    textCard: document.getElementById('dlo-text-card'),
    input: document.getElementById('dlo-input'),
    timerWrap: document.getElementById('dlo-timer-wrap'),
    timer: document.getElementById('dlo-timer'),
    finishBtn: document.getElementById('dlo-finish-btn'),
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
    fingerHint: document.getElementById('dlo-finger-hint'),
    fingerHintKey: document.getElementById('dlo-finger-hint-key'),
    fingerHintFinger: document.getElementById('dlo-finger-hint-finger'),
};

function fingerHintHandClass(fingerId) {
    if (!fingerId) return '';
    if (fingerId === 'thumb') return 'is-thumb';
    if (fingerId.startsWith('left_')) return 'is-left';
    return 'is-right';
}

function updateFingerHintBar(hint) {
    if (!isHandGuideTrack(track)) return;

    if (!hint?.char) {
        els.fingerHint?.classList.remove('is-visible');
        if (els.fingerHintKey) els.fingerHintKey.textContent = '—';
        if (els.fingerHintFinger) {
            els.fingerHintFinger.textContent = '—';
            els.fingerHintFinger.className = 'dlo-finger-hint-finger-name';
        }
        return;
    }

    els.fingerHint?.classList.add('is-visible');
    if (els.fingerHintKey) {
        els.fingerHintKey.textContent = hint.displayChar;
        els.fingerHintKey.classList.remove('is-pulse');
        void els.fingerHintKey.offsetWidth;
        els.fingerHintKey.classList.add('is-pulse');
    }
    if (els.fingerHintFinger) {
        els.fingerHintFinger.textContent = hint.label || '—';
        els.fingerHintFinger.className = `dlo-finger-hint-finger-name ${fingerHintHandClass(hint.finger)}`;
    }
}

function updateHandGuide() {
    if (!fingerGuide || !isRunning) return;
    const ref = currentText.trim().replace(/\s+/g, ' ');
    const hint = fingerGuide.updateFromReference(ref, els.input.value.length);
    updateFingerHintBar(hint);
}

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

function startTimer() {
    if (timerStarted) return;
    timerStarted = true;
    els.timerWrap?.classList.add('is-visible');
    els.timerWrap?.removeAttribute('hidden');
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

    const activeIdx = C.getActiveWordIndexFromInput(inputVal, wordsArray.length);
    highlightActiveWord(activeIdx);
    syncScroll();
    updateHandGuide();

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

function setUiMode(mode) {
    if (!els.main) return;
    els.main.dataset.dloMode = mode;
    els.main.classList.toggle('is-lesson-active', mode === 'lesson');
}

function showLessonPicker() {
    isRunning = false;
    timerStarted = false;
    stopTimer();
    elapsedSec = 0;
    if (els.timer) els.timer.textContent = '00:00';
    setUiMode('picker');
    els.timerWrap?.classList.remove('is-visible');
    els.timerWrap?.setAttribute('hidden', '');
    els.finishBtn?.setAttribute('hidden', '');
    els.workspace?.setAttribute('hidden', '');
    els.empty?.removeAttribute('hidden');
    els.input.value = '';
    els.input.readOnly = true;
    updateFingerHintBar(null);
    activeLessonNo = null;
}

function resetWorkspace() {
    showLessonPicker();
}

function renderLessonList() {
    const lessons = texts().tracks[track] || [];
    els.trackTitle.textContent = texts().trackLabel(track);
    els.progressLabel.textContent = `${progress.tamamlanan_ders} / ${texts().TOTAL} tamamlandı`;
    els.lessonList.innerHTML = '';

    lessons.forEach((lesson) => {
        const state = lessonState(lesson.no);
        const item = document.createElement('div');
        item.className = 'dlo-lesson-item';
        item.setAttribute('role', 'listitem');
        if (state === 'locked') item.classList.add('is-locked');
        if (lesson.no === activeLessonNo) item.classList.add('is-active');

        const label = document.createElement('div');
        label.className = 'dlo-lesson-label';
        if (state === 'locked') {
            label.innerHTML = `<i class="fa-solid fa-lock"></i><span>${lesson.title}</span>`;
        } else if (state === 'completed') {
            label.innerHTML = `<i class="fa-solid fa-circle-check"></i><span>${lesson.title}</span>`;
        } else {
            label.innerHTML = `<span>${lesson.title}</span>`;
        }

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dlo-lesson-action';

        if (state === 'locked') {
            btn.className += ' dlo-lesson-action--retry';
            btn.textContent = 'Kilitli';
            btn.disabled = true;
        } else if (state === 'completed') {
            btn.className += ' dlo-lesson-action--retry';
            btn.textContent = 'Tekrar Et';
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                startLesson(lesson.no);
            });
        } else {
            btn.className += ' dlo-lesson-action--start';
            btn.textContent = 'Başla';
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                startLesson(lesson.no);
            });
        }

        item.appendChild(label);
        item.appendChild(btn);
        els.lessonList.appendChild(item);
    });
}

function getLesson(no) {
    return (texts().tracks[track] || []).find((l) => l.no === no);
}

function startLesson(no) {
    const lesson = getLesson(no);
    if (!lesson) return;

    const state = lessonState(no);
    if (state === 'locked') {
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
    fingerGuide?.setLayout(keyboardLayoutForTrack(track));

    setUiMode('lesson');
    els.empty?.setAttribute('hidden', '');
    els.workspace?.removeAttribute('hidden');
    els.finishBtn?.removeAttribute('hidden');
    els.input.value = '';
    els.input.readOnly = false;
    els.input.focus();

    isRunning = true;
    timerStarted = false;
    elapsedSec = 0;
    els.timerWrap?.classList.remove('is-visible');
    els.timerWrap?.setAttribute('hidden', '');
    if (els.timer) els.timer.textContent = '00:00';
    updateHandGuide();

    renderLessonList();
}

function computeResult() {
    const C = core();
    const alignment = C.evaluateExamText(wordsArray, els.input.value, true, {
        incompleteLastWord: true,
    });
    const total = wordsArray.length;
    const correct = alignment.correct;
    const wrong = alignment.wrong;
    const rate = total > 0 ? Math.round((correct / total) * 100) : 0;
    const freq = letterFrequencyStats(wordsArray);
    const completedFully = isTextComplete(els.input.value);
    const passed = rate >= PASS_RATE && completedFully;
    const canUnlockNext = passed;

    return {
        correct,
        wrong,
        total,
        rate,
        passed,
        canUnlockNext,
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
        if (result.ders_no < texts().TOTAL) {
            els.btnContinue.textContent = 'Devam Et →';
        } else {
            els.btnContinue.textContent = 'Tüm Dersler Tamamlandı';
        }
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
    els.timerWrap?.setAttribute('hidden', '');
    els.input.readOnly = true;
    updateFingerHintBar(null);

    const result = computeResult();
    showLessonPicker();
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
            renderLessonList();
        } catch (e) {
            console.warn(e);
            progress.tamamlanan_ders = Math.max(progress.tamamlanan_ders, result.ders_no);
            progress.son_ders_no = result.ders_no;
            renderLessonList();
        }
    }
}

els.input?.addEventListener('input', onTypingInput);

els.finishBtn?.addEventListener('click', () => finishLesson());

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!els.result.classList.contains('hidden')) {
        hideResult();
        resetWorkspace();
        renderLessonList();
        return;
    }
    if (isRunning) {
        e.preventDefault();
        finishLesson();
    }
});

els.btnClose?.addEventListener('click', () => {
    hideResult();
    resetWorkspace();
    renderLessonList();
});

els.btnRedo?.addEventListener('click', () => {
    hideResult();
    const no = lastResult?.ders_no;
    if (no) startLesson(no);
});

els.btnRetry?.addEventListener('click', () => {
    hideResult();
    const no = lastResult?.ders_no;
    if (no) startLesson(no);
});

els.btnContinue?.addEventListener('click', () => {
    hideResult();
    if (!lastResult?.canUnlockNext) {
        resetWorkspace();
        renderLessonList();
        return;
    }
    const next = (lastResult?.ders_no || activeLessonNo || 0) + 1;
    if (next <= texts().TOTAL && lessonState(next) !== 'locked') {
        startLesson(next);
    } else {
        resetWorkspace();
        renderLessonList();
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

showLessonPicker();

async function boot() {
    document.title = `${texts().trackLabel(track)} — YAZİYO`;
    progress = await loadDersProgress(track);
    showLessonPicker();
    renderLessonList();
}

boot();
