/**
 * YAZİYO — authBoot.js referansını tüm sayfalara ekler
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SNIPPET_ROOT = '<script src="js/authBoot.js"></script>';
const SNIPPET_PAGES = '<script src="../../js/authBoot.js"></script>';
const MARKER = 'authBoot.js';

function walk(dir, files = []) {
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) {
            if (name === 'node_modules' || name === 'scripts') continue;
            walk(full, files);
        } else if (name.endsWith('.html')) {
            files.push(full);
        }
    }
    return files;
}

let updated = 0;
for (const file of walk(ROOT)) {
    let html = fs.readFileSync(file, 'utf8');
    if (html.includes(MARKER)) continue;

    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const snippet = rel === 'index.html' ? SNIPPET_ROOT : SNIPPET_PAGES;

    if (!html.includes('yaziyo-theme')) continue;

    const themeEnd = html.indexOf('</script>', html.indexOf('yaziyo-theme'));
    if (themeEnd === -1) continue;

    const insertAt = themeEnd + '</script>'.length;
    html = `${html.slice(0, insertAt)}\n    ${snippet}${html.slice(insertAt)}`;

    html = html.replace(
        /<!-- AUTH FOUC Önleme: Auth kontrolü tamamlanana kadar sayfayı gizle -->\s*<style>[\s\S]*?body\.auth-ready[\s\S]*?<\/style>\s*<!-- ========================================== -->/g,
        '<!-- Erken oturum durumu: authBoot.js (FOUC önleme, sayfa gizlenmez) -->',
    );

    fs.writeFileSync(file, html, 'utf8');
    updated += 1;
    console.log('authBoot eklendi:', rel);
}

console.log(`Toplam ${updated} dosya güncellendi.`);
