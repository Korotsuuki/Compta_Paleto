"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import StatCard from "@/components/StatCard";
import { Dashboard, money } from "@/lib/types";
import { Trophy } from "lucide-react";

export default function DashboardLive({
  initialStats,
  initialGrades,
  initialTop3,
  showGestionExtras,
  showTop3,
}: {
  initialStats: Dashboard | null;
  initialGrades: any[];
  initialTop3: any[];
  showGestionExtras: boolean;
  showTop3: boolean;
}) {
  const supabase = createClient();
  const [stats, setStats] = useState<Dashboard | null>(initialStats);
  const [grades, setGrades] = useState(initialGrades);
  const [top3, setTop3] = useState(initialTop3);

  const refresh = async () => {
    const { data: statsRows } = await supabase.rpc("get_dashboard_stats");
    setStats(statsRows?.[0] ?? null);

    if (showGestionExtras) {
      const { data: g } = await supabase.from("grades").select("*, profiles:profiles(count)").order("sort_order");
      if (g) setGrades(g as any);
    }
    if (showTop3) {
      const { data: t } = await supabase
        .from("v_employees_full")
        .select("id, prenom, nom, ca_global")
        .eq("valide", true)
        .order("ca_global", { ascending: false })
        .limit(3);
      if (t) setTop3(t as any);
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "factures" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "charges" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "primes" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beneficeNet =
    (stats?.ca_global ?? 0) -
    ((stats?.total_charges ?? 0) +
      (stats?.total_impots ?? 0) +
      (stats?.total_salaires ?? 0) +
      (stats?.prime_semaine_courante ?? 0));

  return (
    <div>
      <header className="mb-8">
        <div className="stamp text-signal text-xs mb-3">Registre global</div>
        <h1 className="font-display text-3xl uppercase text-white">Tableau de bord</h1>
        <p className="text-asphalt-600/80 font-mono text-sm mt-1">
          {stats?.total_employes ?? 0} employé(s) enregistré(s)
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="C.A Global" value={money(stats?.ca_global)} tone="signal" size="lg" />
        <StatCard label="C.A Répa / Net." value={money(stats?.ca_repa_net)} />
        <StatCard label="Coût réel Customs" value={money(stats?.cout_customs)} tone="steel" />
        <StatCard
          label="Bénéfice net"
          value={money(beneficeNet)}
          tone={beneficeNet >= 0 ? "ok" : "bad"}
          size="lg"
        />
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="Total à payer employés" value={money(stats?.total_salaires)} />
        <StatCard label="Charges" value={money(stats?.total_charges)} />
        <StatCard label="Impôts" value={money(stats?.total_impots)} />
        <StatCard label="Prime prévue cette semaine" value={money(stats?.prime_semaine_courante)} tone="steel" size="lg" />
      </section>

      {showTop3 && (
        <section className="ticket p-6 mb-10">
          <h2 className="font-display uppercase text-white text-lg mb-4 flex items-center gap-2">
            <Trophy size={18} className="text-signal" /> Top 3 C.A Global
          </h2>
          <div className="space-y-2">
            {top3.map((e, i) => (
              <div key={e.id} className="ticket-stub pl-3 flex items-center justify-between py-2">
                <span className="text-white text-sm">
                  <span className="text-signal font-mono mr-2">#{i + 1}</span>
                  {e.prenom} {e.nom}
                </span>
                <span className="font-mono text-ok">{money(e.ca_global)}</span>
              </div>
            ))}
            {top3.length === 0 && <p className="text-asphalt-600/60 text-sm">Aucune donnée pour le moment.</p>}
          </div>
        </section>
      )}

      {showGestionExtras && (
        <section className="ticket p-6">
          <h2 className="font-display uppercase text-white text-lg mb-4">Rémunérations par grade</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="text-left text-asphalt-600/80 font-mono text-xs uppercase border-b border-asphalt-700">
                  <th className="pb-2 font-normal">Grade</th>
                  <th className="pb-2 font-normal">Employés</th>
                  <th className="pb-2 font-normal">Rémunération</th>
                </tr>
              </thead>
              <tbody>
                {grades.map((g) => (
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
          </div>
        </section>
      )}
    </div>
  );
}
