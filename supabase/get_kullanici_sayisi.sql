-- Ana sayfa "Aday Sayısı" kartı için herkese açık kullanıcı sayımı.
-- Supabase SQL Editor'de bir kez çalıştırın.

CREATE OR REPLACE FUNCTION public.get_kullanici_sayisi()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint FROM public.kullanicilar;
$$;

GRANT EXECUTE ON FUNCTION public.get_kullanici_sayisi() TO anon, authenticated;
