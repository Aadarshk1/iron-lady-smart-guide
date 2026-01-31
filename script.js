let step = 0;
let lead = {};

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('userInput');
  const chips = document.querySelectorAll('.chip');
  const form = document.getElementById('chatForm');

  // autosize textarea
  input.addEventListener('input', autoGrow);
  autoGrow({ target: input });

  // Enter (no shift) to send from textarea
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });

  form.addEventListener('submit', sendMessage);

  chips.forEach(ch => ch.addEventListener('click', () => {
    const text = ch.textContent.trim();
    // restart the conversation flow so chips always act like topic answers
    step = 1;
    lead = {};

    // remove any current typing indicators
    document.querySelectorAll('.typing').forEach(d => d.remove());

    input.value = text;
    autoGrow({ target: input });
    input.focus();

    // send immediately when chip clicked
    setTimeout(() => form.dispatchEvent(new Event('submit', { cancelable: true })), 50);
  }));

  // clear history button
  const clearBtn = document.getElementById('clearBtn');
  if (clearBtn) clearBtn.addEventListener('click', clearHistory);

  // theme toggle initialization
  const themeToggle = document.getElementById('themeToggle');

  function applyTheme(t){
    try{ document.body.setAttribute('data-theme', t); }catch(e){}
    if (themeToggle){
      const ic = themeToggle.querySelector('.icon');
      if (ic) ic.textContent = (t === 'dark') ? '🌙' : '☀️';
    }
    localStorage.setItem('prefTheme', t);
  }

  function toggleTheme(){
    const cur = document.body.getAttribute('data-theme') || 'light';
    applyTheme(cur === 'light' ? 'dark' : 'light');
  }

  // set initial theme from stored preference or system
  const savedTheme = localStorage.getItem('prefTheme');
  const systemPref = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  applyTheme(savedTheme || systemPref);

  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

  // welcome message
  appendBotMessage('Hello! I\'m your Iron Lady assistant — tell me what you\'d like help with (e.g., leadership, career growth, or confidence).');
});

function sendMessage(e){
  if (e && e.preventDefault) e.preventDefault();
  const input = document.getElementById('userInput');
  const chatBox = document.getElementById('chatBox');
  const message = input.value.trim();

  if (!message) return flashEmpty(input);

  // append user message node
  const userEl = createMessageEl('user', escapeHtml(message));
  chatBox.appendChild(userEl.row);
  chatBox.scrollTop = chatBox.scrollHeight;
  input.value = '';
  autoGrow({ target: input });
  input.focus();

  // typing indicator
  const typingEl = createMessageEl('bot', '', {typing:true});
  chatBox.appendChild(typingEl.row);
  chatBox.scrollTop = chatBox.scrollHeight;

  setTimeout(() => {
    const reply = getAIResponse(message);
    // replace typing with reply
    typingEl.row.remove();
    const botEl = createMessageEl('bot', escapeHtml(reply));
    chatBox.appendChild(botEl.row);
    chatBox.scrollTop = chatBox.scrollHeight;
  }, 700);
}

function autoGrow(e) {
  const ta = e.target;
  ta.style.height = 'auto';
  ta.style.height = (ta.scrollHeight) + 'px';
}

function createMessageEl(kind, text, opts={}){
  const row = document.createElement('div');
  row.className = 'msg-row ' + kind;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = kind === 'user' ? 'Y' : 'AI';

  const bubble = document.createElement('div');
  bubble.className = 'msg ' + kind;
  bubble.innerHTML = `<div class="content">${text}</div>`;

  const meta = document.createElement('span');
  meta.className = 'meta';
  const now = new Date();
  meta.textContent = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  bubble.appendChild(meta);

  if (kind === 'user'){
    row.appendChild(bubble);
    row.appendChild(avatar);
  } else {
    row.appendChild(avatar);
    row.appendChild(bubble);
  }

  if (opts.typing){
    const dots = document.createElement('div');
    dots.className = 'typing';
    dots.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
    bubble.innerHTML = '';
    bubble.appendChild(dots);
    bubble.appendChild(meta);
  }

  return {row, bubble};
}

function appendBotMessage(text){
  const chatBox = document.getElementById('chatBox');
  const botEl = createMessageEl('bot', escapeHtml(text));
  chatBox.appendChild(botEl.row);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function flashEmpty(el){
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 400);
  el.focus();
}

// store last cleared messages and state for undo
let lastCleared = null;
let lastState = null;

function clearHistory(){
  const chatBox = document.getElementById('chatBox');
  if (!chatBox) return;

  // Save current messages and state for undo
  lastCleared = chatBox.innerHTML;
  lastState = { step, lead: JSON.parse(JSON.stringify(lead)) };

  // Clear messages only (keep leads in localStorage)
  chatBox.innerHTML = '';
  step = 0;
  lead = {};

  appendBotMessage('Conversation cleared.');

  // Show a toast with Undo option
  showToast('Conversation cleared', {
    undoLabel: 'Undo',
    duration: 6000,
    onUndo: () => {
      // restore messages and state
      chatBox.innerHTML = lastCleared || '';
      if (lastState){
        step = lastState.step;
        lead = lastState.lead;
      }
      lastCleared = null;
      lastState = null;
      appendBotMessage('Conversation restored.');
    },
    onTimeout: () => {
      // finalize clear: do nothing to stored leads, just drop undo state
      lastCleared = null;
      lastState = null;
    }
  });
}

function showToast(message, opts = {}){
  const area = document.getElementById('toastArea');
  if (!area) return;
  const toast = document.createElement('div');
  toast.className = 'toast';

  const msg = document.createElement('div');
  msg.className = 'message';
  msg.textContent = message;
  toast.appendChild(msg);

  let timeoutId = null;

  if (opts.undoLabel && typeof opts.onUndo === 'function'){
    const btn = document.createElement('button');
    btn.className = 'undo';
    btn.type = 'button';
    btn.textContent = opts.undoLabel;
    btn.addEventListener('click', () => {
      clearTimeout(timeoutId);
      opts.onUndo();
      removeToast(toast);
    });
    toast.appendChild(btn);
  }

  area.appendChild(toast);

  const duration = opts.duration || 5000;
  timeoutId = setTimeout(() => {
    removeToast(toast);
    if (typeof opts.onTimeout === 'function') opts.onTimeout();
  }, duration);

  return toast;
}

function removeToast(el){
  if (!el) return;
  el.classList.add('fade-out');
  setTimeout(() => el.remove(), 180);
}

function escapeHtml(str){
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getAIResponse(message) {
  message = message.toLowerCase();

  if (step === 0) {
    step++;
    return "Great! Are you looking for career growth, leadership development, or confidence building?";
  }

  if (step === 1) {
    if (message.includes("leadership")) {
      lead.goal = "Leadership";
      step++;
      return "Excellent choice! Are you an early-career or mid/senior-level professional?";
    }
    if (message.includes("career")) {
      lead.goal = "Career Growth";
      step++;
      return "Nice! How many years of work experience do you have?";
    }
    if (message.includes("confidence")) {
      lead.goal = "Confidence Building";
      step++;
      return "That’s important. Are you currently working or preparing to re-enter the workforce?";
    }
    return "Could you clarify your main goal: career growth, leadership, or confidence?";
  }

  if (step === 2) {
    step++;
    return `Based on your interest in ${lead.goal}, I recommend our **Leadership Essentials Program**.  
It focuses on leadership mindset, communication, and career acceleration.  
May I know your **full name**?`;
  }

  if (step === 3) {
    lead.name = message;
    step++;
    return "Thanks! Please share your **email address**.";
  }

  if (step === 4) {
    lead.email = message;
    step++;
    return "Almost done 🙂 Please share your **phone number**.";
  }

  if (step === 5) {
    lead.phone = message;
    saveLead();
    step++;
    return "Thank you! Our team will contact you soon. You’re one step closer to becoming an Iron Lady 💪";
  }

  return "Happy to help! Let me know if you have more questions.";
}

function saveLead() {
  let leads = JSON.parse(localStorage.getItem("ironLadyLeads")) || [];
  leads.push(lead);
  localStorage.setItem("ironLadyLeads", JSON.stringify(leads));
}

