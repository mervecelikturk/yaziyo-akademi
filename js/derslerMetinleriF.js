/**
 * F Klavye — 30 ders (çentikli A / K merkezinden dışa)
 *
 *  1–5   Orta sıra
 *  6–10  Üst sıra
 * 11–15  Alt sıra
 * 16–25  Büyük harf, sayı, noktalama
 * 26–30  Pekiştirme metinleri
 *
 * Harf dersleri: 1–3 üç harf / 20 kelime;
 * 4–6 üç-dört harf / 20 kelime;
 * 7–15 üç-beş harf, anlamlı + anlamsız / 20 kelime.
 */
(function (global) {
    const ASAMA = {
        temel: 'Bu aşamada parmak yerini öğrenirsiniz.',
        kelime: 'Bu aşamada kelime üretmeye başlarsınız.',
        cumle: 'Bu aşamada bakmadan yazmaya yaklaşırsınız.',
        pro: 'Bu aşamada gerçek kullanıcı seviyesine çıkarsınız.',
    };

    function w20(words) {
        const list = words.slice(0, 20);
        while (list.length < 20) list.push(words[list.length % words.length]);
        return list.join(' ');
    }

    function lesson(no, title, content, kazanim, asama) {
        return {
            no,
            title: `${no}. Ders — ${title}`,
            content,
            kazanim: `${kazanim} ${asama}`,
        };
    }

    global.YaziyoDerslerF = [

        // =========================================================
        // 1–5  Orta sıra — A K merkez
        // =========================================================

        lesson(1, 'A ve K — Temel Çentik',
            w20(['aka', 'kak', 'aak', 'kaa', 'akk', 'kka', 'aka', 'kak', 'aaa', 'kkk', 'aka', 'kak', 'aak', 'kaa', 'akk', 'kka', 'aka', 'kak', 'aak', 'kaa']),
            'A ve K çentikli tuşları sol ve sağ işaret parmaklarıyla öğrenildi.', ASAMA.temel),

        lesson(2, 'E ve M — Orta Parmaklar',
            w20(['kek', 'kam', 'eke', 'mak', 'kem', 'ame', 'mek', 'eka', 'ema', 'aka', 'kak', 'eek', 'maa', 'ake', 'kea', 'mae', 'eam', 'kma', 'eme', 'eae']),
            'E ve M tuşları orta parmaklarla eklendi; A ve K ile birlikte pekiştirildi.', ASAMA.temel),

        lesson(3, 'İ ve L — Yüzük Parmaklar',
            w20(['kel', 'mal', 'kil', 'mil', 'ilk', 'eli', 'ali', 'ile', 'kal', 'kim', 'lam', 'lik', 'eki', 'lim', 'lek', 'ila', 'kam', 'kek', 'mek', 'ema']),
            'İ ve L tuşları yüzük parmaklarıyla öğrenildi.', ASAMA.temel),

        lesson(4, 'U ve Y — Serçe Parmaklar',
            w20(['kule', 'yaka', 'yele', 'kuyu', 'yum', 'yel', 'kum', 'yale', 'kuma', 'yemi', 'kel', 'mil', 'ilk', 'kal', 'kim', 'mal', 'eki', 'lik', 'kam', 'yule']),
            'U ve Y tuşları serçe parmaklarıyla eklendi.', ASAMA.temel),

        lesson(5, 'T ve Ş — Orta Sıra Tekrarı',
            w20(['kat', 'tak', 'taş', 'kuş', 'şal', 'eşek', 'meşk', 'kuyu', 'yaka', 'kule', 'yel', 'mil', 'kel', 'mal', 'aşk', 'ket', 'met', 'tem', 'şem', 'yum']),
            'T ve Ş ile orta sıra iç tuşlara geçildi; orta sıra genel tekrarı yapıldı.', ASAMA.kelime),

        // =========================================================
        // 6–10  Üst sıra
        // =========================================================

        lesson(6, 'F ve G — Üst Sıra İşaret',
            w20(['kafa', 'gaga', 'gaf', 'gel', 'ege', 'fak', 'gemi', 'gala', 'file', 'liga', 'faki', 'gema', 'gela', 'kufe', 'kaf', 'fig', 'magi', 'kefa', 'gale', 'yaka']),
            'F ve G tuşları işaret parmaklarıyla üst sıraya taşındı.', ASAMA.kelime),

        lesson(7, 'R ve O — Üst Sıra Orta',
            w20(['koro', 'orta', 'okul', 'yol', 'kor', 'mor', 'kara', 'kafa', 'gemi', 'file', 'kule', 'kuyu', 'yaka', 'eşek', 'gala', 'orka', 'romel', 'koray', 'yolak', 'goral']),
            'R ve O tuşları orta parmaklarla öğrenildi.', ASAMA.kelime),

        lesson(8, 'H ve D — Üst Sıra Yüzük',
            w20(['daha', 'halk', 'odak', 'kedi', 'doku', 'hala', 'yol', 'koro', 'okul', 'kafa', 'gemi', 'kule', 'yaka', 'eşek', 'gala', 'hodak', 'deray', 'haluk', 'dokum', 'yahut']),
            'H ve D tuşları yüzük parmaklarıyla eklendi.', ASAMA.kelime),

        lesson(9, 'V ve Z — Üst Sıra Serçe',
            w20(['kova', 'tava', 'vaz', 'kez', 'kaz', 'yol', 'koro', 'daha', 'halk', 'okul', 'kafa', 'gemi', 'kule', 'yaka', 'eşek', 'vezir', 'kazak', 'vokal', 'zayif', 'havuz']),
            'V ve Z tuşları serçe parmaklarıyla öğrenildi.', ASAMA.kelime),

        lesson(10, 'P ve Ğ — Üst Sıra Tekrarı',
            w20(['kapak', 'puma', 'yağa', 'pazar', 'kafa', 'gemi', 'okul', 'yol', 'daha', 'halk', 'kova', 'tava', 'kule', 'yaka', 'eşek', 'eğer', 'oğul', 'kopar', 'pafta', 'kupa']),
            'P ve Ğ ile üst sıra iç tuşlara erişildi; üst sıra genel tekrarı yapıldı.', ASAMA.kelime),

        // =========================================================
        // 11–15  Alt sıra
        // =========================================================

        lesson(11, 'C ve I — Alt Sıra İşaret',
            w20(['acı', 'cam', 'ılık', 'kıl', 'cıvı', 'yol', 'okul', 'kapı', 'daha', 'halk', 'kova', 'kafa', 'gemi', 'kule', 'yaka', 'cival', 'ılıkı', 'cakıl', 'pıhtı', 'yağlı']),
            'C ve I tuşları işaret parmaklarıyla alt sıraya geçildi.', ASAMA.kelime),

        lesson(12, 'Ç ve S — Alt Sıra Orta',
            w20(['çay', 'saç', 'ses', 'kasa', 'açık', 'cam', 'acı', 'ılık', 'yol', 'okul', 'kapı', 'daha', 'halk', 'kova', 'kafa', 'saçak', 'çeşme', 'kasap', 'uçuş', 'seçim']),
            'Ç ve S tuşları orta parmaklarla öğrenildi.', ASAMA.kelime),

        lesson(13, 'N ve B — Alt Sıra Yüzük',
            w20(['ben', 'ban', 'nane', 'bank', 'kani', 'çay', 'kasa', 'ses', 'cam', 'yol', 'okul', 'kapı', 'daha', 'halk', 'kova', 'nacak', 'binek', 'banka', 'çınar', 'sabun']),
            'N ve B tuşları yüzük parmaklarıyla eklendi.', ASAMA.kelime),

        lesson(14, 'J ve Ö — Alt Sıra Serçe',
            w20(['jöle', 'göl', 'öbek', 'jilet', 'körpe', 'gölge', 'ben', 'çay', 'kasa', 'nane', 'yol', 'okul', 'kapı', 'daha', 'halk', 'kova', 'kafa', 'gemi', 'çöz', 'öfke']),
            'J ve Ö tuşları serçe parmaklarıyla öğrenildi.', ASAMA.kelime),

        lesson(15, 'Ü — Karma Harf Tekrarı',
            w20(['gül', 'süt', 'yüz', 'üzüm', 'küme', 'jöle', 'göl', 'ben', 'çay', 'kasa', 'nane', 'yol', 'okul', 'kapı', 'daha', 'gülüş', 'sütün', 'yüzük', 'üzgün', 'küçük']),
            'Ü tuşu eklendi; tüm harflerin karma tekrarı yapıldı.', ASAMA.kelime),

        // =========================================================
        // 16–25  Büyük harf, sayı, noktalama
        // =========================================================

        lesson(16, 'Shift ve Büyük Harf',
            [
                'Ayşe kalemi aldı. Mehmet kapıyı kapadı.',
                'Ankara soğuktu. Elif çay içti.',
                'Konya yolu uzundu. Gül bahçesi açtı.',
                'Zeynep okula gitti. Burak top oynadı.',
            ].join(' '),
            'Shift tuşu ile cümle başı büyük harf alıştırması yapıldı.', ASAMA.cumle),

        lesson(17, 'Nokta ve Virgül',
            [
                'Gel. Dur. Bak. Yaz. Oku.',
                'çay, süt, ekmek, peynir',
                'Kapı açıldı. Ev sessizdi.',
                'elma, armut, üzüm, kiraz',
                'Gün bitti. Işık söndü.',
            ].join(' '),
            'Nokta ve virgül işaretleri kısa ifadeler içinde öğrenildi.', ASAMA.cumle),

        lesson(18, 'İki Nokta ve Noktalı Virgül',
            [
                'Liste: çay, süt, ekmek.',
                'İş bitti; ev sakin.',
                'Üç kural: doğruluk, sabır, emek.',
                'Yol uzundu; hava sıcaktı.',
                'Saat: on. Durak: okul.',
            ].join(' '),
            'İki nokta ve noktalı virgül kullanımı öğrenildi.', ASAMA.cumle),

        lesson(19, 'Soru ve Ünlem',
            [
                'Geldin mi? Neredesin?',
                'Harika! Çok güzel!',
                'Kim geldi? Ne oldu?',
                'Aferin! Bravo!',
                'Hazır mısın? Başlayalım mı?',
                'Tamam! Hadi!',
            ].join(' '),
            'Soru işareti ve ünlem işareti diyalog cümleleriyle öğrenildi.', ASAMA.cumle),

        lesson(20, 'Kesme ve Tırnak',
            [
                'Ankara\'da yağmur vardı.',
                'Öğretmen "Başla" dedi.',
                'Ali\'nin kalemi masada duruyor.',
                '"Günaydın" diye seslendi.',
                'İstanbul\'un yolu uzundu.',
                'Kitabın adı "Yol" idi.',
            ].join(' '),
            'Kesme işareti ve tırnak işareti kullanımına geçildi.', ASAMA.cumle),

        lesson(21, 'Sayılar 1 2 3',
            [
                '1 2 3 1 2 3 2 1 3',
                'sınıfta 3 sıra var',
                '1 ekmek 2 peynir 3 zeytin',
                'kapı 2 kere çaldı',
                'ders 1 saat sürdü',
            ].join(' '),
            '1, 2 ve 3 tuşları yazıldı.', ASAMA.pro),

        lesson(22, 'Sayılar 4 5 6',
            [
                '4 5 6 4 5 6 5 4 6',
                'masada 4 kalem 5 defter var',
                '6 kişi geldi',
                'saat 4 te çıktım 5 te vardım',
                '5 gün 6 gece çalıştık',
            ].join(' '),
            '4, 5 ve 6 tuşları yazıldı.', ASAMA.pro),

        lesson(23, 'Sayılar 7 8 9 0',
            [
                '7 8 9 0 7 8 9 0',
                'sınıfta 30 öğrenci var',
                '8 sıra 9 sandalye',
                'kapı numarası 70',
                'saat 09 da başladık 10 da bitti',
            ].join(' '),
            '7, 8, 9 ve 0 tuşları yazıldı.', ASAMA.pro),

        lesson(24, 'Özel Karakterler',
            [
                '10 + 5 / 3 - 2',
                'telefon (0212) 555 00 11',
                'sonuç: 12 / 4 + 1',
                'adres (okul) kapı 3',
                '- evet + hayır',
            ].join(' '),
            'Eksi, artı, bölü ve parantez karakterleri öğrenildi.', ASAMA.pro),

        lesson(25, 'Sayı, Noktalama ve Büyük Harf',
            [
                'Ayşe 3 ekmek, 2 süt aldı.',
                'Toplantı saat 10:30 da; salon 4.',
                'Sonuç: 15 + 5 = 20 (doğru).',
                'Kim geldi? Ali mi, Mert mi?',
                'Bravo! 9 üzerinden 8 aldın.',
            ].join(' '),
            'Sayı, noktalama ve büyük/küçük harf birlikte pekiştirildi.', ASAMA.pro),

        // =========================================================
        // 26–30  Pekiştirme metinleri
        // =========================================================

        lesson(26, 'Kısa Metin — Günlük Konuşma',
            'sabah erken kalktım yüzümü yıkadım çay demledim ekmek peynir yedim sonra çantamı aldım okula yürüdüm yolda arkadaşımı gördüm birlikte gittik ders bitti eve döndük akşam yemek yedik biraz dinlendik',
            'Günlük konuşma dilinde 30 kelimelik kısa metin yazıldı.', ASAMA.pro),

        lesson(27, 'Kısa Metin — Büyük Harf ve Noktalama',
            'Elif sabah kalktı. Kahvaltı yaptı, çantasını aldı. "Günaydın" dedi. Okula gitti; ders başladı. Öğretmen sordu: Neredesin? Ali geldi. Akşam oldu. Ev sessizdi. Yemek bitti.',
            'Büyük harf ve noktalama ağırlıklı 30 kelimelik metin yazıldı.', ASAMA.pro),

        lesson(28, 'Kısa Metin — Sayı ve Karakter',
            'Sınıfta 32 öğrenci var. Saat 08:30 da ders başladı. Liste: 2 ekmek, 1 süt, 3 elma. Toplam 15 TL. Telefon (0212) 555 10 20. Sonuç 10 + 5 / 3. Kapı no 7.',
            'Sayı ve karakter içeren 30 kelimelik metin yazıldı.', ASAMA.pro),

        lesson(29, 'Uzun Metin — Akıcılık',
            'Her sabah aynı saatte kalkmak, masaya oturmak ve parmakları yuvaya koymak alışkanlık ister. Kısa metinler bile kas hafızasını güçlendirir. Ekrana bakmadan yazmayı dene; hata olursa düzeltip devam et. Sabır ve tekrar ile hızın artar, doğruluğun yükselir. Bugün de dün gibi düzenli çalış.',
            'Akıcılık ve ritim odaklı 50 kelimelik metin yazıldı.', ASAMA.pro),

        lesson(30, 'Uzun Metin — Bitirme Sınavı',
            'F klavye on parmak eğitim programının son dersine hoş geldiniz. Bu metni hatasız ve dengeli bir hızda yazmanız beklenir. Doğru teknikle öğrenildiğinde hız artar, hata azalır. Düzenli pratikle her geçen gün daha doğru yazarsınız. Emeğiniz için tebrikler. Başarılar dileriz.',
            'Genel değerlendirme ve bitirme sınavı metni tamamlandı.', ASAMA.pro),
    ];
}(typeof window !== 'undefined' ? window : globalThis));
