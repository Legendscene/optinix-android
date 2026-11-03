import React from 'react'
import { render } from '@testing-library/react-native'
import { GameArtwork, GameIcon } from '../src/components/gaming/GameArtwork'
import { ThemeProvider } from '../src/theme/ThemeProvider'
import { DEFAULT_PREFERENCES } from '../src/store/preferences'

it('renders the first-launch hero before any game has been discovered', async () => {
  const view = await render(<ThemeProvider initialPreferences={DEFAULT_PREFERENCES}><GameArtwork /></ThemeProvider>)
  expect(view.getByText('Make room for play.')).toBeTruthy()
  expect(view.getByText('O')).toBeTruthy()
}, 20000)

it('renders a missing game and a game without a readable icon safely', async () => {
  const view = await render(<ThemeProvider initialPreferences={DEFAULT_PREFERENCES}><GameIcon game={null} /></ThemeProvider>)
  expect(view.getByText('O')).toBeTruthy()
  await view.rerender(<ThemeProvider initialPreferences={DEFAULT_PREFERENCES}><GameIcon game={{ packageName: 'com.example.game', label: 'Game', installed: false }} /></ThemeProvider>)
  expect(view.getByText('G')).toBeTruthy()
}, 20000)
