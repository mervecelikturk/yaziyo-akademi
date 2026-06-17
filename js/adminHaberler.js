/**
 * YAZİYO — Admin Haberler (Supabase)
 */
import { supabase } from './lib/supabase.js';
import { requireAdminAccess } from './lib/adminAuth.js';
import {
    HABER_CATEGORIES,
    GRADIENT_PRESETS,
    formatDateDisplay,
    isTableMissingError,
    fetchAllHaberlerAdmin,
    upsertHaber,
    deleteHaber,
    upsertResmiGazete,
    deleteResmiGazete,
    resolveSourceUrl
} from './lib/haberlerApi.js';

let state = { news: [], resmiGazete: [] };
let activeTab = 'news';
let editingNewsId = null;
let editingRgId = null;
let deleteTarget = null;
let loading = false;

const els = {};

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}

function catBadge(category) {
    const c = HABER_CATEGORIES[category] || { label: category, color: 'blue' };
    const cls = c.color === 'red' ? 'bg-red-500/15 text-red-400 border-red-500/30'
        : c.color === 'orange' ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
            : 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    return `<span class="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${cls}">${escapeHtml(c.label)}</span>`;
}

function formatAdminDbError(error) {
    const msg = (error?.message || '').toLowerCase();
    if (msg.includes('row-level security') || msg.includes('row security policy')) {
        return 'Yönetici yetkisi veritabanında tanınmıyor. adminGiris.html ile giriş yaptığınız hesabın yonetici_hesaplari tablosunda active=true olarak kayıtlı olduğundan emin olun (028_rls_yonetici_guvenlik.sql).';
    }
    return error?.message || 'Kayıt başarısız.';
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

function showSetupRequired(target) {
    const html = `
        <tr><td colspan="${target === 'rg' ? 6 : 7}" class="px-6 py-12">
            <div class="max-w-2xl mx-auto bg-orange-500/5 border border-orange-500/20 rounded-2xl p-8 text-center">
                <i class="fa-solid fa-database text-4xl text-orange-500 mb-4"></i>
                <h3 class="text-xl font-poppins font-bold mb-2">Veritabanı Kurulumu Gerekli</h3>
                <p class="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
                    Haberler tabloları henüz oluşturulmamış. Supabase SQL Editor'da
                    <code class="text-yaziyo-gold">supabase/migrations/008_haberler.sql</code>
                    dosyasını çalıştırın.
                </p>
                <a href="https://supabase.com/dashboard/project/eqyfnlapipnzojxhispd/sql/new" target="_blank" rel="noopener"
                    class="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700">
                    <i class="fa-solid fa-external-link"></i> SQL Editor
                </a>
                <button type="button" id="haber-reload-btn" class="block mx-auto mt-4 px-8 py-3 bg-orange-500 text-white rounded-xl font-poppins font-bold text-sm">Sayfayı Yenile</button>
            </div>
        </td></tr>`;
    if (target === 'rg' && els.rgTbody) els.rgTbody.innerHTML = html;
    else if (els.newsTbody) els.newsTbody.innerHTML = html;
    document.getElementById('haber-reload-btn')?.addEventListener('click', () => location.reload());
}

function showLoadingRow(target) {
    const col = target === 'rg' ? 6 : 7;
    const html = `<tr><td colspan="${col}" class="px-6 py-24 text-center">
        <i class="fa-solid fa-circle-notch fa-spin text-4xl text-yaziyo-gold mb-4"></i>
        <p class="text-sm text-light-text-secondary">Yükleniyor...</p>
    </td></tr>`;
    if (target === 'rg' && els.rgTbody) els.rgTbody.innerHTML = html;
    else if (els.newsTbody) els.newsTbody.innerHTML = html;
}

function updateStats() {
    const total = state.news.length;
    const published = state.news.filter((n) => n.published).length;
    if (els.statTotal) els.statTotal.textContent = total;
    if (els.statPublished) els.statPublished.textContent = published;
    if (els.statDraft) els.statDraft.textContent = total - published;
    if (els.statFeatured) els.statFeatured.textContent = state.news.filter((n) => n.featured).length;
    if (els.statRg) els.statRg.textContent = state.resmiGazete.length;
}

function getFilteredNews() {
    const q = (els.newsSearch?.value || '').toLowerCase().trim();
    const cat = els.newsCatFilter?.value || 'all';
    const status = els.newsStatusFilter?.value || 'all';

    return state.news.filter((n) => {
        if (cat !== 'all' && n.category !== cat) return false;
        if (status === 'published' && !n.published) return false;
        if (status === 'draft' && n.published) return false;
        if (status === 'featured' && !n.featured) return false;
        if (q) {
            const hay = `${n.title} ${n.excerpt} ${n.author}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });
}

function renderNewsTable() {
    const tbody = els.newsTbody;
    if (!tbody || loading) return;

    const rows = getFilteredNews();
    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-12 text-center text-sm text-light-text-secondary">Kayıt bulunamadı.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map((n) => {
        const flags = [
            n.featured ? '<span class="text-[10px] text-yaziyo-gold font-bold">★ Öne Çıkan</span>' : '',
            n.pinned ? '<span class="text-[10px] text-orange-400">📌 Önemli</span>' : '',
            n.isNew ? '<span class="text-[10px] text-green-500">Yeni</span>' : ''
        ].filter(Boolean).join(' ');

        const status = n.published
            ? '<span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/15 text-green-500 border border-green-500/30">Yayında</span>'
            : '<span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/15 text-slate-400 border border-slate-500/30">Taslak</span>';

        return `
            <tr class="hover:bg-light-bg/50 dark:hover:bg-dark-bg/50 transition-colors">
                <td class="px-6 py-4">
                    <p class="font-poppins font-semibold text-sm line-clamp-2 max-w-[220px]">${escapeHtml(n.title)}</p>
                    <p class="text-[10px] text-light-text-secondary mt-1 line-clamp-1">${escapeHtml(n.excerpt)}</p>
                </td>
                <td class="px-6 py-4">${catBadge(n.category)}</td>
                <td class="px-6 py-4 text-xs whitespace-nowrap">${escapeHtml(n.date)}</td>
                <td class="px-6 py-4 text-xs">${escapeHtml(n.author)}</td>
                <td class="px-6 py-4 text-xs tabular-nums">${(n.views || 0).toLocaleString('tr-TR')}</td>
                <td class="px-6 py-4">${status}<div class="flex flex-wrap gap-1 mt-1">${flags}</div></td>
                <td class="px-6 py-4 text-right whitespace-nowrap">
                    <button type="button" data-edit-news="${n.id}" class="p-2 rounded-lg hover:bg-yaziyo-gold/10 hover:text-yaziyo-gold" title="Düzenle"><i class="fa-solid fa-pen text-sm"></i></button>
                    <button type="button" data-delete-news="${n.id}" class="p-2 rounded-lg hover:bg-red-500/10 hover:text-red-500" title="Sil"><i class="fa-solid fa-trash text-sm"></i></button>
                </td>
            </tr>`;
    }).join('');
}

function renderRgTable() {
    const tbody = els.rgTbody;
    if (!tbody || loading) return;

    const q = (els.rgSearch?.value || '').toLowerCase().trim();
    const rows = state.resmiGazete.filter((r) => {
        if (!q) return true;
        return `${r.kararNo} ${r.excerpt} ${r.category}`.toLowerCase().includes(q);
    });

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-12 text-center text-sm text-light-text-secondary">Kayıt bulunamadı.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map((r) => {
        const status = r.published
            ? '<span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/15 text-green-500 border border-green-500/30">Yayında</span>'
            : '<span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/15 text-slate-400 border border-slate-500/30">Taslak</span>';

        return `
            <tr class="hover:bg-light-bg/50 dark:hover:bg-dark-bg/50 transition-colors">
                <td class="px-6 py-4 font-poppins font-bold text-sm text-yaziyo-gold">${escapeHtml(r.kararNo)}</td>
                <td class="px-6 py-4 text-xs whitespace-nowrap">${escapeHtml(r.date)}</td>
                <td class="px-6 py-4"><span class="text-[10px] font-bold uppercase text-red-400/90">${escapeHtml(r.category)}</span></td>
                <td class="px-6 py-4 text-xs line-clamp-2 max-w-xs">${escapeHtml(r.excerpt)}</td>
                <td class="px-6 py-4">${status}</td>
                <td class="px-6 py-4 text-right whitespace-nowrap">
                    <button type="button" data-edit-rg="${r.id}" class="p-2 rounded-lg hover:bg-yaziyo-gold/10 hover:text-yaziyo-gold"><i class="fa-solid fa-pen text-sm"></i></button>
                    <button type="button" data-delete-rg="${r.id}" class="p-2 rounded-lg hover:bg-red-500/10 hover:text-red-500"><i class="fa-solid fa-trash text-sm"></i></button>
                </td>
            </tr>`;
    }).join('');
}

function setTab(tab) {
    activeTab = tab;
    els.tabNews?.classList.toggle('admin-tab-active', tab === 'news');
    els.tabRg?.classList.toggle('admin-tab-active', tab === 'rg');
    els.panelNews?.classList.toggle('hidden', tab !== 'news');
    els.panelRg?.classList.toggle('hidden', tab !== 'rg');
}

function fillNewsForm(item) {
    const form = els.newsForm;
    if (!form) return;
    form.title.value = item?.title || '';
    form.excerpt.value = item?.excerpt || '';
    form.content.value = item?.content || '';
    form.category.value = item?.category || 'admin-duyuru';
    form.date.value = item?.publishDate || new Date().toISOString().slice(0, 10);
    form.author.value = item?.author || 'Admin Merve';
    form.views.value = item?.views ?? 0;
    form.sourceUrl.value = item ? (resolveSourceUrl(item) || '') : '';
    form.imageGradient.value = item?.imageGradient || GRADIENT_PRESETS[0].value;
    form.featured.checked = !!item?.featured;
    form.pinned.checked = !!item?.pinned;
    form.isNew.checked = !!item?.isNew;
    form.published.checked = item ? !!item.published : true;
    updatePreview();
}

function fillRgForm(item) {
    const form = els.rgForm;
    if (!form) return;
    form.kararNo.value = item?.kararNo || '';
    form.date.value = item?.publishDate || new Date().toISOString().slice(0, 10);
    form.category.value = item?.category || 'Resmi Gazete';
    form.excerpt.value = item?.excerpt || '';
    form.pdfUrl.value = item?.pdfUrl || '';
    form.published.checked = item ? item.published !== false : true;
}

function updatePreview() {
    const form = els.newsForm;
    const box = els.newsPreview;
    if (!form || !box) return;
    const cat = HABER_CATEGORIES[form.category.value] || { label: '—' };
    const grad = form.imageGradient.value;
    box.innerHTML = `
        <div class="rounded-xl overflow-hidden border border-light-border dark:border-dark-border">
            <div class="h-24 bg-gradient-to-br ${grad} relative">
                <span class="absolute top-2 left-2 text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-black/40 text-white">${escapeHtml(cat.label)}</span>
            </div>
            <div class="p-3 bg-light-card dark:bg-dark-card">
                <p class="font-poppins font-bold text-sm line-clamp-2">${escapeHtml(form.title.value || 'Başlık')}</p>
                <p class="text-[11px] text-light-text-secondary line-clamp-2 mt-1">${escapeHtml(form.excerpt.value || 'Özet...')}</p>
            </div>
        </div>`;
}

function openNewsModal(id = null) {
    editingNewsId = id;
    const item = id ? state.news.find((n) => n.id === id) : null;
    els.newsModalTitle.textContent = id ? 'Haberi Düzenle' : 'Yeni Haber Ekle';
    fillNewsForm(item);
    openModal(els.newsModal);
}

function openRgModal(id = null) {
    editingRgId = id;
    const item = id ? state.resmiGazete.find((r) => r.id === id) : null;
    els.rgModalTitle.textContent = id ? 'Kaydı Düzenle' : 'Yeni Resmî Gazete Kaydı';
    fillRgForm(item);
    openModal(els.rgModal);
}

async function loadData() {
    if (!supabase) {
        showSetupRequired('news');
        showSetupRequired('rg');
        return;
    }

    loading = true;
    showLoadingRow('news');
    showLoadingRow('rg');

    const { news, resmiGazete, error } = await fetchAllHaberlerAdmin();
    loading = false;

    if (error) {
        if (isTableMissingError(error)) {
            showSetupRequired('news');
            showSetupRequired('rg');
            return;
        }
        console.error(error);
        showToast('Veriler yüklenemedi.', 'error');
        return;
    }

    state.news = news;
    state.resmiGazete = resmiGazete;
    updateStats();
    renderNewsTable();
    renderRgTable();
}

async function saveNews(e) {
    e.preventDefault();
    const form = els.newsForm;
    const title = form.title.value.trim();
    const excerpt = form.excerpt.value.trim();
    if (!title || !excerpt) {
        showToast('Başlık ve kısa açıklama zorunludur.', 'error');
        return;
    }

    const payload = {
        category: form.category.value,
        title,
        excerpt,
        content: form.content.value.trim(),
        publishDate: form.date.value,
        views: parseInt(form.views.value, 10) || 0,
        author: form.author.value.trim() || 'Admin Merve',
        sourceUrl: form.sourceUrl.value.trim(),
        slug: title.toLowerCase().replace(/[^a-z0-9ğüşıöçĞÜŞİÖÇ]+/gi, '-').replace(/^-|-$/g, '').slice(0, 80),
        imageGradient: form.imageGradient.value,
        featured: form.featured.checked,
        pinned: form.pinned.checked,
        isNew: form.isNew.checked,
        published: form.published.checked
    };

    const btn = form.querySelector('[type="submit"]');
    const prev = btn?.innerHTML;
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Kaydediliyor...';
    }

    const { error } = await upsertHaber(editingNewsId, payload);

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = prev;
    }

    if (error) {
        console.error(error);
        showToast(formatAdminDbError(error), 'error');
        return;
    }

    closeModal(els.newsModal);
    editingNewsId = null;
    showToast('Haber kaydedildi.');
    await loadData();
}

async function saveRg(e) {
    e.preventDefault();
    const form = els.rgForm;
    const kararNo = form.kararNo.value.trim();
    const excerpt = form.excerpt.value.trim();
    if (!kararNo || !excerpt) {
        showToast('Karar numarası ve özet zorunludur.', 'error');
        return;
    }

    const payload = {
        kararNo,
        publishDate: form.date.value,
        category: form.category.value.trim(),
        excerpt,
        pdfUrl: form.pdfUrl.value.trim(),
        published: form.published.checked
    };

    const btn = form.querySelector('[type="submit"]');
    const prev = btn?.innerHTML;
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Kaydediliyor...';
    }

    const { error } = await upsertResmiGazete(editingRgId, payload);

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = prev;
    }

    if (error) {
        console.error(error);
        showToast(formatAdminDbError(error), 'error');
        return;
    }

    closeModal(els.rgModal);
    editingRgId = null;
    showToast('Resmî Gazete kaydı kaydedildi.');
    await loadData();
}

async function confirmDelete() {
    if (!deleteTarget) return;

    const btn = els.btnConfirmDelete;
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }

    const { error } = deleteTarget.type === 'news'
        ? await deleteHaber(deleteTarget.id)
        : await deleteResmiGazete(deleteTarget.id);

    if (btn) {
        btn.disabled = false;
        btn.textContent = 'Sil';
    }

    if (error) {
        showToast('Silme işlemi başarısız.', 'error');
        return;
    }

    closeModal(els.deleteModal);
    deleteTarget = null;
    showToast('Kayıt silindi.');
    await loadData();
}

function exportDraft() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `yaziyo-haberler-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Veriler JSON olarak indirildi.');
}

function bindEvents() {
    els.tabNews?.addEventListener('click', () => setTab('news'));
    els.tabRg?.addEventListener('click', () => setTab('rg'));
    els.btnAddNews?.addEventListener('click', () => openNewsModal());
    els.btnAddRg?.addEventListener('click', () => openRgModal());
    els.newsSearch?.addEventListener('input', renderNewsTable);
    els.newsCatFilter?.addEventListener('change', renderNewsTable);
    els.newsStatusFilter?.addEventListener('change', renderNewsTable);
    els.rgSearch?.addEventListener('input', renderRgTable);
    els.newsForm?.addEventListener('submit', saveNews);
    els.rgForm?.addEventListener('submit', saveRg);
    els.newsForm?.addEventListener('input', updatePreview);
    els.newsForm?.addEventListener('change', updatePreview);

    document.querySelectorAll('[data-close-news-modal]').forEach((b) =>
        b.addEventListener('click', () => closeModal(els.newsModal)));
    document.querySelectorAll('[data-close-rg-modal]').forEach((b) =>
        b.addEventListener('click', () => closeModal(els.rgModal)));
    document.querySelectorAll('[data-close-delete-modal]').forEach((b) =>
        b.addEventListener('click', () => closeModal(els.deleteModal)));

    els.newsTbody?.addEventListener('click', (e) => {
        const edit = e.target.closest('[data-edit-news]');
        const del = e.target.closest('[data-delete-news]');
        if (edit) openNewsModal(edit.dataset.editNews);
        if (del) {
            deleteTarget = { type: 'news', id: del.dataset.deleteNews };
            els.deleteMessage.textContent = 'Bu haberi silmek istediğinize emin misiniz?';
            openModal(els.deleteModal);
        }
    });

    els.rgTbody?.addEventListener('click', (e) => {
        const edit = e.target.closest('[data-edit-rg]');
        const del = e.target.closest('[data-delete-rg]');
        if (edit) openRgModal(edit.dataset.editRg);
        if (del) {
            deleteTarget = { type: 'rg', id: del.dataset.deleteRg };
            els.deleteMessage.textContent = 'Bu Resmî Gazete kaydını silmek istediğinize emin misiniz?';
            openModal(els.deleteModal);
        }
    });

    els.btnConfirmDelete?.addEventListener('click', confirmDelete);
    els.btnExport?.addEventListener('click', exportDraft);
    els.btnRefresh?.addEventListener('click', loadData);
}

function populateGradientSelect() {
    const sel = els.newsForm?.imageGradient;
    if (!sel) return;
    sel.innerHTML = GRADIENT_PRESETS.map((p) =>
        `<option value="${p.value}">${escapeHtml(p.label)}</option>`
    ).join('');
}

function cacheElements() {
    els.statTotal = document.getElementById('stat-total-news');
    els.statPublished = document.getElementById('stat-published');
    els.statDraft = document.getElementById('stat-draft');
    els.statFeatured = document.getElementById('stat-featured');
    els.statRg = document.getElementById('stat-rg');
    els.tabNews = document.getElementById('tab-news');
    els.tabRg = document.getElementById('tab-rg');
    els.panelNews = document.getElementById('panel-news');
    els.panelRg = document.getElementById('panel-rg');
    els.newsTbody = document.getElementById('news-admin-tbody');
    els.rgTbody = document.getElementById('rg-admin-tbody');
    els.newsSearch = document.getElementById('news-search');
    els.newsCatFilter = document.getElementById('news-cat-filter');
    els.newsStatusFilter = document.getElementById('news-status-filter');
    els.rgSearch = document.getElementById('rg-search');
    els.btnAddNews = document.getElementById('btn-add-news');
    els.btnAddRg = document.getElementById('btn-add-rg');
    els.btnRefresh = document.getElementById('btn-refresh-haberler');
    els.newsModal = document.getElementById('news-modal');
    els.rgModal = document.getElementById('rg-modal');
    els.deleteModal = document.getElementById('delete-modal');
    els.newsModalTitle = document.getElementById('news-modal-title');
    els.rgModalTitle = document.getElementById('rg-modal-title');
    els.newsForm = document.getElementById('news-form');
    els.rgForm = document.getElementById('rg-form');
    els.newsPreview = document.getElementById('news-preview');
    els.deleteMessage = document.getElementById('delete-message');
    els.btnConfirmDelete = document.getElementById('btn-confirm-delete');
    els.btnExport = document.getElementById('btn-export-draft');
    els.toast = document.getElementById('admin-toast');
}

async function init() {
    if (!(await requireAdminAccess())) return;
    cacheElements();
    populateGradientSelect();
    bindEvents();
    setTab('news');
    await loadData();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
