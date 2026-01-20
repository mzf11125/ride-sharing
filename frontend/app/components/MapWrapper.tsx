"use client";

import dynamic from "next/dynamic";
import type { Location, SelectionMode } from "./Map";

// Dynamically import Map with SSR disabled to prevent hydration errors
const Map = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] bg-muted animate-pulse rounded-lg flex items-center justify-center">
      <p className="text-muted-foreground">Loading map...</p>
    </div>
  ),
});

export interface MapWrapperProps {
  center?: [number, number];
  zoom?: number;
  pickup?: Location;
  destination?: Location;
  height?: string;
  selectionMode?: SelectionMode;
  onLocationSelect?: (latitude: number, longitude: number) => void;
}

export default function MapWrapper(props: MapWrapperProps) {
  return <Map {...props} />;
}
