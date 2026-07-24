import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { money } from "@/lib/types";
import { Landmark } from "lucide-react";

export default async function GouvPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("profiles")
    .select("prenom, nom, role")
    .eq("id", auth.user?.id)
    .single();

  if (me?.role !== "gouv") redirect("/dashboard");

  const { data: total, error } = await supabase.rpc("get_total_depenses");

  return (
    <Shell
      displayName={me ? `${me.prenom ?? ""} ${me.nom ?? ""}`.trim() : undefined}
      role={me?.role}
      userId={auth.user?.id}
    >
      <header className="mb-8">
        <div className="stamp text-signal text-xs mb-3">Accès externe</div>
        <h1 className="font-display text-3xl uppercase text-white">Dépenses totales</h1>
        <p className="text-asphalt-600/80 font-mono text-sm mt-1">
          Paleto Garage — total déclaré, mis à jour en direct
        </p>
      </header>

      <div className="ticket p-10 max-w-md text-center">
        <Landmark size={32} className="text-signal mx-auto mb-4" />
        <div className="text-[11px] font-mono uppercase text-asphalt-600/80 mb-2">
          Total des dépenses
        </div>
        <div className="font-display text-5xl text-white">{error ? "—" : money(total ?? 0)}</div>
      </div>
    </Shell>
  );
}
