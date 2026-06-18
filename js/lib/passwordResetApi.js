/**
 * YAZİYO - Şifre sıfırlama audit (Supabase RPC)
 */

export async function logPasswordResetComplete(client) {
    if (!client) return null;

    try {
        const { data, error } = await client.rpc('log_password_reset_complete', {
            p_user_agent: typeof navigator !== 'undefined'
                ? (navigator.userAgent || '').slice(0, 500)
                : null,
        });
        if (error) {
            console.warn('Şifre sıfırlama audit kaydı yazılamadı:', error.message);
            return null;
        }
        return data;
    } catch (err) {
        console.warn('Şifre sıfırlama audit hatası:', err);
        return null;
    }
}
