-- ============================================================
-- PALETO GARAGE — Migration 11
-- Corrige "DELETE requires a WHERE clause" sur la clôture hebdomadaire —
-- Supabase impose une clause WHERE explicite même à l'intérieur d'une
-- fonction. À lancer UNE FOIS dans le SQL Editor Supabase.
-- ============================================================

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

  -- Supabase exige une clause WHERE explicite sur les DELETE, même dans
  -- une fonction : "where true" supprime bien toutes les lignes.
  delete from factures where true;

  return v_id;
end;
$$;
revoke execute on function cloturer_semaine(text, date, date) from anon;
