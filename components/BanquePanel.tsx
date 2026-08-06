"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BanqueMouvement, money } from "@/lib/types";
import StatCard from "@/components/StatCard";
import { Plus, ArrowDownCircle, ArrowUpCircle, Trash2 } from "lucide-react";

export default function BanquePanel({
  mouvements,
  solde,
  canManage,
}: {
  mouvements: BanqueMouvement[];
  solde: number;
  canManage: boolean;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState(mouvements);
  const [currentSolde, setCurrentSolde] = useState(solde);
  const [form, setForm] = useState({ type: "depot" as "depot" | "retrait", montant: "", motif: "" });

  const refreshSolde = async () => {
    const { data } = await supabase.from("v_banque_solde").select("solde").single();
    if (data) setCurrentSolde(data.solde);
  };

  useEffect(() => {
    const channel = supabase
      .channel("banque-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "banque_mouvements" }, async () => {
        const { data } = await supabase
          .from("banque_mouvements")
          .select("*")
          .order("date", { ascending: false })
          .order("created_at", { ascending: false });
        if (data) setRows(data as BanqueMouvement[]);
        await refreshSolde();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    const montant = parseFloat(form.montant.replace(",", "."));
    if (!montant || montant <= 0) return;
    const { data } = await supabase
      .from("banque_mouvements")
      .insert({
        type: form.type,
        montant,
        motif: form.motif || null,
        date: new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();
    if (data) setRows((r) => [data as BanqueMouvement, ...r]);
    setForm({ type: "depot", montant: "", motif: "" });
    await refreshSolde();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce mouvement ?")) return;
    await supabase.from("banque_mouvements").delete().eq("id", id);
    setRows((r) => r.filter((m) => m.id !== id));
    await refreshSolde();
  };

  return (
    <div className="space-y-6">
      <StatCard label="Solde actuel" value={money(currentSolde)} tone={currentSolde >= 0 ? "ok" : "bad"} size="lg" />

      {canManage && (
        <div className="ticket p-5">
          <h2 className="font-display uppercase text-white text-sm mb-4">Nouveau mouvement</h2>
          <div className="grid md:grid-cols-4 gap-3">
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as "depot" | "retrait" })}
              className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-2 text-white text-sm"
            >
              <option value="depot">Dépôt</option>
              <option value="retrait">Retrait</option>
            </select>
            <input
              suppressHydrationWarning
              placeholder="Montant"
              value={form.montant}
              onChange={(e) => setForm({ ...form, montant: e.target.value })}
              className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-2 text-white text-sm"
            />
            <input
              suppressHydrationWarning
              placeholder="Motif (optionnel)"
              value={form.motif}
              onChange={(e) => setForm({ ...form, motif: e.target.value })}
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
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="text-left text-asphalt-600/80 font-mono text-xs uppercase border-b border-asphalt-700">
              <th className="p-4 font-normal">Type</th>
              <th className="p-4 font-normal">Motif</th>
              <th className="p-4 font-normal">Date</th>
              <th className="p-4 font-normal text-right">Montant</th>
              <th className="p-4 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-b border-asphalt-800">
                <td className="p-4">
                  {m.type === "depot" ? (
                    <span className="flex items-center gap-1 text-ok text-xs font-mono">
                      <ArrowDownCircle size={14} /> Dépôt
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-bad text-xs font-mono">
                      <ArrowUpCircle size={14} /> Retrait
                    </span>
                  )}
                </td>
                <td className="p-4 text-asphalt-600">{m.motif ?? "—"}</td>
                <td className="p-4 font-mono text-xs text-asphalt-600">
                  {new Date(m.date).toLocaleDateString("fr-FR")}
                </td>
                <td className={`p-4 font-mono text-right ${m.type === "depot" ? "text-ok" : "text-bad"}`}>
                  {m.type === "depot" ? "+" : "-"}
                  {money(m.montant)}
                </td>
                <td className="p-4 text-right">
                  {canManage && (
                    <button
                      onClick={() => remove(m.id)}
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
                <td colSpan={5} className="p-6 text-center text-asphalt-600/60">
                  Aucun mouvement enregistré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
