# Android 10–16 compatibility and gaming HUD

Supported OS range: **Android 10 / API 29 through Android 16 / API 36**.

## Build contract

`plugins/withOptinixAndroid.js` writes `android.minSdkVersion=29`,
`android.targetSdkVersion=36`, and `android.compileSdkVersion=37` on prebuild.
The generated source build and the disposable `C:\O` mirror use those properties.
Compile SDK 37 does not require Android 17 on a phone; runtime access to newer APIs
is guarded. No `tools:overrideLibrary` is used to bypass dependency minimums.
`scripts/build-android.js` defaults release builds to ARM64 + ARMv7; debug defaults
to ARM64. `OPTINIX_ANDROID_ABIS` accepts explicit validated architecture choices.

Inspected dependencies: Expo 58.0.17, React Native 0.88.0 (its checked-in SDK catalog
has minimum 24 / target 36 / compile 37), Expo Modules Core, Reanimated 4.7.1,
Worklets 0.13, gesture handler, screens, SVG, GL, AsyncStorage and the native auth
plugins. The three Optinix modules inherit the Expo root SDK settings. The release
manifest merge and AAR metadata checks must pass at API 29.

## Runtime matrix

| Feature | Android 10–11 | Android 12–16 | Limit / fallback |
|---|---|---|---|
| Control HUD | `TYPE_APPLICATION_OVERLAY`, user-granted overlay access | Same; obey foreground-start restrictions | Denied/revoked permission hides windows; in-app controls remain available |
| Android 10 Go | Read overlay permission and public low-RAM capability | OEM policies still apply | Go/low-memory builds may prohibit overlay access. Explain the restriction and keep tools/notifications usable. Low-RAM alone is not proof of Go branding |
| Display geometry | API 29: `Display.getRealSize`, stable insets and display cutout | API 30+: window metrics and type-based insets | Full-screen handle stays at the physical edge; expanded panels fit safe bounds |
| Edge handle | Public `WindowManager`, touch events and long-press timeout | Same | 8–10 dp peek, 16 dp outside, 44–64 dp height; hold then drag, snap, per-orientation saved position |
| Stats HUD | Non-touchable overlay with requested window alpha | API 31+: window alpha capped at `InputManager.maximumObscuringOpacityForTouch` | View alpha alone does not satisfy Android's touch-through rule |
| Notifications | Read notification/channel enablement; no runtime POST request | API 33+: request `POST_NOTIFICATIONS` and also check channel | Blocked notification-only entry explains how to enable it; Gaming tools can also request reopen |
| Session service | Public foreground service with explicit `NONE` type, visible-screen start | API 34+: explicit `specialUse` service type | Do not pass the future manifest special-use bit to API 29–33; no boot/background auto-start |
| Screenshot / video | Consent + media-projection foreground service; legacy `MediaRecorder()` | API 31+: context constructor; API 33+: typed intent extra | Fresh consent each time; silent video, 10-minute limit. Protected content may be blank; encoder failure reported |
| DND | API 29 `AutomaticZenRule` + `ZenPolicy` and policy access | Same app-owned rule, compatible with newer Modes | Permission/manual action states; never claims the whole system's DND state |
| CPU | Optional accessible `/proc/stat` delta | Same | Often blocked by the OEM/kernel; unavailable or first sample is `null` → `--` |
| RAM | `ActivityManager.MemoryInfo` | Same | Device-level, not per-app memory |
| Temperature | Optional readable thermal files, then battery sensor | Same | Actual sensor source shown; unavailable → `--` |
| Thermal status | API 29 `PowerManager.currentThermalStatus` | Same | Catch vendor failures; no invented status |
| Battery / Hz | Battery broadcast, `DisplayManager` refresh rate | Same | Missing → `--`; Hz is never game FPS |
| Process Manager | UsageStats history + App info / app-management settings | Same; Android 14+ background-kill API is self-only | Not a list of live processes. No extra kill permission. On 10–13 a background-kill request cannot force-stop or prove lasting savings |
| Startup Manager | Resolve exported, enabled vendor activities using PackageManager | Same plus scoped package-visibility queries (API 30+) | No universal autostart API. Generic OEM management page is identified as such; per-app state is not invented |
| UI / account | React Native UI, ordinary native drawables, system-browser OAuth | Same | Missing browser/native/cloud configuration gets an explicit error; authentication is optional |

## Visibility contract

- **Edge handle:** never auto-expands on game launch. Tap opens quick tools; an
  inward swipe opens the full dashboard. Long-press, then drag to reposition.
- **Notification only:** no handle or stats plate until **Show game HUD** is
  explicitly requested. Minimize, outside touch, auto-collapse, or leaving the game
  hides it again. Notification entry cannot revive an ended session.
- **Completely disabled:** ends the gaming service, session timer and both windows.
  Games can still launch without starting a session. Changing back allows the next
  user-started session; it does not restart one in the background.
- Handle opacity, size, visibility and auto-collapse are persistent preferences.
  Dock/height are local native preferences, independently saved for portrait and
  landscape. In-HUD opacity and stats-enable overrides are session-only.

## Control audit

| Control | Actual effect |
|---|---|
| Profile presets | Change Optinix sampling, reminders, HUD and requested DND; not CPU/GPU/game settings |
| Stats on/off | In-memory session override, never overwrites the saved default |
| HUD appearance | Opens Optinix Settings for the saved HUD configuration |
| Brightness / refresh rate | Opens system Display settings; no cross-app brightness/Hz promise |
| Network settings | Opens Android wireless settings |
| Test network | Three user-requested HTTPS samples; not game-server ping. No fake packet-loss figure |
| Review memory | Reads available RAM; closes nothing |
| Clear Optinix cache | Deletes only owned cache files and reports actual deleted bytes |
| App management / battery | Public system settings intents with caught OEM failures |
| DND | Requests/releases only the Optinix-owned rule or routes to policy access |
| Screenshot / record | Android media-projection consent and real capture; Stop releases it |
| Timer / macros | Pause/resume actual session clock; finite user-started utility sequences only |
| Minimize / outside / timeout | Collapse according to the chosen visibility mode |
| Close | Stop the session and its tools |
| Dock left/right / reset | Persist/reset position; no opaque full-screen touch surface |

## Unsupported on Android 10 (also unsupported on later ordinary installs)

- Other apps' real FPS, frame time, per-app CPU/RAM, CPU/GPU clock control,
  cross-app touch automation, silent force-stop or other apps' cache deletion.
- Overlay windows on Go/OEM builds that do not allow overlay permission.
- A universal per-app auto-start switch, direct refresh-rate override for a game,
  recording of protected screens, and microphone capture (not requested).

## Verification

- Jest: **21 suites / 106 tests**, all passed.
- Native unit tests: **21**, all passed (timer/network/session contracts, geometry,
  visibility policy, foreground lifecycle and honest thermal advice).
- ESLint: **0 errors / 0 warnings**. Native lint at minimum API 29: **0 errors and
  0 NewApi/InlinedApi violations** in all three modules. Existing/style warnings
  remain: apps 8, device 1, overlay 91; native lint is not warning-free.
- Release: `assembleRelease` succeeded from `C:\O`, final pass **1 m 44 s**.
  APK metadata confirms minimum **29**, target **36**, compile **37**, ARM64 and
  ARMv7. The merged APK excludes the blocked storage, microphone, boot,
  broad-package-query and background-kill permissions.
- Final APK: **74,824,932 B**, SHA-256
  `9F56407B054704CF97C700CFAF89959DE675856E4A272CAC7399CD08577C654E`.
  Build output: `C:\O\android\app\build\outputs\apk\release\app-release.apk`.
- Physical evidence: Realme RMX3998 / API 36. Handle geometry, tap → quick →
  dashboard, tab navigation, measured values, memory review and own-cache cleanup
  were exercised. See [device results and screenshots](hud-redesign-2026-11-07/README.md).
- The installed phone revision is the preceding **74,824,916 B** lifecycle fix.
  The final thermal/graph/disabled-permission revision was built but **not
  installed**: the user requested the report instead of further device checks.

API 29–35 runtime/emulator testing is **not claimed**. No AVD/system image is
installed on this machine. Successful lint/manifest merge is compatibility
engineering evidence, not proof of every OEM/runtime combination. Go permission
denial and the pending physical interaction tests remain in the device checklist.

Build/check logs are in `%LOCALAPPDATA%\Temp\opencode\hud-final-release.log` and
`hud-final-checks.log`. These releases still use the project's existing debug
signing key; they are test APKs, not a production store-signing setup.
