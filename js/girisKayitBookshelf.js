/**
 * Giriş / Kayıt — sol panel kitaplık görselleri (5 sn aralık)
 */
(function () {
    const slides = document.querySelectorAll('#auth-bookshelf-slider .auth-bookshelf-slide');
    if (slides.length < 2) return;

    const INTERVAL_MS = 5000;
    let current = 0;
    let timer = null;

    function showSlide(index) {
        slides.forEach((slide, i) => {
            const active = i === index;
            slide.classList.toggle('opacity-0', !active);
            slide.classList.toggle('auth-bookshelf-slide--active', active);
        });
        current = index;
    }

    function nextSlide() {
        showSlide((current + 1) % slides.length);
    }

    function start() {
        stop();
        timer = setInterval(nextSlide, INTERVAL_MS);
    }

    function stop() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    showSlide(0);
    start();

    const panel = document.getElementById('auth-bookshelf-panel');
    if (panel) {
        panel.addEventListener('mouseenter', stop);
        panel.addEventListener('mouseleave', start);
    }
})();
