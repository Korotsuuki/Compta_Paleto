import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import HistoriquePanel from "@/components/HistoriquePanel";

export default async function HistoriquePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("profiles")
    .select("prenom, nom, role, grades:grade_id(nom)")
    .eq("id", auth.user?.id)
    .single();

  if (me?.role === "employe") redirect(`/employes/${auth.user?.id}`);
  if (me?.role === "gouv") redirect("/gouv");
  if (me?.role === "gerant" || me?.role === "chef_equipe") redirect("/dashboard");

  const { data: historique } = await supabase
    .from("registre_historique")
    .select("*")
    .order("periode_debut", { ascending: false });

  return (
    <Shell
      displayName={me ? `${me.prenom ?? ""} ${me.nom ?? ""}`.trim() : undefined}
      gradeNom={(me as any)?.grades?.nom}
      role={me?.role}
      userId={auth.user?.id}
    >
      <header className="mb-8">
        <div className="stamp text-signal text-xs mb-3">Suivi dans le temps</div>
        <h1 className="font-display text-3xl uppercase text-white">Historique</h1>
        <p className="text-asphalt-600/80 font-mono text-sm mt-1">
          Clôtures hebdomadaires et réinitialisation des fiches employés
        </p>
      </header>

      <HistoriquePanel historique={(historique ?? []) as any} canClose={me?.role === "direction"} />
    </Shell>
  );
}
