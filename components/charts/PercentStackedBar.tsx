"use client";

import { useEffect, useMemo, useState } from "react";
import EChart from "./EChart";
import ChartPager from "./ChartPager";
import { fmtUnit } from "@/lib/client/format";

export interface PercentSeries {
  name: string;
  data: number[];
  color?: string;
}

export default function PercentStackedBar({
  categories,
  series,
  height = 360,
  showLabels = true,
  minLabelPct = 4,
  pageSize = 12,
}: {
  categories: string[];
  series: PercentSeries[];
  height?: number;
  showLabels?: boolean;
  minLabelPct?: number;
  pageSize?: number;
}) {
  const [page, setPage] = useState(0);
  const effectivePageSize = pageSize > 0 ? pageSize : Math.max(1, categories.length);
  const pageCount = Math.max(1, Math.ceil(categories.length / effectivePageSize));
  useEffect(() => {
    setPage((p) => Math.min(p, pageCount - 1));
  }, [pageCount]);

  const start = page * effectivePageSize;
  const pageCategories = useMemo(
    () => categories.slice(start, start + effectivePageSize),
    [categories, start, effectivePageSize],
  );
  const pageSeries = useMemo(
    () => series.map((s) => ({ ...s, data: s.data.slice(start, start + effectivePageSize) })),
    [series, start, effectivePageSize],
  );
  const displayCategories = pageCategories.map(fmtUnit);
  const totals = pageCategories.map((_, idx) =>
    pageSeries.reduce((sum, s) => sum + (s.data[idx] ?? 0), 0)
  );

  const pctSeries = pageSeries.map((s) => ({
    name: s.name,
    type: "bar" as const,
    stack: "total",
    barMaxWidth: 48,
    itemStyle: s.color ? { color: s.color, borderRadius: 0 } : { borderRadius: 0 },
    label: showLabels
      ? {
          show: true,
          position: "inside" as const,
          color: "#ffffff",
          fontSize: 11,
          fontWeight: 600,
          formatter: (p: { value: number }) =>
            p.value >= minLabelPct ? `${Math.round(p.value)}%` : "",
        }
      : { show: false },
    data: s.data.map((v, idx) => {
      const tot = totals[idx];
      return tot > 0 ? +((v * 100) / tot).toFixed(2) : 0;
    }),
  }));

  return (
    <>
    <EChart
      height={height}
      option={{
        grid: { left: 8, right: 16, top: 48, bottom: 28, containLabel: true },
        legend: {
          top: 4,
          type: "scroll",
          icon: "circle",
          textStyle: { fontSize: 11, color: "#475569" },
          itemWidth: 10,
          itemHeight: 10,
          itemGap: 14,
        },
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          formatter: (params: Array<{ axisValue: string; seriesName: string; value: number; color: string; dataIndex: number }>) => {
            if (!params?.length) return "";
            const idx = params[0].dataIndex;
            const tot = totals[idx];
            const lines = params
              .filter((p) => p.value > 0)
              .map((p) => {
                const abs = pageSeries.find((s) => s.name === p.seriesName)?.data[idx] ?? 0;
                return `<div style="display:flex;align-items:center;gap:6px;">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
                  <span style="flex:1">${p.seriesName}</span>
                  <strong>${abs.toLocaleString("fr-FR")} (${p.value.toFixed(1)}%)</strong>
                </div>`;
              })
              .join("");
            return `<div style="font-weight:600;margin-bottom:4px">${fmtUnit(params[0].axisValue)}</div>
                    ${lines}
                    <div style="margin-top:4px;border-top:1px solid #e2e8f0;padding-top:4px;">
                      Total : <strong>${tot.toLocaleString("fr-FR")}</strong>
                    </div>`;
          },
        },
        xAxis: {
          type: "category",
          data: displayCategories,
          axisTick: { show: false },
          axisLine: { lineStyle: { color: "#cbd5e1" } },
          axisLabel: {
            color: "#475569",
            fontSize: 11,
            interval: 0,
            rotate: categories.length > 6 ? 30 : 0,
            formatter: (v: string) => v,
          },
        },
        yAxis: {
          type: "value",
          max: 100,
          min: 0,
          axisLabel: { formatter: "{value}%", color: "#64748b", fontSize: 11 },
          splitLine: { lineStyle: { color: "#e2e8f0" } },
        },
        series: pctSeries,
      }}
    />
    <ChartPager
      page={page}
      pageCount={pageCount}
      total={categories.length}
      pageSize={effectivePageSize}
      onPageChange={setPage}
    />
    </>
  );
}
