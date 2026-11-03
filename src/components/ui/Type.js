import React from 'react'
import { Text } from 'react-native'

import { useTheme } from '../../theme/ThemeProvider'

const VARIANTS = {
  hero: { family: 'display', size: 'hero', leading: 1.02, letterSpacing: 1.5 },
  display1: { family: 'display', size: 'display1', leading: 1.05, letterSpacing: 0.8 },
  display2: { family: 'display', size: 'display2', leading: 1.1, letterSpacing: 0.6 },
  display3: { family: 'displayMedium', size: 'display3', leading: 1.15, letterSpacing: 0.4 },
  h1: { family: 'display', size: 'display2', leading: 1.18, letterSpacing: -0.8 },
  h2: { family: 'bodySemi', size: 'lg', leading: 1.25 },
  h3: { family: 'bodySemi', size: 'base', leading: 1.3 },
  body: { family: 'body', size: 'base', leading: 1.5 },
  bodySemi: { family: 'bodySemi', size: 'base', leading: 1.4 },
  bodySm: { family: 'body', size: 'sm', leading: 1.45 },
  caption: { family: 'body', size: 'xs', leading: 1.4 },
  label: { family: 'bodySemi', size: 'xs', leading: 1.35, letterSpacing: 0.2 },
  eyebrow: { family: 'bodySemi', size: 'xs', leading: 1.35, letterSpacing: 0.5 },
  mono: { family: 'mono', size: 'sm', leading: 1.35 },
  monoLg: { family: 'monoBold', size: 'lg', leading: 1.2 },
  monoXl: { family: 'monoBold', size: 'display3', leading: 1.1 },
}

function toneColor(theme, tone) {
  switch (tone) {
    case 'secondary':
      return theme.colors.text.secondary
    case 'tertiary':
      return theme.colors.text.tertiary
    case 'accent':
      return theme.accent.color
    case 'accentInk':
      return theme.accent.ink
    case 'onAccent':
      return theme.accent.onAccent
    case 'success':
      return theme.colors.semantic.green
    case 'warn':
      return theme.colors.semantic.yellow
    case 'danger':
      return theme.colors.semantic.red
    case 'info':
      return theme.colors.semantic.cyan
    case 'violet':
      return theme.colors.semantic.violet
    default:
      return theme.colors.text.primary
  }
}

export function Type({ variant = 'body', tone = 'primary', align, style, children, ...rest }) {
  const theme = useTheme()
  const spec = VARIANTS[variant] ?? VARIANTS.body
  const fontSize = theme.typography.size[spec.size]
  const lineHeight = Math.round(fontSize * (spec.leading ?? 1.35))

  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: theme.typography.family[spec.family],
          fontSize,
          lineHeight,
          letterSpacing: spec.letterSpacing ?? 0,
          color: toneColor(theme, tone),
          textAlign: align,
          includeFontPadding: false,
        },
        style,
      ]}
    >
      {children}
    </Text>
  )
}

export default Type
