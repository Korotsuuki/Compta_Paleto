"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { RegistreHistorique, EmployeeResume, money } from "@/lib/types";
import { PackageCheck, Download, AlertTriangle } from "lucide-react";

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
  canClose,
}: {
  historique: RegistreHistorique[];
  canClose: boolean;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState(historique);
  const [titre, setTitre] = useState("");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [closing, setClosing] = useState(false);

  const cloturer = async () => {
    if (!titre || !debut || !fin) return;
    if (
      !confirm(
        "Clôturer la semaine ? Toutes les factures actuelles seront définitivement retirées des fiches employés (le C.A repart à 0). Le détail de cette semaine reste consultable ici et téléchargeable."
      )
    )
      return;
    setClosing(true);
    const { data, error } = await supabase.rpc("cloturer_semaine", {
      p_titre: titre,
      p_periode_debut: debut,
      p_periode_fin: fin,
    });
    if (!error && data) {
      const { data: row } = await supabase.from("registre_historique").select("*").eq("id", data).single();
      if (row) setRows((r) => [row as RegistreHistorique, ...r]);
      setTitre("");
      setDebut("");
      setFin("");
    }
    setClosing(false);
  };

  const exportResume = (h: RegistreHistorique) => {
    const resume = (h.resume_employes ?? []) as EmployeeResume[];
    const csvRows = resume.map((e) => ({
      Prenom: e.prenom,
      Nom: e.nom,
      Grade: e.grade,
      Etat: e.etat,
      "C.A Global": e.ca_global,
      "C.A Repa/Net": e.ca_repa_net,
      "Cout Customs": e.cout_customs,
      "Nombre factures": e.nombre_factures,
      Salaire: e.salaire,
    }));
    downloadCsv(`${h.titre.replace(/\s+/g, "_")}.csv`, toCsv(csvRows));
  };

  return (
    <div className="space-y-6">
      {canClose && (
        <div className="ticket p-5 border-caution/40">
          <h2 className="font-display uppercase text-white text-sm mb-2 flex items-center gap-2">
            <PackageCheck size={16} className="text-signal" /> Clôturer la semaine
          </h2>
          <p className="text-xs text-caution/90 font-mono mb-4 flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            Action irréversible : toutes les factures actuelles sont archivées ici puis effacées des
            fiches employés — nouvelle semaine à zéro pour tout le monde.
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
              disabled={!titre || !debut || !fin || closing}
              className="bg-signal hover:bg-signal-dim disabled:opacity-30 text-asphalt-950 font-medium text-sm py-2 rounded-sm"
            >
              {closing ? "Clôture en cours…" : "Clôturer et réinitialiser"}
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
              <th className="p-4 font-normal"></th>
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
                <td className="p-4 text-right">
                  {h.resume_employes && (
                    <button
                      onClick={() => exportResume(h)}
                      className="flex items-center gap-1 bg-steel/20 hover:bg-steel/30 text-steel-light text-xs px-2 py-1.5 rounded-sm ml-auto"
                      title="Télécharger le détail de cette semaine (CSV, s'ouvre dans Excel)"
                    >
                      <Download size={13} /> Détail
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-asphalt-600/60">
                  Aucune clôture enregistrée pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-asphalt-600/60 font-mono">
        L'export "Détail" ci-dessus est un CSV (compatible Excel) en attendant le modèle précis —
        dis-moi à quoi doit ressembler le fichier final et j'ajoute aussi l'export PDF.
      </p>
    </div>
  );
}
