import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import PartenairesPanel from "@/components/PartenairesPanel";
import PartenairesReadOnly from "@/components/PartenairesReadOnly";

export default async function PartenairesPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("profiles")
    .select("prenom, nom, role, grades:grade_id(nom)")
    .eq("id", auth.user?.id)
    .single();

  if (me?.role === "gouv") redirect("/gouv");

  const canEdit = me?.role === "direction" || me?.role === "gerant";

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
        <div className="stamp text-signal text-xs mb-3">Relations extérieures</div>
        <h1 className="font-display text-3xl uppercase text-white">Partenaires & contrats</h1>
        <p className="text-asphalt-600/80 font-mono text-sm mt-1">
          Accords, remises et avantages réciproques avec les autres entreprises
          {canEdit ? " — droits de modification actifs" : ""}
        </p>
      </header>

      {canEdit ? (
        <PartenairesPanel initial={(partenaires ?? []) as any} />
      ) : (
        <PartenairesReadOnly initial={(partenaires ?? []) as any} />
      )}
    </Shell>
  );
}
