"use client";

import { useMemo, useState } from "react";
import { geoCentroid } from "d3-geo";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import { alpha2ToNumeric } from "@/lib/geo/iso-codes";

const TOPO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export type CountryMarker = {
  /** ISO alpha-2 code from GA4 (e.g. "US"). May be null. */
  countryIso: string | null;
  /** Display name from GA4 (e.g. "United States"). */
  country: string;
  users: number;
};

export function WorldMap({
  markers,
  height = 360,
}: {
  markers: CountryMarker[];
  height?: number;
}) {
  const [hoverIso, setHoverIso] = useState<string | null>(null);

  // Index markers by ISO numeric so we can look up centroids quickly.
  const byNumeric = useMemo(() => {
    const map = new Map<string, CountryMarker>();
    for (const m of markers) {
      const numeric = alpha2ToNumeric(m.countryIso);
      if (numeric) map.set(numeric, m);
    }
    return map;
  }, [markers]);

  const maxUsers = Math.max(1, ...markers.map((m) => m.users));

  return (
    <div className="relative" style={{ height }}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 130, center: [0, 18] }}
        width={980}
        height={500}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup zoom={1} minZoom={1} maxZoom={5}>
          <Geographies geography={TOPO_URL}>
            {({ geographies }) => (
              <>
                {geographies.map((geo) => {
                  const id = String(geo.id);
                  const m = byNumeric.get(id);
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={() => setHoverIso(id)}
                      onMouseLeave={() => setHoverIso(null)}
                      style={{
                        default: {
                          fill: m
                            ? "hsl(187 100% 60% / 0.18)"
                            : "hsl(217 33% 14%)",
                          stroke: "hsl(217 33% 22%)",
                          strokeWidth: 0.5,
                          outline: "none",
                        },
                        hover: {
                          fill: "hsl(187 100% 60% / 0.35)",
                          outline: "none",
                          cursor: m ? "pointer" : "default",
                        },
                        pressed: { outline: "none" },
                      }}
                    />
                  );
                })}
                {geographies.map((geo) => {
                  const id = String(geo.id);
                  const m = byNumeric.get(id);
                  if (!m) return null;
                  const centroid = geoCentroid(geo);
                  if (
                    !Number.isFinite(centroid[0]) ||
                    !Number.isFinite(centroid[1])
                  ) {
                    return null;
                  }
                  const radius = 4 + (m.users / maxUsers) * 14;
                  return (
                    <Marker
                      key={`marker-${id}`}
                      coordinates={[centroid[0], centroid[1]]}
                    >
                      <circle
                        r={radius}
                        fill="hsl(142 90% 55%)"
                        fillOpacity={0.4}
                        stroke="hsl(142 90% 55%)"
                        strokeWidth={1.5}
                      >
                        <animate
                          attributeName="r"
                          from={radius}
                          to={radius * 1.4}
                          dur="1.6s"
                          begin="0s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="fill-opacity"
                          from="0.4"
                          to="0"
                          dur="1.6s"
                          begin="0s"
                          repeatCount="indefinite"
                        />
                      </circle>
                      <circle
                        r={3}
                        fill="hsl(142 90% 55%)"
                        stroke="hsl(222 47% 6%)"
                        strokeWidth={1}
                      />
                    </Marker>
                  );
                })}
              </>
            )}
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {hoverIso && byNumeric.get(hoverIso) && (
        <div className="pointer-events-none absolute right-3 top-3 rounded-md border border-border/60 bg-card/90 px-3 py-2 text-xs shadow-lg backdrop-blur">
          <p className="font-semibold">{byNumeric.get(hoverIso)!.country}</p>
          <p className="text-muted-foreground">
            {byNumeric.get(hoverIso)!.users} active{" "}
            {byNumeric.get(hoverIso)!.users === 1 ? "visitor" : "visitors"}
          </p>
        </div>
      )}
    </div>
  );
}
