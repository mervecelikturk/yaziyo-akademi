/**
 * YAZİYO - Hız testi günlük liderlik tablosu (podyum + tüm liste)
 */

import { supabase } from './lib/supabase.js';

function getClient() {
    return window.yaziyoSupabase || supabase;
}

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = String(str ?? '');
    return d.innerHTML;
}

function toNum(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function getInitial(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return '?';
    return trimmed.charAt(0).toLocaleUpperCase('tr-TR');
}

function formatZaman(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const saat = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const bugun = new Date();
    const ayniGun = d.toDateString() === bugun.toDateString();
    if (ayniGun) return `Bugün, ${saat}`;
    return `${d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}, ${saat}`;
}

function formatDogruluk(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '—';
    return `${Math.round(n)}%`;
}

const AVATAR_PALETTE = [
    'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400',
    'bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400',
    'bg-teal-100 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400',
    'bg-pink-100 dark:bg-pink-900/30 border-pink-200 dark:border-pink-800 text-pink-600 dark:text-pink-400',
    'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400',
];

function podiumCard(entry, place) {
    const config = {
        1: {
            wrap: 'w-full sm:w-1/3 order-1 sm:order-2 h-60 sm:-translate-y-6 rounded-t-3xl border-2 border-yaziyo-gold bg-gradient-to-t from-yellow-200/90 to-yellow-100/80 dark:from-yellow-900/50 dark:to-yellow-800/20 shadow-[0_0_25px_rgba(217,119,6,0.3)]',
            badge: 'absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-yaziyo-gold text-white border-4 border-yellow-100 dark:border-dark-bg flex items-center justify-center font-bold text-3xl shadow-[0_0_20px_rgba(217,119,6,0.5)] z-10',
            badgeInner: '<i class="fa-solid fa-star"></i>',
            label: 'Şampiyon',
            labelClass: 'text-yellow-600 dark:text-yellow-500 font-bold',
            nameClass: 'font-poppins font-extrabold text-2xl text-yaziyo-text mb-2',
            wpmClass: 'text-yaziyo-gold font-extrabold text-2xl',
            wpmUnit: 'text-sm',
        },
        2: {
            wrap: 'w-full sm:w-1/3 order-2 sm:order-1 mt-16 sm:mt-8 h-48 rounded-t-2xl border border-slate-300 dark:border-slate-600 bg-gradient-to-t from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-700/50',
            badge: 'absolute -top-7 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-slate-300 border-4 border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-700 font-extrabold text-2xl shadow-lg z-10',
            badgeInner: '2',
            label: 'Gümüş',
            labelClass: 'text-slate-500 dark:text-slate-400 font-semibold',
            nameClass: 'font-poppins font-bold text-lg text-yaziyo-text mb-1',
            wpmClass: 'text-yaziyo-green font-extrabold text-xl',
            wpmUnit: 'text-xs',
        },
        3: {
            wrap: 'w-full sm:w-1/3 order-3 sm:order-3 mt-16 sm:mt-12 h-44 rounded-t-2xl border border-orange-300 dark:border-orange-700/50 bg-gradient-to-t from-orange-200/80 to-orange-100/50 dark:from-orange-900/40 dark:to-orange-800/20',
            badge: 'absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-orange-300 border-4 border-orange-100 dark:border-slate-800 flex items-center justify-center text-orange-900 dark:text-orange-200 font-extrabold text-xl shadow-lg z-10',
            badgeInner: '3',
            label: 'Bronz',
            labelClass: 'text-orange-600 dark:text-orange-400 font-semibold',
            nameClass: 'font-poppins font-bold text-base text-yaziyo-text mb-1',
            wpmClass: 'text-orange-500 font-extrabold text-lg',
            wpmUnit: 'text-[10px]',
        },
    }[place];

    const isEmpty = !entry;
    const ad = isEmpty ? 'Boş' : escapeHtml(entry.ad);
    const net = isEmpty ? '—' : escapeHtml(toNum(entry.net_kelime));
    const dogru = isEmpty ? '—' : escapeHtml(toNum(entry.dogru_kelime));
    const yanlis = isEmpty ? '—' : escapeHtml(toNum(entry.yanlis_kelime));

    return `
        <div class="${config.wrap} text-center rounded-b-xl shadow-xl relative flex flex-col justify-end p-4 transition-transform hover:-translate-y-2 duration-300 ${isEmpty ? 'opacity-50' : ''}">
            <div class="${config.badge}">${config.badgeInner}</div>
            <div class="text-xs sm:text-sm font-inter mb-1 uppercase tracking-widest ${config.labelClass}">${config.label}</div>
            <div class="${config.nameClass}">${ad}</div>
            <div class="${config.wpmClass}">${net} <span class="${config.wpmUnit} text-yaziyo-text-secondary font-normal">net</span></div>
            <div class="flex items-center justify-center gap-2 mt-2 text-[11px] font-inter font-semibold">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-yaziyo-green" title="Doğru kelime">
                    <i class="fa-solid fa-check"></i>${dogru}
                </span>
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500" title="Yanlış kelime">
                    <i class="fa-solid fa-xmark"></i>${yanlis}
                </span>
            </div>
        </div>
    `;
}

function renderPodium(liste) {
    const podium = document.getElementById('hiz-podium');
    if (!podium) return;

    if (!liste.length) {
        podium.innerHTML = `
            <div class="w-full text-center py-10 border border-dashed border-yaziyo-border rounded-2xl bg-yaziyo-bg/40">
                <i class="fa-solid fa-trophy text-4xl text-yaziyo-gold/40 mb-3"></i>
                <p class="text-yaziyo-text-secondary font-inter">Bugün henüz sonuç yok. İlk sırayı sen kap!</p>
            </div>
        `;
        return;
    }

    const first = liste[0] || null;
    const second = liste[1] || null;
    const third = liste[2] || null;

    podium.innerHTML = `
        <div class="flex flex-col sm:flex-row items-end justify-center gap-4 sm:gap-6">
            ${podiumCard(second, 2)}
            ${podiumCard(first, 1)}
            ${podiumCard(third, 3)}
        </div>
    `;
}

function tableRow(entry, sira) {
    const ad = escapeHtml(entry.ad);
    const net = escapeHtml(entry.net_kelime);
    const dogru = escapeHtml(entry.dogru_kelime);
    const yanlis = escapeHtml(entry.yanlis_kelime);
    const initial = escapeHtml(getInitial(entry.ad));

    if (sira === 1) {
        return `
            <tr class="bg-gradient-to-r from-yellow-50/50 to-transparent dark:from-yellow-900/10 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/20 transition-colors">
                <td class="px-6 py-4 text-center font-extrabold text-yaziyo-gold text-lg">1</td>
                <td class="px-6 py-4 font-semibold flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-200 to-yellow-400 flex items-center justify-center text-yellow-800 font-bold text-xs shadow-sm">${initial}</div>
                    <span>${ad}</span> <i class="fa-solid fa-crown text-yaziyo-gold text-xs ml-1"></i>
                </td>
                <td class="px-6 py-4 text-center font-bold text-yaziyo-green text-base">${net}</td>
                <td class="px-6 py-4 text-center hidden sm:table-cell text-yaziyo-text">${dogru}</td>
                <td class="px-6 py-4 text-right pr-8 hidden md:table-cell text-red-500">${yanlis}</td>
            </tr>
        `;
    }

    if (sira === 2 || sira === 3) {
        const isSilver = sira === 2;
        const rowBg = isSilver
            ? 'from-slate-50/50 dark:from-slate-800/10 hover:bg-slate-100/50 dark:hover:bg-slate-800/30'
            : 'from-orange-50/50 dark:from-orange-900/10 hover:bg-orange-100/50 dark:hover:bg-orange-900/20';
        const rankColor = isSilver ? 'text-slate-500' : 'text-orange-400';
        const avatar = isSilver
            ? 'from-slate-200 to-slate-400 text-slate-800'
            : 'from-orange-200 to-orange-400 text-orange-900';
        return `
            <tr class="bg-gradient-to-r ${rowBg} to-transparent transition-colors">
                <td class="px-6 py-4 text-center font-extrabold ${rankColor} text-base">${sira}</td>
                <td class="px-6 py-4 font-semibold flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br ${avatar} flex items-center justify-center font-bold text-xs shadow-sm">${initial}</div>
                    ${ad}
                </td>
                <td class="px-6 py-4 text-center font-bold text-yaziyo-green text-base">${net}</td>
                <td class="px-6 py-4 text-center hidden sm:table-cell text-yaziyo-text">${dogru}</td>
                <td class="px-6 py-4 text-right pr-8 hidden md:table-cell text-red-500">${yanlis}</td>
            </tr>
        `;
    }

    const palette = AVATAR_PALETTE[(sira - 4) % AVATAR_PALETTE.length];
    return `
        <tr class="hover:bg-yaziyo-bg/80 transition-colors">
            <td class="px-6 py-4 text-center text-yaziyo-text-secondary font-medium">${sira}</td>
            <td class="px-6 py-4 flex items-center gap-3">
                <div class="w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs ${palette}">${initial}</div>
                <span class="text-yaziyo-text">${ad}</span>
            </td>
            <td class="px-6 py-4 text-center font-semibold text-yaziyo-green">${net}</td>
            <td class="px-6 py-4 text-center hidden sm:table-cell text-yaziyo-text-secondary">${dogru}</td>
            <td class="px-6 py-4 text-right pr-8 hidden md:table-cell text-red-500">${yanlis}</td>
        </tr>
    `;
}

function renderTable(liste) {
    const tbody = document.getElementById('hiz-leaderboard-tbody');
    if (!tbody) return;

    if (!liste.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-10 text-center text-yaziyo-text-secondary italic">
                    Bugün henüz kayıtlı sonuç yok. İlk sırayı sen kap!
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = liste.map((entry, idx) => tableRow(entry, entry.sira || idx + 1)).join('');
}

function renderLoading() {
    const tbody = document.getElementById('hiz-leaderboard-tbody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-10 text-center text-yaziyo-text-secondary italic">
                    <i class="fa-solid fa-circle-notch fa-spin text-yaziyo-gold mr-2"></i>Yükleniyor…
                </td>
            </tr>
        `;
    }
}

export async function loadAndRenderHizSiralama() {
    const tbody = document.getElementById('hiz-leaderboard-tbody');
    const podium = document.getElementById('hiz-podium');
    if (!tbody && !podium) return;

    const client = getClient();
    if (!client) {
        renderPodium([]);
        renderTable([]);
        return;
    }

    renderLoading();

    try {
        const { data, error } = await client.rpc('get_gunluk_hiz_siralama', { p_limit: 50 });
        if (error) throw error;
        const liste = Array.isArray(data?.liste) ? data.liste : [];
        renderPodium(liste);
        renderTable(liste);
    } catch (err) {
        console.warn('Günlük hız sıralaması yüklenemedi:', err);
        renderPodium([]);
        renderTable([]);
    }
}

window.refreshHizSiralama = loadAndRenderHizSiralama;
document.addEventListener('DOMContentLoaded', loadAndRenderHizSiralama);
