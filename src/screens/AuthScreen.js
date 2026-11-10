/**
 * AuthScreen — sign in / register / forgot password, plus Google & Discord.
 *
 * Email confirmation is honest: after register we state exactly what happened
 * ("check your inbox") instead of pretending a session exists. Login stays
 * OPTIONAL — the header says so, and everything outside this screen works
 * without an account.
 */
import React, { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'

import { Screen } from '../components/ui/Screen'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Type } from '../components/ui/Type'
import { Field } from '../components/ui/Field'
import { ResultNotice } from '../components/ui/ResultNotice'
import { getAuthStatus, requestPasswordReset, signInWithEmail, signInWithProvider, signUpWithEmail } from '../services/auth'
import { getProviderStatus, supabaseEnv } from '../services/supabase'
import { success as hapticSuccess } from '../lib/haptics'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const PROVIDER_SUFFIX = { google: 'Google', discord: 'Discord' }

export default function AuthScreen({ navigation }) {
  const supabaseReady = supabaseEnv().configured
  const [view, setView] = useState('signIn') // signIn | register | forgot
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(null) // 'email' | 'google' | 'discord'
  const [notice, setNotice] = useState(null) // { tone, message }
  const [checked, setChecked] = useState(supabaseReady)
  const [providerStatus, setProviderStatus] = useState(null) // { google, discord } | null
  const alive = useRef(true)

  useEffect(() => () => {
    alive.current = false
  }, [])

  useEffect(() => {
    if (!supabaseReady) return
    getProviderStatus().then((status) => {
      if (alive.current && status) setProviderStatus(status)
    })
  }, [supabaseReady])

  useEffect(() => {
    if (!supabaseReady) return
    getAuthStatus().then((status) => {
      if (!alive.current) return
      setChecked(true)
      if (status.user) navigation.replace('Account')
    })
  }, [navigation, supabaseReady])

  if (!supabaseReady) {
    const env = supabaseEnv()
    return (
      <Screen>
        <PageHeader title="Optinix Account" subtitle="Cloud sign-in and settings sync, optional but built in." />
        <Card style={{ gap: 10 }}>
          <Type variant="h2">Sign-in is not configured in this build</Type>
          <Type variant="bodySm" tone="secondary">
            This app was built without Optinix Cloud credentials, so account features are
            honestly unavailable here. Nothing else changes — every optimizer, HUD and gaming
            feature keeps working on this device.
          </Type>
          <Type variant="caption" tone="tertiary">
            {`Missing settings: SUPABASE_URL ${env.url ? '✓' : '—'}, publishable key ${env.key ? '✓' : '—'}. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY before building, and the Optinix Cloud project still needs the account tables migration.`}
          </Type>
        </Card>
        <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} />
      </Screen>
    )
  }

  const validate = ({ needConfirm = false } = {}) => {
    if (!EMAIL_RE.test(email)) return 'Enter a valid email address.'
    if (password.length < 6) return 'Password must be at least 6 characters.'
    if (needConfirm && password !== confirm) return 'The two passwords do not match.'
    return null
  }

  const submitEmail = async () => {
    const problem = validate({ needConfirm: view === 'register' })
    if (problem) {
      setNotice({ ok: false, message: problem })
      return
    }
    setBusy('email')
    setNotice(null)
    try {
      if (view === 'signIn') {
        const result = await signInWithEmail(email, password)
        if (!alive.current) return
        if (!result.ok) {
          setNotice({ ok: false, message: result.error })
          return
        }
        hapticSuccess()
        navigation.replace('Account')
        return
      }
      if (view === 'register') {
        const result = await signUpWithEmail(email, password)
        if (!alive.current) return
        if (!result.ok) {
          setNotice({ ok: false, message: result.error })
          return
        }
        if (result.needsVerification) {
          hapticSuccess()
          setNotice({ ok: true, message: 'Account created. One step left: open the Optinix verification email and tap the link. Then come back here and sign in.' })
          setView('signIn')
        } else {
          hapticSuccess()
          navigation.replace('Account')
        }
        return
      }
      // forgot
      const result = await requestPasswordReset(email)
      if (!alive.current) return
      setNotice(result.ok
        ? { ok: true, message: 'Reset link sent to this email. Open the link on this phone — it lands directly in Optinix so you can set a new password on the Account screen.' }
        : { ok: false, message: result.error })
    } finally {
      if (alive.current) setBusy(null)
    }
  }

  const runProvider = async (provider) => {
    setBusy(provider)
    setNotice(null)
    try {
      const result = await signInWithProvider(provider)
      if (!alive.current) return
      if (result.ok) {
        hapticSuccess()
        navigation.replace('Account')
        return
      }
      if (result.cancelled) {
        setNotice({ ok: true, message: 'Sign-in was cancelled before it finished. Try again whenever you like.' })
        return
      }
      setNotice({ ok: false, message: result.error ?? 'Sign-in did not complete.' })
    } finally {
      if (alive.current) setBusy(null)
    }
  }

  const title = { signIn: 'Welcome back', register: 'Create your Optinix account', forgot: 'Reset your password' }[view]
  const subtitle = {
    signIn: 'Sync your theme, HUD and gaming setup across devices. Creating an account is optional — Optinix works fully without one.',
    register: 'One account, all your devices: your settings follow you everywhere.',
    forgot: 'We email you a reset link that opens straight back into Optinix.',
  }[view]

  return (
    <Screen>
      <PageHeader title="Optinix Account" subtitle={subtitle} />
      <Card style={{ gap: 12 }}>
        <Type variant="h2">{title}</Type>
        {notice ? <ResultNotice result={{ ok: notice.ok ?? false, message: notice.message }} /> : null}
        <Field
          label="Email"
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        {view === 'forgot' ? null : (
          <Field
            label={view === 'register' ? 'Password (min 6 characters)' : 'Password'}
            placeholder="••••••••"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        )}
        {view === 'register' ? (
          <Field
            label="Confirm password"
            placeholder="••••••••"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
            error={confirm.length > 0 && confirm !== password ? 'Passwords do not match yet.' : null}
          />
        ) : null}
        <View style={{ gap: 8 }}>
          <Button label={view === 'signIn' ? 'Sign in' : view === 'register' ? 'Create account' : 'Send reset link'} loading={busy === 'email'} onPress={submitEmail} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {view !== 'forgot' ? (
              <Button
                key={view}
                label={view === 'signIn' ? 'Need an account? Register' : 'Already registered? Sign in'}
                variant="ghost"
                onPress={() => { setView(view === 'signIn' ? 'register' : 'signIn'); setNotice(null) }}
              />
            ) : null}
            <Button label={view === 'forgot' ? 'Back to sign in' : 'Forgot password?'} variant="ghost" onPress={() => { setView(view === 'forgot' ? 'signIn' : 'forgot'); setNotice(null) }} />
          </View>
        </View>
      </Card>

      {view !== 'forgot' ? (
        <Card style={{ gap: 12 }}>
          <Type variant="label">Or continue with</Type>
          {['google', 'discord'].map((provider) => {
            const state = providerStatus?.[provider]
            const suffix = state === 'enabled' ? '' : state === 'disabled' ? ' · setup needed' : ''
            return (
              <View key={provider} style={{ gap: 4 }}>
                <Button
                  label={`Continue with ${PROVIDER_SUFFIX[provider]}${suffix}`}
                  loading={busy === provider}
                  onPress={() => runProvider(provider)}
                />
                {state === 'disabled' ? (
                  <Type variant="caption" tone="warn">
                    The Optinix Cloud project has not enabled {PROVIDER_SUFFIX[provider]} sign-in yet — pressing this can only show a setup notice, not a login page. It turns on with one dashboard toggle (docs/account-setup.md).
                  </Type>
                ) : null}
              </View>
            )
          })}
          <Type variant="caption" tone="tertiary">
            Google and Discord open in the system browser and return to Optinix automatically.
            Both are also linking options after you sign in.
          </Type>
        </Card>
      ) : null}

      {!checked ? (
        <Type variant="caption" tone="tertiary">Checking your Optinix Cloud configuration…</Type>
      ) : null}
      <Type variant="caption" tone="tertiary" align="center">
        No account needed — you can keep using Optinix without signing in, and this device
        keeps working fully offline.
      </Type>
    </Screen>
  )
}
