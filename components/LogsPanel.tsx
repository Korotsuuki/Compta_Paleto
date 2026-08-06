"use client";

import { Fragment, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuditLogEntry } from "@/lib/types";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";

const TABLE_LABELS: Record<string, string> = {
  profiles: "Employé",
  factures: "Facture",
  charges: "Charge",
  primes: "Prime",
  partenaires: "Partenaire",
  contrats: "Contrat",
  banque_mouvements: "Banque",
  grades: "Grade",
  services: "Prestation",
};

const ACTION_ICON: Record<string, any> = { INSERT: Plus, UPDATE: Pencil, DELETE: Trash2 };
const ACTION_COLOR: Record<string, string> = { INSERT: "text-ok", UPDATE: "text-steel-light", DELETE: "text-bad" };
const ACTION_LABEL: Record<string, string> = { INSERT: "création", UPDATE: "modification", DELETE: "suppression" };

type LogRow = AuditLogEntry & { profiles?: { prenom: string | null; nom: string | null } | null };

export default function LogsPanel({ initial }: { initial: LogRow[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState<LogRow[]>(initial);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("logs-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_log" }, async (payload) => {
        const { data } = await supabase
          .from("profiles")
          .select("prenom, nom")
          .eq("id", (payload.new as any).acted_by)
          .single();
        setRows((r) => [{ ...(payload.new as AuditLogEntry), profiles: data }, ...r].slice(0, 200));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="ticket overflow-hidden">
      <div className="max-h-[70vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-asphalt-900">
            <tr className="text-left text-asphalt-600/80 font-mono text-xs uppercase border-b border-asphalt-700">
              <th className="p-4 font-normal">Quand</th>
              <th className="p-4 font-normal">Qui</th>
              <th className="p-4 font-normal">Action</th>
              <th className="p-4 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((log) => {
              const Icon = ACTION_ICON[log.action];
              const isOpen = expanded === log.id;
              return (
                <Fragment key={log.id}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : log.id)}
                    className="border-b border-asphalt-800 hover:bg-asphalt-900/50 cursor-pointer"
                  >
                    <td className="p-4 font-mono text-xs text-asphalt-600 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("fr-FR")}
                    </td>
                    <td className="p-4 text-white text-sm">
                      {log.profiles ? `${log.profiles.prenom ?? ""} ${log.profiles.nom ?? ""}`.trim() : "Système"}
                    </td>
                    <td className={`p-4 text-xs font-mono flex items-center gap-1.5 ${ACTION_COLOR[log.action]}`}>
                      <Icon size={13} />
                      {ACTION_LABEL[log.action]} · {TABLE_LABELS[log.table_name] ?? log.table_name}
                    </td>
                    <td className="p-4 text-asphalt-600">
                      {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-asphalt-800 bg-asphalt-900/40">
                      <td colSpan={4} className="p-4">
                        <pre className="text-[11px] font-mono text-asphalt-600 whitespace-pre-wrap break-all">
                          {JSON.stringify(log.new_data ?? log.old_data, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-asphalt-600/60">
                  Aucune activité enregistrée pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
