"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
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
  ScrollText,
  Menu,
  X,
} from "lucide-react";
import { Role, ROLE_LABELS } from "@/lib/types";

const DASHBOARD = { href: "/dashboard", label: "Registre global", icon: LayoutDashboard };
const EMPLOYES = { href: "/employes", label: "Employés", icon: Users };
const PARTENAIRES = { href: "/partenaires", label: "Partenaires", icon: Handshake };
const CONTRATS = { href: "/contrats", label: "Contrats", icon: FileText };
const CHARGES = { href: "/charges", label: "Charges", icon: Receipt };
const PRIMES = { href: "/primes", label: "Primes", icon: Gift };
const BANQUE = { href: "/banque", label: "Banque", icon: Landmark };
const HISTORIQUE = { href: "/historique", label: "Historique", icon: FileClock };
const LOGS = { href: "/logs", label: "Logs", icon: ScrollText };
const ADMIN = { href: "/admin", label: "Administration", icon: Settings };

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
  const [mobileOpen, setMobileOpen] = useState(false);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const maFiche = { href: `/employes/${userId}`, label: "Ma fiche", icon: UserCircle };

  let nav: typeof DASHBOARD[] = [];
  if (role === "gouv") {
    nav = [{ href: "/gouv", label: "Dépenses totales", icon: Banknote }];
  } else if (role === "employe") {
    nav = [DASHBOARD, PARTENAIRES, maFiche];
  } else if (role === "chef_equipe") {
    nav = [DASHBOARD, EMPLOYES, PARTENAIRES, maFiche];
  } else if (role === "gerant") {
    nav = [DASHBOARD, EMPLOYES, PARTENAIRES, CHARGES, maFiche];
  } else if (role === "drh") {
    nav = [DASHBOARD, EMPLOYES, PARTENAIRES, CONTRATS, CHARGES, PRIMES, BANQUE, HISTORIQUE, maFiche];
  } else if (role === "direction") {
    nav = [DASHBOARD, EMPLOYES, PARTENAIRES, CONTRATS, CHARGES, PRIMES, BANQUE, HISTORIQUE, LOGS, ADMIN, maFiche];
  } else {
    nav = [DASHBOARD];
  }

  const sidebarContent = (
    <>
      <div className="px-5 py-6 border-b border-asphalt-700 flex items-center justify-between">
        <div className="flex items-center gap-2 text-signal">
          <Wrench size={20} strokeWidth={2.5} />
          <div>
            <div className="font-display uppercase tracking-wider text-white text-lg leading-none">
              Paleto Garage
            </div>
            <div className="font-mono text-[10px] text-asphalt-600/70 mt-1">registre interne</div>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden text-asphalt-600 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
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
    </>
  );

  return (
    <div className="min-h-screen flex bg-asphalt-950 bg-diamond">
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-asphalt-900 border-b border-asphalt-700">
        <div className="flex items-center gap-2 text-signal">
          <Wrench size={18} strokeWidth={2.5} />
          <span className="font-display uppercase tracking-wider text-white text-sm">Paleto Garage</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="text-white">
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile off-canvas sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-64 bg-asphalt-950 border-r border-asphalt-700 flex flex-col">{sidebarContent}</div>
          <div className="flex-1 bg-black/60" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-asphalt-700 flex-col">
        {sidebarContent}
      </aside>

      <main className="flex-1 p-4 md:p-8 pt-20 md:pt-8 overflow-y-auto overflow-x-hidden">{children}</main>
    </div>
  );
}
