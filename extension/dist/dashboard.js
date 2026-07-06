"use strict";
(() => {
  // src/dashboard.ts
  function findSessionInLocalStorage() {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (!(key.startsWith("sb-") && key.endsWith("-auth-token"))) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(key) ?? "");
        if (parsed?.access_token && parsed?.user?.id) return parsed;
      } catch {
      }
    }
    return null;
  }
  function findSessionInSessionStorage() {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      if (!(key.startsWith("sb-") && key.endsWith("-auth-token"))) continue;
      try {
        const parsed = JSON.parse(sessionStorage.getItem(key) ?? "");
        if (parsed?.access_token && parsed?.user?.id) return parsed;
      } catch {
      }
    }
    return null;
  }
  function stampPlatformUrl() {
    const origin = window.location.origin;
    chrome.storage.local.get("auth", (result) => {
      const existing = result.auth;
      if (existing?.access_token) {
        chrome.storage.local.set({ auth: { ...existing, platformUrl: origin } });
      }
    });
  }
  function saveSessionToBackground(session) {
    const auth = {
      access_token: session.access_token,
      refresh_token: session.refresh_token ?? "",
      user_id: session.user.id,
      email: session.user.email ?? "",
      expires_at: session.expires_at ?? Math.floor(Date.now() / 1e3) + 3600
    };
    chrome.storage.local.set({ auth: { ...auth, platformUrl: window.location.origin } });
    chrome.runtime.sendMessage({ type: "SYNC_AUTH", payload: session });
  }
  function syncAuth() {
    const lsSession = findSessionInLocalStorage();
    if (lsSession) {
      saveSessionToBackground(lsSession);
      return;
    }
    const ssSession = findSessionInSessionStorage();
    if (ssSession) {
      saveSessionToBackground(ssSession);
      return;
    }
    chrome.runtime.sendMessage({ type: "SYNC_AUTH_FROM_COOKIES" });
  }
  var ALLOWED_PLATFORM_HOSTNAMES = ["open4peerreview-olitorus.vercel.app", "localhost"];
  var PREVIEW_PLATFORM_RE = /^open4peerreview-[a-z0-9]+-allimaeeees-projects\.vercel\.app$/;
  var hn = window.location.hostname;
  var isAllowedPlatform = ALLOWED_PLATFORM_HOSTNAMES.includes(hn) || PREVIEW_PLATFORM_RE.test(hn);
  if (isAllowedPlatform) {
    stampPlatformUrl();
    syncAuth();
    setTimeout(syncAuth, 2e3);
    window.addEventListener("storage", syncAuth);
  }
})();
//# sourceMappingURL=dashboard.js.map
