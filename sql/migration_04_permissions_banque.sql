-- ============================================================
-- PALETO GARAGE — Migration 04
-- Refonte complète des permissions par grade + suivi bancaire.
-- À lancer UNE FOIS dans le SQL Editor Supabase.
-- ============================================================

-- ------------------------------------------------------------
-- 1. NOUVEAUX RÔLES ET COLONNE "FAMILLE MÉCANO"
-- ------------------------------------------------------------
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('direction', 'drh', 'gerant', 'chef_equipe', 'employe', 'gouv'));

-- Permet de repérer les grades "famille mécano" (le Chef d'équipe voit leurs fiches)
alter table grades add column if not exists est_mecano boolean not null default false;
update grades set est_mecano = true
  where nom in ('Mécano Stagiaire', 'Mécano', 'Mécano confirmé');

-- ------------------------------------------------------------
-- 2. CORRECTION DE SÉCURITÉ IMPORTANTE + AJOUT DE COLONNE
-- ------------------------------------------------------------
-- Les vues (v_employee_ca, v_employees_full, v_dashboard) s'exécutaient
-- jusqu'ici avec les droits de leur propriétaire (comportement par défaut
-- de Postgres), ce qui CONTOURNAIT les règles de sécurité (RLS) des
-- tables profiles/factures/charges en dessous. Concrètement : n'importe
-- quel compte validé pouvait déjà tout voir via ces vues, même les fiches
-- des autres employés. On corrige ça avec `security_invoker = true`, qui
-- force chaque vue à respecter les droits de la personne connectée. On en
-- profite pour ajouter `est_mecano` à la vue employés.
create or replace view v_employee_ca
with (security_invoker = true) as
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

create or replace view v_employees_full
with (security_invoker = true) as
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
  end as salaire,
  coalesce(g.est_mecano, false) as est_mecano
from profiles p
left join grades g on g.id = p.grade_id
left join v_employee_ca ca on ca.employee_id = p.id;

create or replace view v_dashboard
with (security_invoker = true) as
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

-- ------------------------------------------------------------
-- 3. FONCTIONS D'ACCÈS
-- ------------------------------------------------------------
create or replace function is_drh_or_direction()
returns boolean language sql security definer stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('direction', 'drh'));
$$;

create or replace function is_gerant_or_direction()
returns boolean language sql security definer stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('direction', 'gerant'));
$$;

-- "Accès de base classique" : Direction, DRH, Gérant, Chef d'équipe
create or replace function is_gestion()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role in ('direction', 'drh', 'gerant', 'chef_equipe')
  );
$$;

-- Voit TOUT l'effectif (par opposition au Chef d'équipe, limité aux mécanos)
create or replace function is_roster_large()
returns boolean language sql security definer stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('direction', 'drh', 'gerant'));
$$;

create or replace function is_chef_equipe()
returns boolean language sql security definer stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'chef_equipe');
$$;

create or replace function is_gouv()
returns boolean language sql security definer stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'gouv');
$$;

create or replace function is_mecano_employee(target_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from profiles p join grades g on g.id = p.grade_id
    where p.id = target_id and g.est_mecano = true
  );
$$;

-- Renvoie uniquement le total des dépenses, pour les comptes "Gouv" —
-- ils n'ont accès à aucun détail (charges, salaires, factures individuels).
create or replace function get_total_depenses()
returns numeric language plpgsql security definer stable as $$
begin
  if not (is_gouv() or is_gestion()) then
    raise exception 'accès refusé';
  end if;
  return
    (select coalesce(sum(montant), 0) from charges) +
    (select coalesce(sum(salaire), 0) from v_employees_full) +
    (select coalesce(sum(montant_verse), 0) from primes);
end;
$$;

-- ------------------------------------------------------------
-- 4. NOUVELLES POLICIES (on retire les anciennes d'abord)
-- ------------------------------------------------------------

-- PROFILES : chacun voit sa propre fiche ; Direction/DRH/Gérant voient tout
-- le monde ; Chef d'équipe voit en plus les fiches "famille mécano".
drop policy if exists "lecture_propre_profil_ou_valide" on profiles;
create policy "lecture_profils" on profiles for select
  using (
    auth.uid() = id
    or is_roster_large()
    or (is_chef_equipe() and is_mecano_employee(id))
  );

-- GRADES / SERVICES : info non sensible, tout compte validé peut lire
-- (déjà en place, inchangé — nécessaire pour que chacun voie son propre
-- grade et les prix des prestations sur sa fiche).

-- FACTURES
drop policy if exists "lecture_valide" on factures;
drop policy if exists "creation_facture" on factures;
drop policy if exists "maj_facture" on factures;
drop policy if exists "suppr_facture" on factures;

create policy "lecture_factures" on factures for select
  using (
    employee_id = auth.uid()
    or is_roster_large()
    or (is_chef_equipe() and is_mecano_employee(employee_id))
  );
create policy "ecriture_factures" on factures for insert
  with check (
    employee_id = auth.uid()
    or is_roster_large()
    or (is_chef_equipe() and is_mecano_employee(employee_id))
  );
create policy "maj_factures" on factures for update
  using (
    employee_id = auth.uid()
    or is_roster_large()
    or (is_chef_equipe() and is_mecano_employee(employee_id))
  );
create policy "suppr_factures" on factures for delete
  using (
    employee_id = auth.uid()
    or is_roster_large()
    or (is_chef_equipe() and is_mecano_employee(employee_id))
  );

-- CHARGES : lecture = équipe de gestion (Direction/DRH/Gérant/Chef
-- d'équipe) ; écriture (ajout + suppression) = Direction/Gérant seulement.
drop policy if exists "lecture_valide" on charges;
drop policy if exists "ecriture_direction" on charges;
create policy "lecture_charges" on charges for select using (is_gestion());
create policy "ecriture_charges" on charges for all
  using (is_gerant_or_direction()) with check (is_gerant_or_direction());

-- PARTENAIRES : lecture = équipe de gestion ; écriture = Direction/Gérant.
drop policy if exists "lecture_valide" on partenaires;
drop policy if exists "ecriture_direction" on partenaires;
create policy "lecture_partenaires" on partenaires for select using (is_gestion());
create policy "ecriture_partenaires" on partenaires for all
  using (is_gerant_or_direction()) with check (is_gerant_or_direction());

-- CONTRATS : lecture = équipe de gestion, + chacun peut voir SON PROPRE
-- contrat ; écriture (upload/suppression) = Direction/DRH seulement.
drop policy if exists "lecture_valide" on contrats;
drop policy if exists "ecriture_direction" on contrats;
create policy "lecture_contrats" on contrats for select
  using (is_gestion() or employee_id = auth.uid());
create policy "ecriture_contrats" on contrats for all
  using (is_drh_or_direction()) with check (is_drh_or_direction());

-- PRIMES : lecture = équipe de gestion ; écriture = Direction (inchangé).
drop policy if exists "lecture_valide" on primes;
create policy "lecture_primes" on primes for select using (is_gestion());

-- HISTORIQUE : lecture = équipe de gestion ; écriture = Direction (inchangé).
drop policy if exists "lecture_valide" on registre_historique;
create policy "lecture_historique" on registre_historique for select using (is_gestion());

-- Fichiers de contrats (Storage) : upload/suppression réservés à
-- Direction/DRH désormais (au lieu de "cadre" qui n'existe plus).
drop policy if exists "ajout_contrats_fichiers" on storage.objects;
drop policy if exists "maj_contrats_fichiers" on storage.objects;
drop policy if exists "suppr_contrats_fichiers" on storage.objects;
create policy "ajout_contrats_fichiers" on storage.objects
  for insert with check (bucket_id = 'contrats' and is_drh_or_direction());
create policy "maj_contrats_fichiers" on storage.objects
  for update using (bucket_id = 'contrats' and is_drh_or_direction());
create policy "suppr_contrats_fichiers" on storage.objects
  for delete using (bucket_id = 'contrats' and is_drh_or_direction());

-- ------------------------------------------------------------
-- 5. SUIVI BANCAIRE
-- ------------------------------------------------------------
create table if not exists banque_mouvements (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('depot', 'retrait')),
  montant numeric(12,2) not null check (montant > 0),
  motif text,
  date date not null default now(),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table banque_mouvements enable row level security;

create policy "lecture_banque" on banque_mouvements for select using (is_gestion());
create policy "ecriture_banque" on banque_mouvements for all
  using (is_direction()) with check (is_direction());

create or replace view v_banque_solde
with (security_invoker = true) as
select
  coalesce(sum(case when type = 'depot' then montant else -montant end), 0) as solde
from banque_mouvements;
