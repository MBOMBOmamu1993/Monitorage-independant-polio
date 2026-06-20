"use client";

import { useEffect, useMemo, useState } from "react";
import EChart from "./EChart";
import ChartPager from "./ChartPager";
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
  pageSize = 12,
}: {
  categories: string[];
  series: BarStackedSeries[];
  height?: number;
  horizontal?: boolean;
  stack?: string | false;
  valueFormat?: (v: number) => string;
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
  const catAxis = { type: "category" as const, data: displayCategories, axisTick: { show: false } };
  const valAxis = { type: "value" as const, axisLabel: { formatter: (v: number) => valueFormat(v) } };

  return (
    <>
    <EChart
      height={height}
      option={{
        grid: { left: 10, right: 16, top: 30, bottom: 20, containLabel: true },
        legend: { top: 0, type: "scroll", textStyle: { fontSize: 11 } },
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
        xAxis: horizontal ? valAxis : catAxis,
        yAxis: horizontal ? catAxis : valAxis,
        series: pageSeries.map((s) => ({
          name: s.name,
          type: "bar",
          stack: stack || undefined,
          data: s.data,
          itemStyle: s.color ? { color: s.color } : undefined,
          barMaxWidth: 28,
        })),
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
