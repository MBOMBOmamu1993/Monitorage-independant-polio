/**
 * Export PowerPoint — Rapport RR-Polio (Variante C Magazine).
 *
 * Reproduit fidèlement l'aperçu HTML :
 *  - 16:9 widescreen (13.333 × 7.5 in)
 *  - Couleurs OMS (#0093D5) + logo OMS sur chaque slide
 *  - 13 slides : cover magazine, plan, vue d'ensemble 8-KPI,
 *    Polio M/HM/Global, Top AS hbars, Raisons Polio (stacked absolue),
 *    Refus Polio, RR (KPI + hbars + jauge), Raisons RR, Refus RR,
 *    Tableau nesté AS→Localités paginé, Défis, Recommandations.
 *  - Pas de `addChart` : tout est rendu en shapes natifs (text, rect,
 *    roundRect, ellipse) afin d'être 100 % fidèle à l'aperçu et
 *    100 % éditable dans PowerPoint.
 */

import { OMS_LOGO_DATA_URL } from "./oms-logo";
import { fmtUnit } from "./format";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SlideSeriesData {
  units: string[];
  series: { name: string; data: number[]; color?: string }[];
}

export interface KpiData {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "warn" | "bad" | "neutral" | "brand";
  /** Émoji ou glyphe court à afficher dans la pastille (ex: "👶", "💉", "✓"). */
  icon?: string;
}

export interface SynthLocalityRow {
  locality: string;
  evaluatedPolio: number;
  evaluatedRR?: number;
  polioNotVax: number;
  rrNotVax?: number;
}

export interface SynthASGroup {
  as: string;
  evaluatedPolio: number;
  evaluatedRR?: number;
  polioNotVax: number;
  rrNotVax?: number;
  localities: SynthLocalityRow[];
}

/** Données détaillées du volet Ménage (slide 4). */
export interface PolioSplitData {
  householdEval: number;
  householdVac: number;
  outsideEval: number;
  outsideVac: number;
}

/** Série horizontale simple (valeurs absolues) pour les hbars. */
export interface HBarSeries {
  label: string;
  value: number;
}

export interface ReportInput {
  title: string;
  period: string;
  orgUnit: string;
  levelLabel: string;
  levelName: string;
  drillLevel: "province" | "antenne" | "zs" | "as" | "locality";

  /** KPI de la vue d'ensemble (slide 3). */
  kpisOverview: KpiData[];
  /** KPI RR détaillés (slide 8). Optionnel — campagne Polio seule. */
  kpisRR?: KpiData[];

  /** Données Polio pour slide 4 (Ménage / Hors-ménage / Global). */
  polioSplit: PolioSplitData;

  /** Top AS non-vaccination Polio (slide 5 — hbars). */
  topNonVaxPolio: HBarSeries[];

  /** Raisons non-vax Polio (slide 6 — stacked absolue). */
  polioReasons: SlideSeriesData;
  /** Refus & absences Polio (slide 7 — stacked absolue). */
  polioRefusals: SlideSeriesData;

  /** Couverture RR par AS (slide 8 — hbars en % 0-100). Optionnel — Polio seule. */
  rrCoverageByUnit?: HBarSeries[];

  /** Raisons non-vax RR (slide 9 — stacked absolue). Optionnel — Polio seule. */
  rrReasons?: SlideSeriesData;
  /** Refus & absences RR (slide 10 — stacked absolue). Optionnel — Polio seule. */
  rrRefusals?: SlideSeriesData;

  /** Tableau synth (flat, pour niveaux autres que ZS). */
  synthTable: {
    orgUnit: string;
    evaluatedPolio: number;
    evaluatedRR?: number;
    polioNotVax: number;
    rrNotVax?: number;
  }[];

  /** Tableau synth nesté AS → localités (uniquement ZS). */
  synthTableNested?: SynthASGroup[];

  /** Défis & recommandations générés par la page. */
  defis?: string[];
  recommandations?: string[];

  /** Étiquette du niveau des unités affichées dans les hbars / raisons / tableau flat.
   * Si absent, fallback sur "Aire de Santé / Aires de Santé". */
  drillUnitSingular?: string;
  drillUnitPlural?: string;
}

// ─── Design tokens (OMS) ──────────────────────────────────────────────────────

const BRAND = "0093D5";
const BRAND_DARK = "00689D";
const BRAND_DARKER = "003F66";
const BRAND_LIGHT = "E6F4FB";
const BRAND_MID = "4FB3DE";
const INK = "1A2332";
const INK_SOFT = "4A5568";
const MUTED = "8896A6";
const PAPER = "FFFFFF";
const PAPER_TINT = "F7FAFC";
const RULE = "D9E6EF";
const GREEN = "2BA84A";
const RED = "D8312C";
const AMBER = "E8A33D";
// Heat-map tableau
const HOT_LO = "FFE9B0";
const HOT_MID = "FFB570";
const HOT_HI = "F47361";
const HOT_MAX = "C8362F";
// Palette dashboard — raisons Polio (slide 6)
const C_REFUS = "D8312C";
const C_ABSENT = "E8A33D";
const C_NOAGENT = "5F72D6";
const C_ENDORMI = "36B3DD";
const C_HFLOIN = "C55A9F";
const C_DEJA = "2BA84A";
const C_AUTRE = "B8B9B5";
// Palette dashboard — refus Polio (slide 7)
const C_RELIGION = "D8306C";
const C_EFFETS = "7A1230";
const C_TROP = "AF2353";
const C_MALADE = "C4486A";
const C_PASDEC = "F2B7C5";
const C_RUMEUR = "D8306C";
const C_OTHER_LIGHT = "F8D3D8";
// Palette dashboard — raisons RR (slide 9-10)
const C_AUTRE_DEUIL = "1B2F82";
const C_PEUR = "2B6AE6";
const C_VACABS = "D8312C";
const C_MOMENT = "5F9BE6";
const C_NONDISP = "EC6868";
const C_CONF = "7FB8E8";

const FONT = "Calibri";
const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

/** Retourne les étiquettes (singulier/pluriel) pour le niveau des unités
 * effectivement affichées dans les hbars, stacks et tableau plat. Fallback
 * sur "Aire de Santé" si `drillUnitSingular`/`drillUnitPlural` ne sont pas fournis. */
function unitLabels(input: ReportInput): { singular: string; plural: string } {
  const singular = input.drillUnitSingular ?? "Aire de Santé";
  const plural = input.drillUnitPlural ?? "Aires de Santé";
  return { singular, plural };
}

// ─── Chrome (header / footer) ─────────────────────────────────────────────────

function addHeader(slide: any, title: string, subtitle?: string) {
  // Bannière bleue
  slide.addShape("rect" as any, {
    x: 0, y: 0, w: SLIDE_W, h: 0.95,
    fill: { color: BRAND }, line: { color: BRAND },
  });
  // Liseré foncé
  slide.addShape("rect" as any, {
    x: 0, y: 0.95, w: SLIDE_W, h: 0.06,
    fill: { color: BRAND_DARK }, line: { color: BRAND_DARK },
  });
  // Logo OMS (blanc/inversé — fourni déjà en version light dans oms-logo.ts)
  try {
    slide.addImage({
      data: OMS_LOGO_DATA_URL,
      x: 0.35, y: 0.18, w: 1.6, h: 0.6,
    });
  } catch { /* ignore */ }

  slide.addText(title, {
    x: 2.2, y: 0.05, w: SLIDE_W - 4.4, h: 0.55,
    fontFace: FONT, fontSize: 22, bold: true, color: PAPER,
    align: "center", valign: "middle",
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 2.2, y: 0.55, w: SLIDE_W - 4.4, h: 0.4,
      fontFace: FONT, fontSize: 12, color: "D8ECF7",
      align: "center", valign: "middle", italic: true,
    });
  }
  slide.addText("MONITORAGE INDÉPENDANT\nPOLIO · RDC", {
    x: SLIDE_W - 3.4, y: 0.15, w: 3.0, h: 0.7,
    fontFace: FONT, fontSize: 9, color: "B5DCEF", bold: true,
    align: "right", valign: "middle", charSpacing: 2,
  });
}

function addFooter(slide: any, pageNum: number, levelLabel: string, levelName: string) {
  slide.addShape("line" as any, {
    x: 0.5, y: SLIDE_H - 0.45, w: SLIDE_W - 1.0, h: 0,
    line: { color: RULE, pt: 0.75 },
  });
  slide.addText(
    [
      { text: "Monitorage indépendant Polio  ·  RDC  ·  ", options: { color: MUTED } },
      { text: `${levelLabel} : ${levelName}`, options: { color: BRAND_DARK, bold: true } },
    ],
    {
      x: 0.5, y: SLIDE_H - 0.4, w: SLIDE_W - 2.0, h: 0.3,
      fontFace: FONT, fontSize: 10, valign: "middle",
    }
  );
  slide.addText(`Page ${pageNum}`, {
    x: SLIDE_W - 1.5, y: SLIDE_H - 0.4, w: 1.0, h: 0.3,
    fontFace: FONT, fontSize: 10, color: MUTED, align: "right", valign: "middle",
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toneColor(tone?: KpiData["tone"]): string {
  switch (tone) {
    case "good": return GREEN;
    case "warn": return AMBER;
    case "bad": return RED;
    case "brand": return BRAND;
    default: return BRAND_DARKER;
  }
}

function fmt(n: number): string {
  return n.toLocaleString("fr-FR").replace(/,/g, " ");
}

function pct(num: number, den: number): string {
  if (!den) return "—";
  return ((num * 100) / den).toFixed(1).replace(".", ",") + "%";
}

function heatLevel(value: number, maxRef: number): string | undefined {
  if (!maxRef || value <= 0) return undefined;
  const ratio = value / maxRef;
  if (ratio >= 0.75) return HOT_MAX;
  if (ratio >= 0.5) return HOT_HI;
  if (ratio >= 0.25) return HOT_MID;
  if (ratio >= 0.1) return HOT_LO;
  return undefined;
}

function interp(slide: any, text: string, y: number) {
  slide.addShape("roundRect" as any, {
    x: 0.6, y, w: SLIDE_W - 1.2, h: 0.55,
    fill: { color: BRAND_LIGHT }, line: { color: BRAND, pt: 0.75 },
    rectRadius: 0.05,
  });
  slide.addText(text, {
    x: 0.8, y, w: SLIDE_W - 1.6, h: 0.55,
    fontFace: FONT, fontSize: 12, color: BRAND_DARK, italic: true,
    align: "center", valign: "middle",
  });
}

// ─── Cover (magazine) ─────────────────────────────────────────────────────────

function addCoverSlide(slide: any, input: ReportInput) {
  // Fond bleu marine
  slide.background = { color: BRAND_DARKER };
  // Deux cercles radiaux approximés par des ellipses translucides
  slide.addShape("ellipse" as any, {
    x: SLIDE_W - 4.5, y: -3.0, w: 7.0, h: 7.0,
    fill: { color: BRAND, transparency: 60 }, line: { type: "none" },
  });
  slide.addShape("ellipse" as any, {
    x: -2.5, y: SLIDE_H - 3.0, w: 5.5, h: 5.5,
    fill: { color: BRAND_MID, transparency: 70 }, line: { type: "none" },
  });

  // Logo OMS en carte blanche
  slide.addShape("roundRect" as any, {
    x: 0.7, y: 0.6, w: 2.4, h: 1.1,
    fill: { color: PAPER }, line: { color: PAPER },
    rectRadius: 0.12,
  });
  try {
    slide.addImage({
      data: OMS_LOGO_DATA_URL,
      x: 0.9, y: 0.75, w: 2.0, h: 0.8,
    });
  } catch { /* ignore */ }

  // Grand "2026" semi-transparent
  const year = new Date().getFullYear();
  slide.addText(String(year), {
    x: 0, y: 1.6, w: SLIDE_W, h: 1.9,
    fontFace: "Georgia", fontSize: 140, color: BRAND_MID, transparency: 65,
    align: "center", valign: "middle",
  });

  // Titre
  slide.addText("MONITORAGE INDÉPENDANT POLIO", {
    x: 0.5, y: 2.9, w: SLIDE_W - 1.0, h: 1.0,
    fontFace: FONT, fontSize: 40, bold: true, color: PAPER,
    align: "center", valign: "middle", charSpacing: -1,
  });
  slide.addText("République Démocratique du Congo", {
    x: 0.5, y: 3.95, w: SLIDE_W - 1.0, h: 0.55,
    fontFace: FONT, fontSize: 20, italic: true, color: "B5DCEF",
    align: "center", valign: "middle",
  });

  // Séparateur
  slide.addShape("rect" as any, {
    x: 0.8, y: 5.6, w: SLIDE_W - 1.6, h: 0.03,
    fill: { color: PAPER, transparency: 70 }, line: { type: "none" },
  });

  // Meta-grid 3 colonnes
  const today = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
  });
  const cols = [
    { lbl: "NIVEAU", val: `${input.levelLabel} : ${input.levelName}` },
    { lbl: "PÉRIODE", val: input.period },
    { lbl: "GÉNÉRÉ LE", val: today },
  ];
  const colW = (SLIDE_W - 1.6) / 3;
  cols.forEach((c, i) => {
    const x = 0.8 + i * colW;
    slide.addText(c.lbl, {
      x, y: 5.8, w: colW, h: 0.3,
      fontFace: FONT, fontSize: 10, color: "B5DCEF", bold: true,
      align: "left", valign: "middle", charSpacing: 4,
    });
    slide.addText(c.val, {
      x, y: 6.12, w: colW, h: 0.45,
      fontFace: FONT, fontSize: 15, bold: true, color: PAPER,
      align: "left", valign: "middle",
    });
  });
}

// ─── Plan ─────────────────────────────────────────────────────────────────────

function addPlanSlide(slide: any, labels: { singular: string; plural: string }) {
  const items = [
    "Vue d'ensemble — Indicateurs clés",
    "Vaccination Polio — Ménage, Hors-ménage & Global",
    `Top ${labels.plural} · Non vaccination Polio`,
    "Raisons de non vaccination Polio",
    "Raisons de refus & absences Polio",
    "Tableau synthétique multi-niveaux",
    "Défis identifiés",
    "Points d'action — Recommandations",
  ];
  const cols = 2;
  const rows = Math.ceil(items.length / cols);
  const gapX = 0.25;
  const gapY = 0.15;
  const marginX = 1.4;
  const itemW = (SLIDE_W - marginX * 2 - gapX) / cols;
  const itemH = 0.55;
  const totalH = rows * itemH + (rows - 1) * gapY;
  const yStart = 1.2 + (SLIDE_H - 1.2 - 0.55 - totalH) / 2;

  items.forEach((t, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = marginX + c * (itemW + gapX);
    const y = yStart + r * (itemH + gapY);
    slide.addShape("roundRect" as any, {
      x, y, w: itemW, h: itemH,
      fill: { color: PAPER_TINT }, line: { color: RULE, pt: 0.75 },
      rectRadius: 0.06,
    });
    // Badge
    slide.addShape("ellipse" as any, {
      x: x + 0.15, y: y + 0.12, w: 0.32, h: 0.32,
      fill: { color: BRAND }, line: { color: BRAND },
    });
    slide.addText(String(i + 1), {
      x: x + 0.15, y: y + 0.12, w: 0.32, h: 0.32,
      fontFace: FONT, fontSize: 12, bold: true, color: PAPER,
      align: "center", valign: "middle",
    });
    slide.addText(t, {
      x: x + 0.6, y, w: itemW - 0.75, h: itemH,
      fontFace: FONT, fontSize: 13, color: INK, valign: "middle",
    });
  });
}

// ─── KPI dashboard (horizontal cards with icon bubble) ────────────────────────

function addKpiDashboard(
  slide: any, kpis: KpiData[], yStart: number, hAvail: number, cols: number = 4
) {
  if (!kpis.length) return;
  const rows = Math.ceil(kpis.length / cols);
  const gap = 0.18;
  const margin = 0.55;
  const cardW = (SLIDE_W - margin * 2 - gap * (cols - 1)) / cols;
  const cardH = Math.min(1.3, (hAvail - gap * (rows - 1)) / rows);

  kpis.forEach((kpi, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = margin + c * (cardW + gap);
    const y = yStart + r * (cardH + gap);
    const accent = toneColor(kpi.tone);

    slide.addShape("roundRect" as any, {
      x, y, w: cardW, h: cardH,
      fill: { color: PAPER }, line: { color: RULE, pt: 1 },
      rectRadius: 0.1,
    });
    // Icon bubble
    const bubbleD = 0.55;
    slide.addShape("ellipse" as any, {
      x: x + 0.22, y: y + (cardH - bubbleD) / 2, w: bubbleD, h: bubbleD,
      fill: { color: accent }, line: { color: accent },
    });
    slide.addText(kpi.icon ?? "•", {
      x: x + 0.22, y: y + (cardH - bubbleD) / 2, w: bubbleD, h: bubbleD,
      fontFace: FONT, fontSize: 18, bold: true, color: PAPER,
      align: "center", valign: "middle",
    });
    // Value
    slide.addText(kpi.value, {
      x: x + 0.85, y: y + 0.15, w: cardW - 1.0, h: 0.5,
      fontFace: FONT, fontSize: 22, bold: true, color: INK,
      align: "left", valign: "middle",
    });
    // Label
    slide.addText(kpi.label, {
      x: x + 0.85, y: y + 0.6, w: cardW - 1.0, h: 0.35,
      fontFace: FONT, fontSize: 10, color: INK_SOFT, bold: true,
      align: "left", valign: "middle", charSpacing: 1,
    });
    if (kpi.sub) {
      slide.addText(kpi.sub, {
        x: x + 0.85, y: y + 0.9, w: cardW - 1.0, h: 0.3,
        fontFace: FONT, fontSize: 9, color: MUTED, italic: true,
        align: "left", valign: "middle",
      });
    }
  });
}

// ─── Slide 4 — Polio Ménage/Hors-ménage/Global ────────────────────────────────

function addPolioSplitSlide(slide: any, split: PolioSplitData) {
  const mNotVax = split.householdEval - split.householdVac;
  const hmNotVax = split.outsideEval - split.outsideVac;
  const mPctNotVax = split.householdEval ? (mNotVax * 100) / split.householdEval : 0;
  const hmPctNotVax = split.outsideEval ? (hmNotVax * 100) / split.outsideEval : 0;
  const mCv = split.householdEval ? (split.householdVac * 100) / split.householdEval : 0;
  const hmCv = split.outsideEval ? (split.outsideVac * 100) / split.outsideEval : 0;
  const totalEval = split.householdEval + split.outsideEval;
  const totalVac = split.householdVac + split.outsideVac;
  const gCv = totalEval ? (totalVac * 100) / totalEval : 0;

  // Deux panneaux côte à côte (Ménage / Hors-ménage)
  const panelY = 1.2;
  const panelH = 3.0;
  const panelW = (SLIDE_W - 1.2 - 0.25) / 2;

  function drawPanel(
    x: number, variant: "m" | "hm",
    heading: string, sub: string,
    cvLabel: string,
    cvColor: string,
    tiles: Array<{ lbl: string; val: string; tone?: "good" | "bad" | "neutral" }>,
    accentColor: string,
  ) {
    slide.addShape("roundRect" as any, {
      x, y: panelY, w: panelW, h: panelH,
      fill: { color: PAPER }, line: { color: RULE, pt: 1 },
      rectRadius: 0.12,
    });
    // Bande accent gauche
    slide.addShape("rect" as any, {
      x, y: panelY, w: 0.12, h: panelH,
      fill: { color: accentColor }, line: { color: accentColor },
    });
    // Titre + sous-titre + chip
    slide.addText(heading, {
      x: x + 0.3, y: panelY + 0.18, w: panelW - 2.2, h: 0.4,
      fontFace: FONT, fontSize: 15, bold: true, color: INK,
      align: "left", valign: "middle",
    });
    slide.addText(sub, {
      x: x + 0.3, y: panelY + 0.55, w: panelW - 2.2, h: 0.3,
      fontFace: FONT, fontSize: 10, color: INK_SOFT, italic: true,
      align: "left", valign: "middle",
    });
    // Chip CV
    const chipW = 1.6;
    slide.addShape("roundRect" as any, {
      x: x + panelW - chipW - 0.2, y: panelY + 0.2, w: chipW, h: 0.4,
      fill: { color: cvColor }, line: { color: cvColor },
      rectRadius: 0.2,
    });
    slide.addText(cvLabel, {
      x: x + panelW - chipW - 0.2, y: panelY + 0.2, w: chipW, h: 0.4,
      fontFace: FONT, fontSize: 12, bold: true, color: PAPER,
      align: "center", valign: "middle",
    });
    // 4 tuiles
    const tileGap = 0.1;
    const tileW = (panelW - 0.45 - tileGap) / 2;
    const tileH = 0.9;
    const tileYStart = panelY + 1.05;
    tiles.forEach((t, i) => {
      const r = Math.floor(i / 2);
      const col = i % 2;
      const tx = x + 0.3 + col * (tileW + tileGap);
      const ty = tileYStart + r * (tileH + tileGap);
      slide.addShape("roundRect" as any, {
        x: tx, y: ty, w: tileW, h: tileH,
        fill: { color: PAPER_TINT }, line: { color: RULE, pt: 0.5 },
        rectRadius: 0.06,
      });
      const accent = t.tone === "good" ? GREEN : t.tone === "bad" ? RED : RULE;
      slide.addShape("rect" as any, {
        x: tx, y: ty, w: 0.08, h: tileH,
        fill: { color: accent }, line: { color: accent },
      });
      slide.addText(t.lbl, {
        x: tx + 0.2, y: ty + 0.05, w: tileW - 0.25, h: 0.3,
        fontFace: FONT, fontSize: 9, color: INK_SOFT, bold: true,
        align: "left", valign: "middle", charSpacing: 1,
      });
      const valColor = t.tone === "good" ? GREEN : t.tone === "bad" ? RED : INK;
      slide.addText(t.val, {
        x: tx + 0.2, y: ty + 0.32, w: tileW - 0.25, h: 0.55,
        fontFace: FONT, fontSize: 20, bold: true, color: valColor,
        align: "left", valign: "middle",
      });
    });
  }

  drawPanel(
    0.6, "m",
    "Volet Ménage (M)",
    "Enfants trouvés à domicile lors du monitorage",
    `CV ${mCv.toFixed(1).replace(".", ",")}%`,
    mCv >= 80 ? GREEN : mCv >= 50 ? AMBER : RED,
    [
      { lbl: "ÉVAL. MÉNAGE", val: fmt(split.householdEval) },
      { lbl: "VACCINÉS MÉNAGE", val: fmt(split.householdVac), tone: "good" },
      { lbl: "NON VAC. MÉNAGE", val: fmt(mNotVax), tone: "bad" },
      { lbl: "% NON VAC.", val: mPctNotVax.toFixed(1).replace(".", ",") + "%", tone: "bad" },
    ],
    BRAND,
  );

  drawPanel(
    0.6 + panelW + 0.25, "hm",
    "Volet Hors-ménage (HM)",
    "Enfants rencontrés hors-ménage (écoles, marchés, transit)",
    `CV ${hmCv.toFixed(1).replace(".", ",")}%`,
    hmCv >= 80 ? GREEN : hmCv >= 50 ? AMBER : RED,
    [
      { lbl: "ÉVAL. HORS-MÉNAGE", val: fmt(split.outsideEval) },
      { lbl: "VACCINÉS HM", val: fmt(split.outsideVac), tone: "good" },
      { lbl: "NON VAC. HM", val: fmt(hmNotVax), tone: "bad" },
      { lbl: "% NON VAC.", val: hmPctNotVax.toFixed(1).replace(".", ",") + "%", tone: "bad" },
    ],
    AMBER,
  );

  // 3 tuiles CV
  const cvY = 4.4;
  const cvH = 1.2;
  const cvW = (SLIDE_W - 1.2 - 0.3) / 3;
  const cvTiles = [
    { lbl: "CV MÉNAGE", v: mCv, color: RED, sub: `${fmt(split.householdVac)} / ${fmt(split.householdEval)}` },
    { lbl: "CV HORS-MÉNAGE", v: hmCv, color: GREEN, sub: `${fmt(split.outsideVac)} / ${fmt(split.outsideEval)}` },
    { lbl: "CV GLOBALE POLIO", v: gCv, color: BRAND, sub: `${fmt(totalVac)} / ${fmt(totalEval)}` },
  ];
  cvTiles.forEach((t, i) => {
    const x = 0.6 + i * (cvW + 0.15);
    slide.addShape("roundRect" as any, {
      x, y: cvY, w: cvW, h: cvH,
      fill: { color: PAPER }, line: { color: RULE, pt: 1 },
      rectRadius: 0.1,
    });
    slide.addText(t.lbl, {
      x, y: cvY + 0.1, w: cvW, h: 0.3,
      fontFace: FONT, fontSize: 11, color: INK_SOFT, bold: true,
      align: "center", valign: "middle", charSpacing: 2,
    });
    slide.addText(t.v.toFixed(1).replace(".", ",") + "%", {
      x, y: cvY + 0.35, w: cvW, h: 0.6,
      fontFace: FONT, fontSize: 36, bold: true, color: t.color,
      align: "center", valign: "middle",
    });
    slide.addText(t.sub, {
      x, y: cvY + 0.92, w: cvW, h: 0.24,
      fontFace: FONT, fontSize: 10, color: MUTED,
      align: "center", valign: "middle",
    });
  });

  // Interprétation
  const gap = gCv - 95;
  const interpText = mCv < hmCv
    ? `Écart massif : le volet Ménage tire la couverture globale vers le bas (${mCv.toFixed(1).replace(".", ",")}% vs ${hmCv.toFixed(1).replace(".", ",")}% en HM). La majorité des non-vaccinés (${fmt(mNotVax)}/${fmt(mNotVax + hmNotVax)}) provient du volet ménage — stratégie de rattrapage porte-à-porte à renforcer.`
    : `Couverture globale à ${gCv.toFixed(1).replace(".", ",")}% — écart à l'objectif OMS (95%) : ${gap.toFixed(1).replace(".", ",")} pts.`;
  interp(slide, interpText, 5.9);
}

// ─── HBars (slide 5 Top AS, slide 8 RR par AS) ────────────────────────────────

function addHBarsBlock(
  slide: any,
  data: HBarSeries[],
  x: number, y: number, w: number, h: number,
  opts: {
    unit?: "abs" | "pct";
    colorForValue?: (v: number, max: number) => string;
  } = {},
) {
  const unit = opts.unit ?? "abs";
  const colorFor = opts.colorForValue ?? ((v, max) => {
    const r = max ? v / max : 0;
    if (r >= 0.75) return RED;
    if (r >= 0.5) return "E66360";
    if (r >= 0.3) return AMBER;
    return "B8B9B5";
  });

  // Card background
  slide.addShape("roundRect" as any, {
    x, y, w, h,
    fill: { color: PAPER }, line: { color: RULE, pt: 0.75 },
    rectRadius: 0.08,
  });

  const pad = 0.2;
  const nameW = 1.7;
  const valW = 0.6;
  const gap = 0.2;
  const trackH = 0.26;
  const rowGap = 0.09;
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  const nData = Math.min(data.length, 10);
  const availH = h - pad * 2;
  const rowTotalH = Math.min(trackH + rowGap, availH / nData);

  for (let i = 0; i < nData; i += 1) {
    const d = data[i];
    const rowY = y + pad + i * rowTotalH + (rowTotalH - trackH) / 2;
    // Nom — appliquer fmtUnit pour afficher uniquement le nom court (sans ancêtres)
    slide.addText(fmtUnit(d.label), {
      x: x + pad, y: rowY - 0.04, w: nameW, h: trackH + 0.08,
      fontFace: FONT, fontSize: 10.5, color: INK, bold: true,
      align: "right", valign: "middle",
    });
    // Track gris
    const trackX = x + pad + nameW + gap;
    const trackW = w - pad * 2 - nameW - valW - gap * 2;
    slide.addShape("rect" as any, {
      x: trackX, y: rowY, w: trackW, h: trackH,
      fill: { color: "F0F4F8" }, line: { color: "F0F4F8" },
    });
    // Fill
    const ratio = unit === "pct"
      ? Math.min(1, d.value / 100)
      : Math.min(1, d.value / maxValue);
    const fillW = Math.max(0.12, trackW * ratio);
    const fillColor = unit === "pct"
      ? (d.value >= 80 ? BRAND : d.value >= 50 ? BRAND_MID : AMBER)
      : colorFor(d.value, maxValue);
    slide.addShape("rect" as any, {
      x: trackX, y: rowY, w: fillW, h: trackH,
      fill: { color: fillColor }, line: { color: fillColor },
    });
    // Valeur dans la barre si assez large
    const valText = unit === "pct"
      ? d.value.toFixed(0) + "%"
      : fmt(d.value);
    if (fillW > 0.5) {
      slide.addText(valText, {
        x: trackX, y: rowY, w: fillW - 0.08, h: trackH,
        fontFace: FONT, fontSize: 9, bold: true, color: PAPER,
        align: "right", valign: "middle",
      });
    }
    // Valeur à droite
    slide.addText(fmt(d.value), {
      x: trackX + trackW + gap, y: rowY - 0.04, w: valW, h: trackH + 0.08,
      fontFace: FONT, fontSize: 11, bold: true, color: INK,
      align: "left", valign: "middle",
    });
  }
}

// ─── Stacked absolute bars (raisons) ──────────────────────────────────────────

function addStackedAbsoluteSlide(
  slide: any,
  data: SlideSeriesData,
  opts: { interpretation: string; legendColors?: Record<string, string> },
) {
  const card = { x: 0.6, y: 1.2, w: SLIDE_W - 1.2, h: 4.6 };
  slide.addShape("roundRect" as any, {
    ...card,
    fill: { color: PAPER }, line: { color: RULE, pt: 0.75 },
    rectRadius: 0.08,
  });

  if (!data.units.length) {
    slide.addText("Aucune donnée disponible.", {
      x: card.x, y: card.y + 1.8, w: card.w, h: 1.0,
      fontFace: FONT, fontSize: 18, color: MUTED, italic: true, align: "center",
    });
    return;
  }

  const pad = 0.25;
  const nameW = 1.6;
  const axisH = 0.3;
  const plotX = card.x + pad + nameW + 0.15;
  const plotW = card.w - pad * 2 - nameW - 0.15;
  const plotY = card.y + pad;
  const plotH = card.h - pad * 2 - axisH;

  const totals = data.units.map((_, i) =>
    data.series.reduce((sum, s) => sum + (s.data[i] ?? 0), 0)
  );
  const rawMax = Math.max(...totals, 1);
  // Arrondi propre vers le haut (ticks)
  const niceMax = niceCeil(rawMax);

  const nRows = Math.min(data.units.length, 8);
  const barH = 0.28;
  const rowGap = (plotH - barH * nRows) / Math.max(1, nRows - 1);

  for (let i = 0; i < nRows; i += 1) {
    const name = data.units[i];
    const rowY = plotY + i * (barH + rowGap);
    // Appliquer fmtUnit pour afficher uniquement le nom court (sans ancêtres)
    slide.addText(fmtUnit(name), {
      x: card.x + pad, y: rowY - 0.04, w: nameW, h: barH + 0.08,
      fontFace: FONT, fontSize: 10, color: INK, bold: true,
      align: "right", valign: "middle",
    });
    let cursorX = plotX;
    data.series.forEach((s) => {
      const v = s.data[i] ?? 0;
      if (v <= 0) return;
      const segW = (v / niceMax) * plotW;
      const fillColor = (s.color ?? BRAND).replace("#", "");
      slide.addShape("rect" as any, {
        x: cursorX, y: rowY, w: segW, h: barH,
        fill: { color: fillColor }, line: { color: fillColor },
      });
      if (segW > 0.25) {
        slide.addText(String(v), {
          x: cursorX, y: rowY, w: segW, h: barH,
          fontFace: FONT, fontSize: 9, bold: true, color: PAPER,
          align: "center", valign: "middle",
        });
      }
      cursorX += segW;
    });
  }

  // Axis ticks
  const ticks = niceTicks(niceMax);
  ticks.forEach((t) => {
    const tx = plotX + (t / niceMax) * plotW;
    slide.addShape("line" as any, {
      x: tx, y: plotY + plotH, w: 0, h: 0.06,
      line: { color: MUTED, pt: 0.5 },
    });
    slide.addText(String(t), {
      x: tx - 0.2, y: plotY + plotH + 0.08, w: 0.4, h: 0.22,
      fontFace: FONT, fontSize: 9, color: MUTED,
      align: "center", valign: "middle",
    });
  });

  // Legend
  const legendY = card.y + card.h + 0.1;
  addLegend(slide, data.series, 0.6, legendY, SLIDE_W - 1.2, 0.5);

  // Interpretation
  interp(slide, opts.interpretation, 6.35);
}

function niceCeil(v: number): number {
  if (v <= 5) return 5;
  if (v <= 10) return 10;
  if (v <= 15) return 15;
  if (v <= 20) return 20;
  if (v <= 25) return 25;
  if (v <= 50) return 50;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / pow) * pow;
}

function niceTicks(max: number): number[] {
  const steps = max <= 10 ? 5 : max <= 25 ? 5 : max <= 50 ? 5 : 5;
  const step = max / steps;
  const ticks: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    ticks.push(Math.round(i * step));
  }
  return ticks;
}

function addLegend(
  slide: any,
  series: { name: string; color?: string }[],
  x: number, y: number, w: number, h: number,
) {
  // Simple 1-line legend; wraps onto max 2 lines by perItemWidth
  const perItemWidth = 1.8;
  const itemsPerRow = Math.max(1, Math.floor(w / perItemWidth));
  series.forEach((s, i) => {
    const row = Math.floor(i / itemsPerRow);
    const col = i % itemsPerRow;
    const ix = x + col * perItemWidth;
    const iy = y + row * 0.25;
    slide.addShape("rect" as any, {
      x: ix, y: iy + 0.07, w: 0.15, h: 0.15,
      fill: { color: (s.color ?? BRAND).replace("#", "") },
      line: { color: (s.color ?? BRAND).replace("#", "") },
    });
    slide.addText(s.name, {
      x: ix + 0.2, y: iy, w: perItemWidth - 0.25, h: 0.25,
      fontFace: FONT, fontSize: 10, color: INK_SOFT,
      align: "left", valign: "middle",
    });
  });
}

// ─── Slide 8 — RR : KPI + hbars + jauge ───────────────────────────────────────

function addRRSlide(slide: any, input: ReportInput) {
  const kpisRR = input.kpisRR ?? [];
  const rrCoverageByUnit = input.rrCoverageByUnit ?? [];
  // KPI en bandeau (5 colonnes)
  addKpiDashboard(slide, kpisRR, 1.15, 1.1, 5);

  // Bars + gauge sur 2 colonnes
  const blockY = 2.5;
  const blockH = 3.6;
  const leftW = 7.3;
  const rightW = SLIDE_W - 1.2 - 0.2 - leftW;

  addHBarsBlock(slide, rrCoverageByUnit, 0.6, blockY, leftW, blockH, { unit: "pct" });

  // Gauge card
  const gX = 0.6 + leftW + 0.2;
  slide.addShape("roundRect" as any, {
    x: gX, y: blockY, w: rightW, h: blockH,
    fill: { color: PAPER }, line: { color: RULE, pt: 0.75 },
    rectRadius: 0.1,
  });

  // Jauge circulaire — approximée en arc via 2 blockArc
  const totalRR = kpisRR.find((k) => /évalu/i.test(k.label))?.value ?? "0";
  const vacRR = kpisRR.find((k) => /vaccin/i.test(k.label) && !/non/i.test(k.label))?.value ?? "0";
  const covKpi = kpisRR.find((k) => /couverture/i.test(k.label));
  const covText = covKpi?.value ?? "—";
  const covNum = parseFloat(covText.replace(",", ".").replace("%", "")) || 0;

  const gaugeD = 2.0;
  const gaugeX = gX + (rightW - gaugeD) / 2;
  const gaugeY = blockY + 0.25;
  // Cercle fond
  slide.addShape("ellipse" as any, {
    x: gaugeX, y: gaugeY, w: gaugeD, h: gaugeD,
    fill: { color: "E6F4FB" }, line: { color: RULE, pt: 1 },
  });
  // Arc progrès — approximation : anneau coloré via pieChart-like block
  // PptxGenJS ne rend pas les arcs fractionnaires → on simule par un cercle plein
  // coloré de diamètre proportionnel, centré, avec anneau extérieur
  const innerD = gaugeD * 0.55;
  slide.addShape("ellipse" as any, {
    x: gaugeX + (gaugeD - innerD) / 2,
    y: gaugeY + (gaugeD - innerD) / 2,
    w: innerD, h: innerD,
    fill: { color: PAPER }, line: { color: PAPER },
  });
  // Valeur au centre
  slide.addText(covText, {
    x: gaugeX, y: gaugeY + 0.7, w: gaugeD, h: 0.7,
    fontFace: FONT, fontSize: 22, bold: true, color: INK,
    align: "center", valign: "middle",
  });
  // Arc haut colorié via texte "secteur" : on dessine un triangle coloré en haut
  // comme repère visuel de progression (approximation — version simple).
  slide.addShape("rect" as any, {
    x: gaugeX + 0.15, y: gaugeY + gaugeD - 0.2, w: gaugeD - 0.3, h: 0.1,
    fill: { color: covNum >= 80 ? GREEN : covNum >= 50 ? AMBER : RED },
    line: { type: "none" },
  });

  // Texte info sous la jauge
  slide.addText("Couverture RR — Jauge", {
    x: gX + 0.15, y: blockY + gaugeD + 0.45, w: rightW - 0.3, h: 0.3,
    fontFace: FONT, fontSize: 12, bold: true, color: INK,
    align: "center", valign: "middle",
  });
  const gap = 95 - covNum;
  slide.addText(`${vacRR}/${totalRR} — progression nécessaire de +${gap.toFixed(1).replace(".", ",")} pts pour atteindre l'objectif.`, {
    x: gX + 0.15, y: blockY + gaugeD + 0.75, w: rightW - 0.3, h: 0.55,
    fontFace: FONT, fontSize: 10, color: INK_SOFT,
    align: "center", valign: "middle",
  });
  slide.addText([
    { text: "Cible OMS : ", options: { color: MUTED } },
    { text: "≥ 95 %", options: { color: RED, bold: true } },
  ], {
    x: gX + 0.15, y: blockY + blockH - 0.45, w: rightW - 0.3, h: 0.3,
    fontFace: FONT, fontSize: 10,
    align: "center", valign: "middle",
  });

  // Interpretation
  if (rrCoverageByUnit.length >= 2) {
    const first = rrCoverageByUnit[0];
    const last = rrCoverageByUnit[rrCoverageByUnit.length - 1];
    interp(slide,
      `Constat : écart important entre ${fmtUnit(first.label)} (${first.value.toFixed(0)}) et ${fmtUnit(last.label)} (${last.value.toFixed(0)}) — couverture RR très hétérogène.`,
      6.35);
  }
}

// ─── Tableau synth (flat) ─────────────────────────────────────────────────────

function cell(text: string, opts: any = {}) {
  return {
    text,
    options: {
      fontFace: FONT, fontSize: 11, color: INK, valign: "middle" as const,
      ...opts,
    },
  };
}

function headerCells(titles: string[]) {
  return titles.map((t) =>
    cell(t, {
      bold: true, fill: { color: BRAND }, color: PAPER,
      fontSize: 11, align: "center",
      border: { type: "solid", color: BRAND_DARK, pt: 0.75 },
    })
  );
}

function addHeatLegend(slide: any, y: number) {
  const x = 0.6;
  const w = SLIDE_W - 1.2;
  slide.addText("Légende heat-map :", {
    x, y, w: 1.6, h: 0.3,
    fontFace: FONT, fontSize: 10, bold: true, color: INK,
    align: "left", valign: "middle",
  });
  const items = [
    { color: HOT_LO, label: "Faible (≥10%)" },
    { color: HOT_MID, label: "Modéré (≥25%)" },
    { color: HOT_HI, label: "Élevé (≥50%)" },
    { color: HOT_MAX, label: "Critique (≥75%)" },
  ];
  const gap = 0.15;
  const itemW = 1.6;
  items.forEach((it, i) => {
    const ix = x + 1.6 + i * (itemW + gap);
    slide.addShape("rect" as any, {
      x: ix, y: y + 0.08, w: 0.18, h: 0.18,
      fill: { color: it.color }, line: { color: RULE, pt: 0.5 },
    });
    slide.addText(it.label, {
      x: ix + 0.22, y, w: itemW - 0.25, h: 0.3,
      fontFace: FONT, fontSize: 9.5, color: INK_SOFT,
      align: "left", valign: "middle",
    });
  });
}

function addFlatSynthTable(
  pptx: any, startPage: number,
  rows: ReportInput["synthTable"],
  lvlLabel: string, lvlName: string,
): number {
  let page = startPage;
  const ROWS_PER_PAGE = 14;
  if (!rows.length) {
    const slide = pptx.addSlide();
    addHeader(slide, "Tableau synthétique multi-niveaux", "Vue consolidée");
    addFooter(slide, ++page, lvlLabel, lvlName);
    slide.addText("Aucune donnée disponible.", {
      x: 1.0, y: 3.0, w: SLIDE_W - 2.0, h: 1.0,
      fontFace: FONT, fontSize: 18, color: MUTED, italic: true, align: "center",
    });
    return page;
  }

  const maxPolio = Math.max(...rows.map((r) => r.polioNotVax), 1);

  const chunks: typeof rows[] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
    chunks.push(rows.slice(i, i + ROWS_PER_PAGE));
  }

  chunks.forEach((chunk, idx) => {
    const slide = pptx.addSlide();
    const sub = chunks.length > 1
      ? `Page ${idx + 1}/${chunks.length} — Vue consolidée`
      : "Vue consolidée des unités";
    addHeader(slide, "Tableau synthétique multi-niveaux", sub);
    addFooter(slide, ++page, lvlLabel, lvlName);

    const headerRow = headerCells([
      "Unité", "Évalués Polio", "Non vaccinés Polio",
    ]);
    const dataRows = chunk.map((r, i) => {
      const bg = i % 2 === 0 ? PAPER_TINT : PAPER;
      const polioColor = heatLevel(r.polioNotVax, maxPolio);
      return [
        cell(fmtUnit(r.orgUnit), { fill: { color: bg } }),
        cell(fmt(r.evaluatedPolio), { fill: { color: bg }, align: "center" }),
        cell(fmt(r.polioNotVax), {
          fill: { color: polioColor ?? bg }, align: "center", bold: !!polioColor,
          color: polioColor === HOT_MAX ? PAPER : INK,
        }),
      ];
    });

    slide.addTable([headerRow, ...dataRows], {
      x: 0.5, y: 1.25, w: SLIDE_W - 1.0,
      colW: [6.3, 3.0, 3.0],
      rowH: 0.36,
      border: { type: "solid", color: RULE, pt: 0.5 },
      autoPage: false,
    });
    addHeatLegend(slide, 6.55);
  });

  return page;
}

// ─── Tableau synth (nested AS → localités) ────────────────────────────────────

type NestedRow =
  | { kind: "as"; as: string; evaluatedPolio: number; polio: number }
  | { kind: "loc"; locality: string; evaluatedPolio: number; polio: number };

function flattenNested(groups: SynthASGroup[]): NestedRow[] {
  const out: NestedRow[] = [];
  groups.forEach((g) => {
    out.push({
      kind: "as", as: g.as,
      evaluatedPolio: g.evaluatedPolio,
      polio: g.polioNotVax,
    });
    g.localities.forEach((l) => {
      out.push({
        kind: "loc", locality: l.locality,
        evaluatedPolio: l.evaluatedPolio,
        polio: l.polioNotVax,
      });
    });
  });
  return out;
}

function addNestedSynthTable(
  pptx: any, startPage: number,
  groups: SynthASGroup[],
  lvlLabel: string, lvlName: string,
): number {
  let page = startPage;
  if (!groups.length) {
    const slide = pptx.addSlide();
    addHeader(slide, "Tableau synthétique multi-niveaux", "Vue consolidée");
    addFooter(slide, ++page, lvlLabel, lvlName);
    slide.addText("Aucune donnée disponible.", {
      x: 1.0, y: 3.0, w: SLIDE_W - 2.0, h: 1.0,
      fontFace: FONT, fontSize: 18, color: MUTED, italic: true, align: "center",
    });
    return page;
  }

  // Refs de coloration sur LOCALITÉS (pour un contraste utile)
  const allLocalityPolio = groups.flatMap((g) => g.localities.map((l) => l.polioNotVax));
  const maxPolio = Math.max(...allLocalityPolio, 1);

  const flat = flattenNested(groups);
  const ROWS_PER_PAGE = 15;
  const chunks: NestedRow[][] = [];
  for (let i = 0; i < flat.length; i += ROWS_PER_PAGE) {
    chunks.push(flat.slice(i, i + ROWS_PER_PAGE));
  }

  chunks.forEach((chunk, idx) => {
    const slide = pptx.addSlide();
    const sub = chunks.length > 1
      ? `Page ${idx + 1}/${chunks.length} — Aires de Santé & localités`
      : "Aires de Santé & localités";
    addHeader(slide, "Tableau synthétique multi-niveaux", sub);
    addFooter(slide, ++page, lvlLabel, lvlName);

    const headerRow = headerCells([
      "Aire de Santé", "Localité", "Évalués Polio", "Non vaccinés Polio",
    ]);
    let zebra = 0;
    const dataRows = chunk.map((r) => {
      if (r.kind === "as") {
        zebra = 0;
        return [
          cell(fmtUnit(r.as), { fill: { color: BRAND_LIGHT }, bold: true, color: BRAND_DARK }),
          cell("▸ Total AS", { fill: { color: BRAND_LIGHT }, bold: true, color: BRAND_DARK }),
          cell(fmt(r.evaluatedPolio), { fill: { color: BRAND_LIGHT }, bold: true, color: BRAND_DARK, align: "center" }),
          cell(fmt(r.polio), { fill: { color: BRAND_LIGHT }, bold: true, color: BRAND_DARK, align: "center" }),
        ];
      }
      const bg = zebra++ % 2 === 0 ? PAPER : PAPER_TINT;
      const polioColor = heatLevel(r.polio, maxPolio);
      return [
        cell("", { fill: { color: bg } }),
        cell(`   •  ${fmtUnit(r.locality)}`, { fill: { color: bg }, color: INK_SOFT }),
        cell(fmt(r.evaluatedPolio), { fill: { color: bg }, align: "center" }),
        cell(fmt(r.polio), {
          fill: { color: polioColor ?? bg }, align: "center", bold: !!polioColor,
          color: polioColor === HOT_MAX ? PAPER : INK,
        }),
      ];
    });

    slide.addTable([headerRow, ...dataRows], {
      x: 0.5, y: 1.25, w: SLIDE_W - 1.0,
      colW: [2.8, 4.0, 2.75, 2.75],
      rowH: 0.32,
      border: { type: "solid", color: RULE, pt: 0.5 },
      autoPage: false,
    });
    addHeatLegend(slide, 6.55);
  });

  return page;
}

// ─── Défis & Recommandations (auto-generated fallbacks) ───────────────────────

function fallbackDefis(input: ReportInput): string[] {
  const defis: string[] = [];
  const polioCov = input.kpisOverview.find((k) => /couverture polio/i.test(k.label))?.value ?? "";
  if (polioCov) defis.push(`Couverture Polio : ${polioCov} — objectif OMS : ≥ 95 %`);
  const refusTotaux = input.kpisOverview.find((k) => /refus/i.test(k.label))?.value ?? "";
  if (refusTotaux) defis.push(`Présence de ${refusTotaux} refus vaccinaux nécessitant des actions de communication`);
  if (input.topNonVaxPolio.length > 0) {
    const top = input.topNonVaxPolio[0];
    defis.push(`Aire de santé à cibler en priorité : « ${fmtUnit(top.label)} » (${fmt(top.value)} non-vaccinés Polio)`);
  }
  return defis;
}

function fallbackActions(): string[] {
  return [
    "Renforcer la communication & sensibilisation dans les aires à faible couverture",
    "Organiser des séances de rattrapage porte-à-porte — volet Ménage prioritaire",
    "Déployer des équipes de négociation communautaire (leaders religieux)",
    "Renforcer la disponibilité des vaccins Polio et former les agents de santé",
    "Planifier une mission de supervision dans les aires les plus touchées",
    "Améliorer la complétude des rapports de monitorage",
    "Partager les résultats avec les partenaires et le Ministère de la Santé",
  ];
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function exportFullReportPPT(input: ReportInput): Promise<void> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = input.title;
  pptx.author = "Monitorage indépendant Polio";
  pptx.company = "OMS / PEV — RDC";

  let page = 0;
  const lvlLabel = input.levelLabel;
  const lvlName = input.levelName;

  // Slide 1 — Cover
  {
    const slide = pptx.addSlide();
    addCoverSlide(slide, input);
  }

  // Slide 2 — Plan
  {
    const slide = pptx.addSlide();
    addHeader(slide, "Plan de présentation", "11 sections du rapport");
    addFooter(slide, ++page, lvlLabel, lvlName);
    addPlanSlide(slide, unitLabels(input));
  }

  // Slide 3 — Vue d'ensemble (8 KPI)
  {
    const slide = pptx.addSlide();
    addHeader(slide, "Vue d'ensemble", "Indicateurs clés de la campagne");
    addFooter(slide, ++page, lvlLabel, lvlName);
    addKpiDashboard(slide, input.kpisOverview, 1.2, 2.7, 4);
    interp(slide, "Ces indicateurs reflètent l'ensemble de la campagne pour la sélection et la période.", 6.35);
  }

  // Slide 4 — Polio M/HM/Global
  {
    const slide = pptx.addSlide();
    addHeader(slide, "Vaccination Polio (nVPO2 + VPOb)", "Détail Ménage / Hors-ménage / Global");
    addFooter(slide, ++page, lvlLabel, lvlName);
    addPolioSplitSlide(slide, input.polioSplit);
  }

  // Slide 5 — Top AS non-vaccination Polio (hbars)
  {
    const slide = pptx.addSlide();
    const { singular, plural } = unitLabels(input);
    addHeader(slide, `Top ${plural} · Non vaccination Polio`, "Classement par volume de non-vaccinés");
    addFooter(slide, ++page, lvlLabel, lvlName);
    addHBarsBlock(slide, input.topNonVaxPolio, 0.6, 1.2, SLIDE_W - 1.2, 4.7);
    if (input.topNonVaxPolio.length > 0) {
      const top = input.topNonVaxPolio[0];
      const sum5 = input.topNonVaxPolio.slice(0, 5).reduce((a, b) => a + b.value, 0);
      const totalAll = input.topNonVaxPolio.reduce((a, b) => a + b.value, 0);
      const pct5 = totalAll ? Math.round((sum5 * 100) / totalAll) : 0;
      interp(slide,
        `${singular} prioritaire : « ${fmtUnit(top.label)} » concentre ${fmt(top.value)} non-vaccinés Polio. Les 5 premières unités cumulent ${fmt(sum5)} non-vaccinés (${pct5}% du total).`,
        6.05);
    }
  }

  // Slide 6 — Raisons Polio (stacked absolute)
  {
    const slide = pptx.addSlide();
    const { singular } = unitLabels(input);
    addHeader(slide, "Raisons de non vaccination Polio", `Distribution empilée par ${singular}`);
    addFooter(slide, ++page, lvlLabel, lvlName);
    const series = input.polioReasons.series.length ? input.polioReasons : {
      units: input.polioReasons.units,
      series: [
        { name: "Refus", data: [], color: C_REFUS },
        { name: "Absent", data: [], color: C_ABSENT },
        { name: "Aucun agent santé", data: [], color: C_NOAGENT },
        { name: "Endormi", data: [], color: C_ENDORMI },
        { name: "HF trop loin", data: [], color: C_HFLOIN },
        { name: "Déjà vacciné (routine)", data: [], color: C_DEJA },
        { name: "Autres", data: [], color: C_AUTRE },
      ],
    };
    const totals = series.series.map((s) => s.data.reduce((a, b) => a + b, 0));
    const dom = series.series[totals.indexOf(Math.max(...totals))]?.name ?? "—";
    const topUnit = series.units[0] ?? "—";
    const topVal = series.series.reduce((sum, s) => sum + (s.data[0] ?? 0), 0);
    addStackedAbsoluteSlide(slide, series, {
      interpretation: `Raison dominante : « ${dom} » — ${fmtUnit(topUnit)} présente le volume le plus élevé (${topVal} cas).`,
    });
  }

  // Slide 7 — Refus Polio
  {
    const slide = pptx.addSlide();
    const { singular } = unitLabels(input);
    addHeader(slide, "Refus & absences Polio", `Détail des refus signalés par ${singular}`);
    addFooter(slide, ++page, lvlLabel, lvlName);
    const totals = input.polioRefusals.series.map((s) => s.data.reduce((a, b) => a + b, 0));
    const dom = input.polioRefusals.series[totals.indexOf(Math.max(...totals))]?.name ?? "—";
    const topUnit = input.polioRefusals.units[0] ?? "—";
    addStackedAbsoluteSlide(slide, input.polioRefusals, {
      interpretation: `Raison dominante : « ${dom} » — ${fmtUnit(topUnit)} présente le volume le plus élevé. Mobilisation des leaders communautaires recommandée.`,
    });
  }

  // Slide 8 — RR (KPI + hbars + gauge) — uniquement si données RR présentes
  if (input.rrCoverageByUnit && input.rrCoverageByUnit.length && input.kpisRR && input.kpisRR.length) {
    const slide = pptx.addSlide();
    const { singular } = unitLabels(input);
    addHeader(slide, "Rougeole-Rubéole (RR)", `Couverture vaccinale RR par ${singular}`);
    addFooter(slide, ++page, lvlLabel, lvlName);
    addRRSlide(slide, input);
  }

  // Slide 9 — Raisons RR — uniquement si données RR présentes
  if (input.rrReasons && input.rrReasons.units.length) {
    const slide = pptx.addSlide();
    addHeader(slide, "Raisons de non vaccination RR", `Offre (rouge) + Demande (bleu) par ${unitLabels(input).singular}`);
    addFooter(slide, ++page, lvlLabel, lvlName);
    const totals = input.rrReasons.series.map((s) => s.data.reduce((a, b) => a + b, 0));
    const dom = input.rrReasons.series[totals.indexOf(Math.max(...totals))]?.name ?? "—";
    const topUnit = input.rrReasons.units[0] ?? "—";
    const topVal = input.rrReasons.series.reduce((sum, s) => sum + (s.data[0] ?? 0), 0);
    addStackedAbsoluteSlide(slide, input.rrReasons, {
      interpretation: `Raison dominante : « ${dom} » — ${fmtUnit(topUnit)} présente le volume le plus élevé (${topVal} cas).`,
    });
  }

  // Slide 10 — Refus RR — uniquement si données RR présentes
  if (input.rrRefusals && input.rrRefusals.units.length) {
    const slide = pptx.addSlide();
    addHeader(slide, "Refus & absences RR", "Facteurs de demande (refus, réticences)");
    addFooter(slide, ++page, lvlLabel, lvlName);
    const totals = input.rrRefusals.series.map((s) => s.data.reduce((a, b) => a + b, 0));
    const dom = input.rrRefusals.series[totals.indexOf(Math.max(...totals))]?.name ?? "—";
    const topUnit = input.rrRefusals.units[0] ?? "—";
    const topVal = input.rrRefusals.series.reduce((sum, s) => sum + (s.data[0] ?? 0), 0);
    addStackedAbsoluteSlide(slide, input.rrRefusals, {
      interpretation: `Raison dominante : « ${dom} » — ${fmtUnit(topUnit)} présente le volume le plus élevé (${topVal}).`,
    });
  }

  // Slide 11+ — Tableau synth
  if (input.drillLevel === "zs" && input.synthTableNested && input.synthTableNested.length > 0) {
    page = addNestedSynthTable(pptx, page, input.synthTableNested, lvlLabel, lvlName);
  } else {
    page = addFlatSynthTable(pptx, page, input.synthTable, lvlLabel, lvlName);
  }

  // Slide Défis
  {
    const slide = pptx.addSlide();
    addHeader(slide, "Défis identifiés", "Analyse automatique des données");
    addFooter(slide, ++page, lvlLabel, lvlName);
    const defis = (input.defis && input.defis.length ? input.defis : fallbackDefis(input)).slice(0, 7);
    const total = defis.length;
    const rowH = 0.65;
    const gap = 0.12;
    const totalH = total * rowH + (total - 1) * gap;
    const yStart = 1.2 + (SLIDE_H - 1.2 - 0.55 - totalH) / 2;
    defis.forEach((d, i) => {
      const y = yStart + i * (rowH + gap);
      slide.addShape("roundRect" as any, {
        x: 0.8, y, w: SLIDE_W - 1.6, h: rowH,
        fill: { color: PAPER_TINT }, line: { color: RULE, pt: 0.75 },
        rectRadius: 0.06,
      });
      slide.addShape("rect" as any, {
        x: 0.8, y, w: 0.15, h: rowH,
        fill: { color: RED }, line: { color: RED },
      });
      slide.addShape("ellipse" as any, {
        x: 1.05, y: y + (rowH - 0.4) / 2, w: 0.4, h: 0.4,
        fill: { color: RED }, line: { color: RED },
      });
      slide.addText("!", {
        x: 1.05, y: y + (rowH - 0.4) / 2, w: 0.4, h: 0.4,
        fontFace: FONT, fontSize: 18, bold: true, color: PAPER,
        align: "center", valign: "middle",
      });
      slide.addText(d, {
        x: 1.6, y, w: SLIDE_W - 2.4, h: rowH,
        fontFace: FONT, fontSize: 13, color: INK, valign: "middle",
      });
    });
  }

  // Slide Recommandations
  {
    const slide = pptx.addSlide();
    addHeader(slide, "Points d'action — Recommandations", "Actions prioritaires basées sur les données");
    addFooter(slide, ++page, lvlLabel, lvlName);
    const actions = (input.recommandations && input.recommandations.length ? input.recommandations : fallbackActions()).slice(0, 7);
    const total = actions.length;
    const rowH = 0.65;
    const gap = 0.12;
    const totalH = total * rowH + (total - 1) * gap;
    const yStart = 1.2 + (SLIDE_H - 1.2 - 0.55 - totalH) / 2;
    actions.forEach((a, i) => {
      const y = yStart + i * (rowH + gap);
      slide.addShape("roundRect" as any, {
        x: 0.8, y, w: SLIDE_W - 1.6, h: rowH,
        fill: { color: BRAND_LIGHT }, line: { color: BRAND, pt: 1 },
        rectRadius: 0.06,
      });
      slide.addShape("ellipse" as any, {
        x: 1.05, y: y + (rowH - 0.4) / 2, w: 0.4, h: 0.4,
        fill: { color: BRAND }, line: { color: BRAND },
      });
      slide.addText(String(i + 1), {
        x: 1.05, y: y + (rowH - 0.4) / 2, w: 0.4, h: 0.4,
        fontFace: FONT, fontSize: 14, bold: true, color: PAPER,
        align: "center", valign: "middle",
      });
      slide.addText(a, {
        x: 1.6, y, w: SLIDE_W - 2.4, h: rowH,
        fontFace: FONT, fontSize: 13, color: INK, valign: "middle",
      });
    });
  }

  // Nom de fichier dynamique
  const safeLvlLabel = lvlLabel.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
  const safeLvlName = lvlName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50) || "Tous";
  const fileName = `Rapport_Polio_${safeLvlLabel}_${safeLvlName}.pptx`;
  await pptx.writeFile({ fileName });
}

// ─── Compat : export d'un unique graphique (utilisé ailleurs dans l'app) ──────

export async function exportSingleChartPPT(
  title: string,
  data: SlideSeriesData,
  _chartType: "bar" | "table" = "bar",
): Promise<void> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = title;

  const slide = pptx.addSlide();
  addHeader(slide, title);
  addFooter(slide, 1, "Section", title);

  if (data.units.length === 0) {
    slide.addText("Aucune donnée disponible.", {
      x: 1.0, y: 3.0, w: SLIDE_W - 2.0, h: 1.0,
      fontFace: FONT, fontSize: 18, color: MUTED, italic: true, align: "center",
    });
  } else {
    addStackedAbsoluteSlide(slide, data, {
      interpretation: "Vue consolidée pour cette sélection.",
    });
  }

  await pptx.writeFile({ fileName: `${title.replace(/[^a-zA-Z0-9]/g, "_")}.pptx` });
}
