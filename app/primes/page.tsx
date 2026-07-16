import { createClient } from "@/lib/supabase/server";
import Shell from "@/components/Shell";
import { money } from "@/lib/types";

export default async function PrimesPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("profiles")
    .select("prenom, nom, role, grades:grade_id(nom)")
    .eq("id", auth.user?.id)
    .single();

  const { data: primes } = await supabase.from("primes").select("*").order("semaine");

  return (
    <Shell
      displayName={me ? `${me.prenom ?? ""} ${me.nom ?? ""}`.trim() : undefined}
      gradeNom={(me as any)?.grades?.nom}
      role={me?.role}
    >
      <header className="mb-8">
        <div className="stamp text-signal text-xs mb-3">Enveloppe hebdomadaire</div>
        <h1 className="font-display text-3xl uppercase text-white">Primes</h1>
        <p className="text-asphalt-600/80 font-mono text-sm mt-1">Suivi des primes versées par semaine</p>
      </header>

      <div className="ticket overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="text-left text-asphalt-600/80 font-mono text-xs uppercase border-b border-asphalt-700">
              <th className="p-4 font-normal">Semaine</th>
              <th className="p-4 font-normal">Date</th>
              <th className="p-4 font-normal text-right">Montant maximum</th>
              <th className="p-4 font-normal text-right">Montant versé</th>
              <th className="p-4 font-normal text-right">Reste</th>
            </tr>
          </thead>
          <tbody>
            {(primes ?? []).map((p) => (
              <tr key={p.id} className="border-b border-asphalt-800">
                <td className="p-4 text-white font-mono">{p.semaine}</td>
                <td className="p-4 font-mono text-xs text-asphalt-600">
                  {new Date(p.date_debut).toLocaleDateString("fr-FR")}
                </td>
                <td className="p-4 font-mono text-right text-white">{money(p.montant_max)}</td>
                <td className="p-4 font-mono text-right text-signal">{money(p.montant_verse)}</td>
                <td className="p-4 font-mono text-right text-ok">
                  {money(p.montant_max - p.montant_verse)}
                </td>
              </tr>
            ))}
            {(primes ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-asphalt-600/60">
                  Aucune prime enregistrée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
