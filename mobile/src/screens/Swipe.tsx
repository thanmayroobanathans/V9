import React, { useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useApp } from '../store'
import { SwipeCard, type Dir, type SwipeHandle } from '../components/SwipeCard'
import { Chip, Chips, Empty, Header } from '../components/ui'
import { C, hueColor } from '../theme'
import type { Stack } from '../nav'
import { INTENT_LABEL, isActive, type Intent, type Person } from '../../../lib/social'
import { fit, fitLabel, jungOf, quizTaken } from '../../../lib/match'
import { typeInfo } from '../../../lib/jung'
import { natureTags } from '../../../lib/nature'

export function SwipeScreen() {
  const app = useApp(), me = app.me!
  const nav = useNavigation<NativeStackNavigationProp<Stack>>()
  const [intent, setIntent] = useState<Intent | 'any'>('any')
  const [filters, setFilters] = useState(false)
  const card = useRef<SwipeHandle>(null)
  const deck = useMemo(() => app.candidates
    .filter(p => intent === 'any' || p.intent === intent)
    .map(p => ({ p, f: fit(me, p, app.taste) }))
    .sort((a, b) => (b.f.score + (isActive(b.p) ? 2 : 0)) - (a.f.score + (isActive(a.p) ? 2 : 0))), [app.candidates, me, app.taste, intent])
  const top = deck[0], next = deck[1]
  const onSwiped = (d: Dir) => { if (top) app.swipe(top.p, d === 'right' ? 'like' : d === 'left' ? 'pass' : 'super') }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header logo right={<Pressable hitSlop={10} onPress={() => setFilters(f => !f)}><Ionicons name="options-outline" size={24} color={C.ink} /></Pressable>} />
      {filters && <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}><Chips>{(['any', ...Object.keys(INTENT_LABEL)] as (Intent | 'any')[]).map(i => <Chip key={i} label={i === 'any' ? 'Anyone' : INTENT_LABEL[i as Intent]} on={intent === i} onPress={() => setIntent(i)} />)}</Chips></View>}
      <View style={{ flex: 1, marginHorizontal: 12, marginBottom: 4 }}>
        {!app.peopleLoaded ? <Empty icon="hourglass-outline" title="Loading…" />
          : !top ? <Empty icon="people-outline" title="You're all caught up" text="Check back later — new students join every day." />
          : <SwipeCard key={top.p.uid} ref={card} onSwiped={onSwiped} onTap={() => nav.navigate('Person', { person: top.p })} under={next ? <Card me={me} p={next.p} score={next.f.score} /> : undefined}>
            <Card me={me} p={top.p} score={top.f.score} reasons={top.f.reasons} />
          </SwipeCard>}
      </View>
      {!!top && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 22, paddingVertical: 12 }}>
          <Act icon="close" color="#fff" size={62} onPress={() => card.current?.swipe('left')} />
          <Act icon="star" color={C.accent} size={48} onPress={() => card.current?.swipe('up')} />
          <Act icon="heart" color="#fff" size={62} grad onPress={() => card.current?.swipe('right')} />
        </View>
      )}
    </View>
  )
}

function Card({ me, p, score, reasons }: { me: Person; p: Person; score: number; reasons?: string[] }) {
  const t = typeInfo(jungOf(p)), tag = natureTags(p.nature)[0]
  return (
    <View style={s.card}>
      {p.photoURL ? <Image source={{ uri: p.photoURL }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        : <LinearGradient colors={[hueColor(p.hue, 60), hueColor((p.hue + 50) % 360, 28), '#000']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#ffffff30', fontSize: 160, fontWeight: '800' }}>{(p.name || '?')[0].toUpperCase()}</Text>
        </LinearGradient>}
      {isActive(p) && <View style={s.live}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.green }} /><Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>Active now</Text></View>}
      <LinearGradient colors={['transparent', '#000000ee']} style={s.overlay}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>{p.name}{p.age ? `, ${p.age}` : ''}</Text>
            <Text style={{ color: '#ffffffcc', fontSize: 13, marginTop: 2 }}>{p.program} · {p.year}</Text>
          </View>
          <View style={s.score}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{score}<Text style={{ fontSize: 10 }}>%</Text></Text></View>
        </View>
        <Text style={{ color: '#fff', fontSize: 13, marginTop: 8 }}><Text style={{ fontWeight: '700' }}>{fitLabel(score)}</Text>{quizTaken(p) ? ` · ${t.emoji} ${t.name}` : ''}{tag ? ` · ${tag}` : ''}</Text>
        {!!reasons?.[0] && <Text style={{ color: '#ffffffcc', fontSize: 13, marginTop: 4 }}>{reasons[0]}</Text>}
        {!!p.bio && <Text numberOfLines={2} style={{ color: '#ffffffe6', fontSize: 14, marginTop: 8, lineHeight: 20 }}>{p.bio}</Text>}
        {p.interests?.length > 0 && <Text numberOfLines={1} style={{ color: '#e0f1ff', fontSize: 13, marginTop: 6 }}>{p.interests.map(i => `#${i.toLowerCase().replace(/\s+/g, '')}`).join('  ')}{me.interests.length ? '' : ''}</Text>}
      </LinearGradient>
    </View>
  )
}

function Act({ icon, color, size, grad, onPress }: { icon: keyof typeof Ionicons.glyphMap; color: string; size: number; grad?: boolean; onPress: () => void }) {
  const body = <Ionicons name={icon} size={size * 0.42} color={color} />
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.88 : 1 }] })}>
      {grad ? <LinearGradient colors={['#fa7e1e', '#d62976', '#962fbf']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>{body}</LinearGradient>
        : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>{body}</View>}
    </Pressable>
  )
}

const s = StyleSheet.create({
  card: { flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: C.panel, borderWidth: 1, borderColor: '#1a1a1a' },
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 80, paddingHorizontal: 18, paddingBottom: 18 },
  score: { width: 52, height: 52, borderRadius: 26, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  live: { position: 'absolute', top: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0009', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
})
