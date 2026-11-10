const { withAndroidManifest, withGradleProperties, withProjectBuildGradle, withSettingsGradle } = require('expo/config-plugins')

module.exports = function withOptinixAndroid(config) {
  config = withSettingsGradle(config, (mod) => {
    if (!mod.modResults.contents.includes('def optinixAliasRoot')) {
      mod.modResults.contents += `
def optinixAliasRoot = System.getenv('OPTINIX_BUILD_ROOT')
def optinixRealRoot = System.getenv('OPTINIX_SOURCE_ROOT')
if (optinixAliasRoot && optinixRealRoot) {
  def real = optinixRealRoot.replace('\\\\', '/').replaceAll('/+$', '')
  def alias = optinixAliasRoot.replace('\\\\', '/').replaceAll('/+$', '')
  def remapPath = { String value ->
    def normalized = value.replace('\\\\', '/')
    if (normalized.equalsIgnoreCase(real) || normalized.toLowerCase().startsWith(real.toLowerCase() + '/')) {
      return alias + normalized.substring(real.length())
    }
    return value
  }
  def remapProject
  remapProject = { descriptor ->
    descriptor.projectDir = new File(remapPath(descriptor.projectDir.absolutePath))
    descriptor.children.each { child -> remapProject(child) }
  }
  remapProject(rootProject)
  def cache = new File(settingsDir, 'build/generated/autolinking/autolinking.json')
  if (cache.exists()) {
    def remapValue
    remapValue = { value ->
      if (value instanceof Map) return value.collectEntries { key, item -> [(key): remapValue(item)] }
      if (value instanceof List) return value.collect { item -> remapValue(item) }
      if (value instanceof String) return remapPath(value)
      return value
    }
    cache.text = groovy.json.JsonOutput.toJson(remapValue(new groovy.json.JsonSlurper().parse(cache)))
  }
}
`
    }
    return mod
  })
  config = withGradleProperties(config, (mod) => {
    const properties = {
      'android.minSdkVersion': '29',
      'android.targetSdkVersion': '36',
      'android.compileSdkVersion': '37',
      'android.enableMinifyInReleaseBuilds': 'false',
      'android.cmakeVersion': '3.31.6',
      'expo.android.cmakeObjectPathMax': '200',
      'org.gradle.jvmargs': '-Xmx2048m -XX:MaxMetaspaceSize=512m -XX:+UseSerialGC',
      'kotlin.daemon.jvmargs': '-Xmx1536m -XX:+UseSerialGC',
      'org.gradle.workers.max': '2',
      'systemProp.org.gradle.internal.http.connectionTimeout': '30000',
      'systemProp.org.gradle.internal.http.socketTimeout': '60000',
    }
    for (const [key, value] of Object.entries(properties)) {
      const current = mod.modResults.find((entry) => entry.type === 'property' && entry.key === key)
      if (current) current.value = value
      else mod.modResults.push({ type: 'property', key, value })
    }
    return mod
  })
  config = withProjectBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes('maven.aliyun.com/repository/google')) {
      mod.modResults.contents = mod.modResults.contents.replace(/repositories\s*\{/g, `repositories {
        maven { url 'https://maven.aliyun.com/repository/google' }
        maven { url 'https://maven.aliyun.com/repository/central' }`)
    }
    return mod
  })
  // The AdMob library (2026-11-09) merges an EMPTY placeholder
  // com.google.android.gms.ads.APPLICATION_ID from its own AndroidManifest when
  // the app manifest has no real value, and Google's provider then terminates
  // the process at launch ("Invalid application ID") — a crash observed on the
  // device. Enforce the app-level meta-data here so any future prebuild or
  // stale mirror always carries a valid ID (Google's public sample/test ID,
  // matching app.json's react-native-google-mobile-ads plugin argument).
  const ADMOB_APPLICATION_ID = 'ca-app-pub-3940256099942544~3347511713'
  config = withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0]
    if (!application) return mod
    if (!Array.isArray(application['meta-data']) && !application['meta-data']) application['meta-data'] = []
    const entries = application['meta-data'] ?? []
    const ensure = (name, value) => {
      const existing = entries.find((entry) => entry.$?.['android:name'] === name)
      if (existing) {
        existing.$['android:value'] = value
        existing.$['tools:replace'] = 'android:value'
      } else {
        entries.push({
          $: { 'android:name': name, 'android:value': value, 'tools:replace': 'android:value' },
        })
      }
    }
    ensure('com.google.android.gms.ads.APPLICATION_ID', ADMOB_APPLICATION_ID)
    ensure('com.google.android.gms.ads.flag.OPTIMIZE_INITIALIZATION', 'true')
    ensure('com.google.android.gms.ads.flag.OPTIMIZE_AD_LOADING', 'true')
    application['meta-data'] = entries
    application.$['android:allowBackup'] = 'false'
    return mod
  })
  return config
}
