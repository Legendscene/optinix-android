# Android feasibility and permission contract

Audited 2026-10-24, before system-feature implementation. Application: Expo SDK 58,
React Native 0.88 / React 19, three local Kotlin Expo modules, minSdk 24,
compileSdk 37, targetSdk 36, package `net.exitpoint.optinix`.

## Feasibility matrix

| Feature | Android / access | Supported method | OEM variance and fallback | Ordinary app? |
| --- | --- | --- | --- | --- |
| Game library | 24+; launcher-intent package visibility on 30+ | Query MAIN/LAUNCHER activities, category GAME (26+) or labeled heuristic; user-selected additions | Categories can be missing; manual launcher picker. Saved but absent entries are unavailable | Yes; no QUERY_ALL_PACKAGES |
| Game launch / profiles | 24+; no special access for launch | Launcher intent; persist per-game Optinix settings; report each setting separately | OEM performance settings require user action | Yes for app-owned settings; no CPU/GPU overclock or other-game mode control |
| Foreground game detection | 24+; optional Usage Access | UsageEvents, resumed/paused transitions, only during an explicitly started gaming session | Restricted/OEM-redacted events return unknown; launcher-selected game is labeled as selected, not verified foreground | Conditional |
| Floating HUD | 26+ TYPE_APPLICATION_OVERLAY; 24–25 TYPE_PHONE; explicit overlay Settings grant | One non-focusable, touchable window; bounded edge docking, non-sticky foreground service | Games can hide overlays; permission denial leaves in-app tools usable | Yes |
| Foreground execution | 26+ notification channel; 34+ specialUse declaration; 35+ tighter background starts | Start from visible user action before launching the game; ongoing Stop action; no boot auto-start | OEM process kills end the session; interrupted history is labeled and never silently restarted | Conditional; Play specialUse declaration/review required |
| Notifications | 33+ POST_NOTIFICATIONS | Ask when enabling session notifications/HUD, not at startup | Denial: visible in-app/overlay status; Android still shows FGS in task manager | Yes |
| DND | 29+ notification-policy access | An Optinix-owned AutomaticZenRule with setAutomaticZenRuleState; disable only this rule | Other rules/user DND can remain active; 24–28 open system DND settings | Conditional; no global DND reset |
| Session timer / breaks | 24+; notifications only for reminders | Monotonic elapsed time in the existing gaming service; pause/resume/stop; quiet reminders | Process death records interrupted session; no exact-alarm claim; stopped/locked sessions stop work | Yes |
| Screenshot / recording | MediaProjection 21+ (project 24+); fresh system consent every capture; mediaProjection FGS on 29+/typed permission 34+ | Consent activity → dedicated capture service → ImageReader / MediaRecorder; visible stop; MediaStore on 29+, private file/share on 24–28 | Secure content remains black; no bypass; audio intentionally off; rotation may letterbox recording | Yes with per-session consent |
| Brightness/display | 24+; system Settings intent | Open display/brightness controls; no WRITE_SETTINGS needed | Per-game/global brightness is left to the system settings UI | Yes as a truthful shortcut |
| Macro configuration | 24+; no special access | Local editor, categories, CRUD, bounded repeats and delays, schema validation | Restorable drafts; invalid configurations rejected | Yes |
| Macro execution | 24+; explicit enable and Start | Native bounded utility sequence: delay, haptic, session marker, timer controls, own DND rule; Stop in app, HUD and notification | No input injection. Arbitrary taps/swipes require a separate, prominently disclosed AccessibilityService plus policy review | Yes for listed utility actions; cross-app input unavailable in this build |
| RAM/storage/battery | 24+; no special access | ActivityManager.MemoryInfo, StatFs, BatteryManager; available fields nullable | Missing battery properties/read failures show --, not zero | Yes |
| Thermal | PowerManager status 29+; accessible sensors optional | Thermal status plus battery temperature with source label | Protected CPU/GPU thermal files return null; no cooling control | Conditional |
| CPU / FPS / display | Accessible CPU sources only; display API; app Choreographer | CPU deltas if readable, per-core clocks if available, display Hz, app-only frame rate | Modern Android often blocks /proc/stat; no another-game FPS source | Conditional; game FPS unsupported |
| Memory/cache optimization | 24+ | Memory/storage audit and per-app settings; count successfully deleted own-cache file bytes | Android 14+ killBackgroundProcesses cannot kill other apps; no process-kill optimization on older versions either | Yes for audit/own cache, no other-app cache clearing |
| Network diagnostics | 24+ INTERNET/ACCESS_NETWORK_STATE | User-triggered HTTPS HEAD samples, monotonic time, DNS lookup, connection metadata, locally retained results | HTTP failure ratio is not IP packet loss; DNS can be cached; SSID/location-sensitive fields withheld | Yes; no VPN, routing, DNS/proxy mutation |
| Usage/storage recommendations | 24+ optional usage access; StorageStats 26+ | User-triggered queries scoped to launchable/user-selected packages | Foreground usage is not background CPU evidence; protected stats return unavailable | Conditional |

## Architecture decisions

- Keep React Native UI, existing engines, tokens, charts and native modules. Add screens
  through the existing navigation, not a replacement application.
- Kotlin owns active gaming sessions, overlay, utility macros and their cancellation.
  The existing gaming foreground service has one loop; screen capture has a separate,
  correctly typed service only while capture is active.
- AsyncStorage owns library/favorites/profiles/macros/preferences. Native SharedPreferences
  owns overlay position, app-owned DND rule id, bounded session history, and mirrored
  configuration required while JavaScript is suspended.
- Monitoring is foreground/lifecycle-aware. Foreground detection runs only in an explicitly
  enabled gaming service; no boot receivers or permanent background JS polling.
- Macro execution deliberately uses no AccessibilityService: utility automation is useful
  without access to another app's screen/input. A gaming utility is not an accessibility
  tool, and adding input injection would require separate consent/distribution review.
- No telemetry upload, game artwork scraping, location request, microphone capture, broad
  storage access, or unrestricted installed-package enumeration. Icons are obtained locally
  to identify launchable games; decorative cover art is original Optinix geometry.

## Audit findings to correct

1. Existing boost counted API calls as killed processes and cache cleanup counted bytes
   before verifying deletion. Neither is an honest success result.
2. Existing JS monitor and foreground polling continued while backgrounded; old FPS/ping
   could be carried forward after a failed sample.
3. Overlay had 8sp controls, unbounded dragging, no notification Stop, no lifecycle-aware
   screen-off handling, and did not actually apply live opacity/expanded configuration.
4. Native CPU reads can be denied on the Realme; this must remain unavailable, never inferred
   from RAM, panel refresh rate, or animation timings.
5. Generated source build still had R8 enabled although the last disposable build disabled
   it. Persist required build properties in an Expo config plugin.

## Official sources consulted

Direct developer.android.com fetching failed in the web tool; primary content was read
through the Jina text transport (and curl with an article-body selector), not third-party
booster marketing claims.

- https://developer.android.com/games/gamedashboard/aboutdashboard
- https://developer.android.com/games/gamedashboard/components
- https://developer.android.com/games/optimize/adpf/gamemode/gamemode-api
- https://developer.android.com/games/optimize/adpf
- https://developer.android.com/about/versions/15/behavior-changes-15
- https://developer.android.com/about/versions/14/behavior-changes-all
- https://developer.android.com/guide/topics/ui/accessibility
- https://developer.android.com/develop/ui/views/notifications
- https://developer.android.com/media/grow/media-projection
- https://developer.android.com/training/package-visibility/declaring
- https://support.google.com/googleplay/android-developer/answer/10964491

Play distribution still requires the developer's actual foreground-service declaration and
review; successful local compilation is not a Play policy approval.
