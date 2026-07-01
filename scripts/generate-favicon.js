/**
 * logo.png → favicon.ico + images/favicon-48.png
 * Google arama sonuçları için 48×48 PNG + çok boyutlu ICO üretir.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico').default || require('png-to-ico');

const ROOT = path.join(__dirname, '..');
const LOGO = path.join(ROOT, 'images', 'logo.png');
const OUT_ICO = path.join(ROOT, 'favicon.ico');
const OUT_48 = path.join(ROOT, 'images', 'favicon-48.png');
const TMP = path.join(ROOT, '.favicon-tmp');

const SIZES = [16, 32, 48];

async function resizeSquare(size) {
    return sharp(LOGO)
        .resize(size, size, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .png()
        .toBuffer();
}

async function main() {
    if (!fs.existsSync(LOGO)) {
        console.error('logo.png bulunamadı:', LOGO);
        process.exit(1);
    }

    fs.mkdirSync(TMP, { recursive: true });
    const pngPaths = [];

    for (const size of SIZES) {
        const buf = await resizeSquare(size);
        const file = path.join(TMP, `favicon-${size}.png`);
        fs.writeFileSync(file, buf);
        pngPaths.push(file);
        if (size === 48) {
            fs.writeFileSync(OUT_48, buf);
        }
    }

    const ico = await pngToIco(pngPaths);
    fs.writeFileSync(OUT_ICO, ico);

    fs.rmSync(TMP, { recursive: true, force: true });

    console.log('Oluşturuldu:', OUT_ICO);
    console.log('Oluşturuldu:', OUT_48);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
