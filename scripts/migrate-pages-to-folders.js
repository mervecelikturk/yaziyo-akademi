/**
 * pages/*.html → pages/{slug}/{originalName}.html + index.html
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGES_DIR = path.join(ROOT, 'pages');

const PAGE_FOLDER_MAP = {
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

const htmlFiles = Object.keys(PAGE_FOLDER_MAP).sort((a, b) => b.length - a.length);

function escapeRe(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pageHrefFromFolder(slug) {
    return `../${slug}/`;
}

function transformContent(content, slug) {
    let out = content;

    // Asset yolları (pages/ → pages/{slug}/)
    out = out.replace(/href="\.\.\/(?!pages)/g, 'href="../../');
    out = out.replace(/src="\.\.\/(?!pages)/g, 'src="../../');

    // Sayfa linkleri — uzun dosya adları önce
    for (const file of htmlFiles) {
        const folder = PAGE_FOLDER_MAP[file];
        const newHref = pageHrefFromFolder(folder);
        const re = new RegExp(
            `href=(["'])${escapeRe(file)}(\\?[^"']*)?\\1`,
            'g',
        );
        out = out.replace(re, (match, quote, query) => {
            return `href=${quote}${newHref}${query || ''}${quote}`;
        });
    }

    const canonical = `https://yaziyoakademi.com/pages/${slug}/`;
    out = out.replace(
        /https:\/\/yaziyoakademi\.com\/pages\/[^"']+\.html/g,
        canonical,
    );

    return out;
}

function createRedirectStub(slug) {
    const target = `${slug}/`;
    return `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="0;url=${target}">
    <link rel="canonical" href="${target}">
    <script>window.location.replace('${target}');</script>
    <title>Yönlendiriliyor…</title>
</head>
<body><p><a href="${target}">Devam etmek için tıklayın</a></p></body>
</html>
`;
}

for (const file of Object.keys(PAGE_FOLDER_MAP)) {
    const srcPath = path.join(PAGES_DIR, file);
    if (!fs.existsSync(srcPath)) {
        console.warn('Skip missing:', file);
        continue;
    }

    const raw = fs.readFileSync(srcPath, 'utf8');
    if (raw.includes('Yönlendiriliyor')) {
        console.warn('Skip redirect stub:', file);
        continue;
    }

    const slug = PAGE_FOLDER_MAP[file];
    const destDir = path.join(PAGES_DIR, slug);
    fs.mkdirSync(destDir, { recursive: true });

    const transformed = transformContent(raw, slug);

    fs.writeFileSync(path.join(destDir, 'index.html'), transformed, 'utf8');

    console.log(`OK: ${file} → pages/${slug}/index.html`);
}

console.log('Migration complete.');
