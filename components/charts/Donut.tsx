"use client";

import EChart from "./EChart";

export default function Donut({
  data,
  height = 260,
  title,
}: {
  data: { name: string; value: number; color?: string }[];
  height?: number;
  title?: string;
}) {
  return (
    <EChart
      height={height}
      option={{
        tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
        legend: { orient: "vertical", left: "left", textStyle: { fontSize: 11 } },
        title: title
          ? { text: title, top: "middle", left: "center", textStyle: { fontSize: 11 } }
          : undefined,
        series: [
          {
            type: "pie",
            radius: ["55%", "80%"],
            avoidLabelOverlap: true,
            itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 2 },
            label: { show: false },
            labelLine: { show: false },
            data: data.map((d) => ({
              name: d.name,
              value: d.value,
              itemStyle: d.color ? { color: d.color } : undefined,
            })),
          },
        ],
      }}
    />
  );
}
