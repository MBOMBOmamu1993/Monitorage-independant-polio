import "./globals.css";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { Metadata } from "next";
import Sidebar from "@/components/shell/Sidebar";
import Topbar from "@/components/shell/Topbar";
import FilterBar from "@/components/shell/FilterBar";
import SiteGate from "@/components/shell/SiteGate";

export const metadata: Metadata = {
  title: "Polio — Monitorage indépendant",
  description:
    "Dashboard opérationnel pour le monitorage indépendant de la campagne Polio (RDC).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <SiteGate>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <div className="sticky top-0 z-40 shadow-sm">
                <Topbar />
              </div>
              <main className="flex-1 overflow-y-auto overflow-x-hidden bg-surface-50">
                <FilterBar />
                <div className="p-4 md:p-6">{children}</div>
              </main>
            </div>
          </div>
        </SiteGate>
      </body>
    </html>
  );
}
