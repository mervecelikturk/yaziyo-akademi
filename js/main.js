/* ============================================ */
/* YAZİYO - Ana JavaScript Dosyası              */
/* Zabıt Katipliği Çalışma Platformu            */
/* ============================================ */

function closeMobileMenuUi() {
    if (window.YaziyoSiteNavbar?.closeMobileMenu) {
        window.YaziyoSiteNavbar.closeMobileMenu();
        return;
    }
    if (window.YaziyoAdminNavbar?.closeMobileMenu) {
        window.YaziyoAdminNavbar.closeMobileMenu();
        return;
    }
    const mobileMenu = document.getElementById('mobile-menu');
    const hamburgerIcon = document.getElementById('hamburger-icon');
    if (!mobileMenu) return;
    mobileMenu.classList.remove('open');
    mobileMenu.classList.add('hidden');
    hamburgerIcon?.classList.remove('fa-xmark');
    hamburgerIcon?.classList.add('fa-bars');
}

function openMobileMenuUi() {
    const mobileMenu = document.getElementById('mobile-menu');
    const hamburgerIcon = document.getElementById('hamburger-icon');
    if (!mobileMenu) return;

    if (window.YaziyoSiteNavbar?.syncNavActive) {
        window.YaziyoSiteNavbar.syncNavActive();
    } else if (window.YaziyoAdminNavbar?.syncNavActive) {
        window.YaziyoAdminNavbar.syncNavActive();
    }

    mobileMenu.classList.remove('hidden');
    requestAnimationFrame(() => {
        mobileMenu.classList.add('open');
    });
    hamburgerIcon?.classList.remove('fa-bars');
    hamburgerIcon?.classList.add('fa-xmark');
}

let mobileMenuUiBound = false;

function initMobileMenuUi() {
    if (mobileMenuUiBound) return;
    mobileMenuUiBound = true;

    document.addEventListener('click', (e) => {
        const hamburgerBtn = e.target.closest('#hamburger-btn');
        if (hamburgerBtn) {
            e.stopPropagation();
            const mobileMenu = document.getElementById('mobile-menu');
            if (!mobileMenu) return;

            if (mobileMenu.classList.contains('open')) {
                closeMobileMenuUi();
            } else {
                openMobileMenuUi();
            }
            return;
        }

        const trigger = e.target.closest('.mobile-dropdown-trigger');
        if (trigger) {
            e.stopPropagation();
            const menu = trigger.nextElementSibling;
            if (!menu) return;
            const isOpen = menu.classList.contains('open');

            document.querySelectorAll('.mobile-dropdown-menu.open').forEach((m) => {
                m.classList.remove('open');
                m.previousElementSibling?.classList.remove('open');
            });

            if (!isOpen) {
                menu.classList.add('open');
                trigger.classList.add('open');
            }
            return;
        }

        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu?.classList.contains('open') && !mobileMenu.contains(e.target)) {
            closeMobileMenuUi();
        }
    });
}

window.YaziyoMobileMenu = {
    init: initMobileMenuUi,
    close: closeMobileMenuUi,
    open: openMobileMenuUi,
};

document.addEventListener('DOMContentLoaded', () => {

    if (window.YaziyoAdminNavbar) {
        window.YaziyoAdminNavbar.boot();
    }

    if (window.YaziyoSiteNavbar) {
        window.YaziyoSiteNavbar.boot();
    }

    initMobileMenuUi();

    /* ============================================ */
    /* GECE/GÜNDÜZ MODU KONTROLÜ                   */
    /* ============================================ */
    const themeToggleBtn = document.getElementById('theme-toggle-btn');

    function toggleTheme() {
        document.documentElement.classList.add('theme-transition');

        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('yaziyo-theme', isDark ? 'dark' : 'light');

        setTimeout(() => {
            document.documentElement.classList.remove('theme-transition');
        }, 350);
    }
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    window.addEventListener('storage', (event) => {
        if (event.key === 'yaziyo-theme') {
            document.documentElement.classList.add('theme-transition');
            if (event.newValue === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            setTimeout(() => {
                document.documentElement.classList.remove('theme-transition');
            }, 350);
        }
    });

    /* ============================================ */
    /* HEADER SCROLL ETKİSİ                        */
    /* ============================================ */
    const header = document.getElementById('main-header');

    if (header) {
        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;

            if (currentScrollY > 50) {
                header.classList.add('shadow-lg', 'shadow-black/20');
            } else {
                header.classList.remove('shadow-lg', 'shadow-black/20');
            }
        }, { passive: true });
    }

    /* ============================================ */
    /* SAYFA AKTİF/PASİF DURUMU (Admin ayarları)   */
    /* ============================================ */
    if (window.YaziyoPageStatus) {
        window.YaziyoPageStatus.applyToNavbar();
    }

});
