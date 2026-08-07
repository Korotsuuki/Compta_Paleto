"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/lib/types";
import { RotateCcw } from "lucide-react";

export default function LicenciesPanel({ initial }: { initial: Profile[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState(initial);

  useEffect(() => {
    const channel = supabase
      .channel("licencies-live")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
        const p = payload.new as Profile;
        setRows((r) => {
          if (p.licencie && !r.some((x) => x.id === p.id)) return [...r, p];
          if (!p.licencie) return r.filter((x) => x.id !== p.id);
          return r;
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reactiver = async (id: string) => {
    if (!confirm("Réactiver ce compte ? Il retrouvera son accès immédiatement.")) return;
    setRows((r) => r.filter((x) => x.id !== id));
    await supabase.from("profiles").update({ licencie: false, valide: true }).eq("id", id);
  };

  if (rows.length === 0) return null;

  return (
    <div>
      <h2 className="font-display uppercase text-bad text-sm mb-3 tracking-wide">
        Employés retirés du site ({rows.length})
      </h2>
      <div className="ticket overflow-x-auto border-bad/30">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="text-left text-asphalt-600/80 font-mono text-xs uppercase border-b border-asphalt-700">
              <th className="p-4 font-normal">Nom</th>
              <th className="p-4 font-normal">Pseudo Discord</th>
              <th className="p-4 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-asphalt-800">
                <td className="p-4 text-white">
                  {p.prenom} {p.nom}
                </td>
                <td className="p-4 text-asphalt-600 text-xs font-mono">{p.discord_username ?? "—"}</td>
                <td className="p-4">
                  <button
                    onClick={() => reactiver(p.id)}
                    className="flex items-center gap-1 bg-ok/20 hover:bg-ok/30 text-ok text-xs px-3 py-1.5 rounded-sm"
                  >
                    <RotateCcw size={13} /> Réactiver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
