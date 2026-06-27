(function () {
    function goToOyun(track) {
        window.location.href = '../ders-oyunu/?track=' + encodeURIComponent(track);
    }

    document.querySelectorAll('[data-ders-track]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const track = btn.getAttribute('data-ders-track');
            if (track) goToOyun(track);
        });
    });
})();
