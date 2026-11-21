import React, { useEffect, useState } from 'react'
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { watchPosts, type Person, type Post } from '../../../lib/social'
import { typeInfo, AXES, type Jung } from '../../../lib/jung'
import { jungOf, quizTaken } from '../../../lib/match'
import { natureTags } from '../../../lib/nature'
import { Avatar, Button, Empty, T } from './ui'
import { C } from '../theme'

const TILE = (Math.min(Dimensions.get('window').width, 600) - 4) / 3

/** Instagram-style profile: header with stats, bio, tags, actions and a 3-column post grid. */
export function ProfileView({ me, person, counts, actions, canSee, onOpenPost, onNewPost, onQuiz, onLists }: {
  me: Person; person: Person; counts?: { followers: number; following: number }; actions: React.ReactNode
  canSee: boolean; onOpenPost: (p: Post) => void; onNewPost?: () => void; onQuiz?: () => void; onLists?: (t: 'followers' | 'following') => void
}) {
  const [posts, setPosts] = useState<Post[] | null>(canSee ? null : [])
  useEffect(() => { if (!canSee) { setPosts([]); return } return watchPosts(person.uid, setPosts, () => setPosts([])) }, [person.uid, canSee])
  const isMe = me.uid === person.uid
  const t = typeInfo(jungOf(person)), tags = natureTags(person.nature)
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24, paddingHorizontal: 16, paddingVertical: 8 }}>
        <Avatar name={person.name} photoURL={person.photoURL} hue={person.hue} size={86} ring />
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
          <Stat n={canSee ? posts?.length ?? '–' : '–'} label="posts" />
          {counts
            ? <><Stat n={counts.followers} label="followers" onPress={() => onLists?.('followers')} /><Stat n={counts.following} label="following" onPress={() => onLists?.('following')} /></>
            : <Stat n={person.age || '–'} label="age" />}
        </View>
      </View>
      <View style={{ paddingHorizontal: 16, gap: 2 }}>
        <Text style={T.b}>{person.name}</Text>
        <Text style={T.muted}>{person.program} · {person.year}{quizTaken(person) ? ` · ${t.emoji} ${t.name}` : ''}{tags.length ? ` · ${tags[0]}` : ''}</Text>
        {!!person.bio && <Text style={[T.body, { marginTop: 4 }]}>{person.bio}</Text>}
        {person.interests?.length > 0 && <Text style={{ marginTop: 4, flexWrap: 'wrap' }}>{person.interests.map(i => <Text key={i} style={{ color: !isMe && me.interests.includes(i) ? C.accent : '#e0f1ff', fontWeight: !isMe && me.interests.includes(i) ? '600' : '400' }}>#{i.toLowerCase().replace(/\s+/g, '')}  </Text>)}</Text>}
      </View>
      {isMe && !quizTaken(person) && onQuiz && (
        <Pressable onPress={onQuiz} style={s.nudge}><Text style={{ fontSize: 22 }}>✨</Text><View><Text style={T.b}>Take the personality quiz</Text><Text style={T.muted}>Optional · 36 questions · better matches</Text></View></Pressable>
      )}
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginVertical: 12 }}>{actions}</View>
      <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: 'center', paddingVertical: 10 }}><Ionicons name="grid-outline" size={22} color={C.ink} /></View>
      {canSee ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
          {isMe && onNewPost && <Pressable onPress={onNewPost} style={[s.tile, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d0d0d', borderWidth: 1, borderStyle: 'dashed', borderColor: '#333' }]}><Ionicons name="add" size={30} color={C.muted} /></Pressable>}
          {posts === null && Array.from({ length: 5 }, (_, i) => <View key={i} style={[s.tile, { backgroundColor: '#161616' }]} />)}
          {posts?.map(p => (
            <Pressable key={p.id} onPress={() => onOpenPost(p)} style={({ pressed }) => [s.tile, { opacity: pressed ? 0.8 : 1 }]}>
              {p.image ? <Image source={{ uri: p.image }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} /> : <View style={s.textTile}><Text numberOfLines={5} style={{ color: '#fff', fontSize: 12, textAlign: 'center' }}>{p.text}</Text></View>}
            </Pressable>
          ))}
        </View>
      ) : <Empty icon="lock-closed-outline" title="This account is private" text="Follow to see their photos" />}
    </View>
  )
}

function Stat({ n, label, onPress }: { n: number | string; label: string; onPress?: () => void }) {
  return <Pressable onPress={onPress} disabled={!onPress} style={{ alignItems: 'center' }}><Text style={{ color: C.ink, fontSize: 17, fontWeight: '700' }}>{n}</Text><Text style={{ color: C.ink, fontSize: 13 }}>{label}</Text></Pressable>
}

export function TypeCard({ jung }: { jung: Jung }) {
  const t = typeInfo(jung)
  return (
    <View style={s.type}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <View style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 34 }}>{t.emoji}</Text></View>
        <View><Text style={[T.muted, { fontSize: 11, letterSpacing: 1.5 }]}>YOUR TYPE</Text><Text style={{ color: C.ink, fontSize: 24, fontWeight: '700' }}>{t.name}</Text></View>
      </View>
      <Text style={[T.body, { marginVertical: 12 }]}>{t.blurb}</Text>
      {AXES.map(a => (
        <View key={a.key} style={{ marginTop: 10 }}>
          <Text style={[T.muted, { fontSize: 11, letterSpacing: 1.2, marginBottom: 8 }]}>{a.label.toUpperCase()}</Text>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: C.panel2 }}><View style={{ position: 'absolute', left: `${jung[a.key] * 100}%`, top: -5, width: 16, height: 16, marginLeft: -8, borderRadius: 8, backgroundColor: '#000', borderWidth: 3, borderColor: '#fff' }} /></View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ color: jung[a.key] < 0.5 ? C.ink : C.muted, fontSize: 12, fontWeight: jung[a.key] < 0.5 ? '600' : '400' }}>{a.left}</Text>
            <Text style={{ color: jung[a.key] >= 0.5 ? C.ink : C.muted, fontSize: 12, fontWeight: jung[a.key] >= 0.5 ? '600' : '400' }}>{a.right}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

export function ActionButton(props: React.ComponentProps<typeof Button>) { return <Button small {...props} style={[{ flex: 1 }, props.style]} /> }

const s = StyleSheet.create({
  tile: { width: TILE, height: TILE, backgroundColor: '#121212', overflow: 'hidden' },
  textTile: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 10, backgroundColor: '#222' },
  nudge: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  type: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 18, padding: 18, marginVertical: 8 },
})
