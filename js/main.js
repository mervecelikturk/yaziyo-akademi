/* ============================================ */
/* YAZİYO - Ana JavaScript Dosyası              */
/* Zabıt Katipliği Çalışma Platformu            */
/* ============================================ */



document.addEventListener('DOMContentLoaded', () => {

    if (window.YaziyoAdminNavbar) {
        window.YaziyoAdminNavbar.mount();
    }

    if (window.YaziyoSiteNavbar) {
        window.YaziyoSiteNavbar.mount();
    }

    /* ============================================ */
    /* MOBİL HAMBURGER MENÜ KONTROLÜ               */
    /* ============================================ */
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const hamburgerIcon = document.getElementById('hamburger-icon');
    const mobileMenu = document.getElementById('mobile-menu');

    if (hamburgerBtn && mobileMenu) {
        hamburgerBtn.addEventListener('click', () => {
            // Menü açma/kapama toggle
            const isOpen = mobileMenu.classList.contains('open');

            if (isOpen) {
                // Menüyü kapat
                mobileMenu.classList.remove('open');
                mobileMenu.classList.add('hidden');
                hamburgerIcon.classList.remove('fa-xmark');
                hamburgerIcon.classList.add('fa-bars');
            } else {
                // Menüyü aç
                mobileMenu.classList.remove('hidden');
                // Bir sonraki frame'de open sınıfını ekle (CSS animasyonu için)
                requestAnimationFrame(() => {
                    mobileMenu.classList.add('open');
                });
                hamburgerIcon.classList.remove('fa-bars');
                hamburgerIcon.classList.add('fa-xmark');
            }
        });

        // Mobil menü dışına tıklanınca kapat
        document.addEventListener('click', (e) => {
            if (!hamburgerBtn.contains(e.target) && !mobileMenu.contains(e.target)) {
                mobileMenu.classList.remove('open');
                setTimeout(() => {
                    mobileMenu.classList.add('hidden');
                }, 300);
                hamburgerIcon.classList.remove('fa-xmark');
                hamburgerIcon.classList.add('fa-bars');
            }
        });
    }

    /* ============================================ */
    /* MOBİL DROPDOWN ACCORDION KONTROLÜ           */
    /* ============================================ */
    document.querySelectorAll('.mobile-dropdown-trigger').forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = trigger.nextElementSibling;
            const isOpen = menu.classList.contains('open');

            // Diğer açık dropdown'ları kapat
            document.querySelectorAll('.mobile-dropdown-menu.open').forEach(m => {
                m.classList.remove('open');
                m.previousElementSibling.classList.remove('open');
            });

            // Bu dropdown'u toggle et
            if (!isOpen) {
                menu.classList.add('open');
                trigger.classList.add('open');
            }
        });
    });

    /* ============================================ */
    /* GECE/GÜNDÜZ MODU KONTROLÜ                   */
    /* localStorage ile mod kaydediliyor            */
    /* ============================================ */
    const themeToggleBtn = document.getElementById('theme-toggle-btn');

    /**
     * GECE/GÜNDÜZ MODU (DARK/LIGHT MODE) GEÇİŞ FONKSİYONU
     * - 'dark' class'ını html üzerinden toggle (aç/kapat) yapar.
     * - Tailwind darkMode: 'class' mantığına tam uyar (dark varsa gece, yoksa gündüz).
     * - Seçimi localStorage üzerinde kalıcı saklar.
     */
    function toggleTheme() {
        // Geçiş esnasında renklerin yumuşak akması için animasyon class'ını ekliyoruz
        document.documentElement.classList.add('theme-transition');

        // Toggle: 'dark' sınıfı varsa çıkarır, yoksa ekler.
        const isDark = document.documentElement.classList.toggle('dark');

        // Yeni duruma göre localStorage'ı güncelliyoruz (dark veya light)
        localStorage.setItem('yaziyo-theme', isDark ? 'dark' : 'light');

        // Animasyon bittikten sonra performans için transition class'ını siliyoruz
        setTimeout(() => {
            document.documentElement.classList.remove('theme-transition');
        }, 350);
    }
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // Açık olan diğer sekmelerde tema değişimini anında yakalayan sistem
    window.addEventListener('storage', (event) => {
        if (event.key === 'yaziyo-theme') {
            document.documentElement.classList.add('theme-transition');
            if (event.newValue === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            setTimeout(() => {
                document.documentElement.classList.remove('theme-transition');
            }, 350);
        }
    });

    /* ============================================ */
    /* İSTATİSTİK SAYAÇ ANİMASYONU                */
    /* ============================================ */
    const statNumbers = document.querySelectorAll('.stat-number');

    /**
     * Sayıyı animasyonlu şekilde artan gösterim ile sayar
     * @param {HTMLElement} element - Hedef DOM elementi
     * @param {number} target - Hedef sayı değeri
     * @param {number} duration - Animasyon süresi (ms)
     */
    function animateCounter(element, target, duration = 1500) {
        const startTime = performance.now();

        function updateCount(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease-out cubic fonksiyonu (yavaşlayarak biten animasyon)
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentValue = Math.floor(easeOut * target);

            // Sayıyı formatla (+ işareti başta olacak şekilde)
            element.textContent = '+' + currentValue.toLocaleString('tr-TR');

            if (progress < 1) {
                requestAnimationFrame(updateCount);
            } else {
                // Tam hedefe ulaştığında kesin değeri set et
                element.textContent = '+' + target.toLocaleString('tr-TR');
            }
        }

        requestAnimationFrame(updateCount);
    }

    /* ============================================ */
    /* INTERSECTION OBSERVER (Görünüme Girme)      */
    /* ============================================ */

    const ASYNC_STAT_CARDS = {
        'aday-sayisi-gosterge': {
            readyKey: 'adaySayisiReady',
            readyEvent: 'yaziyo:aday-sayisi-ready',
        },
        'mulakat-soru-sayisi-gosterge': {
            readyKey: 'mulakatSoruSayisiReady',
            readyEvent: 'yaziyo:mulakat-soru-sayisi-ready',
        },
    };

    function triggerStatAnimation(card) {
        const numberEl = card.querySelector('.stat-number');
        if (!numberEl || card.classList.contains('animated')) return;

        const run = () => {
            if (card.classList.contains('animated')) return;
            card.classList.add('animated');
            const target = parseInt(numberEl.getAttribute('data-target'), 10) || 0;
            animateCounter(numberEl, target);
        };

        const asyncStat = ASYNC_STAT_CARDS[numberEl.id];
        if (asyncStat && document.documentElement.dataset[asyncStat.readyKey] !== '1') {
            document.addEventListener(asyncStat.readyEvent, run, { once: true });
            return;
        }

        run();
    }

    // İstatistik kartlarını izle - görünüme girince sayaç başlat
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                triggerStatAnimation(entry.target);
            }
        });
    }, {
        threshold: 0.3,
        rootMargin: '0px 0px -50px 0px'
    });

    // Her istatistik kartını gözlemciye kaydet
    document.querySelectorAll('.stat-card').forEach(card => {
        statsObserver.observe(card);
    });

    /* ============================================ */
    /* HEADER SCROLL ETKİSİ                        */
    /* ============================================ */
    const header = document.getElementById('main-header');
    let lastScrollY = 0;

    if (header) {
        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;

            if (currentScrollY > 50) {
                header.classList.add('shadow-lg', 'shadow-black/20');
            } else {
                header.classList.remove('shadow-lg', 'shadow-black/20');
            }

            lastScrollY = currentScrollY;
        }, { passive: true });
    }

    /* ============================================ */
    /* HERO SLIDER (Otomatik Görsel Geçişi)        */
    /* ============================================ */
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.slider-dot');
    let currentSlide = 0;
    let sliderInterval = null;
    const SLIDE_DURATION = 3000; // 3 saniye

    /**
     * Belirtilen index'teki slayta geçiş yapar
     * @param {number} index - Hedef slayt index'i
     */
    function goToSlide(index) {
        // Önceki slaytı gizle
        slides[currentSlide].style.opacity = '0';
        dots[currentSlide].classList.remove('active');

        // Yeni slaytı göster
        currentSlide = index;
        slides[currentSlide].style.opacity = '1';
        dots[currentSlide].classList.add('active');
    }

    /** Bir sonraki slayta ilerle */
    function nextSlide() {
        const next = (currentSlide + 1) % slides.length;
        goToSlide(next);
    }

    /** Otomatik slider'ı başlat */
    function startSlider() {
        sliderInterval = setInterval(nextSlide, SLIDE_DURATION);
    }

    /** Otomatik slider'ı durdur */
    function stopSlider() {
        if (sliderInterval) {
            clearInterval(sliderInterval);
            sliderInterval = null;
        }
    }

    // Dot butonlarına tıklama olayları
    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            const slideIndex = parseInt(dot.getAttribute('data-slide'), 10);
            stopSlider();
            goToSlide(slideIndex);
            startSlider(); // Tıklamadan sonra otomatik geçişi yeniden başlat
        });
    });

    // Slider'ı başlat
    if (slides.length > 0) {
        startSlider();
    }

    /* ============================================ */
    /* BİLDİRİM MODALI GÖSTER/GİZLE                 */
    /* (İleride gerçek bildirim sistemi eklenecek)  */
    /* ============================================ */
    const notificationBtn = document.getElementById('notification-btn');
    const notificationModal = document.getElementById('notification-modal');
    const notificationBackdrop = document.getElementById('notification-backdrop');
    const notificationContent = document.getElementById('notification-content');
    const notificationClose = document.getElementById('notification-close');

    /** Bildirim modalını açar */
    async function openNotificationModal() {
        if (!notificationModal) return;

        const isLoggedIn = document.documentElement.classList.contains('is-logged-in');

        // ID yoksa notification-content içinden bul veya oluştur
        let emptyMsg = document.getElementById('notification-empty-msg');
        let footerMsg = document.getElementById('notification-footer-msg');

        if (!emptyMsg && notificationContent) {
            // Mevcut paragrafı al ya da yeni oluştur
            const existingP = notificationContent.querySelector('p:not([id])');
            if (existingP) {
                existingP.id = 'notification-empty-msg';
                emptyMsg = existingP;
            }
        }

        if (!footerMsg && notificationContent) {
            // "yakında aktif olacak" içeren elementi footer msg olarak işaretle
            const allP = notificationContent.querySelectorAll('p');
            allP.forEach((p) => {
                if (!p.id && (p.textContent.includes('yakında') || p.textContent.includes('aktif olacak'))) {
                    p.id = 'notification-footer-msg';
                    footerMsg = p;
                }
            });
            // Hâlâ yoksa yeni ekle
            if (!footerMsg) {
                footerMsg = document.createElement('p');
                footerMsg.id = 'notification-footer-msg';
                footerMsg.className = 'text-xs text-yaziyo-gold font-inter font-medium tracking-wide text-center mt-2';
                const divider = notificationContent.querySelector('.h-px, hr');
                if (divider) divider.after(footerMsg);
                else notificationContent.appendChild(footerMsg);
            }
        }

        if (isLoggedIn && window.yaziyoSupabase && window.YaziyoNotifications) {
            await window.YaziyoNotifications.refreshNotificationsForModal(window.yaziyoSupabase);
        } else {
            const list = document.getElementById('notification-list');
            if (list) list.classList.add('hidden');

            if (emptyMsg) {
                emptyMsg.classList.remove('hidden');
                emptyMsg.textContent = isLoggedIn
                    ? 'Henüz yeni bildiriminiz yok.'
                    : 'Bildirimlerinizi görmek için giriş yapın.';
            }

            if (footerMsg) {
                footerMsg.classList.remove('hidden');
                if (isLoggedIn) {
                    footerMsg.innerHTML = '';
                } else {
                    const girisHref = (window.YaziyoPaths?.pageHref('girisKayit.html')) || 'girisKayit.html';
                    footerMsg.innerHTML =
                        '<a href="' + girisHref + '" class="inline-flex items-center gap-1 text-yaziyo-gold hover:underline transition-all font-semibold">' +
                        '<i class="fa-solid fa-right-to-bracket"></i> Giriş yap / Kayıt ol' +
                        '</a>';
                }
            }
        }

        notificationModal.classList.remove('hidden');
        notificationModal.classList.add('flex');
        
        // CSS Transition'ların yakalanabilmesi için çok ufak bir gecikme
        requestAnimationFrame(() => {
            notificationBackdrop.classList.remove('opacity-0');
            notificationContent.classList.remove('scale-95', 'opacity-0');
            notificationContent.classList.add('scale-100', 'opacity-100');
        });
    }

    /** Bildirim modalını kapatır */
    function closeNotificationModal() {
        if (!notificationModal) return;
        notificationBackdrop.classList.add('opacity-0');
        notificationContent.classList.remove('scale-100', 'opacity-100');
        notificationContent.classList.add('scale-95', 'opacity-0');
        
        // Animasyon bittikten sonra DOM'da gizle
        setTimeout(() => {
            notificationModal.classList.remove('flex');
            notificationModal.classList.add('hidden');
        }, 300);
    }

    // Bildirim Butonuna Tıklandığında Modalı Aç
    if (notificationBtn) {
        notificationBtn.addEventListener('click', openNotificationModal);
    }

    // Modal Dışına (Backdrop) Tıklanınca Modalı Kapat
    if (notificationBackdrop) {
        notificationBackdrop.addEventListener('click', closeNotificationModal);
    }

    // Çarpı (X) Butonuna Tıklanınca Modalı Kapat
    if (notificationClose) {
        notificationClose.addEventListener('click', closeNotificationModal);
    }

    /* ============================================ */
    /* SAYFA AKTİF/PASİF DURUMU (Admin ayarları)   */
    /* ============================================ */
    if (window.YaziyoPageStatus) {
        window.YaziyoPageStatus.applyToNavbar();
    }

});
