const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function walk(dir, files = []) {
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) {
            if (name === 'node_modules' || name === 'scripts') continue;
            walk(full, files);
        } else if (name.endsWith('.html')) files.push(full);
    }
    return files;
}

for (const file of walk(ROOT)) {
    let html = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    if (!html.includes('authBoot.js')) continue;
    if (rel.includes('admin-paneli')) continue;

    const isRoot = rel === 'index.html';
    const sitePaths = isRoot
        ? '<script src="js/lib/sitePaths.js"></script>'
        : '<script src="../../js/lib/sitePaths.js"></script>';
    const authMod = isRoot
        ? '<script type="module" src="js/auth.js"></script>'
        : '<script type="module" src="../../js/auth.js"></script>';

    const bootTag = isRoot
        ? '<script src="js/authBoot.js"></script>'
        : '<script src="../../js/authBoot.js"></script>';

    if (!html.includes('type="module" src="js/auth.js"') && !html.includes('type="module" src="../../js/auth.js"')) {
        html = html.replace(bootTag, `${bootTag}\n    ${sitePaths}\n    ${authMod}`);
    }

    const headEnd = html.indexOf('</head>');
    if (headEnd === -1) continue;
    const head = html.slice(0, headEnd);
    const body = html.slice(headEnd);

    let newBody = body
        .replace(/\s*<script defer src="js\/lib\/sitePaths\.js"><\/script>\s*/g, '\n')
        .replace(/\s*<script src="\.\.\/\.\.\/js\/lib\/sitePaths\.js"><\/script>\s*/g, '\n')
        .replace(/\s*<script type="module" src="js\/auth\.js"><\/script>\s*/g, '\n')
        .replace(/\s*<script type="module" src="\.\.\/\.\.\/js\/auth\.js"><\/script>\s*/g, '\n');

    if (newBody !== body || !head.includes('auth.js')) {
        fs.writeFileSync(file, head + newBody, 'utf8');
        console.log('fixed:', rel);
    }
}

console.log('done');
