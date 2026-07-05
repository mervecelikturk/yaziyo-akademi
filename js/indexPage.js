/* ============================================ */
/* YAZİYO - Ana Sayfa (index.html) JS          */
/* Sayaç, hero slider, bildirim modalı         */
/* ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    /* ============================================ */
    /* İSTATİSTİK SAYAÇ ANİMASYONU                */
    /* Üç kart aynı anda başlar ve aynı anda biter */
    /* ============================================ */

    const STAT_ANIMATION_DURATION = 1500;
    let statsAnimationStarted = false;
    let statsSectionVisible = false;

    const REQUIRED_STATS = [
        { readyKey: 'metinSayisiReady', readyEvent: 'yaziyo:metin-sayisi-ready' },
        { readyKey: 'adaySayisiReady', readyEvent: 'yaziyo:aday-sayisi-ready' },
        { readyKey: 'mulakatSoruSayisiReady', readyEvent: 'yaziyo:mulakat-soru-sayisi-ready' },
    ];

    function areAllStatsReady() {
        return REQUIRED_STATS.every(
            (stat) => document.documentElement.dataset[stat.readyKey] === '1',
        );
    }

    function animateCounter(element, target, duration, startTime) {
        function updateCount(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentValue = Math.floor(easeOut * target);

            element.textContent = '+' + currentValue.toLocaleString('tr-TR');

            if (progress < 1) {
                requestAnimationFrame(updateCount);
            } else {
                element.textContent = '+' + target.toLocaleString('tr-TR');
            }
        }

        requestAnimationFrame(updateCount);
    }

    function startAllStatAnimations() {
        if (statsAnimationStarted || !statsSectionVisible || !areAllStatsReady()) return;

        statsAnimationStarted = true;
        const startTime = performance.now();

        document.querySelectorAll('.stat-card .stat-number').forEach((numberEl) => {
            const target = parseInt(numberEl.getAttribute('data-target'), 10) || 0;
            numberEl.closest('.stat-card')?.classList.add('animated');
            animateCounter(numberEl, target, STAT_ANIMATION_DURATION, startTime);
        });
    }

    function tryStartStatsAnimations() {
        startAllStatAnimations();
    }

    function markStatsSectionVisible() {
        statsSectionVisible = true;
        tryStartStatsAnimations();
    }

    REQUIRED_STATS.forEach(({ readyEvent, readyKey }) => {
        document.addEventListener(readyEvent, tryStartStatsAnimations);
        if (document.documentElement.dataset[readyKey] === '1') {
            tryStartStatsAnimations();
        }
    });

    const statsSection = document.getElementById('stats-section');
    if (statsSection) {
        const statsSectionObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    markStatsSectionVisible();
                    statsSectionObserver.disconnect();
                }
            });
        }, {
            threshold: 0.12,
            rootMargin: '0px',
        });

        statsSectionObserver.observe(statsSection);

        requestAnimationFrame(() => {
            const rect = statsSection.getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.bottom > 0) {
                markStatsSectionVisible();
            }
        });
    }

    /* ============================================ */
    /* HERO SLIDER (Otomatik Görsel Geçişi)        */
    /* ============================================ */
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.slider-dot');
    let currentSlide = 0;
    let sliderInterval = null;
    const SLIDE_DURATION = 3000;

    function goToSlide(index) {
        slides[currentSlide].style.opacity = '0';
        dots[currentSlide].classList.remove('active');

        currentSlide = index;
        slides[currentSlide].style.opacity = '1';
        dots[currentSlide].classList.add('active');
    }

    function nextSlide() {
        const next = (currentSlide + 1) % slides.length;
        goToSlide(next);
    }

    function startSlider() {
        sliderInterval = setInterval(nextSlide, SLIDE_DURATION);
    }

    function stopSlider() {
        if (sliderInterval) {
            clearInterval(sliderInterval);
            sliderInterval = null;
        }
    }

    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            const slideIndex = parseInt(dot.getAttribute('data-slide'), 10);
            stopSlider();
            goToSlide(slideIndex);
            startSlider();
        });
    });

    if (slides.length > 0) {
        startSlider();
    }

    /* ============================================ */
    /* BİLDİRİM MODALI                             */
    /* ============================================ */
    const notificationBtn = document.getElementById('notification-btn');
    const notificationModal = document.getElementById('notification-modal');
    const notificationBackdrop = document.getElementById('notification-backdrop');
    const notificationContent = document.getElementById('notification-content');
    const notificationClose = document.getElementById('notification-close');

    async function openNotificationModal() {
        if (!notificationModal) return;

        const isLoggedIn = document.documentElement.classList.contains('is-logged-in');

        let emptyMsg = document.getElementById('notification-empty-msg');
        let footerMsg = document.getElementById('notification-footer-msg');

        if (!emptyMsg && notificationContent) {
            const existingP = notificationContent.querySelector('p:not([id])');
            if (existingP) {
                existingP.id = 'notification-empty-msg';
                emptyMsg = existingP;
            }
        }

        if (!footerMsg && notificationContent) {
            const allP = notificationContent.querySelectorAll('p');
            allP.forEach((p) => {
                if (!p.id && (p.textContent.includes('yakında') || p.textContent.includes('aktif olacak'))) {
                    p.id = 'notification-footer-msg';
                    footerMsg = p;
                }
            });
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
                    const girisHref = (window.YaziyoPaths?.pageHref('girisKayit.html')) || 'pages/giris-kayit/';
                    footerMsg.innerHTML =
                        '<a href="' + girisHref + '" class="inline-flex items-center gap-1 text-yaziyo-gold hover:underline transition-all font-semibold">' +
                        '<i class="fa-solid fa-right-to-bracket"></i> Giriş yap / Kayıt ol' +
                        '</a>';
                }
            }
        }

        notificationModal.classList.remove('hidden');
        notificationModal.classList.add('flex');

        requestAnimationFrame(() => {
            notificationBackdrop.classList.remove('opacity-0');
            notificationContent.classList.remove('scale-95', 'opacity-0');
            notificationContent.classList.add('scale-100', 'opacity-100');
        });
    }

    function closeNotificationModal() {
        if (!notificationModal) return;
        notificationBackdrop.classList.add('opacity-0');
        notificationContent.classList.remove('scale-100', 'opacity-100');
        notificationContent.classList.add('scale-95', 'opacity-0');

        setTimeout(() => {
            notificationModal.classList.remove('flex');
            notificationModal.classList.add('hidden');
        }, 300);
    }

    if (notificationBtn) {
        notificationBtn.addEventListener('click', openNotificationModal);
    }
    if (notificationBackdrop) {
        notificationBackdrop.addEventListener('click', closeNotificationModal);
    }
    if (notificationClose) {
        notificationClose.addEventListener('click', closeNotificationModal);
    }
});
