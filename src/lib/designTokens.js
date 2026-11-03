/**
 * designTokens.js — the Optinix design language, ported 1:1 from
 * PC-Optimizer/desktop/src/index.css so both apps share one visual identity.
 *
 * PC ships its theme as CSS variables driven by three attributes (`data-theme`,
 * `data-accent`, `data-density`). React Native has no cascade, so the same
 * values are expressed as plain objects and resolved at runtime by
 * `src/theme/ThemeProvider.js`, which exposes `useTheme()`.
 *
 * Rule carried over from the desktop app: a value that is not measured is
 * `null`, never a fabricated number. The same rule governs `status` below.
 */

/* ------------------------------------------------------------------ */
/* Surfaces & text — dark is the default identity                      */
/* ------------------------------------------------------------------ */

export const DARK = {
  mode: 'dark',
  surface: {
    0: '#06070a',
    1: '#0b0d12',
    2: '#101319',
    3: '#171b23',
    4: '#20252f',
  },
  border: {
    base: '#1e232c',
    light: '#2c333f',
  },
  text: {
    primary: '#eef1f6',
    secondary: '#aeb7c6',
    tertiary: '#8b94a5',
  },
  semantic: {
    green: '#3ea86a',
    greenDim: 'rgba(62,168,106,0.14)',
    yellow: '#c9962f',
    yellowDim: 'rgba(201,150,47,0.14)',
    red: '#d9534f',
    redDim: 'rgba(217,83,79,0.14)',
    cyan: '#5b9dff',
    cyanDim: 'rgba(74,168,196,0.14)',
    violet: '#9b7bff',
    violetDim: 'rgba(139,123,247,0.13)',
    violetLine: 'rgba(139,123,247,0.28)',
    egGreen: '#22eba3',
    egGreenDim: 'rgba(34,235,163,0.14)',
    egLine: 'rgba(34,235,163,0.32)',
    egInk: '#04130e',
  },
  chart: ['#00e5cc', '#4aa8c4', '#c9962f', '#d9534f'],
  /** dim/line/ink are derived per accent; see ACCENTS. */
  onAccent: '#06120f',
  overlay: 'rgba(4,6,10,0.72)',
  scrim: 'rgba(0,0,0,0.62)',
  grid: 'rgba(255,255,255,0.035)',
}

export const LIGHT = {
  mode: 'light',
  surface: {
    0: '#f6f7f9',
    1: '#ffffff',
    2: '#ffffff',
    3: '#eef0f4',
    4: '#e2e5eb',
  },
  border: {
    base: '#e3e6ec',
    light: '#d2d7e0',
  },
  text: {
    primary: '#171a20',
    secondary: '#454b57',
    tertiary: '#646c7c',
  },
  semantic: {
    green: '#1d7f4c',
    greenDim: 'rgba(29,127,76,0.10)',
    yellow: '#96701c',
    yellowDim: 'rgba(150,112,28,0.10)',
    red: '#b93b38',
    redDim: 'rgba(185,59,56,0.10)',
    cyan: '#1f7e99',
    cyanDim: 'rgba(31,126,153,0.10)',
    violet: '#6b5ce0',
    violetDim: 'rgba(107,92,224,0.10)',
    violetLine: 'rgba(107,92,224,0.28)',
    egGreen: '#0f9d6b',
    egGreenDim: 'rgba(15,157,107,0.12)',
    egLine: 'rgba(15,157,107,0.32)',
    egInk: '#ffffff',
  },
  chart: ['#0b7f70', '#1f7e99', '#96701c', '#b93b38'],
  onAccent: '#ffffff',
  overlay: 'rgba(255,255,255,0.82)',
  scrim: 'rgba(16,20,28,0.30)',
  grid: 'rgba(16,20,28,0.03)',
}

/* ------------------------------------------------------------------ */
/* Accent presets — dark keeps the neon values, light darkens for AA   */
/* ------------------------------------------------------------------ */

export const ACCENTS = {
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
    /** Orbitron for the brand/hero numerals. */
    display: 'PlusJakartaSans_700Bold',
    displayMedium: 'PlusJakartaSans_600SemiBold',
    displayRegular: 'PlusJakartaSans_500Medium',
    brand: 'Orbitron_700Bold',
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
  sharp: 2,
  xs: 6,
  soft: 8,
  md: 10,
  lg: 14,
  xl: 16,
  '2xl': 20,
  '3xl': 26,
  pill: 999,
  hex: 6,
}

/* ------------------------------------------------------------------ */
/* Shadows — RN needs both shadow* (iOS) and elevation (Android)       */
/* ------------------------------------------------------------------ */

export const shadows = {
  e1: {
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  e2: {
    shadowColor: '#000',
    shadowOpacity: 0.36,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  e3: {
    shadowColor: '#000',
    shadowOpacity: 0.44,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 11,
  },
  e4: {
    shadowColor: '#000',
    shadowOpacity: 0.52,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 14 },
    elevation: 18,
  },
}

/** Colored glow built from the live accent so presets keep working. */
export function glow(color, strength = 0.55, radiusPx = 14) {
  return {
    shadowColor: color,
    shadowOpacity: strength,
    shadowRadius: radiusPx,
    shadowOffset: { width: 0, height: 0 },
    elevation: Math.round(radiusPx * 0.55),
  }
}

/* ------------------------------------------------------------------ */
/* Gradients — arrays of stop colors for expo-linear-gradient          */
/* ------------------------------------------------------------------ */

export const GRADIENTS = {
  dark: {
    hero: ['#06070a', '#0b0d12', '#06070a'],
    accent: ['#2ee6cf', '#3ad9c2', '#79e6d3'],
    title: ['#e8eaef', '#4df0e1', '#8b7bf7'],
    control: ['#00e5cc', '#4aa8c4', '#8b7bf7'],
    optimized: ['#22eba3', '#00e5cc', '#4aa8c4'],
    analyzing: ['#ffc75c', '#ffb020', '#c9962f'],
    critical: ['#ff96ac', '#d9534f', '#b93b38'],
    companion: ['#a99cff', '#8b7bf7', '#6b5ce0'],
    glass: ['rgba(20,22,26,0.92)', 'rgba(10,11,13,0.88)'],
    card: ['rgba(23,27,35,0.9)', 'rgba(11,13,18,0.96)'],
    rail: ['transparent', 'rgba(0,229,204,0.32)', 'rgba(139,123,247,0.32)', 'transparent'],
  },
  light: {
    hero: ['#ffffff', '#f6f7f9', '#eef0f4'],
    accent: ['#0b7f70', '#1f7e99', '#6b5ce0'],
    title: ['#171a20', '#0a6e62', '#0b7f70'],
    control: ['#0b7f70', '#1f7e99'],
    optimized: ['#1d7f4c', '#0b7f70', '#1f7e99'],
    analyzing: ['#96701c', '#9a6700', '#855800'],
    critical: ['#b93b38', '#c2185b', '#a6144e'],
    companion: ['#6b5ce0', '#4f46e5', '#4338ca'],
    glass: ['rgba(255,255,255,0.94)', 'rgba(246,247,249,0.9)'],
    card: ['rgba(255,255,255,0.98)', 'rgba(238,240,244,0.96)'],
    rail: ['transparent', 'rgba(11,127,112,0.28)', 'rgba(107,92,224,0.28)', 'transparent'],
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
  glow,
  GRADIENTS,
  GRADIENT_LOCATIONS,
  motion,
  statusPalette,
  thresholds,
  toneFor,
}
