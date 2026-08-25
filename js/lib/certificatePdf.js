/**
 * YAZİYO — Katılım / tamamlama / başarı belgesi PDF üretimi
 * Helvetica Türkçe karakterleri göstermez; metin canvas üzerinde
 * Inter + Poppins ile çizilir, ardından PDF'e gömülür.
 */
import { BELGE_TURLERI } from './egitimlerimApi.js';

const GOLD = '#D97706';
const NAVY = '#1E293B';
const SLATE = '#475569';
const MUTED = '#64748B';
const PAPER = '#FFFCF7';
const LINE = '#E7D5B8';

const PAGE_W_MM = 297;
const PAGE_H_MM = 210;
const PX_PER_MM = 8;

const LOGO_URL = new URL('../../images/logo.png', import.meta.url).href;

function mm(n) {
    return n * PX_PER_MM;
}

function loadImage(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

async function ensureFonts() {
    if (!document.fonts?.load) return;
    const sample = 'YAZİYO AKADEMİ ĞÜŞİÖÇğüşıöç Ââ';
    await document.fonts.ready.catch(() => {});
    await Promise.all([
        document.fonts.load('800 64px Poppins', sample),
        document.fonts.load('700 48px Poppins', sample),
        document.fonts.load('600 28px Poppins', sample),
        document.fonts.load('400 22px Inter', sample),
        document.fonts.load('500 20px Inter', sample),
        document.fonts.load('600 18px Inter', sample),
    ]).catch(() => {});
}

/** 'YYYY-MM-DD' → '5 Ocak 2026' (yerel saat kaymasına takılmadan) */
export function formatBelgeTarihi(value) {
    if (!value) return '';
    const raw = String(value).trim();
    const parts = raw.slice(0, 10).split('-');
    let d;
    if (parts.length === 3) {
        d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else {
        d = new Date(raw);
    }
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Türkçe iyelik (tamlayan) eki: "Ahmet'in", "Ayşe'nin", "Burak'ın".
 * Belge cümlesi "[Ad Soyad]'ın" kalıbıyla yazıldığı için ek isme göre uyumlanır.
 */
function genitiveSuffix(name) {
    const clean = String(name || '').trim().toLocaleLowerCase('tr-TR');
    if (!clean) return "'ın";

    const vowels = 'aeıioöuü';
    let lastVowel = '';
    for (let i = clean.length - 1; i >= 0; i -= 1) {
        if (vowels.includes(clean[i])) {
            lastVowel = clean[i];
            break;
        }
    }

    let ek = 'ın';
    if (lastVowel === 'e' || lastVowel === 'i') ek = 'in';
    else if (lastVowel === 'o' || lastVowel === 'u') ek = 'un';
    else if (lastVowel === 'ö' || lastVowel === 'ü') ek = 'ün';

    const endsWithVowel = vowels.includes(clean[clean.length - 1]);
    return `'${endsWithVowel ? 'n' : ''}${ek}`;
}

/** Cümledeki aday adı: büyük harf + iyelik eki (AHMET'İN) */
export function formatBelgeAdi(name) {
    const ad = String(name || 'Katılımcı').trim() || 'Katılımcı';
    return `${ad.toLocaleUpperCase('tr-TR')}${genitiveSuffix(ad).toLocaleUpperCase('tr-TR')}`;
}

/**
 * Belge metni — tür bazında sabit cümle.
 * Eğitim adı / tarih aralığı / düzenlenme tarihi admin tarafından doldurulur.
 */
export function buildBelgeCumlesi(tur, { aliciAdi, egitimAdi, baslangic, bitis, belgeTarihi } = {}) {
    const ad = String(aliciAdi || 'Katılımcı').trim() || 'Katılımcı';
    const egitim = String(egitimAdi || '').trim();
    const bas = formatBelgeTarihi(baslangic);
    const bit = formatBelgeTarihi(bitis);
    const verilis = formatBelgeTarihi(belgeTarihi) || formatBelgeTarihi(new Date().toISOString().slice(0, 10));

    const kim = formatBelgeAdi(ad);
    const program = egitim ? `${egitim} eğitim programına` : 'eğitim programına';
    const programI = egitim ? `${egitim} eğitim programını` : 'eğitim programını';
    const aralik = bas && bit ? ` ${bas} – ${bit} tarihleri arasında` : (bas ? ` ${bas} tarihinden itibaren` : '');
    const tarihSonu = verilis ? `, ${verilis} tarihinde düzenlenmiştir.` : ' düzenlenmiştir.';

    if (tur === 'basari') {
        return `Bu belge, ${kim} ${programI}${aralik} başarıyla tamamlayarak belirlenen eğitim ve performans kriterlerini yerine getirmesi nedeniyle${tarihSonu}`;
    }
    if (tur === 'tamamlama') {
        return `Bu belge, ${kim} ${programI}${aralik} eksiksiz şekilde tamamladığını belgelemek üzere${tarihSonu}`;
    }
    return `Bu belge, ${kim} ${program}${aralik} katılım sağladığını belgelemek üzere${tarihSonu}`;
}

function wrapText(ctx, text, maxWidth) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const lines = [];
    let line = '';
    for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width <= maxWidth) {
            line = test;
        } else {
            if (line) lines.push(line);
            line = word;
        }
    }
    if (line) lines.push(line);
    return lines;
}

function drawCenteredBlock(ctx, lines, cx, y, lineHeight) {
    for (const line of lines) {
        ctx.fillText(line, cx, y);
        y += lineHeight;
    }
    return y;
}

/**
 * Karışık stilli (renk/font) kelimeleri satırlara böler, ortalar.
 * parts: [{ text, color, font }]
 */
function drawRichCentered(ctx, parts, cx, y, maxWidth, lineHeight) {
    const tokens = [];
    for (const part of parts) {
        const pieces = String(part.text || '').split(/(\s+)/);
        for (const piece of pieces) {
            if (!piece) continue;
            tokens.push({
                text: piece,
                color: part.color,
                font: part.font,
                space: /^\s+$/.test(piece),
            });
        }
    }

    const lines = [];
    let current = [];
    let width = 0;
    const measure = (token) => {
        ctx.font = token.font;
        return ctx.measureText(token.text).width;
    };

    for (const token of tokens) {
        const tw = measure(token);
        if (!token.space && width + tw > maxWidth && current.length) {
            lines.push(current);
            current = [];
            width = 0;
        }
        if (token.space && !current.length) continue;
        current.push(token);
        width += tw;
    }
    if (current.length) lines.push(current);

    const prevAlign = ctx.textAlign;
    ctx.textAlign = 'left';
    for (const line of lines) {
        const total = line.reduce((sum, token) => sum + measure(token), 0);
        let x = cx - total / 2;
        for (const token of line) {
            ctx.font = token.font;
            ctx.fillStyle = token.color;
            ctx.fillText(token.text, x, y);
            x += measure(token);
        }
        y += lineHeight;
    }
    ctx.textAlign = prevAlign;
    return y;
}

function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
}

function drawCorner(ctx, x, y, dx, dy, len) {
    ctx.beginPath();
    ctx.moveTo(x + dx * len, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * len);
    ctx.stroke();
}

function drawGoldRule(ctx, cx, y, width) {
    const half = width / 2;
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = mm(0.35);
    ctx.beginPath();
    ctx.moveTo(cx - half, y);
    ctx.lineTo(cx + half, y);
    ctx.stroke();

    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(cx - half, y, mm(0.7), 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + half, y, mm(0.7), 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Logo + "YAZİYO AKADEMİ" tek satırda:
 * yuvarlak köşeli kare logo, yazının solunda ve dikeyde hizalı.
 * @returns {number} başlık bloğunun yüksekliği
 */
function drawHeader(ctx, logo, cx, centerY) {
    const brand = 'YAZİYO AKADEMİ';
    const fontSize = mm(9);
    const prevAlign = ctx.textAlign;
    const prevBaseline = ctx.textBaseline;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${fontSize}px Poppins, Inter, sans-serif`;
    const textW = ctx.measureText(brand).width;

    const hasLogo = !!(logo && logo.width && logo.height);
    const box = mm(13);
    const gap = mm(3.6);
    const totalW = (hasLogo ? box + gap : 0) + textW;
    let x = cx - totalW / 2;

    if (hasLogo) {
        const boxY = centerY - box / 2;
        const radius = box * 0.22;
        ctx.save();
        roundRect(ctx, x, boxY, box, box, radius);
        ctx.clip();
        const scale = Math.min(box / logo.width, box / logo.height);
        const dw = logo.width * scale;
        const dh = logo.height * scale;
        ctx.drawImage(logo, x + (box - dw) / 2, boxY + (box - dh) / 2, dw, dh);
        ctx.restore();
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = mm(0.32);
        roundRect(ctx, x, boxY, box, box, radius);
        ctx.stroke();
        x += box + gap;
    }

    ctx.fillStyle = NAVY;
    ctx.font = `800 ${fontSize}px Poppins, Inter, sans-serif`;
    ctx.fillText(brand, x, centerY);

    ctx.textAlign = prevAlign;
    ctx.textBaseline = prevBaseline;
    return Math.max(hasLogo ? box : 0, fontSize);
}

/**
 * @param {string} tur katilim | tamamlama | basari
 * @param {object} bilgi { aliciAdi, egitimAdi, kocAdi, baslangic, bitis, belgeTarihi }
 * @returns {Promise<string>} PDF data URI
 */
export async function createCertificatePdf(tur, bilgi = {}) {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) throw new Error('jsPDF yüklenemedi');

    // Eski çağrı biçimi: createCertificatePdf(tur, 'Ad Soyad')
    const info = typeof bilgi === 'string' ? { aliciAdi: bilgi } : (bilgi || {});

    await ensureFonts();

    const w = mm(PAGE_W_MM);
    const h = mm(PAGE_H_MM);
    const cx = w / 2;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);

    const m = mm(12);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = mm(1.6);
    roundRect(ctx, m, m, w - m * 2, h - m * 2, mm(2));
    ctx.stroke();

    ctx.strokeStyle = NAVY;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = mm(0.35);
    roundRect(ctx, m + mm(4), m + mm(4), w - m * 2 - mm(8), h - m * 2 - mm(8), mm(1.2));
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = GOLD;
    ctx.lineWidth = mm(1.1);
    ctx.lineCap = 'square';
    const cPad = m + mm(8);
    const cLen = mm(14);
    drawCorner(ctx, cPad, cPad, 1, 1, cLen);
    drawCorner(ctx, w - cPad, cPad, -1, 1, cLen);
    drawCorner(ctx, cPad, h - cPad, 1, -1, cLen);
    drawCorner(ctx, w - cPad, h - cPad, -1, -1, cLen);

    const logo = await loadImage(LOGO_URL);
    const headerCenterY = mm(28);
    const headerH = drawHeader(ctx, logo, cx, headerCenterY);

    let y = headerCenterY + headerH / 2 + mm(6);
    drawGoldRule(ctx, cx, y, mm(42));
    y += mm(14);

    const title = (BELGE_TURLERI[tur]?.label || 'Belge').toLocaleUpperCase('tr-TR');
    ctx.fillStyle = GOLD;
    ctx.font = `700 ${mm(8.2)}px Poppins, Inter, sans-serif`;
    ctx.fillText(title, cx, y);
    y += mm(14);

    const name = String(info.aliciAdi || 'Katılımcı').trim() || 'Katılımcı';
    const egitim = String(info.egitimAdi || '').trim();
    const sureBas = formatBelgeTarihi(info.baslangic);
    const sureBit = formatBelgeTarihi(info.bitis);
    const sure = sureBas && sureBit ? `${sureBas} – ${sureBit}` : (sureBas || sureBit);

    if (egitim) {
        ctx.fillStyle = NAVY;
        ctx.font = `600 ${mm(5)}px Poppins, Inter, sans-serif`;
        y = drawCenteredBlock(ctx, wrapText(ctx, egitim, mm(200)), cx, y, mm(7.2));
        y += mm(3);
    }
    if (sure) {
        ctx.fillStyle = MUTED;
        ctx.font = `500 ${mm(4)}px Inter, sans-serif`;
        ctx.fillText(sure, cx, y);
        y += mm(10);
    } else {
        y += mm(6);
    }

    const cumle = buildBelgeCumlesi(tur, {
        aliciAdi: name,
        egitimAdi: info.egitimAdi,
        baslangic: info.baslangic,
        bitis: info.bitis,
        belgeTarihi: info.belgeTarihi,
    });
    const kim = formatBelgeAdi(name);
    const kimAt = cumle.indexOf(kim);
    const bodyFont = `400 ${mm(4.6)}px Inter, sans-serif`;
    const nameFont = `700 ${mm(5.2)}px Poppins, Inter, sans-serif`;
    const parts = kimAt >= 0
        ? [
            { text: cumle.slice(0, kimAt), color: SLATE, font: bodyFont },
            { text: kim, color: GOLD, font: nameFont },
            { text: cumle.slice(kimAt + kim.length), color: SLATE, font: bodyFont },
        ]
        : [{ text: cumle, color: SLATE, font: bodyFont }];
    y = drawRichCentered(ctx, parts, cx, y, mm(200), mm(7.8));

    // Alt blok: eğitmenin imzası + veriliş notu (iç çerçeveye değmesin)
    const koc = String(info.kocAdi || '').trim();
    const signY = mm(168);
    if (koc) {
        ctx.fillStyle = NAVY;
        ctx.font = `600 ${mm(4.6)}px Poppins, Inter, sans-serif`;
        ctx.fillText(koc, cx, signY - mm(7));
    }

    ctx.strokeStyle = LINE;
    ctx.lineWidth = mm(0.25);
    ctx.beginPath();
    ctx.moveTo(cx - mm(30), signY);
    ctx.lineTo(cx + mm(30), signY);
    ctx.stroke();

    ctx.fillStyle = MUTED;
    ctx.font = `500 ${mm(3.6)}px Inter, sans-serif`;
    ctx.fillText('Eğitmen', cx, signY + mm(6));

    ctx.fillStyle = NAVY;
    ctx.font = `600 ${mm(3.6)}px Poppins, Inter, sans-serif`;
    ctx.fillText('Bu belge YAZİYO Akademi tarafından verilmiştir.', cx, signY + mm(16));

    const jpeg = canvas.toDataURL('image/jpeg', 0.93);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.addImage(jpeg, 'JPEG', 0, 0, PAGE_W_MM, PAGE_H_MM);
    return doc.output('datauristring');
}
