import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Navigation } from "lucide-react";

// Vite doesn't resolve Leaflet's default marker image paths correctly out of
// the box (a well-known Leaflet + bundler issue) — without this the pin is
// invisible. Re-point at the package's own bundled PNGs.
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export type LatLng = { lat: number; lng: number };

const DEFAULT_CENTER: LatLng = { lat: 34.037, lng: -5.004 }; // Fès

function ClickCatcher({ onPick }: { onPick: (c: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

/** Re-centers the map imperatively when `center` changes from outside
 *  (e.g. the "Ma position" button) — MapContainer's own `center` prop only
 *  applies on first mount. */
function Recenter({ center }: { center: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng]);
  return null;
}

/**
 * Free, no-API-key map picker (OpenStreetMap tiles via Leaflet) — a yoga
 * class is a real physical place, same as a nurse home visit, so it gets a
 * real geocoded location instead of just free-text address/city. Mirrors
 * the mobile admin's map picker (mobile-app/app/admin/yoga-sessions.tsx),
 * writing to the same `set_yoga_session_location` RPC (migration 0049).
 */
export function YogaLocationPicker({
  coords,
  onChange,
}: {
  coords: LatLng | null;
  onChange: (c: LatLng) => void;
}) {
  const [locating, setLocating] = useState(false);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs" style={{ color: "#888780" }}>Localiser sur la carte (optionnel)</label>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs disabled:opacity-50"
          style={{ background: "#F3F3F5", color: "#0D0870", fontWeight: 600 }}
        >
          <Navigation size={12} /> {locating ? "Localisation…" : "Ma position"}
        </button>
      </div>
      <div style={{ height: 220, borderRadius: 14, overflow: "hidden", border: "1px solid #EFEFF2" }}>
        <MapContainer
          center={[coords?.lat ?? DEFAULT_CENTER.lat, coords?.lng ?? DEFAULT_CENTER.lng]}
          zoom={coords ? 15 : 12}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickCatcher onPick={onChange} />
          {coords ? <Recenter center={coords} /> : null}
          {coords ? <Marker position={[coords.lat, coords.lng]} /> : null}
        </MapContainer>
      </div>
      <p className="text-xs mt-1.5" style={{ color: "#B0B0B0" }}>
        {coords
          ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} — cliquez sur la carte pour ajuster`
          : "Cliquez sur la carte pour placer le point exact du studio."}
      </p>
    </div>
  );
}
