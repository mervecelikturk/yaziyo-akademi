/**
 * YAZİYO — Erken oturum durumu (senkron, head'de yüklenir)
 * Misafir: sayfa anında, navbar'a dokunulmaz.
 * Giriş yapılmış: auth butonu doğru metne geçene kadar gizlenir (flash yok).
 */
(function (global) {
    'use strict';

    var REMEMBER_KEY = 'yaziyo-remember-me';
    var AUTH_KEY = 'yaziyo-verified-auth-user';

    function activeStore() {
        try {
            return global.localStorage.getItem(REMEMBER_KEY) === 'true'
                ? global.localStorage
                : global.sessionStorage;
        } catch (_) {
            return null;
        }
    }

    function isEmailConfirmed(user) {
        if (!user) return false;
        if (user.email_confirmed_at || user.confirmed_at) return true;
        var provider = user.app_metadata && user.app_metadata.provider;
        return provider === 'google' || provider === 'github';
    }

    function getCachedUser() {
        var store = activeStore();
        if (!store) return null;
        try {
            var raw = store.getItem(AUTH_KEY);
            if (!raw) return null;
            var user = JSON.parse(raw);
            if (!user || !user.id || !user.email || !isEmailConfirmed(user)) return null;
            return user;
        } catch (_) {
            return null;
        }
    }

    function isInPagesDir() {
        var path = (global.location.pathname || '').replace(/\\/g, '/');
        return /\/pages\/[^/]+\/?/.test(path);
    }

    function pageHrefProfil() {
        if (global.YaziyoPaths && global.YaziyoPaths.pageHref) {
            return global.YaziyoPaths.pageHref('profil.html');
        }
        return isInPagesDir() ? '../profil/' : 'pages/profil/';
    }

    function pageHrefGiris() {
        if (global.YaziyoPaths && global.YaziyoPaths.pageHref) {
            return global.YaziyoPaths.pageHref('girisKayit.html');
        }
        return isInPagesDir() ? '../giris-kayit/' : 'pages/giris-kayit/';
    }

    var docEl = global.document.documentElement;
    var path = (global.location.pathname || '').replace(/\\/g, '/');
    var isProfilePage = /\/pages\/profil\/?$/i.test(path);
    var isAdminPage = /\/pages\/admin/i.test(path);
    var cachedUser = getCachedUser();

    var criticalStyle = global.document.createElement('style');
    criticalStyle.id = 'yaziyo-auth-critical';
    criticalStyle.textContent = [
        '.yaziyo-auth-state--member{display:none!important}',
        'html.is-logged-in .yaziyo-auth-state--guest{display:none!important}',
        'html.is-logged-in .yaziyo-auth-state--member{display:inline-flex!important;align-items:center;gap:.3rem}',
        'html.is-logged-in #auth-button:not([data-yaziyo-auth-ready="1"]),',
        'html.is-logged-in #auth-nav-btn:not([data-yaziyo-auth-ready="1"]){visibility:hidden!important;pointer-events:none!important}',
        isProfilePage ? 'html:not(.is-logged-in) #profile-main-content{display:none!important}' : '',
        isProfilePage ? 'html:not(.is-logged-in) #auth-gate{display:block!important}' : '',
        isProfilePage ? 'html.is-logged-in #auth-gate{display:none!important}' : '',
        isProfilePage ? 'html.is-logged-in #profile-main-content{display:grid!important}' : '',
    ].filter(Boolean).join('');
    global.document.head.appendChild(criticalStyle);

    if (isAdminPage) {
        docEl.classList.add('auth-nav-hydrated');
        global.YaziyoAuthBoot = { getCachedUser: getCachedUser };
        return;
    }

    if (cachedUser) {
        docEl.classList.add('is-logged-in', 'profile-auth-ready');
    } else {
        docEl.classList.remove('is-logged-in', 'profile-auth-ready');
        docEl.classList.add('auth-nav-hydrated');
    }

    function ensureDualStateMarkup(btn) {
        if (btn.querySelector('.yaziyo-auth-state--guest')) return;

        var guestHref = btn.getAttribute('href') || pageHrefGiris();
        var guestHtml = btn.innerHTML;
        var baseClass = btn.className;

        btn.classList.add('yaziyo-auth-btn');
        btn.innerHTML =
            '<span class="yaziyo-auth-state yaziyo-auth-state--guest">' + guestHtml + '</span>' +
            '<span class="yaziyo-auth-state yaziyo-auth-state--member">' +
            '<i class="fa-solid fa-user yaziyo-auth-btn-icon" aria-hidden="true"></i>' +
            '<span class="yaziyo-auth-btn-text">Profilim</span></span>';
        btn.setAttribute('data-yaziyo-auth-guest-href', guestHref);
    }

    function applyMemberButton(btn) {
        ensureDualStateMarkup(btn);
        btn.href = pageHrefProfil();
        btn.setAttribute('aria-label', 'Profilim');
        btn.setAttribute('data-yaziyo-auth-mode', 'member');
        btn.setAttribute('data-yaziyo-auth-ready', '1');
    }

    function applyGuestButton(btn) {
        if (btn.getAttribute('data-yaziyo-auth-ready') === '1') return;
        var girisHref = pageHrefGiris();
        if (btn.getAttribute('href') !== girisHref) {
            btn.href = girisHref;
        }
        btn.setAttribute('aria-label', 'Giriş yap veya kayıt ol');
        btn.setAttribute('data-yaziyo-auth-mode', 'guest');
        btn.setAttribute('data-yaziyo-auth-ready', '1');
    }

    function prepareAuthButtons(forcedUser) {
        var user = forcedUser !== undefined ? forcedUser : getCachedUser();
        var buttons = global.document.querySelectorAll('#auth-button, #auth-nav-btn');
        if (!buttons.length) return false;

        buttons.forEach(function (btn) {
            if (user) {
                applyMemberButton(btn);
            } else {
                applyGuestButton(btn);
            }
        });

        if (user) {
            docEl.classList.add('is-logged-in', 'profile-auth-ready', 'auth-nav-hydrated');
        } else {
            docEl.classList.remove('is-logged-in', 'profile-auth-ready');
            docEl.classList.add('auth-nav-hydrated');
        }
        return true;
    }

    function schedulePrepare() {
        if (prepareAuthButtons(cachedUser)) return;

        var observer = new MutationObserver(function () {
            if (prepareAuthButtons(cachedUser)) observer.disconnect();
        });
        observer.observe(global.document.documentElement, { childList: true, subtree: true });

        global.document.addEventListener('DOMContentLoaded', function () {
            prepareAuthButtons(cachedUser);
            observer.disconnect();
        }, { once: true });
    }

    if (cachedUser) {
        schedulePrepare();
    } else {
        global.document.addEventListener('DOMContentLoaded', function () {
            prepareAuthButtons(null);
        }, { once: true });
    }

    global.YaziyoAuthBoot = {
        getCachedUser: getCachedUser,
        prepareAuthButtons: prepareAuthButtons,
        pageHrefProfil: pageHrefProfil,
        pageHrefGiris: pageHrefGiris,
    };
})(window);
