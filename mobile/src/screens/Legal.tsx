import React, { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Header, Segmented, T, Text } from '../components/ui'
import { PRIVACY, TERMS, UPDATED, type Section } from '../legal'
import { C } from '../theme'

export function LegalView({ initial = 'terms', onBack }: { initial?: 'terms' | 'privacy'; onBack: () => void }) {
  const [tab, setTab] = useState<'terms' | 'privacy'>(initial)
  const doc: Section[] = tab === 'terms' ? TERMS : PRIVACY
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
      <Header title={tab === 'terms' ? 'Terms of Use' : 'Privacy Policy'} onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Segmented value={tab} onChange={setTab} options={[{ v: 'terms', label: 'Terms' }, { v: 'privacy', label: 'Privacy' }]} />
        <Text style={[T.muted, { marginTop: 10 }]}>Last updated {UPDATED}</Text>
        {doc.map((s, i) => (
          <View key={i} style={{ marginTop: 14 }}>
            {s.h && <Text style={[T.b, { fontSize: 15, marginBottom: 6 }]}>{s.h}</Text>}
            {s.p && <Text style={[T.body, { color: '#d8cfcb', fontSize: 14, lineHeight: 22 }]}>{s.p}</Text>}
            {s.li?.map((l, j) => <Text key={j} style={[T.body, { color: '#d8cfcb', fontSize: 14, lineHeight: 22, marginTop: 4 }]}>•  {l}</Text>)}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}
