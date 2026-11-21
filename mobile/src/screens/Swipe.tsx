import React, { useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useApp } from '../store'
import { SwipeCard, type Dir, type SwipeHandle } from '../components/SwipeCard'
import { Chip, Chips, Empty, Glass, Header, IconButton, Text } from '../components/ui'
import { C, GRAD, hueColor } from '../theme'
import type { Stack } from '../nav'
import { INTENT_LABEL, isActive, workLine, type Intent, type Person } from '../../../lib/social'
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
      <Header logo right={<IconButton icon="options-outline" onPress={() => setFilters(f => !f)} />} />
      {filters && <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}><Chips>{(['any', ...Object.keys(INTENT_LABEL)] as (Intent | 'any')[]).map(i => <Chip key={i} label={i === 'any' ? 'Anyone' : INTENT_LABEL[i as Intent]} on={intent === i} onPress={() => setIntent(i)} />)}</Chips></View>}
      <View style={{ flex: 1, marginHorizontal: 12, marginBottom: !top ? 96 : 0 }}>
        {!app.peopleLoaded ? <Empty icon="hourglass-outline" title="Loading…" />
          : !top ? <Empty icon="people-outline" title="You're all caught up" text="Check back later — new students join every day." />
          : <SwipeCard key={top.p.uid} ref={card} onSwiped={onSwiped} onTap={() => nav.navigate('Person', { person: top.p })} under={next ? <Card me={me} p={next.p} score={next.f.score} /> : undefined}>
            <Card me={me} p={top.p} score={top.f.score} reasons={top.f.reasons} />
          </SwipeCard>}
      </View>
      {!!top && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 26, paddingTop: 14, paddingBottom: 96 }}>
          <Act icon="close" color="#fff" size={60} onPress={() => card.current?.swipe('left')} />
          <Act icon="star" color={C.violet} size={48} onPress={() => card.current?.swipe('up')} />
          <Act icon="heart" color="#fff" size={68} grad onPress={() => card.current?.swipe('right')} />
        </View>
      )}
    </View>
  )
}

function Card({ me, p, score, reasons }: { me: Person; p: Person; score: number; reasons?: string[] }) {
  const t = typeInfo(jungOf(p)), tag = natureTags(p.nature)[0]
  const common = p.interests?.filter(i => me.interests.includes(i)) ?? []
  return (
    <View style={s.card}>
      {p.photoURL ? <Image source={{ uri: p.photoURL }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        : <LinearGradient colors={[hueColor(p.hue, 58), hueColor((p.hue + 60) % 360, 30), C.bg]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#ffffff26', fontSize: 190, fontWeight: '800' }}>{(p.name || '?')[0].toUpperCase()}</Text>
        </LinearGradient>}
      <LinearGradient colors={['rgba(0,0,0,0.35)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120 }} />
      <View style={s.topRow}>
        <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.pill}><Ionicons name="flash" size={13} color="#fff" /><Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{score}% · {fitLabel(score)}</Text></LinearGradient>
        {isActive(p) && <Glass style={[s.pill, { borderRadius: 999 }]} intensity={30}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.green }} /><Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Active</Text></Glass>}
      </View>
      <Glass style={s.info} intensity={45}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={{ fontSize: 30, fontWeight: '800', letterSpacing: -0.8 }}>{p.name}</Text>
          {!!p.age && <Text style={{ fontSize: 24, fontWeight: '500', color: '#ffffffcc' }}>{p.age}</Text>}
        </View>
        {!!workLine(p) && <View style={s.line}><Ionicons name="briefcase-outline" size={14} color="#ffffffb0" /><Text style={s.sub}>{workLine(p)}</Text></View>}
        {(quizTaken(p) || tag) && <View style={s.line}><Ionicons name="sparkles-outline" size={14} color="#ffffffb0" /><Text style={s.sub}>{[quizTaken(p) ? `${t.emoji} ${t.name}` : '', tag].filter(Boolean).join(' · ')}</Text></View>}
        {!!p.bio && <Text numberOfLines={2} style={{ color: '#ffffffe8', fontSize: 14.5, marginTop: 8, lineHeight: 21 }}>{p.bio}</Text>}
        {p.interests?.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {p.interests.slice(0, 4).map(i => common.includes(i)
              ? <LinearGradient key={i} colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tag}><Text style={s.tagText}>{i}</Text></LinearGradient>
              : <View key={i} style={[s.tag, { backgroundColor: 'rgba(255,255,255,0.14)' }]}><Text style={s.tagText}>{i}</Text></View>)}
          </View>
        )}
        {!!reasons?.[0] && <Text numberOfLines={1} style={{ color: '#ffffffb0', fontSize: 12.5, marginTop: 10 }}>✦ {reasons[0]}</Text>}
      </Glass>
    </View>
  )
}

function Act({ icon, color, size, grad, onPress }: { icon: keyof typeof Ionicons.glyphMap; color: string; size: number; grad?: boolean; onPress: () => void }) {
  const body = <Ionicons name={icon} size={size * 0.44} color={color} />
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.86 : 1 }] })}>
      {grad ? <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }, s.glow]}>{body}</LinearGradient>
        : <Glass style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }} intensity={30}>{body}</Glass>}
    </Pressable>
  )
}

const s = StyleSheet.create({
  card: { flex: 1, borderRadius: 30, overflow: 'hidden', backgroundColor: C.panel },
  topRow: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  info: { position: 'absolute', left: 10, right: 10, bottom: 10, borderRadius: 24, padding: 16 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  sub: { color: '#ffffffd0', fontSize: 13.5, fontWeight: '500' },
  tag: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  glow: { shadowColor: '#FF2D6F', shadowOpacity: 0.6, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 14 },
})
