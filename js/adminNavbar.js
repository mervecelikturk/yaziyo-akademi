/**
 * YAZİYO — Ortak admin header + navbar (tek kaynak)
 */
(function (global) {
    const SLUG_TO_ACTIVE = {
        admin: 'admin',
        kullanicilar: 'kullanicilar',
        'icerik-ekle': 'icerik-ekle',
        'sinav-ekle': 'sinav-ekle',
        'admin-haberler': 'admin-haberler',
        'admin-egitim-paketleri': 'admin-egitim-paketleri',
        'admin-sozlu-mulakat': 'admin-sozlu-mulakat',
        'admin-mulakat-simulasyonu': 'admin-mulakat-simulasyonu',
        mesajlar: 'mesajlar',
    };

    const MULAKAT_PAGES = ['admin-sozlu-mulakat', 'admin-mulakat-simulasyonu', 'admin-mulakatlar'];

    function getPaths() {
        return global.YaziyoPaths || {
            homeHref: () => '../../index.html',
            pageHref: (f) => `../${f}/`,
            assetHref: (r) => '../../' + r,
        };
    }

    function isAdminPage() {
        const header = document.getElementById('main-header');
        if (!header || header.dataset.yaziyoAdminHeader === 'off') return false;
        if (header.dataset.yaziyoAdminHeader === '1') return true;
        const menu = document.getElementById('desktop-menu');
        return !!menu?.querySelector(
            'a[data-page="admin"], a[data-page="kullanicilar"], a[data-page="icerik-ekle"]',
        );
    }

    function resolveActiveNav() {
        const fromBody = document.body?.dataset?.yaziyoAdminNavActive;
        if (fromBody) return fromBody;
        const fromHeader = document.getElementById('main-header')?.dataset?.yaziyoAdminNavActive;
        if (fromHeader) return fromHeader;
        const slug = global.YaziyoPaths?.currentPageSlug?.() || '';
        if (slug && SLUG_TO_ACTIVE[slug]) return SLUG_TO_ACTIVE[slug];
        return 'admin';
    }

    function ac(active, key) {
        return active === key ? ' active' : '';
    }

    function mulakatOpen(active) {
        return MULAKAT_PAGES.includes(active) ? ' open' : '';
    }

    function mulakatParentActive(active) {
        return MULAKAT_PAGES.includes(active) ? ' active' : '';
    }

    function linkSlug(href) {
        if (!href || href.startsWith('javascript')) return '';
        const parts = href.split('?')[0].split('#')[0].replace(/\/+$/, '').split('/').filter(Boolean);
        return (parts[parts.length - 1] || '').toLowerCase();
    }

    function resolveActiveFromHref(href) {
        return SLUG_TO_ACTIVE[linkSlug(href)] || '';
    }

    function resolveActiveFromLink(link) {
        if (!link) return '';
        if (link.dataset.page) return link.dataset.page;
        return resolveActiveFromHref(link.dataset.originalHref || link.getAttribute('href') || '');
    }

    function applyNavActive(activeKey) {
        const navbar = document.getElementById('main-navbar');
        if (!navbar) return;

        navbar.querySelectorAll(
            '.nav-link.active, .mobile-nav-link.active, .nav-dropdown-trigger.active, .mobile-dropdown-trigger.active',
        ).forEach((el) => el.classList.remove('active'));

        navbar.querySelectorAll(
            '.mobile-dropdown.open, .mobile-dropdown-menu.open, .mobile-dropdown-trigger.open',
        ).forEach((el) => el.classList.remove('open'));

        if (!activeKey) return;

        navbar.querySelectorAll(`[data-page="${activeKey}"]`).forEach((el) => {
            el.classList.add('active');
        });

        if (MULAKAT_PAGES.includes(activeKey)) {
            navbar.querySelectorAll('[data-page="admin-mulakatlar"]').forEach((el) => {
                el.classList.add('active');
                if (el.classList.contains('mobile-dropdown-trigger')) {
                    el.classList.add('open');
                    el.closest('.mobile-dropdown')?.classList.add('open');
                    el.nextElementSibling?.classList.add('open');
                }
            });
        }
    }

    function patchStaticNavActive() {
        if (!isAdminPage()) return;
        applyNavActive(resolveActiveNav());
    }

    function syncNavActive() {
        if (!isAdminPage()) return;
        applyNavActive(resolveActiveNav());
    }

    function closeMobileMenu() {
        const mobileMenu = document.getElementById('mobile-menu');
        const hamburgerIcon = document.getElementById('hamburger-icon');
        if (!mobileMenu) return;
        mobileMenu.classList.remove('open');
        mobileMenu.classList.add('hidden');
        hamburgerIcon?.classList.remove('fa-xmark');
        hamburgerIcon?.classList.add('fa-bars');
    }

    function handleNavClick(e) {
        if (!isAdminPage()) return;
        const link = e.target.closest(
            '#main-navbar a.nav-link, #main-navbar a.mobile-nav-link, #main-navbar a.nav-dropdown-item',
        );
        if (!link || link.classList.contains('disabled')) return;

        const href = link.getAttribute('href');
        if (!href || href.startsWith('javascript')) return;

        const activeKey = resolveActiveFromLink(link);
        if (activeKey) {
            applyNavActive(activeKey);
        }

        link.blur();

        if (link.closest('#mobile-menu')) {
            // Mobilde menüyü hemen kapatmak navigasyonu iptal edebilir — geciktir
            setTimeout(() => closeMobileMenu(), 300);
        }
    }

    let navClickBound = false;
    function bindNavClickHandler() {
        if (navClickBound) return;
        navClickBound = true;
        document.addEventListener('click', handleNavClick, false);
    }

    function buildAdminHeader(active) {
        const paths = getPaths();
        const home = paths.pageHref('admin.html');
        const logoSrc = paths.assetHref('images/logo.png');
        const p = (file) => paths.pageHref(file);

        return `
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between">
            <a href="${home}" class="yaziyo-header-logo flex items-center gap-2 group min-w-0 sm:max-w-none">
                <img src="${logoSrc}" alt="YAZİYO AKADEMİ Logo"
                    class="yaziyo-nav-logo w-auto object-contain rounded-lg transition-transform duration-300 group-hover:scale-105 shrink-0">
                <span class="yaziyo-brand-name truncate">YAZİYO AKADEMİ</span>
            </a>
            <div class="flex items-center gap-2 sm:gap-3 shrink-0">
                <button id="theme-toggle-btn" type="button"
                    class="yaziyo-header-icon-btn flex items-center justify-center rounded-lg border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card text-yaziyo-gold"
                    aria-label="Tema Değiştir">
                    <i class="fa-solid fa-sun theme-icon-sun"></i>
                    <i class="fa-solid fa-moon theme-icon-moon"></i>
                </button>
                <a href="${home}"
                    class="relative inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-poppins font-bold text-xs sm:text-sm rounded-lg transition-all duration-300 hover:shadow-[0_0_15px_rgba(249,115,22,0.4)] hover:scale-105 active:scale-95 shrink-0">
                    <i class="fa-solid fa-user-shield"></i>
                    <span class="hidden sm:inline">Admin</span>
                </a>
            </div>
        </div>
        <div class="w-full h-px bg-light-border dark:bg-dark-border transition-colors duration-300"></div>
        <nav id="main-navbar" class="bg-light-bg/80 dark:bg-dark-bg/80 backdrop-blur-md transition-colors duration-300">
            <div class="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
                <ul id="desktop-menu"
                    class="hidden lg:flex items-center justify-center gap-x-0.5 xl:gap-x-1 py-2 text-[9px] xl:text-[10px] 2xl:text-[11px] font-medium flex-nowrap">
                    <li><a href="${p('admin.html')}" class="nav-link${ac(active, 'admin')}" data-page="admin"><i class="fa-solid fa-gauge-high mr-1 text-[0.85em]"></i>Admin</a></li>
                    <li><a href="${p('kullanicilar.html')}" class="nav-link${ac(active, 'kullanicilar')}" data-page="kullanicilar"><i class="fa-solid fa-users mr-1 text-[0.85em]"></i>Kullanıcılar</a></li>
                    <li><a href="${p('icerikEkle.html')}" class="nav-link${ac(active, 'icerik-ekle')}" data-page="icerik-ekle"><i class="fa-solid fa-folder-plus mr-1 text-[0.85em]"></i>İçerik Ekle</a></li>
                    <li><a href="${p('sinavEkle.html')}" class="nav-link${ac(active, 'sinav-ekle')}" data-page="sinav-ekle"><i class="fa-solid fa-award mr-1 text-[0.85em]"></i>Sınav Ekle</a></li>
                    <li><a href="${p('adminHaberler.html')}" class="nav-link${ac(active, 'admin-haberler')}" data-page="admin-haberler"><i class="fa-solid fa-newspaper mr-1 text-[0.85em]"></i>Haberler</a></li>
                    <li><a href="${p('adminEgitimPaketleri.html')}" class="nav-link${ac(active, 'admin-egitim-paketleri')}" data-page="admin-egitim-paketleri"><i class="fa-solid fa-box-open mr-1 text-[0.85em]"></i>Eğitim Paketleri</a></li>
                    <li class="nav-dropdown">
                        <button type="button" class="nav-link nav-dropdown-trigger${mulakatParentActive(active)}" data-page="admin-mulakatlar"><i class="fa-solid fa-microphone-lines mr-1 text-[0.85em]"></i>Mülakatlar <i class="fa-solid fa-chevron-down nav-dropdown-chevron"></i></button>
                        <ul class="nav-dropdown-menu">
                            <li><a href="${p('adminSozluMulakat.html')}" class="nav-dropdown-item${ac(active, 'admin-sozlu-mulakat')}" data-page="admin-sozlu-mulakat">Sözlü Mülakat</a></li>
                            <li><a href="${p('adminMulakatSimulasyonu.html')}" class="nav-dropdown-item${ac(active, 'admin-mulakat-simulasyonu')}" data-page="admin-mulakat-simulasyonu">Mülakat Simülasyonu</a></li>
                        </ul>
                    </li>
                    <li><a href="${p('mesajlar.html')}" class="nav-link${ac(active, 'mesajlar')}" data-page="mesajlar"><i class="fa-solid fa-envelope mr-1 text-[0.85em]"></i>Mesajlar</a></li>
                </ul>
                <div class="lg:hidden flex items-center justify-between py-2">
                    <span class="yaziyo-mobile-menu-label text-sm font-inter">Admin Menü</span>
                    <button id="hamburger-btn" type="button"
                        class="yaziyo-hamburger-btn p-2 rounded-lg transition-colors duration-300"
                        aria-label="Menüyü aç/kapat">
                        <i class="fa-solid fa-bars text-xl" id="hamburger-icon"></i>
                    </button>
                </div>
                <div id="mobile-menu" class="lg:hidden hidden overflow-hidden transition-all duration-300">
                    <ul class="flex flex-col gap-1 pb-4 text-sm">
                        <li><a href="${p('admin.html')}" class="mobile-nav-link${ac(active, 'admin')}" data-page="admin"><i class="fa-solid fa-gauge-high mr-2"></i>Admin</a></li>
                        <li><a href="${p('kullanicilar.html')}" class="mobile-nav-link${ac(active, 'kullanicilar')}" data-page="kullanicilar"><i class="fa-solid fa-users mr-2"></i>Kullanıcılar</a></li>
                        <li><a href="${p('icerikEkle.html')}" class="mobile-nav-link${ac(active, 'icerik-ekle')}" data-page="icerik-ekle"><i class="fa-solid fa-folder-plus mr-2"></i>İçerik Ekle</a></li>
                        <li><a href="${p('sinavEkle.html')}" class="mobile-nav-link${ac(active, 'sinav-ekle')}" data-page="sinav-ekle"><i class="fa-solid fa-award mr-2"></i>Sınav Ekle</a></li>
                        <li><a href="${p('adminHaberler.html')}" class="mobile-nav-link${ac(active, 'admin-haberler')}" data-page="admin-haberler"><i class="fa-solid fa-newspaper mr-2"></i>Haberler</a></li>
                        <li><a href="${p('adminEgitimPaketleri.html')}" class="mobile-nav-link${ac(active, 'admin-egitim-paketleri')}" data-page="admin-egitim-paketleri"><i class="fa-solid fa-box-open mr-2"></i>Eğitim Paketleri</a></li>
                        <li class="mobile-dropdown${mulakatOpen(active)}">
                            <button type="button" class="mobile-nav-link mobile-dropdown-trigger${mulakatParentActive(active)} w-full text-left flex items-center justify-between" data-page="admin-mulakatlar">Mülakatlar <i class="fa-solid fa-chevron-down mobile-dropdown-chevron"></i></button>
                            <ul class="mobile-dropdown-menu${mulakatOpen(active)} flex flex-col gap-1 pl-3 pt-1">
                                <li><a href="${p('adminSozluMulakat.html')}" class="mobile-nav-link text-[0.8em]${ac(active, 'admin-sozlu-mulakat')}" data-page="admin-sozlu-mulakat">Sözlü Mülakat</a></li>
                                <li><a href="${p('adminMulakatSimulasyonu.html')}" class="mobile-nav-link text-[0.8em]${ac(active, 'admin-mulakat-simulasyonu')}" data-page="admin-mulakat-simulasyonu">Mülakat Simülasyonu</a></li>
                            </ul>
                        </li>
                        <li><a href="${p('mesajlar.html')}" class="mobile-nav-link${ac(active, 'mesajlar')}" data-page="mesajlar"><i class="fa-solid fa-envelope mr-2"></i>Mesajlar</a></li>
                    </ul>
                </div>
            </div>
        </nav>`;
    }

    function mountAdminHeader() {
        const header = document.getElementById('main-header');
        if (!header || !isAdminPage()) return false;
        if (header.dataset.yaziyoAdminHeaderMounted === '1') return true;

        const active = resolveActiveNav();
        header.innerHTML = buildAdminHeader(active);
        header.dataset.yaziyoAdminHeaderMounted = '1';
        header.classList.add('w-full', 'bg-light-bg/95', 'dark:bg-dark-bg/95', 'backdrop-blur-md', 'sticky', 'top-0', 'z-50', 'transition-colors', 'duration-300');
        applyNavActive(active);
        bindNavClickHandler();
        refreshMobileTables();
        if (window.YaziyoMobileMenu?.init) {
            window.YaziyoMobileMenu.init();
        }
        return true;
    }

    function boot() {
        return mountAdminHeader();
    }

    function getAdminMain() {
        const header = document.getElementById('main-header');
        if (!header) return null;
        const next = header.nextElementSibling;
        if (next?.tagName === 'MAIN') return next;
        return document.querySelector('#main-header[data-yaziyo-admin-header="1"] ~ main');
    }

    function enhanceAdminTablesForMobile() {
        const header = document.getElementById('main-header');
        if (!header || header.dataset.yaziyoAdminHeader !== '1') return;

        const main = getAdminMain();
        if (!main) return;

        main.querySelectorAll('table').forEach((table) => {
            if (table.closest('[data-admin-table-skip]')) return;

            const headers = [...table.querySelectorAll('thead th')].map((th) =>
                th.textContent.replace(/\s+/g, ' ').trim(),
            );

            table.querySelectorAll('tbody tr').forEach((tr) => {
                tr.querySelectorAll('td').forEach((td, i) => {
                    if (td.colSpan > 1) return;
                    if (!td.dataset.label && headers[i]) {
                        td.dataset.label = headers[i];
                    }
                });
            });

            table.classList.add('admin-responsive-table');
            const scrollWrap = table.closest('.overflow-x-auto');
            scrollWrap?.classList.add('admin-table-scroll');
            table.closest('.overflow-hidden')?.classList.add('admin-table-card');
        });
    }

    let refreshTablesTimer = null;
    function scheduleRefreshMobileTables() {
        if (refreshTablesTimer) window.clearTimeout(refreshTablesTimer);
        refreshTablesTimer = window.setTimeout(() => {
            refreshTablesTimer = null;
            refreshMobileTables();
        }, 50);
    }

    function refreshMobileTables() {
        enhanceAdminTablesForMobile();
        requestAnimationFrame(() => enhanceAdminTablesForMobile());
    }

    let adminTableObserver = null;
    function observeAdminTables() {
        enhanceAdminTablesForMobile();
        const main = getAdminMain();
        if (!main) return;

        if (adminTableObserver) adminTableObserver.disconnect();
        adminTableObserver = new MutationObserver(() => scheduleRefreshMobileTables());
        adminTableObserver.observe(main, { childList: true, subtree: true });
    }

    global.YaziyoAdminNavbar = {
        mount: mountAdminHeader,
        boot,
        resolveActiveNav,
        applyNavActive,
        syncNavActive,
        closeMobileMenu,
        enhanceAdminTablesForMobile,
        refreshMobileTables,
    };

    patchStaticNavActive();
    bindNavClickHandler();

    global.addEventListener('pageshow', (e) => {
        if (e.persisted) syncNavActive();
        scheduleRefreshMobileTables();
    });

    global.addEventListener('resize', scheduleRefreshMobileTables, { passive: true });

    if (document.getElementById('main-header') && isAdminPage()) {
        boot();
        observeAdminTables();
    } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            boot();
            observeAdminTables();
        });
    } else {
        observeAdminTables();
    }
}(window));
