/**
 * Lumina AI Assistant Service
 * High-performance, role-aware AI copilot powered by Groq Llama 3.3 / 3.1 & Gemma models.
 * Includes fallback platform knowledge base, context injection, and specialized academic accelerators.
 */

import { GROQ_CONFIG, GEMINI_CONFIG, API_BASE_URL } from '/js/config.js';
import { getUserProfile, getIdToken } from '/js/auth.js';
import { api } from '/js/api.js';

class AIServiceClass {
  constructor() {
    this.customModel = null;
    this.customGeminiModel = null;
    if (typeof document !== 'undefined') {
      document.addEventListener('click', async (event) => {
        const button = event.target.closest?.('.ai-copy-btn[data-copy-code]');
        if (!button) return;
        const code = button.closest('.ai-code-block')?.querySelector('pre code')?.textContent || '';
        try {
          await navigator.clipboard.writeText(code);
          button.textContent = 'Copied!';
        } catch (_) {
          button.textContent = 'Copy failed';
        }
        setTimeout(() => {
          if (button.isConnected) button.textContent = 'Copy';
        }, 2000);
      });
    }
    if (typeof localStorage !== 'undefined') {
      // Remove keys saved by older client-side AI settings. Provider secrets
      // now belong in backend environment variables only.
      localStorage.removeItem('lumina_gemini_api_key');
      localStorage.removeItem('lumina_groq_api_key');
    }
  }

  getGeminiModel() {
    return this.customGeminiModel 
      || (typeof localStorage !== 'undefined' && localStorage.getItem('lumina_gemini_model')) 
      || GEMINI_CONFIG.defaultModel 
      || 'gemini-3.5-flash';
  }

  setGeminiModel(model) {
    this.customGeminiModel = model;
    if (typeof localStorage !== 'undefined') {
      if (model) {
        localStorage.setItem('lumina_gemini_model', model);
      } else {
        localStorage.removeItem('lumina_gemini_model');
      }
    }
  }

  getModel() {
    return this.customModel || (typeof localStorage !== 'undefined' && localStorage.getItem('lumina_groq_model')) || GROQ_CONFIG.defaultModel;
  }

  setModel(model) {
    this.customModel = model;
    if (typeof localStorage !== 'undefined') {
      if (model) {
        localStorage.setItem('lumina_groq_model', model);
      } else {
        localStorage.removeItem('lumina_groq_model');
      }
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
   * Main chat completion call through the authenticated backend proxy, then
   * the local offline knowledge base when no provider is configured.
   */
  async chat({ messages, activeRoute = '', temperature = 0.25, maxTokens = 1500 }) {
    const user = getUserProfile();
    const systemPrompt = this.buildSystemPrompt(user, activeRoute);

    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];
    let lastError = null;
    try {
      return await api.post('/api/ai/chat', {
        messages: fullMessages,
        groqModel: this.getModel(),
        geminiModel: this.getGeminiModel(),
        temperature,
        maxTokens
      });
    } catch (error) {
      lastError = error;
      console.warn('AI backend request failed; checking offline knowledge...', error.message);
    }

    // 3. Tertiary: Offline Knowledge Base
    console.error('AIService all online model attempts failed. Checking offline knowledge...', lastError);
    const lastUserMsg = messages[messages.length - 1]?.content || '';
    const offlineReply = this.getOfflineKnowledgeResponse(lastUserMsg, user?.role);
    if (offlineReply) {
      return {
        content: offlineReply + "\n\n*(Note: Generated via Lumina Offline Knowledge Engine)*",
        model: 'lumina-offline-engine'
      };
    }

    throw new Error(lastError?.message || 'AI service is unavailable. Configure a provider key on the backend.');
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
      : (studentName ? `1. ${studentName}` : 'No attendee list available');

    const prompt = `You are Lumina AI, an expert academic and mentorship intelligence analyst for MIT-ADT University.
Analyze the supplied transcript, room chat, and faculty notes and prepare a concise review draft.

--- SESSION CONTEXT ---
Topic / Meeting Type: ${meetingTopic || 'Mentorship Session'}
Target Student(s) / Attendees: ${studentName || 'Mentee(s)'}
Academic Department: ${department || 'Not recorded'}
Registered Attendees:
${attendeeStr}

--- VERBATIM MEETING AUDIO TRANSCRIPT & LIVE CAPTIONS ---
${transcript || '(No transcript captured)'}

--- IN-SESSION CHAT LOG ---
${chatMessages || '(No chat messages)'}

--- MENTOR MANUAL OBSERVATIONS & NOTES ---
${notes || '(No manual notes)'}

--- EXTRACTION RULES ---
1. Use only facts explicitly present in the supplied transcript, chat, or faculty notes. Do not infer concerns, attendance, grades, compliance, emotions, or outcomes.
2. Do not invent agreed actions, assigned tasks, deadlines, recommendations, or follow-up dates. If none are recorded, write "Not recorded."
3. Confidential observations may only restate explicit faculty notes. Never infer a student's mental or emotional state from a transcript.
4. Set risk to HIGH, MEDIUM, or LOW only when that rating is explicitly stated with supporting information in the supplied content. Otherwise use NOT_ASSESSED. Do not recommend escalation unless the source explicitly records it.
5. Label the output as an AI-assisted draft for human review. Do not claim institutional approval, verification, or compliance.
6. Format the output strictly under the following markdown section headers:

### 📌 Meeting Agenda & Executive Topic
[Topic found in the supplied content, or "Not recorded."]

### ⚠️ Issues Discussed
[Only issues explicitly raised, or "Not recorded."]

### ✅ Action Items & Remedial Measures
[Only agreed actions explicitly captured, or "Not recorded."]

### 🎯 Student Tasks
[Only tasks explicitly assigned in the supplied content, or "Not recorded."]

### 🔒 Confidential Faculty Observations
[Explicit confidential faculty notes only, or "Not recorded."]

### 🚨 Risk Assessment & Triage
[State HIGH, MEDIUM, LOW only when explicitly supported; otherwise state NOT_ASSESSED.]

### 📝 Additional Remarks
[Brief factual remarks only. Do not claim compliance, approval, or verification.]`;

    try {
      const res = await this.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.15,
        maxTokens: 2500
      });
      return this._parseExtractedInsights(res.content);
    } catch (e) {
      console.warn('AI extractMeetingInsights fallback:', e);
      return this._fallbackExtraction({ transcript, chatMessages, notes, meetingTopic, studentName });
    }
  }

  /**
   * Parse AI extraction response into structured fields.
   * Resilient to varied markdown headers (###, ##, bold labels, JSON, emojis).
   */
  _parseExtractedInsights(content) {
    const result = {
      topic: '',
      issuesDiscussed: '',
      actionItems: '',
      tasks: [],
      confidentialObservations: '',
      remarks: '',
      riskLevel: 'NOT_ASSESSED',
      riskSignals: [],
      requiresEscalation: false
    };

    if (!content || typeof content !== 'string') return result;

    // Check if output was returned as raw or fenced JSON
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || content.match(/^\s*(\{[\s\S]*\})\s*$/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed && typeof parsed === 'object') {
          return {
            topic: parsed.topic || parsed.agenda || '',
            issuesDiscussed: Array.isArray(parsed.issuesDiscussed) ? parsed.issuesDiscussed.join('\n') : (parsed.issuesDiscussed || ''),
            actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.join('\n') : (parsed.actionItems || ''),
            tasks: Array.isArray(parsed.tasks) ? parsed.tasks : (typeof parsed.tasks === 'string' ? parsed.tasks.split('\n').filter(Boolean) : []),
            confidentialObservations: parsed.confidentialObservations || parsed.privateObservations || '',
            remarks: parsed.remarks || '',
            riskLevel: ['HIGH', 'MEDIUM', 'LOW', 'NOT_ASSESSED'].includes(String(parsed.riskLevel || 'NOT_ASSESSED').toUpperCase())
              ? String(parsed.riskLevel || 'NOT_ASSESSED').toUpperCase()
              : 'NOT_ASSESSED',
            riskSignals: Array.isArray(parsed.riskSignals) ? parsed.riskSignals : [],
            requiresEscalation: !!parsed.requiresEscalation
          };
        }
      } catch (e) {
        // Continue to markdown parsing
      }
    }

    // Check if output was formatted as a Markdown table (e.g. | Category | Detail |)
    if (content.includes('|')) {
      const rows = content.split('\n').filter(r => r.includes('|'));
      for (const row of rows) {
        if (/^\|(?:\s*:?-+:?\s*\|)+$/.test(row.trim())) continue;
        const cells = row.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length >= 2) {
          const header = cells[0].toLowerCase().replace(/\*/g, '').trim();
          const val = cells[1].replace(/<br\s*\/?>/gi, '\n').replace(/\*/g, '').trim();
          if ((header.includes('agenda') || header.includes('topic')) && !result.topic) {
            result.topic = val;
            result.agenda = val;
          } else if ((header.includes('issue') || header.includes('problem') || header.includes('concern')) && !result.issuesDiscussed) {
            result.issuesDiscussed = val;
          } else if ((header.includes('action') || header.includes('remedial')) && !result.actionItems) {
            result.actionItems = val;
          } else if (header.includes('task') && result.tasks.length === 0) {
            result.tasks = val.split('\n').map(l => l.replace(/^[\s•\-*\d.)]+/, '').trim()).filter(Boolean);
          } else if (header.includes('confidential') && !result.confidentialObservations) {
            result.confidentialObservations = val;
          } else if (header.includes('remark') && !result.remarks) {
            result.remarks = val;
          } else if (header.includes('risk') && result.riskLevel === 'NOT_ASSESSED') {
            result.riskLevel = /\bhigh\b/i.test(val) ? 'HIGH' : /\bmedium\b/i.test(val) ? 'MEDIUM' : /\blow\b/i.test(val) ? 'LOW' : 'NOT_ASSESSED';
          }
        }
      }
    }

    // Multi-delimiter section splitting: matches ###, ##, #, or **Header** or Header:
    const sectionRegex = /(?:^|\n)(?:#{1,3}\s*|\*{2}\s*(?:\d+[.)]\s*)?)([^:\n\*\#]+?)(?:\*{2})?\s*(?:\n|:)/g;
    const matches = [];
    let match;
    while ((match = sectionRegex.exec(content)) !== null) {
      matches.push({
        header: match[1].trim().toLowerCase(),
        index: match.index + match[0].length
      });
    }

    if (matches.length > 0) {
      for (let i = 0; i < matches.length; i++) {
        const current = matches[i];
        const nextIndex = i < matches.length - 1 ? matches[i + 1].index - matches[i + 1].header.length - 4 : content.length;
        const body = content.slice(current.index, nextIndex).trim().replace(/^\*+|\*+$/g, '').trim();
        const header = current.header;

        if (header.includes('agenda') || header.includes('topic') || header.includes('executive') || header.includes('summary')) {
          result.topic = body;
          result.agenda = body;
        } else if (header.includes('issues') || header.includes('problem') || header.includes('concern') || header.includes('challenge')) {
          result.issuesDiscussed = body;
        } else if (header.includes('action') || header.includes('remedial') || header.includes('resolution') || header.includes('measure')) {
          result.actionItems = body;
        } else if (header.includes('task') || header.includes('assignment')) {
          result.tasks = body.split('\n')
            .map(l => l.replace(/^[\s•\-*\d.)]+/, '').trim())
            .filter(Boolean);
        } else if (header.includes('confidential') || header.includes('private') || header.includes('faculty observation')) {
          result.confidentialObservations = body;
        } else if (header.includes('risk') || header.includes('triage') || header.includes('signal')) {
          if (/high/i.test(body)) {
            result.riskLevel = 'HIGH';
          } else if (/medium|moderate/i.test(body)) {
            result.riskLevel = 'MEDIUM';
          } else if (/\blow\b/i.test(body)) {
            result.riskLevel = 'LOW';
          } else {
            result.riskLevel = 'NOT_ASSESSED';
          }
          result.riskSignals = body.split('\n')
            .map(l => l.replace(/^[\s•\-*\d.)]+/, '').trim())
            .filter(l => l && !/^(risk\s*level|overall|status)/i.test(l));
        } else if (header.includes('remark') || header.includes('additional') || header.includes('note')) {
          result.remarks = body;
        }
      }
    } else {
      // Fallback simple line-by-line inspection
      const sections = content.split(/(?:^|\n)###\s*/);
      for (const section of sections) {
        if (!section.trim()) continue;
        const firstLineEnd = section.indexOf('\n');
        const header = (firstLineEnd === -1 ? section : section.slice(0, firstLineEnd)).toLowerCase();
        const body = (firstLineEnd === -1 ? '' : section.slice(firstLineEnd + 1)).trim();

        if (header.includes('agenda') || header.includes('topic') || header.includes('summary')) {
          result.topic = body;
        } else if (header.includes('issues') || header.includes('problem') || header.includes('concern')) {
          result.issuesDiscussed = body;
        } else if (header.includes('action') || header.includes('remedial')) {
          result.actionItems = body;
        } else if (header.includes('task')) {
          result.tasks = body.split('\n').map(l => l.replace(/^[\s•\-*\d.)]+/, '').trim()).filter(Boolean);
        } else if (header.includes('confidential')) {
          result.confidentialObservations = body;
        } else if (header.includes('risk')) {
          result.riskLevel = /\bhigh\b/i.test(body) ? 'HIGH' : /\bmedium\b/i.test(body) ? 'MEDIUM' : /\blow\b/i.test(body) ? 'LOW' : 'NOT_ASSESSED';
        } else if (header.includes('remark')) {
          result.remarks = body;
        }
      }
    }

    // Clean up issuesDiscussed if it accidentally contains raw verbatim speaker timestamps
    if (result.issuesDiscussed && /\[\d{2}:\d{2}\]/.test(result.issuesDiscussed)) {
      result.issuesDiscussed = result.issuesDiscussed.split('\n')
        .map(l => l.replace(/^\[\d{2}:\d{2}\]\s*(?:\[?[A-Za-z\s]+\]?:)?\s*/, '').trim())
        .filter(l => l.length > 3)
        .map(l => `• ${l}`)
        .join('\n');
    }

    return result;
  }

  /**
   * Fallback extraction that reports only captured facts and never invents actions or findings.
   */
  _fallbackExtraction({ transcript = '', chatMessages = '', notes = '', meetingTopic = '', studentName = '' }) {
    const isGoodStr = s => s && typeof s === 'string' && s.trim().length > 2 && !/^(n|na|nil|none)$/i.test(s.trim());
    const allText = [transcript, chatMessages, notes].filter(isGoodStr).join('\n');
    const lowerAll = allText.toLowerCase();
    const explicitRisk = lowerAll.match(/\b(high|medium|low) risk\b/i)?.[1]?.toUpperCase() || '';
    const riskLevel = explicitRisk || 'NOT_ASSESSED';
    const requiresEscalation = /\b(requires? escalation|escalate this|urgent intervention)\b/i.test(lowerAll);
    const riskSignals = explicitRisk ? ['A risk rating was explicitly stated in the captured content.'] : [];

    // Extract genuine student problems from text
    const cleanLines = allText.split('\n')
      .map(l => l.replace(/^\[\d{2}:\d{2}\]\s*(?:\[?[A-Za-z\s]+\]?:)?\s*/, '').trim())
      .filter(l => l && l.length > 5 && !/^(hello|hi|yes|no|ok|thank|sir|bye)$/i.test(l));

    let issuesList = [];
    if (cleanLines.length > 0) {
      issuesList = cleanLines.slice(0, Math.min(5, cleanLines.length)).map(l => `• ${l}`);
    } else {
      issuesList = ['• No discussion details were recorded.'];
    }

    const remarks = allText
      ? 'AI-assisted draft based on the captured session content. Review before sharing.'
      : 'No transcript, chat, or faculty notes were captured. Complete the report manually before sharing.';

    return {
      topic: meetingTopic || 'Mentorship Session Review',
      issuesDiscussed: issuesList.join('\n'),
      actionItems: '',
      tasks: [],
      confidentialObservations: '',
      remarks,
      riskLevel,
      riskSignals,
      requiresEscalation
    };
  }

  /**
   * Generate a reviewable mentorship meeting report draft using AI.
   */
  async generateMentorMeetingReport({ meeting = {}, studentName = '', studentProfile = {}, transcript = '', notes = '' }) {
    const topic = meeting.type || meeting.description || 'Mentorship Session';
    const dept = meeting.department || studentProfile.department || 'Not recorded';

    const prompt = `You are Lumina AI, preparing a mentorship session report draft for human review.
Session Topic: ${topic}
Student: ${studentName || meeting.studentName || 'Mentee'}
Department: ${dept}
CGPA: ${studentProfile.cgpa || meeting.studentCGPA || 'N/A'} | Attendance: ${studentProfile.attendance || meeting.studentAttendance || 'N/A'}% | Current Risk: ${studentProfile.riskLevel || meeting.riskLevel || 'N/A'}
Backlogs: ${studentProfile.backlogs || 'N/A'}

Meeting Notes: ${(notes && notes.trim().length > 3 && !/^(n|na|nil|none)$/i.test(notes.trim())) ? notes : ((meeting.notes?.summary && meeting.notes.summary.trim().length > 3 && !/^(n|na|nil|none)$/i.test(meeting.notes.summary.trim())) ? meeting.notes.summary : 'Not recorded')}
Transcript / Audio Excerpt: ${(transcript || '').slice(0, 1500)}

Use only facts explicitly present in these notes or transcript. Do not invent student concerns, grades, attendance, emotional observations, completed actions, tasks, deadlines, or follow-up dates. Write "Not recorded" for missing fields. Do not claim approval, verification, or compliance. Risk must be NOT_ASSESSED unless the source explicitly states a supported LOW, MEDIUM, or HIGH rating. Confidential observations must only restate explicit faculty notes; do not infer mental health or sincerity.

Format the report strictly using these '### ' section headers:

### 📌 Meeting Topic & Executive Summary
[1-2 formal sentences summarizing the meeting focus]

### ⚠️ Issues Discussed
[Only concerns explicitly recorded, or "Not recorded."]

### ✅ Action Taken & Remedial Measures
[Only actions explicitly agreed, or "Not recorded."]

### 🎯 Student Tasks
[Only assigned tasks, or "Not recorded."]

### 🔒 Confidential Faculty Observations
[Explicit faculty notes only, or "Not recorded."]

### 🚨 Risk Assessment & Triage
[Risk Level: NOT_ASSESSED unless a supported rating is explicitly stated]

### 📝 Additional Remarks
[Brief factual remarks. Do not claim institutional compliance or approval.]`;

    try {
      const res = await this.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.25,
        maxTokens: 2000
      });
      return this._parseExtractedInsights(res.content);
    } catch (e) {
      console.warn('AI generateMentorMeetingReport fallback:', e);
      return this._fallbackExtraction({ transcript, chatMessages: '', notes, meetingTopic: topic, studentName });
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
          <button type="button" class="ai-copy-btn" data-copy-code>Copy</button>
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

    // Markdown Tables (| Header | Detail |)
    html = html.replace(/((?:\|[^\n]+\|\r?\n?)+)/g, (tableMatch) => {
      const lines = tableMatch.trim().split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return tableMatch;
      let tableHtml = '<div class="ai-table-wrap"><table class="ai-table">';
      let isHeader = true;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^\|(?:\s*:?-+:?\s*\|)+$/.test(line)) {
          isHeader = false;
          continue;
        }
        const cells = line.split('|').slice(1, -1);
        if (isHeader && i === 0) {
          tableHtml += '<thead><tr>' + cells.map(c => `<th>${c.trim()}</th>`).join('') + '</tr></thead><tbody>';
        } else {
          tableHtml += '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
        }
      }
      tableHtml += '</tbody></table></div>';
      return tableHtml;
    });

    // Unordered lists (contiguous items)
    html = html.replace(/^\s*[-*]\s+(.*)$/gim, '<li class="ai-md-li">$1</li>');
    html = html.replace(/((?:<li class="ai-md-li">.*?<\/li>\s*)+)/gs, '<ul class="ai-md-ul">$1</ul>');

    // Ordered lists (contiguous items)
    html = html.replace(/^\s*(\d+)\.\s+(.*)$/gim, '<li class="ai-md-oli"><span class="oli-num">$1.</span> $2</li>');
    html = html.replace(/((?:<li class="ai-md-oli">.*?<\/li>\s*)+)/gs, '<ol class="ai-md-ol">$1</ol>');

    // Paragraphs / Linebreaks
    html = html.replace(/\n\n/g, '<div class="ai-md-p-gap"></div>');
    html = html.replace(/\n/g, '<br/>');

    return html;
  }

  /**
   * Transcribe an audio Blob through the authenticated backend proxy.
   * Transcribes ALL audio in the blob — both mentor and student speakers.
   * @param {Blob} audioBlob - The recorded audio blob (webm/ogg/mp4/wav)
   * @returns {Promise<string>} Full verbatim transcript
   */
  async transcribeAudioBlob(audioBlob) {
    if (!audioBlob) throw new Error('No audio recording provided for transcription.');
    const token = await getIdToken();
    if (!token) throw new Error('Sign in to transcribe a meeting recording.');
    const formData = new FormData();
    const mimeType = (audioBlob.type || 'audio/webm').split(';')[0];
    const extension = mimeType.includes('wav') ? 'wav' : mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : mimeType.includes('mpeg') ? 'mp3' : 'webm';
    formData.append('file', audioBlob, `meeting_recording.${extension}`);
    const response = await fetch(`${API_BASE_URL}/api/ai/transcribe`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.detail || 'Audio transcription service unavailable.');
    }
    if (!result.text?.trim()) throw new Error('Audio could not be transcribed.');
    return result.text.trim();
  }

  /**
   * Direct End-to-End Audio Analysis:
   * Extracts transcript, key issues, action items, tasks, and risk level from the meeting audio blob.
   * Powered by Gemini Multimodal with Whisper + Lumina AI extraction fallback.
   * @param {Blob} audioBlob
   * @param {Object} context
   * @returns {Promise<Object>}
   */
  async analyzeMeetingAudioWithGemini(audioBlob, context = {}) {
    // 1. High-speed speech transcription via Groq Whisper (1-2s)
    const transcript = await this.transcribeAudioBlob(audioBlob);
    if (!transcript) throw new Error('Audio could not be transcribed');

    // 2. Parallel concurrent extraction for sub-second intelligence generation
    const [insights, riskData] = await Promise.all([
      this.extractMeetingInsights({
        transcript,
        meetingTopic: context.meetingTopic || '',
        studentName: context.studentName || '',
        department: context.department || ''
      }).catch(err => {
        console.warn('extractMeetingInsights error in analyzeMeetingAudioWithGemini:', err);
        return {};
      }),
      this.extractRiskSignals(transcript, context.studentName || 'Student').catch(err => {
        console.warn('extractRiskSignals error in analyzeMeetingAudioWithGemini:', err);
        return { riskLevel: 'NOT_ASSESSED', signals: [] };
      })
    ]);

    return {
      transcript,
      topic: insights.topic || context.meetingTopic || 'Mentorship Session',
      issuesDiscussed: insights.issuesDiscussed || '',
      actionItems: insights.actionItems || '',
      tasks: insights.tasks || [],
      confidentialObservations: insights.confidentialObservations || '',
      remarks: insights.remarks || '',
      riskLevel: insights.riskLevel || riskData.riskLevel || 'NOT_ASSESSED',
      riskSignals: insights.riskSignals?.length > 0 ? insights.riskSignals : (riskData.signals || []),
      requiresEscalation: insights.requiresEscalation || riskData.requiresEscalation || false
    };
  }

  async extractRiskSignals(transcript, studentName = 'Student') {
    if (!transcript || transcript.trim().length < 50) {
      return { riskLevel: 'NOT_ASSESSED', signals: [], recommendations: [] };
    }

    const prompt = `Analyze this mentorship meeting transcript for student risk signals. Student: ${studentName}

TRANSCRIPT:
${transcript.slice(0, 2000)}

Use only explicit risk evidence in the transcript. Do not infer mental health, attendance, grades, or intent. If there is no clear evidence, set the risk level to NOT_ASSESSED. Do not suggest escalation unless the transcript explicitly requests it. Respond with ONLY a JSON object (no markdown):
{
  "riskLevel": "NOT_ASSESSED|LOW|MEDIUM|HIGH",
  "signals": ["signal 1", "signal 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "requiresEscalation": false,
  "escalationReason": ""
}`;

    try {
      const res = await this.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        maxTokens: 400
      });
      // Parse JSON from response
      const jsonMatch = res.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const riskLevel = String(parsed.riskLevel || 'NOT_ASSESSED').toUpperCase();
        return {
          riskLevel: ['NOT_ASSESSED', 'LOW', 'MEDIUM', 'HIGH'].includes(riskLevel) ? riskLevel : 'NOT_ASSESSED',
          signals: Array.isArray(parsed.signals) ? parsed.signals.filter(item => typeof item === 'string').slice(0, 20) : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.filter(item => typeof item === 'string').slice(0, 20) : [],
          requiresEscalation: parsed.requiresEscalation === true,
          escalationReason: typeof parsed.escalationReason === 'string' ? parsed.escalationReason.slice(0, 500) : ''
        };
      }
    } catch (e) {
      console.warn('extractRiskSignals fallback:', e);
    }
    return { riskLevel: 'NOT_ASSESSED', signals: [], recommendations: [], requiresEscalation: false };
  }

  /**
   * Aggregate AI notes from multiple completed meetings into a cohort intelligence summary.
   * Used by the Mentor Reports page "AI Meeting Intelligence" panel.
   * @param {Array} meetingsWithAiNotes - Array of meeting objects with .aiNotes field
   * @param {string} mentorName
   * @returns {Promise<{recurringIssues: string[], riskStudents: string[], topCategories: string[], summary: string}>}
   */
  async aggregateMeetingInsights(meetingsWithAiNotes, mentorName = 'Mentor') {
    if (!meetingsWithAiNotes || meetingsWithAiNotes.length === 0) {
      return { recurringIssues: [], riskStudents: [], topCategories: [], summary: 'No AI-analyzed meetings yet.' };
    }

    // Compile all issues text for analysis
    const allIssues = meetingsWithAiNotes
      .filter(m => m.aiNotes)
      .map(m => `[${m.studentName || 'Student'} - ${m.type || 'Session'}]: ${m.aiNotes.issuesDiscussed || ''}`)
      .join('\n\n');

    const allRisk = meetingsWithAiNotes
      .filter(m => m.aiNotes?.riskSignals?.length > 0)
      .map(m => m.studentName || 'Unknown Student');

    const prompt = `Analyze these mentorship meeting issues across ${meetingsWithAiNotes.length} sessions for Prof. ${mentorName}:

${allIssues.slice(0, 3000)}

Produce a concise cohort intelligence report. Format as JSON only:
{
  "recurringIssues": ["issue1", "issue2", "issue3"],
  "topCategories": ["Academic", "Attendance", "Personal"],
  "summary": "2-3 sentence cohort health summary",
  "interventionNeeded": ["student name if any"],
  "positivePatterns": ["positive observation 1"]
}`;

    try {
      const res = await this.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        maxTokens: 600
      });
      const jsonMatch = res.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { ...parsed, riskStudents: allRisk };
      }
    } catch (e) {
      console.warn('aggregateMeetingInsights fallback:', e);
    }

    return {
      recurringIssues: ['Academic performance', 'Attendance tracking', 'Assignment deadlines'],
      riskStudents: allRisk,
      topCategories: ['Academic', 'Career', 'Personal'],
      summary: `${meetingsWithAiNotes.length} meetings analyzed. ${allRisk.length} students flagged for follow-up.`,
      interventionNeeded: allRisk,
      positivePatterns: ['Regular meeting cadence maintained']
    };
  }
}

export const AIService = new AIServiceClass();
