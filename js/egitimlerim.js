/**
 * YAZİYO — Eğitimlerim (öğrenci paneli)
 * Sol sidebar panelleri: ana, görevler, ilerleme, takvim, etüt, belgeler
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
    fetchTakvimKullanici,
    fetchEtutler,
    fetchEtutKatilimSayisi,
    kaydetEtutKatilim,
    fetchBelgeler,
    fetchBelgeDownload
} from './lib/egitimlerimApi.js';
import {
    submitPaketDegerlendirme,
    fetchKullaniciPaketDegerlendirme
} from './lib/egitimPaketleriApi.js';

let currentUser = null;
let gorevler = [];
let etutTimerIds = [];
let currentPaket = null;
let selectedRating = 0;

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
    t.className = `fixed bottom-6 right-6 z-[130] px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl ${
        type === 'error' ? 'bg-red-500 text-white' : 'bg-yaziyo-gold text-slate-900'
    }`;
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
                <div class="eg-task-meta flex flex-wrap items-center justify-between gap-2">
                    <span><i class="fa-regular fa-clock mr-1"></i>~${g.tahmini_sure_dk || 15} dk</span>
                    <select class="admin-form-select text-xs py-1.5 px-2 rounded-lg border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg" data-gorev-durum="${g.id}">
                        ${opts}
                    </select>
                </div>
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

function drawLineChart(canvas, values, labels, hedef) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 320;
    const h = canvas.height || 180;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const pad = 28;
    const maxVal = Math.max(hedef || 0, ...values, 1) * 1.15;
    const stepX = (w - pad * 2) / Math.max(values.length - 1, 1);

    // grid
    ctx.strokeStyle = 'rgba(148,163,184,0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
        const y = pad + ((h - pad * 2) * i) / 3;
        ctx.beginPath();
        ctx.moveTo(pad, y);
        ctx.lineTo(w - pad, y);
        ctx.stroke();
    }

    // hedef çizgisi
    if (hedef) {
        const hy = h - pad - ((hedef / maxVal) * (h - pad * 2));
        ctx.strokeStyle = 'rgba(234,179,8,0.7)';
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(pad, hy);
        ctx.lineTo(w - pad, hy);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // çizgi
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    values.forEach((v, i) => {
        const x = pad + i * stepX;
        const y = h - pad - ((v / maxVal) * (h - pad * 2));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    values.forEach((v, i) => {
        const x = pad + i * stepX;
        const y = h - pad - ((v / maxVal) * (h - pad * 2));
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(labels[i] || '', x, h - 8);
        ctx.fillText(String(v ?? '—'), x, y - 8);
    });
}

function drawDonutChart(canvas, percent) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(canvas.clientWidth || 200, 200);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
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

async function loadIlerleme() {
    const { data, error } = await fetchIlerlemeOzeti(currentUser.id);
    if (error) {
        if (isEgitimlerimMissingError(error)) {
            showToast('İlerleme için sql/025_egitimlerim.sql çalıştırın', 'error');
        }
        return;
    }
    const minH = data?.min_hiz;
    const maxH = data?.max_hiz;
    const min3 = data?.min_3dk;
    const max3 = data?.max_3dk;
    const hedefH = Number(data?.hedef_hiz) || 40;
    const hedef3 = Number(data?.hedef_3dk) || 90;

    els.statMinHiz.textContent = minH == null ? '—' : String(Math.round(minH));
    els.statMaxHiz.textContent = maxH == null ? '—' : String(Math.round(maxH));
    els.statMin3dk.textContent = min3 == null ? '—' : String(Math.round(min3));
    els.statMax3dk.textContent = max3 == null ? '—' : String(Math.round(max3));
    els.hedefInfo.textContent = `Hedefler — Hız testi: ${hedefH} net · 3 dk metin: ${hedef3} net`;

    const lineValues = [
        Number(minH) || 0,
        Number(maxH) || 0,
        Number(min3) || 0,
        Number(max3) || 0
    ];
    drawLineChart(
        els.lineChart,
        lineValues,
        ['Min hız', 'Max hız', 'Min 3dk', 'Max 3dk'],
        Math.max(hedefH, hedef3)
    );

    const hizPct = maxH != null ? Math.min(100, (Number(maxH) / hedefH) * 100) : 0;
    const metinPct = max3 != null ? Math.min(100, (Number(max3) / hedef3) * 100) : 0;
    const ort = (hizPct + metinPct) / 2;
    drawDonutChart(els.donutChart, ort);
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
            <button type="button" class="px-4 py-2 rounded-lg border border-yaziyo-gold/40 text-yaziyo-gold text-xs font-bold hover:bg-yaziyo-gold hover:text-slate-900 transition-all"
                data-belge-indir="${b.id}">
                <i class="fa-solid fa-download mr-1"></i> İndir
            </button>
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
    els.takvimList = document.getElementById('eg-takvim-list');
    els.etutList = document.getElementById('eg-etut-list');
    els.etutKatilim = document.getElementById('eg-etut-katilim');
    els.belgeList = document.getElementById('eg-belge-list');
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
        const btn = e.target.closest('[data-belge-indir]');
        if (!btn) return;
        await indirBelge(btn.dataset.belgeIndir);
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
    showLoggedIn(currentUser);
    await loadAnaSayfa();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
