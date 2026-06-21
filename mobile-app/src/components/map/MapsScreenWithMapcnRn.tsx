// MapsScreenWithMapcnRn.tsx — écran principal (skin non-Google + suppression des UI natives)
/*
  Comportement:
  - Utilise UrlTile si disponible pour appliquer un skin alternatif (MapTiler / OSM / Stamen)
  - Essaie de désactiver les UI natives (barres/tooltips) via méthodes d'API connues (best-effort)
  - Affiche une bulle d'info custom (glass) au lieu de la barre native vue sur la capture
  - Ne dépend QUE de React Native et d'un Map SDK disponible via require (mapcn-rn ou react-native-maps)
*/

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { mapStyles } from './mapStyles';
import { getTileUrl, mapSkin, colors } from './mapConfig';

// permissive require typing
declare const require: any;

let MapModule: any = null;
try {
  MapModule = require('mapcn-rn');
} catch (e) {
  try {
    MapModule = require('react-native-maps');
  } catch (e2) {
    MapModule = null;
  }
}

const MapViewAny: any = MapModule && (MapModule.MapView || MapModule.default || MapModule.MapContainer || MapModule);
const UrlTileAny: any = MapModule && (MapModule.UrlTile || MapModule.TileOverlay || MapModule.UrlTile);

function hideNativeMapUI(mapRef: any) {
  // Best-effort: call common native methods to hide built-in overlays/toolbars/labels
  try {
    const ref = mapRef?.current;
    if (!ref) return;
    // react-native-maps props via setNativeProps
    if (typeof ref.setNativeProps === 'function') {
      ref.setNativeProps({ showsCompass: false, showsScale: false, showsMyLocationButton: false, toolbarEnabled: false });
    }
    // MapCN/map providers may expose specific methods
    if (typeof ref.setLogoEnabled === 'function') {
      try { ref.setLogoEnabled(false); } catch (e) { /* ignore */ }
    }
    if (typeof ref.disableMapGestures === 'function') {
      // nothing — example
    }
    // As a last resort, try to move built-in overlays out of view (hacky)
    if (ref.getMap && typeof ref.getMap === 'function') {
      try {
        const nativeMap = ref.getMap();
        if (nativeMap && nativeMap.setPadding) nativeMap.setPadding(0, 0, -1000, 0);
      } catch (e) {}
    }
  } catch (err) {
    console.warn('hideNativeMapUI failed', err);
  }
}

export const MapsScreenWithMapcnRn: React.FC = () => {
  const mapRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<{ lat: number; lng: number; label?: string } | null>(null);

  useEffect(() => {
    // try to hide native UI after a short delay so the native view has mounted
    const t = setTimeout(() => {
      hideNativeMapUI(mapRef);
    }, 800);
    return () => clearTimeout(t);
  }, []);

  const onMapPress = async (e: any) => {
    try {
      const coord = e?.nativeEvent?.coordinate || (e?.coordinate);
      if (!coord) return;
      setSelected({ lat: coord.latitude, lng: coord.longitude, label: `(${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)})` });
      // optionally, reverse-geocode here (Nominatim fallback)
      setLoading(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coord.latitude}&lon=${coord.longitude}`);
        const j = await res.json();
        if (j && j.display_name) setSelected({ lat: coord.latitude, lng: coord.longitude, label: j.display_name });
      } catch (err) {
        // ignore
      } finally {
        setLoading(false);
      }
      // hide native overlays again in case tapping revealed them
      hideNativeMapUI(mapRef);
    } catch (err) {
      console.warn('onMapPress error', err);
    }
  };

  if (!MapViewAny) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ marginBottom: 8 }}>Aucun map SDK détecté (mapcn-rn ou react-native-maps)</Text>
        <Text>Installer et rebuild natif pour voir la carte.</Text>
      </View>
    );
  }

  const tileUrl = mapSkin.useCustomTiles ? getTileUrl(mapSkin.provider as any) : null;

  return (
    <View style={mapStyles.container}>
      {/* Map */}
      {/* @ts-ignore */}
      <MapViewAny
        ref={mapRef}
        style={mapStyles.map}
        initialRegion={{ latitude: 39.9042, longitude: 116.4074, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
        showsCompass={false}
        showsScale={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        showsBuildings={false}
        onPress={onMapPress}
      >
        {tileUrl && UrlTileAny ? (
          // @ts-ignore UrlTile component props vary by provider; react-native-maps UrlTile accepts urlTemplate
          <UrlTileAny urlTemplate={tileUrl} maximumZ={19} tileSize={256} zIndex={mapSkin.tileZIndex} />
        ) : null}
      </MapViewAny>

      {/* Small mode badge top-left */}
      <View style={mapStyles.topLeftMode} pointerEvents="box-none">
        <Text style={mapStyles.topLeftText}>InDrive • Skin</Text>
      </View>

      {/* Custom info bubble (replaces native bar) */}
      {selected ? (
        <View style={mapStyles.infoBubble} pointerEvents="box-none">
          <View style={mapStyles.infoLeft}>
            <Text style={mapStyles.infoTitle}>{selected.label ?? 'Position sélectionnée'}</Text>
            <Text style={mapStyles.infoSubtitle}>{`${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)}`}</Text>
          </View>

          <View style={mapStyles.bubbleActions}>
            <TouchableOpacity style={[mapStyles.actionButton]} onPress={() => alert('Navigation') }>
              <Text style={mapStyles.actionText}>Aller</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // hint bubble when nothing selected
        <View style={[mapStyles.infoBubble, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: colors.neutralDark, fontWeight: '600' }}>Tapez pour sélectionner un point</Text>
        </View>
      )}

      {loading && (
        <View style={{ position: 'absolute', left: 0, right: 0, top: '50%', alignItems: 'center' }}>
          <ActivityIndicator size="large" />
        </View>
      )}
    </View>
  );
};

export default MapsScreenWithMapcnRn;
