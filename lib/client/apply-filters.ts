/**
 * Application des filtres (cascade géo + profil moniteur + contexte + type)
 * sur le bundle Analytics renvoyé par l'API.
 *
 * Contrainte : Next renvoie un bundle déjà filtré par date/province,
 * on complète ici côté client le filtrage fin (Antenne/ZS/AS/Localité/…).
 */
import type { AnalyticsBundle, CleanSubmission, ChildRecord } from "@/lib/types/domain";
import type { FiltersState } from "@/lib/state/filters";

export interface FilteredView {
  submissions: CleanSubmission[];
  children: ChildRecord[];
}

export function applyFiltersToBundle(
  bundle: AnalyticsBundle | undefined,
  f: FiltersState
): FilteredView {
  if (!bundle) return { submissions: [], children: [] };
  let subs = bundle.submissions;

  if (f.context === "households") subs = subs.filter((s) => s.form === "households");
  if (f.context === "outside") subs = subs.filter((s) => s.form === "outside");

  if (f.province) subs = subs.filter((s) => s.orgUnit.province === f.province);
  if (f.antenne) subs = subs.filter((s) => s.orgUnit.antenne === f.antenne);
  if (f.zs) subs = subs.filter((s) => s.orgUnit.zs === f.zs);
  if (f.as) subs = subs.filter((s) => s.orgUnit.as === f.as);
  if (f.locality) subs = subs.filter((s) => s.orgUnit.locality === f.locality);

  // Filtrage par date — côté client pour UX instantanée
  if (f.minDate) {
    subs = subs.filter((s) => {
      const d = s.monitoringDate ?? s.submissionTime.slice(0, 10);
      return d >= f.minDate!;
    });
  }
  if (f.maxDate) {
    subs = subs.filter((s) => {
      const d = s.monitoringDate ?? s.submissionTime.slice(0, 10);
      return d <= f.maxDate!;
    });
  }

  if (f.monitoringType !== "all")
    subs = subs.filter((s) => s.monitoringType === f.monitoringType);

  if (f.monitorProfile) subs = subs.filter((s) => s.monitorProfile === f.monitorProfile);
  if (f.monitor) subs = subs.filter((s) => s.monitorName === f.monitor);

  const ids = new Set(subs.map((s) => s.id));
  const children = bundle.children.filter((c) => ids.has(c.submissionId));
  return { submissions: subs, children };
}
