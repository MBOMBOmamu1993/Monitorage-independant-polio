"use client";

import dynamic from "next/dynamic";
import type { MapPoint } from "./LeafletMap";

const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false });

export default function MapClient(props: {
  points: MapPoint[];
  height?: number;
  mode?: "cluster" | "heat";
}) {
  return <LeafletMap {...props} />;
}
