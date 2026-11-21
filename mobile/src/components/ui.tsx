import React from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text as RNText, TextInput, View, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import MaskedView from '@react-native-masked-view/masked-view'
import { Ionicons } from '@expo/vector-icons'
import { AURA, C, F, GRAD, RING, hueColor } from '../theme'

/** Text in Plus Jakarta Sans; fontWeight picks the matching font file (Android needs one per weight). */
export function Text({ style, ...props }: TextProps) {
  const s = (StyleSheet.flatten(style) ?? {}) as TextStyle
  const w = String(s.fontWeight ?? '400')
  const family = w === '800' || w === '900' ? F.xb : w === '700' || w === 'bold' ? F.b : w === '600' ? F.sb : w === '500' ? F.m : F.r
  return <RNText {...props} style={[{ color: C.ink }, s, { fontFamily: s.fontFamily ?? family, fontWeight: undefined }]} />
}

export function GradText({ children, style, colors = GRAD }: { children: React.ReactNode; style?: StyleProp<TextStyle>; colors?: readonly [string, string, ...string[]] }) {
  return (
    <MaskedView maskElement={<Text style={style}>{children}</Text>}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}><Text style={[style, { opacity: 0 }]}>{children}</Text></LinearGradient>
    </MaskedView>
  )
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.18 }}>
      <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size * 1.05, height: size * 1.05, borderRadius: size * 0.32, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="pulse" size={size * 0.72} color="#fff" />
      </LinearGradient>
      <Text style={{ fontWeight: '800', fontSize: size, letterSpacing: -size * 0.04, color: '#fff' }}>pulse</Text>
    </View>
  )
}

/** Frosted-glass surface. */
export function Glass({ children, style, intensity = 40 }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; intensity?: number }) {
  return (
    <View style={[{ overflow: 'hidden', borderWidth: 1, borderColor: C.glassBorder, backgroundColor: 'rgba(20,20,30,0.45)' }, style]}>
      <BlurView intensity={intensity} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  )
}

export function Avatar({ name, photoURL, hue, size = 44, ring }: { name?: string; photoURL?: string | null; hue?: number; size?: number; ring?: boolean }) {
  const inner = ring ? size - 7 : size
  const face = (
    <View style={{ width: inner, height: inner, borderRadius: inner / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      {photoURL
        ? <Image source={{ uri: photoURL }} style={{ width: inner, height: inner }} contentFit="cover" transition={150} />
        : <LinearGradient colors={[hueColor(hue ?? 330), hueColor(((hue ?? 330) + 50) % 360, 35)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: inner * 0.42 }}>{(name || '?')[0].toUpperCase()}</Text>
        </LinearGradient>}
    </View>
  )
  if (!ring) return face
  return (
    <LinearGradient colors={RING} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>{face}</View>
    </LinearGradient>
  )
}

type BtnKind = 'primary' | 'secondary' | 'ghost' | 'danger'
export function Button({ title, onPress, kind = 'primary', disabled, busy, icon, style, small }: {
  title: string; onPress?: () => void; kind?: BtnKind; disabled?: boolean; busy?: boolean; icon?: keyof typeof Ionicons.glyphMap; style?: StyleProp<ViewStyle>; small?: boolean
}) {
  const h = small ? 36 : 52, r = small ? 12 : 16
  const content = busy ? <ActivityIndicator color="#fff" /> : <>
    {icon && <Ionicons name={icon} size={small ? 15 : 18} color="#fff" />}
    <Text style={{ color: '#fff', fontWeight: '700', fontSize: small ? 13 : 16 }}>{title}</Text>
  </>
  return (
    <Pressable onPress={onPress} disabled={disabled || busy} style={({ pressed }) => [{ opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }, style]}>
      {kind === 'primary'
        ? <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.btn, { height: h, borderRadius: r, paddingHorizontal: small ? 14 : 20 }, !small && s.glow]}>{content}</LinearGradient>
        : <View style={[s.btn, { height: h, borderRadius: r, paddingHorizontal: small ? 14 : 20, backgroundColor: kind === 'secondary' ? C.panel2 : kind === 'danger' ? C.danger : 'transparent', borderWidth: kind === 'secondary' ? 1 : 0, borderColor: C.line }]}>{content}</View>}
    </Pressable>
  )
}

export function Chip({ label, on, onPress, disabled }: { label: string; on?: boolean; onPress?: () => void; disabled?: boolean }) {
  const inner = <Text style={{ color: on ? '#fff' : C.ink, fontSize: 13, fontWeight: on ? '700' : '500' }}>{label}</Text>
  return (
    <Pressable onPress={onPress} disabled={disabled || !onPress} style={({ pressed }) => ({ opacity: disabled ? 0.35 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
      {on ? <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.chip}>{inner}</LinearGradient>
        : <View style={[s.chip, { backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }]}>{inner}</View>}
    </Pressable>
  )
}
export function Chips({ children }: { children: React.ReactNode }) { return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>{children}</View> }

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return <Chips>{options.map(o => <Chip key={o.v} label={o.label} on={value === o.v} onPress={() => onChange(o.v)} />)}</Chips>
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <View style={{ marginTop: 16 }}><Text style={{ color: C.muted, fontSize: 13, fontWeight: '600', marginBottom: 8, letterSpacing: 0.2 }}>{label}{hint ? <Text style={{ fontSize: 12, color: C.muted }}>   {hint}</Text> : null}</Text>{children}</View>
}
export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor="#6E6E84" selectionColor={C.accent} {...props} style={[{ backgroundColor: C.glass, borderColor: C.line, borderWidth: 1, borderRadius: 14, color: C.ink, fontSize: 15, fontFamily: F.m, paddingHorizontal: 14, paddingVertical: 13 }, props.style]} />
}

export function Header({ title, onBack, right, logo }: { title?: string; onBack?: () => void; right?: React.ReactNode; logo?: boolean }) {
  return (
    <View style={{ height: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 6 }}>
      {onBack ? <Pressable hitSlop={10} onPress={onBack} style={s.iconBtn}><Ionicons name="chevron-back" size={22} color={C.ink} /></Pressable> : <View style={{ width: 6 }} />}
      {logo ? <Logo /> : <Text numberOfLines={1} style={{ flex: 1, fontSize: onBack ? 17 : 26, fontWeight: '800', letterSpacing: -0.5, textAlign: onBack ? 'center' : 'left' }}>{title}</Text>}
      {logo && <View style={{ flex: 1 }} />}
      <View style={{ minWidth: 40, alignItems: 'flex-end' }}>{right}</View>
    </View>
  )
}
export function IconButton({ icon, onPress, color = C.ink }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; color?: string }) {
  return <Pressable hitSlop={8} onPress={onPress} style={({ pressed }) => [s.iconBtn, { transform: [{ scale: pressed ? 0.9 : 1 }] }]}><Ionicons name={icon} size={20} color={color} /></Pressable>
}

export function Empty({ icon, title, text, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
      <LinearGradient colors={AURA} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}><Ionicons name={icon} size={32} color="#fff" /></LinearGradient>
      <Text style={{ fontWeight: '800', fontSize: 19 }}>{title}</Text>
      {text && <Text style={{ color: C.muted, textAlign: 'center', lineHeight: 20 }}>{text}</Text>}
      {children}
    </View>
  )
}

export function Row({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  return <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: pressed ? 'rgba(255,255,255,0.04)' : 'transparent' })}>{children}</Pressable>
}

export const T = StyleSheet.create({
  title: { color: C.ink, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  b: { color: C.ink, fontSize: 15, fontWeight: '700' },
  body: { color: C.ink, fontSize: 15, lineHeight: 22 },
  muted: { color: C.muted, fontSize: 13 },
  error: { color: '#FF8FA8', fontSize: 13, marginTop: 8 },
})
const s = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  glow: { shadowColor: '#FF2D6F', shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  chip: { borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line },
})
