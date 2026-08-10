/**
 * CareLink — MapLibre styles (cream/navy day + dark night) over MapTiler tiles.
 * ────────────────────────────────────────────────────────────────────────────
 * Requires a free MapTiler key in EXPO_PUBLIC_MAPTILER_KEY (no credit card).
 * Get one at https://cloud.maptiler.com → Account → Keys. Set it in your env /
 * eas.json build env before building the dev client, or the map tiles won't load.
 *
 * WHY THIS FILE GREW
 *
 * The previous style drew 11 layers and exactly ONE filtered POI layer:
 *
 *     filter: ["in", "class", "hospital", "pharmacy", "clinic", "doctors"]
 *
 * Decoding a real z14 tile over Fès shows what that was discarding: 3401 POI
 * features in a single tile, and 6083 across three, spanning 57 classes —
 * cafés, banks, schools, bakeries, mosques, petrol stations, parks, hotels —
 * all downloaded on every tile and thrown away at render time. Street numbers
 * (`housenumber`) and urban texture (`landuse`) were never drawn at all.
 *
 * So the map did not lack data. It lacked layers. Everything below reads from
 * tiles we were already paying for and already receiving.
 *
 * THE THREE RULES THAT KEEP IT FROM BECOMING A MESS
 *
 *  1. ZOOM BANDS. A POI class appears only once the map is close enough for it
 *     to be actionable. Healthcare — the reason this product exists — comes in
 *     first at z14; everyday retail arrives last at z17, where 1551 `shop`
 *     features per tile stop being noise and start being useful.
 *
 *  2. RANK, NOT LUCK. Every POI carries OpenMapTiles' `rank` (lower = more
 *     important). It drives `symbol-sort-key`, so when labels collide the more
 *     significant place wins deterministically instead of whichever happened to
 *     be drawn first. Mid-zoom layers also filter on it, which is what stops a
 *     dense medina from turning into a wall of text.
 *
 *  3. ONE ICON SET, HOSTED. `sprite` points at MapTiler's sprite (252 icons,
 *     named for the same OpenMapTiles vocabulary the tiles use), so there are
 *     no bundled image assets to ship, no `<Images>` wiring, and no per-icon
 *     drift between the data and the artwork. A failed sprite fetch degrades to
 *     text-only labels rather than an empty map.
 *
 * NOT TOUCHED BY ANY OF THIS: the route lines, the tracking marker and the
 * camera are `GeoJSONSource` / `Layer` / `ViewAnnotation` / `Camera` children
 * rendered ABOVE this style by CareLinkMapNative. They never read this object.
 */
import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import { isAfterMaghrib } from "@/lib/prayer-time";

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
/** MapTiler's hosted icon set — same naming as the OpenMapTiles POI classes. */
const sprite = (key: string) => `https://api.maptiler.com/maps/basic-v2/sprite?key=${key}`;

const REGULAR = ["Noto Sans Regular"];
const BOLD = ["Noto Sans Bold"];

/**
 * Prefer the viewer's script, fall back to the local name.
 *
 * Fès tiles carry `name:fr`, `name:ar` and `name:latin` side by side. Picking
 * `name` alone yields whichever the mapper typed; this asks for French, then
 * Latin, then whatever exists.
 */
const LABEL = ["coalesce", ["get", "name:fr"], ["get", "name:latin"], ["get", "name"]];

/**
 * POI groups, in the order they earn their place on screen.
 *
 * `minzoom` is the promise: at this zoom the class is useful enough to be worth
 * the ink. `maxRank` (when set) additionally keeps only the more significant
 * members until we are closer still.
 */
type PoiGroup = {
  id: string;
  minzoom: number;
  classes: string[];
  /** Only show POIs at or below this OpenMapTiles rank until `rankFreeAt`. */
  maxRank?: number;
  color: string;
  /** Draw earlier (lower number) when labels collide. */
  priority: number;
};

/** Colour roles reused by both themes so the two stay in step. */
function poiGroups(c: {
  health: string;
  civic: string;
  transport: string;
  food: string;
  retail: string;
  leisure: string;
}): PoiGroup[] {
  return [
    // Healthcare first and always — this is a home-care product.
    {
      id: "health",
      minzoom: 14,
      classes: ["hospital", "pharmacy", "doctors", "dentist", "veterinary"],
      color: c.health,
      priority: 0,
    },
    // Things you navigate BY, or need mid-trip.
    {
      id: "transport",
      minzoom: 15,
      classes: ["fuel", "parking", "bus", "car", "bicycle", "charging_station"],
      color: c.transport,
      priority: 1,
    },
    // Civic anchors — how people actually describe where they live.
    {
      id: "civic",
      minzoom: 15,
      classes: [
        "place_of_worship", "school", "college", "town_hall", "police",
        "post", "bank", "library", "fire_station",
      ],
      maxRank: 30,
      color: c.civic,
      priority: 2,
    },
    // Green space reads as landmark long before it reads as amenity.
    {
      id: "leisure",
      minzoom: 15,
      classes: ["park", "garden", "playground", "pitch", "stadium", "sports_centre", "swimming_pool"],
      maxRank: 25,
      color: c.leisure,
      priority: 3,
    },
    { id: "civic-all", minzoom: 16, classes: ["place_of_worship", "school", "college", "town_hall", "police", "post", "bank", "library"], color: c.civic, priority: 4 },
    {
      id: "food",
      minzoom: 16,
      classes: ["cafe", "restaurant", "fast_food", "bar", "bakery", "ice_cream", "lodging"],
      color: c.food,
      priority: 5,
    },
    {
      id: "culture",
      minzoom: 16,
      classes: ["museum", "art_gallery", "attraction", "monument", "cinema", "castle", "information"],
      color: c.leisure,
      priority: 6,
    },
    // The long tail. 1551 `shop` per tile — only useful once you are on the street.
    {
      id: "retail",
      minzoom: 17,
      classes: [
        "grocery", "shop", "clothing_store", "butcher", "hairdresser", "laundry",
        "convenience", "alcohol_shop", "florist", "furniture", "hardware",
        "mobile_phone", "optician", "car_repair", "car_rental", "gift", "music",
      ],
      color: c.retail,
      priority: 7,
    },
  ];
}

/** One symbol layer per POI group. Icon from the sprite, label underneath. */
function poiLayers(groups: PoiGroup[], halo: string) {
  return groups.map((g) => ({
    id: `poi-${g.id}`,
    type: "symbol" as const,
    source: "openmaptiles",
    "source-layer": "poi",
    minzoom: g.minzoom,
    filter: (g.maxRank != null
      ? ["all", ["in", "class", ...g.classes], ["<=", ["to-number", ["get", "rank"], 999], g.maxRank]]
      : ["in", "class", ...g.classes]) as unknown as never,
    layout: {
      // `class` is the sprite name for almost every value; `subclass` covers
      // the rest. `dot` is the neutral fallback so a POI is never invisible
      // just because the icon set has no artwork for it.
      "icon-image": ["coalesce", ["image", ["get", "class"]], ["image", ["get", "subclass"]], ["image", "dot"]],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 14, 0.7, 18, 1],
      "icon-optional": true,
      "text-field": LABEL,
      "text-font": REGULAR,
      "text-size": ["interpolate", ["linear"], ["zoom"], 14, 10, 18, 12],
      "text-anchor": "top",
      "text-offset": [0, 0.85],
      "text-max-width": 8,
      "text-optional": true,
      // Rank first (significance), then group priority — a hospital outranks a
      // café even when the café's own rank happens to be lower.
      "symbol-sort-key": ["+", ["*", g.priority, 1000], ["to-number", ["get", "rank"], 500]],
      "icon-allow-overlap": false,
      "text-allow-overlap": false,
      "icon-padding": 4,
    } as unknown as never,
    paint: {
      "text-color": g.color,
      "text-halo-color": halo,
      "text-halo-width": 1.4,
      "icon-opacity": 0.95,
    } as unknown as never,
  }));
}

/** Road widths shared by both themes — the hierarchy IS the legibility. */
const ROAD_WIDTH = {
  motorway: ["interpolate", ["exponential", 1.4], ["zoom"], 6, 1.4, 12, 5, 16, 14, 20, 34],
  trunk: ["interpolate", ["exponential", 1.4], ["zoom"], 8, 1.2, 12, 4, 16, 12, 20, 28],
  primary: ["interpolate", ["exponential", 1.4], ["zoom"], 9, 1, 12, 3, 16, 10, 20, 24],
  secondary: ["interpolate", ["exponential", 1.4], ["zoom"], 11, 0.9, 14, 3, 16, 8, 20, 20],
  minor: ["interpolate", ["exponential", 1.4], ["zoom"], 13, 0.6, 16, 4, 20, 14],
  service: ["interpolate", ["exponential", 1.4], ["zoom"], 15, 0.5, 18, 3, 20, 8],
  path: ["interpolate", ["linear"], ["zoom"], 15, 0.6, 20, 3],
} as const;

type Theme = {
  name: string;
  bg: string;
  water: string;
  waterLabel: string;
  wood: string;
  park: string;
  parkLabel: string;
  landuseResidential: string;
  landuseCommercial: string;
  landuseIndustrial: string;
  building: string;
  buildingOutline: string;
  roadCasing: string;
  roadMinor: string;
  roadSecondary: string;
  roadPrimary: string;
  roadMotorway: string;
  roadMotorwayCasing: string;
  roadLabel: string;
  halo: string;
  placeLabel: string;
  placeLabelMinor: string;
  houseNumber: string;
  poi: { health: string; civic: string; transport: string; food: string; retail: string; leisure: string };
};

function buildStyle(theme: Theme, key: string): StyleSpecification {
  const groups = poiGroups(theme.poi);
  const style = {
    version: 8,
    name: theme.name,
    sources: sources(key),
    glyphs: glyphs(key),
    sprite: sprite(key),
    layers: [
      { id: "bg", type: "background", paint: { "background-color": theme.bg } },

      // ── Land ────────────────────────────────────────────────────────────
      // Urban texture. Subtle on purpose: it should tell you "this block is
      // built up" peripherally, never compete with the route.
      {
        id: "landuse-residential",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landuse",
        minzoom: 12,
        filter: ["in", "class", "residential", "suburb", "neighbourhood"],
        paint: { "fill-color": theme.landuseResidential, "fill-opacity": 0.45 },
      },
      {
        id: "landuse-commercial",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landuse",
        minzoom: 12,
        filter: ["in", "class", "commercial", "retail"],
        paint: { "fill-color": theme.landuseCommercial, "fill-opacity": 0.4 },
      },
      {
        id: "landuse-industrial",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landuse",
        minzoom: 12,
        filter: ["in", "class", "industrial", "quarry", "railway"],
        paint: { "fill-color": theme.landuseIndustrial, "fill-opacity": 0.4 },
      },
      {
        id: "landcover-wood",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landcover",
        filter: ["==", "class", "wood"],
        paint: { "fill-color": theme.wood, "fill-opacity": 0.5 },
      },
      { id: "park", type: "fill", source: "openmaptiles", "source-layer": "park", paint: { "fill-color": theme.park, "fill-opacity": 0.55 } },
      { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water", paint: { "fill-color": theme.water } },
      {
        id: "waterway",
        type: "line",
        source: "openmaptiles",
        "source-layer": "waterway",
        minzoom: 10,
        paint: { "line-color": theme.water, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 16, 3] },
      },

      // ── Buildings ───────────────────────────────────────────────────────
      // Source min-zoom is 13; the old style started at 14 and lost a level.
      {
        id: "building",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 13,
        paint: {
          "fill-color": theme.building,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0.25, 16, 0.6],
          "fill-outline-color": theme.buildingOutline,
        },
      },

      // ── Roads, casing then fill, minor to major ─────────────────────────
      {
        id: "road-path",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        minzoom: 15,
        filter: ["in", "class", "path", "track", "pedestrian"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": theme.roadMinor, "line-width": ROAD_WIDTH.path, "line-dasharray": [2, 2], "line-opacity": 0.7 },
      },
      {
        id: "road-service-casing",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        minzoom: 15,
        filter: ["in", "class", "service"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": theme.roadCasing, "line-width": ["interpolate", ["linear"], ["zoom"], 15, 1.5, 20, 10] },
      },
      {
        id: "road-service",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        minzoom: 15,
        filter: ["in", "class", "service"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": theme.roadMinor, "line-width": ROAD_WIDTH.service },
      },
      {
        id: "road-minor-casing",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        minzoom: 12,
        filter: ["in", "class", "minor"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": theme.roadCasing, "line-width": ["interpolate", ["exponential", 1.4], ["zoom"], 13, 1.4, 16, 6, 20, 18] },
      },
      {
        id: "road-minor",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        minzoom: 12,
        filter: ["in", "class", "minor"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": theme.roadMinor, "line-width": ROAD_WIDTH.minor },
      },
      {
        id: "road-secondary-casing",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["in", "class", "secondary", "tertiary"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": theme.roadCasing, "line-width": ["interpolate", ["exponential", 1.4], ["zoom"], 11, 1.6, 14, 5, 16, 11, 20, 25] },
      },
      {
        id: "road-secondary",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["in", "class", "secondary", "tertiary"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": theme.roadSecondary, "line-width": ROAD_WIDTH.secondary },
      },
      {
        id: "road-primary-casing",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["in", "class", "primary", "trunk"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": theme.roadCasing, "line-width": ["interpolate", ["exponential", 1.4], ["zoom"], 9, 1.8, 12, 5, 16, 13, 20, 30] },
      },
      {
        id: "road-primary",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["in", "class", "primary", "trunk"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": theme.roadPrimary, "line-width": ROAD_WIDTH.primary },
      },
      {
        id: "road-motorway-casing",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["==", "class", "motorway"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": theme.roadMotorwayCasing, "line-width": ["interpolate", ["exponential", 1.4], ["zoom"], 6, 2.2, 12, 7, 16, 17, 20, 38] },
      },
      {
        id: "road-motorway",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["==", "class", "motorway"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": theme.roadMotorway, "line-width": ROAD_WIDTH.motorway },
      },

      // ── Labels ──────────────────────────────────────────────────────────
      {
        id: "road-name",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "transportation_name",
        minzoom: 13,
        filter: ["!in", "class", "motorway", "trunk"],
        layout: {
          "symbol-placement": "line",
          "text-field": LABEL,
          "text-font": REGULAR,
          "text-size": ["interpolate", ["linear"], ["zoom"], 13, 9, 18, 12.5],
          "text-max-angle": 30,
          "text-padding": 2,
        },
        paint: { "text-color": theme.roadLabel, "text-halo-color": theme.halo, "text-halo-width": 1.6 },
      },
      {
        id: "road-name-major",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "transportation_name",
        minzoom: 11,
        filter: ["in", "class", "motorway", "trunk", "primary"],
        layout: {
          "symbol-placement": "line",
          // Signposted reference first — "N6" is how a road is actually known.
          "text-field": ["coalesce", ["get", "ref"], LABEL],
          "text-font": BOLD,
          "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 18, 13.5],
          "text-max-angle": 30,
        },
        paint: { "text-color": theme.roadLabel, "text-halo-color": theme.halo, "text-halo-width": 1.8 },
      },
      {
        id: "park-label",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "park",
        minzoom: 14,
        layout: {
          "text-field": LABEL,
          "text-font": REGULAR,
          "text-size": ["interpolate", ["linear"], ["zoom"], 14, 10, 18, 12],
          "text-max-width": 8,
        },
        paint: { "text-color": theme.parkLabel, "text-halo-color": theme.halo, "text-halo-width": 1.4 },
      },
      {
        id: "water-name",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "water_name",
        minzoom: 10,
        layout: {
          "text-field": LABEL,
          "text-font": REGULAR,
          "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 16, 13],
          "text-max-width": 8,
        },
        paint: { "text-color": theme.waterLabel, "text-halo-color": theme.halo, "text-halo-width": 1.2 },
      },

      // POI symbol layers — ordered so healthcare wins collisions.
      ...poiLayers(groups, theme.halo),

      // Street numbers. Last in, highest zoom: the difference between "that
      // street" and "that door", which is the whole job on a home visit.
      {
        id: "housenumber",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "housenumber",
        minzoom: 17,
        layout: {
          "text-field": ["get", "housenumber"],
          "text-font": REGULAR,
          "text-size": 9.5,
          "text-padding": 2,
        },
        paint: { "text-color": theme.houseNumber, "text-halo-color": theme.halo, "text-halo-width": 1 },
      },

      // ── Places, on top of everything ────────────────────────────────────
      {
        id: "place-neighbourhood",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        minzoom: 13,
        filter: ["in", "class", "neighbourhood", "quarter", "suburb"],
        layout: {
          "text-field": LABEL,
          "text-font": REGULAR,
          "text-size": ["interpolate", ["linear"], ["zoom"], 13, 11, 17, 13],
          "text-transform": "uppercase",
          "text-letter-spacing": 0.08,
          "text-max-width": 9,
          "symbol-sort-key": ["to-number", ["get", "rank"], 100],
        },
        paint: { "text-color": theme.placeLabelMinor, "text-halo-color": theme.halo, "text-halo-width": 1.6 },
      },
      {
        id: "place-labels",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        filter: ["in", "class", "city", "town", "village"],
        layout: {
          "text-field": LABEL,
          "text-font": BOLD,
          "text-size": ["interpolate", ["linear"], ["zoom"], 4, 11, 10, 15, 16, 20],
          "text-max-width": 9,
          "symbol-sort-key": ["to-number", ["get", "rank"], 100],
        },
        paint: { "text-color": theme.placeLabel, "text-halo-color": theme.halo, "text-halo-width": 1.8 },
      },
    ],
  };
  return style as unknown as StyleSpecification;
}

const DAY: Theme = {
  name: "CareLink Cream",
  bg: "#EDE5CC",
  water: "#A0C8D8",
  waterLabel: "#3E7A93",
  wood: "#CFDDC6",
  park: "#CDDEC8",
  parkLabel: "#4A7A46",
  landuseResidential: "#E7DEC3",
  landuseCommercial: "#EADBC6",
  landuseIndustrial: "#E1D8C4",
  building: "#E4D9BB",
  buildingOutline: "#D8CBA8",
  roadCasing: "#FFFFFF",
  roadMinor: "#F7F2E4",
  roadSecondary: "#FBF7EC",
  roadPrimary: "#FFFFFF",
  roadMotorway: "#F2A28C",
  roadMotorwayCasing: "#E0846C",
  roadLabel: "#6B6250",
  halo: "#FBF6EC",
  placeLabel: "#2F2A22",
  placeLabelMinor: "#8A806B",
  houseNumber: "#A79A7C",
  poi: {
    health: "#C0392B",
    civic: "#0D0870",
    transport: "#4A6B8A",
    food: "#B06A2C",
    retail: "#7A6A52",
    leisure: "#4A7A46",
  },
};

const NIGHT: Theme = {
  name: "CareLink Night",
  bg: "#0B1020",
  water: "#12203A",
  waterLabel: "#5C87B5",
  wood: "#152036",
  park: "#152036",
  parkLabel: "#5E8F63",
  landuseResidential: "#101728",
  landuseCommercial: "#131A2C",
  landuseIndustrial: "#0F1626",
  building: "#141A2E",
  buildingOutline: "#1B2340",
  roadCasing: "#0A0F1C",
  roadMinor: "#26314F",
  roadSecondary: "#2C3960",
  roadPrimary: "#38477A",
  roadMotorway: "#7C5CFF",
  roadMotorwayCasing: "#2A2050",
  roadLabel: "#9AA6C4",
  halo: "#0B1020",
  placeLabel: "#E8EDFA",
  placeLabelMinor: "#8B97B8",
  houseNumber: "#5A678A",
  poi: {
    health: "#FF7B6B",
    civic: "#9FB0FF",
    transport: "#7FA3C7",
    food: "#E0A468",
    retail: "#9C917C",
    leisure: "#6FA873",
  },
};

/** Day style — cream/navy. Warm, high-legibility roads; coral motorways. */
export function creamMapStyle(): StyleSpecification {
  return buildStyle(DAY, MAPTILER_KEY);
}

/** Night style — deep navy. Used automatically after Maghrib. */
export function darkMapStyle(): StyleSpecification {
  return buildStyle(NIGHT, MAPTILER_KEY);
}

/**
 * Day or night by local prayer time — tracking screens use this so the map
 * matches the sky the professional is actually driving under.
 */
export function autoMapStyle(): StyleSpecification {
  return isAfterMaghrib() ? darkMapStyle() : creamMapStyle();
}
