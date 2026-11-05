/**
 * Lumina AI Assistant (Copilot) Component
 * Interactive, role-aware floating assistant widget for all authenticated users.
 */

import { AIService } from '/js/services/ai-service.js';
import { getAISuggestions } from '/js/components/ai-suggestions.js';
import { getUserProfile } from '/js/auth.js';
import { showToast } from '/js/components/toast.js';

function getCurrentRoute() {
  return window.location.hash.slice(1).split('?')[0] || '/';
}

class AIAssistantWidget {
  constructor() {
    this.isOpen = false;
    this.isLoading = false;
    this.messages = [];
    this.container = null;
    this.initialized = false;
    this.suggestionPage = 0;
    this.contextStudentId = null;
    this.contextLoadedFor = null;
    this.contextLoading = null;
    this.contextLoadingFor = null;
    this.attendanceContext = '';
    this.attendanceInsight = null;
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
    return getAISuggestions(role).map(([icon, text]) => ({ icon, text }));
  }

  mount() {
    if (this.initialized && document.getElementById('lumina-ai-container')) {
      const targetId = this.resolveContextStudentId();
      if (targetId !== this.contextStudentId) {
        this.contextStudentId = targetId;
        this.contextLoadedFor = null;
        this.attendanceContext = '';
        this.attendanceInsight = null;
        if (targetId) this.refreshAttendanceContext(targetId);
      }
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
    this.contextStudentId = this.resolveContextStudentId();
    this.refreshServiceStatus();
    if (this.contextStudentId) this.refreshAttendanceContext(this.contextStudentId);
  }

  unmount() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.isOpen = false;
    this.initialized = false;
  }

  render() {
    const user = getUserProfile();
    const role = (user?.role || 'STUDENT').toUpperCase();
    const suggestions = this.getRoleSuggestions(role);

    this.container.innerHTML = `
      <!-- Floating Action Button -->
      <button class="lumina-ai-fab" id="lumina-ai-fab-btn" title="Open Lumina AI Copilot (Ctrl + /)">
        <div class="lumina-ai-fab-icon-wrap">
          <div class="lumina-ai-fab-pulse"></div>
          <i class="ph-fill ph-sparkle"></i>
        </div>
        <span>AI Copilot</span>
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
                Lumina AI
              </div>
              <div class="lumina-ai-status">
                <span class="lumina-ai-status-dot checking" id="lumina-ai-status-dot"></span>
                <span id="lumina-ai-status-text">Checking AI connection…</span>
              </div>
            </div>
          </div>
          <div class="lumina-ai-header-actions">
            <button class="lumina-ai-btn-icon" id="lumina-ai-clear-btn" title="Clear Conversation">
              <i class="ph ph-trash"></i>
            </button>
            <button class="lumina-ai-btn-icon" id="lumina-ai-close-btn" title="Close (Ctrl + /)">
              <i class="ph ph-x"></i>
            </button>
          </div>
        </div>

        <!-- Messages Body -->
        <div class="lumina-ai-body" id="lumina-ai-messages-body">
          ${this.messages.length === 0 ? this.renderWelcomeState(suggestions) : this.renderMessagesList()}
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
            AI can make mistakes. Check important details.
          </div>
        </div>
      </div>
    `;
  }

  renderWelcomeState(suggestions) {
    return `
      <div class="lumina-ai-welcome">
        <div class="lumina-ai-welcome-title">What do you need help with?</div>
        <div class="lumina-ai-welcome-desc">Choose an idea or type your question below.</div>

        ${this.renderAttendanceInsight()}
        <div class="lumina-ai-chips-title">Suggestions</div>
        <div class="lumina-ai-chips">
          ${this.getVisibleSuggestions(suggestions).map(s => `
            <button class="lumina-ai-chip" data-prompt="${escapeHtmlAttr(s.text)}">
              <i class="ph ${s.icon}"></i>
              <span>${escapeHtml(s.text)}</span>
            </button>
          `).join('')}
        </div>
        ${suggestions.length > 3 ? `<button type="button" class="lumina-ai-more-suggestions" data-more-suggestions>${this.suggestionPage >= Math.ceil(suggestions.length / 3) - 1 ? 'Start over' : 'More suggestions'}</button>` : ''}
      </div>
    `;
  }

  getVisibleSuggestions(suggestions) {
    const pageCount = Math.max(1, Math.ceil(suggestions.length / 3));
    this.suggestionPage = this.suggestionPage % pageCount;
    const pageItems = suggestions.slice(this.suggestionPage * 3, this.suggestionPage * 3 + 3);
    const contextual = this.attendanceInsight ? [{ icon: 'ph-sparkle', text: this.attendanceInsight.prompt }] : [];
    return [...contextual, ...pageItems];
  }

  renderAttendanceInsight() {
    if (!this.attendanceInsight) return '';
    return `<div class="lumina-ai-attendance-insight" role="status"><strong><i class="ph ph-calendar-check"></i> ${escapeHtml(this.attendanceInsight.title)}</strong><span>${escapeHtml(this.attendanceInsight.detail)}</span></div>`;
  }

  resolveContextStudentId(explicitId = null) {
    const user = getUserProfile();
    const role = String(user?.role || '').toUpperCase();
    if (role === 'STUDENT') return user?.id || user?.uid || null;
    if (explicitId) return String(explicitId);
    const hash = String(window.location.hash || '');
    const queryIndex = hash.indexOf('?');
    return queryIndex >= 0 ? new URLSearchParams(hash.slice(queryIndex + 1)).get('studentId') : null;
  }

  async refreshServiceStatus() {
    const statusText = document.getElementById('lumina-ai-status-text');
    if (!statusText) return;
    try {
      const status = await AIService.getStatus();
      if (status.configured) {
        this.updateServiceStatus('AI available', 'ready');
      } else {
        this.updateServiceStatus('Offline guidance', 'offline');
      }
    } catch (_) {
      this.updateServiceStatus('Offline guidance', 'offline');
    }
  }

  updateServiceStatus(message, state = 'ready') {
    const status = document.getElementById('lumina-ai-status-text');
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
    const dot = document.getElementById('lumina-ai-status-dot');
    if (dot) dot.className = `lumina-ai-status-dot ${state === 'ready' ? '' : state === 'offline' ? 'offline' : 'checking'}`.trim();
  }

  async refreshAttendanceContext(studentId) {
    const targetId = this.resolveContextStudentId(studentId);
    if (!targetId) return;
    if (this.contextLoadedFor === targetId) return;
    if (this.contextLoading && this.contextLoadingFor === targetId) return this.contextLoading;
    this.contextStudentId = targetId;
    this.attendanceContext = '';
    this.attendanceInsight = null;
    this.contextLoadingFor = targetId;
    const loadPromise = (async () => {
      try {
        const user = getUserProfile();
        const role = String(user?.role || '').toUpperCase();
        const [{ AttendanceService }, { StudentService }] = await Promise.all([
          import('/js/services/academic-service.js'),
          import('/js/services.js')
        ]);
        let student = user;
        if (role !== 'STUDENT') {
          student = await StudentService.getFresh(targetId);
          if (!student) return;
          const actorId = user?.id || user?.uid;
          if (['FACULTY', 'MENTOR'].includes(role)) {
            const mentors = [student.mentorId, student.secondaryMentorId, ...(Array.isArray(student.mentorIds) ? student.mentorIds : [])].filter(Boolean).map(String);
            if (!mentors.includes(String(actorId))) return;
          }
          if (role === 'HOD' && student.departmentId && user?.departmentId && student.departmentId !== user.departmentId) return;
          if (role === 'HOD' && !student.departmentId && student.department && user?.department && student.department !== user.department) return;
        }

        const records = (await AttendanceService.getByStudent(targetId)).filter(record =>
          /^\d{4}-\d{2}-\d{2}$/.test(String(record.date || '')) && typeof record.present === 'boolean'
        );
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const cutoff = new Date(todayStart);
        cutoff.setDate(cutoff.getDate() - 29);
        const recent = records.filter(record => {
          const date = new Date(`${record.date}T00:00:00`);
          return date >= cutoff && date <= todayStart;
        });
        const totalPresent = records.filter(record => record.present).length;
        const attendancePercent = records.length ? Math.round(totalPresent / records.length * 1000) / 10 : null;
        const recentPresent = recent.filter(record => record.present).length;
        const recentAbsent = recent.filter(record => !record.present).length;
        const lastPresent = records.find(record => record.present)?.date || null;
        const lastRecord = records[0]?.date || null;
        const rangeText = recent.length
          ? `Past 30 days: ${recentPresent} present and ${recentAbsent} absent marks across ${recent.length} recorded sessions.`
          : 'Past 30 days: no class attendance entries are recorded; this does not establish that the student was absent.';
        const overallText = attendancePercent === null
          ? (Number(student?.attendanceSessions) > 0 ? `Profile summary: ${Number(student.attendance).toFixed(1)}% across ${student.attendanceSessions} sessions; detailed register rows were unavailable.` : 'No detailed attendance register entries are available.')
          : `All available register rows: ${attendancePercent}% present across ${records.length} marked sessions.`;
        this.attendanceContext = [overallText, rangeText, `Last recorded session: ${lastRecord || 'none'}.`, `Last present mark: ${lastPresent || 'none recorded'}.`].join('\n');

        if (recent.length && recentPresent === 0 && recentAbsent > 0) {
          this.attendanceInsight = {
            title: 'No present marks in the last 30 days',
            detail: `${recentAbsent} sessions are marked absent. Confirm the register is complete; it does not explain why.`,
            prompt: role === 'STUDENT'
              ? 'My register shows no present marks over the last month. Help me ask for a register check and make a manageable catch-up plan. Do not guess why.'
              : 'Draft a supportive check-in for this student using the recorded attendance context. Include a register-completeness check and do not guess why.'
          };
        } else if (!recent.length) {
          this.attendanceInsight = {
            title: 'No attendance entries in the last 30 days',
            detail: 'Ask whether the register is up to date before treating this as an absence.',
            prompt: role === 'STUDENT'
              ? 'My attendance register has no entries for the last month. Help me ask the administrator to confirm it is up to date.'
              : 'Draft a neutral message asking the administrator to confirm whether this student’s attendance register is up to date.'
          };
        } else if (attendancePercent !== null && attendancePercent <= 40) {
          this.attendanceInsight = {
            title: `FR attendance range · ${attendancePercent}% recorded`,
            detail: `Based on ${records.length} marked sessions. Review the dates and offer supportive next steps.`,
            prompt: role === 'STUDENT'
              ? 'My recorded attendance is in the FR range. Help me make a realistic recovery plan and prepare questions for my mentor.'
              : 'Draft a non-judgmental FR attendance support plan using the recorded facts, with a student check-in and follow-up date.'
          };
        } else if (attendancePercent !== null && attendancePercent < 75) {
          this.attendanceInsight = {
            title: `Attendance below target · ${attendancePercent}% recorded`,
            detail: `Based on ${records.length} marked sessions. Verify the register and agree on practical support.`,
            prompt: role === 'STUDENT'
              ? 'My recorded attendance is below target. Help me plan how to improve it and catch up on missed material.'
              : 'Suggest a respectful check-in and practical support steps for this student’s recorded attendance below target.'
          };
        }
      } catch (error) {
        console.warn('Could not load attendance context for AI suggestions:', error);
      } finally {
        if (this.contextLoadingFor === targetId) {
          this.contextLoadedFor = targetId;
          this.contextLoading = null;
          this.contextLoadingFor = null;
          const user = getUserProfile();
          const body = document.getElementById('lumina-ai-messages-body');
          if (this.contextStudentId === targetId && body && this.messages.length === 0 && user) {
            body.innerHTML = this.renderWelcomeState(this.getRoleSuggestions(user.role));
          }
        }
      }
    })();
    this.contextLoading = loadPromise;
    return loadPromise;
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
              <button type="button" class="lumina-ai-msg-action-btn" data-speak-index="${index}" aria-label="Read this reply aloud">
                <i class="ph ph-speaker-high"></i> Read aloud
              </button>
              <span>&bull;</span>
              <button type="button" class="lumina-ai-msg-action-btn" data-copy-index="${index}">
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
    const clearBtn = document.getElementById('lumina-ai-clear-btn');
    const form = document.getElementById('lumina-ai-input-form');
    const textarea = document.getElementById('lumina-ai-input-textarea');
    const body = document.getElementById('lumina-ai-messages-body');

    // Toggle open/close
    fab?.addEventListener('click', () => this.toggleWindow());
    closeBtn?.addEventListener('click', () => this.toggleWindow(false));

    // Clear history
    clearBtn?.addEventListener('click', () => {
      if (confirm('Clear AI Assistant conversation history?')) {
        this.messages = [];
        this.suggestionPage = 0;
        this.saveHistory();
        const user = getUserProfile();
        const suggestions = this.getRoleSuggestions(user?.role);
        if (body) {
          body.innerHTML = this.renderWelcomeState(suggestions);
        }
        showToast('Chat history cleared', 'info');
      }
    });

    // Quick prompt chips click delegation
    body?.addEventListener('click', async (e) => {
      const speakButton = e.target.closest('.lumina-ai-msg-action-btn[data-speak-index]');
      if (speakButton) {
        const message = this.messages[Number(speakButton.dataset.speakIndex)];
        if (message?.content) window.dispatchEvent(new CustomEvent('lumina:speak-text', { detail: { text: message.content } }));
        return;
      }
      const copyButton = e.target.closest('.lumina-ai-msg-action-btn[data-copy-index]');
      if (copyButton) {
        const message = this.messages[Number(copyButton.dataset.copyIndex)];
        if (message && typeof message.content === 'string') {
          try {
            await navigator.clipboard.writeText(message.content);
            copyButton.textContent = 'Copied!';
            setTimeout(() => {
              if (copyButton.isConnected) copyButton.textContent = 'Copy';
            }, 2000);
          } catch (_) {
            copyButton.textContent = 'Copy failed';
          }
        }
        return;
      }
      const moreButton = e.target.closest('[data-more-suggestions]');
      if (moreButton) {
        const user = getUserProfile();
        const suggestions = this.getRoleSuggestions(user?.role);
        const pageCount = Math.max(1, Math.ceil(suggestions.length / 3));
        this.suggestionPage = (this.suggestionPage + 1) % pageCount;
        body.innerHTML = this.renderWelcomeState(suggestions);
        return;
      }
      const chip = e.target.closest('.lumina-ai-chip');
      if (chip) {
        const prompt = chip.getAttribute('data-prompt');
        if (prompt) {
          this.sendMessage(prompt, this.contextStudentId);
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
      const studentId = e.detail?.studentId || null;
      if (studentId && String(studentId) !== this.contextStudentId) {
        this.contextLoadedFor = null;
        this.attendanceContext = '';
        this.attendanceInsight = null;
        this.refreshAttendanceContext(studentId);
      }
      this.toggleWindow(true);
      if (prompt) {
        if (autoSend) {
          const contextReady = studentId ? this.refreshAttendanceContext(studentId) : Promise.resolve();
          contextReady.then(() => this.sendMessage(prompt, studentId));
        } else if (textarea) {
          textarea.value = prompt;
          textarea.focus();
        }
      }
    });

    window.addEventListener('lumina:ai-open', () => {
      this.toggleWindow(true);
    });
    window.addEventListener('lumina:voice-opened', () => this.toggleWindow(false));
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
      window.dispatchEvent(new CustomEvent('lumina:ai-opened'));
    }
  }

  async sendMessage(text, studentId = null) {
    if (!text) return;
    if (this.isLoading) {
      window.dispatchEvent(new CustomEvent('lumina:ai-response', { detail: { text: 'The assistant is still working on a response. Please try again in a moment.' } }));
      return;
    }
    const requestedStudentId = this.resolveContextStudentId(studentId || this.contextStudentId);
    if (requestedStudentId && this.contextLoadedFor !== requestedStudentId) {
      await this.refreshAttendanceContext(requestedStudentId);
    }

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
        activeRoute: activeRoute,
        attendanceContext: this.attendanceContext
      });
      this.updateServiceStatus(
        res.model === 'lumina-offline-engine' ? 'Offline guidance' : 'AI ready',
        res.model === 'lumina-offline-engine' ? 'offline' : 'ready'
      );

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
              <button type="button" class="lumina-ai-msg-action-btn" data-speak-index="${this.messages.length - 1}" aria-label="Read this reply aloud">
                <i class="ph ph-speaker-high"></i> Read aloud
              </button>
              <span>&bull;</span>
              <button type="button" class="lumina-ai-msg-action-btn" data-copy-index="${this.messages.length - 1}">
                <i class="ph ph-copy"></i> Copy
              </button>
            </div>
          </div>
        `;
        body.insertAdjacentHTML('beforeend', assistantBubbleHtml);
        this.scrollToBottom();
      }
      window.dispatchEvent(new CustomEvent('lumina:ai-response', { detail: { text: res.content } }));
    } catch (err) {
      console.error('Error in AI Assistant chat:', err);
      document.getElementById(typingIndicatorId)?.remove();
      window.dispatchEvent(new CustomEvent('lumina:ai-response', { detail: { text: `I could not get a response. ${err.message || ''}` } }));

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
