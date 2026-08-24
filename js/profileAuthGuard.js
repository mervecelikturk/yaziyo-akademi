/**
 * YAZİYO - Profil sayfası görünürlük koruması
 * Profil içeriği, auth hydrate gecikmesinde Tailwind hidden / auth CSS altında kalmasın.
 */

import { supabase } from './lib/supabase.js';
import { getStoredVerifiedUser, setStoredVerifiedUser } from './lib/authStorage.js';

function forceProfileVisible(user) {
    const mainContent = document.getElementById('profile-main-content');
    const authGate = document.getElementById('auth-gate');

    document.documentElement.classList.add('is-logged-in', 'profile-auth-ready');

    if (authGate) authGate.style.removeProperty('display');
    if (mainContent) mainContent.style.removeProperty('display');

    if (user) {
        const name = user.user_metadata?.site_full_name || user.user_metadata?.full_name || user.email || 'Kullanıcı';
        const email = user.email || '';
        const userName = document.getElementById('user-name');
        const userEmail = document.getElementById('user-email');
        const joinDate = document.getElementById('user-join-date');
        if (userName) userName.textContent = name;
        if (userEmail && email) userEmail.textContent = email;
        if (joinDate && user.created_at) {
            joinDate.textContent = formatJoinDate(user.created_at);
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

async function applyProfileAuthState() {
    const user = await resolveProfileUser();
    if (user) {
        forceProfileVisible(user);
    } else {
        showProfileGate();
    }
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

let _profileAuthPass = 0;

function scheduleProfileAuthChecks() {
    applyProfileAuthState();
}

document.addEventListener('DOMContentLoaded', scheduleProfileAuthChecks);

window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        _profileAuthPass = 0;
        scheduleProfileAuthChecks();
    }
});

if (supabase) {
    supabase.auth.onAuthStateChange(() => {
        _profileAuthPass = 0;
        applyProfileAuthState();
    });
}

window.yaziyoForceProfileVisible = forceProfileVisible;
window.yaziyoRefreshProfileAuthState = applyProfileAuthState;
