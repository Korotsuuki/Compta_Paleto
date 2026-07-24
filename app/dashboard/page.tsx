import { createClient } from "@/lib/supabase/server";
import Shell from "@/components/Shell";
import StatCard from "@/components/StatCard";
import { money, Dashboard, Grade } from "@/lib/types";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("profiles")
    .select("prenom, nom, role, grades:grade_id(nom)")
    .eq("id", auth.user?.id)
    .single();

  if (me?.role === "employe") redirect(`/employes/${auth.user?.id}`);
  if (me?.role === "gouv") redirect("/gouv");

  const { data: dashRows } = await supabase.from("v_dashboard").select("*").single();
  const dash = dashRows as Dashboard | null;

  const { data: gradesRows } = await supabase
    .from("grades")
    .select("*, profiles:profiles(count)")
    .order("sort_order");

  const totalCharges =
    (dash?.total_kits_nourriture ?? 0) +
    (dash?.total_matieres_premieres ?? 0) +
    (dash?.total_publicite ?? 0) +
    (dash?.total_impots ?? 0) +
    (dash?.total_autres_charges ?? 0) +
    (dash?.total_salaires ?? 0) +
    (dash?.total_primes ?? 0);

  const beneficeNet = (dash?.ca_global ?? 0) - totalCharges;

  return (
    <Shell
      displayName={me ? `${me.prenom ?? ""} ${me.nom ?? ""}`.trim() : undefined}
      gradeNom={(me as any)?.grades?.nom}
      role={me?.role}
      userId={auth.user?.id}
    >
      <header className="mb-8">
        <div className="stamp text-signal text-xs mb-3">Registre global</div>
        <h1 className="font-display text-3xl uppercase text-white">Tableau de bord</h1>
        <p className="text-asphalt-600/80 font-mono text-sm mt-1">
          {dash?.total_employes ?? 0} employé(s) enregistré(s)
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="C.A Global" value={money(dash?.ca_global)} tone="signal" size="lg" />
        <StatCard label="C.A Répa / Net." value={money(dash?.ca_repa_net)} />
        <StatCard label="Coût réel Customs" value={money(dash?.cout_customs)} tone="steel" />
        <StatCard
          label="Bénéfice net"
          value={money(beneficeNet)}
          tone={beneficeNet >= 0 ? "ok" : "bad"}
          size="lg"
        />
      </section>

      <section className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
        <StatCard label="Total à payer employés" value={money(dash?.total_salaires)} />
        <StatCard label="Total primes versées" value={money(dash?.total_primes)} />
        <StatCard label="Total impôts" value={money(dash?.total_impots)} />
        <StatCard label="Achats kits / nourriture" value={money(dash?.total_kits_nourriture)} />
        <StatCard label="Achat matières premières" value={money(dash?.total_matieres_premieres)} />
        <StatCard label="Publicité" value={money(dash?.total_publicite)} />
      </section>

      <section className="ticket p-6">
        <h2 className="font-display uppercase text-white text-lg mb-4">Rémunérations par grade</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-asphalt-600/80 font-mono text-xs uppercase border-b border-asphalt-700">
              <th className="pb-2 font-normal">Grade</th>
              <th className="pb-2 font-normal">Employés</th>
              <th className="pb-2 font-normal">Rémunération</th>
            </tr>
          </thead>
          <tbody>
            {(gradesRows as any[])?.map((g) => (
              <tr key={g.id} className="border-b border-asphalt-800">
                <td className="py-2 text-white">{g.nom}</td>
                <td className="py-2 font-mono text-asphalt-600">{g.profiles?.[0]?.count ?? 0}</td>
                <td className="py-2 font-mono text-signal">
                  {g.type === "fixe"
                    ? money(g.montant_fixe)
                    : `${g.pourcentage}% du C.A (max. ${money(g.plafond)})`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Shell>
  );
}
