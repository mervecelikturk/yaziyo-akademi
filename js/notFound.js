/**
 * YAZİYO — 404 sayfası (GitHub Pages uyumlu, kök mutlak yollar)
 */
(function () {
    const SITE_PAGES = [
        { slug: 'index', href: '/index.html', label: 'Ana Sayfa' },
        { slug: 'giris-kayit', href: '/pages/giris-kayit/', label: 'Giriş / Kayıt' },
        { slug: 'profil', href: '/pages/profil/', label: 'Profil' },
        { slug: 'hiz-testi', href: '/pages/hiz-testi/', label: 'Hız Testi' },
        { slug: 'klavye-calismasi', href: '/pages/klavye-calismasi/', label: 'Klavye Çalışması' },
        { slug: 'ozel-metin-calismasi', href: '/pages/ozel-metin-calismasi/', label: 'Özel Metin' },
        { slug: 'klavye-sinavi', href: '/pages/klavye-sinavi/', label: 'Klavye Sınavı' },
        { slug: 'klavye-duellosu', href: '/pages/klavye-duellosu/', label: 'Klavye Düellosu' },
        { slug: 'kelime-evi', href: '/pages/kelime-evi/', label: 'Kelime Evi' },
        { slug: 'araba-yarisi', href: '/pages/araba-yarisi/', label: 'Araba Yarışı' },
        { slug: 'haberler', href: '/pages/haberler/', label: 'Haberler' },
        { slug: 'egitim-paketleri', href: '/pages/egitim-paketleri/', label: 'Eğitim Paketleri' },
        { slug: 'iletisim', href: '/pages/iletisim/', label: 'İletişim' },
    ];

    const TYPO_MAP = {
        hiztesti: 'hiz-testi',
        hiztest: 'hiz-testi',
        klavyecalismasi: 'klavye-calismasi',
        klavyecalisma: 'klavye-calismasi',
        ozelmetin: 'ozel-metin-calismasi',
        klavyesinavi: 'klavye-sinavi',
        klavyeduellosu: 'klavye-duellosu',
        kelimeevi: 'kelime-evi',
        arabayarisi: 'araba-yarisi',
        egitimpaketleri: 'egitim-paketleri',
        giriskayit: 'giris-kayit',
        sifresifirla: 'sifre-sifirla',
    };

    function stripExt(name) {
        return String(name || '').replace(/\.html?$/i, '');
    }

    function normalizeKey(str) {
        return stripExt(str)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    }

    function getRequestedSlug(pathname) {
        const parts = pathname.replace(/\\/g, '/').split('/').filter(Boolean);
        const pagesIdx = parts.indexOf('pages');
        if (pagesIdx >= 0 && parts[pagesIdx + 1]) {
            return parts[pagesIdx + 1].replace(/\.html$/i, '').toLowerCase();
        }
        return (parts[parts.length - 1] || '').replace(/\.html$/i, '').toLowerCase();
    }

    function levenshtein(a, b) {
        const m = a.length;
        const n = b.length;
        const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
            }
        }
        return dp[m][n];
    }

    function findSuggestedPage(pathname) {
        const requested = getRequestedSlug(pathname);
        if (!requested) return null;

        const exact = SITE_PAGES.find((p) => p.slug === requested);
        if (exact) return exact;

        const typoTarget = TYPO_MAP[normalizeKey(requested)];
        if (typoTarget) {
            const typoPage = SITE_PAGES.find((p) => p.slug === typoTarget);
            if (typoPage) return typoPage;
        }

        const reqKey = normalizeKey(requested);
        if (!reqKey) return null;

        let best = null;
        let bestScore = Infinity;

        for (const page of SITE_PAGES) {
            const pageKey = normalizeKey(page.slug);
            const dist = levenshtein(reqKey, pageKey);
            if (dist < bestScore && dist <= 3) {
                bestScore = dist;
                best = page;
            }
        }

        return bestScore <= 3 ? best : null;
    }

    function initNotFoundPage() {
        const pathname = window.location.pathname || '/';
        const pathEl = document.getElementById('nf-requested-path');
        if (pathEl) {
            pathEl.textContent = pathname + (window.location.search || '') + (window.location.hash || '');
        }

        const suggestion = findSuggestedPage(pathname);
        const suggestionWrap = document.getElementById('nf-suggestion');
        const suggestionLink = document.getElementById('nf-suggestion-link');
        const suggestionLabel = document.getElementById('nf-suggestion-label');

        if (suggestion && suggestionWrap && suggestionLink && suggestionLabel) {
            suggestionLabel.textContent = suggestion.label;
            suggestionLink.href = suggestion.href;
            suggestionWrap.classList.remove('hidden');
        }

        document.title = '404 — Sayfa Bulunamadı | YAZİYO';
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNotFoundPage);
    } else {
        initNotFoundPage();
    }
}());
