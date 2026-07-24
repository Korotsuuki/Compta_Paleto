import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import ContractsPanel from "@/components/ContractsPanel";

export default async function ContratsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("profiles")
    .select("prenom, nom, role, grades:grade_id(nom)")
    .eq("id", auth.user?.id)
    .single();

  if (me?.role === "employe") redirect(`/employes/${auth.user?.id}`);
  if (me?.role === "gouv") redirect("/gouv");

  const { data: contrats } = await supabase
    .from("contrats")
    .select("*")
    .order("date_signature", { ascending: false });

  const { data: employees } = await supabase.from("profiles").select("id, prenom, nom").order("prenom");
  const { data: partenaires } = await supabase.from("partenaires").select("id, nom").order("nom");

  const canManage = me?.role === "direction" || me?.role === "drh";

  return (
    <Shell
      displayName={me ? `${me.prenom ?? ""} ${me.nom ?? ""}`.trim() : undefined}
      gradeNom={(me as any)?.grades?.nom}
      role={me?.role}
      userId={auth.user?.id}
    >
      <header className="mb-8">
        <div className="stamp text-signal text-xs mb-3">Documents</div>
        <h1 className="font-display text-3xl uppercase text-white">Contrats</h1>
        <p className="text-asphalt-600/80 font-mono text-sm mt-1">
          Contrats employés et accords avec les partenaires, fichiers inclus
        </p>
      </header>

      <ContractsPanel
        contracts={(contrats ?? []) as any}
        canManage={!!canManage}
        canDelete={!!canManage}
        employees={(employees ?? []).map((e: any) => ({
          id: e.id,
          label: `${e.prenom ?? ""} ${e.nom ?? ""}`.trim() || "Sans nom",
        }))}
        partenaires={(partenaires ?? []).map((p: any) => ({ id: p.id, label: p.nom }))}
      />
    </Shell>
  );
}
