/**
 * YAZİYO — Admin Sözlü Mülakat (paketler + soru bankası)
 */
import { requireAdminAccess } from './lib/adminAuth.js';
import { refreshAdminMobileTables } from './lib/adminTableMobile.js';
import {
    SORU_KATEGORILERI,
    SORU_KAYNAKLARI,
    MULAKAT_SORU_SAYISI,
    getCategoryLabel,
    getSoruKaynagiLabel,
    fetchAllSorularAdmin,
    fetchAllPaketlerAdmin,
    upsertSoru,
    upsertPaket,
    deleteSoru,
    deletePaket,
    isTableMissingError,
    isPaketTableMissingError
} from './lib/sozluMulakatApi.js';

let questions = [];
let paketler = [];
let editingQuestionId = null;
let editingPaketId = null;
let deleteTarget = null;
let deleteType = null;
let activeTab = 'paketler';
let selectedQuestionIds = new Set();

let questionSearch = '';
let questionCatFilter = 'all';
let questionStatusFilter = 'all';
let paketSearch = '';
let paketQuestionSearch = '';

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

function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('[data-tab]').forEach((btn) => {
        btn.classList.toggle('admin-tab-active', btn.dataset.tab === tab);
    });
    els.panelPaket?.classList.toggle('hidden', tab !== 'paketler');
    els.panelSorular?.classList.toggle('hidden', tab !== 'sorular');
}

function populateSelects() {
    const catOpts = SORU_KATEGORILERI.map((c) =>
        `<option value="${c.id}">${escapeHtml(c.label)}</option>`).join('');
    if (els.fieldCategory) els.fieldCategory.innerHTML = catOpts;
    if (els.catFilter) {
        els.catFilter.innerHTML = `<option value="all">Tüm Kategoriler</option>${SORU_KATEGORILERI.map((c) =>
            `<option value="${c.id}">${escapeHtml(c.label)}</option>`).join('')}`;
    }
    if (els.fieldPaketSource) {
        els.fieldPaketSource.innerHTML = SORU_KAYNAKLARI.map((k) =>
            `<option value="${k.id}">${escapeHtml(k.label)}</option>`).join('');
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

function activeQuestionPool() {
    return questions.filter((q) => q.active && (q.options || []).length >= 5);
}

function renderQuestionPicker() {
    if (!els.paketQuestionPicker) return;
    const q = paketQuestionSearch.toLowerCase().trim();
    let list = activeQuestionPool();
    if (q) {
        list = list.filter((item) =>
            `${item.question} ${getCategoryLabel(item.category)}`.toLowerCase().includes(q));
    }

    if (!list.length) {
        els.paketQuestionPicker.innerHTML = `<p class="text-sm text-light-text-secondary py-4 text-center">Yayında ve 5 şıklı soru yok. Önce Soru Bankası sekmesinden soru ekleyin.</p>`;
        if (els.paketSelectedCount) els.paketSelectedCount.textContent = String(selectedQuestionIds.size);
        return;
    }

    els.paketQuestionPicker.innerHTML = list.map((item) => {
        const checked = selectedQuestionIds.has(item.id) ? 'checked' : '';
        const disabled = !selectedQuestionIds.has(item.id) && selectedQuestionIds.size >= MULAKAT_SORU_SAYISI ? 'disabled' : '';
        return `
            <label class="flex items-start gap-3 p-3 rounded-xl border border-light-border dark:border-dark-border hover:border-yaziyo-gold/40 cursor-pointer ${disabled ? 'opacity-50' : ''}">
                <input type="checkbox" class="mt-1 rounded text-yaziyo-gold" data-qid="${item.id}" ${checked} ${disabled} />
                <span class="text-sm">
                    <span class="text-[10px] font-bold uppercase text-yaziyo-gold">${escapeHtml(getCategoryLabel(item.category))}</span>
                    <span class="block mt-0.5">${escapeHtml(item.question.slice(0, 120))}${item.question.length > 120 ? '…' : ''}</span>
                </span>
            </label>`;
    }).join('');

    els.paketQuestionPicker.querySelectorAll('[data-qid]').forEach((input) => {
        input.addEventListener('change', () => {
            const id = input.dataset.qid;
            if (input.checked) {
                if (selectedQuestionIds.size >= MULAKAT_SORU_SAYISI) {
                    input.checked = false;
                    showToast(`En fazla ${MULAKAT_SORU_SAYISI} soru seçilebilir`, 'error');
                    return;
                }
                selectedQuestionIds.add(id);
            } else {
                selectedQuestionIds.delete(id);
            }
            if (els.paketSelectedCount) els.paketSelectedCount.textContent = String(selectedQuestionIds.size);
            renderQuestionPicker();
        });
    });

    if (els.paketSelectedCount) els.paketSelectedCount.textContent = String(selectedQuestionIds.size);
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

function filterPaketler() {
    let list = [...paketler];
    const q = paketSearch.toLowerCase().trim();
    if (q) {
        list = list.filter((p) =>
            `${p.title} ${p.topic} ${getSoruKaynagiLabel(p.sourceType)}`.toLowerCase().includes(q));
    }
    return list;
}

function updateQuestionStats() {
    if (els.statTotalQ) els.statTotalQ.textContent = String(questions.length);
    if (els.statActiveQ) els.statActiveQ.textContent = String(questions.filter((q) => q.active).length);
    if (els.statDraftQ) els.statDraftQ.textContent = String(questions.filter((q) => !q.active).length);
    if (els.statFiveQ) {
        els.statFiveQ.textContent = String(questions.filter((q) => (q.options || []).length === 5).length);
    }
    if (els.statPoolQ) els.statPoolQ.textContent = String(activeQuestionPool().length);
}

function updatePaketStats() {
    if (els.statTotalP) els.statTotalP.textContent = String(paketler.length);
    if (els.statActiveP) els.statActiveP.textContent = String(paketler.filter((p) => p.active).length);
    if (els.statReadyP) {
        els.statReadyP.textContent = String(paketler.filter((p) => p.questionIds.length === MULAKAT_SORU_SAYISI).length);
    }
    updateQuestionStats();
}

function showPaketSetupRequired() {
    els.paketTbody.innerHTML = `<tr><td colspan="6" class="px-6 py-12 text-center">
        <p class="text-sm text-light-text-secondary mb-2">Mülakat paketleri tablosu kurulmamış.</p>
        <code class="text-yaziyo-gold text-xs">031_sozlu_mulakat_paketleri.sql</code>
    </td></tr>`;
}

function showQuestionSetupRequired() {
    els.questionTbody.innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center">
        <p class="text-sm text-light-text-secondary mb-2">Soru tablosu kurulmamış.</p>
        <code class="text-yaziyo-gold text-xs">024_sozlu_mulakat.sql</code>
    </td></tr>`;
}

function renderPaketTable() {
    const list = filterPaketler();
    if (!list.length) {
        els.paketTbody.innerHTML = `<tr><td colspan="6" class="px-6 py-16 text-center text-sm text-light-text-secondary">${paketler.length ? 'Arama sonucu yok.' : 'Henüz mülakat eklenmedi.'}</td></tr>`;
        refreshAdminMobileTables();
        return;
    }

    els.paketTbody.innerHTML = list.map((p) => `
        <tr class="hover:bg-light-bg/40 dark:hover:bg-dark-bg/40">
            <td class="px-6 py-4 font-poppins font-bold text-sm">${escapeHtml(p.title)}</td>
            <td class="px-6 py-4 text-sm text-light-text-secondary max-w-[200px] line-clamp-2">${escapeHtml(p.topic)}</td>
            <td class="px-6 py-4 text-xs whitespace-nowrap">${escapeHtml(getSoruKaynagiLabel(p.sourceType))}</td>
            <td class="px-6 py-4 text-sm text-center">${p.questionIds.length}/${MULAKAT_SORU_SAYISI}</td>
            <td class="px-6 py-4"><span class="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${p.active ? 'bg-green-500/15 text-green-500' : 'bg-slate-500/15 text-slate-400'}">${p.active ? 'Yayında' : 'Taslak'}</span></td>
            <td class="px-6 py-4 text-right">
                <div class="inline-flex gap-2">
                    <button type="button" class="w-8 h-8 rounded-lg border hover:border-yaziyo-gold" data-edit-paket="${p.id}"><i class="fa-solid fa-pen text-xs"></i></button>
                    <button type="button" class="w-8 h-8 rounded-lg border border-red-500/30 text-red-500" data-delete-paket="${p.id}"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>
            </td>
        </tr>`).join('');
    refreshAdminMobileTables();
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

function resetPaketForm() {
    editingPaketId = null;
    selectedQuestionIds = new Set();
    els.paketForm?.reset();
    els.fieldPaketActive.checked = true;
    els.fieldPaketSort.value = '0';
    els.fieldPaketSource.value = 'cikmis';
    els.paketModalTitle.textContent = 'Yeni Mülakat';
    renderQuestionPicker();
}

function fillPaketForm(p) {
    editingPaketId = p.id;
    els.paketModalTitle.textContent = 'Mülakatı Düzenle';
    els.fieldPaketTitle.value = p.title;
    els.fieldPaketTopic.value = p.topic;
    els.fieldPaketSource.value = p.sourceType;
    els.fieldPaketActive.checked = !!p.active;
    els.fieldPaketSort.value = String(p.sortOrder || 0);
    selectedQuestionIds = new Set(p.questionIds || []);
    renderQuestionPicker();
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
    const { data, error } = await fetchAllSorularAdmin();
    if (error) {
        if (isTableMissingError(error)) showQuestionSetupRequired();
        else showToast(error.message || 'Sorular yüklenemedi', 'error');
        return false;
    }
    questions = data || [];
    renderQuestionTable();
    return true;
}

async function loadPaketler() {
    els.paketTbody.innerHTML = `<tr><td colspan="6" class="px-6 py-12 text-center text-sm"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Yükleniyor...</td></tr>`;
    const { data, error } = await fetchAllPaketlerAdmin();
    if (error) {
        if (isPaketTableMissingError(error)) showPaketSetupRequired();
        else showToast(error.message || 'Mülakatlar yüklenemedi', 'error');
        return false;
    }
    paketler = data || [];
    renderPaketTable();
    return true;
}

async function loadAll() {
    await loadQuestions();
    await loadPaketler();
    updatePaketStats();
}

function bindEvents() {
    document.querySelectorAll('[data-tab]').forEach((btn) => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    els.btnRefreshAll?.addEventListener('click', loadAll);

    els.paketSearch?.addEventListener('input', (e) => {
        paketSearch = e.target.value;
        renderPaketTable();
    });

    els.paketQuestionSearch?.addEventListener('input', (e) => {
        paketQuestionSearch = e.target.value;
        renderQuestionPicker();
    });

    els.btnAddPaket?.addEventListener('click', () => {
        resetPaketForm();
        openModal(els.paketModal);
    });

    els.paketForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            id: editingPaketId || undefined,
            title: els.fieldPaketTitle.value,
            topic: els.fieldPaketTopic.value,
            sourceType: els.fieldPaketSource.value,
            questionIds: [...selectedQuestionIds],
            active: els.fieldPaketActive.checked,
            sortOrder: els.fieldPaketSort.value
        };
        els.btnSavePaket.disabled = true;
        const { data, error } = await upsertPaket(payload);
        els.btnSavePaket.disabled = false;
        if (error) {
            showToast(error.message || 'Kayıt başarısız', 'error');
            return;
        }
        closeModal(els.paketModal);
        showToast(editingPaketId ? 'Mülakat güncellendi' : 'Mülakat eklendi');
        if (editingPaketId) paketler = paketler.map((p) => (p.id === data.id ? data : p));
        else paketler.unshift(data);
        updatePaketStats();
        renderPaketTable();
        resetPaketForm();
    });

    els.paketTbody?.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-edit-paket]');
        const delBtn = e.target.closest('[data-delete-paket]');
        if (editBtn) {
            const p = paketler.find((x) => x.id === editBtn.dataset.editPaket);
            if (p) { fillPaketForm(p); openModal(els.paketModal); }
            return;
        }
        if (delBtn) {
            const p = paketler.find((x) => x.id === delBtn.dataset.deletePaket);
            if (!p) return;
            deleteTarget = p;
            deleteType = 'paket';
            els.deleteModalTitle.textContent = 'Mülakatı Sil';
            els.deleteMessage.textContent = `"${p.title}" mülakatını silmek istediğinize emin misiniz?`;
            openModal(els.deleteModal);
        }
    });

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
        updatePaketStats();
        renderQuestionTable();
        await loadPaketler();
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
            deleteType = 'question';
            els.deleteModalTitle.textContent = 'Soruyu Sil';
            els.deleteMessage.textContent = `Bu soruyu silmek istediğinize emin misiniz?\n"${q.question.slice(0, 80)}…"`;
            openModal(els.deleteModal);
        }
    });

    els.btnConfirmDelete?.addEventListener('click', async () => {
        if (!deleteTarget || !deleteType) return;
        els.btnConfirmDelete.disabled = true;
        let error;
        if (deleteType === 'paket') {
            ({ error } = await deletePaket(deleteTarget.id));
        } else {
            ({ error } = await deleteSoru(deleteTarget.id));
        }
        els.btnConfirmDelete.disabled = false;
        if (error) {
            showToast(error.message || 'Silme başarısız', 'error');
            return;
        }
        if (deleteType === 'paket') {
            paketler = paketler.filter((p) => p.id !== deleteTarget.id);
            renderPaketTable();
        } else {
            questions = questions.filter((q) => q.id !== deleteTarget.id);
            renderQuestionTable();
            await loadPaketler();
        }
        deleteTarget = null;
        deleteType = null;
        closeModal(els.deleteModal);
        showToast('Silindi');
        updatePaketStats();
    });

    document.querySelectorAll('[data-close-paket-modal]').forEach((btn) => {
        btn.addEventListener('click', () => closeModal(els.paketModal));
    });
    document.querySelectorAll('[data-close-question-modal]').forEach((btn) => {
        btn.addEventListener('click', () => closeModal(els.questionModal));
    });
    document.querySelectorAll('[data-close-delete-modal]').forEach((btn) => {
        btn.addEventListener('click', () => closeModal(els.deleteModal));
    });
}

function cacheElements() {
    els.panelPaket = document.getElementById('panel-paketler');
    els.panelSorular = document.getElementById('panel-sorular');
    els.paketTbody = document.getElementById('paket-admin-tbody');
    els.questionTbody = document.getElementById('questions-admin-tbody');
    els.paketSearch = document.getElementById('paket-search');
    els.btnAddPaket = document.getElementById('btn-add-paket');
    els.btnRefreshAll = document.getElementById('btn-refresh-all');
    els.paketModal = document.getElementById('paket-modal');
    els.paketForm = document.getElementById('paket-form');
    els.paketModalTitle = document.getElementById('paket-modal-title');
    els.fieldPaketTitle = document.getElementById('field-paket-title');
    els.fieldPaketTopic = document.getElementById('field-paket-topic');
    els.fieldPaketSource = document.getElementById('field-paket-source');
    els.fieldPaketSort = document.getElementById('field-paket-sort');
    els.fieldPaketActive = document.getElementById('field-paket-active');
    els.paketQuestionPicker = document.getElementById('paket-question-picker');
    els.paketQuestionSearch = document.getElementById('paket-question-search');
    els.paketSelectedCount = document.getElementById('paket-selected-count');
    els.btnSavePaket = document.getElementById('btn-save-paket');
    els.statTotalP = document.getElementById('stat-total-paket');
    els.statActiveP = document.getElementById('stat-active-paket');
    els.statReadyP = document.getElementById('stat-ready-paket');
    els.statPoolQ = document.getElementById('stat-pool-questions');
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
    resetPaketForm();
    resetQuestionForm();
    await loadAll();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
