"use client";

import EChart from "./EChart";

export default function Heatmap({
  xs,
  ys,
  values,
  height = 340,
  minColor = "#e6f5fc",
  maxColor = "#005a82",
}: {
  xs: string[];
  ys: string[];
  values: [number, number, number][]; // [xIdx, yIdx, value]
  height?: number;
  minColor?: string;
  maxColor?: string;
}) {
  const max = Math.max(1, ...values.map((v) => v[2]));
  return (
    <EChart
      height={height}
      option={{
        grid: { left: 10, right: 20, top: 10, bottom: 60, containLabel: true },
        tooltip: { position: "top" },
        xAxis: {
          type: "category",
          data: xs,
          splitArea: { show: true },
          axisLabel: { rotate: 45, fontSize: 10 },
        },
        yAxis: { type: "category", data: ys, splitArea: { show: true } },
        visualMap: {
          min: 0,
          max,
          calculable: true,
          orient: "horizontal",
          left: "center",
          bottom: 0,
          inRange: { color: [minColor, maxColor] },
          textStyle: { fontSize: 10 },
        },
        series: [
          {
            type: "heatmap",
            data: values,
            label: { show: false },
          },
        ],
      }}
    />
  );
}
