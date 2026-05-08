// ============================================================
// TokenLens — Content Script
// Injects real-time token counter widget on AI platforms
// 100% local, zero network requests
// ============================================================

(function() {
  'use strict';

  // ---- Platform Detection ----
  const PLATFORM = (() => {
    const host = location.hostname;
    if (host.includes('openai.com') || host.includes('chatgpt.com')) return 'chatgpt';
    if (host.includes('claude.ai')) return 'claude';
    if (host.includes('gemini.google.com') || host.includes('bard.google.com')) return 'gemini';
    return 'unknown';
  })();

  const MODEL_MAP = {
    chatgpt: 'gpt4',
    claude: 'claude',
    gemini: 'gemini',
    unknown: 'gpt4'
  };

  const MODEL_NAME_MAP = {
    chatgpt: 'GPT-4',
    claude: 'Claude',
    gemini: 'Gemini',
    unknown: 'AI'
  };

  const CONTEXT_LIMITS = {
    chatgpt: 128000,
    claude: 200000,
    gemini: 1000000,
    unknown: 128000
  };

  // ---- Selectors for each platform ----
  const SELECTORS = {
    chatgpt: {
      input: '#prompt-textarea, [data-id="prompt-textarea"], [contenteditable="true"][data-testid]',
      messages: '[data-message-author-role], .markdown, .text-token-text-primary'
    },
    claude: {
      input: '.ProseMirror, div[role="textbox"], [contenteditable="true"]',
      messages: '[data-testid="human-turn"], [data-testid="ai-turn"], .font-claude-message'
    },
    gemini: {
      input: 'rich-textarea textarea, .ql-editor, [contenteditable="true"]',
      messages: 'model-response, user-query, message-content'
    }
  };

  // ---- State ----
  let overlayEl = null;
  let currentInputTokens = 0;
  let totalConversationTokens = 0;
  let isMinimized = false;
  let updateInterval = null;
  let isUpdating = false;  // Guard for MutationObserver feedback loop

  // ---- Format large numbers (200K, 1M etc) ----
  function fmtK(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toLocaleString();
  }

  // ---- Get initial remaining tokens string for current platform ----
  function getInitialRemaining() {
    const limit = CONTEXT_LIMITS[PLATFORM];
    return fmtK(limit);
  }

  // ---- Create Overlay Widget ----
  function createOverlay() {
    if (overlayEl) return;

    overlayEl = document.createElement('div');
    overlayEl.id = 'ai-token-counter-overlay';
    overlayEl.className = 'atc-overlay';
    overlayEl.innerHTML = `
      <div class="atc-header">
        <div class="atc-logo">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span class="atc-title">TokenLens</span>
        </div>
        <div class="atc-controls">
          <div class="atc-platform-badge" id="atc-platform">${MODEL_NAME_MAP[PLATFORM]}</div>
          <button class="atc-btn atc-minimize" title="Minimize">−</button>
        </div>
      </div>

      <div class="atc-body">

        <!-- WARNING BANNER -->
        <div class="atc-warning" id="atc-warning" style="display:none"></div>

        <!-- REMAINING TOKENS — BIG & PROMINENT -->
        <div class="atc-remaining-section">
          <div class="atc-label">Tokens Remaining</div>
          <div class="atc-remaining-value" id="atc-remaining-tokens">${getInitialRemaining()}</div>
          <div class="atc-sublabel" id="atc-remaining-sub">100.0% of context free</div>
        </div>

        <div class="atc-divider"></div>

        <!-- Context Bar -->
        <div class="atc-section">
          <div class="atc-progress-bar">
            <div class="atc-progress-fill" id="atc-progress"></div>
          </div>
          <div class="atc-progress-text" id="atc-context-text">
            0 used · ${getInitialRemaining()} left
          </div>
        </div>

        <div class="atc-divider"></div>

        <!-- Input + Total row -->
        <div class="atc-row">
          <div class="atc-mini-section">
            <div class="atc-label">Typing Now</div>
            <div class="atc-value-sm" id="atc-input-tokens">0</div>
            <div class="atc-sublabel" id="atc-input-chars">0 chars</div>
          </div>
          <div class="atc-mini-divider"></div>
          <div class="atc-mini-section">
            <div class="atc-label">Total Used</div>
            <div class="atc-value-sm" id="atc-total-tokens">0</div>
            <div class="atc-sublabel" id="atc-total-messages">0 messages</div>
          </div>
        </div>

        <div class="atc-divider"></div>

        <div class="atc-section">
          <div class="atc-label">Est. API Cost</div>
          <div class="atc-cost" id="atc-cost">$0.000000</div>
        </div>

      </div>
      <div class="atc-footer">
        <span class="atc-accuracy">~95-99% accurate</span>
        <button class="atc-reset" id="atc-reset-btn">Reset</button>
      </div>
    `;

    document.body.appendChild(overlayEl);

    // Make draggable
    makeDraggable(overlayEl);

    // Controls
    overlayEl.querySelector('.atc-minimize').addEventListener('click', toggleMinimize);
    overlayEl.querySelector('#atc-reset-btn').addEventListener('click', resetCounters);

    // Load saved position and minimized state
    loadPosition();

    return overlayEl;
  }

  function toggleMinimize() {
    const body = overlayEl.querySelector('.atc-body');
    const footer = overlayEl.querySelector('.atc-footer');
    const btn = overlayEl.querySelector('.atc-minimize');
    isMinimized = !isMinimized;

    body.style.cssText = isMinimized ? 'display: none !important;' : '';
    footer.style.cssText = isMinimized ? 'display: none !important;' : '';
    btn.textContent = isMinimized ? '+' : '−';

    // Persist minimize state
    chrome.storage.local.set({ atcMinimized: isMinimized });
  }

  function resetCounters() {
    totalConversationTokens = 0;
    currentInputTokens = 0;
    updateDisplay(0, 0, { chars: 0, words: 0, msgCount: 0 });
  }

  // ---- Draggable ----
  function makeDraggable(el) {
    const header = el.querySelector('.atc-header');
    let isDragging = false, startX, startY, startLeft, startTop;

    header.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = el.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      el.style.transition = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newLeft = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, startLeft + dx));
      const newTop = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, startTop + dy));
      el.style.left = newLeft + 'px';
      el.style.top = newTop + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        el.style.transition = '';
        savePosition();
      }
    });
  }

  function savePosition() {
    if (!overlayEl) return;
    chrome.storage.local.set({
      atcPosition: {
        left: overlayEl.style.left,
        top: overlayEl.style.top
      }
    });
  }

  function loadPosition() {
    chrome.storage.local.get(['atcPosition', 'atcMinimized'], (data) => {
      if (data.atcPosition && overlayEl) {
        overlayEl.style.left = data.atcPosition.left;
        overlayEl.style.top = data.atcPosition.top;
        overlayEl.style.right = 'auto';
        overlayEl.style.bottom = 'auto';
      }
      if (data.atcMinimized && overlayEl) {
        isMinimized = true;
        const body = overlayEl.querySelector('.atc-body');
        const footer = overlayEl.querySelector('.atc-footer');
        const btn = overlayEl.querySelector('.atc-minimize');
        body.style.cssText = 'display: none !important;';
        footer.style.cssText = 'display: none !important;';
        btn.textContent = '+';
      }
    });
  }

  // ---- Token Counting ----
  function getInputText() {
    const selectors = SELECTORS[PLATFORM] || SELECTORS.chatgpt;
    const inputs = document.querySelectorAll(selectors.input);

    let text = '';
    inputs.forEach(el => {
      // Skip if element is inside our widget
      if (el.closest('#ai-token-counter-overlay')) return;
      if (el.tagName === 'TEXTAREA') {
        text += el.value + ' ';
      } else if (el.contentEditable === 'true') {
        text += el.innerText + ' ';
      }
    });
    return text.trim();
  }

  function getAllConversationText() {
    const selectors = SELECTORS[PLATFORM] || SELECTORS.chatgpt;
    const messages = document.querySelectorAll(selectors.messages);
    let allText = '';
    let count = 0;

    messages.forEach(el => {
      // Skip if element is inside our widget
      if (el.closest('#ai-token-counter-overlay')) return;
      const text = el.innerText || el.textContent;
      if (text && text.trim().length > 0) {
        allText += text + ' ';
        count++;
      }
    });

    return { text: allText.trim(), count };
  }

  // ---- Update Display ----
  function updateDisplay(inputTokens, totalTokens, stats) {
    if (!overlayEl) return;

    const model = MODEL_MAP[PLATFORM];
    const limit = CONTEXT_LIMITS[PLATFORM];
    const remaining = Math.max(0, limit - totalTokens);
    const usagePercent = Math.min(100, (totalTokens / limit) * 100);
    const remainingPercent = 100 - usagePercent;

    // Input tokens
    const inputTokensEl = document.getElementById('atc-input-tokens');
    if (inputTokensEl) inputTokensEl.textContent = inputTokens.toLocaleString();

    const inputCharsEl = document.getElementById('atc-input-chars');
    if (inputCharsEl) inputCharsEl.textContent = `${stats.chars || 0} chars · ${stats.words || 0} words`;

    // Remaining tokens — BIG display
    const remainingEl = document.getElementById('atc-remaining-tokens');
    if (remainingEl) {
      remainingEl.textContent = fmtK(remaining);
      // Color based on how much is left: green >40%, yellow 20-40%, red <20%
      if (remainingPercent < 20) {
        remainingEl.style.color = '#f87171'; // red - critical
      } else if (remainingPercent < 40) {
        remainingEl.style.color = '#fbbf24'; // yellow - warning
      } else {
        remainingEl.style.color = '#4ade80'; // green - good
      }
    }

    const remainingSubEl = document.getElementById('atc-remaining-sub');
    if (remainingSubEl) {
      remainingSubEl.textContent = `${remainingPercent.toFixed(1)}% of context free`;
    }

    // Total
    const totalTokensEl = document.getElementById('atc-total-tokens');
    if (totalTokensEl) totalTokensEl.textContent = fmtK(totalTokens);

    const totalMsgsEl = document.getElementById('atc-total-messages');
    if (totalMsgsEl) totalMsgsEl.textContent = `${stats.msgCount || 0} messages`;

    // Progress bar
    const progressEl = document.getElementById('atc-progress');
    if (progressEl) {
      progressEl.style.width = usagePercent + '%';

      if (usagePercent > 80) {
        progressEl.className = 'atc-progress-fill danger';
      } else if (usagePercent > 60) {
        progressEl.className = 'atc-progress-fill warning';
      } else {
        progressEl.className = 'atc-progress-fill';
      }
    }

    const contextTextEl = document.getElementById('atc-context-text');
    if (contextTextEl) {
      contextTextEl.textContent = `${fmtK(totalTokens)} used · ${fmtK(remaining)} left`;
    }

    // Cost
    const costEl = document.getElementById('atc-cost');
    if (costEl) {
      const cost = window.AITokenCounter.estimateCost(totalTokens, model);
      costEl.textContent = `$${cost}`;
    }

    // Warning banner — triggers at exactly 75% and 90% usage
    const warningEl = document.getElementById('atc-warning');
    if (warningEl) {
      if (usagePercent >= 90) {
        warningEl.style.display = 'block';
        warningEl.textContent = '⚠️ Context almost full!';
        warningEl.className = 'atc-warning danger';
      } else if (usagePercent >= 75) {
        warningEl.style.display = 'block';
        warningEl.textContent = '⚡ Context filling up';
        warningEl.className = 'atc-warning warning';
      } else {
        warningEl.style.display = 'none';
      }
    }
  }

  // ---- Main Update Loop ----
  function updateTokens() {
    if (!window.AITokenCounter) return;
    if (isUpdating) return; // Prevent re-entrancy from MutationObserver
    isUpdating = true;

    try {
      const model = MODEL_MAP[PLATFORM];

      // Count input box
      const inputText = getInputText();
      const inputData = window.AITokenCounter.countDetailed(inputText, model);
      currentInputTokens = inputData.tokens;

      // Count full conversation
      const { text: convText, count: msgCount } = getAllConversationText();
      const convData = window.AITokenCounter.countDetailed(convText, model);
      totalConversationTokens = convData.tokens + currentInputTokens;

      updateDisplay(currentInputTokens, totalConversationTokens, {
        chars: inputData.chars,
        words: inputData.words,
        msgCount: msgCount
      });

      // Send to background for popup access (fire-and-forget)
      try {
        chrome.runtime.sendMessage({
          type: 'TOKEN_UPDATE',
          data: {
            platform: PLATFORM,
            inputTokens: currentInputTokens,
            totalTokens: totalConversationTokens,
            remaining: Math.max(0, CONTEXT_LIMITS[PLATFORM] - totalConversationTokens),
            contextLimit: CONTEXT_LIMITS[PLATFORM],
            model: MODEL_NAME_MAP[PLATFORM]
          }
        }).catch(() => {}); // Silently ignore if no listener (popup closed)
      } catch (e) {
        // Extension context may be invalidated — ignore
      }
    } finally {
      isUpdating = false;
    }
  }

  // ---- Debounced update for MutationObserver ----
  let mutationTimeout = null;
  function debouncedUpdate() {
    if (mutationTimeout) clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(updateTokens, 300);
  }

  // ---- Init ----
  function init() {
    // Wait for page to fully load
    setTimeout(() => {
      createOverlay();
      updateTokens();

      // Update every 500ms for real-time feel
      updateInterval = setInterval(updateTokens, 500);

      // Also update on input events (captures keypress effectively)
      document.addEventListener('input', () => setTimeout(updateTokens, 50), true);
      document.addEventListener('keyup', () => setTimeout(updateTokens, 50), true);

      // Observe DOM changes (new messages) — EXCLUDE our own widget
      const observer = new MutationObserver((mutations) => {
        // Filter out mutations inside our own overlay to prevent infinite loop
        const hasRelevantMutation = mutations.some(m => {
          const target = m.target;
          if (target.id === 'ai-token-counter-overlay') return false;
          if (target.closest && target.closest('#ai-token-counter-overlay')) return false;
          return true;
        });
        if (hasRelevantMutation) {
          debouncedUpdate();
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });

    }, 1500);
  }

  // ---- Message listener for popup communication ----
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_TOKENS') {
      // Use sendResponse callback (required for MV3 message passing)
      sendResponse({
        inputTokens: currentInputTokens,
        totalTokens: totalConversationTokens,
        remaining: Math.max(0, CONTEXT_LIMITS[PLATFORM] - totalConversationTokens),
        contextLimit: CONTEXT_LIMITS[PLATFORM],
        platform: PLATFORM,
        model: MODEL_NAME_MAP[PLATFORM]
      });
      return false; // Synchronous response
    }
    if (msg.type === 'TOGGLE_OVERLAY') {
      if (overlayEl) {
        const isHidden = overlayEl.style.display === 'none';
        overlayEl.style.display = isHidden ? 'flex' : 'none';
        // Persist toggle state
        chrome.storage.local.set({ atcOverlayVisible: isHidden });
      }
      return false;
    }
    return false;
  });

  init();
})();
