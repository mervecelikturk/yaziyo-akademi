/**
 * YAZİYO — Haberler sayfası (Supabase)
 */
import {
    HABER_CATEGORIES,
    fetchPublishedHaberler,
    incrementHaberViews,
    isTableMissingError,
    resolveSourceUrl
} from './lib/haberlerApi.js';

let NEWS = [];
let RESMI_GAZETE = [];
let activeFilter = 'all';

const els = {};

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
}

function getCatMeta(category) {
    return HABER_CATEGORIES[category] || { label: category, badgeClass: 'haber-badge-blue' };
}

function matchesFilter(item) {
    if (activeFilter === 'all') return true;
    return item.category === activeFilter;
}

function getFeatured() {
    const featured = NEWS.filter((n) => n.featured);
    if (featured.length) {
        return featured.sort((a, b) => (b.publishDate || '').localeCompare(a.publishDate || ''))[0];
    }
    return NEWS[0] || null;
}

function renderStatusBadges(item) {
    let html = '';
    if (item.isNew) {
        html += '<span class="haber-badge-yeni"><i class="fa-solid fa-sparkles text-[9px]"></i> Yeni</span>';
    }
    if (item.pinned) {
        html += '<span class="haber-badge-pinned"><i class="fa-solid fa-thumbtack text-[9px]"></i> Önemli</span>';
    }
    return html;
}

function renderFeatured(item) {
    if (!item || !els.featured) {
        if (els.featured) els.featured.innerHTML = '';
        return;
    }
    const cat = getCatMeta(item.category);
    els.featured.innerHTML = `
        <article class="haber-featured-card group" data-reveal>
            <div class="haber-featured-glow"></div>
            <div class="haber-featured-inner">
                <div class="haber-featured-visual bg-gradient-to-br ${item.imageGradient}">
                    <div class="absolute inset-0 bg-gradient-to-t from-dark-bg via-dark-bg/40 to-transparent"></div>
                    <div class="absolute top-4 left-4 flex flex-wrap gap-2 z-10">
                        <span class="haber-cat-badge ${cat.badgeClass}">${escapeHtml(cat.label)}</span>
                        ${renderStatusBadges(item)}
                    </div>
                    <div class="absolute bottom-0 left-0 right-0 p-6 sm:p-8 z-10">
                        <h2 class="font-poppins font-bold text-xl sm:text-2xl lg:text-3xl text-white mb-3 leading-tight">${escapeHtml(item.title)}</h2>
                        <p class="font-inter text-sm sm:text-base text-dark-text-secondary/90 max-w-2xl line-clamp-2">${escapeHtml(item.excerpt)}</p>
                    </div>
                    <div class="absolute inset-0 flex items-center justify-center opacity-20">
                        <i class="fa-solid fa-newspaper text-[8rem] text-white"></i>
                    </div>
                </div>
                <div class="haber-featured-body">
                    <p class="text-light-text-secondary dark:text-dark-text-secondary text-sm leading-relaxed mb-6">${escapeHtml(item.excerpt)}</p>
                    <div class="flex flex-wrap items-center gap-4 text-xs text-light-text-secondary dark:text-dark-text-secondary mb-6">
                        <span><i class="fa-regular fa-calendar text-yaziyo-gold mr-1"></i>${escapeHtml(item.date)}</span>
                    </div>
                    <button type="button" class="haber-btn-primary" data-read="${item.id}">
                        Devamını Oku <i class="fa-solid fa-arrow-right ml-2 text-sm"></i>
                    </button>
                </div>
            </div>
        </article>`;
}

function renderNewsCard(item) {
    const cat = getCatMeta(item.category);
    return `
        <article class="haber-news-card group" data-category="${item.category}" data-reveal>
            <div class="haber-news-card-visual bg-gradient-to-br ${item.imageGradient} relative h-36 sm:h-40">
                <div class="absolute inset-0 bg-gradient-to-t from-dark-card/90 to-transparent"></div>
                <span class="haber-cat-badge ${cat.badgeClass} absolute top-3 left-3 z-10">${escapeHtml(cat.label)}</span>
                <div class="absolute top-3 right-3 flex flex-col gap-1 items-end z-10">${renderStatusBadges(item)}</div>
            </div>
            <div class="haber-news-card-body">
                <h3 class="font-poppins font-bold text-base sm:text-lg text-light-text dark:text-dark-text mb-2 line-clamp-2 group-hover:text-yaziyo-gold transition-colors duration-300">${escapeHtml(item.title)}</h3>
                <p class="font-inter text-sm text-light-text-secondary dark:text-dark-text-secondary line-clamp-3 mb-4 flex-grow">${escapeHtml(item.excerpt)}</p>
                <div class="flex flex-wrap gap-3 text-[11px] text-light-text-secondary dark:text-dark-text-secondary border-t border-light-border dark:border-dark-border pt-4 mb-4">
                    <span><i class="fa-regular fa-calendar text-yaziyo-gold mr-1"></i>${escapeHtml(item.date)}</span>
                </div>
                <button type="button" class="haber-btn-outline w-full justify-center" data-read="${item.id}">Devamını Oku</button>
            </div>
        </article>`;
}

function renderRgCard(item) {
    const pdfAttr = item.pdfUrl ? `data-pdf-url="${escapeHtml(item.pdfUrl)}"` : '';
    return `
        <article class="haber-rg-card" data-reveal data-rg-id="${item.id}">
            <div class="haber-rg-paper"></div>
            <div class="haber-rg-icon"><i class="fa-solid fa-file-pdf"></i></div>
            <div class="flex-grow min-w-0">
                <div class="flex flex-wrap items-center gap-2 mb-2">
                    <span class="font-poppins font-bold text-yaziyo-gold text-sm">Karar ${escapeHtml(item.kararNo)}</span>
                    <span class="haber-rg-cat">${escapeHtml(item.category)}</span>
                </div>
                <p class="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-2">
                    <i class="fa-regular fa-calendar mr-1"></i>${escapeHtml(item.date)}
                </p>
                <p class="font-inter text-sm text-light-text-secondary dark:text-dark-text-secondary line-clamp-2">${escapeHtml(item.excerpt)}</p>
            </div>
            <button type="button" class="haber-btn-rg shrink-0" ${pdfAttr}>
                <i class="fa-solid fa-file-pdf"></i> Tam Metni Aç
            </button>
        </article>`;
}

function renderGrid() {
    const featured = getFeatured();
    const showFeatured = featured && (activeFilter === 'all' || featured.category === activeFilter);
    const list = NEWS.filter((n) => {
        if (n.featured && showFeatured) return false;
        return matchesFilter(n);
    });

    if (!NEWS.length) {
        if (els.featured) els.featured.innerHTML = '';
        els.grid.innerHTML = '';
        els.emptyState?.classList.remove('hidden');
        return;
    }

    renderFeatured(showFeatured ? featured : null);

    if (list.length === 0) {
        els.grid.innerHTML = '';
        els.emptyState?.classList.remove('hidden');
    } else {
        els.emptyState?.classList.add('hidden');
        els.grid.innerHTML = list.map(renderNewsCard).join('');
    }

    observeReveal();
}

function showEmptyState(message) {
    if (els.skeletonWrap) els.skeletonWrap.classList.add('hidden');
    if (els.contentWrap) {
        els.contentWrap.classList.remove('opacity-0', 'pointer-events-none');
        els.contentWrap.classList.add('opacity-100');
    }
    if (els.featured) els.featured.innerHTML = '';
    if (els.grid) {
        els.grid.innerHTML = `
            <div class="col-span-full py-16 text-center rounded-2xl border border-dashed border-light-border dark:border-dark-border bg-light-card/50 dark:bg-dark-card/50 px-6">
                <i class="fa-solid fa-database text-4xl text-yaziyo-gold/50 mb-4"></i>
                <p class="text-sm text-light-text-secondary dark:text-dark-text-secondary max-w-md mx-auto">${escapeHtml(message)}</p>
            </div>`;
    }
    if (els.rgGrid) els.rgGrid.innerHTML = '';
}

function setFilter(filter) {
    activeFilter = filter;
    els.filterBtns.forEach((btn) => {
        const isActive = btn.dataset.filter === filter;
        btn.classList.toggle('haber-filter-active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    renderGrid();
}

function observeReveal() {
    const nodes = document.querySelectorAll('[data-reveal]:not(.haber-revealed)');
    if (!('IntersectionObserver' in window)) {
        nodes.forEach((n) => n.classList.add('haber-revealed'));
        return;
    }
    const io = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('haber-revealed');
                    io.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    nodes.forEach((n) => io.observe(n));
}

function showSkeleton(show) {
    if (!els.skeletonWrap || !els.contentWrap) return;
    els.skeletonWrap.classList.toggle('hidden', !show);
    els.contentWrap.classList.toggle('opacity-0', show);
    els.contentWrap.classList.toggle('opacity-100', !show);
    els.contentWrap.classList.toggle('pointer-events-none', show);
}

function bindFilters() {
    els.filterBtns.forEach((btn) => {
        btn.addEventListener('click', () => setFilter(btn.dataset.filter));
    });
}

function openHaberModal(item) {
    const modal = document.getElementById('haber-read-modal');
    const backdrop = document.getElementById('haber-read-backdrop');
    const panel = document.getElementById('haber-read-panel');
    const hero = document.getElementById('haber-modal-hero');
    const badgesContainer = document.getElementById('haber-modal-badges');
    const titleEl = document.getElementById('haber-modal-title');
    const metaEl = document.getElementById('haber-modal-meta');
    const bodyEl = document.getElementById('haber-modal-body');

    if (!modal || !item) return;

    const cat = getCatMeta(item.category);
    if (hero) {
        hero.className = `haber-modal-hero relative shrink-0 h-36 sm:h-44 bg-gradient-to-br ${item.imageGradient}`;
    }
    if (badgesContainer) {
        badgesContainer.innerHTML = `
            <span class="haber-cat-badge ${cat.badgeClass}">${escapeHtml(cat.label)}</span>
            ${renderStatusBadges(item)}`;
    }

    titleEl.textContent = item.title;
    metaEl.innerHTML = `
        <span><i class="fa-regular fa-calendar text-yaziyo-gold mr-1"></i>${escapeHtml(item.date)}</span>`;

    const bodyText = (item.content || '').trim() || item.excerpt || '';
    bodyEl.textContent = bodyText;

    const sourceWrap = document.getElementById('haber-modal-source');
    const sourceLink = document.getElementById('haber-modal-source-link');
    const sourceText = document.getElementById('haber-modal-source-text');
    const sourceUrl = resolveSourceUrl(item);
    if (sourceWrap && sourceLink && sourceText) {
        if (sourceUrl) {
            sourceLink.href = sourceUrl;
            sourceText.textContent = sourceUrl;
            sourceWrap.classList.remove('hidden');
        } else {
            sourceLink.removeAttribute('href');
            sourceText.textContent = '';
            sourceWrap.classList.add('hidden');
        }
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(() => {
        backdrop?.classList.remove('opacity-0');
        panel?.classList.remove('scale-95', 'opacity-0');
        panel?.classList.add('scale-100', 'opacity-100');
    });
}

function closeHaberModal() {
    const modal = document.getElementById('haber-read-modal');
    const backdrop = document.getElementById('haber-read-backdrop');
    const panel = document.getElementById('haber-read-panel');
    if (!modal) return;

    backdrop?.classList.add('opacity-0');
    panel?.classList.remove('scale-100', 'opacity-100');
    panel?.classList.add('scale-95', 'opacity-0');

    setTimeout(() => {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }, 280);
}

function bindReadActions() {
    const modal = document.getElementById('haber-read-modal');
    const backdrop = document.getElementById('haber-read-backdrop');
    document.getElementById('haber-read-close')?.addEventListener('click', closeHaberModal);
    document.getElementById('haber-read-close-btn')?.addEventListener('click', closeHaberModal);
    backdrop?.addEventListener('click', closeHaberModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            closeHaberModal();
        }
    });

    document.addEventListener('click', async (e) => {
        const readBtn = e.target.closest('[data-read]');
        if (readBtn) {
            e.preventDefault();
            const id = readBtn.dataset.read;
            const item = NEWS.find((n) => n.id === id);
            if (item) {
                openHaberModal(item);
                await incrementHaberViews(id);
            }
            return;
        }

        const pdfBtn = e.target.closest('[data-pdf-url]');
        if (pdfBtn?.dataset.pdfUrl) {
            e.preventDefault();
            window.open(pdfBtn.dataset.pdfUrl, '_blank', 'noopener,noreferrer');
        }
    });
}

async function loadHaberler() {
    showSkeleton(true);

    const { news, resmiGazete, error } = await fetchPublishedHaberler();

    if (error) {
        showSkeleton(false);
        if (isTableMissingError(error)) {
            showEmptyState('Haberler henüz yapılandırılmadı. Yönetici panelinden içerik eklenebilir.');
        } else {
            showEmptyState('Haberler yüklenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
            console.error(error);
        }
        return;
    }

    NEWS = news;
    RESMI_GAZETE = resmiGazete;

    if (els.rgGrid) {
        els.rgGrid.innerHTML = RESMI_GAZETE.length
            ? RESMI_GAZETE.map(renderRgCard).join('')
            : '<p class="text-sm text-center text-light-text-secondary py-8">Henüz Resmî Gazete kaydı yok.</p>';
    }

    showSkeleton(false);
    renderGrid();
    observeReveal();
}

function init() {
    els.featured = document.getElementById('haber-featured');
    els.grid = document.getElementById('haber-news-grid');
    els.rgGrid = document.getElementById('haber-rg-grid');
    els.skeletonWrap = document.getElementById('haber-skeleton');
    els.contentWrap = document.getElementById('haber-content');
    els.emptyState = document.getElementById('haber-empty');
    els.filterBtns = document.querySelectorAll('.haber-filter-btn');

    if (!els.grid) return;

    bindFilters();
    bindReadActions();
    loadHaberler();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
