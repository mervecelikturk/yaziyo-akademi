/**
 * YAZİYO — Ödeme servis katmanı
 *
 * UI yalnızca bu modülü çağırır. Iyzico bağlandığında yalnızca adapter
 * ve backend uçları değişir; ödeme ekranının yeniden yazılması gerekmez.
 *
 * PCI kuralları:
 * - Ham kart numarası / CVV bu katmana GİRMEZ ve asla loglanmaz.
 * - Tutar frontend'den kabul edilmez; paket fiyatı veritabanından okunur.
 * - Sipariş teslimi yalnızca backend/webhook doğrulamasından sonra yapılır.
 */

import { supabase } from './supabase.js';
import { ensureSession } from '../authVerification.js';
import {
    fetchPublishedPaketById,
    fetchAktifSatinAlma,
    formatPriceTry,
    isPaketSoldOut,
    isTableMissingError,
} from './egitimPaketleriApi.js';

/** 'stub' | 'iyzico' — sağlayıcı anlaşması sonrası 'iyzico' yapılır */
export const PAYMENT_PROVIDER = 'stub';

export const PaymentErrorCode = {
    PROVIDER_NOT_READY: 'provider_not_ready',
    AUTH: 'auth',
    NOT_FOUND: 'not_found',
    SOLD_OUT: 'sold_out',
    ALREADY_OWNED: 'already_owned',
    INACTIVE: 'inactive',
    VALIDATION: 'validation',
    NETWORK: 'network',
    DECLINED: 'declined',
    THREEDS_CANCELLED: 'threeds_cancelled',
    CLOSED: 'closed',
    DUPLICATE: 'duplicate',
    ORPHAN: 'orphan',
    UNKNOWN: 'unknown',
};

const USER_MESSAGES = {
    [PaymentErrorCode.PROVIDER_NOT_READY]: 'Ödeme henüz aktif değil.',
    [PaymentErrorCode.AUTH]: 'Satın almak için giriş yapmalısınız.',
    [PaymentErrorCode.NOT_FOUND]: 'Paket bulunamadı. Lütfen eğitim paketleri sayfasından tekrar deneyin.',
    [PaymentErrorCode.SOLD_OUT]: 'Bu paket için kontenjan dolmuştur.',
    [PaymentErrorCode.ALREADY_OWNED]: 'Bu paketi zaten satın aldınız.',
    [PaymentErrorCode.INACTIVE]: 'Bu paket şu anda satışta değil.',
    [PaymentErrorCode.VALIDATION]: 'Kart bilgilerinizi kontrol edip tekrar deneyebilirsiniz.',
    [PaymentErrorCode.NETWORK]: 'İnternet bağlantınız kesildi. Lütfen bağlantınızı kontrol edip tekrar deneyin.',
    [PaymentErrorCode.DECLINED]: 'Ödeme gerçekleştirilemedi. Kart bilgilerinizi kontrol edip tekrar deneyebilirsiniz.',
    [PaymentErrorCode.THREEDS_CANCELLED]: '3D Secure işlemi iptal edildi. Ödeme tamamlanmadı.',
    [PaymentErrorCode.CLOSED]: 'Ödeme ekranı kapatıldığı için işlem tamamlanmadı.',
    [PaymentErrorCode.DUPLICATE]: 'Ödeme isteğiniz zaten iletildi. Lütfen sonucu bekleyin.',
    [PaymentErrorCode.ORPHAN]: 'Ödemeniz alınmış olabilir. Sipariş durumunuz kısa süre içinde güncellenecektir.',
    [PaymentErrorCode.UNKNOWN]: 'Ödeme gerçekleştirilemedi. Kart bilgilerinizi kontrol edip tekrar deneyebilirsiniz.',
};

export function userMessageFor(code) {
    return USER_MESSAGES[code] || USER_MESSAGES[PaymentErrorCode.UNKNOWN];
}

export function fail(code, extra = {}) {
    return {
        ok: false,
        code,
        message: extra.message || userMessageFor(code),
        ...extra,
    };
}

export function formatCheckoutAmount(price) {
    return formatPriceTry(price);
}

function publicPackageView(pkg) {
    if (!pkg) return null;
    return {
        id: pkg.id,
        title: pkg.title,
        description: pkg.description,
        category: pkg.category,
        features: pkg.features || [],
        validityDays: pkg.validityDays,
        coverUrl: pkg.coverUrl || '',
        amount: Number(pkg.price) || 0,
        currency: 'TRY',
    };
}

/**
 * Ödeme ekranı bağlamı — tutar sunucudaki paket kaydından gelir.
 */
export async function loadCheckoutContext(packageId, client = supabase) {
    const session = await ensureSession(client);
    if (!session.ok || !session.user) {
        return fail(PaymentErrorCode.AUTH);
    }

    if (!packageId) {
        return fail(PaymentErrorCode.NOT_FOUND);
    }

    const { data: pkg, error } = await fetchPublishedPaketById(packageId, client);
    if (error) {
        if (isTableMissingError(error)) {
            return fail(PaymentErrorCode.NOT_FOUND, {
                message: 'Paketler yüklenemedi. Lütfen daha sonra tekrar deneyin.',
            });
        }
        return fail(PaymentErrorCode.UNKNOWN);
    }
    if (!pkg) return fail(PaymentErrorCode.NOT_FOUND);
    if (isPaketSoldOut(pkg)) return fail(PaymentErrorCode.SOLD_OUT);

    const owned = await fetchAktifSatinAlma(packageId, client);
    if (owned.data) return fail(PaymentErrorCode.ALREADY_OWNED);

    const user = session.user;
    return {
        ok: true,
        package: publicPackageView(pkg),
        amount: Number(pkg.price) || 0,
        currency: 'TRY',
        user: {
            id: user.id,
            email: user.email || '',
            name: user.user_metadata?.site_full_name
                || user.user_metadata?.full_name
                || '',
        },
    };
}

const inFlightKeys = new Set();

function makeIdempotencyKey(packageId, userId) {
    return `pay:${userId}:${packageId}`;
}

/**
 * Ödeme akışını başlatır. Kart verisi parametre olarak ALINMAZ.
 * Iyzico bağlanınca adapter Checkout Form / tokenizasyon kullanır.
 */
export async function startPayment({ packageId, idempotencyKey } = {}, client = supabase) {
    if (!navigator.onLine) {
        return fail(PaymentErrorCode.NETWORK);
    }

    const ctx = await loadCheckoutContext(packageId, client);
    if (!ctx.ok) return ctx;

    const key = idempotencyKey || makeIdempotencyKey(packageId, ctx.user.id);
    if (inFlightKeys.has(key)) {
        return fail(PaymentErrorCode.DUPLICATE);
    }
    inFlightKeys.add(key);

    try {
        const adapter = getAdapter();
        return await adapter.startPayment({
            packageId: ctx.package.id,
            amount: ctx.amount,
            currency: ctx.currency,
            buyer: ctx.user,
            packageTitle: ctx.package.title,
        });
    } catch (err) {
        return mapProviderError(err);
    } finally {
        inFlightKeys.delete(key);
    }
}

/**
 * 3D Secure / sağlayıcı dönüşünden sonra sonucu backend'den doğrula.
 * Frontend'in "başarılı" demesine asla güvenilmez.
 */
export async function confirmPaymentFromProvider({ token, conversationId } = {}) {
    if (!navigator.onLine) {
        return fail(PaymentErrorCode.ORPHAN);
    }
    const adapter = getAdapter();
    if (typeof adapter.confirmPayment !== 'function') {
        return fail(PaymentErrorCode.PROVIDER_NOT_READY);
    }
    try {
        return await adapter.confirmPayment({ token, conversationId });
    } catch (err) {
        return mapProviderError(err);
    }
}

export function mapProviderError(err) {
    const code = err?.code || err?.errorCode;
    if (code && USER_MESSAGES[code]) return fail(code);
    if (!navigator.onLine || err?.name === 'TypeError' || /network|fetch|failed/i.test(err?.message || '')) {
        return fail(PaymentErrorCode.NETWORK);
    }
    return fail(PaymentErrorCode.UNKNOWN);
}

function getAdapter() {
    if (PAYMENT_PROVIDER === 'iyzico') return iyzicoAdapter;
    return stubAdapter;
}

/**
 * Tasarım / anlaşma öncesi — gerçek tahsilat yok.
 * Kart bilgisi gönderilmez.
 */
const stubAdapter = {
    async startPayment() {
        return fail(PaymentErrorCode.PROVIDER_NOT_READY);
    },
    async confirmPayment() {
        return fail(PaymentErrorCode.PROVIDER_NOT_READY);
    },
};

/**
 * Iyzico bağlama noktası.
 *
 * Yapılacaklar (sağlayıcı onayından sonra):
 * 1. Supabase Edge Function: `odeme-baslat`
 *    - Auth doğrula
 *    - `odeme_siparis_olustur(paket_id)` ile sipariş oluştur (tutar DB'den)
 *    - Iyzico Checkout Form / 3D Secure oturumu başlat
 *    - checkoutFormContent veya token döndür
 * 2. Bu adapter Iyzico formunu mount eder (iframe). Ham PAN bizim sunucuya gitmez.
 * 3. Edge Function: `odeme-webhook` / `odeme-dogrula`
 *    - Iyzico'dan ödeme durumunu sorgula
 *    - odendi ise paketi teslim et, sipariş no / işlem ID kaydet
 *    - Kart verisi kaydetme
 */
const iyzicoAdapter = {
    async startPayment() {
        // HOOK: const res = await fetch(`${SUPABASE_URL}/functions/v1/odeme-baslat`, ...)
        return fail(PaymentErrorCode.PROVIDER_NOT_READY);
    },
    async confirmPayment() {
        // HOOK: backend token ile Iyzico'dan doğrular; frontend sonucuna güvenilmez
        return fail(PaymentErrorCode.PROVIDER_NOT_READY);
    },
};

/* ------------------------------------------------------------------ */
/* Kart formu yardımcıları — yalnızca tarayıcıda, asla loglanmaz /     */
/* sunucuya gönderilmez.                                               */
/* ------------------------------------------------------------------ */

export function digitsOnly(value) {
    return String(value || '').replace(/\D/g, '');
}

export function detectCardBrand(digits) {
    const d = digitsOnly(digits);
    if (!d) return null;
    if (/^4/.test(d)) return 'visa';
    if (/^3[47]/.test(d)) return 'amex';
    if (/^5[1-5]/.test(d)) return 'mastercard';
    if (d.length >= 4) {
        const bin4 = parseInt(d.slice(0, 4), 10);
        if (bin4 >= 2221 && bin4 <= 2720) return 'mastercard';
    }
    if (/^9792/.test(d)) return 'troy';
    return null;
}

export function cardNumberLength(brand) {
    return brand === 'amex' ? 15 : 16;
}

export function cvvLength(brand) {
    return brand === 'amex' ? 4 : 3;
}

export function formatCardNumber(value, brand) {
    const d = digitsOnly(value).slice(0, cardNumberLength(brand));
    if (brand === 'amex') {
        return d.replace(/^(\d{0,4})(\d{0,6})(\d{0,5}).*/, (_, a, b, c) =>
            [a, b, c].filter(Boolean).join(' ')).trim();
    }
    return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export function formatExpiry(value) {
    const d = digitsOnly(value).slice(0, 4);
    if (d.length <= 2) return d;
    return `${d.slice(0, 2)}/${d.slice(2)}`;
}

export function luhnValid(digits) {
    const d = digitsOnly(digits);
    if (d.length < 13 || d.length > 19) return false;
    let sum = 0;
    let alt = false;
    for (let i = d.length - 1; i >= 0; i -= 1) {
        let n = d.charCodeAt(i) - 48;
        if (n < 0 || n > 9) return false;
        if (alt) {
            n *= 2;
            if (n > 9) n -= 9;
        }
        sum += n;
        alt = !alt;
    }
    return sum % 10 === 0;
}

export function parseExpiry(value) {
    const m = String(value || '').trim().match(/^(\d{2})\/(\d{2})$/);
    if (!m) return null;
    const month = Number(m[1]);
    const year = 2000 + Number(m[2]);
    if (month < 1 || month > 12) return null;
    return { month, year };
}

export function isExpiryPast(month, year) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    return year < currentYear || (year === currentYear && month < currentMonth);
}

export function sanitizeCardName(value) {
    return String(value || '')
        .replace(/[^\p{L}\s'-]/gu, '')
        .replace(/^\s+/, '')
        .replace(/\s{2,}/g, ' ')
        .slice(0, 40);
}

/**
 * Kart alanlarını doğrular. Dönen nesnede ham kart numarası / CVV yoktur.
 */
export function validateCardForm(fields) {
    const errors = {};
    const firstName = sanitizeCardName(fields.firstName).trim();
    const lastName = sanitizeCardName(fields.lastName).trim();
    const numberDigits = digitsOnly(fields.cardNumber);
    const brand = detectCardBrand(numberDigits);
    const expiryRaw = String(fields.expiry || '').trim();
    const cvvDigits = digitsOnly(fields.cvv);
    const expectedLen = cardNumberLength(brand);
    const expectedCvv = cvvLength(brand);

    if (!firstName) errors.firstName = 'Kart üzerindeki adı giriniz.';
    else if (firstName.length < 2) errors.firstName = 'Ad en az 2 karakter olmalıdır.';

    if (!lastName) errors.lastName = 'Kart üzerindeki soyadı giriniz.';
    else if (lastName.length < 2) errors.lastName = 'Soyad en az 2 karakter olmalıdır.';

    if (!numberDigits) {
        errors.cardNumber = 'Kart numarasını giriniz.';
    } else if (numberDigits.length < expectedLen) {
        errors.cardNumber = 'Kart numarası eksik. Lütfen tüm haneleri giriniz.';
    } else if (!luhnValid(numberDigits) || (brand && numberDigits.length !== expectedLen)) {
        errors.cardNumber = 'Geçersiz kart numarası. Lütfen kontrol ediniz.';
    }

    const expiry = parseExpiry(expiryRaw);
    if (!expiryRaw) {
        errors.expiry = 'Son kullanma tarihini giriniz.';
    } else if (!expiry) {
        errors.expiry = 'Son kullanma tarihini AA/YY formatında giriniz.';
    } else if (isExpiryPast(expiry.month, expiry.year)) {
        errors.expiry = 'Kartın son kullanma tarihi geçmiş. Farklı bir kart deneyiniz.';
    }

    if (!cvvDigits) {
        errors.cvv = 'CVV kodunu giriniz.';
    } else if (cvvDigits.length !== expectedCvv) {
        errors.cvv = brand === 'amex'
            ? 'American Express için 4 haneli güvenlik kodunu giriniz.'
            : 'CVV 3 haneli olmalıdır.';
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors,
        brand,
        expiryPast: !!(expiry && isExpiryPast(expiry.month, expiry.year)),
    };
}
