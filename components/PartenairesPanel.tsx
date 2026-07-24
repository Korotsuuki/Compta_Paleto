"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Partenaire } from "@/lib/types";
import { Plus, Trash2, Save, Check, X } from "lucide-react";

export default function PartenairesPanel({ initial }: { initial: Partenaire[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState<Partenaire[]>(initial);
  const [draft, setDraft] = useState<Partial<Partenaire>>({ categorie: "Garages" });

  const patch = (id: string, field: keyof Partenaire, value: any) =>
    setRows((r) => r.map((p) => (p.id === id ? { ...p, [field]: value } : p)));

  const save = async (p: Partenaire) => {
    await supabase
      .from("partenaires")
      .update({
        nom: p.nom,
        categorie: p.categorie,
        remise_percent: p.remise_percent,
        nettoyage_gratuit: p.nettoyage_gratuit,
        avantages_garage: p.avantages_garage,
        avantages_employes: p.avantages_employes,
      })
      .eq("id", p.id);
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce partenaire ?")) return;
    await supabase.from("partenaires").delete().eq("id", id);
    setRows((r) => r.filter((p) => p.id !== id));
  };

  const add = async () => {
    if (!draft.nom) return;
    const { data } = await supabase
      .from("partenaires")
      .insert({
        nom: draft.nom,
        categorie: draft.categorie ?? "Garages",
        remise_percent: draft.remise_percent ?? null,
        nettoyage_gratuit: draft.nettoyage_gratuit ?? false,
        avantages_garage: draft.avantages_garage ?? null,
        avantages_employes: draft.avantages_employes ?? null,
        sort_order: rows.length + 1,
      })
      .select()
      .single();
    if (data) setRows((r) => [...r, data as Partenaire]);
    setDraft({ categorie: "Garages" });
  };

  return (
    <div className="ticket p-5 overflow-x-auto">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="text-left text-asphalt-600/80 font-mono text-xs uppercase border-b border-asphalt-700">
            <th className="p-3 font-normal">Nom</th>
            <th className="p-3 font-normal">Catégorie</th>
            <th className="p-3 font-normal">Remise %</th>
            <th className="p-3 font-normal">Nettoyage gratuit</th>
            <th className="p-3 font-normal">Avantages garage</th>
            <th className="p-3 font-normal">Avantages employés</th>
            <th className="p-3 font-normal"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-asphalt-800">
              <td className="p-2">
                <input
                  suppressHydrationWarning
                  value={p.nom}
                  onChange={(e) => patch(p.id, "nom", e.target.value)}
                  className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1 text-white w-32"
                />
              </td>
              <td className="p-2">
                <input
                  suppressHydrationWarning
                  value={p.categorie}
                  onChange={(e) => patch(p.id, "categorie", e.target.value)}
                  className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1 text-white w-28"
                />
              </td>
              <td className="p-2">
                <input
                  suppressHydrationWarning
                  type="number"
                  value={p.remise_percent ?? ""}
                  onChange={(e) => patch(p.id, "remise_percent", parseFloat(e.target.value) || null)}
                  className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1 text-white w-20"
                />
              </td>
              <td className="p-2">
                <button
                  onClick={() => patch(p.id, "nettoyage_gratuit", !p.nettoyage_gratuit)}
                  className={p.nettoyage_gratuit ? "text-ok" : "text-asphalt-600/50"}
                >
                  {p.nettoyage_gratuit ? <Check size={16} /> : <X size={16} />}
                </button>
              </td>
              <td className="p-2">
                <input
                  suppressHydrationWarning
                  value={p.avantages_garage ?? ""}
                  onChange={(e) => patch(p.id, "avantages_garage", e.target.value)}
                  className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1 text-white w-36"
                />
              </td>
              <td className="p-2">
                <input
                  suppressHydrationWarning
                  value={p.avantages_employes ?? ""}
                  onChange={(e) => patch(p.id, "avantages_employes", e.target.value)}
                  className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1 text-white w-36"
                />
              </td>
              <td className="p-2 flex gap-1">
                <button
                  onClick={() => save(p)}
                  className="p-1.5 bg-ok/20 hover:bg-ok/30 text-ok rounded-sm"
                  title="Enregistrer"
                >
                  <Save size={14} />
                </button>
                <button
                  onClick={() => remove(p.id)}
                  className="p-1.5 bg-bad/20 hover:bg-bad/30 text-bad rounded-sm"
                  title="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-asphalt-700">
        <input
          suppressHydrationWarning
          placeholder="Nom de l'entreprise"
          value={draft.nom ?? ""}
          onChange={(e) => setDraft({ ...draft, nom: e.target.value })}
          className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1.5 text-white text-sm w-40"
        />
        <input
          suppressHydrationWarning
          placeholder="Catégorie (ex: Garages)"
          value={draft.categorie ?? ""}
          onChange={(e) => setDraft({ ...draft, categorie: e.target.value })}
          className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1.5 text-white text-sm w-36"
        />
        <input
          suppressHydrationWarning
          type="number"
          placeholder="Remise %"
          value={draft.remise_percent ?? ""}
          onChange={(e) => setDraft({ ...draft, remise_percent: parseFloat(e.target.value) || null })}
          className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1.5 text-white text-sm w-24"
        />
        <button
          onClick={add}
          className="flex items-center gap-1 bg-signal hover:bg-signal-dim text-asphalt-950 font-medium text-sm px-3 py-1.5 rounded-sm"
        >
          <Plus size={15} /> Ajouter un partenaire
        </button>
      </div>
    </div>
  );
}
