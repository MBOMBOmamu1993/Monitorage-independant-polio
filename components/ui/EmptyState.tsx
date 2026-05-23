export function EmptyState({
  title = "Aucune donnée pour ces filtres",
  hint,
}: {
  title?: string;
  hint?: string;
}) {
  return (
    <div className="border border-dashed border-surface-300 rounded-xl p-8 text-center">
      <div className="text-3xl mb-2">🌀</div>
      <div className="font-medium text-surface-800">{title}</div>
      {hint ? <div className="text-sm text-surface-700 mt-1">{hint}</div> : null}
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="border border-dashed border-surface-300 rounded-xl p-8 text-center animate-pulse text-surface-700 text-sm">
      Chargement des données ODK…
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="border border-danger-500/40 bg-danger-50 rounded-xl p-4 text-sm text-danger-700">
      <div className="font-semibold mb-1">Erreur</div>
      <div>{message}</div>
    </div>
  );
}
