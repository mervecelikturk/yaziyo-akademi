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
-- 2) Satın alma RPC — KALDIRILDI (bkz. sql/033_odemesiz_erisim_kapatma.sql)
--
-- Bu bölüm public.satin_al_egitim_paketi(uuid) fonksiyonunu yeniden
-- oluşturuyordu. Fonksiyon ödeme doğrulaması yapmadan eğitim erişimi açtığı
-- için tamamen kaldırıldı; dosya tekrar çalıştırıldığında açığın geri gelmemesi
-- adına burada da bırakılmadı.
--
-- Erişim yalnızca sql/031 içindeki odeme_siparis_teslim_et(...) ile,
-- service_role ve doğrulanmış ödeme sonrası tanımlanır.
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
