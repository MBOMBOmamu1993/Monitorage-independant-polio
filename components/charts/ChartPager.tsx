"use client";

export default function ChartPager({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  const start = page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-surface-700">
      <span>
        Page {page + 1} / {pageCount} - {start}-{end} / {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn"
          onClick={() => onPageChange(Math.max(0, page - 1))}
          disabled={page === 0}
        >
          Precedent
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
          disabled={page >= pageCount - 1}
        >
          Suivant
        </button>
      </div>
    </div>
  );
}

