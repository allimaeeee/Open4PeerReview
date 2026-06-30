// Runs on the OER Hub dashboard. Syncs the reviewer's Supabase session into
// chrome.storage.local so the extension on OLI Torus pages can auto-login.
// @supabase/ssr stores sessions in cookies (not localStorage), so we read
// from document.cookie. Supabase SSR may split large cookies into chunks.

import type { StoredAuth } from './types';

const SUPABASE_REF = 'lbmyfqeqkpmohlumlkdg';
const COOKIE_BASE = `sb-${SUPABASE_REF}-auth-token`;

interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email: string };
}

function parseCookie(name: string): string | null {
  const prefix = name + '=';
  for (const part of document.cookie.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}

function getSupabaseSessionStr(): string | null {
  // Try un-chunked cookie first
  const single = parseCookie(COOKIE_BASE);
  if (single) return single;

  // Supabase SSR chunks large cookies: sb-{ref}-auth-token.0, .1, ...
  let result = '';
  let i = 0;
  while (true) {
    const chunk = parseCookie(`${COOKIE_BASE}.${i}`);
    if (!chunk) break;
    result += chunk;
    i++;
    if (i > 10) break; // safety cap
  }
  if (result) return result;

  // Fall back to localStorage (standard supabase-js client)
  return localStorage.getItem(COOKIE_BASE);
}

function syncAuth() {
  const raw = getSupabaseSessionStr();
  if (!raw) return;

  let session: SupabaseSession;
  try {
    session = JSON.parse(raw) as SupabaseSession;
  } catch {
    return;
  }

  if (!session.access_token || !session.user?.id) return;

  const auth: StoredAuth = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    user_id: session.user.id,
    email: session.user.email,
    expires_at: session.expires_at,
  };

  chrome.storage.local.set({ auth });
}

// Sync immediately on page load and whenever cookies change
syncAuth();

// Storage event fires when another tab updates localStorage (supabase-js standard client)
window.addEventListener('storage', (e) => {
  if (e.key === COOKIE_BASE) syncAuth();
});

// Re-sync every 30s to catch cookie-based session refreshes
setInterval(syncAuth, 30_000);
