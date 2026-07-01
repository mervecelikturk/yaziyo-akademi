/**
 * YAZİYO - Admin kullanıcı yönetimi
 */
import { getSupabaseClient, initSupabaseClient } from './lib/supabase.js';
import { requireAdminAccess } from './lib/adminAuth.js';
import { refreshAdminMobileTables } from './lib/adminTableMobile.js';
import { bindNameInput, validateNameFields } from './lib/nameValidation.js';

let allUsers = [];
let searchQuery = '';
let pendingDeleteUserId = null;

const tbody = () => document.querySelector('#users-tbody') || document.querySelector('tbody');
const TABLE_COLSPAN = 7;

function formatUserCount(n) {
    return (Number(n) || 0).toLocaleString('tr-TR');
}

function updateUserCountSummary() {
    const el = document.getElementById('users-count-summary');
    if (!el) return;

    const total = allUsers.length;
    const filtered = filterUsers(allUsers).length;

    if (searchQuery.trim() && filtered !== total) {
        el.textContent = `${formatUserCount(filtered)} / ${formatUserCount(total)} kullanıcı gösteriliyor`;
        return;
    }

    if (total === 0) {
        el.textContent = 'Toplam 0 kullanıcı';
        return;
    }

    el.textContent = `Toplam ${formatUserCount(total)} kullanıcı`;
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function splitName(fullName) {
    const parts = (fullName || 'İsimsiz Kullanıcı').trim().split(/\s+/);
    return {
        firstName: parts[0] || '-',
        lastName: parts.length > 1 ? parts.slice(1).join(' ') : '-',
    };
}

function filterUsers(users) {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u) => {
        const full = (u.full_name || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const { firstName, lastName } = splitName(u.full_name);
        return (
            full.includes(q)
            || email.includes(q)
            || firstName.toLowerCase().includes(q)
            || lastName.toLowerCase().includes(q)
        );
    });
}

function showLoading() {
    const el = tbody();
    if (!el) return;
    const summary = document.getElementById('users-count-summary');
    if (summary) summary.textContent = 'Yükleniyor…';
    el.innerHTML = `
        <tr>
            <td colspan="${TABLE_COLSPAN}" class="px-6 py-24 text-center">
                <div class="flex flex-col items-center gap-4">
                    <i class="fa-solid fa-circle-notch fa-spin text-4xl text-yaziyo-gold"></i>
                    <p class="text-xs text-light-text-secondary dark:text-dark-text-secondary">Kullanıcı listesi yükleniyor...</p>
                </div>
            </td>
        </tr>
    `;
    refreshAdminMobileTables();
}

function showSetupRequired() {
    const el = tbody();
    if (!el) return;
    el.innerHTML = `
        <tr>
            <td colspan="${TABLE_COLSPAN}" class="px-6 py-12">
                <div class="max-w-2xl mx-auto bg-orange-500/5 border border-orange-500/20 rounded-2xl p-8 text-center">
                    <i class="fa-solid fa-database text-4xl text-orange-500 mb-4"></i>
                    <h3 class="text-xl font-poppins font-bold mb-2">Veritabanı Kurulumu Gerekli</h3>
                    <p class="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-6">
                        Supabase'de <b>public.kullanicilar</b> tablosu henüz yok.
                        <code class="text-orange-400">supabase/migrations/001_kullanicilar.sql</code> dosyasını çalıştırın.
                    </p>
                    <pre id="kullanicilar-setup-sql" class="bg-slate-900 text-slate-300 p-4 rounded-xl text-[11px] text-left mb-4 max-h-48 overflow-auto">Dosya: supabase/migrations/001_kullanicilar.sql</pre>
                    <a href="https://supabase.com/dashboard/project/eqyfnlapipnzojxhispd/sql/new" target="_blank" rel="noopener"
                        class="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition-all">
                        <i class="fa-solid fa-external-link"></i> SQL Editor
                    </a>
                    <button type="button" onclick="location.reload()" class="block mx-auto mt-4 px-8 py-3 bg-orange-500 text-white rounded-xl font-poppins font-bold text-sm">Sayfayı Yenile</button>
                </div>
            </td>
        </tr>
    `;
    const summary = document.getElementById('users-count-summary');
    if (summary) summary.textContent = '—';
    loadSetupSql();
    refreshAdminMobileTables();
}

async function loadSetupSql() {
    const pre = document.getElementById('kullanicilar-setup-sql');
    if (!pre) return;
    try {
        const res = await fetch('../supabase/migrations/001_kullanicilar.sql');
        if (res.ok) pre.textContent = await res.text();
    } catch (e) {
        console.warn('Kurulum SQL okunamadı:', e);
    }
}

function showError(message) {
    const el = tbody();
    if (!el) return;
    updateUserCountSummary();
    el.innerHTML = `
        <tr>
            <td colspan="${TABLE_COLSPAN}" class="px-6 py-20 text-center text-red-500">
                <i class="fa-solid fa-triangle-exclamation text-4xl mb-4"></i>
                <p class="font-bold">Bir Hata Oluştu</p>
                <p class="text-sm mt-2 opacity-80">${escapeHtml(message)}</p>
            </td>
        </tr>
    `;
    refreshAdminMobileTables();
}

function renderTable() {
    const el = tbody();
    if (!el) return;

    const users = filterUsers(allUsers);
    updateUserCountSummary();

    if (users.length === 0) {
        el.innerHTML = `
            <tr>
                <td colspan="${TABLE_COLSPAN}" class="px-6 py-20 text-center">
                    <i class="fa-solid fa-user-slash text-5xl mb-4 text-light-text-secondary dark:text-dark-text-secondary opacity-20"></i>
                    <p class="text-light-text-secondary dark:text-dark-text-secondary font-medium">
                        ${searchQuery.trim() ? 'Aramanızla eşleşen kullanıcı bulunamadı.' : 'Henüz kayıtlı bir kullanıcı bulunmuyor.'}
                    </p>
                </td>
            </tr>
        `;
        refreshAdminMobileTables();
        return;
    }

    el.innerHTML = users.map((user, index) => {
        const { firstName, lastName } = splitName(user.full_name);
        const email = user.email || '-';
        const createdAt = user.created_at
            ? new Date(user.created_at).toLocaleDateString('tr-TR')
            : '-';

        return `
            <tr class="hover:bg-light-bg/30 dark:hover:bg-dark-bg/20 transition-colors duration-200 border-b border-light-border dark:border-dark-border last:border-0" data-user-id="${user.id}">
                <td class="px-4 py-4 text-sm font-poppins font-bold text-yaziyo-gold text-center tabular-nums">${index + 1}</td>
                <td class="px-6 py-4 text-sm font-medium">${escapeHtml(firstName)}</td>
                <td class="px-6 py-4 text-sm font-medium">${escapeHtml(lastName)}</td>
                <td class="px-6 py-4 text-sm text-light-text-secondary dark:text-dark-text-secondary">${escapeHtml(email)}</td>
                <td class="px-6 py-4">
                    <span class="font-mono text-sm tracking-widest text-light-text-secondary dark:text-dark-text-secondary opacity-50">••••••••</span>
                </td>
                <td class="px-6 py-4 text-sm text-light-text-secondary dark:text-dark-text-secondary">${escapeHtml(createdAt)}</td>
                <td class="px-6 py-4 text-right">
                    <button type="button" class="delete-btn px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 text-[11px] font-bold uppercase tracking-tight hover:bg-red-500 hover:text-white transition-all duration-200" data-id="${user.id}">Sil</button>
                </td>
            </tr>
        `;
    }).join('');

    refreshAdminMobileTables();
    attachDeleteHandlers();
}

export async function fetchUsers() {
    await initSupabaseClient();
    const supabase = getSupabaseClient();
    if (!supabase) {
        showError('Sistem bağlantısı kurulamadı.');
        return;
    }

    showLoading();

    try {
        const { data: users, error } = await supabase
            .from('kullanicilar')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            if (error.code === 'PGRST205' || error.code === 'PGRST116' || error.message?.includes('kullanicilar')) {
                showSetupRequired();
                return;
            }
            throw error;
        }

        allUsers = users || [];
        renderTable();
    } catch (err) {
        console.error('Fetch Users Error:', err);
        showError(err.message || 'Veriler çekilemedi.');
    }
}

function attachDeleteHandlers() {
    document.querySelectorAll('.delete-btn').forEach((btn) => {
        btn.onclick = () => {
            const userId = btn.getAttribute('data-id');
            const user = allUsers.find((u) => u.id === userId);
            openDeleteUserModal(userId, user);
        };
    });
}

function openDeleteUserModal(userId, user) {
    pendingDeleteUserId = userId;
    const m = document.getElementById('delete-user-modal');
    const backdrop = document.getElementById('delete-user-backdrop');
    const content = document.getElementById('delete-user-content');
    const nameEl = document.getElementById('delete-user-name');
    if (!m || !backdrop || !content) return;

    if (nameEl) {
        nameEl.textContent = (user?.full_name || '').trim() || user?.email || 'Bu kullanıcı';
    }

    m.classList.remove('hidden');
    m.classList.add('flex');

    requestAnimationFrame(() => {
        backdrop.classList.remove('opacity-0');
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    });
}

function closeDeleteUserModal() {
    const m = document.getElementById('delete-user-modal');
    const backdrop = document.getElementById('delete-user-backdrop');
    const content = document.getElementById('delete-user-content');
    if (!m || !backdrop || !content) return;

    pendingDeleteUserId = null;
    backdrop.classList.add('opacity-0');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');

    setTimeout(() => {
        m.classList.remove('flex');
        m.classList.add('hidden');
    }, 300);
}

async function confirmDeleteUser() {
    const supabase = getSupabaseClient();
    if (!pendingDeleteUserId || !supabase) return;

    const userId = pendingDeleteUserId;
    const btn = document.getElementById('confirm-delete-user-btn');
    const label = btn?.querySelector('.confirm-delete-label');

    try {
        if (btn) btn.disabled = true;
        if (label) label.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Siliniyor...';

        const { error } = await supabase.from('kullanicilar').delete().eq('id', userId);
        if (error) throw error;

        allUsers = allUsers.filter((u) => u.id !== userId);
        renderTable();
        closeDeleteUserModal();
    } catch (err) {
        alert('Kullanıcı silinirken hata oluştu: ' + err.message);
    } finally {
        if (btn) btn.disabled = false;
        if (label) label.textContent = 'Evet, Sil';
    }
}

const passwordRules = {
    length: (pw) => pw.length >= 8 && pw.length <= 64,
    upper: (pw) => /[\p{Lu}]/u.test(pw),
    lower: (pw) => /[\p{Ll}]/u.test(pw),
    number: (pw) => /[0-9]/.test(pw),
    noSpace: (pw) => !/\s/.test(pw),
};

function isPasswordValid(pw) {
    return Object.values(passwordRules).every((rule) => rule(pw));
}

function setAddUserFeedback({ error = '', success = '' } = {}) {
    const errEl = document.getElementById('add-user-error');
    const okEl = document.getElementById('add-user-success');
    if (!errEl || !okEl) return;

    if (error) {
        errEl.textContent = error;
        errEl.classList.remove('hidden');
    } else {
        errEl.classList.add('hidden');
        errEl.textContent = '';
    }

    if (success) {
        okEl.textContent = success;
        okEl.classList.remove('hidden');
    } else {
        okEl.classList.add('hidden');
        okEl.textContent = '';
    }
}

export function openAddUserModal() {
    const m = document.getElementById('add-user-modal');
    const backdrop = document.getElementById('add-user-backdrop');
    const content = document.getElementById('add-user-content');
    if (!m || !backdrop || !content) return;

    document.getElementById('add-user-form')?.reset();
    setAddUserFeedback();

    m.classList.remove('hidden');
    m.classList.add('flex');

    requestAnimationFrame(() => {
        backdrop.classList.remove('opacity-0');
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
        document.getElementById('add-user-ad')?.focus();
    });
}

export function closeAddUserModal() {
    const m = document.getElementById('add-user-modal');
    const backdrop = document.getElementById('add-user-backdrop');
    const content = document.getElementById('add-user-content');
    if (!m || !backdrop || !content) return;

    backdrop.classList.add('opacity-0');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');

    setTimeout(() => {
        m.classList.remove('flex');
        m.classList.add('hidden');
    }, 300);
}

function toggleModalPassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn?.querySelector('i');
    if (!input || !icon) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    icon.classList.toggle('fa-eye', !show);
    icon.classList.toggle('fa-eye-slash', show);
}

async function createUser(e) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const ad = (document.getElementById('add-user-ad')?.value || '').trim();
    const soyad = (document.getElementById('add-user-soyad')?.value || '').trim();
    const email = (document.getElementById('add-user-email')?.value || '').trim();
    const password = document.getElementById('add-user-password')?.value || '';
    const confirm = document.getElementById('add-user-password-confirm')?.value || '';
    const submitBtn = document.getElementById('add-user-submit-btn');
    const label = submitBtn?.querySelector('.submit-label');

    setAddUserFeedback();

    const nameError = validateNameFields(ad, soyad);
    if (nameError) {
        setAddUserFeedback({ error: nameError });
        return;
    }

    if (!email) {
        setAddUserFeedback({ error: 'E-posta zorunludur.' });
        return;
    }

    if (password !== confirm) {
        setAddUserFeedback({ error: 'Şifreler eşleşmiyor.' });
        return;
    }

    if (!isPasswordValid(password)) {
        setAddUserFeedback({
            error: 'Şifre 8-64 karakter olmalı; en az bir büyük harf, küçük harf ve rakam içermeli; boşluk olmamalı.',
        });
        return;
    }

    if (submitBtn) submitBtn.disabled = true;
    if (label) label.textContent = 'Kaydediliyor...';

    let prevSession = null;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        prevSession = session;

        const { getEmailConfirmRedirectUrl } = await import('./lib/authConfig.js');
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: `${ad} ${soyad}` },
                emailRedirectTo: getEmailConfirmRedirectUrl(),
            },
        });

        if (error) throw error;

        await supabase.auth.signOut();

        if (prevSession?.access_token && prevSession?.refresh_token) {
            await supabase.auth.setSession({
                access_token: prevSession.access_token,
                refresh_token: prevSession.refresh_token,
            });
        }

        if (data?.user?.identities?.length === 0) {
            setAddUserFeedback({ error: 'Bu e-posta adresi zaten kayıtlı.' });
            return;
        }

        setAddUserFeedback({ success: 'Kullanıcı başarıyla oluşturuldu.' });
        await new Promise((r) => setTimeout(r, 400));
        await fetchUsers();

        setTimeout(() => closeAddUserModal(), 1200);
    } catch (err) {
        console.error('Kullanıcı oluşturma hatası:', err);
        const msg = err.message?.includes('already registered')
            ? 'Bu e-posta adresi zaten kayıtlı.'
            : (err.message || 'Kullanıcı oluşturulamadı.');
        setAddUserFeedback({ error: msg });

        await supabase.auth.signOut();
        if (prevSession?.access_token && prevSession?.refresh_token) {
            await supabase.auth.setSession({
                access_token: prevSession.access_token,
                refresh_token: prevSession.refresh_token,
            });
        }
    } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (label) label.textContent = 'Kullanıcı Oluştur';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    showLoading();
    if (!(await requireAdminAccess())) return;

    fetchUsers();

    document.getElementById('refresh-users-btn')?.addEventListener('click', () => {
        const btn = document.getElementById('refresh-users-btn');
        const icon = btn?.querySelector('i');
        icon?.classList.add('fa-spin');
        fetchUsers().finally(() => {
            setTimeout(() => icon?.classList.remove('fa-spin'), 600);
        });
    });

    document.getElementById('add-user-btn')?.addEventListener('click', openAddUserModal);
    document.getElementById('user-search-input')?.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderTable();
    });

    document.getElementById('add-user-form')?.addEventListener('submit', createUser);
    bindNameInput(document.getElementById('add-user-ad'));
    bindNameInput(document.getElementById('add-user-soyad'));

    document.getElementById('add-user-backdrop')?.addEventListener('click', closeAddUserModal);
    document.querySelectorAll('[data-close-add-user-modal]').forEach((btn) => {
        btn.addEventListener('click', closeAddUserModal);
    });

    document.getElementById('delete-user-backdrop')?.addEventListener('click', closeDeleteUserModal);
    document.querySelectorAll('[data-close-delete-user-modal]').forEach((btn) => {
        btn.addEventListener('click', closeDeleteUserModal);
    });
    document.getElementById('confirm-delete-user-btn')?.addEventListener('click', confirmDeleteUser);

    document.getElementById('toggle-add-user-password')?.addEventListener('click', (e) => {
        toggleModalPassword('add-user-password', e.currentTarget);
    });
    document.getElementById('toggle-add-user-password-confirm')?.addEventListener('click', (e) => {
        toggleModalPassword('add-user-password-confirm', e.currentTarget);
    });
});

window.fetchUsers = fetchUsers;
window.closeAddUserModal = closeAddUserModal;
