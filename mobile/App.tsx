import './src/polyfills'
import React, { useEffect } from 'react'
import { ActivityIndicator, Modal, Pressable, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { DarkTheme, NavigationContainer, createNavigationContainerRef } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import * as SystemUI from 'expo-system-ui'
import { Ionicons } from '@expo/vector-icons'
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { FadeInUp, FadeOutUp, ZoomIn } from 'react-native-reanimated'
import { AppProvider, useApp } from './src/store'
import { Avatar, Button, Glass, GradText, Logo, T, Text } from './src/components/ui'
import { LoginScreen } from './src/screens/Login'
import { OnboardingScreen, RevealScreen } from './src/screens/Onboarding'
import { SwipeScreen } from './src/screens/Swipe'
import { SearchScreen } from './src/screens/Search'
import { ChatScreen, ChatsScreen } from './src/screens/Chats'
import { EditProfileScreen, MyProfileScreen, NewPostScreen, PersonScreen, PostScreen, QuizScreen } from './src/screens/Profile'
import { LegalScreen, ListsScreen, ReportScreen, SettingsScreen } from './src/screens/Settings'
import { C, GRAD } from './src/theme'
import type { Stack } from './src/nav'

SplashScreen.preventAutoHideAsync().catch(() => {})
SystemUI.setBackgroundColorAsync(C.bg).catch(() => {})

const S = createNativeStackNavigator<Stack>()
const Tab = createBottomTabNavigator()
const navRef = createNavigationContainerRef<Stack>()
const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, border: C.line, primary: C.ink, text: C.ink } }

/** Floating frosted-glass tab bar; the active tab gets a gradient pill. */
function TabIcon({ focused, name }: { focused: boolean; name: keyof typeof Ionicons.glyphMap }) {
  return focused
    ? <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 46, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={name} size={21} color="#fff" /></LinearGradient>
    : <View style={{ width: 46, height: 36, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={`${name}-outline` as keyof typeof Ionicons.glyphMap} size={22} color={C.muted} /></View>
}

function Tabs() {
  const app = useApp(), me = app.me!
  const insets = useSafeAreaInsets()
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <Tab.Navigator screenOptions={{
        headerShown: false, tabBarShowLabel: false, animation: 'shift',
        tabBarStyle: { position: 'absolute', bottom: insets.bottom + 10, height: 64, borderRadius: 26, borderTopWidth: 0, backgroundColor: 'transparent', elevation: 0, paddingTop: 13, marginHorizontal: 18 },
        tabBarBackground: () => <Glass style={{ flex: 1, borderRadius: 26 }} intensity={55} />,
      }}>
        <Tab.Screen name="Swipe" component={SwipeScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="flame" /> }} />
        <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="search" /> }} />
        <Tab.Screen name="Chats" component={ChatsScreen} options={{ tabBarBadge: app.badge || undefined, tabBarBadgeStyle: { backgroundColor: C.accent, fontSize: 10, top: -2 }, tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="chatbubbles" /> }} />
        <Tab.Screen name="Profile" component={MyProfileScreen} options={{ tabBarIcon: ({ focused }) => <View style={{ borderRadius: 17, borderWidth: 2, borderColor: focused ? C.accent : 'transparent', padding: 1 }}><Avatar name={me.name} photoURL={me.photoURL} hue={me.hue} size={28} /></View> }} />
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
          <Pressable onPress={() => { const id = app.toast?.matchId; app.setToast(null); if (id && navRef.isReady()) navRef.navigate('Chat', { matchId: id }) }}>
            <Glass style={{ borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }} intensity={60}>
              <LinearGradient colors={GRAD} style={{ width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chatbubble" size={16} color="#fff" /></LinearGradient>
              <Text numberOfLines={2} style={{ flex: 1, fontWeight: '600' }}>{app.toast.text}</Text>
            </Glass>
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
        <View style={{ flex: 1, backgroundColor: 'rgba(10,10,15,0.96)', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 }}>
          <GradText style={{ fontSize: 52, fontWeight: '800', letterSpacing: -2 }}>It&apos;s a match</GradText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 10 }}>
            <Animated.View entering={ZoomIn.springify()}><Avatar name={me.name} photoURL={me.photoURL} hue={me.hue} size={100} ring /></Animated.View>
            <LinearGradient colors={GRAD} style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginHorizontal: -18, zIndex: 2, borderWidth: 3, borderColor: C.bg }}><Ionicons name="heart" size={20} color="#fff" /></LinearGradient>
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
  const [fonts] = useFonts({ PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold })
  useEffect(() => { if (fonts && app.stage !== 'loading') SplashScreen.hideAsync().catch(() => {}) }, [fonts, app.stage])
  if (!fonts || app.stage === 'loading') return <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>{fonts ? <Logo size={40} /> : <ActivityIndicator color="#fff" />}</View>
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
