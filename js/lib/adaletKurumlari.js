/** Adalet kurumları — kategori (Adliye / BAM / CTE) ve JSON erişimi */

export const KURUM_KATEGORILERI = [
    { value: 'ADLIYE', label: 'Adliye' },
    { value: 'BAM', label: 'BAM' },
    { value: 'CTE', label: 'CTE' },
];

/** UI kategorisi → veri modeli kurum_tipi değerleri */
export const KATEGORI_TIPLER = {
    ADLIYE: ['ADLIYE'],
    BAM: ['BAM'],
    CTE: ['DENETIMLI_SERBESTLIK', 'CTE_CEZA_INF', 'EGITIM_EVI'],
};

export const KURUM_TIPI_LABELS = {
    ADLIYE: 'Adliye',
    BAM: 'Bölge Adliye Mahkemesi (BAM)',
    DENETIMLI_SERBESTLIK: 'Denetimli Serbestlik Müdürlüğü',
    CTE_CEZA_INF: 'Ceza İnfaz Kurumu',
    EGITIM_EVI: 'Eğitim Evi',
};

let _cache = null;

export function kurumKey(k) {
    return [k.il, k.ilce ?? '', k.kurum_tipi, k.alt_tur ?? '', k.kurum_adi ?? ''].join('|');
}

export function formatKurumLabel(k) {
    return k.kurum_adi?.trim() || '—';
}

export function kategoriForKurum(k) {
    if (k.kurum_tipi === 'ADLIYE') return 'ADLIYE';
    if (k.kurum_tipi === 'BAM') return 'BAM';
    return 'CTE';
}

export async function loadAdaletKurumlari() {
    if (_cache) return _cache;
    const res = await fetch('../data/adalet-kurumlari.json');
    if (!res.ok) throw new Error('Kurum verisi yüklenemedi');
    _cache = await res.json();
    return _cache;
}

export function filterKurumlarByKategori(kurumlar, { il, kategori } = {}) {
    return kurumlar.filter((k) => {
        if (k.aktif === false) return false;
        if (il && k.il !== il) return false;
        if (!kategori) return true;
        const tips = KATEGORI_TIPLER[kategori] || [];
        return tips.includes(k.kurum_tipi);
    });
}

export function getKategorilerForIl(kurumlar, il) {
    const inIl = kurumlar.filter((k) => k.il === il && k.aktif !== false);
    const cats = new Set(inIl.map(kategoriForKurum));
    return KURUM_KATEGORILERI.filter((o) => cats.has(o.value));
}

export function findKurumByKey(kurumlar, key) {
    return kurumlar.find((k) => kurumKey(k) === key) ?? null;
}

export function getIllerFromKurumlar(kurumlar) {
    return [...new Set(kurumlar.filter((k) => k.aktif !== false).map((k) => k.il))]
        .sort((a, b) => a.localeCompare(b, 'tr'));
}
