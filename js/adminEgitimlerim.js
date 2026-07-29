/**
 * YAZİYO — Admin Eğitimlerim yönetimi
 * Sekmeler: profil, notlar, görevler, takvim, etüt, belgeler
 */
import { requireAdminAccess } from './lib/adminAuth.js';
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
    gonderBelge,
    deleteBelge
} from './lib/egitimlerimApi.js';

let users = [];
let selectedUserId = '';
let pendingPdfBase64 = null;
let pendingPdfFileName = '';

const els = {};

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

function switchTab(id) {
    document.querySelectorAll('.admin-panel').forEach((p) => p.classList.add('hidden'));
    document.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('admin-tab-active'));
    document.getElementById(`tab-${id}`)?.classList.remove('hidden');
    document.querySelector(`[data-admin-tab="${id}"]`)?.classList.add('admin-tab-active');
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

    if (!els.userSelect) return;

    if (!users.length) {
        els.userSelect.disabled = true;
        els.userSelect.innerHTML = '<option value="">Henüz hiç kullanıcı yok</option>';
        return;
    }

    els.userSelect.disabled = false;
    els.userSelect.innerHTML = '<option value="">— Kullanıcı seçin —</option>'
        + users.map((u) =>
            `<option value="${u.id}">${escapeHtml(userDisplayName(u))}</option>`
        ).join('');
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
                    <span class="text-xl">${n.admin_emoji ? (NOT_EMOJILERI[n.admin_emoji]?.emoji || '') : ''}</span>
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
                <p class="text-[11px] mt-1">${g.tahmini_sure_dk} dk · ${GOREV_DURUMLARI[g.durum]?.label || g.durum}</p>
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

function syncBelgeAlici() {
    if (els.belgeAlici) els.belgeAlici.value = '';
    pendingPdfBase64 = null;
    pendingPdfFileName = '';
    if (els.btnBelgeGonder) els.btnBelgeGonder.disabled = true;
    if (els.belgePdfStatus) els.belgePdfStatus.textContent = '';
}

function createCertificatePdf(tur, aliciAdi) {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) throw new Error('jsPDF yüklenemedi');

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const title = BELGE_TURLERI[tur]?.label || 'Belge';

    doc.setDrawColor(234, 179, 8);
    doc.setLineWidth(1.5);
    doc.rect(12, 12, 273, 186);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);
    doc.text('YAZIYO AKADEMI', 148.5, 40, { align: 'center' });

    doc.setFontSize(16);
    doc.setTextColor(234, 179, 8);
    doc.text(title.toLocaleUpperCase('tr-TR'), 148.5, 58, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(71, 85, 105);
    doc.text('Bu belge asagida adi yazili katilimciya verilmistir:', 148.5, 85, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(15, 23, 42);
    doc.text(aliciAdi || 'Katilimci', 148.5, 105, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    const today = new Date().toLocaleDateString('tr-TR');
    doc.text(`Tarih: ${today}`, 148.5, 130, { align: 'center' });
    doc.text('YAZIYO Akademi — Zabıt Katipligi Calisma Platformu', 148.5, 160, { align: 'center' });

    return doc.output('datauristring');
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
    els.belgeList.innerHTML = data.map((b) => `
        <div class="py-3 border-b border-light-border dark:border-dark-border last:border-0 flex flex-wrap justify-between gap-3">
            <div>
                <p class="font-poppins font-bold text-sm">${escapeHtml(b.baslik)}</p>
                <p class="text-xs text-light-text-secondary">${BELGE_TURLERI[b.belge_turu]?.label || b.belge_turu} · ${escapeHtml(b.alici_adi)} · ${formatDateTime(b.created_at)}</p>
            </div>
            <button type="button" class="w-8 h-8 rounded-lg border border-red-500/30 text-red-500" data-del-belge="${b.id}"><i class="fa-solid fa-trash text-xs"></i></button>
        </div>`).join('');
}

async function onUserChange() {
    selectedUserId = els.userSelect.value;
    syncBelgeAlici();
    resetGorevForm();
    resetTakvimForm();
    if (!selectedUserId) return;
    await Promise.all([
        loadProfil(),
        loadNotlar(),
        loadGorevler(),
        loadTakvim(),
        loadBelgeler()
    ]);
}

function cacheElements() {
    els.toast = document.getElementById('admin-toast');
    els.userSelect = document.getElementById('admin-user-select');
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
    els.btnPdfOlustur = document.getElementById('btn-pdf-olustur');
    els.btnBelgeGonder = document.getElementById('btn-belge-gonder');
    els.belgePdfStatus = document.getElementById('belge-pdf-status');
    els.belgeList = document.getElementById('admin-belge-list');
}

function bindEvents() {
    document.querySelectorAll('[data-admin-tab]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.adminTab;
            switchTab(id);
            if (id === 'takvim') await loadTakvim();
            if (id === 'etut') await loadEtut();
            if (id === 'belgeler') await loadBelgeler();
            if (id === 'notlar') await loadNotlar();
            if (id === 'gorevler') await loadGorevler();
        });
    });

    els.userSelect?.addEventListener('change', onUserChange);

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
                els.userSelect.value = ev.kullanici_id;
                selectedUserId = ev.kullanici_id;
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

    els.btnPdfOlustur?.addEventListener('click', () => {
        if (!requireUser()) return;
        const alici = (els.belgeAlici.value || '').trim();
        if (!alici) {
            showToast('Alıcı adını yazın', 'error');
            els.belgeAlici?.focus();
            return;
        }
        try {
            const tur = els.belgeTur.value;
            pendingPdfBase64 = createCertificatePdf(tur, alici);
            pendingPdfFileName = `${tur}_${alici.replace(/\s+/g, '_')}.pdf`;
            els.btnBelgeGonder.disabled = false;
            els.belgePdfStatus.textContent = `PDF hazır: ${pendingPdfFileName}`;
            showToast('PDF oluşturuldu');
        } catch (err) {
            showToast(err.message || 'PDF oluşturulamadı', 'error');
        }
    });

    els.belgeForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!requireUser() || !pendingPdfBase64) {
            showToast('Önce PDF oluşturun', 'error');
            return;
        }
        const alici = (els.belgeAlici.value || '').trim();
        if (!alici) {
            showToast('Alıcı adını yazın', 'error');
            els.belgeAlici?.focus();
            return;
        }
        const tur = els.belgeTur.value;
        const { error } = await gonderBelge({
            kullanici_id: selectedUserId,
            belge_turu: tur,
            baslik: BELGE_TURLERI[tur]?.label || 'Belge',
            dosya_adi: pendingPdfFileName,
            dosya_base64: pendingPdfBase64,
            alici_adi: alici
        });
        if (error) {
            showToast(error.message || 'Gönderilemedi', 'error');
            return;
        }
        pendingPdfBase64 = null;
        els.btnBelgeGonder.disabled = true;
        els.belgePdfStatus.textContent = '';
        els.belgeAlici.value = '';
        await loadBelgeler();
        showToast('Belge kullanıcıya gönderildi');
    });

    els.belgeList?.addEventListener('click', async (e) => {
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

    els.belgeTur?.addEventListener('change', () => {
        pendingPdfBase64 = null;
        els.btnBelgeGonder.disabled = true;
        els.belgePdfStatus.textContent = '';
    });

    els.belgeAlici?.addEventListener('input', () => {
        pendingPdfBase64 = null;
        els.btnBelgeGonder.disabled = true;
        els.belgePdfStatus.textContent = '';
    });
}

async function init() {
    if (!(await requireAdminAccess())) return;
    cacheElements();
    fillRozetSelect();
    bindEvents();
    await loadUsers();
    await loadEtut();
    await loadTakvim();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
