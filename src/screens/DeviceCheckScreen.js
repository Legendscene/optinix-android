import React, { useCallback, useState } from 'react'
import { View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { ResultNotice } from '../components/ui/ResultNotice'
import { Row } from '../components/ui/Row'
import { Screen } from '../components/ui/Screen'
import { Type } from '../components/ui/Type'
import { HONEST_LIMITS, buildReadiness, groupChecks } from '../lib/deviceReadiness'
import appsNative from '../native/apps'
import gamingNative from '../native/gaming'
import { usePreferences } from '../theme/ThemeProvider'

const TONE = { ok: 'success', todo: 'warn', na: 'neutral' }
const LABEL = { ok: 'READY', todo: 'SET UP', na: 'N/A' }

export default function DeviceCheckScreen() {
  const { preferences } = usePreferences()
  const [capabilities, setCapabilities] = useState(null)
  const [permissions, setPermissions] = useState({})
  const [startup, setStartup] = useState(null)
  const [note, setNote] = useState(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const [caps, perms, vendor] = await Promise.all([
      gamingNative.getCapabilities(),
      appsNative.getPermissionState(),
      appsNative.getStartupSupport(),
    ])
    setCapabilities(caps ?? {})
    setPermissions(perms ?? {})
    setStartup(vendor ?? null)
  }, [])

  useFocusEffect(useCallback(() => {
    let alive = true
    refresh().then(() => { if (!alive) return }).catch(() => { if (alive) setNote({ ok: false, message: 'Android could not read the capability probes on this device.' }) })
    return () => { alive = false }
  }, [refresh]))

  if (capabilities == null) {
    return (
      <Screen bottomInset={40}>
        <PageHeader title="Device check" subtitle="What this phone actually allows. Nothing here is simulated." />
        <Card><EmptyState glyph="◌" title="Checking this device…" body="Reading overlay, usage, DND, settings and vendor auto-start capabilities." /></Card>
      </Screen>
    )
  }

  const readiness = buildReadiness({ capabilities, permissions, startup, preferences })
  const groups = groupChecks(readiness.checks)

  const runAction = async (check) => {
    const action = check.action
    if (!action) return
    setBusy(true)
    try {
      if (action.kind === 'settings') setNote(await gamingNative.openSettings(action.target))
      else if (action.kind === 'exempt') {
        const granted = await appsNative.requestBatteryOptimizationExemption()
        setNote({
          ok: granted,
          message: granted
            ? 'Android opened the exemption prompt. Confirm it there, then come back.'
            : 'Android did not offer the battery exemption prompt. Open Battery optimisation from system settings.',
        })
      } else if (action.kind === 'startup') setNote(await appsNative.openAutoStartSettings())
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen bottomInset={40}>
      <PageHeader title="Device check" subtitle="What this phone actually allows. Nothing here is simulated." />

      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Type variant="h1" style={{ flex: 1 }}>{readiness.passed}/{readiness.total}</Type>
          <Badge
            label={readiness.pending === 0 ? 'READY' : 'SETUP'}
            tone={readiness.pending === 0 ? 'success' : 'warn'}
          />
        </View>
        <Type variant="bodySm" tone="secondary">{readiness.headline}</Type>
        {readiness.advisory ? (
          <Type variant="caption" tone="tertiary">
            {readiness.advisory} optional control{readiness.advisory === 1 ? '' : 's'} can still be enabled below.
          </Type>
        ) : null}
        <Button label="Re-check this phone" variant="secondary" size="sm" loading={busy} onPress={async () => { setBusy(true); try { await refresh(); setNote({ ok: true, message: 'Capabilities re-read from this device.' }) } finally { setBusy(false) } }} />
      </Card>

      <ResultNotice result={note} />

      {groups.map((group) => (
        <Card key={group.title} style={{ gap: 2 }}>
          <Type variant="h3" style={{ marginBottom: 8 }}>{group.title}</Type>
          {group.items.map((check) => (
            <Row
              key={check.id}
              title={check.title}
              subtitle={check.detail}
              accessibilityLabel={`${check.title}. ${check.detail}. Status: ${LABEL[check.state]}.`}
              accessibilityHint={check.action ? `Action available: ${check.action.label}. Use the button on the right.` : 'No action needed for this check.'}
              right={
                check.action ? (
                  <Button label={check.action.label} size="sm" variant="secondary" loading={busy} onPress={() => runAction(check)} />
                ) : (
                  <Badge label={LABEL[check.state]} tone={TONE[check.state]} />
                )
              }
            />
          ))}
        </Card>
      ))}

      <Card style={{ gap: 10 }}>
        <Type variant="h3">What Optinix will not pretend</Type>
        {HONEST_LIMITS.map((limit) => (
          <View key={limit.title} style={{ gap: 2 }}>
            <Type variant="bodySm">{limit.title}</Type>
            <Type variant="caption" tone="tertiary">{limit.detail}</Type>
          </View>
        ))}
      </Card>
    </Screen>
  )
}
