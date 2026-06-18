/**
 * YAZİYO — 404 sayfası (GitHub Pages uyumlu, kök mutlak yollar)
 */
(function () {
    const SITE_PAGES = [
        { file: 'index.html', href: '/index.html', label: 'Ana Sayfa' },
        { file: 'girisKayit.html', href: '/pages/girisKayit.html', label: 'Giriş / Kayıt' },
        { file: 'profil.html', href: '/pages/profil.html', label: 'Profil' },
        { file: 'hizTesti.html', href: '/pages/hizTesti.html', label: 'Hız Testi' },
        { file: 'klavyeCalismasi.html', href: '/pages/klavyeCalismasi.html', label: 'Klavye Çalışması' },
        { file: 'ozelMetinCalismasi.html', href: '/pages/ozelMetinCalismasi.html', label: 'Özel Metin' },
        { file: 'klavyeSinavi.html', href: '/pages/klavyeSinavi.html', label: 'Klavye Sınavı' },
        { file: 'klavyeDuellosu.html', href: '/pages/klavyeDuellosu.html', label: 'Klavye Düellosu' },
        { file: 'kelimeEvi.html', href: '/pages/kelimeEvi.html', label: 'Kelime Evi' },
        { file: 'arabaYarisi.html', href: '/pages/arabaYarisi.html', label: 'Araba Yarışı' },
        { file: 'haberler.html', href: '/pages/haberler.html', label: 'Haberler' },
        { file: 'egitimPaketleri.html', href: '/pages/egitimPaketleri.html', label: 'Eğitim Paketleri' },
        { file: 'iletisim.html', href: '/pages/iletisim.html', label: 'İletişim' },
    ];

    const TYPO_MAP = {
        hiztesti: 'hizTesti.html',
        hiztest: 'hizTesti.html',
        klavyecalismasi: 'klavyeCalismasi.html',
        klavyecalisma: 'klavyeCalismasi.html',
        ozelmetin: 'ozelMetinCalismasi.html',
        klavyesinavi: 'klavyeSinavi.html',
        klavyeduellosu: 'klavyeDuellosu.html',
        kelimeevi: 'kelimeEvi.html',
        arabayarisi: 'arabaYarisi.html',
        egitimpaketleri: 'egitimPaketleri.html',
        giriskayit: 'girisKayit.html',
        sifresifirla: 'sifre-sifirla.html',
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

    function getRequestedFilename(pathname) {
        const parts = pathname.replace(/\\/g, '/').split('/').filter(Boolean);
        return parts[parts.length - 1] || '';
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
        const requested = getRequestedFilename(pathname);
        if (!requested) return null;

        const exact = SITE_PAGES.find((p) => p.file.toLowerCase() === requested.toLowerCase());
        if (exact) return exact;

        const typoTarget = TYPO_MAP[normalizeKey(requested)];
        if (typoTarget) {
            const typoPage = SITE_PAGES.find((p) => p.file.toLowerCase() === typoTarget.toLowerCase());
            if (typoPage) return typoPage;
        }

        const reqKey = normalizeKey(requested);
        if (!reqKey) return null;

        let best = null;
        let bestScore = Infinity;

        for (const page of SITE_PAGES) {
            const pageKey = normalizeKey(page.file);
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
