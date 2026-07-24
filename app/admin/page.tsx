import { createClient } from "@/lib/supabase/server";
import Shell from "@/components/Shell";
import AdminPanels from "@/components/AdminPanels";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("profiles")
    .select("prenom, nom, role, grades:grade_id(nom)")
    .eq("id", auth.user?.id)
    .single();

  if (me?.role !== "direction") redirect("/dashboard");

  const { data: grades } = await supabase.from("grades").select("*").order("sort_order");
  const { data: services } = await supabase.from("services").select("*").order("sort_order");
  const { data: partenaires } = await supabase
    .from("partenaires")
    .select("*")
    .order("categorie")
    .order("sort_order");

  return (
    <Shell
      displayName={me ? `${me.prenom ?? ""} ${me.nom ?? ""}`.trim() : undefined}
      gradeNom={(me as any)?.grades?.nom}
      role={me?.role}
      userId={auth.user?.id}
    >
      <header className="mb-8">
        <div className="stamp text-signal text-xs mb-3">Direction</div>
        <h1 className="font-display text-3xl uppercase text-white">Administration</h1>
        <p className="text-asphalt-600/80 font-mono text-sm mt-1">
          Grades, prestations et partenaires — sans passer par Supabase
        </p>
      </header>

      <AdminPanels
        initialGrades={(grades ?? []) as any}
        initialServices={(services ?? []) as any}
        initialPartenaires={(partenaires ?? []) as any}
      />
    </Shell>
  );
}
