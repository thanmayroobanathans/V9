/** Pulse design tokens: deep ink background, hot pink → coral gradient, violet aura, glass surfaces. */
export const C = {
  bg: '#0A0A0F', bg2: '#11111A', panel: '#15151F', panel2: '#1E1E2A',
  glass: 'rgba(255,255,255,0.07)', glassBorder: 'rgba(255,255,255,0.12)', line: 'rgba(255,255,255,0.08)',
  ink: '#F6F6FA', muted: '#9C9CB2', accent: '#FF2D6F', coral: '#FF7A45', violet: '#8B5CF6',
  like: '#FF2D6F', green: '#34D399', danger: '#FF4D6D', blue: '#5B8CFF',
}
export const GRAD = ['#FF2D6F', '#FF7A45'] as const        // brand
export const AURA = ['#FF2D6F', '#8B5CF6'] as const        // pink → violet
export const RING = ['#FF7A45', '#FF2D6F', '#8B5CF6'] as const
export const F = {
  r: 'PlusJakartaSans_400Regular', m: 'PlusJakartaSans_500Medium', sb: 'PlusJakartaSans_600SemiBold',
  b: 'PlusJakartaSans_700Bold', xb: 'PlusJakartaSans_800ExtraBold',
}
export const LOGO_FONT = F.xb
export const hueColor = (h: number, l = 55) => `hsl(${h}, 60%, ${l}%)`
