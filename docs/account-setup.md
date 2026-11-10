# Optional account and settings sync

The Android build includes email registration/sign-in, verification-aware signup,
reset/change password, Google and Discord browser OAuth, a persistent local session,
account/provider management, sign-out and account deletion. Offline use requires no
account. Unconfigured builds show an unavailable state.

**2026-11-09 status:** the build's `.env` carries the real project URL +
publishable key (`jxxgyhcijdqzqxysztxa.supabase.co`). The `/auth/v1/settings`
probe that day showed **only `email: true`; both `google` and `discord` are still
switched OFF on the project**, so tapping those buttons in the app now shows an
honest "setup needed" state instead of opening a bare Supabase error page. The
one-time dashboard steps below turn them on; the app needs no rebuild.

## Build environment

Copy `.env.example` to `.env` and set only:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

`VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` are accepted aliases by the
client factory, but Expo bundles the `EXPO_PUBLIC_*` values. For a `C:\O` build,
copy the public `.env` to that mirror before bundling. Do not put service-role,
database, OAuth client secrets or bot tokens in the client environment.

## Turning Google + Discord on (the current missing step)

All of this lives in the Supabase dashboard → **Authentication → Providers**.
Client **IDs** are public; the **secrets belong only in these dashboard boxes**
(never in the repo, `.env`, or this doc — the values are in the user's local
`configurations.txt` at the workspace root).

1. **Redirect allowlist** (Authentication → URL Configuration):
   add `optinix://auth/callback` (the app deep link) plus the production web
   URL if any. Without this entry, Supabase silently falls back to the Site
   URL and the sign-in never lands back in the app.
2. **Google**:
   - Client ID: `319840507430-tk876ehkc4qm14u0080q2qolusd6d7l7.apps.googleusercontent.com`
     (project `ardent-window-471807-a6`; the Google Cloud console web client).
   - Paste the matching **client secret** from `configurations.txt`.
   - In the Google Cloud console, the **authorized redirect URI** for this web
     OAuth client must include
     `https://jxxgyhcijdqzqxysztxa.supabase.co/auth/v1/callback`
     (Supabase renders the exact string on its provider page; copy it verbatim).
   - Save → provider flips to enabled; the app's pre-flight check
     (`/auth/v1/settings`) shows Google "Ready" the next time the screen loads.
3. **Discord**:
   - Client ID: `1567558319051116735`.
   - Paste the application's **client secret** from `configurations.txt`.
   - In the Discord developer portal (this application: `Optinix`, app id
     `1567558319051116735`) → OAuth2 → add redirect
     `https://jxxgyhcijdqzqxysztxa.supabase.co/auth/v1/callback`.
   - Save. (The Discord **bot token** is unrelated to login — leave it out of
     the app entirely.)
4. **Email** is already enabled with confirmation required — verification and
   reset flows work once the project's mail sender actually delivers.

## Supabase project setup

1. Apply `supabase/migrations/0001_optinix_accounts.sql` to the intended project.
   It creates profiles, settings, device and sync-history tables with RLS tied to
   `auth.uid()` and user-deletion cascades.
2. Add `optinix://auth/callback` to permitted redirects. Configure email confirmation
   and a working mail/SMTP sender. Test verification and password reset delivery.
3. Enable Google and Discord in Auth providers (see the list above). Keep their client secrets in the
   Supabase dashboard; register Supabase's HTTPS auth callback at each provider.
4. Deploy the `delete-account` Edge Function. Its service-role credential belongs
   only in the function environment. It verifies the caller's JWT before deleting
   that user; the app never chooses the deletion target by a supplied user ID.
5. Test with two separate accounts that each can read/write only its own settings,
   devices and history. Exercise sign-in, cold-start session restore, explicit
   identity linking/unlinking and deletion on the configured project.

The app contains no email-based account-merge routine. Supabase controls its own
identity-linking policy; validate that server policy before claiming accounts with
matching provider emails remain separate.

## Synced data

Allowlisted theme (mode/accent/density/**motion**/haptics), HUD/visibility, gaming
preferences, library/profiles and utility macros are sanitized on restore.
Credentials, live telemetry, capture files, diagnostic history and native handle
coordinates are not uploaded. Cold-start hydration prevents defaults overwriting
cloud state; conflicting revisions ask for a cloud/device choice, and the Account
screen states plainly what a restore loaded. Restored macros remain data and
require a user action to run.

## Verification boundary

Callback parsing, sync schema/merge rules and the client bundle have host checks.
Real email delivery, OAuth-provider sign-in, RLS isolation and Edge Function
deployment require the configured project and user accounts; these are not claimed
as verified by the Android overlay walkthrough. The provider probe parsing is
unit-tested (`__tests__/oauthProviders.test.js`); the live `/auth/v1/settings`
answer observed 2026-11-09 was google/discord disabled.
