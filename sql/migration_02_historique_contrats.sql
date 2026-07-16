-- ============================================================
-- PALETO GARAGE — Migration 02
-- Ajoute : historique du registre (clôtures) + stockage des fichiers de
-- contrats. À lancer UNE FOIS dans le SQL Editor Supabase si tu as déjà
-- exécuté sql/schema.sql avant cette mise à jour.
-- ============================================================

-- ---------- HISTORIQUE (clôtures hebdo/mensuelles du registre) ----------
create table if not exists registre_historique (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  periode_debut date not null,
  periode_fin date not null,
  ca_global numeric(12,2) not null default 0,
  ca_repa_net numeric(12,2) not null default 0,
  cout_customs numeric(12,2) not null default 0,
  total_salaires numeric(12,2) not null default 0,
  total_charges numeric(12,2) not null default 0,
  total_primes numeric(12,2) not null default 0,
  benefice_net numeric(12,2) not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table registre_historique enable row level security;

create policy "lecture_valide" on registre_historique for select using (is_valide());
create policy "ecriture_direction" on registre_historique for all
  using (is_direction()) with check (is_direction());

-- ============================================================
-- STOCKAGE DES FICHIERS DE CONTRATS (Supabase Storage)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('contrats', 'contrats', false)
on conflict (id) do nothing;

create policy "lecture_contrats_fichiers" on storage.objects
  for select using (bucket_id = 'contrats' and is_valide());
create policy "ajout_contrats_fichiers" on storage.objects
  for insert with check (bucket_id = 'contrats' and is_cadre_or_above());
create policy "maj_contrats_fichiers" on storage.objects
  for update using (bucket_id = 'contrats' and is_cadre_or_above());
create policy "suppr_contrats_fichiers" on storage.objects
  for delete using (bucket_id = 'contrats' and is_direction());
