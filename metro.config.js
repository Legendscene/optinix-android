const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// three.js ships modern ESM only; Metro handles it, but keep the package's
// explicit "exports" entry points resolvable for the GL renderer imports.
config.resolver.unstable_enablePackageExports = true

module.exports = config
