import { createClient } from "@/lib/supabase/server";
import Shell from "@/components/Shell";
import EmployeeTicket from "@/components/EmployeeTicket";
import ContractsPanel from "@/components/ContractsPanel";
import { notFound, redirect } from "next/navigation";

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

  const isOwner = auth.user?.id === id;

  // Le Chef d'équipe voit tout le monde dans la liste, mais ne peut ouvrir
  // que sa propre fiche ou celle d'un Mécano (stagiaire/confirmé/mécano).
  if (me?.role === "chef_equipe" && !isOwner && !(employee as any)?.est_mecano) {
    redirect("/employes");
  }

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

  const { data: transferTargets } = await supabase.rpc("list_employees_for_transfer");

  const gestionLarge = me?.role === "direction" || me?.role === "drh" || me?.role === "gerant";
  const chefEquipeSurMecano = me?.role === "chef_equipe" && (employee as any)?.est_mecano;
  const canOperate = isOwner || gestionLarge || chefEquipeSurMecano;

  return (
    <Shell
      displayName={me ? `${me.prenom ?? ""} ${me.nom ?? ""}`.trim() : undefined}
      gradeNom={(me as any)?.grades?.nom}
      role={me?.role}
      userId={auth.user?.id}
    >
      <EmployeeTicket
        employee={employee as any}
        services={(services ?? []) as any}
        initialFactures={(factures ?? []) as any}
        partenaires={(partenaires ?? []) as any}
        transferTargets={(transferTargets ?? []) as any}
        canOperate={!!canOperate}
        canManageProfile={me?.role === "direction"}
        isOwner={isOwner}
      />
      <div className="mt-6">
        <ContractsPanel
          contracts={(contrats ?? []) as any}
          canManage={me?.role === "direction" || me?.role === "drh"}
          canDelete={me?.role === "direction" || me?.role === "drh"}
          defaultEmployeeId={id}
        />
      </div>
    </Shell>
  );
}
