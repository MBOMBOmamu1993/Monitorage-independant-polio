export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 pb-3 border-b border-surface-200 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-surface-700 font-semibold">
          <span>Campagne Polio</span>
          <span className="text-surface-300">/</span>
          <span className="text-oms-600">{title}</span>
        </div>
        <h1 className="mt-1 text-[20px] md:text-[22px] font-semibold text-surface-900 leading-tight tracking-tight">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-[12.5px] text-surface-700 mt-0.5">{subtitle}</p>
        ) : null}
      </div>
      {right ? <div className="flex items-center gap-2 shrink-0">{right}</div> : null}
    </div>
  );
}
