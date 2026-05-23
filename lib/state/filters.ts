"use client";

import { create } from "zustand";
import { DEFAULT_DASHBOARD_PROVINCE } from "@/config/provinces";

export type MonitoringContextFilter = "all" | "households" | "outside";

export interface FiltersState {
  province: string | null;
  antenne: string | null;
  zs: string | null;
  as: string | null;
  locality: string | null;
  minDate: string | null;
  maxDate: string | null;
  monitoringType: "all" | "InProcess" | "EndProcess";
  monitorProfile: string | null;
  monitor: string | null;
  context: MonitoringContextFilter;
  restrictToCampaign: boolean;
}

export interface FiltersActions {
  setProvince: (v: string | null) => void;
  setAntenne: (v: string | null) => void;
  setZs: (v: string | null) => void;
  setAs: (v: string | null) => void;
  setLocality: (v: string | null) => void;
  setPeriod: (min: string | null, max: string | null) => void;
  setMonitoringType: (v: FiltersState["monitoringType"]) => void;
  setMonitorProfile: (v: string | null) => void;
  setMonitor: (v: string | null) => void;
  setContext: (v: MonitoringContextFilter) => void;
  setRestrictToCampaign: (v: boolean) => void;
  reset: () => void;
  patch: (partial: Partial<FiltersState>) => void;
}

const INITIAL: FiltersState = {
  province: DEFAULT_DASHBOARD_PROVINCE,
  antenne: null,
  zs: null,
  as: null,
  locality: null,
  minDate: null,
  maxDate: null,
  monitoringType: "all",
  monitorProfile: null,
  monitor: null,
  context: "all",
  restrictToCampaign: true,
};

export const useFilters = create<FiltersState & FiltersActions>((set) => ({
  ...INITIAL,
  setProvince: (v) =>
    set(() => ({
      province: v ?? DEFAULT_DASHBOARD_PROVINCE,
      antenne: null,
      zs: null,
      as: null,
      locality: null,
    })),
  setAntenne: (v) => set(() => ({ antenne: v, zs: null, as: null, locality: null })),
  setZs: (v) => set(() => ({ zs: v, as: null, locality: null })),
  setAs: (v) => set(() => ({ as: v, locality: null })),
  setLocality: (v) => set(() => ({ locality: v })),
  setPeriod: (minDate, maxDate) => set(() => ({ minDate, maxDate })),
  setMonitoringType: (v) => set(() => ({ monitoringType: v })),
  setMonitorProfile: (v) => set(() => ({ monitorProfile: v, monitor: null })),
  setMonitor: (v) => set(() => ({ monitor: v })),
  setContext: (v) => set(() => ({ context: v })),
  setRestrictToCampaign: (v) => set(() => ({ restrictToCampaign: v })),
  reset: () => set(() => ({ ...INITIAL })),
  patch: (partial) => set((s) => ({ ...s, ...partial })),
}));

export function filtersToQuery(f: FiltersState): string {
  const p = new URLSearchParams();
  p.set("restrict", f.restrictToCampaign ? "1" : "0");
  p.set("province", f.province || DEFAULT_DASHBOARD_PROVINCE);
  return `?${p.toString()}`;
}
