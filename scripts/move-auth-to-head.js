/**
 * sitePaths.js ve auth.js'i head'e taşır (authBoot'tan hemen sonra)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE_PATHS_ROOT = '<script src="js/lib/sitePaths.js"></script>';
const SITE_PATHS_PAGES = '<script src="../../js/lib/sitePaths.js"></script>';
const AUTH_ROOT = '<script type="module" src="js/auth.js"></script>';
const AUTH_PAGES = '<script type="module" src="../../js/auth.js"></script>';

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

function removeFromBody(html, snippet) {
    const lines = html.split('\n');
    return lines.filter((line) => !line.includes(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) && !line.trim().includes(snippet.trim())).join('\n');
}

let updated = 0;
for (const file of walk(ROOT)) {
    let html = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    if (!html.includes('authBoot.js')) continue;
    if (rel.includes('admin-paneli') || rel.includes('adminGiris')) continue;

    const sitePaths = rel === 'index.html' ? SITE_PATHS_ROOT : SITE_PATHS_PAGES;
    const authMod = rel === 'index.html' ? AUTH_ROOT : AUTH_PAGES;

    if (!html.includes('js/lib/sitePaths.js') && !html.includes('../../js/lib/sitePaths.js')) {
        html = html.replace(
            /(<script src="(?:\.\.\/\.\.\/)?js\/authBoot\.js"><\/script>)/,
            `$1\n    ${sitePaths}\n    ${authMod}`,
        );
    } else if (!html.includes('type="module" src="js/auth.js"') && !html.includes('type="module" src="../../js/auth.js"')) {
        html = html.replace(
            /(<script src="(?:\.\.\/\.\.\/)?js\/lib\/sitePaths\.js"><\/script>)/,
            `$1\n    ${authMod}`,
        );
    }

    // Body altındaki tekrarlayan sitePaths / auth.js satırlarını kaldır
    html = html.split('\n').filter((line) => {
        if (line.includes('js/lib/sitePaths.js') && html.indexOf(line) !== html.lastIndexOf(line)) {
            return html.indexOf('<head>') < html.indexOf(line) || !html.includes('<head>');
        }
        if (line.includes('type="module" src="../../js/auth.js"') || line.includes('type="module" src="js/auth.js"')) {
            const headEnd = html.indexOf('</head>');
            const linePos = html.indexOf(line);
            if (headEnd > 0 && linePos > headEnd) return false;
        }
        return true;
    }).join('\n');

    // Basit: body içindeki auth.js ve sitePaths scriptlerini sil (head'de varsa)
    if (html.includes('</head>') && html.includes('authBoot.js')) {
        const headPart = html.slice(0, html.indexOf('</head>'));
        const bodyPart = html.slice(html.indexOf('</head>'));
        if (headPart.includes('sitePaths.js') && headPart.includes('auth.js')) {
            let newBody = bodyPart
                .replace(/\s*<script src="\.\.\/\.\.\/js\/lib\/sitePaths\.js"><\/script>\s*/g, '\n')
                .replace(/\s*<script src="js\/lib\/sitePaths\.js"><\/script>\s*/g, '\n')
                .replace(/\s*<script type="module" src="\.\.\/\.\.\/js\/auth\.js"><\/script>\s*/g, '\n')
                .replace(/\s*<script type="module" src="js\/auth\.js"><\/script>\s*/g, '\n');
            html = headPart + newBody;
        }
    }

    fs.writeFileSync(file, html, 'utf8');
    updated += 1;
    console.log('head auth:', rel);
}

console.log(`Toplam ${updated} dosya.`);
