// Keystone chatbot widget.
// Vanilla JS, no dependencies, no build step. Single script tag deployment.
// All CSS classes prefixed `kst-` so it can't collide with any host theme.
//
// Drop in:
//   <script src="/assets/js/chatbot.js" data-page="contact" defer></script>
//
// The script reads its `data-page` attribute to vary the greeting per page.

(function () {
  'use strict';

  if (window.__kstChatbotLoaded) return;
  window.__kstChatbotLoaded = true;

  // -------------------------------------------------- config

  const SCRIPT = document.currentScript;
  const PAGE = (SCRIPT && SCRIPT.dataset.page) || 'unknown';
  const API_BASE = (SCRIPT && SCRIPT.dataset.api) || ''; // empty = same origin
  const PHONE = '(519) 451-1793';
  const PHONE_HREF = 'tel:+15194511793';

  const OPENINGS = {
    contact: "Hey — I'm Keystone's virtual assistant. Are you a current client, or exploring IT services?",
    default: "Hey — I'm Keystone's virtual assistant. How can I help?",
  };
  const OPENING = OPENINGS[PAGE] || OPENINGS.default;

  // -------------------------------------------------- state

  const sessionId = uuid();
  const messages = [{ role: 'assistant', content: OPENING }];
  let isOpen = false;
  let isThinking = false;
  let leadSent = false;
  let panel, msgList, input, sendBtn, bubble;

  // -------------------------------------------------- styles

  const css = `
.kst-bubble {
  position: fixed; bottom: 20px; right: 20px;
  width: 60px; height: 60px; border-radius: 50%;
  background: #004876; color: #ffb819;
  border: none; cursor: pointer;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.12);
  display: flex; align-items: center; justify-content: center;
  z-index: 2147483000;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.kst-bubble:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22); }
.kst-bubble:focus-visible { outline: 3px solid #ffb819; outline-offset: 3px; }
.kst-bubble svg { width: 28px; height: 28px; }
.kst-bubble.kst-hidden { display: none; }

.kst-panel {
  position: fixed; bottom: 20px; right: 20px;
  width: 380px; height: 560px; max-height: calc(100vh - 40px);
  background: #ffffff; border-radius: 14px;
  box-shadow: 0 24px 56px rgba(0, 0, 0, 0.22), 0 4px 12px rgba(0, 0, 0, 0.08);
  display: flex; flex-direction: column;
  overflow: hidden;
  z-index: 2147483001;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 15px; color: #0f1b2d;
  animation: kst-pop 0.18s ease-out;
}
@keyframes kst-pop {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.kst-panel.kst-hidden { display: none; }

.kst-header {
  background: #004876; color: #ffffff;
  padding: 14px 16px;
  display: flex; align-items: center; gap: 12px;
  flex: 0 0 auto;
}
.kst-header-title { font-weight: 700; font-size: 15px; flex: 1; }
.kst-header-title span { display: block; font-weight: 400; font-size: 12px; color: rgba(255, 255, 255, 0.75); margin-top: 2px; }
.kst-header button {
  background: transparent; color: #ffffff; border: none; cursor: pointer;
  padding: 6px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
}
.kst-header button:hover { background: rgba(255, 255, 255, 0.12); }
.kst-header button:focus-visible { outline: 2px solid #ffb819; outline-offset: 1px; }

.kst-call {
  display: inline-flex; align-items: center; gap: 6px;
  background: #ffb819; color: #002339;
  padding: 6px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 700; text-decoration: none;
  white-space: nowrap;
}
.kst-call:hover { background: #ffcb55; }
.kst-call svg { width: 12px; height: 12px; }

.kst-messages {
  flex: 1; overflow-y: auto; padding: 16px;
  background: #f4f6f8;
  display: flex; flex-direction: column; gap: 10px;
  scroll-behavior: smooth;
}
.kst-msg {
  max-width: 85%; padding: 10px 13px; border-radius: 14px;
  line-height: 1.45; word-wrap: break-word; white-space: pre-wrap;
}
.kst-msg-bot {
  align-self: flex-start;
  background: #ffffff; color: #0f1b2d;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.kst-msg-user {
  align-self: flex-end;
  background: #004876; color: #ffffff;
  border-bottom-right-radius: 4px;
}
.kst-msg-system {
  align-self: center;
  background: rgba(255, 184, 25, 0.18); color: #002339;
  font-size: 13px; padding: 6px 12px; border-radius: 999px;
}

.kst-typing {
  align-self: flex-start;
  background: #ffffff;
  padding: 12px 14px; border-radius: 14px; border-bottom-left-radius: 4px;
  display: inline-flex; gap: 4px; align-items: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.kst-typing span {
  width: 6px; height: 6px; border-radius: 50%; background: #4a5a6e;
  animation: kst-blink 1.2s infinite ease-in-out both;
}
.kst-typing span:nth-child(2) { animation-delay: 0.15s; }
.kst-typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes kst-blink {
  0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-2px); }
}

.kst-composer {
  display: flex; gap: 8px; padding: 12px;
  background: #ffffff; border-top: 1px solid #e6eaee;
  flex: 0 0 auto;
}
.kst-composer textarea {
  flex: 1; resize: none; border: 1px solid #cdd5dd; border-radius: 10px;
  padding: 10px 12px; font: inherit; color: #0f1b2d;
  min-height: 40px; max-height: 120px; outline: none;
  font-family: inherit;
}
.kst-composer textarea:focus { border-color: #004876; box-shadow: 0 0 0 3px rgba(0, 72, 118, 0.15); }
.kst-composer textarea:disabled { background: #f4f6f8; color: #4a5a6e; }
.kst-composer button {
  background: #004876; color: #ffffff; border: none; border-radius: 10px;
  padding: 0 16px; cursor: pointer; font-weight: 600;
  display: flex; align-items: center; justify-content: center;
}
.kst-composer button:hover { background: #00345a; }
.kst-composer button:disabled { background: #cdd5dd; cursor: not-allowed; }
.kst-composer button:focus-visible { outline: 2px solid #ffb819; outline-offset: 2px; }
.kst-composer button svg { width: 18px; height: 18px; }

.kst-footer {
  text-align: center; font-size: 11px; color: #4a5a6e;
  padding: 6px 12px 10px; background: #ffffff;
}

@media (max-width: 640px) {
  .kst-panel {
    bottom: 0; right: 0; left: 0; top: 0;
    width: 100%; height: 100%; max-height: 100%;
    border-radius: 0;
  }
  .kst-bubble { bottom: 16px; right: 16px; }
}

@media (prefers-reduced-motion: reduce) {
  .kst-panel, .kst-typing span { animation: none; }
  .kst-messages { scroll-behavior: auto; }
}
`;

  // -------------------------------------------------- bootstrap

  function init() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    bubble = createBubble();
    panel = createPanel();
    document.body.appendChild(bubble);
    document.body.appendChild(panel);

    document.addEventListener('keydown', onKeyDown);
  }

  function createBubble() {
    const btn = document.createElement('button');
    btn.className = 'kst-bubble';
    btn.setAttribute('aria-label', 'Open chat with Keystone');
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    btn.addEventListener('click', open);
    return btn;
  }

  function createPanel() {
    const wrap = document.createElement('div');
    wrap.className = 'kst-panel kst-hidden';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Chat with Keystone');

    wrap.innerHTML = `
      <div class="kst-header">
        <div class="kst-header-title">Keystone Technologies<span>Usually replies in seconds</span></div>
        <a class="kst-call" href="${PHONE_HREF}" aria-label="Call Keystone at ${PHONE}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          Call
        </a>
        <button class="kst-close" aria-label="Close chat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="kst-messages" role="log" aria-live="polite" aria-atomic="false"></div>
      <form class="kst-composer">
        <label for="kst-input" class="kst-sr-only" style="position:absolute;left:-9999px;">Type your message</label>
        <textarea id="kst-input" rows="1" placeholder="Type your message..." autocomplete="off"></textarea>
        <button type="submit" aria-label="Send message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </form>
      <div class="kst-footer">Powered by AI. A real person follows up.</div>
    `;

    msgList = wrap.querySelector('.kst-messages');
    input = wrap.querySelector('textarea');
    sendBtn = wrap.querySelector('button[type="submit"]');

    wrap.querySelector('.kst-close').addEventListener('click', close);
    wrap.querySelector('.kst-composer').addEventListener('submit', onSubmit);
    input.addEventListener('keydown', onInputKeyDown);
    input.addEventListener('input', autoGrow);

    renderMessage('bot', OPENING, wrap.querySelector('.kst-messages'));
    return wrap;
  }

  // -------------------------------------------------- ui actions

  function open() {
    if (isOpen) return;
    isOpen = true;
    panel.classList.remove('kst-hidden');
    bubble.classList.add('kst-hidden');
    setTimeout(() => input && input.focus(), 50);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    panel.classList.add('kst-hidden');
    bubble.classList.remove('kst-hidden');
    bubble.focus();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape' && isOpen) close();
  }

  function onInputKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  }

  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }

  function onSubmit(e) {
    e.preventDefault();
    if (isThinking) return;
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    autoGrow();
    sendTurn(text);
  }

  // -------------------------------------------------- message flow

  async function sendTurn(userText) {
    messages.push({ role: 'user', content: userText });
    renderMessage('user', userText);
    setThinking(true);

    try {
      const resp = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages, page: PAGE, session_id: sessionId }),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      const reply = (data.reply || '').trim();
      messages.push({ role: 'assistant', content: reply });
      renderMessage('bot', reply);

      if (data.lead && !leadSent) {
        leadSent = true;
        // Fire-and-forget; failure is logged but user already saw the bot's
        // closing message so no recovery UI needed in the happy path.
        submitLead(data.lead).catch((err) => console.error('lead submit failed', err));
      }
    } catch (err) {
      console.error('chat error', err);
      renderMessage(
        'system',
        `Sorry — I'm having trouble connecting. Please call ${PHONE} or email info@keystonetech.ca.`
      );
    } finally {
      setThinking(false);
    }
  }

  async function submitLead(lead) {
    const resp = await fetch(`${API_BASE}/api/lead`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lead, session_id: sessionId }),
    });
    if (!resp.ok) throw new Error(`lead HTTP ${resp.status}`);
  }

  // -------------------------------------------------- rendering

  function renderMessage(kind, text, container) {
    const el = document.createElement('div');
    el.className = 'kst-msg kst-msg-' + (kind === 'user' ? 'user' : kind === 'system' ? 'system' : 'bot');
    el.textContent = text;
    (container || msgList).appendChild(el);
    scrollToBottom();
  }

  function setThinking(on) {
    isThinking = on;
    sendBtn.disabled = on;
    input.disabled = on;

    const existing = msgList.querySelector('.kst-typing');
    if (on && !existing) {
      const dots = document.createElement('div');
      dots.className = 'kst-typing';
      dots.setAttribute('aria-label', 'Assistant is typing');
      dots.innerHTML = '<span></span><span></span><span></span>';
      msgList.appendChild(dots);
      scrollToBottom();
    } else if (!on && existing) {
      existing.remove();
    }

    // Re-enabling a disabled input doesn't restore focus on its own.
    // Put the cursor back so the user can keep typing without clicking.
    if (!on && isOpen) {
      requestAnimationFrame(() => input.focus());
    }
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      msgList.scrollTop = msgList.scrollHeight;
    });
  }

  // -------------------------------------------------- helpers

  function uuid() {
    if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    // RFC4122 v4 fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // -------------------------------------------------- go

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
