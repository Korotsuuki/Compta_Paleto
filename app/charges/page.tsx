import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import ChargesTable from "@/components/ChargesTable";

const LABELS: Record<string, string> = {
  kits_nourriture: "Kits / Nourriture",
  matieres_premieres: "Matières premières",
  publicite: "Publicité",
  impots: "Impôts",
  autre: "Autre",
};

export default async function ChargesPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("profiles")
    .select("prenom, nom, role, grades:grade_id(nom)")
    .eq("id", auth.user?.id)
    .single();

  if (me?.role === "employe") redirect(`/employes/${auth.user?.id}`);
  if (me?.role === "gouv") redirect("/gouv");
  if (me?.role === "chef_equipe") redirect("/dashboard");

  const { data: charges } = await supabase.from("charges").select("*").order("date", { ascending: false });

  const canEdit = me?.role === "direction" || me?.role === "gerant";

  return (
    <Shell
      displayName={me ? `${me.prenom ?? ""} ${me.nom ?? ""}`.trim() : undefined}
      gradeNom={(me as any)?.grades?.nom}
      role={me?.role}
      userId={auth.user?.id}
    >
      <header className="mb-8">
        <div className="stamp text-signal text-xs mb-3">Dépenses</div>
        <h1 className="font-display text-3xl uppercase text-white">Charges</h1>
        <p className="text-asphalt-600/80 font-mono text-sm mt-1">
          Achats et prestataires imputés au registre — les impôts sont suivis à part
        </p>
      </header>

      <ChargesTable
        charges={(charges ?? []) as any}
        labels={LABELS}
        addableCategories={["kits_nourriture", "matieres_premieres", "publicite", "autre"]}
        canEdit={!!canEdit}
      />
    </Shell>
  );
}
