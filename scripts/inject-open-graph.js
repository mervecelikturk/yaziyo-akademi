/**
 * Tüm HTML dosyalarına Open Graph meta etiketlerini ekler (tek seferlik bakım aracı).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE_URL = 'https://yaziyoakademi.com';
const SITE_NAME = 'YAZİYO';
const OG_IMAGE = SITE_URL + '/images/logo.png';
const OG_IMAGE_ALT = 'YAZİYO — Zabıt Katipliği Çalışma Platformu';
const DEFAULT_DESCRIPTION =
    'Klavye hız testi, klavye çalışmaları, oyunlar ve online sınavlarla yazma becerini geliştir. Zabıt katipliği hazırlığı için YAZİYO.';

function escapeAttr(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

function extractTitle(html) {
    const m = html.match(/<title>([\s\S]*?)<\/title>/i);
    return m ? m[1].trim() : SITE_NAME;
}

function extractDescription(html) {
    const m = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
    if (m) return m[1].trim();
    const m2 = html.match(/<meta\s+name="description"\s+content='([^']*)'/i);
    if (m2) return m2[1].trim();
    const multiline = html.match(/<meta\s+name="description"\s+content="([\s\S]*?)"\s*\/?>/i);
    if (multiline) return multiline[1].replace(/\s+/g, ' ').trim();
    return DEFAULT_DESCRIPTION;
}

function pagePathFromFile(filePath) {
    const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
    if (rel === 'index.html') return '/';
    if (rel.endsWith('/index.html')) return `/${rel.replace(/\/index\.html$/, '/')}`;
    return '/' + rel;
}

function buildBlock(title, description, pagePath) {
    const t = escapeAttr(title);
    const d = escapeAttr(description);
    const url = SITE_URL + pagePath;

    return [
        '    <!-- Open Graph / Sosyal Paylaşım -->',
        '    <meta property="og:locale" content="tr_TR">',
        '    <meta property="og:site_name" content="' + SITE_NAME + '">',
        '    <meta property="og:type" content="website">',
        '    <meta property="og:title" content="' + t + '">',
        '    <meta property="og:description" content="' + d + '">',
        '    <meta property="og:url" content="' + url + '">',
        '    <meta property="og:image" content="' + OG_IMAGE + '">',
        '    <meta property="og:image:alt" content="' + OG_IMAGE_ALT + '">',
        '    <meta name="twitter:card" content="summary_large_image">',
        '    <meta name="twitter:title" content="' + t + '">',
        '    <meta name="twitter:description" content="' + d + '">',
        '    <meta name="twitter:image" content="' + OG_IMAGE + '">',
        '    <meta name="twitter:image:alt" content="' + OG_IMAGE_ALT + '">',
        '    <link rel="canonical" href="' + url + '">',
    ].join('\n');
}

function stripExistingOg(html) {
    return html
        .replace(/\n?\s*<!-- Open Graph \/ Sosyal Paylaşım -->[\s\S]*?<link rel="canonical" href="[^"]*">\n?/g, '\n');
}

function inject(filePath) {
    let html = fs.readFileSync(filePath, 'utf8');
    html = stripExistingOg(html);

    const title = extractTitle(html);
    const description = extractDescription(html);
    const pagePath = pagePathFromFile(filePath);
    const block = buildBlock(title, description, pagePath);

    const anchor = html.match(/<link rel="icon"[^>]*>/i);
    if (anchor) {
        html = html.replace(anchor[0], anchor[0] + '\n\n' + block);
    } else {
        html = html.replace(/<title>[\s\S]*?<\/title>/i, (m) => m + '\n\n' + block);
    }

    fs.writeFileSync(filePath, html, 'utf8');
    console.log('OK', path.relative(ROOT, filePath));
}

function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walk(full);
        else if (name.endsWith('.html')) inject(full);
    }
}

walk(ROOT);
