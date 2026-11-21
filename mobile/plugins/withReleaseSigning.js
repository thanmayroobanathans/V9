// Expo config plugin: sign release builds with the key provided by CI (KEYSTORE_PATH /
// KEYSTORE_PASSWORD / KEY_ALIAS), and number versions from GITHUB_RUN_NUMBER so every build
// installs as an update (starting at 100, above the earlier web-wrapper builds).
const { withAppBuildGradle } = require('expo/config-plugins')

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, cfg => {
    let g = cfg.modResults.contents
    if (!g.includes('VITPULSE_SIGNING')) {
      g = g.replace(/signingConfigs \{/, `signingConfigs {
        // VITPULSE_SIGNING
        release {
            if (System.getenv("KEYSTORE_PATH")) {
                storeFile file(System.getenv("KEYSTORE_PATH"))
                storePassword System.getenv("KEYSTORE_PASSWORD")
                keyAlias System.getenv("KEY_ALIAS") ?: "vitpulse"
                keyPassword System.getenv("KEYSTORE_PASSWORD")
            }
        }`)
      g = g.replace(/(release \{[^}]*?)signingConfig signingConfigs\.debug/, '$1signingConfig System.getenv("KEYSTORE_PATH") ? signingConfigs.release : signingConfigs.debug')
      g = g.replace(/versionCode \d+/, 'versionCode(100 + (System.getenv("GITHUB_RUN_NUMBER") ?: "0").toInteger())')
    }
    cfg.modResults.contents = g
    return cfg
  })
}
