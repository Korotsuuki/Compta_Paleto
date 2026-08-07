import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import PrimesPanel from "@/components/PrimesPanel";

export default async function PrimesPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("profiles")
    .select("prenom, nom, role, grades:grade_id(nom)")
    .eq("id", auth.user?.id)
    .single();

  if (me?.role === "employe") redirect(`/employes/${auth.user?.id}`);
  if (me?.role === "gouv") redirect("/gouv");

  const { data: primes } = await supabase.rpc("get_primes_mois_courant");

  return (
    <Shell
      displayName={me ? `${me.prenom ?? ""} ${me.nom ?? ""}`.trim() : undefined}
      gradeNom={(me as any)?.grades?.nom}
      role={me?.role}
      userId={auth.user?.id}
    >
      <header className="mb-8">
        <div className="stamp text-signal text-xs mb-3">Enveloppe hebdomadaire</div>
        <h1 className="font-display text-3xl uppercase text-white">Primes</h1>
        <p className="text-asphalt-600/80 font-mono text-sm mt-1">
          Un dimanche par semaine du mois en cours, généré automatiquement — 75 000$, et 175 000$
          la dernière semaine du mois
        </p>
      </header>

      <PrimesPanel initial={(primes ?? []) as any} />
    </Shell>
  );
}
