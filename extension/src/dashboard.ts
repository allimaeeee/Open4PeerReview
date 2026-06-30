// Runs on the OER Hub dashboard. Syncs the reviewer's Supabase session into
// chrome.storage.local so the extension on OLI Torus pages can auto-login.

import type { StoredAuth } from './types';

const SUPABASE_REF = 'lbmyfqeqkpmohlumlkdg';
const LS_KEY = `sb-${SUPABASE_REF}-auth-token`;

interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email: string };
}

function syncAuth() {
  const raw = localStorage.getItem(LS_KEY);
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

// Sync immediately and again on storage changes (e.g. after login/refresh)
syncAuth();
window.addEventListener('storage', (e) => {
  if (e.key === LS_KEY) syncAuth();
});
