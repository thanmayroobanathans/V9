// Metro bundler: share ../lib (the web app's matching engine, Firebase code, etc.) with this app.
// Package imports made from ../lib are resolved as if they came from this app, so there is only
// one copy of Firebase/React (this app's), even though the website has its own node_modules.
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)
const shared = path.resolve(__dirname, '../lib')
config.watchFolders = [shared]
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')]
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fromShared = context.originModulePath.startsWith(shared + path.sep)
  const isPackage = !moduleName.startsWith('.') && !path.isAbsolute(moduleName)
  if (fromShared && isPackage) return context.resolveRequest({ ...context, originModulePath: path.join(__dirname, 'index.ts') }, moduleName, platform)
  return context.resolveRequest(context, moduleName, platform)
}
module.exports = config
