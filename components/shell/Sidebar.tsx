"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/client/cn";

type IconName =
  | "home" | "droplet" | "syringe" | "alert"
  | "map" | "virus" | "users" | "settings" | "download";

function NavIcon({ name, className = "w-4 h-4" }: { name: IconName; className?: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const paths: Record<IconName, JSX.Element> = {
    home:     (<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></>),
    droplet:  (<path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11Z" />),
    syringe:  (<><path d="m14 3 7 7" /><path d="m10 7 7 7" /><path d="m3 21 9-9" /><path d="m6 18-2 2" /><path d="m15 10 4-4" /></>),
    alert:    (<><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v5" /><circle cx="12" cy="17.5" r=".6" fill="currentColor" /></>),
    map:      (<><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14" /><path d="M15 6v14" /></>),
    virus:    (<><circle cx="12" cy="12" r="4" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.5 5.5l2 2M16.5 16.5l2 2M5.5 18.5l2-2M16.5 7.5l2-2" /></>),
    users:    (<><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5" /><circle cx="17" cy="9" r="2.5" /><path d="M15 20c0-2 2-4 4-4s2 1 2 3" /></>),
    settings: (<><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.5 1.5M16.9 16.9l1.5 1.5M5.6 18.4l1.5-1.5M16.9 7.1l1.5-1.5" /></>),
    download: (<><path d="M12 3v12m0 0-4-4m4 4 4-4" /><path d="M5 19h14" /></>),
  };
  return (
    <svg viewBox="0 0 24 24" className={className} {...common}>
      {paths[name]}
    </svg>
  );
}

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/",             label: "Vue d'ensemble",         icon: "home" },
  { href: "/polio",        label: "Polio (nVPO2 + VPOb)",   icon: "droplet" },
  { href: "/raisons",      label: "Raisons & Refus",        icon: "alert" },
  { href: "/cartes",       label: "Cartographie",           icon: "map" },
  { href: "/surveillance", label: "Surveillance épidémio.", icon: "virus" },
  { href: "/performance",  label: "Performance moniteurs",  icon: "users" },
  { href: "/admin",        label: "Admin & Données brutes", icon: "settings" },
  { href: "/rapport",      label: "Télécharger le rapport", icon: "download" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col bg-oms-500 text-white">
      <div className="px-5 pt-5 pb-4 border-b border-white/15">
        <div className="flex items-center gap-2.5">
          <div className="relative w-10 h-10 shrink-0">
            <Image
              src="/logo/pev-transparent.png"
              alt="PEV RDC"
              fill
              sizes="40px"
              style={{ objectFit: "contain" }}
              priority
            />
          </div>
          <div className="leading-tight">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/75 font-medium">
              Monitorage indépendant
            </div>
            <div className="font-semibold text-[16px] leading-tight tracking-tight">
              Polio
            </div>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-white/70">
          République Démocratique du Congo
        </div>
      </div>
      <nav className="flex-1 py-2">
        {NAV.map((item) => {
          const active = path === item.href || (item.href !== "/" && path.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-5 py-2 text-[13px] leading-6 transition border-l-2",
                active
                  ? "bg-white/[0.14] text-white border-white"
                  : "text-white/80 border-transparent hover:bg-white/[0.08] hover:text-white"
              )}
            >
              <NavIcon name={item.icon} className="w-[16px] h-[16px] shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-3 text-[10px] uppercase tracking-wider text-white/70 border-t border-white/15">
        <div>Campagne intégrée 2026</div>
        <div className="mt-0.5 normal-case tracking-normal text-white/55">
          Données ODK · actualisation automatique
        </div>
      </div>
    </aside>
  );
}
