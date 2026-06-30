import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import SonarRing from './SonarRing';

type Props = {
  coordinate: { latitude: number; longitude: number };
  variant?: 'default' | 'pending';
};

export default function MapMarker({ coordinate, variant = 'default' }: Props) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 800 }), withTiming(0, { duration: 800 })),
      -1,
      false
    );
  }, [pulse]);

  const outerStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulse.value, [0, 1], [1, 1.4]);
    const opacity = interpolate(pulse.value, [0, 1], [1, 0]);
    return {
      transform: [{ scale }],
      opacity,
    } as any;
  });

  const size = variant === 'pending' ? 40 : 56;
  const innerSize = variant === 'pending' ? 10 : 14;
  const color = variant === 'pending' ? '#7ee787' : '#00d4ff';

  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
      <View style={[styles.wrap, { width: size, height: size }]}> 
        {variant === 'default' && <SonarRing size={140} color="rgba(0,212,255,0.18)" duration={2000} />}

        <Animated.View style={[styles.outer, outerStyle, { borderColor: color }]} />

        <View style={[styles.inner, { width: innerSize, height: innerSize, borderRadius: innerSize / 2, backgroundColor: color }]} />

        {/* small tail to hint a pin */}
        <View style={[styles.tail, { borderTopColor: color }]} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outer: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  inner: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  tail: {
    position: 'absolute',
    bottom: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
