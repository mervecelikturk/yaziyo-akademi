/**
 * YAZİYO - Profil hesap silme talebi → admin mesajlar
 */
import { supabase } from './lib/supabase.js';

const HESAP_SIL_PREFIX = '[HESAP SİLME TALEBİ]';

function parseUserName(fullName) {
    const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
    return {
        ad: parts[0] || 'Kullanıcı',
        soyad: parts.length > 1 ? parts.slice(1).join(' ') : '-',
    };
}

function showDeleteSuccess() {
    const initialView = document.getElementById('delete-modal-initial-view');
    const successView = document.getElementById('delete-modal-success-view');
    if (initialView) {
        initialView.classList.remove('flex');
        initialView.classList.add('hidden');
    }
    if (successView) {
        successView.classList.remove('hidden');
        successView.classList.add('flex');
    }
}

function setSubmitLoading(loading) {
    const btn = document.getElementById('delete-submit-btn');
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
        btn.dataset.prevText = btn.textContent;
        btn.textContent = 'Gönderiliyor...';
    } else {
        btn.textContent = btn.dataset.prevText || 'Mesajı Gönder';
    }
}

export async function submitDeleteRequest() {
    const input = document.getElementById('delete-reason-input');
    const reason = (input?.value || '').trim();

    if (!reason) {
        input?.classList.add('border-red-500');
        setTimeout(() => input?.classList.remove('border-red-500'), 1500);
        return;
    }

    const client = supabase || window.yaziyoSupabase;
    if (!client) {
        alert('Sistem bağlantısı kurulamadı. Lütfen sayfayı yenileyin.');
        return;
    }

    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) {
        alert('Hesap silme talebi göndermek için giriş yapmalısınız.');
        return;
    }

    const user = session.user;
    const { ad, soyad } = parseUserName(user.user_metadata?.site_full_name || user.user_metadata?.full_name);
    const eposta = user.email || '';
    const mesaj = `${HESAP_SIL_PREFIX}\n\n${reason}`;

    setSubmitLoading(true);

    const { error } = await client.from('iletisim_mesajlari').insert({
        ad,
        soyad,
        eposta,
        mesaj,
    });

    setSubmitLoading(false);

    if (error) {
        console.error('Hesap silme talebi kaydedilemedi:', error);
        alert('Talebiniz gönderilemedi. Lütfen daha sonra tekrar deneyin.');
        return;
    }

    showDeleteSuccess();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('delete-account-backdrop')?.addEventListener('click', () => {
        if (typeof window.closeDeleteAccountModal === 'function') {
            window.closeDeleteAccountModal();
        }
    });
});

window.submitDeleteRequest = submitDeleteRequest;
