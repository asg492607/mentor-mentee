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
   * Builds the role-specific system prompt to ensure accurate, constructive, and professional responses.
   */
  buildSystemPrompt(user, activeRoute = '') {
    const role = (user?.role || 'STUDENT').toUpperCase();
    const name = user?.name || 'User';
    const dept = user?.department || 'University Academic Wing';

    let roleGuidance = '';

    switch (role) {
      case 'STUDENT':
        roleGuidance = `You are Lumina Student Copilot, a supportive, encouraging, and highly structured academic mentor AI for student ${name}.
Your primary duties:
- Help students formulate clear, actionable study plans and exam preparation techniques.
- Guide them in writing articulate, constructive meeting agendas for their faculty mentor.
- Help students draft clear, polite, and detailed issue descriptions (e.g. academic, exam, hostel, fee, or technical tickets).
- Assist in formulating thoughtful self-reflections and academic goals for their Mentorship Booklet.
- Answer questions about Lumina platform features (Meetings, Waiting Rooms, Booklet 60% requirement, Escalation Matrix).`;
        break;

      case 'FACULTY':
      case 'MENTOR':
        roleGuidance = `You are Lumina Mentor Advisor, an executive academic assistant for faculty mentor ${name} in the ${dept} department.
Your primary duties:
- Help mentors formulate structured meeting agendas, action items, and student follow-ups.
- Draft professional, encouraging, and constructive feedback for Mentorship Booklet reviews.
- Provide pedagogical advice for supporting underperforming or high-risk students.
- Help categorize student issues and draft notes for section head or HOD escalations.
- Formulate concise summary reports of mentorship sessions.`;
        break;

      case 'HOD':
        roleGuidance = `You are Lumina Department Intelligence Advisor for Head of Department (HOD) ${name} (${dept}).
Your primary duties:
- Assist with departmental mentorship health, faculty allocation insights, and student risk assessments.
- Draft official communications, notices, or memos regarding mentorship booklet deadlines and departmental reviews.
- Guide issue escalations and multi-tier resolution workflows.`;
        break;

      case 'DEAN':
        roleGuidance = `You are Lumina University Executive Advisor for the Dean ${name}.
Your primary duties:
- Provide high-level summaries on university-wide mentorship health, cross-departmental analytics, and compliance.
- Advise on institutional escalation trends and student welfare governance.`;
        break;

      case 'SECTION_HEAD':
        roleGuidance = `You are Lumina Operations Advisor for Section Head ${name}.
Your primary duties:
- Assist in triaging escalated tickets routed to your operational section (Exam, Travel, Academic, Student Section, etc.).
- Help draft official resolution notices and standard operating procedure guidance.`;
        break;

      case 'ADMIN':
        roleGuidance = `You are Lumina System Intelligence Assistant for Administrator ${name}.
Your primary duties:
- Provide guidance on platform configurations, auto-allocation balancing, booklet compliance thresholds, and user management.
- Assist in diagnosing system workflow questions and user role assignments.`;
        break;

      default:
        roleGuidance = `You are Lumina AI Assistant, an intelligent academic copilot for the university mentorship platform.`;
    }

    return `${roleGuidance}

Current User Context:
- Name: ${name}
- Role: ${role}
- Department: ${dept}
- Active Route: ${activeRoute || 'Dashboard'}
- Institution: MIT-ADT University / Lumina Mentorship Platform

Style & Response Guidelines:
1. Be professional, clear, empathetic, and academically constructive.
2. Structure your replies using clean Markdown (headings, bullet points, numbered steps, bold highlights, tables where applicable).
3. Keep responses concise yet complete. Avoid fluff.
4. Always prioritize student welfare, academic excellence, and ethical mentorship principles.
5. If answering platform specific queries, note that Lumina features include: Mentorship Booklet (requires 60% completion), WebRTC Video Meetings with Waiting Room & Audio mixing screen recording, Multi-tier Issue Escalation (Mentor -> Section Head -> HOD -> Dean), and Chat messaging.`;
  }

  /**
   * Main chat completion call to Groq API with automatic model fallback.
   */
  async chat({ messages, activeRoute = '', temperature = 0.6, maxTokens = 1024 }) {
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
            content: reply,
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
    const prompt = `As an academic writing assistant, refine and polish the following student issue ticket into a clear, professional, well-structured description suitable for faculty and section head review.

Category: ${category || 'General'}
Priority: ${priority || 'Medium'}
Title: ${title}
Draft Description:
${description}

Provide a well-structured output in this format:
### Summary
[1-2 clear sentences summarizing the core issue]

### Details & Impact
[Bullet points elaborating on what happened and how it impacts the student's academic/campus activity]

### Desired Resolution
[Clear expected outcome or assistance requested from the mentor/section]`;

    try {
      const res = await this.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 500
      });
      return res.content;
    } catch (e) {
      console.warn('AI Polish fallback:', e);
      return `### Summary\n${title}\n\n### Details\n${description}\n\n### Requested Action\nPlease review and provide guidance on resolving this matter.`;
    }
  }

  /**
   * Specialized In-Context Helper: Generate a structured agenda for a mentorship meeting.
   */
  async generateMeetingAgenda({ meetingType, topic, studentName, department }) {
    const prompt = `Generate a concise 4-point agenda for an upcoming 1-on-1 college mentorship meeting.
Student: ${studentName || 'Student'}
Department: ${department || 'General'}
Meeting Type / Topic: ${topic || meetingType || 'General Academic Progress Review'}

Keep the points actionable, professional, and structured with allocated estimated minutes (total 20-30 mins).`;

    const res = await this.chat({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      maxTokens: 400
    });
    return res.content;
  }

  /**
   * Specialized In-Context Helper: Suggest constructive mentor feedback for booklet reviews.
   */
  async suggestBookletFeedback({ studentName, goals, performanceNotes }) {
    const prompt = `As an experienced faculty mentor, draft a warm, constructive, and actionable 3-paragraph feedback note for student ${studentName || 'the mentee'} based on their semester booklet submission.

Student Goals: ${goals || 'Improve CGPA, prepare for campus placements, complete academic project'}
Mentor Observations: ${performanceNotes || 'Consistent attendance, good technical aptitude, needs to participate more in co-curricular seminars'}

Ensure the tone is motivating, specific, and professionally aligned with university mentorship standards.`;

    const res = await this.chat({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      maxTokens: 500
    });
    return res.content;
  }

  /**
   * Offline Knowledge Base for platform workflows and university FAQs.
   */
  getOfflineKnowledgeResponse(query, role = 'STUDENT') {
    const q = query.toLowerCase();

    if (q.includes('booklet') || q.includes('60%') || q.includes('lock')) {
      return `### 📘 Mentorship Booklet Guide
The **Mentorship Booklet** is a comprehensive record of your academic journey, co-curricular achievements, and mentorship reviews.

**Key Requirements:**
1. **Mandatory 60% Completion:** Students must complete at least 60% of all booklet sections (Basic Details, Academic History, Career Goals, Strengths & Weaknesses) to unlock other dashboard features.
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
