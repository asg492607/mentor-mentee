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
   * AI Meeting Insights Extractor — parses transcript, chat, notes, and attendees
   * to auto-generate structured meeting report fields.
   */
  async extractMeetingInsights({ transcript = '', chatMessages = '', notes = '', meetingTopic = '', studentName = '', department = '', attendees = [] }) {
    const attendeeStr = attendees.length > 0
      ? attendees.map((a, i) => `${i + 1}. ${a.name || 'Unknown'}${a.enrollment ? ' (' + a.enrollment + ')' : ''}`).join('\n')
      : 'No attendee list available';

    const prompt = `You are an expert academic meeting analyst for MIT-ADT University. Analyze the following mentorship session data and extract a structured report. Be thorough, professional, and actionable.

--- SESSION METADATA ---
Topic/Type: ${meetingTopic || 'Mentorship Session'}
Student/Attendees: ${studentName || 'Mentee(s)'}
Department: ${department || 'Not specified'}
Attendee List:
${attendeeStr}

--- LIVE TRANSCRIPT ---
${transcript || '(No transcript captured)'}

--- ROOM CHAT MESSAGES ---
${chatMessages || '(No chat messages)'}

--- SESSION NOTES ---
${notes || '(No manual notes)'}

--- EXTRACT THE FOLLOWING (use ### headers, bullet points with bold lead-ins) ---

### 📌 Meeting Topic & Executive Summary
[1-2 crisp sentences capturing the essence of the session]

### ⚠️ Issues Discussed
[Bullet points of each distinct student issue, concern, or challenge raised — academic backlogs, attendance, personal, technical, hostel, exam-related, etc.]

### ✅ Action Items & Remedial Measures
[Numbered list of concrete tasks, solutions, and follow-up steps agreed upon with deadlines if possible]

### 🎯 Student Tasks
[Simple bullet list of tasks assigned to the student, one per line — these auto-sync to the student task board]

### 🔒 Confidential Faculty Observations
[Private faculty-only observations: stress indicators, risk signals, counseling needs, behavioral notes — NOT visible to students]

### 📝 Additional Remarks
[Any other noteworthy observations, positive commendations, or general remarks for the HOD/Dean record]`;

    try {
      const res = await this.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.25,
        maxTokens: 900
      });
      return this._parseExtractedInsights(res.content);
    } catch (e) {
      console.warn('AI extractMeetingInsights fallback:', e);
      return this._fallbackExtraction({ transcript, chatMessages, notes, meetingTopic });
    }
  }

  /**
   * Parse AI extraction response into structured fields.
   */
  _parseExtractedInsights(content) {
    const result = {
      topic: '',
      issuesDiscussed: '',
      actionItems: '',
      tasks: [],
      confidentialObservations: '',
      remarks: ''
    };

    if (!content) return result;

    const sections = content.split(/###\s*/);
    for (const section of sections) {
      const lower = section.toLowerCase();
      const body = section.replace(/^[^\n]*\n/, '').trim();

      if (lower.includes('topic') || lower.includes('summary') || lower.includes('executive')) {
        result.topic = body;
      } else if (lower.includes('issues discussed') || lower.includes('issues')) {
        result.issuesDiscussed = body;
      } else if (lower.includes('action items') || lower.includes('remedial')) {
        result.actionItems = body;
      } else if (lower.includes('student tasks') || lower.includes('tasks')) {
        result.tasks = body.split('\n')
          .map(l => l.replace(/^[\s•\-*\d.]+/, '').trim())
          .filter(Boolean);
      } else if (lower.includes('confidential') || lower.includes('faculty observation')) {
        result.confidentialObservations = body;
      } else if (lower.includes('remarks') || lower.includes('additional')) {
        result.remarks = body;
      }
    }

    return result;
  }

  /**
   * Fallback extraction when AI API is unavailable — uses simple heuristics.
   */
  _fallbackExtraction({ transcript, chatMessages, notes, meetingTopic }) {
    const allText = [transcript, chatMessages, notes].filter(Boolean).join('\n');
    const lines = allText.split('\n').filter(l => l.trim());

    return {
      topic: meetingTopic || 'Mentorship Session',
      issuesDiscussed: lines.length > 0
        ? '• ' + lines.slice(0, Math.min(8, lines.length)).join('\n• ')
        : 'Session discussion points were recorded via live transcript.',
      actionItems: 'Action items to be confirmed by mentor post-session review.',
      tasks: [],
      confidentialObservations: '',
      remarks: `Auto-extracted from ${lines.length} transcript line(s). Generated via Lumina Offline Engine.`
    };
  }

  /**
   * Generate a comprehensive official mentorship meeting report using AI.
   */
  async generateMentorMeetingReport({ meeting = {}, studentName = '', studentProfile = {}, transcript = '', notes = '' }) {
    const topic = meeting.type || meeting.description || 'Mentorship Session';
    const dept = meeting.department || studentProfile.department || 'Department of Computer Science & Engineering';

    const prompt = `Generate a concise, formal MIT-ADT University Mentorship Session Report in under 250 words. Use professional academic language.

Session: ${topic}
Student: ${studentName || 'Mentee'}
Department: ${dept}
CGPA: ${studentProfile.cgpa || 'N/A'} | Attendance: ${studentProfile.attendance || 'N/A'}% | Risk Level: ${studentProfile.riskLevel || 'N/A'}
Backlogs: ${studentProfile.backlogs || 'N/A'}

Meeting Notes: ${notes || 'General academic review and mentoring discussion'}
Transcript Excerpt: ${(transcript || '').slice(0, 600)}

Format strictly as:
### Issues Discussed
[3-5 bullet points of specific student issues with bold labels]

### Action Taken & Remedial Measures
[3-5 numbered steps with specific, measurable actions and timelines]

### Student Tasks
[Simple bullet list, one task per line]

### Faculty Observations
[2-3 brief private observations for HOD review]

### Remarks
[1-2 sentences of overall assessment and encouragement]`;

    try {
      const res = await this.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 700
      });
      return this._parseExtractedInsights(res.content);
    } catch (e) {
      console.warn('AI generateMentorMeetingReport fallback:', e);
      return {
        topic,
        issuesDiscussed: 'Academic progress review and mentorship discussion conducted.',
        actionItems: '1. Continue regular academic monitoring.\n2. Review attendance and backlog status.\n3. Follow up in next scheduled session.',
        tasks: ['Submit pending assignments', 'Attend remedial classes if applicable'],
        confidentialObservations: '',
        remarks: 'Session conducted as per institutional mentorship guidelines.'
      };
    }
  }

  /**
   * Generate cohort-level executive summary and performance insights for a mentor.
   */
  async generateCohortExecutiveSummary({ students = [], meetings = [], mentorName = '' }) {
    const highRisk = students.filter(s => s.riskLevel === 'HIGH');
    const medRisk = students.filter(s => s.riskLevel === 'MEDIUM');
    const avgCGPA = students.length > 0
      ? (students.reduce((sum, s) => sum + (parseFloat(s.cgpa) || 0), 0) / students.length).toFixed(2)
      : 'N/A';
    const avgAtt = students.length > 0
      ? (students.reduce((sum, s) => sum + (parseFloat(s.attendance) || 0), 0) / students.length).toFixed(1)
      : 'N/A';
    const completedMeetings = meetings.filter(m => m.status === 'COMPLETED').length;

    const prompt = `Generate a concise Mentor Cohort Performance Intelligence Report (under 200 words) for Prof. ${mentorName || 'Mentor'}.

Cohort Statistics:
- Total Mentees: ${students.length}
- High Risk Students: ${highRisk.length} (${highRisk.map(s => s.name).join(', ') || 'None'})
- Medium Risk Students: ${medRisk.length}
- Average CGPA: ${avgCGPA}
- Average Attendance: ${avgAtt}%
- Completed Meetings: ${completedMeetings} / ${meetings.length} total

Format strictly as:
### 📊 Cohort Health Summary
[2-3 sentences on overall cohort health]

### 🚨 Priority Interventions Required
[Numbered list of specific students/actions needing immediate attention]

### 📈 Positive Trends & Commendations
[Brief positive observations]

### 📋 Recommended Next Steps
[3-4 actionable recommendations for the mentor]`;

    try {
      const res = await this.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 500
      });
      return res.content;
    } catch (e) {
      console.warn('AI generateCohortExecutiveSummary fallback:', e);
      return `### 📊 Cohort Health Summary\nYou are mentoring ${students.length} students. ${highRisk.length} are flagged high-risk requiring immediate intervention. Average CGPA: ${avgCGPA}, Avg Attendance: ${avgAtt}%.\n\n### 🚨 Priority Interventions Required\n${highRisk.length > 0 ? highRisk.map((s, i) => `${i + 1}. **${s.name}** — CGPA: ${s.cgpa || 'N/A'}, Attendance: ${s.attendance || 'N/A'}%`).join('\n') : 'No critical interventions needed at this time.'}\n\n### 📈 Positive Trends\n${completedMeetings} meetings completed out of ${meetings.length} scheduled.\n\n### 📋 Recommended Next Steps\n1. Schedule 1-on-1 sessions with high-risk students.\n2. Review attendance patterns for medium-risk group.\n3. Update mentorship booklets for compliance.\n\n*(Generated via Lumina Offline Knowledge Engine)*`;
    }
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
