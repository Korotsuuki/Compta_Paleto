"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Users,
  Handshake,
  Receipt,
  Gift,
  LogOut,
  Wrench,
  Settings,
  FileClock,
  FileText,
  Landmark,
  UserCircle,
  Banknote,
} from "lucide-react";
import { Role, ROLE_LABELS } from "@/lib/types";

const GESTION_NAV = [
  { href: "/dashboard", label: "Registre global", icon: LayoutDashboard },
  { href: "/employes", label: "Employés", icon: Users },
  { href: "/partenaires", label: "Partenaires", icon: Handshake },
  { href: "/contrats", label: "Contrats", icon: FileText },
  { href: "/charges", label: "Charges", icon: Receipt },
  { href: "/primes", label: "Primes", icon: Gift },
  { href: "/banque", label: "Banque", icon: Landmark },
  { href: "/historique", label: "Historique", icon: FileClock },
];

export default function Shell({
  children,
  displayName,
  gradeNom,
  role,
  userId,
}: {
  children: React.ReactNode;
  displayName?: string;
  gradeNom?: string | null;
  role?: Role;
  userId?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  let nav = GESTION_NAV;
  if (role === "employe") {
    nav = [{ href: `/employes/${userId}`, label: "Ma fiche", icon: UserCircle }];
  } else if (role === "gouv") {
    nav = [{ href: "/gouv", label: "Dépenses totales", icon: Banknote }];
  } else if (role === "direction") {
    nav = [...GESTION_NAV, { href: "/admin", label: "Administration", icon: Settings }];
  }

  return (
    <div className="min-h-screen flex bg-asphalt-950 bg-diamond">
      <aside className="w-64 shrink-0 border-r border-asphalt-700 flex flex-col">
        <div className="px-5 py-6 border-b border-asphalt-700 flex items-center gap-2 text-signal">
          <Wrench size={20} strokeWidth={2.5} />
          <div>
            <div className="font-display uppercase tracking-wider text-white text-lg leading-none">
              Paleto Garage
            </div>
            <div className="font-mono text-[10px] text-asphalt-600/70 mt-1">registre interne</div>
          </div>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-5 py-3 text-sm font-medium border-l-2 transition-colors ${
                  active
                    ? "border-signal text-white bg-asphalt-900"
                    : "border-transparent text-asphalt-600 hover:text-white hover:bg-asphalt-900/60"
                }`}
              >
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-asphalt-700">
          <div className="text-sm text-white truncate">{displayName ?? "…"}</div>
          <div className="text-xs font-mono text-signal/80 mb-3">
            {role ? ROLE_LABELS[role] : ""}
            {gradeNom ? ` · ${gradeNom}` : ""}
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-xs text-asphalt-600 hover:text-bad transition-colors"
          >
            <LogOut size={14} /> Déconnexion
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  );
}
