"use client";

import EChart from "./EChart";

export default function LineTrend({
  categories,
  series,
  height = 260,
}: {
  categories: string[];
  series: { name: string; data: number[]; color?: string }[];
  height?: number;
}) {
  return (
    <EChart
      height={height}
      option={{
        grid: { left: 10, right: 16, top: 30, bottom: 20, containLabel: true },
        legend: { top: 0, textStyle: { fontSize: 11 } },
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: categories, boundaryGap: false },
        yAxis: { type: "value" },
        series: series.map((s) => ({
          name: s.name,
          type: "line",
          smooth: true,
          showSymbol: false,
          areaStyle: { opacity: 0.08 },
          data: s.data,
          lineStyle: { width: 2, color: s.color },
          itemStyle: s.color ? { color: s.color } : undefined,
        })),
      }}
    />
  );
}
