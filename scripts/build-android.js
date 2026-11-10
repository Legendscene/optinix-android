const { spawnSync, execFileSync } = require('node:child_process')
const { existsSync, rmSync } = require('node:fs')
const path = require('node:path')

const source = path.dirname(require.resolve('../package.json'))
if (!existsSync(path.join(source, 'android', 'gradlew.bat'))) throw new Error('Run npx expo prebuild --platform android --no-install first.')
const windows = process.platform === 'win32'
const sdk = process.env.ANDROID_HOME || (windows ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : '')
if (!sdk || !existsSync(sdk)) throw new Error('Set ANDROID_HOME to your Android SDK directory.')
const env = { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk }
const localJdk = windows ? path.join(process.env.USERPROFILE, 'jdk', 'jdk-21.0.12+8') : ''
if (!env.JAVA_HOME && existsSync(localJdk)) env.JAVA_HOME = localJdk
let drive = null
let root = source
let exitCode = 1
const autolinkingCache = path.join(source, 'android', 'build', 'generated', 'autolinking', 'autolinking.json')
try {
  if (windows) {
    drive = ['O:', 'P:', 'Q:', 'R:', 'T:', 'U:'].find((letter) => !existsSync(`${letter}\\`))
    if (!drive) throw new Error('No free drive letter for the Windows short-path build alias.')
    execFileSync('subst.exe', [drive, path.dirname(source)], { stdio: 'inherit' })
    root = path.join(`${drive}\\`, path.basename(source))
  }
  rmSync(autolinkingCache, { force: true })
  env.OPTINIX_SOURCE_ROOT = source
  env.OPTINIX_BUILD_ROOT = root
  const debug = process.argv.includes('--debug')
  const architectures = (process.env.OPTINIX_ANDROID_ABIS || (debug ? 'arm64-v8a' : 'arm64-v8a,armeabi-v7a')).split(',').map((abi) => abi.trim())
  if (!architectures.length || architectures.some((abi) => !['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'].includes(abi))) throw new Error('OPTINIX_ANDROID_ABIS contains an unsupported Android ABI.')
  const task = `:app:assemble${debug ? 'Debug' : 'Release'}`
  const verification = process.argv.includes('--verify-native') ? [':optinix-overlay:testDebugUnitTest', ':optinix-device:lintDebug', ':optinix-apps:lintDebug', ':optinix-overlay:lintDebug'] : []
  const args = [...verification, task, `-PreactNativeArchitectures=${[...new Set(architectures)].join(',')}`, '--console=plain', '--max-workers=2', '--no-daemon']
  // Invoke gradlew by absolute path: some Windows setups export
  // NoDefaultCurrentDirectoryInExePath=1, which makes `cmd /c gradlew.bat` fail with
  // "'gradlew.bat' is not recognized" even when the file is in the working directory.
  const gradlew = path.join(root, 'android', 'gradlew.bat')
  const gradlewCommand = /\s/.test(gradlew) ? `"${gradlew}"` : gradlew
  const built = windows
    ? spawnSync('cmd.exe', ['/d', '/c', gradlewCommand, ...args], { cwd: path.join(root, 'android'), env, stdio: 'inherit' })
    : spawnSync('./gradlew', args, { cwd: path.join(root, 'android'), env, stdio: 'inherit' })
  exitCode = built.status ?? 1
  if (built.error) throw built.error
  if (exitCode === 0) {
    const variant = debug ? 'debug' : 'release'
    console.log(`APK: ${path.join(source, 'android', 'app', 'build', 'outputs', 'apk', variant, `app-${variant}.apk`)}`)
  }
} finally {
  rmSync(autolinkingCache, { force: true })
  if (drive) execFileSync('subst.exe', [drive, '/D'], { stdio: 'inherit' })
}
process.exitCode = exitCode
