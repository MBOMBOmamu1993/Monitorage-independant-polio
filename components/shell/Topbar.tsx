"use client";

import Image from "next/image";
import { useState } from "react";
import { triggerRefresh, useAnalytics } from "@/lib/client/api";
import { fmtDateTime } from "@/lib/client/format";

function Icon({ name, className = "w-4 h-4" }: { name: "refresh" | "download"; className?: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "refresh") {
    return (
      <svg viewBox="0 0 24 24" className={className} {...common}>
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
        <path d="M3 21v-5h5" />
      </svg>
    );
  }
  // download
  return (
    <svg viewBox="0 0 24 24" className={className} {...common}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

export default function Topbar() {
  const { data, isLoading, isProvinceSwitching, refresh, hasData } = useAnalytics();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  async function onRefresh() {
    try {
      setRefreshing(true);
      setRefreshError(null);
      await triggerRefresh();
      await refresh();
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }

  const meta = data?.meta;

  return (
    <header className="relative h-14 shrink-0 px-4 md:px-6 flex items-center gap-4 text-white bg-oms-500 border-b border-white/15">
      <div className="leading-tight min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-white/80 font-medium">
          Programme Élargi de Vaccination
        </div>
        <h1 className="text-[14px] md:text-[15px] font-semibold leading-tight truncate">
          Campagne Polio (nVPO2 + VPOb)
        </h1>
      </div>
      <div className="flex-1" />
      <div className="hidden lg:flex items-center gap-5 text-[11px]">
        <div className="leading-tight text-right">
          <div className="uppercase tracking-wider text-white/75">
            Dernière actualisation
          </div>
          <div className="text-white font-medium tabular-nums">
            {fmtDateTime(meta?.generatedAt)}
          </div>
        </div>
        <div className="h-7 w-px bg-white/20" />
        <div className="leading-tight text-right">
          <div className="uppercase tracking-wider text-white/75">
            Couverture prévue
          </div>
          <div className="text-white font-medium tabular-nums">≥ 95 %</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          disabled={refreshing || isLoading}
          className="inline-flex items-center gap-1.5 px-3 h-8 text-[12px] rounded border border-white/30 bg-white/10 hover:bg-white/20 text-white font-medium transition disabled:opacity-60"
          title="Vider le cache serveur et recharger"
        >
          <Icon name="refresh" className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span>{refreshing ? "Actualisation…" : "Actualiser"}</span>
        </button>
        {refreshError && hasData && (
          <span className="text-[10px] text-amber-200 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
            Refresh échoué
          </span>
        )}
      </div>
      <button
        className="hidden md:inline-flex items-center gap-1.5 px-3 h-8 text-[12px] rounded bg-white text-oms-600 hover:bg-white/90 font-semibold transition"
        title="Exporter les données"
      >
        <Icon name="download" className="w-3.5 h-3.5" />
        <span>Exporter</span>
      </button>

      {/* Barre de progression indéterminée lors du switch de province */}
      {isProvinceSwitching && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden bg-white/20">
          <div className="h-full w-2/5 bg-white/90 rounded-full animate-province-loading" />
        </div>
      )}
    </header>
  );
}
