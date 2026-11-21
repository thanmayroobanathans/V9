import React, { useEffect, useMemo, useState } from 'react'
import { FlatList, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useApp } from '../store'
import { Avatar, Button, Header, Row, T } from '../components/ui'
import { C } from '../theme'
import type { Stack } from '../nav'
import { searchPeople, type Person } from '../../../lib/social'
import { fit } from '../../../lib/match'

export function SearchScreen() {
  const app = useApp(), me = app.me!
  const nav = useNavigation<NativeStackNavigationProp<Stack>>()
  const [q, setQ] = useState('')
  const [res, setRes] = useState<Person[]>([])
  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return }
    const t = setTimeout(() => { searchPeople(q).then(r => setRes(r.filter(p => p.uid !== me.uid))).catch(() => setRes([])) }, 250)
    return () => clearTimeout(t)
  }, [q, me.uid])
  // Suggested for you: best matches you don't follow yet, with a short reason.
  const suggestions = useMemo(() => app.people
    .filter(p => p.username && app.followState(p.uid) !== 'following')
    .map(p => ({ p, f: fit(me, p, app.taste) }))
    .sort((a, b) => b.f.score - a.f.score).slice(0, 25)
    .map(({ p, f }) => {
      const common = p.interests.filter(i => me.interests.includes(i))
      const same = p.program && p.program.toLowerCase() === me.program.toLowerCase()
      return { p, reason: same && p.year === me.year ? `Also ${p.program} · ${p.year}` : common.length >= 2 ? `${common.length} shared interests` : common.length === 1 ? `Also into ${common[0]}` : same ? `Also ${p.program}` : `${f.score}% match` }
    }), [app.people, app.outgoing, me, app.taste]) // eslint-disable-line react-hooks/exhaustive-deps
  const searching = q.trim().length >= 2
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header logo />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.panel2, borderRadius: 10, marginHorizontal: 16, paddingHorizontal: 12 }}>
        <Ionicons name="search" size={18} color={C.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search" placeholderTextColor={C.muted} autoCapitalize="none" autoCorrect={false} style={{ flex: 1, color: C.ink, paddingVertical: 10, fontSize: 15 }} />
        {!!q && <Ionicons name="close-circle" size={18} color={C.muted} onPress={() => setQ('')} />}
      </View>
      <FlatList
        data={searching ? res.map(p => ({ p, reason: `${p.name} · ${p.program}` })) : suggestions}
        keyExtractor={x => x.p.uid}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={!searching ? <Text style={[T.b, { fontSize: 15, marginHorizontal: 16, marginTop: 16, marginBottom: 4 }]}>Suggested for you</Text> : null}
        ListEmptyComponent={<Text style={[T.muted, { textAlign: 'center', marginTop: 24 }]}>{searching ? 'No accounts found' : 'No suggestions yet — more students are joining every day.'}</Text>}
        renderItem={({ item: { p, reason } }) => {
          const st = app.followState(p.uid)
          return (
            <Row onPress={() => nav.navigate('Person', { person: p })}>
              <Avatar name={p.name} photoURL={p.photoURL} hue={p.hue} size={44} />
              <View style={{ flex: 1 }}><Text style={T.b}>{p.username || p.name}</Text><Text style={T.muted}>{searching ? reason : p.name}</Text>{!searching && <Text style={[T.muted, { fontSize: 12 }]}>{reason}</Text>}</View>
              {!searching && (st === 'none' ? <Button small title="Follow" onPress={() => app.follow(p)} /> : <Button small kind="secondary" title={st === 'requested' ? 'Requested' : 'Following'} onPress={() => nav.navigate('Person', { person: p })} />)}
            </Row>
          )
        }}
      />
    </View>
  )
}
