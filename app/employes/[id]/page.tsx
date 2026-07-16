import { createClient } from "@/lib/supabase/server";
import Shell from "@/components/Shell";
import EmployeeTicket from "@/components/EmployeeTicket";
import ContractsPanel from "@/components/ContractsPanel";
import { notFound } from "next/navigation";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("profiles")
    .select("prenom, nom, role, grades:grade_id(nom)")
    .eq("id", auth.user?.id)
    .single();

  const { data: employee } = await supabase
    .from("v_employees_full")
    .select("*")
    .eq("id", id)
    .single();

  if (!employee) notFound();

  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("actif", true)
    .order("sort_order");

  const { data: factures } = await supabase
    .from("factures")
    .select("*")
    .eq("employee_id", id)
    .order("created_at", { ascending: false });

  const { data: contrats } = await supabase
    .from("contrats")
    .select("*")
    .eq("employee_id", id)
    .order("date_signature", { ascending: false });

  const { data: partenaires } = await supabase
    .from("partenaires")
    .select("id, nom, remise_percent")
    .order("nom");

  const canOperate = auth.user?.id === id || me?.role === "direction" || me?.role === "cadre";

  return (
    <Shell
      displayName={me ? `${me.prenom ?? ""} ${me.nom ?? ""}`.trim() : undefined}
      gradeNom={(me as any)?.grades?.nom}
      role={me?.role}
    >
      <EmployeeTicket
        employee={employee as any}
        services={(services ?? []) as any}
        initialFactures={(factures ?? []) as any}
        partenaires={(partenaires ?? []) as any}
        canOperate={!!canOperate}
        canManageProfile={me?.role === "direction"}
        isOwner={auth.user?.id === id}
      />
      <div className="mt-6">
        <ContractsPanel
          contracts={(contrats ?? []) as any}
          canManage={me?.role === "direction" || me?.role === "cadre"}
          canDelete={me?.role === "direction"}
          defaultEmployeeId={id}
        />
      </div>
    </Shell>
  );
}
