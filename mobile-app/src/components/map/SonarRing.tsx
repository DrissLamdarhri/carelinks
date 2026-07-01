import React, { useEffect } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';

type Props = {
  size?: number;
  color?: string;
  duration?: number;
  style?: ViewStyle | any;
};

export default function SonarRing({ size = 160, color = 'rgba(0,212,255,0.4)', duration = 2000, style }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    // animate progress 0 -> 1 repeatedly
    // Use a concrete easing function
    progress.value = withRepeat(withTiming(1, { duration, easing: Easing.out(Easing.ease) }), -1, false);
  }, [duration, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const s = interpolate(progress.value, [0, 1], [size * 0.16, size]);
    const opacity = interpolate(progress.value, [0, 0.7, 1], [1, 0.25, 0]);

    return {
      width: s,
      height: s,
      borderRadius: s / 2,
      borderWidth: 1.5,
      borderColor: color,
      opacity,
      transform: [{ translateX: -s / 2 }, { translateY: -s / 2 }],
    } as any;
  });

  return <Animated.View pointerEvents="none" style={[styles.container, animatedStyle, style]} />;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
});
