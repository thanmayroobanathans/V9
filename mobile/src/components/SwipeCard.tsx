/*
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of
 * the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Adapted from Alovoa (alovoa-expo, components/SwipeCard.tsx and CardStack.tsx) — changes for
 * VIT Pulse: super-like on swipe up, imperative swipe() for the buttons, tap handling, haptics,
 * a second card peeking underneath, and a LIKE / NOPE / SUPER stamp.
 */
import React, { forwardRef, useImperativeHandle } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { scheduleOnRN } from 'react-native-worklets'

const H_THRESHOLD = 120
const V_THRESHOLD = 110
const VELOCITY = 800

export type Dir = 'left' | 'right' | 'up'
export type SwipeHandle = { swipe: (d: Dir) => void }

type Props = { children: React.ReactNode; onSwiped: (d: Dir) => void; onTap?: () => void; under?: React.ReactNode }

export const SwipeCard = forwardRef<SwipeHandle, Props>(function SwipeCard({ children, onSwiped, onTap, under }, ref) {
  const { width, height } = useWindowDimensions()
  const x = useSharedValue(0)
  const y = useSharedValue(0)

  const fly = (d: Dir) => {
    'worklet'
    if (d === 'right') x.value = withTiming(width * 1.4, { duration: 240 }, () => scheduleOnRN(onSwiped, d))
    else if (d === 'left') x.value = withTiming(-width * 1.4, { duration: 240 }, () => scheduleOnRN(onSwiped, d))
    else y.value = withTiming(-height, { duration: 260 }, () => scheduleOnRN(onSwiped, d))
  }
  useImperativeHandle(ref, () => ({ swipe: (d: Dir) => fly(d) }))

  const pan = Gesture.Pan()
    .onUpdate(e => { x.value = e.translationX; y.value = e.translationY })
    .onEnd(e => {
      const horizontal = Math.abs(x.value) > Math.abs(y.value)
      if ((horizontal && x.value > H_THRESHOLD) || e.velocityX > VELOCITY) fly('right')
      else if ((horizontal && x.value < -H_THRESHOLD) || e.velocityX < -VELOCITY) fly('left')
      else if ((!horizontal && y.value < -V_THRESHOLD) || e.velocityY < -VELOCITY) fly('up')
      else { x.value = withSpring(0, { damping: 16 }); y.value = withSpring(0, { damping: 16 }) }
    })
  const tap = Gesture.Tap().maxDistance(8).onEnd((_e, ok) => { if (ok && onTap) scheduleOnRN(onTap) })
  const gesture = Gesture.Exclusive(pan, tap)

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${x.value / 18}deg` }],
  }))
  const underStyle = useAnimatedStyle(() => {
    const p = Math.min(1, Math.sqrt(x.value * x.value + y.value * y.value) / 160)
    return { transform: [{ scale: 0.94 + 0.06 * p }, { translateY: 14 - 14 * p }], opacity: 0.6 + 0.4 * p }
  })
  const like = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [20, 110], [0, 1], Extrapolation.CLAMP) }))
  const nope = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [-110, -20], [1, 0], Extrapolation.CLAMP) }))
  const sup = useAnimatedStyle(() => ({ opacity: Math.abs(x.value) < 60 ? interpolate(y.value, [-120, -30], [1, 0], Extrapolation.CLAMP) : 0 }))

  return (
    <View style={StyleSheet.absoluteFill}>
      {under && <Animated.View style={[StyleSheet.absoluteFill, underStyle]} pointerEvents="none">{under}</Animated.View>}
      <GestureDetector gesture={gesture}>
        <Animated.View style={[StyleSheet.absoluteFill, cardStyle]}>
          {children}
          <Animated.Text style={[s.stamp, s.like, like]}>LIKE</Animated.Text>
          <Animated.Text style={[s.stamp, s.nope, nope]}>NOPE</Animated.Text>
          <Animated.Text style={[s.stamp, s.super, sup]}>SUPER</Animated.Text>
        </Animated.View>
      </GestureDetector>
    </View>
  )
})

const s = StyleSheet.create({
  stamp: { position: 'absolute', top: 40, fontSize: 34, fontWeight: '900', letterSpacing: 2, borderWidth: 4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 2 },
  like: { left: 24, color: '#58c322', borderColor: '#58c322', transform: [{ rotate: '-14deg' }] },
  nope: { right: 24, color: '#ff4d4d', borderColor: '#ff4d4d', transform: [{ rotate: '14deg' }] },
  super: { alignSelf: 'center', top: '42%', color: '#3fa9ff', borderColor: '#3fa9ff' },
})
