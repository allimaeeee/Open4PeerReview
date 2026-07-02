"use strict";
(() => {
  // extension/src/popup.ts
  function send(msg) {
    return chrome.runtime.sendMessage(msg);
  }
  var app = document.getElementById("app");
  async function render() {
    const authResp = await send({ type: "GET_AUTH" });
    const auth = authResp.data ?? null;
    if (!auth) {
      renderLogin();
      return;
    }
    let currentReview = null;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        const resp = await chrome.tabs.sendMessage(tab.id, { type: "GET_CURRENT_REVIEW" }).catch(() => null);
        currentReview = resp?.data ?? null;
      }
    } catch {
    }
    renderStatus(auth, currentReview);
  }
  function renderLogin() {
    app.innerHTML = `
    <div class="form-group">
      <label class="form-label">Email</label>
      <input id="email" type="email" class="input" placeholder="you@institution.edu" />
    </div>
    <div class="form-group">
      <label class="form-label">Password</label>
      <input id="password" type="password" class="input" placeholder="Password" />
    </div>
    <div id="err" class="error-msg"></div>
    <button id="btn-login" class="btn btn-primary">Sign In</button>
  `;
    const emailEl = document.getElementById("email");
    const passEl = document.getElementById("password");
    const errEl = document.getElementById("err");
    const btnEl = document.getElementById("btn-login");
    const doLogin = async () => {
      const email = emailEl.value.trim();
      const password = passEl.value;
      if (!email || !password) return;
      btnEl.disabled = true;
      btnEl.textContent = "Signing in\u2026";
      errEl.style.display = "none";
      const resp = await send({ type: "LOGIN", payload: { email, password } });
      if (!resp.success) {
        errEl.textContent = resp.error ?? "Sign in failed";
        errEl.style.display = "block";
        btnEl.disabled = false;
        btnEl.textContent = "Sign In";
        return;
      }
      render();
    };
    btnEl.addEventListener("click", doLogin);
    passEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doLogin();
    });
  }
  function renderStatus(auth, review) {
    const isOnTorus = document.referrer?.includes("proton.oli.cmu.edu") ?? false;
    const reviewHtml = review ? `
      <div class="review-box">
        <div class="review-label">Active Review</div>
        <div class="review-title">${esc(review.documents?.title ?? "Untitled")}</div>
        <div class="review-rubric">${esc(review.rubrics?.title ?? "")}</div>
      </div>
    ` : `
      <div class="review-box">
        <div class="review-label">No active review</div>
        <div class="review-rubric" style="margin-top:2px;">Navigate to the OER you're assigned to review on Torus \u2014 the panel will open automatically.</div>
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
    document.getElementById("btn-logout")?.addEventListener("click", async () => {
      await send({ type: "LOGOUT" });
      render();
    });
  }
  function esc(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  render();
})();
//# sourceMappingURL=popup.js.map
