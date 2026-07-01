/**
 * YAZİYO - Kullanıcı istatistikleri (Supabase)
 * Profil okuma, hız testi sonucu kaydetme ve rütbe hesaplama
 */

/** Rütbe eşikleri (artan sırada) */
export const RANK_TIERS = [
    { id: 'umut', min: 0, max: 9999, name: 'Umut Vadedenler', color: '#22C55E', borderClass: 'rank-border-umut' },
    { id: 'caliskan', min: 10000, max: 24999, name: 'Çalışkanlar', color: '#3B82F6', borderClass: 'rank-border-caliskan' },
    { id: 'gelismis', min: 25000, max: 49999, name: 'Gelişmişler', color: '#A85507', borderClass: 'rank-border-gelismis' },
    { id: 'usta', min: 50000, max: 99999, name: 'Ustalar', color: '#94A3B8', borderClass: 'rank-border-usta' },
    { id: 'efsane', min: 100000, max: null, name: 'Efsaneler', color: '#D97706', borderClass: 'rank-border-efsane' },
];

const SCALE_MAX = 100000;

/**
 * Sayıyı profil kartlarında gösterilecek Türkçe formata çevirir (örn. 45240 → 45.240)
 */
export function formatStatNumber(value) {
    const n = Number(value) || 0;
    return n.toLocaleString('tr-TR');
}

/**
 * Toplam kelimeye göre mevcut / sonraki rütbe ve ilerleme yüzdesi
 */
export function getRankInfo(totalWords) {
    const words = Math.max(0, Number(totalWords) || 0);
    let current = RANK_TIERS[0];
    let next = RANK_TIERS[1] || null;

    for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
        if (words >= RANK_TIERS[i].min) {
            current = RANK_TIERS[i];
            next = RANK_TIERS[i + 1] || null;
            break;
        }
    }

    let progressPercent = 100;
    if (next) {
        const span = next.min - current.min;
        progressPercent = span > 0 ? Math.min(100, Math.max(0, ((words - current.min) / span) * 100)) : 0;
    }

    const scalePercent = Math.min(100, (words / SCALE_MAX) * 100);

    return { words, current, next, progressPercent, scalePercent };
}

function formatKelimeAraligi(tier) {
    if (tier.max == null) {
        return `${formatStatNumber(tier.min)}+`;
    }
    return `${formatStatNumber(tier.min)} – ${formatStatNumber(tier.max)}`;
}

/**
 * Oturum açık mı kontrol eder
 */
export async function isUserLoggedIn(supabase) {
    if (!supabase) return false;
    const { data: { session } } = await supabase.auth.getSession();
    return !!session?.user;
}

/**
 * kullanicilar tablosundan istatistikleri okur
 * @returns {{ toplam_kelime: number, en_yuksek_kombo: number, created_at?: string } | null}
 */
export async function loadUserStats(supabase, userId) {
    if (!supabase || !userId) return null;

    let { data, error } = await supabase
        .from('kullanicilar')
        .select('toplam_kelime, en_yuksek_kombo, calisma_sure_saniye, en_yuksek_3dk_kelime, created_at')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        console.warn('Geniş istatistik sorgusu başarısız, temel alanlar deneniyor:', error);
        const fallback = await supabase
            .from('kullanicilar')
            .select('toplam_kelime, en_yuksek_kombo, created_at')
            .eq('id', userId)
            .maybeSingle();
        data = fallback.data;
        error = fallback.error;
    }

    if (error) {
        console.error('İstatistik yükleme hatası:', error);
        return {
            toplam_kelime: 0,
            en_yuksek_kombo: 0,
            calisma_sure_saniye: 0,
            en_yuksek_3dk_kelime: 0,
            created_at: null,
        };
    }

    return {
        toplam_kelime: data?.toplam_kelime ?? 0,
        en_yuksek_kombo: data?.en_yuksek_kombo ?? 0,
        calisma_sure_saniye: data?.calisma_sure_saniye ?? 0,
        en_yuksek_3dk_kelime: data?.en_yuksek_3dk_kelime ?? 0,
        created_at: data?.created_at ?? null,
    };
}

/**
 * Çalışma süresini akıllı formatta gösterir (saat / dakika / saniye)
 */
export function formatStudyDuration(totalSeconds) {
    const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;

    if (h > 0) {
        if (m > 0) return `${h}sa ${m}dk`;
        return `${h}sa`;
    }
    if (m > 0) {
        if (sec > 0) return `${m}dk ${sec}sn`;
        return `${m}dk`;
    }
    return `${sec}sn`;
}

/** Test süresini kısa metin olarak gösterir */
export function formatPracticeDuration(seconds) {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    if (s === 180) return '3 Dakika';
    if (s % 60 === 0 && s >= 60) return `${s / 60} Dakika`;
    return formatStudyDuration(s);
}

export const KLAVYE_3DK_SURE = 180;

/**
 * Klavye çalışması sonucunu kaydeder
 */
export async function saveKlavyeCalismasiSonucu(supabase, payload) {
    if (!supabase) throw new Error('Veritabanı bağlantısı kurulamadı');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Sonucu kaydetmek için giriş yapmalısınız');

    const netKelime = Math.max(0, Math.floor(Number(payload.netKelime) || 0));
    const sureSaniye = Math.max(0, Math.floor(Number(payload.sureSaniye) || 0));
    const dogru = Math.max(0, Math.floor(Number(payload.dogru) || 0));
    const yanlis = Math.max(0, Math.floor(Number(payload.yanlis) || 0));
    const gecerli3dk = payload.gecerli3dk === true;
    const net3dk = gecerli3dk ? Math.max(0, Math.floor(Number(payload.netKelime3dk) || 0)) : 0;

    const { data, error } = await supabase.rpc('save_klavye_calismasi_sonucu', {
        p_net_kelime: netKelime,
        p_sure_saniye: sureSaniye,
        p_dogru_kelime: dogru,
        p_yanlis_kelime: yanlis,
        p_metin_adi: payload.metinAdi || '',
        p_kategori: payload.kategori || '',
        p_grup: payload.grup || '',
        p_yanlis_kelimeler: payload.yanlisKelimeler || [],
        p_gecerli_3dk: gecerli3dk,
        p_net_kelime_3dk: net3dk,
    });

    if (error) throw error;

    return {
        toplam_kelime: data?.toplam_kelime ?? 0,
        en_yuksek_kombo: data?.en_yuksek_kombo ?? 0,
        calisma_sure_saniye: data?.calisma_sure_saniye ?? 0,
        en_yuksek_3dk_kelime: data?.en_yuksek_3dk_kelime ?? 0,
        genel_siralama: data?.genel_siralama ?? 0,
    };
}

/**
 * Genel sıralama listesi (toplam kelimeye göre)
 */
export async function loadGenelSiralama(supabase, limit = 50) {
    if (!supabase) return null;

    const { data, error } = await supabase.rpc('get_genel_siralama', { p_limit: limit });
    if (error) {
        console.error('Sıralama yükleme hatası:', error);
        return null;
    }
    return data;
}

/**
 * Son klavye çalışmalarını getirir
 */
export async function loadSonKlavyeCalismalari(supabase, userId, limit = 10) {
    if (!supabase || !userId) return [];

    const { data, error } = await supabase
        .from('klavye_calisma_kayitlari')
        .select('id, created_at, metin_adi, kategori, dogru_kelime, yanlis_kelime, sure_saniye, yanlis_kelimeler')
        .eq('kullanici_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Son çalışmalar yükleme hatası:', error);
        return [];
    }
    return data || [];
}

export async function getUserGenelSiralama(supabase, userId, toplamKelime) {
    if (!supabase || !userId) return null;

    // toplamKelime zaten elimizdeyse (profil akışında loadUserStats önce çağrılıyor)
    // ikinci bir loadUserStats çağrısı yapmadan doğrudan sayım yap.
    let toplam = toplamKelime;
    if (toplam === undefined || toplam === null) {
        const stats = await loadUserStats(supabase, userId);
        if (!stats) return null;
        toplam = stats.toplam_kelime;
    }

    const { count, error } = await supabase
        .from('kullanicilar')
        .select('id', { count: 'exact', head: true })
        .gt('toplam_kelime', toplam);

    if (error) {
        console.error('Sıralama hesaplama hatası:', error);
        return null;
    }

    return (count ?? 0) + 1;
}

/**
 * Profil özeti: istatistikler + genel sıralama TEK RPC çağrısında.
 * RPC mevcut değilse (migration çalışmamışsa) eski yola (stats + ayrı sayım) düşer.
 * @returns {{ toplam_kelime, en_yuksek_kombo, calisma_sure_saniye, en_yuksek_3dk_kelime, created_at, genel_siralama } | null}
 */
export async function loadProfilOzet(supabase, userId) {
    if (!supabase || !userId) return null;

    const { data, error } = await supabase.rpc('get_profil_ozet');
    if (!error && data) {
        return {
            toplam_kelime: data.toplam_kelime ?? 0,
            en_yuksek_kombo: data.en_yuksek_kombo ?? 0,
            calisma_sure_saniye: data.calisma_sure_saniye ?? 0,
            en_yuksek_3dk_kelime: data.en_yuksek_3dk_kelime ?? 0,
            created_at: data.created_at ?? null,
            genel_siralama: data.genel_siralama ?? 1,
            duello_galibiyet: data.duello_galibiyet ?? 0,
            duello_maglubiyet: data.duello_maglubiyet ?? 0,
            duello_beraberlik: data.duello_beraberlik ?? 0,
        };
    }

    // Fallback: RPC yoksa eski yöntem
    if (error) console.warn('get_profil_ozet kullanılamadı, fallback uygulanıyor:', error);
    const stats = await loadUserStats(supabase, userId);
    if (!stats) return null;
    const siralama = await getUserGenelSiralama(supabase, userId, stats.toplam_kelime);
    return { ...stats, genel_siralama: siralama ?? 1 };
}

/**
 * Profil kartındaki "Genel Sıralama" alanını günceller (sıralama arka planda gelince çağrılır)
 */
export function applyGenelSiralamaUI(siralama) {
    const rankEl = document.getElementById('profile-genel-siralama');
    if (rankEl) {
        rankEl.textContent = `#${formatStatNumber(siralama ?? 1)}`;
    }
}

/**
 * Hız testi sonucunu backend RPC ile kaydeder.
 * - toplam_kelime: testte yazılan tüm kelimeler eklenir
 * - en_yuksek_kombo: mevcut değerle testteki max kombo karşılaştırılır, büyük olan kalır
 */
export async function saveHizTestiSonucu(supabase, kelimeSayisi, maxKombo = 0, extra = {}) {
    if (!supabase) {
        throw new Error('Veritabanı bağlantısı kurulamadı');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
        throw new Error('Sonucu kaydetmek için giriş yapmalısınız');
    }

    const kelime = Math.max(0, Math.floor(Number(kelimeSayisi) || 0));
    const kombo = Math.max(0, Math.floor(Number(maxKombo) || 0));
    const wpm = Math.max(0, Math.floor(Number(extra.wpm) || 0));
    const dogruluk = Math.max(0, Math.min(100, Number(extra.dogruluk) || 0));
    const sureSaniye = Math.max(0, Math.floor(Number(extra.sureSaniye) || 0));
    const dogruKelime = Math.max(0, Math.floor(Number(extra.dogruKelime) || 0));
    const yanlisKelime = Math.max(0, Math.floor(Number(extra.yanlisKelime) || 0));

    const { data, error } = await supabase.rpc('save_hiz_testi_sonucu', {
        p_kelime_sayisi: kelime,
        p_max_kombo: kombo,
        p_wpm: wpm,
        p_dogruluk: dogruluk,
        p_sure_saniye: sureSaniye,
        p_dogru_kelime: dogruKelime,
        p_yanlis_kelime: yanlisKelime,
    });

    if (error) throw error;

    return {
        toplam_kelime: data?.toplam_kelime ?? 0,
        en_yuksek_kombo: data?.en_yuksek_kombo ?? 0,
    };
}

/**
 * Araba yarışı / düello sonucunu kaydeder.
 * - duello_galibiyet / maglubiyet / beraberlik sayaçlarını artırır
 * - toplam_kelime: yarışta yazılan tüm kelimeler eklenir
 * - en_yuksek_kombo: mevcut değerle karşılaştırılır, büyük olan kalır
 */
export async function saveYarisDuelloSonucu(supabase, sonuc, kelimeSayisi, maxKombo = 0) {
    if (!supabase) throw new Error('Veritabanı bağlantısı kurulamadı');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Sonucu kaydetmek için giriş yapmalısınız');

    const validSonuc = ['galibiyet', 'maglubiyet', 'beraberlik'];
    if (!validSonuc.includes(sonuc)) throw new Error('Geçersiz sonuç türü');

    const kelime = Math.max(0, Math.floor(Number(kelimeSayisi) || 0));
    const kombo = Math.max(0, Math.floor(Number(maxKombo) || 0));

    const { data, error } = await supabase.rpc('yaris_duello_kaydet', {
        p_sonuc: sonuc,
        p_kelime_sayisi: kelime,
        p_max_kombo: kombo,
    });

    if (error) throw error;

    return {
        toplam_kelime: data?.toplam_kelime ?? 0,
        en_yuksek_kombo: data?.en_yuksek_kombo ?? 0,
        duello_galibiyet: data?.duello_galibiyet ?? 0,
        duello_maglubiyet: data?.duello_maglubiyet ?? 0,
        duello_beraberlik: data?.duello_beraberlik ?? 0,
        genel_siralama: data?.genel_siralama ?? 1,
    };
}

/**
 * Günlük hız testi liderlik tablosunu getirir (kullanıcı başına en iyi WPM)
 */
export async function loadGunlukHizSiralama(supabase, limit = 50) {
    if (!supabase) return null;

    const { data, error } = await supabase.rpc('get_gunluk_hiz_siralama', { p_limit: limit });
    if (error) {
        console.error('Günlük hız sıralaması yükleme hatası:', error);
        return null;
    }
    return data;
}

/**
 * Avatar çerçevesi, rütbe rozeti, çizgisel ilerleme çubuğu ve modal tablosunu günceller
 */
export function applyRankUI(totalWords) {
    const { words, current, next, progressPercent, scalePercent } = getRankInfo(totalWords);

    const avatarDiv = document.getElementById('profile-avatar');
    if (avatarDiv) {
        avatarDiv.className = avatarDiv.className.replace(/rank-border-[a-z]+/g, '');
        avatarDiv.classList.add(current.borderClass);
    }

    const rankIconBg = document.getElementById('rank-icon-bg');
    if (rankIconBg) rankIconBg.style.borderColor = current.color;

    const rankIcon = document.getElementById('rank-icon');
    if (rankIcon) {
        rankIcon.style.color = current.color;
        rankIcon.classList.remove('text-yaziyo-gold');
    }

    const rankBadge = document.getElementById('rank-badge');
    if (rankBadge) {
        const r = parseInt(current.color.slice(1, 3), 16);
        const g = parseInt(current.color.slice(3, 5), 16);
        const b = parseInt(current.color.slice(5, 7), 16);
        rankBadge.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.1)`;
        rankBadge.style.borderColor = `rgba(${r}, ${g}, ${b}, 0.25)`;
    }

    const rankNameEl = document.getElementById('rank-name');
    if (rankNameEl) {
        rankNameEl.textContent = current.name;
        rankNameEl.style.color = current.color;
        rankNameEl.classList.remove('text-yaziyo-gold');
    }

    const rankBadgeIcon = document.getElementById('rank-badge-icon');
    if (rankBadgeIcon) {
        rankBadgeIcon.style.color = current.color;
        rankBadgeIcon.classList.remove('text-yaziyo-gold');
    }

    const subtitle = document.getElementById('rank-progress-subtitle');
    if (subtitle) {
        if (!next) {
            subtitle.textContent = 'Tebrikler, en üst rütbedesiniz!';
        } else {
            const remaining = next.min - words;
            subtitle.textContent = `${next.name} rütbesine ${formatStatNumber(remaining)} kelime kaldı`;
        }
    }

    const progressFill = document.getElementById('rank-progress-fill');
    if (progressFill) progressFill.style.width = `${progressPercent}%`;

    const progressCurrent = document.getElementById('rank-progress-current');
    const progressTarget = document.getElementById('rank-progress-target');
    if (progressCurrent) progressCurrent.textContent = `${formatStatNumber(words)} kelime`;
    if (progressTarget) {
        progressTarget.textContent = next
            ? `${formatStatNumber(next.min)} kelime`
            : `${formatStatNumber(current.min)}+ kelime`;
    }

    const modalScaleFill = document.getElementById('rank-modal-scale-fill');
    const modalMarker = document.getElementById('rank-modal-marker');
    if (modalScaleFill) modalScaleFill.style.width = `${scalePercent}%`;
    if (modalMarker) modalMarker.style.left = `calc(${scalePercent}% - 6px)`;

    document.querySelectorAll('[data-rank-tier]').forEach((el) => {
        const isCurrent = el.getAttribute('data-rank-tier') === current.id;
        el.classList.toggle('ring-2', isCurrent);
        el.classList.toggle('ring-offset-2', isCurrent);
        el.classList.toggle('ring-yaziyo-gold', isCurrent);
        el.classList.toggle('opacity-100', isCurrent);
        el.classList.toggle('opacity-70', !isCurrent);
    });

    const tableBody = document.getElementById('rank-tier-table-body');
    if (tableBody) {
        tableBody.innerHTML = [...RANK_TIERS].reverse().map((tier) => {
            const reached = words >= tier.min;
            const isCurrent = tier.id === current.id;
            let status = '—';
            if (isCurrent) status = '<span class="text-yaziyo-gold font-bold">Şu an buradasınız</span>';
            else if (reached) status = '<span class="text-green-500">Tamamlandı</span>';
            else status = '<span class="text-light-text-secondary dark:text-dark-text-secondary">Kilitli</span>';

            return `<tr class="${isCurrent ? 'bg-yaziyo-gold/5' : ''}">
                <td class="py-2 pr-3 font-semibold" style="color:${tier.color}">${tier.name}</td>
                <td class="py-2 pr-3 text-light-text-secondary dark:text-dark-text-secondary">${formatKelimeAraligi(tier)} kelime</td>
                <td class="py-2 text-right text-xs">${status}</td>
            </tr>`;
        }).join('');
    }

    window._yaziyoTotalWords = words;
}

/**
 * Düello istatistikleri — backend gelene kadar çizgi (—) placeholder
 */
export function applyDuelPlaceholderUI() {
    const winrate = document.getElementById('profile-duello-winrate');
    const wins = document.getElementById('profile-duello-wins');
    const losses = document.getElementById('profile-duello-losses');
    const draws = document.getElementById('profile-duello-draws');

    if (winrate) winrate.textContent = '—';
    if (wins) wins.textContent = '—';
    if (losses) losses.textContent = '—';
    if (draws) draws.textContent = '—';
}

/**
 * Düello istatistiklerini (galibiyet / mağlubiyet / beraberlik) profile yazar.
 * Veri yoksa placeholder (—) korunur.
 */
export function applyDuelStatsUI(stats) {
    if (!stats) return;
    const g = Number(stats.duello_galibiyet) || 0;
    const m = Number(stats.duello_maglubiyet) || 0;
    const b = Number(stats.duello_beraberlik) || 0;
    const toplam = g + m + b;

    const winrate = document.getElementById('profile-duello-winrate');
    const wins = document.getElementById('profile-duello-wins');
    const losses = document.getElementById('profile-duello-losses');
    const draws = document.getElementById('profile-duello-draws');

    if (wins) wins.textContent = formatStatNumber(g);
    if (losses) losses.textContent = formatStatNumber(m);
    if (draws) draws.textContent = formatStatNumber(b);

    if (winrate) {
        winrate.textContent = toplam > 0 ? `%${Math.round((g / toplam) * 100)}` : '—';
        winrate.removeAttribute('title');
        winrate.classList.remove('opacity-60');
    }

    // "Yakında" opaklığını kaldır (gerçek veri geldi)
    [wins, losses, draws].forEach((el) => {
        const wrap = el?.closest('.flex.items-center.gap-2');
        if (wrap) wrap.classList.remove('opacity-60');
    });
}

/**
 * Profil sayfasındaki toplam kelime ve max kombo alanlarını günceller
 */
export function applyProfileStatsUI(stats) {
    const totalEl = document.getElementById('profile-total-words');
    const comboEl = document.getElementById('profile-max-combo');
    const studyEl = document.getElementById('profile-study-time');
    const record3dkEl = document.getElementById('profile-3dk-record');
    const rankEl = document.getElementById('profile-genel-siralama');

    if (totalEl) totalEl.textContent = formatStatNumber(stats.toplam_kelime);
    if (comboEl) comboEl.textContent = formatStatNumber(stats.en_yuksek_kombo);
    if (studyEl) studyEl.textContent = formatStudyDuration(stats.calisma_sure_saniye);
    if (record3dkEl) record3dkEl.textContent = formatStatNumber(stats.en_yuksek_3dk_kelime);
    if (rankEl && stats.genel_siralama != null) {
        rankEl.textContent = `#${formatStatNumber(stats.genel_siralama)}`;
    }

    applyRankUI(stats.toplam_kelime);

    if (stats.duello_galibiyet !== undefined || stats.duello_maglubiyet !== undefined || stats.duello_beraberlik !== undefined) {
        applyDuelStatsUI(stats);
    } else {
        applyDuelPlaceholderUI();
    }
}

/**
 * Çalışma süresi modalı (saat, dakika, saniye ayrıntılı)
 */
export function openStudyTimeModal(totalSeconds) {
    const modal = document.getElementById('study-time-modal');
    const backdrop = document.getElementById('study-time-modal-backdrop');
    const content = document.getElementById('study-time-modal-content');
    if (!modal) return;

    const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;

    const hEl = document.getElementById('study-time-hours');
    const mEl = document.getElementById('study-time-minutes');
    const sEl = document.getElementById('study-time-seconds');
    const summaryEl = document.getElementById('study-time-summary');

    if (hEl) hEl.textContent = String(h);
    if (mEl) mEl.textContent = String(m);
    if (sEl) sEl.textContent = String(sec);
    if (summaryEl) summaryEl.textContent = formatStudyDuration(s);

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    requestAnimationFrame(() => {
        backdrop?.classList.remove('opacity-0');
        content?.classList.remove('scale-95', 'opacity-0');
    });
}

export function closeStudyTimeModal() {
    const modal = document.getElementById('study-time-modal');
    const backdrop = document.getElementById('study-time-modal-backdrop');
    const content = document.getElementById('study-time-modal-content');
    if (!modal) return;

    backdrop?.classList.add('opacity-0');
    content?.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
}

export function openGenelSiralamaModal(siralamaData) {
    const modal = document.getElementById('genel-siralama-modal');
    const backdrop = document.getElementById('genel-siralama-modal-backdrop');
    const content = document.getElementById('genel-siralama-modal-content');
    const tbody = document.getElementById('genel-siralama-tbody');
    const myRankEl = document.getElementById('genel-siralama-my-rank');
    if (!modal || !tbody) return;

    const liste = siralamaData?.liste || [];
    const benimSiram = siralamaData?.benim_siram ?? '—';
    const benimKelime = siralamaData?.benim_kelime ?? 0;

    if (myRankEl) {
        myRankEl.textContent = `Sizin sıranız: #${formatStatNumber(benimSiram)} (${formatStatNumber(benimKelime)} kelime)`;
    }

    if (liste.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="py-6 text-center text-light-text-secondary italic">Henüz sıralama verisi yok.</td></tr>';
    } else {
        tbody.innerHTML = liste.map((row) => `
            <tr class="border-b border-light-border/50 dark:border-dark-border/50">
                <td class="py-3 pr-4 font-bold text-yaziyo-gold">#${row.sira}</td>
                <td class="py-3 pr-4">${escapeHtmlStat(maskRankingDisplayName(row.ad))}</td>
                <td class="py-3 text-right font-semibold">${formatStatNumber(row.toplam_kelime)}</td>
            </tr>
        `).join('');
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    requestAnimationFrame(() => {
        backdrop?.classList.remove('opacity-0');
        content?.classList.remove('scale-95', 'opacity-0');
    });
}

export function closeGenelSiralamaModal() {
    const modal = document.getElementById('genel-siralama-modal');
    const backdrop = document.getElementById('genel-siralama-modal-backdrop');
    const content = document.getElementById('genel-siralama-modal-content');
    if (!modal) return;

    backdrop?.classList.add('opacity-0');
    content?.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
}

function escapeHtmlStat(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
}

/**
 * Sıralama listesinde soyadı gizler: Merve Çeliktürk → Merve Ç*******k
 */
export function maskRankingDisplayName(fullName) {
    const trimmed = String(fullName ?? '').trim();
    if (!trimmed) return '—';

    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0];

    const firstName = parts[0];
    const maskedSurname = parts.slice(1).map(maskRankingSurnamePart).join(' ');
    return `${firstName} ${maskedSurname}`;
}

function maskRankingSurnamePart(name) {
    const chars = [...String(name ?? '')];
    if (chars.length <= 2) return chars.join('');
    return chars[0] + '*'.repeat(chars.length - 2) + chars[chars.length - 1];
}

/** Hata türü etiketleri — gerçek kelime değildir */
const MISTAKE_ERROR_LABELS = new Set([
    'Fazla Vuruş', 'Eksik Vuruş', 'Harf Yer Değiştirme', 'Karakter Hatası',
    'Kelime Bölme', 'Kelime Birleştirme', 'Fazla Boşluk', 'Karışık Hata',
    'Fazla Kelime', 'Atlanan Kelime', 'Eksik Son Kelime',
    '(fazla boşluk)', '(Atlandı)',
]);

function isMistakeErrorLabel(value) {
    if (!value || typeof value !== 'string') return true;
    const trimmed = value.trim();
    if (!trimmed || trimmed.startsWith('(')) return true;
    return MISTAKE_ERROR_LABELS.has(trimmed);
}

/** Yanlış yazılan kelimenin metinde olması gereken doğru halini döndürür (kullanıcının yazdığı değil) */
function getExpectedWordFromMistake(m) {
    if (!m || typeof m !== 'object') return '';

    for (const field of ['expected', 'original']) {
        const value = m[field] != null ? String(m[field]).trim() : '';
        if (value && !isMistakeErrorLabel(value)) {
            return value;
        }
    }
    return '';
}

function formatExpectedWordsFromMistakes(mistakes) {
    if (!Array.isArray(mistakes)) return '—';
    const words = mistakes
        .map(getExpectedWordFromMistake)
        .filter(Boolean);
    const unique = [...new Set(words)];
    return unique.length ? unique.join(', ') : '—';
}

/**
 * Son çalışmalar tablosunu doldurur
 */
export function renderSonKlavyeCalismalari(kayitlar) {
    const tbody = document.getElementById('son-calismalar-tbody');
    if (!tbody) return;

    if (!kayitlar.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-light-text-secondary italic">Son çalışma yok.</td></tr>';
        return;
    }

    tbody.innerHTML = kayitlar.map((k, idx) => {
        const tarih = new Date(k.created_at);
        const tarihStr = tarih.toLocaleString('tr-TR', {
            day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
        });
        const yanlisListe = Array.isArray(k.yanlis_kelimeler) ? k.yanlis_kelimeler : [];
        const dogruKelimeMetin = formatExpectedWordsFromMistakes(yanlisListe);
        const wrongId = `wrong-words-${k.id || idx}`;
        const isOzelMetin = k.kategori === 'Özel Metin';
        const metinBadge = k.kategori
            ? `${escapeHtmlStat(k.kategori)}${k.metin_adi ? ' · ' + escapeHtmlStat(k.metin_adi) : ''}`
            : escapeHtmlStat(k.metin_adi || 'Metin');
        const badgeClass = isOzelMetin
            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
            : 'bg-purple-500/10 text-purple-500 border-purple-500/20';

        return `<tr class="hover:bg-light-bg/50 dark:hover:bg-dark-bg/30 transition-colors">
            <td class="px-6 py-4 text-sm whitespace-nowrap text-light-text dark:text-dark-text">${tarihStr}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 rounded-md text-[10px] font-bold border italic ${badgeClass}">${metinBadge}</span>
            </td>
            <td class="px-6 py-4 text-green-500 font-bold">${k.dogru_kelime}</td>
            <td class="px-6 py-4 text-red-500 font-bold">${k.yanlis_kelime}</td>
            <td class="px-6 py-4">
                <div class="flex items-center gap-2 min-w-[220px] bg-light-bg/50 dark:bg-dark-bg/30 px-3 py-1.5 rounded-lg border border-light-border dark:border-dark-border group">
                    <span class="text-xs text-yaziyo-green font-medium truncate" id="${wrongId}">${escapeHtmlStat(dogruKelimeMetin)}</span>
                    ${dogruKelimeMetin !== '—' ? `<button onclick="copyMistypedWords('${wrongId}', this)" class="shrink-0 text-light-text-secondary hover:text-yaziyo-gold transition-colors" title="Doğru kelimeleri kopyala"><i class="fa-regular fa-copy"></i></button>` : ''}
                </div>
            </td>
            <td class="px-6 py-4 text-sm font-medium whitespace-nowrap">${formatPracticeDuration(k.sure_saniye)}</td>
        </tr>`;
    }).join('');
}

/**
 * Kelime evi sonucunu kaydeder
 */
export async function saveKelimeEviSonucu(supabase, payload) {
    if (!supabase) throw new Error('Veritabanı bağlantısı kurulamadı');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Sonucu kaydetmek için giriş yapmalısınız');

    const { data, error } = await supabase.rpc('save_kelime_evi_sonucu', {
        p_ev_seviyesi: Math.max(1, Math.floor(Number(payload.evSeviyesi) || 1)),
        p_kat_sayisi: Math.max(1, Math.floor(Number(payload.katSayisi) || 1)),
        p_wpm: Math.max(0, Math.floor(Number(payload.wpm) || 0)),
        p_dogruluk: Math.max(0, Math.min(100, Math.floor(Number(payload.accuracy) || 0))),
        p_max_kombo: Math.max(0, Math.floor(Number(payload.maxCombo) || 0)),
        p_dogru_kelime: Math.max(0, Math.floor(Number(payload.dogru) || 0)),
        p_yanlis_kelime: Math.max(0, Math.floor(Number(payload.yanlis) || 0)),
        p_toplam_kelime: Math.max(0, Math.floor(Number(payload.toplamKelime) || 0)),
        p_sure_saniye: Math.max(0, Math.floor(Number(payload.sureSaniye) || 0)),
        p_metin_adi: payload.metinAdi || '',
        p_kategori: payload.kategori || '',
        p_grup: payload.grup || '',
        p_gorsel_data: payload.gorsel || null,
    });

    if (error) throw error;

    return {
        id: data?.id,
        toplam_kelime: data?.toplam_kelime ?? 0,
        en_yuksek_kombo: data?.en_yuksek_kombo ?? 0,
    };
}

/**
 * Kullanıcının kayıtlı kelime evlerini getirir
 */
export async function loadKelimeEvleri(supabase, userId, limit = 3) {
    if (!supabase || !userId) return [];

    const { data, error } = await supabase
        .from('kelime_evleri')
        .select('id, created_at, ev_seviyesi, kat_sayisi, wpm, dogruluk, max_kombo, gorsel_data, metin_adi')
        .eq('kullanici_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Kelime evleri yükleme hatası:', error);
        return [];
    }
    return data || [];
}

/**
 * Profil panelinde kelime evlerini render eder
 */
export function renderKelimeEvleri(evler) {
    const grid = document.getElementById('kelime-evi-grid');
    const empty = document.getElementById('kelime-evi-empty');
    if (!grid) return;

    if (!evler || evler.length === 0) {
        grid.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
    }

    if (empty) empty.classList.add('hidden');

    grid.innerHTML = evler.map((ev) => {
        const tarih = ev.created_at
            ? new Date(ev.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
            : '—';
        const img = ev.gorsel_data
            ? `<img src="${ev.gorsel_data}" alt="Kelime Evi" class="w-full h-32 object-cover rounded-t-xl" loading="lazy">`
            : `<div class="w-full h-32 bg-gradient-to-br from-yaziyo-gold/20 to-green-400/20 rounded-t-xl flex items-center justify-center text-4xl">🏠</div>`;

        return `<article class="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-xl overflow-hidden shadow-md hover:border-yaziyo-gold/40 transition-colors">
            ${img}
            <div class="p-4">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-yaziyo-gold">Seviye ${ev.ev_seviyesi || ev.kat_sayisi || 1}</span>
                    <span class="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">${tarih}</span>
                </div>
                <h4 class="font-poppins font-bold text-sm text-light-text dark:text-dark-text truncate mb-2">${escapeHtmlStat(ev.metin_adi || 'Kelime Evi')}</h4>
                <div class="flex gap-3 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    <span><strong class="text-yaziyo-gold">${ev.wpm || 0}</strong> WPM</span>
                    <span><strong class="text-green-600">${ev.dogruluk || 0}%</strong></span>
                    <span><i class="fa-solid fa-fire text-orange-400"></i> ${ev.max_kombo || 0}</span>
                </div>
            </div>
        </article>`;
    }).join('');
}
