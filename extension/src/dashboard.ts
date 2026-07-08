// Runs on the OER platform (production, preview, or localhost). Syncs the
// reviewer's Supabase session into chrome.storage.local so the extension on
// OLI Torus can auto-login.
//
// On every page load (stampPlatformUrl): stamps the current platform origin onto
// whatever auth is already in storage — captures platformUrl even for sessions
// that were stored via oer_token or a previous login (which carry no origin).
//
// syncAuth() additionally tries to refresh the full session using:
// 1. Scan localStorage for any sb-*-auth-token key.
// 2. Scan sessionStorage for the same.
// 3. Ask background to read HttpOnly cookies via chrome.cookies API.
// 4. Retry after 2 s in case the session is set asynchronously.

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

// Stamps the current platform origin onto whatever auth is already in storage.
// Runs on every platform page load so platformUrl is always current, regardless
// of whether a fresh session can be extracted from localStorage/cookies.
function stampPlatformUrl() {
  const origin = window.location.origin;
  chrome.storage.local.get('auth', (result) => {
    const existing = (result as { auth?: StoredAuth }).auth;
    if (existing?.access_token) {
      chrome.storage.local.set({ auth: { ...existing, platformUrl: origin } });
    }
  });
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
  chrome.storage.local.set({ auth: { ...auth, platformUrl: window.location.origin } });
  // Also notify background — background uses sender.origin to stamp platformUrl independently
  chrome.runtime.sendMessage({ type: 'SYNC_AUTH', payload: session });
}

function syncAuth() {
  // Strategy 1: localStorage
  const lsSession = findSessionInLocalStorage();
  if (lsSession) { saveSessionToBackground(lsSession); return; }

  // Strategy 2: sessionStorage
  const ssSession = findSessionInSessionStorage();
  if (ssSession) { saveSessionToBackground(ssSession); return; }

  // Strategy 3: ask background to read HttpOnly cookies
  chrome.runtime.sendMessage({ type: 'SYNC_AUTH_FROM_COOKIES' });
}

// Runtime guard: *.vercel.app is necessarily broad in the manifest, so narrow it
// here. Only sync auth if we're actually on a known OER platform origin.
const ALLOWED_PLATFORM_HOSTNAMES = ['open4peerreview-olitorus.vercel.app', 'localhost'];
const PREVIEW_PLATFORM_RE = /^open4peerreview-[a-z0-9]+-allimaeeees-projects\.vercel\.app$/;
const hn = window.location.hostname;
const isAllowedPlatform = ALLOWED_PLATFORM_HOSTNAMES.includes(hn) || PREVIEW_PLATFORM_RE.test(hn);
if (isAllowedPlatform) {
  // Always stamp the current origin onto stored auth — captures platformUrl even
  // when syncAuth can't read the session from this page (e.g. HttpOnly cookie sessions).
  stampPlatformUrl();

  // Attempt full session sync (extracts token from localStorage/cookies).
  syncAuth();
  setTimeout(syncAuth, 2000);

  // Re-sync on localStorage changes (e.g. after token refresh).
  window.addEventListener('storage', syncAuth);
}
