/**
 * Lumina AI Assistant Service
 * High-performance, role-aware AI copilot powered by Groq Llama 3.3 / 3.1 & Gemma models.
 * Includes fallback platform knowledge base, context injection, and specialized academic accelerators.
 */

import { GROQ_CONFIG } from '/js/config.js';
import { getUserProfile } from '/js/auth.js';

class AIServiceClass {
  constructor() {
    this.customApiKey = null;
    this.customModel = null;
  }

  getApiKey() {
    return this.customApiKey || localStorage.getItem('lumina_groq_api_key') || GROQ_CONFIG.apiKey;
  }

  setApiKey(key) {
    this.customApiKey = key;
    if (key) {
      localStorage.setItem('lumina_groq_api_key', key);
    } else {
      localStorage.removeItem('lumina_groq_api_key');
    }
  }

  getModel() {
    return this.customModel || localStorage.getItem('lumina_groq_model') || GROQ_CONFIG.defaultModel;
  }

  setModel(model) {
    this.customModel = model;
    if (model) {
      localStorage.setItem('lumina_groq_model', model);
    } else {
      localStorage.removeItem('lumina_groq_model');
    }
  }

  /**
   * Builds the role-specific "Super Prompter" system prompt.
   * Enforces zero conversational filler, maximum information density, and structured markdown.
   */
  buildSystemPrompt(user, activeRoute = '') {
    const role = (user?.role || 'STUDENT').toUpperCase();
    const name = user?.name || 'User';
    const dept = user?.department || 'University Wing';

    let rolePersona = '';

    switch (role) {
      case 'STUDENT':
        rolePersona = `Role: Lumina Student Copilot for ${name} (${dept}).
Focus Areas: High-yield study plans, exam revision roadmaps, clear mentor meeting agendas, polite issue drafting, and mentorship booklet goals.`;
        break;

      case 'FACULTY':
      case 'MENTOR':
        rolePersona = `Role: Lumina Mentor Advisor for Faculty ${name} (${dept}).
Focus Areas: 1-on-1 meeting agendas, constructive booklet review feedback, mentee risk triage, and section escalation notes.`;
        break;

      case 'HOD':
        rolePersona = `Role: Lumina Department Intelligence Advisor for HOD ${name} (${dept}).
Focus Areas: Departmental mentorship compliance, faculty allocation insights, and student risk intervention memos.`;
        break;

      case 'DEAN':
        rolePersona = `Role: Lumina Institutional Executive Advisor for Dean ${name}.
Focus Areas: University-wide mentorship health, cross-departmental compliance, and high-level escalation governance.`;
        break;

      case 'SECTION_HEAD':
        rolePersona = `Role: Lumina Operations Advisor for Section Head ${name}.
Focus Areas: Resolving escalated student requests, SOP guidance, and official ticket resolution summaries.`;
        break;

      case 'ADMIN':
        rolePersona = `Role: Lumina System Intelligence Assistant for Admin ${name}.
Focus Areas: Platform configurations, auto-allocation balancing logic, and compliance threshold management.`;
        break;

      default:
        rolePersona = `Role: Lumina University AI Copilot.`;
    }

    return `You are Lumina Super Copilot — an elite, ultra-efficient academic mentorship intelligence system at MIT-ADT University.

${rolePersona}
Current Active View: ${activeRoute || 'Dashboard'}

STRICT SUPER-PROMPTER OUTPUT RULES:
1. ZERO FLUFF: NEVER start with conversational filler (e.g. "Sure!", "Here is a plan...", "As an AI...", "I hope this helps!"). Jump directly into the solution.
2. HIGH INFORMATION DENSITY & BREVITY: Keep answers compact, punchy, and structured (typically 80 to 200 words). Maximize actionable value per sentence.
3. VISUAL STRUCTURE & CLEAN MARKDOWN:
   - Use '### ' for clean, bold headings.
   - Use bold lead-in bullet points: '• **Key Point**: Actionable detail.'
   - Use numbered lists (1., 2., 3.) only for sequential steps.
   - Use 'inline code' for terms, IDs, and route references.
   - Use tables for structured comparisons.
4. ACADEMIC EXCELLENCE: Maintain an encouraging, highly professional, and constructive tone.
5. PLATFORM INTELLIGENCE: Lumina platform features include: Mentorship Booklet (mandatory 25% completion to unlock), WebRTC Video Meetings with Waiting Room, 4-tier Issue Escalation (Mentor -> Section Head -> HOD -> Dean), and Chat messaging.`;
  }

  /**
   * Main chat completion call to Groq API with automatic model fallback.
   */
  async chat({ messages, activeRoute = '', temperature = 0.3, maxTokens = 600 }) {
    const apiKey = this.getApiKey();
    const user = getUserProfile();
    const systemPrompt = this.buildSystemPrompt(user, activeRoute);

    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    const modelsToTry = [
      this.getModel(),
      GROQ_CONFIG.fastModel,
      GROQ_CONFIG.fallbackModel
    ];

    let lastError = null;

    for (const model of modelsToTry) {
      try {
        const response = await fetch(GROQ_CONFIG.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: fullMessages,
            temperature: temperature,
            max_tokens: maxTokens
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error?.message || `Groq API returned HTTP ${response.status}`);
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content;
        if (reply) {
          return {
            content: reply.trim(),
            model: model,
            usage: data.usage
          };
        }
      } catch (err) {
        console.warn(`AIService: Model ${model} attempt failed:`, err.message);
        lastError = err;
      }
    }

    // If all models failed or network error, check offline knowledge base
    console.error('AIService all online model attempts failed. Checking offline knowledge...', lastError);
    const lastUserMsg = messages[messages.length - 1]?.content || '';
    const offlineReply = this.getOfflineKnowledgeResponse(lastUserMsg, user?.role);
    if (offlineReply) {
      return {
        content: offlineReply + "\n\n*(Note: Generated via Lumina Offline Knowledge Engine)*",
        model: 'lumina-offline-engine'
      };
    }

    throw new Error(lastError?.message || 'Could not connect to AI service. Please check your network connection.');
  }

  /**
   * Specialized In-Context Helper: Polish and articulate an issue description for student tickets.
   */
  async polishIssueDescription({ title, description, category, priority }) {
    const prompt = `Refine and structure this student issue into a concise, professional ticket (under 120 words).

Category: ${category || 'General'} | Priority: ${priority || 'Medium'} | Title: ${title}
Draft Notes: ${description}

Format strictly as:
### Summary
[1 crisp sentence]

### Details & Impact
• **Context**: [Specific issue and when it occurred]
• **Academic Impact**: [Direct impact on classes/exams/grades]

### Desired Resolution
• [Concrete requested action from faculty/section]`;

    try {
      const res = await this.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        maxTokens: 350
      });
      return res.content;
    } catch (e) {
      console.warn('AI Polish fallback:', e);
      return `### Summary\n${title}\n\n### Details\n${description}\n\n### Desired Resolution\nPlease review and advise on next steps.`;
    }
  }

  /**
   * Specialized In-Context Helper: Generate a structured agenda for a mentorship meeting.
   */
  async generateMeetingAgenda({ meetingType, topic, studentName, department }) {
    const prompt = `Generate a concise 4-point agenda (total 25 mins) for this mentorship session in under 100 words.
Student/Target: ${studentName || 'Mentee'} | Department: ${department || 'General'} | Topic: ${topic || meetingType || 'Academic Review'}

Format strictly with ### Agenda, bullet points with bold titles and time allocation.`;

    const res = await this.chat({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 300
    });
    return res.content;
  }

  /**
   * Specialized In-Context Helper: Suggest constructive mentor feedback for booklet reviews.
   */
  async suggestBookletFeedback({ studentName, goals, performanceNotes }) {
    const prompt = `Draft constructive, encouraging faculty feedback (under 120 words) for student ${studentName || 'Mentee'}'s booklet review.
Student Goals: ${goals || 'Academic improvement and placement prep'}
Observations: ${performanceNotes || 'Good attendance, active in labs, needs guidance in technical projects'}

Format as 3 concise bullet points:
• **Academic Strengths**: [Commendation]
• **Growth Areas**: [Targeted recommendations]
• **Next Milestone**: [Clear target for next semester]`;

    const res = await this.chat({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 300
    });
    return res.content;
  }

  /**
   * Offline Knowledge Base for platform workflows and university FAQs.
   */
  getOfflineKnowledgeResponse(query, role = 'STUDENT') {
    const q = query.toLowerCase();

    if (q.includes('booklet') || q.includes('25%') || q.includes('lock')) {
      return `### 📘 Mentorship Booklet Guide
The **Mentorship Booklet** is a comprehensive record of your academic journey, co-curricular achievements, and mentorship reviews.

**Key Requirements:**
1. **Mandatory 25% Completion:** Students must complete at least 25% of all booklet sections (Basic Details, Academic History, Career Goals, Strengths & Weaknesses) to unlock other dashboard features.
2. **Mentor Review:** Once filled, your mentor reviews and signs off on your entries with structured qualitative feedback.
3. **Exporting:** Mentors, HODs, and Admins can export completed booklets into official university PDFs with a single click.`;
    }

    if (q.includes('meeting') || q.includes('video') || q.includes('call') || q.includes('waiting room')) {
      return `### 🎥 Lumina Video Meetings & Waiting Room
Lumina includes a built-in serverless WebRTC video conferencing suite:

1. **Scheduling:** Mentors and students can schedule meetings directly from the **Meetings** tab.
2. **Waiting Room:** When a student joins, they enter a Waiting Room until the host mentor admits them.
3. **Screen Recording:** Mentors can record sessions with mixed microphone and screen audio.
4. **Permanent End:** When the mentor selects "End Meeting for All", the session completes securely.`;
    }

    if (q.includes('issue') || q.includes('escalat') || q.includes('ticket')) {
      return `### 🎫 Issue Escalation Matrix
Lumina provides a transparent 4-tier escalation hierarchy:

1. **Tier 1 (Mentor):** Student raises an issue (Academic, Exam, Travel, etc.). The assigned mentor attempts to resolve it.
2. **Tier 2 (Section Head):** If unresolved, the mentor escalates it to the relevant Section Head (e.g., Exam Section).
3. **Tier 3 (HOD):** Departmental matters can be escalated up to the Head of Department.
4. **Tier 4 (Dean):** University-wide or complex cases are escalated to the Dean.
All actions and status updates are tracked in the real-time timeline.`;
    }

    if (q.includes('allocate') || q.includes('mentor assign') || q.includes('auto-allocate')) {
      return `### 👥 Mentor Allocation System
Admins and HODs can allocate mentors through two methods:
1. **Algorithmic Auto-Allocation:** Evenly distributes unassigned students across active faculty members in the department up to the maximum capacity (default 20 students per mentor).
2. **Manual Allocation:** Allows granular 1-on-1 or bulk assignment of students to specific mentors or dual co-mentors.`;
    }

    return `### 🎓 Lumina AI Copilot Platform Guide
I am your Lumina Academic Assistant. You can ask me to:
- **Draft Meeting Agendas & Notes**
- **Help Write Clear Issue Descriptions**
- **Formulate Academic & Career Goals**
- **Review Mentorship Guidelines & University Policies**
- **Plan Study & Revision Timetables**

How can I assist you today?`;
  }

  /**
   * Lightweight markdown parser to render assistant outputs with code blocks, bold text, lists, and headers safely.
   */
  formatMarkdown(text) {
    if (!text) return '';
    let html = text;

    // Escape HTML entities to prevent injection
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code blocks with syntax copy button
    html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const cleanCode = code.trim();
      return `<div class="ai-code-block">
        <div class="ai-code-header">
          <span>${lang || 'text'}</span>
          <button class="ai-copy-btn" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(cleanCode)}'));this.innerText='Copied!';setTimeout(()=>this.innerText='Copy',2000);">Copy</button>
        </div>
        <pre><code>${cleanCode}</code></pre>
      </div>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h4 class="ai-md-h4">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 class="ai-md-h3">$1</h3>');
    html = html.replace(/^# (.*$)/gim, '<h2 class="ai-md-h2">$1</h2>');

    // Bold and Italics
    html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Unordered lists
    html = html.replace(/^\s*[-*]\s+(.*)$/gim, '<li class="ai-md-li">$1</li>');
    html = html.replace(/(<li class="ai-md-li">.*<\/li>)/gms, '<ul class="ai-md-ul">$1</ul>');

    // Ordered lists
    html = html.replace(/^\s*(\d+)\.\s+(.*)$/gim, '<li class="ai-md-oli"><span class="oli-num">$1.</span> $2</li>');
    html = html.replace(/(<li class="ai-md-oli">.*<\/li>)/gms, '<ol class="ai-md-ol">$1</ol>');

    // Paragraphs / Linebreaks
    html = html.replace(/\n\n/g, '<div class="ai-md-p-gap"></div>');
    html = html.replace(/\n/g, '<br/>');

    return html;
  }
}

export const AIService = new AIServiceClass();
