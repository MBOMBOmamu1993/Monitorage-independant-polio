"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/client/cn";

export interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  render?: (row: T) => React.ReactNode;
  sortBy?: (row: T) => number | string | null;
  className?: string;
}

export default function RankingTable<T>({
  rows,
  columns,
  defaultSort,
  pageSize = 15,
  maxHeight = 520,
}: {
  rows: T[];
  columns: Column<T>[];
  defaultSort?: { key: string; dir: "asc" | "desc" };
  pageSize?: number;
  maxHeight?: number;
}) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>(
    defaultSort ?? { key: columns[0]?.key ?? "", dir: "desc" }
  );
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortBy) return rows;
    const arr = [...rows].sort((a, b) => {
      const va = col.sortBy!(a);
      const vb = col.sortBy!(b);
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === "number" && typeof vb === "number") return va - vb;
      return String(va).localeCompare(String(vb), "fr");
    });
    if (sort.dir === "desc") arr.reverse();
    return arr;
  }, [rows, columns, sort]);

  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));

  return (
    <div>
      <div className="overflow-auto rounded-md border border-surface-200" style={{ maxHeight }}>
        <table className="table-default">
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th
                  key={c.key}
                  onClick={() =>
                    c.sortBy
                      ? setSort((s) =>
                          s.key === c.key
                            ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" }
                            : { key: c.key, dir: "desc" }
                        )
                      : undefined
                  }
                  className={cn(
                    "px-4 py-3",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                    c.align === "left" && "text-left",
                    !c.align && i === 0 && "text-left",
                    !c.align && i !== 0 && "text-center",
                    c.sortBy && "cursor-pointer select-none"
                  )}
                >
                  {c.label}
                  {c.sortBy && sort.key === c.key ? (
                    <span className="ml-1 text-surface-400">
                      {sort.dir === "asc" ? "▲" : "▼"}
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((r, rowIdx) => (
              <tr key={rowIdx}>
                {columns.map((c, i) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-4 py-3",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      c.align === "left" && "text-left",
                      !c.align && i === 0 && "text-left",
                      !c.align && i !== 0 && "text-center",
                      c.className
                    )}
                  >
                    {c.render ? c.render(r) : ""}
                  </td>
                ))}
              </tr>
            ))}
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center text-surface-700 py-6">
                  Aucune ligne
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {pageCount > 1 ? (
        <div className="flex items-center justify-between py-2 text-xs text-surface-700">
          <span>
            Page {page + 1} / {pageCount} · {sorted.length} lignes
          </span>
          <div className="flex gap-1">
            <button
              className="btn"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              ← Préc.
            </button>
            <button
              className="btn"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
            >
              Suiv. →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
