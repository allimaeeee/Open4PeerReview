"use strict";
(() => {
  // extension/src/dashboard.ts
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
  function saveSessionToBackground(session) {
    const auth = {
      access_token: session.access_token,
      refresh_token: session.refresh_token ?? "",
      user_id: session.user.id,
      email: session.user.email ?? "",
      expires_at: session.expires_at ?? Math.floor(Date.now() / 1e3) + 3600
    };
    chrome.storage.local.set({ auth });
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
  syncAuth();
  setTimeout(syncAuth, 2e3);
  window.addEventListener("storage", syncAuth);
})();
//# sourceMappingURL=dashboard.js.map
