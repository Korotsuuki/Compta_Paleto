-- ============================================================
-- PALETO GARAGE — Migration 07
-- Corrige un bug important : le registre global affichait 0 partout tant
-- qu'aucune facture n'avait été créée (la fonction dépendait d'une
-- jointure sur les factures pour exister). Ajoute aussi le tri des
-- employés par grade (même ordre que l'administration).
-- À lancer UNE FOIS dans le SQL Editor Supabase.
-- ============================================================

-- ------------------------------------------------------------
-- 1. CORRECTIF get_dashboard_stats()
-- ------------------------------------------------------------
-- Avant : `... from factures f join services s on ...` → si la table
-- factures est vide, la jointure ne renvoie AUCUNE ligne, donc toute la
-- fonction renvoie 0 ligne, et le site affiche 0 partout (y compris le
-- nombre d'employés, qui n'a pourtant rien à voir avec les factures).
-- Après : chaque valeur est calculée séparément dans une variable, la
-- fonction renvoie donc toujours exactement une ligne.
create or replace function get_dashboard_stats()
returns table (
  ca_global numeric,
  ca_repa_net numeric,
  cout_customs numeric,
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
  v_total_impots numeric;
  v_total_primes numeric;
  v_total_employes bigint;
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

  select
    coalesce(sum(f.montant), 0),
    coalesce(sum(f.montant) filter (where s.categorie in ('prestation', 'nettoyage')), 0),
    coalesce(sum(f.montant) filter (where s.categorie = 'custom'), 0)
  into v_ca_global, v_ca_repa_net, v_cout_customs
  from factures f
  join services s on s.id = f.service_id;

  select coalesce(sum(
    case
      when p.etat = 'absent' then 0
      when g.type = 'fixe' then coalesce(g.montant_fixe, 0)
      when g.type = 'pourcentage' then least(
        coalesce((select sum(f2.montant) from factures f2 where f2.employee_id = p.id), 0)
          * coalesce(g.pourcentage, 0) / 100.0,
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

  select coalesce(sum(montant), 0) into v_total_impots
  from charges where categorie = 'impots';

  select coalesce(sum(montant_verse), 0) into v_total_primes from primes;

  select count(*) into v_total_employes from profiles where valide = true and role != 'gouv';

  return query select
    v_ca_global, v_ca_repa_net, v_cout_customs, v_total_salaires,
    v_total_charges, v_total_impots, v_total_primes, v_total_employes,
    (case when cur_sunday = last_sunday_month then 175000 else 75000 end)::numeric;
end;
$$;
revoke execute on function get_dashboard_stats() from anon;

-- ------------------------------------------------------------
-- 2. TRI DES EMPLOYÉS PAR GRADE (même ordre que la page Administration)
-- ------------------------------------------------------------
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
  coalesce(g.est_mecano, false) as est_mecano,
  coalesce(g.sort_order, 9999) as grade_sort_order
from profiles p
left join grades g on g.id = p.grade_id
left join v_employee_ca ca on ca.employee_id = p.id;
