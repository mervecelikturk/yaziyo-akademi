/**
 * YAZİYO — Eğitim Paketleri sayfası (Supabase)
 */
import {
    fetchPublishedPaketler,
    isTableMissingError,
    BADGE_OPTIONS
} from './lib/egitimPaketleriApi.js';

const COMPARISON = {
    plans: ['Temel', 'Pro', 'Premium'],
    rows: [
        { name: 'Video Ders', values: [true, true, true] },
        { name: 'AI Analiz', values: [false, true, true] },
        { name: 'Deneme Sınavı', values: [true, true, true] },
        { name: 'Özel Plan', values: [false, true, true] },
        { name: 'Mentor Desteği', values: [false, false, true] }
    ]
};

let PACKAGES = [];
let activeCategory = 'Tümü';
let searchQuery = '';
let sortBy = 'popular';
let selectedPackage = null;

const els = {};

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}

function badgeHtml(badge) {
    if (!badge) return '';
    const meta = BADGE_OPTIONS[badge];
    if (!meta) return `<span class="ep-badge">${escapeHtml(badge)}</span>`;
    return `<span class="${meta.cls}">${meta.label}</span>`;
}

function getFeatured() {
    const featured = PACKAGES.filter((p) => p.featured);
    if (featured.length) return featured[0];
    return PACKAGES[0] || null;
}

function getCategories() {
    const cats = new Set(PACKAGES.map((p) => p.category).filter(Boolean));
    return ['Tümü', ...Array.from(cats).sort((a, b) => a.localeCompare(b, 'tr'))];
}

function filterPackages() {
    const featured = getFeatured();
    let list = PACKAGES.filter((p) => !featured || p.id !== featured.id);

    if (activeCategory !== 'Tümü') {
        list = list.filter((p) => p.category === activeCategory);
    }

    const q = searchQuery.toLowerCase().trim();
    if (q) {
        list = list.filter((p) =>
            `${p.title} ${p.description} ${p.category}`.toLowerCase().includes(q));
    }

    list = [...list];
    if (sortBy === 'popular') {
        list.sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0) || b.price - a.price);
    } else if (sortBy === 'new') {
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } else if (sortBy === 'price-asc') {
        list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
        list.sort((a, b) => b.price - a.price);
    }

    return list;
}

function formatPrice(price) {
    const n = Number(price) || 0;
    if (n <= 0) return 'Ücretsiz';
    return `₺${n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;
}

function renderCategoryFilters() {
    const container = els.filterContainer;
    if (!container) return;

    const categories = getCategories();
    container.innerHTML = categories.map((cat) => `
        <button type="button" class="ep-filter-pill${cat === activeCategory ? ' ep-filter-pill-active' : ''}" data-category="${escapeHtml(cat)}">${escapeHtml(cat)}</button>
    `).join('');

    container.querySelectorAll('.ep-filter-pill').forEach((btn) => {
        btn.addEventListener('click', () => setCategory(btn.dataset.category));
    });
}

function renderFeatured() {
    const p = getFeatured();
    const section = els.featuredSection;
    const el = els.featured;
    if (!el) return;

    if (!p) {
        section?.classList.add('hidden');
        el.innerHTML = '';
        return;
    }

    section?.classList.remove('hidden');
    const cover = p.coverUrl
        ? `<img src="${escapeHtml(p.coverUrl)}" alt="" class="w-full h-full object-cover rounded-3xl">`
        : `<div class="w-40 h-40 sm:w-52 sm:h-52 rounded-3xl ep-glass flex flex-col items-center justify-center shadow-2xl border border-yaziyo-gold/20">
                <i class="fa-solid fa-graduation-cap text-5xl sm:text-6xl text-yaziyo-gold mb-2"></i>
                <span class="text-xs font-bold uppercase tracking-wider text-light-text-secondary">${escapeHtml(p.category)}</span>
           </div>`;

    el.innerHTML = `
        <div class="ep-featured-inner grid grid-cols-1 lg:grid-cols-2">
            <div class="p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
                <span class="inline-flex self-start items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-yaziyo-gold/15 text-yaziyo-gold border border-yaziyo-gold/30 mb-4">
                    <i class="fa-solid fa-fire"></i> Öne Çıkan Paket
                </span>
                <h2 class="font-poppins font-bold text-2xl sm:text-3xl text-light-text dark:text-dark-text mb-3">${escapeHtml(p.title)}</h2>
                <p class="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-6 leading-relaxed">${escapeHtml(p.description)}</p>
                <ul class="space-y-2 mb-8">
                    ${(p.features || []).slice(0, 5).map((f) => `
                        <li class="flex items-center gap-2 text-sm text-light-text dark:text-dark-text">
                            <i class="fa-solid fa-circle-check text-yaziyo-gold text-xs"></i>${escapeHtml(f)}
                        </li>`).join('')}
                </ul>
                <div class="flex flex-wrap items-center gap-4">
                    <span class="text-2xl font-poppins font-bold text-yaziyo-gold">${formatPrice(p.price)}</span>
                    <button type="button" class="ep-cta-pulse inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yaziyo-gold to-yellow-600 text-slate-900 font-poppins font-bold rounded-xl hover:shadow-glow-gold transition-all" data-package-start="${p.id}">
                        İncele <i class="fa-solid fa-arrow-right"></i>
                    </button>
                </div>
            </div>
            <div class="relative min-h-[220px] lg:min-h-full bg-gradient-to-br from-yaziyo-gold/10 via-blue-500/5 to-transparent flex items-center justify-center p-8 overflow-hidden">
                <div class="ep-float relative max-w-xs w-full aspect-square flex items-center justify-center">${cover}</div>
            </div>
        </div>`;
}

function renderGrid() {
    const list = filterPackages();
    const grid = els.grid;
    const empty = els.gridEmpty;
    const packagesSection = els.packagesSection;
    if (!grid) return;

    if (!PACKAGES.length) {
        grid.innerHTML = '';
        packagesSection?.classList.remove('hidden');
        empty?.classList.remove('hidden');
        if (empty) empty.textContent = 'Henüz eğitim paketi eklenmedi. Yakında burada olacak.';
        return;
    }

    if (!list.length) {
        grid.innerHTML = '';
        empty?.classList.remove('hidden');
        if (empty) empty.textContent = 'Aramanızla eşleşen paket bulunamadı.';
        return;
    }

    empty?.classList.add('hidden');

    grid.innerHTML = list.map((p, i) => `
        <article class="ep-package-card ep-reveal" data-package-id="${p.id}" style="transition-delay: ${Math.min(i * 50, 300)}ms">
            <div class="flex items-start justify-between gap-2 mb-3">
                ${badgeHtml(p.badge)}
                <span class="text-[10px] font-bold uppercase text-light-text-secondary">${escapeHtml(p.category)}</span>
            </div>
            <h3 class="font-poppins font-bold text-lg text-light-text dark:text-dark-text mb-2 line-clamp-2">${escapeHtml(p.title)}</h3>
            <p class="text-sm text-light-text-secondary dark:text-dark-text-secondary line-clamp-2 mb-4 flex-grow">${escapeHtml(p.description)}</p>
            <ul class="space-y-1.5 mb-4">
                ${(p.features || []).slice(0, 4).map((f) => `
                    <li class="text-xs text-light-text-secondary flex items-start gap-1.5">
                        <i class="fa-solid fa-check text-yaziyo-gold mt-0.5 text-[10px]"></i><span class="line-clamp-1">${escapeHtml(f)}</span>
                    </li>`).join('')}
            </ul>
            <div class="pt-4 border-t border-light-border dark:border-dark-border flex items-center justify-between gap-3">
                <div>
                    <span class="text-2xl font-poppins font-bold text-yaziyo-gold">${formatPrice(p.price)}</span>
                    ${p.price > 0 ? '<span class="text-[10px] text-light-text-secondary block">tek sefer</span>' : ''}
                </div>
                <button type="button" class="px-4 py-2 rounded-lg border border-yaziyo-gold/40 text-yaziyo-gold text-sm font-bold hover:bg-yaziyo-gold hover:text-slate-900 transition-all" data-package-open="${p.id}">
                    İncele
                </button>
            </div>
        </article>
    `).join('');

    observeReveal();
}

function renderComparison() {
    const el = els.compareWrap;
    const section = els.comparisonSection;
    if (!el) return;

    if (!PACKAGES.length) {
        section?.classList.add('hidden');
        return;
    }
    section?.classList.remove('hidden');

    const planHeaders = COMPARISON.plans.map((plan) => `
        <th class="text-center font-poppins font-bold text-sm ${plan === 'Pro' ? 'text-yaziyo-gold' : ''}">${escapeHtml(plan)}</th>`).join('');

    const rows = COMPARISON.rows.map((row) => `
        <tr>
            <td>${escapeHtml(row.name)}</td>
            ${row.values.map((v, i) => `
                <td class="text-center ${COMPARISON.plans[i] === 'Pro' ? 'bg-yaziyo-gold/5' : ''}">
                    ${v ? '<i class="fa-solid fa-circle-check text-green-500"></i>' : '<i class="fa-solid fa-xmark text-red-400/70"></i>'}
                </td>`).join('')}
        </tr>`).join('');

    el.innerHTML = `
        <table class="ep-compare-table w-full text-sm">
            <thead>
                <tr class="bg-light-bg/50 dark:bg-dark-bg/50">
                    <th class="text-left text-light-text-secondary text-xs uppercase">Özellik</th>
                    ${planHeaders}
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}

function openDrawer(pkg) {
    selectedPackage = pkg;
    const drawer = els.drawer;
    if (!drawer || !pkg) return;

    els.drawerTitle.textContent = pkg.title;
    els.drawerDesc.textContent = pkg.description;
    els.drawerPrice.textContent = formatPrice(pkg.price);
    els.drawerModules.innerHTML = (pkg.modules || []).length
        ? (pkg.modules || []).map((m) => `
            <li class="flex items-center gap-2 text-sm py-2 border-b border-light-border dark:border-dark-border last:border-0">
                <i class="fa-solid fa-layer-group text-yaziyo-gold text-xs"></i>${escapeHtml(m)}
            </li>`).join('')
        : '<li class="text-sm text-light-text-secondary py-2">Modül bilgisi eklenmemiş.</li>';
    els.drawerLearn.innerHTML = (pkg.learn || []).length
        ? (pkg.learn || []).map((l) => `
            <li class="flex items-start gap-2 text-sm text-light-text-secondary">
                <i class="fa-solid fa-lightbulb text-yaziyo-gold mt-1 text-xs"></i>${escapeHtml(l)}
            </li>`).join('')
        : '<li class="text-sm text-light-text-secondary">Henüz öğrenme hedefi eklenmemiş.</li>';

    if (pkg.contentUrl) {
        els.drawerCta.textContent = 'Pakete Git';
        els.drawerCta.dataset.href = pkg.contentUrl;
    } else {
        els.drawerCta.textContent = 'Satın Al / Başla';
        delete els.drawerCta.dataset.href;
    }

    drawer.classList.add('ep-drawer-open');
    document.body.style.overflow = 'hidden';
}

function closeDrawer() {
    els.drawer?.classList.remove('ep-drawer-open');
    document.body.style.overflow = '';
    selectedPackage = null;
}

function setCategory(cat) {
    activeCategory = cat;
    renderCategoryFilters();
    renderGrid();
}

function observeReveal() {
    const nodes = document.querySelectorAll('.ep-reveal:not(.ep-revealed)');
    if (!('IntersectionObserver' in window)) {
        nodes.forEach((n) => n.classList.add('ep-revealed'));
        return;
    }
    const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('ep-revealed');
                io.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    nodes.forEach((n) => io.observe(n));
}

function scrollToSection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function bindEvents() {
    els.search?.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderGrid();
    });

    els.sort?.addEventListener('change', (e) => {
        sortBy = e.target.value;
        renderGrid();
    });

    els.btnExplore?.addEventListener('click', () => scrollToSection('ep-packages'));
    els.btnCompare?.addEventListener('click', () => scrollToSection('ep-comparison'));

    document.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('[data-package-open], [data-package-start]');
        if (actionBtn) {
            e.preventDefault();
            e.stopPropagation();
            const id = actionBtn.dataset.packageOpen || actionBtn.dataset.packageStart;
            const pkg = PACKAGES.find((p) => p.id === id);
            if (pkg) openDrawer(pkg);
            return;
        }
        const card = e.target.closest('.ep-package-card');
        if (card?.dataset.packageId) {
            const pkg = PACKAGES.find((p) => p.id === card.dataset.packageId);
            if (pkg) openDrawer(pkg);
        }
    });

    els.drawerClose?.addEventListener('click', closeDrawer);
    els.drawerBackdrop?.addEventListener('click', closeDrawer);
    els.drawerCta?.addEventListener('click', () => {
        if (!selectedPackage) return;
        if (els.drawerCta.dataset.href) {
            window.open(els.drawerCta.dataset.href, '_blank', 'noopener');
            return;
        }
        showToast(`${selectedPackage.title} — ödeme yakında aktif olacak.`);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDrawer();
    });
}

function showToast(msg) {
    const t = els.toast;
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('hidden', 'opacity-0');
    setTimeout(() => t.classList.add('opacity-0'), 2800);
    setTimeout(() => t.classList.add('hidden'), 3200);
}

function showSetupBanner() {
    const grid = els.grid;
    if (!grid) return;
    grid.innerHTML = `
        <div class="col-span-full max-w-xl mx-auto text-center py-12 px-6 rounded-2xl border border-orange-500/20 bg-orange-500/5">
            <i class="fa-solid fa-database text-3xl text-orange-500 mb-3"></i>
            <p class="text-sm text-light-text-secondary">Paketler yüklenemedi. Veritabanı kurulumu gerekebilir.</p>
        </div>`;
}

function cacheElements() {
    els.featuredSection = document.getElementById('ep-featured-section');
    els.featured = document.getElementById('ep-featured');
    els.grid = document.getElementById('ep-package-grid');
    els.gridEmpty = document.getElementById('ep-grid-empty');
    els.packagesSection = document.getElementById('ep-packages');
    els.filterContainer = document.getElementById('ep-category-filters');
    els.search = document.getElementById('ep-search');
    els.sort = document.getElementById('ep-sort');
    els.btnExplore = document.getElementById('ep-btn-explore');
    els.btnCompare = document.getElementById('ep-btn-compare');
    els.compareWrap = document.getElementById('ep-compare-table-wrap');
    els.comparisonSection = document.getElementById('ep-comparison');
    els.drawer = document.getElementById('ep-drawer');
    els.drawerBackdrop = document.getElementById('ep-drawer-backdrop');
    els.drawerClose = document.getElementById('ep-drawer-close');
    els.drawerTitle = document.getElementById('ep-drawer-title');
    els.drawerDesc = document.getElementById('ep-drawer-desc');
    els.drawerPrice = document.getElementById('ep-drawer-price');
    els.drawerModules = document.getElementById('ep-drawer-modules');
    els.drawerLearn = document.getElementById('ep-drawer-learn');
    els.drawerCta = document.getElementById('ep-drawer-cta');
    els.toast = document.getElementById('ep-toast');
}

async function loadPackages() {
    const { data, error } = await fetchPublishedPaketler();
    if (error) {
        console.error('Eğitim paketleri yükleme hatası:', error);
        if (isTableMissingError(error)) showSetupBanner();
        return;
    }
    PACKAGES = data || [];
}

async function init() {
    cacheElements();
    bindEvents();
    await loadPackages();
    renderCategoryFilters();
    renderFeatured();
    renderGrid();
    renderComparison();
    observeReveal();
    document.querySelectorAll('.ep-reveal-static').forEach((n) => n.classList.add('ep-revealed'));
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
