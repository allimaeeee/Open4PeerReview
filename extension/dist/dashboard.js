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
  function stampPlatformUrl() {
    const origin = window.location.origin;
    const hostname = window.location.hostname;
    const guardPassed = ALLOWED_PLATFORM_HOSTNAMES.includes(hostname) || PREVIEW_PLATFORM_RE.test(hostname);
    console.log("[OER-DEBUG] stampPlatformUrl ENTRY ts=" + Date.now() + " origin=" + origin + " hostname=" + hostname + " guard=" + guardPassed);
    chrome.storage.local.get("auth", (result) => {
      const existing = result.auth;
      console.log("[OER-DEBUG] stampPlatformUrl storage read: hasAuth=" + !!existing?.access_token + " existingPlatformUrl=" + (existing?.platformUrl ?? "(none)") + " user_id=" + (existing?.user_id ?? "(none)"));
      if (existing?.access_token) {
        const toWrite = { ...existing, platformUrl: origin };
        chrome.storage.local.set({ auth: toWrite }, () => {
          console.log("[OER-DEBUG] stampPlatformUrl SET COMPLETE ts=" + Date.now() + " wrote platformUrl=" + toWrite.platformUrl + " user_id=" + toWrite.user_id);
        });
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
    const platformUrl = window.location.origin;
    console.log("[OER-DEBUG] saveSessionToBackground ts=" + Date.now() + " writing auth with platformUrl=" + platformUrl + " user_id=" + auth.user_id);
    chrome.storage.local.set({ auth: { ...auth, platformUrl } });
    chrome.runtime.sendMessage({ type: "SYNC_AUTH", payload: session });
  }
  function syncAuth() {
    console.log("[OER-DEBUG] syncAuth ENTRY ts=" + Date.now());
    const lsSession = findSessionInLocalStorage();
    if (lsSession) {
      console.log("[OER-DEBUG] syncAuth: found session in localStorage");
      saveSessionToBackground(lsSession);
      return;
    }
    const ssSession = findSessionInSessionStorage();
    if (ssSession) {
      console.log("[OER-DEBUG] syncAuth: found session in sessionStorage");
      saveSessionToBackground(ssSession);
      return;
    }
    console.log("[OER-DEBUG] syncAuth: no local session found, sending SYNC_AUTH_FROM_COOKIES");
    chrome.runtime.sendMessage({ type: "SYNC_AUTH_FROM_COOKIES" });
  }
  var ALLOWED_PLATFORM_HOSTNAMES = ["annotation-platform-seven.vercel.app", "localhost"];
  var PREVIEW_PLATFORM_RE = /^open4peerreview-[a-z0-9]+-allimaeeees-projects\.vercel\.app$/;
  var hn = window.location.hostname;
  var isAllowedPlatform = ALLOWED_PLATFORM_HOSTNAMES.includes(hn) || PREVIEW_PLATFORM_RE.test(hn);
  console.log("[OER-DEBUG] dashboard.ts module load: isAllowedPlatform=" + isAllowedPlatform + " hostname=" + hn + " ts=" + Date.now());
  if (isAllowedPlatform) {
    stampPlatformUrl();
    syncAuth();
    setTimeout(() => {
      console.log("[OER-DEBUG] 2s retry syncAuth ts=" + Date.now());
      syncAuth();
    }, 2e3);
    window.addEventListener("storage", syncAuth);
  }
})();
//# sourceMappingURL=dashboard.js.map
