// Runs on oerhub.vercel.app. Syncs the reviewer's Supabase session into
// chrome.storage.local so the extension on OLI Torus can auto-login.
//
// Three strategies are tried in order:
// 1. Scan localStorage for any sb-*-auth-token key (works when supabase-js
//    browser client stores session there, which is the default).
// 2. Send SYNC_AUTH_FROM_COOKIES to background — background reads oerhub
//    cookies via chrome.cookies API, which can access HttpOnly tokens set
//    by Next.js middleware.
// 3. Retry after 2s in case the session is set asynchronously by the app.

import type { StoredAuth } from './types';

interface SupabaseLocalSession {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  user?: { id: string; email: string };
}

function findSessionInLocalStorage(): SupabaseLocalSession | null {
  // Try every localStorage key that looks like a Supabase auth token
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (!(key.startsWith('sb-') && key.endsWith('-auth-token'))) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? '') as SupabaseLocalSession;
      if (parsed?.access_token && parsed?.user?.id) return parsed;
    } catch { /* malformed — skip */ }
  }
  return null;
}

function findSessionInSessionStorage(): SupabaseLocalSession | null {
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (!key) continue;
    if (!(key.startsWith('sb-') && key.endsWith('-auth-token'))) continue;
    try {
      const parsed = JSON.parse(sessionStorage.getItem(key) ?? '') as SupabaseLocalSession;
      if (parsed?.access_token && parsed?.user?.id) return parsed;
    } catch { /* malformed — skip */ }
  }
  return null;
}

function saveSessionToBackground(session: SupabaseLocalSession) {
  const auth: StoredAuth = {
    access_token: session.access_token!,
    refresh_token: session.refresh_token ?? '',
    user_id: session.user!.id,
    email: session.user!.email ?? '',
    expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
  };
  // Save directly in the content script's context (no background round-trip needed)
  chrome.storage.local.set({ auth });
  // Also notify background so it has the value cached
  chrome.runtime.sendMessage({ type: 'SYNC_AUTH', payload: session });
}

function syncAuth() {
  // Strategy 1: localStorage
  const lsSession = findSessionInLocalStorage();
  if (lsSession) {
    saveSessionToBackground(lsSession);
    return;
  }

  // Strategy 2: sessionStorage
  const ssSession = findSessionInSessionStorage();
  if (ssSession) {
    saveSessionToBackground(ssSession);
    return;
  }

  // Strategy 3: ask background to read HttpOnly cookies
  chrome.runtime.sendMessage({ type: 'SYNC_AUTH_FROM_COOKIES' });
}

// Run immediately, then retry once after 2s (for async session initialization)
syncAuth();
setTimeout(syncAuth, 2000);

// Re-sync on localStorage changes (e.g. after token refresh)
window.addEventListener('storage', syncAuth);
