// Optinix — delete-account Edge Function.
//
// WHY an Edge Function: Supabase Auth has no client-privilege "delete me".
// Only the service_role key (server-side secret, never bundled in the app)
// can call auth.admin.deleteUser(). The app sends its normal user JWT — the
// function verifies it and deletes ONLY that verified user. No client-
// supplied user id is ever trusted.
//
// Deploy:  supabase functions deploy delete-account --project-ref <ref>
//          (then note the project ref for yourself; the app calls it by name)
//
// curl-ish contract: POST {SUPABASE_URL}/functions/v1/delete-account
//   Authorization: Bearer <user JWT>  (sent automatically by supabase-js
//   functions.invoke)
//
// Cascade cleanup: profiles / user_settings / devices / sync_history rows
// all reference auth.users(id) ON DELETE CASCADE (migration 0001), so the
// auth-admin delete clears personal data in one shot.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Secrets come from function env vars, configured in the dashboard —
  // never in this repo's client code.
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  const url = Deno.env.get('SUPABASE_URL')

  if (!serviceKey || !url) {
    return json({ error: 'Server configuration missing (service key). Nothing was deleted.' }, 500)
  }

  // 1) Verify the CALLER's JWT against the public API — never trust the body.
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Missing session token.' }, 401)
  }
  const anon = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: authData, error: authError } = await anon.auth.getUser()
  if (authError || !authData?.user) {
    return json({ error: 'Session token was not accepted.' }, 401)
  }

  // 2) Admin delete of exactly the verified user (RLS bypass server-side,
  //    FK ON DELETE CASCADE wipes their rows).
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: deleteError } = await admin.auth.admin.deleteUser(authData.user.id)
  if (deleteError) {
    return json({ error: `Account deletion failed on the server: ${deleteError.message}` }, 500)
  }

  return json({ deleted: true, user_id: authData.user.id })
})

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
