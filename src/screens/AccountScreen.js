/**
 * AccountScreen â€” premium account surface: profile, connected providers
 * (Google/Discord linking), password change, cloud-sync status + conflict
 * resolution, device management, sign out and account deletion.
 *
 * Honesty: sync status comes straight from the cloudSync engine (never a
 * fake "âœ“ all synced"), an unconfigured build says so, and the remove-device
 * action deletes the cloud row only â€” nothing local is pretend-deleted.
 */
import React, { useCallback, useRef, useState } from 'react'
import { View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

import { Screen } from '../components/ui/Screen'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Type } from '../components/ui/Type'
import { Field } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { ResultNotice } from '../components/ui/ResultNotice'
import { SectionHeader } from '../components/ui/SectionHeader'
import { PulseDot } from '../components/ui/PulseDot'
import { useCloudSyncState } from '../hooks/useCloudSyncState'
import { useTheme } from '../theme/ThemeProvider'
import { getSupabase } from '../services/supabase'
import { success as hapticSuccess, tap as hapticTap } from '../lib/haptics'
import {
  getAuthStatus,
  linkProvider,
  requestAccountDeletion,
  requestPasswordReset,
  signOut,
  unlinkProvider,
  updateDisplayName,
  updatePassword,
} from '../services/auth'
import { syncNow, resolveConflictWithCloud, resolveConflictWithDevice } from '../services/cloudSync'
import { relativeTime } from '../lib/format'

const PROVIDER_LABELS = {
  google: 'Google',
  discord: 'Discord',
  email: 'Email',
  azure: 'Microsoft',
  apple: 'Apple',
  github: 'GitHub',
}

const SYNC_COPY = {
  disabled: { label: 'Not configured', tone: 'neutral' },
  'signed-out': { label: 'Signed out', tone: 'neutral' },
  idle: { label: 'Ready', tone: 'neutral' },
  syncing: { label: 'Syncingâ€¦', tone: 'accent' },
  saved: { label: 'All synced âœ“', tone: 'success' },
  offline: { label: 'Offline â€” will retry', tone: 'warn' },
  error: { label: 'Sync problem', tone: 'warn' },
  conflict: { label: 'Needs your choice', tone: 'warn' },
}

export default function AccountScreen({ navigation }) {
  const theme = useTheme()
  const sync = useCloudSyncState()
  const [status, setStatus] = useState(null) // auth snapshot
  const [profile, setProfile] = useState(null)
  const [devices, setDevices] = useState(null)
  const [notice, setNotice] = useState(null)
  const [nameDraft, setNameDraft] = useState(null)
  const [pwDraft, setPwDraft] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const alive = useRef(true)

  const load = useCallback(async () => {
    const auth = await getAuthStatus()
    if (!alive.current) return
    setStatus(auth)
    setNameDraft(auth.user?.user_metadata?.display_name ?? null)
    const client = getSupabase()
    if (!client || !auth.user) {
      setProfile(null)
      setDevices(null)
      return
    }
    const u = auth.user
    setProfile({
      userId: u.id,
      email: u.email ?? '(no email on this account)',
      displayName: u.user_metadata?.display_name ?? null,
      createdAt: u.created_at ?? null,
      identities: Array.isArray(u.identities) ? u.identities : [],
      hasPassword: Array.isArray(u.identities)
        ? u.identities.some((i) => i?.provider === 'email')
        : true,
    })
    try {
      const { data, error } = await client.from('devices').select('device_id, label, platform, model, app_version, os_version, last_seen_at').eq('user_id', u.id).order('last_seen_at', { ascending: false })
      if (error) throw error
      if (alive.current) setDevices(Array.isArray(data) ? data : [])
    } catch {
      if (alive.current) setDevices(null)
    }
  }, [])

  useFocusEffect(useCallback(() => {
    alive.current = true
    load()
    return () => {
      alive.current = false
    }
  }, [load]))

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load()
    } finally {
      if (alive.current) setRefreshing(false)
    }
  }, [load])

  if (!status || !status.configured) {
    return (
      <Screen>
        <PageHeader title="Optinix Account" subtitle="Cloud sign-in and settings sync, optional but built in." />
        <Card style={{ gap: 10 }}>
          <Type variant="h2">Not configured in this build</Type>
          <Type variant="bodySm" tone="secondary">
            This Optinix build has no cloud credentials, so account features are honestly
            unavailable. Every optimizer, HUD and gaming feature keeps working on this device.
          </Type>
        </Card>
        <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} />
      </Screen>
    )
  }

  if (!status.user) {
    return (
      <Screen>
        <PageHeader
          title="Optinix Account"
          subtitle="Optional cloud account: your theme, HUD and gaming setup follow your devices."
        />
        <Card style={{ gap: 12 }}>
          <Type variant="h2">You are using Optinix without an account</Type>
          <Type variant="bodySm" tone="secondary">
            That is perfectly fine. Sign in whenever you want settings sync, device management
            and password login â€” or keep going without it.
          </Type>
          <Button label="Sign in or create an account" onPress={() => navigation.navigate('Auth')} />
        </Card>
      </Screen>
    )
  }

  const syncCopy = SYNC_COPY[sync.status] ?? SYNC_COPY.idle
  const providers = profile?.identities ?? []
  const oauthProviders = ['google', 'discord']
  const needsPassword = profile && !profile.hasPassword && providers.length > 0

  const saveName = async () => {
    if (nameDraft == null) return
    const result = await updateDisplayName(nameDraft)
    if (result.ok) {
      setProfile((prev) => prev ? { ...prev, displayName: String(nameDraft).trim() } : prev)
      setNotice({ ok: true, message: 'Saved. Your account profile now shows this name.' })
      await load()
    } else {
      setNotice({ ok: false, message: result.error })
    }
  }

  const toggleProvider = async (provider) => {
    const linked = providers.some((i) => i?.provider === provider)
    const result = linked
      ? await unlinkProvider(providers.find((i) => i?.provider === provider)?.identity_id)
      : await linkProvider(provider)
    if (result.ok) {
      setNotice({ ok: true, message: linked ? 'Provider unlinked from this account.' : `${PROVIDER_LABELS[provider]} is now linked. You can sign in with it.` })
      await load()
    } else if (!result.cancelled) {
      setNotice({ ok: false, message: result.error })
    }
  }

  const savePassword = async () => {
    if (String(pwDraft).length < 6) {
      setNotice({ ok: false, message: 'Password must be at least 6 characters.' })
      return
    }
    setPwBusy(true)
    try {
      const result = await updatePassword(pwDraft)
      if (result.ok) {
        setPwDraft('')
        setNotice({ ok: true, message: needsPassword ? 'Password set. You can now also sign in with email + this password.' : 'Password updated for this account.' })
      } else {
        setNotice({ ok: false, message: result.error })
      }
    } finally {
      setPwBusy(false)
    }
  }

  const removeDeviceRow = async (deviceId) => {
    const client = getSupabase()
    if (!client || !profile) {
      setNotice({ ok: false, message: 'Cloud is not available right now.' })
      return
    }
    try {
      const { error } = await client.from('devices').delete().eq('device_id', deviceId).eq('user_id', profile.userId)
      if (error) throw error
      setDevices((prev) => (Array.isArray(prev) ? prev.filter((d) => d.device_id !== deviceId) : prev))
      setNotice({ ok: true, message: 'Device removed from your account. It stops syncing until it signs in again.' })
    } catch {
      setNotice({ ok: false, message: 'Cloud is not available right now.' })
    }
  }

  const doSignOut = async () => {
    const result = await signOut()
    if (result.ok) await load()
    else setNotice({ ok: false, message: result.error })
  }

  const doDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    const result = await requestAccountDeletion()
    if (result.ok) {
      setConfirmDelete(false)
      await load()
      setNotice({ ok: true, message: 'Account deleted on the server and signed out here.' })
    } else {
      setNotice({ ok: false, message: result.error })
    }
  }

  const runSyncNow = async () => {
    hapticTap()
    const ok = await syncNow()
    if (ok) hapticSuccess()
    if (!ok && sync.error) setNotice({ ok: false, message: sync.error })
  }

  return (
    <Screen scroll contentStyle={{ gap: 14 }}>
      <PageHeader
        title="Optinix Account"
        subtitle="Your cloud profile, connected providers, synced devices and settings sync."
      />
      {notice ? <ResultNotice result={{ ok: notice.ok, message: notice.message }} /> : null}

      <SectionHeader eyebrow="Profile" />
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 46, height: 46, borderRadius: 14, borderWidth: 1, borderColor: theme?.colors?.border?.light, alignItems: 'center', justifyContent: 'center' }}>
            <Type variant="h3">{(profile?.displayName || profile?.email || '?').slice(0, 1).toUpperCase()}</Type>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Type variant="body">{profile?.displayName || profile?.email}</Type>
            <Type variant="caption" tone="tertiary">{profile?.email}</Type>
          </View>
          <Badge tone="success" label="Signed in" />
        </View>
        {profile?.createdAt ? (
          <Type variant="caption" tone="tertiary">{`Member since ${new Date(profile.createdAt).toLocaleDateString()}`}</Type>
        ) : null}
        <Field
          label="Display name"
          placeholder="How should Optinix greet you?"
          value={nameDraft ?? ''}
          onChangeText={setNameDraft}
          maxLength={40}
        />
        <Button label="Save name" size="sm" onPress={saveName} disabled={nameDraft == null || nameDraft === (profile?.displayName ?? '')} />
      </Card>

      <SectionHeader eyebrow="Cloud sync" />
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Type variant="h3" style={{ flex: 1 }}>Settings sync</Type>
          {sync.status === 'syncing' ? <PulseDot active tone="accent" size={8} /> : null}
          <Badge tone={syncCopy.tone} label={syncCopy.label} />
        </View>
        <Type variant="bodySm" tone="secondary">
          Theme, in-game HUD, gaming preferences, your saved games and macros are synced to
          your Optinix Cloud account. Passwords and credentials are never uploaded.
        </Type>
        <Type variant="caption" tone="tertiary">
          {sync.lastSyncedAt ? `Last synced ${relativeTime(sync.lastSyncedAt)}` : 'This device has not completed a sync handshake yet.'}
        </Type>
        {sync.status === 'saved' && sync.lastAction === 'restore' ? (
          <ResultNotice result={{ ok: true, message: 'Your saved setup was loaded from the cloud — theme, HUD, gaming settings, game library and macros now match the copy stored on your Optinix account.' }} />
        ) : null}
        {sync.error && sync.status !== 'conflict' ? <ResultNotice result={{ ok: false, message: sync.error }} /> : null}
        {sync.status === 'conflict' ? (
          <View style={{ gap: 8 }}>
            <ResultNotice result={{ ok: false, message: sync.error ?? 'Newer settings exist in the cloud and on this device.' }} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button label="Use cloud copy" size="sm" onPress={resolveConflictWithCloud} />
              <Button label="Keep this device" size="sm" variant="ghost" onPress={resolveConflictWithDevice} />
            </View>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label="Sync now" size="sm" loading={sync.status === 'syncing'} onPress={runSyncNow} style={{ flex: 1 }} />
          <Button label="Refresh" size="sm" variant="ghost" loading={refreshing} onPress={refresh} style={{ flex: 1 }} />
        </View>
      </Card>

      <SectionHeader eyebrow="Connected providers" />
      <Card style={{ gap: 12 }}>
        <Type variant="bodySm" tone="secondary">
          Ways to sign in to this account. Link a second provider so a lost password never
          locks you out.
        </Type>
        {[...oauthProviders, 'email'].map((provider) => {
          const linked = providers.some((i) => i?.provider === provider)
          const label = PROVIDER_LABELS[provider] ?? provider
          return (
            <View key={provider} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Type variant="bodySm">{label}</Type>
                {linked ? <Type variant="caption" tone="tertiary">Linked to this account</Type> : <Type variant="caption" tone="tertiary">Not linked</Type>}
              </View>
              {linked || oauthProviders.includes(provider) ? (
                <Button
                  label={linked && oauthProviders.includes(provider) ? 'Unlink' : linked ? 'Linked âœ“' : 'Link'}
                  size="sm"
                  variant={linked && oauthProviders.includes(provider) ? 'ghost' : 'primary'}
                  disabled={linked && !oauthProviders.includes(provider)}
                  onPress={() => toggleProvider(provider)}
                />
              ) : null}
            </View>
          )
        })}
        {providers.length === 0 ? (
          <Type variant="caption" tone="tertiary">No linked identities were returned for this account.</Type>
        ) : null}
      </Card>

      <SectionHeader eyebrow="Password" />
      <Card style={{ gap: 12 }}>
        {needsPassword ? (
          <Type variant="bodySm" tone="secondary">
            You signed in with a linked provider, so no password exists yet. Set one to be
            able to sign in with email too (or use “Forgot password” for a reset link later).
          </Type>
        ) : null}
        <Field
          label={needsPassword ? 'New password' : 'Change password'}
          placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
          secureTextEntry
          autoCapitalize="none"
          value={pwDraft}
          onChangeText={setPwDraft}
          maxLength={72}
        />
        <Button label={needsPassword ? 'Set password' : 'Update password'} size="sm" loading={pwBusy} onPress={savePassword} />
        <Button
          label="Email me a reset link instead"
          size="sm"
          variant="ghost"
          onPress={async () => {
            const result = await requestPasswordReset(profile.email)
            setNotice(result.ok
              ? { ok: true, message: 'Reset link sent. Open it on this phone to finish in Optinix.' }
              : { ok: false, message: result.error })
          }}
        />
      </Card>

      <SectionHeader eyebrow="Devices" />
      <Card style={{ gap: 10 }}>
        {devices == null ? (
          <Type variant="bodySm" tone="secondary">
            Device list is not available. If you just created the account tables migration, it
            will appear from the next sync.
          </Type>
        ) : devices.length === 0 ? (
          <Type variant="bodySm" tone="secondary">No devices registered yet â€” sync once and this phone shows up here.</Type>
        ) : (
          devices.map((device) => (
            <View key={device.device_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Type variant="bodySm">{device.label || device.model || 'Android device'}</Type>
                <Type variant="caption" tone="tertiary">
                  {[device.os_version ? `Android ${device.os_version}` : null, device.app_version ? `app ${device.app_version}` : null, device.last_seen_at ? `seen ${relativeTime(device.last_seen_at)}` : null].filter(Boolean).join(' Â· ') || 'No handshake data yet'}
                </Type>
              </View>
              <Button label="Remove" size="sm" variant="ghost" onPress={() => removeDeviceRow(device.device_id)} />
            </View>
          ))
        )}
      </Card>

      <SectionHeader eyebrow="Session" />
      <Card style={{ gap: 10 }}>
        <Button label="Sign out on this device" variant="ghost" onPress={doSignOut} />
        <Type variant="caption" tone="tertiary">
          Signing out clears the local session and stops sync on this device only. Your cloud
          copy stays for your other devices.
        </Type>
      </Card>

      <SectionHeader eyebrow="Danger zone" />
      <Card style={{ gap: 10 }}>
        <Button label={confirmDelete ? 'Tap again to permanently delete' : 'Delete accountâ€¦'} variant="ghost" onPress={doDelete} />
        {confirmDelete ? (
          <Type variant="caption" tone="tertiary">
            This deletes the account, its synced settings and device list on the server.
            Devices signed in elsewhere lose sync. Nothing on other devices&apos; local storage is
            removed by this action.
          </Type>
        ) : null}
      </Card>
    </Screen>
  )
}
