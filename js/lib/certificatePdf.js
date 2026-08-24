/**
 * YAZİYO — Katılım / tamamlama / başarı belgesi PDF üretimi
 * Helvetica Türkçe karakterleri göstermez; metin canvas üzerinde
 * Inter + Poppins ile çizilir, ardından PDF'e gömülür.
 */
import { BELGE_TURLERI } from './egitimlerimApi.js';

const GOLD = '#D97706';
const NAVY = '#1E293B';
const INK = '#0F172A';
const SLATE = '#475569';
const MUTED = '#64748B';
const PAPER = '#FFFCF7';
const LINE = '#E7D5B8';

const PAGE_W_MM = 297;
const PAGE_H_MM = 210;
const PX_PER_MM = 8;

const BELGE_METINLERI = {
    katilim: 'Bu belge, aşağıda adı yazılı katılımcıya eğitim programına katılımı nedeniyle verilmiştir.',
    tamamlama: 'Bu belge, aşağıda adı yazılı katılımcıya eğitim programını başarıyla tamamladığı için verilmiştir.',
    basari: 'Bu belge, aşağıda adı yazılı katılımcıya gösterdiği başarı nedeniyle verilmiştir.',
};

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
 * @param {string} tur katilim | tamamlama | basari
 * @param {string} aliciAdi
 * @returns {Promise<string>} PDF data URI
 */
export async function createCertificatePdf(tur, aliciAdi) {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) throw new Error('jsPDF yüklenemedi');

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
    let y = mm(20);
    if (logo && logo.width && logo.height) {
        const maxW = mm(24);
        const maxH = mm(20);
        const ratio = logo.width / logo.height;
        let lw = maxW;
        let lh = lw / ratio;
        if (lh > maxH) {
            lh = maxH;
            lw = lh * ratio;
        }
        ctx.drawImage(logo, cx - lw / 2, y, lw, lh);
        y += lh + mm(6);
    } else {
        y = mm(32);
    }

    ctx.fillStyle = NAVY;
    ctx.font = `800 ${mm(9)}px Poppins, Inter, sans-serif`;
    ctx.fillText('YAZİYO AKADEMİ', cx, y);
    y += mm(8);
    drawGoldRule(ctx, cx, y, mm(42));
    y += mm(12);

    const title = (BELGE_TURLERI[tur]?.label || 'Belge').toLocaleUpperCase('tr-TR');
    ctx.fillStyle = GOLD;
    ctx.font = `700 ${mm(8.2)}px Poppins, Inter, sans-serif`;
    ctx.fillText(title, cx, y);
    y += mm(16);

    const body = BELGE_METINLERI[tur] || BELGE_METINLERI.katilim;
    ctx.fillStyle = SLATE;
    ctx.font = `400 ${mm(4.6)}px Inter, sans-serif`;
    const bodyLines = wrapText(ctx, body, mm(190));
    y = drawCenteredBlock(ctx, bodyLines, cx, y, mm(7.2));

    const name = String(aliciAdi || 'Katılımcı').trim() || 'Katılımcı';
    const nameMax = mm(200);
    let nameSize = mm(11);
    ctx.font = `700 ${nameSize}px Poppins, Inter, sans-serif`;
    while (nameSize > mm(6) && ctx.measureText(name).width > nameMax) {
        nameSize -= mm(0.4);
        ctx.font = `700 ${nameSize}px Poppins, Inter, sans-serif`;
    }
    const nameLines = ctx.measureText(name).width > nameMax
        ? wrapText(ctx, name, nameMax)
        : [name];

    const footerTop = mm(164);
    const nameBlockH = mm(8) + nameLines.length * nameSize * 1.25 + mm(8);
    const midTop = y + mm(6);
    const midBottom = footerTop - mm(14);
    let nameY = midTop + Math.max(0, (midBottom - midTop - nameBlockH) / 2);

    drawGoldRule(ctx, cx, nameY, mm(70));
    nameY += mm(10);
    ctx.fillStyle = INK;
    ctx.font = `700 ${nameSize}px Poppins, Inter, sans-serif`;
    nameY = drawCenteredBlock(ctx, nameLines, cx, nameY, nameSize * 1.25);
    nameY += mm(6);
    drawGoldRule(ctx, cx, nameY, mm(70));

    const today = new Date().toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
    ctx.fillStyle = MUTED;
    ctx.font = `500 ${mm(4.2)}px Inter, sans-serif`;
    ctx.fillText(today, cx, footerTop);

    ctx.strokeStyle = LINE;
    ctx.lineWidth = mm(0.25);
    ctx.beginPath();
    ctx.moveTo(cx - mm(28), mm(172));
    ctx.lineTo(cx + mm(28), mm(172));
    ctx.stroke();

    ctx.fillStyle = NAVY;
    ctx.font = `600 ${mm(3.8)}px Poppins, Inter, sans-serif`;
    ctx.fillText('YAZİYO Akademi', cx, mm(180));
    ctx.fillStyle = MUTED;
    ctx.font = `400 ${mm(3.4)}px Inter, sans-serif`;
    ctx.fillText('Zabıt Kâtipliği Çalışma Platformu', cx, mm(188));

    const jpeg = canvas.toDataURL('image/jpeg', 0.93);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.addImage(jpeg, 'JPEG', 0, 0, PAGE_W_MM, PAGE_H_MM);
    return doc.output('datauristring');
}
