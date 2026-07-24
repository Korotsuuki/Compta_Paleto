import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import PartenairesPanel from "@/components/PartenairesPanel";
import { Check, X } from "lucide-react";

export default async function PartenairesPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("profiles")
    .select("prenom, nom, role, grades:grade_id(nom)")
    .eq("id", auth.user?.id)
    .single();

  if (me?.role === "employe") redirect(`/employes/${auth.user?.id}`);
  if (me?.role === "gouv") redirect("/gouv");

  const canEdit = me?.role === "direction" || me?.role === "gerant";

  const { data: partenaires } = await supabase
    .from("partenaires")
    .select("*")
    .order("categorie")
    .order("sort_order");

  const byCategorie = (partenaires ?? []).reduce<Record<string, any[]>>((acc, p) => {
    (acc[p.categorie] ??= []).push(p);
    return acc;
  }, {});

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
        <>
          {Object.keys(byCategorie).length === 0 && (
            <div className="ticket p-6 text-asphalt-600/70 text-sm">
              Aucun partenaire enregistré pour le moment.
            </div>
          )}

          {Object.entries(byCategorie).map(([categorie, list]) => (
            <div key={categorie} className="ticket overflow-x-auto mb-6">
              <div className="px-5 py-3 border-b border-asphalt-700 font-display uppercase text-signal text-sm tracking-wide">
                {categorie}
              </div>
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="text-left text-asphalt-600/80 font-mono text-xs uppercase border-b border-asphalt-700">
                    <th className="p-4 font-normal">Entreprise</th>
                    <th className="p-4 font-normal">Remise Custom/Perf</th>
                    <th className="p-4 font-normal">Nettoyage/Répa gratuit</th>
                    <th className="p-4 font-normal">Avantages Paleto Garage</th>
                    <th className="p-4 font-normal">Avantages employés</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id} className="border-b border-asphalt-800">
                      <td className="p-4 text-white">{p.nom}</td>
                      <td className="p-4 font-mono text-signal">
                        {p.remise_percent ? `-${p.remise_percent}%` : "—"}
                      </td>
                      <td className="p-4">
                        {p.nettoyage_gratuit ? (
                          <Check size={16} className="text-ok" />
                        ) : (
                          <X size={16} className="text-asphalt-600/50" />
                        )}
                      </td>
                      <td className="p-4 text-asphalt-600 text-xs">{p.avantages_garage ?? "—"}</td>
                      <td className="p-4 text-asphalt-600 text-xs">{p.avantages_employes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </Shell>
  );
}
