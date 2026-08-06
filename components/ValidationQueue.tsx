"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Grade, Profile, roleForGradeName } from "@/lib/types";
import { Check, X } from "lucide-react";

export default function ValidationQueue({ pending, grades }: { pending: Profile[]; grades: Grade[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState(pending);
  const [selectedGrade, setSelectedGrade] = useState<Record<string, string>>({});
  const [isGouv, setIsGouv] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const channel = supabase
      .channel("validation-queue-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, (payload) => {
        const p = payload.new as Profile;
        if (!p.valide) setRows((r) => (r.some((x) => x.id === p.id) ? r : [...r, p]));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
        const p = payload.new as Profile;
        // Un autre membre de la Direction vient de valider/refuser ce compte
        // ailleurs : on le retire de la file ici aussi.
        if (p.valide) setRows((r) => r.filter((x) => x.id !== p.id));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "profiles" }, (payload) => {
        const id = (payload.old as Profile).id;
        setRows((r) => r.filter((x) => x.id !== id));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approve = async (id: string) => {
    if (isGouv[id]) {
      await supabase.from("profiles").update({ valide: true, grade_id: null, role: "gouv" }).eq("id", id);
      setRows((r) => r.filter((p) => p.id !== id));
      return;
    }
    const grade_id = selectedGrade[id];
    if (!grade_id) return;
    const grade = grades.find((g) => g.id === grade_id);
    const role = roleForGradeName(grade?.nom);
    await supabase.from("profiles").update({ valide: true, grade_id, role }).eq("id", id);
    setRows((r) => r.filter((p) => p.id !== id));
  };

  const reject = async (id: string) => {
    // On ne valide pas : le compte reste "en attente" indéfiniment.
    // Suppression du profil si tu veux vraiment refuser l'accès :
    await supabase.from("profiles").delete().eq("id", id);
    setRows((r) => r.filter((p) => p.id !== id));
  };

  if (rows.length === 0) return null;

  return (
    <div>
      <h2 className="font-display uppercase text-caution text-sm mb-3 tracking-wide">
        Comptes en attente de validation ({rows.length})
      </h2>
      <div className="ticket overflow-x-auto border-caution/40">
      <table className="w-full text-sm min-w-[800px]">
        <thead>
          <tr className="text-left text-asphalt-600/80 font-mono text-xs uppercase border-b border-asphalt-700">
            <th className="p-4 font-normal">Pseudo Discord</th>
            <th className="p-4 font-normal">Connecté le</th>
            <th className="p-4 font-normal">Type de compte</th>
            <th className="p-4 font-normal"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-asphalt-800">
              <td className="p-4 text-white">{p.discord_username ?? p.prenom}</td>
              <td className="p-4 font-mono text-xs text-asphalt-600">
                {p.date_entree ? new Date(p.date_entree).toLocaleDateString("fr-FR") : "—"}
              </td>
              <td className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <button
                    onClick={() => setIsGouv({ ...isGouv, [p.id]: !isGouv[p.id] })}
                    className={`text-[11px] font-mono px-2 py-1 rounded-sm ${
                      isGouv[p.id] ? "bg-steel/30 text-steel-light" : "bg-asphalt-700 text-asphalt-600"
                    }`}
                  >
                    {isGouv[p.id] ? "Compte Gouv (externe)" : "Employé du garage"}
                  </button>
                </div>
                {!isGouv[p.id] && (
                  <select
                    value={selectedGrade[p.id] ?? ""}
                    onChange={(e) => setSelectedGrade({ ...selectedGrade, [p.id]: e.target.value })}
                    className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1 text-white text-xs"
                  >
                    <option value="">Choisir un grade…</option>
                    {grades.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nom}
                      </option>
                    ))}
                  </select>
                )}
              </td>
              <td className="p-4 flex gap-2">
                <button
                  onClick={() => approve(p.id)}
                  disabled={!isGouv[p.id] && !selectedGrade[p.id]}
                  className="flex items-center gap-1 bg-ok/20 hover:bg-ok/30 disabled:opacity-30 text-ok text-xs px-3 py-1.5 rounded-sm"
                >
                  <Check size={13} /> Valider
                </button>
                <button
                  onClick={() => reject(p.id)}
                  className="flex items-center gap-1 bg-bad/20 hover:bg-bad/30 text-bad text-xs px-3 py-1.5 rounded-sm"
                >
                  <X size={13} /> Refuser
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
