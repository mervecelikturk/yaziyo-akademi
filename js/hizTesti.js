
        document.addEventListener('DOMContentLoaded', () => {

            /* ============================================ */
            /* === METİN KELİME LİSTESİ BURAYA YAZILACAK === */
            /* ============================================ */

            // Rastgele metin kelime listesi
            // Kelimeler tekrarlanmayacak şekilde, bir kelime yazıldıktan sonra en az 10 kelime sonra tekrar edilebilir.
            const rastgeleKelimeListesi = [
                "bir", "ve", "bu", "için", "o", "ben", "demek", "çok", "yapmak", "ne",
                "gibi", "daha", "almak", "var", "kendi", "gelmek", "ile", "vermek", "ama",
                "sonra", "kadar", "yer", "en", "insan", "değil", "her", "istemek", "yıl",
                "çıkmak", "görmek", "gün", "biz", "gitmek", "iş", "şey", "ara", "ki",
                "bilmek", "el", "zaman", "ya", "olmak", "tüm", "yeni", "büyük", "küçük",
                "iyi", "kötü", "ilk", "son", "uzun", "kısa", "güzel", "çirkin", "açık",
                "kapalı", "sıcak", "soğuk", "hızlı", "yavaş", "kolay", "zor", "doğru",
                "yanlış", "tam", "yarım", "az", "çok", "fazla", "azıcık", "hiç", "herkes",
                "kimse", "başka", "aynı", "farklı", "eski", "yeni", "arkadaş", "aile",
                "ev", "okul", "iş", "şehir", "köy", "ülke", "dünya", "su", "ekmek",
                "yemek", "içmek", "gitmek", "gelmek", "durmak", "koşmak", "yürümek",
                "oturmak", "kalkmak", "uyumak", "uyanmak", "gülmek", "ağlamak", "konuşmak",
                "söylemek", "dinlemek", "anlamak", "düşünmek", "bilmek", "unutmak",
                "hatırlamak", "sevmek", "nefret", "mutlu", "üzgün", "korku", "cesur",
                "zayıf", "güçlü", "hasta", "sağlık", "para", "zaman", "hayat", "ölüm",
                "doğum", "çocuk", "genç", "yaşlı", "erkek", "kadın", "anne", "baba",
                "kardeş", "arkadaş", "öğretmen", "doktor", "polis", "asker", "yol",
                "araba", "ev", "oda", "kapı", "pencere", "masa", "sandalye", "kitap",
                "kalem", "defter", "telefon", "bilgisayar", "internet", "film", "müzik",
                "şarkı", "dans", "spor", "top", "futbol", "basketbol", "yüzme", "koşu",
                "dağ", "deniz", "nehir", "göl", "orman", "ağaç", "çiçek", "kuş", "kedi",
                "köpek", "at", "inek", "koyun", "tavuk", "meyve", "elma", "armut",
                "muz", "portakal", "sebze", "domates", "salatalık", "soğan", "ekmek",
                "süt", "yumurta", "et", "balık", "tatlı", "çikolata", "kahve", "çay",
                "su", "hava", "güneş", "yağmur", "kar", "rüzgar", "bulut", "gök",
                "yıldız", "ay", "sabah", "öğle", "akşam", "gece", "yarın", "bugün",
                "dün", "hafta", "ay", "yıl", "sene", "saat", "dakika", "saniye",
                "renk", "kırmızı", "mavi", "yeşil", "sarı", "beyaz", "siyah", "büyük",
                "küçük", "uzun", "kısa", "yüksek", "alçak", "sıcak", "soğuk", "acı",
                "tatlı", "tuzlu", "ekşi", "güzel", "çirkin", "temiz", "kirli", "yeni",
                "eski", "hızlı", "yavaş", "kolay", "zor", "doğru", "yanlış", "iyi",
                "kötü", "mutlu", "üzgün", "korkmuş", "cesur", "zengin", "fakir",
                "sağlıklı", "hasta", "aç", "tok", "uygun", "yanlış", "gerçek", "yalan",
                "arkadaş", "düşman", "sevgi", "aşk", "nefret", "barış", "savaş",
                "özgürlük", "hak", "adalet", "eşitlik", "kardeşlik", "yardım", "destek",
                "güven", "güvenlik", "tehlike", "sorun", "çözüm", "fikir", "düşünce",
                "plan", "proje", "iş", "çalışma", "dinlenme", "tatil", "seyahat",
                "ülke", "şehir", "köy", "ev", "oda", "mutfak", "banyo", "yatak",
                "masa", "sandalye", "kitap", "defter", "kalem", "kağıt", "telefon",
                "bilgisayar", "televizyon", "müzik", "film", "oyun", "spor", "futbol",
                "basketbol", "yüzme", "koşu", "yürüyüş", "dağcılık", "yemek", "içmek",
                "uyumak", "konuşmak", "gülmek", "ağlamak", "sevmek", "kızmak", "üzülmek"
            ];

            // Hukuk terimleri kelime listesi
            const hukukKelimeListesi = [
                "temyiz", "istinaf", "kovuşturma", "soruşturma", "mütalaa", "iddianame", "beraat",
                "mahkumiyet", "hapis", "adli", "para", "cezası", "erteleme", "denetimli", "serbestlik",
                "şartla", "tahliye", "infaz", "tutukluluk", "gözaltı", "yakalama", "arama", "elkoyma",
                "müsadere", "zoralım", "tazminat", "nafaka", "velayet", "vesayet", "kayyum", "vasi",
                "miras", "tereke", "intikal", "tescil", "tapu", "kadastro", "imar", "ruhsat",
                "izin", "lisans", "patent", "marka", "telif", "fikri", "mülkiyet", "sınai", "haklar",
                "sözleşme", "akit", "mukavele", "protokol", "anlaşma", "mutabakat", "uzlaşma", "arabuluculuk",
                "tahkim", "hakem", "bilirkişi", "keşif", "tanık", "beyan", "ifade", "sorgu", "sorgulama",
                "çapraz", "sorgu", "yüzleştirme", "teşhis", "delil", "ispat", "karine", "varsayım",
                "yorum", "kıyas", "içtihat", "emsal", "teamül", "örf", "adet", "gelenek", "görenek",
                "mevzuat", "kodifikasyon", "kanunlaştırma", "yasama", "yürütme", "yargı", "erkler",
                "ayrılığı", "denge", "denetim", "anayasal", "yargı", "denetimi", "iptal", "itiraz",
                "bireysel", "başvuru", "temel", "haklar", "özgürlükler", "eşitlik", "adalet", "hukuk",
                "devleti", "sosyal", "laik", "demokratik", "cumhuriyet", "egemenlik", "bağımsızlık",
                "ülke", "bütünlüğü", "milli", "güvenlik", "kamu", "düzeni", "genel", "ahlak",
                "sağlık", "çevre", "tüketici", "koruma", "rekabet", "tekel", "kartel", "birleşme",
                "devralma", "tasfiye", "iflas", "konkordato", "yeniden", "yapılandırma", "alacak",
                "borç", "temerrüt", "gecikme", "faiz", "munzam", "zarar", "kusur", "ihmal",
                "kast", "taksir", "meşru", "müdafaa", "zaruret", "hali", "mücbir", "sebep",
                "illiyet", "bağı", "nedensellik", "hukuka", "aykırılık", "haksız", "fiil", "sebepsiz",
                "zenginleşme", "vekaletsiz", "iş", "görme", "suçluluk", "savsaklama", "yükümlülük",
                "yargılama", "yeterlik", "muhakeme", "kanıt", "tanıklık", "karar",
                "cümle", "başvuru", "bozma", "savcılık", "tahkikat", "iddianame",
                "aklanma", "mahkumiyet", "denetim", "şartlı", "gözaltı", "muhafaza", "müzekkere",
                "celp", "çağrı", "şikâyet", "dilekçe", "talep", "özet", "muhtıra",
                "görüş", "hüküm", "kararname", "ihtiyati", "tedbir", "emir", "yaptırım",
                "tutuklama", "salıverme", "hakkaniyet", "yargılanma", "savunma", "müdafaa", "değişiklik",
                "tüzük", "yönetmelik", "genelge", "içtüzük", "antlaşma", "sözleşme", "tutanak"
            ];

            // Türkçede ilk 500 kelime listesi
            const ilk500KelimeListesi = [
                "plan", "bile", "başlamak", "yaptın", "bize", "söylemek", "gece", "şunları", "bunlar", "aile",
                "hemen", "yanlış", "onlar", "giriş", "geliyor", "kolay", "yaptı", "girmek", "zaten", "araba",
                "veri", "şurada", "insan", "internet", "bunları", "ayar", "bu", "yol", "çocuk", "yükleme",
                "konuşmak", "hata", "benzer", "cevaplamak", "ev", "artık", "orada", "kullanıcı", "ile", "mi",
                "bizden", "açmak", "buradan", "aslında", "biz", "problem", "mü", "site", "senden", "durmak",
                "bizde", "beklemek", "kapalı", "yapabilir", "olabilir", "gün", "siz", "yapıyor", "buton", "öğretmek",
                "küçük", "yapmak", "gerekiyor", "proje", "uzun", "öğrenci", "olmak", "geldim", "istemek", "çünkü",
                "eski", "onlarda", "sandalye", "birisi", "çalışmak", "düşünmek", "tasarım", "öğretmen", "şehir", "size",
                "sizde", "yüksek", "şunlar", "okumak", "bakmak", "şu", "hatta", "onların", "de", "şifre",
                "sizin", "bizim", "anlatmak", "bağlantı", "gelmeli", "benim", "kahve", "ekran", "kimse", "bunu",
                "sormak", "oda", "kullanmak", "rağmen", "sonra", "yazılım", "çirkin", "ve", "defter", "kitap",
                "için", "yemek", "kötü", "ben", "hesap", "onu", "geldi", "dolayı", "aynı", "edecek",
                "geliştirmek", "arkadaş", "gibi", "daha", "bende", "ekmek", "olacak", "ise", "o", "kalmak",
                "uygulama", "senin", "edebilmek", "fazla", "yapacak", "gelmek", "istiyorum", "oluyor", "ki", "platform",
                "geliyorsun", "telefon", "kalem", "hızlı", "burada", "şimdi", "muhtemelen", "masa", "yavaş", "yaptım",
                "kod", "bulmak", "kadar", "yapıyorum", "göre", "kesinlikle", "kadın", "bilgisayar", "önce", "gerekli",
                "güzel", "mesaj", "sende", "erkek", "aramak", "onları", "neden", "öğrenmek", "sistem", "önemli",
                "sevmek", "geldin", "para", "benden", "çözüm", "mı", "ondan", "doğru", "herkes", "mümkün",
                "onun", "kayıt", "yaşamak", "net", "etmek", "kapatmak", "kaybetmek", "kazanmak", "az", "okul",
                "oldu", "geliyorum", "ama", "bilmek", "henüz", "dinlemek", "şunu", "görmek", "açık", "gerçekten",
                "kendi", "ona", "ancak", "büyük", "koymak", "yeni", "düşük", "anlamak", "biri", "çıkmak",
                "ayrıca", "fikir", "iş", "onda", "kim", "gitmek", "lazım", "bitmek", "zor", "denemek",
                "bildirim", "taşımak", "ya", "da", "yapabilmek", "veya", "fakat", "hissetmek", "onlardan", "beri",
                "gitmeli", "inanmak", "pencere", "bana", "şuradan", "sizden", "sen", "yapıyorsun", "oradan", "indirme",
                "kısa", "sunucu", "almak", "kapı", "hayat", "sana", "farklı", "onlara", "yalnız", "iyi",
                "nerede", "zaman", "su", "nasıl", "ne", "belki", "mu", "yazmak", "çay", "ülke", "dünya", "vermek"
            ];

            // === METİN KELİME LİSTESİ BURAYA YAZILACAK ===
            // const kelimeListesi = ["kelime1", "kelime2", ...];
            // Kelimeler tekrarlanmayacak şekilde, bir kelime yazıldıktan sonra en az 10 kelime sonra tekrar edilebilir.
            // Yukarıdaki rastgeleKelimeListesi ve hukukKelimeListesi kullanılmaktadır.
            // İleride Supabase entegrasyonu ile kelime listeleri veritabanından çekilebilir.


            /* ============================================ */
            /* DOM ELEMENT REFERANSLARI                    */
            /* ============================================ */
            const settingsSection = document.getElementById('settings-section');
            const testSection = document.getElementById('test-section');
            const startBtn = document.getElementById('start-btn');
            const finishBtn = document.getElementById('finish-btn');
            const durationSelect = document.getElementById('duration-select');
            const textTypeSelect = document.getElementById('text-type-select');
            const comboSelect = document.getElementById('combo-select');
            const textDisplay = document.getElementById('text-display');
            const userInput = document.getElementById('user-input');
            const timerDisplay = document.getElementById('timer-display');
            const progressBar = document.getElementById('progress-bar');
            const liveWpm = document.getElementById('live-wpm');
            const liveAccuracy = document.getElementById('live-accuracy');
            const liveWpmMobile = document.getElementById('live-wpm-mobile');
            const liveAccuracyMobile = document.getElementById('live-accuracy-mobile');
            const comboContainer = document.getElementById('combo-container');

            // Sonuç Modal DOM elemanları
            const resultModal = document.getElementById('result-modal');
            const closeModalBtn = document.getElementById('close-modal-btn');
            const saveResultBtn = document.getElementById('save-result-btn');
            const restartBtn = document.getElementById('restart-btn');
            const saveToast = document.getElementById('save-toast');


            /* ============================================ */
            /* TEST DURUM DEĞİŞKENLERİ                    */
            /* ============================================ */
            let testActive = false;          // Test şu anda aktif mi
            let testStarted = false;         // İlk tuşa basıldı mı (zamanlayıcı başladı mı)
            let totalDuration = 60;          // Toplam süre (saniye)
            let remainingTime = 60;          // Kalan süre (saniye)
            let timerInterval = null;        // Zamanlayıcı interval ID

            let fullText = '';               // Oluşturulan tam metin
            let charIndex = 0;              // Şu anda yazılması gereken karakter indeksi
            let correctKeys = 0;            // Doğru basılan tuş sayısı
            let wrongKeys = 0;             // Yanlış basılan tuş sayısı
            let totalKeysPressed = 0;      // Toplam basılan tuş sayısı

            let words = [];                 // Metin kelimeleri dizisi
            let currentWordIndex = 0;       // Şu anda yazılan kelimenin indeksi
            let wordStartIndex = 0;         // Mevcut kelimenin metindeki başlangıç indeksi
            let completedWords = [];        // Tamamlanan kelimeler [{word, typed, correct}]
            let mistakes = [];              // Yanlış yazılan kelimeler [{wrong, correct}]

            let testStartTime = null;       // Test başlangıç zamanı (Date)

            // === KOMBO SİSTEMİ DEĞİŞKENLERİ ===
            let comboCount = 0;             // Peş peşe doğru kelime sayısı
            let maxCombo = 0;               // Test boyunca ulaşılan en yüksek kombo
            let isComboEnabled = true;      // Kombo sistemi aktif mi
            let pendingSaveWords = 0;       // Kaydedilecek kelime sayısı (test sonucu)
            let pendingSaveCombo = 0;       // Kaydedilecek max kombo
            let pendingSaveWpm = 0;         // Kaydedilecek WPM
            let pendingSaveAccuracy = 0;    // Kaydedilecek doğruluk (%)
            let pendingSaveSure = 0;        // Kaydedilecek süre (saniye)
            let pendingSaveDogruKelime = 0; // Kaydedilecek doğru kelime sayısı
            let pendingSaveYanlisKelime = 0;// Kaydedilecek yanlış kelime sayısı
            let resultSaved = false;        // Bu test sonucu zaten kaydedildi mi


            /* ============================================ */
            /* METİN OLUŞTURMA FONKSİYONLARI               */
            /* ============================================ */

            /**
             * Kelime listesinden tekrarsız (en az 10 kelime aralıkla) metin oluşturur
             * @param {string[]} wordList - Kaynak kelime listesi
             * @param {number} wordCount - Oluşturulacak kelime sayısı
             * @returns {string[]} Oluşturulan kelime dizisi
             */
            function generateWords(wordList, wordCount) {
                const result = [];
                const recentWords = []; // Son 10 kelimeyi takip et

                for (let i = 0; i < wordCount; i++) {
                    let word;
                    let attempts = 0;
                    const maxAttempts = 100;

                    do {
                        word = wordList[Math.floor(Math.random() * wordList.length)];
                        attempts++;
                    } while (recentWords.includes(word) && attempts < maxAttempts);

                    result.push(word);
                    recentWords.push(word);

                    // Son 10 kelimeyi tut, eskilerini çıkar
                    if (recentWords.length > 10) {
                        recentWords.shift();
                    }
                }

                return result;
            }

            /**
             * Seçilen metin türüne ve süreye göre metin oluşturur
             */
            function generateText() {
                const textType = textTypeSelect.value;
                let wordList;
                if (textType === 'hukuk') {
                    wordList = hukukKelimeListesi;
                } else if (textType === 'ilk-500') {
                    wordList = ilk500KelimeListesi;
                } else {
                    wordList = rastgeleKelimeListesi;
                }

                // Dakika başına yaklaşık 60-80 kelime varsayarak yeterli kelime oluştur
                // (süre dakika × 80 kelime + fazladan buffer)
                const minutes = totalDuration / 60;
                const wordCount = Math.ceil(minutes * 100); // Bol yedek kelime

                words = generateWords(wordList, wordCount);
                fullText = words.join(' '); // İmlasız, küçük harflerle (zaten öyle)
            }


            /* ============================================ */
            /* METİN RENDER FONKSİYONLARI                  */
            /* ============================================ */

            /**
             * Metni karakter karakter DOM'a render eder
             */
            function renderText() {
                textDisplay.innerHTML = '';
                const inner = document.createElement('div');
                inner.id = 'text-display-inner';

                for (let i = 0; i < fullText.length; i++) {
                    const charSpan = document.createElement('span');
                    charSpan.classList.add('char');
                    charSpan.textContent = fullText[i];
                    charSpan.setAttribute('data-index', i);

                    if (i === 0) {
                        charSpan.classList.add('current');
                    } else {
                        charSpan.classList.add('pending');
                    }

                    inner.appendChild(charSpan);
                }

                textDisplay.appendChild(inner);
                window.YaziyoTypingScroll?.resetTypingPanels({
                    referenceEl: inner,
                    userInputEl: userInput,
                    referenceMoveMode: 'transform',
                });
            }

            function scrollTextDisplay() {
                const inner = document.getElementById('text-display-inner');
                const scrollLib = window.YaziyoTypingScroll;
                if (!scrollLib || !fullText || !inner) return;

                const typedLen = wordStartIndex + (userInput.value?.length || 0);
                scrollLib.syncTypingPanels({
                    referenceEl: inner,
                    referenceContainer: textDisplay,
                    referenceFullText: fullText,
                    userInputEl: userInput,
                    typedLen,
                    referenceMoveMode: 'transform',
                });
            }


            /* ============================================ */
            /* ZAMANLAYICI FONKSİYONLARI                   */
            /* ============================================ */

            /**
             * Süreyi MM:SS formatında gösterir
             * @param {number} seconds - Saniye cinsinden süre
             * @returns {string} Formatlanmış süre
             */
            function formatTime(seconds) {
                const mins = Math.floor(seconds / 60);
                const secs = seconds % 60;
                return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            }

            /**
             * Zamanlayıcıyı başlatır
             */
            function startTimer() {
                testStartTime = new Date();
                timerInterval = setInterval(() => {
                    remainingTime--;

                    // Süre göstergesini güncelle
                    timerDisplay.textContent = formatTime(remainingTime);

                    // İlerleme çubuğunu güncelle
                    const progress = (remainingTime / totalDuration) * 100;
                    progressBar.style.width = `${progress}%`;

                    // Son 10 saniyede uyarı efekti
                    if (remainingTime <= 10) {
                        timerDisplay.classList.add('timer-warning');
                    } else {
                        timerDisplay.classList.remove('timer-warning');
                    }

                    // Anlık istatistikleri güncelle
                    updateLiveStats();

                    // Süre bitti
                    if (remainingTime <= 0) {
                        endTest();
                    }
                }, 1000);
            }

            /**
             * Anlık WPM ve doğruluk değerlerini günceller
             */
            function updateLiveStats() {
                if (!testStartTime) return;

                const elapsed = (new Date() - testStartTime) / 1000 / 60; // dakika
                if (elapsed <= 0) return;

                // Standart WPM: (toplam doğru karakter / 5) / dakika
                const wpm = elapsed > 0 ? Math.round((correctKeys / 5) / elapsed) : 0;

                // Doğruluk oranı
                const accuracy = totalKeysPressed > 0 ? Math.round((correctKeys / totalKeysPressed) * 100) : 100;

                // Desktop
                liveWpm.textContent = wpm;
                liveAccuracy.textContent = `${accuracy}%`;

                // Mobil
                liveWpmMobile.textContent = wpm;
                liveAccuracyMobile.textContent = `${accuracy}%`;

                // Renk kodlaması
                const wpmColor = wpm >= 40 ? 'text-yaziyo-green' : wpm >= 20 ? 'text-yellow-400' : 'text-red-400';
                const accColor = accuracy >= 90 ? 'text-yaziyo-green' : accuracy >= 70 ? 'text-yellow-400' : 'text-red-400';

                [liveWpm, liveWpmMobile].forEach(el => {
                    el.className = `font-poppins font-bold text-lg ${wpmColor}`;
                });
                [liveAccuracy, liveAccuracyMobile].forEach(el => {
                    el.className = `font-poppins font-bold text-lg ${accColor}`;
                });
            }


            /* ============================================ */
            /* TEST KONTROL FONKSİYONLARI                  */
            /* ============================================ */

            /**
             * Testi başlatır: ayarları kilitler, metni oluşturur, test alanını gösterir
             */
            function initTest() {
                // Süreyi al
                totalDuration = parseInt(durationSelect.value, 10);
                remainingTime = totalDuration;

                // Metni oluştur ve render et
                generateText();
                renderText();

                // Durum değişkenlerini sıfırla
                testActive = true;
                testStarted = false;
                charIndex = 0;
                correctKeys = 0;
                wrongKeys = 0;
                totalKeysPressed = 0;
                currentWordIndex = 0;
                wordStartIndex = 0;
                completedWords = [];
                mistakes = [];
                testStartTime = null;

                // UI güncelle
                timerDisplay.textContent = formatTime(remainingTime);
                timerDisplay.classList.remove('timer-warning');
                progressBar.style.width = '100%';
                liveWpm.textContent = '0';
                liveAccuracy.textContent = '100%';
                liveWpmMobile.textContent = '0';
                liveAccuracyMobile.textContent = '100%';

                // Dropdown'dan kombo durumunu al
                isComboEnabled = comboSelect.value === 'on';
                comboCount = 0;
                maxCombo = 0;
                resultSaved = false;
                pendingSaveWords = 0;
                pendingSaveCombo = 0;

                // Dropdown'ları pasif yap
                durationSelect.disabled = true;
                textTypeSelect.disabled = true;
                comboSelect.disabled = true;

                // Alanları göster/gizle
                settingsSection.classList.add('hidden');
                testSection.classList.remove('hidden');

                // Input'a odaklan
                userInput.value = '';
                userInput.focus();
            }

            /**
             * Testi sonlandırır ve sonuç ekranını açar
             */
            function endTest() {
                testActive = false;
                testStarted = false;

                // Zamanlayıcıyı durdur
                if (timerInterval) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                }

                // Mevcut yazılmakta olan kelimeyi tamamlanmış say
                finishCurrentWord();

                // Input'u pasif yap
                userInput.disabled = true;

                // Sonuçları hesapla ve göster
                showResults();
            }

            /**
             * Mevcut kelimeyi tamamlanmış olarak işaretler
             */
            function finishCurrentWord() {
                if (currentWordIndex < words.length && charIndex > wordStartIndex) {
                    const expectedWord = words[currentWordIndex];
                    const typedPart = fullText.substring(wordStartIndex, charIndex);
                    // Sadece kelime kısmını al (boşluk hariç)
                    const typedWord = typedPart.trim();

                    if (typedWord.length > 0) {
                        const isCorrect = typedWord === expectedWord;
                        completedWords.push({
                            word: expectedWord,
                            typed: typedWord,
                            correct: isCorrect
                        });

                        if (!isCorrect) {
                            mistakes.push({
                                wrong: typedWord,
                                correct: expectedWord
                            });
                        }
                    }
                }
            }

            /**
             * Testi sıfırlayıp ayar ekranına döner
             */
            function resetTest() {
                // Zamanlayıcıyı temizle
                if (timerInterval) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                }

                testActive = false;
                testStarted = false;
                comboCount = 0;
                maxCombo = 0;
                resultSaved = false;
                pendingSaveWords = 0;
                pendingSaveCombo = 0;
                resetSaveButtonUI();

                // Input'u aktif yap
                userInput.disabled = false;
                userInput.value = '';

                // Dropdown'ları aktif yap
                durationSelect.disabled = false;
                textTypeSelect.disabled = false;
                comboSelect.disabled = false;

                // Alanları göster/gizle
                testSection.classList.add('hidden');
                settingsSection.classList.remove('hidden');

                // Modalı kapat
                resultModal.classList.add('hidden');
            }


            /* ============================================ */
            /* KULLANICI GİRDİ İŞLEME                     */
            /* ============================================ */

            /**
             * Kullanıcı her tuşa bastığında çağrılır
             */
            userInput.addEventListener('keydown', (e) => {
                if (!testActive) return;

                if (e.code === 'Space' || e.code === 'Enter') {
                    e.preventDefault(); 
                    
                    if (!testStarted) {
                        testStarted = true;
                        startTimer();
                    }

                    const inputValue = userInput.value;
                    completeWord(inputValue);
                }
            });

            userInput.addEventListener('input', (e) => {
                if (!testActive) return;
                if (!testStarted) {
                    testStarted = true;
                    startTimer();
                }
                const inputValue = userInput.value;
                processInput(inputValue);
            });

            /**
             * Kullanıcı girişini işler, karakter karakter kontrol eder
             * @param {string} inputValue - Input alanındaki mevcut değer
             */
            function processInput(inputValue) {
                const chars = textDisplay.querySelectorAll('.char');

                // Mevcut kelimenin başlangıcından itibaren kontrol et
                const currentFullWord = getCurrentExpectedSegment();
                const inputLen = inputValue.length;

                // Tüm karakterlerin durumunu güncelle
                for (let i = 0; i < chars.length; i++) {
                    chars[i].classList.remove('correct', 'incorrect', 'current', 'pending');

                    if (i < wordStartIndex) {
                        // Önceden tamamlanmış kelimeler - zaten işlendi
                        // Durumlarını koru (önceden correct veya incorrect olarak işaretlendi)
                        if (chars[i].dataset.status === 'correct') {
                            chars[i].classList.add('correct');
                        } else if (chars[i].dataset.status === 'incorrect') {
                            chars[i].classList.add('incorrect');
                        } else {
                            chars[i].classList.add('correct'); // varsayılan
                        }
                    } else if (i < wordStartIndex + inputLen) {
                        // Kullanıcının yazdığı kısım
                        const typedChar = inputValue[i - wordStartIndex];
                        const expectedChar = fullText[i];

                        if (typedChar === expectedChar) {
                            chars[i].classList.add('correct');
                        } else {
                            chars[i].classList.add('incorrect');
                        }
                    } else if (i === wordStartIndex + inputLen) {
                        // Şu anda yazılması gereken karakter
                        chars[i].classList.add('current');
                    } else {
                        // Henüz yazılmamış
                        chars[i].classList.add('pending');
                    }
                }

                // Scroll kontrolü
                scrollTextDisplay();

                // Boşluk tuşuna basıldığında kelime tamamlanmış demektir
                if (inputValue.endsWith(' ') && inputValue.trim().length > 0) {
                    completeWord(inputValue);
                }
            }

            /**
             * Mevcut beklenen segmenti (kelime + boşluk) döndürür
             * @returns {string}
             */
            function getCurrentExpectedSegment() {
                if (currentWordIndex >= words.length) return '';
                const word = words[currentWordIndex];
                // Sonraki kelime varsa boşluk da ekle
                return currentWordIndex < words.length - 1 ? word + ' ' : word;
            }

            /**
             * Kelime tamamlandığında çağrılır
             * @param {string} inputValue - Input'taki değer (sondaki boşluk dahil)
             */
            function completeWord(inputValue) {
                const typedWord = inputValue.trim();
                const expectedWord = words[currentWordIndex];

                let isSkipped = false;
                if (typedWord === "") {
                    isSkipped = true;
                }

                if (!isSkipped) {
                    for (let i = 0; i < typedWord.length; i++) {
                        totalKeysPressed++;
                        if (i < expectedWord.length && typedWord[i] === expectedWord[i]) {
                            correctKeys++;
                        } else {
                            wrongKeys++;
                        }
                    }
                    if (typedWord.length < expectedWord.length) {
                        const missing = expectedWord.length - typedWord.length;
                        wrongKeys += missing;
                        totalKeysPressed += missing;
                    }
                    totalKeysPressed++;
                    correctKeys++;
                }

                const isCorrect = typedWord === expectedWord;
                completedWords.push({
                    word: expectedWord,
                    typed: typedWord,
                    correct: isCorrect
                });

                if (!isCorrect) {
                    mistakes.push({
                        wrong: typedWord,
                        correct: expectedWord
                    });
                }

                // Karakter durumlarını kalıcı olarak işaretle
                const chars = textDisplay.querySelectorAll('.char');
                for (let i = wordStartIndex; i < wordStartIndex + expectedWord.length + 1 && i < chars.length; i++) {
                    if (i < wordStartIndex + Math.min(typedWord.length, expectedWord.length)) {
                        const typedIdx = i - wordStartIndex;
                        if (typedWord[typedIdx] === expectedWord[typedIdx]) {
                            chars[i].dataset.status = 'correct';
                        } else {
                            chars[i].dataset.status = 'incorrect';
                        }
                    } else if (i === wordStartIndex + expectedWord.length) {
                        chars[i].dataset.status = 'correct';
                    } else {
                        chars[i].dataset.status = 'incorrect';
                    }
                }

                // Sonraki kelimeye geç
                currentWordIndex++;
                wordStartIndex += expectedWord.length + 1;

                // === KOMBO SİSTEMİ MANTIĞI ===
                if (isComboEnabled) {
                    if (isCorrect) {
                        // Doğru kelimede kombo artır
                        comboCount++;
                        maxCombo = Math.max(maxCombo, comboCount);
                        // x2'den itibaren animasyon göster
                        if (comboCount >= 2) {
                            showComboEffect(comboCount);
                        }
                    } else {
                        // Yanlış kelimede kombo sıfırla ve efekt göster
                        if (comboCount >= 2) {
                            showComboBroken();
                        }
                        comboCount = 0;
                    }
                }

                // Input'u temizle
                userInput.value = '';

                // Render güncelle
                processInput('');

                // Tüm kelimeler bittiyse testi bitir
                if (currentWordIndex >= words.length) {
                    endTest();
                }
            }


            /* ============================================ */
            /* KOMBO GÖRSEL EFEKTLERİ                       */
            /* ============================================ */

            /**
             * Yeni kombo seviyesine ulaşıldığında ekranda animasyon gösterir
             * @param {number} count - Mevcut kombo sayısı
             */
            function showComboEffect(count) {
                if (!comboContainer) return;

                // Yeni bir damga oluştur
                const stamp = document.createElement('div');
                stamp.className = 'combo-stamp animate-combo-pop';
                stamp.innerHTML = `x${count}`;
                
                // Rastgele hafif açı değişikliği
                const randomRotate = (Math.random() * 20 - 10); // -10 ile +10 arası
                stamp.style.transform = `rotate(${randomRotate}deg)`;

                // Konteynera ekle
                comboContainer.appendChild(stamp);

                // Animasyon bitince temizle
                setTimeout(() => {
                    if (stamp.parentNode === comboContainer) {
                        comboContainer.removeChild(stamp);
                    }
                }, 1200);
            }

            /**
             * Kombo sıfırlandığında görsel geri bildirim gösterir
             */
            function showComboBroken() {
                if (!comboContainer) return;

                const broken = document.createElement('div');
                broken.className = 'combo-stamp combo-broken animate-combo-broken';
                broken.innerHTML = 'KOMBO';
                
                comboContainer.appendChild(broken);

                setTimeout(() => {
                    if (broken.parentNode === comboContainer) {
                        comboContainer.removeChild(broken);
                    }
                }, 800);
            }


            /* ============================================ */
            /* SONUÇ HESAPLAMA VE GÖSTERME                 */
            /* ============================================ */

            /**
             * Test sonuçlarını hesaplar ve modal'da gösterir
             */
            function showResults() {
                // Geçen süre: testStartTime'dan ms hassasiyetiyle
                const elapsedMs = testStartTime ? (new Date() - testStartTime) : 0;
                const elapsedSeconds = Math.max(1, Math.round(elapsedMs / 1000));
                const elapsedMinutes = elapsedSeconds / 60;

                // Kelime istatistikleri
                const totalWords = completedWords.length;
                const correctWordsCount = completedWords.filter(w => w.correct).length;
                const wrongWordsCount = completedWords.filter(w => !w.correct).length;

                // Ana WPM: doğru kelime sayısı / geçen dakika
                const mainWpm = elapsedMinutes > 0 ? Math.round(correctWordsCount / elapsedMinutes) : 0;

                // Hata oranı
                const errorRate = totalKeysPressed > 0 ? ((wrongKeys / totalKeysPressed) * 100).toFixed(1) : 0;

                // Doğruluk yüzdesi
                const accuracy = totalKeysPressed > 0 ? ((correctKeys / totalKeysPressed) * 100).toFixed(1) : 100;

                // Sonuç modal değerlerini güncelle
                document.getElementById('result-wpm').textContent = mainWpm;
                document.getElementById('result-real-wpm').textContent = mainWpm;

                const comboCard = document.getElementById('result-combo-card');
                const maxComboEl = document.getElementById('result-max-combo');
                if (comboCard && maxComboEl) {
                    if (isComboEnabled) {
                        comboCard.classList.remove('hidden');
                        maxComboEl.textContent = maxCombo;
                    } else {
                        comboCard.classList.add('hidden');
                    }
                }
                document.getElementById('result-time').textContent = formatTime(elapsedSeconds);
                document.getElementById('result-error-rate').textContent = errorRate + '%';
                document.getElementById('result-accuracy').textContent = accuracy + '%';
                document.getElementById('result-correct-keys').textContent = correctKeys.toLocaleString('tr-TR');
                document.getElementById('result-wrong-keys').textContent = wrongKeys.toLocaleString('tr-TR');
                document.getElementById('result-total-keys').textContent = totalKeysPressed.toLocaleString('tr-TR');
                document.getElementById('result-correct-words').textContent = correctWordsCount;
                document.getElementById('result-wrong-words').textContent = wrongWordsCount;
                document.getElementById('result-total-words').textContent = totalWords;

                // Yanlış kelimeler listesi
                const mistakesSection = document.getElementById('mistakes-section');
                const mistakesList = document.getElementById('mistakes-list');
                mistakesList.innerHTML = '';

                if (mistakes.length > 0) {
                    mistakesSection.classList.remove('hidden');
                    mistakes.forEach(m => {
                        const item = document.createElement('div');
                        item.classList.add('mistake-item');
                        const wrong = document.createElement('span');
                        wrong.className = 'mistake-wrong';
                        wrong.textContent = m.wrong;
                        const arrow = document.createElement('i');
                        arrow.className = 'fa-solid fa-arrow-right text-yaziyo-text-secondary text-xs';
                        const correct = document.createElement('span');
                        correct.className = 'mistake-correct';
                        correct.textContent = m.correct;
                        item.appendChild(wrong);
                        item.appendChild(arrow);
                        item.appendChild(correct);
                        mistakesList.appendChild(item);
                    });
                } else {
                    mistakesSection.classList.add('hidden');
                }

                pendingSaveWords = totalWords;
                pendingSaveCombo = isComboEnabled ? maxCombo : 0;
                pendingSaveWpm = mainWpm;
                pendingSaveAccuracy = parseFloat(accuracy) || 0;
                pendingSaveSure = elapsedSeconds;
                pendingSaveDogruKelime = correctWordsCount;
                pendingSaveYanlisKelime = wrongWordsCount;
                resultSaved = false;
                updateSaveButtonState();

                // Modalı göster
                resultModal.classList.remove('hidden');

                checkUserGoalsAfterTest(correctWordsCount);
            }

            async function checkUserGoalsAfterTest(correctWordsCount) {
                if (!window.yaziyoSupabase) return;
                const sureDakika = Math.round(totalDuration / 60);
                try {
                    const { checkGoalCompletion } = await import('./userGoals.js');
                    const { onGoalsCompleted } = await import('./notifications.js');
                    const completed = await checkGoalCompletion(
                        window.yaziyoSupabase,
                        'hiz',
                        sureDakika,
                        correctWordsCount
                    );
                    if (completed.length > 0) {
                        await onGoalsCompleted(window.yaziyoSupabase, completed);
                    }
                } catch (err) {
                    console.warn('Hedef kontrolü atlandı:', err);
                }
            }

            function resetSaveButtonUI() {
                if (!saveResultBtn) return;
                const label = saveResultBtn.querySelector('span');
                saveResultBtn.disabled = true;
                if (label) label.textContent = 'Sonucu Kaydet';
                saveResultBtn.classList.remove('!bg-green-600/20', '!border-green-500/40');
            }

            async function updateSaveButtonState() {
                if (!saveResultBtn) return;

                if (resultSaved) {
                    saveResultBtn.disabled = true;
                    saveResultBtn.innerHTML = '<i class="fa-solid fa-check"></i><span>Kaydedildi</span>';
                    saveResultBtn.classList.add('!bg-green-600/20', '!border-green-500/40');
                    return;
                }

                const { isUserLoggedIn } = await import('./userStats.js');
                const loggedIn = await isUserLoggedIn(window.yaziyoSupabase);

                saveResultBtn.disabled = !loggedIn;
                const labelText = loggedIn ? 'Sonucu Kaydet' : 'Giriş Yapın (Kaydet)';
                saveResultBtn.innerHTML = `<i class="fa-solid fa-bookmark"></i><span>${labelText}</span>`;
            }

            function showSaveToast(message, isError = false) {
                const toastText = document.getElementById('save-toast-text');
                const toastIcon = saveToast?.querySelector('i');
                if (toastText) toastText.textContent = message;
                if (toastIcon) {
                    toastIcon.className = isError
                        ? 'fa-solid fa-circle-exclamation text-red-400'
                        : 'fa-solid fa-circle-check text-yaziyo-green';
                }
                saveToast.classList.remove('hidden');
                requestAnimationFrame(() => {
                    saveToast.classList.remove('translate-y-4', 'opacity-0');
                    saveToast.classList.add('translate-y-0', 'opacity-100');
                });
                setTimeout(() => {
                    saveToast.classList.remove('translate-y-0', 'opacity-100');
                    saveToast.classList.add('translate-y-4', 'opacity-0');
                    setTimeout(() => saveToast.classList.add('hidden'), 500);
                }, 3000);
            }

            /**
             * HTML özel karakterlerini escape eder
             */
            function escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }

            /* OLAY DİNLEYİCİLERİ                         */
            /* ============================================ */

            // Teste Başla butonu
            startBtn.addEventListener('click', () => {
                initTest();
            });

            // Bitir butonu
            finishBtn.addEventListener('click', () => {
                if (testActive) {
                    endTest();
                }
            });

            // Modal kapat butonu
            closeModalBtn.addEventListener('click', () => {
                resetTest();
            });

            // Overlay tıklama ile modal kapat
            document.getElementById('modal-overlay').addEventListener('click', () => {
                resetTest();
            });

            // Yeni Test butonu
            restartBtn.addEventListener('click', () => {
                resetTest();
            });

            saveResultBtn.addEventListener('click', async () => {
                if (resultSaved || saveResultBtn.disabled) return;

                const originalHtml = saveResultBtn.innerHTML;
                saveResultBtn.disabled = true;
                saveResultBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Kaydediliyor...</span>';

                try {
                    const { saveHizTestiSonucu, isUserLoggedIn } = await import('./userStats.js');

                    if (!await isUserLoggedIn(window.yaziyoSupabase)) {
                        throw new Error('Sonucu kaydetmek için giriş yapmalısınız');
                    }

                    await saveHizTestiSonucu(
                        window.yaziyoSupabase,
                        pendingSaveWords,
                        pendingSaveCombo,
                        {
                            wpm: pendingSaveWpm,
                            dogruluk: pendingSaveAccuracy,
                            sureSaniye: pendingSaveSure,
                            dogruKelime: pendingSaveDogruKelime,
                            yanlisKelime: pendingSaveYanlisKelime,
                        }
                    );

                    resultSaved = true;
                    showSaveToast('Sonuç profilinize kaydedildi');
                    updateSaveButtonState();

                    if (typeof window.refreshHizSiralama === 'function') {
                        window.refreshHizSiralama();
                    }
                } catch (err) {
                    console.error('Sonuç kaydetme hatası:', err);
                    showSaveToast(err.message || 'Kayıt başarısız oldu', true);
                    saveResultBtn.disabled = false;
                    saveResultBtn.innerHTML = originalHtml;
                }
            });

            // Escape tuşu ile testi bitirme
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && testActive) {
                    endTest();
                }
            });

            // Sayfa yüklendiğinde süre göstergesini ayarla
            timerDisplay.textContent = formatTime(parseInt(durationSelect.value, 10));

            // Dropdown değiştiğinde süre göstergesini güncelle
            durationSelect.addEventListener('change', () => {
                timerDisplay.textContent = formatTime(parseInt(durationSelect.value, 10));
            });

        });
    