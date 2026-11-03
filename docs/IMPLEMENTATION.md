# Premium Android implementation record

Started 2026-10-24. All source changes and artifacts belong to Android-Optimizer.
PC-Optimizer/desktop/src/index.css was read only as the brand reference.

## Design foundation

Palette: carbon `#06070a`, base plate `#0b0d12`, raised graphite `#101319`, cyan key
light `#2ee6cf`, blue data `#5b9dff`, violet atmosphere `#9b7bff`. Amber/red carry
status meanings. Card radius 16; control radius 10; primary touch targets at least 48dp.

Type: Plus Jakarta Sans for display (same as the PC), Inter for UI, existing JetBrains
Mono for measured numbers (OFL-compatible mobile substitute for the PC's system Cascadia
Mono). Fonts are bundled; no runtime font requests.

Layout: a left-aligned gaming home with one dimensional game cartridge/cover focal point,
an actionable library beneath it, and a quiet instrument strip. Retain the five navigation
destinations; secondary stack routes hold Network Intelligence, Macro Studio, profiles,
gaming tools and session history.

```
Home / Game Space                   Native HUD
Optinix             settings       edge handle + chosen shortcut dock
Featured installed game            game / selected profile / dismiss
icon + original cover geometry      Overview | Perf | Tools | Stats
Launch / configure profile          touch-sized controls / stop macro
Measured device strip               explicit metric provenance
Library / tools / recent sessions   short scrollable content in landscape
```

Brief review: avoid a wall of identical neon cards. Game covers own the atmosphere;
metrics use restrained rows/graphs; controls use solid cyan. Existing 3D orb remains
available on the dashboard, paused off-screen and disabled under reduced motion or
battery-conscious mode. New secondary screens do not start more GL loops.

## Stages and evidence

| Stage | Status | Evidence |
| --- | --- | --- |
| A Audit | Complete | docs/FEASIBILITY.md; baseline Jest 35/35 |
| B Design foundation | In progress | Shared tokens and mobile primitives |
| C Game Space | Pending | Library, profiles, sessions |
| D Overlay | Pending | Native window/lifecycle and dock |
| E Utilities | Pending | DND, timer, capture/display |
| F Macros | Pending | Validated bounded utility sequences |
| G Intelligence | Pending | Diagnostics/history, safe audits |
| H Verification | Pending | JS/native/release/device checks |

Only record checks as passed after running them. Runtime permission/secure-screen/device
behavior must be reported separately from unit tests and successful APK compilation.
