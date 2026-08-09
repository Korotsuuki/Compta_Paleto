"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Contrat, ContratChamps } from "@/lib/types";
import { buildContratInitial, buildAvenant, REPRESENTANTS } from "@/lib/contractText";
import { Pencil, Save, X, Download } from "lucide-react";

export default function ContractDocument({
  contrat,
  canEdit,
}: {
  contrat: Contrat;
  canEdit: boolean;
}) {
  const supabase = createClient();
  const [champs, setChamps] = useState<ContratChamps>(
    contrat.champs ?? ({} as ContratChamps)
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ContratChamps>(champs);
  const [saving, setSaving] = useState(false);

  const sections =
    contrat.type === "avenant"
      ? buildAvenant(champs, contrat.numero_avenant)
      : buildContratInitial(champs);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("contrats").update({ champs: draft }).eq("id", contrat.id);
    if (!error) {
      setChamps(draft);
      setEditing(false);
    }
    setSaving(false);
  };

  const downloadPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const marginX = 50;
    const pageWidth = doc.internal.pageSize.getWidth() - marginX * 2;
    let y = 60;

    const ensureSpace = (needed: number) => {
      if (y + needed > doc.internal.pageSize.getHeight() - 60) {
        doc.addPage();
        y = 60;
      }
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(contrat.titre, marginX, y);
    y += 30;

    sections.forEach((section) => {
      if (section.heading) {
        ensureSpace(24);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(section.heading, marginX, y);
        y += 18;
      }
      section.paragraphs.forEach((p) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10.5);
        const lines = doc.splitTextToSize(p, pageWidth);
        ensureSpace(lines.length * 14 + 6);
        doc.text(lines, marginX, y);
        y += lines.length * 14 + 6;
      });
      (section.bullets ?? []).forEach((b) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10.5);
        const lines = doc.splitTextToSize("•  " + b, pageWidth - 14);
        ensureSpace(lines.length * 14 + 4);
        doc.text(lines, marginX + 14, y);
        y += lines.length * 14 + 4;
      });
    });

    ensureSpace(90);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.text("Signature de l'entreprise, Paleto Garage :", marginX, y);
    y += 26;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(22);
    doc.text(REPRESENTANTS.split(" et ")[1] ?? REPRESENTANTS, marginX, y);
    y += 34;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.text(`Signature de l'employé, ${champs.nom_prenom ?? ""} :`, marginX, y);
    y += 26;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(22);
    doc.text(champs.nom_prenom ?? "", marginX, y);

    doc.save(`${contrat.titre.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_")}.pdf`);
  };

  const field = (
    label: string,
    key: keyof ContratChamps,
    type: "text" | "date" = "text"
  ) => (
    <div>
      <label className="text-[11px] font-mono text-asphalt-600/80 block mb-1">{label}</label>
      <input
        suppressHydrationWarning
        type={type}
        value={(draft[key] as string) ?? ""}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        className="w-full bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1.5 text-sm text-white"
      />
    </div>
  );

  return (
    <div className="ticket p-6 bg-white text-asphalt-950 !border-asphalt-300">
      <div className="flex items-center justify-between mb-4 not-prose">
        <h3 className="font-display uppercase text-lg">{contrat.titre}</h3>
        <div className="flex gap-2">
          <button
            onClick={downloadPdf}
            className="flex items-center gap-1 bg-signal text-asphalt-950 text-xs font-medium px-3 py-1.5 rounded-sm"
          >
            <Download size={13} /> PDF
          </button>
          {canEdit && !editing && (
            <button
              onClick={() => {
                setDraft(champs);
                setEditing(true);
              }}
              className="flex items-center gap-1 bg-asphalt-200 text-asphalt-950 text-xs font-medium px-3 py-1.5 rounded-sm"
            >
              <Pencil size={13} /> Modifier
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-3 mb-6">
          <div className="grid md:grid-cols-2 gap-3">
            {field("Nom Prénom", "nom_prenom")}
            {field("Date de naissance", "date_naissance", "date")}
            {field("Ville de naissance", "ville_naissance")}
            {field("Nationalité", "nationalite")}
            {field("Téléphone", "telephone")}
            {field("Numéro de sécurité sociale (ID joueur)", "numero_secu")}
            {field("Date de visite médicale", "date_visite_medicale", "date")}
            {field("Date de début de contrat", "date_debut_contrat", "date")}
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1 bg-ok text-white text-xs font-medium px-3 py-1.5 rounded-sm"
            >
              <Save size={13} /> Enregistrer
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1 bg-asphalt-200 text-asphalt-950 text-xs font-medium px-3 py-1.5 rounded-sm"
            >
              <X size={13} /> Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 text-sm leading-relaxed">
          {sections.map((section, i) => (
            <div key={i}>
              {section.heading && <h4 className="font-bold text-base mb-1">{section.heading}</h4>}
              {section.paragraphs.map((p, j) => (
                <p key={j} className="mb-1.5">
                  {p}
                </p>
              ))}
              {section.bullets && (
                <ul className="list-disc pl-5 space-y-0.5">
                  {section.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          <div className="pt-6 grid md:grid-cols-2 gap-8">
            <div>
              <p className="text-xs text-asphalt-600 mb-1">Signature de l'entreprise, Paleto Garage :</p>
              <p className="text-xs text-asphalt-600 mb-1">Lu et approuvé.</p>
              <p className="font-signature text-4xl">{REPRESENTANTS.split(" et ")[1] ?? REPRESENTANTS}</p>
            </div>
            <div>
              <p className="text-xs text-asphalt-600 mb-1">Signature de l'employé, {champs.nom_prenom} :</p>
              <p className="text-xs text-asphalt-600 mb-1">Lu et approuvé,</p>
              <p className="font-signature text-4xl">{champs.nom_prenom}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
