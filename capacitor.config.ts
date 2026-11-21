import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Android app shell. The static export in `out/` (built without a base path) is bundled into the
 * APK, so the app opens instantly and works offline from Firestore's cache.
 */
const config: CapacitorConfig = {
  appId: 'com.vitpulse.app',
  appName: 'VIT Pulse',
  webDir: 'out',
  backgroundColor: '#000000',
  android: { allowMixedContent: false, captureInput: true, adjustMarginsForEdgeToEdge: 'force' },
  plugins: {
    SplashScreen: { launchShowDuration: 900, launchAutoHide: true, backgroundColor: '#000000', showSpinner: false },
    StatusBar: { style: 'DARK', backgroundColor: '#000000', overlaysWebView: false },
  },
}

export default config
