/** Türkiye illeri ve adliye seçenekleri */
export const TURKIYE_ILLER = [
    'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin',
    'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa',
    'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan',
    'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Isparta',
    'Mersin', 'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir',
    'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla',
    'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop',
    'Sivas', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak', 'Van',
    'Yozgat', 'Zonguldak', 'Aksaray', 'Bayburt', 'Karaman', 'Kırıkkale', 'Batman', 'Şırnak',
    'Bartın', 'Ardahan', 'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce',
];

export const BECAYIS_UNVANLAR = [
    { value: 'zabit_katibi', label: 'Zabıt Katibi' },
    { value: 'cte_katibi', label: 'CTE Katibi' },
    { value: 'icra_katibi', label: 'İcra Katibi' },
    { value: 'mubasir', label: 'Mübaşir' },
];

export const BECAYIS_SEBEP_MAX = 264;

/** @param {string} il */
export function getAdliyelerForIl(il) {
    if (!il) return [];
    return [
        `${il} Adliyesi`,
        `${il} Adalet Sarayı`,
        `${il} Cumhuriyet Başsavcılığı`,
        `${il} İcra Müdürlüğü`,
    ];
}

export function unvanLabel(value) {
    return BECAYIS_UNVANLAR.find((u) => u.value === value)?.label || value || '—';
}
