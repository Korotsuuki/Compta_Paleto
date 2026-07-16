"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { RegistreHistorique, money } from "@/lib/types";
import { PackageCheck, Download } from "lucide-react";

function toCsv(rows: Record<string, any>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function HistoriquePanel({
  historique,
  currentSnapshot,
  canClose,
}: {
  historique: RegistreHistorique[];
  currentSnapshot: {
    ca_global: number;
    ca_repa_net: number;
    cout_customs: number;
    total_salaires: number;
    total_charges: number;
    total_primes: number;
  };
  canClose: boolean;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState(historique);
  const [titre, setTitre] = useState("");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [range, setRange] = useState({ debut: "", fin: "" });
  const [exporting, setExporting] = useState<string | null>(null);

  const cloturer = async () => {
    if (!titre || !debut || !fin) return;
    const benefice_net =
      currentSnapshot.ca_global -
      (currentSnapshot.total_salaires + currentSnapshot.total_charges + currentSnapshot.total_primes);
    const { data } = await supabase
      .from("registre_historique")
      .insert({
        titre,
        periode_debut: debut,
        periode_fin: fin,
        ca_global: currentSnapshot.ca_global,
        ca_repa_net: currentSnapshot.ca_repa_net,
        cout_customs: currentSnapshot.cout_customs,
        total_salaires: currentSnapshot.total_salaires,
        total_charges: currentSnapshot.total_charges,
        total_primes: currentSnapshot.total_primes,
        benefice_net,
      })
      .select()
      .single();
    if (data) setRows((r) => [data as RegistreHistorique, ...r]);
    setTitre("");
    setDebut("");
    setFin("");
  };

  const exportTable = async (table: "v_employees_full" | "factures" | "charges", filename: string) => {
    setExporting(table);
    let query = supabase.from(table).select("*");
    if (table !== "v_employees_full") {
      const dateCol = table === "factures" ? "created_at" : "date";
      if (range.debut) query = query.gte(dateCol, range.debut);
      if (range.fin) query = query.lte(dateCol, range.fin);
    }
    const { data } = await query;
    downloadCsv(filename, toCsv((data ?? []) as any));
    setExporting(null);
  };

  return (
    <div className="space-y-6">
      {canClose && (
        <div className="ticket p-5">
          <h2 className="font-display uppercase text-white text-sm mb-4 flex items-center gap-2">
            <PackageCheck size={16} className="text-signal" /> Clôturer une période
          </h2>
          <p className="text-xs text-asphalt-600/70 font-mono mb-4">
            Enregistre une photo des totaux actuels du registre (C.A, salaires, charges, bénéfice) —
            utile pour comparer semaine après semaine. Ça n'efface aucune donnée existante.
          </p>
          <div className="grid md:grid-cols-4 gap-3">
            <input
              suppressHydrationWarning
              placeholder="Titre (ex: Semaine 28)"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-2 text-white text-sm"
            />
            <input
              suppressHydrationWarning
              type="date"
              value={debut}
              onChange={(e) => setDebut(e.target.value)}
              className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-2 text-white text-sm"
            />
            <input
              suppressHydrationWarning
              type="date"
              value={fin}
              onChange={(e) => setFin(e.target.value)}
              className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-2 text-white text-sm"
            />
            <button
              onClick={cloturer}
              disabled={!titre || !debut || !fin}
              className="bg-signal hover:bg-signal-dim disabled:opacity-30 text-asphalt-950 font-medium text-sm py-2 rounded-sm"
            >
              Clôturer
            </button>
          </div>
        </div>
      )}

      <div className="ticket overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="text-left text-asphalt-600/80 font-mono text-xs uppercase border-b border-asphalt-700">
              <th className="p-4 font-normal">Période</th>
              <th className="p-4 font-normal text-right">C.A Global</th>
              <th className="p-4 font-normal text-right">Salaires</th>
              <th className="p-4 font-normal text-right">Charges</th>
              <th className="p-4 font-normal text-right">Bénéfice net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => (
              <tr key={h.id} className="border-b border-asphalt-800">
                <td className="p-4">
                  <div className="text-white">{h.titre}</div>
                  <div className="text-xs font-mono text-asphalt-600/70">
                    {new Date(h.periode_debut).toLocaleDateString("fr-FR")} →{" "}
                    {new Date(h.periode_fin).toLocaleDateString("fr-FR")}
                  </div>
                </td>
                <td className="p-4 text-right font-mono text-signal">{money(h.ca_global)}</td>
                <td className="p-4 text-right font-mono text-white">{money(h.total_salaires)}</td>
                <td className="p-4 text-right font-mono text-white">{money(h.total_charges)}</td>
                <td className={`p-4 text-right font-mono ${h.benefice_net >= 0 ? "text-ok" : "text-bad"}`}>
                  {money(h.benefice_net)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-asphalt-600/60">
                  Aucune clôture enregistrée pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="ticket p-5">
        <h2 className="font-display uppercase text-white text-sm mb-4 flex items-center gap-2">
          <Download size={16} className="text-signal" /> Export CSV
        </h2>
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="text-[11px] font-mono text-asphalt-600/80 block mb-1">Depuis</label>
            <input
              suppressHydrationWarning
              type="date"
              value={range.debut}
              onChange={(e) => setRange({ ...range, debut: e.target.value })}
              className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1.5 text-white text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-mono text-asphalt-600/80 block mb-1">Jusqu'à</label>
            <input
              suppressHydrationWarning
              type="date"
              value={range.fin}
              onChange={(e) => setRange({ ...range, fin: e.target.value })}
              className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1.5 text-white text-sm"
            />
          </div>
          <span className="text-xs text-asphalt-600/60 font-mono pb-2">
            (s'applique aux factures et charges — laisser vide pour tout exporter)
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => exportTable("v_employees_full", "employes.csv")}
            disabled={exporting === "v_employees_full"}
            className="flex items-center gap-2 bg-steel/20 hover:bg-steel/30 text-steel-light text-sm px-3 py-2 rounded-sm"
          >
            <Download size={14} /> Employés
          </button>
          <button
            onClick={() => exportTable("factures", "factures.csv")}
            disabled={exporting === "factures"}
            className="flex items-center gap-2 bg-steel/20 hover:bg-steel/30 text-steel-light text-sm px-3 py-2 rounded-sm"
          >
            <Download size={14} /> Factures
          </button>
          <button
            onClick={() => exportTable("charges", "charges.csv")}
            disabled={exporting === "charges"}
            className="flex items-center gap-2 bg-steel/20 hover:bg-steel/30 text-steel-light text-sm px-3 py-2 rounded-sm"
          >
            <Download size={14} /> Charges
          </button>
        </div>
      </div>
    </div>
  );
}
