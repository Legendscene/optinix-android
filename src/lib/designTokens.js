/**
 * designTokens.js — the Optinix design language, ported from
 * PC-Optimizer/desktop/src (design-system.css owns the shell tokens,
 * index.css the legacy table) so both apps share one visual identity.
 *
 * Current desktop art direction (2026-11-04 "Monochrome desktop redesign"):
 * pure black/white canvases, neutral surfaces, lightness-only status
 * differentiation and one ink accent. The four coloured accent presets are
 * kept for saved preferences (desktop keeps legacy values too) but `mono`
 * is the fresh-install default so Android looks like the desktop product.
 *
 * PC ships its theme as CSS variables driven by two attributes (`data-theme`
 * + density); React Native has no cascade, so the same values are expressed
 * as plain objects and resolved at runtime by `src/theme/ThemeProvider.js`.
 *
 * Rule carried over from the desktop app: a value that is not measured is
 * `null`, never a fabricated number. The same rule governs `status` below.
 */

/* ------------------------------------------------------------------ */
/* Surfaces & text — dark is the default identity                      */
/* Mirrors design-system.css `:root` (ui-canvas…ui-quiet)              */
/* ------------------------------------------------------------------ */

export const DARK = {
  mode: 'dark',
  surface: {
    0: '#000000',
    1: '#111111',
    2: '#191919',
    3: '#232323',
    4: '#303030',
  },
  border: {
    base: '#2c2c2c',
    light: '#555555',
  },
  text: {
    primary: '#ffffff',
    secondary: '#c1c1c1',
    tertiary: '#a0a0a0',
  },
  semantic: {
    /** Monochrome semantics: lightness carries severity, labels carry meaning. */
    green: '#ffffff',
    greenDim: 'rgba(255,255,255,0.10)',
    yellow: '#c1c1c1',
    yellowDim: 'rgba(255,255,255,0.10)',
    red: '#ffffff',
    redDim: 'rgba(255,255,255,0.10)',
    cyan: '#ffffff',
    cyanDim: 'rgba(255,255,255,0.10)',
    violet: '#c1c1c1',
    violetDim: 'rgba(255,255,255,0.10)',
    violetLine: '#2c2c2c',
    egGreen: '#ffffff',
    egGreenDim: 'rgba(255,255,255,0.10)',
    egLine: '#555555',
    egInk: '#000000',
  },
  chart: ['#ffffff', '#c1c1c1', '#a0a0a0', '#555555'],
  /** dim/line/ink are derived per accent; see ACCENTS. */
  onAccent: '#000000',
  overlay: 'rgba(0,0,0,0.72)',
  scrim: 'rgba(0,0,0,0.62)',
  grid: 'rgba(255,255,255,0.04)',
}

export const LIGHT = {
  mode: 'light',
  surface: {
    0: '#ffffff',
    1: '#f5f5f5',
    2: '#eeeeee',
    3: '#e4e4e4',
    4: '#d7d7d7',
  },
  border: {
    base: '#d7d7d7',
    light: '#a3a3a3',
  },
  text: {
    primary: '#000000',
    secondary: '#414141',
    tertiary: '#565656',
  },
  semantic: {
    green: '#000000',
    greenDim: 'rgba(0,0,0,0.10)',
    yellow: '#414141',
    yellowDim: 'rgba(0,0,0,0.10)',
    red: '#000000',
    redDim: 'rgba(0,0,0,0.10)',
    cyan: '#000000',
    cyanDim: 'rgba(0,0,0,0.10)',
    violet: '#414141',
    violetDim: 'rgba(0,0,0,0.10)',
    violetLine: '#d7d7d7',
    egGreen: '#000000',
    egGreenDim: 'rgba(0,0,0,0.10)',
    egLine: '#a3a3a3',
    egInk: '#ffffff',
  },
  chart: ['#000000', '#414141', '#565656', '#a3a3a3'],
  onAccent: '#ffffff',
  overlay: 'rgba(255,255,255,0.82)',
  scrim: 'rgba(0,0,0,0.30)',
  grid: 'rgba(0,0,0,0.03)',
}

/* ------------------------------------------------------------------ */
/* Accent presets — `mono` mirrors the desktop ink accent (the 2026    */
/* monochrome redesign retired colored accents there). Saved prefs     */
/* keep working, so the four legacy presets stay selectable.           */
/* ------------------------------------------------------------------ */

export const ACCENTS = {
  mono: {
    dark: {
      accent: '#ffffff',
      hover: '#c1c1c1',
      dim: 'rgba(255,255,255,0.10)',
      ink: '#ffffff',
      line: '#555555',
      onAccent: '#000000',
    },
    light: {
      accent: '#000000',
      hover: '#414141',
      dim: 'rgba(0,0,0,0.10)',
      ink: '#000000',
      line: '#a3a3a3',
      onAccent: '#ffffff',
    },
  },
  teal: {
    dark: {
      accent: '#2ee6cf',
      hover: '#5ff0dd',
      dim: 'rgba(46,230,207,0.13)',
      ink: '#7af5e5',
      line: 'rgba(46,230,207,0.3)',
      onAccent: '#06120f',
    },
    light: {
      accent: '#0b7f70',
      hover: '#096b5f',
      dim: 'rgba(11,127,112,0.10)',
      ink: '#0a6e62',
      line: 'rgba(11,127,112,0.32)',
      onAccent: '#ffffff',
    },
  },
  indigo: {
    dark: {
      accent: '#7a6af0',
      hover: '#8c7ef7',
      dim: 'rgba(122,106,240,0.14)',
      ink: '#a99cff',
      line: 'rgba(122,106,240,0.32)',
      onAccent: '#0d0a1f',
    },
    light: {
      accent: '#4f46e5',
      hover: '#4338ca',
      dim: 'rgba(79,70,229,0.10)',
      ink: '#463cc9',
      line: 'rgba(79,70,229,0.30)',
      onAccent: '#ffffff',
    },
  },
  amber: {
    dark: {
      accent: '#ffb020',
      hover: '#ffc04d',
      dim: 'rgba(255,176,32,0.14)',
      ink: '#ffc75c',
      line: 'rgba(255,176,32,0.32)',
      onAccent: '#241500',
    },
    light: {
      accent: '#9a6700',
      hover: '#855800',
      dim: 'rgba(154,103,0,0.10)',
      ink: '#8a5b00',
      line: 'rgba(154,103,0,0.30)',
      onAccent: '#ffffff',
    },
  },
  rose: {
    dark: {
      accent: '#ff6b8a',
      hover: '#ff8aa4',
      dim: 'rgba(255,107,138,0.14)',
      ink: '#ff96ac',
      line: 'rgba(255,107,138,0.32)',
      onAccent: '#26060f',
    },
    light: {
      accent: '#c2185b',
      hover: '#a6144e',
      dim: 'rgba(194,24,91,0.10)',
      ink: '#ad1450',
      line: 'rgba(194,24,91,0.30)',
      onAccent: '#ffffff',
    },
  },
}

export const ACCENT_OPTIONS = [
  { id: 'mono', label: 'Mono' },
  { id: 'teal', label: 'Teal' },
  { id: 'indigo', label: 'Indigo' },
  { id: 'amber', label: 'Amber' },
  { id: 'rose', label: 'Rose' },
]

export const MODE_OPTIONS = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
]

export const DENSITY_OPTIONS = [
  { id: 'comfortable', label: 'Comfortable' },
  { id: 'compact', label: 'Compact' },
]

/* ------------------------------------------------------------------ */
/* Type scale — dp sizes hand-tuned for phones, not viewport clamps    */
/* ------------------------------------------------------------------ */

export const typography = {
  family: {
    /** Plus Jakarta Sans = the desktop --font-display face. Orbitron was
     *  retired 2026-11-06; the legacy `brand` key maps to the same face
     *  so old references resolve without a second bundled font. */
    display: 'PlusJakartaSans_700Bold',
    displayMedium: 'PlusJakartaSans_600SemiBold',
    displayRegular: 'PlusJakartaSans_500Medium',
    brand: 'PlusJakartaSans_700Bold',
    body: 'Inter_400Regular',
    bodyMedium: 'Inter_500Medium',
    bodySemi: 'Inter_600SemiBold',
    bodyBold: 'Inter_700Bold',
    mono: 'JetBrainsMono_500Medium',
    monoBold: 'JetBrainsMono_700Bold',
  },
  size: {
    hero: 64,
    display1: 44,
    display2: 32,
    display3: 24,
    xl: 22,
    lg: 18,
    base: 16,
    sm: 14,
    xs: 12,
    '2xs': 10,
    '3xs': 9,
  },
  leading: {
    display: 1.02,
    heading: 1.15,
    body: 1.5,
    tight: 1.35,
  },
  tracking: {
    display: -1.2,
    tight: -0.4,
    normal: 0,
    open: 0.4,
    wide: 1.2,
    widest: 2.4,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
}

/* ------------------------------------------------------------------ */
/* Spacing / radius / density                                          */
/* ------------------------------------------------------------------ */

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
}

export const DENSITY = {
  comfortable: { gap: 16, cardPad: 16, rowH: 52, sectionGap: 24 },
  compact: { gap: 10, cardPad: 12, rowH: 44, sectionGap: 16 },
}

export const radius = {
  /* Mirrors the desktop's --radius-control (7px) and --radius-card (12px):
   * `md`/`soft` style controls and inputs, `lg`/`xl` style cards. */
  sharp: 2,
  xs: 6,
  soft: 7,
  md: 7,
  lg: 12,
  xl: 12,
  '2xl': 20,
  '3xl': 26,
  pill: 999,
  hex: 6,
}

/* ------------------------------------------------------------------ */
/* Shadows — RN needs both shadow* (iOS) and elevation (Android)       */
/* Mirrors --shadow-e1..e3 (0 1px 2px #00000018, 0 8px 22px #0000001c, */
/* 0 12px 32px #00000026): the monochrome look is nearly flat. `e4` is */
/* a mobile-only step for sheets; nothing gets heavier than that.      */
/* ------------------------------------------------------------------ */

export const shadows = {
  e1: {
    shadowColor: '#000',
    shadowOpacity: 0.09,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  e2: {
    shadowColor: '#000',
    shadowOpacity: 0.11,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  e3: {
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 9,
  },
  e4: {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
}

/* ------------------------------------------------------------------ */
/* Gradients — arrays of stop colors for expo-linear-gradient          */
/* ------------------------------------------------------------------ */

/* Ink-only ramps (desktop monochrome). Meaning is carried by labels, so
   the old semantic ramps collapse into lightness steps. */

export const GRADIENTS = {
  dark: {
    hero: ['#000000', '#0d0d0d', '#000000'],
    accent: ['#ffffff', '#d9d9d9', '#b3b3b3'],
    title: ['#ffffff', '#c1c1c1', '#7a7a7a'],
    control: ['#ffffff', '#d4d4d4'],
    optimized: ['#ffffff', '#c1c1c1', '#8f8f8f'],
    analyzing: ['#e3e3e3', '#c1c1c1', '#9a9a9a'],
    critical: ['#ffffff', '#e0e0e0', '#bdbdbd'],
    companion: ['#c1c1c1', '#a0a0a0', '#6b6b6b'],
    glass: ['rgba(17,17,17,0.94)', 'rgba(0,0,0,0.90)'],
    card: ['rgba(25,25,25,0.95)', 'rgba(10,10,10,0.96)'],
    rail: ['transparent', 'rgba(255,255,255,0.30)', 'rgba(255,255,255,0.16)', 'transparent'],
  },
  light: {
    hero: ['#ffffff', '#f5f5f5', '#eeeeee'],
    accent: ['#000000', '#2b2b2b', '#4a4a4a'],
    title: ['#000000', '#414141', '#6b6b6b'],
    control: ['#000000', '#2e2e2e'],
    optimized: ['#2b2b2b', '#414141', '#565656'],
    analyzing: ['#414141', '#565656', '#6e6e6e'],
    critical: ['#000000', '#1f1f1f', '#3a3a3a'],
    companion: ['#414141', '#565656', '#777777'],
    glass: ['rgba(255,255,255,0.95)', 'rgba(245,245,245,0.92)'],
    card: ['rgba(255,255,255,0.98)', 'rgba(238,238,238,0.96)'],
    rail: ['transparent', 'rgba(0,0,0,0.26)', 'rgba(0,0,0,0.14)', 'transparent'],
  },
}

export const GRADIENT_LOCATIONS = [0, 0.55, 1]

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */

export const motion = {
  duration: { instant: 90, fast: 150, base: 220, slow: 360, hero: 900 },
  /** reanimated: Easing.bezier(...pair) */
  easing: {
    out: [0.16, 1, 0.3, 1],
    inOut: [0.65, 0, 0.35, 1],
    spring: [0.34, 1.56, 0.64, 1],
  },
  spring: {
    soft: { damping: 18, stiffness: 160, mass: 1 },
    snappy: { damping: 16, stiffness: 260, mass: 0.9 },
    bouncy: { damping: 11, stiffness: 220, mass: 1 },
  },
}

/* ------------------------------------------------------------------ */
/* Status vocabulary — shared by chips, gauges and cards               */
/* ------------------------------------------------------------------ */

export function statusPalette({ accent, semantic, text }) {
  return {
    optimized: { color: accent, label: 'OPTIMIZED', tone: 'accent' },
    optimizing: { color: semantic.yellow, label: 'OPTIMIZING', tone: 'warning' },
    analyzing: { color: semantic.yellow, label: 'ANALYZING', tone: 'warning' },
    unoptimized: { color: text.tertiary, label: 'CURRENT', tone: 'neutral' },
    critical: { color: semantic.red, label: 'CRITICAL', tone: 'danger' },
    unavailable: { color: text.tertiary, label: 'N/A', tone: 'neutral' },
  }
}

/* ------------------------------------------------------------------ */
/* Metric thresholds — mirrored from the desktop gauges                */
/* ------------------------------------------------------------------ */

export const thresholds = {
  ping: { good: 30, warn: 80 },
  jitter: { good: 5, warn: 15 },
  packetLoss: { good: 0.5, warn: 2 },
  temperature: { good: 40, warn: 48 },
  batteryTemp: { good: 38, warn: 45 },
  storage: { good: 75, warn: 90 },
  ram: { good: 70, warn: 88 },
  cpu: { good: 65, warn: 85 },
  fpsDrop: { good: 5, warn: 15 },
}

/** Map a measured value onto a semantic tone. Accepts a theme or theme.colors. */
export function toneFor(value, band, theme) {
  const semantic = theme?.colors?.semantic || theme?.semantic
  const text = theme?.colors?.text || theme?.text
  const neutral = text?.tertiary || '#8f96a8'
  if (!semantic) return neutral
  if (value == null || Number.isNaN(value)) return neutral
  if (value <= band.good) return semantic.green
  if (value <= band.warn) return semantic.yellow
  return semantic.red
}

export default {
  DARK,
  LIGHT,
  ACCENTS,
  ACCENT_OPTIONS,
  MODE_OPTIONS,
  DENSITY_OPTIONS,
  typography,
  spacing,
  DENSITY,
  radius,
  shadows,
  GRADIENTS,
  GRADIENT_LOCATIONS,
  motion,
  statusPalette,
  thresholds,
  toneFor,
}
