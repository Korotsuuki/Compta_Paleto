"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Partenaire } from "@/lib/types";
import { Check, X } from "lucide-react";

export default function PartenairesReadOnly({ initial }: { initial: Partenaire[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState(initial);

  useEffect(() => {
    const channel = supabase
      .channel("partenaires-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "partenaires" }, async () => {
        const { data } = await supabase.from("partenaires").select("*").order("categorie").order("sort_order");
        if (data) setRows(data as Partenaire[]);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byCategorie = rows.reduce<Record<string, Partenaire[]>>((acc, p) => {
    (acc[p.categorie] ??= []).push(p);
    return acc;
  }, {});

  if (Object.keys(byCategorie).length === 0) {
    return (
      <div className="ticket p-6 text-asphalt-600/70 text-sm">Aucun partenaire enregistré pour le moment.</div>
    );
  }

  return (
    <>
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
  );
}
