/**
 * YAZİYO — Ortak admin header + navbar (tek kaynak)
 */
(function (global) {
    const FILE_TO_ACTIVE = {
        'admin.html': 'admin',
        'kullanicilar.html': 'kullanicilar',
        'icerikekle.html': 'icerik-ekle',
        'sinavekle.html': 'sinav-ekle',
        'adminhaberler.html': 'admin-haberler',
        'adminegitimpaketleri.html': 'admin-egitim-paketleri',
        'adminsozlumulakat.html': 'admin-sozlu-mulakat',
        'adminmulakatsimulasyonu.html': 'admin-mulakat-simulasyonu',
        'mesajlar.html': 'mesajlar',
    };

    const MULAKAT_PAGES = ['admin-sozlu-mulakat', 'admin-mulakat-simulasyonu', 'admin-mulakatlar'];

    function getPaths() {
        return global.YaziyoPaths || {
            homeHref: () => '../index.html',
            assetHref: (r) => '../' + r,
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
        const file = (global.location.pathname.split('/').pop() || 'admin.html').toLowerCase();
        return FILE_TO_ACTIVE[file] || 'admin';
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

    function buildAdminHeader(active) {
        const paths = getPaths();
        const home = paths.homeHref();
        const logoSrc = paths.assetHref('images/logo.png');

        return `
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between">
            <a href="${home}" class="flex items-center gap-2 group shrink-0 min-w-0">
                <img src="${logoSrc}" alt="YAZİYO Logo"
                    class="h-5 sm:h-6 w-auto object-contain rounded-lg border-2 border-yaziyo-gold transition-transform duration-300 group-hover:scale-105 shrink-0">
                <span class="font-poppins font-extrabold text-yaziyo-gold text-sm sm:text-base tracking-widest select-none truncate">YAZİYO</span>
            </a>
            <div class="flex items-center gap-2 sm:gap-3 shrink-0">
                <button id="theme-toggle-btn" type="button"
                    class="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card text-yaziyo-gold transition-all duration-300 hover:scale-110 hover:rotate-12 hover:border-yaziyo-gold"
                    aria-label="Tema Değiştir">
                    <i class="fa-solid fa-sun text-base sm:text-lg theme-icon-sun"></i>
                    <i class="fa-solid fa-moon text-base sm:text-lg theme-icon-moon"></i>
                </button>
                <a href="admin.html"
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
                    <li><a href="admin.html" class="nav-link${ac(active, 'admin')}" data-page="admin"><i class="fa-solid fa-gauge-high mr-1 text-[0.85em]"></i>Admin</a></li>
                    <li><a href="kullanicilar.html" class="nav-link${ac(active, 'kullanicilar')}" data-page="kullanicilar"><i class="fa-solid fa-users mr-1 text-[0.85em]"></i>Kullanıcılar</a></li>
                    <li><a href="icerikEkle.html" class="nav-link${ac(active, 'icerik-ekle')}" data-page="icerik-ekle"><i class="fa-solid fa-folder-plus mr-1 text-[0.85em]"></i>İçerik Ekle</a></li>
                    <li><a href="sinavEkle.html" class="nav-link${ac(active, 'sinav-ekle')}" data-page="sinav-ekle"><i class="fa-solid fa-award mr-1 text-[0.85em]"></i>Sınav Ekle</a></li>
                    <li><a href="adminHaberler.html" class="nav-link${ac(active, 'admin-haberler')}" data-page="admin-haberler"><i class="fa-solid fa-newspaper mr-1 text-[0.85em]"></i>Haberler</a></li>
                    <li><a href="adminEgitimPaketleri.html" class="nav-link${ac(active, 'admin-egitim-paketleri')}" data-page="admin-egitim-paketleri"><i class="fa-solid fa-box-open mr-1 text-[0.85em]"></i>Eğitim Paketleri</a></li>
                    <li class="nav-dropdown">
                        <button type="button" class="nav-link nav-dropdown-trigger${mulakatParentActive(active)}" data-page="admin-mulakatlar"><i class="fa-solid fa-microphone-lines mr-1 text-[0.85em]"></i>Mülakatlar <i class="fa-solid fa-chevron-down nav-dropdown-chevron"></i></button>
                        <ul class="nav-dropdown-menu">
                            <li><a href="adminSozluMulakat.html" class="nav-dropdown-item${ac(active, 'admin-sozlu-mulakat')}" data-page="admin-sozlu-mulakat">Sözlü Mülakat</a></li>
                            <li><a href="adminMulakatSimulasyonu.html" class="nav-dropdown-item${ac(active, 'admin-mulakat-simulasyonu')}" data-page="admin-mulakat-simulasyonu">Mülakat Simülasyonu</a></li>
                        </ul>
                    </li>
                    <li><a href="mesajlar.html" class="nav-link${ac(active, 'mesajlar')}" data-page="mesajlar"><i class="fa-solid fa-envelope mr-1 text-[0.85em]"></i>Mesajlar</a></li>
                </ul>
                <div class="lg:hidden flex items-center justify-between py-2">
                    <span class="text-light-text-secondary dark:text-dark-text-secondary text-sm font-inter">Admin Menü</span>
                    <button id="hamburger-btn" type="button"
                        class="text-light-text dark:text-dark-text p-2 rounded-lg hover:bg-light-card dark:hover:bg-dark-card transition-colors duration-300"
                        aria-label="Menüyü aç/kapat">
                        <i class="fa-solid fa-bars text-xl" id="hamburger-icon"></i>
                    </button>
                </div>
                <div id="mobile-menu" class="lg:hidden hidden overflow-hidden transition-all duration-300">
                    <ul class="flex flex-col gap-1 pb-4 text-sm">
                        <li><a href="admin.html" class="mobile-nav-link${ac(active, 'admin')}" data-page="admin"><i class="fa-solid fa-gauge-high mr-2"></i>Admin</a></li>
                        <li><a href="kullanicilar.html" class="mobile-nav-link${ac(active, 'kullanicilar')}" data-page="kullanicilar"><i class="fa-solid fa-users mr-2"></i>Kullanıcılar</a></li>
                        <li><a href="icerikEkle.html" class="mobile-nav-link${ac(active, 'icerik-ekle')}" data-page="icerik-ekle"><i class="fa-solid fa-folder-plus mr-2"></i>İçerik Ekle</a></li>
                        <li><a href="sinavEkle.html" class="mobile-nav-link${ac(active, 'sinav-ekle')}" data-page="sinav-ekle"><i class="fa-solid fa-award mr-2"></i>Sınav Ekle</a></li>
                        <li><a href="adminHaberler.html" class="mobile-nav-link${ac(active, 'admin-haberler')}" data-page="admin-haberler"><i class="fa-solid fa-newspaper mr-2"></i>Haberler</a></li>
                        <li><a href="adminEgitimPaketleri.html" class="mobile-nav-link${ac(active, 'admin-egitim-paketleri')}" data-page="admin-egitim-paketleri"><i class="fa-solid fa-box-open mr-2"></i>Eğitim Paketleri</a></li>
                        <li class="mobile-dropdown${mulakatOpen(active)}">
                            <button type="button" class="mobile-nav-link mobile-dropdown-trigger${mulakatParentActive(active)} w-full text-left flex items-center justify-between" data-page="admin-mulakatlar">Mülakatlar <i class="fa-solid fa-chevron-down mobile-dropdown-chevron"></i></button>
                            <ul class="mobile-dropdown-menu${mulakatOpen(active)} flex flex-col gap-1 pl-3 pt-1">
                                <li><a href="adminSozluMulakat.html" class="mobile-nav-link text-[0.8em]${ac(active, 'admin-sozlu-mulakat')}" data-page="admin-sozlu-mulakat">Sözlü Mülakat</a></li>
                                <li><a href="adminMulakatSimulasyonu.html" class="mobile-nav-link text-[0.8em]${ac(active, 'admin-mulakat-simulasyonu')}" data-page="admin-mulakat-simulasyonu">Mülakat Simülasyonu</a></li>
                            </ul>
                        </li>
                        <li><a href="mesajlar.html" class="mobile-nav-link${ac(active, 'mesajlar')}" data-page="mesajlar"><i class="fa-solid fa-envelope mr-2"></i>Mesajlar</a></li>
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
        return true;
    }

    function boot() {
        return mountAdminHeader();
    }

    global.YaziyoAdminNavbar = {
        mount: mountAdminHeader,
        boot,
        resolveActiveNav,
    };

    if (document.getElementById('main-header') && isAdminPage()) {
        boot();
    } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    }
}(window));
