/**
 * Ana sayfa — dekoratif çizginin altında rastgele Atatürk sözü
 */
(function () {
    const ATATURK_QUOTES = [
        'Adalet gücü bağımsız olmayan bir milletin, devlet halinde varlığı kabul olunamaz.',
        'Kadınlarımız için asıl mücadele alanı, eğitim ve öğretimdir.',
        'Hukuk düzeni, devletin temelidir.',
        'Türk kadını, dünyanın en aydın, en faziletli ve en ağır başlı kadını olmak zorundadır.',
        'En hakiki mürşit ilimdir, fendir.',
        'Türkiye Cumhuriyeti şeyhler, dervişler, müritler, mensuplar memleketi olamaz.',
        'Vazifeye atılmak için, içinde bulunacağın vaziyetin imkân ve şeraitini düşünmeyeceksin.',
        'Dünyada her şey kadının eseridir.',
        'Eğitimdir ki bir milleti ya özgür, bağımsız, şanlı, yüksek bir toplum halinde yaşatır; ya da esaret ve sefalete terk eder.',
        'Laiklik yalnız din ve dünya işlerinin ayrılması değildir; bütün yurttaşların vicdan, ibadet ve din özgürlüğü demektir.',
        'Ey Türk gençliği! Birinci vazifen, Türk istiklâlini, Türk Cumhuriyetini, ilelebet muhafaza ve müdafaa etmektir.',
    ];

    const el = document.getElementById('hero-ataturk-quote-text');
    if (!el || !ATATURK_QUOTES.length) return;

    const idx = Math.floor(Math.random() * ATATURK_QUOTES.length);
    el.textContent = `\u201C${ATATURK_QUOTES[idx]}\u201D`;
})();
