/**
 * YAZİYO — Admin Live Chat sayfası
 */
import { initSupabaseClient } from './lib/supabase.js';
import { requireAdminAccess } from './lib/adminAuth.js';
import { createAdminLiveChatPanel } from './lib/adminLiveChatPanel.js';

function showToast(msg, type = 'success') {
    const t = document.getElementById('alc-toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `fixed left-4 right-4 bottom-4 sm:left-auto sm:right-6 sm:bottom-6 max-w-sm z-[150] px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl ${
        type === 'error' ? 'bg-red-500 text-white' : 'bg-yaziyo-gold text-slate-900'
    }`;
    t.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.add('hidden'), 2800);
}

async function init() {
    const ok = await requireAdminAccess();
    if (!ok) return;

    await initSupabaseClient();
    const panel = createAdminLiveChatPanel({ showToast });
    await panel.start();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
