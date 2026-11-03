import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ThemeProvider } from '../src/theme/ThemeProvider'
import { DEFAULT_PREFERENCES } from '../src/store/preferences'
import MacroEditorScreen from '../src/screens/MacroEditorScreen'
import { macroStore } from '../src/store/macros'

const mockGoBack = jest.fn()
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: mockGoBack }) }))

it('saves a user-edited macro through the real editor and persistent store', async () => {
  await macroStore.reset()
  const view = await render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 24, left: 0, right: 0, bottom: 16 } }}><ThemeProvider initialPreferences={DEFAULT_PREFERENCES}><MacroEditorScreen route={{ params: undefined }} navigation={{ goBack: mockGoBack }} /></ThemeProvider></SafeAreaProvider>)
  await fireEvent.changeText(view.getByLabelText('Macro name'), 'Training cue')
  await fireEvent.changeText(view.getByLabelText('Category'), 'Practice')
  await fireEvent.press(view.getByRole('button', { name: 'Save macro' }))
  await waitFor(() => expect(mockGoBack).toHaveBeenCalled())
  expect(macroStore.getState().data.macros[0]).toMatchObject({ name: 'Training cue', category: 'Practice', repeats: 1 })
}, 20000)
