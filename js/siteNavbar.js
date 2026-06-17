/**
 * YAZİYO — Ortak site header + navbar (tek kaynak)
 * İletişim sayfası yapısı referans alınır; mobil menü tüm sayfalarda aynıdır.
 */
(function (global) {
    function getPaths() {
        return global.YaziyoPaths || {
            homeHref: () => '../index.html',
            pageHref: (f) => f,
            assetHref: (r) => '../' + r,
        };
    }

    const FILE_TO_ACTIVE = {
        'index.html': 'anasayfa',
        'profil.html': 'profil',
        'hiztesti.html': 'klavye-calismalari',
        'klavyecalismasi.html': 'klavye-calismalari',
        'ozelmetincalismasi.html': 'klavye-calismalari',
        'klavyesinavi.html': 'klavye-calismalari',
        'kelimeevi.html': 'oyunlar',
        'arabayarisi.html': 'oyunlar',
        'klavyeduellosu.html': 'oyunlar',
        'sozlumulakat.html': 'mulakatlar',
        'mulakatsimulasyonu.html': 'mulakatlar',
        'becayis.html': 'becayis',
        'egitimpaketleri.html': 'egitim-paketleri',
        'haberler.html': 'haberler',
        'kpsscalismasi.html': 'kpss-calismasi',
        'iletisim.html': 'iletisim',
        'giriskayit.html': '',
        'sifresifirla.html': '',
    };

    function isAdminNavbar() {
        const menu = document.getElementById('desktop-menu');
        if (!menu) return false;
        return !!menu.querySelector(
            'a[data-page="admin"], a[data-page^="admin-"], a[data-page="kullanicilar"], a[data-page="icerik-ekle"]',
        );
    }

    function resolveActiveNav() {
        const fromBody = document.body?.dataset?.yaziyoNavActive;
        if (fromBody) return fromBody;
        const fromHeader = document.getElementById('main-header')?.dataset?.yaziyoNavActive;
        if (fromHeader) return fromHeader;
        const file = (global.location.pathname.split('/').pop() || 'index.html').toLowerCase();
        return FILE_TO_ACTIVE[file] || '';
    }

    function ac(active, key) {
        return active === key ? ' active' : '';
    }

    function mobOpen(active, key) {
        return active === key ? ' open' : '';
    }

    function buildHeaderInner(active) {
        const paths = getPaths();
        const home = paths.homeHref();
        const logoSrc = paths.assetHref('images/logo.png');
        const girisKayit = paths.pageHref('girisKayit.html');
        return `
        <div class="yaziyo-header-bar max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between gap-2">
            <a href="${home}" class="yaziyo-header-logo flex items-center gap-2 group shrink-0 min-w-0" id="logo-link">
                <img src="${logoSrc}" alt="YAZİYO Logo"
                    class="h-5 sm:h-6 w-auto object-contain rounded-lg border-2 border-yaziyo-gold transition-transform duration-300 group-hover:scale-105 shrink-0"
                    id="header-logo">
                <span class="font-poppins font-extrabold text-yaziyo-gold text-sm sm:text-base tracking-widest select-none truncate">YAZİYO</span>
            </a>
            <div class="yaziyo-header-actions flex items-center justify-end min-w-0">
                <div class="relative group yaziyo-header-icon-wrap">
                    <button id="theme-toggle-btn" type="button" class="yaziyo-header-icon-btn flex items-center justify-center rounded-lg border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card text-yaziyo-gold transition-all duration-300 hover:scale-110 hover:rotate-12 hover:border-yaziyo-gold hover:shadow-glow-gold active:scale-95" aria-label="Tema Değiştir">
                        <i class="fa-solid fa-sun theme-icon-sun"></i>
                        <i class="fa-solid fa-moon theme-icon-moon"></i>
                    </button>
                    <span class="yaziyo-header-tooltip">Tema Değiştir</span>
                </div>
                <div class="relative group yaziyo-header-icon-wrap">
                    <button id="notification-btn" type="button" class="yaziyo-header-icon-btn flex relative items-center justify-center rounded-lg border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card text-light-text-secondary dark:text-dark-text-secondary transition-all duration-300 hover:scale-110 hover:text-yaziyo-gold hover:border-yaziyo-gold hover:shadow-glow-gold active:scale-95" aria-label="Bildirimler">
                        <i class="fa-solid fa-bell"></i>
                        <span class="absolute top-1.5 right-1.5 w-[7px] h-[7px] sm:top-2 sm:right-2 sm:w-[8px] sm:h-[8px] bg-red-500 rounded-full border border-light-card dark:border-dark-card shadow-[0_0_8px_rgba(239,68,68,0.6)] hidden"></span>
                    </button>
                    <span class="yaziyo-header-tooltip">Bildirimler</span>
                </div>
                <div class="relative group yaziyo-header-streak yaziyo-header-icon-wrap">
                    <div class="yaziyo-header-streak-badge flex items-center gap-1 rounded-lg border border-yaziyo-border bg-yaziyo-card cursor-not-allowed select-none">
                        <i class="fa-solid fa-fire text-orange-400"></i>
                        <span id="streak-count" class="font-poppins font-bold text-orange-400">0</span>
                    </div>
                    <span class="yaziyo-header-tooltip">Günlük Seri</span>
                </div>
                <a href="${girisKayit}" id="auth-button" class="yaziyo-auth-btn inline-flex items-center justify-center bg-gradient-to-r from-yaziyo-gold to-yellow-600 text-slate-900 font-poppins font-bold rounded-lg transition-all duration-300 hover:shadow-glow-gold hover:scale-105 active:scale-95 shrink-0" aria-label="Giriş yap veya kayıt ol">
                    <i class="fa-solid fa-right-to-bracket yaziyo-auth-btn-icon" aria-hidden="true"></i>
                    <span class="yaziyo-auth-btn-text yaziyo-auth-btn-text--full">Giriş Yap / Kayıt Ol</span>
                    <span class="yaziyo-auth-btn-text yaziyo-auth-btn-text--short">Giriş</span>
                </a>
            </div>
        </div>
        <div class="w-full h-px bg-light-border dark:bg-dark-border transition-colors duration-300"></div>
        <nav id="main-navbar" class="bg-light-bg/80 dark:bg-dark-bg/80 backdrop-blur-md transition-colors duration-300">
            <div class="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
                <ul id="desktop-menu" class="hidden lg:flex items-center justify-center gap-x-0.5 xl:gap-x-1 py-2 text-[9px] xl:text-[10px] 2xl:text-[11px] font-medium flex-nowrap">
                    <li><a href="${home}" class="nav-link${ac(active, 'anasayfa')}" data-page="anasayfa">Ana Sayfa</a></li>
                    <li><a href="${paths.pageHref('profil.html')}" class="nav-link${ac(active, 'profil')}" data-page="profil">Profil</a></li>
                    <li class="nav-dropdown">
                        <button type="button" class="nav-link nav-dropdown-trigger${ac(active, 'klavye-calismalari')}" data-page="klavye-calismalari">Klavye Çalışmaları <i class="fa-solid fa-chevron-down nav-dropdown-chevron"></i></button>
                        <ul class="nav-dropdown-menu">
                            <li><a href="${paths.pageHref('hizTesti.html')}" class="nav-dropdown-item">Hız Testi</a></li>
                            <li><a href="${paths.pageHref('klavyeCalismasi.html')}" class="nav-dropdown-item">Klavye Çalışması</a></li>
                            <li><a href="${paths.pageHref('ozelMetinCalismasi.html')}" class="nav-dropdown-item">Özel Metin Çalışması</a></li>
                            <li><a href="javascript:void(0)" class="nav-dropdown-item disabled">Klavye Sınavı</a></li>
                        </ul>
                    </li>
                    <li class="nav-dropdown">
                        <button type="button" class="nav-link nav-dropdown-trigger${ac(active, 'oyunlar')}" data-page="oyunlar">Oyunlar <i class="fa-solid fa-chevron-down nav-dropdown-chevron"></i></button>
                        <ul class="nav-dropdown-menu">
                            <li><a href="javascript:void(0)" class="nav-dropdown-item disabled cursor-not-allowed">Klavye Düellosu</a></li>
                            <li><a href="${paths.pageHref('kelimeEvi.html')}" class="nav-dropdown-item">Kelime Evi</a></li>
                            <li><a href="${paths.pageHref('arabaYarisi.html')}" class="nav-dropdown-item">Araba Yarışı</a></li>
                        </ul>
                    </li>
                    <li class="nav-dropdown">
                        <button type="button" class="nav-link nav-dropdown-trigger${ac(active, 'mulakatlar')}" data-page="mulakatlar">Mülakatlar <i class="fa-solid fa-chevron-down nav-dropdown-chevron"></i></button>
                        <ul class="nav-dropdown-menu">
                            <li><a href="javascript:void(0)" class="nav-dropdown-item disabled">Sözlü Mülakat</a></li>
                            <li><a href="javascript:void(0)" class="nav-dropdown-item disabled">Mülakat Simülasyonu</a></li>
                        </ul>
                    </li>
                    <li><a href="javascript:void(0)" class="nav-link disabled${ac(active, 'becayis')}" data-page="becayis">Becayiş</a></li>
                    <li><a href="javascript:void(0)" class="nav-link disabled${ac(active, 'egitim-paketleri')}" data-page="egitim-paketleri">Eğitim Paketleri</a></li>
                    <li><a href="javascript:void(0)" class="nav-link disabled${ac(active, 'haberler')}" data-page="haberler">Haberler</a></li>
                    <li><a href="${paths.pageHref('kpssCalismasi.html')}" class="nav-link${ac(active, 'kpss-calismasi')}" data-page="kpss-calismasi">KPSS Çalışması</a></li>
                    <li><a href="${paths.pageHref('iletisim.html')}" class="nav-link${ac(active, 'iletisim')}" data-page="iletisim">İletişim</a></li>
                </ul>
                <div class="lg:hidden flex items-center justify-between py-2">
                    <span class="text-light-text-secondary dark:text-dark-text-secondary text-sm font-inter transition-colors duration-300">Menü</span>
                    <button id="hamburger-btn" type="button" class="text-light-text dark:text-dark-text p-2 rounded-lg hover:bg-light-card dark:hover:bg-dark-card transition-colors duration-300" aria-label="Menüyü aç/kapat">
                        <i class="fa-solid fa-bars text-xl" id="hamburger-icon"></i>
                    </button>
                </div>
                <div id="mobile-menu" class="lg:hidden hidden overflow-hidden transition-all duration-300">
                    <ul class="flex flex-col gap-1 pb-4 text-sm">
                        <li><a href="${home}" class="mobile-nav-link${ac(active, 'anasayfa')}" data-page="anasayfa">Ana Sayfa</a></li>
                        <li><a href="${paths.pageHref('profil.html')}" class="mobile-nav-link${ac(active, 'profil')}" data-page="profil">Profil</a></li>
                        <li class="mobile-dropdown${mobOpen(active, 'klavye-calismalari')}">
                            <button type="button" class="mobile-nav-link mobile-dropdown-trigger${ac(active, 'klavye-calismalari')} w-full text-left flex items-center justify-between" data-page="klavye-calismalari">Klavye Çalışmaları <i class="fa-solid fa-chevron-down mobile-dropdown-chevron"></i></button>
                            <ul class="mobile-dropdown-menu${mobOpen(active, 'klavye-calismalari')} flex flex-col gap-1 pl-3 pt-1">
                                <li><a href="${paths.pageHref('hizTesti.html')}" class="mobile-nav-link text-[0.8em]">Hız Testi</a></li>
                                <li><a href="${paths.pageHref('klavyeCalismasi.html')}" class="mobile-nav-link text-[0.8em]">Klavye Çalışması</a></li>
                                <li><a href="${paths.pageHref('ozelMetinCalismasi.html')}" class="mobile-nav-link text-[0.8em]">Özel Metin Çalışması</a></li>
                                <li><a href="javascript:void(0)" class="mobile-nav-link disabled text-[0.8em]">Klavye Sınavı</a></li>
                            </ul>
                        </li>
                        <li class="mobile-dropdown${mobOpen(active, 'oyunlar')}">
                            <button type="button" class="mobile-nav-link mobile-dropdown-trigger${ac(active, 'oyunlar')} w-full text-left flex items-center justify-between" data-page="oyunlar">Oyunlar <i class="fa-solid fa-chevron-down mobile-dropdown-chevron"></i></button>
                            <ul class="mobile-dropdown-menu${mobOpen(active, 'oyunlar')} flex flex-col gap-1 pl-3 pt-1">
                                <li><a href="javascript:void(0)" class="mobile-nav-link disabled text-[0.8em] cursor-not-allowed">Klavye Düellosu</a></li>
                                <li><a href="${paths.pageHref('kelimeEvi.html')}" class="mobile-nav-link text-[0.8em]">Kelime Evi</a></li>
                                <li><a href="${paths.pageHref('arabaYarisi.html')}" class="mobile-nav-link text-[0.8em]">Araba Yarışı</a></li>
                            </ul>
                        </li>
                        <li class="mobile-dropdown${mobOpen(active, 'mulakatlar')}">
                            <button type="button" class="mobile-nav-link mobile-dropdown-trigger${ac(active, 'mulakatlar')} w-full text-left flex items-center justify-between" data-page="mulakatlar">Mülakatlar <i class="fa-solid fa-chevron-down mobile-dropdown-chevron"></i></button>
                            <ul class="mobile-dropdown-menu${mobOpen(active, 'mulakatlar')} flex flex-col gap-1 pl-3 pt-1">
                                <li><a href="javascript:void(0)" class="mobile-nav-link disabled text-[0.8em]">Sözlü Mülakat</a></li>
                                <li><a href="javascript:void(0)" class="mobile-nav-link disabled text-[0.8em]">Mülakat Simülasyonu</a></li>
                            </ul>
                        </li>
                        <li><a href="javascript:void(0)" class="mobile-nav-link disabled${ac(active, 'becayis')}" data-page="becayis">Becayiş</a></li>
                        <li><a href="javascript:void(0)" class="mobile-nav-link disabled${ac(active, 'egitim-paketleri')}" data-page="egitim-paketleri">Eğitim Paketleri</a></li>
                        <li><a href="javascript:void(0)" class="mobile-nav-link disabled${ac(active, 'haberler')}" data-page="haberler">Haberler</a></li>
                        <li><a href="${paths.pageHref('kpssCalismasi.html')}" class="mobile-nav-link${ac(active, 'kpss-calismasi')}" data-page="kpss-calismasi">KPSS Çalışması</a></li>
                        <li><a href="${paths.pageHref('iletisim.html')}" class="mobile-nav-link${ac(active, 'iletisim')}" data-page="iletisim">İletişim</a></li>
                    </ul>
                </div>
            </div>
        </nav>`;
    }

    function mountSharedHeader() {
        const header = document.getElementById('main-header');
        if (!header || header.dataset.yaziyoSharedHeader === 'off') return false;
        if (header.dataset.yaziyoSharedHeaderMounted === '1') return true;
        if (isAdminNavbar()) return false;

        const active = resolveActiveNav();
        header.innerHTML = buildHeaderInner(active);
        header.dataset.yaziyoSharedHeaderMounted = '1';
        return true;
    }

    function boot() {
        const mounted = mountSharedHeader();
        if (mounted && global.YaziyoPageStatus) {
            global.YaziyoPageStatus.applyToNavbar();
        }
        return mounted;
    }

    global.YaziyoSiteNavbar = {
        mount: mountSharedHeader,
        boot,
        resolveActiveNav,
    };

    if (document.getElementById('main-header')) {
        boot();
    } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
}(window));
