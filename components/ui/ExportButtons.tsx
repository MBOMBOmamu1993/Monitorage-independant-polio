"use client";

import { useState } from "react";
import { cn } from "@/lib/client/cn";
import { exportToExcel, excelFromSeries } from "@/lib/client/export-excel";
import { exportSingleChartPPT } from "@/lib/client/export-pptx";
import type { SlideSeriesData } from "@/lib/client/export-pptx";

interface ExportButtonsProps {
  title: string;
  data: SlideSeriesData;
  className?: string;
}

export function ExportButtons({ title, data, className }: ExportButtonsProps) {
  const [loadingXls, setLoadingXls] = useState(false);
  const [loadingPpt, setLoadingPpt] = useState(false);

  async function handleExcel() {
    setLoadingXls(true);
    try {
      const sheet = excelFromSeries(title, data.units, data.series);
      await exportToExcel(title.replace(/[^a-zA-Z0-9]/g, "_"), [sheet]);
    } finally {
      setLoadingXls(false);
    }
  }

  async function handlePPT() {
    setLoadingPpt(true);
    try {
      await exportSingleChartPPT(title, data, "bar");
    } finally {
      setLoadingPpt(false);
    }
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <button
        onClick={handleExcel}
        disabled={loadingXls || data.units.length === 0}
        title="Télécharger en Excel"
        className={cn(
          "inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition",
          "border-emerald-600/40 text-emerald-700 bg-emerald-50 hover:bg-emerald-100",
          "disabled:opacity-40 disabled:cursor-not-allowed"
        )}
      >
        {loadingXls ? (
          <span className="w-3 h-3 border border-emerald-600 border-t-transparent rounded-full animate-spin" />
        ) : (
          <span>📥</span>
        )}
        Excel
      </button>
      <button
        onClick={handlePPT}
        disabled={loadingPpt || data.units.length === 0}
        title="Télécharger en PowerPoint"
        className={cn(
          "inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition",
          "border-orange-500/40 text-orange-700 bg-orange-50 hover:bg-orange-100",
          "disabled:opacity-40 disabled:cursor-not-allowed"
        )}
      >
        {loadingPpt ? (
          <span className="w-3 h-3 border border-orange-600 border-t-transparent rounded-full animate-spin" />
        ) : (
          <span>📊</span>
        )}
        PPT
      </button>
    </div>
  );
}

// ─── KPI export ───────────────────────────────────────────────────────────────

interface KpiExportButtonsProps {
  title: string;
  kpis: { label: string; value: string | number; sub?: string }[];
  className?: string;
}

export function KpiExportButtons({ title, kpis, className }: KpiExportButtonsProps) {
  const [loading, setLoading] = useState(false);

  async function handleExcel() {
    setLoading(true);
    try {
      const { excelFromKpis } = await import("@/lib/client/export-excel");
      const sheet = excelFromKpis(title, kpis);
      await exportToExcel(title.replace(/[^a-zA-Z0-9]/g, "_"), [sheet]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExcel}
      disabled={loading || kpis.length === 0}
      title="Télécharger en Excel"
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition",
        "border-emerald-600/40 text-emerald-700 bg-emerald-50 hover:bg-emerald-100",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        className
      )}
    >
      {loading ? (
        <span className="w-3 h-3 border border-emerald-600 border-t-transparent rounded-full animate-spin" />
      ) : (
        <span>📥</span>
      )}
      Excel
    </button>
  );
}
