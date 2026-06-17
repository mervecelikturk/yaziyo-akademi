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

    if (authGate) {
        authGate.classList.add('hidden');
        authGate.style.setProperty('display', 'none', 'important');
    }

    if (mainContent) {
        mainContent.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
        mainContent.classList.add('opacity-100', 'pointer-events-auto');
        mainContent.style.setProperty('display', 'grid', 'important');
        mainContent.style.setProperty('opacity', '1', 'important');
        mainContent.style.setProperty('pointer-events', 'auto', 'important');
    }

    if (user) {
        const name = user.user_metadata?.full_name || user.email || 'Kullanıcı';
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

async function hydrateProfileStats(user) {
    if (!supabase || !user?.id) return;

    try {
        const { loadUserStats, applyProfileStatsUI, applyRankUI } = await import('./userStats.js');
        const stats = await loadUserStats(supabase, user.id);
        const joinDate = document.getElementById('user-join-date');
        if (joinDate) {
            joinDate.textContent = formatJoinDate(stats?.created_at || user.created_at);
        }

        if (stats) {
            applyProfileStatsUI(stats);
        } else {
            applyRankUI(0);
        }
    } catch (err) {
        console.warn('Profil istatistikleri guard üzerinden güncellenemedi:', err);
    }
}

function showProfileGate() {
    const mainContent = document.getElementById('profile-main-content');
    const authGate = document.getElementById('auth-gate');

    document.documentElement.classList.remove('is-logged-in', 'profile-auth-ready');

    if (mainContent) {
        mainContent.style.setProperty('display', 'none', 'important');
        mainContent.classList.add('hidden', 'opacity-0', 'pointer-events-none');
        mainContent.classList.remove('opacity-100', 'pointer-events-auto');
    }

    if (authGate) {
        authGate.classList.remove('hidden');
        authGate.style.setProperty('display', 'block', 'important');
    }
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

async function applyProfileAuthState() {
    const user = await resolveProfileUser();
    if (user) {
        forceProfileVisible(user);
        hydrateProfileStats(user);
    } else {
        showProfileGate();
    }
}

function scheduleProfileAuthChecks() {
    [0, 50, 150, 350, 800, 1500, 3000].forEach((delay) => {
        window.setTimeout(applyProfileAuthState, delay);
    });
}

document.addEventListener('DOMContentLoaded', scheduleProfileAuthChecks);
window.addEventListener('load', scheduleProfileAuthChecks);
window.addEventListener('pageshow', scheduleProfileAuthChecks);

if (supabase) {
    supabase.auth.onAuthStateChange(() => {
        scheduleProfileAuthChecks();
    });
}

window.yaziyoForceProfileVisible = forceProfileVisible;
window.yaziyoRefreshProfileAuthState = applyProfileAuthState;
