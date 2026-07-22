/**
 * YAZİYO — Sözlü Mülakat (sabit 5/10 kart + rastgele soru, kayıt yok)
 */
import {
    fetchPublishedSorular,
    getSoruKaynagiLabel,
    MULAKAT_MODLARI,
    getMinDogru,
    getPreviousQuestionIds,
    savePreviousQuestionIds,
    pickRandomSorular,
    isTableMissingError
} from './lib/sozluMulakatApi.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const CARD_TONE_COUNT = 8;

const state = {
    pool: [],
    selected: null,
    questionCount: 5,
    minCorrect: 3,
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

function usablePool() {
    return (state.pool || []).filter((q) => q.active && (q.options || []).length >= 5);
}

function renderCards() {
    if (!els.cardsGrid) return;

    const pool = usablePool();
    const modes = MULAKAT_MODLARI.filter((m) => pool.length >= m.questionCount);

    if (!modes.length) {
        els.cardsGrid.innerHTML = '';
        els.emptyMsg?.classList.remove('hidden');
        if (els.emptyMsg) {
            els.emptyMsg.textContent = pool.length
                ? `Mülakat için en az 5 yayında soru gerekli (şu an ${pool.length}).`
                : 'Henüz yayında soru yok. Admin panelinden soru eklediğinde mülakatlar burada görünecek.';
        }
        return;
    }

    els.emptyMsg?.classList.add('hidden');
    els.cardsGrid.innerHTML = modes.map((m, i) => `
        <article class="sm-mulakat-card sm-mulakat-card-tone-${i % CARD_TONE_COUNT}" role="listitem">
            <p class="sm-card-label">Mülakat</p>
            <h2 class="sm-card-title">${escapeHtml(m.title)}</h2>
            <p class="sm-card-topic">${escapeHtml(m.topic)}</p>
            <span class="sm-card-source"><i class="fa-solid fa-book-open"></i> ${escapeHtml(getSoruKaynagiLabel(m.sourceType))}</span>
            <button type="button" class="sm-card-start" data-start="${m.id}">
                <i class="fa-solid fa-play"></i> Başla
            </button>
        </article>
    `).join('');

    els.cardsGrid.querySelectorAll('[data-start]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const mode = MULAKAT_MODLARI.find((x) => x.id === btn.dataset.start);
            if (mode) startMulakat(mode);
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

function startMulakat(mode) {
    const count = mode.questionCount;
    const previousIds = getPreviousQuestionIds(mode.id);
    const { questions, error } = pickRandomSorular(usablePool(), count, previousIds);

    if (error || !questions.length) {
        if (els.emptyMsg) {
            els.emptyMsg.classList.remove('hidden');
            els.emptyMsg.textContent = error?.message || 'Soru seçilemedi.';
        }
        return;
    }

    savePreviousQuestionIds(mode.id, questions.map((q) => q.id));

    state.selected = {
        id: mode.id,
        title: mode.title,
        topic: mode.topic,
        sourceType: mode.sourceType,
        questions
    };
    state.questionCount = count;
    state.minCorrect = mode.minCorrect ?? getMinDogru(count);
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

    let n = 3;
    state.countdownTimer = setInterval(() => {
        n -= 1;
        if (n > 0) {
            if (els.countdownNum) els.countdownNum.textContent = String(n);
            playCountdownSound('tick');
        } else if (n === 0) {
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
        els.quizProgress.textContent = `Soru ${state.questionIndex + 1} / ${state.questionCount}`;
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
        els.quizNext.textContent = state.questionIndex >= state.questionCount - 1
            ? 'Sonucu Gör'
            : 'Sonraki Soru';
    }
}

function nextQuestion() {
    if (state.answers[state.questionIndex] === undefined) return;
    state.questionIndex += 1;
    if (state.questionIndex >= state.questionCount) {
        showResult();
        return;
    }
    showQuestion();
}

function showResult() {
    els.quizPanel?.classList.add('hidden');
    els.resultPanel?.classList.remove('hidden');

    const passed = state.correctCount >= state.minCorrect;

    if (els.resultBadge) {
        els.resultBadge.className = `sm-result-badge ${passed ? 'success' : 'fail'}`;
        els.resultBadge.textContent = passed ? 'Mülakat Başarılı' : 'Mülakat Başarısız';
    }
    if (els.resultSummary) {
        els.resultSummary.textContent = `${state.correctCount} / ${state.questionCount} doğru cevap · Geçmek için en az ${state.minCorrect} doğru gerekir`;
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
    const mode = MULAKAT_MODLARI.find((m) => m.id === state.selected?.id);
    if (mode) startMulakat(mode);
}

function backToCards() {
    closeExamRoot();
}

async function loadPool() {
    const { data, error } = await fetchPublishedSorular();
    if (error) {
        console.error('Soru bankası yüklenemedi:', error);
        state.pool = [];
        if (isTableMissingError(error)) {
            els.loadBanner?.classList.remove('hidden');
        }
        renderCards();
        return;
    }

    els.loadBanner?.classList.add('hidden');
    state.pool = data || [];
    renderCards();
}

function bindEvents() {
    els.quizNext?.addEventListener('click', nextQuestion);
    els.btnRetry?.addEventListener('click', retryMulakat);
    els.btnBack?.addEventListener('click', backToCards);
    els.btnReload?.addEventListener('click', () => loadPool());
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
    await loadPool();
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
