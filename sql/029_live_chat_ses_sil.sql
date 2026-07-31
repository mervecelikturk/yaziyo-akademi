-- YAZİYO — Live Chat: ses süresi + admin mesaj silme
-- Supabase SQL Editor'da bir kez çalıştırın (028_live_chat.sql sonrası).

alter table public.live_chat_mesajlar
    add column if not exists sure_sn integer default null
        check (sure_sn is null or sure_sn >= 0);

-- Admin tüm mesajları silebilir (her iki taraftan kalkar)
drop policy if exists "Admins delete live chat messages" on public.live_chat_mesajlar;
create policy "Admins delete live chat messages"
    on public.live_chat_mesajlar for delete to authenticated
    using (public.is_yaziyo_admin());
