import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'

/**
 * Pick a photo from the gallery and return a small JPEG data URL (same format the website stores):
 * avatars ~320 px square (< 60 KB), posts ~1080 px (< 250 KB).
 */
export async function pickImage(kind: 'avatar' | 'post'): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) throw new Error('Allow photo access to choose a picture')
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: kind === 'avatar', aspect: [1, 1], quality: 1 })
  if (res.canceled || !res.assets?.[0]) return null
  const a = res.assets[0], side = kind === 'avatar' ? 320 : 1080, limit = kind === 'avatar' ? 60_000 : 250_000
  const resize = (a.width ?? side) >= (a.height ?? side) ? { width: Math.min(side, a.width ?? side) } : { height: Math.min(side, a.height ?? side) }
  for (const q of [0.82, 0.7, 0.58, 0.46]) {
    const out = await ImageManipulator.manipulateAsync(a.uri, [{ resize }], { compress: q, format: ImageManipulator.SaveFormat.JPEG, base64: true })
    const url = `data:image/jpeg;base64,${out.base64}`
    if (url.length < limit || q === 0.46) return url
  }
  return null
}
