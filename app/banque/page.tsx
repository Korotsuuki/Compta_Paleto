import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import BanquePanel from "@/components/BanquePanel";

export default async function BanquePage() {
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

  const { data: mouvements } = await supabase
    .from("banque_mouvements")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: solde } = await supabase.from("v_banque_solde").select("solde").single();

  return (
    <Shell
      displayName={me ? `${me.prenom ?? ""} ${me.nom ?? ""}`.trim() : undefined}
      gradeNom={(me as any)?.grades?.nom}
      role={me?.role}
      userId={auth.user?.id}
    >
      <header className="mb-8">
        <div className="stamp text-signal text-xs mb-3">Trésorerie</div>
        <h1 className="font-display text-3xl uppercase text-white">Banque</h1>
        <p className="text-asphalt-600/80 font-mono text-sm mt-1">
          Solde de l'entreprise et mouvements (dépôts / retraits)
        </p>
      </header>

      <BanquePanel
        mouvements={(mouvements ?? []) as any}
        solde={solde?.solde ?? 0}
        canManage={me?.role === "direction"}
      />
    </Shell>
  );
}
