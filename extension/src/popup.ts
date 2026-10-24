import type { StoredAuth, ReviewAssignment, BackgroundMessage, BackgroundResponse } from './types';
import { tokens } from '../../lib/design-system/token-values';
import latoRegular from './fonts/Lato-Regular.woff2';
import latoBold from './fonts/Lato-Bold.woff2';
import newsreaderVariable from './fonts/Newsreader-Variable.woff2';

// Inlined from public/welcome-icon.svg — fallback values applied directly so
// CSS custom properties don't need to be defined in the popup document context.
const WELCOME_ICON_SVG = `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" width="40" height="40" class="login-icon"><circle cx="40" cy="40" r="39.75" fill="#FEF5DE" stroke="#C4C6CD" stroke-width="0.5"/><path d="M53.9643 27H44.6429C43.8389 27 43.046 27.1883 42.3269 27.5499C41.6079 27.9115 40.9824 28.4365 40.5 29.0833C40.0176 28.4365 39.3921 27.9115 38.6731 27.5499C37.954 27.1883 37.1611 27 36.3571 27H27.0357C26.761 27 26.4976 27.1097 26.3034 27.3051C26.1091 27.5004 26 27.7654 26 28.0417V46.7917C26 47.0679 26.1091 47.3329 26.3034 47.5282C26.4976 47.7236 26.761 47.8333 27.0357 47.8333H36.3571C37.1812 47.8333 37.9715 48.1626 38.5542 48.7486C39.1369 49.3347 39.4643 50.1295 39.4643 50.9583C39.4643 51.2346 39.5734 51.4996 39.7676 51.6949C39.9619 51.8903 40.2253 52 40.5 52C40.7747 52 41.0381 51.8903 41.2324 51.6949C41.4266 51.4996 41.5357 51.2346 41.5357 50.9583C41.5357 50.1295 41.8631 49.3347 42.4458 48.7486C43.0285 48.1626 43.8188 47.8333 44.6429 47.8333H53.9643C54.239 47.8333 54.5024 47.7236 54.6966 47.5282C54.8909 47.3329 55 47.0679 55 46.7917V28.0417C55 27.7654 54.8909 27.5004 54.6966 27.3051C54.5024 27.1097 54.239 27 53.9643 27ZM36.3571 45.75H28.0714V29.0833H36.3571C37.1812 29.0833 37.9715 29.4126 38.5542 29.9986C39.1369 30.5847 39.4643 31.3795 39.4643 32.2083V46.7917C38.5688 46.1138 37.4779 45.7481 36.3571 45.75ZM52.9286 45.75H44.6429C43.5221 45.7481 42.4312 46.1138 41.5357 46.7917V32.2083C41.5357 31.3795 41.8631 30.5847 42.4458 29.9986C43.0285 29.4126 43.8188 29.0833 44.6429 29.0833H52.9286V45.75ZM44.6429 32.2083H49.8214C50.0961 32.2083 50.3596 32.3181 50.5538 32.5134C50.748 32.7088 50.8571 32.9737 50.8571 33.25C50.8571 33.5263 50.748 33.7912 50.5538 33.9866C50.3596 34.1819 50.0961 34.2917 49.8214 34.2917H44.6429C44.3682 34.2917 44.1047 34.1819 43.9105 33.9866C43.7163 33.7912 43.6071 33.5263 43.6071 33.25C43.6071 32.9737 43.7163 32.7088 43.9105 32.5134C44.1047 32.3181 44.3682 32.2083 44.6429 32.2083ZM50.8571 37.4167C50.8571 37.6929 50.748 37.9579 50.5538 38.1532C50.3596 38.3486 50.0961 38.4583 49.8214 38.4583H44.6429C44.3682 38.4583 44.1047 38.3486 43.9105 38.1532C43.7163 37.9579 43.6071 37.6929 43.6071 37.4167C43.6071 37.1404 43.7163 36.8754 43.9105 36.6801C44.1047 36.4847 44.3682 36.375 44.6429 36.375H49.8214C50.0961 36.375 50.3596 36.4847 50.5538 36.6801C50.748 36.8754 50.8571 37.1404 50.8571 37.4167ZM50.8571 41.5833C50.8571 41.8596 50.748 42.1246 50.5538 42.3199C50.3596 42.5153 50.0961 42.625 49.8214 42.625H44.6429C44.3682 42.625 44.1047 42.5153 43.9105 42.3199C43.7163 42.1246 43.6071 41.8596 43.6071 41.5833C43.6071 41.3071 43.7163 41.0421 43.9105 40.8468C44.1047 40.6514 44.3682 40.5417 44.6429 40.5417H49.8214C50.0961 40.5417 50.3596 40.6514 50.5538 40.8468C50.748 41.0421 50.8571 41.3071 50.8571 41.5833Z" fill="#512906"/></svg>`;

function injectStyles(): void {
  const style = document.createElement('style');
  style.textContent = `
    @font-face { font-family: 'Lato'; font-weight: 400; src: url(${latoRegular}) format('woff2'); }
    @font-face { font-family: 'Lato'; font-weight: 700; src: url(${latoBold}) format('woff2'); }
    @font-face { font-family: 'Newsreader'; font-weight: 200 800; src: url(${newsreaderVariable}) format('woff2-variations'); }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      width: 300px;
      min-height: 120px;
      font-family: ${tokens.font.body};
      font-size: 13px;
      color: ${tokens.color.textPrimary};
      background: ${tokens.color.surfaceCard};
    }

    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 14px;
      background: ${tokens.color.primary};
      color: ${tokens.color.onPrimary};
    }

    .logo-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${tokens.color.secondaryContainer};
      flex-shrink: 0;
    }

    .header-title { font-weight: 600; font-size: 13px; letter-spacing: 0.01em; flex: 1; }

    .body { padding: 14px; }

    .status-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }

    .status-dot { width: 7px; height: 7px; border-radius: 50%; background: ${tokens.color.textMuted}; flex-shrink: 0; }
    .status-dot.active { background: ${tokens.color.success}; }

    .status-text { font-size: 12px; color: ${tokens.color.textSecondary}; flex: 1; }
    .user-email { font-size: 11px; color: ${tokens.color.textMuted}; margin-bottom: 14px; }

    .review-box {
      background: ${tokens.color.surfaceContainer};
      border: 1px solid ${tokens.color.border};
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 12px;
    }
    .review-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: ${tokens.color.textMuted}; margin-bottom: 4px; }
    .review-title { font-size: 13px; font-weight: 600; color: ${tokens.color.textPrimary}; font-family: ${tokens.font.heading}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .review-rubric { font-size: 11px; color: ${tokens.color.textSecondary}; margin-top: 2px; }

    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      font-family: inherit;
      transition: all 0.2s;
    }
    .btn:active { transform: scale(0.99); }
    .btn:focus-visible { outline: 2px solid ${tokens.color.primary}; outline-offset: 2px; }

    .btn-outline {
      background: ${tokens.color.surfaceContainer};
      color: ${tokens.color.textSecondary};
      border: 1px solid ${tokens.color.border};
    }
    .btn-outline:hover { background: ${tokens.color.surfaceContainerHigh}; border-color: ${tokens.color.borderStrong}; }

    .btn-danger {
      background: ${tokens.color.errorContainer};
      color: ${tokens.color.onErrorContainer};
      border: 1px solid ${tokens.color.error};
    }
    .btn-danger:hover { background: ${tokens.color.error}; color: ${tokens.color.onPrimary}; }

    .divider { height: 1px; background: ${tokens.color.border}; margin: 12px 0; }

    .state-loading { display: flex; align-items: center; justify-content: center; padding: 24px; }
    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid ${tokens.color.border};
      border-top-color: ${tokens.color.primary};
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Login screen */
    .login-header { text-align: center; padding: 20px 0 0; margin-bottom: 16px; }
    .login-icon { display: block; margin: 0 auto 10px; }
    .login-heading { font-family: ${tokens.font.heading}; font-size: 16px; font-weight: 600; color: ${tokens.color.textPrimary}; margin-bottom: 4px; }
    .login-sub { font-size: 11px; color: ${tokens.color.textMuted}; }

    .form-group { margin-bottom: 16px; }
    .form-label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: ${tokens.color.textSecondary};
      margin-bottom: 6px;
    }
    .input {
      width: 100%;
      padding: 0 0 8px;
      border: none;
      border-bottom: 2px solid ${tokens.color.border};
      border-radius: 0;
      font-size: 11px;
      color: ${tokens.color.textPrimary};
      background: transparent;
      outline: none;
      font-family: inherit;
      transition: border-color 0.15s;
    }
    .input::placeholder { color: ${tokens.color.textMuted}; }
    .input:focus { border-bottom-color: ${tokens.color.primary}; }
    .input.error { border-bottom-color: ${tokens.color.error}; }

    .btn-primary { background: ${tokens.color.primary}; color: ${tokens.color.onPrimary}; }
    .btn-primary:hover { background: ${tokens.color.primaryHover}; }

    .error-msg { font-size: 11px; color: ${tokens.color.error}; margin-bottom: 8px; display: none; }
  `;
  document.head.appendChild(style);
}

function send<T = unknown>(msg: BackgroundMessage): Promise<BackgroundResponse<T>> {
  return chrome.runtime.sendMessage(msg);
}

const app = document.getElementById('app')!;

async function render() {
  const authResp = await send<StoredAuth>({ type: 'GET_AUTH' });
  const auth = authResp.data ?? null;

  if (!auth) {
    renderLogin();
    return;
  }

  // Ask the active tab's content script for the current review
  let currentReview: ReviewAssignment | null = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_REVIEW' })
        .catch(() => null);
      currentReview = resp?.data ?? null;
    }
  } catch { /* extension not active on this tab */ }

  renderStatus(auth, currentReview);
}

function renderLogin() {
  app.innerHTML = `
    <div class="login-header">
      ${WELCOME_ICON_SVG}
      <p class="login-heading">Log In</p>
      <p class="login-sub">Use your OER Hub account credentials</p>
    </div>
    <div class="form-group">
      <label class="form-label">Email</label>
      <input id="email" type="email" class="input" placeholder="you@institution.edu" />
    </div>
    <div class="form-group">
      <label class="form-label">Password</label>
      <input id="password" type="password" class="input" placeholder="Password" />
    </div>
    <div id="err" class="error-msg"></div>
    <button id="btn-login" class="btn btn-primary" style="margin-top:4px;">Sign In</button>
  `;

  const emailEl = document.getElementById('email') as HTMLInputElement;
  const passEl  = document.getElementById('password') as HTMLInputElement;
  const errEl   = document.getElementById('err') as HTMLElement;
  const btnEl   = document.getElementById('btn-login') as HTMLButtonElement;

  const doLogin = async () => {
    const email = emailEl.value.trim();
    const password = passEl.value;
    if (!email || !password) return;
    btnEl.disabled = true;
    btnEl.textContent = 'Signing in…';
    errEl.style.display = 'none';
    const resp = await send<StoredAuth>({ type: 'LOGIN', payload: { email, password } });
    if (!resp.success) {
      errEl.textContent = resp.error ?? 'Sign in failed';
      errEl.style.display = 'block';
      btnEl.disabled = false;
      btnEl.textContent = 'Sign In';
      return;
    }
    render();
  };

  btnEl.addEventListener('click', doLogin);
  passEl.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
}

function renderStatus(auth: StoredAuth, review: ReviewAssignment | null) {
  const reviewHtml = review
    ? `
      <div class="review-box">
        <div class="review-label">Active Review</div>
        <div class="review-title">${esc(review.documents?.title ?? 'Untitled')}</div>
        <div class="review-rubric">${esc(review.rubrics?.title ?? '')}</div>
      </div>
    `
    : `
      <div class="review-box">
        <div class="review-label">No active review</div>
        <div class="review-rubric" style="margin-top:2px;">Open a review from your OER Hub dashboard — the panel appears on Torus automatically. It won't show up if you browse Torus on your own.</div>
      </div>
    `;

  app.innerHTML = `
    <div class="status-row">
      <div class="status-dot active"></div>
      <span class="status-text">Signed in</span>
    </div>
    <div class="user-email">${esc(auth.email)}</div>
    ${reviewHtml}
    <div class="divider"></div>
    <button id="btn-logout" class="btn btn-danger">Sign Out</button>
  `;

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await send({ type: 'LOGOUT' });
    render();
  });
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

injectStyles();
render();
