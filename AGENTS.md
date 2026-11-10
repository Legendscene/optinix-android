# AGENTS.md — Optinix Android

**Read this first if you are an AI (or human) touching this project.**  
If you change behavior, files, build steps, or fixes, update this file in the same session.  
This is the single source of truth for "what exists, where it lives, and why".Last updated: 2026-11-09 (evening HUD+ pass installed below)

## What this is

`Android-Optimizer` is a React Native (Expo SDK 58) Android device optimizer + in-game HUD.
It mirrors the architecture and honesty rules of `../PC-Optimizer` (Flask backend, port 5420),
but runs fully on-device. There is no Python backend on Android: all data comes from Kotlin
native modules or JS services.

App identity: `net.exitpoint.optinix` / display name `Optinix`.

## Golden rules

**Golden rule additional note (2026-10-26): sessions start only from a visible Optinix
screen.** `OptinixOverlayModule.start/startSession` resolves failure
("Open Optinix and start the session from a visible screen.") when
`currentActivity?.hasWindowFocus() != true` — this is by design (no background launch).
`gameWatch.js` + the old `OverlayAutoStart` flow were **removed in the 2026-11-07
overhaul** (verified unused, then deleted — see the Changelog); foreground detection
when a session runs is native (`ForegroundGameReader`, UsageStats-based).
Launcher-launched games with Optinix in the background will NOT auto-open the overlay
— see Pending #2. The app-side `setOverlayVisible` (JS → native) can explicitly hide
or re-open the control HUD while a session runs; it never starts one.

1. **Never fabricate metrics.** Unmeasured / unsupported values are `null`; UI renders `--`
   and explains why. This matches the PC optimizer's rule.
2. Anything that requires root (clearing other apps' cache, killing system apps, real game FPS)
   is reported unsupported with a reason — never faked.
3. Overlay metrics are measured **inside the overlay service itself** (CPU/RAM/temp/battery).
   Game FPS is intentionally not shown because it cannot be measured without root/hooking.
4. Keep the UI honest about provenance: "APP FRAME RATE" means our app's Choreographer rate,
   not the game's FPS.
5. `android/` and `ios/` are generated (gitignored). Do not treat them as source of truth.

## Current Android 10–16 / HUD contract (2026-11-07)

The user's minimum is **Android 10 / API 29**. `plugins/withOptinixAndroid.js` now
persists minimum 29, target 36 and compile 37 into generated Gradle properties.
Do not raise the minimum above 29. The RN/Expo dependency catalog minimum was 24;
no framework downgrade or manifest override is needed. All three native modules
run strict lint (`NewApi`/`InlinedApi` fatal). `optinix-device` now declares its
already-used network/Wi-Fi permissions in its own manifest (previously only the
app declared them, so standalone module lint reported missing permission).

Current overlay behavior supersedes the historical descriptions below:

- `HandleGeometry.kt`: an 8–10 dp visible edge sliver, **16 dp off-screen**, height
  44–64 dp; no text/bubble and a static small dot. Eight corner-radius values are
  required (four caused a real runtime crash during the first redesign walkthrough).
  The handle's tiny region excludes the system back gesture using the API-29 public
  API. Since the 2026-11-07 23:04 redesign a **tap or an inward swipe both open the
  full assistant panel** (the intermediate QUICK card is gone); hold then drag →
  reposition/edge snap. Dock and vertical fraction persist separately for
  portrait/landscape.
- `OverlayWindow.kt`: **one** overlay window holding a fixed **rail plate** (icon +
  label, sliding active indicator, auto-fitted width) next to an independently
  **scrollable content plate** — fixed header (game name, timer, minimize), metric
  strip, fixed section title, scrollable body, single-line status footer. Sections
  (2026-11-09 simplification, Realme-assistant level): **Tools / Boost / Stats** —
  a fresh panel always opens on **Tools** (brightness, 12-tile tool grid, network
  check card); **Boost** merges the old Performance + Optimization (profile pills,
  memory ring/boost, device review, action deep links); **Stats** merges Monitor +
  Network numbers + the FPS/stats HUD controls. Tool tiles are 70 dp with 22 dp
  icons; honesty notes are trimmed but the meanings are intact.
  Split into `OverlayStyle.kt` (tokens), `OverlayIcons.kt` (21 stroke icons),
  `OverlayControls.kt` (`OverlaySwitch`, `OverlaySlider`, `OverlaySegmented` with an
  animated pill), `OverlaySystem.kt` (settings/DND/screenshot/recorder bridges) and
  `OverlayDashboard.kt` (section bodies). Only the body scrolls; the rail and header
  never move, so section state survives switching. No saved `expanded` state is
  restored on game launch. Outside touch, minimize and idle timeout all dispatch
  through the service.
- `HudPolicy.kt`: persistent `hudVisibility` (`overlayVisibility` JS pref): `edge`,
  `notification`, `disabled`. Notification-only shows nothing until explicit
  **Show game HUD**; minimizing hides both windows again. Disabled stops the
  gaming service, timer, macros and both HUDs. Games still open without a session.
  Session-scoped stats/opacity overrides never overwrite saved defaults.
- `OverlaySupport.kt`: API-29 real-display size + stable/cutout insets; guarded
  API-30+ window metrics; Android 10 Go/low-RAM overlay restriction copy; actual
  notification/channel enablement; guarded API-31 touch-through opacity cap.
  Low-RAM is not proof of Go branding: copy says the OS may block the permission.
- `FpsHudWindow.kt`: nullable readings explicitly render `--` (never blank), size
  fits the display and rotation, title **Optinix stats HUD**, `FLAG_NOT_TOUCHABLE`
  with **WindowManager alpha**, capped to Android's input-obscuring threshold on
  API 31+ (normally 0.8). View alpha alone was insufficient. Both windows are gated
  to foreground library games and permission state.
- Service reads sensors at the configured **2–30 s interval**, at least 5 s in
  battery-conscious mode. It does not poll at 700 ms. Logging records HUD state
  transitions, not every unchanged tick. Network results are applied on the UI
  thread. Explicit reopen cannot start a new background session.
- Process/Startup use public UsageStats/PackageManager/settings APIs on 29–36.
  Startup probes require an enabled/exported, permission-accessible activity and
  distinguish a generic vendor page from a direct startup page. No kill permission
  was added for Android 10–13; App info remains the genuine force-stop route.
- `ForegroundState.kt` fixes late launcher-stop events clearing a newer game
  activity; `ForegroundGameReader` replays a 10 s overlap with timestamp ordering.
  Only public class-name events are used (instance IDs are not in the public SDK).
  Service `dump()` exposes read-only HUD/permission/sample diagnostics to adb.
- `OverlayAdvice.kt` handles real Android thermal status as well as sensor values:
  Severe must not result in "No threshold crossed". Stats caches already-measured
  graph series so selecting the tab need not wait for the next 5 s sample.
- Release helper defaults to ARM64 + ARMv7 (debug ARM64); validated optional
  `OPTINIX_ANDROID_ABIS` override. No notification request for Disabled game launches.

Host verification so far: **21 Jest suites / 107 tests**, ESLint 0/0, **28 native
unit tests** (overlay suite 4+5+4+9+6), all module Kotlin builds and strict native API lint pass (no errors
or NewApi/InlinedApi findings; style/deprecation warnings remain). The final
release/physical walkthrough result is recorded in the latest Changelog entry.
Android 29–35 runtime testing is not implied by lint; no AVD/system image is
installed on this machine. See `docs/android10-compatibility.md` for the matrix and
button audit; optional account deployment steps are in `docs/account-setup.md`.

## Overlay design history (superseded by the current contract above)

`OverlayWindow.kt` renders exactly **one** `TYPE_APPLICATION_OVERLAY` view per service
(`WRAP_CONTENT`, `TRANSLUCENT`, `NOT_FOCUSABLE|NOT_TOUCH_MODAL|FLAG_WATCH_OUTSIDE_TOUCH`) — the window is only as big
as its visible controls, so there is no fullscreen invisible surface and no touch stealing:

- **State A — game-space notch (verified on device 2026-10-26 ~21:58):** in HANDLE mode the
  window is a single **15 × 52 dp notch card (size-dependent: `size`
  config scales the notch to 15–20 dp wide × 44–64 dp tall)** flush against the docked screen edge
  (`tuckPx = dp(2)`), holding a centred pulsing accent dot. Column gravity flips per dock
  side so the notch hugs the persisted right/left edge (`dockPortrait/dockLandscape`).
  Tapping the notch slides the drawer out of that edge; **while any drawer is open the
  notch is hidden** (`handleRowView.visibility = GONE`) — exactly Game Space's two-window
  behaviour replicated inside our one window. The dashboard header carries a `‹`
  minimize button (`performAction("collapse")`, added to the service dispatcher) that
  returns the window to the notch. Verified frame sizes via `dumpsys window`: notch
  `[1575,68][1600,156]` (landscape, 272 dpi), drawer `[1063,68][1600,691]`.
  Idle (`autoHide` on) dims to ~45% opacity and scales to 0.92 after 7 s; any touch
  restores position/alpha and re-arms the timer. Dragging lifts 1.06× with a 2.4°
  rotationX tilt + spring settle; entrance grows out of the notch corner (230 ms
  overshoot); buttons press-scale 0.97→1. All motion is skipped when `reducedMotion`
  is on.
- **State B — quick panel:** 220dp rounded card below the handle: session timer, configured
  shortcut chips (from `overlayShortcuts` prefilter), profile preset buttons (2 rows of 2),
  quick tool grid (Timer/DND/Bright./Net test/Shot/Rec, DND filtered by SDK+access), accent
  "Full dashboard" button, status line.
- **State C — dashboard:** tabbed panel (Perf / Tools / Net / Stats), height auto-fits its
  content (`fit()` measures the scroll content; cap 440dp) — no more fixed 510dp plate with
  dead space. Network tab shows the last measured HTTPS latency via `setNetworkResult()`.
- **2026-10-30 modern-UI pass (Kotlin-only, not yet on device).** `OverlayWindow.kt`
  reskinned to the PC's Obsidian-Spectrum language: layered vertical-gradient plates with
  `#1EFFFFFF` hairline strokes (the hard `#2c333f` grey border is gone), segmented tab
  track (`#141926`) with an accent-tinted active pill, Perf tab rebuilt as a 2×2 metric
  tile grid (`CPU/RAM/Temp/Battery`, `JetBrainsMono_700Bold` 15f values inside `#121722`
  tiles) with presentational status colouring — CPU/RAM warn ≥80 / hot ≥95, temp warn ≥45 /
  hot ≥53 °C, battery low warn ≤25 / hot ≤12 (colour only; the numbers stay exactly what
  the sensors reported and unmeasured stays neutral `--`), quick panel timer now mono-bold
  14f with an accent dot, shortcut chips are hairline pills, panel headers carry a small
  accent dot before the game name, and exactly one accent-filled primary per surface
  (Quick → "Dashboard"; its ink colour is chosen by measured accent luminance since the
  HUD accent is a user preference). `OverlaySparkline.kt` gained a soft accent area fill
  under the CPU line and an endpoint dot on the newest sample (public API unchanged).
  Notch geometry (15–20×44–64 dp), all motion (entrance/drag/idle/pulse), dock/tuck,
  haptics, reduced-motion gating and honest `--` copy are untouched. Battery tile shows
  `⚡` while charging (previously the word "charging", now shorter for the tile).
  Verification: `:optinix-overlay:compileDebugKotlin` BUILD SUCCESSFUL (40 s, only the
  pre-existing VIBRATOR_SERVICE deprecation warning in the service); **no APK was built
  and nothing was installed — the user asked to be consulted before any phone build**;
  jest/eslint not rerun because zero JS files changed.

- **2026-11-07 monochrome + interaction pass (code-only, not on device).** Overlay
  palette re-pointed from Obsidian navy to the PC's current monochrome system (plates
  `#191919→#0a0a0a`, notch `#1c1c1c→#0a0a0a`, tiles `#161616`, buttons `#262626`, tab
  track `#111111`, hairline `#2EFFFFFF`, ink `#ffffff`, muted `#a0a0a0`, quiet notes;
  `--` stays neutral). Numerals use a **lightness-only status ramp** — normal `#a0a0a0`
  → warn `#c1c1c1` → hot `#ffffff` — labels carry meaning, values stay raw sensor
  output. `OverlaySparkline` RAM line `#8a8a8a`, grid `#2c2c2c`; `OverlayWindow.accent()`
  and `OverlayBridge.accent` defaults are ink `#ffffff`. Two new behaviours:
  (1) **tap-outside collapse** — `FLAG_WATCH_OUTSIDE_TOUCH` plus a root `ACTION_OUTSIDE`
  listener folds an open QUICK/DASHBOARD drawer back to the notch (game touches are
  untouched; `NOT_TOUCH_MODAL` preserved); (2) **configurable auto-collapse** —
  `autoCollapseSeconds` config key (never→0, 5/10/20; default 10) arms an independent
  runnable that collapses open drawers while the old 7 s `autoHide` dim keeps working;
  tab taps re-arm via `restoreBrightness()`. `hudAccentHex` now resolves the active
  accent's **dark variant** even for `overlayAccent: 'app'` (a light-mode mono/black
  accent would vanish on the always-dark HUD). New Settings picker Never/5s/10s/20s
  (`overlayAutoCollapse` pref, sanitized enum `['never','5','10','20']`; gaming.js maps
  it to seconds). Fonts: `typography.family.brand` retired from Orbitron →
  `PlusJakartaSans_700Bold` and App.js stopped importing/loading Orbitron.
  Fresh-install accent default is `mono`.

- **2026-11-07 overhaul — the second overlay window: FPS stats HUD (`FpsHudWindow.kt`).**
  The service now draws up to two windows: the control HUD above plus a fully
  pass-through stats plate, shown only while a session runs AND `fpsHudEnabled` is on.
  It is created with `TYPE_APPLICATION_OVERLAY` +
  `FLAG_NOT_FOCUSABLE|FLAG_NOT_TOUCHABLE` — it can never steal a touch from the game —
  and is placed in a chosen corner (`fpsHudCorner`
  topLeft/topRight/bottomLeft/bottomRight; x=12 dp margin, y=30 dp top / 14 dp bottom;
  no dragging, unlike the control HUD). Three modes: `minimal` ("GAME FPS" `--` +
  labelled display-Hz line), `compact` (OPTINIX header + Game FPS/CPU/RAM rows),
  `detailed` (adds a Frame-time row, user-selected metric rows, and the explanatory
  note). Scale 0.7–1.6×, opacity 0.4–1 (default 0.9). Honesty: GAME FPS is permanently
  `--` because ordinary apps cannot read another app's frame statistics (only
  hooks/root would expose them, which are out of scope); Display Hz is a separate
  labelled number, never presented as FPS; CPU/RAM/temp/battery/refresh are the same
  real service-loop `OverlayMetrics` values with the lightness-only status ramp.
  Config arrives via the `fpsHud*` GamingStore keys (JS prefs → gamingConfig → module
  clamps); opacity is a view alpha applied at `show()` time, other keys rebuild the
  layout via a config signature. The service hides/rebuilds it on permission loss,
  `reconfigure()`, `resetPosition()` and `onDestroy()`.

Modes live in `enum Mode { HANDLE, QUICK, DASHBOARD }`; only DASHBOARD persists as the
`expanded` config. `hide()` now nulls **all** view refs (`bubble`, `heading`, `quickTimer`,
`scroll`, etc.), eliminating stale-view actions after `reconfigure()`, and now also
cancels/removes both the idle-dim and auto-collapse callbacks.

## Stack

- Expo `~58.0.17`, React Native `0.88.0`, React `19.3.0`, new architecture on.
- Auth/cloud: `@supabase/supabase-js` 2, `react-native-url-polyfill`, `expo-web-browser`
  (system-browser OAuth), `expo-crypto` (WebCrypto/PKCE shim). Optional feature — the app
  runs fully without it.
- Navigation: `@react-navigation/native` 7, `bottom-tabs` 7 (5 tabs), `native-stack` installed.
- 3D: `expo-gl` + `three@0.186.1` directly (no react-three-fiber). Reanimated 4 + worklets 0.13.
- Styling: plain `StyleSheet` + design tokens. Tailwind/NativeWind were removed.
- Storage: AsyncStorage. Tests: Jest (`jest-expo`) + Testing Library. Lint: ESLint 9 flat config.

## Commands

```powershell
npm install
npm test                 # jest, currently 21 suites / 106 tests
npx eslint .             # lint, currently clean
npx expo export --platform android

npx expo start --dev-client   # dev client (debug build required)
npx expo run:android          # build+install debug (see long-path notes)
npx expo prebuild --platform android --no-install   # regenerate android/
```

Native-only Kotlin compile check (fast, no APK):

```powershell
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
cd android
.\gradlew.bat :optinix-device:compileDebugKotlin :optinix-apps:compileDebugKotlin :optinix-overlay:compileDebugKotlin --console=plain
```

Standalone release APK (required tweaks are in Generated Android / Gotchas):

```powershell
.\gradlew.bat :app:assembleRelease "-PreactNativeArchitectures=arm64-v8a,armeabi-v7a" --console=plain
adb install -r app\build\outputs\apk\release\app-release.apk
```

## Source map

```
App.js                     Fonts, SplashScreen, providers, nav theme, monitor start,
                           GamingConfiguration (single native config pusher),
                           cloudSync start (optional), deep-link splitter: normal
                           optinix:// routes → navigator, auth callbacks →
                           handleAuthCallbackUrl (never reaches the navigator).
index.js                   Expo entry.
app.json                   Expo config: package, permissions (incl. blockedPermissions), plugins.
                           The unused extra.optinix block was removed in the 2026-11-07
                           overhaul (nothing read it; jest.setup mock kept in parity).
                           Icon/adaptiveIcon/splash image fields (2026-11-07, mono colors #0a0a0a/#000000)
                           point at repo assets/ as regenerated by scripts/make-logo-assets.ps1.

src/navigation/
  RootTabs.js              5 tabs: Dashboard, Boost, Games, Monitor, Settings.
  TabBar.js                Custom floating tab bar.
  TabIcon.js               Tab glyphs (SVG).

src/screens/
  DashboardScreen.js       Hero 3D orb, health ring, APP FRAME RATE/CPU/RAM tiles, quick actions.
  BoostScreen.js           Safe sweep + engine list + "Background apps & startup" entry
                           card routing to the two managers (no simulated kills).
  ProcessManagerScreen.js  Recently-active apps + device RAM summary, search/sort by
                           recent/name/screen time, honest no-kill copy; routes to
                           App info and the system app-management page.
  StartupManagerScreen.js  Vendor auto-start capability banner (Available/Unsupported/
                           Unknown), documented consequence copy, per-app system routing.
  GamesScreen.js           Game library, overlay toggle, session launch, last result.
  AddGamesScreen.js        Pick launchable game candidates into the persisted library.
  GameProfileScreen.js     Per-game profile (preset, DND, HUD, sampling, reminders).
  GamingToolsScreen.js     In-session DND/timer/capture/controls + HUD visibility card
                           (hide/reopen via setOverlayVisible while session runs).
  SessionsScreen.js        Session history (GamingStore), clear + details; honest
                           loading/empty states.
  MacroStudioScreen.js     Utility macro list + enable toggle (runs user-started only).
  MacroEditorScreen.js     Macro builder (haptic/wait/markers), 20 repeats / 10 min cap.
  NetworkScreen.js         Measured HTTPS diagnostics + history (no fabricated numbers).
  MonitorScreen.js         Live CPU/RAM/temp/battery/network history (sparklines).
  SettingsScreen.js        Theme/accent/density/motion, HUD customization (opacity, notch size,
                           HUD accent + live notch preview, shortcuts), FPS stats HUD card
                           (enable/mode/corner/size/opacity/detailed-metric toggles +
                           honest FPS caption), Optinix Account entry card (sign-in state +
                           sync status from the engine), permissions, gaming data reset,
                           native module status, about.

src/components/three/OrbScene.js   expo-gl + three orb (the view that triggered the R8 crash).
src/components/gaming/GameArtwork.js  Optional per-game artwork rendering.

src/components/ui/         Design-system primitives (23 files, incl. Field, PageHeader,
                           ResultNotice, ToggleRow, CountUp).

src/theme/ThemeProvider.js Theme from tokens + preferences; useTheme/usePreferences
                           (the unused useThemedStyles was removed in the 2026-11-07
                           overhaul). Now also registers the cloudSync preferences
                           bridge (src/theme/syncHub.js): readPreferences / committed-
                           change notify / sanitize-backed applyCloudPreferences.
src/theme/syncHub.js       Bridge singleton between ThemeProvider React state and the
                           cloud sync engine (read/subscribe/apply/notify).
src/store/preferences.js   AsyncStorage + persistentStore-backed preferences (incl. overlayShortcuts,
                           overlayAccent ('app' follows theme or a fixed HUD colour), overlayAutoHide,
                           overlayAutoCollapse ('never'|'5'|'10'|'20'), accent ('mono' fresh-install default),
                           fpsHud{Enabled,Mode,Opacity,Corner,Scale,Metrics} (separate FPS stats HUD;
                           opacity default 0.9), macroEnabled, batteryConscious, networkTarget,
                           reminderMinutes, retentionDays). The dead autoOptimizeOnLaunch pref was
                           removed in the 2026-11-07 overhaul (sanitize drops stale installs' copy).
src/store/persistentStore.js  createPersistentStore(namespace, defaults, sanitize) — load/change/
                           reset AsyncStorage stores with hydrate state for useSyncExternalStore.
src/store/gameLibrary.js   Persisted game library (games, excluded, discoveryEnabled) + merge/
                           select helpers; entries carry a sanitized profile.
src/store/macros.js        Persisted utility macros (100 max) with sync to native GamingStore.
src/store/networkHistory.js  Persisted network diagnostic history.

src/lib/designTokens.js    Colors/accents/typography/spacing/radius/shadows/gradients/thresholds.
src/lib/format.js          Bytes, percent, duration, signed, relativeTime helpers.
src/lib/insights.js        Health score/grade and tips from metrics.
src/lib/runHistory.js      Engine run history persistence + summarising.
src/lib/engineUi.js        Engine metadata → UI copy/tones.
src/lib/gameProfiles.js    6 profile presets (competitive/max/balanced/battery/streaming/custom)
                           with bounded `short` labels; sanitizeProfile drops unsupported knobs.
src/lib/macros.js          Macro schema, MACRO_ACTIONS, validation (finite, user-started only).
src/lib/networkDiagnostics.js  Diagnostic result comparison, target validation, timing helpers.
src/lib/haptics.js         Guarded expo-haptics wrappers (tap/select/success) — failures are
                           swallowed once and remembered; never crashes a user flow.
src/lib/processUi.js       Pure Process Manager helpers (search/sort/last-used labels,
                           device-level RAM summarize — per-app RAM never invented).
src/lib/startupOem.js      Startup capability copy/steps per vendor + perAppControls
                           decision; unsupported is a first-class honest state.
src/lib/authCrypto.js      WebCrypto shim for Hermes (expo-crypto →
                           crypto.getRandomValues + subtle.digest) so Supabase PKCE
                           works; randomId() helper. Missing plugin = PKCE falls
                           back to implicit flow, email auth unaffected.
src/lib/authUrls.js        Pure optinix:// auth callback parser (PKCE code, implicit
                           tokens, provider errors); foreign schemes → kind 'other'.
src/lib/syncSchema.js      Cloud payload schema/merge/decideSyncAction (tested):
                           section allowlist (theme/overlay/gaming + library/macros),
                           local-only keys (onboardingDone) never upload, decision
                           policy restore/upload/restore-cloud-newer/conflict.

src/services/
  monitor.js               Polls native snapshot + cpu + app FPS; AppState-aware; null-safe.
  supabase.js              Supabase client factory. Env contract:
                           EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
                           (VITE_* accepted as aliases, Expo only inlines EXPO_PUBLIC_*).
                           Unconfigured/null env = null client → honest disabled UI.
                           Only the project URL + publishable key ever reach the
                           bundle (verified: no service_role/provider secrets in
                           the export). AsyncStorage session storage, PKCE when
                           the crypto shim is available else implicit.
  auth.js                  Account actions: email signup (verification-aware,
                           "check your inbox" honesty), login, password reset,
                           password set/update, display-name update, Google +
                           Discord OAuth via expo-web-browser system browser +
                           optinix://auth/callback deep link (PKCE), link/unlink
                           identities, sign out, account deletion via the
                           protected delete-account Edge Function, and
                           handleAuthCallbackUrl() (dedupes double-delivered
                           callback URLs). Never trusts client user ids; accounts
                           are never merged on matching emails.
  cloudSync.js             Optional cloud sync engine (singleton, not React):
                           user_settings/devices/sync_history with RLS; debounced
                           (~1.2 s) uploads, offline retry backoff 15s/60s/5m,
                           "Sync Now", last-synced timestamp, conflict state that
                           ASKS the user (cloud copy vs device) instead of
                           guessing, shared applyRemotePieces for restore paths,
                           hydration guard so a cold start can never upload
                           defaults over cloud data. Payload = theme/overlay/
                           gaming prefs + game library + macros; NO credentials,
                           NO remote command execution (restore is data → local
                           sanitize, not code).
  metrics.js               Metric normalisation/derived values.
  networkProbe.js          Latency/throughput probe (real requests).
  gaming.js                gamingConfig(preferences, theme) builder (passes autoCollapseSeconds +
                           fpsHud{Enabled,Mode,Opacity,Corner,Scale,Metrics}) +
                           hudAccentHex() (always the active accent's dark-variant hex; HUD is dark),
                           launchGame() full flow
                           (configure → native startSession → openApp → fallback endSession),
                           notification permission helper.
  overlayController.js     stopOverlay() only — the Dashboard stop action. Starting and
                           configuration live in the native gaming surface (one source of
                           truth; the dead startOverlay/setConfig/getState/isOverlayShown
                           exports were removed in the 2026-11-07 overhaul; gameWatch.js
                           was deleted the same day after verifying nothing called it).

src/hooks/
  usePermissions.js        Special-access state (usage, overlay, battery) refreshed on focus.
  useEngineRun.js          Runs an engine, records history, exposes execution result.
  useCloudSyncState.js     useSyncExternalStore binding for the cloudSync engine state.
  useGamingRuntime.js      Subscribes to native getRuntime() (session/macro/capture state).

src/engines/
  base.js                  Optimizer engine base class (mirrors PC OptimizerBase semantics).
  systemEngines.js         Memory/battery/thermal/cache/network etc.
  appEngines.js            App/game related engines.
  index.js                 Registry used by screens.

src/navigation/RootNavigator.js  Bottom tabs + native stack (GamingTools/MacroStudio/
                           Network/Sessions/GameProfile/AddGames/ProcessManager/
                           StartupManager detail screens) + Auth/Account routes.
src/screens/
   AuthScreen.js            Sign in / register (verification-aware) / forgot password,
                            Continue with Google + Discord with a live /auth/v1/settings probe (honest
                            setup-needed state, never a bare Supabase error page);
                            honest not-configured-in-this-build card when env is
                            missing; login is optional.
  AccountScreen.js         Account surface: profile + display-name edit, connected
                           providers (Google/Discord link/unlink), password
                           set/change, cloud-sync status + Sync Now + conflict
                           choice (cloud vs device) + a plain restore notice after a cloud
                           row only), sign out, two-tap account deletion.
src/native/{device,apps,overlay,gaming}.js   JS bridges; gaming.js wraps the overlay module's
                           gaming surface with availability + honest fallbacks (incl.
                           setOverlayVisible); apps.js exposes getStartupSupport,
                           openAutoStartSettings, openAppManagementSettings. The dead
                           appsNative.boost and overlay requestPermission/setConfig JS
                           wrappers were removed in the 2026-11-07 overhaul (the
                           underlying native abilities remain, honest).

modules/optinix-device/    Kotlin module: device snapshot, CPU load, FPS.
modules/optinix-apps/      Kotlin module: installed/recent apps, icons, foreground app,
                           boost (native, honest), cache, permissions, storage, startup
                           capability probe (AUTO_START_CANDIDATES resolved via
                           getActivityInfo; matching <queries> visibility entries in
                           the module manifest) + app-management intents.
modules/optinix-overlay/   Kotlin overlay module + foreground service; gaming runtime
                           (GamingStore/GamingActions, OptinixOverlayService session loop,
                           OverlayWindow handle/quick/dashboard, FpsHudWindow stats plate,
                           MacroRunner, DndController,
                           SessionClock, OverlaySession, OverlaySparkline, OverlayTools,
                           NetworkDiagnostics, CaptureService/CaptureConsentActivity/
                           CaptureRepository, ForegroundGameReader).

plugins/withOptinixAndroid.js  Config plugin persisting all build tweaks (see Gotchas) +
                           OPTINIX_BUILD_ROOT/OPTINIX_SOURCE_ROOT gradle path remap so the
                           release build can run from C:\O while pulling from the real root.

scripts/build-android.js   Node helper for release build
scripts/device-smoke.js    adb-based smoke script (null-safe text checks).
scripts/make-logo-assets.ps1  Regenerates the app icon/adaptive/splash PNGs + mipmap PNGs +
                           adaptive XMLs into assets/ and both res trees (repo android/ +
                           C:\O). Deletes the old ic_launcher*.webp first.

__tests__/                 21 suites / 106 tests: format, insights, engines, gameLibrary,
                           gameArtwork, macros, macroEditor, macroPersistence, monitorLifecycle,
                           persistentStore, networkProbe, runHistory, onboarding, hudAccent,
                           processUi, startupOem, fpsHudPrefs, syncSchema, authUrls,
                           hudVisibilityPrefs, gamingCompatibility.
```

## Native modules (API surface)

`optinix-device` (`OptinixDeviceModule.kt`):
`getSnapshot()`, `getCpuLoad()`, `getFps()` (Choreographer, app-only), `isSupported`.
Snapshot includes device info, per-core CPU, memory, storage, battery, thermal zones,
display/refresh rate, network.

`optinix-apps` (`OptinixAppsModule.kt`):
`getInstalledApps`, `getGameCandidates`, `getAppIcon` (base64 PNG), `getForegroundApp`,
`getRecentApps`, `getStorageStats`, `boost`, `clearOwnCache`, `openApp`, `openAppInfo`,
`openAppManagementSettings` (ACTION_APPLICATION_SETTINGS, 2026-11-07),
`hasUsageAccess`, `openUsageAccessSettings`, `hasOverlayPermission`, `openOverlaySettings`,
`isBatteryOptimizationExempt`, `requestBatteryOptimizationExemption`, `getPermissionState`,
`getStartupSupport` / `openAutoStartSettings` (2026-11-07 — vendor auto-start capability
probe. `supported` is true ONLY when one of the known managers in
`AUTO_START_CANDIDATES` (ColorOS safecenter/phonemanager, legacy OPPO, MIUI, Samsung
sm/lool, OnePlus, iqoo/vivo, ASUS, Huawei) resolves via `getActivityInfo` on THIS
device; the module manifest carries matching `<queries>` package entries so the probe
can see them on Android 11+. Unsupported is returned honestly — nothing simulated).

`optinix-overlay`:
`hasPermission`, `requestPermission`, `start(config)`, `setConfig(config)`, `stop`, `getState`,
`setOverlayVisible(visible)` (2026-11-07 — app-side hide/show of the control HUD;
hands back a gaming-style result and refuses honestly without overlay permission),
plus the gaming surface (`configureGaming`, `getRuntime`, `startSession`, `endSession`,
`timerAction`, `getSessionHistory`, `clearSessions`, macros, capture, diagnose,
`resetOverlayPosition` — which also resets the FPS HUD corner since 2026-11-07).
Config clamps: `accent` (hex), `opacity` (0.35–1), `expanded`,
`fpsHudOpacity` (0.4–1, default 0.9), `fpsHudScale` (0.7–1.6), `fpsHudMode`
(minimal|compact|detailed), `fpsHudCorner` (topLeft|topRight|bottomLeft|bottomRight),
`fpsHudMetrics` (known ids, ≤5), `autoCollapseSeconds` (0 = never).
Service (`OptinixOverlayService.kt`) draws an edge handle / quick tools / dashboard
with Perf/Tools/Optimize/Stats tabs and samples `OverlayMetrics.kt` every 2–30 s
(minimum 5 s in battery-conscious mode):
- CPU: `/proc/stat` deltas (first sample null, honest).
- RAM: `ActivityManager.MemoryInfo`.
- Temperature: max plausible `/sys/class/thermal/thermal_zone*/temp`, fallback battery temp.
- Battery: sticky `ACTION_BATTERY_CHANGED`.
Supporting classes: `OverlaySession.kt` (avg/peak, duration, drain), `OverlaySparkline.kt`
(44-point CPU/RAM chart), `OverlayTools.kt` (boost, own-cache clean, HTTPS latency),
`FpsHudWindow.kt` (second `TYPE_APPLICATION_OVERLAY` window — the pass-through stats
plate; GAME FPS always `--`, display Hz / CPU / RAM / temp / battery measured).
The collapsed handle has no metric text. Game FPS is unavailable to ordinary apps.

## Data flow (current, 2026-10-26)

- `monitor.js` polls `getSnapshot` + `getCpuLoad` + `getFps` (only while app is active),
  keeps a snapshot store for `useSyncExternalStore`. Background clears stale FPS.
- `GamingConfiguration` (App.js) is the single config pusher: whenever preferences, theme,
  library or macros change/hydrate it validates macros and calls
  `gamingNative.configure({...gamingConfig, games, macros})` → native `GamingStore`.
- Sessions start only through `gaming.launchGame()` (Games screen tap, requires window
  focus) or a manual `startSession` from a visible screen. The service loop samples
  OverlayMetrics, reads the foreground app natively (ForegroundGameReader/UsageStats),
  and records history in `GamingStore`.
- Overlay JS pushes only config; metrics/messages/short labels flow within the service.
- `gameWatch.js` was deleted and the App-level `OverlayAutoStart` was removed earlier —
  no auto overlay on launcher-launched games while Optinix is backgrounded. The explicit
  `gamingNative.setOverlayVisible(true/false)` (GamingTools screen) can show/hide the
  control HUD without touching the session; `HudPolicy` reconciles requested
  visibility with the foreground library game. The persistent Disabled mode is
  stronger than Hide: it ends the gaming service and timer.

## Design system

- Token source: `src/lib/designTokens.js` (mirrors `PC-Optimizer/desktop/src/design-system.css`
  — the 2026-11-04 monochrome system: gray surfaces, ink accent, `--radius-card 12` /
  `--radius-control 7`, near-flat `--shadow-e1..e3`).
- Themes: dark default, light supported; attrs `data-theme`/`data-accent`/`data-density`
  in the web app map to `mode`/`accent`/`density` preferences here.
- Accents: **mono** default (ink `#ffffff` dark / `#000000` light; HUD accent = dark
  variant). Legacy teal/indigo/amber/rose remain selectable for saved preferences.
- Fonts: Inter (body), Plus Jakarta Sans (display), JetBrains Mono (numeric) — Orbitron
  retired 2026-11-07 (imports/load removed from App.js). Import per-weight
  subpaths (`@expo-google-fonts/inter/400Regular` etc.); importing the package root bundles
  all 57 font assets instead of 26.

## Verification checklist (expected green)

```
npx eslint .        -> 0 errors / 0 warnings
npx jest            -> 21 suites, 106 tests passed
npx expo export --platform android -> bundle succeeds (1 hbc bundle, 26 assets)
:optinix-{device,apps,overlay}:compileDebugKotlin -> BUILD SUCCESSFUL
:app:assembleRelease -> BUILD SUCCESSFUL, APK installs and launches
```

### Audit result — 2026-10-27

- Jest: 14 suites / 64 tests passed; ESLint: 0 errors and 0 warnings.
- Native module Kotlin compile (`:optinix-device:compileDebugKotlin`,
  `:optinix-apps:compileDebugKotlin`, `:optinix-overlay:compileDebugKotlin`):
  `BUILD SUCCESSFUL`.
- The normal `npx expo export --platform android` command is currently blocked by
  this machine's missing `hermesc` executable before source bundling.
  `npx expo export --platform android --no-bytecode` completes successfully
  (debug-only workaround; bytecode remains preferred for release builds).
- Frontend visual pass upgraded the mobile shell into a command-center layout:
  Dashboard now exposes device/HUD telemetry chips, Boost has measured run KPI
  tiles, cards have a stronger accent edge, and the tab bar has a focused accent
  rail. Changes live in `src/screens/DashboardScreen.js`, `src/screens/BoostScreen.js`,
  `src/components/ui/Card.js`, and `src/navigation/TabBar.js`.

**On-device HUD verification method (gotcha, 2026-10-26):** `uiautomator dump` only
captures the app's own windows — cross-process overlay windows never appear in the
hierarchy dump, and content taps at guessed coordinates are the only way to drive the
HUD over a game. Use `dumpsys window windows` (search `Optinix gaming HUD`; read
`Frames:` for the window rect and `mAttrs=` for position) plus `adb logcat -d -s
OptinixHUD` (the service now logs every loop tick: `wantHud/current/game/showing/
allowed/err`, and `show() refused` when Android rejects the add). Release builds are
not debuggable, so `run-as` cannot read private prefs — the loop log is the ground
truth for why the HUD is or is not showing.

## Build environment on this PC (2026-10-23)

- SDK: `C:\Users\prana\AppData\Local\Android\Sdk`
  (`ANDROID_HOME` env var is not set; set it per shell.)
- SDK contents: platforms android-34, android-37.0; build-tools 34.0.0, 36.0.0, 37.0.0;
  platform-tools; NDK `27.1.12297006` (real, installed manually);
  CMake `3.31.6` (installed manually, includes ninja 1.12.1).
- Android Studio at `C:\Program Files\Android\Android Studio` (no sdkmanager/cmdline-tools).
- JDK 21: `JAVA_HOME=C:\Users\prana\jdk\jdk-21.0.12+8`.
- Gradle wrapper 9.4.1. Kotlin 2.2.10 (build uses plugin version, catalog says 2.2.0).
- Expo build config: compileSdk 37, targetSdk 36, minSdk **29**, buildTools 37.0.0.
- Device used for testing: 2026-11-07 attachment = Realme RMX3998 (serial
  `NB89CQEAFUR8TKMR`, Android 16 / SDK 36, arm64-v8a); historical device: Realme
  RMX5313 (`00744740104c8f9c`). Check with:
  `& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices`

## Generated Android / Gotchas (important)

`android/` is generated by prebuild and gitignored. The following local tweaks are required
on this machine and are lost on `expo prebuild --clean`. Re-apply them:

1. **R8 crash (fixed 2026-10-23).** Release build with minify enabled crashed on launch:
   `java.lang.IllegalStateException: Didn't find a correct constructor for class d21` at
   `expo.modules.kotlin.views.SimpleViewManagerWrapper.createViewInstance` (expo-gl view on
   Dashboard). Fix used: `android.enableMinifyInReleaseBuilds=false` in
   `android/gradle.properties`, then rebuild release. If you want minify back, add/verify
   proguard keep rules for `expo.modules.gl.**` / expo module view classes and test on device
   before shipping.
2. **Windows long paths.** RN's autolinked CMake uses `-DCMAKE_OBJECT_PATH_MAX=1024`, which
   lets ninja hit MAX_PATH (`ninja: error: mkdir(...C_/O/node_modules/...)`). Required:
   - `android.cmakeVersion=3.31.6` (SDK cmake folder installed at
     `Sdk\cmake\3.31.6`; download `https://dl.google.com/android/repository/cmake-3.31.6-windows.zip`)
   - `expo.android.cmakeObjectPathMax=200` (expo root plugin reads this Gradle property)
   - Optionally build from a short path copy (`C:\O`) if the original path is still too deep.
     `C:\O` is disposable and not the source of truth.
3. **Slow/flaky Maven network.** `android/build.gradle` has Aliyun mirrors before
   `google()`/`mavenCentral()` and `android/gradle.properties` has
   `systemProp.org.gradle.internal.http.{connectionTimeout,socketTimeout}` (30 s/60 s).
   Without these, Gradle can hang for many minutes on a stalled download.
4. **Gradle daemon crash under memory pressure.** On 15 GB RAM with other apps open, run with
   fewer workers (`org.gradle.workers.max=2`) and SerialGC if the daemon dies
   (`Gradle build daemon disappeared unexpectedly`). Free RAM first.
5. `edgeToEdgeEnabled` was removed from `app.json` (Expo SDK 58 warns it no longer exists).
6. Autolinking: local modules under `modules/` are auto-discovered by Expo autolinking
   (no package.json entry needed). JS imports use relative paths like `../../modules/optinix-overlay`.
7. **Icon resource duplicates (2026-11-07).** The generated launcher icons are PNG now;
   any leftover `ic_launcher*.webp` beside them makes `:app:packageReleaseResources`
   fail with "Duplicate resources" (the old webps were the prebuild default). Delete rule
   lives in `scripts/make-logo-assets.ps1`: a per-directory
   `Get-ChildItem "$root\mipmap-*" -Directory → -Filter ic_launcher*.webp` remove loop.
   PS 5.1 quirk: `Get-ChildItem '<res>\mipmap-*' -Filter 'ic_launcher*.webp'` in one call
   matched nothing (wildcard Path + Filter double-apply), so a single-pass delete silently
   skipped all files and the build failed — the loop form is required.
8. **Icons/splash live outside app.json (manual res patch, 2026-11-07).** The working
   splash/icon resources were hand-patched into BOTH
   `android/app/src/main/res` and `C:\O\.../res` (they get lost on prebuild — re-run
   `scripts/make-logo-assets.ps1` after `expo prebuild`):
   - `mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher.png` + `ic_launcher_round.png`
     (48/72/96/144/192 px, glyph 80% of canvas, `#000000` bg) — replaced the old webp.
   - `mipmap-*/ic_launcher_foreground.png` (108/162/216/324/432 px, transparent, glyph
     62% of the 108dp canvas → inside the adaptive safe zone).
   - `mipmap-anydpi-v26/ic_launcher.xml` + `ic_launcher_round.xml` (adaptive: background
     `@color/ic_launcher_background` `#000000`, foreground `@mipmap/ic_launcher_foreground`).
   - `values/colors.xml`: `splashscreen_background`/`activityBackground` `#0a0a0a`,
     `colorPrimary` `#ffffff`(ink), `ic_launcher_background` `#000000`; `values-night/` left
     as  the empty `<resources/>`.
   - `drawable/splashscreen_logo.xml`: was an all-transparent layer-list (why the splash
       looked dead); now a `@mipmap/ic_launcher_foreground` bitmap item at 156×156 dp.
   - Android 12+ shows the launcher icon on splash regardless (`icon_preferred` in
       styles.xml), so the adaptive icon is the real splash art — screencap verified.
   The logo comes from the workspace root `logo.png` (user's file, NEVER modified); the
       glyph bbox is auto-measured, scaled per target (76% icon / 62% adaptive / 50% splash),
   and drawn with HQ bicubic via System.Drawing.
9. **adb taps vs the user's hand (repeated 2026-11-07 ~11:33).** While driving the app
     by adb, a tap was computed from a stale dump and the phone had meanwhile switched to
       the user's WhatsApp screen — the tap landed on the user's open app. If any
       screenshot/dump comes back WITHOUT the expected Optinix UI, stop blind taps
       immediately and let the user drive. More such adb-tapping detours have happened
       before; treat the device as user-occupied at all times.

## Current status

- **Latest (2026-11-10 afternoon): illustrated permission guides + one-time stats-HUD reset installed and verified; Realme-parity overlay interaction pass built.**
  (1) Onboarding permission cards are now expandable ("How?") with a pure-View mock
  of the exact Android surface (notification prompt / usage-access list / overlay
  toggle / battery options), numbered steps and the same action button
  (`PermissionGuide` + `PermissionDiagram` in `OnboardingScreen.js`).
  (2) `fpsHudResetV2` one-time migration turns a stale saved stats-HUD "on" off
  exactly once (test in `fpsHudPrefs`). (3) `overlayAutoCollapse` default is now
  **'never'** with `autoCollapseResetV2` folding the phone's saved '5 s' timer once
  (test in `hudVisibilityPrefs`) — dismissal is tap-outside/minimize, Realme-style,
  never a timer. (4) Overlay interaction pass (`OverlayWindow.kt` /
  `OverlayStyle.kt` / `OverlayControls.kt`): panel now slides out of the docked edge
  (240 ms, no scale pop) and hides with a 150 ms throw; the plate opens vertically
  centered; handle plate + rail/plate/tile/control hexes moved to PC mono
  (#191919/#0a0a0a, #161616, #262626, #111111; grays #c1c1c1/#a0a0a0/#6b6b6b;
  navy leftovers #242a38/#12151e/#28303f/#252c3c gone) per the "strict PC parity"
  direction. Host: Jest **25 suites / 132 tests**, ESLint 0/0, overlay compile +
  unit tests green. Build A — **84,367,568 B**, SHA-256 `559052B3…317CDBE47`
  (guides + stats-off): installed, device hash `559052b3…cdb e47` matches,
  lastUpdateTime **2026-11-10 13:52:57** (Realme's install prompt outlasted two adb
  timeouts — finished in the background), launch smoke clean with the phone asleep.
  Build B — **84,367,632 B**, SHA-256 `7021EED135536319077C25D5AC710DBEC705358031A6D888C97E0F6F62DA3EA1`
  (interaction pass): **NOT installed yet** — needs user approval + prompt consent.
- **Earlier (2026-11-10 noon): HUD simplified to 3 tabs (Tools/Boost/Stats) + animated onboarding — installed and hash-verified.**
  From the user's "eazy to use" brief (the 6-line rail confused even him). Overlay
  sections cut 6→3: **Tools** (fresh open always lands here; now hosts the network
  check card too), **Boost** (Performance+Optimization merged), **Stats**
  (Monitor+FPS-HUD merged); 70 dp tool tiles, 22 dp icons, trimmed-but-intact
  honesty notes, `OverlayDashboardTest` locks the 3 ids. Onboarding: staggered
  one-shot entrances (`Stagger`), animated rail progress segments, `CountUp` on the
  Done screen — all reducedMotion-gated. Host: overlay compile + **28 native
  tests**, Jest **25/130**, ESLint 0/0. Release from C:\O **84,362,132 B**, SHA-256
  `CE1D93CF49ACF87B80DF20ED0D6AF9001B894D91E95570D8789A4708CC2AF7EF`, AdMob ID
  verified in-APK. Installed user-approved → `Success`, device hash
  `ce1d93cf…2af7ef` matches, lastUpdateTime **2026-11-10 12:59:54**, launch smoke
  clean (process alive, no FATAL; screencap black — phone locked). HUD-over-game +
  onboarding walkthrough pending user time.
- **Earlier (2026-11-09 night, later): installed-build launch crash FIXED + reinstalled.**
  App opened and instantly died: `MobileAdsInitProvider` FATAL "Invalid application
  ID" — the AdMob app-level manifest entry (added to the repo's generated manifest in
  the morning prebuild) was missing from the stale C:\O mirror manifest, so the library's
  empty placeholder ID merged into the APK. Fixed three ways: mirror manifest patched
  (ID + OPTIMIZE flags, `tools:replace`), `plugins/withOptinixAndroid.js` now enforces
  the meta-data on every prebuild durably, and the release was rebuilt/installed —
  **84,376,748 B, SHA-256 `411FEAFCA4FE692F2946B6F8EC94E774551DB42C976E45CADA99093FE7C443CF`**,
  on-device hash verified (`411feafc…`), lastUpdateTime 18:50:06. Launch smoke: process
  stays alive, no FATAL in logcat (visual check pending — phone locked). Live-logcat
  capture (`logcat -c` → `am start`) is the documented way to catch launch-kill bugs.
- **Earlier (2026-11-09 night): Account/UX + games pass installed and hash-verified, then superseded the same night by the AdMob-ID crash fix (latest above).**
  From the user's Hinglish brief: fix Google sign-in opening a Supabase error page, show
  only installed games, wire the provided Google/Discord credentials, make sign-in load
  settings (with explicit restore notice), add an onboarding animation-choice step, and
  make the app easier + livelier. Code (all JS, no native changes):
  (1) **OAuth pre-flight** — `getProviderStatus()`/`parseProviderSettings` (supabase.js) ask
  `/auth/v1/settings` first; a disabled provider now returns an honest "setup needed"
  message INSTEAD of opening a bare Supabase error page; AuthScreen shows per-provider
  status captions. Also fixed a wrong supabase-js option name: `skipBrowserAuthorization`
  (did nothing) → `skipBrowserRedirect: true` in `signInWithProvider`/`linkProvider`.
  Verified via the public settings endpoint: the project still has **google/discord OFF,
  email ON** — enabling them is a dashboard step documented with exact values in
  `docs/account-setup.md` (client IDs public, secrets only in the dashboard boxes; the
  service_role key can't configure the Management API — attempted, 401, as expected).
  (2) **Games library installed-first** — default filter Installed; unavailable titles
  move behind the All tab with a count note; Play stays disabled for them.
  (3) **Sign-in → restore UX** — cloudSync tracks `lastAction` ('upload'|'restore'); the
  Account screen says plainly when a cloud restore applied (conflict still asks first);
  `motion` + `haptics` prefs were already in the sync schema's theme section.
  (4) **Onboarding motion step** — new step 2 of 5 ("How alive should it feel?") with
  Full effects / Reduced motion radio cards with real animated previews; writes the
  `motion` pref (syncable; changed any time in Settings).
  (5) **Feedback polish** — `src/lib/haptics.js` safe wrappers (never crash a flow);
  haptic ticks on onboarding steps/finish, launch (Games + Dashboard), sign-in success,
  Sync now; new `PulseDot` (loop opacity animation — entrance-animation-free so the
  2026-11-07 card-freeze gotcha does not apply) on the Dashboard LIVE/SAMPLING status
  and the Account sync card; Account restore notice.
  Verification: Jest **25 suites / 130 tests** (new `oauthProviders` suite), ESLint 0/0;
  release from the C:\O mirror (src re-synced, no npm change) **84,376,700 B**, SHA-256
  `62D980E5A39ECF1DE44DC15DBBA6881C45EA4548EBC15B348DD287BD2456AB86`, bundle probed for
  new strings (ASCII markers present; the "missing" ones carry em-dashes and are
  UTF-16-string-table entries — a verify-gotcha, not a bug). **Installed and
  hash-verified**: user-approved `adb install -r` → `Success`, on-device
  `pm path`+`sha256sum` = `62d980e5…86` (local APK byte-for-byte),
  lastUpdateTime 2026-11-09 18:38:48; launch smoke was cut by the phone
  auto-locking to the PIN lockscreen (no FATAL in logcat) — live walkthrough
  is the user's. The Supabase provider enables remain a dashboard step.
- **Earlier (2026-11-09 evening): HUD+ polish pass INSTALLED and hash-verified (user-approved install).**
  Built from the user's side-by-side with the Realme Game Assistant: new `OverlayGauge` (monitor hero, measured rings with centred values) + `OverlayMeterBar` (honest level bars on cpu/ram/temp/battery tiles), 4th BATTERY quick-strip cell, boost ring 52 dp, `fit()` reserved 176 dp (taller landscape scroll), idle dim 0.5× → 0.78× ("opacity kam h" complaint), handle grip **88–126 dp** (was 68–96; user showed the assistant's tall left capsule), 7 honest notes trimmed. FPS stats HUD default already `false` in code — phone's saved pref to be switched OFF via Settings in the pending walkthrough. New build gotcha: repo-root `assembleRelease` now hits the ninja >260-char path in gesture-handler `.cxx`; built from the re-synced `C:\O` mirror (npm install first — google-mobile-ads was missing there). Release **84,366,200 B** (~9.5 MB AdMob SDK growth), SHA-256 `435E0BF01E8C28635B66C2065B8C4781750C7B9BBDB176A82EE5A979BE280115`, installed `Success` (attempt 2; attempt 1 was cancelled by the user), on-device hash `435e0bf0…280115` verified, lastUpdateTime **2026-11-09 17:54:54**. Host: overlay tests 28, Jest **24 suites / 126 tests**, ESLint 0/0. Details: `docs/hud-redesign-2026-11-07/README.md` 2026-11-09 section + Changelog. Device walkthrough (taller capsule, gauges, stats-pref off) pending — phone auto-locked (PIN).
- **Also inside the installed build (earlier, previously NOT installed): Cyber Gaming Capsule + Obsidian Glass overlay redesign (2026-11-09 early morning), Process/Startup category filtering (11-08 late night), Device check + share reports (11-08 night), build-pipeline fixes (11-08 evening), AdMob integration (11-09 morning).** All shipped in the 2026-11-09 evening APK above; on-device walkthrough of those surfaces is still pending.
- **Earlier (2026-11-08 late night): Process & Startup integration + Category filtering + Genuine Force-Stop routing; NOT installed.**
  `ProcessManagerScreen` gained category filtering (`All apps`, `User apps`, `Games`, `System`), clear type badges, and guided 1-tap "Force stop" routing with contextual instructions. Direct navigation added to `GamesScreen` (Game Space pills) and `GamingToolsScreen` (Game utilities), seamlessly paired with the in-game HUD's `optinix://processes` and `optinix://startup` deep-links. Zero fake kills; 100% genuine Android system routing. Jest **23 suites / 120 tests**, ESLint 0/0, Kotlin compile green.
- **Earlier (2026-11-08 night): Device check + shareable session reports; NOT installed.**
  New `DeviceCheckScreen` audits the real permissions and probes on this phone with one-tap
  fixes and an honest-limits card; Sessions cards can share a measured report with only the
  readings the service recorded. Jest **23 suites / 118 tests**, ESLint 0/0, release
  **74,905,980 B**, SHA-256 `8439EB5D1D0733755BBF72719B1E88F90E0763B4A40BAB53AEB35F95EB58B428`,
  copy `artifacts/Optinix-Premium-HUD.apk`. The phone still runs the 74,824,916 B build.
- **Earlier (2026-11-08 evening): build pipeline + robustness pass; NOT installed.**
  `scripts/build-android.js` now works on this PC (root cause: the machine sets
  `NoDefaultCurrentDirectoryInExePath=1`, so the absolute gradlew path is used), the repo's
  missing `hermesc.exe` was restored, the overlay keeps its scroll position across rotation,
  and discovery can no longer flip the whole library to "Unavailable" when the native app
  query returns nothing. Verification: overlay unit tests **28**, Jest **21 suites / 107
  tests**, ESLint 0/0. Release **74,892,792 B**, SHA-256
  `C9ECA825C1998FE5E8D1B8AAA39BAF936874668082776A153B573B1B6BA973E6`, copy
  `artifacts/Optinix-Premium-HUD.apk`. Device still runs the 74,824,916 B build; installing
  needs approval. Details: Changelog 2026-11-08 (evening).
- **Earlier (2026-11-07 23:04): premium gaming-assistant HUD redesign delivered as code
  and as a release build; NOT installed.** New rail + scrollable-plate overlay
  (`OverlayStyle`/`OverlayIcons`/`OverlayControls`/`OverlaySystem`/`OverlayDashboard` +
  rewritten `OverlayWindow.kt`), six sections, tap-or-swipe panel entry, session-scoped
  FPS HUD overrides, real brightness/rotation controls via `WRITE_SETTINGS`, deep links
  to Process/Startup/Macros. Host: overlay unit tests **27**, Jest **21 suites / 106
tests**, ESLint 0/0, module lint clean. Release **74,891,192 B**, SHA-256
  `E499D4D26ADBEA42FE339048132625D0EA043D7149196D8E664D4DCDCE308364`,
  copy `artifacts/Optinix-Premium-HUD.apk`. Device not touched (user approval required
  for any install); the phone runs the 74,824,916 B build. Details: Changelog
  2026-11-07 23:04 and `docs/hud-redesign-2026-11-07/README.md`.
- **Previous (2026-11-07 22:03): Android 10–16 compatibility + major HUD redesign +
  optional account/sync code are delivered.** Host: Jest 21/106, ESLint 0/0,
  native tests 21, strict module lint 0 errors / 0 API violations (style warnings
  remain), release **74,824,932 B**, min 29 / target 36 / compile 37, ARM64 + ARMv7.
  SHA-256 `9F56407B054704CF97C700CFAF89959DE675856E4A272CAC7399CD08577C654E`.
  **Final revision not installed**: user chose “Abhi report de do” and device work
  stopped. The phone runs the preceding **74,824,916 B lifecycle-fix build**,
  hash `8D713ADB41FD3340DCC5E0DD3CD8088267079D9129B74432857E1538345AD8EB`,
  installed under approval and hash-verified at 20:52:54. Landscape Township handle
  and dashboard, tab navigation, RAM/temperature/battery/Hz, RAM review and 3.3 MB
  own-cache cleanup were exercised. Remaining visibility/docking/portrait/permission
  tests are pending, not claimed. **Auto-collapse remains temporarily Never**
  (was saved 5s before testing). See `docs/hud-redesign-2026-11-07/README.md`.
  A copy of the final test APK is `artifacts/Optinix-Android10-HUD.apk` (gitignored).
- **Earlier 2026-11-07 product overhaul (historical):** full 10-phase PC-grade
  overhaul shipped as code and as a release build — two-manager Review surfaces
  (Process/Startup), the FPS stats HUD second window, HUD hide/reopen, dead-code purge,
  UI parity fixes. Verification: jest **17 suites / 83 tests**, eslint 0/0, all three
  Kotlin modules `compileDebugKotlin` BUILD SUCCESSFUL, release APK
  **40,581,655 bytes** (2026-11-07 14:29, built from the re-synced C:\O mirror; logs
  `C:\O\assemble-overhaul.log` + `assemble-overhaul2.log`). **NOT installed — the
  ten-phase prompt approved only the release build; `adb install` and the on-device
  walkthrough need explicit user approval. The APK actually installed on RMX3998 is
  still the 40,536,735 B icon/motion build.** No screen recording was provided for the
  audit; identifying was source-only.
- JS shell complete: 5 tabs, theme/preferences, dashboard/boost/games/monitor/settings
  (+ ProcessManager/StartupManager native-stack screens registered).
- Native modules compile; release APK builds; installed and runs on RMX5313.
- Overlay redesigned into handle / quick panel / dashboard states (see "Overlay feature
  set"). New prefs: `overlayAutoHide` (Settings → In-game HUD → Idle behaviour) → `autoHide`
  config key. Jest still 58/58, eslint clean after the redesign.
- `C:\O` had drifted badly from the repo (an older half-copy: whole screens, `plugins/`,
  `src/services/gaming.js` etc. missing) and was rebuilt as a full mirror on 2026-10-26
  (robocopy /MIR of `src`, `modules` (minus build dirs), `plugins`, root config files +
  fresh `npm install`). **Gotcha: when building from C:\O, re-sync root config files and
  run npm install after package.json changes — a stale mirror fails the JS bundle task**
  (symptom: `PluginError: Failed to resolve plugin for module ./plugins/withOptinixAndroid`).
- Earlier release APK: 40,536,735 bytes (2026-11-07 ~11:29, icon/splash + motion pass),
  built from the C:\O mirror and installed on RMX3998 (`install -r`, Success; process
  live, no FATAL). Previous: 40,436,161 bytes (2026-11-07 ~10:52, mono parity). Contains
  the complete gaming layer (game library, per-game profiles, macros,
  GamingTools/Sessions/Network screens), the `short`-label wiring, the one-time onboarding,
  the Game Space-style notch HUD described in "Overlay feature set", the user's logo in
  the launcher icon + splash, and the PC-style motion pass (Card entrance, tab pill,
  button press scale, health count-up).
- **Icon/splash verified on device (adb screencaps, 2026-11-07 ~11:31):** launcher home
  screen shows the black square Optinix icon (user's white+cyan mark, adaptive rounded
  square), and `am start` + 0.35 s-delayed screencap shows the logo on the black
  splash — the old splash was a transparent layer-list and rendered nothing.
- **Motion verified live:** Dashboard after fresh launch shows the health count-up
  value (89, mono-bold, ring wrapped from the MetricRing sweep), the floating tab bar
  renders the sliding accent-dim pill (verified at Home, then tapping Monitor moved the
  pill to the right item – geometry from bar-width/5 per tab, inset 7 px), and cards
  enter with Reanimated FadeInDown (360 ms). All of it is gated on `preferences.reducedMotion`;
  honest `--` copies untouched (CPU `--`, "Core data unavailable", "Android restricts
  this reading" all still render).
- **HUD lifecycle verified on device (adb-only, 2026-10-26 ~21:57):** after a fresh install +
  "Launch game" tap, `OptinixHUD` loop log shows `wantHud=true current=com.gameinsight.airport
  overlays=true showing=true allowed=true` stable across ticks; window surface stays up
  (`mHasSurface=true isOnScreen=true`, no fatal logcat). The earlier "window vanishes / no HUD
  window" behaviour did not reproduce on the notch build — it appeared only with the older
  pre-notch alpha build while reconnecting; keep the loop log for now to catch any return.
- App state on device: overlay permission granted (appops allow), GET_USAGE_STATS allow,
  notification channels created, versionName 1.0.0. Session LIVE over Airport City at
  21:57–21:58 with notch ⇄ drawer pulls verified by adb taps (see feature set frames).
- A clean full 4-step onboarding run needs a deliberate wipe (`pm clear`) — user data, so
  only with the user's OK. Human-feel drag/idle motion checks still need the user's hands.

## Pending / next steps

0. Latest handoff: final APK update and critical on-device minimize/swipe/outside/
   drag/docking/persistence/notification-only/disabled tests await a new device
   walkthrough. User explicitly chose the report rather than continuing now.
   Restore Auto-collapse from Never to the prior 5s through Settings if desired.
   Android API 29–35 runtime testing needs a real device or AVD; only API 36 was
   physically exercised. Account provider/email/RLS/delete-function setup and
   real end-to-end verification remain user-project actions (`docs/account-setup.md`).
1. Verify full HUD flow on the device with user present: grant usage access, launch a game
   from Optinix Games, drag/expand the HUD, switch tabs, run Boost/Clear/Ping, check
   measured values and the new short profile labels in handle/quick panel. Once the
   2026-11-07 overhaul APK is installed, add: FPS stats HUD (modes/corners/opacity/
   detailed metrics live over a game), HUD hide/reopen, Process Manager list + routing,
   Startup Manager Realme probe.
2. **Decision needed — auto overlay on launcher-launched games.** The old JS auto-start is
   dead; background games produce nothing today. Options: (a) accept + document honestly
   ("start from Optinix"), (b) implement a small native watcher (GamingStore + a periodic
   UsageStats check when a session-capable event is expected; beware Realme process kills),
   or (c) a lightweight foreground micro-service. Nothing was faked meanwhile.
3. ~~Remove dead `gameWatch.js`~~ — DONE (2026-11-07 overhaul): usage verified empty,
   file deleted; jest/eslint stayed green. `monitorLifecycle.test.js` never referenced
   it.
4. Decide long-term R8 strategy (keep minify off vs add keep rules and test) — currently
   stable with minify off, and the config plugin keeps it off across prebuilds.
5. ~~Config plugin for prebuild tweaks~~ — DONE: `plugins/withOptinixAndroid.js` persists
   minify/cmake/objectPathMax/jvmargs/timeouts/mirrors + C:\O→'repo path remap.
6. Improve game detection (AddGames discovery heuristic) if false positives/negatives appear.
7. Consider debug/dev-client workflow with Metro for faster iteration (JS-only changes can
   already be tested via `expo start`, native needs assembleRelease from C:\O).
8. Demote the per-tick `Log.i("OptinixHUD", ...)` loop log to `Log.d` (or remove) before any
   public/store build — it is a diagnostic intended to stay through this debug phase.
9. ~~~Walk the 2026-10-30/2026-11-07 overlay reskin on device~~~ — the reskin **is now
   inside the installed APK** (rebuilt 2026-11-07 ~11:29), but the hands-on HUD
   walkthrough is still pending user time: drag the notch out, QUICK/DASHBOARD tabs,
   tap-outside collapse, auto-collapse (Never/5s/10s/20s), idle dim, all over a real
   game.
10. Historical 14:29 install-blocker is superseded by later approved installs.
    Re-check Process/Startup, Realme OEM capabilities and FPS modes/corners on the
    latest revision; the current pending install is the 22:03 final revision above.

## Changelog

### 2026-11-10 (afternoon) — illustrated permission guidance + one-time default resets + Realme-parity interaction pass

User status after the 3-tab install: stats HUD was still ON on the phone (saved
pref from earlier walkthroughs), onboarding still lacked "usme image bhi dena h ki
dekh yaha se aise hota h", and he answered the direction questions firmly:
overlay = **recreate the Realme Game Assistant interaction from the supplied
reference, stop asking**; app UI = **strict PC Optimizer design-system parity**.

**JS (`OnboardingScreen.js`, `preferences.js`, tests):**
- `PERMISSIONS` items carry `diagram` + `steps`; new `PermissionGuide` shows a
  pure-View miniature of the actual Android surface — `notifications` (native
  prompt card with Don't allow/Allow pills), `usage`/`overlay` (settings list:
  app row + the exact toggle ON), `battery` (Unrestricted/Optimised/Restricted
  with the selected pill) — plus numbered steps and the same permission action.
  Cards toggle via a "How?" press (one expanded at a time); granted cards hide
  the inner button. Steps text references the button labels honestly.
- `fpsHudResetV2`: one-time stats-HUD off migration (saved "on" folds off once,
  marker preserves later deliberate choices) — the previous builds could not
  retro-fix the phone without a wipe.
- `overlayAutoCollapse` default `'10'` → **`'never'`** + `autoCollapseResetV2`
  (the phone's stored `'5'` resets once) — from re-reading the Realme reference
  frames: the assistant never timer-folds an open panel; dismissal is
  tap-outside/minimize (both already implemented). Settings keeps Never/5/10/20.

**Kotlin (Realme interaction parity + mono repaint):**
- `animateIn()`: the plate now **slides out of the docked edge** — start
  `translationX = direction*dp(64)`, 240 ms Decelerate, no scale pop (was a
  20 dp/210 ms fade-pop). `collapseToHandle()` throws 28 dp over 150 ms.
- `dock()`: the open panel is **vertically centered** on the screen (Realme
  behaviour) instead of pinned at `top+8`.
- Mono parity: `OverlayStyle` PLATE/RAIL/TILE/CONTROL/TRACK hexes → PC mono
  (`#191919/#0a0a0a`, `#191919/#0d0d0d`, `#161616`, `#262626`, `#111111`),
  SECONDARY/MUTED/QUIET → `#c1c1c1/#a0a0a0/#6b6b6b`; handle plate
  `#242a38/#0d1017` → `#191919/#0a0a0a`; quick-strip cell `#12151e` → `#161616`;
  `OverlayControls` switch track `#28303f` → `#2e2e2e`, gauge track `#252c3c` →
  `#2c2c2c`. All remaining navy-tinted grays are gone from the HUD.

**Verification:** Jest **25 suites / 132 tests** (the two new one-time-migration
tests included), ESLint 0/0; overlay `compileDebugKotlin` + `testDebugUnitTest`
BUILD SUCCESSFUL. Build A (guides + stats reset) **84,367,568 B**, SHA-256
`559052B33C6E3507F67F52B953E93CCB76653F63A7EF7B132E48A3E317CDBE47` — installed
user-approved; Realme's "Continue installation" prompt outlasted two adb
timeouts but finished in the background (gotcha: always re-check
`lastUpdateTime` after a "timed out" install), device hash `559052b3…cdbe47`
verified byte-for-byte, lastUpdateTime **2026-11-10 13:52:57**, launch smoke:
process alive 10 s +, no FATAL (phone asleep — visual walkthrough is the user's).
Build B (interaction pass above) **84,367,632 B**, SHA-256
`7021EED135536319077C25D5AC710DBEC705358031A6D888C97E0F6F62DA3EA1` —
**not installed**; device walkthrough (slide/collapse feel, centered plate,
mono surface, stats HUD off after migration) pending. Pushed:
`18846c9` (guides/reset) on `main`.

### 2026-11-10 (noon) — HUD simplified to 3 tabs (Tools/Boost/Stats) + animated onboarding; installed and hash-verified

User brief: "overlay sudhar strictly… eazy to use banana h me hi confuse ho raha hu,
user ki toh gand mar jayegi… ek da mast karke baki ache se improve karta ja aur
animated onboarding bhi kar de." The confusion driver was the 6-line rail
(Performance/Monitor/Tools/Network/Optimization/FPS HUD).

**Kotlin (`OverlayDashboard.kt` + `OverlayWindow.kt`):**
- Sections reduced to **three**: `TOOLS` (default on every fresh open — brightness,
  12-tile tool grid, and the network check card migrated in), `BOOST` (old
  Performance + Optimization merged: profile pills, memory ring/boost, device
  review + measured grid, and the six honest system-route pill buttons),
  `STATS` (old Monitor + FPS HUD merged: gauges, meter tiles, session chart,
  detail rows, aggregates, and the stats-HUD switch/mode/corner/size/opacity
  controls). Distinct icons (TOOLS/OPTIMIZE/STATS); `OverlayDashboardTest` locked
  3 ids/labels/icons (28 native tests green).
- The tool tile that used to jump to Monitor now targets STATS; the dead
  `valueViews["net"]` row was removed; the network hero (HTTPS result + jitter),
  target/connection/metered rows and the primary **Run test** button now live in
  Tools. The validated/DNS detail rows were dropped there with the section —
  the honest "cannot lower ping" note remains.
- Touch targets: tool tiles 64→**70 dp**, icons 19→**22 dp**, label 8.5→9, note
  7.5→8. Honesty wordings trimmed only (all `--`/game-FPS/unsupported rules
  unchanged). Rail indicator math unchanged (the dp(30) brand offset works for
  any section count); `railItemHeight` clamp (44–54 dp) fine with three cells.
- Default `section = OverlayDashboard.TOOLS` in the field initializer; render's
  STATS-gated chart update retargeted. A fresh panel always lands on Tools —
  predictability per the Realme-assistant pattern.

**Onboarding (`src/screens/OnboardingScreen.js`):**
- New `Stagger` helper: one-shot `FadeInDown` (300 ms, 85 ms/item) on static step
  content in Welcome/Motion/Intro/Permissions/Done; reduced motion renders plain
  Views. Steps are remounted per step (keyed Reanimated wrapper), so entrances
  never replay mid-step (entrance-freeze gotcha respected).
- `Rail` rebuilt from static dots to **animated progress segments** (`RailDot`
  `useAnimatedStyle` + `withTiming` width 12↔26; reduced motion → duration 0;
  tint semantics preserved: accent = done/active).
- Done step's permission counter now uses the honest `CountUp` (one count-up of
  the real granted count; reduced motion renders instantly).
- Overlay copy updated: "six-section" → "three-tab game assistant panel".

**Verification:** overlay `:optinix-overlay:compileDebugKotlin` BUILD
SUCCESSFUL + `testDebugUnitTest` **28 tests** (4+5+4+9+6, includes the updated
sections test); Jest **25 suites / 130 tests**; ESLint 0/0. Release from the
C:\O mirror (src/modules/plugins/__tests__ robocopy rc=0/1 healthy; mirror
generated manifest already carried the patched AdMob ID): BUILD SUCCESSFUL
3 m 25 s → **84,362,132 B**, SHA-256
`CE1D93CF49ACF87B80DF20ED0D6AF9001B894D91E95570D8789A4708CC2AF7EF`; aapt2
confirms the real AdMob APPLICATION_ID inside the APK. **Installed and
verified:** `adb install -r` → `Success` (user-approved), on-device
`pm path`+`sha256sum` = `ce1d93cf…2af7ef` byte-for-byte, lastUpdateTime
**2026-11-10 12:59:54**; launch smoke: process alive 10 s+, no FATAL in
logcat (screencap black — phone locked; the visual HUD/onboarding walkthrough
is the user's). No new build gotchas; the rail geometry concern (indicator
brand-offset + item-height clamp) was checked and works for any section count.

### 2026-11-09 (night, later) — device crash fixed: empty AdMob APPLICATION_ID was killing the app at launch

User report: "cant even able to open app kholte hi band ho ja raha h". Live logcat
capture reproduced it: `FATAL EXCEPTION: MobileAdsInitProvider → IllegalStateException:
Invalid application ID`. The 2026-11-09 AdMob integration's app-level manifest
entry never reached the build: the **repo's generated android manifest carries the
correct `ca-app-pub-3940256099942544~3347511713` (from app.json plugin args, added
in the morning prebuild), but the C:\O mirror's generated manifest predated the
AdMob integration and had no entry at all — so the library's own placeholder
manifest merged an EMPTY APPLICATION_ID** into the APK (verified on the installed
build with aapt2: value `""`). Google's init provider then terminated the process
inside the first second. The earlier (17:54) HUD build had the same latent crash;
it simply was never opened after install.

Fixes:
1. Mirror `C:\O\android\app\src\main\AndroidManifest.xml` patched in place with the
   three AdMob meta-data entries (APPLICATION_ID + both OPTIMIZE flags,
   `tools:replace="android:value"`), mirroring the repo's correct manifest.
2. Durable: `plugins/withOptinixAndroid.js` `withAndroidManifest` mod now **enforces**
   the AdMob APPLICATION_ID + OPTIMIZE flags in every generated manifest (adds or
   replaces, with `tools:replace`), so no future prebuild or stale mirror can ship an
   empty ID again. Plugin loads verified via `node -e require(...)`.
3. Rebuilt from the mirror: BUILD SUCCESSFUL 1 m 01 s → **84,376,748 B**, SHA-256
   `411FEAFCA4FE692F2946B6F8EC94E774551DB42C976E45CADA99093FE7C443CF`. aapt2 on the
   new APK confirms value `ca-app-pub-3940256099942544~3347511713`.

Install: user-instructed fix cycle, `adb install -r` → `Success`, on-device
`pm path`+`sha256sum` = `411feafc…443cf` byte-for-byte, `lastUpdateTime
2026-11-09 18:50:06`. Launch smoke: process alive 10 s+ (`ps -A`, state S), **no
FATAL in logcat** — the previously fatal provider init now passes. Screencap
returned a black frame (screen off/locked) so the visual walkthrough is the user's.
Skill/verify note: launch-kill bugs like this surface only in a live logcat capture
(`logcat -c` → `am start` → read) — the pattern to reuse.

### 2026-11-09 (night) — account/UX + games pass: Google sign-in honesty, installed-first library, onboarding motion choice

Trip wire: the user hit the Google sign-in and saw a bare Supabase page open
("subabase ka kya khul raha h"), reported non-installed games sitting in the
games list, supplied the project's Google/Discord credentials and asked for
sign-in to load settings with an explicit restore option, easier onboarding
with an interface-level animation choice ("onboarding me kar dena taki user
select kar paye ki full animation karna h ya nahi"), and generally easier,
livelier UX.

**Findings first.** The public `/auth/v1/settings` endpoint (apikey header,
publishable key) reported `email: true`, `google: false`, `discord: false` —
the providers were never switched on, which is why tapping Google handed the
user to Supabase's own error page. A Management-API attempt with the
service_role key got 401 (the API takes a personal access token, `sbp_…`,
not a project key) — provider enablement is a dashboard step, documented
with the exact values in `docs/account-setup.md` (Google web client
`319840507430-tk876ehkc4qm14u0080q2qolusd6d7l7…`, Discord app
`1567558319051116735`, callback URLs listed; secrets stay in the dashboard,
never in the repo). The app-side `.env` already carried the correct URL +
publishable key.

**App changes (JS only):**
- `src/services/supabase.js`: new pure `parseProviderSettings()` (unit-tested)
  + cached `getProviderStatus()` fetch of `/auth/v1/settings`; a null result
  never blocks sign-in (transient failure ≠ claimed disabled).
- `src/services/auth.js`: both `signInWithProvider` and `linkProvider` gate on
  the provider status and return an honest, actionable message instead of
  opening the browser; replaced the ineffective `skipBrowserAuthorization`
  supabase-js option with the real `skipBrowserRedirect: true`.
- `src/screens/AuthScreen.js`: per-provider status captions ("· setup needed"
  + explain the dashboard toggle) driven by `getProviderStatus()`.
- `src/screens/GamesScreen.js`: default filter is now **Installed** (was All);
  a count note points unavailable titles to the All tab (they keep the honest
  Unavailable badge and a disabled Play button).
- `src/services/cloudSync.js`: `lastAction` ('upload' | 'restore') joins the
  sync state; `src/screens/AccountScreen.js` prints a plain success notice
  when a cloud restore loaded the setup ("Your saved setup was loaded from
  the cloud…"). Conflict handling unchanged (asks first).
- `src/screens/OnboardingScreen.js`: new step 2/5 — animation level radio
  (Full effects / Reduced motion) with one-element live previews (staggered
  bars vs static), committing the syncable `motion` preference; all forward
  steps tick haptically via the new wrapper and completion still persists
  `onboardingDone`.
- `src/lib/haptics.js` (new): guarded expo-haptics wrappers
  (`tap`/`select`/`success`) that swallow any native failure once; used at
  onboarding steps + finish, Games/Dashboard launch success, email/provider
  sign-in success, save/sync actions.
- `src/components/ui/PulseDot.js` (new): breathing status dot animated by
  looping opacity on a shared value (no `entering`, so the 2026-11-07
  entrance-freeze gotcha does not apply; reduced-motion → static; inactive →
  null). Placed on the Dashboard LIVE/SAMPLING row (replacing a static dot)
  and beside the Account "Settings sync" badge while syncing.

**Verification:** Jest **25 suites / 130 tests** (new `oauthProviders` suite:
parse behavior incl. junk bodies), ESLint 0/0. No native code changes, so no
Kotlin re-verification was needed; release built from the C:\O mirror
(`src` re-synced at 18:25, `.env` copied, no package changes): BUILD
SUCCESSFUL 1 m 13 s → **84,376,700 B**, SHA-256
`62D980E5A39ECF1DE44DC15DBBA6881C45EA4548EBC15B348DD287BD2456AB86`.
Bundle sanity probe found the ASCII markers (`How alive should it feel`,
`Full effects`, `saved title`, `not switched on`, `Welcome back`); strings
containing — / · measure as absent under a UTF-8-read of the hermes string
table because non-ASCII strings live in the UTF-16 table — recorded as a
verify-gotcha, not a bundle defect. **Install approved and verified:** `adb
install -r` → `Success`, device copy hash via `pm path` + `sha256sum` is
`62d980e5…86` (byte-for-byte = the local APK), `lastUpdateTime
2026-11-09 18:38:48`; launch smoke was cut short by the phone auto-locking to
the PIN lockscreen right after `am start` (no FATAL / crash lines in logcat)
— the live walkthrough belongs to the user.

### 2026-11-09 (evening) — HUD+ polish pass from the side-by-side: installed and hash-verified

Trip wire: the user screenshotted the Realme assistant's handle and panel next
to Optinix and asked for heavy improvement plus three specifics — handle LEFT
with proper visibility ("aisa sa hi mere ko handle chahiye left side me… uski
opacity bhi kam h"), panel overall upgrade, stats/FPS HUD disabled by default.

Kotlin (`modules/optinix-overlay`): new `OverlayGauge` (ring + centred
measured value; caller supplies fraction AND label — unmeasured renders an
empty ring with `--`) and `OverlayMeterBar` (thin measured-level track; fill =
the displayed number mapped to a range, null = empty), wired in
`OverlayWindow.kt`: Monitor hero card with 72 dp CPU/RAM gauges, meter bars on
the cpu/ram/temp/battery tiles, a 4th BATTERY quick-strip cell, boost ring
52 dp, `fit()` reserve 228→176 dp, idle dim 0.5×→0.78×, and seven long honest
notes trimmed to 1–3 lines. `HandleGeometry.heightDp` → `size×1.75` clamped
88–126 dp (third user bump: "too short next to the assistant's tall capsule");
peek 20/22/26 and tuck 28 unchanged; test + Settings preview/caption updated.
FPS stats HUD default verified already `false` in JS and native code — the
phone's visible stats plate was a SAVED pref from an earlier walkthrough,
to be turned off through Settings during the walkthrough. Default dock is and
stays LEFT.

Verification/host: overlay compile + unit tests 28 green, Jest 24 suites /
126 tests, ESLint 0/0. Build: repo-root release now fails on
`react-native-gesture-handler:buildCMakeRelWithDebInfo` with ninja
"Filename longer than 260 characters" (`.../gesture-handler/android/.cxx/...`
at the real path even through a C:\OA junction — Gradle canonicalizes), so the
release came from the re-synced C:\O mirror after an in-mirror `npm install`
(the mirror lacked `react-native-google-mobile-ads` from the 11-09 AdMob
integration): BUILD SUCCESSFUL 4 m 05 s → 84,366,200 B, SHA-256
`435E0BF01E8C28635B66C2065B8C4781750C7B9BBDB176A82EE5A979BE280115`, copy
`artifacts/Optinix-Premium-HUD.apk`. Install approved by the user (first
attempt accidentally cancelled → `INSTALL_FAILED_VERIFICATION_FAILURE`; re-run
`Success`), on-device hash via `pm path`+`sha256sum`
`435e0bf01e8c28635b66c2065b8c4781750c7b9bbdb176a82ee5a979be280115` matches,
lastUpdateTime 2026-11-09 17:54:54. Device walkthrough (taller left capsule,
gauges/meters live, stats pref OFF) pending — the phone auto-locked (PIN) just
after the launch smoke check.

### 2026-11-08 (night) — Device check audit + shareable session reports (new user-facing features)

Two features aimed at OEM-game-assistant parity without any invented capability.

**Device check (`src/screens/DeviceCheckScreen.js` + `src/lib/deviceReadiness.js`).** A real
capability audit for THIS phone, built only from probes the native modules already return
(`getCapabilities`, `getPermissionState`, `getStartupSupport`): overlay access, usage access,
session notifications (required only in Notification-only mode), DND policy access,
`WRITE_SETTINGS`, battery-optimisation exemption and the vendor auto-start manager. Each row
carries the exact system route that fixes it (`overlay`, `usage`, `notifications`,
`dnd-access`, `write` settings targets, `requestBatteryOptimizationExemption`,
`openAutoStartSettings`), a required-only score (`passed/total`), and an explicit "What Optinix
will not pretend" card (game FPS, CPU/GPU clocks, refresh rate, other apps). Unsupported
probes render **N/A**, never as a fake pass. Reachable from the `DeviceCheck` stack route,
`optinix://check`, the Dashboard (setup card when the HUD permissions are missing, plus a
ghost button) and Settings → permissions card. `groupChecks()` keeps screen order:
Game HUD → System controls → This phone.

**Shareable session reports (`src/lib/sessionReport.js` + Sessions screen).** Each stored
session gets **Share report**, which shares only the readings the service actually sampled
(duration, CPU average, RAM average, peak temperature, temperature source, end reason), keeps
`--` for anything unmeasured, and states the game-FPS limitation. No number is computed that
the service did not record.

Tests: two new suites (`deviceReadiness`, `sessionReport`, 11 tests) covering required vs
optional scoring, notification-mode requirements, N/A handling, missing-value fallbacks and
the shared text. Host verification: Jest **23 suites / 118 tests**, ESLint 0/0, release
`:app:assembleRelease` via the repaired script **74,905,980 B** in 1 m 04 s, SHA-256
`8439EB5D1D0733755BBF72719B1E88F90E0763B4A40BAB53AEB35F95EB58B428`; the packaged
`assets/index.android.bundle` was checked to contain the new screens. **Not installed.**

### 2026-11-08 (evening) — build pipeline repaired, rotation state kept, discovery can no longer wipe "Installed"

Four root causes found and fixed; no behaviour was invented to paper over them.

1. **`scripts/build-android.js` could not run on this PC at all** (`'gradlew.bat' is not
   recognized as an internal or external command`). Not a Gradle or path-length problem:
   this machine exports **`NoDefaultCurrentDirectoryInExePath=1`**, which stops `cmd` from
   searching the working directory for executables. The script now invokes the absolute
   `root\android\gradlew.bat` (quoted when the path contains spaces) instead of the bare
   name. Verified with a full run from the repo root: **BUILD SUCCESSFUL in 2 m 36 s** — the
   C:\O mirror is no longer required just to get a release build.
2. **The repo's `node_modules/hermes-compiler/hermesc/win64-bin/` was missing `hermesc.exe`**
   (all the ICU/MSVC DLLs were present), so `:app:createBundleReleaseJsAndAssets` failed with
   `'…\hermesc' is not recognized`. Restored the executable from the same package version in
   the C:\O mirror. If it vanishes again, suspect antivirus quarantine before reinstalling.
3. **`OverlayWindow.reconfigure()` dropped the reader's scroll position.** Rotation/inset
   changes rebuild the window (section already survived); it now captures `scrollY` and
   restores it after the rebuild, so rotating mid-section keeps its place.
4. **A failed discovery query could mark the entire library "Unavailable".**
   `appsNative.getInstalledApps` is wrapped in `safeCall`, which returns `[]` on any native
   error, and `mergeDiscovered` then flipped every saved game to `installed: false`. The
   device-side "Township/Subway Surf Unavailable" observation is consistent with that. `discoverGames()`
   now rejects with "Android returned no launchable apps, so your library was left unchanged"
   and touches no state (+1 Jest test). NOTE: the `<queries>` MAIN/LAUNCHER intent is present
   in the merged APK manifest (verified with `aapt2 dump xmltree`), so package visibility is
   **not** the cause; a genuinely absent package still reports Unavailable, which is correct.
5. `OnboardingScreen` said "quick tools" (that card was removed). Now "the six-section game
   assistant panel".

Verification: `:optinix-overlay:testDebugUnitTest` **28 tests** (4+5+4+**9**+6 — the earlier
"27" notes missed the geometry test added on 2026-11-08), Jest **21 suites / 107 tests**,
ESLint 0/0, release via the fixed script **74,892,792 B**, SHA-256
`C9ECA825C1998FE5E8D1B8AAA39BAF936874668082776A153B573B1B6BA973E6`, copy
`artifacts/Optinix-Premium-HUD.apk`. **Not installed** — installation and the on-device
walkthrough still need explicit approval.

### 2026-11-08 (midday) — handle capsuled per the phone's own assistant + in-panel Memory ring; installed and device-verified

Two feedback-driven passes built, installed and walked on the RMX3998 that day
(user's words that drove them: "abhi bhi right side me h… pichka pichka ho raha
h" and a zoomed look at the left-edge reference (`w69-left-edge.png`: the
Realme Game Assistant sits as a subtle left tab)). Full evidence trail and the
raw findings live in `docs/hud-redesign-2026-11-07/README.md` (2026-11-08
sections); only the durable facts are repeated here.

- **Handle geometry (final state in `HandleGeometry.kt`):** visible sliver
  **20/22/26 dp** (size ≥72/≥64/else) with a **68–96 dp** grip (size×1.3) and a
  **28 dp** off-screen tuck (must stay > peek, test-locked). `OverlayWindow`
  renders the **IconView Optinix mark (15 dp) + 3×14 dp accent tail** inside the
  handle. Settings preview/caption updated to match.
- **In-panel animated Boost:** new `OverlayBoostRing` (ring arc = complement of
  the measured RAM reading, breathing halo, 700 ms sweep flash,
  `reducedMotion`-static) in the Performance section's MEMORY card, and an
  honest measured `OverlayTools.boost()` (before-RAM → own-cache `sweepCache()`
  → after-RAM delta string; nothing killed). New service action `"boost"`,
  `runTool`-routed.
- **App-managed handle side:** `setHandleSide`/`getHandleSide` async functions +
  `side:left/right` service actions + Settings picker ("applied to portrait and
  landscape together. Hold, then drag still re-docks it"). The phone's saved
  right dock was NOT silently wiped — Left was set through the app's own
  Settings and screenshot-verified (`w73-handleside.png`).
- **Installed builds (both user-approved):** 74,892,528 B `6790666e…` (12:18:21),
  then the capsule pass **74,892,584 B** SHA-256
  `FA1B8F593CE2F5C950BFA5B8562A61F6C3E0946BB347636DB03EDD4B120A3DC0`
  (12:40:31, overlay permission retained, no FATAL; device copy
  `artifacts/Optinix-HandlePlus2-20261108.apk`).
- **Device-verified:** capsule handle frame `[2334,0][2471,237]` with the ⊙
  mark (`w67`), single gaming + stats window, Performance MEMORY ring showing
  the real FREE-MEMORY 38% value (`w66`), Handle side Left active in Settings.
- **Gotchas recorded:** (1) the phone's Auto-collapse pref is **5 s**, so open
  panels folding a few seconds after opening is configured behaviour, not a
  bug — earlier blind-tap articles kept misreading it (the "temporarily Never"
  note from 2026-11-07 has reverted to the saved 5 s); (2) a synthetic
  `input swipe` across the full screen from the handle position triggers the
  system back gesture and exits the game — hold-drag can't be faked over adb,
  so the left-docked frame check and the Boost-sweep hands-on still need the
  user's finger; (3) Realme's install prompt can outlast two `install -r`
  timeouts before completing — always finish with an installed-hash check.

### 2026-11-07 23:04 — premium gaming-assistant HUD (rail + plate); release built, NOT installed

Brief: rebuild the in-game overlay to OEM-assistant quality using the PC optimizer's
monochrome design system, with the supplied Realme Game Assistant recording
(`%USERPROFILE%/Videos/MeldStudio_Recording_Recording_Output_2026-11-07_at_9.34.58pm.mp4`,
63.85 s, 1920×1080@60) as the interaction reference. Stills extracted to
`docs/hud-redesign-2026-11-07/ref-frames/`.

New Kotlin files under `modules/optinix-overlay/android/src/main/java/net/exitpoint/optinix/overlay/`:
`OverlayStyle.kt` (color/space/type tokens derived from PC Obsidian), `OverlayIcons.kt`
(21 hand-drawn stroke icons — no icon dependency added), `OverlayControls.kt`
(`OverlaySwitch`, `OverlaySlider` with a `dragging` flag, `OverlaySegmented` with an
animated selection pill), `OverlaySystem.kt` (brightness, rotation, DND, screenshot,
recorder, settings intents), `OverlayDashboard.kt` (section bodies + honest copy).
Rewritten: `OverlayWindow.kt` (~1,600 lines: rail, plate, six sections, entrance /
collapse / section cross-fade / indicator animation, confirm sheet, status footer),
`FpsHudWindow.kt` (`setSession`/`clearSession` appearance overrides), 
`OptinixOverlayService.kt` (`fpsOverrides`, `applyFpsOverrides()`, actions `mode:*`,
`bright:*`, `rotate`, `fps:toggle|mode|corner|scale|opacity|metric`,
`processes|startup|macros`, `write` + `notifications` in the settings set, session now
exposes `intervalMs`/`reminderMinutes`/`fpsHud`). `GamingActions.kt` gained the same
targets; `OptinixOverlayModule.kt` exposes `writeSettings`. JS: `App.js` linking adds
`ProcessManager: 'processes'` and `StartupManager: 'startup'`; `SettingsScreen.js` has
the new handle copy plus a "Modify system settings" capability row. New test
`src/test/.../OverlayDashboardTest.kt` (6 tests).

Honesty decisions: profile pills (Power saving / Balanced / Pro gamer) change Optinix
session settings only and the section says so; only Pro gamer needs a confirmation
sheet. Refresh-rate writes are not claimed (routing to Display settings instead), and
no CPU/GPU governor claim is made. Game FPS stays `--` with the Hz ≠ FPS note. Aim
assist, cross-app taps, other-app cache clearing, other-app kills and SIM switching
are refused rather than faked.

Verification: `:optinix-overlay:compileDebugKotlin` + `:optinix-overlay:testDebugUnitTest`
(27 tests, 0 failures) + `:optinix-overlay:lintDebug` green; Jest 21 suites / 106 tests;
ESLint 0/0; release `:app:assembleRelease` from the C:\O mirror BUILD SUCCESSFUL in
1m45s with `:optinix-overlay:compileReleaseKotlin` and
`:app:createBundleReleaseJsAndAssets` both re-executed → **74,891,192 B**, SHA-256
`E499D4D26ADBEA42FE339048132625D0EA043D7149196D8E664D4DCDCE308364` (copy at
`artifacts/Optinix-Premium-HUD.apk`). Only two pre-existing deprecation warnings
(`FOREGROUND_SERVICE_TYPE_NONE`, `VIBRATOR_SERVICE`). **Nothing installed** — the phone
still runs the 74,824,916 B build; device walkthrough needs explicit approval.

Gotcha repeated: `node scripts/build-android.js` failed here with `'gradlew.bat' is not
recognized` (its `subst` alias path), so build from the C:\O mirror directly:
robocopy `src`/`modules` (minus `build`, `.gradle`)/`plugins`/`scripts`/`__tests__` +
root config files, then `cd C:\O\android && .\gradlew.bat :app:assembleRelease
"-PreactNativeArchitectures=arm64-v8a,armeabi-v7a"` with `JAVA_HOME`/`ANDROID_HOME` set.
The mirror root is `C:\O` itself (not `C:\O\Android-Optimizer`).

- 2026-11-07 (22:03 handoff): **Major gaming HUD redesign + Android 10 minimum**.
  Files: `OverlayWindow`, `FpsHudWindow`, service/module, `GamingActions`, new
  `HandleGeometry/HudPolicy/OverlaySupport/ForegroundState/OverlayAdvice` + tests;
  `ForegroundGameReader`, Apps/Device modules and manifests; preferences/gaming
  config/sync schema, Settings/GamingTools/Onboarding/Dashboard/Process/Startup
  surfaces; plugin SDK properties and dual-ARM build helper. No PC edits.
  Why: subtle edge handle, genuine visibility semantics, public API-29 fallbacks,
  honest capability/metric/action states, and prevention of game input obstruction.
  Verification: 21 Jest suites / 106 tests, ESLint 0/0, 21 native tests, module lint
  0 errors and API violations (warnings 8/1/91), final release 1m44s / 74,824,932 B.
  Physical observations and exact built/installed hashes are in Current status and
  `docs/hud-redesign-2026-11-07/README.md`; incomplete tests are not claimed.
  Gotchas: eight radius values are mandatory; stale activity-stop events must match
  class before clearing foreground; Go/low-RAM is not proof of grantability;
  API 31 touch-through requires window alpha (not only view alpha); C:\O had a stale
  generated manifest, now reconciled and APK-permission checked; Realme's scan
  **Continue installation** prompt causes adb timeouts (do not disable protections;
  check the installed hash). Final thermal/graph fixes are host-verified only.
  Temporary Auto-collapse Never is documented after the user stopped testing.
- 2026-11-07 (account delivery): optional Supabase email/OAuth/profile/provider/
  reset/logout/delete surfaces and allowlisted cloud preference/library/macro sync
  are included in the build. Source map lists the files; migration and protected
  delete-account function are in `supabase/`, setup in `docs/account-setup.md`.
  EXPO_PUBLIC project URL/publishable key only (VITE aliases accepted); no service
  role/provider secrets are intentionally bundled. Callback/schema host tests pass.
  Real provider/email/RLS isolation/account-deletion verification is still pending
  Supabase project configuration. Server identity-linking policy must be validated;
  lack of client email merging is not proof about Supabase's own automatic linking.

- 2026-11-07 (final): **Full product overhaul — the user's 10-phase prompt (audit →
  PC-grade UI → gaming overlay integrity → FPS HUD → Process Manager → Startup Manager
  → permissions/performance/testing). Code + verification only; NO install.** The
  "screen recording" referenced in the prompt was never attached: the audit and UI
  checks were source-only, and no device install/manual testing was done because the
  prompt approved only the release build (device work needs explicit user sign-off).
  - **Verification numbers:** eslint 0 errors / 0 warnings; jest **17 suites / 83
    tests** (new: `processUi`, `startupOem`, `fpsHudPrefs`);
    `:optinix-device/:optinix-apps/:optinix-overlay:compileDebugKotlin` BUILD
    SUCCESSFUL; release APK **40,581,655 B** (2026-11-07 14:29) from the re-synced
    C:\O mirror — full build 4 m 31 s (`C:\O\assemble-overhaul.log`), then an
    incremental rebuild 1 m 14 s (`assemble-overhaul2.log`) after the FlatList layout
    fix (both new screens use the AddGames idiom: `<Screen scroll={false}
    contentStyle={{ padding: 0 }}>` + `FlatList style={{ flex: 1 }}`, so footers
    scroll with content instead of double-padded dead space). Sync rc codes 0/1/3 =
    healthy. `adb install` was NOT run; the phone still runs the previous
    40,536,735 B build.
  - **FPS stats HUD (new second overlay window):** new `FpsHudWindow.kt` +
    service wiring — the session loop shows/hides it only while `fpsHudEnabled` and
    overlay permission are up, hides it on permission revoke and in `onDestroy()`,
    `reconfigure()` re-applies config, `resetPosition()` also resets the FPS corner,
    permission-revoke path hides both windows. `FLAG_NOT_TOUCHABLE` (can never steal
    a game touch), corner placement (no drag), three modes (minimal/compact/
    detailed). Game FPS is permanently `--` with an honest note ("Game FPS is not
    exposed by Android. Display Hz is not game FPS."); measured rows are CPU/RAM/temp/
    battery/refresh from the same service loop. Module: `AsyncFunction
    ("setOverlayVisible")`, clamps `fpsHudOpacity` 0.4–1 (default 0.9, matched to
    Settings' segmented options), `fpsHudScale` 0.7–1.6, `fpsHudMode`/`fpsHudCorner`
    enums, `fpsHudMetrics` ≤5 known ids. JS: new `fpsHud*` preferences + sanitize,
    gamingConfig pass-through, `native/gaming.js` bridge, and the Settings
    "FPS stats HUD" card (enable/mode/corner/size/opacity/detailed-metric toggles +
    honest caption). Details in "Overlay feature set".
  - **Process Manager:** new `ProcessManagerScreen.js` + `src/lib/processUi.js` (+
    tests): device-level RAM summary from the monitor snapshot (per-app memory is not
    exposed by Android — stated, never invented), recently-active apps via
    UsageStats, search + sort (recent/name/screen time), zero "Kill" affordances and
    the honest explanation (Android 14+ `killBackgroundProcesses` reaches only the
    calling app's own processes). Real actions: per-app App info (`openAppInfo`) and
    the new native `openAppManagementSettings` (ACTION_APPLICATION_SETTINGS); dead JS
    `appsNative.boost` wrapper removed.
  - **Startup Manager:** new `StartupManagerScreen.js` + `src/lib/startupOem.js` (+
    tests) over the new native `getStartupSupport`/`openAutoStartSettings`
    (`AUTO_START_CANDIDATES`: ColorOS safecenter + phonemanager, legacy OPPO, MIUI,
    Samsung sm/lool, OnePlus, iqoo/vivo, ASUS, Huawei — resolved via
    `getActivityInfo` try/catch; the module manifest gained the matching `<queries>`
    package entries for Android 11+ visibility). Honest states: Available /
    Unsupported ("will not fake a toggle") / Unknown (native module missing), per-
    vendor manual paths, consequence copy (blocking auto-start delays notifications/
    sync), and an "Optinix's own startup" card (no boot permission — nothing to
    manage). No per-app on/off state is ever claimed because Android exposes none.
  - **HUD hidden state:** native `setOverlayVisible(visible)` — the service holds
    `wantHud` as the single truth, refuses honestly without overlay permission, and
    the loop reconciles the control HUD with the foreground library game; the new
    GamingTools "HUD visibility" card (Hide / Reopen) drives it. `resetOverlayPosition`
    also resets the FPS HUD corner.
  - **Dead-code purge / audit fixes:** deleted `src/services/gameWatch.js` (verified
    unused); `overlayController.js` reduced to the one used export `stopOverlay()`;
    removed dead JS wrappers (`appsNative.boost`, overlay `requestPermission`/
    `setConfig`, `gamingNative.applyProfile`); preferences dropped the dead
    `autoOptimizeOnLaunch` (sanitize drops stale installs' copy); removed
    ThemeProvider's unused `useThemedStyles` and designTokens' unused `glow()` (also
    from the default export); BoostScreen's ghost "apps closed" line gone
    (`execution.killed` is never produced by any engine); Dashboard's hard-coded
    "10 engines" chip → `${engineRegistry.length}`; app.json's unread `extra.optinix`
    removed (jest.setup expo-constants mock parity); `appEngines`' old JS
    `overlayNative.start` HUD path kept but the honest unsupported message retained.
  - **UI parity fixes:** SessionsScreen honest loading state (`sessions == null`) +
    EmptyState adoption; GamesScreen EmptyState; AddGamesScreen guards a missing Apps
    module with an inline notice (no setState-in-effect lint breach); GameArtwork's
    legacy teal artwork gradient → ink-only `GRADIENTS.hero` ramps; SettingsScreen's
    HUD-preview hardcoded navy hexes → global DARK tokens (surface/border).
  - **Remaining (honest):** the `<queries>` OEM probes are compile-verified only —
    resolution on real Realme UI is untested until install approval; FPS HUD and both
    managers need hands-on walkthrough; `expo export` bytecode path still blocked by
    the machine's missing hermesc (release builds unaffected, they bundle via Gradle
    metro). See Pending #10.

- 2026-11-07 (later): **Logo in the build + PC-style motion pass (user asked: "at least
  build with the logo" + "no animations at all – fix this"; the rebuild/install used the
  phone-build approval the user had given earlier today).** Scope:
  - **Icon/splash:** new `scripts/make-logo-assets.ps1` (System.Drawing, repeats in ~10 s)
    generated repo `assets/icon.png` (1024, black, glyph 76%), `assets/adaptive-icon.png`
    (transparent, glyph 62%), `assets/splash.png` (transparent, glyph 50%) and the mipmap
    PNGs/adaptive-XMLs into BOTH res trees (repo `android/` and C:\O) after deleting the
    old `ic_launcher*.webp`. app.json gained `icon`, `android.adaptiveIcon`, `splash.image`
    and mono colors (`primaryColor` ink `#ffffff`, backgrounds `#0a0a0a`/`#000000`).
    Resource patch: colors.xml (splash/activity `#0a0a0a`, colorPrimary `#ffffff`,
    new `ic_launcher_background` `#000000`), splashscreen_logo.xml bitmap item. See gotchas
    7-8 for the webp-duplicate trap and the exact file list.
  - **Motion (all Reanimated, all `reducedMotion`-gated, transform/opacity only):**
    `Card.js` opens with `FadeInDown` (360 ms, `enter={false}` opt-out prop; plain
    `View` → `Animated.View`); `Button.js` gained press scale 0.97 (110 ms in / 170 ms
    out) + press opacity 0.86 off `AnimatedPressable` shared values; `TabBar.js` swapped
    the static per-item active bg for a **sliding accent-dim pill** (spring damping 26/
    stiffness 300, geometry = bar width / tab count, inset 7 px, no animation on first
    layout, `reducedMotion` = instant set); new `CountUp.js` animates a real number once
    from 0 when it first arrives (`useAnimatedReaction` + `runOnJS`, null stays an honest
    `--` and plays nothing; later live updates render instantly) — used for the
    Dashboard health score.
  - **Test infra:** `jest.setup.js` gained a global `react-native-reanimated` mock
    (worklets need the real native module at import; Button imports broke the
    macroEditor suite). Jest: 14 suites / **66 tests passed**; eslint 0/0 after
    scoped `react-hooks/immutability` disables (Reanimated shared values are mutable
    by design) and reworking CountUp so setState only ever fires from the reaction.
  - **Build/install:** `src`, `assets` (new), `scripts`, `plugins`, `app.json`,
    `jest.setup.js` synced to C:\O (robocopy /MIR); `:app:assembleRelease
    -PreactNativeArchitectures=arm64-v8a` from `C:\O\android` → BUILD SUCCESSFUL 1 m 03 s
    (APK 40,536,735 B; first attempt failed on webp duplicates → see gotcha 7, fixed,
    second run green). `adb install -r` Success on RMX3998. Screencap-verified: launcher
    icon (home screen), logo splash at cold start, Dashboard values, tab pill on Home +
    after a Monitor tap. No FATAL in logcat; honest `--` copies intact.
  - **Incident:** one adb tap had been computed from a stale dump while the user had
    switched to WhatsApp on the device — escaped into the user's app (dumps don't
    lie about coordinates, but foreground changes between commands). Stopped driving the
    UI immediately; documented in gotcha 9. Screenshots on the device were deleted.
- 2026-11-09: **Google AdMob Monetization Architecture & Privacy Integration.**
  Integrated official Google Mobile Ads SDK (`react-native-google-mobile-ads` v17.4.0) with Google Play Services Ads 25.5.0 + UMP Consent 4.0.0.
  - Centralized manager: `src/services/adManager.js` handles initialization, UMP GDPR/privacy consent, safe test ID defaults (`ca-app-pub-3940256099942544~3347511713`), and listener subscriptions.
  - **Rule 6 (Optimization safety):** Connected to `useEngineRun.js` — whenever an optimization sweep runs, `adManager.setOptimizing(true)` immediately suppresses all ads, collapses active banners, and blocks rewarded ad requests.
  - **Rule 7 (Gaming session protection):** Connected to `useGamingRuntime.js` — whenever an active gaming session runs, `adManager.setGamingActive(true)` halts all ads to ensure zero intrusion over gameplay or the in-game overlay.
  - Non-intrusive banner component: `src/components/ads/OptinixBannerAd.js` uses `ANCHORED_ADAPTIVE_BANNER`, auto-collapses on load error (zero blank boxes), and unmounts cleanly when `canShowAds()` is false. Placed non-intrusively in `SessionsScreen.js` and `SettingsScreen.js`.
  - User privacy & settings: Added "Monetization & Ads" card in `SettingsScreen.js` providing one-tap Google UMP privacy & consent verification and an optional Rewarded Ad supporter button.
  - Verification: Jest **24 suites / 126 tests** (new `adManager.test.js`), ESLint 0/0, overlay native unit tests **28/28 PASS**, Gradle compilation verified. NOT installed on physical device (awaits approval).
- 2026-11-07: **App-wide monochrome token parity (PC 2026-11-04 direction) + HUD
  enhancements.** designTokens.js DARK/LIGHT → PC gray/ink values; ACCENTS gained
  `mono` (first/default) with legacy teal/indigo/amber/rose kept; ACCENT_OPTIONS
  reordered; GRADIENTS → ink-only ramps; radius `md/soft 7` (= PC control) and
  `lg/xl 12` (= PC card); shadows → PC `--shadow-e1..e3` opacities (0.09/0.11/0.15)
  + mobile-only e4 0.18; `typography.family.brand` Orbitron → PlusJakartaSans_700Bold,
  Orbitron imports/load removed from App.js. preferences `accent: 'mono'` fresh
  default + new `overlayAutoCollapse` (never/5/10/20, default '10') with sanitized
  enum; ThemeProvider fallback `ACCENTS.mono`; stale teal defaults in appEngines
  (`game-boost` accent) and OrbScene → ink. HUD (Kotlin-only): mono palette +
  lightness-only numeral ramp, tap-outside collapse (`FLAG_WATCH_OUTSIDE_TOUCH` +
  root `ACTION_OUTSIDE`), configurable auto-collapse (`autoCollapseSeconds`
  config key, independent of the 7 s `autoHide` dim), sparkline RAM/grid grays,
  bridge accent default ink, and `hudAccentHex` now always dark-variant. Settings
  gained the Auto-collapse picker. Verification: jest 14 suites / 66 tests,
  eslint 0 errors / 0 warnings, `:optinix-overlay:compileDebugKotlin` BUILD
  SUCCESSFUL (both passes: 1m17s and 8s). **Phone build done the same morning with
  the user's approval:** `src/modules/plugins/scripts/docs/__tests__` + config files
  synced to the `C:\O` mirror (robocopy /MIR; `tests` rc=16 expected — no such dir),
  `:app:assembleRelease -PreactNativeArchitectures=arm64-v8a` from `C:\O\android` →
  BUILD SUCCESSFUL in 2m 48s, APK 40,436,161 B → `adb install -r` OK on the attached
  **Realme RMX3998 (Android 16, serial `NB89CQEAFUR8TKMR`; the old RMX5313
  `00744740104c8f9c` is not attached)**. adb launch smoke: process alive, no FATAL
  exceptions, `uiautomator` shows full Dashboard content (honest `--`/display-Hz copy
  intact). Device-side caveat: this was an **upgrade, so the pre-existing saved
  `accent: 'teal'` kept rendering** — correct legacy-pref policy (`mono` is only the
  fresh-install default). To show the new look, the saved accent was switched to
  **Mono through the app's own Settings screen via adb taps** (Settings → Appearance
  → Mono; one-tap revert if the user wants teal back). After the switch the Games
  screen rendered the monochrome system live: ink-filled primary, hairline controls,
  ink tab selection (screenshot archived). HUD-over-game walkthrough (notch drag,
  drawer, tap-outside collapse, auto-collapse timing) still needs hands-on with a
  game.
- 2026-10-30: **Overlay modern-UI pass (user asked for a modern overlay UI).**
  Obsidian-Spectrum reskin of `OverlayWindow.kt` + a rewritten `OverlaySparkline.kt`
  (full list in the 2026-10-30 bullet under "Overlay feature set"): gradient plates with
  hairline strokes instead of the hard grey border, segmented dashboard tabs with an
  accent-tinted active pill, Perf tab as a 2×2 mono-numeral metric tile grid with
  presentational warn/hot status colours (thresholds documented in the feature set),
  mono-bold quick-panel timer, hairline shortcut pills, accent dot in panel headers,
  one accent-filled primary action per surface (ink chosen by measured accent luminance),
  sparkline CPU area fill + newest-sample endpoint dot. Notch geometry, all motion
  (entrance/drag/idle/pulse), docking, haptics, reduced-motion gating and the honest `--`
  rules are untouched; colour is the only added judgement, values stay raw sensor output.
  Verification: `:optinix-overlay:compileDebugKotlin` BUILD SUCCESSFUL. **No APK build and
  no device install — user instruction: consult before any phone build.** jest/eslint not
  rerun (zero JS changes). Release rebuild + on-device HUD walkthrough pending approval.

- 2026-10-26 (late night): **Game Space-notch HUD verified live, `‹` collapse added.**
  Device check settled the "HUD disappears" scare: the loop log
  (`wantHud/current/game/showing/allowed/err`, added unconditionally to
  `OptinixOverlayService` — release `BuildConfig.DEBUG` gate dropped; demote pending)
  shows the window adding and staying (`showing=true` across ticks, no crash). The
  single window now behaves exactly like Game Space's two windows: the 15×52 dp notch
  sits flush at the docked edge (frame `[1575,68][1600,156]`), tapping it opens the
  drawer (`[1063,68][1600,691]`) while the notch itself hides
  (`handleRowView.visibility = GONE`), and a new `‹` minimize button in the dashboard
  header (`performAction("collapse")` added to the service dispatcher) slides it back to
  a notch. Verified end-to-end over Airport City via adb taps + `dumpsys window` frames;
  uiautomator cannot see cross-process overlay windows (dump is app-window-only —
  documented as a verification gotcha). APK 40,433,737 B installed and session left LIVE
  for the user to feel.

- 2026-10-26 (night, later): **Game Space-style overlay motion.** Handle now tucks to a
  ~14dp notch sliver (dot faces the visible side via per-dock layout direction), opens by
  sliding the window out of the edge, closes by sliding back in; idle deep-tucks + dims +
  scales; entrance grows out of the handle corner (230 ms overshoot); drag has lift +
  2.4° 3D tilt + spring settle; buttons press-scale; accent dot breathes (2.4 s loop);
  everything gated on `reducedMotion`. Kotlin compile green; release rebuild + install
  pending.
- 2026-10-26 (night): **One-time onboarding.** Added `OnboardingScreen.js`
  (Welcome → What it does → Permissions → Ready): permissions (POST_NOTIFICATIONS,
  usage access, overlay, battery exemption) are collected during setup with honest
  live status read from Android each render/AppState return; "Continue" is always
  available, nothing is ever asked twice by the app itself. New `onboardingDone`
  preference gates the first run (`RootNavigator` waits for hydration, then picks
  the initial route; onboarding `replace('Main')`es before persisting so the active
  route is never removed out from under the navigator). `ThemeProvider.reset()`
  preserves `onboardingDone` so a Settings reset does not re-run setup. Existing
  installs see onboarding exactly once because the new flag defaults to false.
  Verification: jest 13 suites / 60 tests, eslint 0/0, release APK 40,433,737 B
  (2026-10-26 ~21:00) installed; Welcome step confirmed live via uiautomator dump,
  then the flag flip + Main screens confirmed — full 4-step visual pass pending a
  deliberate `pm clear` (user data). Reduced-motion preference drops all step
  motion.
- 2026-10-26 (evening): **Session-finish analysis + profile `short` wiring.** Deep audit of
  the in-progress gaming layer found (a) `gameProfiles.js` gained bounded `short` preset
  labels but nothing consumed them, (b) full docs drift (gaming layer absent from source
  map/data flow), (c) `gameWatch.js`+`OverlayAutoStart` dead since the gaming rework,
  (d) config plugin already covers all prebuild tweaks. Completed the `short` wiring:
  `OptinixOverlayService.session()` now exposes `profileShort` (full `profileName` kept for
  history); `OverlayWindow` handle subtitle and quick-panel profile buttons prefer
  `short` with name fallback. Mirror re-synced to C:\O (src/modules/plugins/scripts/docs/
  tests, hash-verified). Verification: jest 58/58, eslint 0/0,
  `:optinix-overlay:compileDebugKotlin` green, release APK 40,421,413 B built from C:\O,
  installed and launched cleanly on RMX5313. AGENTS.md source map/data flow rewritten to
  match reality.
- 2026-10-26: **Overlay visual rebuild.** Rewrote `OverlayWindow.kt`: handle pill
  (mono CPU% text, accent ring), 220dp quick menu (chips, profile modes, tool grid, timer,
  status), auto-fit dashboard with Perf/Tools/Net/Stats tabs (fixed-size 316×510dp plate
  removed — root cause of the empty-space "black window" look), idle fade after 7 s
  (`autoHide`), all view references cleared in `hide()`, measured network latency shown in
  the Net tab (`setNetworkResult`). `optinix-overlay` build.gradle unchanged in repo but
  rebuilt from stale C:\O (was missing the `react-android` dependency there). Added
  `overlayAutoHide` preference + Settings toggle + `autoHide` config pass-through.
  Verification: eslint clean, jest 58/58, `:optinix-{device,apps,overlay}:compileDebugKotlin`
  green, JS bundle + release APK build green, APK (40,421,345 B) installed on RMX5313.
  On-device interaction/screenshot check blocked by the PIN lockscreen.
- 2026-10-25: Session opacity configurable temporarily, panel readability fixed at low
  opacity, right-edge docking with RTL handle, paused-session battery drain honesty added,
  null-safe text filtering in smoke script, accessibility label patches, Jest passes 58/58.
- 2026-10-23 (evening): Overlay HUD expanded into PERF/BOOST/STATS tabs. Added
  `OverlaySession.kt` (session stats + battery drain), `OverlaySparkline.kt` (CPU/RAM chart),
  `OverlayTools.kt` (measured boost, own-cache clean, HTTPS latency), foreground app row via
  UsageStats, INTERNET/KILL_BACKGROUND_PROCESSES permissions in the overlay manifest, and
  updated Games screen copy. Kotlin compile green, eslint clean, jest 35/35, release APK
  rebuilt and installed (40,133,005 bytes). Runtime HUD verification still pending because
  the test phone was locked.
- 2026-10-23: Overlay metrics moved into `OptinixOverlayService` (CPU/RAM/temp/battery,
  honest nulls), removed JS metric pushes and FPS/PING overlay rows; per-weight font imports;
  native modules compiled; release APK built, R8 crash found and fixed by disabling minify;
  CMake 3.31.6 + `cmakeObjectPathMax=200` added for Windows long paths; app installed and
  verified running on device.

## GitHub source publication — 2026-11-03

Initialized this source checkout for https://github.com/Legendscene/optinix-android.git on main at the user's request. Root generated /android and /ios remain ignored; local modules/*/android source is versioned. Module build output, Gradle caches, APKs, artifacts, logs and environment secrets are excluded. No application behavior changed and no APK build/install performed.
