// ============================================================
// TokenLens — Background Service Worker
// Minimal: only relays messages and cleans up storage on tab close
// ============================================================

// Log install
chrome.runtime.onInstalled.addListener(() => {
  console.log('[TokenLens] Installed / Updated');
});

// Relay TOKEN_UPDATE from content script → storage (keyed by tab id)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TOKEN_UPDATE' && sender.tab) {
    chrome.storage.local.set({
      [`tokens_${sender.tab.id}`]: message.data
    });
  }
  // Must return false/undefined for synchronous handling
  return false;
});

// CRITICAL: Clean up storage when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(`tokens_${tabId}`);
});
