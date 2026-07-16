-- ============================================================
-- PALETO GARAGE — Schéma Supabase
-- À exécuter dans l'éditeur SQL de ton projet Supabase (une fois).
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- GRADES ----------
create table if not exists grades (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique,
  type text not null check (type in ('fixe', 'pourcentage')),
  montant_fixe numeric(12,2) default 0,      -- utilisé si type = 'fixe'
  pourcentage numeric(5,2) default 0,        -- utilisé si type = 'pourcentage' (ex: 22.5 = 22,5%)
  plafond numeric(12,2) default 0,           -- salaire max si type = 'pourcentage'
  sort_order int not null default 0
);

-- ---------- PROFILES (1 ligne par employé, liée à auth.users) ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  discord_username text,
  avatar_url text,
  prenom text,
  nom text,
  telephone text,
  date_entree date default now(),
  grade_id uuid references grades(id),
  etat text not null default 'actif' check (etat in ('actif', 'absent')),
  employee_code text unique,
  -- Palier d'accès: direction = tout voir/modifier, cadre = gère son équipe, employe = accès à sa fiche
  role text not null default 'employe' check (role in ('direction', 'cadre', 'employe')),
  -- Un compte Discord peut se connecter à tout moment, mais reste sans accès tant
  -- qu'un membre de la Direction ne l'a pas validé manuellement (voir page Employés).
  valide boolean not null default false,
  created_at timestamptz default now()
);

-- ---------- SERVICES (catalogue des prestations facturables) ----------
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  prix numeric(12,2) not null default 0,
  categorie text not null check (categorie in ('depannage', 'prestation', 'nettoyage', 'custom')),
  montant_libre boolean not null default false, -- ex: "Montant Custom" où le prix est saisi à chaque facture
  actif boolean not null default true,
  sort_order int not null default 0
);

-- ---------- FACTURES (chaque +1 / saisie sur la fiche employé) ----------
create table if not exists factures (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references profiles(id) on delete cascade,
  service_id uuid references services(id),
  montant numeric(12,2) not null default 0,
  quantite int not null default 1,
  client_identite text,
  client_telephone text,
  created_at timestamptz not null default now()
);

-- ---------- CHARGES (dépenses: kits, matières premières, pub, impôts...) ----------
create table if not exists charges (
  id uuid primary key default gen_random_uuid(),
  categorie text not null check (categorie in ('kits_nourriture', 'matieres_premieres', 'publicite', 'impots', 'autre')),
  prestataire text,
  article text,
  date date not null default now(),
  montant numeric(12,2) not null default 0,
  quantite int not null default 1,
  created_at timestamptz default now()
);

-- ---------- PRIMES (enveloppe hebdomadaire) ----------
create table if not exists primes (
  id uuid primary key default gen_random_uuid(),
  semaine int not null,
  date_debut date not null,
  montant_max numeric(12,2) not null default 0,
  montant_verse numeric(12,2) not null default 0
);

-- ---------- PARTENAIRES (autres entreprises / services publics) ----------
create table if not exists partenaires (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  categorie text not null, -- ex: 'Garages', 'Services Publics'
  remise_percent numeric(5,2),
  nettoyage_gratuit boolean default false,
  avantages_garage text,   -- avantages pour Paleto Garage
  avantages_employes text, -- avantages pour les employés Paleto
  sort_order int not null default 0
);

-- ---------- CONTRATS (texte / lien vers un document, lié à un employé ou un partenaire) ----------
create table if not exists contrats (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  partenaire_id uuid references partenaires(id) on delete set null,
  employee_id uuid references profiles(id) on delete set null,
  contenu text,
  fichier_url text,
  date_signature date default now()
);

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

-- ============================================================
-- STOCKAGE DES FICHIERS DE CONTRATS (Supabase Storage)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('contrats', 'contrats', false)
on conflict (id) do nothing;

-- ============================================================
-- FONCTIONS UTILITAIRES
-- ============================================================

create or replace function is_valide()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and valide = true
  );
$$;

create or replace function is_direction()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'direction'
  );
$$;

create or replace function is_cadre_or_above()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role in ('direction', 'cadre')
  );
$$;

-- Crée automatiquement une fiche `profiles` à la première connexion Discord
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, discord_username, avatar_url, prenom, employee_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Nouvel employé'),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'full_name', 'Nouvel employé'),
    lpad((floor(random() * 99999))::text, 5, '0')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- VUES CALCULÉES
-- ============================================================

-- C.A par employé, ventilé par catégorie de service
create or replace view v_employee_ca as
select
  p.id as employee_id,
  coalesce(sum(f.montant), 0) as ca_global,
  coalesce(sum(f.montant) filter (where s.categorie in ('prestation', 'nettoyage')), 0) as ca_repa_net,
  coalesce(sum(f.montant) filter (where s.categorie = 'custom'), 0) as cout_customs,
  coalesce(sum(f.montant) filter (where s.categorie = 'depannage'), 0) as ca_depannage,
  count(f.id) as nombre_factures
from profiles p
left join factures f on f.employee_id = p.id
left join services s on s.id = f.service_id
group by p.id;

-- Fiche complète employé: infos + grade + C.A + salaire calculé
create or replace view v_employees_full as
select
  p.*,
  g.nom as grade_nom,
  g.type as grade_type,
  g.montant_fixe,
  g.pourcentage,
  g.plafond,
  coalesce(ca.ca_global, 0) as ca_global,
  coalesce(ca.ca_repa_net, 0) as ca_repa_net,
  coalesce(ca.cout_customs, 0) as cout_customs,
  coalesce(ca.nombre_factures, 0) as nombre_factures,
  case
    when g.type = 'fixe' then coalesce(g.montant_fixe, 0)
    when g.type = 'pourcentage' then least(coalesce(ca.ca_global, 0) * coalesce(g.pourcentage, 0) / 100.0, coalesce(g.plafond, 0))
    else 0
  end as salaire
from profiles p
left join grades g on g.id = p.grade_id
left join v_employee_ca ca on ca.employee_id = p.id;

-- Registre global (dashboard)
create or replace view v_dashboard as
select
  (select coalesce(sum(ca_global), 0) from v_employee_ca) as ca_global,
  (select coalesce(sum(ca_repa_net), 0) from v_employee_ca) as ca_repa_net,
  (select coalesce(sum(cout_customs), 0) from v_employee_ca) as cout_customs,
  (select coalesce(sum(salaire), 0) from v_employees_full) as total_salaires,
  (select coalesce(sum(montant), 0) from charges where categorie = 'kits_nourriture') as total_kits_nourriture,
  (select coalesce(sum(montant), 0) from charges where categorie = 'matieres_premieres') as total_matieres_premieres,
  (select coalesce(sum(montant), 0) from charges where categorie = 'impots') as total_impots,
  (select coalesce(sum(montant), 0) from charges where categorie = 'publicite') as total_publicite,
  (select coalesce(sum(montant), 0) from charges where categorie = 'autre') as total_autres_charges,
  (select coalesce(sum(montant_verse), 0) from primes) as total_primes,
  (select count(*) from profiles) as total_employes;

-- Empêche un employé de se valider lui-même ou de changer son propre rôle/grade
-- (seule la Direction peut modifier ces trois colonnes sensibles)
create or replace function protect_profile_privileges()
returns trigger
language plpgsql
security definer
as $$
begin
  -- auth.uid() est NULL quand la requête vient directement du SQL Editor Supabase
  -- (accès réservé au propriétaire du projet) : on laisse passer, c'est le seul
  -- moyen de nommer le tout premier compte "Direction". Depuis le site (API), un
  -- utilisateur normal a toujours un auth.uid() et ne peut pas s'auto-valider.
  if auth.uid() is not null and not is_direction() then
    new.role := old.role;
    new.valide := old.valide;
    new.grade_id := old.grade_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_update_protect on profiles;
create trigger on_profile_update_protect
  before update on profiles
  for each row execute procedure protect_profile_privileges();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table grades enable row level security;
alter table profiles enable row level security;
alter table services enable row level security;
alter table factures enable row level security;
alter table charges enable row level security;
alter table primes enable row level security;
alter table partenaires enable row level security;
alter table contrats enable row level security;
alter table registre_historique enable row level security;

-- Lecture: réservée aux comptes validés par la Direction (voir colonne `valide`)
create policy "lecture_valide" on grades for select using (is_valide());
create policy "lecture_propre_profil_ou_valide" on profiles for select
  using (auth.uid() = id or is_valide());
create policy "lecture_valide" on services for select using (is_valide());
create policy "lecture_valide" on factures for select using (is_valide());
create policy "lecture_valide" on charges for select using (is_valide());
create policy "lecture_valide" on primes for select using (is_valide());
create policy "lecture_valide" on partenaires for select using (is_valide());
create policy "lecture_valide" on contrats for select using (is_valide());
create policy "lecture_valide" on registre_historique for select using (is_valide());

-- Écriture: réservée à direction/cadre selon la table
create policy "ecriture_direction" on grades for all using (is_direction()) with check (is_direction());
create policy "ecriture_direction" on services for all using (is_direction()) with check (is_direction());
create policy "ecriture_direction" on charges for all using (is_cadre_or_above()) with check (is_cadre_or_above());
create policy "ecriture_direction" on primes for all using (is_direction()) with check (is_direction());
create policy "ecriture_direction" on partenaires for all using (is_direction()) with check (is_direction());
create policy "ecriture_direction" on contrats for all using (is_cadre_or_above()) with check (is_cadre_or_above());
create policy "ecriture_direction" on registre_historique for all using (is_direction()) with check (is_direction());

-- Fichiers de contrats (bucket Storage "contrats", privé)
create policy "lecture_contrats_fichiers" on storage.objects
  for select using (bucket_id = 'contrats' and is_valide());
create policy "ajout_contrats_fichiers" on storage.objects
  for insert with check (bucket_id = 'contrats' and is_cadre_or_above());
create policy "maj_contrats_fichiers" on storage.objects
  for update using (bucket_id = 'contrats' and is_cadre_or_above());
create policy "suppr_contrats_fichiers" on storage.objects
  for delete using (bucket_id = 'contrats' and is_direction());

-- Profiles: chacun peut modifier ses propres infos de contact; direction peut tout modifier (grade, rôle, état)
create policy "maj_propre_profil" on profiles for update
  using (auth.uid() = id or is_direction())
  with check (auth.uid() = id or is_direction());

-- Factures: un employé peut créer ses propres factures; cadre/direction peuvent en créer pour l'équipe
create policy "creation_facture" on factures for insert
  with check (employee_id = auth.uid() or is_cadre_or_above());
create policy "maj_facture" on factures for update using (is_cadre_or_above());
create policy "suppr_facture" on factures for delete using (is_cadre_or_above());

-- ============================================================
-- DONNÉES DE DÉPART (à ajuster) — grades observés sur ton registre
-- ============================================================
insert into grades (nom, type, montant_fixe, pourcentage, plafond, sort_order) values
  ('Patron', 'fixe', 100000, 0, 0, 1),
  ('Co-Patron', 'fixe', 100000, 0, 0, 2),
  ('DRH', 'fixe', 100000, 0, 0, 3),
  ('RH', 'pourcentage', 0, 50, 100000, 4),
  ('Gérant', 'pourcentage', 0, 50, 75000, 5),
  ('Chef d''équipe', 'pourcentage', 0, 25, 75000, 6),
  ('Mécano confirmé', 'pourcentage', 0, 22.5, 75000, 7),
  ('Mécano', 'pourcentage', 0, 20, 75000, 8),
  ('Mécano Stagiaire', 'pourcentage', 0, 15, 75000, 9)
on conflict (nom) do nothing;

insert into services (nom, prix, categorie, montant_libre, sort_order) values
  ('Déplacement', 350, 'depannage', false, 1),
  ('Chaîne', 300, 'depannage', false, 2),
  ('Réparation + Nettoyage', 220, 'prestation', false, 3),
  ('Réparation', 150, 'prestation', false, 4),
  ('Nettoyage', 75, 'nettoyage', false, 5),
  ('Montant Custom', 0, 'custom', true, 6)
on conflict do nothing;
