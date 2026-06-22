-- Ana sayfa "Mülakat Soru Sayısı" kartı için herkese açık aktif soru sayımı.
-- Supabase SQL Editor'de bir kez çalıştırın.

CREATE OR REPLACE FUNCTION public.get_mulakat_soru_sayisi()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint FROM public.sozlu_mulakat_sorulari WHERE aktif = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_mulakat_soru_sayisi() TO anon, authenticated;
