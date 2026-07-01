/* ============================================ */
/* YAZİYO - İçerik Ekle (Sayfa Durumu) Admin   */
/* ============================================ */

import { requireAdminAccess } from './lib/adminAuth.js';
import { refreshAdminMobileTables } from './lib/adminTableMobile.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!(await requireAdminAccess())) return;

    const tbody = document.getElementById('page-status-tbody');
    if (!tbody || !window.YaziyoPageStatus) return;

    const { PAGES, getStatus, setPageActive } = window.YaziyoPageStatus;
    const status = getStatus();

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

    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.status-toggle-btn');
        if (!btn) return;

        const row = btn.closest('tr');
        const pageId = row?.dataset.pageId;
        if (!pageId) return;

        const isActive = btn.classList.contains('is-active');
        const nextActive = !isActive;

        setPageActive(pageId, nextActive);
        updateToggleButton(btn, nextActive);
        window.YaziyoAdminNavbar?.refreshMobileTables?.();
        window.YaziyoPageStatus.applyToNavbar();
    });
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
