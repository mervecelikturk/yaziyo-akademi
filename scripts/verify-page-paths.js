const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'pages');
const dirs = fs.readdirSync(pagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

const issues = [];

for (const dir of dirs) {
    const idx = path.join(pagesDir, dir, 'index.html');
    if (!fs.existsSync(idx)) {
        issues.push(`missing index: ${dir}`);
        continue;
    }
    const c = fs.readFileSync(idx, 'utf8');
    if (c.includes('href="../css/') || c.includes('src="../js/') || c.includes('href="../images/')) {
        issues.push(`bad asset path: ${dir}`);
    }
    const withoutHome = c.replace(/\.\.\/\.\.\/index\.html/g, '');
    if (/href="[^"]+\.html"/.test(withoutHome)) {
        issues.push(`html page link: ${dir}`);
    }
}

console.log(`Folders: ${dirs.length}`);
if (issues.length) {
    console.error(issues.join('\n'));
    process.exit(1);
}
console.log('All checks passed');
