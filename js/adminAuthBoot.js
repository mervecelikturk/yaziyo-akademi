/**
 * YAZİYO — Admin paneli ortak oturum koruması ve çıkış
 */
import { requireAdminAccess, performAdminLogout } from './lib/adminAuth.js';
import { getSupabaseClient, initSupabaseClient } from './lib/supabase.js';

async function bootAdminPanel() {
    await initSupabaseClient();
    return requireAdminAccess();
}

bootAdminPanel();

window.performAdminLogout = async () => {
    await performAdminLogout(getSupabaseClient());
    window.location.replace('adminGiris.html?cikis=1');
};
