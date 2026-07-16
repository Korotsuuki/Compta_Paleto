import { createClient } from "@/lib/supabase/server";
import Shell from "@/components/Shell";
import EmployeesTable from "@/components/EmployeesTable";
import ValidationQueue from "@/components/ValidationQueue";
import { EmployeeFull, Grade } from "@/lib/types";

export default async function EmployesPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("profiles")
    .select("prenom, nom, role, grades:grade_id(nom)")
    .eq("id", auth.user?.id)
    .single();

  const { data: employees } = await supabase
    .from("v_employees_full")
    .select("*")
    .eq("valide", true)
    .order("prenom");

  const { data: pending } = await supabase
    .from("profiles")
    .select("*")
    .eq("valide", false)
    .order("created_at");

  const { data: grades } = await supabase.from("grades").select("*").order("sort_order");

  const canEdit = me?.role === "direction";

  return (
    <Shell
      displayName={me ? `${me.prenom ?? ""} ${me.nom ?? ""}`.trim() : undefined}
      gradeNom={(me as any)?.grades?.nom}
      role={me?.role}
    >
      <header className="mb-8">
        <div className="stamp text-signal text-xs mb-3">Effectif</div>
        <h1 className="font-display text-3xl uppercase text-white">Employés</h1>
        <p className="text-asphalt-600/80 font-mono text-sm mt-1">
          {employees?.length ?? 0} fiche(s) — {canEdit ? "droits de modification actifs" : "lecture seule"}
        </p>
      </header>

      {canEdit && (pending?.length ?? 0) > 0 && (
        <div className="mb-8">
          <h2 className="font-display uppercase text-caution text-sm mb-3 tracking-wide">
            Comptes en attente de validation ({pending!.length})
          </h2>
          <ValidationQueue pending={pending as any} grades={(grades ?? []) as Grade[]} />
        </div>
      )}

      <EmployeesTable
        employees={(employees ?? []) as EmployeeFull[]}
        grades={(grades ?? []) as Grade[]}
        canEdit={!!canEdit}
      />
    </Shell>
  );
}
