"use client";

import dynamic from "next/dynamic";
import type { ChoroplethProps } from "./Choropleth";

const Choropleth = dynamic(() => import("./Choropleth"), { ssr: false });

export default function ChoroplethClient(props: ChoroplethProps) {
  return <Choropleth {...props} />;
}
