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

    // Bildirim modalı: js/notifications.js + auth.js (tüm sayfalar)
});
