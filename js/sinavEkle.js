/**
 * YAZİYO — Admin: Sınav Ekle (Supabase)
 * Haftalık & aylık klavye sınavlarını yönetir.
 */

import { supabase } from './lib/supabase.js';

const els = {};
let exams = [];
let editingId = null;
let deleteTarget = null;

/* ============================================ */
/* Yardımcılar                                  */
/* ============================================ */
function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = String(str ?? '');
    return d.innerHTML;
}

function isTableMissingError(error) {
    if (!error) return false;
    const msg = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
    return error.code === '42P01' || msg.includes('does not exist') || msg.includes('could not find the table');
}

function showToast(message, type = 'success') {
    const toast = els.toast;
    if (!toast) return;
    toast.textContent = message;
    toast.className = `fixed bottom-6 right-6 z-[300] px-5 py-3 rounded-xl font-inter text-sm font-semibold shadow-2xl transition-all duration-300 ${type === 'error' ? 'bg-red-500 text-white' : 'bg-yaziyo-gold text-slate-900'}`;
    toast.classList.remove('hidden', 'opacity-0');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3200);
}

function pad(n) { return String(n).padStart(2, '0'); }

/** ISO -> datetime-local input değeri (yerel saat) */
function toLocalInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local değeri -> ISO (timestamptz) */
function toISO(localValue) {
    if (!localValue) return null;
    const d = new Date(localValue);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
}

function formatDateTime(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function getStatus(sinav, now = new Date()) {
    const bas = new Date(sinav.baslangic);
    const bit = new Date(sinav.bitis);
    const son = new Date(sinav.sonuc);
    if (now < bas) return { key: 'yaklasiyor', label: 'Yaklaşıyor', cls: 'bg-blue-500/15 text-blue-500' };
    if (now <= bit) return { key: 'aktif', label: 'Aktif', cls: 'bg-green-500/15 text-green-500' };
    if (now < son) return { key: 'degerlendiriliyor', label: 'Değerlendiriliyor', cls: 'bg-orange-500/15 text-orange-500' };
    return { key: 'tamamlandi', label: 'Sonuçlandı', cls: 'bg-yaziyo-gold/15 text-yaziyo-gold' };
}

/* ============================================ */
/* Otomatik tarih                               */
/* ============================================ */
function localInputFromParts(year, month, day, hour, minute) {
    return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

function autoFillDates() {
    const tur = els.tur.value;
    const now = new Date();

    if (tur === 'haftalik') {
        // Bu haftanın pazartesisi
        const day = now.getDay(); // 0=pazar
        const diffToMonday = (day === 0 ? -6 : 1 - day);
        const monday = new Date(now);
        monday.setDate(now.getDate() + diffToMonday);
        const friday = new Date(monday); friday.setDate(monday.getDate() + 4);
        const saturday = new Date(monday); saturday.setDate(monday.getDate() + 5);

        els.baslangic.value = localInputFromParts(monday.getFullYear(), monday.getMonth(), monday.getDate(), 8, 0);
        els.bitis.value = localInputFromParts(friday.getFullYear(), friday.getMonth(), friday.getDate(), 23, 59);
        els.sonuc.value = localInputFromParts(saturday.getFullYear(), saturday.getMonth(), saturday.getDate(), 10, 0);
    } else {
        // Ayın 15'i — kısa online pencere, sonuç = bitiş
        const y = now.getFullYear();
        const m = now.getMonth();
        els.baslangic.value = localInputFromParts(y, m, 15, 20, 0);
        els.bitis.value = localInputFromParts(y, m, 15, 20, 30);
        els.sonuc.value = localInputFromParts(y, m, 15, 20, 30);
    }
    showToast('Tarihler türüne göre dolduruldu, gerekirse düzenleyin.');
}

/* ============================================ */
/* Liste                                        */
/* ============================================ */
async function loadExams() {
    const body = els.listBody;
    body.innerHTML = `<tr><td colspan="5" class="px-4 py-12 text-center text-light-text-secondary"><i class="fa-solid fa-circle-notch fa-spin text-yaziyo-gold text-xl"></i></td></tr>`;

    const { data, error } = await supabase
        .from('sinavlar')
        .select('id, tur, baslik, metin, sure_saniye, baslangic, bitis, sonuc, aktif')
        .order('baslangic', { ascending: false });

    if (error) {
        if (isTableMissingError(error)) {
            body.innerHTML = setupRequiredRow();
        } else {
            body.innerHTML = `<tr><td colspan="5" class="px-4 py-12 text-center text-red-500">Liste yüklenemedi: ${escapeHtml(error.message)}</td></tr>`;
        }
        return;
    }

    exams = Array.isArray(data) ? data : [];
    renderList();
}

function setupRequiredRow() {
    return `
        <tr><td colspan="5" class="px-4 py-12">
            <div class="max-w-xl mx-auto bg-orange-500/5 border border-orange-500/20 rounded-2xl p-8 text-center">
                <i class="fa-solid fa-database text-4xl text-orange-500 mb-4"></i>
                <h3 class="text-lg font-poppins font-bold mb-2 text-yaziyo-text">Veritabanı Kurulumu Gerekli</h3>
                <p class="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    Sınav tabloları henüz oluşturulmamış. Supabase SQL Editor'da
                    <code class="text-yaziyo-gold">supabase/migrations/012_klavye_sinavi.sql</code> dosyasını çalıştırın.
                </p>
            </div>
        </td></tr>`;
}

function renderList() {
    const body = els.listBody;
    if (!exams.length) {
        body.innerHTML = `<tr><td colspan="5" class="px-4 py-12 text-center text-light-text-secondary">Henüz sınav eklenmemiş.</td></tr>`;
        return;
    }

    body.innerHTML = exams.map((s) => {
        const st = getStatus(s);
        const turLabel = s.tur === 'haftalik' ? 'Haftalık' : 'Aylık';
        const turCls = s.tur === 'haftalik' ? 'bg-blue-500/15 text-blue-500' : 'bg-yaziyo-gold/15 text-yaziyo-gold';
        const aktifDot = s.aktif ? 'text-green-500' : 'text-slate-400';
        return `
            <tr class="hover:bg-light-bg/40 dark:hover:bg-dark-bg/30 transition-colors">
                <td class="px-4 py-3">
                    <div class="font-semibold text-yaziyo-text flex items-center gap-2">
                        <i class="fa-solid fa-circle text-[7px] ${aktifDot}" title="${s.aktif ? 'Yayında' : 'Pasif'}"></i>
                        ${escapeHtml(s.baslik)}
                    </div>
                    <div class="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">${s.sure_saniye} sn</div>
                </td>
                <td class="px-4 py-3 text-center">
                    <span class="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${turCls}">${turLabel}</span>
                </td>
                <td class="px-4 py-3 text-center">
                    <span class="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${st.cls}">${st.label}</span>
                </td>
                <td class="px-4 py-3 text-center hidden md:table-cell text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                    <div>Baş: ${formatDateTime(s.baslangic)}</div>
                    <div>Bit: ${formatDateTime(s.bitis)}</div>
                    <div>Son: ${formatDateTime(s.sonuc)}</div>
                </td>
                <td class="px-4 py-3 text-right whitespace-nowrap">
                    <button data-toggle="${s.id}" title="${s.aktif ? 'Pasifleştir' : 'Yayınla'}" class="w-8 h-8 rounded-lg border border-light-border dark:border-dark-border hover:border-yaziyo-gold hover:text-yaziyo-gold transition-all">
                        <i class="fa-solid ${s.aktif ? 'fa-eye' : 'fa-eye-slash'}"></i>
                    </button>
                    <button data-edit="${s.id}" title="Düzenle" class="w-8 h-8 rounded-lg border border-light-border dark:border-dark-border hover:border-yaziyo-gold hover:text-yaziyo-gold transition-all">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button data-delete="${s.id}" title="Sil" class="w-8 h-8 rounded-lg border border-light-border dark:border-dark-border hover:border-red-500 hover:text-red-500 transition-all">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>`;
    }).join('');
}

/* ============================================ */
/* Form                                         */
/* ============================================ */
function resetForm() {
    editingId = null;
    els.id.value = '';
    els.tur.value = 'haftalik';
    els.baslik.value = '';
    els.metin.value = '';
    els.sure.value = '180';
    els.baslangic.value = '';
    els.bitis.value = '';
    els.sonuc.value = '';
    els.aktif.checked = true;
    els.formTitle.innerHTML = '<i class="fa-solid fa-plus text-yaziyo-gold"></i> Yeni Sınav';
    els.saveBtn.querySelector('span').textContent = 'Kaydet';
    updateMetinSayac();
}

function fillForm(s) {
    editingId = s.id;
    els.id.value = s.id;
    els.tur.value = s.tur;
    els.baslik.value = s.baslik;
    els.metin.value = s.metin;
    els.sure.value = s.sure_saniye;
    els.baslangic.value = toLocalInput(s.baslangic);
    els.bitis.value = toLocalInput(s.bitis);
    els.sonuc.value = toLocalInput(s.sonuc);
    els.aktif.checked = !!s.aktif;
    els.formTitle.innerHTML = '<i class="fa-solid fa-pen text-yaziyo-gold"></i> Sınavı Düzenle';
    els.saveBtn.querySelector('span').textContent = 'Güncelle';
    updateMetinSayac();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateMetinSayac() {
    const val = els.metin.value.trim();
    const kelime = val ? val.split(/\s+/).length : 0;
    els.metinKelime.textContent = kelime;
    els.metinKarakter.textContent = els.metin.value.length;
}

function validateForm() {
    const baslik = els.baslik.value.trim();
    const metin = els.metin.value.trim();
    const sure = parseInt(els.sure.value, 10);
    const bas = toISO(els.baslangic.value);
    const bit = toISO(els.bitis.value);
    const son = toISO(els.sonuc.value);

    if (!baslik) { showToast('Başlık girin.', 'error'); return null; }
    if (metin.length < 20) { showToast('Sınav metni çok kısa.', 'error'); return null; }
    if (!Number.isFinite(sure) || sure < 30) { showToast('Geçerli bir süre girin.', 'error'); return null; }
    if (!bas || !bit || !son) { showToast('Tüm tarihleri doldurun.', 'error'); return null; }
    if (new Date(bit) <= new Date(bas)) { showToast('Bitiş, başlangıçtan sonra olmalı.', 'error'); return null; }
    if (new Date(son) < new Date(bit)) { showToast('Sonuç tarihi bitişten önce olamaz.', 'error'); return null; }

    return {
        tur: els.tur.value,
        baslik,
        metin,
        sure_saniye: sure,
        baslangic: bas,
        bitis: bit,
        sonuc: son,
        aktif: els.aktif.checked,
    };
}

async function handleSubmit(e) {
    e.preventDefault();
    const payload = validateForm();
    if (!payload) return;

    els.saveBtn.disabled = true;
    const origHtml = els.saveBtn.innerHTML;
    els.saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Kaydediliyor...</span>';

    try {
        let error;
        if (editingId) {
            ({ error } = await supabase.from('sinavlar').update(payload).eq('id', editingId));
        } else {
            ({ error } = await supabase.from('sinavlar').insert(payload));
        }
        if (error) throw error;

        showToast(editingId ? 'Sınav güncellendi.' : 'Sınav eklendi.');
        resetForm();
        await loadExams();
    } catch (err) {
        console.error('Sınav kaydetme hatası:', err);
        showToast(err?.message || 'Kaydetme başarısız.', 'error');
    } finally {
        els.saveBtn.disabled = false;
        els.saveBtn.innerHTML = origHtml;
        els.saveBtn.querySelector('span').textContent = editingId ? 'Güncelle' : 'Kaydet';
    }
}

async function toggleAktif(id) {
    const s = exams.find((e) => e.id === id);
    if (!s) return;
    const { error } = await supabase.from('sinavlar').update({ aktif: !s.aktif }).eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(!s.aktif ? 'Sınav yayınlandı.' : 'Sınav pasifleştirildi.');
    await loadExams();
}

/* ============================================ */
/* Silme                                        */
/* ============================================ */
function openDeleteModal(id) {
    const s = exams.find((e) => e.id === id);
    if (!s) return;
    deleteTarget = id;
    els.deleteAdi.textContent = s.baslik;
    els.deleteModal.classList.remove('hidden');
    els.deleteModal.classList.add('flex');
}

function closeDeleteModal() {
    deleteTarget = null;
    els.deleteModal.classList.add('hidden');
    els.deleteModal.classList.remove('flex');
}

async function confirmDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from('sinavlar').delete().eq('id', deleteTarget);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Sınav silindi.');
    closeDeleteModal();
    await loadExams();
}

/* ============================================ */
/* Init                                         */
/* ============================================ */
function cacheEls() {
    els.toast = document.getElementById('toast');
    els.form = document.getElementById('sinav-form');
    els.id = document.getElementById('sinav-id');
    els.tur = document.getElementById('sinav-tur');
    els.baslik = document.getElementById('sinav-baslik');
    els.metin = document.getElementById('sinav-metin');
    els.sure = document.getElementById('sinav-sure');
    els.baslangic = document.getElementById('sinav-baslangic');
    els.bitis = document.getElementById('sinav-bitis');
    els.sonuc = document.getElementById('sinav-sonuc');
    els.aktif = document.getElementById('sinav-aktif');
    els.saveBtn = document.getElementById('btn-sinav-kaydet');
    els.clearBtn = document.getElementById('btn-sinav-temizle');
    els.autoBtn = document.getElementById('btn-otomatik-tarih');
    els.formTitle = document.getElementById('form-title');
    els.metinKelime = document.getElementById('metin-kelime');
    els.metinKarakter = document.getElementById('metin-karakter');
    els.listBody = document.getElementById('sinav-list-body');
    els.refreshBtn = document.getElementById('btn-refresh');
    els.deleteModal = document.getElementById('delete-modal');
    els.deleteAdi = document.getElementById('delete-sinav-adi');
}

function bindEvents() {
    els.form.addEventListener('submit', handleSubmit);
    els.clearBtn.addEventListener('click', resetForm);
    els.autoBtn.addEventListener('click', autoFillDates);
    els.metin.addEventListener('input', updateMetinSayac);
    els.refreshBtn.addEventListener('click', loadExams);

    els.listBody.addEventListener('click', (e) => {
        const ed = e.target.closest('[data-edit]');
        if (ed) { const s = exams.find((x) => x.id === ed.getAttribute('data-edit')); if (s) fillForm(s); return; }
        const del = e.target.closest('[data-delete]');
        if (del) { openDeleteModal(del.getAttribute('data-delete')); return; }
        const tg = e.target.closest('[data-toggle]');
        if (tg) { toggleAktif(tg.getAttribute('data-toggle')); return; }
    });

    document.getElementById('delete-cancel').addEventListener('click', closeDeleteModal);
    document.getElementById('delete-backdrop').addEventListener('click', closeDeleteModal);
    document.getElementById('delete-confirm').addEventListener('click', confirmDelete);
}

document.addEventListener('DOMContentLoaded', () => {
    cacheEls();
    bindEvents();
    resetForm();
    loadExams();
});
