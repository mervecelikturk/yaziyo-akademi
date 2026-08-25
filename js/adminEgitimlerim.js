/**
 * YAZİYO — Admin Eğitimlerim yönetimi
 * Sekmeler: profil, paketler, notlar, görevler, takvim, etüt, belgeler, livechat
 */
import { requireAdminAccess } from './lib/adminAuth.js';
import { initSupabaseClient } from './lib/supabase.js';
import {
    BASARI_ROZETLERI,
    NOT_EMOJILERI,
    GOREV_DURUMLARI,
    TAKVIM_DURUMLARI,
    BELGE_TURLERI,
    isEgitimlerimMissingError,
    fetchKullaniciListesi,
    fetchEgitimlerimProfil,
    upsertEgitimlerimProfil,
    fetchNotlarAdmin,
    setNotEmoji,
    deleteNot,
    bildirimGonder,
    fetchAdminKullaniciOzeti,
    fetchAdminKullaniciCalismalari,
    fetchGorevler,
    upsertGorev,
    deleteGorev,
    fetchTakvimAdmin,
    upsertTakvimEvent,
    deleteTakvimEvent,
    fetchEtutler,
    upsertEtut,
    deleteEtut,
    fetchBelgeler,
    fetchBelgeDownload,
    gonderBelge,
    deleteBelge
} from './lib/egitimlerimApi.js';
import {
    fetchKullaniciPaketleri,
    cancelKullaniciPaketi,
    fetchAllPaketlerAdmin,
    adminPaketTanimla
} from './lib/egitimPaketleriApi.js';
import { createAdminLiveChatPanel } from './lib/adminLiveChatPanel.js';
import { createCertificatePdf, buildBelgeCumlesi, formatBelgeAdi } from './lib/certificatePdf.js';
import {
    formatStatNumber,
    formatStudyDuration,
    formatPracticeDuration,
    analyzeLetterMistakesFromSessions
} from './userStats.js';

let users = [];
let selectedUserId = '';
let pendingPdfBase64 = null;
let pendingPdfFileName = '';
let liveChatPanel = null;
let liveChatReady = false;
let syncingUserFromChat = false;
let activeTab = 'profil';
let paketOptions = [];
let calismalar = [];
let belgeBlobUrl = null;

/** Harf analizi profil sayfasıyla aynı pencereyi kullanır */
const HARF_ANALIZI_SEANS = 10;

/** Çalışma listesi bu kadar günü gösterir */
const CALISMA_GUN = 5;

/** İstatistik/harf analizi için çekilen geçmiş penceresi */
const CALISMA_FETCH_GUN = 30;

const USER_REQUIRED_TABS = new Set(['profil', 'paketler', 'notlar', 'gorevler', 'takvim', 'etut', 'belgeler']);
/** Paketler dışında tüm sekmeler: kullanıcının satın alımı yoksa kilitli */
const PACKAGE_GATED_TABS = new Set(['profil', 'notlar', 'gorevler', 'takvim', 'etut', 'belgeler', 'livechat']);

const els = {};
let selectedUserHasPaket = null;

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}

function showToast(message, type = 'success') {
    const toast = els.toast;
    if (!toast) return;
    toast.textContent = message;
    toast.className = `fixed left-4 right-4 bottom-4 sm:left-auto sm:right-6 sm:bottom-6 max-w-sm z-[200] px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl ${
        type === 'error' ? 'bg-red-500 text-white' : 'bg-yaziyo-gold text-slate-900'
    }`;
    toast.style.bottom = 'max(1rem, env(safe-area-inset-bottom, 0px))';
    toast.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.add('hidden'), 3200);
}

function selectedUser() {
    return users.find((u) => u.id === selectedUserId) || null;
}

function userDisplayName(u) {
    if (!u) return '';
    return (u.full_name || '').trim() || u.email || 'Kullanıcı';
}

function toLocalInputValue(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(val) {
    if (!val) return null;
    return new Date(val).toISOString();
}

function formatDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function requireUser() {
    if (!selectedUserId) {
        showToast('Önce kullanıcı seçin', 'error');
        return false;
    }
    return true;
}

function needsSelectedUser() {
    return USER_REQUIRED_TABS.has(activeTab) && !selectedUserId;
}

function needsPurchasedPaket() {
    return !!selectedUserId
        && PACKAGE_GATED_TABS.has(activeTab)
        && selectedUserHasPaket === false;
}

function setNeedUserOverlay(mode) {
    const title = els.needUserTitle;
    const text = els.needUserText;
    const icon = els.needUserIcon;
    if (mode === 'paket') {
        if (icon) icon.className = 'fa-solid fa-box-open text-3xl text-yaziyo-gold mb-3';
        if (title) title.textContent = 'Kullanıcı paket satın almadı';
        if (text) text.textContent = 'Bu kullanıcı henüz eğitim paketi satın almamış. Paketler sekmesinden paket tanımlayabilirsiniz.';
        return;
    }
    if (icon) icon.className = 'fa-regular fa-user text-3xl text-yaziyo-gold mb-3';
    if (title) title.textContent = 'Bir kullanıcı seçin';
    if (text) text.textContent = 'Soldan bir kullanıcı seçtikten sonra bu bölümü yönetebilirsiniz.';
}

function updateNeedUserState() {
    const noUser = needsSelectedUser();
    const noPaket = needsPurchasedPaket();
    const blocked = noUser || noPaket;
    if (blocked) setNeedUserOverlay(noPaket ? 'paket' : 'user');
    els.needUser?.classList.toggle('hidden', !blocked);
    document.querySelectorAll('.admin-panel').forEach((p) => p.classList.add('hidden'));
    if (!blocked) {
        document.getElementById(`tab-${activeTab}`)?.classList.remove('hidden');
    }
}

function setSelectedUserHasPaket(value) {
    selectedUserHasPaket = value;
    updateNeedUserState();
}

function switchTab(id) {
    activeTab = id;
    document.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('admin-tab-active'));
    document.querySelector(`[data-admin-tab="${id}"]`)?.classList.add('admin-tab-active');
    updateNeedUserState();
}

async function ensureLiveChatPanel() {
    if (!liveChatPanel) {
        liveChatPanel = createAdminLiveChatPanel({
            showToast,
            onUserSelect(userId) {
                if (selectedUserId === userId) return;
                syncingUserFromChat = true;
                applyUserSelection(userId);
                syncBelgeAlici();
                syncingUserFromChat = false;
            },
        });
    }
    if (!liveChatReady) {
        const result = await liveChatPanel.start();
        liveChatReady = !!result?.ok;
    }
    return liveChatReady;
}

async function openLiveChatForSelectedUser() {
    const ready = await ensureLiveChatPanel();
    if (!ready || !liveChatPanel) return;
    if (!selectedUserId) {
        await liveChatPanel.loadConversations();
        return;
    }
    const u = selectedUser();
    await liveChatPanel.openForUser(selectedUserId, {
        user_name: userDisplayName(u),
        email: u?.email || '',
        full_name: u?.full_name || '',
    });
}

let userListOpen = false;
let userHighlightIndex = -1;

function userSearchHaystack(u) {
    return `${userDisplayName(u)} ${u.email || ''}`.toLocaleLowerCase('tr-TR');
}

function filteredUsers(query) {
    const q = String(query || '').trim().toLocaleLowerCase('tr-TR');
    if (!q) return users;
    return users.filter((u) => userSearchHaystack(u).includes(q));
}

function syncUserSearchDisplay() {
    if (!els.userSearch) return;
    const u = selectedUser();
    els.userSearch.value = u ? userDisplayName(u) : '';
    els.userSearch.placeholder = users.length ? 'İsim veya e-posta ara...' : 'Henüz hiç kullanıcı yok';
    els.userSearch.disabled = !users.length;
}

function closeUserList() {
    userListOpen = false;
    userHighlightIndex = -1;
    els.userList?.setAttribute('hidden', '');
    els.userSearch?.setAttribute('aria-expanded', 'false');
}

function renderUserList(query) {
    if (!els.userList) return;
    const list = filteredUsers(query);
    if (!list.length) {
        els.userList.innerHTML = '<li class="aeg-user-empty">Eşleşen kullanıcı yok.</li>';
        userHighlightIndex = -1;
        return;
    }
    els.userList.innerHTML = list.map((u, i) => {
        const name = userDisplayName(u);
        const mail = u.email && u.email !== name ? u.email : '';
        const selected = u.id === selectedUserId ? ' is-selected' : '';
        const active = i === userHighlightIndex ? ' is-active' : '';
        return `
            <li>
                <button type="button" class="aeg-user-option${selected}${active}" role="option"
                    data-user-id="${u.id}" aria-selected="${u.id === selectedUserId ? 'true' : 'false'}">
                    <span class="aeg-user-option-name">${escapeHtml(name)}</span>
                    ${mail ? `<span class="aeg-user-option-mail">${escapeHtml(mail)}</span>` : ''}
                </button>
            </li>`;
    }).join('');
}

function openUserList() {
    if (!users.length) return;
    userListOpen = true;
    els.userList?.removeAttribute('hidden');
    els.userSearch?.setAttribute('aria-expanded', 'true');
    renderUserList(els.userSearch?.value || '');
}

function applyUserSelection(userId, { load = false } = {}) {
    selectedUserId = userId || '';
    syncUserSearchDisplay();
    closeUserList();
    if (load) onUserChange();
}

function pickUserFromList(delta) {
    const list = filteredUsers(els.userSearch?.value || '');
    if (!list.length) return;
    if (userHighlightIndex < 0) userHighlightIndex = delta > 0 ? 0 : list.length - 1;
    else userHighlightIndex = (userHighlightIndex + delta + list.length) % list.length;
    renderUserList(els.userSearch?.value || '');
    els.userList?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
}

function confirmHighlightedUser() {
    const list = filteredUsers(els.userSearch?.value || '');
    const u = list[userHighlightIndex] || list[0];
    if (u) applyUserSelection(u.id, { load: true });
}

/* ---------- Kullanıcı listesi ---------- */

async function loadUsers() {
    const { data, error } = await fetchKullaniciListesi();
    if (error) {
        showToast(error.message || 'Kullanıcılar yüklenemedi', 'error');
        return;
    }
    users = data || [];
    selectedUserId = '';
    syncUserSearchDisplay();
    closeUserList();
}

/* ---------- Paketler ---------- */

function paketDurumLabel(p) {
    if (p.durum === 'iptal_edildi') return { text: 'İptal edildi', cls: 'bg-red-500/15 text-red-600' };
    if (p.suresiDoldu) return { text: 'Süresi doldu', cls: 'bg-slate-500/15 text-slate-600 dark:text-slate-300' };
    return { text: 'Aktif', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' };
}

async function loadPaketOptions() {
    if (!els.paketEkleSelect) return;
    const { data, error } = await fetchAllPaketlerAdmin();
    if (error) {
        els.paketEkleSelect.innerHTML = '<option value="">Paketler yüklenemedi</option>';
        els.paketEkleSelect.disabled = true;
        return;
    }
    paketOptions = data || [];
    if (!paketOptions.length) {
        els.paketEkleSelect.innerHTML = '<option value="">Tanımlı paket yok</option>';
        els.paketEkleSelect.disabled = true;
        return;
    }
    els.paketEkleSelect.disabled = false;
    els.paketEkleSelect.innerHTML = paketOptions.map((p) =>
        `<option value="${p.id}">${escapeHtml(p.title)}${p.active ? '' : ' (yayında değil)'} · ${p.validityDays} gün</option>`
    ).join('');
    syncPaketGunPlaceholder();
}

function syncPaketGunPlaceholder() {
    if (!els.paketEkleGun || !els.paketEkleSelect) return;
    const paket = paketOptions.find((p) => p.id === els.paketEkleSelect.value);
    els.paketEkleGun.placeholder = paket ? `Varsayılan: ${paket.validityDays} gün` : 'Paketin varsayılanı';
}

async function loadPaketler() {
    if (!selectedUserId) {
        setSelectedUserHasPaket(false);
        if (els.paketList) {
            els.paketList.innerHTML = '<p class="px-5 py-8 text-center text-sm text-light-text-secondary">Kullanıcı seçin.</p>';
        }
        return;
    }
    const { data, error } = await fetchKullaniciPaketleri(selectedUserId);
    if (error) {
        setSelectedUserHasPaket(false);
        els.paketList.innerHTML = `<p class="px-5 py-8 text-center text-sm text-red-500">${escapeHtml(error.message)}</p>`;
        return;
    }
    setSelectedUserHasPaket((data || []).length > 0);
    if (!data.length) {
        els.paketList.innerHTML = '<p class="px-5 py-8 text-center text-sm text-light-text-secondary">Bu kullanıcının paketi yok.</p>';
        return;
    }
    els.paketList._cache = data;
    els.paketList.innerHTML = data.map((p) => {
        const durum = paketDurumLabel(p);
        const kalan = p.durum === 'aktif' && !p.suresiDoldu && p.kalanGun != null
            ? `${p.kalanGun} gün kaldı`
            : '';
        const canCancel = p.durum === 'aktif';
        return `
            <div class="px-5 py-4 flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2 mb-1">
                        <p class="font-poppins font-bold text-sm">${escapeHtml(p.paketAdi)}</p>
                        <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${durum.cls}">${durum.text}</span>
                    </div>
                    <p class="text-xs text-light-text-secondary">
                        Başlangıç: ${formatDateTime(p.baslangic)} · Bitiş: ${formatDateTime(p.bitis)}
                        ${kalan ? ` · ${escapeHtml(kalan)}` : ''}
                        ${p.iptalEdildiAt ? ` · İptal: ${formatDateTime(p.iptalEdildiAt)}` : ''}
                    </p>
                    <p class="text-xs text-light-text-secondary mt-0.5">
                        ${Number(p.fiyat || 0).toLocaleString('tr-TR')} ₺ · ${p.gecerlilikGun || '—'} gün
                    </p>
                </div>
                ${canCancel ? `
                    <button type="button"
                        class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/40 text-red-600 text-xs font-bold hover:bg-red-500/10"
                        data-cancel-paket="${p.id}">
                        <i class="fa-solid fa-ban"></i> İptal et
                    </button>` : ''}
            </div>`;
    }).join('');
}

/* ---------- Profil ---------- */

function fillRozetSelect() {
    els.fieldRozet.innerHTML = '<option value="">Rozet yok</option>'
        + Object.values(BASARI_ROZETLERI).map((r) =>
            `<option value="${r.id}">${escapeHtml(r.label)}</option>`
        ).join('');
}

async function loadProfil() {
    if (!selectedUserId) return;
    const { data, error } = await fetchEgitimlerimProfil(selectedUserId);
    if (error && isEgitimlerimMissingError(error)) {
        showToast('sql/025_egitimlerim.sql dosyasını çalıştırın', 'error');
        return;
    }
    els.fieldKoc.value = data?.koc_adi || '';
    els.fieldRozet.value = data?.basari_rozeti || '';
    els.fieldHedefHiz.value = data?.hedef_hiz_net ?? 40;
    els.fieldHedef3dk.value = data?.hedef_3dk_net ?? 90;
    els.fieldGorusme.value = toLocalInputValue(data?.sonraki_gorusme);
    prefillBelgeKoc(data?.koc_adi);
}

/* ---------- Profil istatistikleri + son çalışmalar ---------- */

function statCard(icon, label, value) {
    return `
        <div class="aeg-stat">
            <div class="aeg-stat-label"><i class="fa-solid ${icon}"></i> ${escapeHtml(label)}</div>
            <div class="aeg-stat-value">${escapeHtml(value)}</div>
        </div>`;
}

async function loadKullaniciIstatistik() {
    if (!els.statGrid) return;
    if (!selectedUserId) {
        els.statGrid.innerHTML = '<p class="text-sm text-light-text-secondary">Kullanıcı seçin.</p>';
        if (els.harfAnalizi) els.harfAnalizi.innerHTML = '';
        return;
    }

    els.statGrid.innerHTML = '<p class="text-sm text-light-text-secondary">Yükleniyor...</p>';
    const { data, error } = await fetchAdminKullaniciOzeti(selectedUserId);
    if (error) {
        els.statGrid.innerHTML = `<p class="text-sm text-red-500">${escapeHtml(error.message)}</p>`;
        return;
    }

    const siralama = Number(data?.genel_siralama) || 0;
    els.statGrid.innerHTML = [
        statCard('fa-stopwatch', '3 Dk Rekor', `${formatStatNumber(data?.en_yuksek_3dk_kelime)} kelime`),
        statCard('fa-keyboard', 'Toplam Kelime', formatStatNumber(data?.toplam_kelime)),
        statCard('fa-ranking-star', 'Genel Sıralama', siralama > 0 ? `#${formatStatNumber(siralama)}` : '—'),
        statCard('fa-hourglass-half', 'Çalışma Süresi', formatStudyDuration(data?.calisma_sure_saniye)),
        statCard('fa-bolt', 'En Yüksek Kombo', formatStatNumber(data?.en_yuksek_kombo))
    ].join('');
}

function renderHarfAnaliziAdmin() {
    if (!els.harfAnalizi) return;
    const klavye = calismalar.filter((c) => c.tur === 'klavye').slice(0, HARF_ANALIZI_SEANS);
    const items = analyzeLetterMistakesFromSessions(klavye.map((c) => c.raw), 12);
    if (!items.length) {
        els.harfAnalizi.innerHTML = '<p class="text-sm text-light-text-secondary italic">Son çalışmalarda önerilecek harf hatası bulunamadı.</p>';
        return;
    }
    els.harfAnalizi.innerHTML = items.map((item) =>
        `<span class="aeg-harf-chip"><b>${escapeHtml(item.letter)}</b> ${item.count} hata</span>`
    ).join('');
}

const CALISMA_TURLERI = {
    klavye: { label: 'Klavye Çalışması', icon: 'fa-keyboard' },
    hiz: { label: 'Hız Testi', icon: 'fa-gauge-high' },
    kelime_evi: { label: 'Kelime Evi', icon: 'fa-house' },
    sinav: { label: 'Klavye Sınavı', icon: 'fa-file-pen' }
};

function collectCalismalar(payload) {
    const push = (rows, tur) => (rows || [])
        .filter((row) => row && typeof row === 'object')
        .map((row) => ({
            tur,
            tarih: row.created_at || null,
            raw: row
        }));

    return [
        ...push(payload?.klavye, 'klavye'),
        ...push(payload?.hiz_testi, 'hiz'),
        ...push(payload?.kelime_evi, 'kelime_evi'),
        ...push(payload?.sinav, 'sinav')
    ].sort((a, b) => new Date(b.tarih || 0) - new Date(a.tarih || 0));
}

function calismaBasligi(item) {
    const r = item.raw || {};
    const tur = CALISMA_TURLERI[item.tur]?.label || 'Çalışma';
    const detay = r.metin_adi || r.kategori || r.sinav_adi || '';
    return detay ? `${tur} · ${detay}` : tur;
}

async function loadCalismalar() {
    if (!els.calismaList) return;
    if (!selectedUserId) {
        calismalar = [];
        els.calismaList.innerHTML = '<p class="px-5 py-8 text-center text-sm text-light-text-secondary">Kullanıcı seçin.</p>';
        return;
    }

    els.calismaList.innerHTML = '<p class="px-5 py-8 text-center text-sm text-light-text-secondary">Yükleniyor...</p>';
    const { data, error } = await fetchAdminKullaniciCalismalari(selectedUserId, CALISMA_FETCH_GUN);
    if (error) {
        calismalar = [];
        els.calismaList.innerHTML = `<p class="px-5 py-8 text-center text-sm text-red-500">${escapeHtml(error.message)}</p>`;
        return;
    }

    calismalar = collectCalismalar(data);
    renderHarfAnaliziAdmin();

    const sinir = Date.now() - CALISMA_GUN * 24 * 60 * 60 * 1000;
    const son = calismalar.filter((c) => c.tarih && new Date(c.tarih).getTime() >= sinir);

    if (!son.length) {
        els.calismaList.innerHTML = `<p class="px-5 py-8 text-center text-sm text-light-text-secondary">Son ${CALISMA_GUN} günde çalışma yok.</p>`;
        return;
    }

    els.calismaList.innerHTML = son.map((item) => {
        const idx = calismalar.indexOf(item);
        const meta = CALISMA_TURLERI[item.tur] || {};
        return `
            <div class="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                <div class="min-w-0">
                    <p class="font-poppins font-bold text-sm">
                        <i class="fa-solid ${meta.icon || 'fa-circle'} text-yaziyo-gold mr-1"></i>
                        ${escapeHtml(calismaBasligi(item))}
                    </p>
                    <p class="text-xs text-light-text-secondary mt-0.5">${formatDateTime(item.tarih)}</p>
                </div>
                <button type="button" class="px-3 py-2 rounded-lg border border-yaziyo-gold text-yaziyo-gold text-xs font-bold" data-sonuc-index="${idx}">
                    <i class="fa-solid fa-chart-simple mr-1"></i> Sonuç ekranı
                </button>
            </div>`;
    }).join('');
}

/* ---------- Çalışma sonuç ekranı ---------- */

function metricRow(label, value) {
    return `
        <div class="aeg-stat">
            <div class="aeg-stat-label">${escapeHtml(label)}</div>
            <div class="aeg-stat-value">${escapeHtml(value)}</div>
        </div>`;
}

function beklenenKelime(m) {
    if (!m || typeof m !== 'object') return '';
    return String(m.expected ?? m.original ?? '').trim();
}

/** Kayıtta hazır alan yoksa doğru/yanlış ve süreden hesaplanır */
function calismaMetrikleri(item) {
    const r = item.raw || {};
    const dogru = Number(r.dogru_kelime);
    const yanlis = Number(r.yanlis_kelime);
    const sure = Number(r.sure_saniye);
    const metrics = [];

    const net = Number(r.net_kelime);
    if (Number.isFinite(net)) metrics.push(['Net kelime', formatStatNumber(net)]);
    else if (Number.isFinite(dogru)) metrics.push(['Net kelime', formatStatNumber(Math.max(0, dogru - (yanlis || 0)))]);

    if (Number.isFinite(dogru)) metrics.push(['Doğru kelime', formatStatNumber(dogru)]);
    if (Number.isFinite(yanlis)) metrics.push(['Yanlış kelime', formatStatNumber(yanlis)]);

    const wpm = Number(r.wpm);
    if (Number.isFinite(wpm) && wpm > 0) metrics.push(['WPM', String(Math.round(wpm))]);
    else if (Number.isFinite(dogru) && Number.isFinite(sure) && sure > 0) {
        metrics.push(['WPM', String(Math.round((dogru / sure) * 60))]);
    }

    const dogruluk = Number(r.dogruluk);
    if (Number.isFinite(dogruluk) && dogruluk > 0) metrics.push(['Doğruluk', `${Math.round(dogruluk)}%`]);
    else if (Number.isFinite(dogru) && Number.isFinite(yanlis) && dogru + yanlis > 0) {
        metrics.push(['Doğruluk', `${Math.round((dogru / (dogru + yanlis)) * 100)}%`]);
    }

    if (Number.isFinite(sure) && sure > 0) metrics.push(['Süre', formatPracticeDuration(sure)]);
    if (Number.isFinite(Number(r.kelime_sayisi))) metrics.push(['Kelime sayısı', formatStatNumber(r.kelime_sayisi)]);
    if (r.gecerli_3dk) metrics.push(['3 dk net', formatStatNumber(r.net_kelime_3dk)]);
    if (Number.isFinite(Number(r.max_kombo))) metrics.push(['En yüksek kombo', formatStatNumber(r.max_kombo)]);
    if (Number.isFinite(Number(r.ev_seviyesi))) metrics.push(['Ev seviyesi', formatStatNumber(r.ev_seviyesi)]);
    if (Number.isFinite(Number(r.kat_sayisi))) metrics.push(['Kat sayısı', formatStatNumber(r.kat_sayisi)]);

    return metrics;
}

function openSonucModal(index) {
    const item = calismalar[index];
    if (!item || !els.sonucModal) return;
    const r = item.raw || {};

    els.sonucBaslik.textContent = calismaBasligi(item);
    const parcalar = [formatDateTime(item.tarih)];
    if (r.kategori) parcalar.push(r.kategori);
    if (r.grup) parcalar.push(r.grup);
    els.sonucAlt.textContent = parcalar.filter(Boolean).join(' · ');

    const metrics = calismaMetrikleri(item);
    let html = metrics.length
        ? `<div class="aeg-stat-grid">${metrics.map(([l, v]) => metricRow(l, v)).join('')}</div>`
        : '<p class="text-sm text-light-text-secondary">Bu kayıt için ölçüm bilgisi yok.</p>';

    const hatalar = Array.isArray(r.yanlis_kelimeler) ? r.yanlis_kelimeler : [];
    if (hatalar.length) {
        const chips = hatalar.slice(0, 60).map((m) => {
            const beklenen = beklenenKelime(m);
            const yazilan = m && m.user != null ? String(m.user).trim() : '';
            return `<span class="aeg-harf-chip"><b>${escapeHtml(beklenen || '—')}</b> → ${escapeHtml(yazilan || '—')}</span>`;
        }).join('');
        html += `
            <div class="mt-5">
                <h4 class="text-xs font-bold uppercase tracking-wider text-light-text-secondary mb-2">
                    Hatalı kelimeler (${hatalar.length})
                </h4>
                <div class="flex flex-wrap gap-2">${chips}</div>
            </div>`;
    }

    els.sonucGovde.innerHTML = html;
    els.sonucModal.classList.add('open');
    els.sonucModal.setAttribute('aria-hidden', 'false');
}

function closeSonucModal() {
    els.sonucModal?.classList.remove('open');
    els.sonucModal?.setAttribute('aria-hidden', 'true');
}

/* ---------- Notlar ---------- */

async function loadNotlar() {
    if (!selectedUserId) {
        els.notList.innerHTML = '<p class="px-5 py-8 text-center text-sm text-light-text-secondary">Kullanıcı seçin.</p>';
        return;
    }
    const { data, error } = await fetchNotlarAdmin(selectedUserId);
    if (error) {
        els.notList.innerHTML = `<p class="px-5 py-8 text-center text-sm text-red-500">${escapeHtml(error.message)}</p>`;
        return;
    }
    if (!data.length) {
        els.notList.innerHTML = '<p class="px-5 py-8 text-center text-sm text-light-text-secondary">Not yok.</p>';
        return;
    }
    els.notList.innerHTML = data.map((n) => {
        const emojiBtns = Object.values(NOT_EMOJILERI).map((e) =>
            `<button type="button" class="emoji-btn ${n.admin_emoji === e.id ? 'active' : ''}" data-not-emoji="${n.id}" data-emoji-id="${e.id}" title="${escapeHtml(e.label)}">${e.emoji}</button>`
        ).join('');
        return `
            <div class="px-5 py-4">
                <div class="flex justify-between gap-2 mb-2">
                    <span class="text-xs font-bold text-yaziyo-gold">${escapeHtml(n.not_tarihi)}</span>
                    <div class="flex items-center gap-2">
                        <span class="text-xl">${n.admin_emoji ? (NOT_EMOJILERI[n.admin_emoji]?.emoji || '') : ''}</span>
                        <button type="button" class="w-8 h-8 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10" data-del-not="${n.id}" title="Notu sil"><i class="fa-solid fa-trash text-xs"></i></button>
                    </div>
                </div>
                <p class="text-sm mb-3 whitespace-pre-wrap">${escapeHtml(n.icerik || '—')}</p>
                <div class="flex flex-wrap gap-2">${emojiBtns}
                    <button type="button" class="emoji-btn text-xs font-bold" data-not-emoji="${n.id}" data-emoji-id="" title="Kaldır">✕</button>
                </div>
            </div>`;
    }).join('');
}

/* ---------- Görevler ---------- */

async function loadGorevler() {
    if (!selectedUserId) {
        els.gorevList.innerHTML = '<p class="text-sm text-light-text-secondary">Kullanıcı seçin.</p>';
        return;
    }
    const { data, error } = await fetchGorevler(selectedUserId);
    if (error) {
        els.gorevList.innerHTML = `<p class="text-sm text-red-500">${escapeHtml(error.message)}</p>`;
        return;
    }
    if (!data.length) {
        els.gorevList.innerHTML = '<p class="text-sm text-light-text-secondary">Görev yok.</p>';
        return;
    }
    els.gorevList.innerHTML = data.map((g) => `
        <div class="py-3 border-b border-light-border dark:border-dark-border last:border-0 flex flex-wrap justify-between gap-3">
            <div>
                <p class="font-poppins font-bold text-sm">${escapeHtml(g.baslik)}
                    <span class="text-[10px] ml-2 uppercase ${g.oncelik === 'zorunlu' ? 'text-red-500' : 'text-yaziyo-gold'}">${g.oncelik}</span>
                </p>
                <p class="text-xs text-light-text-secondary mt-1">${escapeHtml(g.aciklama || '')}</p>
                <p class="text-[11px] mt-1">${g.tahmini_sure_dk} dk · <span class="aeg-gorev-durum">${escapeHtml(GOREV_DURUMLARI[g.durum]?.label || g.durum)}</span></p>
            </div>
            <div class="flex gap-2">
                <button type="button" class="w-8 h-8 rounded-lg border border-light-border hover:border-yaziyo-gold" data-edit-gorev="${g.id}" title="Düzenle"><i class="fa-solid fa-pen text-xs"></i></button>
                <button type="button" class="w-8 h-8 rounded-lg border border-red-500/30 text-red-500" data-del-gorev="${g.id}" title="Sil"><i class="fa-solid fa-trash text-xs"></i></button>
            </div>
        </div>`).join('');

    els.gorevList._cache = data;
}

function resetGorevForm() {
    els.gorevEditId.value = '';
    els.gorevBaslik.value = '';
    els.gorevAciklama.value = '';
    els.gorevSure.value = '15';
    els.gorevOncelik.value = 'onerilen';
}

/* ---------- Takvim ---------- */

async function loadTakvim() {
    const { data, error } = await fetchTakvimAdmin();
    if (error) {
        els.takvimList.innerHTML = `<p class="text-sm text-red-500">${escapeHtml(error.message)}</p>`;
        return;
    }
    const filtered = selectedUserId
        ? data.filter((e) => e.kullanici_id === selectedUserId)
        : data;
    if (!filtered.length) {
        els.takvimList.innerHTML = '<p class="text-sm text-light-text-secondary">Takvim kaydı yok.</p>';
        return;
    }
    const nameOf = (id) => {
        const u = users.find((x) => x.id === id);
        return u ? userDisplayName(u) : id.slice(0, 8);
    };
    els.takvimList.innerHTML = filtered.map((e) => `
        <div class="py-3 border-b border-light-border dark:border-dark-border last:border-0 flex flex-wrap justify-between gap-3">
            <div>
                <p class="font-poppins font-bold text-sm">${escapeHtml(e.baslik)}
                    <span class="text-[10px] text-yaziyo-gold ml-2">${e.tur === 'online_ders' ? 'Online ders' : 'Görüşme'}</span>
                </p>
                <p class="text-xs text-light-text-secondary">${escapeHtml(nameOf(e.kullanici_id))} · ${formatDateTime(e.baslangic)} – ${formatDateTime(e.bitis)}</p>
                <p class="text-[11px] mt-1 font-bold">${TAKVIM_DURUMLARI[e.durum]?.label || e.durum}</p>
            </div>
            <div class="flex gap-2">
                <button type="button" class="w-8 h-8 rounded-lg border border-light-border" data-edit-takvim="${e.id}" title="Düzenle"><i class="fa-solid fa-pen text-xs"></i></button>
                <button type="button" class="w-8 h-8 rounded-lg border border-red-500/30 text-red-500" data-del-takvim="${e.id}" title="Sil"><i class="fa-solid fa-trash text-xs"></i></button>
            </div>
        </div>`).join('');
    els.takvimList._cache = filtered;
}

function resetTakvimForm() {
    els.takvimEditId.value = '';
    els.takvimBaslik.value = 'Görüşme';
    els.takvimTur.value = 'gorusme';
    els.takvimBaslangic.value = '';
    els.takvimBitis.value = '';
    els.takvimDurum.value = 'planlandi';
}

/* ---------- Etüt ---------- */

async function loadEtut() {
    const { data, error } = await fetchEtutler(undefined, true);
    if (error) {
        els.etutList.innerHTML = `<p class="text-sm text-red-500">${escapeHtml(error.message)}</p>`;
        return;
    }
    if (!data.length) {
        els.etutList.innerHTML = '<p class="text-sm text-light-text-secondary">Etüt yok.</p>';
        return;
    }
    els.etutList.innerHTML = data.map((e) => `
        <div class="py-3 border-b border-light-border dark:border-dark-border last:border-0 flex flex-wrap justify-between gap-3">
            <div>
                <p class="font-poppins font-bold text-sm">${escapeHtml(e.baslik)} ${e.aktif ? '' : '<span class="text-red-500 text-[10px]">pasif</span>'}</p>
                <p class="text-xs text-light-text-secondary">${formatDateTime(e.baslangic)} – ${formatDateTime(e.bitis)}</p>
                <a href="${escapeHtml(e.meet_url)}" target="_blank" rel="noopener" class="text-xs text-yaziyo-gold hover:underline break-all">${escapeHtml(e.meet_url)}</a>
            </div>
            <div class="flex gap-2">
                <button type="button" class="w-8 h-8 rounded-lg border border-light-border" data-edit-etut="${e.id}"><i class="fa-solid fa-pen text-xs"></i></button>
                <button type="button" class="w-8 h-8 rounded-lg border border-red-500/30 text-red-500" data-del-etut="${e.id}"><i class="fa-solid fa-trash text-xs"></i></button>
            </div>
        </div>`).join('');
    els.etutList._cache = data;
}

function resetEtutForm() {
    els.etutEditId.value = '';
    els.etutBaslik.value = 'Etüt Odası';
    els.etutBaslangic.value = '';
    els.etutBitis.value = '';
    els.etutMeet.value = '';
}

/* ---------- Belgeler / PDF ---------- */

function todayInputValue() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function belgeFormVerisi() {
    return {
        aliciAdi: (els.belgeAlici?.value || '').trim(),
        egitimAdi: (els.belgeEgitim?.value || '').trim(),
        kocAdi: (els.belgeKoc?.value || '').trim(),
        baslangic: els.belgeBaslangic?.value || '',
        bitis: els.belgeBitis?.value || '',
        belgeTarihi: els.belgeTarih?.value || todayInputValue()
    };
}

/** Belge bilgisi değişince hazır PDF geçersizleşir */
function invalidatePendingPdf() {
    pendingPdfBase64 = null;
    pendingPdfFileName = '';
    if (els.btnBelgeGonder) els.btnBelgeGonder.disabled = true;
    if (els.belgePdfStatus) els.belgePdfStatus.textContent = '';
}

function updateBelgeOnizleme() {
    if (!els.belgeCumle) return;
    const tur = els.belgeTur?.value || 'katilim';
    const bilgi = belgeFormVerisi();
    const cumle = buildBelgeCumlesi(tur, bilgi);
    const kim = formatBelgeAdi(bilgi.aliciAdi);
    const at = cumle.indexOf(kim);
    if (at >= 0) {
        els.belgeCumle.innerHTML =
            `${escapeHtml(cumle.slice(0, at))}<span class="text-yaziyo-gold font-poppins font-bold">${escapeHtml(kim)}</span>${escapeHtml(cumle.slice(at + kim.length))}`;
    } else {
        els.belgeCumle.textContent = cumle;
    }
    if (els.belgeSureOzet) {
        const bas = bilgi.baslangic;
        const bit = bilgi.bitis;
        if (bas && bit) {
            const a = new Date(`${bas}T00:00:00`);
            const b = new Date(`${bit}T00:00:00`);
            const gun = Math.round((b - a) / 86400000) + 1;
            els.belgeSureOzet.textContent = Number.isFinite(gun) && gun > 0
                ? `Eğitim süresi: ${gun} gün`
                : 'Eğitim süresi: tarihleri kontrol edin';
        } else {
            els.belgeSureOzet.textContent = 'Eğitim süresi, başlangıç ve bitiş tarihlerinden hesaplanır.';
        }
    }
}

function resetBelgeForm() {
    if (els.belgeAlici) els.belgeAlici.value = '';
    if (els.belgeEgitim) els.belgeEgitim.value = '';
    if (els.belgeBaslangic) els.belgeBaslangic.value = '';
    if (els.belgeBitis) els.belgeBitis.value = '';
    if (els.belgeTarih) els.belgeTarih.value = todayInputValue();
    invalidatePendingPdf();
    syncBelgeAlici();
}

/** Seçilen kullanıcının adı belgeye aday adı olarak yazılır; admin düzeltebilir */
function syncBelgeAlici() {
    if (!els.belgeAlici) return;
    const u = selectedUser();
    els.belgeAlici.value = u ? userDisplayName(u) : '';
    updateBelgeOnizleme();
}

/** Koç adı seçili kullanıcının profilinden ön doldurulur */
function prefillBelgeKoc(kocAdi) {
    if (els.belgeKoc) {
        els.belgeKoc.value = kocAdi || '';
        updateBelgeOnizleme();
    }
}

function pdfBlobUrl(dosyaBase64) {
    const base64 = String(dosyaBase64 || '');
    const payload = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
}

function closeBelgeModal() {
    els.belgeModal?.classList.remove('open');
    els.belgeModal?.setAttribute('aria-hidden', 'true');
    if (els.belgeFrame) els.belgeFrame.removeAttribute('src');
    if (belgeBlobUrl) {
        URL.revokeObjectURL(belgeBlobUrl);
        belgeBlobUrl = null;
    }
}

async function openBelgeModal(belgeId) {
    const { data, error } = await fetchBelgeDownload(belgeId);
    if (error || !data?.dosya_base64) {
        showToast(error?.message || 'Belge açılamadı', 'error');
        return;
    }
    if (belgeBlobUrl) URL.revokeObjectURL(belgeBlobUrl);
    try {
        belgeBlobUrl = pdfBlobUrl(data.dosya_base64);
    } catch {
        showToast('Belge içeriği okunamadı', 'error');
        return;
    }
    els.belgeBaslik.textContent = data.baslik || 'Belge';
    els.belgeAlt.textContent = data.dosya_adi || '';
    if (els.belgeYeniSekme) els.belgeYeniSekme.href = belgeBlobUrl;
    if (els.belgeFrame) els.belgeFrame.src = belgeBlobUrl;
    els.belgeModal?.classList.add('open');
    els.belgeModal?.setAttribute('aria-hidden', 'false');
}

async function loadBelgeler() {
    if (!selectedUserId) {
        els.belgeList.innerHTML = '<p class="text-sm text-light-text-secondary">Kullanıcı seçin.</p>';
        return;
    }
    const { data, error } = await fetchBelgeler(selectedUserId);
    if (error) {
        els.belgeList.innerHTML = `<p class="text-sm text-red-500">${escapeHtml(error.message)}</p>`;
        return;
    }
    if (!data.length) {
        els.belgeList.innerHTML = '<p class="text-sm text-light-text-secondary">Gönderilmiş belge yok.</p>';
        return;
    }
    els.belgeList.innerHTML = data.map((b) => {
        const detay = [
            BELGE_TURLERI[b.belge_turu]?.label || b.belge_turu,
            b.alici_adi,
            b.egitim_adi,
            b.koc_adi,
            formatDateTime(b.created_at)
        ].filter(Boolean).map((x) => escapeHtml(x)).join(' · ');
        return `
        <div class="py-3 border-b border-light-border dark:border-dark-border last:border-0 flex flex-wrap justify-between gap-3">
            <div class="min-w-0">
                <p class="font-poppins font-bold text-sm">${escapeHtml(b.baslik)}</p>
                <p class="text-xs text-light-text-secondary">${detay}</p>
            </div>
            <div class="flex gap-2">
                <button type="button" class="px-3 py-2 rounded-lg border border-yaziyo-gold text-yaziyo-gold text-xs font-bold" data-view-belge="${b.id}">
                    <i class="fa-solid fa-eye mr-1"></i> Görüntüle
                </button>
                <button type="button" class="w-8 h-8 rounded-lg border border-red-500/30 text-red-500" data-del-belge="${b.id}" title="Sil"><i class="fa-solid fa-trash text-xs"></i></button>
            </div>
        </div>`;
    }).join('');
}

async function onUserChange() {
    if (syncingUserFromChat) return;
    resetBelgeForm();
    resetGorevForm();
    resetTakvimForm();
    if (!selectedUserId) {
        setSelectedUserHasPaket(false);
        if (els.paketList) {
            els.paketList.innerHTML = '<p class="px-5 py-8 text-center text-sm text-light-text-secondary">Kullanıcı seçin.</p>';
        }
        calismalar = [];
        await Promise.all([loadKullaniciIstatistik(), loadCalismalar()]);
        return;
    }
    selectedUserHasPaket = null;
    updateNeedUserState();
    await Promise.all([
        loadProfil(),
        loadKullaniciIstatistik(),
        loadCalismalar(),
        loadPaketler(),
        loadNotlar(),
        loadGorevler(),
        loadTakvim(),
        loadBelgeler()
    ]);
    if (activeTab === 'etut') await loadEtut();
    if (activeTab === 'livechat') {
        await openLiveChatForSelectedUser();
    }
}

function cacheElements() {
    els.toast = document.getElementById('admin-toast');
    els.needUser = document.getElementById('aeg-need-user');
    els.needUserIcon = document.getElementById('aeg-need-user-icon');
    els.needUserTitle = document.getElementById('aeg-need-user-title');
    els.needUserText = document.getElementById('aeg-need-user-text');
    els.userSearch = document.getElementById('admin-user-search');
    els.userList = document.getElementById('admin-user-list');
    els.userCombo = document.getElementById('admin-user-combo');
    els.fieldKoc = document.getElementById('field-koc');
    els.fieldRozet = document.getElementById('field-rozet');
    els.fieldHedefHiz = document.getElementById('field-hedef-hiz');
    els.fieldHedef3dk = document.getElementById('field-hedef-3dk');
    els.fieldGorusme = document.getElementById('field-gorusme');
    els.profilForm = document.getElementById('profil-form');
    els.notList = document.getElementById('admin-not-list');
    els.gorevForm = document.getElementById('gorev-form');
    els.gorevEditId = document.getElementById('gorev-edit-id');
    els.gorevBaslik = document.getElementById('gorev-baslik');
    els.gorevAciklama = document.getElementById('gorev-aciklama');
    els.gorevSure = document.getElementById('gorev-sure');
    els.gorevOncelik = document.getElementById('gorev-oncelik');
    els.gorevList = document.getElementById('admin-gorev-list');
    els.takvimForm = document.getElementById('takvim-form');
    els.takvimEditId = document.getElementById('takvim-edit-id');
    els.takvimBaslik = document.getElementById('takvim-baslik');
    els.takvimTur = document.getElementById('takvim-tur');
    els.takvimBaslangic = document.getElementById('takvim-baslangic');
    els.takvimBitis = document.getElementById('takvim-bitis');
    els.takvimDurum = document.getElementById('takvim-durum');
    els.takvimList = document.getElementById('admin-takvim-list');
    els.etutForm = document.getElementById('etut-form');
    els.etutEditId = document.getElementById('etut-edit-id');
    els.etutBaslik = document.getElementById('etut-baslik');
    els.etutBaslangic = document.getElementById('etut-baslangic');
    els.etutBitis = document.getElementById('etut-bitis');
    els.etutMeet = document.getElementById('etut-meet');
    els.etutList = document.getElementById('admin-etut-list');
    els.belgeForm = document.getElementById('belge-form');
    els.belgeTur = document.getElementById('belge-tur');
    els.belgeAlici = document.getElementById('belge-alici');
    els.belgeEgitim = document.getElementById('belge-egitim');
    els.belgeKoc = document.getElementById('belge-koc');
    els.belgeBaslangic = document.getElementById('belge-baslangic');
    els.belgeBitis = document.getElementById('belge-bitis');
    els.belgeTarih = document.getElementById('belge-tarih');
    els.belgeCumle = document.getElementById('belge-cumle-onizleme');
    els.belgeSureOzet = document.getElementById('belge-sure-ozet');
    els.btnPdfOlustur = document.getElementById('btn-pdf-olustur');
    els.btnBelgeGonder = document.getElementById('btn-belge-gonder');
    els.belgePdfStatus = document.getElementById('belge-pdf-status');
    els.belgeList = document.getElementById('admin-belge-list');
    els.paketList = document.getElementById('admin-paket-list');
    els.paketEkleForm = document.getElementById('paket-ekle-form');
    els.paketEkleSelect = document.getElementById('paket-ekle-select');
    els.paketEkleGun = document.getElementById('paket-ekle-gun');
    els.btnPaketEkle = document.getElementById('btn-paket-ekle');
    els.statGrid = document.getElementById('aeg-stat-grid');
    els.harfAnalizi = document.getElementById('aeg-harf-analizi');
    els.btnStatYenile = document.getElementById('btn-stat-yenile');
    els.calismaList = document.getElementById('aeg-calisma-list');
    els.sonucModal = document.getElementById('aeg-sonuc-modal');
    els.sonucBaslik = document.getElementById('aeg-sonuc-baslik');
    els.sonucAlt = document.getElementById('aeg-sonuc-alt');
    els.sonucGovde = document.getElementById('aeg-sonuc-govde');
    els.sonucKapat = document.getElementById('aeg-sonuc-kapat');
    els.belgeModal = document.getElementById('aeg-belge-modal');
    els.belgeBaslik = document.getElementById('aeg-belge-baslik');
    els.belgeAlt = document.getElementById('aeg-belge-alt');
    els.belgeFrame = document.getElementById('aeg-belge-frame');
    els.belgeYeniSekme = document.getElementById('aeg-belge-yeni-sekme');
    els.belgeKapat = document.getElementById('aeg-belge-kapat');
}

function bindEvents() {
    document.querySelectorAll('[data-admin-tab]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.adminTab;
            switchTab(id);
            if (id === 'livechat') {
                await openLiveChatForSelectedUser();
                return;
            }
            if (!selectedUserId) return;
            if (id === 'takvim') await loadTakvim();
            if (id === 'etut') await loadEtut();
            if (id === 'belgeler') await loadBelgeler();
            if (id === 'notlar') await loadNotlar();
            if (id === 'gorevler') await loadGorevler();
            if (id === 'paketler') await loadPaketler();
            if (id === 'profil') {
                await Promise.all([loadProfil(), loadKullaniciIstatistik(), loadCalismalar()]);
            }
        });
    });

    els.userSearch?.addEventListener('focus', () => {
        els.userSearch.select();
        userHighlightIndex = Math.max(0, users.findIndex((u) => u.id === selectedUserId));
        userListOpen = true;
        els.userList?.removeAttribute('hidden');
        els.userSearch?.setAttribute('aria-expanded', 'true');
        renderUserList('');
    });
    els.userSearch?.addEventListener('input', () => {
        userHighlightIndex = 0;
        openUserList();
        renderUserList(els.userSearch.value);
    });
    els.userSearch?.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!userListOpen) openUserList();
            pickUserFromList(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!userListOpen) openUserList();
            pickUserFromList(-1);
        } else if (e.key === 'Enter') {
            if (userListOpen) {
                e.preventDefault();
                confirmHighlightedUser();
            }
        } else if (e.key === 'Escape') {
            closeUserList();
            syncUserSearchDisplay();
        }
    });
    els.userSearch?.addEventListener('blur', () => {
        window.setTimeout(() => {
            closeUserList();
            syncUserSearchDisplay();
        }, 150);
    });
    els.userList?.addEventListener('mousedown', (e) => {
        const btn = e.target.closest('[data-user-id]');
        if (!btn) return;
        e.preventDefault();
        applyUserSelection(btn.dataset.userId, { load: true });
    });

    els.btnStatYenile?.addEventListener('click', async () => {
        if (!requireUser()) return;
        const icon = els.btnStatYenile.querySelector('i');
        icon?.classList.add('fa-spin');
        await Promise.all([loadKullaniciIstatistik(), loadCalismalar()]);
        setTimeout(() => icon?.classList.remove('fa-spin'), 500);
    });

    els.calismaList?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-sonuc-index]');
        if (!btn) return;
        openSonucModal(Number(btn.dataset.sonucIndex));
    });

    els.sonucKapat?.addEventListener('click', closeSonucModal);
    els.sonucModal?.addEventListener('click', (e) => {
        if (e.target === els.sonucModal) closeSonucModal();
    });

    els.belgeKapat?.addEventListener('click', closeBelgeModal);
    els.belgeModal?.addEventListener('click', (e) => {
        if (e.target === els.belgeModal) closeBelgeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        closeSonucModal();
        closeBelgeModal();
    });

    els.paketEkleSelect?.addEventListener('change', syncPaketGunPlaceholder);

    els.paketEkleForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!requireUser()) return;
        const paketId = els.paketEkleSelect?.value;
        if (!paketId) {
            showToast('Paket seçin', 'error');
            return;
        }
        const gunRaw = parseInt(els.paketEkleGun?.value, 10);
        const gun = Number.isFinite(gunRaw) && gunRaw > 0 ? gunRaw : null;
        const paketAdi = paketOptions.find((p) => p.id === paketId)?.title || 'Paket';
        if (!confirm(`“${paketAdi}” bu kullanıcıya tanımlanacak. Onaylıyor musunuz?`)) return;

        els.btnPaketEkle.disabled = true;
        const { error } = await adminPaketTanimla(selectedUserId, paketId, gun);
        els.btnPaketEkle.disabled = false;
        if (error) {
            showToast(error.message || 'Paket tanımlanamadı', 'error');
            return;
        }
        if (els.paketEkleGun) els.paketEkleGun.value = '';
        await loadPaketler();
        showToast('Paket kullanıcıya tanımlandı');
    });

    els.paketList?.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-cancel-paket]');
        if (!btn) return;
        if (!requireUser()) return;
        const paket = (els.paketList._cache || []).find((x) => x.id === btn.dataset.cancelPaket);
        const ad = paket?.paketAdi || 'paketi';
        if (!confirm(`“${ad}” iptal edilsin mi?\n\nKullanıcı bu pakete erişimi kaybeder.`)) return;
        btn.disabled = true;
        const { error } = await cancelKullaniciPaketi(btn.dataset.cancelPaket);
        if (error) {
            showToast(error.message || 'İptal başarısız', 'error');
            btn.disabled = false;
            return;
        }
        await loadPaketler();
        showToast('Paket iptal edildi');
    });

    els.profilForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!requireUser()) return;
        const { error } = await upsertEgitimlerimProfil({
            kullanici_id: selectedUserId,
            koc_adi: els.fieldKoc.value,
            basari_rozeti: els.fieldRozet.value || null,
            hedef_hiz_net: els.fieldHedefHiz.value,
            hedef_3dk_net: els.fieldHedef3dk.value,
            sonraki_gorusme: fromLocalInputValue(els.fieldGorusme.value)
        });
        if (error) {
            showToast(error.message || 'Kayıt başarısız', 'error');
            return;
        }
        showToast('Profil kaydedildi');
    });

    els.notList?.addEventListener('click', async (e) => {
        const del = e.target.closest('[data-del-not]');
        if (del) {
            if (!confirm('Bu günlük not silinsin mi?')) return;
            const { error } = await deleteNot(del.dataset.delNot);
            if (error) {
                showToast(error.message || 'Not silinemedi', 'error');
                return;
            }
            await loadNotlar();
            showToast('Not silindi');
            return;
        }

        const btn = e.target.closest('[data-not-emoji]');
        if (!btn) return;
        const { error } = await setNotEmoji(btn.dataset.notEmoji, btn.dataset.emojiId || null);
        if (error) {
            showToast(error.message || 'Emoji kaydedilemedi', 'error');
            return;
        }
        await loadNotlar();
        showToast('Emoji güncellendi');
    });

    els.gorevForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!requireUser()) return;
        const { error } = await upsertGorev({
            id: els.gorevEditId.value || undefined,
            kullanici_id: selectedUserId,
            baslik: els.gorevBaslik.value,
            aciklama: els.gorevAciklama.value,
            tahmini_sure_dk: els.gorevSure.value,
            oncelik: els.gorevOncelik.value
        });
        if (error) {
            showToast(error.message || 'Görev kaydedilemedi', 'error');
            return;
        }
        resetGorevForm();
        await loadGorevler();
        showToast('Görev kaydedildi');
    });

    els.gorevList?.addEventListener('click', async (e) => {
        const edit = e.target.closest('[data-edit-gorev]');
        const del = e.target.closest('[data-del-gorev]');
        if (edit) {
            const g = (els.gorevList._cache || []).find((x) => x.id === edit.dataset.editGorev);
            if (!g) return;
            els.gorevEditId.value = g.id;
            els.gorevBaslik.value = g.baslik;
            els.gorevAciklama.value = g.aciklama || '';
            els.gorevSure.value = g.tahmini_sure_dk || 15;
            els.gorevOncelik.value = g.oncelik || 'onerilen';
            return;
        }
        if (del) {
            if (!confirm('Görev silinsin mi?')) return;
            const { error } = await deleteGorev(del.dataset.delGorev);
            if (error) showToast(error.message, 'error');
            else {
                await loadGorevler();
                showToast('Görev silindi');
            }
        }
    });

    els.takvimForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!requireUser()) return;
        const { error } = await upsertTakvimEvent({
            id: els.takvimEditId.value || undefined,
            kullanici_id: selectedUserId,
            baslik: els.takvimBaslik.value,
            tur: els.takvimTur.value,
            baslangic: fromLocalInputValue(els.takvimBaslangic.value),
            bitis: fromLocalInputValue(els.takvimBitis.value),
            durum: els.takvimDurum.value
        });
        if (error) {
            showToast(error.message || 'Takvim kaydı başarısız', 'error');
            return;
        }
        resetTakvimForm();
        await loadTakvim();
        showToast('Takvim güncellendi');
    });

    els.takvimList?.addEventListener('click', async (e) => {
        const edit = e.target.closest('[data-edit-takvim]');
        const del = e.target.closest('[data-del-takvim]');
        if (edit) {
            const ev = (els.takvimList._cache || []).find((x) => x.id === edit.dataset.editTakvim);
            if (!ev) return;
            els.takvimEditId.value = ev.id;
            els.takvimBaslik.value = ev.baslik || '';
            els.takvimTur.value = ev.tur || 'gorusme';
            els.takvimBaslangic.value = toLocalInputValue(ev.baslangic);
            els.takvimBitis.value = toLocalInputValue(ev.bitis);
            els.takvimDurum.value = ev.durum || 'planlandi';
            if (ev.kullanici_id) {
                applyUserSelection(ev.kullanici_id);
            }
            return;
        }
        if (del) {
            if (!confirm('Etkinlik silinsin mi?')) return;
            const { error } = await deleteTakvimEvent(del.dataset.delTakvim);
            if (error) showToast(error.message, 'error');
            else {
                await loadTakvim();
                showToast('Etkinlik silindi');
            }
        }
    });

    els.etutForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { error } = await upsertEtut({
            id: els.etutEditId.value || undefined,
            baslik: els.etutBaslik.value,
            baslangic: fromLocalInputValue(els.etutBaslangic.value),
            bitis: fromLocalInputValue(els.etutBitis.value),
            meet_url: els.etutMeet.value,
            aktif: true
        });
        if (error) {
            showToast(error.message || 'Etüt kaydedilemedi', 'error');
            return;
        }
        resetEtutForm();
        await loadEtut();
        showToast('Etüt kaydedildi');
    });

    els.etutList?.addEventListener('click', async (e) => {
        const edit = e.target.closest('[data-edit-etut]');
        const del = e.target.closest('[data-del-etut]');
        if (edit) {
            const ev = (els.etutList._cache || []).find((x) => x.id === edit.dataset.editEtut);
            if (!ev) return;
            els.etutEditId.value = ev.id;
            els.etutBaslik.value = ev.baslik || '';
            els.etutBaslangic.value = toLocalInputValue(ev.baslangic);
            els.etutBitis.value = toLocalInputValue(ev.bitis);
            els.etutMeet.value = ev.meet_url || '';
            return;
        }
        if (del) {
            if (!confirm('Etüt silinsin mi?')) return;
            const { error } = await deleteEtut(del.dataset.delEtut);
            if (error) showToast(error.message, 'error');
            else {
                await loadEtut();
                showToast('Etüt silindi');
            }
        }
    });

    els.btnPdfOlustur?.addEventListener('click', async () => {
        if (!requireUser()) return;
        const bilgi = belgeFormVerisi();
        if (!bilgi.aliciAdi) {
            showToast('Aday adını yazın', 'error');
            els.belgeAlici?.focus();
            return;
        }
        const btn = els.btnPdfOlustur;
        btn.disabled = true;
        if (els.belgePdfStatus) els.belgePdfStatus.textContent = 'PDF hazırlanıyor...';
        try {
            const tur = els.belgeTur.value;
            pendingPdfBase64 = await createCertificatePdf(tur, bilgi);
            pendingPdfFileName = `${tur}_${bilgi.aliciAdi.replace(/\s+/g, '_')}.pdf`;
            els.btnBelgeGonder.disabled = false;
            els.belgePdfStatus.textContent = `PDF hazır: ${pendingPdfFileName}`;
            showToast('PDF oluşturuldu');
        } catch (err) {
            invalidatePendingPdf();
            showToast(err.message || 'PDF oluşturulamadı', 'error');
        } finally {
            btn.disabled = false;
        }
    });

    els.belgeForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!requireUser() || !pendingPdfBase64) {
            showToast('Önce PDF oluşturun', 'error');
            return;
        }
        const bilgi = belgeFormVerisi();
        if (!bilgi.aliciAdi) {
            showToast('Aday adını yazın', 'error');
            els.belgeAlici?.focus();
            return;
        }
        const tur = els.belgeTur.value;
        const baslik = BELGE_TURLERI[tur]?.label || 'Belge';
        const { error } = await gonderBelge({
            kullanici_id: selectedUserId,
            belge_turu: tur,
            baslik,
            dosya_adi: pendingPdfFileName,
            dosya_base64: pendingPdfBase64,
            alici_adi: bilgi.aliciAdi,
            egitim_adi: bilgi.egitimAdi,
            koc_adi: bilgi.kocAdi,
            baslangic_tarihi: bilgi.baslangic || null,
            bitis_tarihi: bilgi.bitis || null,
            belge_tarihi: bilgi.belgeTarihi || null
        });
        if (error) {
            showToast(error.message || 'Gönderilemedi', 'error');
            return;
        }

        const hedefId = selectedUserId;
        resetBelgeForm();
        await loadBelgeler();
        showToast('Belge kullanıcıya gönderildi');

        const { error: bildirimError } = await bildirimGonder({
            kullanici_id: hedefId,
            baslik: 'Yeni belgeniz var',
            mesaj: `${baslik}${bilgi.egitimAdi ? ` (${bilgi.egitimAdi})` : ''} hesabınıza eklendi. Eğitimlerim > Belgeler bölümünden görüntüleyebilirsiniz.`
        });
        if (bildirimError) {
            showToast('Belge gönderildi, bildirim iletilemedi', 'error');
        }
    });

    els.belgeList?.addEventListener('click', async (e) => {
        const view = e.target.closest('[data-view-belge]');
        if (view) {
            await openBelgeModal(view.dataset.viewBelge);
            return;
        }
        const del = e.target.closest('[data-del-belge]');
        if (!del) return;
        if (!confirm('Belge silinsin mi?')) return;
        const { error } = await deleteBelge(del.dataset.delBelge);
        if (error) showToast(error.message, 'error');
        else {
            await loadBelgeler();
            showToast('Belge silindi');
        }
    });

    [
        els.belgeTur,
        els.belgeAlici,
        els.belgeEgitim,
        els.belgeKoc,
        els.belgeBaslangic,
        els.belgeBitis,
        els.belgeTarih
    ].forEach((el) => {
        el?.addEventListener('input', () => {
            invalidatePendingPdf();
            updateBelgeOnizleme();
        });
        el?.addEventListener('change', () => {
            invalidatePendingPdf();
            updateBelgeOnizleme();
        });
    });
}

async function init() {
    if (!(await requireAdminAccess())) return;
    await initSupabaseClient();
    cacheElements();
    fillRozetSelect();
    bindEvents();
    resetBelgeForm();
    await Promise.all([loadUsers(), loadPaketOptions()]);

    // Eğitimlerim yönetimindeyken admin çevrimiçi görünsün (sekme açılmasa da)
    await ensureLiveChatPanel();

    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === 'livechat') {
        switchTab('livechat');
        await openLiveChatForSelectedUser();
    } else {
        switchTab(activeTab);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
