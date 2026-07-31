-- YAZİYO — Kullanıcı paket iptali (admin)
-- Supabase SQL Editor'da bir kez çalıştırın.

-- ============================================================
-- 1) Satın alma: durum + iptal zamanı
-- ============================================================
alter table public.egitim_paketi_satin_almalar
    add column if not exists durum text not null default 'aktif',
    add column if not exists iptal_edildi_at timestamptz;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'egitim_paketi_satin_almalar_durum_check'
    ) then
        alter table public.egitim_paketi_satin_almalar
            add constraint egitim_paketi_satin_almalar_durum_check
            check (durum in ('aktif', 'iptal_edildi'));
    end if;
end $$;

comment on column public.egitim_paketi_satin_almalar.durum is
    'aktif | iptal_edildi — admin iptali soft-cancel';
comment on column public.egitim_paketi_satin_almalar.iptal_edildi_at is
    'Paket iptal edildiği an';

-- Eski unique (paket_id, kullanici_id) → yalnızca aktif kayıtlar için
do $$
begin
    if exists (
        select 1 from pg_constraint
        where conname = 'egitim_paketi_satin_almalar_paket_id_kullanici_id_key'
    ) then
        alter table public.egitim_paketi_satin_almalar
            drop constraint egitim_paketi_satin_almalar_paket_id_kullanici_id_key;
    end if;
end $$;

drop index if exists public.egitim_paketi_satin_almalar_aktif_unique;
create unique index egitim_paketi_satin_almalar_aktif_unique
    on public.egitim_paketi_satin_almalar (paket_id, kullanici_id)
    where durum = 'aktif';

create index if not exists egitim_paketi_satin_almalar_durum_idx
    on public.egitim_paketi_satin_almalar (durum);

-- ============================================================
-- 2) Satın alma RPC: yalnızca aktif kayıt "zaten sahip" sayılır
-- ============================================================
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
        where paket_id = p_paket_id
          and kullanici_id = v_uid
          and durum = 'aktif'
    ) then
        return jsonb_build_object('success', false, 'code', 'already_owned', 'message', 'Bu paketi zaten satın aldınız.');
    end if;

    v_bitis := now() + make_interval(days => greatest(1, coalesce(v_paket.gecerlilik_gun, 30)));

    insert into public.egitim_paketi_satin_almalar (
        paket_id, kullanici_id, fiyat, gecerlilik_gun, satin_alma_tarihi, bitis_tarihi, durum
    ) values (
        p_paket_id, v_uid, coalesce(v_paket.fiyat, 0), coalesce(v_paket.gecerlilik_gun, 30), now(), v_bitis, 'aktif'
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

-- ============================================================
-- 3) Admin paket iptal RPC
-- ============================================================
create or replace function public.iptal_egitim_paketi(p_satin_alma_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_row public.egitim_paketi_satin_almalar%rowtype;
    v_paket_baslik text;
begin
    if v_uid is null then
        return jsonb_build_object('success', false, 'code', 'auth', 'message', 'Giriş gerekli.');
    end if;

    if not exists (
        select 1 from public.yonetici_hesaplari y
        where y.id = v_uid and y.active = true
    ) then
        return jsonb_build_object('success', false, 'code', 'forbidden', 'message', 'Bu işlem için yönetici yetkisi gerekir.');
    end if;

    if p_satin_alma_id is null then
        return jsonb_build_object('success', false, 'code', 'invalid', 'message', 'Geçersiz satın alma.');
    end if;

    select * into v_row
    from public.egitim_paketi_satin_almalar
    where id = p_satin_alma_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'code', 'not_found', 'message', 'Satın alma kaydı bulunamadı.');
    end if;

    if v_row.durum = 'iptal_edildi' then
        return jsonb_build_object('success', false, 'code', 'already_cancelled', 'message', 'Bu paket zaten iptal edilmiş.');
    end if;

    update public.egitim_paketi_satin_almalar
    set durum = 'iptal_edildi',
        iptal_edildi_at = now(),
        bitis_tarihi = least(bitis_tarihi, now())
    where id = p_satin_alma_id;

    update public.egitim_paketleri
    set satis_sayisi = greatest(0, coalesce(satis_sayisi, 0) - 1),
        updated_at = now()
    where id = v_row.paket_id;

    select baslik into v_paket_baslik
    from public.egitim_paketleri
    where id = v_row.paket_id;

    insert into public.yonetici_bildirimleri (baslik, mesaj, tur, paket_id, kullanici_id)
    values (
        'Paket iptal edildi',
        format(
            '%s paketi yönetici tarafından iptal edildi (kullanıcı: %s).',
            coalesce(v_paket_baslik, 'Paket'),
            v_row.kullanici_id::text
        ),
        'paket_iptal',
        v_row.paket_id,
        v_row.kullanici_id
    );

    return jsonb_build_object(
        'success', true,
        'message', 'Paket iptal edildi.',
        'satin_alma_id', p_satin_alma_id
    );
end;
$$;

revoke all on function public.iptal_egitim_paketi(uuid) from public;
grant execute on function public.iptal_egitim_paketi(uuid) to authenticated;

comment on function public.iptal_egitim_paketi(uuid) is
    'Yönetici: kullanıcının eğitim paketi satın alımını soft-cancel eder';

-- Değerlendirme: yalnızca aktif (ve süresi dolmuş) satın almalar
drop policy if exists "Users insert own expired-package rating" on public.egitim_paketi_degerlendirmeler;
create policy "Users insert own expired-package rating"
    on public.egitim_paketi_degerlendirmeler
    for insert
    to authenticated
    with check (
        kullanici_id = auth.uid()
        and exists (
            select 1
            from public.egitim_paketi_satin_almalar s
            where s.paket_id = egitim_paketi_degerlendirmeler.paket_id
              and s.kullanici_id = auth.uid()
              and s.durum = 'aktif'
              and s.bitis_tarihi <= now()
        )
    );
