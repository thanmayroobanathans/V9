import React, { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming, withDelay } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import * as Haptics from 'expo-haptics'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useApp } from '../store'
import { Avatar, Button, Header, T } from '../components/ui'
import { ActionButton, ProfileView, TypeCard } from '../components/profile'
import { ProfileBuilder, Quiz } from './Onboarding'
import { pickImage } from '../image'
import { C } from '../theme'
import type { Props, Stack } from '../nav'
import { createPost, deletePost, likeInfo, setLike } from '../../../lib/social'
import { jungOf, quizTaken } from '../../../lib/match'

export function MyProfileScreen() {
  const app = useApp(), me = app.me!
  const nav = useNavigation<NativeStackNavigationProp<Stack>>()
  const followers = app.incoming.filter(f => f.status === 'accepted').length, following = app.outgoing.filter(f => f.status === 'accepted').length
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title={me.username} right={<Pressable hitSlop={10} onPress={() => nav.navigate('Settings')}><Ionicons name="menu" size={26} color={C.ink} /></Pressable>} />
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <ProfileView me={me} person={me} canSee counts={{ followers, following }}
          onOpenPost={post => nav.navigate('Post', { owner: me, post })} onNewPost={() => nav.navigate('NewPost')} onQuiz={() => nav.navigate('Quiz')} onLists={tab => nav.navigate('Lists', { tab })}
          actions={<><ActionButton kind="secondary" title="Edit profile" onPress={() => nav.navigate('EditProfile')} /><ActionButton kind="secondary" title="Settings" onPress={() => nav.navigate('Settings')} /></>} />
        {quizTaken(me) && <View style={{ paddingHorizontal: 16, marginTop: 16 }}><Text style={[T.b, { fontSize: 15 }]}>Personality</Text><TypeCard jung={jungOf(me)} /></View>}
      </ScrollView>
    </View>
  )
}

export function PersonScreen({ route, navigation }: Props<'Person'>) {
  const app = useApp(), me = app.me!
  const p = app.byUid[route.params.person.uid] ?? route.params.person
  const st = app.followState(p.uid), chat = app.chatWith(p.uid)
  const followsMe = app.incoming.some(f => f.fromUid === p.uid && f.status === 'accepted')
  const f = app.fitWith(p)
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <Header title={p.username || p.name} onBack={navigation.goBack} right={<Pressable hitSlop={10} onPress={() => navigation.navigate('Report', { target: p })}><Ionicons name="flag-outline" size={22} color={C.ink} /></Pressable>} />
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <ProfileView me={me} person={p} canSee={st === 'following'} onOpenPost={post => navigation.navigate('Post', { owner: p, post })}
          actions={<>
            {st === 'following' ? <ActionButton kind="secondary" title="Following" onPress={() => app.unfollow(p.uid)} />
              : st === 'requested' ? <ActionButton kind="secondary" title="Requested" onPress={() => app.unfollow(p.uid)} />
              : <ActionButton title={followsMe ? 'Follow back' : 'Follow'} onPress={() => app.follow(p)} />}
            {chat && <ActionButton kind="secondary" title="Message" onPress={() => navigation.navigate('Chat', { matchId: chat })} />}
          </>} />
        {f && f.reasons.length > 0 && (
          <View style={{ margin: 16, padding: 14, borderRadius: 14, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, gap: 4 }}>
            <Text style={T.b}>{f.score}% match</Text>
            {f.reasons.slice(0, 3).map(r => <Text key={r} style={T.muted}>• {r}</Text>)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

/** One post: double-tap the photo to like (heart burst). */
export function PostScreen({ route, navigation }: Props<'Post'>) {
  const app = useApp(), me = app.me!
  const { owner, post } = route.params
  const [info, setInfo] = useState<{ count: number; liked: boolean } | null>(null)
  const [confirm, setConfirm] = useState(false)
  const heart = useSharedValue(0)
  useEffect(() => { likeInfo(post.uid, post.id, me.uid).then(setInfo).catch(() => setInfo({ count: 0, liked: false })) }, [post.uid, post.id, me.uid])
  const set = async (on: boolean) => {
    if (!info || info.liked === on) return
    const prev = info
    setInfo({ count: info.count + (on ? 1 : -1), liked: on })
    if (on) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    try { await setLike(post.uid, post.id, me.uid, on) } catch { setInfo(prev) }
  }
  const burst = () => { heart.value = withSequence(withSpring(1.15, { damping: 8 }), withSpring(1), withDelay(350, withTiming(0, { duration: 200 }))); set(true) }
  const dbl = Gesture.Tap().numberOfTaps(2).runOnJS(true).onEnd(burst)
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heart.value }], opacity: heart.value > 0.05 ? 1 : 0 }))
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <Header title="Post" onBack={navigation.goBack} />
      <ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}><Avatar name={owner.name} photoURL={owner.photoURL} hue={owner.hue} size={32} /><Text style={T.b}>{owner.username}</Text></View>
        <GestureDetector gesture={dbl}>
          <View>
            {post.image ? <Image source={{ uri: post.image }} style={{ width: '100%', aspectRatio: 1 }} contentFit="cover" />
              : <View style={{ aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: '#222' }}><Text style={{ color: '#fff', fontSize: 20, textAlign: 'center', lineHeight: 28 }}>{post.text}</Text></View>}
            <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }, heartStyle]}><Ionicons name="heart" size={110} color="#fff" /></Animated.View>
          </View>
        </GestureDetector>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 }}>
          <Pressable hitSlop={10} onPress={() => set(!info?.liked)}><Ionicons name={info?.liked ? 'heart' : 'heart-outline'} size={28} color={info?.liked ? C.like : C.ink} /></Pressable>
          {owner.uid === me.uid && (confirm
            ? <View style={{ flexDirection: 'row', gap: 6 }}><Button small kind="danger" title="Delete" onPress={async () => { await deletePost(post.uid, post.id).catch(() => {}); navigation.goBack() }} /><Button small kind="ghost" title="Cancel" onPress={() => setConfirm(false)} /></View>
            : <Pressable onPress={() => setConfirm(true)}><Text style={T.muted}>Delete</Text></Pressable>)}
        </View>
        <View style={{ paddingHorizontal: 14, gap: 4 }}>
          <Text style={T.b}>{info ? `${info.count} ${info.count === 1 ? 'like' : 'likes'}` : ' '}</Text>
          {!!post.image && !!post.text && <Text style={T.body}><Text style={T.b}>{owner.username} </Text>{post.text}</Text>}
          <Text style={T.muted}>{new Date(post.at).toLocaleDateString([], { day: 'numeric', month: 'long' })}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

export function NewPostScreen({ navigation }: Props<'NewPost'>) {
  const app = useApp(), me = app.me!
  const [image, setImage] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const pick = async () => { setErr(''); try { const u = await pickImage('post'); if (u) setImage(u) } catch (e) { setErr((e as Error).message) } }
  useEffect(() => { pick() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const share = async () => { setBusy(true); try { await createPost(me.uid, text.trim(), image); navigation.goBack() } catch (e) { setErr((e as Error).message); setBusy(false) } }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
      <Header title="New post" onBack={navigation.goBack} right={<Pressable disabled={busy || (!text.trim() && !image)} onPress={share}><Text style={{ color: C.accent, fontWeight: '700', opacity: busy || (!text.trim() && !image) ? 0.4 : 1 }}>{busy ? 'Sharing…' : 'Share'}</Text></Pressable>} />
      <ScrollView keyboardShouldPersistTaps="handled">
        <Pressable onPress={pick} style={{ aspectRatio: 1, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center' }}>
          {image ? <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <><Ionicons name="images-outline" size={36} color={C.muted} /><Text style={[T.b, { marginTop: 8 }]}>Select a photo</Text></>}
        </Pressable>
        <TextInput value={text} onChangeText={setText} placeholder="Write a caption…" placeholderTextColor={C.muted} multiline maxLength={500} style={{ color: C.ink, fontSize: 15, padding: 16, minHeight: 90, textAlignVertical: 'top' }} />
        {!!err && <Text style={[T.error, { marginHorizontal: 16 }]}>{err}</Text>}
      </ScrollView>
    </SafeAreaView>
  )
}

export function EditProfileScreen({ navigation }: Props<'EditProfile'>) {
  const app = useApp()
  return <ProfileBuilder initial={app.me!} mode="edit" onCancel={navigation.goBack} onDone={async d => { if (await app.finishBuild(d)) navigation.goBack() }} />
}

export function QuizScreen({ navigation }: Props<'Quiz'>) {
  const app = useApp()
  return <Quiz onBack={navigation.goBack} onDone={async a => { await app.finishBuild(app.me!, a); navigation.goBack() }} />
}
