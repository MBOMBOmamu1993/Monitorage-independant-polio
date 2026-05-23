"use client";

import { useMemo } from "react";
import { useAnalytics } from "@/lib/client/api";
import { useFilters } from "@/lib/state/filters";
import { fmtUnit } from "@/lib/client/format";
import { useCascadeOptions } from "@/lib/client/cascade-options";

/**
 * Champ de filtre « étiquette-dans-le-cadre » : label et select sont visuellement
 * fusionnés dans un seul pill compact, style institutionnel.
 */
function Field({
  label,
  value,
  onChange,
  options,
  placeholder = "Tous",
  disabled = false,
  onReset,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  onReset?: () => void;
}) {
  const hasValue = !!value;
  return (
    <div
      className={
        "group flex items-center rounded-md border bg-white h-8 pl-2 pr-1 transition " +
        (hasValue
          ? "border-oms-400 ring-1 ring-oms-100"
          : "border-surface-200 hover:border-surface-300") +
        (disabled ? " opacity-50 pointer-events-none" : "")
      }
    >
      <span className="section-title whitespace-nowrap mr-2">{label}</span>
      <select
        disabled={disabled}
        className="flex-1 min-w-[5rem] max-w-[10rem] bg-transparent text-[12px] text-surface-900 focus:outline-none appearance-none cursor-pointer"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {fmtUnit(o)}
          </option>
        ))}
      </select>
      {hasValue && onReset ? (
        <button
          type="button"
          onClick={onReset}
          title={`Réinitialiser ${label}`}
          className="ml-1 w-4 h-4 shrink-0 flex items-center justify-center text-surface-500 hover:text-danger-600 text-[11px] leading-none"
        >
          ×
        </button>
      ) : (
        <span className="ml-1 w-4 h-4 shrink-0 flex items-center justify-center text-surface-400 text-[9px] leading-none pointer-events-none">▾</span>
      )}
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
  onReset,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  onReset: () => void;
}) {
  const hasValue = !!value;
  return (
    <div
      className={
        "flex items-center rounded-md border bg-white h-8 pl-2 pr-1 transition " +
        (hasValue
          ? "border-oms-400 ring-1 ring-oms-100"
          : "border-surface-200 hover:border-surface-300")
      }
    >
      <span className="section-title whitespace-nowrap mr-2">{label}</span>
      <input
        type="date"
        className="flex-1 min-w-[7rem] max-w-[9rem] bg-transparent text-[12px] text-surface-900 focus:outline-none"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      />
      {hasValue ? (
        <button
          type="button"
          onClick={onReset}
          className="ml-1 w-4 h-4 shrink-0 flex items-center justify-center text-surface-500 hover:text-danger-600 text-[11px] leading-none"
          title="Effacer"
        >
          ×
        </button>
      ) : (
        <span className="ml-1 w-4" />
      )}
    </div>
  );
}

export default function FilterBar() {
  const { data } = useAnalytics();
  const f = useFilters();

  // Cascade dynamique depuis la FactTable : pour chaque filtre, on calcule
  // les valeurs valides en appliquant TOUS les autres filtres actifs.
  // Cela assure qu'en choisissant Province=KENGE + Contexte=Ménage, le
  // dropdown Moniteur ne liste que les moniteurs ayant réellement fait des
  // visites ménage à KENGE.
  const cascade = useCascadeOptions(data?.factTable, f);

  // Source de fallback (server-side) pour la cascade géographique hiérarchique
  // quand la FactTable n'est pas encore chargée.
  const fo = data?.filterOptions;

  // Province : TOUJOURS depuis filterOptions serveur (toutes provinces de la
  // campagne, calculées indépendamment du filtre actif). La cascade FactTable
  // ne connaît que la province actuellement chargée → on l'ignore ici.
  const provinces = useMemo(() => fo?.provinces ?? [], [fo]);

  const antennes = useMemo(() => {
    if (cascade) return Array.from(cascade.antennes).sort((a, b) => a.localeCompare(b));
    if (!fo) return [];
    if (f.province) return fo.antennesByProvince[f.province] ?? [];
    const all = new Set<string>();
    for (const arr of Object.values(fo.antennesByProvince)) arr.forEach((a) => all.add(a));
    return Array.from(all).sort((a, b) => a.localeCompare(b));
  }, [cascade, fo, f.province]);

  const zsList = useMemo(() => {
    if (cascade) return Array.from(cascade.zs).sort((a, b) => a.localeCompare(b));
    if (!fo) return [];
    if (f.antenne) return fo.zsByAntenne[f.antenne] ?? [];
    const all = new Set<string>();
    for (const a of antennes) (fo.zsByAntenne[a] ?? []).forEach((z) => all.add(z));
    return Array.from(all).sort((a, b) => a.localeCompare(b));
  }, [cascade, fo, f.antenne, antennes]);

  const asList = useMemo(() => {
    if (cascade) return Array.from(cascade.as).sort((a, b) => a.localeCompare(b));
    if (!fo) return [];
    if (f.zs) return fo.asByZs[f.zs] ?? [];
    const all = new Set<string>();
    for (const z of zsList) (fo.asByZs[z] ?? []).forEach((a) => all.add(a));
    return Array.from(all).sort((a, b) => a.localeCompare(b));
  }, [cascade, fo, f.zs, zsList]);

  const localities = useMemo(() => {
    if (cascade) return Array.from(cascade.localities).sort((a, b) => a.localeCompare(b));
    if (!fo) return [];
    if (f.as) return fo.localitiesByAs[f.as] ?? [];
    const all = new Set<string>();
    for (const a of asList) (fo.localitiesByAs[a] ?? []).forEach((l) => all.add(l));
    return Array.from(all).sort((a, b) => a.localeCompare(b));
  }, [cascade, fo, f.as, asList]);

  // Contexte : disponible selon tous les autres filtres actifs
  const contextOptions = useMemo(() => ({
    households: cascade ? cascade.contexts.has("households") : (fo?.hasHouseholds ?? false),
    outside: cascade ? cascade.contexts.has("outside") : (fo?.hasOutside ?? false),
  }), [cascade, fo]);

  // Type : disponible selon contexte + profil + moniteur + géo actifs
  const typeOptions = useMemo(() => {
    if (cascade) return {
      InProcess: cascade.types.has("InProcess"),
      EndProcess: cascade.types.has("EndProcess"),
    };
    if (!fo) return { InProcess: false, EndProcess: false };
    if (f.monitorProfile) {
      const available = new Set(fo.typesByProfile[f.monitorProfile] ?? []);
      return { InProcess: available.has("InProcess"), EndProcess: available.has("EndProcess") };
    }
    return { InProcess: fo.hasInProcess, EndProcess: fo.hasEndProcess };
  }, [cascade, fo, f.monitorProfile]);

  // Profils : disponibles selon contexte + type + moniteur + géo actifs
  const profiles = useMemo(() => {
    if (cascade) return Array.from(cascade.profiles).sort((a, b) => a.localeCompare(b));
    if (!fo) return [];
    if (f.monitoringType !== "all") return fo.profilesByType[f.monitoringType] ?? [];
    return fo.profiles;
  }, [cascade, fo, f.monitoringType]);

  // Moniteurs : intersection contexte ∩ type ∩ profil ∩ géo
  const monitors = useMemo(() => {
    if (cascade) return Array.from(cascade.monitors).sort((a, b) => a.localeCompare(b));
    if (!fo) return [];
    const byType = f.monitoringType !== "all" ? new Set(fo.monitorsByType[f.monitoringType] ?? []) : null;
    const byProfile = f.monitorProfile ? new Set(fo.monitorsByProfile[f.monitorProfile] ?? []) : null;
    if (!byType && !byProfile) return fo.allMonitors;
    return fo.allMonitors.filter(
      (m) => (byType === null || byType.has(m)) && (byProfile === null || byProfile.has(m))
    );
  }, [cascade, fo, f.monitoringType, f.monitorProfile]);

  const hasAnyFilter =
    !!f.province ||
    !!f.antenne ||
    !!f.zs ||
    !!f.as ||
    !!f.locality ||
    !!f.minDate ||
    !!f.maxDate ||
    f.context !== "all" ||
    f.monitoringType !== "all" ||
    !!f.monitorProfile ||
    !!f.monitor;

  const contextValues = [
    { value: "all", label: "Ménage + Hors-ménage" },
    ...(contextOptions.households ? [{ value: "households", label: "Ménage" }] : []),
    ...(contextOptions.outside ? [{ value: "outside", label: "Hors-ménage" }] : []),
  ];
  const typeValues = [
    { value: "all", label: "Tous" },
    ...(typeOptions.InProcess ? [{ value: "InProcess", label: "In-process" }] : []),
    ...(typeOptions.EndProcess ? [{ value: "EndProcess", label: "End-process" }] : []),
  ];

  return (
    <div className="bg-white border-b border-surface-200 px-4 md:px-6 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Field label="Province" value={f.province} onChange={f.setProvince} options={provinces} onReset={() => f.setProvince(null)} />
        <Field label="Antenne" value={f.antenne} onChange={f.setAntenne} options={antennes} disabled={antennes.length === 0} onReset={() => f.setAntenne(null)} />
        <Field label="ZS" value={f.zs} onChange={f.setZs} options={zsList} disabled={zsList.length === 0} onReset={() => f.setZs(null)} />
        <Field label="AS" value={f.as} onChange={f.setAs} options={asList} disabled={asList.length === 0} onReset={() => f.setAs(null)} />
        <Field label="Localité" value={f.locality} onChange={f.setLocality} options={localities} disabled={localities.length === 0} onReset={() => f.setLocality(null)} />

        <span className="mx-1 h-5 w-px bg-surface-200" />

        <DateField label="Du" value={f.minDate} onChange={(v) => f.setPeriod(v, f.maxDate)} onReset={() => f.setPeriod(null, f.maxDate)} />
        <DateField label="Au" value={f.maxDate} onChange={(v) => f.setPeriod(f.minDate, v)} onReset={() => f.setPeriod(f.minDate, null)} />

        <span className="mx-1 h-5 w-px bg-surface-200" />

        <Field
          label="Contexte"
          value={f.context === "all" ? null : f.context}
          onChange={(v) => f.setContext((v ?? "all") as typeof f.context)}
          options={contextValues.filter((o) => o.value !== "all").map((o) => o.value)}
          placeholder="Ménage + Hors-ménage"
          onReset={() => f.setContext("all")}
        />
        <Field
          label="Type"
          value={f.monitoringType === "all" ? null : f.monitoringType}
          onChange={(v) => f.setMonitoringType((v ?? "all") as typeof f.monitoringType)}
          options={typeValues.filter((o) => o.value !== "all").map((o) => o.value)}
          placeholder="Tous"
          onReset={() => f.setMonitoringType("all")}
        />
        <Field label="Profil" value={f.monitorProfile} onChange={f.setMonitorProfile} options={profiles} onReset={() => f.setMonitorProfile(null)} />
        <Field label="Moniteur" value={f.monitor} onChange={f.setMonitor} options={monitors} onReset={() => f.setMonitor(null)} />

        <div className="flex-1 min-w-0" />

        {hasAnyFilter ? (
          <button
            onClick={f.reset}
            className="inline-flex items-center gap-1.5 px-3 h-8 text-[12px] rounded-md font-medium transition bg-danger-500 border border-danger-500 text-white hover:bg-danger-600"
            title="Réinitialiser tous les filtres"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Réinitialiser
          </button>
        ) : null}
      </div>
    </div>
  );
}
