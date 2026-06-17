/**
 * YAZİYO — Sözlü Mülakat (kart listesi + 5 soruluk test, kayıt yok)
 */
import {
    fetchPublishedPaketler,
    getSoruKaynagiLabel,
    MULAKAT_SORU_SAYISI,
    MULAKAT_MIN_DOGRU,
    isPaketTableMissingError
} from './lib/sozluMulakatApi.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const CARD_TONE_COUNT = 8;

const state = {
    paketler: [],
    selected: null,
    questionIndex: 0,
    answers: [],
    correctCount: 0,
    countdownTimer: null,
    audioCtx: null,
    escHandler: null
};

const els = {};

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

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}

function shuffleQuestions(questions) {
    return [...questions].sort(() => Math.random() - 0.5);
}

function renderCards() {
    if (!els.cardsGrid) return;

    if (!state.paketler.length) {
        els.cardsGrid.innerHTML = '';
        els.emptyMsg?.classList.remove('hidden');
        return;
    }

    els.emptyMsg?.classList.add('hidden');
    els.cardsGrid.innerHTML = state.paketler.map((p, i) => `
        <article class="sm-mulakat-card sm-mulakat-card-tone-${i % CARD_TONE_COUNT}" role="listitem">
            <p class="sm-card-label">Mülakat</p>
            <h2 class="sm-card-title">${escapeHtml(p.title)}</h2>
            <p class="sm-card-topic">${escapeHtml(p.topic || '—')}</p>
            <span class="sm-card-source"><i class="fa-solid fa-book-open"></i> ${escapeHtml(getSoruKaynagiLabel(p.sourceType))}</span>
            <button type="button" class="sm-card-start" data-start="${p.id}">
                <i class="fa-solid fa-play"></i> Başla
            </button>
        </article>
    `).join('');

    els.cardsGrid.querySelectorAll('[data-start]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const paket = state.paketler.find((x) => x.id === btn.dataset.start);
            if (paket) startMulakat(paket);
        });
    });
}

function bindExamEsc() {
    if (state.escHandler) return;
    state.escHandler = (e) => {
        if (e.key !== 'Escape') return;
        if (els.examRoot?.classList.contains('hidden')) return;
        e.preventDefault();
        exitExam();
    };
    document.addEventListener('keydown', state.escHandler);
}

function unbindExamEsc() {
    if (!state.escHandler) return;
    document.removeEventListener('keydown', state.escHandler);
    state.escHandler = null;
}

function openExamRoot() {
    document.documentElement.classList.add('sm-exam-open');
    els.examRoot?.classList.remove('hidden');
    els.examRoot?.setAttribute('aria-hidden', 'false');
    bindExamEsc();
}

function closeExamRoot() {
    document.documentElement.classList.remove('sm-exam-open');
    els.examRoot?.classList.add('hidden');
    els.examRoot?.setAttribute('aria-hidden', 'true');
    unbindExamEsc();
    clearCountdown();
    hideAllExamPanels();
    state.selected = null;
}

function exitExam() {
    closeExamRoot();
}

function hideAllExamPanels() {
    els.countdown?.classList.add('hidden');
    els.quizPanel?.classList.add('hidden');
    els.resultPanel?.classList.add('hidden');
}

function clearCountdown() {
    if (state.countdownTimer) {
        clearInterval(state.countdownTimer);
        state.countdownTimer = null;
    }
}

function startMulakat(paket) {
    const questions = shuffleQuestions(paket.questions || []);
    if (questions.length < MULAKAT_SORU_SAYISI) return;

    state.selected = { ...paket, questions: questions.slice(0, MULAKAT_SORU_SAYISI) };
    state.questionIndex = 0;
    state.answers = [];
    state.correctCount = 0;

    ensureAudioCtx();
    openExamRoot();
    hideAllExamPanels();
    els.countdown?.classList.remove('hidden');
    if (els.countdownNum) {
        els.countdownNum.textContent = '3';
        els.countdownNum.style.color = '';
    }
    playCountdownSound('tick');

    let count = 3;
    state.countdownTimer = setInterval(() => {
        count -= 1;
        if (count > 0) {
            if (els.countdownNum) els.countdownNum.textContent = String(count);
            playCountdownSound('tick');
        } else if (count === 0) {
            if (els.countdownNum) {
                els.countdownNum.textContent = 'BAŞLA!';
                els.countdownNum.style.color = 'rgb(var(--yaziyo-green-rgb))';
            }
            playCountdownSound('start');
        } else {
            clearCountdown();
            if (els.countdownNum) els.countdownNum.style.color = '';
            els.countdown?.classList.add('hidden');
            showQuestion();
        }
    }, 1000);
}

function showQuestion() {
    const q = state.selected?.questions?.[state.questionIndex];
    if (!q) {
        showResult();
        return;
    }

    els.quizPanel?.classList.remove('hidden');
    els.resultPanel?.classList.add('hidden');
    els.quizNext?.classList.add('hidden');

    if (els.quizProgress) {
        els.quizProgress.textContent = `Soru ${state.questionIndex + 1} / ${MULAKAT_SORU_SAYISI}`;
    }
    if (els.quizQuestion) els.quizQuestion.textContent = q.question;

    if (els.quizOptions) {
        els.quizOptions.innerHTML = q.options.map((opt, i) => `
            <button type="button" class="sm-quiz-option" data-idx="${i}">
                <span class="sm-quiz-option-letter">${LETTERS[i]}</span>
                <span>${escapeHtml(opt)}</span>
            </button>
        `).join('');

        els.quizOptions.querySelectorAll('[data-idx]').forEach((btn) => {
            btn.addEventListener('click', () => answerQuestion(parseInt(btn.dataset.idx, 10)));
        });
    }
}

function answerQuestion(selectedIndex) {
    const q = state.selected?.questions?.[state.questionIndex];
    if (!q || state.answers[state.questionIndex] !== undefined) return;

    const isCorrect = selectedIndex === q.correctIndex;
    state.answers[state.questionIndex] = { selectedIndex, isCorrect };
    if (isCorrect) state.correctCount += 1;

    els.quizOptions?.querySelectorAll('[data-idx]').forEach((btn) => {
        const idx = parseInt(btn.dataset.idx, 10);
        btn.disabled = true;
        if (idx === q.correctIndex) btn.classList.add('correct');
        else if (idx === selectedIndex) btn.classList.add('wrong');
    });

    if (els.quizNext) {
        els.quizNext.classList.remove('hidden');
        els.quizNext.textContent = state.questionIndex >= MULAKAT_SORU_SAYISI - 1
            ? 'Sonucu Gör'
            : 'Sonraki Soru';
    }
}

function nextQuestion() {
    if (state.answers[state.questionIndex] === undefined) return;
    state.questionIndex += 1;
    if (state.questionIndex >= MULAKAT_SORU_SAYISI) {
        showResult();
        return;
    }
    showQuestion();
}

function showResult() {
    els.quizPanel?.classList.add('hidden');
    els.resultPanel?.classList.remove('hidden');

    const passed = state.correctCount >= MULAKAT_MIN_DOGRU;

    if (els.resultBadge) {
        els.resultBadge.className = `sm-result-badge ${passed ? 'success' : 'fail'}`;
        els.resultBadge.textContent = passed ? 'Mülakat Başarılı' : 'Mülakat Başarısız';
    }
    if (els.resultSummary) {
        els.resultSummary.textContent = `${state.correctCount} / ${MULAKAT_SORU_SAYISI} doğru cevap · Geçmek için en az ${MULAKAT_MIN_DOGRU} doğru gerekir`;
    }

    if (els.resultAnswers) {
        els.resultAnswers.innerHTML = state.selected.questions.map((q, i) => {
            const ans = state.answers[i];
            const correctLetter = LETTERS[q.correctIndex];
            const correctText = q.options[q.correctIndex];
            const userLetter = ans ? LETTERS[ans.selectedIndex] : '—';
            const userText = ans ? q.options[ans.selectedIndex] : '—';

            return `
                <div class="sm-result-item">
                    <p class="sm-result-item-num">Soru ${i + 1}</p>
                    <p class="sm-result-item-q">${escapeHtml(q.question)}</p>
                    ${ans?.isCorrect
                        ? `<p class="sm-result-item-ok"><i class="fa-solid fa-circle-check"></i> Doğru: ${escapeHtml(correctLetter)}) ${escapeHtml(correctText)}</p>`
                        : `<p class="sm-result-item-bad"><i class="fa-solid fa-circle-xmark"></i> Sizin cevabınız: ${escapeHtml(userLetter)}) ${escapeHtml(userText)}</p>
                           <p class="sm-result-item-ok">Doğru cevap: ${escapeHtml(correctLetter)}) ${escapeHtml(correctText)}</p>`}
                </div>`;
        }).join('');
    }
}

function retryMulakat() {
    if (state.selected) startMulakat(state.selected);
}

function backToCards() {
    closeExamRoot();
}

async function loadPaketler() {
    const { data, error } = await fetchPublishedPaketler();
    if (error) {
        console.error('Mülakat paketleri yüklenemedi:', error);
        state.paketler = [];
        if (isPaketTableMissingError(error)) {
            els.loadBanner?.classList.remove('hidden');
        }
        renderCards();
        return;
    }

    els.loadBanner?.classList.add('hidden');
    state.paketler = data || [];
    renderCards();
}

function bindEvents() {
    els.quizNext?.addEventListener('click', nextQuestion);
    els.btnRetry?.addEventListener('click', retryMulakat);
    els.btnBack?.addEventListener('click', backToCards);
    els.btnReload?.addEventListener('click', () => loadPaketler());
    els.examExit?.addEventListener('click', exitExam);
}

function cacheElements() {
    els.cardsGrid = document.getElementById('sm-cards-grid');
    els.emptyMsg = document.getElementById('sm-empty-msg');
    els.loadBanner = document.getElementById('sm-setup-banner');
    els.btnReload = document.getElementById('sm-btn-reload');
    els.examRoot = document.getElementById('sm-exam-root');
    els.examExit = document.getElementById('sm-exam-exit');
    els.countdown = document.getElementById('sm-countdown');
    els.countdownNum = document.getElementById('sm-countdown-num');
    els.quizPanel = document.getElementById('sm-quiz-panel');
    els.quizProgress = document.getElementById('sm-quiz-progress');
    els.quizQuestion = document.getElementById('sm-quiz-question');
    els.quizOptions = document.getElementById('sm-quiz-options');
    els.quizNext = document.getElementById('sm-quiz-next');
    els.resultPanel = document.getElementById('sm-result-panel');
    els.resultBadge = document.getElementById('sm-result-badge');
    els.resultSummary = document.getElementById('sm-result-summary');
    els.resultAnswers = document.getElementById('sm-result-answers');
    els.btnRetry = document.getElementById('sm-btn-retry');
    els.btnBack = document.getElementById('sm-btn-back');
}

async function init() {
    if (document.getElementById('mulakat-content')?.dataset.initialized) return;
    cacheElements();
    bindEvents();
    await loadPaketler();
    document.getElementById('mulakat-content').dataset.initialized = '1';
}

function tryInit() {
    if (document.documentElement.classList.contains('is-logged-in')) {
        init();
    }
}

function boot() {
    cacheElements();
    tryInit();
    const obs = new MutationObserver(tryInit);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
