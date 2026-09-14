/**
 * YAZİYO — Admin Eğitim Paketleri (Supabase)
 */
import { requireAdminAccess } from './lib/adminAuth.js';
import { refreshAdminMobileTables } from './lib/adminTableMobile.js';
import {
    EGITIM_KATEGORILERI,
    BADGE_OPTIONS,
    PAKET_YETKILERI,
    fetchAllPaketlerAdmin,
    upsertPaket,
    deletePaket,
    isTableMissingError,
    isPaketSoldOut,
    fetchAdminBildirimler,
    markAdminBildirimOkundu,
    markAllAdminBildirimOkundu,
    fetchPaketIptalTalepleri,
    fetchAdminAktifSatinAlmalar,
    cancelKullaniciPaketi
} from './lib/egitimPaketleriApi.js';

let packages = [];
let notifications = [];
let iadeTalepleri = [];
let aktifPaketler = [];
let editingId = null;
let deleteTarget = null;
let cancelTarget = null;
let searchQuery = '';
let statusFilter = 'all';
let activeSection = 'yonetim';

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

function formatDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function notifIcon(tur) {
    if (tur === 'paket_iade_talep') return { icon: 'fa-rotate-left', wrap: 'bg-red-500/15 text-red-500' };
    if (tur === 'paket_iptal') return { icon: 'fa-ban', wrap: 'bg-slate-500/15 text-slate-400' };
    if (tur === 'paket_tanimla') return { icon: 'fa-user-plus', wrap: 'bg-sky-500/15 text-sky-500' };
    return { icon: 'fa-box-open', wrap: 'bg-orange-500/15 text-orange-500' };
}

function iadeDurumLabel(durum) {
    if (durum === 'iptal_edildi') return { text: 'Paket iptal edildi', cls: 'bg-slate-500/15 text-slate-400' };
    if (durum === 'kapatildi') return { text: 'Kapatıldı', cls: 'bg-slate-500/15 text-slate-400' };
    return { text: 'Bekliyor', cls: 'bg-orange-500/15 text-orange-500' };
}

function switchSection(id) {
    const next = id === 'islemler' ? 'islemler' : 'yonetim';
    const changed = next !== activeSection;
    activeSection = next;
    els.sectionYonetim?.classList.toggle('hidden', activeSection !== 'yonetim');
    els.sectionIslemler?.classList.toggle('hidden', activeSection !== 'islemler');
    els.tabYonetim?.classList.toggle('admin-tab-active', activeSection === 'yonetim');
    els.tabIslemler?.classList.toggle('admin-tab-active', activeSection === 'islemler');
    if (activeSection === 'islemler') {
        if (window.location.hash !== '#islemler') {
            history.replaceState(null, '', `${window.location.pathname}${window.location.search}#islemler`);
        }
        if (changed) loadOperations();
    } else if (window.location.hash === '#islemler') {
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
}

function updateIslemlerBadge() {
    const unread = salesNotifications().filter((n) => !n.okundu).length;
    const pending = iadeTalepleri.filter((t) => t.durum === 'beklemede').length;
    const total = unread + pending;
    const badge = els.islemlerBadge;
    if (!badge) return;
    if (total > 0) {
        badge.textContent = String(total);
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function renderIadeTalepleri() {
    const list = els.iadeList;
    const badge = els.iadeBadge;
    if (!list) return;
    const pending = iadeTalepleri.filter((t) => t.durum === 'beklemede').length;
    if (badge) {
        if (pending > 0) {
            badge.textContent = String(pending);
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
    if (!iadeTalepleri.length) {
        list.innerHTML = '<p class="px-6 py-8 text-center text-sm text-light-text-secondary">Henüz iade mesajı yok.</p>';
        return;
    }
    list.innerHTML = iadeTalepleri.map((t) => {
        const durum = iadeDurumLabel(t.durum);
        const canCancel = t.durum === 'beklemede';
        return `
            <div class="px-6 py-4 ${canCancel ? 'bg-red-500/5' : 'opacity-75'}">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-2 mb-1">
                            <p class="font-poppins font-bold text-sm">${escapeHtml(t.paketAdi)}</p>
                            <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${durum.cls}">${durum.text}</span>
                        </div>
                        <p class="text-xs text-light-text-secondary">
                            ${escapeHtml(t.kullaniciAdi)}${t.kullaniciEposta ? ` · ${escapeHtml(t.kullaniciEposta)}` : ''}
                            · ${escapeHtml(formatDateTime(t.createdAt))}
                        </p>
                        <p class="text-sm mt-2 leading-relaxed whitespace-pre-wrap">${escapeHtml(t.neden)}</p>
                    </div>
                    ${canCancel ? `
                        <button type="button"
                            class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/40 text-red-600 text-xs font-bold hover:bg-red-500/10 shrink-0"
                            data-cancel-satin="${t.satinAlmaId}">
                            <i class="fa-solid fa-ban"></i> Paketi İptal Et
                        </button>` : ''}
                </div>
            </div>`;
    }).join('');
}

function renderAktifPaketler() {
    const list = els.aktifPaketList;
    if (!list) return;
    if (!aktifPaketler.length) {
        list.innerHTML = '<p class="px-6 py-8 text-center text-sm text-light-text-secondary">Aktif paket yok.</p>';
        return;
    }
    list.innerHTML = aktifPaketler.map((p) => {
        const kalan = p.kalanGun == null ? '—' : (p.kalanGun < 0 ? 'Süresi doldu' : `${p.kalanGun} gün`);
        return `
            <div class="px-6 py-4 flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                    <p class="font-poppins font-bold text-sm">${escapeHtml(p.paketAdi)}</p>
                    <p class="text-xs text-light-text-secondary mt-1">
                        ${escapeHtml(p.kullaniciAdi)}${p.kullaniciEposta ? ` · ${escapeHtml(p.kullaniciEposta)}` : ''}
                    </p>
                    <p class="text-xs text-light-text-secondary mt-0.5">
                        ${escapeHtml(formatDateTime(p.baslangic))} → ${escapeHtml(formatDateTime(p.bitis))}
                        · ${escapeHtml(kalan)}
                        · ${(p.fiyat || 0).toLocaleString('tr-TR')} ₺
                    </p>
                </div>
                <button type="button"
                    class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/40 text-red-600 text-xs font-bold hover:bg-red-500/10 shrink-0"
                    data-cancel-satin="${p.id}">
                    <i class="fa-solid fa-ban"></i> İptal et
                </button>
            </div>`;
    }).join('');
}

function openCancelModal(satinAlmaId, label) {
    cancelTarget = { id: satinAlmaId, label };
    if (els.cancelPaketMessage) {
        els.cancelPaketMessage.textContent = `“${label}” paketi iptal edilsin mi? Kullanıcı bu pakete erişimi kaybeder.`;
    }
    openModal(els.cancelPaketModal);
}

function clampField(value, min, max, fallback) {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

function showToast(message, type = 'success') {
    const toast = els.toast;
    if (!toast) return;
    toast.textContent = message;
    toast.className = `fixed left-4 right-4 bottom-4 sm:left-auto sm:right-6 sm:bottom-6 max-w-sm z-[200] px-5 py-3 rounded-xl font-inter text-sm font-semibold shadow-2xl transition-all duration-300 ${type === 'error' ? 'bg-red-500 text-white' : 'bg-yaziyo-gold text-slate-900'}`;
    toast.style.bottom = 'max(1rem, env(safe-area-inset-bottom, 0px))';
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
    document.body.style.overflow = 'hidden';
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
        if (!document.getElementById('package-modal')?.classList.contains('flex')
            && !document.getElementById('delete-modal')?.classList.contains('flex')
            && !document.getElementById('cancel-paket-modal')?.classList.contains('flex')) {
            document.body.style.overflow = '';
        }
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
        <tr><td colspan="7" class="px-6 py-12">
            <div class="max-w-2xl mx-auto bg-orange-500/5 border border-orange-500/20 rounded-2xl p-8 text-center">
                <i class="fa-solid fa-database text-4xl text-orange-500 mb-4"></i>
                <h3 class="text-xl font-poppins font-bold mb-2">Veritabanı Kurulumu Gerekli</h3>
                <p class="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
                    Eğitim paketleri tablosu henüz oluşturulmamış. Supabase SQL Editor'da
                    <code class="text-yaziyo-gold">supabase/migrations/023_egitim_paketleri.sql</code>
                    ve <code class="text-yaziyo-gold">sql/024_egitim_paketi_satis.sql</code>
                    dosyalarını çalıştırın.
                </p>
                <button type="button" id="ep-reload-btn" class="px-8 py-3 bg-orange-500 text-white rounded-xl font-poppins font-bold text-sm">Sayfayı Yenile</button>
            </div>
        </td></tr>`;
    document.getElementById('ep-reload-btn')?.addEventListener('click', () => location.reload());
}

function salesNotifications() {
    return notifications.filter((n) => (
        n.tur === 'paket_satis'
        || n.tur === 'paket_iptal'
        || n.tur === 'paket_tanimla'
    ));
}

function renderNotifications() {
    const list = els.notifList;
    const badge = els.notifBadge;
    if (!list) return;

    const sales = salesNotifications();
    const unread = sales.filter((n) => !n.okundu).length;
    if (badge) {
        if (unread > 0) {
            badge.textContent = String(unread);
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
    if (els.btnMarkAllNotif) {
        els.btnMarkAllNotif.disabled = unread === 0;
    }

    if (!sales.length) {
        list.innerHTML = '<p class="px-6 py-8 text-center text-sm text-light-text-secondary">Henüz satış bildirimi yok.</p>';
        return;
    }

    list.innerHTML = sales.map((n) => `
        <div class="px-6 py-4 flex gap-3 items-start ${n.okundu ? 'opacity-70' : 'bg-yaziyo-gold/5'}" data-notif-id="${n.id}">
            <div class="w-9 h-9 rounded-full shrink-0 flex items-center justify-center ${n.okundu ? 'bg-slate-500/10 text-slate-400' : notifIcon(n.tur).wrap}">
                <i class="fa-solid ${notifIcon(n.tur).icon} text-sm"></i>
            </div>
            <div class="min-w-0 flex-grow">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <p class="font-poppins font-bold text-sm">${escapeHtml(n.baslik)}</p>
                    <span class="text-[10px] text-light-text-secondary whitespace-nowrap">${escapeHtml(formatDateTime(n.created_at))}</span>
                </div>
                <p class="text-xs text-light-text-secondary mt-1 leading-relaxed">${escapeHtml(n.mesaj)}</p>
                ${n.okundu ? '' : `<button type="button" class="mt-2 text-[11px] font-bold text-yaziyo-gold hover:underline" data-mark-notif="${n.id}">Okundu</button>`}
            </div>
        </div>`).join('');
}

function renderTable() {
    const list = filterList();
    if (!list.length) {
        els.tbody.innerHTML = `
            <tr><td colspan="7" class="px-6 py-16 text-center text-sm text-light-text-secondary">
                ${packages.length ? 'Filtreye uygun paket bulunamadı.' : 'Henüz eğitim paketi eklenmedi. Yeni paket ekleyerek başlayın.'}
            </td></tr>`;
        refreshAdminMobileTables();
        return;
    }

    els.tbody.innerHTML = list.map((p) => {
        const badgeLabel = p.badge ? (BADGE_OPTIONS[p.badge]?.label || p.badge) : '—';
        const soldOut = isPaketSoldOut(p);
        return `
            <tr class="hover:bg-light-bg/40 dark:hover:bg-dark-bg/40 transition-colors">
                <td class="px-6 py-4">
                    <p class="font-poppins font-bold text-sm">${escapeHtml(p.title)}</p>
                    <p class="text-xs text-light-text-secondary line-clamp-1 mt-0.5">${escapeHtml(p.description)}</p>
                    <p class="text-[10px] text-light-text-secondary mt-1">${p.validityDays || 30} gün geçerli</p>
                </td>
                <td class="px-6 py-4 text-sm">${escapeHtml(p.category)}</td>
                <td class="px-6 py-4 text-sm font-bold text-yaziyo-gold">${formatPrice(p.price)}</td>
                <td class="px-6 py-4 text-sm tabular-nums">
                    <span class="${soldOut ? 'text-red-500 font-bold' : ''}">${p.salesCount || 0}/${p.maxSales || 100}</span>
                    ${soldOut ? '<span class="block text-[10px] text-red-500 font-bold mt-0.5">Dolu</span>' : ''}
                </td>
                <td class="px-6 py-4">
                    <span class="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${p.active ? 'bg-green-500/15 text-green-500' : 'bg-slate-500/15 text-slate-400'}">${p.active ? 'Yayında' : 'Taslak'}</span>
                    ${p.badge ? `<span class="ml-1 inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-yaziyo-gold/15 text-yaziyo-gold">${escapeHtml(badgeLabel)}</span>` : ''}
                </td>
                <td class="px-6 py-4 text-center">${p.featured ? '<i class="fa-solid fa-star text-yaziyo-gold"></i>' : '—'}</td>
                <td class="px-6 py-4 text-right">
                    <div class="inline-flex gap-2">
                        <button type="button" class="w-11 h-11 rounded-lg border border-light-border dark:border-dark-border hover:border-yaziyo-gold hover:text-yaziyo-gold transition-all" data-edit="${p.id}" title="Düzenle"><i class="fa-solid fa-pen text-xs"></i></button>
                        <button type="button" class="w-11 h-11 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white transition-all" data-delete="${p.id}" title="Sil"><i class="fa-solid fa-trash text-xs"></i></button>
                    </div>
                </td>
            </tr>`;
    }).join('');
    refreshAdminMobileTables();
}

function renderYetkiCheckboxes(selected = []) {
    const wrap = els.fieldYetkiler;
    if (!wrap) return;
    const set = new Set(selected || []);
    wrap.innerHTML = PAKET_YETKILERI.map((group) => `
        <div>
            <p class="text-[10px] font-bold uppercase tracking-wider text-yaziyo-gold mb-2">${escapeHtml(group.group)}</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                ${group.items.map((item) => `
                    <label class="flex items-start gap-2 text-sm cursor-pointer rounded-lg px-2 py-2.5 min-h-11 hover:bg-light-bg/60 dark:hover:bg-dark-bg/60">
                        <input type="checkbox" class="mt-0.5 rounded border-light-border text-yaziyo-gold focus:ring-yaziyo-gold" data-yetki-id="${escapeHtml(item.id)}" ${set.has(item.id) ? 'checked' : ''}>
                        <span class="break-words">${escapeHtml(item.label)}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function readYetkilerFromForm() {
    if (!els.fieldYetkiler) return [];
    return [...els.fieldYetkiler.querySelectorAll('[data-yetki-id]:checked')]
        .map((el) => el.dataset.yetkiId)
        .filter(Boolean);
}

function setAllYetkiler(checked) {
    els.fieldYetkiler?.querySelectorAll('[data-yetki-id]').forEach((el) => {
        el.checked = checked;
    });
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
    els.fieldMaxSales.value = '100';
    els.fieldValidityDays.value = '30';
    renderYetkiCheckboxes([]);
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
    els.fieldMaxSales.value = String(pkg.maxSales || 100);
    els.fieldValidityDays.value = String(pkg.validityDays || 30);
    els.fieldFeatured.checked = !!pkg.featured;
    els.fieldPopular.checked = !!pkg.popular;
    els.fieldActive.checked = !!pkg.active;
    els.fieldSort.value = String(pkg.sortOrder || 0);
    renderYetkiCheckboxes(pkg.yetkiler || []);
}

async function loadNotifications() {
    const { data, error } = await fetchAdminBildirimler();
    if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('yonetici_bildirimleri') || error.code === 'PGRST205') {
            if (els.notifList) {
                els.notifList.innerHTML = `
                    <p class="px-6 py-6 text-center text-sm text-orange-500">
                        Satış bildirimleri için <code class="text-yaziyo-gold">sql/024_egitim_paketi_satis.sql</code> dosyasını çalıştırın.
                    </p>`;
            }
            return;
        }
        console.warn('Bildirim yükleme hatası:', error);
        return;
    }
    notifications = data || [];
    renderNotifications();
    updateIslemlerBadge();
}

async function loadIadeTalepleri() {
    const { data, error } = await fetchPaketIptalTalepleri();
    if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('paket_iptal_talepleri') || error.code === 'PGRST205') {
            if (els.iadeList) {
                els.iadeList.innerHTML = `
                    <p class="px-6 py-6 text-center text-sm text-orange-500">
                        İade mesajları için <code class="text-yaziyo-gold">sql/039_paket_iptal_talepleri.sql</code> dosyasını çalıştırın.
                    </p>`;
            }
            return;
        }
        console.warn('İade talepleri yüklenemedi:', error);
        return;
    }
    iadeTalepleri = data || [];
    renderIadeTalepleri();
    updateIslemlerBadge();
}

async function loadAktifPaketler() {
    const { data, error } = await fetchAdminAktifSatinAlmalar();
    if (error) {
        console.warn('Aktif paketler yüklenemedi:', error);
        return;
    }
    aktifPaketler = data || [];
    renderAktifPaketler();
}

async function loadOperations() {
    await Promise.all([loadNotifications(), loadIadeTalepleri(), loadAktifPaketler()]);
}

function cancelLabelFor(satinAlmaId) {
    const iade = iadeTalepleri.find((t) => t.satinAlmaId === satinAlmaId);
    if (iade) return `${iade.paketAdi} — ${iade.kullaniciAdi}`;
    const aktif = aktifPaketler.find((p) => p.id === satinAlmaId);
    if (aktif) return `${aktif.paketAdi} — ${aktif.kullaniciAdi}`;
    return 'paket';
}

async function loadData() {
    els.tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-12 text-center text-sm text-light-text-secondary"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Yükleniyor...</td></tr>`;
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
        maxSales: clampField(els.fieldMaxSales.value, 1, 100, 100),
        validityDays: clampField(els.fieldValidityDays.value, 1, 3650, 30),
        yetkiler: readYetkilerFromForm(),
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

    els.btnYetkiAll?.addEventListener('click', () => setAllYetkiler(true));
    els.btnYetkiNone?.addEventListener('click', () => setAllYetkiler(false));

    els.btnRefresh?.addEventListener('click', async () => {
        await Promise.all([loadData(), loadOperations()]);
    });

    els.tabYonetim?.addEventListener('click', () => switchSection('yonetim'));
    els.tabIslemler?.addEventListener('click', () => switchSection('islemler'));
    window.addEventListener('hashchange', () => {
        switchSection(window.location.hash === '#islemler' ? 'islemler' : 'yonetim');
    });

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
            const msg = error.message || 'Kayıt başarısız';
            if (/max_satis|gecerlilik_gun|yetkiler|column/i.test(msg)) {
                showToast('Yeni alanlar için sql/024 ve sql/026 dosyalarını çalıştırın.', 'error');
            } else {
                showToast(msg, 'error');
            }
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

    els.notifList?.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-mark-notif]');
        if (!btn) return;
        const id = btn.dataset.markNotif;
        const { error } = await markAdminBildirimOkundu(id);
        if (error) {
            showToast(error.message || 'Bildirim güncellenemedi', 'error');
            return;
        }
        notifications = notifications.map((n) => (n.id === id ? { ...n, okundu: true } : n));
        renderNotifications();
        updateIslemlerBadge();
    });

    els.btnMarkAllNotif?.addEventListener('click', async () => {
        const { error } = await markAllAdminBildirimOkundu();
        if (error) {
            showToast(error.message || 'Bildirimler güncellenemedi', 'error');
            return;
        }
        notifications = notifications.map((n) => ({ ...n, okundu: true }));
        renderNotifications();
        updateIslemlerBadge();
        showToast('Tüm bildirimler okundu işaretlendi');
    });

    const onCancelClick = (e) => {
        const btn = e.target.closest('[data-cancel-satin]');
        if (!btn) return;
        openCancelModal(btn.dataset.cancelSatin, cancelLabelFor(btn.dataset.cancelSatin));
    };
    els.iadeList?.addEventListener('click', onCancelClick);
    els.aktifPaketList?.addEventListener('click', onCancelClick);

    els.btnConfirmCancelPaket?.addEventListener('click', async () => {
        if (!cancelTarget?.id) return;
        els.btnConfirmCancelPaket.disabled = true;
        const { error } = await cancelKullaniciPaketi(cancelTarget.id);
        els.btnConfirmCancelPaket.disabled = false;
        if (error) {
            showToast(error.message || 'Paket iptal edilemedi', 'error');
            return;
        }
        closeModal(els.cancelPaketModal);
        cancelTarget = null;
        showToast('Paket iptal edildi');
        await loadOperations();
        await loadData();
    });

    document.querySelectorAll('[data-close-cancel-modal]').forEach((btn) => {
        btn.addEventListener('click', () => closeModal(els.cancelPaketModal));
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
            const modal = btn.closest('#package-modal, #delete-modal, #cancel-paket-modal');
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
    els.fieldMaxSales = document.getElementById('field-max-sales');
    els.fieldValidityDays = document.getElementById('field-validity-days');
    els.fieldYetkiler = document.getElementById('field-yetkiler');
    els.btnYetkiAll = document.getElementById('btn-yetki-all');
    els.btnYetkiNone = document.getElementById('btn-yetki-none');
    els.fieldFeatured = document.getElementById('field-featured');
    els.fieldPopular = document.getElementById('field-popular');
    els.fieldActive = document.getElementById('field-active');
    els.fieldSort = document.getElementById('field-sort');
    els.notifList = document.getElementById('admin-notif-list');
    els.notifBadge = document.getElementById('notif-unread-badge');
    els.btnMarkAllNotif = document.getElementById('btn-mark-all-notif-read');
    els.tabYonetim = document.getElementById('tab-yonetim');
    els.tabIslemler = document.getElementById('tab-islemler');
    els.sectionYonetim = document.getElementById('section-yonetim');
    els.sectionIslemler = document.getElementById('section-islemler');
    els.islemlerBadge = document.getElementById('islemler-badge');
    els.iadeList = document.getElementById('admin-iade-list');
    els.iadeBadge = document.getElementById('iade-pending-badge');
    els.aktifPaketList = document.getElementById('admin-aktif-paket-list');
    els.cancelPaketModal = document.getElementById('cancel-paket-modal');
    els.cancelPaketMessage = document.getElementById('cancel-paket-message');
    els.btnConfirmCancelPaket = document.getElementById('btn-confirm-cancel-paket');
}

async function init() {
    if (!(await requireAdminAccess())) return;

    cacheElements();
    populateCategorySelect();
    bindEvents();
    resetForm();
    await Promise.all([loadData(), loadOperations()]);
    if (window.location.hash === '#islemler') switchSection('islemler');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
