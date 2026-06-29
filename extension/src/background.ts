import type {
  BackgroundMessage,
  BackgroundResponse,
  StoredAuth,
  CriterionScore,
  HighlightTag,
  Anchor,
} from './types';

const SUPABASE_URL = 'https://lbmyfqeqkpmohlumlkdg.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxibXlmcWVxa3Btb2hsdW1sa2RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNTk1MDEsImV4cCI6MjA5NzYzNTUwMX0.Hnnv3rVNyzgeN1v8yik2U3uJ8FwvxYCmiffH_hooIac';
const SCREENSHOTS_BUCKET = 'screenshots';

// ── Message handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: BackgroundMessage, sender, sendResponse) => {
    handleMessage(message, sender)
      .then(sendResponse)
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }
);

async function handleMessage(
  msg: BackgroundMessage,
  sender: chrome.runtime.MessageSender,
): Promise<BackgroundResponse> {
  const auth = await getStoredAuth();

  switch (msg.type) {
    case 'GET_AUTH':
      return { success: true, data: auth };

    case 'LOGIN': {
      const { email, password } = msg.payload as { email: string; password: string };
      return login(email, password);
    }

    case 'LOGOUT':
      await chrome.storage.local.remove('auth');
      return { success: true };

    case 'CAPTURE_TAB': {
      const tabId = sender.tab?.id;
      const windowId = sender.tab?.windowId;
      if (!tabId || windowId === undefined) return { success: false, error: 'No tab context' };
      return captureTab(windowId);
    }

    case 'UPLOAD_SCREENSHOT': {
      if (!auth) return { success: false, error: 'Not authenticated' };
      const { png, reviewId } = msg.payload as { png: string; reviewId: string };
      return uploadScreenshot(png, reviewId, auth.access_token);
    }

    case 'GET_ASSIGNMENTS':
      if (!auth) return { success: false, error: 'Not authenticated' };
      return getAssignments(auth);

    case 'GET_RUBRIC_ITEMS': {
      if (!auth) return { success: false, error: 'Not authenticated' };
      const { rubricId } = msg.payload as { rubricId: string };
      return get(`rubric_items?rubric_id=eq.${rubricId}&order=sort_order.asc`, auth.access_token);
    }

    case 'GET_ANNOTATIONS': {
      if (!auth) return { success: false, error: 'Not authenticated' };
      const { reviewId } = msg.payload as { reviewId: string };
      return get(`annotations?review_id=eq.${reviewId}&order=created_at.asc`, auth.access_token);
    }

    case 'GET_SCORES': {
      if (!auth) return { success: false, error: 'Not authenticated' };
      const { reviewId } = msg.payload as { reviewId: string };
      return get(`review_scores?review_id=eq.${reviewId}`, auth.access_token);
    }

    case 'SAVE_ANNOTATION': {
      if (!auth) return { success: false, error: 'Not authenticated' };
      const { id, ...fields } = msg.payload as { id?: string } & Record<string, unknown>;
      if (id) {
        return patch(`annotations?id=eq.${id}`, fields, auth.access_token);
      }
      return post('annotations', fields, auth.access_token);
    }

    case 'UPDATE_ANNOTATION': {
      if (!auth) return { success: false, error: 'Not authenticated' };
      const { id, ...fields } = msg.payload as { id: string } & Record<string, unknown>;
      return patch(`annotations?id=eq.${id}`, fields, auth.access_token);
    }

    case 'DELETE_ANNOTATION': {
      if (!auth) return { success: false, error: 'Not authenticated' };
      const { id } = msg.payload as { id: string };
      return del(`annotations?id=eq.${id}`, auth.access_token);
    }

    case 'SAVE_SCORE': {
      if (!auth) return { success: false, error: 'Not authenticated' };
      return upsertScore(msg.payload as SaveScorePayload, auth.access_token);
    }

    case 'SET_REVIEW_STATUS': {
      if (!auth) return { success: false, error: 'Not authenticated' };
      const { reviewId, status } = msg.payload as { reviewId: string; status: string };
      return patch(`reviews?id=eq.${reviewId}`, { status }, auth.access_token);
    }

    default:
      return { success: false, error: `Unknown message type` };
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getStoredAuth(): Promise<StoredAuth | null> {
  const { auth } = await chrome.storage.local.get('auth') as { auth?: StoredAuth };
  if (!auth) return null;
  if (auth.expires_at < Math.floor(Date.now() / 1000) + 60) {
    return refreshToken(auth.refresh_token);
  }
  return auth;
}

async function login(email: string, password: string): Promise<BackgroundResponse<StoredAuth>> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json() as { error_description?: string; msg?: string };
      return { success: false, error: err.error_description ?? err.msg ?? 'Login failed' };
    }
    const data = await res.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      user: { id: string; email: string };
    };
    const auth: StoredAuth = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user_id: data.user.id,
      email: data.user.email,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
    };
    await chrome.storage.local.set({ auth });
    return { success: true, data: auth };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

async function refreshToken(token: string): Promise<StoredAuth | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ refresh_token: token }),
    });
    if (!res.ok) { await chrome.storage.local.remove('auth'); return null; }
    const data = await res.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      user: { id: string; email: string };
    };
    const auth: StoredAuth = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user_id: data.user.id,
      email: data.user.email,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
    };
    await chrome.storage.local.set({ auth });
    return auth;
  } catch { return null; }
}

// ── Screenshot ────────────────────────────────────────────────────────────────

async function captureTab(windowId: number): Promise<BackgroundResponse<{ png: string }>> {
  try {
    const png = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
    return { success: true, data: { png } };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

async function uploadScreenshot(
  png: string,
  reviewId: string,
  accessToken: string,
): Promise<BackgroundResponse<{ url: string }>> {
  try {
    const filename = `${reviewId}/${Date.now()}.png`;
    const base64 = png.replace(/^data:image\/png;base64,/, '');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SCREENSHOTS_BUCKET}/${filename}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'image/png',
      },
      body: bytes,
    });
    if (!res.ok) return { success: false, error: await res.text() };
    const url = `${SUPABASE_URL}/storage/v1/object/public/${SCREENSHOTS_BUCKET}/${filename}`;
    return { success: true, data: { url } };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ── REST helpers ──────────────────────────────────────────────────────────────

function headers(token: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${token}`,
    ...extra,
  };
}

async function get<T>(path: string, token: string): Promise<BackgroundResponse<T>> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: headers(token) });
  if (!res.ok) return { success: false, error: await res.text() };
  return { success: true, data: await res.json() as T };
}

async function post<T>(path: string, body: unknown, token: string): Promise<BackgroundResponse<T>> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: headers(token, { 'Prefer': 'return=representation' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) return { success: false, error: await res.text() };
  const data = await res.json() as T[] | T;
  return { success: true, data: Array.isArray(data) ? data[0] : data };
}

async function patch<T>(path: string, body: unknown, token: string): Promise<BackgroundResponse<T>> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: headers(token, { 'Prefer': 'return=representation' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) return { success: false, error: await res.text() };
  return { success: true };
}

async function del(path: string, token: string): Promise<BackgroundResponse> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'DELETE',
    headers: headers(token),
  });
  if (!res.ok) return { success: false, error: await res.text() };
  return { success: true };
}

interface SaveScorePayload {
  review_id: string;
  rubric_item_id: string;
  score: CriterionScore | null;
  criterion_scores: CriterionScore[];
  comment?: string | null;
}

async function upsertScore(payload: SaveScorePayload, token: string): Promise<BackgroundResponse> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/review_scores?on_conflict=review_id,rubric_item_id`,
    {
      method: 'POST',
      headers: headers(token, { 'Prefer': 'return=representation,resolution=merge-duplicates' }),
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) return { success: false, error: await res.text() };
  return { success: true };
}

async function getAssignments(auth: StoredAuth): Promise<BackgroundResponse> {
  return get(
    `reviews?reviewer_id=eq.${auth.user_id}&status=in.(assigned,in_progress)&select=id,document_id,rubric_id,status,documents(title,source_url),rubrics(title)`,
    auth.access_token,
  );
}

// Satisfy TypeScript — these types are used only via the payload union above
export type { Anchor, HighlightTag };
