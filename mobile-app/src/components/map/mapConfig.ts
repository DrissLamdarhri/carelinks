// mapConfig.ts — basemap custom non-Google + configuration de skin
export const colors = {
  primary: '#FF6B35',
  secondary: '#004E89',
  neutralLight: '#F5F5F5',
  neutralDark: '#1A1A1A',
  success: '#10B981',
  error: '#EF4444',
  white: '#FFFFFF',
  black: '#000000',
};

export type TileProviderKey = 'maptiler' | 'osm' | 'stamen';

export const tileProviders: Record<TileProviderKey, { urlTemplate: string; attribution?: string; requiresKey?: boolean; note?: string }> = {
  maptiler: {
    // MapTiler est une bonne alternative visuelle à Google, rapide, et personnalisable.
    urlTemplate: 'https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=MAPTILER_KEY',
    attribution: '© MapTiler',
    requiresKey: true,
    note: 'Remplacer MAPTILER_KEY via getTileUrl() ou config native',
  },
  osm: {
    urlTemplate: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    requiresKey: false,
  },
  stamen: {
    urlTemplate: 'http://tile.stamen.com/toner/{z}/{x}/{y}.png',
    attribution: '© Stamen Design',
    requiresKey: false,
  },
};

export const defaultTileProvider: TileProviderKey = 'maptiler';

/**
 * getTileUrl — injecte une clé si nécessaire et retourne l'URL prête à être utilisée par UrlTile
 * Fournir { MAPTILER_KEY: '...' } depuis les secrets ou config d'expo.
 */
export function getTileUrl(provider: TileProviderKey = defaultTileProvider, keyReplacement?: { MAPTILER_KEY?: string }) {
  const p = tileProviders[provider];
  let url = p.urlTemplate;
  if (provider === 'maptiler') {
    const key = keyReplacement?.MAPTILER_KEY || '<YOUR_MAPTILER_KEY>'; // Remplacer en prod
    url = url.replace('MAPTILER_KEY', encodeURIComponent(key));
  }
  return url;
}

export const mapSkin = {
  useCustomTiles: true,
  provider: defaultTileProvider,
  // Option pour forcer une apparence non-Google (utile en Chine et pour un skin InDrive)
  tileZIndex: 0,
};
