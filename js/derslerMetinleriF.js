/**
 * F Klavye — 30 derslik on parmak eğitim metinleri
 *
 * Harf öğretim sırası:
 *   L1: A, E     | L2: K, L     | L3: İ, T     | L4: N, R     | L5: M, U
 *   L6: Y, S     | L7: D, O     | L8: B, Ç     | L9: G, I(ı)  | L10: Ş, C
 *   L11: Ü, P    | L12: Z, H    | L13: V, F    | L14: Ö, Ğ    | L15: J + Tekrar
 *   L16–20: Büyük harf + noktalama
 *   L21–24: Sayılar
 *   L25–29: Metin yazımı
 *   L30: Final sınavı
 *
 * Kelime sayısı hedefleri:
 *   L1–15 → 50   L16–25 → 60   L26–29 → 70   L30 → 90
 */
(function (global) {
    function drill50(words) {
        const out = [];
        let i = 0;
        while (out.length < 50) {
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
        // BÖLÜM 1 — Harf Öğretimi (L1–L15)
        // =========================================================

        // L1: sadece A ve E
        lesson(1, 'A ve E — İlk Sesli Harfler',
            drill50(['ae', 'ea', 'aa', 'ee', 'aea', 'eae', 'aae', 'eaa']),
            'A ve E sesli harfleri ve temel tuş hissi öğrenildi.', ASAMA.temel),

        // L2: A E K L → 3 harfli kelimeler
        lesson(2, 'K ve L — İlk Sessiz Harfler',
            drill50(['kel', 'kal', 'lak', 'kek', 'lek', 'kale', 'leke', 'el', 'al', 'kal']),
            'K ve L harfleriyle ilk anlamlı üç harfli kelimeler yazıldı.', ASAMA.temel),

        // L3: A E K L İ T → 3-4 harfli kelimeler
        lesson(3, 'İ ve T — Orta Sıra',
            drill50(['tel', 'kil', 'til', 'eti', 'tik', 'kit', 'etki', 'kilit', 'ilik', 'tali']),
            'İ ve T harfleriyle üç-dört harfli kelimeler pekiştirildi.', ASAMA.temel),

        // L4: + N R → 4 harfli kelimeler
        lesson(4, 'N ve R — Sık Kullanılan Sessizler',
            drill50(['nar', 'kar', 'kare', 'kart', 'tane', 'ekin', 'renk', 'narin', 'erken', 'tren']),
            'N ve R harfleriyle dört harfli anlamlı kelimeler üretildi.', ASAMA.temel),

        // L5: + M U → anlamlı kelimeler
        lesson(5, 'M ve U — Yeni Çift',
            drill50(['kule', 'kulak', 'kural', 'marul', 'numara', 'mum', 'kum', 'tulum', 'umar', 'kumar']),
            'M ve U harfleriyle anlamlı kelimeler üretildi.', ASAMA.kelime),

        // L6: + Y S
        lesson(6, 'Y ve S — Akıcı Sessizler',
            drill50(['yem', 'yel', 'ses', 'sel', 'yas', 'yurt', 'serin', 'serum', 'seyir', 'saray', 'yumruk']),
            'Y ve S harfleriyle çeşitli anlamlı kelimeler yazıldı.', ASAMA.kelime),

        // L7: + D O
        lesson(7, 'D ve O — Yeni Çift',
            drill50(['oda', 'dil', 'dal', 'son', 'sol', 'yol', 'dolu', 'okul', 'durum', 'salon', 'doktor', 'neden', 'yorum', 'model']),
            'D ve O harfleriyle günlük Türkçe kelimeler öğrenildi.', ASAMA.kelime),

        // L8: + B Ç
        lesson(8, 'B ve Ç — Yeni Sessizler',
            drill50(['çay', 'çam', 'ben', 'bol', 'boy', 'bel', 'bilet', 'çelik', 'çoban', 'çatal', 'bulduk']),
            'B ve Ç harfleriyle kelime çeşitliliği artırıldı.', ASAMA.kelime),

        // L9: + G I(ı)
        lesson(9, 'G ve I — Orta Sıra Tamamlanıyor',
            drill50(['gıda', 'kısa', 'sıra', 'yakın', 'takım', 'kıyı', 'ılık', 'gelin', 'bakımlı', 'kırgın', 'ikram']),
            'G ve I harfleriyle kısa ve anlamlı kelimeler öğrenildi.', ASAMA.kelime),

        // L10: + Ş C → basit cümleler (50 kelime)
        // Yasak: h ü p z v f ö ğ j
        lesson(10, 'Ş ve C — Tamamlayıcı Sessizler', [
            'ırmak taşların arasından sakin akar',
            'kuşlar dala konar tarla kışın boş kalır',
            'sis ormanı sarar bitkiler ırmaktan su içer',
            'okul erken kalabalık olur sokak gece karanlık kalır',
            'çalışmak sabır ister kış gelince tarla bekler',
            'akşam bastırır orman serindir',
            'bilgi artar sabırla çalışırsın',
            'bu yol seni ileri taşır adım adım ilerle',
        ].join(' '), 'Ş ve C harfleriyle kısa cümle yapıları kuruldu.', ASAMA.kelime),

        // L11: + Ü P → basit cümleler (50 kelime)
        // Yasak: h z v f ö ğ j
        lesson(11, 'Ü ve P — Üst Satıra Geçiş', [
            'güneş büyük bulutların üstünde parlar',
            'tüm orman ısınır küçük bitkiler serpilir',
            'park neşeli oluyor toplantı erken başlıyor',
            'pek çok kişi katılıyor güçlü çalışmak ilerletir',
            'bitkiler büyür kuşlar dala konarken güneş batıyor',
            'gece serindir tüm çalışmalar tamamlanıyor',
            'birlikte güçlüdür sepetler ürünlerle doluyor',
            'emekler karşılık buluyor işte gerçek başarı budur',
        ].join(' '), 'Ü ve P harfleriyle anlamlı cümleler kuruldu.', ASAMA.cumle),

        // L12: + Z H → basit cümleler (50 kelime)
        // Yasak: v f ö ğ j
        lesson(12, 'Z ve H — Harf Seti Genişliyor', [
            'sabah güneş yükseliyor güzel iklim herkesi canlandırıyor',
            'pazar kalabalık deniz berrak parlıyor buz gibi serin durur',
            'satıcılar hızlı çalışıyor taze sebzeler sunuluyor',
            'haber hızla yayılıyor hasta ziyaret edilir',
            'bu güzel şehirde yaşamak gerçekten iyidir tüm insanlar',
            'birbirine yakın hep yardımlaşıyor mutlu oluyoruz',
            'günler mola ile geçiyor çalışma ilerliyor',
        ].join(' '), 'Z ve H harfleriyle anlamlı cümleler kuruldu; kelime çeşitliliği arttı.', ASAMA.cumle),

        // L13: + V F → basit cümleler (50 kelime)
        // Yasak: ö ğ j
        lesson(13, 'V ve F — Son Sessizler', [
            'fabrika işçileri gün boyu çalışıyor verimli üretim yapılıyor',
            'veri kayıtları güncel tutuluyor faydalı bilgi paylaşılıyor',
            'festival hazırlıkları başladı vatan sevgisi canlı tutuluyor',
            'favori spor aktivitedir kısa mola vermek faydalıdır',
            'verimlilik artar çalışanlar mutlu olur',
            'birlikte çalışmak güçlendirir takım ruhu çok kıymetlidir',
            'başarıya birlikte ulaşılır sabır insana güç verir',
        ].join(' '), 'V ve F harfleriyle cümleler kuruldu; tüm Türkçe sessizler tamamlandı.', ASAMA.cumle),

        // L14: + Ö Ğ → basit cümleler (50 kelime)
        // Yasak: j
        lesson(14, 'Ö ve Ğ — Türkçeye Özel Harfler', [
            'öğrenciler sabah erkenden derse gelir ödevlerini sürekli teslim eder',
            'öğretmenin açıklamalarını dinler ağaçların altında oturup çalışır',
            'öğle molasında kısa dinlenme yapar soğuk havada bile görevini sürdürür',
            'özgür düşünce güçlü toplum yaratır öğretmen öğrenciye görev verir',
            'dağ yolu uzun görünür ağır işler sabırla kolaylaşır',
            'her gün öğrenilen bir şey hayatı güzelleştirir',
        ].join(' '), 'Ö ve Ğ harfleriyle Türkçeye özel kelimeler öğrenildi; harf seti tamamlandı.', ASAMA.cumle),

        // L15: + J → tüm harfler, tekrar (50 kelime)
        lesson(15, 'J ve Tüm Harflerin Tekrarı', [
            'japon bahçesinde jale çiçekleri açmış judo sporcusu her gün antrenmana gidiyor',
            'öğrenciler sabah erkenden derse gelir ödevlerini teslim eder öğretmeni dinler',
            'deniz kıyısında serin rüzgar eser dalgalar sahile vurur güneş parlar',
            'fabrika işçileri gün boyu çalışır veri kayıtlarını düzenler',
            'ağaçlar sonbaharda sararır yapraklar dökülür kışın soğuk dağlar beyazlaşır',
        ].join(' '), 'J harfi öğrenildi; tüm F klavye harfleri kapsamlı tekrarla pekiştirildi.', ASAMA.cumle),

        // =========================================================
        // BÖLÜM 2 — Büyük Harf + Noktalama (L16–L20) → 60 kelime
        // =========================================================

        lesson(16, 'Büyük Harf — Shift Tuşu', [
            'Zeynep sabah erkenden kalktı ve kahvaltısını hazırladı.',
            'Annesi Fatma mutfakta çay demliyordu.',
            'Ankara\'da yaşayan bu aile her sabah birlikte kahvaltı ederdi.',
            'Küçük kardeş Mert masaya geldi.',
            'Türkiye\'nin pek çok şehrinde böyle güzel aile sofraları kurulur.',
            'Zeynep çantasını alıp çıktı.',
            'İstanbul\'dan amcası Kadir gelecekti; Zeynep onu çok özlemişti.',
            'Dışarıda güneş parlıyordu hava güzeldi.',
            'Bugün güzel bir gün olacaktı.',
            'Beraber Atatürk Parkı\'nda yürüyüş yapacaklardı.',
        ].join(' '), 'Shift tuşu ile büyük harf kullanımı öğrenildi; özel isimler ve cümle başları pekiştirildi.', ASAMA.cumle),

        lesson(17, 'Nokta ve Virgül', [
            'Aylin sabah erkenden kalktı, yüzünü yıkadı ve kahvaltıya oturdu.',
            'Masada peynir, zeytin, domates ve ekmek vardı.',
            'Çay demlenirken kitabını açtı, birkaç sayfa okudu.',
            'Annesinin sesi geldi.',
            'Aylin hızla çantasını kapıp dışarı fırladı.',
            'Sokakta hava serinleşmişti, hafif bir esinti vardı.',
            'Okula varınca sınıfa koştu, sırasına oturdu.',
            'Gününün güzel başladığını fark etti.',
            'Dersi dinlemek için hazırdı.',
            'Gülümseyerek defterini açtı.',
            'Her şey güzeldi.',
        ].join(' '), 'Nokta ve virgül kullanımı anlamlı cümleler içinde pekiştirildi.', ASAMA.cumle),

        lesson(18, 'Soru İşareti ve Ünlem', [
            'Bugün hava nasıl? Dışarısı serin mi?',
            'Evet, çok güzel bir gün!',
            'Nereye gidiyorsun? Okula mı, parka mı?',
            'Harika! Bu kadar güzel bir yer görmedim.',
            'Saat kaçta buluşalım? Öğleden sonra uygun mu?',
            'Tabii ki! Sizi bekliyorum.',
            'Bu kitabı okudun mu? Gerçekten çok iyi.',
            'Hayır, henüz okumadım ama almayı düşünüyorum.',
            'Hemen al! Pişman olmazsın, söz veriyorum.',
            'Tamam, bugün alacağım.',
            'Bu iyi bir seçim!',
        ].join(' '), 'Soru işareti ve ünlem işareti kullanımı doğal diyalog cümleleriyle öğrenildi.', ASAMA.cumle),

        lesson(19, 'İki Nokta ve Noktalı Virgül', [
            'Çantama şunları koydum: kitap, kalem, silgi ve cetvel.',
            'Hava soğuktu; yine de yürüyüşe çıktım.',
            'Üç önemli kural var: doğruluk, sabır ve çalışkanlık.',
            'Yorgunum; ama görevimi tamamlamam gerekiyor.',
            'Toplantıda konuşulanlar şöyle özetlenebilir: verim arttı, maliyetler düştü.',
            'Uzun bir yol kat ettik; hedefe az kaldı.',
            'Alışveriş listesi hazır: ekmek, süt, yoğurt ve peynir.',
            'Ders bitmeden önce şunu hatırla: tekrar başarı getirir.',
        ].join(' '), 'İki nokta ve noktalı virgül kullanımı pratik örneklerle öğrenildi.', ASAMA.cumle),

        lesson(20, 'Tırnak ve Parantez', [
            'Öğretmen "Başarı sabırla gelir" dedi.',
            'Atatürk (1881-1938) Türkiye Cumhuriyeti\'nin kurucusudur.',
            '"Kitap insanın en iyi dostudur" sözü hâlâ geçerlidir.',
            'Bu çalışma (yaklaşık iki saat sürdü) çok verimli oldu.',
            'Annem "Erken yat, erken kalk" derdi hep.',
            'Türkiye\'nin nüfusu (2024 verilerine göre) seksen beş milyonu aştı.',
            '"Çalışmadan başarı olmaz" ilkesi her zaman doğrudur.',
            'Proje tamamlandı (bütçe dahilinde) ve zamanında teslim edildi.',
        ].join(' '), 'Tırnak işaretleri ve parantez kullanımı gerçek cümle örnekleriyle pekiştirildi.', ASAMA.cumle),

        // =========================================================
        // BÖLÜM 3 — Sayılar (L21–L24) → 60 kelime
        // =========================================================

        lesson(21, 'Sayılar 0–9', [
            'Sınıfta 32 öğrenci var, 8 sıraya 4\'er kişi oturmuş.',
            'Bugün 3 saat çalıştım ve 15 sayfa okudum.',
            'Marketten 2 ekmek, 1 litre süt ve 500 gram yoğurt aldım.',
            'Sınav sonuçları açıklandı: Ali 87, Merve 94, Kerem 76 aldı.',
            'Sabah 7\'de kalktım, 8\'de evden çıktım.',
            'Bu yıl 365 gün her gün bir şey öğrenmeyi hedefliyorum.',
            'Kitapta 240 sayfa var; bugün 30 sayfa okudum.',
        ].join(' '), 'Sayılar ve temel rakam yazımı metin içinde öğrenildi.', ASAMA.pro),

        lesson(22, 'Tarih ve Saat', [
            'Toplantı 15 Ocak 2025 Çarşamba günü saat 10:30\'da başlayacak.',
            'Türkiye Cumhuriyeti 29 Ekim 1923\'te ilan edildi.',
            'Sabah 06:45\'te uyandım, 07:15\'te evden çıktım.',
            'Sınav 3 Mart 2025\'te saat 09:00\'da başlıyor.',
            'Teslim tarihi 31 Aralık, son gün olduğunu unutma.',
            'Öğle arası 12:00-13:00 arası, bir saatlik mola.',
            'Doğum günüm 14 Şubat; tatil değil ama özel.',
            '2023 yılında 52 hafta, 365 gün ve 8.760 saat var.',
        ].join(' '), 'Tarih ve saat yazım kuralları gerçek örneklerle öğrenildi.', ASAMA.pro),

        lesson(23, 'Telefon, Para ve Yüzde', [
            'Müşteri hizmetleri numarası: 0850 123 45 67.',
            'Ürün fiyatı 249,90 TL; indirimle 187,50 TL oldu.',
            'Banka hesabına 1.500 TL yatırıldı.',
            'Sınavda başarı oranı %78\'e yükseldi.',
            'KDV oranı %20 olarak uygulandı; toplam tutar 360 TL.',
            'Acil hatlarda 112, polis için 155, itfaiye için 110\'u arayın.',
            'Maaş artışı %15 olarak belirlendi, yeni tutar 18.750 TL.',
            'İndirim kuponu ile %30 daha ucuza satın alabilirsiniz.',
        ].join(' '), 'Telefon, para birimi ve yüzde yazım kuralları öğrenildi.', ASAMA.pro),

        lesson(24, 'Ondalık Sayılar ve Ölçüler', [
            'Su kaynaması 100°C\'de gerçekleşir; donma noktası 0°C\'dir.',
            'Paketin ağırlığı 2,5 kg; hacmi 3,75 litredir.',
            'Pi sayısı yaklaşık 3,14159 olarak bilinir.',
            'Hız saatte 87,6 km olarak ölçüldü.',
            'Döviz kuru bugün 1 dolar = 32,45 TL olarak açıklandı.',
            'Projenin tamamlanma oranı %63,7\'ye ulaştı.',
            'Alan 12,5 m² olan oda mobilyalar için yeterlidir.',
            'Ortalama sıcaklık bu ay 18,3°C olarak kaydedildi.',
            'Maliyeti 4,75 TL olarak hesaplandı.',
        ].join(' '), 'Ondalık sayılar, ölçü birimleri ve özel semboller yazım kurallarıyla pekiştirildi.', ASAMA.pro),

        // =========================================================
        // BÖLÜM 4 — Metin Yazımı (L25–L29) → 60 kelime (L25), 70 (L26-29)
        // =========================================================

        lesson(25, 'Günlük Hayattan Metin', [
            'Elif sabah erkenden kalkıp mutfağa geçti.',
            'Kahvaltıyı hazırlarken radyodan hava durumunu dinledi; gün boyunca güneşli olacaktı.',
            'İşe gitmeden önce çantasını kontrol etti: bilgisayar, dosyalar, kalem ve defteri.',
            'Metrobüste sıkışık bir yolculuk geçirdi ama kitap okuyarak vakit harcadı.',
            'Öğle arasında iş arkadaşıyla kafeteryada yemek yedi.',
            'Mesai bitince market alışverişini yapıp eve döndü.',
            'Akşam yemeği hazırlarken bugünü değerlendirdi: verimli bir gündü.',
        ].join(' '), 'Günlük hayat konularında akıcı metin yazımı gerçekleştirildi.', ASAMA.pro),

        lesson(26, 'Mesleki Metin', [
            'Zabıt kâtipliği sınavına hazırlanan Ahmet her sabah bir saat klavye çalışması yapıyor.',
            'F klavye düzenini tercih etmesinin nedeni Türkçeye en uygun düzen olmasıdır.',
            'On parmak tekniğiyle dakikada 60 kelimeye ulaşmayı hedefliyor.',
            'Her gün kısa metinler yazarak hem hızını hem doğruluk oranını artırıyor.',
            'Sınav günü geldiğinde metni hatasız teslim etmek için hazır olmak istiyor.',
            'Düzenli çalışma ve sabır bu hedefe ulaşmanın en kısa yoludur.',
            'Yaziyo Akademi platformu bu süreçte ona rehberlik ediyor.',
        ].join(' '), 'Mesleki bağlamda anlamlı metin yazımı gerçekleştirildi.', ASAMA.pro),

        lesson(27, 'Doğa ve Çevre', [
            'Türkiye dört mevsimi bir arada yaşayan, zengin bir doğal çeşitliliğe sahip bir ülkedir.',
            'Karadeniz\'in yemyeşil ormanları, Ege\'nin zeytin bahçeleri ve Doğu Anadolu\'nun karlı dağları güzellikler sunar.',
            'Her mevsim kendi rengini getirir; bahar çiçeklerle, yaz kavurucu sıcaklarla, sonbahar altın yapraklarla, kış beyaz örtüyle.',
            'İklim değişikliği bu dengeyi tehdit etmektedir.',
            'Doğayı korumak hem bugünkü hem de gelecek kuşakların sorumluluğudur.',
            'Küçük adımlar bile büyük fark yaratır: israfı azalt, geri dönüşüme dikkat et.',
        ].join(' '), 'Doğa ve çevre temalı uzun metin yazımı gerçekleştirildi.', ASAMA.pro),

        lesson(28, 'Eğitim ve Teknoloji', [
            'Dijital çağda eğitim büyük bir dönüşüm geçirmektedir.',
            'Öğrenciler artık yalnızca sınıfta değil, internet üzerinden de derse katılabiliyor.',
            'Yapay zekâ destekli uygulamalar öğrenme süreçlerini kişiselleştirirken öğretmenler bu araçları sınıfta kullanmayı öğreniyor.',
            'Ancak teknoloji ne kadar gelişirse gelişsin, öğrenmenin özünde merak, sabır ve pratik yatmaktadır.',
            'Klavye kullanımı da bu süreçte önemli bir beceri hâline gelmiştir.',
            'Hızlı ve doğru yazabilen biri iş hayatında büyük avantaj elde eder.',
            'Düzenli çalışmayla bu beceri kısa sürede edinilebilir.',
        ].join(' '), 'Eğitim ve teknoloji temalı uzun metin yazımıyla akıcılık geliştirildi.', ASAMA.pro),

        lesson(29, 'Süreli Yazım Pratiği', [
            'Saat tam on ikide kalem kâğıda değdi ve Selin yazmaya başladı.',
            'Parmaklarının tuşlara alışkın olduğunu hissediyordu; artık klavyeye bakmıyordu.',
            'Her harf doğru tuşa gidiyordu, ritim oluşmuştu.',
            'İlk dakika yavaştı; ikinci dakikada tempo arttı, üçüncüde ise kelimeler akıp gitmeye başladı.',
            'Sınav metnini hatasız bitirmenin verdiği özgüven muazzamdı.',
            'Aylarca yapılan çalışmanın meyvesini şimdi topluyordu.',
            'Elini klavyeden kaldırdığında gülümsedi: "Oldu" dedi içinden.',
            'Bu an için çok çalışmıştı ve her saniyeye değmişti.',
        ].join(' '), 'Süreli yazım pratiğiyle akıcılık ve özgüven doruk noktasına ulaştı.', ASAMA.pro),

        // =========================================================
        // BÖLÜM 5 — Final Sınavı (L30) → 90 kelime
        // =========================================================

        lesson(30, 'Final Sınavı', [
            'F klavye on parmak eğitim programının son dersine hoş geldiniz.',
            'Bu metni hatasız ve dengeli bir hızda yazmanız beklenmektedir.',
            'Zabıt kâtipliği ve benzer mesleklerde doğruluk kritiktir.',
            'F klavye, 1955 yılında Türkçeye özel olarak geliştirilmiştir.',
            'En sık kullanılan harfler parmakların rahatça ulaşabileceği orta sıraya yerleştirilmiştir.',
            'Doğru teknikle öğrenildiğinde hız artar, hata azalır ve yorgunluk düşer.',
            'Bugün bu programı tamamlayarak gerekli kas hafızasına ve güvene ulaştınız.',
            'Artık klavyeye bakmadan yazabileceksiniz.',
            'Düzenli pratikle her geçen gün daha hızlı ve daha doğru yazacaksınız.',
            'Bu başarıyı kutluyoruz; çalışmaya devam edin.',
            'Emeğiniz için tebrikler. Başarılar diliyoruz.',
        ].join(' '), 'Final sınavı tamamlandı: tüm harfler, noktalama, sayılar ve uzun metin yazımı bütünleşik olarak pekiştirildi.', ASAMA.pro),
    ];
}(typeof window !== 'undefined' ? window : globalThis));
