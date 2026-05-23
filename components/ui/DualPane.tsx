"use client";

/**
 * Volet dual Ménage / Hors-ménage — structure inspirée du dashboard PowerBI
 * polio D0 / D1 / D2. Chaque volet reçoit ses propres KPI et visuels.
 */
import { Card, CardHeader } from "./Card";
import { cn } from "@/lib/client/cn";

interface Props {
  leftTitle: string;
  rightTitle: string;
  leftSubtitle?: string;
  rightSubtitle?: string;
  leftTone?: "brand" | "warn";
  rightTone?: "brand" | "warn";
  left: React.ReactNode;
  right: React.ReactNode;
  leftBadge?: React.ReactNode;
  rightBadge?: React.ReactNode;
}

export function DualPane({
  leftTitle,
  rightTitle,
  leftSubtitle,
  rightSubtitle,
  leftTone = "brand",
  rightTone = "warn",
  left,
  right,
  leftBadge,
  rightBadge,
}: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card
        className={cn(
          "border-t-4",
          leftTone === "brand" ? "border-t-oms-600" : "border-t-warn-500"
        )}
      >
        <CardHeader
          title={leftTitle}
          subtitle={leftSubtitle}
          right={leftBadge}
        />
        {left}
      </Card>
      <Card
        className={cn(
          "border-t-4",
          rightTone === "warn" ? "border-t-warn-500" : "border-t-oms-600"
        )}
      >
        <CardHeader
          title={rightTitle}
          subtitle={rightSubtitle}
          right={rightBadge}
        />
        {right}
      </Card>
    </div>
  );
}
