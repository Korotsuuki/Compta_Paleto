"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Contrat } from "@/lib/types";
import { Upload, Download, Trash2, FileText } from "lucide-react";

export default function ContractsPanel({
  contracts,
  canManage,
  canDelete,
  defaultEmployeeId,
  defaultPartenaireId,
  employees,
  partenaires,
}: {
  contracts: Contrat[];
  canManage: boolean;
  canDelete: boolean;
  defaultEmployeeId?: string;
  defaultPartenaireId?: string;
  employees?: { id: string; label: string }[];
  partenaires?: { id: string; label: string }[];
}) {
  const supabase = createClient();
  const [rows, setRows] = useState<Contrat[]>(contracts);
  const [titre, setTitre] = useState("");
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId ?? "");
  const [partenaireId, setPartenaireId] = useState(defaultPartenaireId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async () => {
    if (!file || !titre) return;
    setUploading(true);
    const path = `${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("contrats").upload(path, file);
    if (!uploadError) {
      const { data } = await supabase
        .from("contrats")
        .insert({
          titre,
          fichier_url: path,
          employee_id: employeeId || null,
          partenaire_id: partenaireId || null,
        })
        .select()
        .single();
      if (data) setRows((r) => [data as Contrat, ...r]);
    }
    setTitre("");
    setFile(null);
    setUploading(false);
  };

  const download = async (path: string) => {
    const { data } = await supabase.storage.from("contrats").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const remove = async (c: Contrat) => {
    if (!confirm(`Supprimer le contrat "${c.titre}" ?`)) return;
    if (c.fichier_url) await supabase.storage.from("contrats").remove([c.fichier_url]);
    await supabase.from("contrats").delete().eq("id", c.id);
    setRows((r) => r.filter((x) => x.id !== c.id));
  };

  return (
    <div className="ticket p-5">
      <h2 className="font-display uppercase text-white text-sm mb-4 tracking-wide flex items-center gap-2">
        <FileText size={16} className="text-signal" /> Contrats
      </h2>

      <div className="space-y-2 mb-4">
        {rows.length === 0 && (
          <p className="text-asphalt-600/60 text-sm">Aucun contrat enregistré.</p>
        )}
        {rows.map((c) => (
          <div
            key={c.id}
            className="ticket-stub pl-3 flex items-center justify-between py-2 pr-2"
          >
            <div>
              <div className="text-white text-sm">{c.titre}</div>
              <div className="text-xs font-mono text-asphalt-600/70">
                {new Date(c.date_signature).toLocaleDateString("fr-FR")}
              </div>
            </div>
            <div className="flex gap-1">
              {c.fichier_url && (
                <button
                  onClick={() => download(c.fichier_url!)}
                  className="p-1.5 bg-steel/20 hover:bg-steel/30 text-steel-light rounded-sm"
                  title="Télécharger"
                >
                  <Download size={14} />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => remove(c)}
                  className="p-1.5 bg-bad/20 hover:bg-bad/30 text-bad rounded-sm"
                  title="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {canManage && (
        <div className="pt-4 border-t border-asphalt-700 space-y-2">
          <input
              suppressHydrationWarning
            placeholder="Titre du contrat"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            className="w-full bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1.5 text-sm text-white"
          />
          {employees && (
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1.5 text-sm text-white"
            >
              <option value="">— Aucun employé lié —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
          )}
          {partenaires && (
            <select
              value={partenaireId}
              onChange={(e) => setPartenaireId(e.target.value)}
              className="w-full bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1.5 text-sm text-white"
            >
              <option value="">— Aucun partenaire lié —</option>
              {partenaires.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
          <input
              suppressHydrationWarning
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-xs text-asphalt-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-sm file:border-0 file:bg-asphalt-700 file:text-white file:text-xs"
          />
          <button
            onClick={upload}
            disabled={!file || !titre || uploading}
            className="w-full flex items-center justify-center gap-2 bg-signal hover:bg-signal-dim disabled:opacity-30 text-asphalt-950 font-medium text-sm py-2 rounded-sm"
          >
            <Upload size={15} /> {uploading ? "Envoi en cours…" : "Envoyer le contrat"}
          </button>
        </div>
      )}
    </div>
  );
}
