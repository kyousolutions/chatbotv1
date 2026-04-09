/**
 * KYOU Chat Demo – main.js
 *
 * Sends user messages to the n8n webhook.
 * A random userID is generated once per session.
 */

const WEBHOOK_BASE = 'https://n8n3.kyou.solutions/webhook-test/testbotv2';
const USER_ID = Math.random().toString(36).slice(2, 11);

const OPENING_MESSAGE = 'Hallo! Ich bin dein KI-Assistent von KYOU. Stell mir eine Frage zur Plattform — ich bin live. 👋';

const QUICK_REPLIES = [
  'Was kann KYOU?',
  'Für wen ist das?',
  'Wie läuft die Integration?',
];

document.addEventListener('DOMContentLoaded', () => {
  /* ── DOM refs ─────────────────────────────────────── */
  const messagesArea = document.getElementById('messages-area');
  const chatInput    = document.getElementById('chat-input');
  const sendBtn      = document.getElementById('send-btn');

  /* ── State ────────────────────────────────────────── */
  const history = []; // { role: 'user'|'assistant', content: string }[]
  let isLoading = false;
  let chipsEl   = null;

  /* ── Message rendering ────────────────────────────── */
  function createBubble(text, role) {
    const row = document.createElement('div');
    row.className = `message-row ${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;

    row.appendChild(bubble);
    return row;
  }

  function appendMessage(text, role) {
    const row = createBubble(text, role);
    messagesArea.appendChild(row);
    scrollToBottom();
    return row;
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesArea.scrollTop = messagesArea.scrollHeight;
    });
  }

  /* ── Opening message ──────────────────────────────── */
  function showOpeningMessage() {
    setTimeout(() => {
      const row = createBubble(OPENING_MESSAGE, 'bot');
      row.style.animationDelay = '0ms';
      messagesArea.appendChild(row);
      scrollToBottom();
    }, 320);

    setTimeout(() => {
      chipsEl = document.createElement('div');
      chipsEl.className = 'chips-row';

      QUICK_REPLIES.forEach(label => {
        const chip = document.createElement('button');
        chip.className = 'chip';
        chip.textContent = label;
        chip.addEventListener('click', () => handleChip(label));
        chipsEl.appendChild(chip);
      });

      messagesArea.appendChild(chipsEl);
      scrollToBottom();
    }, 480);
  }

  function removeChips() {
    if (chipsEl) {
      chipsEl.style.transition = 'opacity 200ms, transform 200ms';
      chipsEl.style.opacity    = '0';
      chipsEl.style.transform  = 'translateY(4px)';
      setTimeout(() => chipsEl?.remove(), 220);
      chipsEl = null;
    }
  }

  /* ── Typing indicator ─────────────────────────────── */
  function showTypingIndicator() {
    const row = document.createElement('div');
    row.className = 'message-row bot typing-row';
    row.id = 'typing-indicator';

    const bubble = document.createElement('div');
    bubble.className = 'typing-bubble';

    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.className = 'dot';
      bubble.appendChild(dot);
    }

    row.appendChild(bubble);
    messagesArea.appendChild(row);
    scrollToBottom();
  }

  function removeTypingIndicator() {
    document.getElementById('typing-indicator')?.remove();
  }

  /* ── API call (n8n webhook) ────────────────────────── */
  async function sendToAPI(userText) {
    const url = new URL(WEBHOOK_BASE);
    url.searchParams.set('userID', USER_ID);
    url.searchParams.set('anfrage_user_frontend', userText);

    const res = await fetch(url.toString());

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const text = await res.text();
    let reply;
    try {
      const data = JSON.parse(text);
      reply = data?.response ?? data?.message ?? data?.text ?? data?.output ?? text;
    } catch {
      reply = text;
    }

    history.push({ role: 'user',      content: userText });
    history.push({ role: 'assistant', content: reply    });
    return reply;
  }

  /* ── Send flow ────────────────────────────────────── */
  async function handleSend(text) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    isLoading = true;
    sendBtn.disabled = true;
    chatInput.value  = '';
    resetTextareaHeight();

    removeChips();
    appendMessage(trimmed, 'user');
    showTypingIndicator();

    try {
      const reply = await sendToAPI(trimmed);
      removeTypingIndicator();
      appendMessage(reply, 'bot');
    } catch (err) {
      removeTypingIndicator();
      appendMessage(`Fehler: ${err.message}. Bitte versuche es erneut.`, 'error');
      history.pop(); // remove failed user message so it can be retried
      console.error('[KYOU Chat]', err);
    } finally {
      isLoading = false;
      updateSendBtn();
    }
  }

  function handleChip(label) {
    if (isLoading) return;
    handleSend(label);
  }

  /* ── Textarea auto-resize ─────────────────────────── */
  function resetTextareaHeight() {
    chatInput.style.height = 'auto';
  }

  function autoResizeTextarea() {
    chatInput.style.height = 'auto';
    const lineH    = parseFloat(getComputedStyle(chatInput).lineHeight) || 22.5;
    const maxH     = lineH * 4;
    chatInput.style.height = Math.min(chatInput.scrollHeight, maxH) + 'px';
  }

  /* ── Send button state ────────────────────────────── */
  function updateSendBtn() {
    sendBtn.disabled = chatInput.value.trim().length === 0 || isLoading;
  }

  /* ── Event listeners ──────────────────────────────── */
  chatInput.addEventListener('input', () => {
    autoResizeTextarea();
    updateSendBtn();
  });

  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) handleSend(chatInput.value);
    }
  });

  sendBtn.addEventListener('click', () => {
    if (!sendBtn.disabled) handleSend(chatInput.value);
  });

  /* ── Init ─────────────────────────────────────────── */
  showOpeningMessage();
});
