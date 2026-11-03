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
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0]
    if (application) application.$['android:allowBackup'] = 'false'
    return mod
  })
}
