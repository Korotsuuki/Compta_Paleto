"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EmployeeFull, Grade, money, roleForGradeName, ROLE_LABELS } from "@/lib/types";
import { UserX } from "lucide-react";

export default function EmployeesTable({
  employees,
  grades,
  canEdit,
  canFire,
}: {
  employees: EmployeeFull[];
  grades: Grade[];
  canEdit: boolean;
  canFire?: boolean;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState(employees);

  useEffect(() => {
    const channel = supabase
      .channel("employees-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, async () => {
        const { data } = await supabase.from("v_employees_full").select("*").eq("valide", true).order("grade_sort_order").order("prenom");
        if (data) setRows(data as EmployeeFull[]);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "factures" }, async () => {
        const { data } = await supabase.from("v_employees_full").select("*").eq("valide", true).order("grade_sort_order").order("prenom");
        if (data) setRows(data as EmployeeFull[]);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateGrade = async (id: string, grade_id: string) => {
    const grade = grades.find((g) => g.id === grade_id);
    const role = roleForGradeName(grade?.nom);
    setRows((r) => r.map((e) => (e.id === id ? { ...e, grade_id, role } : e)));
    await supabase.from("profiles").update({ grade_id, role }).eq("id", id);
  };

  const toggleEtat = async (id: string, etat: "actif" | "absent") => {
    const next = etat === "actif" ? "absent" : "actif";
    setRows((r) => r.map((e) => (e.id === id ? { ...e, etat: next } : e)));
    await supabase.from("profiles").update({ etat: next }).eq("id", id);
  };

  const renvoyer = async (e: EmployeeFull) => {
    if (
      !confirm(
        `Retirer ${e.prenom} ${e.nom} du site ? Son accès sera coupé mais son historique (factures, contrats) est conservé.`
      )
    )
      return;
    setRows((r) => r.filter((x) => x.id !== e.id));
    await supabase.from("profiles").update({ valide: false, licencie: true }).eq("id", e.id);
  };

  return (
    <div className="ticket overflow-x-auto">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="text-left text-asphalt-600/80 font-mono text-xs uppercase border-b border-asphalt-700">
            <th className="p-4 font-normal">Employé</th>
            <th className="p-4 font-normal">Grade</th>
            <th className="p-4 font-normal">Accès</th>
            <th className="p-4 font-normal">État</th>
            <th className="p-4 font-normal">Téléphone</th>
            <th className="p-4 font-normal">C.A Global</th>
            <th className="p-4 font-normal">Salaire</th>
            <th className="p-4 font-normal"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className="border-b border-asphalt-800 hover:bg-asphalt-900/50">
              <td className="p-4">
                <div className="text-white font-medium">
                  {e.prenom} {e.nom}
                </div>
                <div className="text-xs font-mono text-asphalt-600/70">#{e.employee_code}</div>
              </td>
              <td className="p-4">
                {canEdit ? (
                  <select
                    value={e.grade_id ?? ""}
                    onChange={(ev) => updateGrade(e.id, ev.target.value)}
                    className="bg-asphalt-800 border border-asphalt-700 rounded-sm px-2 py-1 text-white text-xs"
                  >
                    <option value="">—</option>
                    {grades.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nom}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-signal text-xs font-mono">{e.grade_nom ?? "—"}</span>
                )}
              </td>
              <td className="p-4">
                <span className="text-xs font-mono text-steel-light">{ROLE_LABELS[e.role]}</span>
              </td>
              <td className="p-4">
                <button
                  onClick={() => canEdit && toggleEtat(e.id, e.etat)}
                  disabled={!canEdit}
                  className={`text-xs font-mono px-2 py-1 rounded-sm ${
                    e.etat === "actif" ? "bg-ok/20 text-ok" : "bg-caution/20 text-caution"
                  }`}
                >
                  {e.etat}
                </button>
              </td>
              <td className="p-4 font-mono text-asphalt-600">{e.telephone ?? "—"}</td>
              <td className="p-4 font-mono text-white">{money(e.ca_global)}</td>
              <td className="p-4 font-mono text-signal">{money(e.salaire)}</td>
              <td className="p-4">
                <div className="flex items-center gap-3">
                  <Link href={`/employes/${e.id}`} className="text-xs text-steel-light hover:underline">
                    Voir la fiche →
                  </Link>
                  {canFire && (
                    <button
                      onClick={() => renvoyer(e)}
                      className="text-bad/70 hover:text-bad"
                      title="Retirer du site"
                    >
                      <UserX size={15} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
