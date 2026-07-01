/**
 * pages/ link ve sitemap doğrulama
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGES = path.join(ROOT, 'pages');

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
    'dersler.html': 'dersler',
    'dersOyunu.html': 'ders-oyunu',
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

const issues = [];

function folderHasIndex(slug) {
    return fs.existsSync(path.join(PAGES, slug, 'index.html'));
}

// 1) PAGE_SLUGS → index.html
for (const [file, slug] of Object.entries(PAGE_SLUGS)) {
    if (!folderHasIndex(slug)) {
        issues.push(`PAGE_SLUGS: ${file} → pages/${slug}/index.html YOK`);
    }
}

// 2) pages/ kökünde yönlendirme stub'ı kalmamalı (yalnızca klasör/index.html)
const rootPageHtml = fs.readdirSync(PAGES).filter((f) => f.endsWith('.html'));
if (rootPageHtml.length) {
    issues.push(`Kök pages/*.html stub dosyaları silinmeli: ${rootPageHtml.join(', ')}`);
}

// 4) Klasörlerde index dışı html kalmamalı
for (const dir of fs.readdirSync(PAGES, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const extras = fs.readdirSync(path.join(PAGES, dir.name)).filter((f) => f.endsWith('.html') && f !== 'index.html');
    extras.forEach((f) => issues.push(`Fazla kopya: pages/${dir.name}/${f}`));
}

// 5) Sitemap
const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const sitemapSlugs = sitemapUrls
    .map((u) => {
        if (u === 'https://yaziyoakademi.com/' || u === 'https://yaziyoakademi.com') return null;
        return u.replace('https://yaziyoakademi.com/pages/', '').replace(/\/$/, '');
    })
    .filter(Boolean);

for (const slug of sitemapSlugs) {
    if (!folderHasIndex(slug)) {
        issues.push(`Sitemap URL pages/${slug}/ → index.html YOK`);
    }
}

const publicNavSlugs = [
    'dersler', 'hiz-testi', 'klavye-calismasi', 'ozel-metin-calismasi',
    'klavye-sinavi', 'klavye-duellosu', 'kelime-evi', 'araba-yarisi',
    'sozlu-mulakat', 'mulakat-simulasyonu', 'becayis', 'egitim-paketleri',
    'haberler', 'kpss-calismasi', 'iletisim', 'giris-kayit',
];
/** robots.txt ile noindex — sitemap'te olmamalı */
const SITEMAP_EXCLUDED = new Set(['profil', 'sifre-sifirla', 'ders-oyunu']);

const missingFromSitemap = publicNavSlugs.filter(
    (s) => folderHasIndex(s) && !SITEMAP_EXCLUDED.has(s) && !sitemapSlugs.includes(s),
);
if (missingFromSitemap.length) {
    issues.push(`Sitemap'te eksik (public sayfalar): ${missingFromSitemap.join(', ')}`);
}

const staleInSitemap = sitemapSlugs.filter((s) => !folderHasIndex(s));
if (staleInSitemap.length) {
    issues.push(`Sitemap'te geçersiz slug: ${staleInSitemap.join(', ')}`);
}

// 6) HTML içi eski doğrudan .html sayfa linkleri (pages/ altında klasör içi kopya)
const htmlFiles = [];
function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.html')) htmlFiles.push(p);
    }
}
walk(PAGES);
walk(ROOT);

const legacyPageNames = Object.keys(PAGE_SLUGS);
const badHrefRe = new RegExp(
    `href=(["'])(?:\\.\\./)?(?:pages/)?(?:${legacyPageNames.map((n) => n.replace('.', '\\.')).join('|')})(\\?[^"']*)?\\1`,
    'gi',
);

for (const file of htmlFiles) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    if (!rel.startsWith('pages/') || !rel.includes('/')) continue;
    const content = fs.readFileSync(file, 'utf8');
    const hits = content.match(badHrefRe);
    if (hits) {
        issues.push(`${rel}: eski doğrudan .html link → ${[...new Set(hits)].join(', ')}`);
    }
}

console.log(JSON.stringify({ ok: issues.length === 0, issueCount: issues.length, issues, sitemapSlugs, missingFromSitemap }, null, 2));
process.exit(issues.length ? 1 : 0);
