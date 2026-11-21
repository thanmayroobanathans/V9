import React, { useState } from 'react'
import { Pressable, ScrollView, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useApp } from '../store'
import { Avatar, Button, Header, Input, Row, T } from '../components/ui'
import { LegalView } from './Legal'
import { C } from '../theme'
import type { Props } from '../nav'
import { report } from '../../../lib/social'
import { quizTaken } from '../../../lib/match'

function SetRow({ title, sub, onPress, right, color }: { title: string; sub?: string; onPress?: () => void; right?: React.ReactNode; color?: string }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderColor: '#1a1a1a', backgroundColor: pressed ? '#0d0d0d' : 'transparent' })}>
      <View style={{ flex: 1 }}><Text style={{ color: color ?? C.ink, fontSize: 15 }}>{title}</Text>{!!sub && <Text style={T.muted}>{sub}</Text>}</View>{right}
    </Pressable>
  )
}

export function SettingsScreen({ navigation }: Props<'Settings'>) {
  const app = useApp(), me = app.me!
  const [typed, setTyped] = useState('')
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
      <Header title="Settings" onBack={navigation.goBack} />
      <ScrollView>
        <SetRow title="Location" sub={app.geo === 'denied' ? 'Blocked in Android settings' : 'Improves matches · never shown'} right={<Switch value={app.wantLocation} onValueChange={v => app.setWantLocation(v)} trackColor={{ true: C.accent }} />} />
        <SetRow title="Show my profile" sub="Off pauses swiping" right={<Switch value={me.visible} onValueChange={v => app.updateMe({ visible: v })} trackColor={{ true: C.accent }} />} />
        <SetRow title={quizTaken(me) ? 'Retake personality quiz' : 'Take personality quiz'} onPress={() => navigation.navigate('Quiz')} />
        <SetRow title="Report a problem" onPress={() => navigation.navigate('Report', {})} />
        <SetRow title="Terms of Use" onPress={() => navigation.navigate('Legal', { tab: 'terms' })} />
        <SetRow title="Privacy Policy" onPress={() => navigation.navigate('Legal', { tab: 'privacy' })} />
        <SetRow title="Log out" color={C.accent} onPress={() => app.signOut()} />
        <View style={{ padding: 16, gap: 10 }}>
          <Text style={{ color: C.danger, fontSize: 15 }}>Delete account</Text>
          <Text style={T.muted}>Type <Text style={T.b}>{me.username}</Text> to permanently delete your profile, posts and data.</Text>
          <Input value={typed} onChangeText={t => setTyped(t.trim().toLowerCase())} autoCapitalize="none" placeholder={me.username} />
          <Button kind="danger" title="Delete account" disabled={typed !== me.username} onPress={app.removeAccount} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

export function ListsScreen({ route, navigation }: Props<'Lists'>) {
  const app = useApp(), me = app.me!
  const [tab, setTab] = useState(route.params.tab)
  const followers = app.incoming.filter(f => f.status === 'accepted'), following = app.outgoing.filter(f => f.status === 'accepted')
  const list = tab === 'followers' ? followers : following
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <Header title={me.username} onBack={navigation.goBack} />
      <View style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderColor: C.line }}>
        {(['followers', 'following'] as const).map(t => (
          <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: tab === t ? '#fff' : 'transparent' }}>
            <Text style={{ color: tab === t ? C.ink : C.muted, fontWeight: '600' }}>{(t === 'followers' ? followers : following).length} {t}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView>
        {list.map(f => tab === 'followers'
          ? <Row key={f.id}><Avatar name={f.fromName} photoURL={f.fromPhoto} hue={f.fromHue} /><View style={{ flex: 1 }}><Text style={T.b}>{f.fromUsername}</Text><Text style={T.muted}>{f.fromName}</Text></View><Button small kind="secondary" title="Remove" onPress={() => app.decline(f)} /></Row>
          : <Row key={f.id}><Avatar name={f.toName} photoURL={f.toPhoto} hue={f.toHue} /><View style={{ flex: 1 }}><Text style={T.b}>{f.toUsername}</Text><Text style={T.muted}>{f.toName}</Text></View><Button small kind="secondary" title="Following" onPress={() => app.unfollow(f.toUid)} /></Row>)}
        {!list.length && <Text style={[T.muted, { textAlign: 'center', marginTop: 24 }]}>No one yet</Text>}
      </ScrollView>
    </SafeAreaView>
  )
}

const REASONS = ['Harassment or bullying', 'Ragging', 'Fake profile', 'Nudity or sexual content', 'Hate speech', 'Spam or scam', 'Under 18', 'Something else']
export function ReportScreen({ route, navigation }: Props<'Report'>) {
  const app = useApp(), target = route.params?.target
  const [reason, setReason] = useState<string | null>(null)
  const [detail, setDetail] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
      <Header title="Report" onBack={navigation.goBack} />
      {done ? <View style={{ alignItems: 'center', padding: 40, gap: 10 }}><Text style={{ fontSize: 40 }}>✓</Text><Text style={T.b}>Thanks for letting us know</Text><Text style={T.muted}>We review every report.</Text><Button title="Done" style={{ alignSelf: 'stretch', marginTop: 12 }} onPress={navigation.goBack} /></View> : (
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text style={[T.b, { fontSize: 16, padding: 16 }]}>{target ? `Why are you reporting @${target.username}?` : 'What went wrong?'}</Text>
          {REASONS.map(r => (
            <Pressable key={r} onPress={() => setReason(r)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderColor: '#1a1a1a' }}>
              <Text style={{ color: C.ink, fontSize: 15 }}>{r}</Text>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: reason === r ? 6 : 2, borderColor: reason === r ? C.accent : '#555' }} />
            </Pressable>
          ))}
          <View style={{ padding: 16, gap: 12 }}>
            <Input value={detail} onChangeText={setDetail} multiline maxLength={1000} placeholder="Add details (optional)" style={{ minHeight: 80, textAlignVertical: 'top' }} />
            <Button title="Submit report" disabled={!reason} busy={busy} onPress={async () => { setBusy(true); try { await report(app.me!.uid, target?.uid ?? '', reason!, detail); setDone(true) } catch { /* ignore */ } setBusy(false) }} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

export function LegalScreen({ route, navigation }: Props<'Legal'>) {
  return <LegalView initial={route.params.tab} onBack={navigation.goBack} />
}
