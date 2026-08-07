"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PrimeSemaine, money } from "@/lib/types";

export default function PrimesPanel({ initial }: { initial: PrimeSemaine[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState<PrimeSemaine[]>(initial);

  useEffect(() => {
    const refresh = async () => {
      const { data } = await supabase.rpc("get_primes_mois_courant");
      if (data) setRows(data as PrimeSemaine[]);
    };
    // Les semaines sont calculées automatiquement (dates), mais on garde un
    // canal ouvert au cas où la structure de primes évoluerait plus tard.
    const channel = supabase
      .channel("primes-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "primes" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="ticket overflow-x-auto">
      <table className="w-full text-sm min-w-[500px]">
        <thead>
          <tr className="text-left text-asphalt-600/80 font-mono text-xs uppercase border-b border-asphalt-700">
            <th className="p-4 font-normal">Semaine</th>
            <th className="p-4 font-normal">Date (dimanche)</th>
            <th className="p-4 font-normal text-right">Montant maximum</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.date_debut} className="border-b border-asphalt-800">
              <td className="p-4 text-white font-mono">{p.semaine_numero}</td>
              <td className="p-4 font-mono text-xs text-asphalt-600">
                {new Date(p.date_debut).toLocaleDateString("fr-FR")}
              </td>
              <td className="p-4 font-mono text-right text-signal">{money(p.montant_max)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="p-6 text-center text-asphalt-600/60">
                Aucune semaine trouvée pour ce mois.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
