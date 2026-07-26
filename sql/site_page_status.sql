-- YAZİYO — Sayfa aktif/pasif durumu (İçerik Ekle)
-- Supabase SQL Editor'da bir kez çalıştırın.

create table if not exists public.site_page_status (
    page_id text primary key,
    is_active boolean not null default true,
    updated_at timestamptz not null default now()
);

create index if not exists site_page_status_active_idx
    on public.site_page_status (is_active);

alter table public.site_page_status enable row level security;

drop policy if exists "Public read site_page_status" on public.site_page_status;
create policy "Public read site_page_status"
    on public.site_page_status
    for select
    to anon, authenticated
    using (true);

drop policy if exists "Admins write site_page_status" on public.site_page_status;
create policy "Admins write site_page_status"
    on public.site_page_status
    for all
    to authenticated
    using (
        exists (
            select 1
            from public.yonetici_hesaplari y
            where y.id = auth.uid()
              and y.active = true
        )
    )
    with check (
        exists (
            select 1
            from public.yonetici_hesaplari y
            where y.id = auth.uid()
              and y.active = true
        )
    );

comment on table public.site_page_status is
    'Menü sayfalarının aktif/pasif durumu — İçerik Ekle panelinden yönetilir';
