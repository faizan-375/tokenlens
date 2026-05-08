# 🔍 TokenLens — Chrome Extension

**Know your tokens.** Live token counter on ChatGPT, Claude & Gemini — so you always know what's left.

---

## ✅ Supported Platforms
| Platform | URL | Accuracy |
|----------|-----|----------|
| ChatGPT | chat.openai.com / chatgpt.com | ~99% |
| Claude | claude.ai | ~97% |
| Gemini | gemini.google.com | ~95% |

---

## 📦 Installation (Step by Step)

### Step 1: Extract the ZIP
- Extract `tokenlens.zip` to a folder
- Example: `C:\Users\YourName\tokenlens\`

### Step 2: Open Chrome Extensions
- Open Chrome browser
- Go to: `chrome://extensions/`
- OR click Menu (⋮) → Extensions → Manage Extensions

### Step 3: Enable Developer Mode
- Toggle "Developer mode" ON in the top-right corner

### Step 4: Load Extension
- Click "Load unpacked"
- Select the folder where you extracted the files
- The extension will be installed!

### Step 5: Use It!
- Open ChatGPT, Claude, or Gemini
- A token counter widget will appear in the bottom-right corner
- Drag the widget to move it anywhere on the page

---

## 🎯 Features

- **Real-time counting** — Tokens update as you type
- **Input tokens** — See tokens for what you're currently typing
- **Conversation total** — Total tokens for the entire conversation
- **Context window** — Visual progress bar showing context usage
- **Remaining tokens** — Big, clear display of how many tokens are left
- **Warning banners** — Alerts at 75% and 90% context usage
- **Color system** — Green (>40% free), Yellow (20-40% free), Red (<20% free)
- **Cost estimate** — Approximate API cost display
- **Draggable widget** — Move it anywhere on the page
- **Minimize** — Collapse to just the header bar
- **100% local** — Zero network requests, zero data collection

---

## 🔬 How Token Counting Works

Different AI companies use different tokenizers:

- **GPT (OpenAI)**: cl100k_base BPE tokenizer (multiplier: 1.00x)
- **Claude (Anthropic)**: Custom BPE, similar to GPT (multiplier: 1.02x)
- **Gemini (Google)**: SentencePiece tokenizer (multiplier: 0.97x)

TokenLens uses an advanced JavaScript tokenizer that:
1. Splits text using the exact same regex pattern as tiktoken cl100k_base
2. Encodes each word to byte-level representation
3. Detects script type (English, Arabic/Urdu, Chinese/CJK, Devanagari)
4. Applies model-specific multipliers for accuracy

**Accuracy:** ~95-99% for English, ~90-95% for Arabic/Urdu, ~90% for CJK

---

## 📊 Context Limits

| Model | Context Window |
|-------|---------------|
| GPT-4 | 128,000 tokens |
| Claude | 200,000 tokens |
| Gemini | 1,000,000 tokens |

---

## 🔒 Privacy

- **Zero network requests** — enforced via Content Security Policy
- **No data collection** — everything runs 100% locally
- **Minimal permissions** — only `activeTab` and `storage`
- **Auto-cleanup** — tab data deleted when tab closes
- Full privacy policy bundled at `privacy-policy.html`

---

## ⚠️ Note
This extension counts tokens client-side using a BPE approximation.
For exact server-side counts, check the API's `usage` field in responses.
