import { getUserProfile } from '/js/auth.js';

const VOICE_CONTAINER_ID = 'lumina-voice-assistant';
const LANGUAGE_MAP = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };
const NUMBER_WORDS = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90, hundred: 100
};

function numberFromSpeech(value) {
  const tokens = value.toLowerCase().replace(/-/g, ' ').replace(/\b(and|percent|percentage)\b/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!tokens.length || !tokens.every(token => /^\d+(\.\d+)?$/.test(token) || Object.hasOwn(NUMBER_WORDS, token))) return null;
  let total = 0;
  let current = 0;
  for (const token of tokens) {
    if (/^\d+(\.\d+)?$/.test(token)) current += Number(token);
    else if (NUMBER_WORDS[token] === 100) current = Math.max(1, current) * 100;
    else current += NUMBER_WORDS[token];
  }
  total += current;
  return Number.isFinite(total) ? String(total) : null;
}

class VoiceAssistant {
  constructor() {
    this.container = null;
    this.recognition = null;
    this.lastFocusedElement = null;
    this.isListening = false;
    this.speakNextAIResponse = false;
    this.bound = false;
  }

  mount() {
    if (document.getElementById(VOICE_CONTAINER_ID)) {
      this.container = document.getElementById(VOICE_CONTAINER_ID);
      return;
    }

    const container = document.createElement('section');
    container.id = VOICE_CONTAINER_ID;
    container.innerHTML = `
      <button type="button" class="lumina-voice-launcher" data-voice-toggle aria-label="Open voice assistant" aria-expanded="false">
        <i class="ph ph-microphone" aria-hidden="true"></i><span>Voice</span>
      </button>
      <div class="lumina-voice-panel" data-voice-panel hidden aria-label="Voice assistant">
        <div class="lumina-voice-heading"><div><strong>Voice assistant</strong><p>Focus a text field to dictate, or speak a command or question.</p></div><button type="button" data-voice-close aria-label="Close voice assistant">×</button></div>
        <div class="lumina-voice-actions">
          <button type="button" class="btn btn-primary" data-voice-listen><i class="ph ph-microphone"></i> Start speaking</button>
          <button type="button" class="btn btn-secondary" data-voice-read><i class="ph ph-speaker-high"></i> Read this page</button>
          <button type="button" class="btn btn-ghost" data-voice-stop><i class="ph ph-stop"></i> Stop</button>
        </div>
        <p class="lumina-voice-status" data-voice-status role="status" aria-live="polite">Voice input starts only when you press the microphone.</p>
        <p class="lumina-voice-transcript" data-voice-transcript hidden></p>
      </div>`;
    document.body.appendChild(container);
    this.container = container;
    this.bindEvents();
  }

  bindEvents() {
    if (this.bound || !this.container) return;
    this.bound = true;
    this.container.querySelector('[data-voice-toggle]')?.addEventListener('click', () => this.togglePanel());
    this.container.querySelector('[data-voice-close]')?.addEventListener('click', () => this.togglePanel(false));
    this.container.querySelector('[data-voice-listen]')?.addEventListener('click', () => this.startListening());
    this.container.querySelector('[data-voice-read]')?.addEventListener('click', () => this.readPage());
    this.container.querySelector('[data-voice-stop]')?.addEventListener('click', () => this.stopAll());

    document.addEventListener('focusin', event => {
      if (this.isEditable(event.target) && !this.container?.contains(event.target)) this.lastFocusedElement = event.target;
    });
    window.addEventListener('lumina:ai-response', event => {
      if (!this.speakNextAIResponse) return;
      this.speakNextAIResponse = false;
      this.speak(event.detail?.text || 'I could not produce a response.');
    });
    window.addEventListener('lumina:ai-opened', () => this.togglePanel(false));
    window.addEventListener('lumina:speak-text', event => this.speak(event.detail?.text || ''));
  }

  togglePanel(force = null) {
    const panel = this.container?.querySelector('[data-voice-panel]');
    const launcher = this.container?.querySelector('[data-voice-toggle]');
    if (!panel || !launcher) return;
    const open = force === null ? panel.hidden : force;
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    if (open) {
      window.dispatchEvent(new CustomEvent('lumina:voice-opened'));
      this.setStatus(this.getRecognition() ? 'Focus a text field to dictate, or speak a command or question.' : 'Voice input is unavailable in this browser. Read aloud is still available.');
    }
  }

  setStatus(message, state = 'info') {
    const status = this.container?.querySelector('[data-voice-status]');
    if (status) {
      status.textContent = message;
      status.dataset.state = state;
    }
  }

  setTranscript(text) {
    const output = this.container?.querySelector('[data-voice-transcript]');
    if (!output) return;
    output.textContent = text;
    output.hidden = !text;
  }

  language() {
    let locale = 'en';
    try { locale = localStorage.getItem('lumina_locale') || 'en'; } catch (_) {}
    return LANGUAGE_MAP[locale] || 'en-IN';
  }

  getRecognition() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  startListening() {
    const SpeechRecognition = this.getRecognition();
    if (!SpeechRecognition) {
      this.setStatus('Voice input is not supported by this browser. Try Chrome or Edge.', 'error');
      return;
    }
    if (window.location.hash.startsWith('#/meeting-room')) {
      this.setStatus('Use the meeting caption controls while a call is active.', 'error');
      return;
    }
    this.stopSpeech();
    try { this.recognition?.abort(); } catch (_) {}
    const recognition = new SpeechRecognition();
    this.recognition = recognition;
    recognition.lang = this.language();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      this.isListening = true;
      this.container?.classList.add('is-listening');
      this.container?.querySelector('[data-voice-listen]')?.setAttribute('aria-pressed', 'true');
      this.setStatus('Listening… speak now.');
    };
    recognition.onresult = event => {
      let finalText = '';
      let interimText = '';
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const phrase = event.results[index][0]?.transcript || '';
        if (event.results[index].isFinal) finalText += phrase;
        else interimText += phrase;
      }
      if (interimText) this.setTranscript(interimText.trim());
      if (finalText.trim()) {
        const text = finalText.trim();
        this.setTranscript(text);
        this.handleTranscript(text);
      }
    };
    recognition.onerror = event => {
      const message = event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? 'Microphone access is blocked. Allow it in your browser settings, then try again.'
        : event.error === 'no-speech' ? 'No speech detected. Press the microphone and try again.'
          : 'Voice input stopped. Press the microphone to try again.';
      this.setStatus(message, 'error');
    };
    recognition.onend = () => {
      this.isListening = false;
      this.container?.classList.remove('is-listening');
      this.container?.querySelector('[data-voice-listen]')?.setAttribute('aria-pressed', 'false');
      if (this.container?.isConnected && this.container.querySelector('[data-voice-status]')?.textContent === 'Listening… speak now.') {
        this.setStatus('Ready. Press the microphone when you want to speak.');
      }
    };
    this.setTranscript('');
    try { recognition.start(); }
    catch (_) { this.setStatus('Voice input is already active. Wait a moment and try again.', 'error'); }
  }

  isEditable(element) {
    if (!(element instanceof HTMLElement) || element.isContentEditable) return Boolean(element?.isContentEditable);
    if (element instanceof HTMLTextAreaElement) return !element.disabled && !element.readOnly;
    if (element instanceof HTMLSelectElement) return !element.disabled;
    if (!(element instanceof HTMLInputElement) || element.disabled || element.readOnly) return false;
    return ['text', 'search', 'tel', 'email', 'url', 'number', 'date', 'checkbox', 'radio'].includes((element.type || 'text').toLowerCase());
  }

  getDictationTarget() {
    const active = document.activeElement;
    if (this.isEditable(active) && !this.container?.contains(active)) return active;
    return this.lastFocusedElement?.isConnected && this.isEditable(this.lastFocusedElement) ? this.lastFocusedElement : null;
  }

  insertText(target, text) {
    if (target instanceof HTMLSelectElement) {
      const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      const options = Array.from(target.options).filter(option => !option.disabled && option.value);
      const matched = options.find(option => option.textContent.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() === normalized)
        || options.find(option => option.textContent.toLowerCase().includes(normalized) || normalized.includes(option.textContent.toLowerCase()));
      if (!matched) {
        this.setStatus(`No option matched “${text}”. Say the option name and try again.`, 'error');
        return;
      }
      target.value = matched.value;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      this.setStatus(`Selected ${matched.textContent.trim()}.`);
      return;
    }
    if (target instanceof HTMLInputElement && ['checkbox', 'radio'].includes(target.type)) {
      const answer = text.toLowerCase();
      if (/\b(no|uncheck|disable|off)\b/.test(answer)) target.checked = false;
      else if (/\b(yes|check|enable|on)\b/.test(answer)) target.checked = true;
      else {
        this.setStatus('Say “check” or “uncheck” for this control.', 'error');
        return;
      }
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      this.setStatus(target.checked ? 'Checked.' : 'Unchecked.');
      return;
    }
    if (target instanceof HTMLInputElement && target.type === 'number') {
      const number = numberFromSpeech(text);
      if (number === null) {
        this.setStatus('Say a number, then try again.', 'error');
        return;
      }
      target.value = number;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      this.setStatus(`Entered ${number}.`);
      return;
    }
    if (target instanceof HTMLInputElement && target.type === 'date') {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00`) : new Date(text);
      if (Number.isNaN(date.getTime())) {
        this.setStatus('Say a date such as “March 20 2026”.', 'error');
        return;
      }
      target.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      this.setStatus(`Entered ${target.value}.`);
      return;
    }
    if (target instanceof HTMLInputElement && target.type === 'email') {
      text = text.toLowerCase().replace(/\s+at\s+/g, '@').replace(/\s+dot\s+/g, '.').replace(/\s+/g, '');
    } else if (target instanceof HTMLInputElement && target.type === 'tel') {
      const digitWords = { zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9' };
      text = text.toLowerCase().replace(/\bplus\b/g, '+').replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g, word => digitWords[word]).replace(/[\s-]+/g, '');
    }
    target.focus();
    if (target.isContentEditable) {
      const selection = window.getSelection();
      if (selection?.rangeCount) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      } else target.append(document.createTextNode(text));
    } else {
      let start = target.value.length;
      let end = start;
      try {
        if (Number.isInteger(target.selectionStart)) start = target.selectionStart;
        if (Number.isInteger(target.selectionEnd)) end = target.selectionEnd;
      } catch (_) {}
      try { target.setRangeText(text, start, end, 'end'); }
      catch (_) { target.value += `${target.value ? ' ' : ''}${text}`; }
    }
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    if (target.id === 'lumina-ai-input-textarea') {
      this.speakNextAIResponse = true;
      document.getElementById('lumina-ai-input-form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
    this.setStatus('Dictation added to the focused field.');
  }

  async handleTranscript(rawText) {
    const text = rawText.trim();
    const command = text.toLowerCase().replace(/[.,!?]+$/g, '').trim();
    if (/^(stop|stop reading|stop speaking|quiet)$/.test(command)) {
      this.stopAll();
      this.setStatus('Stopped.');
      return;
    }
    if (/^(read|read page|read this page|read the page)$/.test(command)) {
      this.readPage();
      return;
    }
    if (/^(help|voice help|what can you do)$/.test(command)) {
      this.speak('Focus a text field and press the microphone to dictate. Without a focused field, say a page name to navigate or ask me a question. You can also ask me to read the page.');
      return;
    }
    if (/^(open|show) (ai|copilot|assistant)$/.test(command)) {
      window.dispatchEvent(new CustomEvent('lumina:ai-open'));
      this.setStatus('AI assistant opened.');
      return;
    }

    const navigation = this.matchNavigation(command);
    if (navigation) {
      if (navigation.action === 'profile-modal') {
        const { openProfileModal } = await import('/js/components/profile-modal.js');
        openProfileModal();
      } else {
        window.location.hash = navigation.path;
      }
      this.setStatus(`Opening ${navigation.label}.`);
      return;
    }

    const target = this.getDictationTarget();
    if (target) {
      this.insertText(target, text);
      return;
    }

    if (!document.getElementById('lumina-ai-window')) {
      this.speak('Open your signed-in dashboard to ask the AI assistant a question.');
      return;
    }
    this.speakNextAIResponse = true;
    this.setStatus('Sending your question to the assistant…');
    window.dispatchEvent(new CustomEvent('lumina:ai-prompt', { detail: { prompt: text, autoSend: true } }));
  }

  matchNavigation(command) {
    const user = getUserProfile();
    if (!user) {
      const publicRoutes = [
        { path: '/login', label: 'sign in', aliases: ['login', 'log in'] },
        { path: '/register', label: 'register', aliases: ['registration', 'create account'] },
        { path: '/landing', label: 'home', aliases: ['landing page'] }
      ];
      const hasPublicNavigationVerb = /^(please\s+)?(go to|open|show|navigate to|take me to)\s+/.test(command);
      const normalizedPublicCommand = command.replace(/^(please\s+)?(go to|open|show|navigate to|take me to)\s+/, '').trim();
      return publicRoutes.flatMap(route => [route.label, ...route.aliases].map(alias => ({ ...route, alias })))
        .find(route => normalizedPublicCommand === route.alias || (hasPublicNavigationVerb && normalizedPublicCommand.includes(route.alias))) || null;
    }
    const role = String(user?.role || '').toUpperCase();
    const items = {
      STUDENT: [
        ['/student/dashboard', 'dashboard', ['home']], ['/chat', 'messages', ['chat']], ['/student/meetings', 'meetings', ['meeting']],
        ['/student/issues', 'issues', ['grievances']], ['/student/tasks', 'tasks', ['goals']], ['/student/profile', 'profile', ['my profile']],
        ['/student/booklet', 'booklet', ['mentorship booklet']], ['/student/academics', 'academics', ['academic record', 'marks']]
      ],
      STAFF: [
        ['/mentor/dashboard', 'dashboard', ['home']], ['/chat', 'messages', ['chat']], ['/mentor/meetings', 'meetings', ['meeting']],
        ['/mentor/issues', 'issues', ['grievances']], ['/mentor/students', 'students', ['my students']], ['/mentor/reports', 'reports', ['analytics']],
        ['#profile-modal', 'profile', ['my profile'], 'profile-modal']
      ],
      HOD: [
        ['/hod/dashboard', 'dashboard', ['home']], ['/hod/allocation', 'allocation', ['mentor allocation']], ['/hod/management', 'management', ['academic management']],
        ['/hod/directory', 'users', ['directory']], ['/hod/risk-students', 'risk students', ['at risk students']], ['/hod/escalations', 'escalations', ['issues']], ['/hod/reports', 'reports', ['analytics']],
        ['#profile-modal', 'profile', ['my profile'], 'profile-modal']
      ],
      DEAN: [
        ['/dean/dashboard', 'dashboard', ['home']], ['/dean/management', 'management', ['academic management']], ['/dean/directory', 'users', ['directory']],
        ['/dean/analytics', 'analytics', ['reports']], ['/dean/allocation', 'allocation', ['mentor allocation']], ['/dean/escalations', 'escalations', ['issues']], ['/dean/reports', 'mentor reports'],
        ['#profile-modal', 'profile', ['my profile'], 'profile-modal']
      ],
      SECTION_HEAD: [
        ['/section/dashboard', 'dashboard', ['home', 'admissions']], ['/section/escalations', 'escalations', ['issues']], ['#profile-modal', 'profile', ['my profile'], 'profile-modal']
      ],
      ADMIN: [
        ['/admin/dashboard', 'dashboard', ['home']], ['/admin/marks', 'marks', ['results']], ['/admin/attendance', 'attendance'], ['/admin/compliance', 'compliance', ['booklet compliance']],
        ['/admin/users', 'users', ['directory']], ['/admin/departments', 'departments', ['classes', 'organization']], ['/admin/allocation', 'allocation', ['mentor allocation']],
        ['/admin/settings', 'settings'], ['/admin/security-logs', 'security logs'], ['/admin/infrastructure', 'system intelligence'], ['#profile-modal', 'profile', ['my profile'], 'profile-modal']
      ]
    };
    const roleKey = role === 'FACULTY' || role === 'MENTOR' ? 'STAFF' : role;
    const routes = items[roleKey] || [];
    const hasNavigationVerb = /^(please\s+)?(go to|open|show|navigate to|take me to)\s+/.test(command);
    const normalized = command.replace(/^(please\s+)?(go to|open|show|navigate to|take me to)\s+/, '').trim();
    const matches = routes.flatMap(([path, label, aliases = [], action]) => [label, ...aliases].map(alias => ({ path, label, action, alias })))
      .filter(item => normalized === item.alias || (hasNavigationVerb && normalized.includes(item.alias)))
      .sort((left, right) => right.alias.length - left.alias.length);
    return matches[0] || null;
  }

  pageText() {
    const root = document.getElementById('app');
    if (!root) return '';
    const text = root.innerText.replace(/\n{3,}/g, '\n\n').trim();
    return text.slice(0, 4200);
  }

  readPage() {
    if (window.location.hash.startsWith('#/meeting-room')) {
      this.setStatus('Use meeting captions during a call. Read aloud is paused to avoid audio feedback.', 'error');
      return;
    }
    const content = this.pageText();
    if (!content) {
      this.setStatus('There is no page content to read.', 'error');
      return;
    }
    this.speak(`Here is this page. ${content}`);
  }

  speak(text) {
    if (window.location.hash.startsWith('#/meeting-room')) {
      this.setStatus('Read aloud is paused during a call to avoid audio feedback.', 'error');
      return;
    }
    if (!('speechSynthesis' in window) || !window.SpeechSynthesisUtterance) {
      this.setStatus('Read aloud is not supported by this browser.', 'error');
      return;
    }
    const plainText = String(text || '').replace(/<[^>]*>/g, ' ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/https?:\/\/\S+/g, '').replace(/[`*_#>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 5000);
    if (!plainText) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.lang = this.language();
    utterance.rate = 1;
    utterance.onstart = () => this.setStatus('Reading aloud…');
    utterance.onend = () => this.setStatus('Finished reading.');
    utterance.onerror = () => this.setStatus('Could not play speech. Check your device audio settings.', 'error');
    window.speechSynthesis.speak(utterance);
  }

  stopSpeech() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  stopAll() {
    this.stopSpeech();
    try { this.recognition?.abort(); } catch (_) {}
    this.isListening = false;
    this.container?.classList.remove('is-listening');
    this.container?.querySelector('[data-voice-listen]')?.setAttribute('aria-pressed', 'false');
  }

  unmount() {
    this.stopAll();
    this.container?.remove();
    this.container = null;
    this.bound = false;
    this.speakNextAIResponse = false;
  }
}

export const voiceAssistantWidget = new VoiceAssistant();
export function initVoiceAssistant() { voiceAssistantWidget.mount(); }
