import React, { useId } from 'react'
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop, Line } from 'react-native-svg'

import { useTheme } from '../../theme/ThemeProvider'

export function buildSparkPaths(values, width = 100, height = 40, inset = 2) {
  const length = values.length
  if (length === 0) return { line: '', area: '' }

  const numeric = values.filter((value) => typeof value === 'number' && Number.isFinite(value))
  if (numeric.length === 0) return { line: '', area: '' }

  const min = Math.min(...numeric)
  const max = Math.max(...numeric)
  const span = max - min || 1
  const usable = height - inset * 2

  const points = values.map((value, index) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    const x = length === 1 ? width / 2 : (index / (length - 1)) * width
    const y = height - inset - ((value - min) / span) * usable
    return [x, y]
  })

  let line = ''
  let pen = false
  let hasGap = false
  for (const point of points) {
    if (!point) {
      pen = false
      hasGap = true
      continue
    }
    line += `${pen ? 'L' : 'M'}${point[0].toFixed(2)} ${point[1].toFixed(2)} `
    pen = true
  }

  let area = ''
  if (!hasGap && points.length > 1) {
    area = `M0 ${height} L${points.map((point) => `${point[0].toFixed(2)} ${point[1].toFixed(2)}`).join(' L')} L${width} ${height} Z`
  }

  return { line: line.trim(), area }
}

export function Sparkline({ values = [], height = 42, color, fill = true, strokeWidth = 2 }) {
  const theme = useTheme()
  const gradientId = `spark${useId().replace(/:/g, '')}`
  const { line, area } = buildSparkPaths(values, 100, height)
  const stroke = color ?? theme.accent.color

  return (
    <Svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
      <Defs>
        <SvgGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={stroke} stopOpacity={0.32} />
          <Stop offset="1" stopColor={stroke} stopOpacity={0} />
        </SvgGradient>
      </Defs>
      {line ? (
        <>
          {fill && area ? <Path d={area} fill={`url(#${gradientId})`} /> : null}
          <Path
            d={line}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      ) : (
        <Line
          x1="0"
          y1={height / 2}
          x2="100"
          y2={height / 2}
          stroke={theme.colors.border.base}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      )}
    </Svg>
  )
}

export default Sparkline
