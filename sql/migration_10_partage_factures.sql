-- ============================================================
-- PALETO GARAGE — Migration 10
-- Partage d'une facture "Montant Custom" avec un collègue : reste dans
-- l'historique de la personne qui l'a créée (avec le nom du destinataire),
-- mais compte dans le C.A de la personne qui l'a reçue.
-- À lancer UNE FOIS dans le SQL Editor Supabase.
-- ============================================================

-- ------------------------------------------------------------
-- 1. COLONNE DE PARTAGE
-- ------------------------------------------------------------
alter table factures add column if not exists partage_avec uuid references profiles(id) on delete set null;

-- Le destinataire doit pouvoir lire les lignes qui lui sont partagées
-- (nécessaire pour que son propre C.A soit calculé correctement).
drop policy if exists "lecture_factures" on factures;
create policy "lecture_factures" on factures for select
  using (
    employee_id = auth.uid()
    or partage_avec = auth.uid()
    or is_roster_large()
    or (is_chef_equipe() and is_mecano_employee(employee_id))
  );

-- ------------------------------------------------------------
-- 2. C.A PAR EMPLOYÉ — attribution "effective" (partagée si présente,
--    sinon le créateur de la facture)
-- ------------------------------------------------------------
create or replace view v_employee_ca
with (security_invoker = true) as
select
  p.id as employee_id,
  coalesce(sum(fe.montant), 0) as ca_global,
  coalesce(sum(fe.montant) filter (where s.categorie in ('prestation', 'nettoyage')), 0) as ca_repa_net,
  coalesce(sum(fe.montant) filter (where s.categorie = 'custom'), 0) as cout_customs,
  coalesce(sum(fe.montant) filter (where s.categorie = 'depannage'), 0) as ca_depannage,
  count(fe.id) as nombre_factures
from profiles p
left join (
  select f.id, coalesce(f.partage_avec, f.employee_id) as owner_id, f.montant, f.service_id
  from factures f
) fe on fe.owner_id = p.id
left join services s on s.id = fe.service_id
group by p.id;

-- ------------------------------------------------------------
-- 3. CORRIGER LES SALAIRES (même attribution effective) DANS
--    get_dashboard_stats() ET get_total_depenses()
-- ------------------------------------------------------------
create or replace function get_dashboard_stats()
returns table (
  ca_global numeric,
  ca_repa_net numeric,
  cout_customs numeric,
  cout_entreprise numeric,
  total_salaires numeric,
  total_charges numeric,
  total_impots numeric,
  total_primes numeric,
  total_employes bigint,
  prime_semaine_courante numeric
)
language plpgsql security definer stable set search_path = public as $$
declare
  cur_sunday date := date_trunc('week', current_date)::date + 6;
  last_sunday_month date;
  v_ca_global numeric;
  v_ca_repa_net numeric;
  v_cout_customs numeric;
  v_total_salaires numeric;
  v_total_charges numeric;
  v_total_primes numeric;
  v_total_employes bigint;
  v_prime_semaine numeric;
  v_kits numeric;
  v_matieres numeric;
  v_base_imposable numeric;
  v_impots numeric;
begin
  if not is_valide() then
    raise exception 'accès refusé';
  end if;

  select max(gs::date) into last_sunday_month
  from generate_series(
    date_trunc('month', cur_sunday),
    date_trunc('month', cur_sunday) + interval '1 month - 1 day',
    interval '1 day'
  ) gs
  where extract(dow from gs) = 0;
  v_prime_semaine := case when cur_sunday = last_sunday_month then 175000 else 75000 end;

  select
    coalesce(sum(f.montant), 0),
    coalesce(sum(f.montant) filter (where s.categorie in ('prestation', 'nettoyage')), 0),
    coalesce(sum(coalesce(f.montant_brut, f.montant)) filter (where s.categorie = 'custom'), 0)
  into v_ca_global, v_ca_repa_net, v_cout_customs
  from factures f
  join services s on s.id = f.service_id;

  select coalesce(sum(
    case
      when p.etat = 'absent' then 0
      when g.type = 'fixe' then coalesce(g.montant_fixe, 0)
      when g.type = 'pourcentage' then least(
        coalesce((
          select sum(f2.montant) from factures f2
          where coalesce(f2.partage_avec, f2.employee_id) = p.id
        ), 0) * coalesce(g.pourcentage, 0) / 100.0,
        coalesce(g.plafond, 0)
      )
      else 0
    end
  ), 0)
  into v_total_salaires
  from profiles p
  left join grades g on g.id = p.grade_id;

  select coalesce(sum(montant), 0) into v_total_charges
  from charges where categorie in ('kits_nourriture', 'matieres_premieres', 'publicite', 'autre');

  select coalesce(sum(montant), 0) into v_kits from charges where categorie = 'kits_nourriture';
  select coalesce(sum(montant), 0) into v_matieres from charges where categorie = 'matieres_premieres';

  select coalesce(sum(montant_verse), 0) into v_total_primes from primes;

  select count(*) into v_total_employes from profiles where valide = true and role != 'gouv';

  v_base_imposable := greatest(0, v_ca_global - v_total_salaires - v_kits - v_matieres - v_prime_semaine);

  v_impots :=
    (case
      when v_base_imposable > 300000 then 60000 + 0.4 * (v_base_imposable - 300000)
      when v_base_imposable > 200000 then 30000 + 0.3 * (v_base_imposable - 200000)
      when v_base_imposable > 100000 then 10000 + 0.2 * (v_base_imposable - 100000)
      else 0.1 * v_base_imposable
    end) * 0.75;

  return query select
    v_ca_global, v_ca_repa_net, v_cout_customs, v_cout_customs / 2, v_total_salaires,
    v_total_charges, v_impots, v_total_primes, v_total_employes, v_prime_semaine;
end;
$$;
revoke execute on function get_dashboard_stats() from anon;

create or replace function get_total_depenses()
returns numeric language plpgsql security definer stable set search_path = public as $$
begin
  if not (is_gouv() or is_gestion()) then
    raise exception 'accès refusé';
  end if;
  return
    (select coalesce(sum(montant), 0) from charges) +
    (
      select coalesce(sum(
        case
          when p.etat = 'absent' then 0
          when g.type = 'fixe' then coalesce(g.montant_fixe, 0)
          when g.type = 'pourcentage' then least(
            coalesce((
              select sum(f.montant) from factures f
              where coalesce(f.partage_avec, f.employee_id) = p.id
            ), 0) * coalesce(g.pourcentage, 0) / 100.0,
            coalesce(g.plafond, 0)
          )
          else 0
        end
      ), 0)
      from profiles p
      left join grades g on g.id = p.grade_id
    ) +
    (select coalesce(sum(montant_verse), 0) from primes);
end;
$$;

-- ------------------------------------------------------------
-- 4. PARTAGER / ANNULER LE PARTAGE (remplace transfer_facture)
-- ------------------------------------------------------------
drop function if exists transfer_facture(uuid, uuid);

create or replace function partager_facture(p_facture_id uuid, p_avec_employee_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  select employee_id into v_owner from factures where id = p_facture_id;
  if v_owner is null then
    raise exception 'Facture introuvable';
  end if;
  if not (
    v_owner = auth.uid()
    or is_roster_large()
    or (is_chef_equipe() and is_mecano_employee(v_owner))
  ) then
    raise exception 'Accès refusé';
  end if;
  if not exists (select 1 from profiles where id = p_avec_employee_id and valide = true) then
    raise exception 'Employé cible invalide';
  end if;
  update factures set partage_avec = p_avec_employee_id where id = p_facture_id;
end;
$$;
revoke execute on function partager_facture(uuid, uuid) from anon;

create or replace function annuler_partage_facture(p_facture_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  select employee_id into v_owner from factures where id = p_facture_id;
  if v_owner is null then
    raise exception 'Facture introuvable';
  end if;
  if not (
    v_owner = auth.uid()
    or is_roster_large()
    or (is_chef_equipe() and is_mecano_employee(v_owner))
  ) then
    raise exception 'Accès refusé';
  end if;
  update factures set partage_avec = null where id = p_facture_id;
end;
$$;
revoke execute on function annuler_partage_facture(uuid) from anon;
