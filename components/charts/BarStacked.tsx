"use client";

import EChart from "./EChart";
import { fmtUnit } from "@/lib/client/format";

export interface BarStackedSeries {
  name: string;
  data: number[];
  color?: string;
}

export default function BarStacked({
  categories,
  series,
  height = 320,
  horizontal = false,
  stack = "total",
  valueFormat = (v: number) => String(v),
}: {
  categories: string[];
  series: BarStackedSeries[];
  height?: number;
  horizontal?: boolean;
  stack?: string | false;
  valueFormat?: (v: number) => string;
}) {
  const displayCategories = categories.map(fmtUnit);
  const catAxis = { type: "category" as const, data: displayCategories, axisTick: { show: false } };
  const valAxis = { type: "value" as const, axisLabel: { formatter: (v: number) => valueFormat(v) } };

  return (
    <EChart
      height={height}
      option={{
        grid: { left: 10, right: 16, top: 30, bottom: 20, containLabel: true },
        legend: { top: 0, type: "scroll", textStyle: { fontSize: 11 } },
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
        xAxis: horizontal ? valAxis : catAxis,
        yAxis: horizontal ? catAxis : valAxis,
        series: series.map((s) => ({
          name: s.name,
          type: "bar",
          stack: stack || undefined,
          data: s.data,
          itemStyle: s.color ? { color: s.color } : undefined,
          barMaxWidth: 28,
        })),
      }}
    />
  );
}
