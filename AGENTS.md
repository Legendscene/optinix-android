# AGENTS.md — Optinix Android

**Read this first if you are an AI (or human) touching this project.**  
If you change behavior, files, build steps, or fixes, update this file in the same session.  
This is the single source of truth for "what exists, where it lives, and why".Last updated: 2026-10-30

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
`gameWatch.js` + the old `OverlayAutoStart` flow are **dead code** (nothing calls
`startGameWatch`); foreground detection when a session runs is native
(`ForegroundGameReader`, UsageStats-based). Launcher-launched games with Optinix in the
background will NOT auto-open the overlay — see Pending #2.

1. **Never fabricate metrics.** Unmeasured / unsupported values are `null`; UI renders `--`
   and explains why. This matches the PC optimizer's rule.
2. Anything that requires root (clearing other apps' cache, killing system apps, real game FPS)
   is reported unsupported with a reason — never faked.
3. Overlay metrics are measured **inside the overlay service itself** (CPU/RAM/temp/battery).
   Game FPS is intentionally not shown because it cannot be measured without root/hooking.
4. Keep the UI honest about provenance: "APP FRAME RATE" means our app's Choreographer rate,
   not the game's FPS.
5. `android/` and `ios/` are generated (gitignored). Do not treat them as source of truth.

## Overlay feature set (three states, redesigned 2026-10-26)

`OverlayWindow.kt` renders exactly **one** `TYPE_APPLICATION_OVERLAY` view per service
(`WRAP_CONTENT`, `TRANSLUCENT`, `NOT_FOCUSABLE|NOT_TOUCH_MODAL`) — the window is only as big
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

Modes live in `enum Mode { HANDLE, QUICK, DASHBOARD }`; only DASHBOARD persists as the
`expanded` config. `hide()` now nulls **all** view refs (`bubble`, `heading`, `quickTimer`,
`scroll`, etc.), eliminating stale-view actions after `reconfigure()`.

## Stack

- Expo `~58.0.17`, React Native `0.88.0`, React `19.3.0`, new architecture on.
- Navigation: `@react-navigation/native` 7, `bottom-tabs` 7 (5 tabs), `native-stack` installed.
- 3D: `expo-gl` + `three@0.186.1` directly (no react-three-fiber). Reanimated 4 + worklets 0.13.
- Styling: plain `StyleSheet` + design tokens. Tailwind/NativeWind were removed.
- Storage: AsyncStorage. Tests: Jest (`jest-expo`) + Testing Library. Lint: ESLint 9 flat config.

## Commands

```powershell
npm install
npm test                 # jest, currently 14 suites / 64 tests
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
.\gradlew.bat :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain
adb install -r app\build\outputs\apk\release\app-release.apk
```

## Source map

```
App.js                     Fonts, SplashScreen, providers, nav theme, monitor start,
                           game watch start, OverlayAutoStart.
index.js                   Expo entry.
app.json                   Expo config: package, permissions, plugins, extra.optinix.apiPort=5420.

src/navigation/
  RootTabs.js              5 tabs: Dashboard, Boost, Games, Monitor, Settings.
  TabBar.js                Custom floating tab bar.
  TabIcon.js               Tab glyphs (SVG).

src/screens/
  DashboardScreen.js       Hero 3D orb, health ring, APP FRAME RATE/CPU/RAM tiles, quick actions.
  BoostScreen.js           Safe sweep + engine list (memory, cache, game, battery audit).
  GamesScreen.js           Game library, overlay toggle, session launch, last result.
  AddGamesScreen.js        Pick launchable game candidates into the persisted library.
  GameProfileScreen.js     Per-game profile (preset, DND, HUD, sampling, reminders).
  GamingToolsScreen.js     In-session DND/timer/capture/controls surfaced from runtime.
  SessionsScreen.js        Session history (GamingStore), clear + details.
  MacroStudioScreen.js     Utility macro list + enable toggle (runs user-started only).
  MacroEditorScreen.js     Macro builder (haptic/wait/markers), 20 repeats / 10 min cap.
  NetworkScreen.js         Measured HTTPS diagnostics + history (no fabricated numbers).
  MonitorScreen.js         Live CPU/RAM/temp/battery/network history (sparklines).
  SettingsScreen.js        Theme/accent/density/motion, HUD customization (opacity, notch size,
                           HUD accent + live notch preview, shortcuts), permissions, gaming data
                           reset, native module status, about.

src/components/three/OrbScene.js   expo-gl + three orb (the view that triggered the R8 crash).
src/components/gaming/GameArtwork.js  Optional per-game artwork rendering.

src/components/ui/         Design-system primitives (22 files, incl. Field, PageHeader,
                           ResultNotice, ToggleRow).

src/theme/ThemeProvider.js Theme from tokens + preferences; useTheme/usePreferences/useThemedStyles.
src/store/preferences.js   AsyncStorage + persistentStore-backed preferences (incl. overlayShortcuts,
                           overlayAccent ('app' follows theme, or a fixed HUD colour), overlayAutoHide,
                           macroEnabled, batteryConscious, networkTarget, reminderMinutes, retentionDays).
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

src/services/
  monitor.js               Polls native snapshot + cpu + app FPS; AppState-aware; null-safe.
  metrics.js               Metric normalisation/derived values.
  networkProbe.js          Latency/throughput probe (real requests).
  gaming.js                gamingConfig(preferences, theme) builder + hudAccentHex() HUD-accent
                           helper (custom accent uses the dark-variant hex), launchGame() full flow
                           (configure → native startSession → openApp → fallback endSession),
                           notification permission helper.
  gameWatch.js             DEAD CODE (kept): nothing calls startGameWatch since the gaming
                           rework; candidate for removal in a cleanup pass.
  overlayController.js     start/stop/setConfig/getState around the overlay module.

src/hooks/
  usePermissions.js        Special-access state (usage, overlay, battery) refreshed on focus.
  useEngineRun.js          Runs an engine, records history, exposes execution result.
  useGamingRuntime.js      Subscribes to native getRuntime() (session/macro/capture state).

src/engines/
  base.js                  Optimizer engine base class (mirrors PC OptimizerBase semantics).
  systemEngines.js         Memory/battery/thermal/cache/network etc.
  appEngines.js            App/game related engines.
  index.js                 Registry used by screens.

src/navigation/RootNavigator.js  Bottom tabs + native stack (GamingTools/MacroStudio/
                           Network/Sessions/GameProfile/AddGames detail screens).
src/native/{device,apps,overlay,gaming}.js   JS bridges; gaming.js wraps the overlay module's
                           gaming surface with availability + honest fallbacks.

modules/optinix-device/    Kotlin module: device snapshot, CPU load, FPS.
modules/optinix-apps/      Kotlin module: installed/recent apps, icons, foreground app,
                           boost, cache, permissions, storage.
modules/optinix-overlay/   Kotlin overlay module + foreground service; gaming runtime
                           (GamingStore/GamingActions, OptinixOverlayService session loop,
                           OverlayWindow handle/quick/dashboard, MacroRunner, DndController,
                           SessionClock, OverlaySession, OverlaySparkline, OverlayTools,
                           NetworkDiagnostics, CaptureService/CaptureConsentActivity/
                           CaptureRepository, ForegroundGameReader).

plugins/withOptinixAndroid.js  Config plugin persisting all build tweaks (see Gotchas) +
                           OPTINIX_BUILD_ROOT/OPTINIX_SOURCE_ROOT gradle path remap so the
                           release build can run from C:\O while pulling from the real root.

scripts/build-android.js   Node helper for release build
scripts/device-smoke.js    adb-based smoke script (null-safe text checks).

__tests__/                 14 suites / 64 tests: format, insights, engines, gameLibrary,
                           gameArtwork, macros, macroEditor, macroPersistence, monitorLifecycle,
                           persistentStore, networkProbe, runHistory, onboarding, hudAccent.
```

## Native modules (API surface)

`optinix-device` (`OptinixDeviceModule.kt`):
`getSnapshot()`, `getCpuLoad()`, `getFps()` (Choreographer, app-only), `isSupported`.
Snapshot includes device info, per-core CPU, memory, storage, battery, thermal zones,
display/refresh rate, network.

`optinix-apps` (`OptinixAppsModule.kt`):
`getInstalledApps`, `getGameCandidates`, `getAppIcon` (base64 PNG), `getForegroundApp`,
`getRecentApps`, `getStorageStats`, `boost`, `clearOwnCache`, `openApp`, `openAppInfo`,
`hasUsageAccess`, `openUsageAccessSettings`, `hasOverlayPermission`, `openOverlaySettings`,
`isBatteryOptimizationExempt`, `requestBatteryOptimizationExemption`, `getPermissionState`.

`optinix-overlay`:
`hasPermission`, `requestPermission`, `start(config)`, `setConfig(config)`, `stop`, `getState`.
Config: `accent` (hex), `opacity` (0.35–1), `expanded`.
Service (`OptinixOverlayService.kt`) draws a draggable bubble + expandable HUD with
PERF/BOOST/STATS tabs and samples `OverlayMetrics.kt` every 700 ms:
- CPU: `/proc/stat` deltas (first sample null, honest).
- RAM: `ActivityManager.MemoryInfo`.
- Temperature: max plausible `/sys/class/thermal/thermal_zone*/temp`, fallback battery temp.
- Battery: sticky `ACTION_BATTERY_CHANGED`.
Supporting classes: `OverlaySession.kt` (avg/peak, duration, drain), `OverlaySparkline.kt`
(44-point CPU/RAM chart), `OverlayTools.kt` (boost, own-cache clean, HTTPS latency).
Bubble headline = CPU %. No game FPS in overlay (cannot be measured without root).

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
- `gameWatch.js` + the removed App-level `OverlayAutoStart` are dead — no auto overlay on
  launcher-launched games while Optinix is backgrounded.

## Design system

- Token source: `src/lib/designTokens.js` (mirrors `PC-Optimizer/desktop/src/index.css`).
- Themes: dark default, light supported; attrs `data-theme`/`data-accent`/`data-density`
  in the web app map to `mode`/`accent`/`density` preferences here.
- Accents: teal (default `#00E5CC` / overlay `#14B8A6`), indigo, amber, rose.
- Fonts: Inter (body), Orbitron (display), JetBrains Mono (numeric). Import per-weight
  subpaths (`@expo-google-fonts/inter/400Regular` etc.); importing the package root bundles
  all 57 font assets instead of 26.

## Verification checklist (expected green)

```
npx eslint .        -> 0 errors / 0 warnings
npx jest            -> 14 suites, 64 tests passed
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
- Expo build config: compileSdk 37, targetSdk 36, minSdk 24, buildTools 37.0.0.
- Device used for testing: Realme RMX5313 (`adb` serial `00744740104c8f9c`), Android 16,
  arm64-v8a. Check with:
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

## Current status

- JS shell complete: 5 tabs, theme/preferences, dashboard/boost/games/monitor/settings.
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
- Current release APK: 40,433,737 bytes (2026-10-26 ~21:55), installed on RMX5313. Contains
  the complete gaming layer (game library, per-game profiles, macros,
  GamingTools/Sessions/Network screens), the `short`-label wiring, the one-time onboarding,
  and the Game Space-style notch HUD described in "Overlay feature set".
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

1. Verify full HUD flow on the device with user present: grant usage access, launch a game
   from Optinix Games, drag/expand the HUD, switch tabs, run Boost/Clear/Ping, check
   measured values and the new short profile labels in handle/quick panel.
2. **Decision needed — auto overlay on launcher-launched games.** The old JS auto-start is
   dead; background games produce nothing today. Options: (a) accept + document honestly
   ("start from Optinix"), (b) implement a small native watcher (GamingStore + a periodic
   UsageStats check when a session-capable event is expected; beware Realme process kills),
   or (c) a lightweight foreground micro-service. Nothing was faked meanwhile.
3. Remove dead `gameWatch.js` (+ its `monitorLifecycle.test.js` references) or re-wire it;
   today it is unused after the gaming rework.
4. Decide long-term R8 strategy (keep minify off vs add keep rules and test) — currently
   stable with minify off, and the config plugin keeps it off across prebuilds.
5. ~~Config plugin for prebuild tweaks~~ — DONE: `plugins/withOptinixAndroid.js` persists
   minify/cmake/objectPathMax/jvmargs/timeouts/mirrors + C:\O→'repo path remap.
6. Improve game detection (AddGames discovery heuristic) if false positives/negatives appear.
7. Consider debug/dev-client workflow with Metro for faster iteration (JS-only changes can
   already be tested via `expo start`, native needs assembleRelease from C:\O).
8. Demote the per-tick `Log.i("OptinixHUD", ...)` loop log to `Log.d` (or remove) before any
   public/store build — it is a diagnostic intended to stay through this debug phase.
9. Rebuild the release APK and walk the 2026-10-30 overlay reskin on RMX5313 (notch,
   quick panel, dashboard tabs, tiles) — **only after the user approves a phone build**;
   sync `modules/` to the `C:\O` mirror first when building from there (see gotchas).

## Changelog

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
