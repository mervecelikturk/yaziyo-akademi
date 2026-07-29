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

-- 4) Satın alma RPC (limit kontrolü + yönetici bildirimi)
create or replace function public.satin_al_egitim_paketi(p_paket_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_paket public.egitim_paketleri%rowtype;
    v_bitis timestamptz;
    v_email text;
    v_ad text;
begin
    if v_uid is null then
        return jsonb_build_object('success', false, 'code', 'auth', 'message', 'Satın almak için giriş yapmalısınız.');
    end if;

    select * into v_paket
    from public.egitim_paketleri
    where id = p_paket_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'code', 'not_found', 'message', 'Paket bulunamadı.');
    end if;

    if coalesce(v_paket.aktif, false) is not true then
        return jsonb_build_object('success', false, 'code', 'inactive', 'message', 'Şu an aktif değil.');
    end if;

    if coalesce(v_paket.satis_sayisi, 0) >= coalesce(v_paket.max_satis, 100) then
        return jsonb_build_object('success', false, 'code', 'sold_out', 'message', 'Şu an aktif değil.');
    end if;

    if exists (
        select 1 from public.egitim_paketi_satin_almalar
        where paket_id = p_paket_id and kullanici_id = v_uid
    ) then
        return jsonb_build_object('success', false, 'code', 'already_owned', 'message', 'Bu paketi zaten satın aldınız.');
    end if;

    v_bitis := now() + make_interval(days => greatest(1, coalesce(v_paket.gecerlilik_gun, 30)));

    insert into public.egitim_paketi_satin_almalar (
        paket_id, kullanici_id, fiyat, gecerlilik_gun, satin_alma_tarihi, bitis_tarihi
    ) values (
        p_paket_id, v_uid, coalesce(v_paket.fiyat, 0), coalesce(v_paket.gecerlilik_gun, 30), now(), v_bitis
    );

    update public.egitim_paketleri
    set satis_sayisi = coalesce(satis_sayisi, 0) + 1,
        updated_at = now()
    where id = p_paket_id;

    select email into v_email from auth.users where id = v_uid;
    begin
        select nullif(trim(coalesce(full_name, '')), '') into v_ad
        from public.kullanicilar
        where id = v_uid;
    exception when others then
        v_ad := null;
    end;

    insert into public.yonetici_bildirimleri (baslik, mesaj, tur, paket_id, kullanici_id)
    values (
        'Yeni paket satışı',
        format(
            '%s paketi satın alındı. Alıcı: %s%s — Geçerlilik: %s gün (bitiş: %s).',
            coalesce(v_paket.baslik, 'Paket'),
            coalesce(v_ad, coalesce(v_email, 'Kullanıcı')),
            case when v_email is not null and v_ad is not null then ' (' || v_email || ')' else '' end,
            coalesce(v_paket.gecerlilik_gun, 30)::text,
            to_char(v_bitis at time zone 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI')
        ),
        'paket_satis',
        p_paket_id,
        v_uid
    );

    return jsonb_build_object(
        'success', true,
        'message', 'Paket başarıyla satın alındı.',
        'bitis_tarihi', v_bitis,
        'gecerlilik_gun', coalesce(v_paket.gecerlilik_gun, 30),
        'icerik_url', coalesce(v_paket.icerik_url, '')
    );
end;
$$;

revoke all on function public.satin_al_egitim_paketi(uuid) from public;
grant execute on function public.satin_al_egitim_paketi(uuid) to authenticated;

comment on function public.satin_al_egitim_paketi(uuid) is
    'Eğitim paketi satın alma: satış limiti, geçerlilik ve yönetici bildirimi';
