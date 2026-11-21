import React, { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInRight, FadeInUp } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { useApp, type Draft } from '../store'
import { Avatar, Button, Chip, Chips, Field, Input, Segmented, T } from '../components/ui'
import { TypeCard } from '../components/profile'
import { pickImage } from '../image'
import { C } from '../theme'
import { INTENT_LABEL, INTERESTS, USERNAME_RE, normaliseUsername, usernameOwner, type Intent } from '../../../lib/social'
import { QUESTIONS } from '../../../lib/pulse-model'

const YEARS = ['1st year', '2nd year', '3rd year', '4th year', '5th year', 'Masters', 'PhD']

/** Profile builder. onboard: 3 steps then optional quiz. edit: same steps, saves on Done. */
export function ProfileBuilder({ initial, mode, onDone, onCancel }: { initial: Draft; mode: 'onboard' | 'edit'; onDone: (d: Draft, answers?: number[]) => Promise<boolean | void>; onCancel?: () => void }) {
  const app = useApp()
  const [d, setD] = useState<Draft>(initial)
  const [step, setStep] = useState(0)
  const [quiz, setQuiz] = useState(false)
  const [nameOk, setNameOk] = useState(!!initial.username && USERNAME_RE.test(initial.username))
  const [photoErr, setPhotoErr] = useState('')
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(x => ({ ...x, [k]: v }))
  const steps = 3
  const valid = [nameOk && d.name.trim().length > 0 && d.age >= 18 && d.age <= 40 && d.program.trim().length > 0, d.interests.length >= 3, true]
  const last = step === steps - 1

  if (quiz) return <Quiz onBack={() => setQuiz(false)} onDone={a => onDone(d, a)} />

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 }}>
          {step > 0 || onCancel ? <Pressable hitSlop={10} onPress={() => step > 0 ? setStep(step - 1) : onCancel?.()} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="arrow-back" size={24} color={C.ink} /></Pressable> : <View style={{ width: 40 }} />}
          <View style={{ flexDirection: 'row', gap: 6 }}>{Array.from({ length: mode === 'onboard' ? 4 : 3 }, (_, i) => <View key={i} style={{ height: 6, width: i <= step ? 18 : 6, borderRadius: 3, backgroundColor: i <= step ? '#fff' : '#333' }} />)}</View>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Animated.View key={step} entering={FadeInRight.duration(250)}>
            {step === 0 && <>
              <View style={{ alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Pressable onPress={async () => { setPhotoErr(''); try { const u = await pickImage('avatar'); if (u) set('photoURL', u) } catch (e) { setPhotoErr((e as Error).message) } }}>
                  <Avatar name={d.name} photoURL={d.photoURL} hue={d.hue} size={112} />
                  <View style={{ position: 'absolute', right: 2, bottom: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: C.accent, borderWidth: 3, borderColor: C.bg, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="camera" size={15} color="#fff" /></View>
                </Pressable>
                <Text style={{ color: C.accent, fontWeight: '600' }}>{d.photoURL ? 'Change photo' : 'Add profile photo'}</Text>
                {!!photoErr && <Text style={T.error}>{photoErr}</Text>}
              </View>
              <UsernameField uid={d.uid} value={d.username} original={initial.username} onChange={(v, ok) => { set('username', v); setNameOk(ok) }} />
              <Field label="Name"><Input value={d.name} maxLength={24} placeholder="First name" onChangeText={t => set('name', t)} /></Field>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ width: 96 }}><Field label="Age"><Input value={d.age ? String(d.age) : ''} keyboardType="number-pad" maxLength={2} onChangeText={t => set('age', Number(t.replace(/\D/g, '')))} /></Field></View>
                <View style={{ flex: 1 }}><Field label="Program"><Input value={d.program} maxLength={32} placeholder="CSE, ECE, BBA…" onChangeText={t => set('program', t)} /></Field></View>
              </View>
              {d.age > 0 && d.age < 18 && <Text style={T.error}>18+ only</Text>}
              <Field label="Year"><Segmented value={d.year} onChange={v => set('year', v)} options={YEARS.map(y => ({ v: y, label: y.replace(' year', '') }))} /></Field>
            </>}

            {step === 1 && <>
              <Text style={T.title}>About you</Text>
              <Field label="Looking for"><Segmented<Intent> value={d.intent} onChange={v => set('intent', v)} options={(Object.keys(INTENT_LABEL) as Intent[]).map(v => ({ v, label: INTENT_LABEL[v] }))} /></Field>
              <Field label="Bio" hint={`${d.bio.length}/150`}><Input value={d.bio} maxLength={150} multiline numberOfLines={3} style={{ minHeight: 84, textAlignVertical: 'top' }} placeholder="Write something about yourself" onChangeText={t => set('bio', t)} /></Field>
              <Field label="Interests" hint="pick 3–6">
                <Chips>{INTERESTS.map(i => { const on = d.interests.includes(i); return <Chip key={i} label={i} on={on} disabled={!on && d.interests.length >= 6} onPress={() => set('interests', on ? d.interests.filter(x => x !== i) : [...d.interests, i])} /> })}</Chips>
              </Field>
            </>}

            {step === 2 && <>
              <Text style={T.title}>Location</Text>
              <Text style={[T.muted, { marginTop: 6, fontSize: 14 }]}>Helps us find people with a similar daily routine. Your location is never shown.</Text>
              <Pressable onPress={() => app.setWantLocation(!app.wantLocation)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, padding: 14, borderRadius: 10, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line }}>
                <Ionicons name="location-outline" size={20} color={C.ink} /><Text style={[T.body, { flex: 1 }]}>{app.wantLocation ? 'Location on' : 'Turn on location'}</Text>
                <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: app.wantLocation ? C.accent : '#3a3a3a', justifyContent: 'center', padding: 3 }}><View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: app.wantLocation ? 'flex-end' : 'flex-start' }} /></View>
              </Pressable>
              {app.geo === 'denied' && <Text style={T.error}>Location permission was denied. You can allow it later in Android settings.</Text>}
            </>}

            {!!app.error && <Text style={T.error}>{app.error}</Text>}
            {mode === 'onboard' && last ? <>
              <Button title="Take personality quiz" style={{ marginTop: 20 }} onPress={() => setQuiz(true)} />
              <Button title="Skip for now" kind="ghost" busy={app.saving} style={{ marginTop: 6 }} onPress={() => onDone(d)} />
              <Text style={[T.muted, { textAlign: 'center', marginTop: 6 }]}>The quiz is optional and improves your matches. You can take it later from your profile.</Text>
            </> : <Button title={mode === 'edit' && last ? 'Done' : 'Next'} disabled={!valid[step]} busy={app.saving && last} style={{ marginTop: 20 }} onPress={() => last ? onDone(d) : setStep(step + 1)} />}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function UsernameField({ uid, value, original, onChange }: { uid: string; value: string; original: string; onChange: (v: string, ok: boolean) => void }) {
  const [state, setState] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>(value && USERNAME_RE.test(value) ? 'ok' : 'idle')
  useEffect(() => {
    if (!value) { setState('idle'); onChange(value, false); return }
    if (!USERNAME_RE.test(value)) { setState('invalid'); onChange(value, false); return }
    if (value === original) { setState('ok'); onChange(value, true); return }
    setState('checking'); onChange(value, false)
    const t = setTimeout(() => { usernameOwner(value).then(o => { const ok = !o || o === uid; setState(ok ? 'ok' : 'taken'); onChange(value, ok) }).catch(() => { setState('ok'); onChange(value, true) }) }, 350)
    return () => clearTimeout(t)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  const border = state === 'ok' ? '#58c32288' : state === 'taken' || state === 'invalid' ? '#ff8a8a88' : C.line
  return (
    <Field label="Username">
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.panel, borderWidth: 1, borderColor: border, borderRadius: 8, paddingHorizontal: 12 }}>
        <Text style={{ color: C.muted }}>@</Text>
        <Input value={value} maxLength={20} autoCapitalize="none" autoCorrect={false} placeholder="yourname" style={{ flex: 1, borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 6 }} onChangeText={t => onChange(normaliseUsername(t), false)} />
        {state === 'ok' && <Ionicons name="checkmark" size={18} color={C.green} />}
      </View>
      <Text style={[T.muted, { color: state === 'taken' || state === 'invalid' ? '#ff8a8a' : C.muted, marginTop: 4, fontSize: 12 }]}>{state === 'taken' ? 'Taken' : state === 'invalid' ? '3–20 characters: a–z, 0–9, . _' : state === 'checking' ? 'Checking…' : ' '}</Text>
    </Field>
  )
}

/** The 36-question personality quiz (one question per screen). */
export function Quiz({ onDone, onBack }: { onDone: (answers: number[]) => void; onBack: () => void }) {
  const [answers, setAnswers] = useState<number[]>([])
  const total = QUESTIONS.length, q = Math.min(answers.length, total - 1), item = QUESTIONS[q]
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 30 }}>
        <Pressable hitSlop={10} onPress={() => answers.length ? setAnswers(answers.slice(0, -1)) : onBack()}><Ionicons name="arrow-back" size={24} color={C.ink} /></Pressable>
        <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: C.panel2, overflow: 'hidden' }}><View style={{ width: `${(answers.length / total) * 100}%`, height: '100%', backgroundColor: '#fff' }} /></View>
        <Text style={T.muted}>{answers.length + 1}/{total}</Text>
      </View>
      <Animated.View key={q} entering={FadeInUp.duration(220)}>
        <Text style={{ color: C.ink, fontSize: 26, fontWeight: '700', lineHeight: 32, marginBottom: 24 }}>{item.text}</Text>
        {item.options.map((o, i) => (
          <Pressable key={o} onPress={() => { const n = [...answers, i]; if (n.length === total) onDone(n); else setAnswers(n) }}
            style={({ pressed }) => ({ backgroundColor: pressed ? C.panel2 : C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 10, padding: 16, marginBottom: 10, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
            <Text style={{ color: C.ink, fontSize: 16, textAlign: 'center', fontWeight: '500' }}>{o}</Text>
          </Pressable>
        ))}
      </Animated.View>
    </SafeAreaView>
  )
}

export function OnboardingScreen() {
  const app = useApp()
  return <ProfileBuilder initial={app.blankDraft} mode="onboard" onDone={app.finishBuild} />
}

export function RevealScreen() {
  const app = useApp(), me = app.me!
  const took = (me.certainty ?? 0) > 0
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, alignItems: 'center' }}>
        <Avatar name={me.name} photoURL={me.photoURL} hue={me.hue} size={96} ring />
        <Text style={[T.title, { marginVertical: 14 }]}>You&apos;re all set, {me.name}</Text>
        <View style={{ alignSelf: 'stretch' }}>{took ? <TypeCard jung={me.jung} /> : <Text style={[T.muted, { textAlign: 'center' }]}>You can take the personality quiz anytime from your profile.</Text>}</View>
        <Button title="Start" style={{ alignSelf: 'stretch', marginTop: 20 }} onPress={() => app.setStage('app')} />
      </ScrollView>
    </SafeAreaView>
  )
}
