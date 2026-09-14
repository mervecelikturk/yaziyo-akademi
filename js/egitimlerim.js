/**
 * YAZİYO — Eğitimlerim (öğrenci paneli)
 * Sol sidebar panelleri: ana, görevler, ilerleme, takvim, etüt, belgeler, paket
 */
import { supabase, initSupabaseClient } from './lib/supabase.js';
import { ensureSession } from './authVerification.js';
import {
    BASARI_ROZETLERI,
    NOT_EMOJILERI,
    GOREV_DURUMLARI,
    TAKVIM_DURUMLARI,
    BELGE_TURLERI,
    isEgitimlerimMissingError,
    fetchEgitimlerimProfil,
    fetchBugunkuNot,
    saveBugunkuNot,
    fetchGorevler,
    updateGorevDurum,
    buildGunlukGorevOzeti,
    fetchKullaniciPaketOzeti,
    fetchOkunmamisMesajSayisi,
    fetchIlerlemeOzeti,
    fetchSonKlavyeCalismalariAnaliz,
    countSkippedFromKayit,
    mergeHarfMsFromKayitlar,
    fetchMetinHavuzu,
    saveMetinHavuzu,
    deleteMetinHavuzu,
    METIN_HAVUZU_LIMIT,
    fetchTakvimKullanici,
    fetchEtutler,
    fetchEtutKatilimSayisi,
    kaydetEtutKatilim,
    fetchBelgeler,
    fetchBelgeDownload
} from './lib/egitimlerimApi.js';
import {
    submitPaketDegerlendirme,
    fetchKullaniciPaketDegerlendirme,
    userHasPurchasedPaket,
    fetchKullaniciPaketleri,
    fetchKullaniciIptalTalepleri,
    olusturPaketIptalTalebi
} from './lib/egitimPaketleriApi.js';
import { mountLiveChatWidget } from './liveChatWidget.js';

let currentUser = null;
let gorevler = [];
let etutTimerIds = [];
let currentPaket = null;
let selectedRating = 0;
let belgeAktifBlobUrl = null;
let iptalHedef = null;
let kullaniciPaketleri = [];
let iptalTalepleri = [];

const els = {};

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}

function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
}

function formatDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function showToast(msg, type = 'success') {
    const t = els.toast;
    if (!t) return;
    t.textContent = msg;
    t.className = `fixed left-4 right-4 bottom-4 sm:left-auto sm:right-6 sm:bottom-6 max-w-sm z-[130] px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl ${
        type === 'error' ? 'bg-red-500 text-white' : 'bg-yaziyo-gold text-slate-900'
    }`;
    // Live Chat FAB ile çakışmasın
    t.style.bottom = document.getElementById('lc-root')
        ? 'max(5.25rem, calc(env(safe-area-inset-bottom, 0px) + 4.25rem))'
        : 'max(1rem, env(safe-area-inset-bottom, 0px))';
    t.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.add('hidden'), 3200);
}

function showLoggedIn(user) {
    document.documentElement.classList.add('is-logged-in');
    els.authGate?.classList.add('hidden');
    els.main?.classList.remove('hidden');
    const name = user?.user_metadata?.site_full_name
        || user?.user_metadata?.full_name
        || user?.email
        || 'Öğrenci';
    if (els.sidebarName) els.sidebarName.textContent = name;
    if (els.welcomeName) els.welcomeName.textContent = name.split(' ')[0];
}

function showLoggedOut() {
    document.documentElement.classList.remove('is-logged-in');
    els.authGate?.classList.remove('hidden');
    els.main?.classList.add('hidden');
}

function switchPanel(id) {
    document.querySelectorAll('.eg-panel').forEach((p) => p.classList.remove('active'));
    document.querySelectorAll('.eg-menu-item').forEach((b) => b.classList.remove('active'));
    document.getElementById(`panel-${id}`)?.classList.add('active');
    document.querySelector(`[data-eg-panel="${id}"]`)?.classList.add('active');
    if (window.innerWidth < 1024) {
        els.menuList?.classList.remove('open');
    }
}

/* ---------- Ana sayfa render ---------- */

function renderRozet(rozetId) {
    const meta = BASARI_ROZETLERI[rozetId];
    if (!meta) {
        els.rozetLabel.textContent = 'Rozet yok';
        els.rozetWrap.querySelector('i').className = 'fa-solid fa-medal';
        return;
    }
    els.rozetLabel.textContent = meta.label;
    els.rozetWrap.querySelector('i').className = `fa-solid ${meta.icon}`;
}

function renderPaket(paket) {
    currentPaket = paket;
    if (!paket) {
        els.paketAdi.textContent = 'Aktif paket yok';
        els.paketBaslangic.textContent = '—';
        els.paketBitis.textContent = '—';
        els.paketKalan.textContent = '—';
        hideRatingCard();
        return;
    }
    els.paketAdi.textContent = paket.paketAdi;
    els.paketBaslangic.textContent = formatDate(paket.baslangic);
    els.paketBitis.textContent = formatDate(paket.bitis);
    const kalan = paket.kalanGun;
    els.paketKalan.textContent = kalan == null ? '—' : (kalan < 0 ? 'Süresi doldu' : `${kalan} gün`);

    if (paket.suresiDoldu && paket.paketId) {
        setupRatingCard(paket.paketId);
    } else {
        hideRatingCard();
    }
}

function paketDurumMetni(p) {
    if (p.durum === 'iptal_edildi') return { text: 'İptal edildi', cls: 'bg-red-500/15 text-red-500' };
    if (p.suresiDoldu) return { text: 'Süresi doldu', cls: 'bg-slate-500/15 text-slate-400' };
    return { text: 'Aktif', cls: 'bg-green-500/15 text-green-500' };
}

function bekleyenTalep(satinAlmaId) {
    return iptalTalepleri.find((t) => t.satin_alma_id === satinAlmaId && t.durum === 'beklemede') || null;
}

function renderPaketDetay() {
    const list = els.paketDetayList;
    if (!list) return;
    if (!kullaniciPaketleri.length) {
        list.innerHTML = '<p class="eg-empty">Görüntülenecek paket bulunamadı.</p>';
        return;
    }

    list.innerHTML = kullaniciPaketleri.map((p) => {
        const durum = paketDurumMetni(p);
        const talep = bekleyenTalep(p.id);
        const kalan = p.durum === 'aktif' && !p.suresiDoldu && p.kalanGun != null
            ? `${p.kalanGun} gün`
            : '—';
        const canRequest = p.durum === 'aktif' && !talep;
        return `
            <div class="rounded-2xl border border-light-border dark:border-dark-border p-4 sm:p-5 mb-3 last:mb-0">
                <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div class="min-w-0">
                        <p class="font-poppins font-bold text-lg">${escapeHtml(p.paketAdi)}</p>
                        <span class="inline-flex mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${durum.cls}">${durum.text}</span>
                    </div>
                    ${canRequest ? `
                        <button type="button" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors"
                            data-iptal-talep="${p.id}">
                            <i class="fa-solid fa-ban"></i> Paketi İptal Et
                        </button>` : ''}
                </div>
                <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div class="flex justify-between gap-2"><dt class="text-light-text-secondary">Başlangıç</dt><dd class="font-semibold">${escapeHtml(formatDate(p.baslangic))}</dd></div>
                    <div class="flex justify-between gap-2"><dt class="text-light-text-secondary">Bitiş</dt><dd class="font-semibold">${escapeHtml(formatDate(p.bitis))}</dd></div>
                    <div class="flex justify-between gap-2"><dt class="text-light-text-secondary">Kalan gün</dt><dd class="font-bold text-yaziyo-gold">${escapeHtml(kalan)}</dd></div>
                    <div class="flex justify-between gap-2"><dt class="text-light-text-secondary">Ücret</dt><dd class="font-semibold">${(Number(p.fiyat) || 0).toLocaleString('tr-TR')} ₺</dd></div>
                </dl>
                ${talep ? `
                    <div class="mt-4 rounded-xl bg-orange-500/10 border border-orange-500/20 px-3 py-3">
                        <p class="text-xs font-bold text-orange-600 dark:text-orange-400 mb-1">İptal talebiniz iletildi</p>
                        <p class="text-xs text-light-text-secondary leading-relaxed">${escapeHtml(talep.neden)}</p>
                        <p class="text-[11px] text-light-text-secondary mt-2">Yönetici değerlendirene kadar paketiniz aktif kalır.</p>
                    </div>` : ''}
                ${p.durum === 'iptal_edildi' ? `
                    <p class="mt-3 text-xs text-red-500">Bu paket ${p.iptalEdildiAt ? formatDate(p.iptalEdildiAt) : ''} tarihinde iptal edildi.</p>` : ''}
            </div>`;
    }).join('');
}

async function loadPaketDetay() {
    if (!currentUser) return;
    const [paketRes, talepRes] = await Promise.all([
        fetchKullaniciPaketleri(currentUser.id),
        fetchKullaniciIptalTalepleri(currentUser.id)
    ]);
    if (paketRes.error) {
        if (els.paketDetayList) {
            els.paketDetayList.innerHTML = `<p class="eg-empty">${escapeHtml(paketRes.error.message || 'Paketler yüklenemedi')}</p>`;
        }
        return;
    }
    kullaniciPaketleri = paketRes.data || [];
    if (talepRes.error) {
        const msg = (talepRes.error.message || '').toLowerCase();
        if (msg.includes('paket_iptal_talepleri') || talepRes.error.code === 'PGRST205') {
            iptalTalepleri = [];
        } else {
            iptalTalepleri = [];
        }
    } else {
        iptalTalepleri = talepRes.data || [];
    }
    renderPaketDetay();
}

function iptalModalAc(satinAlmaId, paketAdi) {
    iptalHedef = { id: satinAlmaId, ad: paketAdi };
    if (els.iptalPaketAdi) els.iptalPaketAdi.textContent = paketAdi || 'Eğitim paketi';
    if (els.iptalNeden) els.iptalNeden.value = '';
    if (els.iptalCount) els.iptalCount.textContent = '0/800';
    els.iptalModal?.classList.remove('hidden');
    els.iptalModal?.classList.add('is-open');
    els.iptalModal?.setAttribute('aria-hidden', 'false');
    document.body.classList.add('eg-belge-open');
    els.iptalNeden?.focus();
}

function iptalModalKapat() {
    iptalHedef = null;
    els.iptalModal?.classList.add('hidden');
    els.iptalModal?.classList.remove('is-open');
    els.iptalModal?.setAttribute('aria-hidden', 'true');
    if (!els.belgeModal?.classList.contains('is-open')) {
        document.body.classList.remove('eg-belge-open');
    }
}

function hideRatingCard() {
    els.ratingCard?.classList.add('hidden');
    selectedRating = 0;
}

function renderStarPicker(active = 0) {
    if (!els.ratingStars) return;
    els.ratingStars.innerHTML = [1, 2, 3, 4, 5].map((n) => `
        <button type="button" class="w-10 h-10 text-2xl transition-transform hover:scale-110 ${n <= active ? 'text-yaziyo-gold' : 'text-slate-400/40'}"
            data-rate="${n}" aria-label="${n} yıldız">
            <i class="fa-${n <= active ? 'solid' : 'regular'} fa-star"></i>
        </button>
    `).join('');
}

async function setupRatingCard(paketId) {
    if (!els.ratingCard) return;
    els.ratingCard.classList.remove('hidden');
    els.ratingDone?.classList.add('hidden');
    els.ratingSave?.classList.remove('hidden');
    els.ratingYorum?.classList.remove('hidden');
    els.ratingStars?.classList.remove('hidden');

    const { data } = await fetchKullaniciPaketDegerlendirme(paketId, currentUser.id);
    if (data?.puan) {
        selectedRating = data.puan;
        renderStarPicker(selectedRating);
        if (els.ratingYorum) els.ratingYorum.value = data.yorum || '';
        if (els.ratingDone) {
            els.ratingDone.textContent = `Değerlendirmeniz kaydedildi: ${data.puan}/5`;
            els.ratingDone.classList.remove('hidden');
        }
    } else {
        selectedRating = 0;
        renderStarPicker(0);
        if (els.ratingYorum) els.ratingYorum.value = '';
    }
}

async function loadAnaSayfa() {
    const uid = currentUser.id;

    const [profilRes, notRes, paketRes, mesajRes, gorevRes] = await Promise.all([
        fetchEgitimlerimProfil(uid),
        fetchBugunkuNot(uid),
        fetchKullaniciPaketOzeti(uid),
        fetchOkunmamisMesajSayisi(uid),
        fetchGorevler(uid)
    ]);

    if (profilRes.error && isEgitimlerimMissingError(profilRes.error)) {
        showToast('Eğitimlerim veritabanı kurulumu gerekli (sql/025_egitimlerim.sql)', 'error');
    }

    const profil = profilRes.data;
    renderRozet(profil?.basari_rozeti);
    els.kocAdi.textContent = profil?.koc_adi || 'Henüz atanmadı';
    els.sonrakiGorusme.textContent = profil?.sonraki_gorusme
        ? formatDateTime(profil.sonraki_gorusme)
        : 'Planlanmadı';

    const not = notRes.data;
    els.dailyNote.value = not?.icerik || '';
    els.noteCount.textContent = `${(not?.icerik || '').length}/256`;
    const emojiMeta = NOT_EMOJILERI[not?.admin_emoji];
    els.noteEmoji.textContent = emojiMeta ? emojiMeta.emoji : '';

    renderPaket(paketRes.data);
    els.mesajCount.textContent = String(mesajRes.count || 0);

    gorevler = gorevRes.data || [];
    els.gorevOzeti.textContent = buildGunlukGorevOzeti(gorevler).metin;
    await loadMetinHavuzu();
}

/* ---------- Metin havuzu ---------- */

function renderMetinHavuzu(items) {
    const list = els.havuzList;
    if (els.havuzCount) {
        els.havuzCount.textContent = `${items.length}/${METIN_HAVUZU_LIMIT}`;
    }
    if (els.havuzKaydet) {
        els.havuzKaydet.disabled = items.length >= METIN_HAVUZU_LIMIT;
    }
    if (!list) return;
    if (!items.length) {
        list.innerHTML = '<p class="eg-empty" style="padding:0.75rem 0">Henüz metin eklemediniz.</p>';
        return;
    }
    list.innerHTML = items.map((m) => `
        <div class="eg-havuz-item" data-havuz-id="${escapeHtml(m.id)}">
            <div class="min-w-0">
                <p class="text-[10px] uppercase tracking-widest text-yaziyo-gold font-bold">${escapeHtml(m.tur || 'Kendi Metnim')}</p>
                <p class="font-poppins font-bold text-sm">${escapeHtml(m.ad)}</p>
                <p class="text-xs text-light-text-secondary">${escapeHtml(m.grup)}</p>
            </div>
            <button type="button" class="px-3 py-1.5 rounded-lg border border-red-400/50 text-red-500 text-xs font-bold" data-havuz-sil="${escapeHtml(m.id)}">
                Sil
            </button>
        </div>`).join('');
}

async function loadMetinHavuzu() {
    const { data, error } = await fetchMetinHavuzu(currentUser.id);
    if (error && isEgitimlerimMissingError(error)) {
        showToast('Metin havuzu için sql/035_egitimlerim_analiz_metin.sql çalıştırın', 'error');
        renderMetinHavuzu([]);
        return;
    }
    if (error) {
        showToast(error.message || 'Metin havuzu yüklenemedi', 'error');
        renderMetinHavuzu([]);
        return;
    }
    renderMetinHavuzu(data || []);
}

async function kaydetMetinHavuzu() {
    if (els.havuzTur) els.havuzTur.value = 'Kendi Metnim';
    const { error } = await saveMetinHavuzu({
        grup: els.havuzGrup?.value || '',
        ad: els.havuzAd?.value || '',
        icerik: els.havuzIcerik?.value || ''
    });
    if (error) {
        const msg = error.message || 'Metin eklenemedi';
        showToast(msg.includes('egitimlerim_metin') ? 'Metin havuzu için sql/035_egitimlerim_analiz_metin.sql çalıştırın' : msg, 'error');
        return;
    }
    if (els.havuzGrup) els.havuzGrup.value = '';
    if (els.havuzAd) els.havuzAd.value = '';
    if (els.havuzIcerik) els.havuzIcerik.value = '';
    showToast('Metin eklendi. Klavye çalışmasında Kendi Metnim türünden seçebilirsiniz.');
    await loadMetinHavuzu();
}

/* ---------- Görevler ---------- */

function renderGorevler() {
    const list = els.gorevList;
    if (!list) return;
    if (!gorevler.length) {
        list.innerHTML = '<p class="eg-empty">Henüz size atanmış görev yok.</p>';
        return;
    }
    list.innerHTML = gorevler.map((g) => {
        const opts = Object.values(GOREV_DURUMLARI).map((d) =>
            `<option value="${d.id}" ${g.durum === d.id ? 'selected' : ''}>${d.label}</option>`
        ).join('');
        return `
            <div class="eg-task-row" data-gorev-id="${g.id}">
                <div class="flex flex-wrap items-center gap-2">
                    <span class="eg-pill ${g.oncelik === 'zorunlu' ? 'eg-pill-zorunlu' : 'eg-pill-onerilen'}">
                        ${g.oncelik === 'zorunlu' ? 'Zorunlu' : 'Önerilen'}
                    </span>
                    <h3 class="font-poppins font-bold text-sm">${escapeHtml(g.baslik)}</h3>
                </div>
                <p class="text-sm text-light-text-secondary">${escapeHtml(g.aciklama || '')}</p>
                <p class="eg-task-meta flex flex-wrap items-center justify-between gap-2">
                    <span><i class="fa-regular fa-clock mr-1"></i>~${g.tahmini_sure_dk || 15} dk</span>
                    <span class="flex items-center gap-2">
                        <span class="eg-gorev-durum">${escapeHtml(GOREV_DURUMLARI[g.durum]?.label || g.durum)}</span>
                        <select class="eg-task-select" data-gorev-durum="${g.id}">
                            ${opts}
                        </select>
                    </span>
                </p>
            </div>`;
    }).join('');
}

async function loadGorevler() {
    const { data, error } = await fetchGorevler(currentUser.id);
    if (error) {
        showToast(error.message || 'Görevler yüklenemedi', 'error');
        return;
    }
    gorevler = data || [];
    renderGorevler();
    els.gorevOzeti.textContent = buildGunlukGorevOzeti(gorevler).metin;
}

/* ---------- İlerleme grafikleri (canvas) ---------- */

function drawLineChart(canvas, values, labels, targets = []) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const cssH = 180;
    const w = Math.max(canvas.clientWidth || 280, 200);
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, cssH);

    const h = cssH;
    const pad = w < 340 ? 22 : 30;
    const targetVals = (targets || []).map((t) => Number(t.value) || 0);
    const maxVal = Math.max(...values, ...targetVals, 1) * 1.18;
    const stepX = (w - pad * 2) / Math.max(values.length - 1, 1);
    const yOf = (v) => h - pad - ((Number(v) || 0) / maxVal) * (h - pad * 2);

    ctx.strokeStyle = 'rgba(148,163,184,0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
        const y = pad + ((h - pad * 2) * i) / 3;
        ctx.beginPath();
        ctx.moveTo(pad, y);
        ctx.lineTo(w - pad, y);
        ctx.stroke();
    }

    (targets || []).forEach((t) => {
        const val = Number(t.value) || 0;
        if (!val) return;
        const hy = yOf(val);
        ctx.strokeStyle = t.color || 'rgba(234,179,8,0.7)';
        ctx.lineWidth = 1.75;
        ctx.setLineDash(t.dash || [6, 4]);
        ctx.beginPath();
        ctx.moveTo(pad, hy);
        ctx.lineTo(w - pad, hy);
        ctx.stroke();
        ctx.setLineDash([]);
    });

    if (!values.length) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Henüz kayıt yok', w / 2, h / 2);
        return;
    }

    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    values.forEach((v, i) => {
        const x = pad + i * stepX;
        const y = yOf(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const showEvery = values.length > 6 && w < 400 ? 2 : 1;
    values.forEach((v, i) => {
        const x = pad + i * stepX;
        const y = yOf(v);
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        if (i % showEvery !== 0 && i !== values.length - 1) return;
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        const label = labels[i] || '';
        const shortLabel = w < 360 && label.length > 8 ? `${label.slice(0, 7)}…` : label;
        ctx.fillText(shortLabel, x, h - 8);
        ctx.fillText(String(v ?? '—'), x, y - 8);
    });
}

function drawDonutChart(canvas, percent) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(canvas.clientWidth || 180, 200);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.32;
    const p = Math.max(0, Math.min(100, percent || 0)) / 100;

    ctx.lineWidth = 18;
    ctx.strokeStyle = 'rgba(148,163,184,0.25)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#eab308';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#eab308';
    ctx.font = 'bold 22px Poppins, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(p * 100)}%`, cx, cy);
}

let lastIlerlemeChart = null;
let chartResizeObserver = null;

function redrawIlerlemeCharts() {
    if (!lastIlerlemeChart) return;
    const { lineValues, labels, targets, ort } = lastIlerlemeChart;
    drawLineChart(els.lineChart, lineValues, labels, targets);
    drawDonutChart(els.donutChart, ort);
}

function bindChartResize() {
    if (chartResizeObserver || typeof ResizeObserver === 'undefined') return;
    const target = els.lineChart?.parentElement || els.lineChart;
    if (!target) return;
    let t = null;
    chartResizeObserver = new ResizeObserver(() => {
        clearTimeout(t);
        t = setTimeout(redrawIlerlemeCharts, 120);
    });
    chartResizeObserver.observe(target);
}

function fmtStat(v) {
    return v == null || Number.isNaN(Number(v)) ? '—' : String(Math.round(Number(v)));
}

function renderSon10Analiz(rows) {
    const list = els.son10Analiz;
    if (!list) return;
    if (!rows.length) {
        list.innerHTML = '<li class="text-light-text-secondary">Son 10 çalışma için henüz kayıt yok.</li>';
        return;
    }

    const harfler = mergeHarfMsFromKayitlar(rows);
    const fastest = harfler[0] || null;
    const slowest = harfler.length ? harfler[harfler.length - 1] : null;

    let dogru = 0;
    let yanlis = 0;
    let atlanan = 0;
    rows.forEach((r) => {
        dogru += Math.max(0, Number(r.dogru_kelime) || 0);
        yanlis += Math.max(0, Number(r.yanlis_kelime) || 0);
        atlanan += countSkippedFromKayit(r);
    });
    const attempted = dogru + yanlis + atlanan;
    const skipRate = attempted > 0 ? ((atlanan / attempted) * 100) : 0;
    const errRate = (dogru + yanlis) > 0 ? ((yanlis / (dogru + yanlis)) * 100) : 0;

    const harfYok = rows.length ? 'Yeni kayıtlardan sonra görünür' : '—';
    const items = [
        {
            label: 'En hızlı harf',
            value: fastest ? `${fastest.harf.toLocaleUpperCase('tr-TR')} (${fastest.ms} ms)` : harfYok
        },
        {
            label: 'En yavaş harf',
            value: slowest ? `${slowest.harf.toLocaleUpperCase('tr-TR')} (${slowest.ms} ms)` : harfYok
        },
        {
            label: 'Kelime atlama oranı',
            value: `${skipRate.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}%`
        },
        {
            label: 'Hata oranı',
            value: `${errRate.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}%`
        }
    ];

    list.innerHTML = items.map((it) =>
        `<li><span>${escapeHtml(it.label)}</span><span class="eg-analiz-val">${escapeHtml(it.value)}</span></li>`
    ).join('');
}

function renderChartLegend(targets) {
    if (!els.chartLegend) return;
    const bits = [
        `<span><i class="eg-legend-swatch" style="background:#eab308"></i> Doğru kelime</span>`
    ];
    (targets || []).forEach((t) => {
        bits.push(
            `<span><i class="eg-legend-swatch" style="background:${escapeHtml(t.color)}"></i> ${escapeHtml(t.label)}</span>`
        );
    });
    els.chartLegend.innerHTML = bits.join('');
}

function extremaFromKayitlar(rows) {
    let min1 = null;
    let max1 = null;
    let min3 = null;
    let max3 = null;
    (rows || []).forEach((r) => {
        const sure = Number(r.sure_saniye) || 0;
        const speed1 = Number(r.net_kelime) || Number(r.dogru_kelime) || 0;
        const n3 = Number(r.net_kelime_3dk) || 0;
        if (r.gecerli_3dk && n3 > 0) {
            min3 = min3 == null ? n3 : Math.min(min3, n3);
            max3 = max3 == null ? n3 : Math.max(max3, n3);
        }
        if (sure >= 50 && sure <= 75 && speed1 > 0) {
            min1 = min1 == null ? speed1 : Math.min(min1, speed1);
            max1 = max1 == null ? speed1 : Math.max(max1, speed1);
        }
    });
    return { min1, max1, min3, max3 };
}

function pickNum(preferred, fallback) {
    if (preferred != null && !Number.isNaN(Number(preferred))) return Number(preferred);
    if (fallback != null && !Number.isNaN(Number(fallback))) return Number(fallback);
    return null;
}

async function loadIlerleme() {
    const [ozetRes, sonRes] = await Promise.all([
        fetchIlerlemeOzeti(currentUser.id),
        fetchSonKlavyeCalismalariAnaliz(currentUser.id, 80)
    ]);

    if (ozetRes.error) {
        if (isEgitimlerimMissingError(ozetRes.error)) {
            showToast('İlerleme için sql/025_egitimlerim.sql çalıştırın', 'error');
        }
    }
    const data = ozetRes.data;
    const extra = extremaFromKayitlar(sonRes.data || []);
    const minH = pickNum(data?.min_hiz, extra.min1);
    const maxH = pickNum(data?.max_hiz, extra.max1);
    const min3 = pickNum(data?.min_3dk, extra.min3);
    const max3 = pickNum(data?.max_3dk, extra.max3);
    const hedefH = Number(data?.hedef_hiz) || 40;
    const hedef3 = Number(data?.hedef_3dk) || 90;

    if (els.statMinHiz) els.statMinHiz.textContent = fmtStat(minH);
    if (els.statMaxHiz) els.statMaxHiz.textContent = fmtStat(maxH);
    if (els.statMin3dk) els.statMin3dk.textContent = fmtStat(min3);
    if (els.statMax3dk) els.statMax3dk.textContent = fmtStat(max3);
    if (els.hedefInfo) {
        els.hedefInfo.textContent = `Hedefler — 1 dk: ${hedefH} net · 3 dk: ${hedef3} net (admin tarafından belirlenir)`;
    }

    const last10 = (sonRes.data || []).slice(0, 10);
    const rows = [...last10].reverse();
    const lineValues = rows.map((r) => Math.max(0, Number(r.dogru_kelime) || 0));
    const labels = rows.map((r, i) => {
        const d = r.created_at ? new Date(r.created_at) : null;
        if (!d || Number.isNaN(d.getTime())) return String(i + 1);
        return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
    });
    const targets = [
        { value: hedefH, color: '#38bdf8', dash: [7, 4], label: `1 dk hedef (${hedefH})` },
        { value: hedef3, color: '#fb923c', dash: [3, 4], label: `3 dk hedef (${hedef3})` }
    ];

    const hizPct = maxH != null ? Math.min(100, (Number(maxH) / hedefH) * 100) : 0;
    const metinPct = max3 != null ? Math.min(100, (Number(max3) / hedef3) * 100) : 0;
    const ort = (hizPct + metinPct) / 2;

    lastIlerlemeChart = { lineValues, labels, targets, ort };
    drawLineChart(els.lineChart, lineValues, labels, targets);
    drawDonutChart(els.donutChart, ort);
    renderChartLegend(targets);
    renderSon10Analiz(last10);
    bindChartResize();
}

/* ---------- Takvim ---------- */

function renderTakvim(items) {
    const list = els.takvimList;
    if (!list) return;
    if (!items.length) {
        list.innerHTML = '<p class="eg-empty">Takvimde kayıt yok.</p>';
        return;
    }
    list.innerHTML = items.map((e) => {
        const own = e.kendi_etkinligi !== false && e.tur !== 'dolu';
        const durumLabel = own
            ? (TAKVIM_DURUMLARI[e.durum]?.label || e.durum || '')
            : 'Dolu';
        return `
            <div class="eg-calendar-item ${own ? '' : 'eg-busy'}">
                <div class="text-xs font-semibold text-yaziyo-gold">${escapeHtml(formatDateTime(e.baslangic))}</div>
                <div>
                    <p class="font-poppins font-bold text-sm">${escapeHtml(e.baslik || (own ? 'Etkinlik' : 'Dolu'))}</p>
                    ${own ? `<p class="text-xs text-light-text-secondary">${e.tur === 'online_ders' ? 'Online ders' : 'Görüşme'} · ${formatDateTime(e.bitis)}</p>` : '<p class="text-xs text-light-text-secondary">Bu saat dolu</p>'}
                </div>
                <span class="eg-pill ${own ? 'eg-pill-onerilen' : ''}">${escapeHtml(durumLabel)}</span>
            </div>`;
    }).join('');
}

async function loadTakvim() {
    const { data, error } = await fetchTakvimKullanici();
    if (error) {
        showToast(error.message || 'Takvim yüklenemedi', 'error');
        return;
    }
    renderTakvim(data || []);
}

/* ---------- Etüt ---------- */

function clearEtutTimers() {
    etutTimerIds.forEach((id) => clearInterval(id));
    etutTimerIds = [];
}

function formatCountdown(ms) {
    if (ms <= 0) return 'Başladı';
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}s ${m}dk ${sec}sn`;
    return `${m}dk ${sec}sn`;
}

function renderEtutler(items) {
    clearEtutTimers();
    const list = els.etutList;
    if (!list) return;
    if (!items.length) {
        list.innerHTML = '<p class="eg-empty">Yaklaşan etüt yok.</p>';
        return;
    }
    const now = Date.now();
    list.innerHTML = items.map((e) => {
        const start = new Date(e.baslangic).getTime();
        const end = new Date(e.bitis).getTime();
        const withinHour = start - now <= 60 * 60 * 1000 && start > now;
        const live = now >= start && now <= end;
        return `
            <div class="eg-task-row" data-etut-id="${e.id}">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <h3 class="font-poppins font-bold text-sm">${escapeHtml(e.baslik)}</h3>
                    <span class="eg-countdown" data-etut-countdown="${e.id}">
                        ${live ? 'Canlı' : (withinHour ? formatCountdown(start - now) : '—')}
                    </span>
                </div>
                <p class="text-xs text-light-text-secondary">${formatDateTime(e.baslangic)} – ${formatDateTime(e.bitis)}</p>
                <div class="flex gap-2">
                    <a href="${escapeHtml(e.meet_url)}" target="_blank" rel="noopener"
                        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yaziyo-gold text-slate-900 text-xs font-bold"
                        data-etut-join="${e.id}">
                        <i class="fa-solid fa-video"></i> Katıl
                    </a>
                </div>
            </div>`;
    }).join('');

    items.forEach((e) => {
        const start = new Date(e.baslangic).getTime();
        const end = new Date(e.bitis).getTime();
        const el = list.querySelector(`[data-etut-countdown="${e.id}"]`);
        if (!el) return;
        const tick = () => {
            const n = Date.now();
            if (n >= start && n <= end) {
                el.textContent = 'Canlı';
                return;
            }
            if (start - n <= 60 * 60 * 1000 && start > n) {
                el.textContent = formatCountdown(start - n);
            } else if (n > end) {
                el.textContent = 'Bitti';
            } else {
                el.textContent = '—';
            }
        };
        tick();
        etutTimerIds.push(setInterval(tick, 1000));
    });
}

async function loadEtut() {
    const [{ data, error }, katilim] = await Promise.all([
        fetchEtutler(),
        fetchEtutKatilimSayisi(currentUser.id)
    ]);
    if (error) {
        showToast(error.message || 'Etütler yüklenemedi', 'error');
        return;
    }
    renderEtutler(data || []);
    els.etutKatilim.textContent = String(katilim.count || 0);
}

/* ---------- Belgeler ---------- */

function renderBelgeler(items) {
    const list = els.belgeList;
    if (!list) return;
    if (!items.length) {
        list.innerHTML = '<p class="eg-empty">Henüz belgeniz yok.</p>';
        return;
    }
    list.innerHTML = items.map((b) => `
        <div class="eg-doc-row">
            <div>
                <p class="font-poppins font-bold text-sm">${escapeHtml(b.baslik)}</p>
                <p class="text-xs text-light-text-secondary">
                    ${escapeHtml(BELGE_TURLERI[b.belge_turu]?.label || b.belge_turu)} · ${formatDate(b.created_at)}
                </p>
            </div>
            <div class="flex flex-wrap gap-2">
                <button type="button" class="px-4 py-2 rounded-lg border border-yaziyo-gold/40 text-yaziyo-gold text-xs font-bold hover:bg-yaziyo-gold hover:text-slate-900 transition-all"
                    data-belge-goster="${b.id}">
                    <i class="fa-solid fa-eye mr-1"></i> Görüntüle
                </button>
                <button type="button" class="px-4 py-2 rounded-lg border border-yaziyo-gold/40 text-yaziyo-gold text-xs font-bold hover:bg-yaziyo-gold hover:text-slate-900 transition-all"
                    data-belge-indir="${b.id}">
                    <i class="fa-solid fa-download mr-1"></i> İndir
                </button>
            </div>
        </div>`).join('');
}

async function loadBelgeler() {
    const { data, error } = await fetchBelgeler(currentUser.id);
    if (error) {
        showToast(error.message || 'Belgeler yüklenemedi', 'error');
        return;
    }
    renderBelgeler(data || []);
}

async function indirBelge(id) {
    const { data, error } = await fetchBelgeDownload(id);
    if (error || !data?.dosya_base64) {
        showToast(error?.message || 'Belge indirilemedi', 'error');
        return;
    }
    const link = document.createElement('a');
    link.href = data.dosya_base64.startsWith('data:')
        ? data.dosya_base64
        : `data:application/pdf;base64,${data.dosya_base64}`;
    link.download = data.dosya_adi || `${data.baslik || 'belge'}.pdf`;
    link.click();
}

/** PDF'i indirmeden gösterebilmek için blob URL üretir */
function belgeBlobUrlOlustur(dosyaBase64) {
    const raw = String(dosyaBase64 || '');
    const payload = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
}

function belgeModalKapat() {
    els.belgeModal?.classList.add('hidden');
    els.belgeModal?.classList.remove('is-open');
    els.belgeModal?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('eg-belge-open');
    if (els.belgeFrame) els.belgeFrame.removeAttribute('src');
    if (belgeAktifBlobUrl) {
        URL.revokeObjectURL(belgeAktifBlobUrl);
        belgeAktifBlobUrl = null;
    }
}

async function gosterBelge(id) {
    const { data, error } = await fetchBelgeDownload(id);
    if (error || !data?.dosya_base64) {
        showToast(error?.message || 'Belge açılamadı', 'error');
        return;
    }
    if (belgeAktifBlobUrl) URL.revokeObjectURL(belgeAktifBlobUrl);
    try {
        belgeAktifBlobUrl = belgeBlobUrlOlustur(data.dosya_base64);
    } catch {
        showToast('Belge içeriği okunamadı', 'error');
        return;
    }
    if (els.belgeBaslik) els.belgeBaslik.textContent = data.baslik || 'Belge';
    if (els.belgeAlt) els.belgeAlt.textContent = data.dosya_adi || '';
    if (els.belgeYeniSekme) els.belgeYeniSekme.href = belgeAktifBlobUrl;
    if (els.belgeFrame) els.belgeFrame.src = belgeAktifBlobUrl;
    els.belgeModal?.classList.remove('hidden');
    els.belgeModal?.classList.add('is-open');
    els.belgeModal?.setAttribute('aria-hidden', 'false');
    document.body.classList.add('eg-belge-open');
}

/* ---------- Events / init ---------- */

function cacheElements() {
    els.authGate = document.getElementById('eg-auth-gate');
    els.main = document.getElementById('eg-main-content');
    els.menuToggle = document.getElementById('eg-menu-toggle');
    els.menuList = document.getElementById('eg-menu-list');
    els.menuChevron = document.getElementById('eg-menu-chevron');
    els.sidebarName = document.getElementById('eg-sidebar-name');
    els.welcomeName = document.getElementById('eg-welcome-name');
    els.rozetWrap = document.getElementById('eg-rozet-wrap');
    els.rozetLabel = document.getElementById('eg-rozet-label');
    els.dailyNote = document.getElementById('eg-daily-note');
    els.noteCount = document.getElementById('eg-note-count');
    els.noteEmoji = document.getElementById('eg-note-emoji');
    els.noteSave = document.getElementById('eg-note-save');
    els.paketAdi = document.getElementById('eg-paket-adi');
    els.paketBaslangic = document.getElementById('eg-paket-baslangic');
    els.paketBitis = document.getElementById('eg-paket-bitis');
    els.paketKalan = document.getElementById('eg-paket-kalan');
    els.ratingCard = document.getElementById('eg-rating-card');
    els.ratingStars = document.getElementById('eg-rating-stars');
    els.ratingYorum = document.getElementById('eg-rating-yorum');
    els.ratingSave = document.getElementById('eg-rating-save');
    els.ratingDone = document.getElementById('eg-rating-done');
    els.kocAdi = document.getElementById('eg-koc-adi');
    els.sonrakiGorusme = document.getElementById('eg-sonraki-gorusme');
    els.mesajCount = document.getElementById('eg-mesaj-count');
    els.gorevOzeti = document.getElementById('eg-gorev-ozeti');
    els.gorevList = document.getElementById('eg-gorev-list');
    els.statMinHiz = document.getElementById('eg-stat-min-hiz');
    els.statMaxHiz = document.getElementById('eg-stat-max-hiz');
    els.statMin3dk = document.getElementById('eg-stat-min-3dk');
    els.statMax3dk = document.getElementById('eg-stat-max-3dk');
    els.lineChart = document.getElementById('eg-line-chart');
    els.donutChart = document.getElementById('eg-donut-chart');
    els.hedefInfo = document.getElementById('eg-hedef-info');
    els.son10Analiz = document.getElementById('eg-son10-analiz');
    els.chartLegend = document.getElementById('eg-chart-legend');
    els.havuzTur = document.getElementById('eg-havuz-tur');
    els.havuzGrup = document.getElementById('eg-havuz-grup');
    els.havuzAd = document.getElementById('eg-havuz-ad');
    els.havuzIcerik = document.getElementById('eg-havuz-icerik');
    els.havuzKaydet = document.getElementById('eg-havuz-kaydet');
    els.havuzList = document.getElementById('eg-havuz-list');
    els.havuzCount = document.getElementById('eg-havuz-count');
    els.takvimList = document.getElementById('eg-takvim-list');
    els.etutList = document.getElementById('eg-etut-list');
    els.etutKatilim = document.getElementById('eg-etut-katilim');
    els.belgeList = document.getElementById('eg-belge-list');
    els.belgeModal = document.getElementById('eg-belge-modal');
    els.belgeBaslik = document.getElementById('eg-belge-baslik');
    els.belgeAlt = document.getElementById('eg-belge-alt');
    els.belgeFrame = document.getElementById('eg-belge-frame');
    els.belgeYeniSekme = document.getElementById('eg-belge-yeni-sekme');
    els.belgeKapat = document.getElementById('eg-belge-kapat');
    els.paketDetayList = document.getElementById('eg-paket-detay-list');
    els.iptalModal = document.getElementById('eg-iptal-modal');
    els.iptalPaketAdi = document.getElementById('eg-iptal-paket-adi');
    els.iptalNeden = document.getElementById('eg-iptal-neden');
    els.iptalCount = document.getElementById('eg-iptal-count');
    els.iptalGonder = document.getElementById('eg-iptal-gonder');
    els.iptalKapat = document.getElementById('eg-iptal-kapat');
    els.iptalVazgec = document.getElementById('eg-iptal-vazgec');
    els.toast = document.getElementById('eg-toast');
}

function bindEvents() {
    els.menuToggle?.addEventListener('click', () => {
        els.menuList?.classList.toggle('open');
        els.menuChevron?.classList.toggle('rotate-180');
    });

    document.querySelectorAll('[data-eg-panel]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.egPanel;
            switchPanel(id);
            if (id === 'gorevler') await loadGorevler();
            if (id === 'ilerleme') await loadIlerleme();
            if (id === 'takvim') await loadTakvim();
            if (id === 'etut') await loadEtut();
            if (id === 'belgeler') await loadBelgeler();
            if (id === 'paket') await loadPaketDetay();
        });
    });

    els.dailyNote?.addEventListener('input', () => {
        const len = els.dailyNote.value.length;
        els.noteCount.textContent = `${len}/256`;
    });

    els.noteSave?.addEventListener('click', async () => {
        const { error } = await saveBugunkuNot(currentUser.id, els.dailyNote.value);
        if (error) {
            showToast(error.message || 'Not kaydedilemedi', 'error');
            return;
        }
        showToast('Günlük not kaydedildi');
    });

    els.havuzKaydet?.addEventListener('click', async () => {
        els.havuzKaydet.disabled = true;
        try {
            await kaydetMetinHavuzu();
        } finally {
            if (els.havuzKaydet && (els.havuzCount?.textContent || '').startsWith(`${METIN_HAVUZU_LIMIT}/`)) {
                els.havuzKaydet.disabled = true;
            } else if (els.havuzKaydet) {
                els.havuzKaydet.disabled = false;
            }
        }
    });

    els.havuzTur?.addEventListener('input', () => {
        els.havuzTur.value = 'Kendi Metnim';
    });

    els.havuzList?.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-havuz-sil]');
        if (!btn) return;
        const { error } = await deleteMetinHavuzu(btn.dataset.havuzSil);
        if (error) {
            showToast(error.message || 'Metin silinemedi', 'error');
            return;
        }
        showToast('Metin silindi');
        await loadMetinHavuzu();
    });

    els.ratingStars?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-rate]');
        if (!btn) return;
        selectedRating = Number(btn.dataset.rate);
        renderStarPicker(selectedRating);
    });

    els.ratingSave?.addEventListener('click', async () => {
        if (!currentPaket?.paketId) return;
        if (!selectedRating || selectedRating < 1) {
            showToast('Lütfen 1-5 yıldız seçin', 'error');
            return;
        }
        els.ratingSave.disabled = true;
        const { data, error } = await submitPaketDegerlendirme(
            currentPaket.paketId,
            selectedRating,
            els.ratingYorum?.value || ''
        );
        els.ratingSave.disabled = false;
        if (error) {
            showToast(error.message || 'Değerlendirme kaydedilemedi', 'error');
            return;
        }
        if (data && data.success === false) {
            showToast(data.message || 'Değerlendirme kaydedilemedi', 'error');
            return;
        }
        if (els.ratingDone) {
            els.ratingDone.textContent = `Teşekkürler! Değerlendirmeniz: ${selectedRating}/5`;
            els.ratingDone.classList.remove('hidden');
        }
        showToast('Değerlendirmeniz kaydedildi');
    });

    els.gorevList?.addEventListener('change', async (e) => {
        const sel = e.target.closest('[data-gorev-durum]');
        if (!sel) return;
        const { data, error } = await updateGorevDurum(sel.dataset.gorevDurum, sel.value);
        if (error) {
            showToast(error.message || 'Durum güncellenemedi', 'error');
            return;
        }
        gorevler = gorevler.map((g) => (g.id === data.id ? data : g));
        els.gorevOzeti.textContent = buildGunlukGorevOzeti(gorevler).metin;
        showToast('Görev durumu güncellendi');
    });

    els.etutList?.addEventListener('click', async (e) => {
        const join = e.target.closest('[data-etut-join]');
        if (!join) return;
        await kaydetEtutKatilim(join.dataset.etutJoin, currentUser.id);
        const { count } = await fetchEtutKatilimSayisi(currentUser.id);
        els.etutKatilim.textContent = String(count || 0);
    });

    els.belgeList?.addEventListener('click', async (e) => {
        const goster = e.target.closest('[data-belge-goster]');
        if (goster) {
            await gosterBelge(goster.dataset.belgeGoster);
            return;
        }
        const btn = e.target.closest('[data-belge-indir]');
        if (!btn) return;
        await indirBelge(btn.dataset.belgeIndir);
    });

    els.belgeKapat?.addEventListener('click', belgeModalKapat);
    els.belgeModal?.addEventListener('click', (e) => {
        if (e.target === els.belgeModal) belgeModalKapat();
    });
    els.paketDetayList?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-iptal-talep]');
        if (!btn) return;
        const paket = kullaniciPaketleri.find((p) => p.id === btn.dataset.iptalTalep);
        iptalModalAc(btn.dataset.iptalTalep, paket?.paketAdi || 'Eğitim paketi');
    });
    els.iptalNeden?.addEventListener('input', () => {
        if (els.iptalCount) els.iptalCount.textContent = `${els.iptalNeden.value.length}/800`;
    });
    els.iptalKapat?.addEventListener('click', iptalModalKapat);
    els.iptalVazgec?.addEventListener('click', iptalModalKapat);
    els.iptalModal?.addEventListener('click', (e) => {
        if (e.target === els.iptalModal) iptalModalKapat();
    });
    els.iptalGonder?.addEventListener('click', async () => {
        if (!iptalHedef?.id) return;
        const neden = (els.iptalNeden?.value || '').trim();
        if (neden.length < 8) {
            showToast('Lütfen iptal nedeninizi en az 8 karakter yazın', 'error');
            return;
        }
        els.iptalGonder.disabled = true;
        const { error } = await olusturPaketIptalTalebi(iptalHedef.id, neden);
        els.iptalGonder.disabled = false;
        if (error) {
            showToast(error.message || 'Talep gönderilemedi', 'error');
            return;
        }
        iptalModalKapat();
        showToast('İptal talebiniz yöneticiye iletildi');
        await loadPaketDetay();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (els.iptalModal?.classList.contains('is-open')) {
            iptalModalKapat();
            return;
        }
        belgeModalKapat();
    });
}

async function init() {
    cacheElements();
    bindEvents();
    await initSupabaseClient();

    const result = await ensureSession(supabase);
    if (!result.ok || !result.user) {
        showLoggedOut();
        return;
    }

    currentUser = result.user;

    const hasPackage = await userHasPurchasedPaket(supabase);
    if (!hasPackage) {
        window.location.replace('../egitim-paketleri/');
        return;
    }

    showLoggedIn(currentUser);

    // Live chat FAB ana sayfa verisini beklemesin
    mountLiveChatWidget(currentUser).catch((err) => {
        console.warn('Live chat başlatılamadı:', err);
    });

    await loadAnaSayfa();

    document.addEventListener('visibilitychange', () => {
        if (document.hidden || !currentUser) return;
        const ilerlemeOpen = document.getElementById('panel-ilerleme')?.classList.contains('active');
        if (ilerlemeOpen) loadIlerleme();
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
