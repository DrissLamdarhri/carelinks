import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text as RNText } from 'react-native';
import Svg, {
  Defs,
  Pattern,
  Rect,
  Line,
  RadialGradient,
  Stop,
  Ellipse,
  Path,
  Circle,
  G,
  Text as SvgText,
} from 'react-native-svg';

type Props = {
  lat?: number;
  lng?: number;
  style?: any;
};

export default function MapSection({ lat = 33.5731, lng = -5.5398, style }: Props) {
  const pinX = 235;
  const pinY = 210;

  // phase cycles 0..3 (we use modulo 3); increment ~0.048 per 16ms tick
  const phaseRef = useRef(0);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      phaseRef.current = (phaseRef.current + 0.048) % 3;
      // setState to force re-render for animated rings
      setPhase(phaseRef.current);
    }, 16);
    return () => clearInterval(id);
  }, []);

  const contours = [
    'M 60,120 Q 150,100 250,115 Q 330,125 390,110',
    'M 50,145 Q 160,128 260,140 Q 345,148 400,135',
    'M 45,175 Q 140,160 235,170 Q 330,178 405,165',
    'M 42,205 Q 130,195 220,200 Q 315,205 408,195',
    'M 50,240 Q 140,232 225,235 Q 315,238 400,228',
    'M 60,270 Q 145,265 230,268 Q 318,272 395,262',
    'M 95,318 Q 168,316 240,318 Q 316,320 375,314',
  ];

  const roads = [
    'M 40,140 Q 120,155 235,210 Q 310,185 380,160',
    'M 235,210 Q 260,250 285,275 Q 310,310 330,300',
    'M 120,175 Q 175,195 235,210',
    'M 235,210 Q 240,170 260,140 Q 290,100 340,80',
    'M 100,250 Q 160,240 235,210 Q 260,200 295,235',
  ];

  const cities = [
    { name: 'Meknès', nameAr: 'مكناس', x: 235, y: 210, major: true },
    { name: 'Fès', nameAr: 'فاس', x: 310, y: 185, major: true },
    { name: 'Rabat', nameAr: 'الرباط', x: 120, y: 175, major: false },
    { name: 'Khénifra', nameAr: 'خنيفرة', x: 285, y: 275, major: false },
    { name: 'Ifrane', nameAr: 'إفران', x: 295, y: 235, major: false },
    { name: 'Salé', nameAr: 'سلا', x: 110, y: 165, major: false },
    { name: 'Midelt', nameAr: 'ميدلت', x: 330, y: 300, major: false },
  ];

  return (
    <View style={[styles.container, style]}>
      <Svg viewBox="0 0 440 360" preserveAspectRatio="xMidYMid slice" style={styles.svg}>
        <Defs>
          {/* Subtle grid pattern 24x24 */}
          <Pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <Rect x="0" y="0" width="24" height="24" fill="none" />
            <Line x1="0" y1="0" x2="24" y2="0" stroke="#4a9eff" strokeOpacity={0.10} strokeWidth={1} />
            <Line x1="0" y1="0" x2="0" y2="24" stroke="#4a9eff" strokeOpacity={0.10} strokeWidth={1} />
          </Pattern>

          <RadialGradient id="area-fill" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#1a4a8a" stopOpacity={0.3} />
            <Stop offset="100%" stopColor="#0a1628" stopOpacity={0} />
          </RadialGradient>

          <RadialGradient id="pin-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#00d4ff" stopOpacity={0.6} />
            <Stop offset="100%" stopColor="#00d4ff" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* Background + grid */}
        <Rect x={0} y={0} width="100%" height="100%" fill="#0a1628" />
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#grid)" opacity={0.08} />

        {/* Terrain ellipse + meknes polygonal region */}
        <Ellipse cx={220} cy={210} rx={200} ry={160} fill="url(#area-fill)" />
        <Path
          d="M 180,160 Q 235,150 290,165 Q 320,180 330,220 Q 310,260 270,270 Q 220,275 185,255 Q 155,235 160,200 Z"
          fill="#1a3a6a"
          fillOpacity={0.15}
          stroke="#2a5a9a"
          strokeWidth={0.5}
          strokeOpacity={0.3}
        />

        {/* Contours */}
        {contours.map((d, i) => (
          <Path
            key={`cont-${i}`}
            d={d}
            fill="none"
            stroke="#1e4a8a"
            strokeWidth={i % 2 === 0 ? 1.2 : 0.6}
            strokeOpacity={i % 2 === 0 ? 0.5 : 0.25}
          />
        ))}

        {/* Roads with halo */}
        {roads.map((d, i) => (
          <G key={`road-${i}`}>
            <Path d={d} fill="none" stroke="#f0a820" strokeWidth={5} strokeOpacity={0.06} />
            <Path
              d={d}
              fill="none"
              stroke="#f0a820"
              strokeWidth={i === 0 ? 1.2 : 1.2}
              strokeOpacity={0.5}
              strokeDasharray={i === 0 ? undefined : '6 3'}
            />
          </G>
        ))}

        {/* 5km ring */}
        <Circle
          cx={pinX}
          cy={pinY}
          r={38}
          fill="#00d4ff"
          fillOpacity={0.04}
          stroke="#00d4ff"
          strokeWidth={1}
          strokeOpacity={0.3}
          strokeDasharray="4 3"
        />
        <Circle cx={pinX} cy={pinY} r={38} fill="none" stroke="#00d4ff" strokeWidth={6} strokeOpacity={0.06} />

        {/* Animated sonar rings (driven by phase state) */}
        {[0, 1, 2].map((i) => {
          const t = ((phase + i) % 3) / 3;
          const r = 8 + t * 52;
          const op = Math.max(0, 1 - t * 1.4);
          const sw = [1.5, 1.2, 0.9][i];
          return (
            <Circle
              key={`ring-${i}`}
              cx={pinX}
              cy={pinY}
              r={r}
              fill="none"
              stroke="#00d4ff"
              strokeWidth={sw}
              strokeOpacity={op}
            />
          );
        })}

        {/* Cities */}
        {cities.map((city) => (
          <G key={`city-${city.name}`}>
            <Circle
              cx={city.x}
              cy={city.y}
              r={city.major ? 10 : 7}
              fill="#4a9eff"
              fillOpacity={0.15}
            />
            <Circle
              cx={city.x}
              cy={city.y}
              r={city.major ? 5 : 3}
              fill={city.major ? '#4a9eff' : '#2a6acc'}
              fillOpacity={0.95}
            />

            {/* Labels FR above */}
            <SvgText
              x={city.x + (city.name === 'Meknès' ? -8 : 10)}
              y={city.y - 8}
              fontSize={city.major ? 9 : 7.5}
              fill="#a8c8f0"
              fontWeight={city.major ? '700' : '600'}
            >
              {city.name}
            </SvgText>

            {/* Labels AR below */}
            <SvgText x={city.x + (city.name === 'Meknès' ? -8 : 10)} y={city.y + 4} fontSize={city.major ? 7.5 : 6.5} fill="#4a7aaa">
              {city.nameAr}
            </SvgText>
          </G>
        ))}

        {/* Watermark */}
        <SvgText x="380" y="340" fontSize={11} fill="#1e4a7a" fontWeight="700" textAnchor="end" letterSpacing={3}>
          MAROC
        </SvgText>

        {/* Pin glow + drop + inner circle */}
        <Circle cx={pinX} cy={pinY} r={22} fill="url(#pin-glow)" />
        <G>
          <Path
            d={`M ${pinX},${pinY - 22} C ${pinX - 10},${pinY - 22} ${pinX - 14},${pinY - 12} ${pinX - 14},${pinY - 6} C ${pinX - 14},${pinY + 4} ${pinX},${pinY + 16} ${pinX},${pinY + 16} C ${pinX},${pinY + 16} ${pinX + 14},${pinY + 4} ${pinX + 14},${pinY - 6} C ${pinX + 14},${pinY - 12} ${pinX + 10},${pinY - 22} ${pinX},${pinY - 22} Z`}
            fill="#00d4ff"
            fillOpacity={0.95}
          />
          <Circle cx={pinX} cy={pinY - 9} r={4.5} fill="#0a1628" fillOpacity={0.9} />
        </G>
      </Svg>

      {/* Top overlay */}
      <View style={styles.topNav} pointerEvents="box-none">
        <TouchableOpacity style={styles.iconBtn} accessibilityLabel="Retour">
          <RNText style={styles.iconText}>←</RNText>
        </TouchableOpacity>

        <View style={styles.searchBadge}>
          <View style={styles.pulseDot} />
          <RNText style={styles.searchText} numberOfLines={1}>
            Al Mansour 3, Meknès
          </RNText>
        </View>

        <TouchableOpacity style={[styles.iconBtn, styles.gpsBtn]} accessibilityLabel="GPS">
          <RNText style={{ color: '#67e8f9', fontWeight: '700' }}>⊕</RNText>
        </TouchableOpacity>
      </View>

      {/* Bottom overlay */}
      <View style={styles.bottomStrip} pointerEvents="box-none">
        <View style={styles.smallDot} />
        <RNText style={styles.coordText}>33.5731, -5.5398</RNText>
        <RNText style={styles.dotSep}>·</RNText>

        <View style={styles.radiusBadge}>
          <RNText style={styles.radiusText}>rayon 5 km</RNText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 260,
    width: '100%',
    position: 'relative',
    backgroundColor: '#0a1628',
    overflow: 'hidden',
  },
  svg: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  topNav: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 500,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  iconText: { color: '#fff', fontWeight: '700' },
  searchBadge: {
    flex: 1,
    marginHorizontal: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#60a5fa', marginRight: 8 },
  searchText: { color: '#bfdbfe', fontSize: 11, fontWeight: '600' },

  gpsBtn: {
    backgroundColor: 'rgba(0,212,255,0.2)',
    borderColor: 'rgba(0,212,255,0.3)',
  },

  bottomStrip: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(10,22,40,0.85)',
    zIndex: 600,
  },
  smallDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22d3ee', marginRight: 8 },
  coordText: { color: '#67e8f9', fontFamily: 'monospace', fontSize: 12 },
  dotSep: { color: '#60a5fa', marginHorizontal: 8 },
  radiusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(0,212,255,0.1)', borderWidth: 1, borderColor: 'rgba(0,212,255,0.2)' },
  radiusText: { color: '#a5f3fc', fontSize: 11 },
});
