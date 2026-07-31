-- YAZİYO — Live Chat presence düzeltmesi
-- Çevrimiçi adminleri önceliklendir (yeni çevrimdışı kayıt online admini ezmesin)

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
        -- 1) Gerçekten çevrimiçi (son 75 sn güncellenmiş + cevrimici)
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
