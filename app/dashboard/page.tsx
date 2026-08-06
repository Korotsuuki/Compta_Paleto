import { createClient } from "@/lib/supabase/server";
import Shell from "@/components/Shell";
import DashboardLive from "@/components/DashboardLive";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("profiles")
    .select("prenom, nom, role, grades:grade_id(nom)")
    .eq("id", auth.user?.id)
    .single();

  if (me?.role === "gouv") redirect("/gouv");

  const { data: statsRows } = await supabase.rpc("get_dashboard_stats");
  const stats = statsRows?.[0] ?? null;

  const isGestion = me?.role && me.role !== "employe";

  const { data: gradesRows } = isGestion
    ? await supabase.from("grades").select("*, profiles:profiles(count)").order("sort_order")
    : { data: null };

  const { data: top3 } = isGestion
    ? await supabase
        .from("v_employees_full")
        .select("id, prenom, nom, ca_global")
        .eq("valide", true)
        .order("ca_global", { ascending: false })
        .limit(3)
    : { data: null };

  return (
    <Shell
      displayName={me ? `${me.prenom ?? ""} ${me.nom ?? ""}`.trim() : undefined}
      gradeNom={(me as any)?.grades?.nom}
      role={me?.role}
      userId={auth.user?.id}
    >
      <DashboardLive
        initialStats={stats}
        initialGrades={(gradesRows as any) ?? []}
        initialTop3={(top3 as any) ?? []}
        showGestionExtras={!!isGestion}
        showTop3={me?.role === "direction"}
      />
    </Shell>
  );
}
