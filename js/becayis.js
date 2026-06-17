/**
 * YAZİYO — Becayiş sayfası
 */
import {
    fetchBecayisStats,
    searchBecayisIlanlari,
    createBecayisIlani,
    sendBecayisTalebi,
    fetchGelenTalepler,
    respondBecayisTalebi,
    isBecayisTableMissingError,
} from './lib/becayisApi.js';
import { ensureSession } from './authVerification.js';
import { supabase } from './lib/supabase.js';
import {
    TURKIYE_ILLER,
    BECAYIS_UNVANLAR,
    BECAYIS_SEBEP_MAX,
    unvanLabel,
} from './lib/becayisLocations.js';
import {
    loadAdaletKurumlari,
    KURUM_KATEGORILERI,
    filterKurumlarByKategori,
    getKategorilerForIl,
    findKurumByKey,
    formatKurumLabel,
    kurumKey,
} from './lib/adaletKurumlari.js';

const state = {
    ilanlar: [],
    allIlanlar: [],
    talepler: [],
    stats: { toplam: 0, aktif_talepler: 0, bu_ay: 0 },
    activeTab: 'ara',
    selectedIlanId: null,
    pendingAcceptTalepId: null,
    filtersApplied: false,
    kurumlar: [],
};

const els = {};

const LEGAL_DISMISS_KEY = 'yaziyo_becayis_legal_dismissed';

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}

function truncateSebep(text, max = 120) {
    const t = (text || '').trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max)}…`;
}

function fillIlSelect(select, placeholder = 'İl seçin') {
    if (!select) return;
    select.innerHTML = `<option value="">${placeholder}</option>`;
    TURKIYE_ILLER.forEach((il) => {
        select.innerHTML += `<option value="${escapeHtml(il)}">${escapeHtml(il)}</option>`;
    });
}

function fillUnvanSelect(select, placeholder = 'Unvan seçin') {
    if (!select) return;
    select.innerHTML = `<option value="">${placeholder}</option>`;
    BECAYIS_UNVANLAR.forEach((u) => {
        select.innerHTML += `<option value="${u.value}">${escapeHtml(u.label)}</option>`;
    });
}

function fillKategoriSelect(select, il, placeholder = 'Kurum seçin') {
    if (!select) return;
    select.innerHTML = `<option value="">${placeholder}</option>`;
    const options = il
        ? getKategorilerForIl(state.kurumlar, il)
        : KURUM_KATEGORILERI;
    options.forEach((o) => {
        select.innerHTML += `<option value="${o.value}">${escapeHtml(o.label)}</option>`;
    });
}

function fillKurumSelect(select, { il, kategori }, placeholder = 'Kurum adı seçin') {
    if (!select) return;
    select.innerHTML = `<option value="">${placeholder}</option>`;
    const isFilter = select.id === 'bc-filter-kurum';
    if (!isFilter && (!il || !kategori)) return;

    let matched;
    if (isFilter) {
        if (!il) return;
        matched = kategori
            ? filterKurumlarByKategori(state.kurumlar, { il, kategori })
            : state.kurumlar.filter((k) => k.il === il && k.aktif !== false);
    } else {
        matched = filterKurumlarByKategori(state.kurumlar, { il, kategori });
    }

    matched.forEach((k) => {
        const key = kurumKey(k);
        select.innerHTML += `<option value="${escapeHtml(key)}">${escapeHtml(formatKurumLabel(k))}</option>`;
    });
}

function readKurumBlockValues(block) {
    return {
        il: block.il?.value || '',
        kategori: block.kategori?.value || '',
        kurum: block.kurum?.value || '',
    };
}

function refreshKurumBlock(block, { resetKategori = false } = {}) {
    const vals = readKurumBlockValues(block);
    const isFilter = block.blockId === 'filter';
    const kategoriPlaceholder = isFilter ? 'Tüm kurumlar' : 'Kurum seçin';
    const kurumPlaceholder = isFilter ? 'Tüm kurum adları' : 'Kurum adı seçin';

    if (resetKategori) fillKategoriSelect(block.kategori, vals.il, kategoriPlaceholder);

    if (block.kategori) {
        block.kategori.disabled = !vals.il && !isFilter;
    }
    if (block.kurum) {
        block.kurum.disabled = !isFilter && (!vals.il || !vals.kategori);
        if (isFilter) block.kurum.disabled = !vals.il;
    }

    fillKurumSelect(block.kurum, vals, kurumPlaceholder);
}

function bindKurumBlock(block) {
    block.il?.addEventListener('change', () => {
        if (block.kategori) block.kategori.value = '';
        if (block.kurum) block.kurum.value = '';
        refreshKurumBlock(block, { resetKategori: true });
    });
    block.kategori?.addEventListener('change', () => {
        if (block.kurum) block.kurum.value = '';
        refreshKurumBlock(block);
    });
}

function kurumBlockFromPrefix(prefix, blockId) {
    return {
        blockId,
        il: document.getElementById(`bc-${prefix}-il`),
        kategori: document.getElementById(`bc-${prefix}-kategori`),
        kurum: document.getElementById(`bc-${prefix}-kurum`),
    };
}

function getSelectedKurumLabel(kurumSelect) {
    const key = kurumSelect?.value;
    if (!key) return '';
    const kurum = findKurumByKey(state.kurumlar, key);
    return kurum ? formatKurumLabel(kurum) : '';
}

function setupCharCounter(textarea, counterEl) {
    if (!textarea || !counterEl) return;
    const update = () => {
        const len = textarea.value.length;
        const rem = BECAYIS_SEBEP_MAX - len;
        counterEl.textContent = `${len} / ${BECAYIS_SEBEP_MAX}`;
        counterEl.classList.toggle('warn', rem < 30);
    };
    textarea.addEventListener('input', update);
    update();
}

function showToast(message) {
    const toast = els.toast;
    if (!toast) return;
    toast.querySelector('[data-bc-toast-msg]').textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove('show'), 4000);
}

function openModal(modal) {
    modal?.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
    modal?.classList.remove('open');
    if (!document.querySelector('.bc-modal-backdrop.open')) {
        document.body.style.overflow = '';
    }
}

function isLegalModalDismissed() {
    try {
        return localStorage.getItem(LEGAL_DISMISS_KEY) === '1';
    } catch {
        return false;
    }
}

function saveLegalModalDismissPreference() {
    if (!els.legalDismissCheck?.checked) return;
    try {
        localStorage.setItem(LEGAL_DISMISS_KEY, '1');
    } catch {
        /* ignore */
    }
}

function closeLegalModal() {
    saveLegalModalDismissPreference();
    closeModal(els.legalModal);
}

function maybeOpenLegalModal() {
    if (!isLegalModalDismissed()) {
        openModal(els.legalModal);
    }
}

function switchTab(tabId) {
    state.activeTab = tabId;
    document.querySelectorAll('.bc-tab-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.bc-panel').forEach((panel) => {
        panel.classList.toggle('active', panel.id === `bc-panel-${tabId}`);
    });
    if (tabId === 'gelen') loadTalepler();
    if (tabId === 'ara' && !state.allIlanlar.length) loadAllIlanlar();
}

function hasActiveIlFilter() {
    return !!els.filterIl?.value;
}

function updateListHeading() {
    if (!els.ilanListHeading) return;
    const il = els.filterIl?.value;
    els.ilanListHeading.textContent = il ? `${il} — ilanlar` : 'Tüm ilanlar';
}

function updateEmptyMessage() {
    if (!els.ilanEmpty) return;
    const msg = els.ilanEmpty.querySelector('p');
    if (!msg) return;
    if (hasActiveIlFilter()) {
        msg.textContent = 'Seçtiğiniz ile uygun becayiş ilanı yok. Farklı bir il seçebilir veya kendi ilanınızı oluşturabilirsiniz.';
    } else if ((state.stats?.toplam ?? 0) > 0 && !state.allIlanlar.length) {
        msg.textContent = 'Sistemde ilan var ancak size ait olmayan aktif ilan bulunmuyor. Kendi ilanınız arama listesinde gösterilmez.';
    } else {
        msg.textContent = 'Henüz yayınlanmış becayiş ilanı bulunmuyor. İlk ilanı siz oluşturabilirsiniz.';
    }
}

function applyIlFilter() {
    const il = els.filterIl?.value || '';
    state.filtersApplied = !!il;
    if (!il) {
        state.ilanlar = [...state.allIlanlar];
    } else {
        state.ilanlar = state.allIlanlar.filter(
            (i) => i.mevcut_il === il || i.hedef_il === il,
        );
    }
    renderIlanlar();
}

async function loadStats() {
    try {
        state.stats = await fetchBecayisStats();
        if (els.statToplam) els.statToplam.textContent = state.stats.toplam ?? 0;
        if (els.statAktif) els.statAktif.textContent = state.stats.aktif_talepler ?? 0;
        if (els.statBuAy) els.statBuAy.textContent = state.stats.bu_ay ?? 0;
        els.setupBanner?.classList.add('hidden');
    } catch (err) {
        if (isBecayisTableMissingError(err)) {
            els.setupBanner?.classList.remove('hidden');
        }
    }
}

function renderIlanlar() {
    updateListHeading();
    updateEmptyMessage();
    if (!state.ilanlar.length) {
        els.ilanGrid.innerHTML = '';
        els.ilanEmpty?.classList.remove('hidden');
        return;
    }
    els.ilanEmpty?.classList.add('hidden');
    els.ilanGrid.innerHTML = state.ilanlar.map((ilan) => `
        <article class="bc-ilan-card" data-ilan-id="${ilan.id}">
            <p class="bc-ilan-label">Mevcut Kurum</p>
            <p class="bc-ilan-value">${escapeHtml(ilan.mevcut_adliye)} <span class="text-xs font-normal opacity-70">(${escapeHtml(ilan.mevcut_il)})</span></p>
            <p class="bc-ilan-label">Gitmek İstediği Kurum</p>
            <p class="bc-ilan-value">${escapeHtml(ilan.hedef_adliye)} <span class="text-xs font-normal opacity-70">(${escapeHtml(ilan.hedef_il)})</span></p>
            <p class="bc-ilan-label">Unvan</p>
            <p class="bc-ilan-value">${escapeHtml(unvanLabel(ilan.unvan))}</p>
            <p class="bc-ilan-label">Atama Yılı</p>
            <p class="bc-ilan-value">${escapeHtml(String(ilan.atama_yili))}</p>
            <p class="bc-ilan-label">Becayiş Sebebi</p>
            <p class="bc-ilan-sebep">${escapeHtml(truncateSebep(ilan.sebep, 264)) || '—'}</p>
            <button type="button" class="bc-action-btn" data-send-talep="${ilan.id}">
                <i class="fa-solid fa-paper-plane"></i> Talep Gönder
            </button>
        </article>
    `).join('');
}

async function waitForSession(maxAttempts = 10, delayMs = 350) {
    for (let i = 0; i < maxAttempts; i += 1) {
        const result = await ensureSession(supabase);
        if (result.ok) return true;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return false;
}

async function loadAllIlanlar() {
    try {
        const hasSession = await waitForSession();
        if (!hasSession) {
            showToast('Oturum doğrulanamadı. Lütfen sayfayı yenileyin veya tekrar giriş yapın.');
            return;
        }
        state.allIlanlar = await searchBecayisIlanlari({ il: null, unvan: null });
        applyIlFilter();
        els.setupBanner?.classList.add('hidden');
    } catch (err) {
        if (isBecayisTableMissingError(err)) {
            els.setupBanner?.classList.remove('hidden');
            return;
        }
        console.error('Becayiş ilanları yüklenemedi:', err);
        showToast(err.message || 'İlanlar yüklenemedi.');
    }
}

function openTalepModal(ilanId) {
    state.selectedIlanId = ilanId;
    const ilan = state.ilanlar.find((i) => i.id === ilanId);
    els.talepForm?.reset();
    if (ilan && els.talepBlock?.il) {
        els.talepBlock.il.value = ilan.hedef_il || '';
    }
    if (els.talepBlock) {
        refreshKurumBlock(els.talepBlock, { resetKategori: true });
    }
    if (els.talepSebepCounter) {
        els.talepSebepCounter.textContent = `0 / ${BECAYIS_SEBEP_MAX}`;
    }
    openModal(els.talepModal);
}

async function submitTalep(e) {
    e.preventDefault();
    const payload = {
        mevcutAdliye: getSelectedKurumLabel(els.talepBlock?.kurum),
        unvan: els.talepUnvan?.value,
        atamaYili: parseInt(els.talepAtamaYili?.value, 10),
        sebep: els.talepSebep?.value?.trim().slice(0, BECAYIS_SEBEP_MAX),
    };
    if (!payload.mevcutAdliye || !payload.unvan || !payload.atamaYili) {
        showToast('Lütfen tüm zorunlu alanları doldurun.');
        return;
    }
    els.talepSubmitBtn?.setAttribute('disabled', 'true');
    try {
        await sendBecayisTalebi(state.selectedIlanId, payload);
        closeModal(els.talepModal);
        showToast('Becayiş talebiniz başarıyla gönderildi.');
        await loadStats();
    } catch (err) {
        showToast(err.message || 'Talep gönderilemedi.');
    } finally {
        els.talepSubmitBtn?.removeAttribute('disabled');
    }
}

async function submitIlan(e) {
    e.preventDefault();
    const payload = {
        mevcutIl: els.createMevcutBlock?.il?.value?.trim(),
        mevcutAdliye: getSelectedKurumLabel(els.createMevcutBlock?.kurum),
        hedefIl: els.createHedefBlock?.il?.value?.trim(),
        hedefAdliye: getSelectedKurumLabel(els.createHedefBlock?.kurum),
        unvan: els.createUnvan?.value,
        atamaYili: parseInt(els.createAtamaYili?.value, 10),
        sebep: els.createSebep?.value?.trim().slice(0, BECAYIS_SEBEP_MAX),
    };
    if (!payload.mevcutIl || !payload.mevcutAdliye || !payload.hedefIl || !payload.hedefAdliye || !payload.unvan || !payload.atamaYili) {
        showToast('Lütfen tüm zorunlu alanları doldurun.');
        return;
    }
    if (payload.mevcutIl === payload.hedefIl) {
        openModal(els.sameIlModal);
        return;
    }
    els.createSubmitBtn?.setAttribute('disabled', 'true');
    try {
        await createBecayisIlani(payload);
        els.createForm?.reset();
        openModal(els.successModal);
        await loadStats();
        if (state.activeTab === 'ara') await loadAllIlanlar();
    } catch (err) {
        showToast(err.message || 'İlan oluşturulamadı.');
    } finally {
        els.createSubmitBtn?.removeAttribute('disabled');
    }
}

function renderTalepler() {
    const pending = state.talepler.filter((t) => t.durum === 'beklemede');
    if (!pending.length) {
        els.talepGrid.innerHTML = '';
        els.talepEmpty?.classList.remove('hidden');
        return;
    }
    els.talepEmpty?.classList.add('hidden');
    els.talepGrid.innerHTML = pending.map((t) => `
        <article class="bc-ilan-card" data-talep-id="${t.id}">
            <p class="bc-ilan-label">Talep Gönderen</p>
            <p class="bc-ilan-value">${escapeHtml(t.gonderen_adi)}</p>
            <p class="bc-ilan-label">Mevcut Kurum</p>
            <p class="bc-ilan-value">${escapeHtml(t.mevcut_adliye)}</p>
            <p class="bc-ilan-label">Unvan</p>
            <p class="bc-ilan-value">${escapeHtml(unvanLabel(t.unvan))}</p>
            <p class="bc-ilan-label">Atama Yılı</p>
            <p class="bc-ilan-value">${escapeHtml(String(t.atama_yili))}</p>
            <p class="bc-ilan-label">Becayiş Sebebi</p>
            <p class="bc-ilan-sebep">${escapeHtml(truncateSebep(t.sebep, 264)) || '—'}</p>
            <div class="bc-talep-actions">
                <button type="button" class="bc-action-btn success" data-accept="${t.id}">
                    <i class="fa-solid fa-check"></i> Talebi Kabul Et
                </button>
                <button type="button" class="bc-action-btn danger" data-reject="${t.id}">
                    <i class="fa-solid fa-xmark"></i> Talebi Reddet
                </button>
            </div>
        </article>
    `).join('');
}

async function loadTalepler() {
    try {
        state.talepler = await fetchGelenTalepler();
        renderTalepler();
    } catch (err) {
        if (isBecayisTableMissingError(err)) {
            els.setupBanner?.classList.remove('hidden');
        }
    }
}

function openEmailModal(talepId) {
    state.pendingAcceptTalepId = talepId;
    openModal(els.emailModal);
}

async function finalizeAccept(shareEmail) {
    const talepId = state.pendingAcceptTalepId;
    if (!talepId) return;
    closeModal(els.emailModal);
    try {
        await respondBecayisTalebi(talepId, 'kabul', shareEmail);
        showToast(shareEmail ? 'Talep kabul edildi ve e-posta paylaşıldı. İlan listeden kaldırıldı.' : 'Talep kabul edildi.');
        await loadTalepler();
        await loadStats();
        if (shareEmail) {
            await loadAllIlanlar();
        }
        if (window.YaziyoNotifications?.refreshNotificationsForModal && window.yaziyoSupabase) {
            window.YaziyoNotifications.refreshNotificationsForModal(window.yaziyoSupabase);
        }
    } catch (err) {
        showToast(err.message || 'İşlem tamamlanamadı.');
    }
    state.pendingAcceptTalepId = null;
}

async function rejectTalep(talepId) {
    try {
        await respondBecayisTalebi(talepId, 'red', false);
        showToast('Talep reddedildi.');
        await loadTalepler();
        await loadStats();
        if (window.YaziyoNotifications?.refreshNotificationsForModal && window.yaziyoSupabase) {
            window.YaziyoNotifications.refreshNotificationsForModal(window.yaziyoSupabase);
        }
    } catch (err) {
        showToast(err.message || 'Talep reddedilemedi.');
    }
}

function bindEvents() {
    document.querySelectorAll('.bc-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    els.filterIl?.addEventListener('change', applyIlFilter);
    els.btnReload?.addEventListener('click', () => {
        loadStats();
        loadAllIlanlar();
        loadTalepler();
    });

    els.ilanGrid?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-send-talep]');
        if (btn) openTalepModal(btn.getAttribute('data-send-talep'));
    });

    els.talepForm?.addEventListener('submit', submitTalep);
    els.createForm?.addEventListener('submit', submitIlan);

    els.talepGrid?.addEventListener('click', (e) => {
        const accept = e.target.closest('[data-accept]');
        const reject = e.target.closest('[data-reject]');
        if (accept) openEmailModal(accept.getAttribute('data-accept'));
        if (reject) rejectTalep(reject.getAttribute('data-reject'));
    });

    document.querySelectorAll('[data-bc-modal-close]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-bc-modal-close');
            if (id === 'bc-legal-modal') {
                closeLegalModal();
                return;
            }
            closeModal(document.getElementById(id));
        });
    });

    document.querySelectorAll('.bc-modal-backdrop').forEach((backdrop) => {
        backdrop.addEventListener('click', (e) => {
            if (e.target !== backdrop) return;
            if (backdrop.id === 'bc-legal-modal') {
                closeLegalModal();
                return;
            }
            closeModal(backdrop);
        });
    });

    els.emailShareBtn?.addEventListener('click', () => finalizeAccept(true));
    els.emailSkipBtn?.addEventListener('click', () => finalizeAccept(false));
    els.successCloseBtn?.addEventListener('click', () => closeModal(els.successModal));
    els.legalCloseBtn?.addEventListener('click', closeLegalModal);
    els.sameIlCloseBtn?.addEventListener('click', () => closeModal(els.sameIlModal));
}

function cacheElements() {
    els.statToplam = document.getElementById('bc-stat-toplam');
    els.statAktif = document.getElementById('bc-stat-aktif');
    els.statBuAy = document.getElementById('bc-stat-bu-ay');
    els.setupBanner = document.getElementById('bc-setup-banner');
    els.btnReload = document.getElementById('bc-btn-reload');
    els.filterIl = document.getElementById('bc-filter-il');
    els.ilanGrid = document.getElementById('bc-ilan-grid');
    els.ilanEmpty = document.getElementById('bc-ilan-empty');
    els.ilanListHeading = document.getElementById('bc-ilan-list-heading');
    els.talepGrid = document.getElementById('bc-talep-grid');
    els.talepEmpty = document.getElementById('bc-talep-empty');
    els.talepModal = document.getElementById('bc-talep-modal');
    els.talepForm = document.getElementById('bc-talep-form');
    els.talepBlock = kurumBlockFromPrefix('talep-mevcut', 'talep-mevcut');
    els.talepUnvan = document.getElementById('bc-talep-unvan');
    els.talepAtamaYili = document.getElementById('bc-talep-atama-yili');
    els.talepSebep = document.getElementById('bc-talep-sebep');
    els.talepSebepCounter = document.getElementById('bc-talep-sebep-count');
    els.talepSubmitBtn = document.getElementById('bc-talep-submit');
    els.createForm = document.getElementById('bc-create-form');
    els.createMevcutBlock = kurumBlockFromPrefix('create-mevcut', 'create-mevcut');
    els.createHedefBlock = kurumBlockFromPrefix('create-hedef', 'create-hedef');
    els.createUnvan = document.getElementById('bc-create-unvan');
    els.createAtamaYili = document.getElementById('bc-create-atama-yili');
    els.createSebep = document.getElementById('bc-create-sebep');
    els.createSebepCounter = document.getElementById('bc-create-sebep-count');
    els.createSubmitBtn = document.getElementById('bc-create-submit');
    els.successModal = document.getElementById('bc-success-modal');
    els.successCloseBtn = document.getElementById('bc-success-close');
    els.legalModal = document.getElementById('bc-legal-modal');
    els.legalCloseBtn = document.getElementById('bc-legal-close');
    els.legalDismissCheck = document.getElementById('bc-legal-dismiss');
    els.sameIlModal = document.getElementById('bc-same-il-modal');
    els.sameIlCloseBtn = document.getElementById('bc-same-il-close');
    els.emailModal = document.getElementById('bc-email-modal');
    els.emailShareBtn = document.getElementById('bc-email-share');
    els.emailSkipBtn = document.getElementById('bc-email-skip');
    els.toast = document.getElementById('bc-toast');
}

function initSelects() {
    fillIlSelect(els.filterIl, 'Tüm iller');
    fillIlSelect(els.createMevcutBlock?.il);
    fillIlSelect(els.createHedefBlock?.il);
    fillIlSelect(els.talepBlock?.il);
    fillUnvanSelect(els.talepUnvan);
    fillUnvanSelect(els.createUnvan);

    [els.createMevcutBlock, els.createHedefBlock, els.talepBlock].forEach((block) => {
        if (block) {
            bindKurumBlock(block);
            refreshKurumBlock(block, { resetKategori: true });
        }
    });

    setupCharCounter(els.talepSebep, els.talepSebepCounter);
    setupCharCounter(els.createSebep, els.createSebepCounter);
}

async function init() {
    const root = document.getElementById('becayis-content');
    if (!root || root.dataset.initialized) return;
    cacheElements();
    try {
        state.kurumlar = await loadAdaletKurumlari();
    } catch (err) {
        showToast(err.message || 'Kurum listesi yüklenemedi.');
        state.kurumlar = [];
    }
    initSelects();
    bindEvents();
    switchTab('ara');
    await loadStats();
    await loadAllIlanlar();
    maybeOpenLegalModal();
    root.dataset.initialized = '1';
}

function tryInit() {
    if (document.documentElement.classList.contains('is-logged-in')) {
        init();
    }
}

function bindAuthReload() {
    if (!supabase || bindAuthReload._bound) return;
    bindAuthReload._bound = true;
    supabase.auth.onAuthStateChange((event, session) => {
        const root = document.getElementById('becayis-content');
        if (!root?.dataset.initialized || !session?.user) return;
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
            loadStats();
            loadAllIlanlar();
        }
    });
}

function boot() {
    cacheElements();
    bindAuthReload();
    tryInit();
    const obs = new MutationObserver(tryInit);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
