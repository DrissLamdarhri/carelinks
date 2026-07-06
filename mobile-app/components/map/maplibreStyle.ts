/**
 * CareLink — MapLibre styles (cream/navy day + dark night) over MapTiler tiles.
 *
 * Requires a free MapTiler key in EXPO_PUBLIC_MAPTILER_KEY (no credit card).
 * Get one at https://cloud.maptiler.com → Account → Keys. Set it in your env /
 * eas.json build env before building the dev client, or the map tiles won't load.
 */
import type { StyleSpecification } from "@maplibre/maplibre-react-native";

export const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY ?? "";

function sources(key: string) {
  return {
    openmaptiles: {
      type: "vector",
      url: `https://api.maptiler.com/tiles/v3/tiles.json?key=${key}`,
    },
  };
}

const glyphs = (key: string) => `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${key}`;

/** Day style — cream/navy. Warm, high-legibility roads; coral motorways. */
export function creamMapStyle(): StyleSpecification {
  const key = MAPTILER_KEY;
  const style = {
    version: 8,
    name: "CareLink Cream",
    sources: sources(key),
    glyphs: glyphs(key),
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#EDE5CC" } },
      { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water", paint: { "fill-color": "#A0C8D8" } },
      {
        id: "landcover-wood",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landcover",
        filter: ["==", "class", "wood"],
        paint: { "fill-color": "#CDDEC8", "fill-opacity": 0.55 },
      },
      { id: "park", type: "fill", source: "openmaptiles", "source-layer": "park", paint: { "fill-color": "#CDDEC8", "fill-opacity": 0.5 } },

      // roads: tan casing + warm cream-white fill (higher daylight contrast than pure white)
      {
        id: "road-casing",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#B8A882", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.5, 16, 10] },
      },
      {
        id: "road",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#FBF6EC", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 16, 6.5] },
      },
      // motorways/trunk accented coral so major roads read at a glance
      {
        id: "road-motorway-casing",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["in", "class", "motorway", "trunk"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#C9803F", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2, 16, 12] },
      },
      {
        id: "road-motorway",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["in", "class", "motorway", "trunk"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#E8A56A", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.2, 16, 8] },
      },

      { id: "building", type: "fill", source: "openmaptiles", "source-layer": "building", minzoom: 14, paint: { "fill-color": "#E4D9BB", "fill-opacity": 0.5 } },
      // ── Street names — essential for a nurse to reach the exact address ──
      {
        id: "road-name",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "transportation_name",
        minzoom: 13,
        layout: {
          "symbol-placement": "line",
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
        },
        paint: { "text-color": "#6B6480", "text-halo-color": "#FBF6EC", "text-halo-width": 1.4 },
      },
      // ── Health POIs (hospital / pharmacy / clinic) — useful care landmarks ──
      {
        id: "poi-health",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "poi",
        minzoom: 14,
        filter: ["in", "class", "hospital", "pharmacy", "clinic", "doctors"],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 10,
          "text-anchor": "top",
          "text-offset": [0, 0.6],
        },
        paint: { "text-color": "#C0392B", "text-halo-color": "#FBF6EC", "text-halo-width": 1.2 },
      },
      // ── Places — city / district / neighborhood, sized by importance ──
      {
        id: "place-labels",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["match", ["get", "class"], "city", 16, "town", 13, "village", 12, "suburb", 12, "neighbourhood", 11, 11],
        },
        paint: { "text-color": "#0D0870", "text-halo-color": "#EDE5CC", "text-halo-width": 1.6 },
      },
    ],
  };
  return style as unknown as StyleSpecification;
}

/** Night style — deep navy, auto-used by tracking between 19:00 and 06:00. */
export function darkMapStyle(): StyleSpecification {
  const key = MAPTILER_KEY;
  const style = {
    version: 8,
    name: "CareLink Night",
    sources: sources(key),
    glyphs: glyphs(key),
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#0D0B1A" } },
      { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water", paint: { "fill-color": "#12203A" } },
      { id: "landcover-wood", type: "fill", source: "openmaptiles", "source-layer": "landcover", filter: ["==", "class", "wood"], paint: { "fill-color": "#152036", "fill-opacity": 0.5 } },
      { id: "park", type: "fill", source: "openmaptiles", "source-layer": "park", paint: { "fill-color": "#152036", "fill-opacity": 0.5 } },
      {
        id: "road-casing",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#0A0E1F", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.5, 16, 10] },
      },
      {
        id: "road",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#1E2340", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 16, 6.5] },
      },
      {
        id: "road-motorway",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["in", "class", "motorway", "trunk"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#2C3565", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.2, 16, 8] },
      },
      { id: "building", type: "fill", source: "openmaptiles", "source-layer": "building", minzoom: 14, paint: { "fill-color": "#141A2E", "fill-opacity": 0.6 } },
      {
        id: "road-name",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "transportation_name",
        minzoom: 13,
        layout: { "symbol-placement": "line", "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 11 },
        paint: { "text-color": "#8189B0", "text-halo-color": "#0D0B1A", "text-halo-width": 1.4 },
      },
      {
        id: "poi-health",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "poi",
        minzoom: 14,
        filter: ["in", "class", "hospital", "pharmacy", "clinic", "doctors"],
        layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 10, "text-anchor": "top", "text-offset": [0, 0.6] },
        paint: { "text-color": "#F0857D", "text-halo-color": "#0D0B1A", "text-halo-width": 1.2 },
      },
      {
        id: "place-labels",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["match", ["get", "class"], "city", 16, "town", 13, "village", 12, "suburb", 12, "neighbourhood", 11, 11],
        },
        paint: { "text-color": "#A0A8CC", "text-halo-color": "#0D0B1A", "text-halo-width": 1.4 },
      },
    ],
  };
  return style as unknown as StyleSpecification;
}

/** Pick day/night automatically by local hour (night = 19:00–06:00). */
export function autoMapStyle(): StyleSpecification {
  const h = new Date().getHours();
  return h >= 19 || h < 6 ? darkMapStyle() : creamMapStyle();
}
