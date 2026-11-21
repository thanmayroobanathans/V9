import './src/polyfills'
import React, { useEffect } from 'react'
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { DarkTheme, NavigationContainer, createNavigationContainerRef } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import * as SystemUI from 'expo-system-ui'
import { Ionicons } from '@expo/vector-icons'
import { useFonts, GrandHotel_400Regular } from '@expo-google-fonts/grand-hotel'
import Animated, { FadeInUp, FadeOutUp, ZoomIn } from 'react-native-reanimated'
import { AppProvider, useApp } from './src/store'
import { Avatar, Button, Logo, T } from './src/components/ui'
import { LoginScreen } from './src/screens/Login'
import { OnboardingScreen, RevealScreen } from './src/screens/Onboarding'
import { SwipeScreen } from './src/screens/Swipe'
import { SearchScreen } from './src/screens/Search'
import { ChatScreen, ChatsScreen } from './src/screens/Chats'
import { EditProfileScreen, MyProfileScreen, NewPostScreen, PersonScreen, PostScreen, QuizScreen } from './src/screens/Profile'
import { LegalScreen, ListsScreen, ReportScreen, SettingsScreen } from './src/screens/Settings'
import { C, LOGO_FONT } from './src/theme'
import type { Stack } from './src/nav'

SplashScreen.preventAutoHideAsync().catch(() => {})
SystemUI.setBackgroundColorAsync(C.bg).catch(() => {})

const S = createNativeStackNavigator<Stack>()
const Tab = createBottomTabNavigator()
const navRef = createNavigationContainerRef<Stack>()
const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, border: C.line, primary: C.ink, text: C.ink } }

function Tabs() {
  const app = useApp(), me = app.me!
  const insets = useSafeAreaInsets()
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <Tab.Navigator screenOptions={{ headerShown: false, tabBarShowLabel: false, tabBarActiveTintColor: '#fff', tabBarInactiveTintColor: '#fff', tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.line, height: 56 + insets.bottom, paddingTop: 6 }, animation: 'shift' }}>
        <Tab.Screen name="Swipe" component={SwipeScreen} options={{ tabBarIcon: ({ focused }) => <Ionicons name={focused ? 'flame' : 'flame-outline'} size={27} color="#fff" /> }} />
        <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarIcon: ({ focused }) => <Ionicons name={focused ? 'search' : 'search-outline'} size={26} color="#fff" /> }} />
        <Tab.Screen name="Chats" component={ChatsScreen} options={{ tabBarBadge: app.badge || undefined, tabBarBadgeStyle: { backgroundColor: C.like, fontSize: 10 }, tabBarIcon: ({ focused }) => <Ionicons name={focused ? 'chatbubble' : 'chatbubble-outline'} size={25} color="#fff" /> }} />
        <Tab.Screen name="Profile" component={MyProfileScreen} options={{ tabBarIcon: ({ focused }) => <View style={{ borderRadius: 15, borderWidth: focused ? 2 : 0, borderColor: '#fff', padding: 1 }}><Avatar name={me.name} photoURL={me.photoURL} hue={me.hue} size={26} /></View> }} />
      </Tab.Navigator>
    </SafeAreaView>
  )
}

function MainApp() {
  const app = useApp()
  return (
    <NavigationContainer ref={navRef} theme={theme}>
      <S.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: C.bg } }}>
        <S.Screen name="Tabs" component={Tabs} />
        <S.Screen name="Person" component={PersonScreen} />
        <S.Screen name="Chat" component={ChatScreen} />
        <S.Screen name="Post" component={PostScreen} />
        <S.Screen name="NewPost" component={NewPostScreen} options={{ animation: 'slide_from_bottom' }} />
        <S.Screen name="EditProfile" component={EditProfileScreen} />
        <S.Screen name="Quiz" component={QuizScreen} />
        <S.Screen name="Settings" component={SettingsScreen} />
        <S.Screen name="Lists" component={ListsScreen} />
        <S.Screen name="Report" component={ReportScreen} />
        <S.Screen name="Legal" component={LegalScreen} />
      </S.Navigator>
      <MatchModal />
      {app.toast && (
        <Animated.View entering={FadeInUp} exiting={FadeOutUp} style={{ position: 'absolute', top: 50, left: 16, right: 16 }}>
          <Pressable onPress={() => { const id = app.toast?.matchId; app.setToast(null); if (id && navRef.isReady()) navRef.navigate('Chat', { matchId: id }) }} style={{ backgroundColor: C.panel2, borderRadius: 14, padding: 14 }}>
            <Text numberOfLines={2} style={{ color: C.ink }}>💬 {app.toast.text}</Text>
          </Pressable>
        </Animated.View>
      )}
    </NavigationContainer>
  )
}

function MatchModal() {
  const app = useApp(), c = app.celebrate, me = app.me
  return (
    <Modal visible={!!c} transparent animationType="fade" onRequestClose={() => app.setCelebrate(null)}>
      {c && me && (
        <View style={{ flex: 1, backgroundColor: '#000000f0', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 }}>
          <Text style={{ fontFamily: LOGO_FONT, fontSize: 64, color: '#fff' }}>It&apos;s a match</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 10 }}>
            <Animated.View entering={ZoomIn.springify()}><Avatar name={me.name} photoURL={me.photoURL} hue={me.hue} size={100} ring /></Animated.View>
            <Ionicons name="heart" size={30} color={C.like} />
            <Animated.View entering={ZoomIn.delay(120).springify()}><Avatar name={c.other.name} photoURL={c.other.photoURL} hue={c.other.hue} size={100} ring /></Animated.View>
          </View>
          <Text style={[T.muted, { fontSize: 15 }]}>You and {c.other.name} liked each other</Text>
          <Button title="Send a message" icon="chatbubble" style={{ alignSelf: 'stretch' }} onPress={() => { const id = c.matchId; app.setCelebrate(null); if (navRef.isReady()) navRef.navigate('Chat', { matchId: id }) }} />
          <Button title="Keep swiping" kind="ghost" onPress={() => app.setCelebrate(null)} />
        </View>
      )}
    </Modal>
  )
}

function Root() {
  const app = useApp()
  const [fonts] = useFonts({ GrandHotel_400Regular })
  useEffect(() => { if (fonts && app.stage !== 'loading') SplashScreen.hideAsync().catch(() => {}) }, [fonts, app.stage])
  if (!fonts || app.stage === 'loading') return <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>{fonts ? <Logo size={52} /> : <ActivityIndicator color="#fff" />}</View>
  if (app.stage === 'gate') return <LoginScreen />
  if (app.stage === 'build') return <OnboardingScreen />
  if (app.stage === 'reveal') return <RevealScreen />
  return <MainApp />
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor={C.bg} />
        <AppProvider><Root /></AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
