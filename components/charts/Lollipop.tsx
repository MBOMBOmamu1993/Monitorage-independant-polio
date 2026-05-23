"use client";

import EChart from "./EChart";

export default function Lollipop({
  items,
  valueFormat = (v: number) => v.toFixed(1) + "%",
  height = 320,
  threshold = 95,
}: {
  items: { label: string; value: number }[];
  valueFormat?: (v: number) => string;
  height?: number;
  threshold?: number;
}) {
  const categories = items.map((i) => i.label);
  const values = items.map((i) => i.value);

  return (
    <EChart
      height={height}
      option={{
        grid: { left: 10, right: 20, top: 20, bottom: 20, containLabel: true },
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "line" },
          valueFormatter: (v: unknown) => valueFormat(Number(v)),
        },
        xAxis: {
          type: "value",
          min: 0,
          max: Math.max(100, ...values),
          axisLabel: { formatter: (v: number) => valueFormat(v) },
        },
        yAxis: { type: "category", data: categories, axisTick: { show: false } },
        series: [
          {
            type: "bar",
            data: values,
            barWidth: 2,
            itemStyle: { color: "#cbd5e1" },
            z: 1,
          },
          {
            type: "scatter",
            symbolSize: 14,
            data: values.map((v) => ({
              value: v,
              itemStyle: {
                color:
                  v >= threshold ? "#22b457" : v >= threshold - 5 ? "#f29e0b" : "#e23636",
              },
            })),
            z: 2,
            label: {
              show: true,
              position: "right",
              formatter: (p: { value: number }) => valueFormat(p.value),
              fontSize: 11,
            },
          },
          {
            type: "line",
            markLine: {
              silent: true,
              symbol: "none",
              data: [
                {
                  xAxis: threshold,
                  label: { formatter: `Seuil ${threshold}%`, position: "end" },
                  lineStyle: { color: "#16a34a", type: "dashed" },
                },
              ],
            },
            data: [],
          },
        ],
      }}
    />
  );
}
