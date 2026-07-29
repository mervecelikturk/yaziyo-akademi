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
    const { data, error } = await client
        .from('egitim_paketi_satin_almalar')
        .select('id, paket_id, satin_alma_tarihi, bitis_tarihi, gecerlilik_gun, fiyat, egitim_paketleri(baslik)')
        .eq('kullanici_id', userId)
        .order('satin_alma_tarihi', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) return { data: null, error };
    if (!data) return { data: null, error: null };

    const bitis = data.bitis_tarihi;
    const kalan = daysRemaining(bitis);
    return {
        data: {
            satinAlmaId: data.id,
            paketId: data.paket_id,
            paketAdi: data.egitim_paketleri?.baslik || 'Eğitim Paketi',
            baslangic: data.satin_alma_tarihi,
            bitis,
            kalanGun: kalan,
            gecerlilikGun: data.gecerlilik_gun,
            suresiDoldu: kalan != null && kalan < 0
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
        .select('id, belge_turu, baslik, dosya_adi, alici_adi, created_at')
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
        alici_adi: payload.alici_adi || ''
    };
    if (!row.kullanici_id || !BELGE_TURLERI[row.belge_turu] || !row.dosya_base64) {
        return { data: null, error: new Error('Kullanıcı, belge türü ve PDF zorunlu') };
    }
    const { data, error } = await client
        .from('egitimlerim_belgeler')
        .insert(row)
        .select('id, belge_turu, baslik, dosya_adi, alici_adi, created_at')
        .single();
    return { data, error };
}

export async function deleteBelge(id, client = supabase) {
    if (!client || !id) return { error: new Error('Geçersiz istek') };
    const { error } = await client.from('egitimlerim_belgeler').delete().eq('id', id);
    return { error };
}

/* ---------- Kullanıcı listesi (admin seçici) ---------- */

export async function fetchKullaniciListesi(client = supabase) {
    if (!client) return { data: [], error: null };
    const { data, error } = await client
        .from('kullanicilar')
        .select('id, email, full_name, created_at')
        .order('full_name', { ascending: true });
    return { data: data || [], error };
}
