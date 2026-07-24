"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Grade, Service, Partenaire, GradeType, ServiceCategorie, money } from "@/lib/types";
import { Plus, Trash2, Save, Check, X } from "lucide-react";
import PartenairesPanel from "@/components/PartenairesPanel";

type Tab = "grades" | "services" | "partenaires";

export default function AdminPanels({
  initialGrades,
  initialServices,
  initialPartenaires,
}: {
  initialGrades: Grade[];
  initialServices: Service[];
  initialPartenaires: Partenaire[];
}) {
  const [tab, setTab] = useState<Tab>("grades");

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {(
          [
            ["grades", "Grades & rémunération"],
            ["services", "Prestations facturables"],
            ["partenaires", "Partenaires"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-xs font-mono uppercase rounded-sm border ${
              tab === key
                ? "bg-signal text-asphalt-950 border-signal"
                : "border-asphalt-700 text-asphalt-600 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "grades" && <GradesPanel initial={initialGrades} />}
      {tab === "services" && <ServicesPanel initial={initialServices} />}
      {tab === "partenaires" && <PartenairesPanel initial={initialPartenaires} />}
    </div>
  );
}

// ---------------------------------------------------------------------
// GRADES
// ---------------------------------------------------------------------
function GradesPanel({ initial }: { initial: Grade[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState<Grade[]>(initial);
  const [draft, setDraft] = useState<Partial<Grade>>({ type: "pourcentage" });
  const [savingId, setSavingId] = useState<string | null>(null);

  const patch = (id: string, field: keyof Grade, value: any) =>
    setRows((r) => r.map((g) => (g.id === id ? { ...g, [field]: value } : g)));

  const save = async (g: Grade) => {
    setSavingId(g.id);
    await supabase
      .from("grades")
      .update({
        nom: g.nom,
        type: g.type,
        montant_fixe: g.montant_fixe,
        pourcentage: g.pourcentage,
        plafond: g.plafond,
        est_mecano: g.est_mecano,
      })
      .eq("id", g.id);
    setSavingId(null);
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce grade ? Les employés qui l'ont doivent être réassignés.")) return;
    await supabase.from("grades").delete().eq("id", id);
    setRows((r) => r.filter((g) => g.id !== id));
  };

  const add = async () => {
    if (!draft.nom) return;
    const { data } = await supabase
      .from("grades")
      .insert({
        nom: draft.nom,
        type: draft.type ?? "pourcentage",
        montant_fixe: draft.montant_fixe ?? 0,
        pourcentage: draft.pourcentage ?? 0,
        plafond: draft.plafond ?? 0,
        est_mecano: draft.est_mecano ?? false,
        sort_order: rows.length + 1,
      })
      .select()
      .single();
    if (data) setRows((r) => [...r, data as Grade]);
    setDraft({ type: "pourcentage" });
  };

  return (
    <div className="ticket p-5 overflow-x-auto">
      <table className="w-full text-sm min-w-[800px]">
        <thead>
          <tr className="text-left text-asphalt-600/80 font-mono text-xs uppercase border-b border-asphalt-700">
            <th className="p-3 font-normal">Nom</th>
            <th className="p-3 font-normal">Type</th>
            <th className="p-3 font-normal">Montant fixe</th>
            <th className="p-3 font-normal">% du C.A</th>
            <th className="p-3 font-normal">Plafond</th>
            <th className="p-3 font-normal">Famille mécano</th>
            <th className="p-3 font-normal"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.id} className="border-b border-asphalt-800">
              <td className="p-2">
                <input
              suppressHydrationWarning
                  value={g.nom}
                  onChange={(e) => patch(g.id, "nom", e.target.value)}
                  className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1 text-white w-32"
                />
              </td>
              <td className="p-2">
                <select
                  value={g.type}
                  onChange={(e) => patch(g.id, "type", e.target.value as GradeType)}
                  className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1 text-white"
                >
                  <option value="fixe">Fixe</option>
                  <option value="pourcentage">% du C.A</option>
                </select>
              </td>
              <td className="p-2">
                <input
              suppressHydrationWarning
                  type="number"
                  value={g.montant_fixe}
                  onChange={(e) => patch(g.id, "montant_fixe", parseFloat(e.target.value) || 0)}
                  disabled={g.type !== "fixe"}
                  className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1 text-white w-24 disabled:opacity-30"
                />
              </td>
              <td className="p-2">
                <input
              suppressHydrationWarning
                  type="number"
                  value={g.pourcentage}
                  onChange={(e) => patch(g.id, "pourcentage", parseFloat(e.target.value) || 0)}
                  disabled={g.type !== "pourcentage"}
                  className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1 text-white w-20 disabled:opacity-30"
                />
              </td>
              <td className="p-2">
                <input
              suppressHydrationWarning
                  type="number"
                  value={g.plafond}
                  onChange={(e) => patch(g.id, "plafond", parseFloat(e.target.value) || 0)}
                  disabled={g.type !== "pourcentage"}
                  className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1 text-white w-24 disabled:opacity-30"
                />
              </td>
              <td className="p-2">
                <button
                  onClick={() => patch(g.id, "est_mecano", !g.est_mecano)}
                  className={`text-xs px-2 py-1 rounded-sm ${
                    g.est_mecano ? "bg-steel/30 text-steel-light" : "bg-asphalt-700 text-asphalt-600"
                  }`}
                  title="Visible pour le Chef d'équipe"
                >
                  {g.est_mecano ? "oui" : "non"}
                </button>
              </td>
              <td className="p-2 flex gap-1">
                <button
                  onClick={() => save(g)}
                  className="p-1.5 bg-ok/20 hover:bg-ok/30 text-ok rounded-sm"
                  title="Enregistrer"
                >
                  {savingId === g.id ? <Check size={14} /> : <Save size={14} />}
                </button>
                <button
                  onClick={() => remove(g.id)}
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
          placeholder="Nom du grade"
          value={draft.nom ?? ""}
          onChange={(e) => setDraft({ ...draft, nom: e.target.value })}
          className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1.5 text-white text-sm w-40"
        />
        <select
          value={draft.type}
          onChange={(e) => setDraft({ ...draft, type: e.target.value as GradeType })}
          className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1.5 text-white text-sm"
        >
          <option value="fixe">Fixe</option>
          <option value="pourcentage">% du C.A</option>
        </select>
        <input
              suppressHydrationWarning
          type="number"
          placeholder="Montant fixe"
          value={draft.montant_fixe ?? ""}
          onChange={(e) => setDraft({ ...draft, montant_fixe: parseFloat(e.target.value) || 0 })}
          className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1.5 text-white text-sm w-28"
        />
        <input
              suppressHydrationWarning
          type="number"
          placeholder="%"
          value={draft.pourcentage ?? ""}
          onChange={(e) => setDraft({ ...draft, pourcentage: parseFloat(e.target.value) || 0 })}
          className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1.5 text-white text-sm w-20"
        />
        <input
              suppressHydrationWarning
          type="number"
          placeholder="Plafond"
          value={draft.plafond ?? ""}
          onChange={(e) => setDraft({ ...draft, plafond: parseFloat(e.target.value) || 0 })}
          className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1.5 text-white text-sm w-24"
        />
        <button
          onClick={add}
          className="flex items-center gap-1 bg-signal hover:bg-signal-dim text-asphalt-950 font-medium text-sm px-3 py-1.5 rounded-sm"
        >
          <Plus size={15} /> Ajouter un grade
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// SERVICES
// ---------------------------------------------------------------------
const CATS: ServiceCategorie[] = ["depannage", "prestation", "nettoyage", "custom"];

function ServicesPanel({ initial }: { initial: Service[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState<Service[]>(initial);
  const [draft, setDraft] = useState<Partial<Service>>({ categorie: "prestation" });

  const patch = (id: string, field: keyof Service, value: any) =>
    setRows((r) => r.map((s) => (s.id === id ? { ...s, [field]: value } : s)));

  const save = async (s: Service) => {
    await supabase
      .from("services")
      .update({ nom: s.nom, prix: s.prix, categorie: s.categorie, actif: s.actif })
      .eq("id", s.id);
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette prestation ?")) return;
    await supabase.from("services").delete().eq("id", id);
    setRows((r) => r.filter((s) => s.id !== id));
  };

  const add = async () => {
    if (!draft.nom) return;
    const { data } = await supabase
      .from("services")
      .insert({
        nom: draft.nom,
        prix: draft.prix ?? 0,
        categorie: draft.categorie ?? "prestation",
        montant_libre: false,
        actif: true,
        sort_order: rows.length + 1,
      })
      .select()
      .single();
    if (data) setRows((r) => [...r, data as Service]);
    setDraft({ categorie: "prestation" });
  };

  return (
    <div className="ticket p-5 overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="text-left text-asphalt-600/80 font-mono text-xs uppercase border-b border-asphalt-700">
            <th className="p-3 font-normal">Nom</th>
            <th className="p-3 font-normal">Prix</th>
            <th className="p-3 font-normal">Catégorie</th>
            <th className="p-3 font-normal">Actif</th>
            <th className="p-3 font-normal"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-b border-asphalt-800">
              <td className="p-2">
                <input
              suppressHydrationWarning
                  value={s.nom}
                  onChange={(e) => patch(s.id, "nom", e.target.value)}
                  className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1 text-white w-44"
                />
              </td>
              <td className="p-2">
                <input
              suppressHydrationWarning
                  type="number"
                  value={s.prix}
                  disabled={s.montant_libre}
                  onChange={(e) => patch(s.id, "prix", parseFloat(e.target.value) || 0)}
                  className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1 text-white w-24 disabled:opacity-30"
                />
              </td>
              <td className="p-2">
                <select
                  value={s.categorie}
                  onChange={(e) => patch(s.id, "categorie", e.target.value as ServiceCategorie)}
                  className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1 text-white"
                >
                  {CATS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </td>
              <td className="p-2">
                <button
                  onClick={() => patch(s.id, "actif", !s.actif)}
                  className={`text-xs px-2 py-1 rounded-sm ${
                    s.actif ? "bg-ok/20 text-ok" : "bg-bad/20 text-bad"
                  }`}
                >
                  {s.actif ? "actif" : "désactivé"}
                </button>
              </td>
              <td className="p-2 flex gap-1">
                <button
                  onClick={() => save(s)}
                  className="p-1.5 bg-ok/20 hover:bg-ok/30 text-ok rounded-sm"
                  title="Enregistrer"
                >
                  <Save size={14} />
                </button>
                <button
                  onClick={() => remove(s.id)}
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
          placeholder="Nom de la prestation"
          value={draft.nom ?? ""}
          onChange={(e) => setDraft({ ...draft, nom: e.target.value })}
          className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1.5 text-white text-sm w-48"
        />
        <input
              suppressHydrationWarning
          type="number"
          placeholder="Prix"
          value={draft.prix ?? ""}
          onChange={(e) => setDraft({ ...draft, prix: parseFloat(e.target.value) || 0 })}
          className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1.5 text-white text-sm w-24"
        />
        <select
          value={draft.categorie}
          onChange={(e) => setDraft({ ...draft, categorie: e.target.value as ServiceCategorie })}
          className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1.5 text-white text-sm"
        >
          {CATS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          onClick={add}
          className="flex items-center gap-1 bg-signal hover:bg-signal-dim text-asphalt-950 font-medium text-sm px-3 py-1.5 rounded-sm"
        >
          <Plus size={15} /> Ajouter une prestation
        </button>
      </div>
      <p className="text-xs text-asphalt-600/60 mt-3 font-mono">
        La prestation "Montant Custom" (montant libre) reste modifiable en nom/catégorie mais son
        prix se saisit à chaque facture sur la fiche employé.
      </p>
    </div>
  );
}

