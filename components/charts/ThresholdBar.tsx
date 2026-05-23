"use client";

/**
 * Barres verticales avec ligne de seuil (OMS 90% / 95% / 5%).
 * Couleur adaptée selon la position vs seuil.
 */
import EChart from "./EChart";
import type * as echarts from "echarts/core";
import { fmtUnit } from "@/lib/client/format";

interface Props {
  categories: string[];
  values: number[];
  threshold: number;
  thresholdLabel?: string;
  higherIsBetter?: boolean;
  unit?: string;
  height?: number;
}

export default function ThresholdBar({
  categories,
  values,
  threshold,
  thresholdLabel,
  higherIsBetter = true,
  unit = "%",
  height = 300,
}: Props) {
  const displayCategories = categories.map(fmtUnit);
  const data = values.map((v) => ({
    value: v,
    itemStyle: {
      color: higherIsBetter
        ? v >= threshold
          ? "#22b457"
          : v >= threshold * 0.95
          ? "#f29e0b"
          : "#e23636"
        : v <= threshold
        ? "#22b457"
        : v <= threshold * 1.5
        ? "#f29e0b"
        : "#e23636",
      borderRadius: [4, 4, 0, 0],
    },
  }));

  const option: echarts.EChartsCoreOption = {
    tooltip: {
      trigger: "axis",
      valueFormatter: (v: unknown) => `${Number(v).toFixed(1)}${unit}`,
    },
    grid: { left: 44, right: 16, top: 24, bottom: 72 },
    xAxis: {
      type: "category",
      data: displayCategories,
      axisLabel: { rotate: 38, fontSize: 10, interval: 0 },
    },
    yAxis: {
      type: "value",
      axisLabel: { formatter: `{value}${unit}`, fontSize: 10 },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 28,
        data,
        label: {
          show: true,
          position: "top",
          fontSize: 10,
          formatter: (p: { value: number }) => `${p.value.toFixed(1)}${unit}`,
        },
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: "#111", type: "dashed", width: 1.5 },
          data: [
            {
              yAxis: threshold,
              label: { formatter: thresholdLabel ?? `Seuil ${threshold}${unit}` },
            },
          ],
        },
      },
    ],
  };
  return <EChart option={option} height={height} />;
}
