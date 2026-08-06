"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Charge, ChargeCategorie, money } from "@/lib/types";
import { Plus, Trash2 } from "lucide-react";

export default function ChargesTable({
  charges,
  labels,
  addableCategories,
  canEdit,
}: {
  charges: Charge[];
  labels: Record<string, string>;
  addableCategories?: ChargeCategorie[];
  canEdit: boolean;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState(charges);
  const options = addableCategories ?? (Object.keys(labels) as ChargeCategorie[]);
  const [form, setForm] = useState({
    categorie: options[0] ?? ("autre" as ChargeCategorie),
    prestataire: "",
    article: "",
    montant: "",
    quantite: "1",
  });

  useEffect(() => {
    const channel = supabase
      .channel("charges-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "charges" }, async () => {
        const { data } = await supabase.from("charges").select("*").order("date", { ascending: false });
        if (data) setRows(data as Charge[]);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    const montant = parseFloat(form.montant.replace(",", "."));
    if (!montant) return;
    const { data } = await supabase
      .from("charges")
      .insert({
        categorie: form.categorie,
        prestataire: form.prestataire || null,
        article: form.article || null,
        montant,
        quantite: parseInt(form.quantite) || 1,
        date: new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();
    if (data) setRows((r) => [data as Charge, ...r]);
    setForm({ categorie: options[0] ?? ("autre" as ChargeCategorie), prestataire: "", article: "", montant: "", quantite: "1" });
  };

  const deleteCharge = async (id: string) => {
    if (!confirm("Supprimer cette charge ?")) return;
    await supabase.from("charges").delete().eq("id", id);
    setRows((r) => r.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="ticket p-5">
          <h2 className="font-display uppercase text-white text-sm mb-4">Nouvelle charge</h2>
          <div className="grid md:grid-cols-5 gap-3">
            <select
              value={form.categorie}
              onChange={(e) => setForm({ ...form, categorie: e.target.value as ChargeCategorie })}
              className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-2 text-white text-sm"
            >
              {options.map((k) => (
                <option key={k} value={k}>
                  {labels[k]}
                </option>
              ))}
            </select>
            <input
              suppressHydrationWarning
              placeholder="Prestataire"
              value={form.prestataire}
              onChange={(e) => setForm({ ...form, prestataire: e.target.value })}
              className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-2 text-white text-sm"
            />
            <input
              suppressHydrationWarning
              placeholder="Article"
              value={form.article}
              onChange={(e) => setForm({ ...form, article: e.target.value })}
              className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-2 text-white text-sm"
            />
            <input
              suppressHydrationWarning
              placeholder="Montant"
              value={form.montant}
              onChange={(e) => setForm({ ...form, montant: e.target.value })}
              className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-2 text-white text-sm"
            />
            <button
              onClick={submit}
              className="flex items-center justify-center gap-1 bg-signal hover:bg-signal-dim text-asphalt-950 font-medium text-sm py-2 rounded-sm"
            >
              <Plus size={15} /> Ajouter
            </button>
          </div>
        </div>
      )}

      <div className="ticket overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="text-left text-asphalt-600/80 font-mono text-xs uppercase border-b border-asphalt-700">
              <th className="p-4 font-normal">Catégorie</th>
              <th className="p-4 font-normal">Prestataire</th>
              <th className="p-4 font-normal">Article</th>
              <th className="p-4 font-normal">Date</th>
              <th className="p-4 font-normal text-right">Montant</th>
              <th className="p-4 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-asphalt-800">
                <td className="p-4 text-signal text-xs font-mono">{labels[c.categorie]}</td>
                <td className="p-4 text-white">{c.prestataire ?? "—"}</td>
                <td className="p-4 text-asphalt-600">{c.article ?? "—"}</td>
                <td className="p-4 font-mono text-xs text-asphalt-600">
                  {new Date(c.date).toLocaleDateString("fr-FR")}
                </td>
                <td className="p-4 font-mono text-right text-white">{money(c.montant)}</td>
                <td className="p-4 text-right">
                  {canEdit && (
                    <button
                      onClick={() => deleteCharge(c.id)}
                      className="p-1.5 bg-bad/20 hover:bg-bad/30 text-bad rounded-sm"
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-asphalt-600/60">
                  Aucune charge enregistrée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
