/**
 * YAZİYO — Günlük giriş serisi (streak)
 * Yerel takvim günü + 24 saat kuralı (record_gunluk_seri RPC)
 */

const STREAK_CACHE_PREFIX = 'yaziyo-streak-data-';
const STREAK_RPC_UNAVAILABLE_KEY = 'yaziyo-streak-rpc-unavailable';

/** Supabase'de 030_gunluk_seri migration'ı yoksa RPC 404 döner */
function isStreakRpcMissingError(error) {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    const status = error.status || error.statusCode;
    return (
        status === 404
        || error.code === 'PGRST202'
        || error.code === 'PGRST205'
        || msg.includes('record_gunluk_seri')
        || msg.includes('could not find the function')
        || msg.includes('schema cache')
    );
}

function isStreakRpcUnavailable() {
    try {
        return sessionStorage.getItem(STREAK_RPC_UNAVAILABLE_KEY) === '1';
    } catch {
        return false;
    }
}

function markStreakRpcUnavailable() {
    try {
        sessionStorage.setItem(STREAK_RPC_UNAVAILABLE_KEY, '1');
    } catch {
        /* ignore */
    }
}

async function loadStreakFallback(supabase, userId) {
    try {
        const { data: row, error } = await supabase
            .from('kullanicilar')
            .select('streak_count, max_streak')
            .eq('id', userId)
            .maybeSingle();

        if (error) throw error;

        const fallback = {
            streak_count: row?.streak_count ?? 0,
            max_streak: row?.max_streak ?? 0,
        };
        applyStreakUI(fallback.streak_count, fallback.max_streak);
        setStreakWidgetMode(true, fallback.streak_count, fallback.max_streak);
        return fallback;
    } catch {
        applyStreakUI(0);
        setStreakWidgetMode(true, 0, 0);
        return null;
    }
}

/** @returns {string} YYYY-MM-DD (yerel) */
export function getLocalDateString(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * @param {number} streak
 * @returns {{ textClass: string, flameClass: string, tier: string }}
 */
export function getStreakTier(streak) {
    const n = Math.max(0, Number(streak) || 0);
    if (n >= 101) {
        return {
            tier: 'red',
            textClass: 'text-red-500',
            flameClass: 'text-red-500',
        };
    }
    if (n >= 11) {
        return {
            tier: 'orange',
            textClass: 'text-orange-400',
            flameClass: 'text-orange-400',
        };
    }
    return {
        tier: 'yellow',
        textClass: 'text-yellow-400',
        flameClass: 'text-yellow-400',
    };
}

const FLAME_COLOR_CLASSES = [
    'text-yellow-400',
    'text-orange-400',
    'text-red-500',
    'text-orange-500',
];

/**
 * @param {number} streak
 * @param {number} [maxStreak]
 */
export function applyStreakUI(streak, maxStreak = 0) {
    const count = Math.max(0, Number(streak) || 0);
    const max = Math.max(0, Number(maxStreak) || 0);
    const { textClass, flameClass } = getStreakTier(count);

    document.querySelectorAll('[id="streak-count"]').forEach((countEl) => {
        countEl.textContent = String(count);
        FLAME_COLOR_CLASSES.forEach((c) => countEl.classList.remove(c));
        countEl.classList.add('font-poppins', 'font-bold', 'text-sm', textClass);

        const wrap = countEl.closest('.flex.items-center') || countEl.parentElement;
        const flame = wrap?.querySelector('i.fa-fire');
        if (flame) {
            FLAME_COLOR_CLASSES.forEach((c) => flame.classList.remove(c));
            flame.classList.add(flameClass);
        }
    });
}

export function setStreakWidgetMode(loggedIn, streak, maxStreak) {
    document.querySelectorAll('[id="streak-count"]').forEach((countEl) => {
        const wrap = countEl.closest('.flex.items-center') || countEl.parentElement;
        if (!wrap) return;

        if (loggedIn) {
            wrap.classList.remove('cursor-not-allowed', 'select-none', 'opacity-70');
            wrap.classList.add('cursor-default');
            wrap.setAttribute(
                'title',
                maxStreak > 0
                    ? `Günlük seri: ${streak} gün · Rekor: ${maxStreak}`
                    : `Günlük seri: ${streak} gün`
            );
        } else {
            wrap.classList.add('cursor-not-allowed', 'select-none');
            wrap.classList.remove('cursor-default');
            wrap.setAttribute('title', 'Giriş yapınca günlük seriniz başlar');
        }
    });
}

export function clearStreakSessionCache() {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(STREAK_CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
}

function cacheKey(userId, localDate) {
    return `${STREAK_CACHE_PREFIX}${userId}-${localDate}`;
}

function readCache(userId, localDate) {
    try {
        const raw = sessionStorage.getItem(cacheKey(userId, localDate));
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function writeCache(userId, localDate, data) {
    try {
        sessionStorage.setItem(cacheKey(userId, localDate), JSON.stringify(data));
    } catch {
        /* ignore quota */
    }
}

/**
 * Oturum açıkken seriyi kaydeder / yükler ve navbar'ı günceller.
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 */
export async function syncDailyStreak(supabase) {
    if (!supabase) {
        applyStreakUI(0);
        setStreakWidgetMode(false, 0, 0);
        return null;
    }

    let userId = null;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
            applyStreakUI(0);
            setStreakWidgetMode(false, 0, 0);
            return null;
        }
        userId = session.user.id;
    } catch (err) {
        console.warn('Streak oturum kontrolü:', err);
        applyStreakUI(0);
        setStreakWidgetMode(false, 0, 0);
        return null;
    }

    const localDate = getLocalDateString();
    const cached = readCache(userId, localDate);
    if (cached) {
        applyStreakUI(cached.streak_count, cached.max_streak);
        setStreakWidgetMode(true, cached.streak_count, cached.max_streak);
        return cached;
    }

    if (isStreakRpcUnavailable()) {
        return loadStreakFallback(supabase, userId);
    }

    try {
        const { data, error } = await supabase.rpc('record_gunluk_seri', {
            p_local_date: localDate,
        });

        if (error) throw error;

        const payload = {
            streak_count: data?.streak_count ?? 0,
            max_streak: data?.max_streak ?? 0,
            updated: !!data?.updated,
        };

        writeCache(userId, localDate, payload);
        applyStreakUI(payload.streak_count, payload.max_streak);
        setStreakWidgetMode(true, payload.streak_count, payload.max_streak);
        return payload;
    } catch (err) {
        if (isStreakRpcMissingError(err)) {
            markStreakRpcUnavailable();
            return loadStreakFallback(supabase, userId);
        }

        console.warn('Günlük seri güncellenemedi:', err);
        return loadStreakFallback(supabase, userId);
    }
}

if (typeof window !== 'undefined') {
    window.YaziyoStreak = {
        sync: syncDailyStreak,
        applyStreakUI,
        setStreakWidgetMode,
        getLocalDateString,
        getStreakTier,
        clearStreakSessionCache,
    };
}
