"use client";

/**
 * Combo bar (count) + line (%) avec marqueur de seuil OMS.
 * Inspiré PowerBI : "Nombre et % enfants non vaccinés par province".
 */
import EChart from "./EChart";
import type * as echarts from "echarts/core";
import { fmtUnit } from "@/lib/client/format";

interface Props {
  categories: string[];
  counts: number[];
  pcts: number[];
  threshold?: number;
  countLabel?: string;
  pctLabel?: string;
  colorBar?: string;
  colorLine?: string;
  height?: number;
}

export default function ComboBarLine({
  categories,
  counts,
  pcts,
  threshold = 5,
  countLabel = "Nombre",
  pctLabel = "% non vaccinés",
  colorBar = "#0093d5",
  colorLine = "#e23636",
  height = 320,
}: Props) {
  const displayCategories = categories.map(fmtUnit);
  const option: echarts.EChartsCoreOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
    legend: { top: 0, right: 10, textStyle: { fontSize: 11 } },
    grid: { left: 44, right: 44, top: 30, bottom: 80 },
    xAxis: {
      type: "category",
      data: displayCategories,
      axisLabel: { rotate: 38, fontSize: 10, interval: 0 },
    },
    yAxis: [
      { type: "value", name: countLabel, nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 } },
      {
        type: "value",
        name: pctLabel,
        nameTextStyle: { fontSize: 10 },
        axisLabel: { fontSize: 10, formatter: "{value}%" },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: countLabel,
        type: "bar",
        data: counts,
        itemStyle: { color: colorBar, borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 28,
      },
      {
        name: pctLabel,
        type: "line",
        yAxisIndex: 1,
        data: pcts,
        smooth: true,
        symbol: "circle",
        symbolSize: 7,
        lineStyle: { color: colorLine, width: 2.5 },
        itemStyle: { color: colorLine },
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: colorLine, type: "dashed", opacity: 0.6 },
          data: [{ yAxis: threshold, label: { formatter: `Seuil ${threshold}%` } }],
        },
      },
    ],
  };
  return <EChart option={option} height={height} />;
}
