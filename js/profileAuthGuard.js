/**
 * YAZİYO - Profil sayfası görünürlük koruması
 * Profil içeriği, auth hydrate gecikmesinde Tailwind hidden / auth CSS altında kalmasın.
 */

import { supabase } from './lib/supabase.js';
import { getStoredVerifiedUser, setStoredVerifiedUser } from './lib/authStorage.js';

function setTextOnce(el, value) {
    if (!el || !value) return;
    if (el.textContent === value) return;
    el.textContent = value;
}

function forceProfileVisible(user) {
    const mainContent = document.getElementById('profile-main-content');
    const authGate = document.getElementById('auth-gate');

    document.documentElement.classList.add('is-logged-in', 'profile-auth-ready');

    if (authGate) authGate.style.removeProperty('display');
    if (mainContent) mainContent.style.removeProperty('display');

    if (user) {
        const name = user.user_metadata?.site_full_name || user.user_metadata?.full_name || user.email || 'Kullanıcı';
        setTextOnce(document.getElementById('user-name'), name);
        setTextOnce(document.getElementById('user-email'), user.email || '');
        if (user.created_at) {
            setTextOnce(document.getElementById('user-join-date'), formatJoinDate(user.created_at));
        }
    }
}

function formatJoinDate(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return 'Katılma Tarihi: Bilinmiyor';
    return `Katılma Tarihi: ${date.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })}`;
}

/** Aynı durum tekrar uygulanıp sayfa yeniden çizilmesin */
let _appliedProfileState = null;

async function applyProfileAuthState() {
    const user = await resolveProfileUser();
    if (user) {
        const key = `user:${user.id}:${user.user_metadata?.site_full_name || user.user_metadata?.full_name || ''}`;
        if (_appliedProfileState === key) return;
        _appliedProfileState = key;
        forceProfileVisible(user);
        return;
    }

    // Oturum geç hydrate olabilir: doğrulanmış kullanıcı önbellekte varsa içeriği kapatma.
    if (getStoredVerifiedUser()) return;

    if (_appliedProfileState === 'gate') return;
    _appliedProfileState = 'gate';
    showProfileGate();
}

function showProfileGate() {
    const mainContent = document.getElementById('profile-main-content');
    const authGate = document.getElementById('auth-gate');

    document.documentElement.classList.remove('is-logged-in', 'profile-auth-ready');

    if (mainContent) mainContent.style.removeProperty('display');
    if (authGate) authGate.style.removeProperty('display');
}

async function resolveProfileUser() {
    const cached = getStoredVerifiedUser();
    if (cached) return cached;

    if (!supabase) return null;

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setStoredVerifiedUser(user);
            return user;
        }
    } catch (_) {
        // Session fallback below covers short-lived getUser failures.
    }

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            setStoredVerifiedUser(session.user);
            return session.user;
        }
    } catch (_) {
        return null;
    }

    return null;
}

function scheduleProfileAuthChecks() {
    applyProfileAuthState();
}

// lib/supabase.js modül seviyesinde await kullandığı için bu modül
// DOMContentLoaded'dan SONRA çalışabilir; o durumda doğrudan başlat.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleProfileAuthChecks);
} else {
    scheduleProfileAuthChecks();
}

window.addEventListener('pageshow', (event) => {
    if (event.persisted) scheduleProfileAuthChecks();
});

if (supabase) {
    supabase.auth.onAuthStateChange(() => {
        applyProfileAuthState();
    });
}

window.yaziyoForceProfileVisible = forceProfileVisible;
window.yaziyoRefreshProfileAuthState = applyProfileAuthState;
