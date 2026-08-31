-- YAZİYO — Eğitim paketi satış limiti, geçerlilik süresi ve yönetici bildirimleri
-- Supabase SQL Editor'da bir kez çalıştırın.

-- 1) Paket kolonları
alter table public.egitim_paketleri
    add column if not exists max_satis integer not null default 100,
    add column if not exists gecerlilik_gun integer not null default 30,
    add column if not exists satis_sayisi integer not null default 0;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'egitim_paketleri_max_satis_check'
    ) then
        alter table public.egitim_paketleri
            add constraint egitim_paketleri_max_satis_check
            check (max_satis >= 1 and max_satis <= 100);
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'egitim_paketleri_gecerlilik_gun_check'
    ) then
        alter table public.egitim_paketleri
            add constraint egitim_paketleri_gecerlilik_gun_check
            check (gecerlilik_gun >= 1 and gecerlilik_gun <= 3650);
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'egitim_paketleri_satis_sayisi_check'
    ) then
        alter table public.egitim_paketleri
            add constraint egitim_paketleri_satis_sayisi_check
            check (satis_sayisi >= 0);
    end if;
end $$;

comment on column public.egitim_paketleri.max_satis is 'Paketin satılabileceği maksimum kişi sayısı (1-100)';
comment on column public.egitim_paketleri.gecerlilik_gun is 'Satın alma sonrası geçerlilik süresi (gün)';
comment on column public.egitim_paketleri.satis_sayisi is 'Toplam satış / kayıt sayısı';

-- 2) Satın alma kayıtları
create table if not exists public.egitim_paketi_satin_almalar (
    id uuid primary key default gen_random_uuid(),
    paket_id uuid not null references public.egitim_paketleri(id) on delete cascade,
    kullanici_id uuid not null references auth.users(id) on delete cascade,
    fiyat numeric not null default 0,
    gecerlilik_gun integer not null default 30,
    satin_alma_tarihi timestamptz not null default now(),
    bitis_tarihi timestamptz not null,
    created_at timestamptz not null default now(),
    unique (paket_id, kullanici_id)
);

create index if not exists egitim_paketi_satin_almalar_paket_idx
    on public.egitim_paketi_satin_almalar (paket_id);

create index if not exists egitim_paketi_satin_almalar_kullanici_idx
    on public.egitim_paketi_satin_almalar (kullanici_id);

alter table public.egitim_paketi_satin_almalar enable row level security;

drop policy if exists "Users read own package purchases" on public.egitim_paketi_satin_almalar;
create policy "Users read own package purchases"
    on public.egitim_paketi_satin_almalar
    for select
    to authenticated
    using (
        kullanici_id = auth.uid()
        or exists (
            select 1 from public.yonetici_hesaplari y
            where y.id = auth.uid() and y.active = true
        )
    );

-- 3) Yönetici bildirimleri
create table if not exists public.yonetici_bildirimleri (
    id uuid primary key default gen_random_uuid(),
    baslik text not null,
    mesaj text not null,
    tur text not null default 'paket_satis',
    paket_id uuid references public.egitim_paketleri(id) on delete set null,
    kullanici_id uuid references auth.users(id) on delete set null,
    okundu boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists yonetici_bildirimleri_created_idx
    on public.yonetici_bildirimleri (created_at desc);

create index if not exists yonetici_bildirimleri_okundu_idx
    on public.yonetici_bildirimleri (okundu);

alter table public.yonetici_bildirimleri enable row level security;

drop policy if exists "Admins read yonetici_bildirimleri" on public.yonetici_bildirimleri;
create policy "Admins read yonetici_bildirimleri"
    on public.yonetici_bildirimleri
    for select
    to authenticated
    using (
        exists (
            select 1 from public.yonetici_hesaplari y
            where y.id = auth.uid() and y.active = true
        )
    );

drop policy if exists "Admins update yonetici_bildirimleri" on public.yonetici_bildirimleri;
create policy "Admins update yonetici_bildirimleri"
    on public.yonetici_bildirimleri
    for update
    to authenticated
    using (
        exists (
            select 1 from public.yonetici_hesaplari y
            where y.id = auth.uid() and y.active = true
        )
    )
    with check (
        exists (
            select 1 from public.yonetici_hesaplari y
            where y.id = auth.uid() and y.active = true
        )
    );

drop policy if exists "Admins delete yonetici_bildirimleri" on public.yonetici_bildirimleri;
create policy "Admins delete yonetici_bildirimleri"
    on public.yonetici_bildirimleri
    for delete
    to authenticated
    using (
        exists (
            select 1 from public.yonetici_hesaplari y
            where y.id = auth.uid() and y.active = true
        )
    );

-- 4) Satın alma RPC — KALDIRILDI (bkz. sql/033_odemesiz_erisim_kapatma.sql)
--
-- Burada tanımlı olan public.satin_al_egitim_paketi(uuid) fonksiyonu security
-- definer idi ve authenticated rolüne execute yetkisi veriliyordu. Ödeme
-- doğrulaması yapmadan egitim_paketi_satin_almalar tablosuna aktif kayıt
-- yazdığı için giriş yapmış her kullanıcı ücretli pakete bedava erişebiliyordu.
--
-- Eğitim erişimi artık YALNIZCA şu yolla tanımlanır:
--   sql/031_odeme_siparisleri.sql → public.odeme_siparis_teslim_et(...)
--   (service_role; sağlayıcı ödemesi doğrulandıktan sonra çağrılır)
--
-- Bu bölümü geri eklemeyin. Yönetici elle erişim tanımlamak isterse siparişi
-- teslim eden fonksiyon service_role ile çağrılmalıdır.
