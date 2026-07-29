/**
 * YAZİYO — Eğitim Paketleri sayfası (Supabase)
 */
import {
    fetchPublishedPaketler,
    isTableMissingError,
    isPaketSoldOut,
    purchasePaket,
    ratingStarsHtml,
    BADGE_OPTIONS
} from './lib/egitimPaketleriApi.js';

let PACKAGES = [];
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

function listPackages() {
    const featured = getFeatured();
    return PACKAGES.filter((p) => !featured || p.id !== featured.id);
}

function formatPrice(price) {
    const n = Number(price) || 0;
    if (n <= 0) return 'Ücretsiz';
    return `₺${n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;
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
                <h2 class="font-poppins font-bold text-2xl sm:text-3xl text-light-text dark:text-dark-text mb-3 break-words">${escapeHtml(p.title)}</h2>
                ${ratingStarsHtml(p.ratingAvg, p.ratingCount, { size: 'lg' }) ? `<div class="mb-3">${ratingStarsHtml(p.ratingAvg, p.ratingCount, { size: 'lg' })}</div>` : ''}
                <p class="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-6 leading-relaxed break-words">${escapeHtml(p.description)}</p>
                <ul class="space-y-2 mb-8">
                    ${(p.features || []).slice(0, 5).map((f) => `
                        <li class="flex items-start gap-2 text-sm text-light-text dark:text-dark-text min-w-0">
                            <i class="fa-solid fa-circle-check text-yaziyo-gold text-xs mt-1 shrink-0"></i><span class="break-words">${escapeHtml(f)}</span>
                        </li>`).join('')}
                </ul>
                <div class="flex flex-wrap items-center gap-4">
                    <span class="text-xl sm:text-2xl font-poppins font-bold text-yaziyo-gold break-all">${formatPrice(p.price)}</span>
                    <button type="button" class="ep-cta-pulse inline-flex items-center justify-center gap-2 min-h-11 px-6 py-3 bg-gradient-to-r from-yaziyo-gold to-yellow-600 text-slate-900 font-poppins font-bold rounded-xl hover:shadow-glow-gold transition-all" data-package-start="${p.id}">
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
    const list = listPackages();
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
        empty?.classList.add('hidden');
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
            ${ratingStarsHtml(p.ratingAvg, p.ratingCount) ? `<div class="mb-2">${ratingStarsHtml(p.ratingAvg, p.ratingCount)}</div>` : ''}
            <p class="text-sm text-light-text-secondary dark:text-dark-text-secondary line-clamp-2 mb-4 flex-grow">${escapeHtml(p.description)}</p>
            <ul class="space-y-1.5 mb-4">
                ${(p.features || []).slice(0, 4).map((f) => `
                    <li class="text-xs text-light-text-secondary flex items-start gap-1.5">
                        <i class="fa-solid fa-check text-yaziyo-gold mt-0.5 text-[10px]"></i><span class="line-clamp-1">${escapeHtml(f)}</span>
                    </li>`).join('')}
            </ul>
            <div class="pt-4 border-t border-light-border dark:border-dark-border flex flex-wrap items-center justify-between gap-3">
                <div class="min-w-0">
                    <span class="text-xl sm:text-2xl font-poppins font-bold text-yaziyo-gold break-all">${formatPrice(p.price)}</span>
                    ${p.price > 0 ? '<span class="text-[10px] text-light-text-secondary block">tek sefer</span>' : ''}
                </div>
                <button type="button" class="shrink-0 min-h-10 px-4 py-2 rounded-lg border border-yaziyo-gold/40 text-yaziyo-gold text-sm font-bold hover:bg-yaziyo-gold hover:text-slate-900 transition-all" data-package-open="${p.id}">
                    İncele
                </button>
            </div>
        </article>
    `).join('');

    observeReveal();
}

function openDrawer(pkg) {
    selectedPackage = pkg;
    const drawer = els.drawer;
    if (!drawer || !pkg) return;

    const soldOut = isPaketSoldOut(pkg);
    const days = pkg.validityDays || 30;

    els.drawerTitle.textContent = pkg.title;
    els.drawerDesc.textContent = pkg.description;
    els.drawerPrice.textContent = formatPrice(pkg.price);
    if (els.drawerRating) {
        const html = ratingStarsHtml(pkg.ratingAvg, pkg.ratingCount, { size: 'lg' });
        if (html) {
            els.drawerRating.innerHTML = `<p class="text-[10px] font-bold uppercase tracking-widest text-yaziyo-gold mb-2">Kullanıcı Değerlendirmesi</p>${html}`;
            els.drawerRating.classList.remove('hidden');
        } else {
            els.drawerRating.innerHTML = '';
            els.drawerRating.classList.add('hidden');
        }
    }
    if (els.drawerValidity) {
        els.drawerValidity.textContent = soldOut
            ? 'Bu paket için kontenjan dolmuştur.'
            : `Satın alındıktan sonra ${days} gün boyunca geçerlidir.`;
    }
    els.drawerModules.innerHTML = (pkg.modules || []).length
        ? (pkg.modules || []).map((m) => `
            <li class="flex items-start gap-2 text-sm py-2 border-b border-light-border dark:border-dark-border last:border-0 min-w-0">
                <i class="fa-solid fa-layer-group text-yaziyo-gold text-xs mt-1 shrink-0"></i><span class="break-words min-w-0">${escapeHtml(m)}</span>
            </li>`).join('')
        : '<li class="text-sm text-light-text-secondary py-2">Modül bilgisi eklenmemiş.</li>';
    els.drawerLearn.innerHTML = (pkg.learn || []).length
        ? (pkg.learn || []).map((l) => `
            <li class="flex items-start gap-2 text-sm text-light-text-secondary min-w-0">
                <i class="fa-solid fa-lightbulb text-yaziyo-gold mt-1 text-xs shrink-0"></i><span class="break-words min-w-0">${escapeHtml(l)}</span>
            </li>`).join('')
        : '<li class="text-sm text-light-text-secondary">Henüz öğrenme hedefi eklenmemiş.</li>';

    if (soldOut) {
        els.drawerCta.textContent = 'Kontenjan dolu';
        els.drawerCta.disabled = true;
        els.drawerCta.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        els.drawerCta.textContent = 'Satın Al / Başla';
        els.drawerCta.disabled = false;
        els.drawerCta.classList.remove('opacity-50', 'cursor-not-allowed');
    }
    delete els.drawerCta.dataset.href;
    if (pkg.contentUrl) {
        els.drawerCta.dataset.contentUrl = pkg.contentUrl;
    } else {
        delete els.drawerCta.dataset.contentUrl;
    }

    drawer.classList.add('ep-drawer-open');
    document.body.style.overflow = 'hidden';
}

function getLoginRedirectUrl() {
    const next = encodeURIComponent(window.location.href);
    return `../giris-kayit/?redirect=${next}`;
}

async function handlePurchaseClick() {
    if (!selectedPackage) return;

    if (isPaketSoldOut(selectedPackage)) {
        showToast('Şu an aktif değil.', 'error');
        return;
    }

    els.drawerCta.disabled = true;
    const prevLabel = els.drawerCta.textContent;
    els.drawerCta.textContent = 'İşleniyor...';

    try {
        const { data, error } = await purchasePaket(selectedPackage.id);

        if (error) {
            showToast(error.message || 'Satın alma başarısız.', 'error');
            return;
        }

        if (!data?.success) {
            if (data?.code === 'auth') {
                showToast('Satın almak için giriş yapmalısınız.');
                setTimeout(() => {
                    window.location.href = getLoginRedirectUrl();
                }, 900);
                return;
            }
            showToast(data?.message || 'Şu an aktif değil.', 'error');
            if (data?.code === 'sold_out' || data?.code === 'inactive') {
                selectedPackage.salesCount = selectedPackage.maxSales;
                const idx = PACKAGES.findIndex((p) => p.id === selectedPackage.id);
                if (idx >= 0) PACKAGES[idx] = { ...PACKAGES[idx], salesCount: PACKAGES[idx].maxSales };
                if (els.drawerValidity) {
                    els.drawerValidity.textContent = 'Bu paket için kontenjan dolmuştur.';
                }
            }
            return;
        }

        selectedPackage.salesCount = (selectedPackage.salesCount || 0) + 1;
        const idx = PACKAGES.findIndex((p) => p.id === selectedPackage.id);
        if (idx >= 0) {
            PACKAGES[idx] = {
                ...PACKAGES[idx],
                salesCount: (PACKAGES[idx].salesCount || 0) + 1
            };
        }

        const days = data.gecerlilik_gun || selectedPackage.validityDays || 30;
        showToast(`${selectedPackage.title} satın alındı — ${days} gün geçerli.`);

        const contentUrl = data.icerik_url || selectedPackage.contentUrl || els.drawerCta.dataset.contentUrl;
        if (contentUrl) {
            window.open(contentUrl, '_blank', 'noopener');
        }
    } finally {
        els.drawerCta.disabled = false;
        els.drawerCta.textContent = prevLabel;
    }
}

function closeDrawer() {
    els.drawer?.classList.remove('ep-drawer-open');
    document.body.style.overflow = '';
    selectedPackage = null;
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
    els.btnExplore?.addEventListener('click', () => scrollToSection('ep-packages'));

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
        handlePurchaseClick();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDrawer();
    });
}

function showToast(msg, type = 'success') {
    const t = els.toast;
    if (!t) return;
    t.textContent = msg;
    t.className = `fixed left-4 right-4 bottom-4 sm:left-auto sm:right-6 sm:bottom-6 max-w-sm z-[130] px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl transition-opacity ${
        type === 'error'
            ? 'bg-red-500 text-white border border-red-400'
            : 'bg-yaziyo-card border border-yaziyo-border'
    }`;
    t.style.bottom = 'max(1rem, env(safe-area-inset-bottom, 0px))';
    t.classList.remove('hidden', 'opacity-0');
    clearTimeout(showToast._t1);
    clearTimeout(showToast._t2);
    showToast._t1 = setTimeout(() => t.classList.add('opacity-0'), 2800);
    showToast._t2 = setTimeout(() => t.classList.add('hidden'), 3200);
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
    els.btnExplore = document.getElementById('ep-btn-explore');
    els.drawer = document.getElementById('ep-drawer');
    els.drawerBackdrop = document.getElementById('ep-drawer-backdrop');
    els.drawerClose = document.getElementById('ep-drawer-close');
    els.drawerTitle = document.getElementById('ep-drawer-title');
    els.drawerDesc = document.getElementById('ep-drawer-desc');
    els.drawerRating = document.getElementById('ep-drawer-rating');
    els.drawerPrice = document.getElementById('ep-drawer-price');
    els.drawerValidity = document.getElementById('ep-drawer-validity');
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
    renderFeatured();
    renderGrid();
    observeReveal();
    document.querySelectorAll('.ep-reveal-static').forEach((n) => n.classList.add('ep-revealed'));
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
