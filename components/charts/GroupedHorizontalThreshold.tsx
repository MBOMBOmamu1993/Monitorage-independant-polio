"use client";

import EChart from "./EChart";
import { fmtUnit } from "@/lib/client/format";

export interface GroupedSeries {
  name: string;
  data: number[];
  color?: string;
}

export default function GroupedHorizontalThreshold({
  categories,
  series,
  threshold = 95,
  thresholdLabel,
  unit = "%",
  height,
  decimals = 1,
}: {
  categories: string[];
  series: GroupedSeries[];
  threshold?: number;
  thresholdLabel?: string;
  unit?: string;
  height?: number;
  decimals?: number;
}) {
  const displayCategories = categories.map(fmtUnit);
  const computedHeight = height ?? Math.max(280, categories.length * (series.length * 22 + 16) + 80);

  return (
    <EChart
      height={computedHeight}
      option={{
        grid: { left: 8, right: 64, top: 36, bottom: 32, containLabel: true },
        legend: {
          top: 0,
          icon: "circle",
          itemWidth: 10,
          itemHeight: 10,
          textStyle: { color: "#475569", fontSize: 12 },
        },
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          valueFormatter: (v: unknown) => `${Number(v).toFixed(decimals)}${unit}`,
        },
        xAxis: {
          type: "value",
          max: (val: { max: number }) => Math.max(100, Math.ceil(val.max / 10) * 10),
          min: 0,
          axisLabel: { formatter: `{value}${unit}`, color: "#64748b", fontSize: 11 },
          splitLine: { lineStyle: { color: "#e2e8f0" } },
        },
        yAxis: {
          type: "category",
          data: displayCategories,
          inverse: true,
          axisTick: { show: false },
          axisLine: { lineStyle: { color: "#cbd5e1" } },
          axisLabel: {
            color: "#1e293b",
            fontSize: 12,
            fontWeight: 500,
            formatter: (v: string) => v,
          },
        },
        series: series.map((s, idx) => ({
          name: s.name,
          type: "bar",
          barMaxWidth: 18,
          barGap: "20%",
          itemStyle: s.color ? { color: s.color, borderRadius: [0, 4, 4, 0] } : { borderRadius: [0, 4, 4, 0] },
          data: s.data.map((v) => +v.toFixed(decimals)),
          label: {
            show: true,
            position: "right",
            color: "#1e293b",
            fontSize: 11,
            fontWeight: 600,
            formatter: (p: { value: number }) => `${p.value.toFixed(decimals)}${unit}`,
          },
          markLine: idx === 0 ? {
            silent: true,
            symbol: "none",
            lineStyle: { color: "#0f172a", type: "dashed", width: 1.5 },
            label: {
              formatter: thresholdLabel ?? `Seuil ${threshold}${unit}`,
              color: "#0f172a",
              fontSize: 11,
              position: "end",
            },
            data: [{ xAxis: threshold }],
          } : undefined,
        })),
      }}
    />
  );
}
