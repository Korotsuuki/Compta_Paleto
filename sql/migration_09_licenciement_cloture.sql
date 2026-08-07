-- ============================================================
-- PALETO GARAGE — Migration 09
-- Compte "licencié" (accès coupé, données conservées) + clôture
-- hebdomadaire qui remet les fiches à zéro tout en archivant le détail.
-- À lancer UNE FOIS dans le SQL Editor Supabase.
-- ============================================================

-- ------------------------------------------------------------
-- 1. COMPTE LICENCIÉ
-- ------------------------------------------------------------
-- Différent d'une suppression : le profil, ses factures et ses contrats
-- restent en base (pour les archives), seul l'accès est coupé (valide =
-- false), et on le distingue des "nouveaux comptes en attente" avec ce
-- drapeau dédié.
alter table profiles add column if not exists licencie boolean not null default false;

create or replace function protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not is_direction() then
    new.role := old.role;
    new.valide := old.valide;
    new.grade_id := old.grade_id;
    new.licencie := old.licencie;
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 2. CLÔTURE HEBDOMADAIRE (remise à zéro des fiches)
-- ------------------------------------------------------------
alter table registre_historique add column if not exists total_impots numeric(12,2) not null default 0;
alter table registre_historique add column if not exists resume_employes jsonb;

create or replace function cloturer_semaine(p_titre text, p_periode_debut date, p_periode_fin date)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_stats record;
  v_resume jsonb;
begin
  if not is_direction() then
    raise exception 'accès refusé';
  end if;

  select * into v_stats from get_dashboard_stats();

  -- Détail par employé au moment de la clôture, conservé pour permettre de
  -- régénérer l'export Excel/PDF de cette semaine plus tard si besoin.
  select coalesce(jsonb_agg(jsonb_build_object(
    'employee_id', e.id,
    'prenom', e.prenom,
    'nom', e.nom,
    'grade', e.grade_nom,
    'etat', e.etat,
    'ca_global', e.ca_global,
    'ca_repa_net', e.ca_repa_net,
    'cout_customs', e.cout_customs,
    'nombre_factures', e.nombre_factures,
    'salaire', e.salaire
  ) order by e.prenom), '[]'::jsonb)
  into v_resume
  from v_employees_full e
  where e.valide = true;

  insert into registre_historique (
    titre, periode_debut, periode_fin,
    ca_global, ca_repa_net, cout_customs,
    total_salaires, total_charges, total_impots, total_primes,
    benefice_net, resume_employes, created_by
  ) values (
    p_titre, p_periode_debut, p_periode_fin,
    v_stats.ca_global, v_stats.ca_repa_net, v_stats.cout_customs,
    v_stats.total_salaires, v_stats.total_charges, v_stats.total_impots, v_stats.prime_semaine_courante,
    v_stats.ca_global - (v_stats.total_charges + v_stats.total_impots + v_stats.total_salaires + v_stats.prime_semaine_courante),
    v_resume, auth.uid()
  )
  returning id into v_id;

  -- Remise à zéro : toutes les factures sont effacées, nouvelle semaine
  -- vierge pour tout le monde. Le détail reste dans l'archive ci-dessus.
  delete from factures;

  return v_id;
end;
$$;
revoke execute on function cloturer_semaine(text, date, date) from anon;

-- ------------------------------------------------------------
-- 3. RESSERRER LES ACCÈS (Chef d'équipe et Gérant ont un périmètre plus
--    étroit désormais) — la sécurité doit suivre le menu, pas juste le
--    cacher côté site.
-- ------------------------------------------------------------
-- Charges : Direction / DRH / Gérant (le Chef d'équipe n'y a plus accès)
create or replace function is_charges_gestion()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('direction', 'drh', 'gerant'));
$$;
revoke execute on function is_charges_gestion() from anon;

drop policy if exists "lecture_charges" on charges;
create policy "lecture_charges" on charges for select using (is_charges_gestion());

-- Contrats, Primes, Banque, Historique : Direction / DRH uniquement
-- (Gérant et Chef d'équipe n'y ont plus accès). Chacun garde quand même
-- la lecture de SON PROPRE contrat, peu importe son rôle.
drop policy if exists "lecture_contrats" on contrats;
create policy "lecture_contrats" on contrats for select
  using (is_drh_or_direction() or employee_id = auth.uid());

drop policy if exists "lecture_primes" on primes;
create policy "lecture_primes" on primes for select using (is_drh_or_direction());

drop policy if exists "lecture_banque" on banque_mouvements;
create policy "lecture_banque" on banque_mouvements for select using (is_drh_or_direction());

drop policy if exists "lecture_historique" on registre_historique;
create policy "lecture_historique" on registre_historique for select using (is_drh_or_direction());
