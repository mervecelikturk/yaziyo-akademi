/* ============================================ */
/* YAZİYO - İçerik Ekle (Sayfa Durumu) Admin   */
/* ============================================ */

import { requireAdminAccess } from './lib/adminAuth.js';
import { refreshAdminMobileTables } from './lib/adminTableMobile.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!(await requireAdminAccess())) return;

    const tbody = document.getElementById('page-status-tbody');
    const syncHint = document.getElementById('page-status-sync-hint');
    if (!tbody || !window.YaziyoPageStatus) return;

    const { PAGES, getStatus, setPageActiveAsync, syncFromRemote, pushAllToRemote } = window.YaziyoPageStatus;

    // Önce sunucudaki kalıcı durumu al
    await syncFromRemote();

    let status = getStatus();

    // Uzakta hiç kayıt yoksa mevcut durumu ilk kez yükle (kalıcılık başlasın)
    try {
        const { fetchRemotePageStatusMap } = await import('./lib/pageStatusApi.js');
        const remote = await fetchRemotePageStatusMap();
        if (remote && Object.keys(remote).length === 0) {
            const pushed = await pushAllToRemote();
            if (pushed?.ok) {
                setSyncHint('Durumlar sunucuya kaydedildi.', false);
            } else if (pushed?.missingTable) {
                setSyncHint('Uyarı: site_page_status tablosu yok. sql/site_page_status.sql dosyasını Supabase\'de çalıştırın.', true);
            }
        }
    } catch (_) { /* ignore */ }

    status = getStatus();
    tbody.innerHTML = '';

    PAGES.forEach((page) => {
        const active = status[page.id] !== false;
        const row = document.createElement('tr');
        row.className = 'hover:bg-light-bg/30 dark:hover:bg-dark-bg/20 transition-colors duration-200';
        row.dataset.pageId = page.id;
        row.innerHTML = `
            <td class="px-6 py-4 text-sm font-medium">${page.label}</td>
            <td class="px-6 py-4 text-sm font-medium">
                <button type="button" class="status-toggle-btn ${active ? 'is-active' : 'is-passive'} inline-flex items-center px-3 py-1 rounded-full text-xs font-bold transition-all duration-300 ${active
            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800/50'
            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800/50'}">
                    <i class="fa-solid fa-circle text-[6px] mr-1.5"></i>
                    <span>${active ? 'Aktif' : 'Pasif'}</span>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    refreshAdminMobileTables();

    tbody.addEventListener('click', async (e) => {
        const btn = e.target.closest('.status-toggle-btn');
        if (!btn || btn.disabled) return;

        const row = btn.closest('tr');
        const pageId = row?.dataset.pageId;
        if (!pageId) return;

        const isActive = btn.classList.contains('is-active');
        const nextActive = !isActive;

        btn.disabled = true;
        updateToggleButton(btn, nextActive);

        const result = await setPageActiveAsync(pageId, nextActive);
        btn.disabled = false;

        if (!result?.remoteOk) {
            // Uzak kayıt başarısızsa UI'ı geri al
            updateToggleButton(btn, isActive);
            window.YaziyoPageStatus.setPageActive(pageId, isActive);
            if (result?.missingTable) {
                setSyncHint('Kayıt başarısız: site_page_status tablosu bulunamadı. sql/site_page_status.sql dosyasını çalıştırın.', true);
            } else {
                setSyncHint('Sunucuya kaydedilemedi. Bağlantıyı kontrol edip tekrar deneyin.', true);
            }
            return;
        }

        setSyncHint(`${row.querySelector('td')?.textContent?.trim() || 'Sayfa'} ${nextActive ? 'aktif' : 'pasif'} olarak kaydedildi.`, false);
        window.YaziyoAdminNavbar?.refreshMobileTables?.();
        window.YaziyoPageStatus.applyToNavbar();
    });

    function setSyncHint(message, isError) {
        if (!syncHint) return;
        syncHint.textContent = message || '';
        syncHint.classList.toggle('text-red-500', !!isError);
        syncHint.classList.toggle('text-yaziyo-gold', !isError && !!message);
        syncHint.classList.toggle('hidden', !message);
    }
});

function updateToggleButton(btn, active) {
    const span = btn.querySelector('span');
    if (active) {
        span.textContent = 'Aktif';
        btn.className = 'status-toggle-btn is-active inline-flex items-center px-3 py-1 rounded-full text-xs font-bold transition-all duration-300 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800/50';
    } else {
        span.textContent = 'Pasif';
        btn.className = 'status-toggle-btn is-passive inline-flex items-center px-3 py-1 rounded-full text-xs font-bold transition-all duration-300 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800/50';
    }
}
