-- YAZİYO — Paket yetkilendirme + kullanıcı değerlendirmeleri
-- Supabase SQL Editor'da bir kez çalıştırın.

-- ============================================================
-- 1) Paket yetkileri + değerlendirme özeti kolonları
-- ============================================================
alter table public.egitim_paketleri
    add column if not exists yetkiler jsonb not null default '[]'::jsonb,
    add column if not exists ortalama_puan numeric(3,2) default null,
    add column if not exists degerlendirme_sayisi integer not null default 0;

comment on column public.egitim_paketleri.yetkiler is
    'Paketin aktif ettiği platform özellikleri (string id listesi)';
comment on column public.egitim_paketleri.ortalama_puan is
    'Kullanıcı değerlendirmeleri ortalaması (1-5); yoksa null';
comment on column public.egitim_paketleri.degerlendirme_sayisi is
    'Toplam değerlendirme sayısı';

-- ============================================================
-- 2) Değerlendirme tablosu
-- ============================================================
create table if not exists public.egitim_paketi_degerlendirmeler (
    id uuid primary key default gen_random_uuid(),
    paket_id uuid not null references public.egitim_paketleri(id) on delete cascade,
    kullanici_id uuid not null references auth.users(id) on delete cascade,
    satin_alma_id uuid references public.egitim_paketi_satin_almalar(id) on delete set null,
    puan integer not null check (puan >= 1 and puan <= 5),
    yorum text not null default '',
    created_at timestamptz not null default now(),
    unique (paket_id, kullanici_id)
);

create index if not exists egitim_paketi_degerlendirmeler_paket_idx
    on public.egitim_paketi_degerlendirmeler (paket_id);

alter table public.egitim_paketi_degerlendirmeler enable row level security;

drop policy if exists "Public read package ratings" on public.egitim_paketi_degerlendirmeler;
create policy "Public read package ratings"
    on public.egitim_paketi_degerlendirmeler
    for select
    to anon, authenticated
    using (true);

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
              and s.bitis_tarihi <= now()
        )
    );

drop policy if exists "Users update own rating" on public.egitim_paketi_degerlendirmeler;
create policy "Users update own rating"
    on public.egitim_paketi_degerlendirmeler
    for update
    to authenticated
    using (kullanici_id = auth.uid())
    with check (kullanici_id = auth.uid());

drop policy if exists "Admins manage ratings" on public.egitim_paketi_degerlendirmeler;
create policy "Admins manage ratings"
    on public.egitim_paketi_degerlendirmeler
    for all
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

-- Ortalama puanı paket satırına yansıt
create or replace function public.egitim_paketi_degerlendirme_ozet_guncelle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_paket uuid;
    v_avg numeric;
    v_cnt integer;
begin
    v_paket := coalesce(new.paket_id, old.paket_id);

    select round(avg(puan)::numeric, 2), count(*)::integer
    into v_avg, v_cnt
    from public.egitim_paketi_degerlendirmeler
    where paket_id = v_paket;

    update public.egitim_paketleri
    set ortalama_puan = case when v_cnt > 0 then v_avg else null end,
        degerlendirme_sayisi = coalesce(v_cnt, 0),
        updated_at = now()
    where id = v_paket;

    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_egitim_paketi_degerlendirme_ozet on public.egitim_paketi_degerlendirmeler;
create trigger trg_egitim_paketi_degerlendirme_ozet
    after insert or update or delete on public.egitim_paketi_degerlendirmeler
    for each row execute function public.egitim_paketi_degerlendirme_ozet_guncelle();

-- Güvenli değerlendirme RPC (süresi bitmiş satın alma şartı)
create or replace function public.egitim_paketi_degerlendir(
    p_paket_id uuid,
    p_puan integer,
    p_yorum text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_satin uuid;
begin
    if v_uid is null then
        return jsonb_build_object('success', false, 'message', 'Giriş gerekli');
    end if;

    if p_puan is null or p_puan < 1 or p_puan > 5 then
        return jsonb_build_object('success', false, 'message', 'Puan 1-5 arasında olmalı');
    end if;

    select id into v_satin
    from public.egitim_paketi_satin_almalar
    where paket_id = p_paket_id
      and kullanici_id = v_uid
      and bitis_tarihi <= now()
    order by bitis_tarihi desc
    limit 1;

    if v_satin is null then
        return jsonb_build_object(
            'success', false,
            'message', 'Değerlendirme yalnızca süresi bitmiş paketler için yapılabilir.'
        );
    end if;

    insert into public.egitim_paketi_degerlendirmeler (
        paket_id, kullanici_id, satin_alma_id, puan, yorum
    ) values (
        p_paket_id, v_uid, v_satin, p_puan, left(coalesce(p_yorum, ''), 500)
    )
    on conflict (paket_id, kullanici_id) do update
    set puan = excluded.puan,
        yorum = excluded.yorum,
        satin_alma_id = excluded.satin_alma_id;

    return jsonb_build_object('success', true, 'message', 'Değerlendirmeniz kaydedildi.');
end;
$$;

revoke all on function public.egitim_paketi_degerlendir(uuid, integer, text) from public;
grant execute on function public.egitim_paketi_degerlendir(uuid, integer, text) to authenticated;
