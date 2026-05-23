"use client";

/**
 * Barres empilées 100% — répartition pour chaque catégorie d'org-unit.
 * Inspiré PowerBI : raisons non-vaccination / absence / canaux d'information.
 */
import EChart from "./EChart";
import type * as echarts from "echarts/core";
import { fmtUnit } from "@/lib/client/format";

interface SerieDef {
  name: string;
  data: number[];
  color?: string;
}

interface Props {
  categories: string[];
  series: SerieDef[];
  horizontal?: boolean;
  height?: number;
}

const PALETTE = [
  "#0093d5",
  "#e23636",
  "#f29e0b",
  "#22b457",
  "#8e44ad",
  "#16a085",
  "#d35400",
  "#2c3e50",
  "#c0392b",
  "#7f8c8d",
];

export default function Stacked100({
  categories,
  series,
  horizontal = false,
  height = 340,
}: Props) {
  const displayCategories = categories.map(fmtUnit);

  // Normalisation 100% par catégorie
  const totals = categories.map((_, i) =>
    series.reduce((s, se) => s + (se.data[i] ?? 0), 0)
  );
  const pctSeries = series.map((se, idx) => ({
    name: se.name,
    type: "bar" as const,
    stack: "total",
    barMaxWidth: horizontal ? 20 : 26,
    itemStyle: { color: se.color ?? PALETTE[idx % PALETTE.length] },
    emphasis: { focus: "series" as const },
    label: {
      show: true,
      position: "inside" as const,
      fontSize: 10,
      color: "#fff",
      formatter: (p: { value: number }) => (p.value >= 8 ? `${p.value.toFixed(0)}%` : ""),
    },
    data: se.data.map((v, i) => (totals[i] ? +((v / totals[i]) * 100).toFixed(1) : 0)),
  }));

  const option: echarts.EChartsCoreOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: any) => {
        if (!params || !params.length) return "";
        const title = fmtUnit(params[0].axisValue);
        const rows = params.map((p: any) => `
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="width:10px;height:10px;border-radius:50%;background:${p.color};"></span>
            <span style="flex:1">${p.seriesName}</span>
            <strong style="margin-left:8px;">${p.value.toFixed(1)}%</strong>
          </div>
        `).join("");
        return `<div style="font-weight:600;margin-bottom:4px;">${title}</div>${rows}`;
      }
    },
    legend: { top: 0, textStyle: { fontSize: 11 } },
    grid: { left: 80, right: 24, top: 30, bottom: horizontal ? 40 : 70 },
    xAxis: horizontal
      ? { type: "value", max: 100, axisLabel: { formatter: "{value}%", fontSize: 10 } }
      : {
          type: "category",
          data: displayCategories,
          axisLabel: { rotate: 38, fontSize: 10, interval: 0 },
        },
    yAxis: horizontal
      ? {
          type: "category",
          data: displayCategories,
          axisLabel: { fontSize: 10 },
        }
      : { type: "value", max: 100, axisLabel: { formatter: "{value}%", fontSize: 10 } },
    series: pctSeries,
  };
  return <EChart option={option} height={height} />;
}
