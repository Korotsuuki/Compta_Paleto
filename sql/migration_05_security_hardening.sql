-- ============================================================
-- PALETO GARAGE — Migration 05
-- Corrige les avertissements du linter de sécurité Supabase :
-- search_path non figé sur les fonctions, et fonctions internes
-- exposées inutilement en RPC public. À lancer UNE FOIS.
-- ============================================================

-- ------------------------------------------------------------
-- 1. FIGER LE search_path DE CHAQUE FONCTION
-- ------------------------------------------------------------
-- Sans ça, une fonction SECURITY DEFINER peut en théorie être trompée par
-- un schéma malveillant placé avant "public" dans le search_path de
-- l'appelant. On fixe explicitement search_path = public sur toutes nos
-- fonctions (elles n'utilisent que des tables du schéma public).

create or replace function is_valide()
returns boolean
language sql
security definer
stable
set search_path = public
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
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'direction'
  );
$$;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
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
  end if;
  return new;
end;
$$;

create or replace function is_drh_or_direction()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('direction', 'drh'));
$$;

create or replace function is_gerant_or_direction()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('direction', 'gerant'));
$$;

create or replace function is_gestion()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role in ('direction', 'drh', 'gerant', 'chef_equipe')
  );
$$;

create or replace function is_roster_large()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('direction', 'drh', 'gerant'));
$$;

create or replace function is_chef_equipe()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'chef_equipe');
$$;

create or replace function is_gouv()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'gouv');
$$;

create or replace function is_mecano_employee(target_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from profiles p join grades g on g.id = p.grade_id
    where p.id = target_id and g.est_mecano = true
  );
$$;

create or replace function get_total_depenses()
returns numeric language plpgsql security definer stable set search_path = public as $$
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
-- 2. SUPPRIMER LE CODE MORT
-- ------------------------------------------------------------
-- is_cadre_or_above() n'est plus utilisé par aucune policy depuis que la
-- migration 04 a remplacé le rôle "cadre" par des rôles précis (DRH,
-- Gérant, Chef d'équipe...).
drop function if exists is_cadre_or_above();

-- ------------------------------------------------------------
-- 3. RETIRER L'EXPOSITION RPC INUTILE
-- ------------------------------------------------------------
-- handle_new_user() et protect_profile_privileges() ne sont que des
-- fonctions de déclencheur (trigger) : personne ne doit jamais les
-- appeler directement depuis le site. Les retirer de l'API publique
-- n'affecte pas leur fonctionnement (les triggers continuent de marcher).
revoke execute on function handle_new_user() from anon, authenticated;
revoke execute on function protect_profile_privileges() from anon, authenticated;

-- Les fonctions is_xxx() servent uniquement à l'intérieur des règles RLS ;
-- elles doivent rester exécutables par "authenticated" (sinon les règles
-- RLS des utilisateurs connectés cesseraient de fonctionner), mais n'ont
-- aucune raison d'être appelables par un visiteur non connecté ("anon").
revoke execute on function is_valide() from anon;
revoke execute on function is_direction() from anon;
revoke execute on function is_drh_or_direction() from anon;
revoke execute on function is_gerant_or_direction() from anon;
revoke execute on function is_gestion() from anon;
revoke execute on function is_roster_large() from anon;
revoke execute on function is_chef_equipe() from anon;
revoke execute on function is_gouv() from anon;
revoke execute on function is_mecano_employee(uuid) from anon;

-- get_total_depenses() est volontairement appelée par le site (page Gouv)
-- pour un utilisateur connecté : on garde "authenticated", on retire juste
-- "anon" qui n'en a aucun usage légitime (la fonction refuse déjà l'accès
-- si l'appelant n'est ni Gouv ni gestion, donc aucun risque réel, mais
-- autant nettoyer).
revoke execute on function get_total_depenses() from anon;
