/**
 * Q Klavye Dersleri — 30 ders, pedagojik sıralamayla.
 * Harf öğretim sırası (Q klavye, on parmak):
 *   L1  F J  |  L2  D K  |  L3  S L  |  L4  A G  |  L5  H İ
 *   L6  E R  |  L7  U I  |  L8  T Y  |  L9  O P  |  L10 C V
 *   L11 N M  |  L12 X Z  |  L13 Ç Ş  |  L14 B Ö  |  L15 Ü Ğ
 *   L16–20: Büyük harf + Noktalama
 *   L21–24: Sayılar
 *   L25–29: Metin yazımı
 *   L30:    Final
 */
(function (global) {

    /* Drill üreteci: 'words' listesini döngüyle tam 50 kelimeye tamamlar */
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
        temel:  'temel',
        kelime: 'kelime',
        cumle:  'cumle',
        metin:  'metin',
        pro:    'pro',
    };

    function lesson(no, title, content, kazanim, asama) {
        return { no, title, content, kazanim, asama };
    }

    global.YaziyoDerslerQ = [

        // ─────────────────────────────────────────────────────────────────
        // L1: Sadece F ve J — Ana sıra, işaret parmakları
        // ─────────────────────────────────────────────────────────────────
        lesson(1, 'F ve J — Ana Sıra Merkez',
            drill50(['fj', 'jf', 'ff', 'jj', 'fjf', 'jfj', 'ffj', 'jff']),
            'F ve J tuşları tanındı; işaret parmakları ana sıraya alıştı.', ASAMA.temel),

        // ─────────────────────────────────────────────────────────────────
        // L2: + D K — Ana sıra, orta parmaklar
        // ─────────────────────────────────────────────────────────────────
        lesson(2, 'D ve K — Ana Sıra Orta',
            drill50(['dk', 'kd', 'fd', 'jk', 'fdk', 'jkf', 'dkj', 'kfj', 'dfk', 'kjf']),
            'D ve K tuşları eklendi; dört tuşla akıcı geçiş pratikleşti.', ASAMA.temel),

        // ─────────────────────────────────────────────────────────────────
        // L3: + S L — Ana sıra, yüzük parmaklar
        // ─────────────────────────────────────────────────────────────────
        lesson(3, 'S ve L — Ana Sıra Dış',
            drill50(['sl', 'ls', 'sdf', 'lkj', 'fds', 'kls', 'sfl', 'djk', 'lds', 'skf']),
            'S ve L tuşları eklendi; altı harfle sol-sağ denge kuruldu.', ASAMA.temel),

        // ─────────────────────────────────────────────────────────────────
        // L4: + A G — İlk sesli harf! 3–4 harfli anlamlı kelimeler
        // ─────────────────────────────────────────────────────────────────
        lesson(4, 'A ve G — İlk Sesli Harf',
            drill50(['dal', 'fal', 'kal', 'sal', 'kas', 'laf', 'gala', 'asla', 'faks', 'sakal']),
            'A seslisi eklenerek ilk gerçek kelimeler yazıldı; kas hafızası başladı.', ASAMA.temel),

        // ─────────────────────────────────────────────────────────────────
        // L5: + H İ — İkinci sesli; 4 harfli anlamlı kelimeler
        // ─────────────────────────────────────────────────────────────────
        lesson(5, 'H ve İ — Ana Sıra Tamamlanıyor',
            drill50(['his', 'hal', 'halk', 'asil', 'fail', 'haki', 'halka', 'dahil', 'halas', 'ilah']),
            'H ve İ eklenerek daha anlamlı kelimeler kuruldu; el pozisyonu pekişti.', ASAMA.kelime),

        // ─────────────────────────────────────────────────────────────────
        // L6: + E R — Üst sıra sol; anlamlı kelimeler genişliyor
        // ─────────────────────────────────────────────────────────────────
        lesson(6, 'E ve R — Üst Sıra Sol',
            drill50(['her', 'ile', 'fare', 'risk', 'hedef', 'ideal', 'irade', 'fikir', 'eser', 'garaj']),
            'E ve R ile kelime dağarcığı belirgin biçimde genişledi.', ASAMA.kelime),

        // ─────────────────────────────────────────────────────────────────
        // L7: + U I — Üst sıra sağ; beş sesli birden kullanılıyor
        // ─────────────────────────────────────────────────────────────────
        lesson(7, 'U ve I — Üst Sıra Sağ',
            drill50(['ruh', 'kural', 'kısa', 'sıra', 'kulak', 'ılık', 'ıslak', 'hasar', 'husus', 'kısır']),
            'U ve I (ı) eklenerek beş sesli tam oldu; kelime akışı hızlandı.', ASAMA.kelime),

        // ─────────────────────────────────────────────────────────────────
        // L8: + T Y — Üst sıra iç; çok heceli kelimeler
        // ─────────────────────────────────────────────────────────────────
        lesson(8, 'T ve Y — Üst Sıra İç',
            drill50(['yıl', 'yurt', 'hayat', 'tarih', 'satır', 'kartal', 'fıkra', 'talihli', 'yıkık', 'yaylı']),
            'T ve Y ile çok heceli, anlamlı kelimeler yazılmaya başlandı.', ASAMA.kelime),

        // ─────────────────────────────────────────────────────────────────
        // L9: + O P — Üst sıra orta; altı sesli tam
        // ─────────────────────────────────────────────────────────────────
        lesson(9, 'O ve P — Üst Sıra Tamamlanıyor',
            drill50(['top', 'yol', 'okul', 'pilot', 'tıp', 'kayıp', 'toprak', 'kapı', 'kıyı', 'turp']),
            'O ve P eklenerek üst sıra tamamlandı; akıcı geçişler güçlendi.', ASAMA.kelime),

        // ─────────────────────────────────────────────────────────────────
        // L10: + C V — Alt sıra başlıyor; 50 kelime, sözcük listesi
        // ─────────────────────────────────────────────────────────────────
        lesson(10, 'C ve V — Alt Sıra Başlıyor',
            'pilot yolcu ile kapıya gitti yol iyi ilerliyor okul saatleri kısa hayat kolay olur yolcular garajda duruyor tarihsel varlık kalıcıdır risk alarak ilerliyor havlu ıslak sıcak olur halk tarihsel yerleri seviyor ocak ayı sert tavırla iyi oluyor vakit aktif ilerler fare kapıya gider yolculuk iyi seyir aktif hayatta risk vardır',
            'C ve V harfleriyle alt sıraya giriş yapıldı; sözcük çeşitliliği arttı.', ASAMA.kelime),

        // ─────────────────────────────────────────────────────────────────
        // L11: + N M — Cümleler artık mümkün! 50 kelime
        // ─────────────────────────────────────────────────────────────────
        lesson(11, 'N ve M — İlk Gerçek Cümleler', [
            'tren istasyona giriyor yolcular toplanıyor',
            'salon dolu hayvanlar parkı seviyor',
            'roman okumak hayata yararlıdır',
            'mavi yol sakin sorun adım adım ilerliyor',
            'veri kayıtlara giriyor numara sırayla',
            'kaplan ilerliyor keman sesi iyi',
            'insanlar meydan dolduruyor hikaye etkiler',
            'kural saygı gerektirir hayat aktif ilerler',
            'her insan yararlı olmalı verim artar para gelir',
        ].join(' '),
            'N ve M ile gerçek Türkçe cümleler kuruldu; anlam taşıyan metin yazıldı.', ASAMA.cumle),

        // ─────────────────────────────────────────────────────────────────
        // L12: + X Z — 50 kelime
        // ─────────────────────────────────────────────────────────────────
        lesson(12, 'X ve Z — Alt Sıra Genişliyor', [
            'deniz kıyısında yaz sezonu iyi ilerliyor',
            'hazır yolcular gemiyle gidiyor',
            'yıldız geceyi aydınlatıyor',
            'hızlı tren istasyona varıyor',
            'pazar dolu insanlar geziniyor',
            'zaman hızlı akıyor gazete okumak yararlı',
            'kız istasyonda gazetesini okuyor',
            'kuzey tarafı iyi seyir fizik dersinde veri iyi',
            'numara kayıtlara girer hayvan parkta seviyor',
            'roman okumak hayat zaten ilerletir',
        ].join(' '),
            'X ve Z harfleriyle kelime dağarcığı tamamlandı; cümle akışı güçlendi.', ASAMA.cumle),

        // ─────────────────────────────────────────────────────────────────
        // L13: + Ç Ş — 50 kelime
        // ─────────────────────────────────────────────────────────────────
        lesson(13, 'Ç ve Ş — Türkçeye Özgü Sesler', [
            'şehirde çalışmak iyi fırsatlar yaratır',
            'çocuklar koşarak okula gidiyor',
            'uçak piste iniyor şarkı sesleri salondan yayılıyor',
            'açık havada çay içmek keyiflidir',
            'yavaş ama kararlı ilerlemek en iyi yoldur',
            'çeşit çeşit yiyecekler pazarda satılır',
            'veri aktarımı tamamlandı raporlar hazırlandı',
            'çalışkan insan her konuda ilerler',
            'sorun da kararlı tutumla aşılır proje tamamlanıyor',
        ].join(' '),
            'Ç ve Ş harfleriyle Türkçeye özgü sesler yazıya geçirildi.', ASAMA.cumle),

        // ─────────────────────────────────────────────────────────────────
        // L14: + B Ö — 50 kelime
        // ─────────────────────────────────────────────────────────────────
        lesson(14, 'B ve Ö — Kelime Zenginliği Arttı', [
            'bir şehirde yaşamak hem keyifli hem zor olabilir',
            'başarı sabır ile gelir',
            'önce planlama sonra uygulama',
            'adım adım ilerlemek önemlidir',
            'ben her sabah okula gidiyorum',
            'bu yolda bir kafeterya var bol insan gidiyor',
            'görev saygıyla yapılır köyde hayat farklıdır',
            'söz verince tutmak şarttır banka işlemleri hızlıdır',
            'başarı her yerde kazanılır',
        ].join(' '),
            'B ve Ö harfleriyle kelime zenginliği arttı; bütünleşik cümle yapısı kuruldu.', ASAMA.cumle),

        // ─────────────────────────────────────────────────────────────────
        // L15: + Ü Ğ — Tüm harfler tamamlandı, 50 kelime, genel tekrar
        // ─────────────────────────────────────────────────────────────────
        lesson(15, 'Ü ve Ğ — Tüm Harfler Tamamlandı', [
            'öğrenci sabah erkenden derse gelir ödevlerini teslim eder',
            'büyük şehirlerde yaşam hızlı ilerler',
            'güneş doğduğunda yeni bir gün başlar',
            'müzik insanların ruhunu besler',
            'ağaçlar sonbaharda sararır yapraklar dökülür',
            'kışın soğuk havada bile çalışmak gerekir',
            'özgür düşünce güçlü toplum yaratır',
            'dağları aşan yolcular başarıya ulaşır',
            'tüm harfleri öğrendik artık akıcı yazabiliriz',
        ].join(' '),
            'Ü ve Ğ ile Q klavyenin tüm harfleri tamamlandı; kapsamlı tekrar yapıldı.', ASAMA.cumle),

        // ─────────────────────────────────────────────────────────────────
        // L16: Büyük harf + Shift — 60 kelime
        // ─────────────────────────────────────────────────────────────────
        lesson(16, 'Büyük Harf ve Shift Kullanımı', [
            'Ayşe sabah erken kalktı ve okula gitti.',
            'Mehmet bugün İstanbul\'a seyahat ediyor.',
            'Fatma öğretmenini çok seviyor ve her derste aktif katılır.',
            'Ankara Türkiye\'nin başkentidir.',
            'Bora her gün düzenli çalışır.',
            'Zeynep müzik dersine başladı.',
            'Türkçe en güzel dillerden biridir.',
            'Karadeniz kıyıları çok güzeldir.',
            'Selim her sabah koşu yapar.',
            'Elif kitap okumayı çok seviyor.',
            'Ege denizi mavidir.',
            'Hasan her zaman başarılı olur.',
        ].join(' '),
            'Büyük harf ve Shift tuşu kullanımı öğrenildi; cümle başlangıçları ve özel isimler yazıldı.', ASAMA.metin),

        // ─────────────────────────────────────────────────────────────────
        // L17: Nokta ve virgül — 60 kelime
        // ─────────────────────────────────────────────────────────────────
        lesson(17, 'Nokta ve Virgül', [
            'Sabah güneş doğdu, kuşlar ötmeye başladı.',
            'Ekmek, peynir ve zeytin güzel bir kahvaltı yapar.',
            'Kitap okumak zihni geliştirir, kelime dağarcığını zenginleştirir.',
            'Öğrenciler derse geldi, ödevlerini teslim etti.',
            'Irmak dağdan indi, ovada genişledi.',
            'Yolculuk başladı, ilk durak iki saat sonra.',
            'Meyve, sebze ve tahıllar sağlıklı beslenmenin temelidir.',
            'Çalışmak önemlidir, dinlenmek de gereklidir.',
            'Hava soğudu, insanlar içeri girdi.',
            'Bahar geldi, çiçekler açtı, park doldu.',
        ].join(' '),
            'Nokta ve virgül kullanımı pekişti; cümle sonu ve liste virgülü doğru yazıldı.', ASAMA.metin),

        // ─────────────────────────────────────────────────────────────────
        // L18: Soru ve ünlem işareti — 60 kelime
        // ─────────────────────────────────────────────────────────────────
        lesson(18, 'Soru ve Ünlem İşareti', [
            'Bu kitabı sen mi yazdın?',
            'Hayır, onu bir arkadaşım önerdi!',
            'Bugün hava nasıl?',
            'Çok güzel, dışarı çıkmak için mükemmel!',
            'Sınav ne zaman başlıyor?',
            'Yarın sabah saat dokuzda başlıyor!',
            'Bunu daha önce hiç yaptın mı?',
            'Evet, çok kez yaptım ve her seferinde keyif aldım!',
            'Hangi şehirde yaşıyorsun?',
            'İzmir\'de yaşıyorum, denizi çok seviyorum!',
            'Tekrar gidecek misin?',
            'Elbette, her yaz gidiyorum!',
        ].join(' '),
            'Soru ve ünlem işaretleri yazıldı; diyalog metinlerinde doğal akış sağlandı.', ASAMA.metin),

        // ─────────────────────────────────────────────────────────────────
        // L19: İki nokta ve noktalı virgül — 60 kelime
        // ─────────────────────────────────────────────────────────────────
        lesson(19, 'İki Nokta ve Noktalı Virgül', [
            'Şu malzemelere ihtiyacım var: un, yumurta, şeker ve tereyağı.',
            'Yemeği hazırladım; herkes sofraya gelebilir.',
            'İki temel kural var: doğruluk ve düzenlilik.',
            'Türkiye\'nin dört büyük şehri: İstanbul, Ankara, İzmir ve Bursa.',
            'Projeyi bitirdim; şimdi dinlenme zamanı.',
            'Güzel bir gün geçirdik; ama çok yorulduk.',
            'Üç önemli değer: sabır, çalışkanlık ve dürüstlük.',
            'Toplantı sona erdi; herkes işine döndü.',
            'Tatil planı hazır: dağ, deniz ve müze.',
        ].join(' '),
            'İki nokta ve noktalı virgül kullanımı öğrenildi; liste ve bağlaç yapıları yazıldı.', ASAMA.metin),

        // ─────────────────────────────────────────────────────────────────
        // L20: Tırnak ve parantez — 60 kelime
        // ─────────────────────────────────────────────────────────────────
        lesson(20, 'Tırnak İşareti ve Parantez', [
            'Öğretmen "Yarın sınav var" dedi.',
            'Kitabın adı "Küçük Prens" (Antoine de Saint-Exupéry).',
            '"Çalışmak başarının anahtarıdır" sözünü hep hatırlarım.',
            'Proje raporu (ekte sunulmuştur) incelemenizi bekliyor.',
            '"Sabır taşı çatlar" diye bir deyim vardır.',
            'Sonuçlar (Tablo 3\'e bakınız) oldukça başarılıdır.',
            '"Güneş her gün doğar" dedi ve yola koyuldu.',
            'Toplantı tarihi (15 Mart) değişmeyecek.',
            '"Azimle çalışanlar her zaman hedeflerine ulaşır" dedi gülerek.',
        ].join(' '),
            'Tırnak işareti ve parantez kullanımı öğrenildi; alıntı ve açıklama yazımı tamamlandı.', ASAMA.metin),

        // ─────────────────────────────────────────────────────────────────
        // L21: Sayılar 0–9 — 60 kelime
        // ─────────────────────────────────────────────────────────────────
        lesson(21, 'Rakamlar: 0\'dan 9\'a', [
            'Sınıfta 30 öğrenci var, 5 tanesi bugün yok.',
            'Yarışmada 1. olan kişi 250 puan aldı.',
            'Sepette 8 elma, 4 armut ve 6 portakal vardı.',
            'Görev 7 gün içinde tamamlanmalı.',
            'Bu binanın 9 katı ve 36 dairesi var.',
            'Toplantıya 12 kişi katıldı, 3 kişi izin aldı.',
            'Arabanın yakıt tüketimi 100 km\'de 6 litredir.',
            '0\'dan başlayıp 9\'a kadar sayıyoruz.',
            'Etkinliğe 200 kişi başvurdu, 50\'si seçildi.',
        ].join(' '),
            '0–9 rakamları klavyeden yazıldı; sayısal ifadeler metne katıldı.', ASAMA.metin),

        // ─────────────────────────────────────────────────────────────────
        // L22: Tarih ve saat — 60 kelime
        // ─────────────────────────────────────────────────────────────────
        lesson(22, 'Tarih ve Saat Yazımı', [
            'Toplantı 15/09/2025 tarihinde saat 10:00\'da başlayacak.',
            'Cumhuriyet 29 Ekim 1923\'te ilan edildi.',
            'Tren 08:45\'te kalkıyor, 13:30\'da varıyor.',
            'Doğum tarihi: 03.07.1998.',
            'Akşam 19:00\'da buluşalım, 21:00\'a kadar kalabiliriz.',
            'Sınav 12 Ocak 2026 Pazartesi günü saat 09:30\'da.',
            'Kargo 24/11/2024 tarihinde gönderildi.',
            'Film 20:15\'te başlıyor, 22:45\'te bitiyor.',
            'Sipariş 30 Mayıs 2025 Cuma günü verildi.',
            'Dersin başlangıç saati 08:00, bitiş saati 10:30 olarak belirlendi.',
        ].join(' '),
            'Tarih ve saat yazımı öğrenildi; gün-ay-yıl ve saat formatları kullanıldı.', ASAMA.metin),

        // ─────────────────────────────────────────────────────────────────
        // L23: Telefon, para, yüzde — 60 kelime
        // ─────────────────────────────────────────────────────────────────
        lesson(23, 'Telefon, Para ve Yüzde', [
            'Müşteri hizmetleri numarası: 0850 222 44 66.',
            'Ürünün fiyatı 349,90 TL, %15 indirimle 297,42 TL oldu.',
            'Acil servis için 112\'yi arayın.',
            'Döviz kuru: 1 dolar = 32,75 TL.',
            'Bu ay enflasyon oranı %3,8 olarak açıklandı.',
            'Mağaza telefonu: (0212) 555 77 88.',
            'Fatura tutarı 1.250 TL; KDV dahil toplam 1.475 TL.',
            'Katılım oranı %92 ile rekor kırdı.',
            'Kargo ücreti 0–3 kg için 39,90 TL.',
        ].join(' '),
            'Telefon, para ve yüzde ifadeleri yazıldı; nokta ve virgürlü sayısal formatlar pekişti.', ASAMA.metin),

        // ─────────────────────────────────────────────────────────────────
        // L24: Ondalık sayılar — 60 kelime
        // ─────────────────────────────────────────────────────────────────
        lesson(24, 'Ondalık ve Kesirli Sayılar', [
            'Pi sayısı 3,14159 olarak bilinir.',
            'Deney sonucu 0,75 ile 1,25 arasında değişti.',
            'Ortalama sıcaklık bu ay 18,4 derece ölçüldü.',
            'Ürün ağırlığı 2,550 kg, hacmi 3,75 litredir.',
            'Hız 87,6 km/s olarak kaydedildi.',
            'Bütçenin %62,5\'i altyapıya ayrıldı.',
            'Puan ortalaması 4,73 üzerinden 3,58 olarak hesaplandı.',
            'Fiyat 0,99 TL artarak 14,99 TL\'ye yükseldi.',
            'Stok miktarı 12.450,00 adet olarak güncellendi.',
            'Hesaplama sonucu 0,001 ile 99,99 arasında değişiyor.',
        ].join(' '),
            'Ondalık ve kesirli sayılar yazıldı; virgüllü rakam formatı pekiştirildi.', ASAMA.metin),

        // ─────────────────────────────────────────────────────────────────
        // L25: Metin yazımı — gerçek hayat konusu, 60 kelime
        // ─────────────────────────────────────────────────────────────────
        lesson(25, 'Metin Yazımı — Doğa ve Çevre', [
            'Ormanlar dünyamızın ciğerleridir.',
            'Her yıl milyonlarca ağaç kesiliyor, bu durum iklimi tehdit ediyor.',
            'Yağmur ormanları sayısız canlı türüne ev sahipliği yapar.',
            'Denizler ise gezegenimizin ısısını düzenleyen dev bir sistem gibi çalışır.',
            'Geri dönüşüm, enerji tasarrufu ve bisiklet kullanımı gibi küçük adımlar büyük fark yaratır.',
            'Çocuklarımıza yeşil ve temiz bir dünya bırakmak herkesin sorumluluğudur.',
            'Sürdürülebilir bir gelecek için bugünden adım atmak herkesin görevidir.',
        ].join(' '),
            'Gerçek bir konu üzerine bağlantılı paragraf yazıldı; metin akışı ve noktalama birlikte pekişti.', ASAMA.metin),

        // ─────────────────────────────────────────────────────────────────
        // L26: Metin yazımı — 70 kelime
        // ─────────────────────────────────────────────────────────────────
        lesson(26, 'Metin Yazımı — Teknoloji ve İnsan', [
            'Teknoloji son yirmi yılda inanılmaz bir hızla ilerledi.',
            'Akıllı telefonlar, bulut sistemleri ve yapay zekâ artık günlük hayatın ayrılmaz parçası oldu.',
            'Bu gelişmeler insanların çalışma ve iletişim biçimini kökten değiştirdi.',
            'Ancak teknolojiyi doğru ve bilinçli kullanmak büyük önem taşıyor.',
            'Ekrana baktığımız süreyi dengelemek, yüz yüze iletişimi korumak ve dijital okuryazarlığı geliştirmek şart.',
            'Teknolojiyi bir araç olarak kullanırsak, o zaman gerçek anlamda güçlenebiliriz.',
            'Bilinçli kullanım, teknolojiyi bir fırsata dönüştürmenin anahtarıdır.',
        ].join(' '),
            'Teknoloji temalı uzun metin yazıldı; paragraf bütünlüğü ve akıcılık geliştirildi.', ASAMA.metin),

        // ─────────────────────────────────────────────────────────────────
        // L27: Metin yazımı — 70 kelime
        // ─────────────────────────────────────────────────────────────────
        lesson(27, 'Metin Yazımı — Spor ve Sağlık', [
            'Düzenli spor yapmak, hem bedeni hem de zihni güçlü tutar.',
            'Araştırmalar, haftada en az üç gün egzersiz yapan kişilerin daha mutlu ve üretken olduğunu gösteriyor.',
            'Yürüyüş, yüzme ve bisiklet gibi kardiyo egzersizleri kalp sağlığını korur.',
            'Streç hareketleri ise kasları esnetir, sakatlanma riskini azaltır.',
            'Bunların yanı sıra yeterli uyku ve dengeli beslenme de sağlıklı yaşamın temel taşlarıdır.',
            'Küçük adımlarla başlayın, tutarlı olun; sonuçlar zamanla kendiliğinden gelecektir.',
            'Aktif kalmak uzun ve sağlıklı yaşamın temelidir.',
        ].join(' '),
            'Spor ve sağlık temalı metin yazıldı; bağlaç ve geçiş ifadeleri doğal biçimde kullanıldı.', ASAMA.metin),

        // ─────────────────────────────────────────────────────────────────
        // L28: Metin yazımı — 70 kelime
        // ─────────────────────────────────────────────────────────────────
        lesson(28, 'Metin Yazımı — Eğitim ve Öğrenme', [
            'Öğrenme, yaşam boyu devam eden bir süreçtir.',
            'Okul yıllarında edinilen bilgiler, mesleki hayatın temelini oluşturur.',
            'Ancak gerçek öğrenme yalnızca sınıfla sınırlı değildir; kitaplar, deneyimler ve insanlar da birer öğretmendir.',
            'Yabancı dil öğrenmek, yeni kapılar aralamak anlamına gelir.',
            'Müzik, resim ve el sanatları gibi alanlardaki beceriler yaratıcılığı besler.',
            'Her yeni şey öğrendiğinizde beyniniz gelişir, dünyaya bakışınız genişler.',
            'Araştırmalar; düzenli ders çalışan, soru soran ve kitap okuyan öğrencilerin çok daha başarılı olduğunu ortaya koyuyor.',
        ].join(' '),
            'Eğitim temalı metin yazıldı; uzun ve karmaşık cümleler akıcı biçimde yazıldı.', ASAMA.metin),

        // ─────────────────────────────────────────────────────────────────
        // L29: Metin yazımı — 70 kelime
        // ─────────────────────────────────────────────────────────────────
        lesson(29, 'Metin Yazımı — İş Hayatı ve Kariyer', [
            'Başarılı bir kariyer inşa etmek, uzun vadeli bir plan gerektirir.',
            'Önce kendinizi tanıyın: güçlü ve zayıf yönlerinizi belirleyin.',
            'Ardından hedefler koyun ve bu hedeflere ulaşmak için somut adımlar atın.',
            'İş dünyasında iletişim becerileri, teknik bilgi kadar önemlidir.',
            'Takım çalışması, problem çözme ve eleştirel düşünce gibi yetkinlikler sizi öne çıkarır.',
            'En önemlisi, değişime açık olun; çünkü iş dünyası sürekli dönüşüyor.',
            'Kişisel gelişim kitapları, online kurslar ve mentorluk programları bu yolculukta size destek olabilir.',
        ].join(' '),
            'İş hayatı temalı metin yazıldı; farklı cümle yapıları ve bağlaçlar ustaca kullanıldı.', ASAMA.metin),

        // ─────────────────────────────────────────────────────────────────
        // L30: Final Sınavı — 90 kelime
        // ─────────────────────────────────────────────────────────────────
        lesson(30, 'Final Sınavı', [
            'Q klavye eğitim programının son dersine hoş geldiniz.',
            'Bu metni hatasız, dengeli ve akıcı bir hızda yazmanız beklenmektedir.',
            'Veri giriş uzmanlığı ve sekreterlik gibi mesleklerde doğruluk her şeyden önce gelir.',
            'Q klavye, dünya genelinde en yaygın kullanılan klavye düzenidir.',
            'On parmak tekniğiyle öğrenildiğinde yazma hızı artar, hata oranı düşer ve uzun süreli çalışmada yorgunluk azalır.',
            'Bu programı tamamlayarak gerekli kas hafızasını ve özgüveni kazandınız.',
            'Artık ekrana ve klavyeye bakmadan, doğal bir akışla yazabileceksiniz.',
            'Düzenli pratikle her gün biraz daha hızlı ve daha doğru yazacaksınız.',
            'Emeğiniz ve azminiz için tebrikler; başarılar dileriz.',
        ].join(' '),
            'Final sınavı tamamlandı: tüm harfler, noktalama işaretleri, rakamlar ve uzun metin bütünleşik olarak pekiştirildi.', ASAMA.pro),

    ];

}(typeof window !== 'undefined' ? window : globalThis));
