/**
 * YAZİYO — Paket satın alımına bağlı navbar erişimi
 * Eğitimlerim: hem İçerik Ekle (aktif/pasif) hem aktif paket gerekir.
 */
(function (global) {
    const PACKAGE_NAV_IDS = ['egitimlerim'];

    function getPaths() {
        return global.YaziyoPaths || {
            pageHref: (f) => `../${String(f).replace(/\.html$/i, '')}/`,
        };
    }

    function resolveHref(pageId) {
        const paths = getPaths();
        if (pageId === 'egitimlerim') return paths.pageHref('egitimlerim.html');
        return 'javascript:void(0)';
    }

    function setLinkActive(link, active, pageId) {
        if (!link) return;
        const target = resolveHref(pageId);

        if (active) {
            link.dataset.originalHref = target;
            link.setAttribute('href', target);
            link.classList.remove('disabled', 'cursor-not-allowed');
            link.removeAttribute('aria-disabled');
            link.removeAttribute('title');
            link.dataset.packageUnlocked = '1';
        } else {
            if (!link.dataset.originalHref && target && !target.startsWith('javascript')) {
                link.dataset.originalHref = target;
            }
            link.setAttribute('href', 'javascript:void(0)');
            link.classList.add('disabled', 'cursor-not-allowed');
            link.setAttribute('aria-disabled', 'true');
            link.dataset.packageUnlocked = '0';
            link.title = 'Eğitim paketi satın alındığında açılır';
        }
    }

    function isGloballyActive(pageId) {
        if (!global.YaziyoPageStatus?.isPageActive) return true;
        return global.YaziyoPageStatus.isPageActive(pageId) !== false;
    }

    function applyPackageNavAccess(hasPackage) {
        const navbar = document.getElementById('main-navbar');
        if (!navbar) return;

        PACKAGE_NAV_IDS.forEach((pageId) => {
            const globallyOn = isGloballyActive(pageId);
            const unlocked = globallyOn && !!hasPackage;
            navbar.querySelectorAll(`a[data-page="${pageId}"]`).forEach((link) => {
                setLinkActive(link, unlocked, pageId);
                if (!unlocked) {
                    link.title = globallyOn
                        ? 'Eğitim paketi satın alındığında açılır'
                        : 'Bu sayfa şu anda kapalı';
                }
            });
        });
    }

    /** Başlangıçta pasif */
    function lockPackageNav() {
        applyPackageNavAccess(false);
    }

    async function syncPackageNavAccess() {
        lockPackageNav();
        try {
            const { initSupabaseClient, getSupabaseClient } = await import('./lib/supabase.js');
            await initSupabaseClient();
            const client = getSupabaseClient();
            if (!client) return false;

            const { userHasPurchasedPaket } = await import('./lib/egitimPaketleriApi.js');
            const hasPackage = await userHasPurchasedPaket(client);
            applyPackageNavAccess(hasPackage);
            global.__yaziyoHasPurchasedPaket = hasPackage;
            return hasPackage;
        } catch (err) {
            console.warn('Paket navbar erişimi kontrol edilemedi:', err);
            lockPackageNav();
            return false;
        }
    }

    global.YaziyoPackageNavAccess = {
        PACKAGE_NAV_IDS,
        applyPackageNavAccess,
        lockPackageNav,
        syncPackageNavAccess,
        isPackageGatedPage(pageId) {
            return PACKAGE_NAV_IDS.includes(pageId);
        },
    };
}(typeof window !== 'undefined' ? window : globalThis));
