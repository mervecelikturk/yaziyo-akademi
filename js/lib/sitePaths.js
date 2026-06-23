/**
 * YAZİYO — kök (index.html) ve pages/ dizinleri arasında göreli yollar
 */
(function (global) {
    /** Eski dosya adı → klasör slug (pages/{slug}/) */
    const PAGE_SLUGS = {
        'admin.html': 'admin',
        'adminEgitimPaketleri.html': 'admin-egitim-paketleri',
        'adminGiris.html': 'admin-paneli',
        'adminHaberler.html': 'admin-haberler',
        'adminMulakatSimulasyonu.html': 'admin-mulakat-simulasyonu',
        'adminSozluMulakat.html': 'admin-sozlu-mulakat',
        'arabaYarisi.html': 'araba-yarisi',
        'becayis.html': 'becayis',
        'egitimPaketleri.html': 'egitim-paketleri',
        'girisKayit.html': 'giris-kayit',
        'haberler.html': 'haberler',
        'hizTesti.html': 'hiz-testi',
        'icerikEkle.html': 'icerik-ekle',
        'iletisim.html': 'iletisim',
        'kelimeEvi.html': 'kelime-evi',
        'klavyeCalismasi.html': 'klavye-calismasi',
        'klavyeDuellosu.html': 'klavye-duellosu',
        'klavyeSinavi.html': 'klavye-sinavi',
        'kpssCalismasi.html': 'kpss-calismasi',
        'kullanicilar.html': 'kullanicilar',
        'mesajlar.html': 'mesajlar',
        'mulakatSimulasyonu.html': 'mulakat-simulasyonu',
        'ozelMetinCalismasi.html': 'ozel-metin-calismasi',
        'profil.html': 'profil',
        'sinavEkle.html': 'sinav-ekle',
        'sifre-sifirla.html': 'sifre-sifirla',
        'sozluMulakat.html': 'sozlu-mulakat',
    };

    const SLUG_TO_LEGACY_FILE = Object.fromEntries(
        Object.entries(PAGE_SLUGS).map(([file, slug]) => [slug, file]),
    );

    function pathname() {
        return global.location.pathname.replace(/\\/g, '/');
    }

    function isInPagesDir() {
        return /\/pages\/[^/]+\/?/.test(pathname());
    }

    function resolveSlug(fileOrSlug) {
        if (!fileOrSlug) return '';
        const raw = String(fileOrSlug).replace(/\/+$/, '');
        if (PAGE_SLUGS[raw]) return PAGE_SLUGS[raw];
        if (raw.endsWith('.html') && PAGE_SLUGS[raw]) return PAGE_SLUGS[raw];
        if (SLUG_TO_LEGACY_FILE[raw]) return raw;
        return raw.replace(/\.html$/i, '');
    }

    function currentPageSlug() {
        const parts = pathname().split('/').filter(Boolean);
        const idx = parts.indexOf('pages');
        if (idx >= 0 && parts[idx + 1]) {
            return parts[idx + 1].toLowerCase();
        }
        return '';
    }

    function homeHref() {
        return isInPagesDir() ? '../../index.html' : 'index.html';
    }

    function pageHref(fileOrSlug) {
        const slug = resolveSlug(fileOrSlug);
        const rel = `${slug}/`;
        return isInPagesDir() ? `../${rel}` : `pages/${rel}`;
    }

    function assetHref(relativePath) {
        return isInPagesDir() ? `../../${relativePath}` : relativePath;
    }

    function absolutePageUrl(slug) {
        const origin = global.location.origin && global.location.origin !== 'null'
            ? global.location.origin.replace(/\/$/, '')
            : 'https://yaziyoakademi.com';
        return `${origin}/pages/${slug}/`;
    }

    global.YaziyoPaths = {
        PAGE_SLUGS,
        SLUG_TO_LEGACY_FILE,
        isInPagesDir,
        currentPageSlug,
        resolveSlug,
        homeHref,
        pageHref,
        assetHref,
        absolutePageUrl,
    };
}(typeof window !== 'undefined' ? window : globalThis));
