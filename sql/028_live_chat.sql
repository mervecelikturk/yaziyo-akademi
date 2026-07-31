-- YAZİYO — Live Chat (Eğitimlerim floating widget + admin paneli)
-- Supabase SQL Editor'da bir kez çalıştırın.

-- ============================================================
-- Helpers
-- ============================================================
create or replace function public.is_yaziyo_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.yonetici_hesaplari y
        where y.id = auth.uid()
          and y.active = true
    );
$$;

create or replace function public.user_has_aktif_paket(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.egitim_paketi_satin_almalar s
        where s.kullanici_id = p_uid
          and coalesce(s.durum, 'aktif') = 'aktif'
    );
$$;

-- ============================================================
-- 1) Konuşmalar (kullanıcı başına tek thread)
-- ============================================================
create table if not exists public.live_chat_konusmalar (
    id uuid primary key default gen_random_uuid(),
    kullanici_id uuid not null unique references auth.users(id) on delete cascade,
    son_mesaj_at timestamptz default null,
    son_mesaj_ozet text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists live_chat_konusmalar_son_mesaj_idx
    on public.live_chat_konusmalar (son_mesaj_at desc nulls last);

alter table public.live_chat_konusmalar enable row level security;

drop policy if exists "Users read own live chat convo" on public.live_chat_konusmalar;
create policy "Users read own live chat convo"
    on public.live_chat_konusmalar for select to authenticated
    using (
        kullanici_id = auth.uid()
        or public.is_yaziyo_admin()
    );

drop policy if exists "Users insert own live chat convo" on public.live_chat_konusmalar;
create policy "Users insert own live chat convo"
    on public.live_chat_konusmalar for insert to authenticated
    with check (
        (
            kullanici_id = auth.uid()
            and public.user_has_aktif_paket(auth.uid())
        )
        or public.is_yaziyo_admin()
    );

drop policy if exists "Participants update live chat convo" on public.live_chat_konusmalar;
create policy "Participants update live chat convo"
    on public.live_chat_konusmalar for update to authenticated
    using (
        kullanici_id = auth.uid()
        or public.is_yaziyo_admin()
    )
    with check (
        kullanici_id = auth.uid()
        or public.is_yaziyo_admin()
    );

-- ============================================================
-- 2) Mesajlar
-- ============================================================
create table if not exists public.live_chat_mesajlar (
    id uuid primary key default gen_random_uuid(),
    konusma_id uuid not null references public.live_chat_konusmalar(id) on delete cascade,
    gonderen_id uuid not null references auth.users(id) on delete cascade,
    gonderen_rol text not null check (gonderen_rol in ('kullanici', 'admin')),
    tip text not null default 'text'
        check (tip in ('text', 'image', 'file', 'audio', 'link')),
    icerik text not null default '',
    dosya_url text default null,
    dosya_adi text default null,
    dosya_mime text default null,
    sure_sn integer default null check (sure_sn is null or sure_sn >= 0),
    goruldu boolean not null default false,
    goruldu_at timestamptz default null,
    created_at timestamptz not null default now(),
    constraint live_chat_mesaj_icerik_uzunluk check (char_length(icerik) <= 4000)
);

create index if not exists live_chat_mesajlar_konusma_idx
    on public.live_chat_mesajlar (konusma_id, created_at);

create index if not exists live_chat_mesajlar_goruldu_idx
    on public.live_chat_mesajlar (konusma_id, gonderen_rol, goruldu);

alter table public.live_chat_mesajlar enable row level security;

drop policy if exists "Participants read live chat messages" on public.live_chat_mesajlar;
create policy "Participants read live chat messages"
    on public.live_chat_mesajlar for select to authenticated
    using (
        public.is_yaziyo_admin()
        or exists (
            select 1 from public.live_chat_konusmalar k
            where k.id = konusma_id
              and k.kullanici_id = auth.uid()
        )
    );

drop policy if exists "Users insert text live chat messages" on public.live_chat_mesajlar;
create policy "Users insert text live chat messages"
    on public.live_chat_mesajlar for insert to authenticated
    with check (
        gonderen_id = auth.uid()
        and (
            (
                public.is_yaziyo_admin()
                and gonderen_rol = 'admin'
                and tip in ('text', 'image', 'file', 'audio', 'link')
            )
            or (
                not public.is_yaziyo_admin()
                and gonderen_rol = 'kullanici'
                and tip = 'text'
                and public.user_has_aktif_paket(auth.uid())
                and exists (
                    select 1 from public.live_chat_konusmalar k
                    where k.id = konusma_id
                      and k.kullanici_id = auth.uid()
                )
            )
        )
    );

drop policy if exists "Participants update seen live chat messages" on public.live_chat_mesajlar;
create policy "Participants update seen live chat messages"
    on public.live_chat_mesajlar for update to authenticated
    using (
        public.is_yaziyo_admin()
        or exists (
            select 1 from public.live_chat_konusmalar k
            where k.id = konusma_id
              and k.kullanici_id = auth.uid()
        )
    )
    with check (
        public.is_yaziyo_admin()
        or exists (
            select 1 from public.live_chat_konusmalar k
            where k.id = konusma_id
              and k.kullanici_id = auth.uid()
        )
    );

drop policy if exists "Admins delete live chat messages" on public.live_chat_mesajlar;
create policy "Admins delete live chat messages"
    on public.live_chat_mesajlar for delete to authenticated
    using (public.is_yaziyo_admin());

-- Konuşma özetini güncelle
create or replace function public.live_chat_mesaj_sonrasi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_ozet text;
begin
    if new.tip = 'text' then
        v_ozet := left(coalesce(new.icerik, ''), 120);
    elsif new.tip = 'image' then
        v_ozet := '📷 Görsel';
    elsif new.tip = 'file' then
        v_ozet := '📎 Dosya';
    elsif new.tip = 'audio' then
        v_ozet := '🎤 Ses kaydı';
    elsif new.tip = 'link' then
        v_ozet := '🔗 Görüşme bağlantısı';
    else
        v_ozet := 'Yeni mesaj';
    end if;

    update public.live_chat_konusmalar
    set son_mesaj_at = new.created_at,
        son_mesaj_ozet = v_ozet,
        updated_at = now()
    where id = new.konusma_id;

    return new;
end;
$$;

drop trigger if exists trg_live_chat_mesaj_sonrasi on public.live_chat_mesajlar;
create trigger trg_live_chat_mesaj_sonrasi
    after insert on public.live_chat_mesajlar
    for each row execute function public.live_chat_mesaj_sonrasi();

-- Kullanıcı yalnızca metin gönderebilsin (ek koruma)
create or replace function public.live_chat_mesaj_koru()
returns trigger
language plpgsql
as $$
begin
    if not public.is_yaziyo_admin() then
        new.gonderen_rol := 'kullanici';
        new.tip := 'text';
        new.dosya_url := null;
        new.dosya_adi := null;
        new.dosya_mime := null;
        new.gonderen_id := auth.uid();
        if char_length(trim(coalesce(new.icerik, ''))) < 1 then
            raise exception 'Mesaj boş olamaz';
        end if;
    else
        new.gonderen_rol := 'admin';
        new.gonderen_id := auth.uid();
    end if;

    if char_length(coalesce(new.icerik, '')) > 4000 then
        raise exception 'Mesaj en fazla 4000 karakter olabilir';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_live_chat_mesaj_koru on public.live_chat_mesajlar;
create trigger trg_live_chat_mesaj_koru
    before insert on public.live_chat_mesajlar
    for each row execute function public.live_chat_mesaj_koru();

-- Görüldü güncellemesinde yalnızca ilgili alanlar değişsin
create or replace function public.live_chat_mesaj_update_koru()
returns trigger
language plpgsql
as $$
declare
    v_admin boolean;
    v_can_mark boolean := false;
begin
    v_admin := public.is_yaziyo_admin();

    -- İçerik alanları her zaman kilitli
    new.id := old.id;
    new.konusma_id := old.konusma_id;
    new.gonderen_id := old.gonderen_id;
    new.gonderen_rol := old.gonderen_rol;
    new.tip := old.tip;
    new.icerik := old.icerik;
    new.dosya_url := old.dosya_url;
    new.dosya_adi := old.dosya_adi;
    new.dosya_mime := old.dosya_mime;
    new.created_at := old.created_at;

    if v_admin and old.gonderen_rol = 'kullanici' then
        v_can_mark := true;
    elsif (not v_admin) and old.gonderen_rol = 'admin' then
        v_can_mark := true;
    end if;

    if v_can_mark and new.goruldu is true and old.goruldu is false then
        new.goruldu := true;
        new.goruldu_at := coalesce(new.goruldu_at, now());
    else
        new.goruldu := old.goruldu;
        new.goruldu_at := old.goruldu_at;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_live_chat_mesaj_update_koru on public.live_chat_mesajlar;
create trigger trg_live_chat_mesaj_update_koru
    before update on public.live_chat_mesajlar
    for each row execute function public.live_chat_mesaj_update_koru();

-- ============================================================
-- 3) Presence (çevrimiçi / son görülme / yazıyor)
-- ============================================================
create table if not exists public.live_chat_presence (
    kullanici_id uuid primary key references auth.users(id) on delete cascade,
    cevrimici boolean not null default false,
    son_gorulme timestamptz not null default now(),
    yaziyor_konusma_id uuid default null references public.live_chat_konusmalar(id) on delete set null,
    yaziyor_at timestamptz default null,
    updated_at timestamptz not null default now()
);

alter table public.live_chat_presence enable row level security;

drop policy if exists "Auth read live chat presence" on public.live_chat_presence;
create policy "Auth read live chat presence"
    on public.live_chat_presence for select to authenticated
    using (true);

drop policy if exists "Users upsert own live chat presence" on public.live_chat_presence;
create policy "Users upsert own live chat presence"
    on public.live_chat_presence for insert to authenticated
    with check (kullanici_id = auth.uid());

drop policy if exists "Users update own live chat presence" on public.live_chat_presence;
create policy "Users update own live chat presence"
    on public.live_chat_presence for update to authenticated
    using (kullanici_id = auth.uid())
    with check (kullanici_id = auth.uid());

-- ============================================================
-- 4) Storage bucket (admin medya)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'live-chat',
    'live-chat',
    false,
    15728640, -- 15 MB
    array[
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip',
        'text/plain',
        'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav'
    ]
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins upload live chat files" on storage.objects;
create policy "Admins upload live chat files"
    on storage.objects for insert to authenticated
    with check (
        bucket_id = 'live-chat'
        and public.is_yaziyo_admin()
    );

drop policy if exists "Admins update live chat files" on storage.objects;
create policy "Admins update live chat files"
    on storage.objects for update to authenticated
    using (
        bucket_id = 'live-chat'
        and public.is_yaziyo_admin()
    )
    with check (
        bucket_id = 'live-chat'
        and public.is_yaziyo_admin()
    );

drop policy if exists "Admins delete live chat files" on storage.objects;
create policy "Admins delete live chat files"
    on storage.objects for delete to authenticated
    using (
        bucket_id = 'live-chat'
        and public.is_yaziyo_admin()
    );

drop policy if exists "Participants read live chat files" on storage.objects;
create policy "Participants read live chat files"
    on storage.objects for select to authenticated
    using (
        bucket_id = 'live-chat'
        and (
            public.is_yaziyo_admin()
            or (storage.foldername(name))[1] = auth.uid()::text
        )
    );

-- ============================================================
-- 5) Admin presence (paketli kullanıcılar yonetici_hesaplari okuyamaz)
-- ============================================================
create or replace function public.live_chat_admin_presence()
returns setof public.live_chat_presence
language sql
stable
security definer
set search_path = public
as $$
    select p.*
    from public.live_chat_presence p
    inner join public.yonetici_hesaplari y on y.id = p.kullanici_id and y.active = true
    where auth.uid() is not null
      and (
          public.is_yaziyo_admin()
          or public.user_has_aktif_paket(auth.uid())
      )
    order by
        case
            when p.cevrimici is true
             and p.updated_at > (now() - interval '75 seconds')
            then 0
            else 1
        end,
        p.updated_at desc nulls last,
        p.son_gorulme desc nulls last
    limit 1;
$$;

grant execute on function public.live_chat_admin_presence() to authenticated;

create or replace function public.live_chat_is_admin_id(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.yonetici_hesaplari y
        where y.id = p_uid and y.active = true
    );
$$;

grant execute on function public.live_chat_is_admin_id(uuid) to authenticated;

-- ============================================================
-- 6) Realtime
-- ============================================================
do $$
begin
    begin
        alter publication supabase_realtime add table public.live_chat_mesajlar;
    exception when duplicate_object then null;
    end;
    begin
        alter publication supabase_realtime add table public.live_chat_konusmalar;
    exception when duplicate_object then null;
    end;
    begin
        alter publication supabase_realtime add table public.live_chat_presence;
    exception when duplicate_object then null;
    end;
end $$;

-- Replica identity for realtime UPDATE payloads
alter table public.live_chat_mesajlar replica identity full;
alter table public.live_chat_konusmalar replica identity full;
alter table public.live_chat_presence replica identity full;
