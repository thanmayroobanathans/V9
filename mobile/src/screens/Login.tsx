import React, { useEffect, useState } from 'react'
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { useApp } from '../store'
import { Button, GradText, Logo, Text, T } from '../components/ui'
import { LegalView } from './Legal'
import { C, GRAD } from '../theme'

const { width: W, height: H } = Dimensions.get('window')
const s = StyleSheet.create({ hero: { fontSize: 44, fontWeight: '800', letterSpacing: -1.5, lineHeight: 52 } })

/** A big soft glow that drifts slowly — two of them make the animated aura behind the logo. */
function Blob({ colors, size, from, to, duration }: { colors: readonly [string, string]; size: number; from: [number, number]; to: [number, number]; duration: number }) {
  const t = useSharedValue(0)
  useEffect(() => { t.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: from[0] + (to[0] - from[0]) * t.value }, { translateY: from[1] + (to[1] - from[1]) * t.value }, { scale: 1 + 0.15 * t.value }],
  }))
  return <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, opacity: 0.55 }, style]}><LinearGradient colors={colors} style={{ flex: 1, borderRadius: size / 2 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} /></Animated.View>
}

export function LoginScreen() {
  const app = useApp()
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null)
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Blob colors={['#FF2D6F', '#FF7A45']} size={W * 1.1} from={[-W * 0.35, -H * 0.12]} to={[-W * 0.05, H * 0.02]} duration={7000} />
      <Blob colors={['#8B5CF6', '#FF2D6F']} size={W * 1.0} from={[W * 0.35, H * 0.42]} to={[W * 0.05, H * 0.3]} duration={9000} />
      <LinearGradient colors={['rgba(10,10,15,0.15)', 'rgba(10,10,15,0.75)', C.bg]} locations={[0, 0.45, 0.8]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1, padding: 28, justifyContent: 'flex-end' }}>
        <Animated.View entering={FadeInDown.duration(600)} style={{ gap: 14, marginBottom: 36 }}>
          <Logo size={34} />
          <View>
            <Text style={s.hero}>Meet people who</Text>
            <GradText style={s.hero}>actually fit you.</GradText>
          </View>
          <Text style={{ color: C.muted, fontSize: 16, lineHeight: 23 }}>Swipe, match and chat — ranked by personality, not just photos.</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(150).duration(600)}>
          <Button title={busy ? 'Opening Google…' : 'Continue with Google'} icon="logo-google" disabled={!agreed} busy={busy}
            onPress={async () => { setBusy(true); await app.login(); setBusy(false) }} />
          <Pressable onPress={() => setAgreed(a => !a)} style={{ flexDirection: 'row', gap: 10, marginTop: 18, alignItems: 'flex-start' }}>
            {agreed
              ? <LinearGradient colors={GRAD} style={{ width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="checkmark" size={16} color="#fff" /></LinearGradient>
              : <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: C.muted }} />}
            <Text style={[T.muted, { flex: 1, lineHeight: 20 }]}>
              I&apos;m 18+ and agree to the <Text style={{ color: C.ink, fontWeight: '700' }} onPress={() => setLegal('terms')}>Terms</Text> and <Text style={{ color: C.ink, fontWeight: '700' }} onPress={() => setLegal('privacy')}>Privacy Policy</Text>.
            </Text>
          </Pressable>
          {!!app.error && <Text style={[T.error, { textAlign: 'center', marginTop: 16 }]}>{app.error}</Text>}
        </Animated.View>
      </SafeAreaView>
      <Modal visible={!!legal} animationType="slide" onRequestClose={() => setLegal(null)}>
        {legal && <LegalView initial={legal} onBack={() => setLegal(null)} />}
      </Modal>
    </View>
  )
}
