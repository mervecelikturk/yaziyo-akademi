/**
 * YAZİYO — Eğitimlerim veri katmanı (Supabase ↔ UI)
 * Kullanıcı paneli + admin yönetimi için ortak API.
 */
import { supabase } from './supabase.js';

/* ---------- Sabitler (admin / kullanıcı ortak) ---------- */

/** Admin'in kullanıcıya atayabileceği başarı rozetleri */
export const BASARI_ROZETLERI = {
    ilk_adim: { id: 'ilk_adim', label: 'İlk Adım', icon: 'fa-shoe-prints', hint: 'Eğitime başlangıç' },
    azim: { id: 'azim', label: 'Azim Rozeti', icon: 'fa-fire', hint: 'Düzenli çalışma' },
    hiz_ustasi: { id: 'hiz_ustasi', label: 'Hız Ustası', icon: 'fa-gauge-high', hint: 'Hız testi başarısı' },
    disiplin: { id: 'disiplin', label: 'Disiplin Rozeti', icon: 'fa-clipboard-check', hint: 'Görev tamamlama' },
    yildiz: { id: 'yildiz', label: 'Yıldız Öğrenci', icon: 'fa-star', hint: 'Üstün performans' },
    maratoncu: { id: 'maratoncu', label: 'Maratoncu', icon: 'fa-flag-checkered', hint: 'Uzun soluklu ilerleme' },
    mukemmeliyetci: { id: 'mukemmeliyetci', label: 'Mükemmeliyetçi', icon: 'fa-trophy', hint: 'Hedef üstü net' },
    mentor_favorisi: { id: 'mentor_favorisi', label: 'Mentor Favorisi', icon: 'fa-heart', hint: 'Koç takdirı' }
};

/** Admin'in günlük nota bırakabileceği emojiler */
export const NOT_EMOJILERI = {
    gulenyuz: { id: 'gulenyuz', emoji: '😊', label: 'Gülen yüz' },
    aglayan: { id: 'aglayan', emoji: '😢', label: 'Ağlayan yüz' },
    endiseli: { id: 'endiseli', emoji: '😟', label: 'Endişeli' },
    sasirmis: { id: 'sasirmis', emoji: '😲', label: 'Şaşırmış' },
    uzgun: { id: 'uzgun', emoji: '😔', label: 'Üzgün' },
    mutlu: { id: 'mutlu', emoji: '😄', label: 'Mutlu' }
};

export const GOREV_DURUMLARI = {
    baslamadi: { id: 'baslamadi', label: 'Başlamadı' },
    devam_ediyor: { id: 'devam_ediyor', label: 'Devam ediyor' },
    tamamlandi: { id: 'tamamlandi', label: 'Tamamlandı' },
    atlandi: { id: 'atlandi', label: 'Atlandı' }
};

export const TAKVIM_DURUMLARI = {
    planlandi: { id: 'planlandi', label: 'Planlandı' },
    gerceklesti: { id: 'gerceklesti', label: 'Gerçekleşti' },
    iptal_edildi: { id: 'iptal_edildi', label: 'İptal edildi' },
    ertelendi: { id: 'ertelendi', label: 'Ertelendi' }
};

export const BELGE_TURLERI = {
    katilim: { id: 'katilim', label: 'Katılım Belgesi' },
    tamamlama: { id: 'tamamlama', label: 'Tamamlama Belgesi' },
    basari: { id: 'basari', label: 'Başarı Belgesi' }
};

export function isEgitimlerimMissingError(error) {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    return (
        error.code === 'PGRST205'
        || error.code === 'PGRST202'
        || msg.includes('egitimlerim_')
        || msg.includes('schema cache')
    );
}

function todayIstanbul() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
}

function daysRemaining(endIso) {
    if (!endIso) return null;
    const end = new Date(endIso);
    const now = new Date();
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return diff;
}

/* ---------- Profil ---------- */

export async function fetchEgitimlerimProfil(userId, client = supabase) {
    if (!client || !userId) return { data: null, error: null };
    const { data, error } = await client
        .from('egitimlerim_profiller')
        .select('*')
        .eq('kullanici_id', userId)
        .maybeSingle();
    return { data, error };
}

export async function upsertEgitimlerimProfil(payload, client = supabase) {
    if (!client || !payload?.kullanici_id) {
        return { data: null, error: new Error('Kullanıcı gerekli') };
    }
    const row = {
        kullanici_id: payload.kullanici_id,
        koc_adi: (payload.koc_adi || '').trim(),
        basari_rozeti: payload.basari_rozeti || null,
        hedef_hiz_net: Math.max(1, parseInt(payload.hedef_hiz_net, 10) || 40),
        hedef_3dk_net: Math.max(1, parseInt(payload.hedef_3dk_net, 10) || 90),
        sonraki_gorusme: payload.sonraki_gorusme || null,
        aktif: payload.aktif !== false,
        notlar_admin: payload.notlar_admin || '',
        updated_at: new Date().toISOString()
    };
    const { data, error } = await client
        .from('egitimlerim_profiller')
        .upsert(row, { onConflict: 'kullanici_id' })
        .select('*')
        .single();
    return { data, error };
}

/* ---------- Günlük not ---------- */

export async function fetchBugunkuNot(userId, client = supabase) {
    if (!client || !userId) return { data: null, error: null };
    const { data, error } = await client
        .from('egitimlerim_gunluk_notlar')
        .select('*')
        .eq('kullanici_id', userId)
        .eq('not_tarihi', todayIstanbul())
        .maybeSingle();
    return { data, error };
}

export async function saveBugunkuNot(userId, icerik, client = supabase) {
    if (!client || !userId) return { data: null, error: new Error('Oturum gerekli') };
    const text = String(icerik || '').slice(0, 256);
    const { data, error } = await client
        .from('egitimlerim_gunluk_notlar')
        .upsert(
            {
                kullanici_id: userId,
                not_tarihi: todayIstanbul(),
                icerik: text,
                updated_at: new Date().toISOString()
            },
            { onConflict: 'kullanici_id,not_tarihi' }
        )
        .select('*')
        .single();
    return { data, error };
}

export async function fetchNotlarAdmin(userId, client = supabase, limit = 30) {
    if (!client || !userId) return { data: [], error: null };
    const { data, error } = await client
        .from('egitimlerim_gunluk_notlar')
        .select('*')
        .eq('kullanici_id', userId)
        .order('not_tarihi', { ascending: false })
        .limit(limit);
    return { data: data || [], error };
}

export async function setNotEmoji(notId, emojiId, client = supabase) {
    if (!client || !notId) return { error: new Error('Geçersiz istek') };
    const { error } = await client
        .from('egitimlerim_gunluk_notlar')
        .update({ admin_emoji: emojiId || null, updated_at: new Date().toISOString() })
        .eq('id', notId);
    return { error };
}

/** Yönetici notu siler (yetki: sql/034 "Admins delete daily notes" politikası) */
export async function deleteNot(notId, client = supabase) {
    if (!client || !notId) return { error: new Error('Geçersiz istek') };
    const { error } = await client
        .from('egitimlerim_gunluk_notlar')
        .delete()
        .eq('id', notId);
    return { error };
}

/* ---------- Görevler ---------- */

export async function fetchGorevler(userId, client = supabase) {
    if (!client || !userId) return { data: [], error: null };
    const { data, error } = await client
        .from('egitimlerim_gorevler')
        .select('*')
        .eq('kullanici_id', userId)
        .order('sira', { ascending: true })
        .order('created_at', { ascending: true });
    return { data: data || [], error };
}

export async function upsertGorev(item, client = supabase) {
    if (!client) return { data: null, error: new Error('Bağlantı yok') };
    const payload = {
        kullanici_id: item.kullanici_id,
        baslik: (item.baslik || '').trim(),
        aciklama: (item.aciklama || '').trim(),
        tahmini_sure_dk: Math.max(1, parseInt(item.tahmini_sure_dk, 10) || 15),
        oncelik: item.oncelik === 'zorunlu' ? 'zorunlu' : 'onerilen',
        durum: GOREV_DURUMLARI[item.durum] ? item.durum : 'baslamadi',
        sira: parseInt(item.sira, 10) || 0,
        updated_at: new Date().toISOString()
    };
    if (!payload.baslik) return { data: null, error: new Error('Görev başlığı zorunlu') };

    if (item.id) {
        const { data, error } = await client
            .from('egitimlerim_gorevler')
            .update(payload)
            .eq('id', item.id)
            .select('*')
            .single();
        return { data, error };
    }
    const { data, error } = await client
        .from('egitimlerim_gorevler')
        .insert(payload)
        .select('*')
        .single();
    return { data, error };
}

export async function updateGorevDurum(gorevId, durum, client = supabase) {
    if (!client || !gorevId || !GOREV_DURUMLARI[durum]) {
        return { error: new Error('Geçersiz durum') };
    }
    const { data, error } = await client
        .from('egitimlerim_gorevler')
        .update({ durum, updated_at: new Date().toISOString() })
        .eq('id', gorevId)
        .select('*')
        .single();
    return { data, error };
}

export async function deleteGorev(id, client = supabase) {
    if (!client || !id) return { error: new Error('Geçersiz istek') };
    const { error } = await client.from('egitimlerim_gorevler').delete().eq('id', id);
    return { error };
}

/** Günlük görev özeti — otomatik: zorunlu + bugün tamamlanmayanlar */
export function buildGunlukGorevOzeti(gorevler = []) {
    const list = gorevler || [];
    const zorunlu = list.filter((g) => g.oncelik === 'zorunlu');
    const tamamlanan = list.filter((g) => g.durum === 'tamamlandi').length;
    const devam = list.filter((g) => g.durum === 'devam_ediyor').length;
    const bekleyen = list.filter((g) => g.durum === 'baslamadi').length;
    return {
        toplam: list.length,
        zorunlu: zorunlu.length,
        tamamlanan,
        devam,
        bekleyen,
        metin: list.length
            ? `${tamamlanan}/${list.length} tamamlandı · ${zorunlu.length} zorunlu · ${bekleyen} başlamadı`
            : 'Bugün için atanmış görev yok.'
    };
}

/* ---------- Paket / hoş geldin verisi ---------- */

export async function fetchKullaniciPaketOzeti(userId, client = supabase) {
    if (!client || !userId) return { data: null, error: null };

    // Önce aktif paket; durum kolonu yoksa tüm kayıtlardan en sonuncusu
    let data = null;
    let error = null;

    const aktifQuery = await client
        .from('egitim_paketi_satin_almalar')
        .select('id, paket_id, satin_alma_tarihi, bitis_tarihi, gecerlilik_gun, fiyat, durum, egitim_paketleri(baslik)')
        .eq('kullanici_id', userId)
        .eq('durum', 'aktif')
        .order('satin_alma_tarihi', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (aktifQuery.error) {
        const msg = (aktifQuery.error.message || '').toLowerCase();
        if (msg.includes('durum') || aktifQuery.error.code === '42703') {
            const fallback = await client
                .from('egitim_paketi_satin_almalar')
                .select('id, paket_id, satin_alma_tarihi, bitis_tarihi, gecerlilik_gun, fiyat, egitim_paketleri(baslik)')
                .eq('kullanici_id', userId)
                .order('satin_alma_tarihi', { ascending: false })
                .limit(1)
                .maybeSingle();
            data = fallback.data;
            error = fallback.error;
        } else {
            return { data: null, error: aktifQuery.error };
        }
    } else {
        data = aktifQuery.data;
        error = null;
    }

    if (error) return { data: null, error };
    if (!data) return { data: null, error: null };

    const bitis = data.bitis_tarihi;
    const kalan = daysRemaining(bitis);
    return {
        data: {
            satinAlmaId: data.id,
            paketId: data.paket_id,
            paketAdi: data.egitim_paketleri?.baslik || 'Eğitim Paketi',
            fiyat: Number(data.fiyat) || 0,
            baslangic: data.satin_alma_tarihi,
            bitis,
            kalanGun: kalan,
            gecerlilikGun: data.gecerlilik_gun,
            suresiDoldu: kalan != null && kalan < 0,
            durum: data.durum || 'aktif'
        },
        error: null
    };
}

export async function fetchOkunmamisMesajSayisi(userId, client = supabase) {
    if (!client || !userId) return { count: 0, error: null };
    const { count, error } = await client
        .from('bildirimler')
        .select('id', { count: 'exact', head: true })
        .eq('kullanici_id', userId)
        .eq('okundu', false);
    return { count: count || 0, error };
}

/* ---------- İlerleme ---------- */

export async function fetchIlerlemeOzeti(userId = null, client = supabase) {
    if (!client) return { data: null, error: new Error('Bağlantı yok') };
    const { data, error } = await client.rpc('egitimlerim_ilerleme_ozeti', {
        p_kullanici_id: userId
    });
    if (error) return { data: null, error };
    return { data, error: null };
}

/* ---------- Takvim ---------- */

export async function fetchTakvimKullanici(client = supabase) {
    if (!client) return { data: [], error: null };
    const { data, error } = await client.rpc('egitimlerim_takvim_listele');
    if (error) return { data: [], error };
    const sorted = [...(data || [])].sort((a, b) =>
        String(a.baslangic || '').localeCompare(String(b.baslangic || ''))
    );
    return { data: sorted, error: null };
}

export async function fetchTakvimAdmin(client = supabase) {
    if (!client) return { data: [], error: null };
    const { data, error } = await client
        .from('egitimlerim_takvim')
        .select('*')
        .order('baslangic', { ascending: true });
    return { data: data || [], error };
}

export async function upsertTakvimEvent(item, client = supabase) {
    if (!client) return { data: null, error: new Error('Bağlantı yok') };
    const payload = {
        kullanici_id: item.kullanici_id,
        baslik: (item.baslik || 'Görüşme').trim(),
        tur: item.tur === 'online_ders' ? 'online_ders' : 'gorusme',
        baslangic: item.baslangic,
        bitis: item.bitis,
        durum: TAKVIM_DURUMLARI[item.durum] ? item.durum : 'planlandi',
        notlar: item.notlar || '',
        updated_at: new Date().toISOString()
    };
    if (!payload.kullanici_id || !payload.baslangic || !payload.bitis) {
        return { data: null, error: new Error('Kullanıcı, başlangıç ve bitiş zorunlu') };
    }
    if (item.id) {
        const { data, error } = await client
            .from('egitimlerim_takvim')
            .update(payload)
            .eq('id', item.id)
            .select('*')
            .single();
        return { data, error };
    }
    const { data, error } = await client
        .from('egitimlerim_takvim')
        .insert(payload)
        .select('*')
        .single();
    return { data, error };
}

export async function deleteTakvimEvent(id, client = supabase) {
    if (!client || !id) return { error: new Error('Geçersiz istek') };
    const { error } = await client.from('egitimlerim_takvim').delete().eq('id', id);
    return { error };
}

/* ---------- Etüt ---------- */

export async function fetchEtutler(client = supabase, admin = false) {
    if (!client) return { data: [], error: null };
    let q = client.from('egitimlerim_etutler').select('*').order('baslangic', { ascending: true });
    if (!admin) q = q.eq('aktif', true);
    const { data, error } = await q;
    return { data: data || [], error };
}

export async function upsertEtut(item, client = supabase) {
    if (!client) return { data: null, error: new Error('Bağlantı yok') };
    const payload = {
        baslik: (item.baslik || 'Etüt Odası').trim(),
        baslangic: item.baslangic,
        bitis: item.bitis,
        meet_url: (item.meet_url || '').trim(),
        aktif: item.aktif !== false
    };
    if (!payload.baslangic || !payload.bitis || !payload.meet_url) {
        return { data: null, error: new Error('Başlangıç, bitiş ve Meet linki zorunlu') };
    }
    if (item.id) {
        const { data, error } = await client
            .from('egitimlerim_etutler')
            .update(payload)
            .eq('id', item.id)
            .select('*')
            .single();
        return { data, error };
    }
    const { data, error } = await client
        .from('egitimlerim_etutler')
        .insert(payload)
        .select('*')
        .single();
    return { data, error };
}

export async function deleteEtut(id, client = supabase) {
    if (!client || !id) return { error: new Error('Geçersiz istek') };
    const { error } = await client.from('egitimlerim_etutler').delete().eq('id', id);
    return { error };
}

export async function fetchEtutKatilimSayisi(userId, client = supabase) {
    if (!client || !userId) return { count: 0, error: null };
    const { count, error } = await client
        .from('egitimlerim_etut_katilim')
        .select('id', { count: 'exact', head: true })
        .eq('kullanici_id', userId);
    return { count: count || 0, error };
}

export async function kaydetEtutKatilim(etutId, userId, client = supabase) {
    if (!client || !etutId || !userId) return { error: new Error('Geçersiz istek') };
    const { error } = await client
        .from('egitimlerim_etut_katilim')
        .upsert({ etut_id: etutId, kullanici_id: userId }, { onConflict: 'etut_id,kullanici_id' });
    return { error };
}

/* ---------- Belgeler ---------- */

export async function fetchBelgeler(userId, client = supabase) {
    if (!client || !userId) return { data: [], error: null };
    const { data, error } = await client
        .from('egitimlerim_belgeler')
        .select('id, belge_turu, baslik, dosya_adi, alici_adi, egitim_adi, koc_adi, created_at')
        .eq('kullanici_id', userId)
        .order('created_at', { ascending: false });
    return { data: data || [], error };
}

export async function fetchBelgeDownload(belgeId, client = supabase) {
    if (!client || !belgeId) return { data: null, error: new Error('Geçersiz istek') };
    const { data, error } = await client
        .from('egitimlerim_belgeler')
        .select('id, baslik, dosya_adi, dosya_base64, belge_turu')
        .eq('id', belgeId)
        .single();
    return { data, error };
}

export async function gonderBelge(payload, client = supabase) {
    if (!client) return { data: null, error: new Error('Bağlantı yok') };
    const row = {
        kullanici_id: payload.kullanici_id,
        belge_turu: payload.belge_turu,
        baslik: payload.baslik,
        dosya_adi: payload.dosya_adi,
        dosya_base64: payload.dosya_base64,
        alici_adi: payload.alici_adi || '',
        egitim_adi: payload.egitim_adi || '',
        koc_adi: payload.koc_adi || '',
        baslangic_tarihi: payload.baslangic_tarihi || null,
        bitis_tarihi: payload.bitis_tarihi || null,
        belge_tarihi: payload.belge_tarihi || null
    };
    if (!row.kullanici_id || !BELGE_TURLERI[row.belge_turu] || !row.dosya_base64) {
        return { data: null, error: new Error('Kullanıcı, belge türü ve PDF zorunlu') };
    }
    const { data, error } = await client
        .from('egitimlerim_belgeler')
        .insert(row)
        .select('id, belge_turu, baslik, dosya_adi, alici_adi, egitim_adi, koc_adi, created_at')
        .single();
    return { data, error };
}

/**
 * Kullanıcıya bildirim gönderir (bildirim çanı).
 * Sunucu tarafındaki gonder_admin_bildirim RPC'si kullanılır; belge gönderimi
 * gibi işlemlerden sonra çağrılır. Bildirim başarısız olsa da ana işlem bozulmaz.
 */
export async function bildirimGonder({ kullanici_id, baslik, mesaj }, client = supabase) {
    if (!client || !kullanici_id || !mesaj) return { error: new Error('Geçersiz istek') };
    const { data, error } = await client.rpc('gonder_admin_bildirim', {
        p_kullanici_id: kullanici_id,
        p_mesaj: mesaj,
        p_baslik: baslik || null
    });
    if (error) return { error };
    if (data && data.success === false) {
        return { error: new Error(data.message || 'Bildirim gönderilemedi') };
    }
    return { error: null };
}

/* ---------- Admin: seçilen kullanıcının istatistikleri ve çalışmaları ---------- */

/** sql/034 — admin_kullanici_ozeti: kelime, kombo, süre, 3dk rekoru, sıralama */
export async function fetchAdminKullaniciOzeti(userId, client = supabase) {
    if (!client || !userId) return { data: null, error: new Error('Kullanıcı gerekli') };
    const { data, error } = await client.rpc('admin_kullanici_ozeti', {
        p_kullanici_id: userId
    });
    if (!error && data && data.success === false) {
        return { data: null, error: new Error(data.message || 'İstatistik alınamadı') };
    }
    if (!error && data) return { data, error: null };

    // RPC henüz yoksa kullanicilar tablosundan oku (admin listesi zaten açık)
    const { data: row, error: rowError } = await client
        .from('kullanicilar')
        .select('toplam_kelime, en_yuksek_kombo, calisma_sure_saniye, en_yuksek_3dk_kelime')
        .eq('id', userId)
        .maybeSingle();
    if (rowError || !row) {
        const msg = error?.message || rowError?.message || 'İstatistik alınamadı';
        if (/admin_kullanici_ozeti|schema cache|PGRST202/i.test(msg)) {
            return { data: null, error: new Error('İstatistik sistemi henüz kurulmamış. sql/034_admin_egitimlerim.sql dosyasını çalıştırın.') };
        }
        return { data: null, error: new Error(msg) };
    }
    const toplam = Number(row.toplam_kelime) || 0;
    const { count } = await client
        .from('kullanicilar')
        .select('id', { count: 'exact', head: true })
        .gt('toplam_kelime', toplam);
    return {
        data: {
            success: true,
            toplam_kelime: toplam,
            en_yuksek_kombo: row.en_yuksek_kombo || 0,
            calisma_sure_saniye: row.calisma_sure_saniye || 0,
            en_yuksek_3dk_kelime: row.en_yuksek_3dk_kelime || 0,
            genel_siralama: (count ?? 0) + 1
        },
        error: null
    };
}

/** sql/034 — admin_kullanici_calismalari: son N günün çalışma kayıtları */
export async function fetchAdminKullaniciCalismalari(userId, gun = 5, client = supabase) {
    if (!client || !userId) return { data: null, error: new Error('Kullanıcı gerekli') };
    const { data, error } = await client.rpc('admin_kullanici_calismalari', {
        p_kullanici_id: userId,
        p_gun: gun
    });
    if (error) {
        if (/admin_kullanici_calismalari|schema cache|PGRST202/i.test(error.message || '')) {
            return { data: null, error: new Error('Çalışma geçmişi henüz kurulmamış. sql/034_admin_egitimlerim.sql dosyasını çalıştırın.') };
        }
        return { data: null, error };
    }
    if (data && data.success === false) {
        return { data: null, error: new Error(data.message || 'Çalışmalar alınamadı') };
    }
    return { data, error: null };
}

export async function deleteBelge(id, client = supabase) {
    if (!client || !id) return { error: new Error('Geçersiz istek') };
    const { error } = await client.from('egitimlerim_belgeler').delete().eq('id', id);
    return { error };
}

/* ---------- Kullanıcı listesi (admin seçici) ---------- */

/**
 * Tüm kullanıcılar döner. Paketi olmayan kullanıcıya da paket tanımlanabilmesi
 * için liste satın alma kaydına göre filtrelenmez; hangi kullanıcının paketi
 * olduğu Paketler sekmesinde ayrıca görünür.
 */
export async function fetchKullaniciListesi(client = supabase) {
    if (!client) return { data: [], error: null };

    const rpc = await client.rpc('admin_kullanici_listesi');
    if (!rpc.error && Array.isArray(rpc.data)) {
        const sorted = [...rpc.data].sort((a, b) =>
            String(a.full_name || '').localeCompare(String(b.full_name || ''), 'tr')
        );
        return { data: sorted, error: null };
    }

    const { data, error } = await client
        .from('kullanicilar')
        .select('id, email, full_name, created_at')
        .order('full_name', { ascending: true });

    return { data: data || [], error };
}

/* ---------- Metin havuzu (kullanıcıya özel, max 10) ---------- */

export const METIN_HAVUZU_LIMIT = 10;
export const METIN_HAVUZU_TUR = 'Kendi Metnim';
export const METIN_HAVUZU_KATEGORI = 'kendi_metnim';

export function slugifyMetinGrup(value) {
    const raw = String(value || '').trim().toLocaleLowerCase('tr-TR');
    return raw
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40) || 'grup';
}

export async function fetchMetinHavuzu(userId = null, client = supabase) {
    if (!client) return { data: [], error: new Error('Bağlantı yok') };
    const uid = userId || (await client.auth.getUser())?.data?.user?.id;
    if (!uid) return { data: [], error: new Error('Oturum gerekli') };
    const { data, error } = await client
        .from('egitimlerim_metin_havuzu')
        .select('id, tur, grup, ad, icerik, created_at')
        .eq('kullanici_id', uid)
        .order('created_at', { ascending: true });
    if (error) return { data: [], error };
    return { data: data || [], error: null };
}

export async function saveMetinHavuzu({ grup, ad, icerik }, client = supabase) {
    if (!client) return { data: null, error: new Error('Bağlantı yok') };
    const { data: { session } } = await client.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return { data: null, error: new Error('Oturum gerekli') };

    const g = String(grup || '').trim();
    const a = String(ad || '').trim();
    const t = String(icerik || '').trim();
    if (!g) return { data: null, error: new Error('Metin grubu zorunludur') };
    if (!a) return { data: null, error: new Error('Metin adı zorunludur') };
    if (t.length < 10) return { data: null, error: new Error('Metin en az 10 karakter olmalıdır') };

    const { count } = await client
        .from('egitimlerim_metin_havuzu')
        .select('id', { count: 'exact', head: true })
        .eq('kullanici_id', uid);
    if ((count || 0) >= METIN_HAVUZU_LIMIT) {
        return { data: null, error: new Error('En fazla 10 metin ekleyebilirsiniz') };
    }

    const { data, error } = await client
        .from('egitimlerim_metin_havuzu')
        .insert({
            kullanici_id: uid,
            tur: METIN_HAVUZU_TUR,
            grup: g,
            ad: a,
            icerik: t
        })
        .select('*')
        .single();
    return { data, error };
}

export async function deleteMetinHavuzu(id, client = supabase) {
    if (!client || !id) return { error: new Error('Geçersiz istek') };
    const { error } = await client
        .from('egitimlerim_metin_havuzu')
        .delete()
        .eq('id', id);
    return { error };
}

export function applyMetinHavuzuToCalisma(rows, { categories, metinler, categorySelect } = {}) {
    const list = Array.isArray(rows) ? rows : [];
    if (!categories || !metinler) return;

    const groupsMap = new Map();
    list.forEach((row) => {
        const grupLabel = String(row.grup || '').trim() || 'Grup';
        const slug = slugifyMetinGrup(grupLabel);
        if (!groupsMap.has(slug)) {
            groupsMap.set(slug, { id: slug, label: grupLabel, texts: [] });
        }
        groupsMap.get(slug).texts.push({
            id: String(row.ad || 'Metin').trim() || 'Metin',
            text: String(row.icerik || '')
        });
    });

    const groups = Array.from(groupsMap.values());
    categories[METIN_HAVUZU_KATEGORI] = {
        label: METIN_HAVUZU_TUR,
        groups: groups.map((g) => ({ id: g.id, label: g.label }))
    };
    metinler[METIN_HAVUZU_KATEGORI] = {};
    groups.forEach((g) => {
        metinler[METIN_HAVUZU_KATEGORI][g.id] = g.texts;
    });

    if (categorySelect && ![...categorySelect.options].some((o) => o.value === METIN_HAVUZU_KATEGORI)) {
        const opt = document.createElement('option');
        opt.value = METIN_HAVUZU_KATEGORI;
        opt.textContent = METIN_HAVUZU_TUR;
        categorySelect.appendChild(opt);
    }
}

/* ---------- Son çalışmalar (İlerleme-Analiz) ---------- */

const SKIP_LABELS = new Set(['Atlanan Kelime', 'Atlandı']);

export async function fetchSonKlavyeCalismalariAnaliz(userId, limit = 10, client = supabase) {
    if (!client || !userId) return { data: [], error: null };
    const colsWithAnaliz = 'id, created_at, metin_adi, kategori, dogru_kelime, yanlis_kelime, sure_saniye, yanlis_kelimeler, gecerli_3dk, net_kelime, net_kelime_3dk, analiz';
    const colsBase = 'id, created_at, metin_adi, kategori, dogru_kelime, yanlis_kelime, sure_saniye, yanlis_kelimeler, gecerli_3dk, net_kelime, net_kelime_3dk';

    let { data, error } = await client
        .from('klavye_calisma_kayitlari')
        .select(colsWithAnaliz)
        .eq('kullanici_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        const fallback = await client
            .from('klavye_calisma_kayitlari')
            .select(colsBase)
            .eq('kullanici_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
        data = fallback.data;
        error = fallback.error;
    }
    if (error) return { data: [], error };
    return { data: data || [], error: null };
}

export function countSkippedFromKayit(row) {
    const fromAnaliz = Number(row?.analiz?.atlanan);
    if (Number.isFinite(fromAnaliz) && fromAnaliz >= 0) return fromAnaliz;
    const mistakes = Array.isArray(row?.yanlis_kelimeler) ? row.yanlis_kelimeler : [];
    return mistakes.filter((m) => SKIP_LABELS.has(String(m?.errorType || m?.original || ''))).length;
}

export function mergeHarfMsFromKayitlar(rows) {
    const acc = new Map();
    (rows || []).forEach((row) => {
        const src = row?.analiz?.harfMs;
        if (!src || typeof src !== 'object') return;
        Object.entries(src).forEach(([harf, ms]) => {
            const n = Number(ms);
            if (!harf || !Number.isFinite(n) || n <= 0) return;
            const key = String(harf).toLocaleLowerCase('tr-TR');
            const cur = acc.get(key) || { sum: 0, count: 0 };
            cur.sum += n;
            cur.count += 1;
            acc.set(key, cur);
        });
    });
    const out = [];
    acc.forEach((v, harf) => {
        if (v.count > 0) out.push({ harf, ms: Math.round(v.sum / v.count) });
    });
    out.sort((a, b) => a.ms - b.ms);
    return out;
}
