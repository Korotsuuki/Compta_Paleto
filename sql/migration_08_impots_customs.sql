-- ============================================================
-- PALETO GARAGE — Migration 08
-- Coût réel Customs/Perf (avant remise) + Coût entreprise, et calcul
-- automatique des impôts par tranches progressives (×0,75).
-- À lancer UNE FOIS dans le SQL Editor Supabase.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Garder le prix brut du panier sur les factures "Montant Custom"
-- ------------------------------------------------------------
-- Jusqu'ici on ne gardait que le montant déjà remisé (facturé). On ajoute
-- une colonne pour le prix brut avant remise, nécessaire pour calculer le
-- "Coût réel Customs/Perf". Les factures déjà existantes n'ont pas cette
-- donnée (elle vaudra le montant facturé par défaut, une légère
-- imprécision sur l'historique, sans impact vu que le site est en test).
alter table factures add column if not exists montant_brut numeric(12,2);
update factures set montant_brut = montant where montant_brut is null;

-- ------------------------------------------------------------
-- 2. STATISTIQUES DU REGISTRE — Coût réel Customs/Perf, Coût entreprise,
--    et impôts calculés automatiquement (tranches progressives × 0,75)
-- ------------------------------------------------------------
-- Une fonction ne peut pas changer sa "forme" de retour avec un simple
-- CREATE OR REPLACE dès qu'on ajoute une colonne — il faut la supprimer
-- avant de la recréer.
drop function if exists get_dashboard_stats();

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

  select coalesce(sum(montant), 0) into v_kits from charges where categorie = 'kits_nourriture';
  select coalesce(sum(montant), 0) into v_matieres from charges where categorie = 'matieres_premieres';

  select coalesce(sum(montant_verse), 0) into v_total_primes from primes;

  select count(*) into v_total_employes from profiles where valide = true and role != 'gouv';

  -- Base imposable = C.A Global - Salaires - Kits/Nourriture - Matières premières - Prime de la semaine
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
