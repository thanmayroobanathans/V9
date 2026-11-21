import React, { useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useApp } from '../store'
import { Button, Logo, T } from '../components/ui'
import { LegalView } from './Legal'
import { C } from '../theme'
import { ALLOWED_DOMAIN } from '../../../lib/config'

export function LoginScreen() {
  const app = useApp()
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null)
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', padding: 28 }}>
      <View style={{ alignItems: 'center', gap: 10 }}>
        <Logo size={58} />
        <Text style={[T.muted, { fontSize: 15 }]}>Meet VIT students who fit you.</Text>
      </View>
      <Button title={busy ? 'Opening Google…' : 'Continue with Google'} icon="logo-google" disabled={!agreed} busy={busy} style={{ marginTop: 32 }}
        onPress={async () => { setBusy(true); await app.login(); setBusy(false) }} />
      <Pressable onPress={() => setAgreed(a => !a)} style={{ flexDirection: 'row', gap: 10, marginTop: 18, alignItems: 'flex-start' }}>
        <Ionicons name={agreed ? 'checkbox' : 'square-outline'} size={22} color={agreed ? C.accent : C.muted} />
        <Text style={[T.muted, { flex: 1, lineHeight: 19 }]}>
          I&apos;m 18+, a VIT student, and agree to the <Text style={{ color: C.ink, fontWeight: '600' }} onPress={() => setLegal('terms')}>Terms</Text> and <Text style={{ color: C.ink, fontWeight: '600' }} onPress={() => setLegal('privacy')}>Privacy Policy</Text>.
        </Text>
      </Pressable>
      {!!app.error && <Text style={[T.error, { textAlign: 'center', marginTop: 16 }]}>{app.error}</Text>}
      <Text style={[T.muted, { textAlign: 'center', marginTop: 48 }]}>Use your @{ALLOWED_DOMAIN} account</Text>
      <Modal visible={!!legal} animationType="slide" onRequestClose={() => setLegal(null)}>
        {legal && <LegalView initial={legal} onBack={() => setLegal(null)} />}
      </Modal>
    </SafeAreaView>
  )
}
