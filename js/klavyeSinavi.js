/**
 * YAZİYO - Klavye Sınavı
 * Haftalık & aylık online sınavlar: katılım, 3 dakikalık yazma testi, sıralama.
 */

import { supabase } from './lib/supabase.js';

function getClient() {
    return window.yaziyoSupabase || supabase;
}

/* ============================================ */
/* Durum & state                                */
/* ============================================ */
let currentUser = null;
let exams = [];                 // tüm aktif sınavlar
let myResults = {};             // sinav_id -> { net_kelime, ... }
let activeTab = 'haftalik';
let tickerStarted = false;

/* Yazma motoru state'i */
const engine = {
    sinav: null,
    target: '',
    started: false,
    finished: false,
    remaining: 0,
    duration: 180,
    timerId: null,
};

/* ============================================ */
/* Yardımcılar                                  */
/* ============================================ */
function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = String(str ?? '');
    return d.innerHTML;
}

function $(id) {
    return document.getElementById(id);
}

function normalizeText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
}

function getInitial(name) {
    const t = String(name || '').trim();
    return t ? t.charAt(0).toLocaleUpperCase('tr-TR') : '?';
}

function formatDateTime(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('tr-TR', {
        day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    });
}

function formatDateShort(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
}

function formatSure(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Sınav durumu:
 *  yaklasiyor      -> now < baslangic
 *  aktif           -> baslangic <= now <= bitis
 *  degerlendiriliyor -> bitis < now < sonuc
 *  tamamlandi      -> now >= sonuc
 */
function getStatus(sinav, now = new Date()) {
    const bas = new Date(sinav.baslangic);
    const bit = new Date(sinav.bitis);
    const son = new Date(sinav.sonuc);
    if (now < bas) return 'yaklasiyor';
    if (now <= bit) return 'aktif';
    if (now < son) return 'degerlendiriliyor';
    return 'tamamlandi';
}

const STATUS_BADGE = {
    yaklasiyor: { label: 'Yaklaşıyor', cls: 'bg-blue-500/15 text-blue-500 border-blue-500/30', icon: 'fa-hourglass-start' },
    aktif: { label: 'Aktif', cls: 'bg-green-500/15 text-green-500 border-green-500/30', icon: 'fa-circle-play' },
    degerlendiriliyor: { label: 'Değerlendiriliyor', cls: 'bg-orange-500/15 text-orange-500 border-orange-500/30', icon: 'fa-clipboard-check' },
    tamamlandi: { label: 'Sonuçlandı', cls: 'bg-yaziyo-gold/15 text-yaziyo-gold border-yaziyo-gold/30', icon: 'fa-ranking-star' },
};

function showToast(message, type = 'success') {
    const toast = $('sinav-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `fixed bottom-6 left-1/2 -translate-x-1/2 z-[400] px-5 py-3 rounded-xl font-inter text-sm font-semibold shadow-2xl transition-all duration-300 ${type === 'error' ? 'bg-red-500 text-white' : 'bg-yaziyo-gold text-slate-900'}`;
    toast.classList.remove('hidden', 'opacity-0', 'translate-y-4');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-4');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3500);
}

/* ============================================ */
/* Görünürlük (auth gate)                       */
/* ============================================ */
function applyView() {
    const gate = $('auth-gate');
    const content = $('sinav-content');
    if (currentUser) {
        document.documentElement.classList.add('is-logged-in');
        if (gate) gate.style.display = 'none';
        if (content) content.style.display = 'block';
    } else {
        document.documentElement.classList.remove('is-logged-in');
        if (gate) gate.style.display = 'block';
        if (content) content.style.display = 'none';
    }
}

/* ============================================ */
/* Veri yükleme                                 */
/* ============================================ */
async function loadExams() {
    const client = getClient();
    if (!client) return;

    try {
        const { data, error } = await client
            .from('sinavlar')
            .select('id, tur, baslik, metin, sure_saniye, baslangic, bitis, sonuc, aktif')
            .eq('aktif', true)
            .order('baslangic', { ascending: false });
        if (error) throw error;
        exams = Array.isArray(data) ? data : [];
    } catch (err) {
        console.warn('Sınavlar yüklenemedi:', err);
        exams = [];
    }

    await loadMyResults();
    renderCards('haftalik');
    renderCards('aylik');
    startTicker();
}

async function loadMyResults() {
    myResults = {};
    const client = getClient();
    if (!client || !currentUser) return;
    try {
        const { data, error } = await client
            .from('sinav_sonuclari')
            .select('sinav_id, net_kelime, dogru_kelime, yanlis_kelime, wpm, dogruluk')
            .eq('kullanici_id', currentUser.id);
        if (error) throw error;
        (data || []).forEach((r) => { myResults[r.sinav_id] = r; });
    } catch (err) {
        console.warn('Kendi sonuçlar yüklenemedi:', err);
    }
}

/* ============================================ */
/* Kart render                                  */
/* ============================================ */
function renderCards(tur) {
    const container = $(tur === 'haftalik' ? 'haftalik-list' : 'aylik-list');
    if (!container) return;

    const list = exams.filter((e) => e.tur === tur);
    if (!list.length) {
        container.innerHTML = emptyState(tur);
        return;
    }
    container.innerHTML = list.map((e) => examCard(e)).join('');
}

function emptyState(tur) {
    const isWeekly = tur === 'haftalik';
    return `
        <div class="col-span-full text-center py-16 border border-dashed border-yaziyo-border rounded-2xl bg-yaziyo-bg/40">
            <i class="fa-solid ${isWeekly ? 'fa-calendar-week' : 'fa-calendar-days'} text-4xl text-yaziyo-gold/40 mb-3"></i>
            <p class="text-yaziyo-text font-poppins font-semibold">Şu an planlanmış ${isWeekly ? 'haftalık' : 'aylık'} sınav yok</p>
            <p class="text-sm text-yaziyo-text-secondary mt-1">
                ${isWeekly ? 'Haftalık sınavlar pazartesi günleri eklenir.' : 'Aylık sınavlar her ayın 15’inde eklenir.'}
            </p>
        </div>
    `;
}

function examCard(sinav) {
    const status = getStatus(sinav);
    const badge = STATUS_BADGE[status];
    const mine = myResults[sinav.id];
    const turLabel = sinav.tur === 'haftalik' ? 'Haftalık Sınav' : 'Aylık Sınav';

    let actionHtml = '';
    let infoHtml = '';

    if (status === 'yaklasiyor') {
        infoHtml = `<i class="fa-solid fa-calendar-day text-yaziyo-gold"></i> Başlangıç: <strong>${formatDateTime(sinav.baslangic)}</strong>`;
        actionHtml = `
            <div class="text-center">
                <div class="text-xs text-yaziyo-text-secondary mb-1">Başlamasına</div>
                <div class="font-poppins font-bold text-yaziyo-gold text-lg" data-countdown="${sinav.baslangic}">—</div>
            </div>
            <button disabled class="w-full mt-3 py-2.5 rounded-xl bg-yaziyo-bg border border-yaziyo-border text-yaziyo-text-secondary font-poppins font-bold text-sm cursor-not-allowed">
                <i class="fa-solid fa-lock mr-1"></i> Henüz Açılmadı
            </button>`;
    } else if (status === 'aktif') {
        infoHtml = `<i class="fa-solid fa-flag-checkered text-yaziyo-gold"></i> Bitiş: <strong>${formatDateTime(sinav.bitis)}</strong>`;
        if (mine) {
            actionHtml = `
                ${myScoreBox(mine)}
                <button disabled class="w-full mt-3 py-2.5 rounded-xl bg-green-500/10 border border-green-500/30 text-green-500 font-poppins font-bold text-sm cursor-default">
                    <i class="fa-solid fa-check mr-1"></i> Katıldınız
                </button>`;
        } else {
            actionHtml = `
                <div class="text-center">
                    <div class="text-xs text-yaziyo-text-secondary mb-1">Katılım kapanmasına</div>
                    <div class="font-poppins font-bold text-green-500 text-lg" data-countdown="${sinav.bitis}">—</div>
                </div>
                <button data-start-exam="${sinav.id}" class="w-full mt-3 py-2.5 rounded-xl bg-gradient-to-r from-yaziyo-gold to-yellow-600 text-slate-900 font-poppins font-bold text-sm hover:shadow-glow-gold hover:scale-[1.02] active:scale-95 transition-all">
                    <i class="fa-solid fa-keyboard mr-1"></i> Sınava Başla
                </button>`;
        }
    } else if (status === 'degerlendiriliyor') {
        infoHtml = `<i class="fa-solid fa-hourglass-half text-orange-500"></i> Sonuçlar: <strong>${formatDateTime(sinav.sonuc)}</strong>`;
        actionHtml = `
            ${mine ? myScoreBox(mine) : `<p class="text-sm text-yaziyo-text-secondary text-center py-2">Bu sınava katılmadınız.</p>`}
            <button disabled class="w-full mt-3 py-2.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-500 font-poppins font-bold text-sm cursor-default">
                <i class="fa-solid fa-clipboard-check mr-1"></i> Sıralama Hazırlanıyor
            </button>`;
    } else { // tamamlandi
        infoHtml = `<i class="fa-solid fa-calendar-check text-yaziyo-gold"></i> ${formatDateShort(sinav.baslangic)} sınavı`;
        actionHtml = `
            ${mine ? myScoreBox(mine) : `<p class="text-sm text-yaziyo-text-secondary text-center py-2">Bu sınava katılmadınız.</p>`}
            <button data-siralama="${sinav.id}" class="w-full mt-3 py-2.5 rounded-xl bg-gradient-to-r from-yaziyo-gold to-yellow-600 text-slate-900 font-poppins font-bold text-sm hover:shadow-glow-gold hover:scale-[1.02] active:scale-95 transition-all">
                <i class="fa-solid fa-ranking-star mr-1"></i> Sıralamayı Gör
            </button>`;
    }

    return `
        <div class="bg-yaziyo-card border border-yaziyo-border rounded-2xl shadow-lg overflow-hidden flex flex-col transition-transform hover:-translate-y-1 duration-300">
            <div class="px-5 pt-5 pb-4 border-b border-yaziyo-border">
                <div class="flex items-center justify-between gap-2 mb-3">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-yaziyo-gold/10 text-yaziyo-gold border border-yaziyo-gold/20">
                        <i class="fa-solid ${sinav.tur === 'haftalik' ? 'fa-calendar-week' : 'fa-calendar-days'}"></i> ${turLabel}
                    </span>
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border ${badge.cls}">
                        <i class="fa-solid ${badge.icon}"></i> ${badge.label}
                    </span>
                </div>
                <h3 class="font-poppins font-bold text-lg text-yaziyo-text leading-snug">${escapeHtml(sinav.baslik)}</h3>
                <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-yaziyo-text-secondary">
                    <span class="inline-flex items-center gap-1.5"><i class="fa-solid fa-stopwatch text-yaziyo-gold"></i> ${Math.round(sinav.sure_saniye / 60)} dk</span>
                    <span class="inline-flex items-center gap-1.5">${infoHtml}</span>
                </div>
            </div>
            <div class="p-5 mt-auto">
                ${actionHtml}
            </div>
        </div>
    `;
}

function myScoreBox(r) {
    return `
        <div class="grid grid-cols-3 gap-2 text-center">
            <div class="bg-yaziyo-bg/60 border border-yaziyo-border rounded-xl py-2">
                <div class="text-[10px] uppercase tracking-wider text-yaziyo-text-secondary">Net</div>
                <div class="font-poppins font-bold text-yaziyo-green">${r.net_kelime}</div>
            </div>
            <div class="bg-yaziyo-bg/60 border border-yaziyo-border rounded-xl py-2">
                <div class="text-[10px] uppercase tracking-wider text-yaziyo-text-secondary">WPM</div>
                <div class="font-poppins font-bold text-yaziyo-text">${r.wpm}</div>
            </div>
            <div class="bg-yaziyo-bg/60 border border-yaziyo-border rounded-xl py-2">
                <div class="text-[10px] uppercase tracking-wider text-yaziyo-text-secondary">Doğruluk</div>
                <div class="font-poppins font-bold text-yaziyo-text">${Math.round(r.dogruluk)}%</div>
            </div>
        </div>
    `;
}

/* ============================================ */
/* Geri sayım ticker                            */
/* ============================================ */
function startTicker() {
    if (tickerStarted) return;
    tickerStarted = true;
    setInterval(updateCountdowns, 1000);
    updateCountdowns();
}

function updateCountdowns() {
    const now = Date.now();
    document.querySelectorAll('[data-countdown]').forEach((el) => {
        const target = new Date(el.getAttribute('data-countdown')).getTime();
        let diff = Math.max(0, Math.floor((target - now) / 1000));
        if (diff <= 0) { el.textContent = 'Şimdi'; return; }
        const g = Math.floor(diff / 86400); diff %= 86400;
        const s = Math.floor(diff / 3600); diff %= 3600;
        const dk = Math.floor(diff / 60);
        const sn = diff % 60;
        if (g > 0) el.textContent = `${g}g ${s}sa`;
        else if (s > 0) el.textContent = `${s}sa ${dk}dk`;
        else el.textContent = `${String(dk).padStart(2, '0')}:${String(sn).padStart(2, '0')}`;
    });
}

/* ============================================ */
/* Sınav (yazma) motoru                         */
/* ============================================ */
function openExam(sinavId) {
    const sinav = exams.find((e) => e.id === sinavId);
    if (!sinav) return;
    if (getStatus(sinav) !== 'aktif') {
        showToast('Bu sınav şu an katılıma açık değil.', 'error');
        return;
    }
    if (myResults[sinavId]) {
        showToast('Bu sınava zaten katıldınız.', 'error');
        return;
    }

    engine.sinav = sinav;
    engine.target = normalizeText(sinav.metin);
    engine.duration = sinav.sure_saniye || 180;
    engine.remaining = engine.duration;
    engine.started = false;
    engine.finished = false;
    clearInterval(engine.timerId);

    $('exam-title').textContent = sinav.baslik;
    $('exam-meta').textContent = `${sinav.tur === 'haftalik' ? 'Haftalık' : 'Aylık'} Sınav · ${Math.round(engine.duration / 60)} dakika`;

    // ekranlar
    $('exam-intro').classList.remove('hidden');
    $('exam-test').classList.add('hidden');
    $('exam-result').classList.add('hidden');

    $('exam-timer').textContent = formatSure(engine.remaining);
    $('exam-wpm').textContent = '0';
    $('exam-acc').textContent = '100%';

    const input = $('exam-input');
    input.value = '';
    input.disabled = false;

    const overlay = $('exam-overlay');
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

function closeExam() {
    clearInterval(engine.timerId);
    const overlay = $('exam-overlay');
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
    document.body.style.overflow = '';
    engine.sinav = null;
}

function startTyping() {
    if (!engine.sinav) return;
    engine.started = true;
    engine.finished = false;

    $('exam-intro').classList.add('hidden');
    $('exam-test').classList.remove('hidden');

    renderHighlight('');
    const input = $('exam-input');
    input.value = '';
    input.disabled = false;
    input.focus();

    engine.remaining = engine.duration;
    $('exam-timer').textContent = formatSure(engine.remaining);

    clearInterval(engine.timerId);
    engine.timerId = setInterval(() => {
        engine.remaining -= 1;
        $('exam-timer').textContent = formatSure(Math.max(0, engine.remaining));
        if (engine.remaining <= 10) {
            $('exam-timer').classList.add('text-red-500');
        }
        if (engine.remaining <= 0) {
            finishExam();
        }
    }, 1000);
}

function onTypingInput() {
    if (!engine.started || engine.finished) return;
    const typed = $('exam-input').value;
    const target = engine.target;

    renderHighlight(typed);

    const elapsed = Math.max(1, engine.duration - engine.remaining);
    const m = computeMetrics(target, typed, elapsed);
    $('exam-wpm').textContent = String(m.wpm);
    $('exam-acc').textContent = `${Math.round(m.accuracy)}%`;

    // metin tamamlandıysa otomatik bitir
    if (typed.length >= target.length) {
        finishExam();
    }
}

function renderHighlight(typed) {
    const target = engine.target;
    const display = $('exam-text');
    if (!display) return;

    const frag = [];
    for (let i = 0; i < target.length; i += 1) {
        const ch = target[i];
        let cls = 'exam-char';
        if (i < typed.length) {
            cls += typed[i] === ch ? ' correct' : ' wrong';
        } else if (i === typed.length) {
            cls += ' current';
        }
        const safe = ch === ' ' ? '&nbsp;' : escapeHtml(ch);
        frag.push(`<span class="${cls}">${safe}</span>`);
    }
    display.innerHTML = frag.join('');

    if (!typed.length) {
        window.YaziyoTypingScroll?.resetTypingPanels({
            referenceEl: display,
            userInputEl: $('exam-input'),
            referenceMoveMode: 'transform',
        });
        return;
    }

    window.YaziyoTypingScroll?.syncTypingPanels({
        referenceEl: display,
        referenceContainer: display,
        referenceFullText: target,
        userInputEl: $('exam-input'),
        typedLen: typed.length,
        referenceMoveMode: 'transform',
    });
}

function computeMetrics(target, typed, elapsedSec) {
    let correctChars = 0;
    const n = Math.min(typed.length, target.length);
    for (let i = 0; i < n; i += 1) {
        if (typed[i] === target[i]) correctChars += 1;
    }
    const totalTyped = typed.length;
    const accuracy = totalTyped > 0 ? (correctChars / totalTyped) * 100 : 100;

    const targetWords = target.split(' ');
    const typedWords = typed.trim().length ? typed.trim().split(/\s+/) : [];
    let dogru = 0;
    for (let i = 0; i < typedWords.length; i += 1) {
        if (typedWords[i] === targetWords[i]) dogru += 1;
    }
    const yanlis = Math.max(0, typedWords.length - dogru);
    const net = dogru;
    const elapsedMin = elapsedSec / 60;
    const wpm = elapsedMin > 0 ? Math.round(dogru / elapsedMin) : 0;

    return { correctChars, totalTyped, accuracy, dogru, yanlis, net, wpm };
}

async function finishExam() {
    if (engine.finished) return;
    engine.finished = true;
    clearInterval(engine.timerId);

    const input = $('exam-input');
    input.disabled = true;
    const typed = input.value;
    const elapsed = Math.max(1, engine.duration - Math.max(0, engine.remaining));
    const m = computeMetrics(engine.target, typed, elapsed);

    // sonuç ekranı
    $('exam-test').classList.add('hidden');
    $('exam-result').classList.remove('hidden');
    $('exam-result-net').textContent = String(m.net);
    $('exam-result-wpm').textContent = String(m.wpm);
    $('exam-result-acc').textContent = `${Math.round(m.accuracy)}%`;
    $('exam-result-dogru').textContent = String(m.dogru);
    $('exam-result-yanlis').textContent = String(m.yanlis);

    const statusEl = $('exam-result-status');
    statusEl.textContent = 'Sonucunuz kaydediliyor...';
    statusEl.className = 'text-sm text-yaziyo-text-secondary text-center';

    await submitResult(engine.sinav, m, elapsed, statusEl);
}

async function submitResult(sinav, m, elapsed, statusEl) {
    const client = getClient();
    if (!client) {
        statusEl.textContent = 'Veritabanı bağlantısı kurulamadı.';
        statusEl.className = 'text-sm text-red-500 text-center';
        return;
    }
    try {
        const { error } = await client.rpc('save_sinav_sonucu', {
            p_sinav_id: sinav.id,
            p_net_kelime: m.net,
            p_dogru_kelime: m.dogru,
            p_yanlis_kelime: m.yanlis,
            p_wpm: m.wpm,
            p_dogruluk: Number(m.accuracy.toFixed(2)),
            p_sure_saniye: elapsed,
        });
        if (error) throw error;

        myResults[sinav.id] = {
            net_kelime: m.net, dogru_kelime: m.dogru, yanlis_kelime: m.yanlis,
            wpm: m.wpm, dogruluk: m.accuracy,
        };

        const son = new Date(sinav.sonuc);
        const sonucHemen = Date.now() >= son.getTime();
        statusEl.textContent = sonucHemen
            ? 'Sonucunuz kaydedildi! Sıralama yayında.'
            : `Sonucunuz kaydedildi! Sıralama ${formatDateTime(sinav.sonuc)} tarihinde açıklanacak.`;
        statusEl.className = 'text-sm text-green-500 font-semibold text-center';

        renderCards(sinav.tur);
    } catch (err) {
        console.error('Sınav sonucu kaydedilemedi:', err);
        statusEl.textContent = err?.message || 'Sonuç kaydedilemedi.';
        statusEl.className = 'text-sm text-red-500 text-center';
    }
}

/* ============================================ */
/* Sıralama modalı                              */
/* ============================================ */
async function openSiralama(sinavId) {
    const sinav = exams.find((e) => e.id === sinavId);
    if (!sinav) return;

    const modal = $('siralama-modal');
    const body = $('siralama-body');
    $('siralama-title').textContent = sinav.baslik;
    $('siralama-subtitle').textContent = `${sinav.tur === 'haftalik' ? 'Haftalık' : 'Aylık'} Sınav · ${formatDateShort(sinav.baslangic)}`;
    body.innerHTML = `<div class="py-12 text-center text-yaziyo-text-secondary"><i class="fa-solid fa-circle-notch fa-spin text-yaziyo-gold text-2xl"></i></div>`;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';

    const client = getClient();
    try {
        const { data, error } = await client.rpc('get_sinav_siralama', { p_sinav_id: sinavId, p_limit: 100 });
        if (error) throw error;
        renderSiralama(data);
    } catch (err) {
        console.error('Sıralama yüklenemedi:', err);
        body.innerHTML = `<div class="py-12 text-center text-red-500">Sıralama yüklenemedi.</div>`;
    }
}

function closeSiralama() {
    const modal = $('siralama-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
}

function renderSiralama(data) {
    const body = $('siralama-body');
    if (!data || !data.aciklandi) {
        body.innerHTML = `
            <div class="py-12 text-center">
                <i class="fa-solid fa-hourglass-half text-3xl text-orange-500 mb-3"></i>
                <p class="text-yaziyo-text font-poppins font-semibold">Sıralama henüz açıklanmadı</p>
                <p class="text-sm text-yaziyo-text-secondary mt-1">Sonuçlar açıklanınca burada görünecek.</p>
            </div>`;
        return;
    }

    const liste = Array.isArray(data.liste) ? data.liste : [];
    if (!liste.length) {
        body.innerHTML = `
            <div class="py-12 text-center">
                <i class="fa-solid fa-user-slash text-3xl text-yaziyo-text-secondary/50 mb-3"></i>
                <p class="text-yaziyo-text font-poppins font-semibold">Bu sınava katılım olmadı</p>
            </div>`;
        return;
    }

    const myRank = data.benim_siram;
    const rows = liste.map((r) => {
        const isMe = currentUser && r.kullanici_id === currentUser.id;
        const rankColor = r.sira === 1 ? 'text-yaziyo-gold' : r.sira === 2 ? 'text-slate-400' : r.sira === 3 ? 'text-orange-400' : 'text-yaziyo-text-secondary';
        const medal = r.sira <= 3 ? `<i class="fa-solid fa-medal ${rankColor}"></i>` : '';
        return `
            <tr class="${isMe ? 'bg-yaziyo-gold/10' : 'hover:bg-yaziyo-bg/60'} transition-colors">
                <td class="px-4 py-3 text-center font-extrabold ${rankColor}">${r.sira} ${medal}</td>
                <td class="px-4 py-3 font-semibold flex items-center gap-2">
                    <span class="w-7 h-7 rounded-full bg-yaziyo-gold/15 text-yaziyo-gold flex items-center justify-center text-xs font-bold">${escapeHtml(getInitial(r.ad))}</span>
                    <span class="text-yaziyo-text">${escapeHtml(r.ad)}${isMe ? ' <span class="text-[10px] text-yaziyo-gold">(Siz)</span>' : ''}</span>
                </td>
                <td class="px-4 py-3 text-center font-bold text-yaziyo-green">${r.net_kelime}</td>
                <td class="px-4 py-3 text-center hidden sm:table-cell text-yaziyo-text">${r.wpm}</td>
                <td class="px-4 py-3 text-center hidden sm:table-cell text-yaziyo-text-secondary">${Math.round(r.dogruluk)}%</td>
            </tr>`;
    }).join('');

    body.innerHTML = `
        <div class="flex items-center justify-between gap-3 px-1 mb-3 text-xs text-yaziyo-text-secondary">
            <span><i class="fa-solid fa-users text-yaziyo-gold mr-1"></i> ${data.katilimci} katılımcı</span>
            ${myRank ? `<span class="font-semibold text-yaziyo-gold"><i class="fa-solid fa-user mr-1"></i> Sıranız: ${myRank}</span>` : ''}
        </div>
        <div class="overflow-x-auto rounded-xl border border-yaziyo-border">
            <table class="w-full text-left font-inter text-sm">
                <thead class="bg-yaziyo-bg border-b border-yaziyo-border text-yaziyo-text-secondary text-xs uppercase tracking-wider">
                    <tr>
                        <th class="px-4 py-3 text-center w-16">Sıra</th>
                        <th class="px-4 py-3">Kullanıcı</th>
                        <th class="px-4 py-3 text-center">Net</th>
                        <th class="px-4 py-3 text-center hidden sm:table-cell">WPM</th>
                        <th class="px-4 py-3 text-center hidden sm:table-cell">Doğruluk</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-yaziyo-border">${rows}</tbody>
            </table>
        </div>`;
}

/* ============================================ */
/* Tab kontrolü                                 */
/* ============================================ */
function switchTab(tur) {
    activeTab = tur;
    ['haftalik', 'aylik'].forEach((t) => {
        const tab = $(`tab-${t}`);
        const panel = $(`panel-${t}`);
        const isActive = t === tur;
        if (tab) tab.classList.toggle('sinav-tab-active', isActive);
        if (panel) panel.classList.toggle('hidden', !isActive);
    });
}

/* ============================================ */
/* Event bağlama & init                         */
/* ============================================ */
function bindEvents() {
    document.addEventListener('click', (e) => {
        const startBtn = e.target.closest('[data-start-exam]');
        if (startBtn) { openExam(startBtn.getAttribute('data-start-exam')); return; }

        const sirBtn = e.target.closest('[data-siralama]');
        if (sirBtn) { openSiralama(sirBtn.getAttribute('data-siralama')); return; }
    });

    $('tab-haftalik')?.addEventListener('click', () => switchTab('haftalik'));
    $('tab-aylik')?.addEventListener('click', () => switchTab('aylik'));

    $('exam-start-btn')?.addEventListener('click', startTyping);
    $('exam-finish-btn')?.addEventListener('click', () => finishExam());
    $('exam-input')?.addEventListener('input', onTypingInput);
    $('exam-input')?.addEventListener('paste', (e) => e.preventDefault());
    $('exam-overlay-close')?.addEventListener('click', () => {
        if (engine.started && !engine.finished) {
            if (!confirm('Sınavdan çıkarsanız bu deneme geçersiz sayılır. Çıkmak istiyor musunuz?')) return;
        }
        closeExam();
    });
    $('exam-result-close')?.addEventListener('click', closeExam);

    $('siralama-close')?.addEventListener('click', closeSiralama);
    $('siralama-backdrop')?.addEventListener('click', closeSiralama);
}

async function init() {
    bindEvents();

    const client = getClient();
    if (!client) { applyView(); return; }

    try {
        const { data: { session } } = await client.auth.getSession();
        currentUser = session?.user || null;
    } catch (_) {
        currentUser = null;
    }
    applyView();
    if (currentUser) loadExams();

    // Auth değişimlerini izle (callback içinde supabase auth metodu ÇAĞIRMA -> deadlock)
    client.auth.onAuthStateChange((event, session) => {
        const user = session?.user || null;
        const changed = (user?.id || null) !== (currentUser?.id || null);
        currentUser = user;
        applyView();
        if (changed && user) {
            setTimeout(() => loadExams(), 0);
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
