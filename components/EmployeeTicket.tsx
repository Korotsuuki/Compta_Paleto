"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EmployeeFull, Facture, Service, Partenaire, money } from "@/lib/types";
import { Minus, Plus, Trash2, Percent, Pencil, Save, X } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  depannage: "Dépannages",
  prestation: "Prestations",
  nettoyage: "Nettoyage",
  custom: "Facture",
};

type PartenaireLite = Pick<Partenaire, "id" | "nom" | "remise_percent">;

export default function EmployeeTicket({
  employee,
  services,
  initialFactures,
  partenaires,
  canOperate,
  canManageProfile,
  isOwner,
}: {
  employee: EmployeeFull;
  services: Service[];
  initialFactures: Facture[];
  partenaires: PartenaireLite[];
  canOperate: boolean;
  canManageProfile: boolean;
  isOwner: boolean;
}) {
  const supabase = createClient();
  const [factures, setFactures] = useState<Facture[]>(initialFactures);
  const [ca, setCa] = useState({
    ca_global: employee.ca_global,
    ca_repa_net: employee.ca_repa_net,
    cout_customs: employee.cout_customs,
    salaire: employee.salaire,
  });
  const [panierAmount, setPanierAmount] = useState("");
  const [partenaireId, setPartenaireId] = useState("");
  const [remisePercent, setRemisePercent] = useState("0");

  const canEditInfo = isOwner || canManageProfile;
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({
    prenom: employee.prenom ?? "",
    nom: employee.nom ?? "",
    telephone: employee.telephone ?? "",
  });
  const [infoDisplay, setInfoDisplay] = useState({
    prenom: employee.prenom ?? "",
    nom: employee.nom ?? "",
    telephone: employee.telephone ?? "",
  });
  const [savingInfo, setSavingInfo] = useState(false);

  const saveInfo = async () => {
    setSavingInfo(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        prenom: infoForm.prenom || null,
        nom: infoForm.nom || null,
        telephone: infoForm.telephone || null,
      })
      .eq("id", employee.id);
    if (!error) {
      setInfoDisplay({ ...infoForm });
      setEditingInfo(false);
    }
    setSavingInfo(false);
  };

  // Realtime: sync factures for this employee across every connected user
  useEffect(() => {
    const channel = supabase
      .channel(`factures-${employee.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "factures", filter: `employee_id=eq.${employee.id}` },
        () => refreshAll()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee.id]);

  const refreshAll = async () => {
    const { data: f } = await supabase
      .from("factures")
      .select("*")
      .eq("employee_id", employee.id)
      .order("created_at", { ascending: false });
    setFactures((f ?? []) as Facture[]);

    const { data: e } = await supabase
      .from("v_employees_full")
      .select("ca_global, ca_repa_net, cout_customs, salaire")
      .eq("id", employee.id)
      .single();
    if (e) setCa(e as any);
  };

  const countFor = (serviceId: string) => factures.filter((f) => f.service_id === serviceId).length;

  const addFacture = async (service: Service) => {
    if (!canOperate) return;
    await supabase.from("factures").insert({
      employee_id: employee.id,
      service_id: service.id,
      montant: service.prix,
      quantite: 1,
    });
    await refreshAll();
  };

  const deleteFacture = async (id: string) => {
    if (!canOperate) return;
    await supabase.from("factures").delete().eq("id", id);
    await refreshAll();
  };

  const removeLastFacture = async (serviceId: string) => {
    if (!canOperate) return;
    const last = factures.find((f) => f.service_id === serviceId);
    if (last) await deleteFacture(last.id);
  };

  const panier = parseFloat(panierAmount.replace(",", ".")) || 0;
  const remise = parseFloat(remisePercent.replace(",", ".")) || 0;
  const prixAFacturer = Math.max(0, panier * (1 - remise / 100));

  const onSelectPartenaire = (id: string) => {
    setPartenaireId(id);
    const p = partenaires.find((pa) => pa.id === id);
    setRemisePercent(p?.remise_percent ? String(p.remise_percent) : "0");
  };

  const addCustomFacture = async () => {
    if (!canOperate) return;
    if (!panier || prixAFacturer <= 0) return;
    const custom = services.find((s) => s.montant_libre);
    if (!custom) return;
    await supabase.from("factures").insert({
      employee_id: employee.id,
      service_id: custom.id,
      montant: Math.round(prixAFacturer * 100) / 100,
      quantite: 1,
    });
    setPanierAmount("");
    setPartenaireId("");
    setRemisePercent("0");
    await refreshAll();
  };

  const grouped = useMemo(() => {
    const g: Record<string, Service[]> = { depannage: [], prestation: [], nettoyage: [] };
    services.forEach((s) => {
      if (s.montant_libre) return;
      (g[s.categorie] ??= []).push(s);
    });
    return g;
  }, [services]);

  const customService = services.find((s) => s.montant_libre);
  const customFactures = factures.filter((f) => f.service_id === customService?.id);
  const customTotal = customFactures.reduce((sum, f) => sum + f.montant, 0);

  return (
    <div>
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="stamp text-signal text-xs mb-3">Fiche employé</div>
          {!editingInfo ? (
            <>
              <h1 className="font-display text-3xl uppercase text-white">
                {infoDisplay.prenom} {infoDisplay.nom}
              </h1>
              <p className="text-asphalt-600/80 font-mono text-sm mt-1">
                {employee.grade_nom ?? "Sans grade"} · #{employee.employee_code} ·{" "}
                <span className={employee.etat === "actif" ? "text-ok" : "text-caution"}>
                  {employee.etat}
                </span>
                {infoDisplay.telephone && <> · {infoDisplay.telephone}</>}
              </p>
            </>
          ) : (
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="text-[11px] font-mono text-asphalt-600/80 block mb-1">Prénom</label>
                <input
                  suppressHydrationWarning
                  value={infoForm.prenom}
                  onChange={(e) => setInfoForm({ ...infoForm, prenom: e.target.value })}
                  className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1.5 text-white text-sm w-32"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-asphalt-600/80 block mb-1">Nom</label>
                <input
                  suppressHydrationWarning
                  value={infoForm.nom}
                  onChange={(e) => setInfoForm({ ...infoForm, nom: e.target.value })}
                  className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1.5 text-white text-sm w-32"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-asphalt-600/80 block mb-1">Téléphone</label>
                <input
                  suppressHydrationWarning
                  value={infoForm.telephone}
                  onChange={(e) => setInfoForm({ ...infoForm, telephone: e.target.value })}
                  className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1.5 text-white text-sm w-32"
                  placeholder="555-0000"
                />
              </div>
              <button
                onClick={saveInfo}
                disabled={savingInfo}
                className="flex items-center gap-1 bg-ok/20 hover:bg-ok/30 text-ok text-xs px-3 py-1.5 rounded-sm"
              >
                <Save size={13} /> Enregistrer
              </button>
              <button
                onClick={() => {
                  setInfoForm(infoDisplay);
                  setEditingInfo(false);
                }}
                className="flex items-center gap-1 bg-asphalt-700 hover:bg-asphalt-600 text-asphalt-600 text-xs px-3 py-1.5 rounded-sm"
              >
                <X size={13} /> Annuler
              </button>
            </div>
          )}
        </div>
        {canEditInfo && !editingInfo && (
          <button
            onClick={() => setEditingInfo(true)}
            className="flex items-center gap-2 text-xs text-asphalt-600 hover:text-white border border-asphalt-700 px-3 py-1.5 rounded-sm"
          >
            <Pencil size={13} /> {isOwner ? "Modifier mes informations" : "Modifier ses informations"}
          </button>
        )}
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="ticket p-4">
          <div className="text-[11px] font-mono uppercase text-asphalt-600/80 mb-2">C.A Répa / Net.</div>
          <div className="font-display text-2xl text-white">{money(ca.ca_repa_net)}</div>
        </div>
        <div className="ticket p-4">
          <div className="text-[11px] font-mono uppercase text-asphalt-600/80 mb-2">Coût réel Customs</div>
          <div className="font-display text-2xl text-steel-light">{money(ca.cout_customs)}</div>
        </div>
        <div className="ticket p-4">
          <div className="text-[11px] font-mono uppercase text-asphalt-600/80 mb-2">C.A Global</div>
          <div className="font-display text-2xl text-signal">{money(ca.ca_global)}</div>
        </div>
        <div className="ticket p-4">
          <div className="text-[11px] font-mono uppercase text-asphalt-600/80 mb-2">
            Salaire {employee.grade_type === "pourcentage" ? `(max. ${money(employee.plafond)})` : ""}
          </div>
          <div className="font-display text-2xl text-ok">{money(ca.salaire)}</div>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        {Object.entries(grouped).map(([cat, list]) =>
          list.length ? (
            <div key={cat} className="ticket p-5">
              <h2 className="font-display uppercase text-white text-sm mb-4 tracking-wide">
                {CATEGORY_LABELS[cat]}
              </h2>
              <div className="space-y-4">
                {list.map((s) => (
                  <div key={s.id} className="ticket-stub pl-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white">
                        {s.nom} <span className="font-mono text-asphalt-600/70">{money(s.prix)}</span>
                      </span>
                      <span className="font-mono text-lg text-signal">{countFor(s.id)}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={!canOperate}
                        onClick={() => addFacture(s)}
                        className="flex-1 flex items-center justify-center gap-1 bg-steel/20 hover:bg-steel/30 disabled:opacity-30 text-steel-light text-xs py-2 rounded-sm"
                      >
                        <Plus size={13} /> {s.nom}
                      </button>
                      <button
                        disabled={!canOperate}
                        onClick={() => removeLastFacture(s.id)}
                        className="flex-1 flex items-center justify-center gap-1 bg-signal/10 hover:bg-signal/20 disabled:opacity-30 text-signal text-xs py-2 rounded-sm"
                      >
                        <Minus size={13} /> {s.nom}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null
        )}

        {customService && (
          <div className="ticket p-5">
            <h2 className="font-display uppercase text-white text-sm mb-4 tracking-wide">
              Nettoyages & Événements
            </h2>
            <div className="ticket-stub pl-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white">Montant Custom</span>
                <span className="font-mono text-lg text-signal">{money(customTotal)}</span>
              </div>

              <label className="text-[11px] font-mono text-asphalt-600/80">Prix du panier Customs</label>
              <input
                suppressHydrationWarning
                value={panierAmount}
                onChange={(e) => setPanierAmount(e.target.value)}
                className="w-full bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1.5 text-sm text-white"
                placeholder="0.00"
              />

              <label className="text-[11px] font-mono text-asphalt-600/80">
                Remise (contrat partenaire)
              </label>
              <select
                value={partenaireId}
                onChange={(e) => onSelectPartenaire(e.target.value)}
                className="w-full bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1.5 text-sm text-white"
              >
                <option value="">— Aucune / remise manuelle —</option>
                {partenaires
                  .filter((p) => p.remise_percent)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom} (-{p.remise_percent}%)
                    </option>
                  ))}
              </select>

              <label className="text-[11px] font-mono text-asphalt-600/80 flex items-center gap-1">
                <Percent size={12} /> % de remise (contrat ou promo temporaire)
              </label>
              <input
                suppressHydrationWarning
                type="number"
                value={remisePercent}
                onChange={(e) => setRemisePercent(e.target.value)}
                className="w-full bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1.5 text-sm text-white"
                placeholder="0"
              />

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-mono text-asphalt-600/80">Prix à facturer</span>
                <span className="font-display text-xl text-ok">{money(prixAFacturer)}</span>
              </div>

              <button
                disabled={!canOperate || !panier}
                onClick={addCustomFacture}
                className="w-full bg-signal hover:bg-signal-dim disabled:opacity-30 text-asphalt-950 font-medium text-sm py-2 rounded-sm mt-1"
              >
                Facturer {panier ? money(prixAFacturer) : ""}
              </button>
              <div className="text-[11px] font-mono text-asphalt-600/70 pt-1">
                {customFactures.length} facture(s) sur ce compte
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="ticket p-5 mt-6">
        <h2 className="font-display uppercase text-white text-sm mb-4 tracking-wide">
          Historique ({factures.length} facture{factures.length > 1 ? "s" : ""})
        </h2>
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-xs font-mono">
            <tbody>
              {factures.slice(0, 30).map((f) => (
                <tr key={f.id} className="border-b border-asphalt-800 text-asphalt-600">
                  <td className="py-1.5">{new Date(f.created_at).toLocaleString("fr-FR")}</td>
                  <td className="py-1.5">{services.find((s) => s.id === f.service_id)?.nom ?? "—"}</td>
                  <td className="py-1.5 text-right text-white">{money(f.montant)}</td>
                  <td className="py-1.5 pl-3 text-right">
                    {canOperate && (
                      <button
                        onClick={() => {
                          if (confirm("Supprimer cette facture ? L'employé pourra la refaire correctement."))
                            deleteFacture(f.id);
                        }}
                        className="p-1 text-bad/70 hover:text-bad"
                        title="Supprimer cette facture"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {factures.length === 0 && (
                <tr>
                  <td className="py-3 text-asphalt-600/60">Aucune facture pour le moment.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
