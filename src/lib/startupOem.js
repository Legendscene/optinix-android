/**
 * startupOem.js — copy + decision helpers for the Startup Manager screen.
 *
 * Pure data (tested by jest): turns the native getStartupSupport() result —
 * { supported, manufacturer, managerLabel } — into honest UI copy plus the
 * concrete next-step instructions per vendor. It never claims a toggle was
 * flipped and never simulates an auto-start state: Android does not expose a
 * cross-app "auto-start on/off" reading, so status is always described as
 * "managed by your phone's vendor page", never as a boolean.
 */

const VENDOR_COPY = {
  realme: {
    path: 'Phone/Security app → Battery → (or App management) → Startup manager',
    note: 'Realme UI hides per-app auto-start toggles in its security app.',
  },
  oppo: {
    path: 'Phone Manager → App management → Startup manager',
    note: 'ColorOS keeps per-app start-up toggles inside Phone Manager.',
  },
  coloros: {
    path: 'Phone Manager → App management → Startup manager',
    note: 'ColorOS keeps per-app start-up toggles inside Phone Manager.',
  },
  xiaomi: {
    path: 'Security app → Permissions → Autostart',
    note: 'HyperOS/MIUI keeps per-app autostart toggles in the Security app.',
  },
  samsung: {
    path: 'Settings → Battery → Background usage limits → Sleeping apps',
    note: 'One UI manages background starts through Sleeping / Deep-sleeping app lists.',
  },
  oneplus: {
    path: 'Settings → Battery → More settings → Optimize battery use',
    note: 'OxygenOS gates background starts via battery optimisation lists.',
  },
  vivo: {
    path: 'i Manager → App manager → Startup management',
    note: 'OriginOS/Funtouch keeps autostart controls in i Manager.',
  },
  iqoo: {
    path: 'i Manager → App manager → Startup management',
    note: 'iQOO devices expose start managers inside i Manager.',
  },
  asus: {
    path: 'Mobile Manager → Battery → startup permission',
    note: 'ASUS Mobile Manager holds startup permissions.',
  },
  huawei: {
    path: 'Settings → Battery → App launch (Manage automatically → off)',
    note: 'EMUI manages launches per app under App launch.',
  },
  honor: {
    path: 'Settings → Battery → App launch (Manage automatically → off)',
    note: 'MagicOS manages launches per app under App launch.',
  },
}

/** Vendor key lookup tolerates manufacturer strings like "Realme-RMX3998". */
function vendorKey(manufacturer) {
  const raw = String(manufacturer ?? '').toLowerCase()
  if (!raw) return null
  for (const key of Object.keys(VENDOR_COPY)) {
    if (raw.includes(key)) return key
  }
  return null
}

/**
 * UI copy for the capability banner.
 * Returns { tone, title, body, steps[], managerLabel|null }.
 * tone: 'supported' | 'unsupported' | 'unknown'
 */
export function startupSupportCopy(support) {
  const manufacturer = String(support?.manufacturer ?? '').trim()
  const vendor = vendorKey(manufacturer ?? support?.managerLabel)
  if (support == null) {
    return {
      tone: 'unknown',
      title: 'Startup support could not be checked',
      body: 'The Optinix native module is unavailable in this build, so the capability probe could not run. Nothing is being claimed either way.',
      steps: [],
      managerLabel: null,
    }
  }
  if (support?.supported) {
    const label = support?.managerLabel
    const steps = []
    if (manufacturer) steps.push(manufacturer)
    if (vendor) {
      steps.push(VENDOR_COPY[vendor].path)
      if (VENDOR_COPY[vendor].note) steps.push(VENDOR_COPY[vendor].note)
    } else if (label) {
      steps.push(`Look inside ${label} for per-app start-up permissions.`)
    }
    return {
      tone: 'supported',
      title: label ? `${label} found on your phone` : 'Auto-start manager found',
      body:
        support.directAutoStart === false
          ? 'This phone exposes a vendor management page, not a verified auto-start switch. Available battery and background controls depend on the OEM version. Optinix opens the page; you apply changes there.'
          : 'Android lets each phone maker provide its own auto-start page. Optinix can open it for you — it never changes anything by itself.',
      steps,
      managerLabel: label ?? null,
    }
  }
  return {
    tone: 'unsupported',
    title: 'Startup control is not supported on this device',
    body:
      'No known auto-start manager was found on this phone, and Android has no universal auto-start page. Optinix will not fake a toggle. Battery and background options in system Settings are the honest alternative.',
    steps: vendor ? [VENDOR_COPY[vendor].path, VENDOR_COPY[vendor].note] : ['Settings → Apps → [app] → Battery'],
    managerLabel: null,
  }
}

/** Per-app consequence copy, shown before any jump into vendor settings. */
export function startupConsequences() {
  return [
    'Blocking an app from starting itself can delay its notifications, sync and alarms.',
    'Fewer auto-starting apps usually means less memory pressure at boot.',
    'You review and apply every change inside your phone vendor\'s own page — Optinix never applies it.',
  ]
}

/**
 * Whether per-app rows can list a "manage" action for a package: requires a
 * resolvable vendor manager (on the probe) — otherwise rows show app info /
 * battery only. There is no per-app autostart read API on Android.
 */
export function perAppControlsAvailable(support) {
  return Boolean(support?.supported)
}
