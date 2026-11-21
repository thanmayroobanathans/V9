import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { C, GRAD, LOGO_FONT, hueColor } from '../theme'

export function Avatar({ name, photoURL, hue, size = 44, ring }: { name?: string; photoURL?: string | null; hue?: number; size?: number; ring?: boolean }) {
  const inner = ring ? size - 8 : size
  const face = (
    <View style={{ width: inner, height: inner, borderRadius: inner / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      {photoURL
        ? <Image source={{ uri: photoURL }} style={{ width: inner, height: inner }} contentFit="cover" transition={150} />
        : <LinearGradient colors={[hueColor(hue ?? 210), hueColor(((hue ?? 210) + 40) % 360, 38)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: inner * 0.42 }}>{(name || '?')[0].toUpperCase()}</Text>
        </LinearGradient>}
    </View>
  )
  if (!ring) return face
  return (
    <LinearGradient colors={[...GRAD]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>{face}</View>
    </LinearGradient>
  )
}

export function Logo({ size = 30 }: { size?: number }) {
  return <Text style={{ fontFamily: LOGO_FONT, fontSize: size, color: '#fff' }}>VIT Pulse</Text>
}

type BtnKind = 'primary' | 'secondary' | 'ghost' | 'danger'
export function Button({ title, onPress, kind = 'primary', disabled, busy, icon, style, small }: {
  title: string; onPress?: () => void; kind?: BtnKind; disabled?: boolean; busy?: boolean; icon?: keyof typeof Ionicons.glyphMap; style?: StyleProp<ViewStyle>; small?: boolean
}) {
  const bg = kind === 'primary' ? C.accent : kind === 'secondary' ? '#363636' : kind === 'danger' ? C.danger : 'transparent'
  return (
    <Pressable onPress={onPress} disabled={disabled || busy} style={({ pressed }) => [{ backgroundColor: bg, borderRadius: 8, minHeight: small ? 32 : 44, paddingHorizontal: small ? 14 : 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: disabled ? 0.45 : pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}>
      {busy ? <ActivityIndicator color="#fff" /> : <>
        {icon && <Ionicons name={icon} size={16} color={kind === 'ghost' ? C.ink : '#fff'} />}
        <Text style={{ color: kind === 'ghost' ? C.ink : '#fff', fontWeight: '600', fontSize: small ? 13 : 15 }}>{title}</Text>
      </>}
    </Pressable>
  )
}

export function Chip({ label, on, onPress, disabled }: { label: string; on?: boolean; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled || !onPress} style={({ pressed }) => ({ backgroundColor: on ? '#fff' : C.panel2, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 })}>
      <Text style={{ color: on ? '#000' : C.ink, fontSize: 13, fontWeight: on ? '600' : '400' }}>{label}</Text>
    </Pressable>
  )
}
export function Chips({ children }: { children: React.ReactNode }) { return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>{children}</View> }

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return <Chips>{options.map(o => <Chip key={o.v} label={o.label} on={value === o.v} onPress={() => onChange(o.v)} />)}</Chips>
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <View style={{ marginTop: 14 }}><Text style={{ color: C.muted, fontSize: 13, marginBottom: 6 }}>{label}{hint ? <Text style={{ fontSize: 12 }}>  {hint}</Text> : null}</Text>{children}</View>
}
export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor="#777" {...props} style={[{ backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 8, color: C.ink, fontSize: 15, paddingHorizontal: 12, paddingVertical: 11 }, props.style]} />
}

export function Header({ title, onBack, right, logo }: { title?: string; onBack?: () => void; right?: React.ReactNode; logo?: boolean }) {
  return (
    <View style={{ height: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 4 }}>
      {onBack ? <Pressable hitSlop={10} onPress={onBack} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="arrow-back" size={24} color={C.ink} /></Pressable> : <View style={{ width: 8 }} />}
      {logo ? <Logo /> : <Text numberOfLines={1} style={{ flex: 1, color: C.ink, fontSize: onBack ? 17 : 22, fontWeight: '700', textAlign: onBack ? 'center' : 'left' }}>{title}</Text>}
      {logo && <View style={{ flex: 1 }} />}
      <View style={{ minWidth: 40, alignItems: 'flex-end' }}>{right}</View>
    </View>
  )
}

export function Empty({ icon, title, text, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: C.ink, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}><Ionicons name={icon} size={28} color={C.ink} /></View>
      <Text style={{ color: C.ink, fontWeight: '700', fontSize: 16 }}>{title}</Text>
      {text && <Text style={{ color: C.muted, textAlign: 'center' }}>{text}</Text>}
      {children}
    </View>
  )
}

export function Row({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  return <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: pressed ? '#0d0d0d' : 'transparent' })}>{children}</Pressable>
}
export const T = StyleSheet.create({
  title: { color: C.ink, fontSize: 22, fontWeight: '700' },
  b: { color: C.ink, fontSize: 14, fontWeight: '600' },
  body: { color: C.ink, fontSize: 15, lineHeight: 21 },
  muted: { color: C.muted, fontSize: 13 },
  error: { color: '#ff8a8a', fontSize: 13, marginTop: 8 },
})
