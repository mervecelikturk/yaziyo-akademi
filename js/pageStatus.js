/* ============================================ */
/* YAZİYO - Sayfa Aktif/Pasif Yönetimi         */
/* localStorage önbellek + Supabase kalıcı kayıt */
/* ============================================ */

(function (global) {
    /** v2: eski kayıtlarda kelime-evi yanlışlıkla pasif kalmasın diye sürüm yükseltildi */
    const STORAGE_KEY = 'yaziyo-page-status-v2';
    const REMOTE_SYNCED_KEY = 'yaziyo-page-status-remote-synced-at';

    const PAGES = [
        { id: 'anasayfa', label: 'Ana Sayfa', href: 'index.html', defaultActive: true },
        { id: 'profil', label: 'Profil', href: 'profil.html', defaultActive: true },
        { id: 'dersler', label: 'Dersler', navLabel: 'Dersler', href: 'dersler.html', defaultActive: true },
        { id: 'hiz-testi', label: 'Hız Testi', href: 'hizTesti.html', defaultActive: true },
        { id: 'klavye-calismasi', label: 'Klavye Çalışması', href: 'klavyeCalismasi.html', defaultActive: true },
        { id: 'ozel-metin-calismasi', label: 'Özel Metin Çalışması', href: 'ozelMetinCalismasi.html', defaultActive: true },
        { id: 'klavye-sinavi', label: 'Klavye Sınavı', navLabel: 'Klavye Sınavı', href: 'klavyeSinavi.html', defaultActive: false },
        { id: 'klavye-duellosu', label: 'Klavye Düellosu', navLabel: 'Klavye Düellosu', href: 'klavyeDuellosu.html', defaultActive: true },
        { id: 'kelime-evi', label: 'Kelime Evi', navLabel: 'Kelime Evi', href: 'kelimeEvi.html', defaultActive: true },
        { id: 'araba-yarisi', label: 'Araba Yarışı', navLabel: 'Araba Yarışı', href: 'arabaYarisi.html', defaultActive: true },
        { id: 'sozlu-mulakat', label: 'Sözlü Mülakat', navLabel: 'Sözlü Mülakat', href: 'sozluMulakat.html', defaultActive: true },
        { id: 'mulakat-simulasyonu', label: 'Mülakat Simülasyonu', navLabel: 'Mülakat Simülasyonu', href: 'mulakatSimulasyonu.html', defaultActive: true },
        { id: 'becayis', label: 'Becayiş', href: 'becayis.html', defaultActive: true },
        { id: 'egitim-paketleri', label: 'Eğitim Paketleri', href: 'egitimPaketleri.html', defaultActive: true },
        { id: 'haberler', label: 'Haberler', href: 'haberler.html', defaultActive: false },
        { id: 'kpss-calismasi', label: 'KPSS Çalışması', href: 'kpssCalismasi.html', defaultActive: true },
        { id: 'iletisim', label: 'İletişim', href: 'iletisim.html', defaultActive: true }
    ];

    let syncPromise = null;

    function getDefaults() {
        return PAGES.reduce((acc, page) => {
            acc[page.id] = page.defaultActive;
            return acc;
        }, {});
    }

    function persistStatus(status) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(status));
        return status;
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
                    merged[page.id] = parsed[page.id] !== false;
                }
            });
            return merged;
        } catch {
            return { ...defaults };
        }
    }

    /** Uzak map ile birleştir; uzak kaynak önceliklidir */
    function applyRemoteMap(remoteMap) {
        const status = getDefaults();
        if (remoteMap && typeof remoteMap === 'object') {
            PAGES.forEach((page) => {
                if (Object.prototype.hasOwnProperty.call(remoteMap, page.id)) {
                    status[page.id] = remoteMap[page.id] !== false;
                }
            });
        }
        persistStatus(status);
        try {
            localStorage.setItem(REMOTE_SYNCED_KEY, new Date().toISOString());
        } catch (_) { /* ignore */ }
        return status;
    }

    function setPageActive(pageId, active) {
        const status = getStatus();
        status[pageId] = !!active;
        return persistStatus(status);
    }

    function isPageActive(pageId) {
        return getStatus()[pageId] !== false;
    }

    function normalizeNavText(el) {
        return (el?.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function linkBasename(href) {
        if (!href || href.startsWith('javascript')) return '';
        const base = href.split('?')[0].split('#')[0].replace(/\/+$/, '').split('/').pop().toLowerCase();
        if (base.endsWith('.html') && global.YaziyoPaths?.resolveSlug) {
            return global.YaziyoPaths.resolveSlug(base);
        }
        return base;
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

    function isUsableHref(href) {
        return !!(href && !href.startsWith('javascript') && href !== '#' && href !== '');
    }

    function disableLink(link) {
        if (!link.dataset.originalHref) {
            const href = link.getAttribute('href');
            if (isUsableHref(href)) {
                link.dataset.originalHref = href;
            }
        }
        link.setAttribute('href', 'javascript:void(0)');
        link.classList.add('disabled', 'cursor-not-allowed');
        link.setAttribute('aria-disabled', 'true');
    }

    function enableLink(link, targetHref) {
        const current = link.getAttribute('href');
        const stored = link.dataset.originalHref;
        // Hedef yolu önceliklendir (hardcoded javascript:void linklerde stored boş kalır)
        let href = null;
        if (isUsableHref(targetHref)) href = targetHref;
        else if (isUsableHref(stored)) href = stored;
        else if (isUsableHref(current)) href = current;

        if (href) {
            link.dataset.originalHref = href;
            link.setAttribute('href', href);
            link.classList.remove('disabled', 'cursor-not-allowed');
            link.removeAttribute('aria-disabled');
        } else {
            link.setAttribute('href', 'javascript:void(0)');
            link.classList.add('disabled', 'cursor-not-allowed');
            link.setAttribute('aria-disabled', 'true');
        }
    }

    function applyByHref(href, active) {
        if (!href) return;

        document.querySelectorAll('#main-navbar a').forEach((link) => {
            if (isProtectedAdminNavLink(link)) return;
            const current = link.dataset.originalHref || link.getAttribute('href') || '';
            if (hrefMatchesPage(current, href) || hrefMatchesPage(link.getAttribute('href') || '', href)) {
                if (!link.dataset.originalHref && isUsableHref(current)) {
                    link.dataset.originalHref = current;
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
            const pageId = (link.dataset.page || '').toLowerCase();
            if (pageId === 'egitimlerim' || pageId === 'live-chat') return;
            if (normalizeNavText(link) !== navLabel) return;

            if (!link.dataset.originalHref) {
                const current = link.getAttribute('href');
                link.dataset.originalHref = isUsableHref(current)
                    ? current
                    : (isUsableHref(href) ? href : '');
            }

            if (active) {
                enableLink(link, href || link.dataset.originalHref);
            } else {
                disableLink(link);
            }
        });
    }

    function applyDirectLink(pageId, active, href) {
        // Paket kapılı sayfalar admin pageStatus ile yönetilmez
        if (pageId === 'egitimlerim' || pageId === 'live-chat') return;

        document.querySelectorAll(`#main-navbar [data-page="${pageId}"]`).forEach((el) => {
            if (el.tagName !== 'A') return;
            if (isProtectedAdminNavLink(el)) return;
            if (isUsableHref(href) && !el.dataset.originalHref) {
                el.dataset.originalHref = href;
            }
            if (active) {
                enableLink(el, href);
            } else {
                disableLink(el);
            }
        });
    }

    function resolveHref(page) {
        const paths = global.YaziyoPaths;
        if (!paths) return page.href;
        if (page.id === 'anasayfa') return paths.homeHref();
        return paths.pageHref(page.href);
    }

    function applyPage(page, active) {
        const href = resolveHref(page);
        if (page.navLabel) {
            applyByNavLabel(page.navLabel, active, href);
        } else if (page.href) {
            applyByHref(href, active);
        }
        applyDirectLink(page.id, active, href);
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

    /**
     * Supabase'den durumu çek, localStorage'a yaz, navbar'ı güncelle.
     * Tablo yoksa / boşsa mevcut local durumu korur.
     */
    async function syncFromRemote() {
        if (syncPromise) return syncPromise;

        syncPromise = (async () => {
            try {
                const mod = await import('./lib/pageStatusApi.js');
                const remoteMap = await mod.fetchRemotePageStatusMap();
                if (!remoteMap) return getStatus();

                // Uzakta hiç kayıt yoksa local'i koru (ilk kurulum)
                if (Object.keys(remoteMap).length === 0) return getStatus();

                const status = applyRemoteMap(remoteMap);
                applyToNavbar();
                return status;
            } catch (err) {
                console.warn('Sayfa durumu senkronu atlandı:', err);
                return getStatus();
            } finally {
                syncPromise = null;
            }
        })();

        return syncPromise;
    }

    /** Local + uzak kaydet (İçerik Ekle) */
    async function setPageActiveAsync(pageId, active) {
        const status = setPageActive(pageId, active);
        applyToNavbar();

        try {
            const mod = await import('./lib/pageStatusApi.js');
            const result = await mod.upsertRemotePageStatus(pageId, active);
            if (!result.ok) {
                console.warn('Sayfa durumu uzak kaydı başarısız:', result.error?.message || result.error);
                return { status, remoteOk: false, missingTable: !!result.missingTable, error: result.error };
            }
            try {
                localStorage.setItem(REMOTE_SYNCED_KEY, new Date().toISOString());
            } catch (_) { /* ignore */ }
            return { status, remoteOk: true };
        } catch (err) {
            console.warn('Sayfa durumu uzak kaydı atlandı:', err);
            return { status, remoteOk: false, error: err };
        }
    }

    /** Tüm local durumu uzağa yükle (tablo ilk kez doldurulurken) */
    async function pushAllToRemote() {
        try {
            const mod = await import('./lib/pageStatusApi.js');
            return mod.upsertRemotePageStatusBulk(getStatus());
        } catch (err) {
            return { ok: false, error: err };
        }
    }

    global.YaziyoPageStatus = {
        PAGES,
        getStatus,
        setPageActive,
        setPageActiveAsync,
        isPageActive,
        applyToNavbar,
        syncFromRemote,
        pushAllToRemote,
        applyRemoteMap,
    };
})(window);
