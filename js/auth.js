/**
 * YAZİYO - Kimlik Doğrulama Sistemi
 */

import { getSupabaseClient } from './lib/supabase.js';
import { isEmailConfirmed } from './lib/authConfig.js';
import {
    getCurrentUser,
    ensureSession,
    forceAuthCleanup,
} from './authVerification.js';
import {
    getStoredVerifiedUser,
    isRememberMeEnabled,
    setStoredVerifiedUser,
    mirrorSessionToWindowName,
    clearAllSupabaseAuthKeys,
} from './lib/authStorage.js';

const { homeHref, pageHref } = window.YaziyoPaths || {
    homeHref: () => '../index.html',
    pageHref: (filename) => filename,
};

// Dinamik CSS (Görünürlük Kontrolü + Auth FOUC Önleme)
const style = document.createElement('style');
style.innerHTML = `
    body.auth-loading {
        visibility: hidden !important;
        opacity: 0 !important;
    }
    body.auth-ready {
        visibility: visible !important;
        opacity: 1 !important;
        transition: opacity 0.15s ease;
    }
    html.is-logged-in #auth-gate { display: none !important; }
    html.is-logged-in #profile-main-content, 
    html.is-logged-in #dashboard-grid { display: grid !important; }
    html:not(.is-logged-in) #profile-main-content, 
    html:not(.is-logged-in) #dashboard-grid { display: none !important; }
    html:not(.is-logged-in) #auth-gate { display: block !important; }
`;
document.head.appendChild(style);

let _authInitialCheckDone = false;
if (document.body) {
    document.body.classList.add('auth-loading');
} else {
    document.addEventListener('DOMContentLoaded', () => {
        if (!_authInitialCheckDone) document.body.classList.add('auth-loading');
    });
}

/**
 * Sayfalar arası geçişte window.name'deki oturumu Supabase'e yükler.
 * Yalnızca Beni Hatırla açıkken kullanılır; kalıcılık asıl olarak localStorage'dan gelir.
 */
async function restoreSessionFromWindowName() {
    const client = getSupabaseClient();
    if (!client || !window.name?.includes('yaziyoSession')) return;
    if (!isRememberMeEnabled()) return;

    try {
        const { yaziyoSession } = JSON.parse(window.name);
        if (yaziyoSession?.access_token && yaziyoSession?.refresh_token) {
            await client.auth.setSession({
                access_token: yaziyoSession.access_token,
                refresh_token: yaziyoSession.refresh_token,
            });
            const user = await getCurrentUser(client);
            if (!user) {
                await forceAuthCleanup(client);
            }
        }
    } catch (e) {
        console.warn('window.name oturumu yüklenemedi:', e);
        window.name = '';
    }
}

/**
 * Oturum kontrolü — yalnızca Supabase session
 */
async function checkAuth() {
    let hasSession = false;
    let userData = null;
    const cachedUser = getStoredVerifiedUser();

    try {
        if (cachedUser) {
            hasSession = true;
            userData = cachedUser;
            document.documentElement.classList.add('is-logged-in');
            updateUIElements(cachedUser);
        }

        await restoreSessionFromWindowName();

        const client = getSupabaseClient();
        if (client) {
            const result = await ensureSession(client);
            if (result.ok && result.user) {
                hasSession = true;
                userData = result.user;
            } else if (cachedUser) {
                // Sayfa geçişinde Supabase session bazen geç hydrate oluyor.
                // Cache varsa UI'yi kilitleme; sonraki auth event doğrular.
                hasSession = true;
                userData = cachedUser;
            } else {
                hasSession = false;
                userData = null;
            }
        }

        const html = document.documentElement;
        if (hasSession) {
            html.classList.add('is-logged-in');
            updateUIElements(userData);
            import('./notifications.js')
                .then(({ initNotifications }) => initNotifications(getSupabaseClient()))
                .catch(() => {});
            import('./dailyStreak.js')
                .then(({ syncDailyStreak }) => syncDailyStreak(getSupabaseClient()))
                .catch(() => {});
        } else if (document.documentElement.classList.contains('profile-auth-ready')) {
            html.classList.add('is-logged-in');
        } else {
            html.classList.remove('is-logged-in');
            updateUIElements(null);
            import('./dailyStreak.js')
                .then(({ syncDailyStreak }) => syncDailyStreak(null))
                .catch(() => {});
        }
    } catch (err) {
        console.error('CheckAuth Error:', err);
    } finally {
        if (!_authInitialCheckDone) {
            _authInitialCheckDone = true;
            if (document.body) {
                document.body.classList.remove('auth-loading');
                document.body.classList.add('auth-ready');
            }
        }
    }
}

const handleAuthClick = async (e) => {
    if (e) e.preventDefault();

    let hasSession = false;

    const client = getSupabaseClient();
    if (client) {
        try {
            const result = await ensureSession(client);
            if (result.ok) hasSession = true;
        } catch (err) {
            console.error('Auth check error on click:', err);
        }
    }

    window.location.href = hasSession ? pageHref('profil.html') : pageHref('girisKayit.html');
};

function attachAuthEvents() {
    document.querySelectorAll('#auth-button, #auth-nav-btn').forEach((authBtn) => {
        authBtn.addEventListener('click', handleAuthClick);
    });

    document.querySelectorAll('#menu-cikis, #logout-btn').forEach(btn => {
        btn.onclick = async (e) => {
            e.preventDefault();
            if (typeof window.openLogoutModal === 'function') {
                window.openLogoutModal();
            } else {
                await window.performLogout();
            }
        };
    });
}

window.performLogout = async () => {
    document.documentElement.classList.remove('is-logged-in', 'profile-auth-ready');
    clearAllSupabaseAuthKeys();
    window.name = '';

    try {
        const { clearStreakSessionCache } = await import('./dailyStreak.js');
        clearStreakSessionCache();
    } catch {
        /* ignore */
    }

    await forceAuthCleanup(getSupabaseClient());
    window.location.replace(homeHref());
};

attachAuthEvents();

function updateUIElements(user) {
    const isLoggedIn = !!user;

    document.querySelectorAll('#auth-button, #auth-nav-btn').forEach((authBtn) => {
        authBtn.classList.add('yaziyo-auth-btn');
        if (isLoggedIn) {
            authBtn.href = pageHref('profil.html');
            authBtn.setAttribute('aria-label', 'Profilim');
            authBtn.innerHTML = '<i class="fa-solid fa-user yaziyo-auth-btn-icon" aria-hidden="true"></i> <span class="yaziyo-auth-btn-text">Profilim</span>';
        } else {
            authBtn.href = pageHref('girisKayit.html');
            authBtn.setAttribute('aria-label', 'Giriş yap veya kayıt ol');
            authBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket yaziyo-auth-btn-icon" aria-hidden="true"></i> <span class="yaziyo-auth-btn-text yaziyo-auth-btn-text--full">Giriş Yap / Kayıt Ol</span><span class="yaziyo-auth-btn-text yaziyo-auth-btn-text--short">Giriş</span>';
        }
    });

    if (user) {
        const name = user.user_metadata?.full_name || 'Kullanıcı';
        const avatarUrl = user.user_metadata?.avatar_url;

        if (document.getElementById('user-name')) document.getElementById('user-name').innerText = name;
        if (document.getElementById('kpss-user-name')) document.getElementById('kpss-user-name').innerText = name;

        const avatarHTML = avatarUrl
            ? `<img src="${avatarUrl}" class="w-full h-full object-cover rounded-full">`
            : '<i class="fa-solid fa-user text-4xl"></i>';

        const kpssAvatar = document.getElementById('kpss-profile-avatar');
        if (kpssAvatar) kpssAvatar.innerHTML = avatarHTML;

        const profileAvatar = document.getElementById('profile-avatar');
        if (profileAvatar) profileAvatar.innerHTML = avatarHTML;

        // Gerçek rütbe profil istatistikleri yüklendiğinde `userStats.applyRankUI` ile güncellenir.
        updateGlobalRank(0);
    }
}

function updateGlobalRank(totalWords) {
    let rankClass = '', rankName = '', rankColor = '';

    if (totalWords >= 100000) { rankClass = 'rank-border-efsane'; rankName = 'Efsaneler'; rankColor = '#D97706'; }
    else if (totalWords >= 50000) { rankClass = 'rank-border-usta'; rankName = 'Ustalar'; rankColor = '#94A3B8'; }
    else if (totalWords >= 25000) { rankClass = 'rank-border-gelismis'; rankName = 'Gelişmişler'; rankColor = '#A85507'; }
    else if (totalWords >= 10000) { rankClass = 'rank-border-caliskan'; rankName = 'Çalışkanlar'; rankColor = '#3B82F6'; }
    else { rankClass = 'rank-border-umut'; rankName = 'Umut Vadedenler'; rankColor = '#22C55E'; }

    const kpssAvatar = document.getElementById('kpss-profile-avatar');
    if (kpssAvatar) {
        kpssAvatar.className = kpssAvatar.className.replace(/rank-border-[a-z]+/g, '');
        kpssAvatar.classList.add(rankClass);
    }
    const kpssRankName = document.getElementById('kpss-rank-name');
    if (kpssRankName) {
        kpssRankName.textContent = rankName;
        kpssRankName.style.color = rankColor;
    }
    const kpssRankBadge = document.getElementById('kpss-rank-badge');
    if (kpssRankBadge) {
        kpssRankBadge.style.borderColor = `${rankColor}40`;
        kpssRankBadge.style.backgroundColor = `${rankColor}10`;
    }

    const profileAvatar = document.getElementById('profile-avatar');
    if (profileAvatar) {
        profileAvatar.className = profileAvatar.className.replace(/rank-border-[a-z]+/g, '');
        profileAvatar.classList.add(rankClass);
    }
    const profileRankName = document.getElementById('rank-name');
    if (profileRankName) {
        profileRankName.textContent = rankName;
        profileRankName.style.color = rankColor;
    }
}

checkAuth();
window.addEventListener('load', checkAuth);

const supabaseClient = getSupabaseClient();
if (supabaseClient) {
    // ÖNEMLİ: onAuthStateChange callback'i İÇİNDE supabase.auth.getUser()/getSession()
    // gibi metotları çağırmak deadlock'a yol açar (ör. updateUser() auth kilidini tutarken
    // callback aynı kilidi bekler → "Kaydediliyor" sonsuza kadar takılır).
    // Bu yüzden callback'in verdiği `session` parametresini doğrudan kullanıyoruz ve
    // gerekli supabase çağrılarını setTimeout ile kilidin dışına erteliyoruz.
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            const user = session?.user || null;
            if (user && isEmailConfirmed(user)) {
                setStoredVerifiedUser(user);
                mirrorSessionToWindowName(session);
                document.documentElement.classList.add('is-logged-in');
                updateUIElements(user);
                if (event === 'SIGNED_IN') {
                    import('./dailyStreak.js')
                        .then(({ syncDailyStreak, clearStreakSessionCache }) => {
                            clearStreakSessionCache();
                            return syncDailyStreak(getSupabaseClient());
                        })
                        .catch(() => {});
                }
            } else if (user && !isEmailConfirmed(user)) {
                document.documentElement.classList.remove('is-logged-in');
                updateUIElements(null);
                setTimeout(() => { forceAuthCleanup(getSupabaseClient()); }, 0);
            } else if (!document.documentElement.classList.contains('profile-auth-ready')) {
                document.documentElement.classList.remove('is-logged-in');
                updateUIElements(null);
                setTimeout(() => { forceAuthCleanup(getSupabaseClient()); }, 0);
            }
        }
        if (event === 'SIGNED_OUT') {
            document.documentElement.classList.remove('is-logged-in');
            updateUIElements(null);
            import('./dailyStreak.js')
                .then(({ syncDailyStreak, clearStreakSessionCache }) => {
                    clearStreakSessionCache();
                    return syncDailyStreak(null);
                })
                .catch(() => {});
        }
    });
}

setTimeout(() => {
    if (!_authInitialCheckDone) {
        _authInitialCheckDone = true;
        if (document.body) {
            document.body.classList.remove('auth-loading');
            document.body.classList.add('auth-ready');
        }
    }
}, 3000);

window.yaziyoAuth = { checkAuth, getSupabaseClient };
