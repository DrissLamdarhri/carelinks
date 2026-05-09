/**
 * BookingMap — minimal SVG-based map with pin drop + radius circle.
 * Avoids heavy mapping libs in the Figma Make environment; renders a
 * stylized OSM-like canvas that captures lat/lng on click and reports it.
 */
import { useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import { toast } from "sonner";
import { geo } from "../../lib/db";

interface Props {
  initialLat?: number; initialLng?: number;
  radiusKm?: number;
  onChange?: (lat: number, lng: number) => void;
}

// Casablanca defaults
const DEFAULT_LAT = 33.5731;
const DEFAULT_LNG = -7.5898;

export function BookingMap({ initialLat = DEFAULT_LAT, initialLng = DEFAULT_LNG, radiusKm = 5, onChange }: Props) {
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [locating, setLocating] = useState(false);

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const pos = await geo.getCurrentPosition();
      setLat(pos.lat); setLng(pos.lng);
      onChange?.(pos.lat, pos.lng);
      toast.success("Position détectée");
    } catch {
      toast.error("Impossible de détecter votre position");
    } finally { setLocating(false); }
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const newLat = initialLat + (0.5 - y) * 0.1;
    const newLng = initialLng + (x - 0.5) * 0.1;
    setLat(newLat); setLng(newLng);
    onChange?.(newLat, newLng);
  };

  return (
    <div className="relative w-full h-[200px] rounded-2xl overflow-hidden bg-[#EDE5CC]">
      <svg viewBox="0 0 320 200" className="w-full h-full cursor-crosshair" onClick={handleClick}>
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#8ECFDF" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect width="320" height="200" fill="#EDE5CC" />
        <rect width="320" height="200" fill="url(#grid)" />
        <path d="M0,80 Q80,60 160,90 T320,80 L320,200 L0,200 Z" fill="#5BB8D4" opacity="0.25" />
        <path d="M40,40 L80,30 L120,50 L100,80 L60,70 Z" fill="#0D0870" opacity="0.08" />
        <circle cx="160" cy="100" r={radiusKm * 4} fill="#0D0870" opacity="0.12" stroke="#0D0870" strokeWidth="1" strokeDasharray="3 2" />
        <circle cx="160" cy="100" r="6" fill="#0D0870" stroke="white" strokeWidth="2" />
      </svg>

      <button onClick={useMyLocation} disabled={locating}
        className="absolute top-2 right-2 px-3 h-9 bg-white rounded-xl text-[12px] flex items-center gap-1.5 shadow-md"
        style={{ fontWeight: 600 }}>
        <Navigation size={12} />{locating ? "…" : "Ma position"}
      </button>
      <div className="absolute bottom-2 left-2 right-2 bg-white/95 rounded-xl px-3 py-1.5 flex items-center gap-2">
        <MapPin size={12} className="text-[#0D0870]" />
        <span className="text-[11px] text-[#1A1A1A] truncate">
          {lat.toFixed(4)}, {lng.toFixed(4)} · rayon {radiusKm} km
        </span>
      </div>
    </div>
  );
}
