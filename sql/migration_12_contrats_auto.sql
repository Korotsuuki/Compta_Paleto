-- ============================================================
-- PALETO GARAGE — Migration 12
-- Génération automatique de contrats (à la validation + avenant au
-- changement de grade), champs personnels nécessaires, contrat éditable.
-- À lancer UNE FOIS dans le SQL Editor Supabase.
-- ============================================================

-- ------------------------------------------------------------
-- 1. NOUVEAUX CHAMPS PERSONNELS (nécessaires au contrat)
-- ------------------------------------------------------------
alter table profiles add column if not exists date_naissance date;
alter table profiles add column if not exists ville_naissance text;
alter table profiles add column if not exists nationalite text;
alter table profiles add column if not exists numero_secu text; -- "Id du joueur" côté RP
alter table profiles add column if not exists date_visite_medicale date;

-- ------------------------------------------------------------
-- 2. CONTRATS STRUCTURÉS (générés automatiquement, éditables)
-- ------------------------------------------------------------
alter table contrats add column if not exists type text not null default 'upload'
  check (type in ('upload', 'auto', 'avenant'));
alter table contrats add column if not exists champs jsonb;
alter table contrats add column if not exists avenant_de uuid references contrats(id) on delete set null;
alter table contrats add column if not exists numero_avenant int not null default 0;

-- ------------------------------------------------------------
-- 3. TEXTE DE RÉMUNÉRATION SELON LE GRADE
-- ------------------------------------------------------------
create or replace function texte_salaire_grade(p_grade_id uuid)
returns text language sql stable set search_path = public as $$
  select case
    when g.type = 'fixe' then
      'un salaire hebdomadaire à hauteur de ' || to_char(g.montant_fixe, 'FM999G999') || '$'
    when g.type = 'pourcentage' then
      'une commission de ' || g.pourcentage || '% du chiffre d''affaires généré, plafonnée à '
        || to_char(g.plafond, 'FM999G999') || '$ par semaine'
    else 'un salaire à définir'
  end
  from grades g where g.id = p_grade_id;
$$;

-- ------------------------------------------------------------
-- 4. GÉNÉRATION (initiale ou avenant), réutilisable par le trigger et
--    par le bouton manuel "Créer un contrat"
-- ------------------------------------------------------------
create or replace function generer_contrat(p_employee_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_profile record;
  v_grade_nom text;
  v_dernier_contrat_id uuid;
  v_numero int;
  v_id uuid;
  v_champs jsonb;
begin
  if auth.uid() is not null and not is_drh_or_direction() then
    raise exception 'accès refusé';
  end if;

  select p.*, g.nom as grade_nom into v_profile
  from profiles p left join grades g on g.id = p.grade_id
  where p.id = p_employee_id;

  if v_profile.id is null then
    raise exception 'Employé introuvable';
  end if;

  select id, numero_avenant into v_dernier_contrat_id, v_numero
  from contrats
  where employee_id = p_employee_id and type in ('auto', 'avenant')
  order by date_signature desc, numero_avenant desc
  limit 1;

  v_champs := jsonb_build_object(
    'nom_prenom', trim(coalesce(v_profile.prenom, '') || ' ' || coalesce(v_profile.nom, '')),
    'date_naissance', v_profile.date_naissance,
    'ville_naissance', v_profile.ville_naissance,
    'nationalite', v_profile.nationalite,
    'telephone', v_profile.telephone,
    'numero_secu', v_profile.numero_secu,
    'date_visite_medicale', v_profile.date_visite_medicale,
    'date_debut_contrat', coalesce(v_profile.date_entree, current_date),
    'grade_nom', v_profile.grade_nom,
    'salaire_texte', texte_salaire_grade(v_profile.grade_id),
    'date_signature', current_date
  );

  if v_dernier_contrat_id is null then
    insert into contrats (titre, employee_id, type, champs, date_signature, numero_avenant)
    values (
      'Contrat de travail — ' || v_champs->>'nom_prenom',
      p_employee_id, 'auto', v_champs, current_date, 0
    )
    returning id into v_id;
  else
    insert into contrats (titre, employee_id, type, champs, date_signature, avenant_de, numero_avenant)
    values (
      'Avenant n°' || (v_numero + 1) || ' — ' || v_champs->>'nom_prenom',
      p_employee_id, 'avenant', v_champs, current_date, v_dernier_contrat_id, v_numero + 1
    )
    returning id into v_id;
  end if;

  return v_id;
end;
$$;
revoke execute on function generer_contrat(uuid) from anon;

-- ------------------------------------------------------------
-- 5. DÉCLENCHEMENT AUTOMATIQUE
-- ------------------------------------------------------------
create or replace function trigger_generer_contrat()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Validation d'un nouveau compte → contrat initial
  if old.valide = false and new.valide = true then
    perform generer_contrat(new.id);
  -- Changement de grade d'un compte déjà actif → avenant
  elsif new.valide = true and old.valide = true and old.grade_id is distinct from new.grade_id then
    perform generer_contrat(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists auto_generer_contrat on profiles;
create trigger auto_generer_contrat
  after update on profiles
  for each row execute procedure trigger_generer_contrat();
