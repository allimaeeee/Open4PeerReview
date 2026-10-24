// Convenience re-exports so imports like `@/lib/supabase` work.
// (Some parts of the app still expect these legacy helper names.)

export { createClient as createBrowserSupabase } from './client'
// NOTE: do NOT export server helpers from this barrel.
// Client Components importing `@/lib/supabase` would pull in `./server`,
// which depends on `next/headers` (server-only) and breaks the client bundle.

