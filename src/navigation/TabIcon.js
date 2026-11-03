import React from 'react'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

const STROKE = 1.7

function Grid({ color, size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3.5" y="3.5" width="7" height="7" rx="2" stroke={color} strokeWidth={STROKE} />
      <Rect x="13.5" y="3.5" width="7" height="7" rx="2" stroke={color} strokeWidth={STROKE} />
      <Rect x="3.5" y="13.5" width="7" height="7" rx="2" stroke={color} strokeWidth={STROKE} />
      <Rect x="13.5" y="13.5" width="7" height="7" rx="2" stroke={color} strokeWidth={STROKE} />
    </Svg>
  )
}

function Bolt({ color, size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13.2 2.8 4.9 13.1c-.4.5 0 1.3.6 1.3h4.4l-1 6.1c-.1.7.8 1.1 1.3.5l8.6-10.5c.4-.5 0-1.3-.6-1.3h-4.6l.8-5.9c.1-.7-.8-1.1-1.2-.5Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function Gamepad({ color, size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7.5 8.5h9a4.5 4.5 0 0 1 4.4 5.4l-.5 2.6a2.4 2.4 0 0 1-4.2 1.1l-1.3-1.6H8.1l-1.3 1.6a2.4 2.4 0 0 1-4.2-1.1l-.5-2.6A4.5 4.5 0 0 1 7.5 8.5Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <Path d="M8.4 11.6v2.6M7.1 12.9h2.6" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Circle cx="15.6" cy="12.2" r="0.85" fill={color} />
      <Circle cx="17.6" cy="14.1" r="0.85" fill={color} />
    </Svg>
  )
}

function Pulse({ color, size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2.8 12.2h3.4l2-5.6 3.6 11 2.1-5.4h7.3"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function Sliders({ color, size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3.5 7.5h9M17 7.5h3.5M3.5 16.5h3.5M11.5 16.5h9" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Circle cx="14.8" cy="7.5" r="2.2" stroke={color} strokeWidth={STROKE} />
      <Circle cx="9.2" cy="16.5" r="2.2" stroke={color} strokeWidth={STROKE} />
    </Svg>
  )
}

const ICONS = {
  Dashboard: Grid,
  Boost: Bolt,
  Games: Gamepad,
  Monitor: Pulse,
  Settings: Sliders,
}

export function TabIcon({ name, color, size = 22 }) {
  const Icon = ICONS[name] ?? Grid
  return <Icon color={color} size={size} />
}

export default TabIcon
