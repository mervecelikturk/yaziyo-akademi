/**
 * Q Klavye — 30 ders (çentikli F / J merkezinden dışa)
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
        temel: 'temel',
        kelime: 'kelime',
        cumle: 'cumle',
        metin: 'metin',
        pro: 'pro',
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
            kazanim,
            asama,
        };
    }

    global.YaziyoDerslerQ = [

        // =========================================================
        // 1–5  Orta sıra — F J merkez
        // =========================================================

        lesson(1, 'F ve J — Temel Çentik',
            w20(['fjf', 'jfj', 'ffj', 'jff', 'fjf', 'jfj', 'fff', 'jjj', 'fjf', 'jfj', 'ffj', 'jff', 'fjf', 'jfj', 'fff', 'jjj', 'fjf', 'jfj', 'ffj', 'jff']),
            'F ve J çentikli tuşları sol ve sağ işaret parmaklarıyla öğrenildi.', ASAMA.temel),

        lesson(2, 'D ve K — Orta Parmaklar',
            w20(['fdk', 'kdj', 'djk', 'fjk', 'kfd', 'dfk', 'jdk', 'kjf', 'fkd', 'dkj', 'kdk', 'fdf', 'jdj', 'kfk', 'dfd', 'kjk', 'fkj', 'dkf', 'jfk', 'kdf']),
            'D ve K tuşları orta parmaklarla eklendi; F ve J ile birlikte pekiştirildi.', ASAMA.temel),

        lesson(3, 'S ve L — Yüzük Parmaklar',
            w20(['sdf', 'lkj', 'slk', 'kls', 'fds', 'jkl', 'sld', 'dls', 'fls', 'ksf', 'lsl', 'sfs', 'ksk', 'ldl', 'fsl', 'sls', 'kfl', 'dsj', 'jls', 'skl']),
            'S ve L tuşları yüzük parmaklarıyla öğrenildi.', ASAMA.temel),

        lesson(4, 'A ve Ş — Serçe Parmaklar',
            w20(['dal', 'fal', 'kal', 'sal', 'kas', 'laf', 'şal', 'aşk', 'kafa', 'saka', 'jala', 'daş', 'şaş', 'kala', 'faks', 'asla', 'sala', 'kasa', 'daşk', 'şaka']),
            'A ve Ş tuşları serçe parmaklarıyla eklendi.', ASAMA.temel),

        lesson(5, 'G ve H — Orta Sıra Tekrarı',
            w20(['gala', 'halk', 'şah', 'gah', 'dal', 'fal', 'kal', 'sal', 'kas', 'laf', 'şal', 'kasa', 'asla', 'saka', 'faks', 'hala', 'gaga', 'halk', 'şaka', 'kafa']),
            'G ve H ile orta sıra iç tuşlara geçildi; orta sıra genel tekrarı yapıldı.', ASAMA.kelime),

        // =========================================================
        // 6–10  Üst sıra
        // =========================================================

        lesson(6, 'R ve U — Üst Sıra İşaret',
            w20(['ruh', 'kuru', 'ful', 'jur', 'dal', 'kal', 'sal', 'kas', 'halk', 'gala', 'kasa', 'asla', 'saka', 'faks', 'şaka', 'kafa', 'rufa', 'kula', 'sura', 'juru']),
            'R ve U tuşları işaret parmaklarıyla üst sıraya taşındı.', ASAMA.kelime),

        lesson(7, 'E ve I — Üst Sıra Orta',
            w20(['her', 'kel', 'dere', 'kuru', 'ruh', 'halk', 'gala', 'kasa', 'dal', 'fal', 'kal', 'sal', 'faks', 'şaka', 'kafa', 'kırık', 'sera', 'eşek', 'ılık', 'leke']),
            'E ve I tuşları orta parmaklarla öğrenildi.', ASAMA.kelime),

        lesson(8, 'W ve O — Üst Sıra Yüzük',
            w20(['okul', 'solo', 'koro', 'her', 'dere', 'kuru', 'ruh', 'halk', 'gala', 'kasa', 'dal', 'kal', 'sal', 'faks', 'kafa', 'wok', 'loro', 'sowar', 'okla', 'jolo']),
            'W ve O tuşları yüzük parmaklarıyla eklendi.', ASAMA.kelime),

        lesson(9, 'Q, P ve Ğ — Üst Sıra Serçe',
            w20(['kapı', 'pupa', 'ağı', 'okul', 'solo', 'koro', 'her', 'dere', 'kuru', 'ruh', 'halk', 'gala', 'kasa', 'paşa', 'kupa', 'qopa', 'qarar', 'poğa', 'eğer', 'grup']),
            'Q, P ve Ğ tuşları serçe parmaklarıyla öğrenildi.', ASAMA.kelime),

        lesson(10, 'T ve Y — Üst Sıra Tekrarı',
            w20(['yol', 'tay', 'yurt', 'katı', 'kapı', 'okul', 'koro', 'her', 'dere', 'kuru', 'ruh', 'halk', 'gala', 'kasa', 'dal', 'yatak', 'turşu', 'yolak', 'katkı', 'poyra']),
            'T ve Y ile üst sıra iç tuşlara erişildi; üst sıra genel tekrarı yapıldı.', ASAMA.kelime),

        // =========================================================
        // 11–15  Alt sıra
        // =========================================================

        lesson(11, 'V ve M — Alt Sıra İşaret',
            w20(['mal', 'kav', 'yum', 'yol', 'tay', 'katı', 'kapı', 'okul', 'koro', 'her', 'dere', 'kuru', 'ruh', 'halk', 'yumak', 'metal', 'malum', 'kavak', 'hava', 'kova']),
            'V ve M tuşları işaret parmaklarıyla alt sıraya geçildi.', ASAMA.kelime),

        lesson(12, 'C ve N — Alt Sıra Orta',
            w20(['can', 'nane', 'cam', 'mal', 'yol', 'katı', 'kapı', 'okul', 'koro', 'her', 'dere', 'kuru', 'halk', 'gala', 'nacak', 'cuma', 'kanal', 'unut', 'kanca', 'cane']),
            'C ve N tuşları orta parmaklarla öğrenildi.', ASAMA.kelime),

        lesson(13, 'X ve B — Alt Sıra Yüzük',
            w20(['box', 'bank', 'ben', 'can', 'nane', 'mal', 'yol', 'katı', 'kapı', 'okul', 'koro', 'her', 'dere', 'halk', 'boks', 'naxal', 'baraj', 'kutu', 'bebek', 'bax']),
            'X ve B tuşları yüzük parmaklarıyla eklendi.', ASAMA.kelime),

        lesson(14, 'Z, Ö ve Ç — Alt Sıra Serçe',
            w20(['çay', 'saz', 'ben', 'can', 'nane', 'mal', 'yol', 'kapı', 'okul', 'koro', 'her', 'dere', 'halk', 'özel', 'çocuk', 'kazak', 'çöz', 'göl', 'öbek', 'çorba']),
            'Z, Ö ve Ç tuşları serçe parmaklarıyla öğrenildi.', ASAMA.kelime),

        lesson(15, 'İ ve Ü — Karma Harf Tekrarı',
            w20(['ile', 'gül', 'süt', 'yüz', 'üzüm', 'çay', 'saz', 'ben', 'can', 'nane', 'mal', 'yol', 'kapı', 'gülüş', 'sütün', 'yüzük', 'üzgün', 'küçük', 'jilet', 'eski']),
            'İ ve Ü tuşları eklendi; tüm harflerin karma tekrarı yapıldı.', ASAMA.kelime),

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
            'Shift tuşu ile cümle başı büyük harf alıştırması yapıldı.', ASAMA.metin),

        lesson(17, 'Nokta ve Virgül',
            [
                'Gel. Dur. Bak. Yaz. Oku.',
                'çay, süt, ekmek, peynir',
                'Kapı açıldı. Ev sessizdi.',
                'elma, armut, üzüm, kiraz',
                'Gün bitti. Işık söndü.',
            ].join(' '),
            'Nokta ve virgül işaretleri kısa ifadeler içinde öğrenildi.', ASAMA.metin),

        lesson(18, 'İki Nokta ve Noktalı Virgül',
            [
                'Liste: çay, süt, ekmek.',
                'İş bitti; ev sakin.',
                'Üç kural: doğruluk, sabır, emek.',
                'Yol uzundu; hava sıcaktı.',
                'Saat: on. Durak: okul.',
            ].join(' '),
            'İki nokta ve noktalı virgül kullanımı öğrenildi.', ASAMA.metin),

        lesson(19, 'Soru ve Ünlem',
            [
                'Geldin mi? Neredesin?',
                'Harika! Çok güzel!',
                'Kim geldi? Ne oldu?',
                'Aferin! Bravo!',
                'Hazır mısın? Başlayalım mı?',
                'Tamam! Hadi!',
            ].join(' '),
            'Soru işareti ve ünlem işareti diyalog cümleleriyle öğrenildi.', ASAMA.metin),

        lesson(20, 'Kesme ve Tırnak',
            [
                'Ankara\'da yağmur vardı.',
                'Öğretmen "Başla" dedi.',
                'Ali\'nin kalemi masada duruyor.',
                '"Günaydın" diye seslendi.',
                'İstanbul\'un yolu uzundu.',
                'Kitabın adı "Yol" idi.',
            ].join(' '),
            'Kesme işareti ve tırnak işareti kullanımına geçildi.', ASAMA.metin),

        lesson(21, 'Sayılar 1 2 3',
            [
                '1 2 3 1 2 3 2 1 3',
                'sınıfta 3 sıra var',
                '1 ekmek 2 peynir 3 zeytin',
                'kapı 2 kere çaldı',
                'ders 1 saat sürdü',
            ].join(' '),
            '1, 2 ve 3 tuşları yazıldı.', ASAMA.metin),

        lesson(22, 'Sayılar 4 5 6',
            [
                '4 5 6 4 5 6 5 4 6',
                'masada 4 kalem 5 defter var',
                '6 kişi geldi',
                'saat 4 te çıktım 5 te vardım',
                '5 gün 6 gece çalıştık',
            ].join(' '),
            '4, 5 ve 6 tuşları yazıldı.', ASAMA.metin),

        lesson(23, 'Sayılar 7 8 9 0',
            [
                '7 8 9 0 7 8 9 0',
                'sınıfta 30 öğrenci var',
                '8 sıra 9 sandalye',
                'kapı numarası 70',
                'saat 09 da başladık 10 da bitti',
            ].join(' '),
            '7, 8, 9 ve 0 tuşları yazıldı.', ASAMA.metin),

        lesson(24, 'Özel Karakterler',
            [
                '10 + 5 / 3 - 2',
                'telefon (0212) 555 00 11',
                'sonuç: 12 / 4 + 1',
                'adres (okul) kapı 3',
                '- evet + hayır',
            ].join(' '),
            'Eksi, artı, bölü ve parantez karakterleri öğrenildi.', ASAMA.metin),

        lesson(25, 'Sayı, Noktalama ve Büyük Harf',
            [
                'Ayşe 3 ekmek, 2 süt aldı.',
                'Toplantı saat 10:30 da; salon 4.',
                'Sonuç: 15 + 5 = 20 (doğru).',
                'Kim geldi? Ali mi, Mert mi?',
                'Bravo! 9 üzerinden 8 aldın.',
            ].join(' '),
            'Sayı, noktalama ve büyük/küçük harf birlikte pekiştirildi.', ASAMA.metin),

        // =========================================================
        // 26–30  Pekiştirme metinleri
        // =========================================================

        lesson(26, 'Kısa Metin — Günlük Konuşma',
            'sabah erken kalktım yüzümü yıkadım çay demledim ekmek peynir yedim sonra çantamı aldım okula yürüdüm yolda arkadaşımı gördüm birlikte gittik ders bitti eve döndük akşam yemek yedik biraz dinlendik',
            'Günlük konuşma dilinde 30 kelimelik kısa metin yazıldı.', ASAMA.metin),

        lesson(27, 'Kısa Metin — Büyük Harf ve Noktalama',
            'Elif sabah kalktı. Kahvaltı yaptı, çantasını aldı. "Günaydın" dedi. Okula gitti; ders başladı. Öğretmen sordu: Neredesin? Ali geldi. Akşam oldu. Ev sessizdi. Yemek bitti.',
            'Büyük harf ve noktalama ağırlıklı 30 kelimelik metin yazıldı.', ASAMA.metin),

        lesson(28, 'Kısa Metin — Sayı ve Karakter',
            'Sınıfta 32 öğrenci var. Saat 08:30 da ders başladı. Liste: 2 ekmek, 1 süt, 3 elma. Toplam 15 TL. Telefon (0212) 555 10 20. Sonuç 10 + 5 / 3. Kapı no 7.',
            'Sayı ve karakter içeren 30 kelimelik metin yazıldı.', ASAMA.metin),

        lesson(29, 'Uzun Metin — Akıcılık',
            'Her sabah aynı saatte kalkmak, masaya oturmak ve parmakları yuvaya koymak alışkanlık ister. Kısa metinler bile kas hafızasını güçlendirir. Ekrana bakmadan yazmayı dene; hata olursa düzeltip devam et. Sabır ve tekrar ile hızın artar, doğruluğun yükselir. Bugün de dün gibi düzenli çalış.',
            'Akıcılık ve ritim odaklı 50 kelimelik metin yazıldı.', ASAMA.metin),

        lesson(30, 'Uzun Metin — Bitirme Sınavı',
            'Q klavye on parmak eğitim programının son dersine hoş geldiniz. Bu metni hatasız ve dengeli bir hızda yazmanız beklenir. Doğru teknikle öğrenildiğinde hız artar, hata azalır. Düzenli pratikle her geçen gün daha doğru yazarsınız. Emeğiniz için tebrikler. Başarılar dileriz.',
            'Genel değerlendirme ve bitirme sınavı metni tamamlandı.', ASAMA.metin),
    ];
}(typeof window !== 'undefined' ? window : globalThis));
