/* ============================================ */
/* YAZİYO - Sayfa Aktif/Pasif Yönetimi         */
/* ============================================ */

(function (global) {
    const STORAGE_KEY = 'yaziyo-page-status';

    const PAGES = [
        { id: 'anasayfa', label: 'Ana Sayfa', href: 'index.html', defaultActive: true },
        { id: 'profil', label: 'Profil', href: 'profil.html', defaultActive: true },
        { id: 'hiz-testi', label: 'Hız Testi', href: 'hizTesti.html', defaultActive: true },
        { id: 'klavye-calismasi', label: 'Klavye Çalışması', href: 'klavyeCalismasi.html', defaultActive: true },
        { id: 'ozel-metin-calismasi', label: 'Özel Metin Çalışması', href: 'ozelMetinCalismasi.html', defaultActive: true },
        { id: 'klavye-sinavi', label: 'Klavye Sınavı', navLabel: 'Klavye Sınavı', href: 'klavyeSinavi.html', defaultActive: false },
        { id: 'klavye-duellosu', label: 'Klavye Düellosu', navLabel: 'Klavye Düellosu', href: 'klavyeDuellosu.html', defaultActive: true },
        { id: 'kelime-evi', label: 'Kelime Evi', navLabel: 'Kelime Evi', href: 'kelimeEvi.html', defaultActive: false },
        { id: 'araba-yarisi', label: 'Araba Yarışı', navLabel: 'Araba Yarışı', href: 'arabaYarisi.html', defaultActive: true },
        { id: 'sozlu-mulakat', label: 'Sözlü Mülakat', navLabel: 'Sözlü Mülakat', href: 'sozluMulakat.html', defaultActive: true },
        { id: 'mulakat-simulasyonu', label: 'Mülakat Simülasyonu', navLabel: 'Mülakat Simülasyonu', href: 'mulakatSimulasyonu.html', defaultActive: true },
        { id: 'becayis', label: 'Becayiş', href: 'becayis.html', defaultActive: true },
        { id: 'egitim-paketleri', label: 'Eğitim Paketleri', href: 'egitimPaketleri.html', defaultActive: true },
        { id: 'haberler', label: 'Haberler', href: 'haberler.html', defaultActive: false },
        { id: 'kpss-calismasi', label: 'KPSS Çalışması', href: 'kpssCalismasi.html', defaultActive: true },
        { id: 'iletisim', label: 'İletişim', href: 'iletisim.html', defaultActive: true }
    ];

    function getDefaults() {
        return PAGES.reduce((acc, page) => {
            acc[page.id] = page.defaultActive;
            return acc;
        }, {});
    }

    function getStatus() {
        const defaults = getDefaults();
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return { ...defaults };
            const parsed = JSON.parse(saved);
            const merged = { ...defaults };
            PAGES.forEach((page) => {
                if (Object.prototype.hasOwnProperty.call(parsed, page.id)) {
                    merged[page.id] = parsed[page.id];
                }
            });
            return merged;
        } catch {
            return { ...defaults };
        }
    }

    function setPageActive(pageId, active) {
        const status = getStatus();
        status[pageId] = active;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(status));
        return status;
    }

    function isPageActive(pageId) {
        return getStatus()[pageId] !== false;
    }

    function normalizeNavText(el) {
        return (el?.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function linkBasename(href) {
        if (!href || href.startsWith('javascript')) return '';
        return href.split('?')[0].split('#')[0].split('/').pop().toLowerCase();
    }

    function hrefMatchesPage(linkHref, pageHref) {
        return linkBasename(linkHref) === linkBasename(pageHref);
    }

    /** Yönetici paneli menüsü (admin.html ve alt sayfalar) */
    function isAdminPanelNavbar() {
        const menu = document.getElementById('desktop-menu');
        if (!menu) return false;
        return !!menu.querySelector(
            'a[data-page="admin"], a[data-page^="admin-"], a[data-page="kullanicilar"], a[data-page="icerik-ekle"]'
        );
    }

    /** Admin paneli linkleri kullanıcı sayfa durumundan etkilenmemeli */
    function isProtectedAdminNavLink(link) {
        const href = (link.dataset.originalHref || link.getAttribute('href') || '').toLowerCase();
        const pageId = (link.dataset.page || '').toLowerCase();
        const base = linkBasename(href);
        return (
            base.startsWith('admin')
            || pageId === 'admin'
            || pageId.startsWith('admin-')
            || ['kullanicilar', 'icerik-ekle', 'sinav-ekle', 'mesajlar', 'admin-haberler'].includes(pageId)
        );
    }

    function ensureOriginalHrefs() {
        document.querySelectorAll('#main-navbar a[href]').forEach((link) => {
            const href = link.getAttribute('href');
            if (href && !href.startsWith('javascript') && !link.dataset.originalHref) {
                link.dataset.originalHref = href;
            }
        });
    }

    function disableLink(link) {
        if (!link.dataset.originalHref) {
            const href = link.getAttribute('href');
            if (href && !href.startsWith('javascript')) {
                link.dataset.originalHref = href;
            }
        }
        link.setAttribute('href', 'javascript:void(0)');
        link.classList.add('disabled', 'cursor-not-allowed');
    }

    function enableLink(link, targetHref) {
        const href = targetHref || link.dataset.originalHref;
        if (href && !href.startsWith('javascript')) {
            link.dataset.originalHref = href;
            link.setAttribute('href', href);
            link.classList.remove('disabled', 'cursor-not-allowed');
        } else {
            link.setAttribute('href', 'javascript:void(0)');
            link.classList.add('disabled', 'cursor-not-allowed');
        }
    }

    function applyByHref(href, active) {
        if (!href) return;

        document.querySelectorAll('#main-navbar a').forEach((link) => {
            if (isProtectedAdminNavLink(link)) return;
            const current = link.dataset.originalHref || link.getAttribute('href') || '';
            if (hrefMatchesPage(current, href)) {
                if (!link.dataset.originalHref && !current.startsWith('javascript')) {
                    link.dataset.originalHref = href;
                }
                if (active) {
                    enableLink(link, href);
                } else {
                    disableLink(link);
                }
            }
        });
    }

    function applyByNavLabel(navLabel, active, href) {
        if (!navLabel) return;

        document.querySelectorAll('#main-navbar a').forEach((link) => {
            if (isProtectedAdminNavLink(link)) return;
            if (normalizeNavText(link) !== navLabel) return;

            if (!link.dataset.originalHref) {
                const current = link.getAttribute('href');
                link.dataset.originalHref = current && !current.startsWith('javascript')
                    ? current
                    : (href || 'javascript:void(0)');
            }

            if (active) {
                enableLink(link, href || link.dataset.originalHref);
            } else {
                disableLink(link);
            }
        });
    }

    function applyDirectLink(pageId, active, href) {
        document.querySelectorAll(`#main-navbar [data-page="${pageId}"]`).forEach((el) => {
            if (el.tagName !== 'A') return;
            if (isProtectedAdminNavLink(el)) return;
            if (href) el.dataset.originalHref = href;
            if (active) {
                enableLink(el, href);
            } else {
                disableLink(el);
            }
        });
    }

    function applyPage(page, active) {
        if (page.navLabel) {
            applyByNavLabel(page.navLabel, active, page.href);
        } else if (page.href) {
            applyByHref(page.href, active);
        }
        applyDirectLink(page.id, active, page.href);
    }

    function applyToNavbar() {
        const navbar = document.getElementById('main-navbar');
        if (!navbar) return;

        if (isAdminPanelNavbar()) return;

        ensureOriginalHrefs();
        const status = getStatus();

        PAGES.forEach((page) => {
            const active = status[page.id] !== false;
            applyPage(page, active);
        });
    }

    global.YaziyoPageStatus = {
        PAGES,
        getStatus,
        setPageActive,
        isPageActive,
        applyToNavbar
    };
})(window);
