const { execFileSync } = require('node:child_process')
const { existsSync } = require('node:fs')
const path = require('node:path')

const root = path.dirname(require.resolve('../package.json'))
const sdk = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk')
const binary = path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb')
const serial = process.env.OPTINIX_DEVICE || '00744740104c8f9c'
const packageName = 'net.exitpoint.optinix'
const [command = 'inspect', label, value] = process.argv.slice(2)
const adb = (...args) => execFileSync(binary, ['-s', serial, ...args], { encoding: 'utf8', timeout: 90000, windowsHide: true }).trim()
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const decode = (value) => value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

function locked() {
  const trust = adb('shell', 'dumpsys', 'trust')
  return /\(current\):[^\n]*deviceLocked=1/.test(trust)
}

function nodes() {
  if (locked()) throw new Error('Device is locked. Unlock it before UI verification.')
  adb('shell', 'uiautomator', 'dump', '/sdcard/optinix-smoke.xml')
  const xml = adb('exec-out', 'cat', '/sdcard/optinix-smoke.xml')
  const result = [...xml.matchAll(/<node\s[^>]+/g)].map(([node]) => Object.fromEntries([...node.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, val]) => [key, decode(val)])))
  if (!result.some((node) => node.package === packageName) && !process.argv.includes('--system')) throw new Error('Optinix is not the visible app. No unrelated app UI was collected.')
  return result
}

function find(label) {
  const matches = nodes().filter((node) => {
    const bounds = node.bounds?.match(/\d+/g)?.map(Number)
    return (node.text === label || node['content-desc'] === label) && bounds?.length === 4 && bounds[3] > bounds[1] && bounds[2] > bounds[0]
  })
  const node = matches.find((item) => item.clickable === 'true') || matches[0]
  if (!node) throw new Error(`Visible control not found: ${label}`)
  const coordinates = node.bounds?.match(/\d+/g)?.map(Number)
  if (!coordinates || coordinates.length !== 4) throw new Error('Control has no visible bounds.')
  return { node, x: Math.round((coordinates[0] + coordinates[2]) / 2), y: Math.round((coordinates[1] + coordinates[3]) / 2) }
}

async function main() {
  const devices = execFileSync(binary, ['devices'], { encoding: 'utf8', timeout: 30000 })
  if (!devices.includes(`${serial}\tdevice`)) throw new Error('The configured Android device is not connected and authorized.')
  if (command === 'install') {
    const apk = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk')
    if (!existsSync(apk)) throw new Error('Release APK does not exist. Run npm run build:android.')
    console.log(adb('install', '-r', apk))
    return
  }
  if (command === 'status') {
    console.log(JSON.stringify({ serial, locked: locked(), sdk: adb('shell', 'getprop', 'ro.build.version.sdk'), abi: adb('shell', 'getprop', 'ro.product.cpu.abi'), pid: adb('shell', 'pidof', packageName) }, null, 2))
    return
  }
  if (command === 'launch') {
    if (locked()) throw new Error('Unlock the phone before launching for UI verification.')
    if (label) console.log(adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', `optinix://${label}`, '-n', `${packageName}/.MainActivity`))
    else console.log(adb('shell', 'am', 'start', '-W', '-n', `${packageName}/.MainActivity`))
    await sleep(2500)
  } else if (command === 'tap') {
    const control = find(label)
    console.log(adb('shell', 'input', 'tap', String(control.x), String(control.y)))
    await sleep(700)
  } else if (command === 'type') {
    if (!/^[\w .:-]{1,100}$/.test(value || '')) throw new Error('Use a simple test value for the scoped UI smoke test.')
    const control = find(label)
    adb('shell', 'input', 'tap', String(control.x), String(control.y))
    adb('shell', 'input', 'keyevent', '123', ...Array(Math.min((control.node.text || '').length, 100)).fill('67'))
    adb('shell', 'input', 'text', value.replace(/ /g, '%s'))
    await sleep(300)
  } else if (command === 'back') {
    nodes()
    adb('shell', 'input', 'keyevent', '4')
    await sleep(500)
  } else if (command === 'swipe') {
    const ui = nodes()
    const bounds = ui[0].bounds.match(/\d+/g).map(Number)
    const x = Math.round(bounds[2] * 0.5)
    const top = Math.round(bounds[3] * 0.3)
    const bottom = Math.round(bounds[3] * 0.78)
    adb('shell', 'input', 'swipe', String(x), String(label === 'down' ? top : bottom), String(x), String(label === 'down' ? bottom : top), '350')
    await sleep(400)
  } else if (command === 'shot') {
    nodes()
    if (!/^[\w-]+$/.test(label || '')) throw new Error('Give the screenshot a simple artifact name.')
    const directory = path.join(root, 'artifacts')
    if (!existsSync(directory)) throw new Error('Artifact directory is missing.')
    adb('shell', 'screencap', '-p', '/sdcard/optinix-smoke.png')
    console.log(adb('pull', '/sdcard/optinix-smoke.png', path.join(directory, `${label}.png`)))
    return
  }
  const summary = new Map()
  for (const node of nodes()) {
    const text = node['content-desc'] || node.text
    if (text && (!summary.has(text) || node.clickable === 'true')) summary.set(text, `${text}  [${node.bounds}]${node.checked === 'true' ? ' checked' : ''}`)
  }
  console.log([...summary.values()].join('\n'))
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 })
