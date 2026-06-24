/**
 * YAZİYO — Admin Eğitim Paketleri (Supabase)
 */
import { supabase } from './lib/supabase.js';
import { requireAdminAccess } from './lib/adminAuth.js';
import { refreshAdminMobileTables } from './lib/adminTableMobile.js';
import {
    EGITIM_KATEGORILERI,
    BADGE_OPTIONS,
    fetchAllPaketlerAdmin,
    upsertPaket,
    deletePaket,
    isTableMissingError
} from './lib/egitimPaketleriApi.js';

let packages = [];
let editingId = null;
let deleteTarget = null;
let searchQuery = '';
let statusFilter = 'all';

const els = {};

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

function formatPrice(price) {
    const n = Number(price) || 0;
    if (n <= 0) return 'Ücretsiz';
    return `₺${n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;
}

function showToast(message, type = 'success') {
    const toast = els.toast;
    if (!toast) return;
    toast.textContent = message;
    toast.className = `fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-xl font-inter text-sm font-semibold shadow-2xl transition-all duration-300 ${type === 'error' ? 'bg-red-500 text-white' : 'bg-yaziyo-gold text-slate-900'}`;
    toast.classList.remove('hidden', 'opacity-0');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3200);
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

function filterList() {
    let list = [...packages];
    const q = searchQuery.toLowerCase().trim();
    if (q) {
        list = list.filter((p) =>
            `${p.title} ${p.description} ${p.category}`.toLowerCase().includes(q));
    }
    if (statusFilter === 'active') list = list.filter((p) => p.active);
    else if (statusFilter === 'draft') list = list.filter((p) => !p.active);
    else if (statusFilter === 'featured') list = list.filter((p) => p.featured);
    return list;
}

function updateStats() {
    els.statTotal.textContent = String(packages.length);
    els.statActive.textContent = String(packages.filter((p) => p.active).length);
    els.statDraft.textContent = String(packages.filter((p) => !p.active).length);
    els.statFeatured.textContent = String(packages.filter((p) => p.featured).length);
}

function showSetupRequired() {
    els.tbody.innerHTML = `
        <tr><td colspan="6" class="px-6 py-12">
            <div class="max-w-2xl mx-auto bg-orange-500/5 border border-orange-500/20 rounded-2xl p-8 text-center">
                <i class="fa-solid fa-database text-4xl text-orange-500 mb-4"></i>
                <h3 class="text-xl font-poppins font-bold mb-2">Veritabanı Kurulumu Gerekli</h3>
                <p class="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
                    Eğitim paketleri tablosu henüz oluşturulmamış. Supabase SQL Editor'da
                    <code class="text-yaziyo-gold">supabase/migrations/023_egitim_paketleri.sql</code>
                    dosyasını çalıştırın.
                </p>
                <button type="button" id="ep-reload-btn" class="px-8 py-3 bg-orange-500 text-white rounded-xl font-poppins font-bold text-sm">Sayfayı Yenile</button>
            </div>
        </td></tr>`;
    document.getElementById('ep-reload-btn')?.addEventListener('click', () => location.reload());
}

function renderTable() {
    const list = filterList();
    if (!list.length) {
        els.tbody.innerHTML = `
            <tr><td colspan="6" class="px-6 py-16 text-center text-sm text-light-text-secondary">
                ${packages.length ? 'Filtreye uygun paket bulunamadı.' : 'Henüz eğitim paketi eklenmedi. Yeni paket ekleyerek başlayın.'}
            </td></tr>`;
        refreshAdminMobileTables();
        return;
    }

    els.tbody.innerHTML = list.map((p) => {
        const badgeLabel = p.badge ? (BADGE_OPTIONS[p.badge]?.label || p.badge) : '—';
        return `
            <tr class="hover:bg-light-bg/40 dark:hover:bg-dark-bg/40 transition-colors">
                <td class="px-6 py-4">
                    <p class="font-poppins font-bold text-sm">${escapeHtml(p.title)}</p>
                    <p class="text-xs text-light-text-secondary line-clamp-1 mt-0.5">${escapeHtml(p.description)}</p>
                </td>
                <td class="px-6 py-4 text-sm">${escapeHtml(p.category)}</td>
                <td class="px-6 py-4 text-sm font-bold text-yaziyo-gold">${formatPrice(p.price)}</td>
                <td class="px-6 py-4">
                    <span class="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${p.active ? 'bg-green-500/15 text-green-500' : 'bg-slate-500/15 text-slate-400'}">${p.active ? 'Yayında' : 'Taslak'}</span>
                    ${p.badge ? `<span class="ml-1 inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-yaziyo-gold/15 text-yaziyo-gold">${escapeHtml(badgeLabel)}</span>` : ''}
                </td>
                <td class="px-6 py-4 text-center">${p.featured ? '<i class="fa-solid fa-star text-yaziyo-gold"></i>' : '—'}</td>
                <td class="px-6 py-4 text-right">
                    <div class="inline-flex gap-2">
                        <button type="button" class="w-8 h-8 rounded-lg border border-light-border dark:border-dark-border hover:border-yaziyo-gold hover:text-yaziyo-gold transition-all" data-edit="${p.id}" title="Düzenle"><i class="fa-solid fa-pen text-xs"></i></button>
                        <button type="button" class="w-8 h-8 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white transition-all" data-delete="${p.id}" title="Sil"><i class="fa-solid fa-trash text-xs"></i></button>
                    </div>
                </td>
            </tr>`;
    }).join('');
    refreshAdminMobileTables();
}

function resetForm() {
    editingId = null;
    els.form.reset();
    els.fieldCategory.value = 'Genel';
    els.fieldBadge.value = '';
    els.fieldActive.checked = true;
    els.fieldFeatured.checked = false;
    els.fieldPopular.checked = false;
    els.fieldSort.value = '0';
    els.modalTitle.textContent = 'Yeni Eğitim Paketi';
}

function fillForm(pkg) {
    editingId = pkg.id;
    els.modalTitle.textContent = 'Paketi Düzenle';
    els.fieldTitle.value = pkg.title;
    els.fieldDescription.value = pkg.description;
    els.fieldCategory.value = pkg.category;
    els.fieldPrice.value = pkg.price;
    els.fieldBadge.value = pkg.badge || '';
    els.fieldFeatures.value = arrayToLines(pkg.features);
    els.fieldModules.value = arrayToLines(pkg.modules);
    els.fieldLearn.value = arrayToLines(pkg.learn);
    els.fieldCover.value = pkg.coverUrl || '';
    els.fieldContent.value = pkg.contentUrl || '';
    els.fieldFeatured.checked = !!pkg.featured;
    els.fieldPopular.checked = !!pkg.popular;
    els.fieldActive.checked = !!pkg.active;
    els.fieldSort.value = String(pkg.sortOrder || 0);
}

async function loadData() {
    els.tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-12 text-center text-sm text-light-text-secondary"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Yükleniyor...</td></tr>`;
    const { data, error } = await fetchAllPaketlerAdmin();
    if (error) {
        if (isTableMissingError(error)) showSetupRequired();
        else showToast(error.message || 'Paketler yüklenemedi', 'error');
        return;
    }
    packages = data || [];
    updateStats();
    renderTable();
}

function readFormData() {
    return {
        id: editingId || undefined,
        title: els.fieldTitle.value,
        description: els.fieldDescription.value,
        category: els.fieldCategory.value,
        price: els.fieldPrice.value,
        badge: els.fieldBadge.value || null,
        features: linesToArray(els.fieldFeatures.value),
        modules: linesToArray(els.fieldModules.value),
        learn: linesToArray(els.fieldLearn.value),
        coverUrl: els.fieldCover.value,
        contentUrl: els.fieldContent.value,
        featured: els.fieldFeatured.checked,
        popular: els.fieldPopular.checked,
        active: els.fieldActive.checked,
        sortOrder: els.fieldSort.value
    };
}

function bindEvents() {
    els.btnAdd?.addEventListener('click', () => {
        resetForm();
        openModal(els.modal);
    });

    els.btnRefresh?.addEventListener('click', loadData);

    els.search?.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderTable();
    });

    els.statusFilter?.addEventListener('change', (e) => {
        statusFilter = e.target.value;
        renderTable();
    });

    els.form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = readFormData();
        if (!payload.title.trim()) {
            showToast('Paket başlığı zorunludur', 'error');
            return;
        }
        els.btnSave.disabled = true;
        const { data, error } = await upsertPaket(payload);
        els.btnSave.disabled = false;
        if (error) {
            showToast(error.message || 'Kayıt başarısız', 'error');
            return;
        }
        closeModal(els.modal);
        showToast(editingId ? 'Paket güncellendi' : 'Paket eklendi');
        if (editingId) {
            packages = packages.map((p) => (p.id === data.id ? data : p));
            if (data.featured) packages = packages.map((p) => (p.id !== data.id ? { ...p, featured: false } : p));
        } else {
            packages.unshift(data);
            if (data.featured) packages = packages.map((p) => (p.id !== data.id ? { ...p, featured: false } : p));
        }
        updateStats();
        renderTable();
        resetForm();
    });

    els.tbody?.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-edit]');
        const deleteBtn = e.target.closest('[data-delete]');
        if (editBtn) {
            const pkg = packages.find((p) => p.id === editBtn.dataset.edit);
            if (pkg) {
                fillForm(pkg);
                openModal(els.modal);
            }
            return;
        }
        if (deleteBtn) {
            const pkg = packages.find((p) => p.id === deleteBtn.dataset.delete);
            if (!pkg) return;
            deleteTarget = pkg;
            els.deleteMessage.textContent = `"${pkg.title}" paketini silmek istediğinize emin misiniz?`;
            openModal(els.deleteModal);
        }
    });

    els.btnConfirmDelete?.addEventListener('click', async () => {
        if (!deleteTarget) return;
        els.btnConfirmDelete.disabled = true;
        const { error } = await deletePaket(deleteTarget.id);
        els.btnConfirmDelete.disabled = false;
        if (error) {
            showToast(error.message || 'Silme başarısız', 'error');
            return;
        }
        packages = packages.filter((p) => p.id !== deleteTarget.id);
        deleteTarget = null;
        closeModal(els.deleteModal);
        showToast('Paket silindi');
        updateStats();
        renderTable();
    });

    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('#package-modal, #delete-modal');
            if (modal) closeModal(modal);
        });
    });

    document.querySelectorAll('[data-close-delete-modal]').forEach((btn) => {
        btn.addEventListener('click', () => closeModal(els.deleteModal));
    });
}

function populateCategorySelect() {
    els.fieldCategory.innerHTML = EGITIM_KATEGORILERI.map((cat) =>
        `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');
}

function cacheElements() {
    els.tbody = document.getElementById('packages-admin-tbody');
    els.search = document.getElementById('package-search');
    els.statusFilter = document.getElementById('package-status-filter');
    els.btnAdd = document.getElementById('btn-add-package');
    els.btnRefresh = document.getElementById('btn-refresh-packages');
    els.modal = document.getElementById('package-modal');
    els.deleteModal = document.getElementById('delete-modal');
    els.modalTitle = document.getElementById('package-modal-title');
    els.form = document.getElementById('package-form');
    els.btnSave = document.getElementById('btn-save-package');
    els.deleteMessage = document.getElementById('delete-message');
    els.btnConfirmDelete = document.getElementById('btn-confirm-delete');
    els.toast = document.getElementById('admin-toast');
    els.statTotal = document.getElementById('stat-total-packages');
    els.statActive = document.getElementById('stat-active-packages');
    els.statDraft = document.getElementById('stat-draft-packages');
    els.statFeatured = document.getElementById('stat-featured-packages');
    els.fieldTitle = document.getElementById('field-title');
    els.fieldDescription = document.getElementById('field-description');
    els.fieldCategory = document.getElementById('field-category');
    els.fieldPrice = document.getElementById('field-price');
    els.fieldBadge = document.getElementById('field-badge');
    els.fieldFeatures = document.getElementById('field-features');
    els.fieldModules = document.getElementById('field-modules');
    els.fieldLearn = document.getElementById('field-learn');
    els.fieldCover = document.getElementById('field-cover');
    els.fieldContent = document.getElementById('field-content');
    els.fieldFeatured = document.getElementById('field-featured');
    els.fieldPopular = document.getElementById('field-popular');
    els.fieldActive = document.getElementById('field-active');
    els.fieldSort = document.getElementById('field-sort');
}

async function init() {
    if (!(await requireAdminAccess())) return;

    cacheElements();
    populateCategorySelect();
    bindEvents();
    resetForm();
    await loadData();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
