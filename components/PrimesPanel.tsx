"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PrimeSemaine, money } from "@/lib/types";
import { Save } from "lucide-react";

export default function PrimesPanel({ initial, canEdit }: { initial: PrimeSemaine[]; canEdit: boolean }) {
  const supabase = createClient();
  const [rows, setRows] = useState<PrimeSemaine[]>(initial);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const refresh = async () => {
    const { data } = await supabase.rpc("get_primes_mois_courant");
    if (data) setRows(data as PrimeSemaine[]);
  };

  useEffect(() => {
    const channel = supabase
      .channel("primes-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "primes" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (row: PrimeSemaine) => {
    const raw = drafts[row.date_debut] ?? String(row.montant_verse);
    const montant_verse = parseFloat(raw.replace(",", ".")) || 0;
    setSaving(row.date_debut);
    await supabase
      .from("primes")
      .upsert(
        {
          date_debut: row.date_debut,
          semaine: row.semaine_numero,
          montant_max: row.montant_max,
          montant_verse,
        },
        { onConflict: "date_debut" }
      );
    setSaving(null);
    await refresh();
  };

  return (
    <div className="ticket overflow-x-auto">
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="text-left text-asphalt-600/80 font-mono text-xs uppercase border-b border-asphalt-700">
            <th className="p-4 font-normal">Semaine</th>
            <th className="p-4 font-normal">Date (dimanche)</th>
            <th className="p-4 font-normal text-right">Montant maximum</th>
            <th className="p-4 font-normal text-right">Montant versé</th>
            <th className="p-4 font-normal text-right">Reste</th>
            {canEdit && <th className="p-4 font-normal"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.date_debut} className="border-b border-asphalt-800">
              <td className="p-4 text-white font-mono">{p.semaine_numero}</td>
              <td className="p-4 font-mono text-xs text-asphalt-600">
                {new Date(p.date_debut).toLocaleDateString("fr-FR")}
              </td>
              <td className="p-4 font-mono text-right text-white">{money(p.montant_max)}</td>
              <td className="p-4 font-mono text-right text-signal">
                {canEdit ? (
                  <input
                    suppressHydrationWarning
                    value={drafts[p.date_debut] ?? String(p.montant_verse)}
                    onChange={(e) => setDrafts({ ...drafts, [p.date_debut]: e.target.value })}
                    className="w-28 bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1 text-right text-white"
                  />
                ) : (
                  money(p.montant_verse)
                )}
              </td>
              <td className="p-4 font-mono text-right text-ok">
                {money(p.montant_max - (parseFloat(drafts[p.date_debut] ?? String(p.montant_verse)) || 0))}
              </td>
              {canEdit && (
                <td className="p-4 text-right">
                  <button
                    onClick={() => save(p)}
                    disabled={saving === p.date_debut}
                    className="p-1.5 bg-ok/20 hover:bg-ok/30 text-ok rounded-sm"
                    title="Enregistrer"
                  >
                    <Save size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={canEdit ? 6 : 5} className="p-6 text-center text-asphalt-600/60">
                Aucune semaine trouvée pour ce mois.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
