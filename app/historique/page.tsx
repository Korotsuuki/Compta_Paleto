import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import HistoriquePanel from "@/components/HistoriquePanel";
import { Dashboard } from "@/lib/types";

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

  const { data: historique } = await supabase
    .from("registre_historique")
    .select("*")
    .order("periode_debut", { ascending: false });

  const { data: statsRows } = await supabase.rpc("get_dashboard_stats");
  const dash = (statsRows?.[0] as Dashboard) ?? null;

  const totalCharges = (dash?.total_charges ?? 0) + (dash?.total_impots ?? 0);

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
          Clôtures hebdomadaires/mensuelles du registre et exports CSV
        </p>
      </header>

      <HistoriquePanel
        historique={(historique ?? []) as any}
        currentSnapshot={{
          ca_global: dash?.ca_global ?? 0,
          ca_repa_net: dash?.ca_repa_net ?? 0,
          cout_customs: dash?.cout_customs ?? 0,
          total_salaires: dash?.total_salaires ?? 0,
          total_charges: totalCharges,
          total_primes: dash?.prime_semaine_courante ?? 0,
        }}
        canClose={me?.role === "direction"}
      />
    </Shell>
  );
}
