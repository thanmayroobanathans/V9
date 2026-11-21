import React, { useEffect, useRef, useState } from 'react'
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useApp } from '../store'
import { Avatar, Button, Empty, Header, Row, T, Text } from '../components/ui'
import { C, GRAD } from '../theme'
import { LinearGradient } from 'expo-linear-gradient'
import type { Props, Stack } from '../nav'
import { watchMessages, type Match, type Message } from '../../../lib/social'
import { icebreakers } from '../../../lib/pulse-model'

const other = (m: Match, me: string) => m.memberUids.find(u => u !== me) ?? ''
const ago = (t: number) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d` }

export function ChatsScreen() {
  const app = useApp(), me = app.me!
  const nav = useNavigation<NativeStackNavigationProp<Stack>>()
  const open = app.matches.filter(m => m.status === 'open').sort((a, b) => b.lastAt - a.lastAt)
  const fresh = open.filter(m => !m.lastMessage), convos = open.filter(m => m.lastMessage)
  const pending = app.incoming.filter(f => f.status === 'pending')
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title={me.username} />
      <FlatList
        data={convos}
        keyExtractor={m => m.id}
        contentContainerStyle={{ paddingBottom: 110 }}
        ListHeaderComponent={<>
          {pending.length > 0 && <>
            <Text style={[T.b, { fontSize: 15, margin: 16, marginBottom: 4 }]}>Follow requests</Text>
            {pending.map(f => (
              <Row key={f.id}>
                <Avatar name={f.fromName} photoURL={f.fromPhoto} hue={f.fromHue} size={44} />
                <View style={{ flex: 1 }}><Text style={T.b}>{f.fromUsername}</Text><Text style={T.muted}>{f.fromName}</Text></View>
                <Button small title="Confirm" onPress={() => app.accept(f)} />
                <Button small kind="secondary" title="Delete" onPress={() => app.decline(f)} />
              </Row>
            ))}
          </>}
          {fresh.length > 0 && <>
            <Text style={[T.b, { fontSize: 15, margin: 16, marginBottom: 8 }]}>New matches</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingHorizontal: 16 }}>
              {fresh.map(m => { const o = m.members[other(m, me.uid)]; return (
                <Pressable key={m.id} onPress={() => nav.navigate('Chat', { matchId: m.id })} style={{ alignItems: 'center', gap: 6 }}>
                  <Avatar name={o?.name} photoURL={o?.photoURL} hue={o?.hue} size={68} ring /><Text style={{ color: C.ink, fontSize: 13 }}>{o?.name}</Text>
                </Pressable>) })}
            </ScrollView>
          </>}
          {convos.length > 0 && <Text style={[T.b, { fontSize: 15, margin: 16, marginBottom: 4 }]}>Messages</Text>}
        </>}
        ListEmptyComponent={!fresh.length && !pending.length ? <Empty icon="chatbubbles-outline" title="No chats yet" text="Match by swiping right, or follow someone and get accepted." /> : null}
        renderItem={({ item: m }) => {
          const o = m.members[other(m, me.uid)], unread = app.isUnread(m)
          return (
            <Row onPress={() => nav.navigate('Chat', { matchId: m.id })}>
              <Avatar name={o?.name} photoURL={o?.photoURL} hue={o?.hue} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={[T.b, { fontSize: 15 }]}>{o?.name}</Text>
                <Text numberOfLines={1} style={{ color: unread ? C.ink : C.muted, fontWeight: unread ? '600' : '400', fontSize: 13 }}>{m.lastSender === me.uid ? 'You: ' : ''}{m.lastMessage} · {ago(m.lastAt)}</Text>
              </View>
              {unread && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: C.accent }} />}
            </Row>
          )
        }}
      />
    </View>
  )
}

export function ChatScreen({ route, navigation }: Props<'Chat'>) {
  const app = useApp(), me = app.me!
  const m = app.matches.find(x => x.id === route.params.matchId)
  const [msgs, setMsgs] = useState<Message[]>([])
  const [count, setCount] = useState(100)
  const [more, setMore] = useState(false)
  const [text, setText] = useState('')
  const [confirm, setConfirm] = useState(false)
  const list = useRef<FlatList<Message>>(null)
  useEffect(() => { app.setOpenChatId(route.params.matchId); return () => app.setOpenChatId(null) }, [route.params.matchId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => watchMessages(route.params.matchId, count, (x, h) => { setMsgs(x); setMore(h) }, () => {}), [route.params.matchId, count])
  useEffect(() => { if (m) app.markRead(m.id, m.lastAt) }, [m?.lastAt]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!m) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><Header onBack={navigation.goBack} title="Chat" /><Empty icon="chatbubble-outline" title="Chat not found" /></SafeAreaView>
  const ouid = other(m, me.uid), o = m.members[ouid], person = app.byUid[ouid]
  const send = (t: string) => { const v = t.trim(); if (!v) return; app.send(m.id, v.slice(0, 1000)); setText('') }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderBottomWidth: 0.5, borderColor: C.line }}>
          <Pressable hitSlop={10} onPress={navigation.goBack} style={{ padding: 6 }}><Ionicons name="arrow-back" size={24} color={C.ink} /></Pressable>
          <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }} onPress={() => person && navigation.navigate('Person', { person })}>
            <Avatar name={o?.name} photoURL={o?.photoURL} hue={o?.hue} size={36} />
            <View><Text style={T.b}>{o?.name}</Text><Text style={T.muted}>{person?.username ?? ''}</Text></View>
          </Pressable>
          {confirm
            ? <><Button small kind="danger" title="Unmatch" onPress={() => { app.closeChat(m.id); navigation.goBack() }} /><Button small kind="ghost" title="Cancel" onPress={() => setConfirm(false)} /></>
            : <Pressable hitSlop={10} onPress={() => setConfirm(true)} style={{ padding: 6 }}><Ionicons name="ellipsis-vertical" size={20} color={C.ink} /></Pressable>}
        </View>
        <FlatList
          ref={list}
          data={msgs}
          keyExtractor={x => x.id}
          contentContainerStyle={{ padding: 12, gap: 4, flexGrow: 1, justifyContent: msgs.length ? 'flex-end' : 'center' }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={more ? <Button small kind="ghost" title="Load earlier messages" onPress={() => setCount(c => c + 100)} /> : null}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Avatar name={o?.name} photoURL={o?.photoURL} hue={o?.hue} size={88} />
              <Text style={[T.b, { fontSize: 17 }]}>{o?.name}</Text>
              <Text style={T.muted}>Say hi 👋</Text>
              {person && icebreakers(me.vector, person.vector).map(q => (
                <Pressable key={q} onPress={() => send(q)} style={{ backgroundColor: C.glass, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 11, borderWidth: 1, borderColor: C.glassBorder }}><Text style={{ color: C.ink }}>{q}</Text></Pressable>
              ))}
            </View>}
          renderItem={({ item: x }) => {
            const mine = x.senderUid === me.uid
            return (
              <Animated.View entering={FadeInDown.duration(180)} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%', opacity: x.pending ? 0.6 : 1 }}>
                {mine
                  ? <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, borderBottomRightRadius: 6, paddingHorizontal: 15, paddingVertical: 10 }}><Text style={{ color: '#fff', fontSize: 15, fontWeight: '500' }}>{x.text}</Text></LinearGradient>
                  : <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder, borderRadius: 22, borderBottomLeftRadius: 6, paddingHorizontal: 15, paddingVertical: 10 }}><Text style={{ fontSize: 15 }}>{x.text}</Text></View>}
              </Animated.View>
            )
          }}
        />
        {m.status === 'closed'
          ? <Text style={[T.muted, { textAlign: 'center', padding: 16 }]}>Chat closed</Text>
          : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 }}>
            <TextInput value={text} onChangeText={setText} placeholder="Message…" placeholderTextColor={C.muted} multiline maxLength={1000} style={{ flex: 1, color: C.ink, fontFamily: 'PlusJakartaSans_500Medium', backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 120 }} />
            <Pressable disabled={!text.trim()} onPress={() => send(text)} style={{ opacity: text.trim() ? 1 : 0.4 }}><LinearGradient colors={GRAD} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="arrow-up" size={22} color="#fff" /></LinearGradient></Pressable>
          </View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
