-- ============================================================
-- PALETO GARAGE — Migration 03
-- Active le temps réel (Realtime) sur les tables qui doivent se
-- synchroniser en direct entre tous les utilisateurs connectés.
-- À lancer UNE FOIS dans le SQL Editor Supabase.
-- ============================================================

-- Sans ça, Supabase n'envoie jamais les changements en direct au site,
-- même si le code écoute correctement dessus. (bloc sécurisé : ne plante
-- pas si une table est déjà dans la publication)
do $$
begin
  alter publication supabase_realtime add table factures;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table charges;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table primes;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table profiles;
exception when duplicate_object then null;
end $$;
