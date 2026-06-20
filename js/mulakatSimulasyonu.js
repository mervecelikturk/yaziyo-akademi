/**
 * YAZİYO — Mülakat Simülasyonu (kart seçimi → salon → klavye → fanus → sözlü → sonuç)
 */
import { getStoredVerifiedUser } from './lib/authStorage.js';
import {
    fetchPublishedSimulasyonlar,
    fetchUserDenemeleri,
    saveSimulasyonDenemesi,
    DEFAULT_MIN_ORAL_CORRECT,
    ORAL_QUESTION_COUNT,
    isTableMissingError
} from './lib/mulakatSimulasyonuApi.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const CARD_TONE_COUNT = 8;
const TypingCore = window.YaziyoKlavyeCore;

const state = {
    simulations: [],
    attempts: [],
    selected: null,
    lastSimId: null,
    phase: 'lobby',
    timerId: null,
    timeLeft: 0,
    typed: '',
    correctWords: 0,
    keyboardPassed: false,
    oralIndex: 0,
    oralCorrect: 0,
    oralAnswered: false,
    countdownInterval: null,
    originalWords: [],
    escHandler: null,
    audioCtx: null
};

const els = {};

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}

function ensureAudioCtx() {
    if (!state.audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) state.audioCtx = new Ctx();
    }
    if (state.audioCtx?.state === 'suspended') {
        state.audioCtx.resume().catch(() => {});
    }
    return state.audioCtx;
}

/** @param {'tick' | 'start'} kind */
function playCountdownSound(kind) {
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    const freq = kind === 'start' ? 880 : 440;
    const dur = kind === 'start' ? 0.36 : 0.14;
    const vol = kind === 'start' ? 0.18 : 0.12;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
}

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getMinWords() {
    return state.selected?.minWords || 90;
}

function countCorrectWords() {
    if (!TypingCore || !state.originalWords.length) return 0;
    const result = TypingCore.evaluateExamText(state.originalWords, state.typed, true, {});
    return result.correct;
}

function setPhasePills(activePhase) {
    ['keyboard', 'oral', 'result'].forEach((p) => {
        const el = document.getElementById(`phase-pill-${p}`);
        if (!el) return;
        el.classList.remove('active', 'done');
        if (p === activePhase) el.classList.add('active');
        else if (
            (activePhase === 'oral' && p === 'keyboard')
            || (activePhase === 'result' && (p === 'keyboard' || p === 'oral'))
            || (activePhase === 'done' && p !== 'result')
        ) el.classList.add('done');
    });
}

function renderCards() {
    if (!els.cardsGrid) return;

    if (!state.simulations.length) {
        els.cardsGrid.innerHTML = '';
        els.emptyMsg?.classList.remove('hidden');
        return;
    }

    els.emptyMsg?.classList.add('hidden');
    els.cardsGrid.innerHTML = state.simulations.map((sim, i) => `
        <article class="ms-sim-card ms-sim-card-tone-${i % CARD_TONE_COUNT}" role="listitem">
            <p class="ms-card-label">Simülasyon</p>
            <h2 class="ms-card-title">${escapeHtml(sim.title)}</h2>
            <p class="ms-card-desc">${escapeHtml(sim.description || 'Resmî mülakat simülasyonu')}</p>
            <div class="ms-card-meta">
                <span class="ms-card-tag">${Math.round((sim.keyboardDurationSec || 180) / 60)} dk klavye</span>
                <span class="ms-card-tag">Min ${sim.minWords} doğru kelime</span>
                <span class="ms-card-tag">${ORAL_QUESTION_COUNT} sözlü soru</span>
            </div>
            <button type="button" class="ms-card-start" data-start="${sim.id}">
                <i class="fa-solid fa-play"></i> Simülasyonu Başlat
            </button>
        </article>
    `).join('');

    els.cardsGrid.querySelectorAll('[data-start]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const sim = state.simulations.find((s) => s.id === btn.dataset.start);
            if (sim) enterScene(sim);
        });
    });
}

function bindSceneEsc() {
    if (state.escHandler) return;
    state.escHandler = (e) => {
        if (e.key !== 'Escape') return;
        if (state.phase === 'keyboard' && !els.examWorkspace?.classList.contains('hidden')) return;
        if (els.oralOverlay?.classList.contains('open')) {
            e.preventDefault();
            return;
        }
        if (state.phase === 'scene' || state.phase === 'desk') {
            e.preventDefault();
            exitScene();
        }
    };
    document.addEventListener('keydown', state.escHandler);
}

function unbindSceneEsc() {
    if (!state.escHandler) return;
    document.removeEventListener('keydown', state.escHandler);
    state.escHandler = null;
}

function enterScene(sim) {
    if (sim.questions.length !== ORAL_QUESTION_COUNT) {
        alert('Bu simülasyonun soru seti eksik.');
        return;
    }

    state.selected = sim;
    state.lastSimId = sim.id;
    state.phase = 'scene';
    state.keyboardPassed = false;
    state.correctWords = 0;
    state.typed = '';
    state.oralIndex = 0;
    state.oralCorrect = 0;
    state.originalWords = (sim.keyboardText || '').trim().split(/\s+/).filter(Boolean);

    if (els.deskHint) els.deskHint.textContent = 'Klavyeye tıklayarak klavye mülakatını başlatın';

    els.keyboardBtn?.classList.remove('hidden', 'ms-desk-item--done');
    els.keyboardBtn && (els.keyboardBtn.disabled = false);
    els.fanusBtn?.classList.add('hidden');
    els.fanusBtn?.classList.remove('ms-fanus--pulse');

    document.documentElement.classList.add('ms-scene-open');
    els.sceneRoot?.classList.remove('hidden');
    els.sceneRoot?.setAttribute('aria-hidden', 'false');
    els.lobby?.classList.add('hidden');
    setPhasePills('keyboard');
    bindSceneEsc();
}

function exitScene() {
    stopTimer();
    closeExamWorkspace();
    els.oralOverlay?.classList.remove('open');
    els.resultModal?.classList.add('hidden');

    document.documentElement.classList.remove('ms-scene-open');
    els.sceneRoot?.classList.add('hidden');
    els.sceneRoot?.setAttribute('aria-hidden', 'true');
    els.lobby?.classList.remove('hidden');
    unbindSceneEsc();

    state.phase = 'lobby';
    state.selected = null;
    setPhasePills('idle');
}

function prepareExamWords(text) {
    if (!els.examText) return;
    const words = (text || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
    els.examText.innerHTML = words.map((w, i) =>
        `<span id="word-${i}" class="inline-block transition-all duration-200">${escapeHtml(w)}</span> `
    ).join('');
    els.examText.style.transform = 'translateY(0px)';
}

function highlightActiveWord() {
    if (!TypingCore || !els.examText || !state.originalWords.length) return;
    const activeIdx = TypingCore.getActiveWordIndexFromInput(
        state.typed,
        state.originalWords.length
    );

    els.examText.querySelectorAll('[id^="word-"]').forEach((el, i) => {
        el.classList.toggle('word-active', i === activeIdx);
    });

    const activeEl = document.getElementById(`word-${activeIdx}`);
    const container = els.textDisplayCard;
    if (activeEl && container) {
        const cr = container.getBoundingClientRect();
        const er = activeEl.getBoundingClientRect();
        if (er.bottom > cr.bottom - 50) {
            const cur = els.examText.style.transform
                ? parseInt(els.examText.style.transform.replace(/[^\d-]/g, ''), 10) || 0
                : 0;
            els.examText.style.transform = `translateY(${cur - 35}px)`;
        }
    }
}

function updateKeyboardStats() {
    state.correctWords = countCorrectWords();
    if (els.kbTimer) {
        els.kbTimer.textContent = formatTime(state.timeLeft);
        if (state.timeLeft <= 10 && state.timeLeft > 0) {
            els.kbTimer.classList.add('timer-warning');
        } else {
            els.kbTimer.classList.remove('timer-warning');
        }
    }
    highlightActiveWord();
}

function openExamWorkspace() {
    els.examWorkspace?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeExamWorkspace() {
    els.examWorkspace?.classList.add('hidden');
    els.examContent?.classList.add('hidden');
    els.countdownOverlay?.classList.remove('opacity-100', 'hidden');
    els.countdownOverlay?.classList.add('opacity-0');
    els.countdownNumber?.classList.add('text-yaziyo-gold');
    els.countdownNumber?.classList.remove('text-green-500');
    document.body.style.overflow = '';
    if (document.documentElement.classList.contains('ms-scene-open')) {
        document.body.style.overflow = 'hidden';
    }
    if (state.countdownInterval) {
        clearInterval(state.countdownInterval);
        state.countdownInterval = null;
    }
}

function finishCountdown() {
    els.countdownOverlay?.classList.replace('opacity-100', 'opacity-0');
    setTimeout(() => {
        els.countdownOverlay?.classList.add('hidden');
        els.countdownNumber?.classList.add('text-yaziyo-gold');
        els.countdownNumber?.classList.remove('text-green-500');
        beginKeyboardTest();
    }, 300);
}

function startCountdown() {
    if (!els.countdownOverlay || !els.countdownNumber) {
        beginKeyboardTest();
        return;
    }
    els.countdownOverlay.classList.remove('hidden');
    els.examContent?.classList.add('hidden');

    if (els.countdownOverlay.classList.contains('opacity-0')) {
        els.countdownOverlay.classList.replace('opacity-0', 'opacity-100');
    } else {
        els.countdownOverlay.classList.add('opacity-100');
    }

    let count = 3;
    els.countdownNumber.textContent = String(count);
    els.countdownNumber.classList.remove('text-green-500');
    els.countdownNumber.classList.add('text-yaziyo-gold');
    ensureAudioCtx();
    playCountdownSound('tick');

    if (state.countdownInterval) clearInterval(state.countdownInterval);
    state.countdownInterval = setInterval(() => {
        count -= 1;
        if (count > 0) {
            els.countdownNumber.textContent = String(count);
            playCountdownSound('tick');
        } else if (count === 0) {
            els.countdownNumber.textContent = 'BAŞLA!';
            els.countdownNumber.classList.add('text-green-500');
            els.countdownNumber.classList.remove('text-yaziyo-gold');
            playCountdownSound('start');
        } else {
            clearInterval(state.countdownInterval);
            state.countdownInterval = null;
            finishCountdown();
        }
    }, 1000);
}

function stopTimer() {
    if (state.timerId) {
        clearInterval(state.timerId);
        state.timerId = null;
    }
}

function returnToDeskAfterKeyboard() {
    closeExamWorkspace();
    state.phase = 'desk';
    state.keyboardPassed = true;

    if (els.keyboardBtn) {
        els.keyboardBtn.disabled = true;
        els.keyboardBtn.classList.add('ms-desk-item--done');
    }
    if (els.fanusBtn) {
        els.fanusBtn.classList.remove('hidden');
        els.fanusBtn.classList.add('ms-fanus--pulse');
    }
    if (els.deskHint) {
        els.deskHint.textContent = 'Klavye mülakatını geçtiniz. Fanusa tıklayarak sözlü mülakata geçin.';
    }
    setPhasePills('oral');
}

function finishKeyboardPhase() {
    stopTimer();
    updateKeyboardStats();
    const minWords = getMinWords();

    if (state.correctWords < minWords) {
        closeExamWorkspace();
        showResult(false, {
            reason: 'keyboard',
            keyboardPassed: false,
            message: `Klavye mülakatında en az ${minWords} doğru kelime yazmanız gerekiyordu. ${state.correctWords} doğru kelime yazdınız. Mülakat sona erdi.`,
            correctWords: state.correctWords
        });
        return;
    }

    returnToDeskAfterKeyboard();
}

function startKeyboardPhase() {
    if (state.keyboardPassed) return;

    state.phase = 'keyboard';
    state.typed = '';
    state.correctWords = 0;

    prepareExamWords(state.selected?.keyboardText || '');
    if (els.examInput) {
        els.examInput.value = '';
        els.examInput.readOnly = true;
    }
    if (els.examText?.parentElement) {
        els.examText.parentElement.scrollTo({ top: 0, behavior: 'instant' });
    }
    updateKeyboardStats();
    openExamWorkspace();
    startCountdown();
}

function startKeyboardTimer() {
    stopTimer();
    state.timeLeft = state.selected?.keyboardDurationSec || 180;
    updateKeyboardStats();
    state.timerId = setInterval(() => {
        state.timeLeft -= 1;
        updateKeyboardStats();
        if (state.timeLeft <= 0) finishKeyboardPhase();
    }, 1000);
}

function beginKeyboardTest() {
    els.examContent?.classList.remove('hidden');
    if (els.examInput) {
        els.examInput.readOnly = false;
        els.examInput.focus();
    }
    startKeyboardTimer();
}

function openOralPhase() {
    const q = state.selected?.questions?.[state.oralIndex];
    if (!q) {
        finishSimulation();
        return;
    }
    state.oralAnswered = false;
    if (els.oralTitle) {
        els.oralTitle.textContent = `2. Aşama — Sözlü Mülakat (${state.oralIndex + 1}/${ORAL_QUESTION_COUNT})`;
    }
    if (els.oralQuestion) els.oralQuestion.textContent = q.question;
    if (els.oralMeta) {
        els.oralMeta.textContent = `En az ${DEFAULT_MIN_ORAL_CORRECT} doğru gerekli · Şu an ${state.oralCorrect} doğru`;
    }
    if (els.oralOptions) {
        els.oralOptions.innerHTML = q.options.map((opt, i) => `
            <button type="button" class="ms-oral-option" data-idx="${i}">
                <span class="ms-oral-letter">${LETTERS[i]}</span>
                <span>${escapeHtml(opt)}</span>
            </button>
        `).join('');
        els.oralOptions.querySelectorAll('[data-idx]').forEach((btn) => {
            btn.addEventListener('click', () => answerOral(parseInt(btn.dataset.idx, 10)));
        });
    }
    if (els.oralNext) els.oralNext.classList.add('hidden');
    els.oralOverlay?.classList.add('open');
}

function answerOral(selectedIndex) {
    if (state.oralAnswered) return;
    const q = state.selected?.questions?.[state.oralIndex];
    if (!q) return;

    state.oralAnswered = true;
    if (selectedIndex === q.correctIndex) state.oralCorrect += 1;

    els.oralOptions?.querySelectorAll('[data-idx]').forEach((btn) => {
        const idx = parseInt(btn.dataset.idx, 10);
        btn.disabled = true;
        if (idx === q.correctIndex) btn.classList.add('correct');
        else if (idx === selectedIndex) btn.classList.add('wrong');
    });

    if (els.oralNext) {
        els.oralNext.classList.remove('hidden');
        els.oralNext.textContent = state.oralIndex >= ORAL_QUESTION_COUNT - 1 ? 'Sonucu Gör' : 'Sonraki Soru';
    }
}

function nextOralQuestion() {
    state.oralIndex += 1;
    if (state.oralIndex >= ORAL_QUESTION_COUNT) {
        finishSimulation();
        return;
    }
    openOralPhase();
}

function finishSimulation() {
    els.oralOverlay?.classList.remove('open');
    const oralPassed = state.oralCorrect >= DEFAULT_MIN_ORAL_CORRECT;
    const overallSuccess = state.keyboardPassed && oralPassed;

    showResult(overallSuccess, {
        reason: 'complete',
        keyboardPassed: true,
        oralPassed,
        message: overallSuccess
            ? `Tebrikler! Klavye mülakatında ${state.correctWords} doğru kelime, sözlü mülakatta ${state.oralCorrect}/${ORAL_QUESTION_COUNT} doğru cevap ile simülasyonu başarıyla tamamladınız.`
            : `Sözlü mülakatta en az ${DEFAULT_MIN_ORAL_CORRECT} doğru cevap gerekliydi. ${state.oralCorrect} doğru cevap verdiniz.`,
        correctWords: state.correctWords,
        oralCorrect: state.oralCorrect
    });
}

function formatDate(iso) {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

async function persistAttempt(success, detail) {
    const simId = state.selected?.id || state.lastSimId;
    if (!simId) return;

    const minWords = getMinWords();
    const words = detail.correctWords ?? state.correctWords;
    const keyboardPassed = detail.keyboardPassed ?? (words >= minWords);

    const { error } = await saveSimulasyonDenemesi({
        simulasyonId: simId,
        wordCount: words,
        keyboardPassed,
        oralCorrect: detail.reason === 'keyboard' ? null : (detail.oralCorrect ?? state.oralCorrect),
        success,
        stage: detail.reason === 'keyboard' ? 'klavye' : 'tamamlandi'
    });

    if (error) console.warn('Deneme kaydedilemedi:', error.message);
    else await loadAttempts();
}

function renderAttemptHistory() {
    if (!els.historyList) return;
    if (!state.attempts.length) {
        els.historyList.innerHTML = `<p class="text-xs text-light-text-secondary text-center py-4">Henüz deneme kaydı yok.</p>`;
        return;
    }
    els.historyList.innerHTML = state.attempts.map((a) => `
        <div class="ms-history-item">
            <div class="ms-history-item-main">
                <span class="ms-history-title">${escapeHtml(a.simTitle)}</span>
                <span class="ms-history-date">${formatDate(a.createdAt)}</span>
            </div>
            <div class="ms-history-meta">
                <span><i class="fa-solid fa-keyboard"></i> ${a.wordCount} kelime</span>
                ${a.oralCorrect != null ? `<span><i class="fa-solid fa-microphone"></i> ${a.oralCorrect}/${ORAL_QUESTION_COUNT}</span>` : ''}
                <span class="ms-history-badge ${a.success ? 'ok' : 'fail'}">${a.success ? 'Başarılı' : 'Başarısız'}</span>
            </div>
        </div>
    `).join('');
}

async function loadAttempts() {
    const { data, error } = await fetchUserDenemeleri(8);
    if (error) return;
    state.attempts = data || [];
    renderAttemptHistory();
}

function showResult(success, detail) {
    state.phase = 'result';
    setPhasePills('result');

    const minWords = getMinWords();
    const kbPassed = detail.keyboardPassed ?? (detail.correctWords >= minWords);
    const oralReached = detail.reason !== 'keyboard';

    if (els.resultTitle) {
        els.resultTitle.textContent = success ? 'Mülakat Başarılı' : 'Mülakat Başarısız';
    }
    if (els.resultBadge) {
        els.resultBadge.textContent = success ? 'Simülasyon geçildi' : 'Simülasyon tamamlanamadı';
        els.resultBadge.className = `text-xs font-bold uppercase tracking-wider mt-0.5 ${success ? 'text-yaziyo-green' : 'text-red-400'}`;
    }
    if (els.resultMessage) els.resultMessage.textContent = detail.message || '';

    if (els.resultIconWrap) {
        els.resultIconWrap.classList.toggle('fail', !success);
    }
    if (els.resultIconI) {
        els.resultIconI.className = success
            ? 'fa-solid fa-trophy text-yaziyo-gold'
            : 'fa-solid fa-circle-xmark text-red-400';
    }

    if (els.resKbCorrect) els.resKbCorrect.textContent = String(detail.correctWords ?? state.correctWords);
    if (els.resKbTarget) els.resKbTarget.textContent = String(minWords);
    if (els.resKbStatus) {
        els.resKbStatus.textContent = kbPassed ? 'Geçti' : 'Kaldı';
        els.resKbStatus.className = `ms-result-stat-val text-sm ${kbPassed ? 'text-yaziyo-green' : 'text-red-400'}`;
    }

    if (els.resOralBlock) {
        if (oralReached) {
            els.resOralBlock.classList.remove('muted');
            if (els.resOralCorrect) els.resOralCorrect.textContent = String(detail.oralCorrect ?? state.oralCorrect);
            if (els.resOralTotal) els.resOralTotal.textContent = String(ORAL_QUESTION_COUNT);
            const oralOk = (detail.oralCorrect ?? state.oralCorrect) >= DEFAULT_MIN_ORAL_CORRECT;
            if (els.resOralStatus) {
                els.resOralStatus.textContent = oralOk ? 'Geçti' : 'Kaldı';
                els.resOralStatus.className = `ms-result-stat-val text-sm ${oralOk ? 'text-yaziyo-green' : 'text-red-400'}`;
            }
        } else {
            els.resOralBlock.classList.add('muted');
            if (els.resOralCorrect) els.resOralCorrect.textContent = '—';
            if (els.resOralStatus) {
                els.resOralStatus.textContent = 'Yapılmadı';
                els.resOralStatus.className = 'ms-result-stat-val text-sm text-yaziyo-text-secondary';
            }
        }
    }

    els.resultModal?.classList.remove('hidden');
    persistAttempt(success, detail);
}

function restartCurrentSimulation() {
    const sim = state.selected
        || state.simulations.find((s) => s.id === state.lastSimId);
    els.resultModal?.classList.add('hidden');
    els.oralOverlay?.classList.remove('open');
    closeExamWorkspace();
    if (sim) enterScene(sim);
    else exitScene();
}

async function loadSimulations() {
    const { data, error } = await fetchPublishedSimulasyonlar();

    if (error) {
        if (isTableMissingError(error) && els.setupBanner) {
            els.setupBanner.classList.remove('hidden');
        }
        return;
    }

    state.simulations = data || [];
    els.setupBanner?.classList.add('hidden');
    els.emptyMsg?.classList.toggle('hidden', state.simulations.length > 0);
    renderCards();
}

function bindEvents() {
    els.btnReload?.addEventListener('click', () => loadSimulations());
    els.sceneExit?.addEventListener('click', exitScene);
    els.keyboardBtn?.addEventListener('click', startKeyboardPhase);
    els.fanusBtn?.addEventListener('click', () => {
        if (!state.keyboardPassed) return;
        openOralPhase();
    });
    els.examExit?.addEventListener('click', () => {
        stopTimer();
        closeExamWorkspace();
    });
    els.examInput?.addEventListener('input', (e) => {
        state.typed = e.target.value;
        updateKeyboardStats();
    });
    els.examInput?.addEventListener('paste', (e) => e.preventDefault());
    els.examInput?.addEventListener('drop', (e) => e.preventDefault());
    els.oralNext?.addEventListener('click', nextOralQuestion);
    els.oralClose?.addEventListener('click', () => {
        els.oralOverlay?.classList.remove('open');
    });
    els.resultBack?.addEventListener('click', () => {
        els.resultModal?.classList.add('hidden');
        exitScene();
    });
    els.resultRetry?.addEventListener('click', restartCurrentSimulation);
}

function cacheElements() {
    const id = (x) => document.getElementById(x);
    els.lobby = id('ms-lobby');
    els.cardsGrid = id('ms-cards-grid');
    els.emptyMsg = id('ms-empty-msg');
    els.setupBanner = id('ms-setup-banner');
    els.btnReload = id('ms-btn-reload');
    els.sceneRoot = id('ms-scene-root');
    els.sceneExit = id('ms-scene-exit');
    els.deskHint = id('ms-desk-hint');
    els.keyboardBtn = id('ms-keyboard-btn');
    els.fanusBtn = id('ms-fanus-btn');
    els.examWorkspace = id('workspace-screen');
    els.examExit = id('close-workspace-btn');
    els.countdownOverlay = id('countdown-overlay');
    els.countdownNumber = id('countdown-number');
    els.examContent = id('workspace-content');
    els.textDisplayCard = id('text-display-card');
    els.examText = id('text-content');
    els.examInput = id('user-input');
    els.kbTimer = id('timer-display');
    els.oralOverlay = id('ms-oral-overlay');
    els.oralClose = id('ms-oral-close');
    els.oralTitle = id('ms-oral-title');
    els.oralMeta = id('ms-oral-meta');
    els.oralQuestion = id('ms-oral-question');
    els.oralOptions = id('ms-oral-options');
    els.oralNext = id('ms-oral-next');
    els.resultModal = id('ms-result-modal');
    els.resultTitle = id('ms-result-title');
    els.resultBadge = id('ms-result-badge');
    els.resultMessage = id('ms-result-message');
    els.resultIconWrap = id('ms-result-icon-wrap');
    els.resultIconI = id('ms-result-icon-i');
    els.resKbCorrect = id('ms-res-kb-correct');
    els.resKbTarget = id('ms-res-kb-target');
    els.resKbStatus = id('ms-res-kb-status');
    els.resOralBlock = id('ms-res-oral-block');
    els.resOralCorrect = id('ms-res-oral-correct');
    els.resOralTotal = id('ms-res-oral-total');
    els.resOralStatus = id('ms-res-oral-status');
    els.resultBack = id('ms-result-back');
    els.resultRetry = id('ms-result-retry');
    els.historyList = id('ms-history-list');
}

async function init() {
    cacheElements();
    bindEvents();
    setPhasePills('idle');
    if (!getStoredVerifiedUser()) return;
    await Promise.all([loadSimulations(), loadAttempts()]);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
