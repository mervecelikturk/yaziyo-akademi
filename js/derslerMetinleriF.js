/**
 * F Klavye — 30 derslik on parmak eğitim metinleri
 *
 *  1–5   Orta sıra tuşları
 *  6–10  Üst sıra tuşları
 * 11–15  Alt sıra tuşları
 * 16–20  İmlasız kısa metin
 * 21–25  Noktalama, sayı ve büyük harf
 * 26–30  İmlalı metin
 */
(function (global) {
    function drill(words, n) {
        const out = [];
        let i = 0;
        const target = n || 50;
        while (out.length < target) {
            out.push(words[i % words.length]);
            i += 1;
        }
        return out.join(' ');
    }

    const ASAMA = {
        temel: 'Bu aşamada parmak yerini öğrenirsiniz.',
        kelime: 'Bu aşamada kelime üretmeye başlarsınız.',
        cumle: 'Bu aşamada bakmadan yazmaya yaklaşırsınız.',
        pro: 'Bu aşamada gerçek kullanıcı seviyesine çıkarsınız.',
    };

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
        // 1–5  Orta sıra: u ı a e t k m l y ü z s
        // =========================================================

        lesson(1, 'Orta Sıra — A ve E',
            drill(['ae', 'ea', 'aa', 'ee', 'aea', 'eae', 'aae', 'eaa', 'aee', 'eae']),
            'Orta sıradaki A ve E tuşlarıyla temel parmak hissi öğrenildi.', ASAMA.temel),

        lesson(2, 'Orta Sıra — K ve M',
            drill(['kek', 'kam', 'ame', 'emek', 'ekmek', 'kama', 'mek', 'mak', 'eke', 'aka', 'keme', 'akma']),
            'Sağ el K ve M tuşları A ve E ile birlikte pekiştirildi.', ASAMA.temel),

        lesson(3, 'Orta Sıra — U I T L Y',
            drill(['kal', 'kel', 'mal', 'yel', 'tam', 'kum', 'mut', 'yum', 'el', 'al', 'at', 'et', 'kule', 'yele', 'yaka', 'kalem', 'yemek', 'melek', 'yelek', 'mutlu', 'ılık', 'akıl', 'takı', 'kuma', 'yumak', 'amele', 'elma']),
            'Orta sıranın U, I, T, L ve Y tuşlarıyla kelime yazımı öğrenildi.', ASAMA.temel),

        lesson(4, 'Orta Sıra — Ü Z S',
            drill(['sus', 'ses', 'saz', 'tuz', 'süt', 'süs', 'üzüm', 'yüz', 'asla', 'salam', 'susam', 'tuzlu', 'masa', 'kasa', 'yasa', 'usta', 'elma', 'kalem', 'yemek', 'melek']),
            'Ü, Z ve S tuşlarıyla orta sıra harf seti tamamlandı.', ASAMA.kelime),

        lesson(5, 'Orta Sıra — Tüm Tuşlar',
            drill(['elma', 'masa', 'kasa', 'kalem', 'yemek', 'melek', 'yelek', 'asla', 'salam', 'susam', 'tuzlu', 'süt', 'üzüm', 'yüz', 'ılık', 'akıl', 'mutlu', 'kule', 'yaka', 'kuma', 'usta', 'yasa', 'saz', 'ses', 'sus', 'tuz', 'süs', 'takı', 'yumak', 'amele']),
            'Orta sıradaki tüm tuşlar karışık kelimelerle pekiştirildi.', ASAMA.kelime),

        // =========================================================
        // 6–10  Üst sıra: f g ğ i o d n h p q w
        // =========================================================

        lesson(6, 'Üst Sıra — F ve G',
            drill(['kafa', 'gül', 'gel', 'ege', 'gaga', 'gaf', 'gülme', 'gelme', 'gülüm', 'fakat', 'gül', 'kafa', 'gel', 'ege']),
            'Üst sıradaki F ve G tuşları orta sıra ile birlikte öğrenildi.', ASAMA.kelime),

        lesson(7, 'Üst Sıra — Ğ İ O',
            drill(['iki', 'ile', 'il', 'iğ', 'ağı', 'oğul', 'oya', 'of', 'sil', 'site', 'eğitim', 'iğe', 'oğul', 'iki', 'ile', 'eğitim', 'sil', 'oya', 'ağı']),
            'Üst sıradaki Ğ, İ ve O tuşlarıyla kelime yazımı genişletildi.', ASAMA.kelime),

        lesson(8, 'Üst Sıra — D N H',
            drill(['daha', 'neden', 'hane', 'hendek', 'deneme', 'dahil', 'hande', 'dana', 'gün', 'din', 'daha', 'neden', 'hane', 'deneme', 'dahil']),
            'Üst sıradaki D, N ve H tuşlarıyla günlük kelimeler yazıldı.', ASAMA.kelime),

        lesson(9, 'Üst Sıra — P Q W',
            drill(['peki', 'yap', 'kap', 'puma', 'hep', 'hap', 'qw', 'wq', 'qa', 'wa', 'peki', 'yap', 'kap', 'hep', 'puma', 'qwe', 'wap']),
            'Üst sıradaki P, Q ve W tuşları alıştırma ve kelimelerle öğrenildi.', ASAMA.kelime),

        lesson(10, 'Üst Sıra — Tüm Tuşlar',
            drill(['iki', 'oğul', 'daha', 'neden', 'eğitim', 'fakat', 'peki', 'yap', 'kap', 'gün', 'din', 'hane', 'hendek', 'kafa', 'gül', 'gel', 'ege', 'ağı', 'oya', 'sil', 'site', 'dahil', 'deneme', 'hep', 'puma']),
            'Üst ve orta sıra tuşları karışık kelimelerle pekiştirildi.', ASAMA.kelime),

        // =========================================================
        // 11–15  Alt sıra: j ö v c ç b .
        // =========================================================

        lesson(11, 'Alt Sıra — J ve Ö',
            drill(['jale', 'jöle', 'öf', 'göl', 'öğle', 'ölü', 'öyle', 'öf', 'jale', 'göl', 'öğle', 'jöle', 'öyle', 'ölü']),
            'Alt sıradaki J ve Ö tuşlarıyla kelime yazımı öğrenildi.', ASAMA.kelime),

        lesson(12, 'Alt Sıra — V ve C',
            drill(['ödev', 'cevap', 've', 'ev', 'acı', 'cami', 'can', 'ceza', 'vicdan', 'ödev', 'cevap', 'cami', 'can', 'ev']),
            'Alt sıradaki V ve C tuşlarıyla anlamlı kelimeler yazıldı.', ASAMA.kelime),

        lesson(13, 'Alt Sıra — Ç ve B',
            drill(['çay', 'çam', 'ben', 'bol', 'boy', 'bel', 'bilet', 'çelik', 'çoban', 'çatal', 'bulduk', 'çiçek', 'çay', 'ben', 'çoban']),
            'Alt sıradaki Ç ve B tuşlarıyla kelime çeşitliliği artırıldı.', ASAMA.kelime),

        lesson(14, 'Alt Sıra — Nokta',
            drill(['ben.', 'gel.', 'yap.', 'kal.', 'bak.', 'çay.', 'ev.', 'göl.', 'can.', 'bol.', 'ben geldim.', 'çay içtim.', 'ödev bitti.', 'göl sakin.', 'gün bitti.']),
            'Alt sıradaki nokta tuşu kısa ifadeler içinde öğrenildi.', ASAMA.cumle),

        lesson(15, 'Alt Sıra — Tüm Tuşlar',
            [
                'ben çay içtim göl sakin kaldı',
                'çoban yolda gitti jale camiye geldi',
                'ödev bitti cevap tam çıktı',
                'çiçek açtı çam kokusu yayıldı',
                'öyle güzel bu öğle oldu ki',
                'vicdan temiz can mutlu',
                'bilet aldık belki gidelim',
                'çelik kapı kapandı ev sessiz',
            ].join(' '),
            'Alt, orta ve üst sıra tuşları birlikte pekiştirildi.', ASAMA.cumle),

        // =========================================================
        // 16–20  İmlasız kısa metin (küçük harf, noktalamasız)
        // =========================================================

        lesson(16, 'İmlasız Metin — Kısa Anlatı',
            [
                'sabah erken kalktım yüzümü yıkadım ve kahvaltı yaptım',
                'annem mutfakta çay demledi kardeşim masaya oturdu',
                'dışarıda kuşlar ötüyordu hava sıcaktı',
                'okula yürüyerek gittim yolda arkadaşımı gördüm',
                'dersler akşama kadar sürdü eve dönünce dinlendim',
            ].join(' '),
            'Noktalamasız kısa metinle akıcı yazım alıştırması yapıldı.', ASAMA.cumle),

        lesson(17, 'İmlasız Metin — Günlük Yaşam',
            [
                'pazar günü ailece parka gittik çocuklar top oynadı',
                'göl kenarında oturduk simit yedik çay içtik',
                'rüzgar yaprakları savurdu güneş tepeden bakıyordu',
                'akşam eve dönerken marketten ekmek aldık',
                'yemekten sonra hep birlikte film izledik',
            ].join(' '),
            'Günlük yaşam konulu imlasız metin yazıldı.', ASAMA.cumle),

        lesson(18, 'İmlasız Metin — Okul',
            [
                'öğretmen tahtaya konuyu yazdı öğrenciler defterine geçirdi',
                'soruları sırayla çözdük yanlışları birlikte düzelttik',
                'teneffüste bahçede yürüdük sonra tekrar sınıfa girdik',
                'kitap okuma saatinde herkes sessizce sayfa çevirdi',
                'zil çalınca çantalarımızı toplayıp evlerimize dağıldık',
            ].join(' '),
            'Okul temalı imlasız kısa metinle hız ve doğruluk çalışıldı.', ASAMA.cumle),

        lesson(19, 'İmlasız Metin — Doğa',
            [
                'dağ yolunda yürürken serin bir esinti vardı',
                'ağaçların gölgesinde mola verdik su içtik',
                'uzakta bir göl parlıyordu kuşlar suya konuyordu',
                'çiçekler açmıştı toprak yumuşacıktı',
                'akşam olunca köye döndük ateş yaktık sohbet ettik',
            ].join(' '),
            'Doğa anlatımlı imlasız metinle parmak geçişleri pekiştirildi.', ASAMA.cumle),

        lesson(20, 'İmlasız Metin — Çalışma',
            [
                'her gün düzenli çalışmak başarıyı getirir',
                'klavye başına oturunca sırtını dik tut parmaklarını yuvaya koy',
                'ekrana bakmadan yazmayı dene hata olursa düzeltip devam et',
                'kısa metinler bile kas hafızasını güçlendirir',
                'sabır ve tekrar ile hızın artar doğruluğun yükselir',
            ].join(' '),
            'Çalışma alışkanlığı temalı imlasız metin tamamlandı.', ASAMA.cumle),

        // =========================================================
        // 21–25  Noktalama, sayı ve büyük harf
        // =========================================================

        lesson(21, 'Büyük Harf ve Nokta',
            [
                'Zeynep sabah erkenden kalktı. Kahvaltısını hazırladı.',
                'Annesi Fatma mutfakta çay demliyordu. Kardeşi Mert masaya geldi.',
                'Ankara soğuktu. İstanbul ise daha ılımandı.',
                'Bugün güzel bir gün olacaktı. Hep birlikte parka gideceklerdi.',
                'Akşam olunca eve döndüler. Yemekten sonra kitap okudular.',
            ].join(' '),
            'Cümle başı büyük harf ve nokta kullanımı öğrenildi.', ASAMA.pro),

        lesson(22, 'Virgül ve Kısa Liste',
            [
                'Masada peynir, zeytin, domates ve ekmek vardı.',
                'Aylin yüzünü yıkadı, çantasını aldı ve dışarı çıktı.',
                'Sokakta hava serindi, hafif bir esinti vardı.',
                'Okula varınca sınıfa girdi, sırasına oturdu, defterini açtı.',
                'Çay, süt, bal ve pekmez kahvaltının vazgeçilmezleridir.',
            ].join(' '),
            'Virgül ve liste yazımı anlamlı cümleler içinde pekiştirildi.', ASAMA.pro),

        lesson(23, 'Sayılar ve Tarih',
            [
                'Sınıfta 32 öğrenci var. 8 sıraya 4 kişi oturmuş.',
                'Bugün 3 saat çalıştım ve 15 sayfa okudum.',
                'Marketten 2 ekmek, 1 litre süt ve 500 gram yoğurt aldım.',
                'Toplantı 15 Ocak 2026 Perşembe günü saat 10:30 da başlayacak.',
                'Türkiye Cumhuriyeti 29 Ekim 1923 te ilan edildi.',
                'Sabah 07:15 te evden çıktım, 08:00 de işe vardım.',
            ].join(' '),
            'Rakam, tarih ve saat yazımı metin içinde öğrenildi.', ASAMA.pro),

        lesson(24, 'Soru, Ünlem ve Tırnak',
            [
                'Bugün hava nasıl? Dışarısı serin mi?',
                'Evet, çok güzel bir gün!',
                'Nereye gidiyorsun? Okula mı, parka mı?',
                'Öğretmen "Başarı sabırla gelir" dedi.',
                'Harika! Bu kadar güzel bir yer görmedim.',
                'Saat kaçta buluşalım? Öğleden sonra uygun mu?',
                'Tamam, bugün hallederim. Bu iyi bir seçim!',
            ].join(' '),
            'Soru işareti, ünlem ve tırnak kullanımı diyalog cümleleriyle öğrenildi.', ASAMA.pro),

        lesson(25, 'Karışık Noktalama ve Sayı',
            [
                'Müşteri hizmetleri: 0850 123 45 67.',
                'Ürün fiyatı 249,90 TL; indirimle 187,50 TL oldu.',
                'Sınavda başarı oranı %78 e yükseldi. KDV oranı %20 uygulandı.',
                'Alışveriş listesi hazır: ekmek, süt, yoğurt ve peynir.',
                'Hava soğuktu; yine de yürüyüşe çıktım.',
                'Üç kural var: doğruluk, sabır ve çalışkanlık.',
                'Acil durumlarda 112 yi arayın. Polis için 155, itfaiye için 110.',
            ].join(' '),
            'Noktalama, sayı ve büyük harf birlikte pekiştirildi.', ASAMA.pro),

        // =========================================================
        // 26–30  İmlalı metin
        // =========================================================

        lesson(26, 'İmlalı Metin — Günlük Hayat',
            [
                'Elif sabah erkenden kalkıp mutfağa geçti.',
                'Kahvaltıyı hazırlarken radyodan hava durumunu dinledi; gün boyunca güneşli olacaktı.',
                'İşe gitmeden önce çantasını kontrol etti: bilgisayar, dosyalar, kalem ve defter.',
                'Metrobüste sıkışık bir yolculuk geçirdi ama kitap okuyarak vakit harcadı.',
                'Öğle arasında iş arkadaşıyla kafeteryada yemek yedi.',
                'Mesai bitince market alışverişini yapıp eve döndü.',
                'Akşam yemeği hazırlarken bugünü değerlendirdi: verimli bir gündü.',
            ].join(' '),
            'Günlük hayat konulu imlalı metin yazımı gerçekleştirildi.', ASAMA.pro),

        lesson(27, 'İmlalı Metin — Meslek',
            [
                'Zabıt kâtipliği sınavına hazırlanan Ahmet her sabah bir saat klavye çalışması yapıyor.',
                'F klavye düzenini tercih etmesinin nedeni Türkçeye en uygun düzen olmasıdır.',
                'On parmak tekniğiyle dakikada 60 kelimeye ulaşmayı hedefliyor.',
                'Her gün kısa metinler yazarak hem hızını hem doğruluk oranını artırıyor.',
                'Sınav günü geldiğinde metni hatasız teslim etmek için hazır olmak istiyor.',
                'Düzenli çalışma ve sabır bu hedefe ulaşmanın en kısa yoludur.',
                'Yaziyo Akademi platformu bu süreçte ona rehberlik ediyor.',
            ].join(' '),
            'Mesleki bağlamda imlalı metin yazımı gerçekleştirildi.', ASAMA.pro),

        lesson(28, 'İmlalı Metin — Doğa ve Çevre',
            [
                'Türkiye dört mevsimi bir arada yaşayan, zengin bir doğal çeşitliliğe sahip bir ülkedir.',
                'Karadeniz\'in yemyeşil ormanları, Ege\'nin zeytin bahçeleri ve Doğu Anadolu\'nun karlı dağları güzellikler sunar.',
                'Her mevsim kendi rengini getirir; bahar çiçeklerle, yaz sıcaklarla, sonbahar yapraklarla, kış beyaz örtüyle.',
                'İklim değişikliği bu dengeyi tehdit etmektedir.',
                'Doğayı korumak hem bugünkü hem de gelecek kuşakların sorumluluğudur.',
                'Küçük adımlar bile büyük fark yaratır: israfı azalt, geri dönüşüme dikkat et.',
            ].join(' '),
            'Doğa ve çevre temalı imlalı metin yazımı gerçekleştirildi.', ASAMA.pro),

        lesson(29, 'İmlalı Metin — Eğitim',
            [
                'Dijital çağda eğitim büyük bir dönüşüm geçirmektedir.',
                'Öğrenciler artık yalnızca sınıfta değil, internet üzerinden de derse katılabiliyor.',
                'Yapay zekâ destekli uygulamalar öğrenme süreçlerini kişiselleştirirken öğretmenler bu araçları sınıfta kullanmayı öğreniyor.',
                'Ancak teknoloji ne kadar gelişirse gelişsin, öğrenmenin özünde merak, sabır ve pratik yatmaktadır.',
                'Klavye kullanımı da bu süreçte önemli bir beceri hâline gelmiştir.',
                'Hızlı ve doğru yazabilen biri iş hayatında büyük avantaj elde eder.',
                'Düzenli çalışmayla bu beceri kısa sürede edinilebilir.',
            ].join(' '),
            'Eğitim temalı imlalı metinle akıcılık geliştirildi.', ASAMA.pro),

        lesson(30, 'İmlalı Metin — Final',
            [
                'F klavye on parmak eğitim programının son dersine hoş geldiniz.',
                'Bu metni hatasız ve dengeli bir hızda yazmanız beklenmektedir.',
                'Zabıt kâtipliği ve benzer mesleklerde doğruluk kritiktir.',
                'F klavye, 1955 yılında Türkçeye özel olarak geliştirilmiştir.',
                'En sık kullanılan harfler parmakların rahatça ulaşabileceği orta sıraya yerleştirilmiştir.',
                'Doğru teknikle öğrenildiğinde hız artar, hata azalır ve yorgunluk düşer.',
                'Bugün bu programı tamamlayarak gerekli kas hafızasına ve güvene ulaştınız.',
                'Artık klavyeye bakmadan yazabileceksiniz.',
                'Düzenli pratikle her geçen gün daha hızlı ve daha doğru yazacaksınız.',
                'Emeğiniz için tebrikler. Başarılar diliyoruz.',
            ].join(' '),
            'Final metni tamamlandı: harfler, noktalama, sayılar ve imlalı yazım bütünleşik olarak pekiştirildi.', ASAMA.pro),
    ];
}(typeof window !== 'undefined' ? window : globalThis));
