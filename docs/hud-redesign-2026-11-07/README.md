# Realme HUD redesign verification

Device: Realme RMX3998, Android 16 / API 36, serial `NB89CQEAFUR8TKMR`.

## Built versus installed

Latest release (22:03): **74,824,932 bytes**, SHA-256
`9F56407B054704CF97C700CFAF89959DE675856E4A272CAC7399CD08577C654E`.
It adds the thermal-status advice fix, immediate replay of already-measured Stats
graph history, and no notification-permission request when gaming is disabled.
**This final revision is not installed.** The user chose “Abhi report de do”, so
further installation/input/testing was stopped.

The phone runs the preceding lifecycle-fix revision, installed with user approval
at 20:52:54. Read-back verified the actual installed APK:

- APK bytes: **74,824,916**
- SHA-256: `8D713ADB41FD3340DCC5E0DD3CD8088267079D9129B74432857E1538345AD8EB`
- Minimum API 29, target 36, compile 37; ARM64 and ARMv7 included.
- Source and build-mirror manifests reconciled; blocked storage, kill,
  broad-package-query, boot and microphone permissions absent from the APK.

## Actual-device observations

| Check | Result / evidence |
|---|---|
| Saved Settings UI | Edge mode, 48 dp size, 100% handle opacity, idle fade enabled (`01-settings-edge.png`) |
| Landscape immersive game | Township loaded and stayed foreground; both windows visible, service still sampling every 5 s |
| Collapsed geometry | Screen 2400×1080 at 408 dpi; control frame `[2380,110][2440,222]`: 20 px visible (~8 dp), 40 px off-screen (~16 dp) |
| No automatic expansion | Runtime `expanded=false` after game launch; handle only (`03-right-handle-loaded.png`) |
| Tap / QUICK | Handle tap opened the quick card; timer, profiles and real readings visible (`04-quick-tools.png`) |
| Dashboard | QUICK's Dashboard button opened the full panel (`05-performance.png`) |
| Tabs | Perf, Tools, Optimize and Stats navigation was exercised; `05`–`07` capture the first three. Final graph-cache change is source/test verified, not device verified |
| Honest telemetry | CPU `--`; real RAM, battery-sensor temperature, battery and separately labelled 60 Hz; game FPS `--` |
| Memory review | Reported 2786.2 MB available RAM and explicitly no apps killed (`08-memory-review.png`) |
| Own-cache action | Reported 3.3 MB deleted from Optinix cache only (`09-own-cache-result.png`) |
| Stats-window flags | `FLAG_NOT_TOUCHABLE`, actual window alpha 0.8 and visible surface confirmed with dumpsys. Input-through behavior was not separately asserted |

The initial four-radius crash was fixed (eight corner values required). A second
issue was found in Usage Events: Township resumes `GPlayActivity` before the old
`Launcher` activity stops; package-only tracking incorrectly cleared the game.
The installed fix distinguishes public activity class names and timestamps, with
a 10 s query overlap for delayed OEM events. Service dumpsys diagnostics confirmed
continued samples and the correct game after full loading.

Screenshot links: [collapsed landscape state](03-right-handle-loaded.png),
[quick tools](04-quick-tools.png), [Performance](05-performance.png),
[Tools](06-tools.png), [Optimization before the final advice fix](07-optimization.png),
[measured memory review](08-memory-review.png), [own-cache result](09-own-cache-result.png).

The phone remained user-occupied. When Realme's own Game Assistant appeared,
automation stopped instead of guessing taps. The user then requested the report.

## Pending, not claimed as passed

- Minimize, inward swipe, outside-touch collapse, long-press drag, left docking,
  vertical position persistence, and controlled auto-collapse timing.
- Notification-only entry/minimize/reopen and completely Disabled stopping the
  service on the real phone (policy regressions pass on the host).
- A portrait game, HUD touch-through, FPS plate modes/corners, permission
  denial/revocation, and re-checking the Process/Startup screens on this revision.
- Android 10–15 runtime/emulator runs; no AVD/system image is installed here.
- Final revision installation and thermal/graph UI re-check.

**Temporary test preference:** Auto-collapse was changed from the phone's saved
**5 s to Never** to inspect panels. It was not restored after the user stopped
device testing. Restore it in Settings → In-game HUD → Auto-collapse → 5s if desired.
Other tested appearance preferences were left as found; no app data was wiped.

## Installer gotcha

Realme's `com.oplus.stdsp/...InstallGuideActivity` waits for **Continue installation**
after its scan. This caused both streaming and push-install commands to time out.
The app-specific prompt was confirmed under the user's approval; security settings
were not disabled. Always verify the installed base APK hash after a timeout.

Android 10–15 runtime tests are not represented by this Android 16 device run.

## 23:04 — premium gaming-assistant redesign (rail + plate)

Reference: `MeldStudio_Recording_Recording_Output_2026-11-07_at_9.34.58pm.mp4`
(63.85 s, 1920×1080, 60 fps). Stills in `ref-frames/` (`t1` rail + tools grid,
`t8` metric strip, `t16` gauges + profile segmented pills, `t44` network toggles).

**Built:** release APK **74,891,192 bytes**, SHA-256
`E499D4D26ADBEA42FE339048132625D0EA043D7149196D8E664D4DCDCE308364`, from the re-synced
`C:\O` mirror at 23:04 (`:app:assembleRelease` + `:optinix-overlay:compileReleaseKotlin`
+ JS bundle, 1 m 45 s, log `C:\O\assemble-hud-premium.log`). Copy at
`artifacts/Optinix-Premium-HUD.apk`. **Not installed — the phone still runs the
74,824,916 B build; the redesign has had no device verification at all.**

**Structure:** one overlay window = rail plate (21 stroke icons, animated sliding
indicator, auto-fitted 56–72 dp width) + content plate (fixed header with game name,
timer and minimize; 3-cell metric strip; fixed section title; scrollable body;
single-line status footer). Sections: Performance (profile segmented pills with a
confirmation sheet for Pro gamer), Performance Monitor (CPU/RAM/battery/temperature/
thermal/latency/refresh + sparklines), Tools (2×3 grid: DND, screenshot, recorder,
brightness slider, rotation lock, game capture, settings routes), Network (status hero,
measured HTTPS latency, diagnostics, DNS/Wi-Fi facts, settings routes), Optimization
(health score, thermal status, memory review, process/startup/macros deep links, honest
recommendations) and FPS HUD (enable, minimal/compact/detailed, corner, scale, opacity,
per-metric toggles).

**Honesty:** game FPS stays `--` with the Hz ≠ FPS note; profile pills change Optinix
session settings only and the copy says so; refresh-rate writes are not attempted
(Display settings route instead); no one-click boost claim; aim assist / cross-app taps /
other-app kills / other-app cache clearing / SIM switching are refused.

**Verification run on the host:** `:optinix-overlay:compileDebugKotlin`,
`:optinix-overlay:testDebugUnitTest` (**27** tests: 4 handle-geometry + 5 metrics + 4
session + 8 policy + 6 new dashboard), `:optinix-overlay:lintDebug` (0 errors),
Jest **21 suites / 106 tests**, ESLint **0/0**, release build green with only two
pre-existing deprecation warnings.

**Not verified (pending user approval):** every on-device behaviour — rail indicator,
section fades, scroll fling, panel entrance/collapse, brightness and rotation writes,
DND/screenshot/recorder, network diagnostics over Wi-Fi and mobile data, deep links,
FPS HUD override persistence, Android 10–15 runtime behaviour (lint-only), and
landscape/portrait geometry on a real screen.

---

## 2026-11-08 — device-install walkthrough + duplicate stats-HUD window fix

**Installs (user-approved each):** `install -r` of the premium build
(`E499D4D2…`, 74,891,192 B) succeeded at 10:48:31 (`lastUpdateTime`); Realme's
`com.oplus.stdsp/.extappdetail.model.scan.ui.InstallGuideActivity` "Continue
installation" prompt appeared again and timed out the adb command — the installed
hash was verified on device (`e499d4d2…`) right after. Overlay + usage permissions
retained. An instrumented rebuild (`304E2DE3…`, same size) with stop-reason logging
(`stop: screen-off receiver | startForeground refused | onStartCommand action= |
precondition destroyed=… visibility=… | destroy: session=… reason=…`) was installed
at 11:10:18 the same way.

**Walkthrough evidence (screenshots archived here):**
`w40-installed-dashboard.png`, `w42-game-handle.png`, `w43-game-handle2.png`,
`w44-install-prompt.png` (FLAG_SECURE black), `w45-app.png`, `w46-games.png`,
`w47-state.png`, `w48-games2.png`, `w49-premium-handle-stats.png`,
`w51-premium-panel-performance.png`, `w52-scrolled.png`, `w53-tap2.png`.

**Findings:**
- Township + Subway Surf show **"Unavailable"** in Games on the premium build
  (launch-intent probe failing for `com.playrix.township`, `com.firstgame.subwaysurf`
  style packages); GeForce NOW/Play Games/Level Devil/Roblox show Installed. Open item.
- First Township session died ~26 s in: `10:50:23.469 W/ForegroundServiceTypeLoggerModule:
  FGS stop call for: 10332 has no types!` right after the landscape flip, then the service
  was gone and `OplusHansManager` froze the process ~8 s later. A Level Devil session with
  the same instrumented build survived **85+ s (18 samples)** — the stop is
  Township-rotation-flow-specific, not every-game. Root cause still open; the
  instrumented build's `destroy:` log will capture it on a reproduce.
- `svc power stayon usb` is ON for the walkthrough (screen never sleeps while charging);
  reset after the test. Auto-collapse preference still **Never** (persisted).
- Premium handle over a landscape game: 25 px visible ≈ 9.5 dp, stats HUD top-left
  (Game FPS honest `--`, CPU `--`, RAM 63% real, 60 Hz). Handle tap opens the full
  rail + plate panel; six rail sections present; state-preserve re-open works
  (second tap reopened directly at the FPS HUD section).
- **Bug (reproduced):** `dumpsys window` showed **three** "Optinix stats HUD"
  windows attached (`#10`/`#11` both `[130,130]`, `#12` at `[1896,130]`) — all from
  the SAME pid/session (8474), i.e. an in-process leak, not a Realme freeze ghost.
  The stats plate also stacked on top of the panel header when the panel opened.

**Duplicate-window root cause + fix (2026-11-08):** `reconcileHud()` and
`applyFpsOverrides()` both do `fpsWindow ?: FpsHudWindow(this, store).also { fpsWindow = it }`.
`reconcileHud` runs from the main-thread sampling loop but also from module-thread
entry points (`setOverlayVisible` → `reconcileHud`); two threads read `fpsWindow == null`
concurrently → two instances → both attach a window at `[130,130]`, and each later
race overwrites `fpsWindow`, orphaning the winner's still-attached window (third
window after a corner change). Fix in `FpsHudWindow.kt`:
- every public entry point (`setSession/clearSession/applyConfig/resetCorner/show/
  hide/render`) is serialized on one companion-level `LOCK`;
- a `WeakHashMap<FpsHudWindow, LinearLayout>` registry guarantees **at most one
  attached stats-HUD view per process**: `showLocked()` first calls
  `detachOrphans()`, which removes any other instance's attached view and logs
  `stats HUD: detached an orphaned window from a stale instance`.

The stats-plate-over-panel overlap is also fixed by product decision: while the
assistant panel is expanded the stats HUD hides (the panel carries its own metric
strip) and returns on collapse. Wiring: `reconcileHud` stats condition gained
`&& !OverlayBridge.expanded`; `OverlayWindow.applyMode` dispatches a new
`action("expand")` on the HANDLE → DASHBOARD transition; service `performAction`
handles `"expand" -> reconcileHud()` and `collapse()` now ends with `reconcileHud()`
so both transitions are immediate instead of waiting for the next ≤5 s loop tick.

**Verification of the fix:** module `compileReleaseKotlin` + `testDebugUnitTest`
green (27 tests, only the two pre-existing deprecation warnings), `lintDebug`
clean, release `:app:assembleRelease` from re-synced C:\O — **74,891,192 B**,
SHA-256 `C22209D18CE27A479D89BC0BC1C4825D975A039A98FD2C3B818D4E89BB7BC2FC`,
copy `artifacts/Optinix-HudFix-20261108.apk`. Device install + single-window /
panel-open / corner tests recorded below as they run.

---

## 2026-11-08 (afternoon) — handle sized up vs Realme Game Assistant + in-panel animated Boost + handle-side control

User direction (verbatim): "mene compare karke improve karne ke liye bola h / tu khud
us side edge usko khol analyze kar improve kar / or overlay ke andar boosting wagera
wala kuch add karna taki mast animated badhia gaming ka lage". Combined with the
earlier direction: bigger handle, **default LEFT** dock, app-side side management.

**Changes (Kotlin + JS):**
- `HandleGeometry.kt`: visible sliver **8–9 → 10–14 dp** (`peekDp`: ≥72→14, ≥64→12,
  else 10) and the grip **44–64 → 56–80 dp** (`heightDp`: size×1.15 coerced 56–80).
  The 16 dp off-screen tuck stays larger than the peek (unit-tested: the sliver's
  visible intersection remains ≤ peek; new test
  `handleMaterialsSizedUpAgainstThePhoneAssistant` locks 10/12/14 and 56/64/73/80).
- `OverlayWindow.kt`: the handle's accent marker grew 2×17 → 3×22 dp so the marker
  reads at arm's length.
- Default dock stays **left** (no-pref `false` = left, already true in source); the
  phone's saved testing-time right dock is NOT silently wiped — the new app-side
  control (below) flips it in one tap (legacy-pref policy respected).
- **Handle side control (app-manageable):** Settings → In-game HUD → **Handle side**
  (Left/Right segmented). New native `setHandleSide(side)` writes BOTH
  `dockPortrait`/`dockLandscape`, `getHandleSide()` reports them; when a session is
  live the service re-docks via `window.setSide(right)` (animate), otherwise the
  prefs persist for the next session. Per-orientation hold-drag is untouched and
  still wins afterwards. Bridge: `src/native/gaming.js` `setHandleSide` /
  `getHandleSide`.
- **Animated in-panel Boost (Performance section):** new `OverlayBoostRing`
  (OverlayControls.kt): a hairline ring whose arc is the **complement of the measured
  RAM-in-use reading** (null → no arc, centre label stays honest `--`), a slow
  breathing accent halo (2.4 s loop, `reducedMotion` collapses it to a static ring),
  and a one-shot 700 ms **sweep** flash when the action is tapped ("Boost sweep"
  primary pill → service runs the boost). `OverlayTools.boost()` upgraded from a
  memory *report* to a real measured sweep: before-RAM → Optinix own-cache clean
  (`sweepCache()`, shared with `clearCache()`) → after-RAM, returning the honest
  delta string ("Other apps are protected by Android and were not touched" — still
  no kill claims). New service action `"boost"` runs it through `runTool`.
- `SettingsScreen.js`: handle side picker + updated HUD preview dims — after the
  second "pichka pichka" feedback bump these are the capsule values
  (20/22/26 peek + 68–96 dp height, 28 dp tuck); the first bump's 10/12/14 +
  56–80 numbers were superseded before install.

**Host verification:** `:optinix-overlay:compileDebugKotlin` +
`testDebugUnitTest` green (28 tests incl. the new geometry test), ESLint 0/0,
Jest 21 suites / 106 tests, `lintDebug` clean, release `:app:assembleRelease`
from re-synced C:\O — **74,892,528 B**, SHA-256
`6790666EF00333319E9804E32E62FCE78941B339F3C295AA8AC034DCF81BDB05`, copy
`artifacts/Optinix-HandlePlus-20261108.apk`.

**Install + on-device walkthrough (both bumps, user-approved each):** first
`install -r` stalled on Realme's `InstallGuideActivity` (known); the re-queued
install completed and hash-check confirmed **74,892,528 B** `6790666e…` at
12:18:21. After the second feedback round the capsule build was rebuilt
(**74,892,584 B**, SHA `fa1b8f59…`) and installed (approved in the Realme prompt;
lastUpdateTime 12:40:31, overlay permission retained, no FATAL).

Verified live on the device (screencaps `w66`–`w73`, dumps 12:19–12:56):
- **Capsule handle renders:** gaming-HUD frame `[2334,0][2471,237]`
  (~24 dp visible × ~74 dp crash-free) with the white Optinix ⊙ mark on the dark
  plate — exactly one gaming window and one stats window (`w67-capsule-handle.png`).
- **MEMORY card + boost ring in Performance** (`w66-panel.png`): ring arc +
  "FREE MEMORY 38%" from the real 62%-in-use RAM reading, "Boost sweep" pill
  rendered (bottom of plate; visible after scroll). The ring's live breathing and
  the sweep flash + measured delta string still need the user's tap (content-plate
  taps stay off the adb list — collapsed the panel twice before).
- **Panel auto-collapse gotcha (real cause found):** the phone's saved
  Auto-collapse is **5 s**, so open panels fold themselves back to the handle
  ~5 s after the last touch — repeatedly misread earlier as tap-outside bugs
  during blind-aps testing. Nothing new is broken; it is the configured behaviour.
- **Handle side = Left set through the app's own Settings** (adb-driven,
  `w73-handleside.png`): Left pill active, Handle size shows the phone's saved
  72 dp. Both `dockPortrait`/`dockLandscape` now persist left.
- Synthetic `input swipe` cannot fake the hold-drag: a horizontal sweep from the
  right edge crossed the system back-gesture zone and exited the game to the
  launcher mid-verification (session survived; launcher is foreground-neutral).
  Real-finger left-dock check is therefore still pending — the host test locks
  the geometry, and the app-side Left pref is in place for the next session.

Overnight the device went to the lock screen (04:38, battery fully charged) and
the overlay service stopped with the USB session drop, so the left-docked frame
and Boost-sweep taps remain the two open items; everything else above is
device-verified.

---

## 2026-11-08 (evening) — build pipeline repaired + two robustness fixes

A host-only pass; nothing was installed and no device behaviour changed.

**`scripts/build-android.js` — root cause found.** Every run on this PC died with
`'gradlew.bat' is not recognized as an internal or external command`. The machine exports
`NoDefaultCurrentDirectoryInExePath=1`, so `cmd /d /c gradlew.bat` is not allowed to search
the working directory. The script now launches the absolute `…\android\gradlew.bat` path
(quoted if it contains spaces). Result: a full release build from the repo root succeeds in
**2 m 36 s**, so the C:\O mirror is no longer needed just to produce an APK.

**Missing `hermesc.exe`.** Once Gradle ran, `:app:createBundleReleaseJsAndAssets` failed with
`'…\node_modules\hermes-compiler\hermesc\win64-bin\hermesc' is not recognized`. That
directory contained every DLL but no executable. Restored the binary from the same package
version in the mirror; if it disappears again, check antivirus quarantine.

**Rotation kept the panel but lost its place.** `OverlayWindow.reconfigure()` (configuration
change) rebuilds the window; the section already survived, the scroll offset did not. It now
captures `scrollY` before the rebuild and restores it afterwards.

**Discovery could wipe "Installed".** `appsNative.getInstalledApps` goes through `safeCall`,
which returns `[]` on any native error; `mergeDiscovered` then set `installed: false` for
every saved game — which is one plausible cause of the Township/Subway Surf "Unavailable"
observed on device. `discoverGames()` now throws "Android returned no launchable apps, so
your library was left unchanged" and writes nothing (+1 Jest test). The `<queries>`
MAIN/LAUNCHER intent **is** present in the merged manifest (checked with
`aapt2 dump xmltree`), so package visibility is not the cause; a genuinely missing package
still correctly reads Unavailable.

**Verification:** overlay `testDebugUnitTest` **28** (4+5+4+9+6; earlier "27" notes missed
the 2026-11-08 geometry test), Jest **21 suites / 107 tests**, ESLint 0/0, release
**74,892,792 B**, SHA-256
`C9ECA825C1998FE5E8D1B8AAA39BAF936874668082776A153B573B1B6BA973E6`, built from the repo
with the repaired script (log `build-script-check.log`). Copy:
`artifacts/Optinix-Premium-HUD.apk`. **Not installed** — the phone still runs the
74,824,916 B build and needs approval for any install.

---

## 2026-11-09 (evening) — HUD+ polish pass built from the user's side-by-side (installed, hash-verified)

The user put the Realme Game Assistant and Optinix side by side on screen and
asked for "bhot zyada improvement" plus three concrete fixes: the handle on the
LEFT with much better visibility ("uski opacity bhi kam h"), an overall panel
upgrade, and the FPS stats HUD disabled by default. Side-by-side evidence:
`w80-left.png` (our panel) vs `w82-now.png` + 5 phone screenshots of the
assistant handle/rail (2026-11-09 ~17:16).

**Kotlin overlay changes (modules/optinix-overlay):**
- `OverlayGauge` (new, OverlayControls.kt): a large measured ring with the
  reading centred inside, styled after the assistant's circular gauges. The
  caller passes fraction AND label, so ring and number can never disagree,
  and unmeasured stays an empty ring with "--". Static soft halo — no second
  breathing animation in the panel.
- `OverlayMeterBar` (new): a thin measured-level bar under a metric value
  (the fill IS the displayed number mapped to a range; null → empty track).
  Used on the cpu/ram/temp/battery metric tiles (`METER_TILE_KEYS`).
- Monitor section grew a hero card with two 72 dp CPU/RAM gauges whose values
  equal the tile values; monitor note trimmed, honesty kept.
- Metric quick-strip gained a 4th `BATTERY` cell (real reading, ⚡ while
  charging).
- Boost ring enlarged 46 → 52 dp.
- `fit()` reserves 176 dp instead of 228 dp, so the landscape scroll body is
  ~44 dp taller (it had been squeezed to ~132 dp).
- Idle dim of the collapsed handle reduced 0.5× → 0.78× of its normal
  opacity — the user repeatedly read the old dim as broken visibility.
- Seven long honest notes trimmed to 1–3 lines (memory, modes, tools,
  network, optimize, monitor, FPS notes) — meaning kept, density down.

**Handle geometry (HandleGeometry.kt + test + Settings copy):** the user
showed the assistant's tall left capsule and called ours too short again, so
`heightDp` is now `size×1.75` clamped **88–126 dp** (was ×1.3 → 68–96 dp).
Peek stays 20/22/26 dp, off-screen tuck 28 dp (still > peek, test-locked).
Updated: OverlayCompatibilityTest, SettingsScreen HUD preview height and the
handle-size caption.

**FPS stats HUD "disable by default":** verified in source that the default
is already `false` everywhere (`preferences.js` line 42,
`gaming.js` `=== true`, native `optBoolean("fpsHudEnabled", false)`, service).
The phone showed the stats plate because its SAVED pref was ON from an earlier
walkthrough — to be turned OFF through the app's own Settings in the device
walkthrough below (genuine pref change, no code needed). Device pref action
was still pending when the phone auto-locked.

**Left side:** the fresh default (`docked()` false) is the left edge, and the
phone's portrait/landscape prefs persist Left from the app-managed setting.

**Build pipeline gotcha (new):** `:app:assembleRelease` from the repo root now
fails in `react-native-gesture-handler:buildCMakeRelWithDebInfo[arm64-v8a]`
with `ninja: error: ... Stat(...react-native-workletsConfigVersion.cmake):
Filename longer than 260 characters`. Deleting the `.cxx` tree and rebuilding
from a `C:\OA` junction did NOT help — Gradle canonicalizes the node_modules
path, so the embedded absolute path is still > 260. Working fix (recorded for
next time): robocopy /MIR `src modules plugins scripts assets __tests__` +
root configs (`package.json`, `package-lock.json`, `app.json`, `App.js`,
`index.js`, `jest.setup.js`, `babel.config.js`, `metro.config.js`, `.env`) to
`C:\O`, then `npm install` IN THE MIRROR (its node_modules predated the
2026-11-09 AdMob integration and lacked `react-native-google-mobile-ads`),
then `:app:assembleRelease "-PreactNativeArchitectures=arm64-v8a,armeabi-v7a"`
from `C:\O\android` (4 m 05 s, log `assemble-hudplus2.log`).

**Install (user-approved, second attempt):** first attempt timed out and the
user accidentally cancelled the Realme prompt →
`INSTALL_FAILED_VERIFICATION_FAILURE`; the re-queued install completed with
`Success`. Release copy: **84,366,200 B** (size grew ~9.5 MB with the AdMob
SDK), SHA-256
`435E0BF01E8C28635B66C2065B8C4781750C7B9BBDB176A82EE5A979BE280115`,
**installed** and hash-verified via `pm path` + `sha256sum` (`435e0bf0…280115`
matches the APK byte-for-byte), `lastUpdateTime 2026-11-09 17:54:54`.

**Host verification:** `:optinix-overlay:compileDebugKotlin` +
`testDebugUnitTest` green (28 tests incl. the updated three-pass handle
history assertions), Jest **24 suites / 126 tests**, ESLint 0/0.

**Device walkthrough (pending):** the phone auto-locked to the PIN lockscreen
right after the launch smoke check, so the on-screen confirmation of the new
taller left capsule, the gauges/meter bars, and the stats-HUD pref switch are
still to be captured; nothing above is claimed as device-verified beyond the
install hash.
