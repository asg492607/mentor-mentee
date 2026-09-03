/**
 * Lumina AI Assistant (Copilot) Component
 * Interactive, role-aware floating assistant widget for all authenticated users.
 */

import { AIService } from '/js/services/ai-service.js';
import { getUserProfile } from '/js/auth.js';
import { getCurrentRoute } from '/js/router.js';
import { showToast } from '/js/components/toast.js';

class AIAssistantWidget {
  constructor() {
    this.isOpen = false;
    this.isFullscreen = false;
    this.isLoading = false;
    this.messages = [];
    this.container = null;
    this.initialized = false;
  }

  getStorageKey() {
    const user = getUserProfile();
    const uid = user?.id || user?.uid || 'guest';
    return `lumina_ai_chat_${uid}`;
  }

  loadHistory() {
    try {
      const stored = localStorage.getItem(this.getStorageKey());
      if (stored) {
        this.messages = JSON.parse(stored);
      } else {
        this.messages = [];
      }
    } catch (e) {
      this.messages = [];
    }
  }

  saveHistory() {
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(this.messages.slice(-30)));
    } catch (e) {
      console.warn('Failed to save AI chat history:', e);
    }
  }

  getRoleSuggestions(role) {
    const roleUpper = (role || 'STUDENT').toUpperCase();

    switch (roleUpper) {
      case 'STUDENT':
        return [
          { icon: 'ph-calendar-check', text: 'Draft agenda for next mentor meeting' },
          { icon: 'ph-pencil-simple-line', text: 'Help me write my academic goals for this semester' },
          { icon: 'ph-warning-circle', text: 'Help me draft a clear issue description for exam section' },
          { icon: 'ph-clock-countdown', text: 'Create a 2-week revision plan for exams' },
          { icon: 'ph-book-open', text: 'How does the 25% Mentorship Booklet requirement work?' }
        ];

      case 'FACULTY':
      case 'MENTOR':
        return [
          { icon: 'ph-clipboard-text', text: 'Suggest a 4-point agenda for student 1-on-1 meeting' },
          { icon: 'ph-chat-circle-dots', text: 'Draft constructive feedback for student booklet review' },
          { icon: 'ph-chart-line-up', text: 'Pedagogical tips for students with low attendance' },
          { icon: 'ph-siren', text: 'How should I categorize a student issue before escalating?' }
        ];

      case 'HOD':
        return [
          { icon: 'ph-users-three', text: 'Departmental strategies for underperforming students' },
          { icon: 'ph-file-text', text: 'Draft a memo for faculty on booklet review deadlines' },
          { icon: 'ph-chart-pie-slice', text: 'Key metrics to assess departmental mentorship health' }
        ];

      case 'DEAN':
        return [
          { icon: 'ph-buildings', text: 'Institutional mentorship compliance and quality metrics' },
          { icon: 'ph-scales', text: 'University-level student grievance escalation workflow' }
        ];

      case 'SECTION_HEAD':
        return [
          { icon: 'ph-ticket', text: 'Draft a formal resolution note for an exam section ticket' },
          { icon: 'ph-list-checks', text: 'Standard operating procedures for student requests' }
        ];

      case 'ADMIN':
        return [
          { icon: 'ph-gear', text: 'Explain the auto-allocation balancing logic' },
          { icon: 'ph-cpu', text: 'System intelligence & booklet compliance thresholds' }
        ];

      default:
        return [
          { icon: 'ph-sparkle', text: 'How does Lumina Mentorship platform work?' },
          { icon: 'ph-calendar', text: 'How do video meetings and waiting rooms function?' }
        ];
    }
  }

  mount() {
    if (this.initialized && document.getElementById('lumina-ai-container')) {
      this.updateUserInfo();
      return;
    }

    const user = getUserProfile();
    if (!user) return; // Don't mount on public unauthenticated views

    this.loadHistory();

    let container = document.getElementById('lumina-ai-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'lumina-ai-container';
      document.body.appendChild(container);
    }
    this.container = container;

    this.render();
    this.setupEventListeners();
    this.initialized = true;
  }

  unmount() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.isOpen = false;
    this.initialized = false;
  }

  updateUserInfo() {
    const user = getUserProfile();
    const rolePill = document.getElementById('lumina-ai-role-tag');
    if (rolePill && user) {
      const role = (user.role || 'STUDENT').toUpperCase();
      rolePill.textContent = role === 'FACULTY' ? 'MENTOR' : role;
    }
  }

  render() {
    const user = getUserProfile();
    const role = (user?.role || 'STUDENT').toUpperCase();
    const displayRole = role === 'FACULTY' ? 'MENTOR' : role;
    const suggestions = this.getRoleSuggestions(role);

    this.container.innerHTML = `
      <!-- Floating Action Button -->
      <button class="lumina-ai-fab" id="lumina-ai-fab-btn" title="Open Lumina AI Copilot (Ctrl + /)">
        <div class="lumina-ai-fab-icon-wrap">
          <div class="lumina-ai-fab-pulse"></div>
          <i class="ph-fill ph-sparkle"></i>
        </div>
        <span>AI Copilot</span>
        <span class="lumina-ai-fab-badge">${displayRole}</span>
      </button>

      <!-- Chat Window Panel -->
      <div class="lumina-ai-window" id="lumina-ai-window">
        <!-- Header -->
        <div class="lumina-ai-header">
          <div class="lumina-ai-header-info">
            <div class="lumina-ai-avatar">
              <i class="ph-bold ph-sparkle"></i>
            </div>
            <div class="lumina-ai-header-title">
              <div class="lumina-ai-name">
                Lumina Copilot
                <span class="lumina-ai-role-pill" id="lumina-ai-role-tag">${displayRole}</span>
              </div>
              <div class="lumina-ai-status">
                <span class="lumina-ai-status-dot"></span>
                <span>Active &bull; Groq AI Core</span>
              </div>
            </div>
          </div>
          <div class="lumina-ai-header-actions">
            <button class="lumina-ai-btn-icon" id="lumina-ai-clear-btn" title="Clear Conversation">
              <i class="ph ph-trash"></i>
            </button>
            <button class="lumina-ai-btn-icon" id="lumina-ai-expand-btn" title="Toggle Fullscreen">
              <i class="ph ph-corners-out" id="lumina-ai-expand-icon"></i>
            </button>
            <button class="lumina-ai-btn-icon" id="lumina-ai-close-btn" title="Close (Ctrl + /)">
              <i class="ph ph-x"></i>
            </button>
          </div>
        </div>

        <!-- Messages Body -->
        <div class="lumina-ai-body" id="lumina-ai-messages-body">
          ${this.messages.length === 0 ? this.renderWelcomeState(user, suggestions) : this.renderMessagesList()}
        </div>

        <!-- Footer Input Bar -->
        <div class="lumina-ai-footer">
          <form id="lumina-ai-input-form" class="lumina-ai-input-wrap">
            <textarea 
              id="lumina-ai-input-textarea" 
              class="lumina-ai-textarea" 
              placeholder="Ask anything about academics, meetings, issues, or tasks..." 
              rows="1"
            ></textarea>
            <button type="submit" id="lumina-ai-submit-btn" class="lumina-ai-send-btn" title="Send Message">
              <i class="ph-bold ph-paper-plane-right"></i>
            </button>
          </form>
          <div class="lumina-ai-disclaimer">
            Lumina AI can make mistakes. Verify important academic notices.
          </div>
        </div>
      </div>
    `;
  }

  renderWelcomeState(user, suggestions) {
    const role = (user?.role || 'STUDENT').toUpperCase();
    const roleName = role === 'FACULTY' ? 'Faculty Mentor' : role.charAt(0) + role.slice(1).toLowerCase();

    return `
      <div class="lumina-ai-welcome">
        <div class="lumina-ai-welcome-icon">
          <i class="ph-duotone ph-sparkle"></i>
        </div>
        <div class="lumina-ai-welcome-title">Hello, ${user?.name || 'there'}! 👋</div>
        <div class="lumina-ai-welcome-desc">
          I am your <strong>Lumina ${roleName} Copilot</strong>. How can I assist you in your mentorship activities today?
        </div>

        <div class="lumina-ai-chips-title">Quick Actions &amp; Prompts</div>
        <div class="lumina-ai-chips">
          ${suggestions.map(s => `
            <button class="lumina-ai-chip" data-prompt="${escapeHtmlAttr(s.text)}">
              <i class="ph ${s.icon}"></i>
              <span>${s.text}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderMessagesList() {
    return this.messages.map((m, index) => {
      const isUser = m.role === 'user';
      const timeStr = m.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const formattedContent = isUser ? escapeHtml(m.content) : AIService.formatMarkdown(m.content);

      return `
        <div class="lumina-ai-msg ${isUser ? 'user' : 'assistant'}" data-index="${index}">
          <div class="lumina-ai-bubble">
            ${formattedContent}
          </div>
          <div class="lumina-ai-msg-meta">
            <span>${timeStr}</span>
            ${!isUser ? `
              <span>&bull;</span>
              <button class="lumina-ai-msg-action-btn" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(m.content)}'));this.innerText='Copied!';setTimeout(()=>this.innerHTML='<i class=\\'ph ph-copy\\'></i> Copy',2000);">
                <i class="ph ph-copy"></i> Copy
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  setupEventListeners() {
    const fab = document.getElementById('lumina-ai-fab-btn');
    const windowEl = document.getElementById('lumina-ai-window');
    const closeBtn = document.getElementById('lumina-ai-close-btn');
    const expandBtn = document.getElementById('lumina-ai-expand-btn');
    const clearBtn = document.getElementById('lumina-ai-clear-btn');
    const form = document.getElementById('lumina-ai-input-form');
    const textarea = document.getElementById('lumina-ai-input-textarea');
    const body = document.getElementById('lumina-ai-messages-body');

    // Toggle open/close
    fab?.addEventListener('click', () => this.toggleWindow());
    closeBtn?.addEventListener('click', () => this.toggleWindow(false));

    // Expand / Fullscreen
    expandBtn?.addEventListener('click', () => {
      this.isFullscreen = !this.isFullscreen;
      windowEl?.classList.toggle('fullscreen', this.isFullscreen);
      const icon = document.getElementById('lumina-ai-expand-icon');
      if (icon) {
        icon.className = this.isFullscreen ? 'ph ph-corners-in' : 'ph ph-corners-out';
      }
    });

    // Clear history
    clearBtn?.addEventListener('click', () => {
      if (confirm('Clear AI Assistant conversation history?')) {
        this.messages = [];
        this.saveHistory();
        const user = getUserProfile();
        const suggestions = this.getRoleSuggestions(user?.role);
        if (body) {
          body.innerHTML = this.renderWelcomeState(user, suggestions);
        }
        showToast('Chat history cleared', 'info');
      }
    });

    // Quick prompt chips click delegation
    body?.addEventListener('click', (e) => {
      const chip = e.target.closest('.lumina-ai-chip');
      if (chip) {
        const prompt = chip.getAttribute('data-prompt');
        if (prompt) {
          this.sendMessage(prompt);
        }
      }
    });

    // Auto-resizing textarea
    textarea?.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
    });

    // Submit on Enter (without Shift)
    textarea?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form?.dispatchEvent(new Event('submit'));
      }
    });

    // Form submit handler
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = textarea?.value.trim();
      if (!text || this.isLoading) return;
      textarea.value = '';
      textarea.style.height = 'auto';
      this.sendMessage(text);
    });

    // Keyboard shortcut: Ctrl + / or Cmd + /
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        this.toggleWindow();
      }
    });

    // Custom Event Listener for in-context triggers
    window.addEventListener('lumina:ai-prompt', (e) => {
      const prompt = e.detail?.prompt;
      const autoSend = e.detail?.autoSend !== false;
      this.toggleWindow(true);
      if (prompt) {
        if (autoSend) {
          this.sendMessage(prompt);
        } else if (textarea) {
          textarea.value = prompt;
          textarea.focus();
        }
      }
    });

    window.addEventListener('lumina:ai-open', () => {
      this.toggleWindow(true);
    });
  }

  toggleWindow(forceState = null) {
    const windowEl = document.getElementById('lumina-ai-window');
    if (!windowEl) return;

    this.isOpen = forceState !== null ? forceState : !this.isOpen;
    windowEl.classList.toggle('open', this.isOpen);

    if (this.isOpen) {
      const textarea = document.getElementById('lumina-ai-input-textarea');
      setTimeout(() => textarea?.focus(), 150);
      this.scrollToBottom();
    }
  }

  async sendMessage(text) {
    if (!text || this.isLoading) return;

    const body = document.getElementById('lumina-ai-messages-body');
    const submitBtn = document.getElementById('lumina-ai-submit-btn');
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Append user message
    const userMsg = { role: 'user', content: text, time: timeStr };
    this.messages.push(userMsg);
    this.saveHistory();

    // If first message, replace welcome state
    if (this.messages.length === 1 && body) {
      body.innerHTML = '';
    }

    // Append user bubble
    if (body) {
      const userBubbleHtml = `
        <div class="lumina-ai-msg user">
          <div class="lumina-ai-bubble">${escapeHtml(text)}</div>
          <div class="lumina-ai-msg-meta"><span>${timeStr}</span></div>
        </div>
      `;
      body.insertAdjacentHTML('beforeend', userBubbleHtml);
    }

    // Append typing indicator
    const typingIndicatorId = 'lumina-ai-typing-indicator';
    if (body) {
      const typingHtml = `
        <div class="lumina-ai-typing" id="${typingIndicatorId}">
          <div class="lumina-ai-dot"></div>
          <div class="lumina-ai-dot"></div>
          <div class="lumina-ai-dot"></div>
        </div>
      `;
      body.insertAdjacentHTML('beforeend', typingHtml);
      this.scrollToBottom();
    }

    this.isLoading = true;
    if (submitBtn) submitBtn.disabled = true;

    try {
      const activeRoute = getCurrentRoute();
      // Format messages payload for Groq
      const apiMessages = this.messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }));

      const res = await AIService.chat({
        messages: apiMessages,
        activeRoute: activeRoute
      });

      // Remove typing indicator
      document.getElementById(typingIndicatorId)?.remove();

      const assistantTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const assistantMsg = {
        role: 'assistant',
        content: res.content,
        model: res.model,
        time: assistantTime
      };

      this.messages.push(assistantMsg);
      this.saveHistory();

      if (body) {
        const assistantBubbleHtml = `
          <div class="lumina-ai-msg assistant">
            <div class="lumina-ai-bubble">${AIService.formatMarkdown(res.content)}</div>
            <div class="lumina-ai-msg-meta">
              <span>${assistantTime}</span>
              <span>&bull;</span>
              <button class="lumina-ai-msg-action-btn" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(res.content)}'));this.innerText='Copied!';setTimeout(()=>this.innerHTML='<i class=\\'ph ph-copy\\'></i> Copy',2000);">
                <i class="ph ph-copy"></i> Copy
              </button>
            </div>
          </div>
        `;
        body.insertAdjacentHTML('beforeend', assistantBubbleHtml);
        this.scrollToBottom();
      }
    } catch (err) {
      console.error('Error in AI Assistant chat:', err);
      document.getElementById(typingIndicatorId)?.remove();

      if (body) {
        const errorHtml = `
          <div class="lumina-ai-msg assistant">
            <div class="lumina-ai-bubble" style="border-color:rgba(239,68,68,0.4);background:rgba(239,68,68,0.05);color:#fca5a5;">
              ⚠️ <strong>Error:</strong> ${escapeHtml(err.message || 'Could not fetch response.')}
            </div>
          </div>
        `;
        body.insertAdjacentHTML('beforeend', errorHtml);
        this.scrollToBottom();
      }
    } finally {
      this.isLoading = false;
      if (submitBtn) submitBtn.disabled = false;
      this.scrollToBottom();
    }
  }

  scrollToBottom() {
    const body = document.getElementById('lumina-ai-messages-body');
    if (body) {
      setTimeout(() => {
        body.scrollTop = body.scrollHeight;
      }, 50);
    }
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeHtmlAttr(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;');
}

export const aiAssistantWidget = new AIAssistantWidget();

export function initAIAssistant() {
  aiAssistantWidget.mount();
}

export function openAIAssistantWithPrompt(prompt, autoSend = true) {
  window.dispatchEvent(new CustomEvent('lumina:ai-prompt', {
    detail: { prompt, autoSend }
  }));
}
