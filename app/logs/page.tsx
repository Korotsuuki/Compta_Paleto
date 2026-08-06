import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import LogsPanel from "@/components/LogsPanel";

export default async function LogsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("profiles")
    .select("prenom, nom, role, grades:grade_id(nom)")
    .eq("id", auth.user?.id)
    .single();

  if (me?.role !== "direction") redirect("/dashboard");

  const { data: logs } = await supabase
    .from("audit_log")
    .select("*, profiles:acted_by(prenom, nom)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <Shell
      displayName={me ? `${me.prenom ?? ""} ${me.nom ?? ""}`.trim() : undefined}
      gradeNom={(me as any)?.grades?.nom}
      role={me?.role}
      userId={auth.user?.id}
    >
      <header className="mb-8">
        <div className="stamp text-signal text-xs mb-3">Direction</div>
        <h1 className="font-display text-3xl uppercase text-white">Logs</h1>
        <p className="text-asphalt-600/80 font-mono text-sm mt-1">
          Historique en direct de toutes les modifications sur le site
        </p>
      </header>

      <LogsPanel initial={(logs ?? []) as any} />
    </Shell>
  );
}
