import type { Metadata } from "next";
import { Oswald, JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";

const oswald = Oswald({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700"] });
const jbMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500", "700"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Paleto Garage — Registre",
  description: "Gestion interne du Paleto Garage",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${oswald.variable} ${jbMono.variable} ${inter.variable} font-body bg-asphalt-950 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
