import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import Svg, {
  Defs,
  RadialGradient,
  Stop,
  Ellipse,
  Path,
  Circle,
  G,
  Text as SvgText,
} from 'react-native-svg';
// dynamic reanimated require to avoid crash when API differs
let Reanimated: any = null;
let AnimatedCircle: any = Circle;
let useSharedValue: any = null;
let withRepeat: any = null;
let withTiming: any = null;
let useAnimatedProps: any = null;
try {
  Reanimated = require('react-native-reanimated');
  AnimatedCircle = Reanimated.createAnimatedComponent ? Reanimated.createAnimatedComponent(Circle) : Circle;
  useSharedValue = Reanimated.useSharedValue;
  withRepeat = Reanimated.withRepeat;
  withTiming = Reanimated.withTiming;
  useAnimatedProps = Reanimated.useAnimatedProps;
} catch (e) {
  Reanimated = null;
  AnimatedCircle = Circle;
}

const cities = [
  { name: 'Meknès', nameAr: 'مكناس', x: 235, y: 210, major: true },
  { name: 'Fès', nameAr: 'فاس', x: 310, y: 185, major: true },
  { name: 'Rabat', nameAr: 'الرباط', x: 120, y: 175, major: false },
  { name: 'Khénifra', nameAr: 'خنيفرة', x: 285, y: 275, major: false },
  { name: 'Ifrane', nameAr: 'إفران', x: 295, y: 235, major: false },
  { name: 'Salé', nameAr: 'سلا', x: 110, y: 165, major: false },
  { name: 'Midelt', nameAr: 'ميدلت', x: 330, y: 300, major: false },
];

const roads = [
  'M 40,140 Q 120,155 235,210 Q 310,185 380,160',
  'M 235,210 Q 260,250 285,275 Q 310,310 330,300',
  'M 120,175 Q 175,195 235,210',
  'M 235,210 Q 240,170 260,140 Q 290,100 340,80',
  'M 100,250 Q 160,240 235,210 Q 260,200 295,235',
];

const contours = [
  'M 60,120 Q 150,100 250,115 Q 330,125 390,110',
  'M 50,145 Q 160,128 260,140 Q 345,148 400,135',
  'M 45,175 Q 140,160 235,170 Q 330,178 405,165',
  'M 42,205 Q 130,195 220,200 Q 315,205 408,195',
  'M 50,240 Q 140,232 225,235 Q 315,238 400,228',
  'M 60,270 Q 145,265 230,268 Q 318,272 395,262',
  'M 75,295 Q 155,292 235,294 Q 318,298 388,290',
  'M 95,318 Q 168,316 240,318 Q 316,320 375,314',
];

export default function MapSectionNative({
  lat = 33.5731,
  lng = -5.5398,
  radiusKm = 5,
  onPress,
  primaryColor = '#00d4ff',
}: {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  onPress?: (lat: number, lng: number) => void;
  primaryColor?: string;
}) {
  // pulse cycles 0 -> 3 continuously (3s loop)
  let pulse: any = null;
  const [layout, setLayout] = useState({ w: 440, h: 360 });


  const pinX = 235;
  const pinY = 210;

  const onLayout = (e: any) => {
    const { width, height } = e.nativeEvent.layout;
    if (width && height) setLayout({ w: width, h: height });
  };

  const handleResponderRelease = (e: any) => {
    const { locationX, locationY } = e.nativeEvent;
    const relX = layout.w ? locationX / layout.w : 0.5;
    const relY = layout.h ? locationY / layout.h : 0.5;
    const nextLat = (lat || 33.5731) + (0.5 - relY) * 0.08;
    const nextLng = (lng || -5.5398) + (relX - 0.5) * 0.08;
    onPress?.(nextLat, nextLng);
  };

  // animated props for 3 rings (offset 0,1,2) - fallback if reanimated missing
  const hasReanimated = !!Reanimated && !!useSharedValue && !!withRepeat && !!withTiming && !!useAnimatedProps;
  if (hasReanimated) {
    pulse = useSharedValue(0);
    useEffect(() => {
      if (pulse) pulse.value = withRepeat(withTiming(3, { duration: 3000 }), -1);
    }, [pulse]);
  }

  let ring0: any = null;
  let ring1: any = null;
  let ring2: any = null;

  if (hasReanimated && pulse && useAnimatedProps) {
    ring0 = useAnimatedProps(() => {
      const p = ((pulse.value + 0) % 3) / 3;
      const r = 8 + p * 52;
      const op = Math.max(0, 1 - p * 1.4);
      return { r, strokeOpacity: op } as any;
    });
    ring1 = useAnimatedProps(() => {
      const p = ((pulse.value + 1) % 3) / 3;
      const r = 8 + p * 52;
      const op = Math.max(0, 1 - p * 1.4);
      return { r, strokeOpacity: op } as any;
    });
    ring2 = useAnimatedProps(() => {
      const p = ((pulse.value + 2) % 3) / 3;
      const r = 8 + p * 52;
      const op = Math.max(0, 1 - p * 1.4);
      return { r, strokeOpacity: op } as any;
    });
  }

  return (
    <View style={styles.wrapper} onLayout={onLayout} onStartShouldSetResponder={() => true} onResponderRelease={handleResponderRelease}>
      {/* Background gradient */}
      <View style={styles.bg} />

      {/* subtle grid is omitted for perf on RN; use low-opacity overlay if needed */}

      {/* SVG art */}
      <Svg viewBox="0 0 440 360" style={styles.svg} preserveAspectRatio="xMidYMid slice">
        <Defs>
          <RadialGradient id="area-fill" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#1a4a8a" stopOpacity={0.3} />
            <Stop offset="100%" stopColor="#0a1628" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="pin-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#00d4ff" stopOpacity={0.6} />
            <Stop offset="100%" stopColor="#00d4ff" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Ellipse cx="220" cy="210" rx="200" ry="160" fill="url(#area-fill)" />

        {/* contours */}
        {contours.map((d, i) => (
          <Path key={`cont-${i}`} d={d} fill="none" stroke="#1e4a8a" strokeWidth={i % 3 === 0 ? 1.2 : 0.6} strokeOpacity={i % 3 === 0 ? 0.5 : 0.25} />
        ))}

        {/* terrain region */}
        <Path
          d="M 180,160 Q 235,150 290,165 Q 320,180 330,220 Q 310,260 270,270 Q 220,275 185,255 Q 155,235 160,200 Z"
          fill="#1a3a6a"
          fillOpacity={0.15}
          stroke="#2a5a9a"
          strokeWidth={0.5}
          strokeOpacity={0.3}
        />

        {/* roads (soft + bright) */}
        {roads.map((d, i) => (
          <G key={`road-${i}`}>
            <Path d={d} fill="none" stroke="#c8930a" strokeWidth={3} strokeOpacity={0.08} />
            <Path d={d} fill="none" stroke="#f0a820" strokeWidth={1.2} strokeOpacity={0.5} strokeDasharray={i === 0 ? undefined : '6 3'} />
          </G>
        ))}

        {/* 5km ring */}
        <Circle cx={pinX} cy={pinY} r={38} fill="#00d4ff" fillOpacity={0.04} stroke="#00d4ff" strokeWidth={1} strokeOpacity={0.3} strokeDasharray="4 3" />
        <Circle cx={pinX} cy={pinY} r={38} fill="none" stroke="#00d4ff" strokeWidth={4} strokeOpacity={0.07} />

        {/* animated rings */}
        {hasReanimated && ring0 ? (
          <>
            <AnimatedCircle animatedProps={ring0} cx={pinX} cy={pinY} fill="none" stroke="#00d4ff" strokeWidth={1.5} />
            <AnimatedCircle animatedProps={ring1} cx={pinX} cy={pinY} fill="none" stroke="#00d4ff" strokeWidth={1.2} />
            <AnimatedCircle animatedProps={ring2} cx={pinX} cy={pinY} fill="none" stroke="#00d4ff" strokeWidth={0.9} />
          </>
        ) : (
          <>
            <Circle cx={pinX} cy={pinY} r={8} fill="none" stroke="#00d4ff" strokeWidth={1.5} strokeOpacity={0.6} />
            <Circle cx={pinX} cy={pinY} r={24} fill="none" stroke="#00d4ff" strokeWidth={1.2} strokeOpacity={0.35} />
            <Circle cx={pinX} cy={pinY} r={40} fill="none" stroke="#00d4ff" strokeWidth={0.9} strokeOpacity={0.18} />
          </>
        )}

        {/* city dots + soft halo */}
        {cities.map((city) => (
          <G key={`city-${city.name}`}>
            <Circle cx={city.x} cy={city.y} r={city.major ? 5 : 3} fill={city.major ? '#4a9eff' : '#2a6acc'} fillOpacity={0.9} />
            <Circle cx={city.x} cy={city.y} r={city.major ? 8 : 5} fill="#4a9eff" fillOpacity={0.15} />
          </G>
        ))}

        {/* labels */}
        {cities.map((city) => (
          <G key={`lbl-${city.name}`}>
            <SvgText x={city.x + (city.name === 'Meknès' ? -8 : 10)} y={city.y - 8} fontSize={city.major ? 9 : 7.5} fill="#a8c8f0" fontWeight={city.major ? '600' : '400'}>
              {city.name}
            </SvgText>
            <SvgText x={city.x + (city.name === 'Meknès' ? -8 : 10)} y={city.y + 4} fontSize={city.major ? 7.5 : 6.5} fill="#4a7aaa">
              {city.nameAr}
            </SvgText>
          </G>
        ))}

        {/* MAROC label */}
        <SvgText x="380" y="340" fontSize={11} fill="#1e4a7a" fontWeight="700" textAnchor="end" letterSpacing={3}>
          MAROC
        </SvgText>

        {/* pin glow + body */}
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

      {/* Top nav overlay (native RN views) */}
      <View style={styles.topNav} pointerEvents="box-none">
        <TouchableOpacity style={styles.iconBtn} onPress={() => {}} accessibilityLabel="Retour">
          <Text style={styles.iconText}>◀</Text>
        </TouchableOpacity>

        <View style={styles.searchBadge}>
          <View style={styles.pulseDot} />
          <Text style={styles.searchText} numberOfLines={1}>
            Al Mansour 3, Meknès
          </Text>
        </View>

        <TouchableOpacity style={[styles.iconBtn, styles.navBtn]} onPress={() => {}} accessibilityLabel="Navigation">
          <Text style={styles.iconText}>🧭</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom strip */}
      <View style={styles.bottomStrip} pointerEvents="box-none">
        <View style={styles.smallDot} />
        <Text style={styles.coordText}>33.5731, -5.5398</Text>
        <Text style={styles.dotSep}>·</Text>
        <View style={styles.radiusBadge}>
          <Text style={styles.radiusText}>rayon 5 km</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 260,
    width: '100%',
    position: 'relative',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  bg: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
    // gradient mimic using a solid background to preserve perf; complex gradients are in Svg
    // (no-op placeholder)
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
    top: 12,
    left: 12,
    right: 12,
    height: 40,
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
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  navBtn: {
    backgroundColor: 'rgba(0,212,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.18)',
  },
  iconText: { color: '#fff', fontWeight: '700' },
  searchBadge: {
    flex: 1,
    marginHorizontal: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4fb6ff', marginRight: 8 },
  searchText: { color: '#cfeeff', fontSize: 12, fontWeight: '600' },

  bottomStrip: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(10,22,40,0.9)',
    zIndex: 600,
  },
  smallDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#66e1ff', marginRight: 8 },
  coordText: { color: '#7fe7ff', fontSize: 12, fontFamily: 'monospace' },
  dotSep: { color: '#2aa3ff', marginHorizontal: 8 },
  radiusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(0,212,255,0.08)', borderWidth: 1, borderColor: 'rgba(0,212,255,0.12)' },
  radiusText: { color: '#bfeeff', fontSize: 12 },
});
