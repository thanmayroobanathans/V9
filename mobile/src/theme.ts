/** Instagram-style dark theme, matching the website. */
export const C = {
  bg: '#000000', panel: '#121212', panel2: '#262626', line: '#262626',
  ink: '#f5f5f5', muted: '#a8a8a8', accent: '#0095f6', like: '#ff3040', green: '#58c322', danger: '#ff3040',
}
export const GRAD = ['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5'] as const
export const LOGO_FONT = 'GrandHotel_400Regular'
export const hueColor = (h: number, l = 55) => `hsl(${h}, 55%, ${l}%)`
