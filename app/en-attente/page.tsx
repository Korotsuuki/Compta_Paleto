"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Clock, LogOut, Wrench } from "lucide-react";

export default function EnAttentePage() {
  const supabase = createClient();
  const router = useRouter();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-asphalt-950 bg-diamond px-4">
      <div className="ticket w-full max-w-sm p-8 pt-10 text-center">
        <div className="flex items-center justify-center gap-2 text-signal mb-6">
          <Wrench size={20} strokeWidth={2.5} />
          <span className="font-display uppercase tracking-widest text-sm">Paleto Garage</span>
        </div>
        <Clock size={32} className="text-caution mx-auto mb-4" />
        <h1 className="font-display text-xl uppercase text-white mb-2">Compte en attente</h1>
        <p className="text-sm text-asphalt-600/80 mb-6">
          Ton compte Discord est bien enregistré, mais il doit être validé par la Direction
          avant de pouvoir accéder au registre. Préviens un responsable.
        </p>
        <button
          onClick={signOut}
          className="flex items-center justify-center gap-2 mx-auto text-xs text-asphalt-600 hover:text-bad transition-colors"
        >
          <LogOut size={14} /> Déconnexion
        </button>
      </div>
    </main>
  );
}
