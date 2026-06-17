/**
 * YAZİYO - İletişim formu (Supabase)
 */
import { supabase } from './lib/supabase.js';

document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contact-form');
    const submitBtn = document.getElementById('submit-btn');
    if (!contactForm || !submitBtn) return;

    const btnText = submitBtn.querySelector('.btn-text');
    const successIcon = submitBtn.querySelector('.success-icon');

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!supabase) {
            alert('Mesaj gönderilemedi. Lütfen sayfayı yenileyip tekrar deneyin.');
            return;
        }

        const formData = new FormData(contactForm);
        const ad = (formData.get('firstname') || '').toString().trim();
        const soyad = (formData.get('lastname') || '').toString().trim();
        const eposta = (formData.get('email') || '').toString().trim();
        const mesaj = (formData.get('message') || '').toString().trim();

        submitBtn.style.pointerEvents = 'none';
        if (btnText) btnText.textContent = 'GÖNDERİLİYOR...';

        const { error } = await supabase.from('iletisim_mesajlari').insert({
            ad,
            soyad,
            eposta,
            mesaj,
        });

        if (error) {
            console.error('İletişim mesajı kaydedilemedi:', error);
            if (btnText) btnText.textContent = 'MESAJ GÖNDER';
            submitBtn.style.pointerEvents = 'auto';
            alert('Mesajınız gönderilemedi. Lütfen daha sonra tekrar deneyin.');
            return;
        }

        if (btnText) btnText.style.opacity = '0';
        successIcon?.classList.remove('hidden');

        setTimeout(() => {
            contactForm.reset();
            successIcon?.classList.add('hidden');
            if (btnText) {
                btnText.style.opacity = '1';
                btnText.textContent = 'MESAJ GÖNDER';
            }
            submitBtn.style.pointerEvents = 'auto';
        }, 3000);
    });
});
