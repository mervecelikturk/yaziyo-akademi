/**
 * YAZİYO — Admin Sözlü Mülakat (soru bankası)
 * Kullanıcı sayfasında sabit 5/10 kartlar vardır; admin yalnızca soru ekler.
 */
import { requireAdminAccess } from './lib/adminAuth.js';
import { refreshAdminMobileTables } from './lib/adminTableMobile.js';
import {
    SORU_KATEGORILERI,
    getCategoryLabel,
    fetchAllSorularAdmin,
    upsertSoru,
    deleteSoru,
    isTableMissingError
} from './lib/sozluMulakatApi.js';

let questions = [];
let editingQuestionId = null;
let deleteTarget = null;

let questionSearch = '';
let questionCatFilter = 'all';
let questionStatusFilter = 'all';

const els = {};
const MAX_OPTIONS = 5;
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}

function linesToArray(text) {
    return (text || '').split('\n').map((s) => s.trim()).filter(Boolean);
}

function arrayToLines(arr) {
    return (arr || []).join('\n');
}

function showToast(message, type = 'success') {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.className = `fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-xl font-inter text-sm font-semibold shadow-2xl ${type === 'error' ? 'bg-red-500 text-white' : 'bg-yaziyo-gold text-slate-900'}`;
    els.toast.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => els.toast.classList.add('hidden'), 3200);
}

function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('hidden');
    modalEl.classList.add('flex');
    requestAnimationFrame(() => {
        modalEl.querySelector('[data-backdrop]')?.classList.remove('opacity-0');
        modalEl.querySelector('[data-panel]')?.classList.remove('opacity-0', 'scale-95');
        modalEl.querySelector('[data-panel]')?.classList.add('opacity-100', 'scale-100');
    });
}

function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.querySelector('[data-backdrop]')?.classList.add('opacity-0');
    const panel = modalEl.querySelector('[data-panel]');
    panel?.classList.remove('opacity-100', 'scale-100');
    panel?.classList.add('opacity-0', 'scale-95');
    setTimeout(() => {
        modalEl.classList.remove('flex');
        modalEl.classList.add('hidden');
    }, 280);
}

function populateSelects() {
    const catOpts = SORU_KATEGORILERI.map((c) =>
        `<option value="${c.id}">${escapeHtml(c.label)}</option>`).join('');
    if (els.fieldCategory) els.fieldCategory.innerHTML = catOpts;
    if (els.catFilter) {
        els.catFilter.innerHTML = `<option value="all">Tüm Kategoriler</option>${SORU_KATEGORILERI.map((c) =>
            `<option value="${c.id}">${escapeHtml(c.label)}</option>`).join('')}`;
    }
}

function normalizeOptionsForSelect(options) {
    const list = Array.isArray(options) ? options.map(String) : linesToArray(String(options || ''));
    while (list.length < MAX_OPTIONS) list.push('');
    return list.slice(0, MAX_OPTIONS);
}

function refreshCorrectSelect(options) {
    if (!els.fieldCorrect) return;
    const previous = els.fieldCorrect.value;
    const normalized = normalizeOptionsForSelect(options);
    els.fieldCorrect.innerHTML = normalized.map((opt, i) => {
        const label = (opt || '').trim();
        const preview = label
            ? `${escapeHtml(label.slice(0, 60))}${label.length > 60 ? '…' : ''}`
            : `Şık ${OPTION_LETTERS[i]}`;
        return `<option value="${i}">${OPTION_LETTERS[i]}) ${preview}</option>`;
    }).join('');
    if (previous !== '' && Number(previous) < MAX_OPTIONS) {
        els.fieldCorrect.value = previous;
    }
}

function filterQuestions() {
    let list = [...questions];
    const q = questionSearch.toLowerCase().trim();
    if (q) {
        list = list.filter((item) =>
            `${item.question} ${item.explanation} ${getCategoryLabel(item.category)}`.toLowerCase().includes(q));
    }
    if (questionCatFilter !== 'all') list = list.filter((item) => item.category === questionCatFilter);
    if (questionStatusFilter === 'active') list = list.filter((item) => item.active);
    else if (questionStatusFilter === 'draft') list = list.filter((item) => !item.active);
    return list;
}

function updateQuestionStats() {
    if (els.statTotalQ) els.statTotalQ.textContent = String(questions.length);
    if (els.statActiveQ) els.statActiveQ.textContent = String(questions.filter((q) => q.active).length);
    if (els.statDraftQ) els.statDraftQ.textContent = String(questions.filter((q) => !q.active).length);
    if (els.statFiveQ) {
        els.statFiveQ.textContent = String(questions.filter((q) => (q.options || []).length === 5).length);
    }
}

function showQuestionSetupRequired() {
    els.questionTbody.innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center">
        <p class="text-sm text-light-text-secondary mb-2">Soru tablosu kurulmamış.</p>
        <code class="text-yaziyo-gold text-xs">024_sozlu_mulakat.sql</code>
    </td></tr>`;
}

function renderQuestionTable() {
    const list = filterQuestions();
    if (!list.length) {
        els.questionTbody.innerHTML = `<tr><td colspan="5" class="px-6 py-16 text-center text-sm text-light-text-secondary">${questions.length ? 'Filtreye uygun soru yok.' : 'Henüz soru eklenmedi.'}</td></tr>`;
        refreshAdminMobileTables();
        return;
    }

    els.questionTbody.innerHTML = list.map((q) => `
        <tr class="hover:bg-light-bg/40 dark:hover:bg-dark-bg/40">
            <td class="px-6 py-4">
                <p class="font-poppins font-bold text-sm line-clamp-2">${escapeHtml(q.question)}</p>
            </td>
            <td class="px-6 py-4 text-sm">${escapeHtml(getCategoryLabel(q.category))}</td>
            <td class="px-6 py-4 text-sm text-center">${(q.options || []).length}</td>
            <td class="px-6 py-4"><span class="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${q.active ? 'bg-green-500/15 text-green-500' : 'bg-slate-500/15 text-slate-400'}">${q.active ? 'Yayında' : 'Taslak'}</span></td>
            <td class="px-6 py-4 text-right">
                <div class="inline-flex gap-2">
                    <button type="button" class="w-8 h-8 rounded-lg border hover:border-yaziyo-gold" data-edit-question="${q.id}"><i class="fa-solid fa-pen text-xs"></i></button>
                    <button type="button" class="w-8 h-8 rounded-lg border border-red-500/30 text-red-500" data-delete-question="${q.id}"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>
            </td>
        </tr>`).join('');
    refreshAdminMobileTables();
}

function resetQuestionForm() {
    editingQuestionId = null;
    els.questionForm?.reset();
    els.fieldCategory.value = 'genel';
    els.fieldActive.checked = true;
    els.fieldSort.value = '0';
    els.questionModalTitle.textContent = 'Yeni Soru';
    refreshCorrectSelect(['', '', '', '', '']);
    els.fieldCorrect.value = '0';
}

function fillQuestionForm(q) {
    editingQuestionId = q.id;
    els.questionModalTitle.textContent = 'Soruyu Düzenle';
    els.fieldCategory.value = q.category;
    els.fieldQuestion.value = q.question;
    els.fieldOptions.value = arrayToLines(q.options);
    els.fieldExplanation.value = q.explanation;
    els.fieldActive.checked = !!q.active;
    els.fieldSort.value = String(q.sortOrder || 0);
    refreshCorrectSelect(q.options);
    els.fieldCorrect.value = String(q.correctIndex ?? 0);
}

async function loadQuestions() {
    els.questionTbody.innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-sm"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Yükleniyor...</td></tr>`;
    const { data, error } = await fetchAllSorularAdmin();
    if (error) {
        if (isTableMissingError(error)) showQuestionSetupRequired();
        else showToast(error.message || 'Sorular yüklenemedi', 'error');
        return false;
    }
    questions = data || [];
    updateQuestionStats();
    renderQuestionTable();
    return true;
}

function bindEvents() {
    els.btnRefreshAll?.addEventListener('click', loadQuestions);

    els.btnAddQuestion?.addEventListener('click', () => {
        resetQuestionForm();
        openModal(els.questionModal);
    });

    els.search?.addEventListener('input', (e) => {
        questionSearch = e.target.value;
        renderQuestionTable();
    });

    els.catFilter?.addEventListener('change', (e) => {
        questionCatFilter = e.target.value;
        renderQuestionTable();
    });

    els.statusFilter?.addEventListener('change', (e) => {
        questionStatusFilter = e.target.value;
        renderQuestionTable();
    });

    els.fieldOptions?.addEventListener('input', (e) => {
        refreshCorrectSelect(linesToArray(e.target.value));
    });

    els.questionForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const options = linesToArray(els.fieldOptions.value);
        if (options.length !== 5) {
            showToast('Tam 5 şık girmelisiniz', 'error');
            return;
        }
        const payload = {
            id: editingQuestionId || undefined,
            category: els.fieldCategory.value,
            question: els.fieldQuestion.value,
            options,
            correctIndex: els.fieldCorrect.value,
            explanation: els.fieldExplanation.value,
            active: els.fieldActive.checked,
            sortOrder: els.fieldSort.value
        };
        els.btnSaveQuestion.disabled = true;
        const { data, error } = await upsertSoru(payload);
        els.btnSaveQuestion.disabled = false;
        if (error) {
            showToast(error.message || 'Kayıt başarısız', 'error');
            return;
        }
        closeModal(els.questionModal);
        showToast(editingQuestionId ? 'Soru güncellendi' : 'Soru eklendi');
        if (editingQuestionId) questions = questions.map((q) => (q.id === data.id ? data : q));
        else questions.unshift(data);
        updateQuestionStats();
        renderQuestionTable();
        resetQuestionForm();
    });

    els.questionTbody?.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-edit-question]');
        const delBtn = e.target.closest('[data-delete-question]');
        if (editBtn) {
            const q = questions.find((x) => x.id === editBtn.dataset.editQuestion);
            if (q) { fillQuestionForm(q); openModal(els.questionModal); }
            return;
        }
        if (delBtn) {
            const q = questions.find((x) => x.id === delBtn.dataset.deleteQuestion);
            if (!q) return;
            deleteTarget = q;
            els.deleteModalTitle.textContent = 'Soruyu Sil';
            els.deleteMessage.textContent = `Bu soruyu silmek istediğinize emin misiniz?\n"${q.question.slice(0, 80)}…"`;
            openModal(els.deleteModal);
        }
    });

    els.btnConfirmDelete?.addEventListener('click', async () => {
        if (!deleteTarget) return;
        els.btnConfirmDelete.disabled = true;
        const { error } = await deleteSoru(deleteTarget.id);
        els.btnConfirmDelete.disabled = false;
        if (error) {
            showToast(error.message || 'Silme başarısız', 'error');
            return;
        }
        questions = questions.filter((q) => q.id !== deleteTarget.id);
        deleteTarget = null;
        closeModal(els.deleteModal);
        showToast('Silindi');
        updateQuestionStats();
        renderQuestionTable();
    });

    document.querySelectorAll('[data-close-question-modal]').forEach((btn) => {
        btn.addEventListener('click', () => closeModal(els.questionModal));
    });
    document.querySelectorAll('[data-close-delete-modal]').forEach((btn) => {
        btn.addEventListener('click', () => closeModal(els.deleteModal));
    });
}

function cacheElements() {
    els.questionTbody = document.getElementById('questions-admin-tbody');
    els.btnRefreshAll = document.getElementById('btn-refresh-all');
    els.search = document.getElementById('question-search');
    els.catFilter = document.getElementById('question-cat-filter');
    els.statusFilter = document.getElementById('question-status-filter');
    els.btnAddQuestion = document.getElementById('btn-add-question');
    els.questionModal = document.getElementById('question-modal');
    els.questionForm = document.getElementById('question-form');
    els.questionModalTitle = document.getElementById('question-modal-title');
    els.fieldCategory = document.getElementById('field-category');
    els.fieldQuestion = document.getElementById('field-question');
    els.fieldOptions = document.getElementById('field-options');
    els.fieldCorrect = document.getElementById('field-correct');
    els.fieldExplanation = document.getElementById('field-explanation');
    els.fieldActive = document.getElementById('field-active');
    els.fieldSort = document.getElementById('field-sort');
    els.btnSaveQuestion = document.getElementById('btn-save-question');
    els.statTotalQ = document.getElementById('stat-total-questions');
    els.statActiveQ = document.getElementById('stat-active-questions');
    els.statDraftQ = document.getElementById('stat-draft-questions');
    els.statFiveQ = document.getElementById('stat-five-options');
    els.deleteModal = document.getElementById('delete-modal');
    els.deleteModalTitle = document.getElementById('delete-modal-title');
    els.deleteMessage = document.getElementById('delete-message');
    els.btnConfirmDelete = document.getElementById('btn-confirm-delete');
    els.toast = document.getElementById('admin-toast');
}

async function init() {
    if (!(await requireAdminAccess())) return;
    cacheElements();
    populateSelects();
    bindEvents();
    resetQuestionForm();
    await loadQuestions();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
