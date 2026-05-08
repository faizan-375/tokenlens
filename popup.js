// ============================================================
// TokenLens — Popup Script
// Displays token stats in the extension popup
// ============================================================

const CONTEXT_LIMITS = {
  chatgpt: 128000,
  claude: 200000,
  gemini: 1000000,
  unknown: 128000
};

const PLATFORM_IDS = {
  'ChatGPT': 'chatgpt',
  'GPT-4': 'chatgpt',
  'Claude': 'claude',
  'Gemini': 'gemini',
};

function fmtK(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function renderActive(data) {
  const platformId = PLATFORM_IDS[data.model] || data.platform || 'unknown';
  const limit = data.contextLimit || CONTEXT_LIMITS[platformId];
  const remaining = data.remaining != null ? data.remaining : Math.max(0, limit - data.totalTokens);
  const pct = Math.min(100, (data.totalTokens / limit) * 100);
  const remainPct = 100 - pct;

  // Color system: green >40%, yellow 20-40%, red <20%
  let fillColor = 'linear-gradient(90deg, #7c8cf8, #a78bfa)';
  let remainColor = '#4ade80';
  if (remainPct < 20) {
    fillColor = 'linear-gradient(90deg, #ef4444, #f87171)';
    remainColor = '#f87171';
  } else if (remainPct < 40) {
    fillColor = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
    remainColor = '#fbbf24';
  }

  // Warning banners at exactly 75% and 90%
  let warningHtml = '';
  if (pct >= 90) {
    warningHtml = `<div style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#f87171;border-radius:8px;padding:8px;text-align:center;font-size:11px;font-weight:700;margin-bottom:10px;">⚠️ Context almost full!</div>`;
  } else if (pct >= 75) {
    warningHtml = `<div style="background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);color:#fbbf24;border-radius:8px;padding:8px;text-align:center;font-size:11px;font-weight:700;margin-bottom:10px;">⚡ Context filling up</div>`;
  }

  document.getElementById('main-content').innerHTML = `
    <div class="content">
      <div class="status-bar">
        <div class="status-dot"></div>
        <span class="status-text">Tracking active</span>
        <div class="platform-badge">${data.model}</div>
      </div>

      ${warningHtml}

      <!-- REMAINING — Hero -->
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:14px;text-align:center;margin-bottom:10px;">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#555;font-weight:600;margin-bottom:6px;">Tokens Remaining</div>
        <div style="font-size:40px;font-weight:800;color:${remainColor};letter-spacing:-0.03em;line-height:1;font-feature-settings:'tnum';">${fmtK(remaining)}</div>
        <div style="font-size:10px;color:#555;margin-top:4px;">${remainPct.toFixed(1)}% of context free</div>
      </div>

      <div class="grid">
        <div class="stat-card">
          <div class="stat-label">Typing</div>
          <div class="stat-value">${fmtK(data.inputTokens)}</div>
          <div class="stat-sub">input tokens</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Used</div>
          <div class="stat-value">${fmtK(data.totalTokens)}</div>
          <div class="stat-sub">total tokens</div>
        </div>
      </div>

      <div class="context-section">
        <div class="context-header">
          <span class="context-label">Context Window</span>
          <span class="context-percent">${pct.toFixed(1)}% used</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${pct}%; background: ${fillColor}"></div>
        </div>
        <div class="context-numbers">
          ${fmtK(data.totalTokens)} used · ${fmtK(remaining)} left · ${fmtK(limit)} total
        </div>
      </div>

      <button class="toggle-btn" id="toggle-overlay">Toggle Overlay</button>
    </div>

    <div class="footer">
      <span class="accuracy-note">~95-99% accurate estimate</span>
      <span class="version">v1.1.0</span>
    </div>
  `;

  document.getElementById('toggle-overlay').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_OVERLAY' });
      }
    });
  });
}

function renderNoPage() {
  document.getElementById('main-content').innerHTML = `
    <div class="no-platform">
      <div class="no-platform-icon">🔍</div>
      <div class="no-platform-text">
        Open an AI platform to start<br>counting tokens automatically.
      </div>
      <div class="supported">
        Supported: ChatGPT · Claude · Gemini
      </div>
    </div>
  `;
}

// Get token data from the active tab's content script
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs[0]) { renderNoPage(); return; }

  // Use callback-based sendMessage (matches content.js sendResponse)
  chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_TOKENS' }, (response) => {
    if (chrome.runtime.lastError || !response) {
      renderNoPage();
      return;
    }
    renderActive(response);
  });
});
