-- YAZİYO — Eğitimlerim (öğrenci paneli + admin yönetimi)
-- Supabase SQL Editor'da bir kez çalıştırın.

-- ============================================================
-- 1) Kullanıcıya özel eğitim profili (koç, rozet, hedefler, görüşme)
-- ============================================================
create table if not exists public.egitimlerim_profiller (
    kullanici_id uuid primary key references auth.users(id) on delete cascade,
    koc_adi text not null default '',
    basari_rozeti text default null,
    hedef_hiz_net integer not null default 40,
    hedef_3dk_net integer not null default 90,
    sonraki_gorusme timestamptz default null,
    aktif boolean not null default true,
    notlar_admin text default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.egitimlerim_profiller enable row level security;

drop policy if exists "Users read own egitimlerim profile" on public.egitimlerim_profiller;
create policy "Users read own egitimlerim profile"
    on public.egitimlerim_profiller for select to authenticated
    using (
        kullanici_id = auth.uid()
        or exists (select 1 from public.yonetici_hesaplari y where y.id = auth.uid() and y.active = true)
    );

drop policy if exists "Admins write egitimlerim profiles" on public.egitimlerim_profiller;
create policy "Admins write egitimlerim profiles"
    on public.egitimlerim_profiller for all to authenticated
    using (exists (select 1 from public.yonetici_hesaplari y where y.id = auth.uid() and y.active = true))
    with check (exists (select 1 from public.yonetici_hesaplari y where y.id = auth.uid() and y.active = true));

-- ============================================================
-- 2) Günlük notlar (kullanıcı yazar, admin emoji bırakır)
-- ============================================================
create table if not exists public.egitimlerim_gunluk_notlar (
    id uuid primary key default gen_random_uuid(),
    kullanici_id uuid not null references auth.users(id) on delete cascade,
    not_tarihi date not null default (timezone('Europe/Istanbul', now()))::date,
    icerik text not null default '',
    admin_emoji text default null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (kullanici_id, not_tarihi),
    constraint egitimlerim_not_uzunluk check (char_length(icerik) <= 256)
);

create index if not exists egitimlerim_gunluk_notlar_user_idx
    on public.egitimlerim_gunluk_notlar (kullanici_id, not_tarihi desc);

alter table public.egitimlerim_gunluk_notlar enable row level security;

drop policy if exists "Users manage own daily notes" on public.egitimlerim_gunluk_notlar;
create policy "Users manage own daily notes"
    on public.egitimlerim_gunluk_notlar for all to authenticated
    using (kullanici_id = auth.uid())
    with check (kullanici_id = auth.uid() and char_length(coalesce(icerik, '')) <= 256);

drop policy if exists "Admins read update daily notes" on public.egitimlerim_gunluk_notlar;
create policy "Admins read update daily notes"
    on public.egitimlerim_gunluk_notlar for select to authenticated
    using (exists (select 1 from public.yonetici_hesaplari y where y.id = auth.uid() and y.active = true));

drop policy if exists "Admins update emoji on notes" on public.egitimlerim_gunluk_notlar;
create policy "Admins update emoji on notes"
    on public.egitimlerim_gunluk_notlar for update to authenticated
    using (exists (select 1 from public.yonetici_hesaplari y where y.id = auth.uid() and y.active = true))
    with check (exists (select 1 from public.yonetici_hesaplari y where y.id = auth.uid() and y.active = true));

-- Kullanıcı notu kaydederken admin_emoji'yi değiştiremesin diye trigger
create or replace function public.egitimlerim_not_koru()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'UPDATE' and not exists (
        select 1 from public.yonetici_hesaplari y where y.id = auth.uid() and y.active = true
    ) then
        new.admin_emoji := old.admin_emoji;
        new.kullanici_id := old.kullanici_id;
        new.not_tarihi := old.not_tarihi;
    end if;
    if char_length(coalesce(new.icerik, '')) > 256 then
        raise exception 'Not en fazla 256 karakter olabilir';
    end if;
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_egitimlerim_not_koru on public.egitimlerim_gunluk_notlar;
create trigger trg_egitimlerim_not_koru
    before update on public.egitimlerim_gunluk_notlar
    for each row execute function public.egitimlerim_not_koru();

-- ============================================================
-- 3) Kişiye özel görevler
-- ============================================================
create table if not exists public.egitimlerim_gorevler (
    id uuid primary key default gen_random_uuid(),
    kullanici_id uuid not null references auth.users(id) on delete cascade,
    baslik text not null,
    aciklama text not null default '',
    tahmini_sure_dk integer not null default 15,
    oncelik text not null default 'onerilen' check (oncelik in ('zorunlu', 'onerilen')),
    durum text not null default 'baslamadi'
        check (durum in ('baslamadi', 'devam_ediyor', 'tamamlandi', 'atlandi')),
    sira integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists egitimlerim_gorevler_user_idx
    on public.egitimlerim_gorevler (kullanici_id, sira);

alter table public.egitimlerim_gorevler enable row level security;

drop policy if exists "Users read own tasks" on public.egitimlerim_gorevler;
create policy "Users read own tasks"
    on public.egitimlerim_gorevler for select to authenticated
    using (
        kullanici_id = auth.uid()
        or exists (select 1 from public.yonetici_hesaplari y where y.id = auth.uid() and y.active = true)
    );

drop policy if exists "Users update own task status" on public.egitimlerim_gorevler;
create policy "Users update own task status"
    on public.egitimlerim_gorevler for update to authenticated
    using (kullanici_id = auth.uid())
    with check (kullanici_id = auth.uid());

drop policy if exists "Admins manage tasks" on public.egitimlerim_gorevler;
create policy "Admins manage tasks"
    on public.egitimlerim_gorevler for all to authenticated
    using (exists (select 1 from public.yonetici_hesaplari y where y.id = auth.uid() and y.active = true))
    with check (exists (select 1 from public.yonetici_hesaplari y where y.id = auth.uid() and y.active = true));

-- ============================================================
-- 4) Takvim etkinlikleri (görüşme / online ders)
-- ============================================================
create table if not exists public.egitimlerim_takvim (
    id uuid primary key default gen_random_uuid(),
    kullanici_id uuid not null references auth.users(id) on delete cascade,
    baslik text not null default 'Görüşme',
    tur text not null default 'gorusme' check (tur in ('gorusme', 'online_ders')),
    baslangic timestamptz not null,
    bitis timestamptz not null,
    durum text not null default 'planlandi'
        check (durum in ('planlandi', 'gerceklesti', 'iptal_edildi', 'ertelendi')),
    notlar text default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists egitimlerim_takvim_baslangic_idx
    on public.egitimlerim_takvim (baslangic);
create index if not exists egitimlerim_takvim_user_idx
    on public.egitimlerim_takvim (kullanici_id, baslangic);

alter table public.egitimlerim_takvim enable row level security;

drop policy if exists "Users read calendar (own + busy slots)" on public.egitimlerim_takvim;
drop policy if exists "Users read own calendar" on public.egitimlerim_takvim;
create policy "Users read own calendar"
    on public.egitimlerim_takvim for select to authenticated
    using (
        kullanici_id = auth.uid()
        or exists (select 1 from public.yonetici_hesaplari y where y.id = auth.uid() and y.active = true)
    );

drop policy if exists "Admins manage calendar" on public.egitimlerim_takvim;
create policy "Admins manage calendar"
    on public.egitimlerim_takvim for all to authenticated
    using (exists (select 1 from public.yonetici_hesaplari y where y.id = auth.uid() and y.active = true))
    with check (exists (select 1 from public.yonetici_hesaplari y where y.id = auth.uid() and y.active = true));

-- Kullanıcı: kendi etkinlikleri + başkalarının saatleri "Dolu" (detaysız)
create or replace function public.egitimlerim_takvim_listele()
returns table (
    id uuid,
    kullanici_id uuid,
    baslik text,
    tur text,
    baslangic timestamptz,
    bitis timestamptz,
    durum text,
    notlar text,
    kendi_etkinligi boolean,
    created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
    select
        t.id,
        case when t.kullanici_id = auth.uid() then t.kullanici_id else null end,
        case when t.kullanici_id = auth.uid() then t.baslik else 'Dolu' end,
        case when t.kullanici_id = auth.uid() then t.tur else 'dolu' end,
        t.baslangic,
        t.bitis,
        case when t.kullanici_id = auth.uid() then t.durum else 'dolu' end,
        case when t.kullanici_id = auth.uid() then t.notlar else null end,
        (t.kullanici_id = auth.uid()),
        t.created_at
    from public.egitimlerim_takvim t
    where auth.uid() is not null
      and (
          t.kullanici_id = auth.uid()
          or t.durum <> 'iptal_edildi'
      );
$$;

revoke all on function public.egitimlerim_takvim_listele() from public;
grant execute on function public.egitimlerim_takvim_listele() to authenticated;

-- Eski view varsa kaldır (RPC kullanıyoruz)
drop view if exists public.egitimlerim_takvim_gorunum;

-- ============================================================
-- 5) Etüt odaları
-- ============================================================
create table if not exists public.egitimlerim_etutler (
    id uuid primary key default gen_random_uuid(),
    baslik text not null default 'Etüt Odası',
    baslangic timestamptz not null,
    bitis timestamptz not null,
    meet_url text not null default '',
    aktif boolean not null default true,
    created_at timestamptz not null default now()
);

alter table public.egitimlerim_etutler enable row level security;

drop policy if exists "Authenticated read etutler" on public.egitimlerim_etutler;
create policy "Authenticated read etutler"
    on public.egitimlerim_etutler for select to authenticated
    using (aktif = true or exists (
        select 1 from public.yonetici_hesaplari y where y.id = auth.uid() and y.active = true
    ));

drop policy if exists "Admins manage etutler" on public.egitimlerim_etutler;
create policy "Admins manage etutler"
    on public.egitimlerim_etutler for all to authenticated
    using (exists (select 1 from public.yonetici_hesaplari y where y.id = auth.uid() and y.active = true))
    with check (exists (select 1 from public.yonetici_hesaplari y where y.id = auth.uid() and y.active = true));

-- Katılım kaydı (ileride sayaç için; şimdilik pasif kullanım)
create table if not exists public.egitimlerim_etut_katilim (
    id uuid primary key default gen_random_uuid(),
    etut_id uuid not null references public.egitimlerim_etutler(id) on delete cascade,
    kullanici_id uuid not null references auth.users(id) on delete cascade,
    katilim_tarihi timestamptz not null default now(),
    unique (etut_id, kullanici_id)
);

alter table public.egitimlerim_etut_katilim enable row level security;

drop policy if exists "Users read own etut attendance" on public.egitimlerim_etut_katilim;
create policy "Users read own etut attendance"
    on public.egitimlerim_etut_katilim for select to authenticated
    using (
        kullanici_id = auth.uid()
        or exists (select 1 from public.yonetici_hesaplari y where y.id = auth.uid() and y.active = true)
    );

drop policy if exists "Users insert own etut attendance" on public.egitimlerim_etut_katilim;
create policy "Users insert own etut attendance"
    on public.egitimlerim_etut_katilim for insert to authenticated
    with check (kullanici_id = auth.uid());

drop policy if exists "Admins manage etut attendance" on public.egitimlerim_etut_katilim;
create policy "Admins manage etut attendance"
    on public.egitimlerim_etut_katilim for all to authenticated
    using (exists (select 1 from public.yonetici_hesaplari y where y.id = auth.uid() and y.active = true))
    with check (exists (select 1 from public.yonetici_hesaplari y where y.id = auth.uid() and y.active = true));

-- ============================================================
-- 6) Belgeler (PDF — admin gönderir)
-- ============================================================
create table if not exists public.egitimlerim_belgeler (
    id uuid primary key default gen_random_uuid(),
    kullanici_id uuid not null references auth.users(id) on delete cascade,
    belge_turu text not null check (belge_turu in ('katilim', 'tamamlama', 'basari')),
    baslik text not null,
    dosya_adi text not null,
    dosya_base64 text not null,
    alici_adi text not null default '',
    created_at timestamptz not null default now()
);

create index if not exists egitimlerim_belgeler_user_idx
    on public.egitimlerim_belgeler (kullanici_id, created_at desc);

alter table public.egitimlerim_belgeler enable row level security;

drop policy if exists "Users read own documents" on public.egitimlerim_belgeler;
create policy "Users read own documents"
    on public.egitimlerim_belgeler for select to authenticated
    using (
        kullanici_id = auth.uid()
        or exists (select 1 from public.yonetici_hesaplari y where y.id = auth.uid() and y.active = true)
    );

drop policy if exists "Admins manage documents" on public.egitimlerim_belgeler;
create policy "Admins manage documents"
    on public.egitimlerim_belgeler for all to authenticated
    using (exists (select 1 from public.yonetici_hesaplari y where y.id = auth.uid() and y.active = true))
    with check (exists (select 1 from public.yonetici_hesaplari y where y.id = auth.uid() and y.active = true));

-- ============================================================
-- 7) İlerleme özeti RPC (hız + 3dk metin netleri)
-- ============================================================
create or replace function public.egitimlerim_ilerleme_ozeti(p_kullanici_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := coalesce(p_kullanici_id, auth.uid());
    v_is_admin boolean;
    v_min_hiz numeric := null;
    v_max_hiz numeric := null;
    v_min_3dk numeric := null;
    v_max_3dk numeric := null;
    v_hedef_hiz integer := 40;
    v_hedef_3dk integer := 90;
begin
    if auth.uid() is null then
        return jsonb_build_object('success', false, 'message', 'Oturum gerekli');
    end if;

    v_is_admin := exists (
        select 1 from public.yonetici_hesaplari y where y.id = auth.uid() and y.active = true
    );

    if v_uid <> auth.uid() and not v_is_admin then
        return jsonb_build_object('success', false, 'message', 'Yetkisiz');
    end if;

    select hedef_hiz_net, hedef_3dk_net into v_hedef_hiz, v_hedef_3dk
    from public.egitimlerim_profiller
    where kullanici_id = v_uid;

    -- Hız testi kayıtları (tablo yoksa sessizce atla)
    begin
        execute $q$
            select min(kelime_sayisi)::numeric, max(kelime_sayisi)::numeric
            from public.hiz_testi_sonuclari
            where kullanici_id = $1
        $q$ into v_min_hiz, v_max_hiz using v_uid;
    exception when undefined_table then
        v_min_hiz := null;
        v_max_hiz := null;
    when others then
        begin
            execute $q$
                select min(wpm)::numeric, max(wpm)::numeric
                from public.hiz_testi_kayitlari
                where kullanici_id = $1
            $q$ into v_min_hiz, v_max_hiz using v_uid;
        exception when others then
            v_min_hiz := null;
            v_max_hiz := null;
        end;
    end;

    -- 3 dakikalık çıkmış metin netleri
    begin
        execute $q$
            select min(net_kelime_3dk)::numeric, max(net_kelime_3dk)::numeric
            from public.klavye_calisma_kayitlari
            where kullanici_id = $1
              and coalesce(gecerli_3dk, false) = true
              and coalesce(net_kelime_3dk, 0) > 0
        $q$ into v_min_3dk, v_max_3dk using v_uid;
    exception when others then
        begin
            select en_dusuk_3dk_kelime::numeric, en_yuksek_3dk_kelime::numeric
            into v_min_3dk, v_max_3dk
            from public.kullanicilar
            where id = v_uid;
        exception when others then
            v_min_3dk := null;
            v_max_3dk := null;
        end;
    end;

    return jsonb_build_object(
        'success', true,
        'min_hiz', v_min_hiz,
        'max_hiz', v_max_hiz,
        'min_3dk', v_min_3dk,
        'max_3dk', v_max_3dk,
        'hedef_hiz', coalesce(v_hedef_hiz, 40),
        'hedef_3dk', coalesce(v_hedef_3dk, 90)
    );
end;
$$;

revoke all on function public.egitimlerim_ilerleme_ozeti(uuid) from public;
grant execute on function public.egitimlerim_ilerleme_ozeti(uuid) to authenticated;

comment on table public.egitimlerim_profiller is 'Eğitimlerim kullanıcı profili (koç, rozet, hedefler)';
comment on table public.egitimlerim_gunluk_notlar is 'Kullanıcı günlük notları + admin emoji';
comment on table public.egitimlerim_gorevler is 'Kişiye özel eğitim görevleri';
comment on table public.egitimlerim_takvim is 'Görüşme ve online ders takvimi';
comment on table public.egitimlerim_etutler is 'Etüt odaları (Google Meet)';
comment on table public.egitimlerim_belgeler is 'Admin tarafından gönderilen PDF belgeler';
