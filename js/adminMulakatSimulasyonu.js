/**
 * YAZİYO — Admin Mülakat Simülasyon Paketleri
 */
import { requireAdminAccess } from './lib/adminAuth.js';
import { refreshAdminMobileTables } from './lib/adminTableMobile.js';
import { fetchAllSorularAdmin, getCategoryLabel } from './lib/sozluMulakatApi.js';
import {
    ORAL_QUESTION_COUNT,
    countWords,
    fetchAllSimulasyonlarAdmin,
    upsertSimulasyon,
    deleteSimulasyon,
    isTableMissingError
} from './lib/mulakatSimulasyonuApi.js';

let simulations = [];
let oralPool = [];
let editingId = null;
let deleteTarget = null;
let selectedQuestionIds = new Set();
let searchQuery = '';
let statusFilter = 'all';

const els = {};

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
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

function updateWordCountPreview() {
    const n = countWords(els.fieldKeyboard?.value || '');
    if (els.keyboardWordCount) els.keyboardWordCount.textContent = String(n);
}

function renderQuestionPicker() {
    if (!els.questionPicker) return;
    const q = (els.questionSearch?.value || '').toLowerCase().trim();
    let list = oralPool.filter((item) => item.active);
    if (q) {
        list = list.filter((item) =>
            `${item.question} ${getCategoryLabel(item.category)}`.toLowerCase().includes(q));
    }

    if (!list.length) {
        els.questionPicker.innerHTML = `<p class="text-sm text-light-text-secondary py-4 text-center">Soru bankası boş. <a href="../admin-sozlu-mulakat/" class="text-yaziyo-gold font-semibold hover:underline">Sözlü Mülakat → Soru Bankası</a>ndan soru ekleyin.</p>`;
        return;
    }

    els.questionPicker.innerHTML = list.map((item) => {
        const checked = selectedQuestionIds.has(item.id) ? 'checked' : '';
        const disabled = !selectedQuestionIds.has(item.id) && selectedQuestionIds.size >= ORAL_QUESTION_COUNT ? 'disabled' : '';
        return `
            <label class="flex items-start gap-3 p-3 rounded-xl border border-light-border dark:border-dark-border hover:border-yaziyo-gold/40 cursor-pointer ${disabled ? 'opacity-50' : ''}">
                <input type="checkbox" class="mt-1 rounded text-yaziyo-gold" data-qid="${item.id}" ${checked} ${disabled} />
                <span class="text-sm">
                    <span class="text-[10px] font-bold uppercase text-yaziyo-gold">${escapeHtml(getCategoryLabel(item.category))}</span>
                    <span class="block mt-0.5">${escapeHtml(item.question.slice(0, 120))}${item.question.length > 120 ? '…' : ''}</span>
                </span>
            </label>`;
    }).join('');

    els.questionPicker.querySelectorAll('[data-qid]').forEach((input) => {
        input.addEventListener('change', () => {
            const id = input.dataset.qid;
            if (input.checked) {
                if (selectedQuestionIds.size >= ORAL_QUESTION_COUNT) {
                    input.checked = false;
                    showToast(`En fazla ${ORAL_QUESTION_COUNT} soru seçilebilir`, 'error');
                    return;
                }
                selectedQuestionIds.add(id);
            } else {
                selectedQuestionIds.delete(id);
            }
            if (els.selectedCount) els.selectedCount.textContent = String(selectedQuestionIds.size);
            renderQuestionPicker();
        });
    });

    if (els.selectedCount) els.selectedCount.textContent = String(selectedQuestionIds.size);
}

function filterList() {
    let list = [...simulations];
    const q = searchQuery.toLowerCase().trim();
    if (q) list = list.filter((s) => `${s.title} ${s.description}`.toLowerCase().includes(q));
    if (statusFilter === 'active') list = list.filter((s) => s.active);
    else if (statusFilter === 'draft') list = list.filter((s) => !s.active);
    return list;
}

function updateStats() {
    if (els.statTotal) els.statTotal.textContent = String(simulations.length);
    if (els.statActive) els.statActive.textContent = String(simulations.filter((s) => s.active).length);
    if (els.statDraft) els.statDraft.textContent = String(simulations.filter((s) => !s.active).length);
    if (els.statReady) {
        els.statReady.textContent = String(simulations.filter((s) => s.questionIds.length === ORAL_QUESTION_COUNT).length);
    }
}

function showSetupRequired() {
    els.tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center">
        <div class="max-w-xl mx-auto bg-orange-500/5 border border-orange-500/20 rounded-2xl p-8">
            <h3 class="font-poppins font-bold mb-2">Veritabanı Kurulumu Gerekli</h3>
            <p class="text-sm text-light-text-secondary">Supabase SQL Editor'da <code class="text-yaziyo-gold">026_mulakat_simulasyonlari.sql</code> dosyasını çalıştırın.</p>
        </div></td></tr>`;
}

function renderTable() {
    const list = filterList();
    if (!list.length) {
        els.tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-16 text-center text-sm text-light-text-secondary">${simulations.length ? 'Filtreye uygun kayıt yok.' : 'Henüz simülasyon eklenmedi.'}</td></tr>`;
        refreshAdminMobileTables();
        return;
    }
    els.tbody.innerHTML = list.map((s) => `
        <tr class="hover:bg-light-bg/40 dark:hover:bg-dark-bg/40">
            <td class="px-6 py-4">
                <p class="font-poppins font-bold text-sm">${escapeHtml(s.title)}</p>
                <p class="text-xs text-light-text-secondary mt-1 line-clamp-1">${escapeHtml(s.description)}</p>
            </td>
            <td class="px-6 py-4 text-sm whitespace-nowrap">${countWords(s.keyboardText)} kelime · ${Math.round((s.keyboardDurationSec || 180) / 60)} dk</td>
            <td class="px-6 py-4 text-sm text-center">${s.questions?.length || s.questionIds.length}/${ORAL_QUESTION_COUNT}</td>
            <td class="px-6 py-4"><span class="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${s.active ? 'bg-green-500/15 text-green-500' : 'bg-slate-500/15 text-slate-400'}">${s.active ? 'Yayında' : 'Taslak'}</span></td>
            <td class="px-6 py-4 text-right">
                <div class="inline-flex gap-2">
                    <button type="button" class="w-8 h-8 rounded-lg border hover:border-yaziyo-gold" data-edit="${s.id}"><i class="fa-solid fa-pen text-xs"></i></button>
                    <button type="button" class="w-8 h-8 rounded-lg border border-red-500/30 text-red-500" data-delete="${s.id}"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>
            </td>
        </tr>`).join('');
    refreshAdminMobileTables();
}

function resetForm() {
    editingId = null;
    selectedQuestionIds = new Set();
    els.form?.reset();
    els.fieldActive.checked = true;
    els.fieldSort.value = '0';
    els.fieldDuration.value = '180';
    els.fieldMinWords.value = '90';
    els.modalTitle.textContent = 'Yeni Simülasyon';
    updateWordCountPreview();
    renderQuestionPicker();
}

function fillForm(s) {
    editingId = s.id;
    els.modalTitle.textContent = 'Simülasyonu Düzenle';
    els.fieldTitle.value = s.title;
    els.fieldDescription.value = s.description;
    els.fieldKeyboard.value = s.keyboardText;
    els.fieldDuration.value = String(s.keyboardDurationSec || 180);
    els.fieldMinWords.value = String(s.minWords || 90);
    els.fieldActive.checked = !!s.active;
    els.fieldSort.value = String(s.sortOrder || 0);
    selectedQuestionIds = new Set(s.questionIds || []);
    updateWordCountPreview();
    renderQuestionPicker();
}

async function loadOralPool() {
    const { data } = await fetchAllSorularAdmin();
    oralPool = data || [];
}

async function loadData() {
    els.tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-sm"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Yükleniyor...</td></tr>`;
    const [{ data, error }] = await Promise.all([
        fetchAllSimulasyonlarAdmin(),
        loadOralPool()
    ]);
    if (error) {
        if (isTableMissingError(error)) showSetupRequired();
        else showToast(error.message || 'Yüklenemedi', 'error');
        return;
    }
    simulations = data || [];
    updateStats();
    renderTable();
}

function readFormData() {
    return {
        id: editingId || undefined,
        title: els.fieldTitle.value,
        description: els.fieldDescription.value,
        keyboardText: els.fieldKeyboard.value,
        keyboardDurationSec: els.fieldDuration.value,
        minWords: els.fieldMinWords.value,
        questionIds: [...selectedQuestionIds],
        active: els.fieldActive.checked,
        sortOrder: els.fieldSort.value
    };
}

function bindEvents() {
    els.btnAdd?.addEventListener('click', () => { resetForm(); openModal(els.modal); });
    els.btnRefresh?.addEventListener('click', loadData);
    els.search?.addEventListener('input', (e) => { searchQuery = e.target.value; renderTable(); });
    els.statusFilter?.addEventListener('change', (e) => { statusFilter = e.target.value; renderTable(); });
    els.fieldKeyboard?.addEventListener('input', updateWordCountPreview);
    els.questionSearch?.addEventListener('input', renderQuestionPicker);

    els.form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = readFormData();
        els.btnSave.disabled = true;
        const { data, error } = await upsertSimulasyon(payload);
        els.btnSave.disabled = false;
        if (error) {
            showToast(error.message || 'Kayıt başarısız', 'error');
            return;
        }
        closeModal(els.modal);
        showToast(editingId ? 'Simülasyon güncellendi' : 'Simülasyon eklendi');
        if (editingId) simulations = simulations.map((s) => (s.id === data.id ? data : s));
        else simulations.unshift(data);
        updateStats();
        renderTable();
        resetForm();
    });

    els.tbody?.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-edit]');
        const deleteBtn = e.target.closest('[data-delete]');
        if (editBtn) {
            const s = simulations.find((x) => x.id === editBtn.dataset.edit);
            if (s) { fillForm(s); openModal(els.modal); }
            return;
        }
        if (deleteBtn) {
            const s = simulations.find((x) => x.id === deleteBtn.dataset.delete);
            if (!s) return;
            deleteTarget = s;
            els.deleteMessage.textContent = `"${s.title}" simülasyonunu silmek istediğinize emin misiniz?`;
            openModal(els.deleteModal);
        }
    });

    els.btnConfirmDelete?.addEventListener('click', async () => {
        if (!deleteTarget) return;
        const { error } = await deleteSimulasyon(deleteTarget.id);
        if (error) { showToast(error.message, 'error'); return; }
        simulations = simulations.filter((s) => s.id !== deleteTarget.id);
        deleteTarget = null;
        closeModal(els.deleteModal);
        showToast('Simülasyon silindi');
        updateStats();
        renderTable();
    });

    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('#sim-modal, #delete-modal');
            if (modal) closeModal(modal);
        });
    });
    document.querySelectorAll('[data-close-delete-modal]').forEach((btn) => {
        btn.addEventListener('click', () => closeModal(els.deleteModal));
    });
}

function cacheElements() {
    els.tbody = document.getElementById('simulations-admin-tbody');
    els.search = document.getElementById('sim-search');
    els.statusFilter = document.getElementById('sim-status-filter');
    els.btnAdd = document.getElementById('btn-add-simulation');
    els.btnRefresh = document.getElementById('btn-refresh-simulations');
    els.modal = document.getElementById('sim-modal');
    els.deleteModal = document.getElementById('delete-modal');
    els.modalTitle = document.getElementById('sim-modal-title');
    els.form = document.getElementById('sim-form');
    els.btnSave = document.getElementById('btn-save-simulation');
    els.deleteMessage = document.getElementById('delete-message');
    els.btnConfirmDelete = document.getElementById('btn-confirm-delete');
    els.toast = document.getElementById('admin-toast');
    els.statTotal = document.getElementById('stat-total-simulations');
    els.statActive = document.getElementById('stat-active-simulations');
    els.statDraft = document.getElementById('stat-draft-simulations');
    els.statReady = document.getElementById('stat-ready-simulations');
    els.fieldTitle = document.getElementById('field-title');
    els.fieldDescription = document.getElementById('field-description');
    els.fieldKeyboard = document.getElementById('field-keyboard');
    els.fieldDuration = document.getElementById('field-duration');
    els.fieldMinWords = document.getElementById('field-min-words');
    els.fieldActive = document.getElementById('field-active');
    els.fieldSort = document.getElementById('field-sort');
    els.keyboardWordCount = document.getElementById('keyboard-word-count');
    els.questionPicker = document.getElementById('question-picker');
    els.questionSearch = document.getElementById('question-search');
    els.selectedCount = document.getElementById('selected-question-count');
}

async function init() {
    if (!(await requireAdminAccess())) return;

    cacheElements();
    bindEvents();
    resetForm();
    await loadData();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
