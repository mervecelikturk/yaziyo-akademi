/**
 * Şifre sıfırlama sayfası — PKCE verifier her iki depoda da aranır (aynı cihaz, farklı sekme).
 * Yeni oturum sessionStorage'a yazılır.
 */
export const recoveryAuthStorage = {
    getItem(key) {
        return localStorage.getItem(key) ?? sessionStorage.getItem(key);
    },
    setItem(key, value) {
        sessionStorage.setItem(key, value);
    },
    removeItem(key) {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    },
};
