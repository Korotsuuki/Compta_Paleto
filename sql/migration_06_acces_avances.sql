-- ============================================================
-- PALETO GARAGE — Migration 06
-- Élargissement des accès (Mécano, Chef d'équipe), transfert de facture,
-- primes automatiques, fusion des charges, exclusion du salaire des
-- absents, et journal d'audit en temps réel pour la Direction.
-- À lancer UNE FOIS dans le SQL Editor Supabase.
-- ============================================================

-- ------------------------------------------------------------
-- 0. get_total_depenses() : exclure aussi le salaire des absents, comme
--    pour le bénéfice net (cohérence entre la page Gouv et le Dashboard).
-- ------------------------------------------------------------
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
            coalesce((select sum(f.montant) from factures f where f.employee_id = p.id), 0)
              * coalesce(g.pourcentage, 0) / 100.0,
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
-- 1. PROFILS : le Chef d'équipe voit tout le monde dans la liste
--    (l'accès aux fiches individuelles reste limité côté site + policies
--    factures, qui ne changent pas ici).
-- ------------------------------------------------------------
drop policy if exists "lecture_profils" on profiles;
create policy "lecture_profils" on profiles for select
  using (
    auth.uid() = id
    or is_gestion() -- Direction, DRH, Gérant, Chef d'équipe : tout le monde
  );

-- ------------------------------------------------------------
-- 2. PARTENAIRES : lecture ouverte à tout compte validé (le Mécano y a
--    maintenant accès). L'écriture reste Direction/Gérant uniquement.
-- ------------------------------------------------------------
drop policy if exists "lecture_partenaires" on partenaires;
create policy "lecture_partenaires" on partenaires for select using (is_valide());

-- ------------------------------------------------------------
-- 3. STATISTIQUES DU REGISTRE GLOBAL — accessible à TOUT compte validé
-- ------------------------------------------------------------
-- Le Mécano doit voir le registre global, mais ses droits sur les tables
-- charges/primes restent fermés (confidentialité). On lui donne donc les
-- totaux via une fonction qui calcule elle-même les agrégats, sans exposer
-- le détail ligne par ligne. Elle applique aussi les nouvelles règles :
-- - Kits/Nourriture + Matières premières + Publicité + Autre = "Charges"
-- - Impôts sortis de "Charges", affichés à part (mais toujours déduits du
--   bénéfice net)
-- - Le salaire d'un employé "absent" n'est plus compté dans le bénéfice net
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

  return query
  select
    coalesce(sum(f.montant), 0),
    coalesce(sum(f.montant) filter (where s.categorie in ('prestation', 'nettoyage')), 0),
    coalesce(sum(f.montant) filter (where s.categorie = 'custom'), 0),
    (
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
      from profiles p
      left join grades g on g.id = p.grade_id
    ),
    (select coalesce(sum(montant), 0) from charges where categorie in ('kits_nourriture', 'matieres_premieres', 'publicite', 'autre')),
    (select coalesce(sum(montant), 0) from charges where categorie = 'impots'),
    (select coalesce(sum(montant_verse), 0) from primes),
    (select count(*) from profiles),
    (case when cur_sunday = last_sunday_month then 175000 else 75000 end)
  from factures f
  join services s on s.id = f.service_id;
end;
$$;
revoke execute on function get_dashboard_stats() from anon;

-- ------------------------------------------------------------
-- 4. PRIMES AUTOMATIQUES — un dimanche par semaine du mois en cours,
--    75 000$ par défaut, 175 000$ le dernier dimanche du mois. La
--    Direction peut ensuite enregistrer le montant réellement versé
--    (upsert sur la date), sans jamais avoir à créer les lignes à la main.
-- ------------------------------------------------------------
-- Nécessaire pour permettre l'upsert par date depuis le site :
alter table primes add column if not exists est_auto boolean not null default true;
delete from primes a using primes b
  where a.date_debut = b.date_debut and a.id > b.id; -- dédoublonnage défensif
alter table primes drop constraint if exists primes_date_debut_key;
alter table primes add constraint primes_date_debut_key unique (date_debut);

create or replace function get_primes_mois_courant()
returns table (
  date_debut date,
  montant_max numeric,
  montant_verse numeric,
  semaine_numero int
)
language plpgsql security definer stable set search_path = public as $$
declare
  last_sunday date;
begin
  if not is_gestion() then
    raise exception 'accès refusé';
  end if;

  select max(gs::date) into last_sunday
  from generate_series(date_trunc('month', current_date), date_trunc('month', current_date) + interval '1 month - 1 day', interval '1 day') gs
  where extract(dow from gs) = 0;

  return query
  select
    gs::date,
    (case when gs::date = last_sunday then 175000 else 75000 end)::numeric,
    coalesce(pr.montant_verse, 0),
    row_number() over (order by gs::date)::int
  from generate_series(date_trunc('month', current_date), date_trunc('month', current_date) + interval '1 month - 1 day', interval '1 day') gs
  left join primes pr on pr.date_debut = gs::date
  where extract(dow from gs) = 0
  order by gs::date;
end;
$$;
revoke execute on function get_primes_mois_courant() from anon;

-- Écriture des primes réservée à la Direction (upsert par date depuis le site)
drop policy if exists "ecriture_direction" on primes;
create policy "ecriture_primes" on primes for all
  using (is_direction()) with check (is_direction());

-- ------------------------------------------------------------
-- 5. TRANSFERT DE FACTURE ENTRE EMPLOYÉS
-- ------------------------------------------------------------
-- Liste minimale (id + nom) pour choisir un destinataire, sans exposer les
-- données financières des autres — utilisable par n'importe quel compte
-- validé, y compris un Mécano qui ne voit normalement que sa propre fiche.
create or replace function list_employees_for_transfer()
returns table (id uuid, prenom text, nom text)
language sql security definer stable set search_path = public as $$
  select p.id, p.prenom, p.nom
  from profiles p
  where p.valide = true and p.role != 'gouv' and p.id != auth.uid()
  order by p.prenom;
$$;
revoke execute on function list_employees_for_transfer() from anon;

create or replace function transfer_facture(p_facture_id uuid, p_new_employee_id uuid)
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
  if not exists (select 1 from profiles where id = p_new_employee_id and valide = true) then
    raise exception 'Employé cible invalide';
  end if;
  update factures set employee_id = p_new_employee_id where id = p_facture_id;
end;
$$;
revoke execute on function transfer_facture(uuid, uuid) from anon;

-- ------------------------------------------------------------
-- 6. JOURNAL D'AUDIT (Direction uniquement, temps réel)
-- ------------------------------------------------------------
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  acted_by uuid references profiles(id) on delete set null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

alter table audit_log enable row level security;
drop policy if exists "lecture_logs" on audit_log;
create policy "lecture_logs" on audit_log for select using (is_direction());
revoke insert, update, delete on audit_log from anon, authenticated;

create or replace function log_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (table_name, record_id, action, acted_by, old_data, new_data)
  values (
    TG_TABLE_NAME,
    (case when TG_OP = 'DELETE' then old.id else new.id end)::text,
    TG_OP,
    auth.uid(),
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('UPDATE', 'INSERT') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_factures on factures;
create trigger audit_factures after insert or update or delete on factures for each row execute function log_audit();
drop trigger if exists audit_charges on charges;
create trigger audit_charges after insert or update or delete on charges for each row execute function log_audit();
drop trigger if exists audit_primes on primes;
create trigger audit_primes after insert or update or delete on primes for each row execute function log_audit();
drop trigger if exists audit_partenaires on partenaires;
create trigger audit_partenaires after insert or update or delete on partenaires for each row execute function log_audit();
drop trigger if exists audit_contrats on contrats;
create trigger audit_contrats after insert or update or delete on contrats for each row execute function log_audit();
drop trigger if exists audit_banque on banque_mouvements;
create trigger audit_banque after insert or update or delete on banque_mouvements for each row execute function log_audit();
drop trigger if exists audit_profiles on profiles;
create trigger audit_profiles after update on profiles for each row execute function log_audit();
drop trigger if exists audit_grades on grades;
create trigger audit_grades after insert or update or delete on grades for each row execute function log_audit();
drop trigger if exists audit_services on services;
create trigger audit_services after insert or update or delete on services for each row execute function log_audit();

-- ------------------------------------------------------------
-- 7. TEMPS RÉEL — tables qui manquaient encore à la publication
-- ------------------------------------------------------------
do $$ begin alter publication supabase_realtime add table partenaires; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table contrats; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table banque_mouvements; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table audit_log; exception when duplicate_object then null; end $$;
