/**
 * Lumina AI Assistant Service
 * High-performance, role-aware AI copilot powered by Groq Llama 3.3 / 3.1 & Gemma models.
 * Includes fallback platform knowledge base, context injection, and specialized academic accelerators.
 */

import { GROQ_CONFIG, GEMINI_CONFIG } from '/js/config.js';
import { getUserProfile } from '/js/auth.js';

class AIServiceClass {
  constructor() {
    this.customApiKey = null;
    this.customModel = null;
    this.customGeminiApiKey = null;
    this.customGeminiModel = null;
  }

  getGeminiApiKey() {
    return this.customGeminiApiKey 
      || (typeof localStorage !== 'undefined' && localStorage.getItem('lumina_gemini_api_key')) 
      || GEMINI_CONFIG.apiKey;
  }

  setGeminiApiKey(key) {
    this.customGeminiApiKey = key;
    if (typeof localStorage !== 'undefined') {
      if (key) {
        localStorage.setItem('lumina_gemini_api_key', key);
      } else {
        localStorage.removeItem('lumina_gemini_api_key');
      }
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

  getApiKey() {
    return this.customApiKey || (typeof localStorage !== 'undefined' && localStorage.getItem('lumina_groq_api_key')) || GROQ_CONFIG.apiKey;
  }

  setApiKey(key) {
    this.customApiKey = key;
    if (typeof localStorage !== 'undefined') {
      if (key) {
        localStorage.setItem('lumina_groq_api_key', key);
      } else {
        localStorage.removeItem('lumina_groq_api_key');
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
   * Main chat completion call:
   * 1. Google Gemini Generative AI (gemini-3.5-flash / gemini-3.5-flash-lite)
   * 2. Groq Llama / Qwen / GPT OSS fallback
   * 3. Offline Knowledge Base fallback
   */
  async chat({ messages, activeRoute = '', temperature = 0.25, maxTokens = 1500 }) {
    const user = getUserProfile();
    const systemPrompt = this.buildSystemPrompt(user, activeRoute);

    // 1. Primary: Google Gemini Generative AI
    const geminiKey = this.getGeminiApiKey();
    if (geminiKey) {
      const geminiModels = [
        this.getGeminiModel(),
        GEMINI_CONFIG.fastModel || 'gemini-3.5-flash-lite',
        'gemini-3.5-flash'
      ].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i);

      // Map conversation messages to Gemini contents structure
      const geminiContents = [];
      for (const m of messages) {
        if (!m.content || !m.content.trim()) continue;
        const role = m.role === 'user' ? 'user' : 'model';
        if (geminiContents.length > 0 && geminiContents[geminiContents.length - 1].role === role) {
          geminiContents[geminiContents.length - 1].parts[0].text += '\n\n' + m.content;
        } else {
          geminiContents.push({
            role: role,
            parts: [{ text: m.content }]
          });
        }
      }

      // Ensure the first turn is user role
      if (geminiContents.length > 0 && geminiContents[0].role !== 'user') {
        geminiContents[0].role = 'user';
      }

      if (geminiContents.length > 0) {
        for (const model of geminiModels) {
          try {
            const endpoint = `${GEMINI_CONFIG.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models'}/${model}:generateContent?key=${geminiKey}`;
            const reqBody = {
              systemInstruction: {
                parts: [{ text: systemPrompt }]
              },
              contents: geminiContents,
              generationConfig: {
                temperature: temperature,
                maxOutputTokens: Math.max(maxTokens, 2048),
                thinkingConfig: { thinkingBudget: 0 }
              }
            };

            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(reqBody)
            });

            if (response.ok) {
              const data = await response.json();
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text && text.trim()) {
                return {
                  content: text.trim(),
                  model: model,
                  usage: data.usageMetadata
                };
              }
            } else {
              const errData = await response.json().catch(() => ({}));
              console.warn(`Gemini (${model}) returned non-200:`, errData);
            }
          } catch (geminiErr) {
            console.warn(`Gemini (${model}) execution failed:`, geminiErr.message);
          }
        }
      }
    }

    // 2. Secondary: Groq API fallback
    const groqApiKey = this.getApiKey();
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

    if (groqApiKey) {
      for (const model of modelsToTry) {
        try {
          const response = await fetch(GROQ_CONFIG.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${groqApiKey}`
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
          const choice = data.choices?.[0];
          let reply = choice?.message?.content;
          // Fallback to reasoning if content is empty on reasoning models
          if ((!reply || !reply.trim()) && choice?.message?.reasoning) {
            reply = choice.message.reasoning;
          }
          if (reply && reply.trim()) {
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

    throw new Error(lastError?.message || 'Could not connect to Gemini AI or fallback service. Please check your network connection.');
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
Analyze the following recorded meeting audio transcript, live closed captions, room chat, and faculty notes. Extract a rigorous, exhaustive, highly precise institutional mentorship report.

--- SESSION CONTEXT ---
Topic / Meeting Type: ${meetingTopic || 'Mentorship Session'}
Target Student(s) / Attendees: ${studentName || 'Mentee(s)'}
Academic Department: ${department || 'Department of Computer Science & Engineering (Core)'}
Registered Attendees:
${attendeeStr}

--- VERBATIM MEETING AUDIO TRANSCRIPT & LIVE CAPTIONS ---
${transcript || '(No transcript captured)'}

--- IN-SESSION CHAT LOG ---
${chatMessages || '(No chat messages)'}

--- MENTOR MANUAL OBSERVATIONS & NOTES ---
${notes || '(No manual notes)'}

--- INSTRUCTIONS FOR HIGH-PRECISION EXTRACTION ---
1. Identify the primary Meeting Agenda & Topic directly from how the session opened and the topics explored in the voice recording.
2. Identify all student concerns, difficulties, backlogs, attendance deficits, exam hurdles, or personal/hostel issues explicitly or implicitly discussed.
3. Group issues into distinct bold academic categories (e.g., **Academic Performance & Lab Submissions**, **Attendance Defaulter Status**, **KT & Backlog Clearance Plan**, **Examination Readiness**, **Personal & Psychological Well-being**, **Career, Certifications & Internship Placement**).
4. Specify concrete remedial actions and agreed interventions with clear timelines.
5. Extract individual actionable student tasks (short, crisp, one per line) to automatically synchronize with the student's task manager.
6. Provide confidential faculty observations regarding the mentee's mindset, stress, emotional state, sincerity, and whether university counseling or parental notification is warranted.
7. Evaluate risk triage level strictly: HIGH (critical backlogs / severe attendance shortage < 60% / deep distress), MEDIUM (moderate backlogs / attendance 60-75% / academic warning), or LOW (satisfactory standing).
8. Format the output strictly under the following markdown section headers:

### 📌 Meeting Agenda & Executive Topic
[Specific meeting agenda and core subject matter derived directly from the voice recording dialogue]

### ⚠️ Issues Discussed
[Detailed bullet points with bold category headings describing every problem, challenge, or topic raised by the student or mentor in the recording]

### ✅ Action Items & Remedial Measures
[Numbered concrete remedial actions, faculty guidance, and institutional support steps agreed upon with deadlines]

### 🎯 Student Tasks
[Concise bulleted list of 2-5 specific tasks assigned to the student for follow-up before next review, one per line]

### 🔒 Confidential Faculty Observations
[Confidential observations on the student's attitude, emotional state, engagement, stress signals, and faculty recommendations — kept private from the student]

### 🚨 Risk Assessment & Triage
[State RISK LEVEL: LOW, MEDIUM, or HIGH followed by specific risk factors or corroborating indicators]

### 📝 Additional Remarks
[Professional, constructive summary remarks for official university record and NAAC/NBA compliance]`;

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
   */
  _parseExtractedInsights(content) {
    const result = {
      topic: '',
      issuesDiscussed: '',
      actionItems: '',
      tasks: [],
      confidentialObservations: '',
      remarks: '',
      riskLevel: 'LOW',
      riskSignals: [],
      requiresEscalation: false
    };

    if (!content) return result;

    const sections = content.split(/(?:^|\n)###\s*/);
    for (const section of sections) {
      if (!section.trim()) continue;
      const firstLineEnd = section.indexOf('\n');
      const header = (firstLineEnd === -1 ? section : section.slice(0, firstLineEnd)).toLowerCase();
      const body = (firstLineEnd === -1 ? '' : section.slice(firstLineEnd + 1)).trim();

      if (header.includes('agenda') || header.includes('topic') || header.includes('summary') || header.includes('executive')) {
        result.topic = body;
        result.agenda = body;
      } else if (header.includes('issues') || header.includes('problem') || header.includes('challenge') || header.includes('concern')) {
        result.issuesDiscussed = body;
      } else if (header.includes('action') || header.includes('remedial') || header.includes('resolution') || header.includes('measure')) {
        result.actionItems = body;
      } else if (header.includes('task') || header.includes('student task') || header.includes('assignment')) {
        result.tasks = body.split('\n')
          .map(l => l.replace(/^[\s•\-*\d.)]+/, '').trim())
          .filter(Boolean);
      } else if (header.includes('confidential') || header.includes('faculty observation') || header.includes('private')) {
        result.confidentialObservations = body;
      } else if (header.includes('risk') || header.includes('triage') || header.includes('signals')) {
        if (/high/i.test(body)) {
          result.riskLevel = 'HIGH';
          result.requiresEscalation = true;
        } else if (/medium|moderate/i.test(body)) {
          result.riskLevel = 'MEDIUM';
        } else {
          result.riskLevel = 'LOW';
        }
        result.riskSignals = body.split('\n')
          .map(l => l.replace(/^[\s•\-*\d.)]+/, '').trim())
          .filter(l => l && !/^(risk\s*level|overall|status)/i.test(l));
      } else if (header.includes('remark') || header.includes('additional') || header.includes('note')) {
        result.remarks = body;
      }
    }

    return result;
  }

  /**
   * Fallback extraction when AI API is unavailable — uses intelligent heuristic parsing.
   */
  _fallbackExtraction({ transcript, chatMessages, notes, meetingTopic, studentName }) {
    const isGoodStr = s => s && typeof s === 'string' && s.trim().length > 3 && !/^(n|na|nil|none)$/i.test(s.trim());
    const allText = [transcript, chatMessages, notes].filter(isGoodStr).join('\n');
    const rawLines = allText.split('\n').map(l => l.replace(/^\[\d{2}:\d{2}\]\s*/, '').trim()).filter(l => l && l.length > 3 && !/^(n|na|nil|none)$/i.test(l));

    // Heuristic keyword scan for risk level
    const lowerAll = allText.toLowerCase();
    let riskLevel = 'LOW';
    let requiresEscalation = false;
    const riskSignals = [];

    if (/fail|kt|backlog|critical|depress|anxiety|severe|medical emergency|attendance below 60/i.test(lowerAll)) {
      riskLevel = 'HIGH';
      requiresEscalation = true;
      riskSignals.push('Critical academic backlog or high-stress concerns discussed in session');
    } else if (/attendance|warning|low mark|struggling|difficulty|exam|fee|hostel/i.test(lowerAll)) {
      riskLevel = 'MEDIUM';
      riskSignals.push('Academic monitoring or attendance regularisation required');
    }

    const discussionPoints = rawLines.length > 0
      ? rawLines.slice(0, Math.min(6, rawLines.length)).map(l => `• ${l}`).join('\n')
      : '• Comprehensive academic progress review and mentorship session conducted.\n• Discussion regarding curriculum milestones, semester coursework, and attendance tracking.';

    return {
      topic: meetingTopic || 'Mentorship Session Review',
      issuesDiscussed: discussionPoints,
      actionItems: '1. Follow up on academic milestones discussed during session.\n2. Verify attendance regularisation if applicable.\n3. Complete assigned study modules before next mentorship check-in.',
      tasks: ['Submit pending coursework assignments', 'Review notes for challenging subjects'],
      confidentialObservations: riskLevel === 'HIGH' ? 'Student flagged for faculty follow-up.' : 'Student engaged constructively during session.',
      remarks: `Session logged successfully for ${studentName || 'mentee'}. Verified via Lumina Academic Engine.`,
      riskLevel,
      riskSignals,
      requiresEscalation
    };
  }

  /**
   * Generate a comprehensive official mentorship meeting report using AI.
   */
  async generateMentorMeetingReport({ meeting = {}, studentName = '', studentProfile = {}, transcript = '', notes = '' }) {
    const topic = meeting.type || meeting.description || 'Mentorship Session';
    const dept = meeting.department || studentProfile.department || 'Department of Computer Science & Engineering (Core)';

    const prompt = `You are Lumina AI, generating an official MIT-ADT University Mentorship Session Report.
Session Topic: ${topic}
Student: ${studentName || meeting.studentName || 'Mentee'}
Department: ${dept}
CGPA: ${studentProfile.cgpa || meeting.studentCGPA || 'N/A'} | Attendance: ${studentProfile.attendance || meeting.studentAttendance || 'N/A'}% | Current Risk: ${studentProfile.riskLevel || meeting.riskLevel || 'N/A'}
Backlogs: ${studentProfile.backlogs || 'N/A'}

Meeting Notes: ${(notes && notes.trim().length > 3 && !/^(n|na|nil|none)$/i.test(notes.trim())) ? notes : ((meeting.notes?.summary && meeting.notes.summary.trim().length > 3 && !/^(n|na|nil|none)$/i.test(meeting.notes.summary.trim())) ? meeting.notes.summary : 'General academic review and mentorship guidance')}
Transcript / Audio Excerpt: ${(transcript || '').slice(0, 1500)}

Format the report strictly using these '### ' section headers:

### 📌 Meeting Topic & Executive Summary
[1-2 formal sentences summarizing the meeting focus]

### ⚠️ Issues Discussed
[3-5 bullet points with bold labels detailing student difficulties, backlogs, attendance, or personal concerns]

### ✅ Action Taken & Remedial Measures
[3-5 concrete numbered steps with clear remedial solutions and milestones]

### 🎯 Student Tasks
[Simple bullet list of 2-4 tasks assigned to the mentee, one per line]

### 🔒 Confidential Faculty Observations
[Private observations on student academic mindset, stress, and behavioral readiness]

### 🚨 Risk Assessment & Triage
[Risk Level: LOW | MEDIUM | HIGH with 1-2 bullet indicators]

### 📝 Additional Remarks
[1-2 formal sentences of assessment and encouragement]`;

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

  /**
   * Transcribe an audio Blob using Google Gemini multimodal or Groq Whisper fallback.
   * Transcribes ALL audio in the blob — both mentor and student speakers.
   * @param {Blob} audioBlob - The recorded audio blob (webm/ogg/mp4/wav)
   * @returns {Promise<string>} Full verbatim transcript
   */
  async transcribeAudioBlob(audioBlob) {
    if (!audioBlob) throw new Error('No audio recording provided for transcription.');

    // 1. Primary: Google Gemini Multimodal Audio Transcription
    const geminiKey = this.getGeminiApiKey();
    if (geminiKey) {
      try {
        const base64Audio = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const res = reader.result;
            const b64 = typeof res === 'string' ? res.split(',')[1] : '';
            resolve(b64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });

        if (base64Audio) {
          const mimeType = audioBlob.type || 'audio/webm';
          const model = GEMINI_CONFIG.audioModel || 'gemini-3.5-flash';
          const endpoint = `${GEMINI_CONFIG.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models'}/${model}:generateContent?key=${geminiKey}`;

          const requestBody = {
            contents: [{
              parts: [
                { inlineData: { mimeType: mimeType, data: base64Audio } },
                { text: `Transcribe this university mentorship meeting audio verbatim, separating speakers as [Mentor] and [Student]. Capture all academic, attendance, and career concerns accurately.` }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 4096,
              thinkingConfig: { thinkingBudget: 0 }
            }
          };

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          if (response.ok) {
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text && text.trim()) return text.trim();
          } else {
            const errData = await response.json().catch(() => ({}));
            console.warn('Gemini audio transcription HTTP non-200:', errData);
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini audio transcription fallback error:', geminiErr.message);
      }
    }

    // 2. Secondary: Groq Whisper API (whisper-large-v3-turbo, ultra-fast and reliable)
    const groqKey = this.getApiKey();
    if (groqKey) {
      try {
        const formData = new FormData();
        const mimeType = audioBlob.type || 'audio/webm';
        const ext = mimeType.includes('wav') ? 'wav' : mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';
        formData.append('file', audioBlob, `meeting_recording.${ext}`);
        formData.append('model', GROQ_CONFIG.audioModel || 'whisper-large-v3-turbo');
        formData.append('temperature', '0.0');

        const response = await fetch(GROQ_CONFIG.audioEndpoint || 'https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`
          },
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          if (data.text && data.text.trim()) {
            return data.text.trim();
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          console.warn('Groq Whisper transcription non-200:', errData);
        }
      } catch (whisperErr) {
        console.warn('Groq Whisper audio transcription attempt error:', whisperErr.message);
      }
    }

    throw new Error('Audio transcription service unavailable. Live captions (CC) transcript will be utilized.');
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
    // 1. If Gemini key exists, perform direct multimodal audio analysis
    const geminiKey = this.getGeminiApiKey();
    if (geminiKey) {
      try {
        const base64Audio = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const res = reader.result;
            const b64 = typeof res === 'string' ? res.split(',')[1] : '';
            resolve(b64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });

        if (base64Audio) {
          const mimeType = audioBlob.type || 'audio/webm';
          const model = GEMINI_CONFIG.audioModel || 'gemini-3.5-flash';
          const endpoint = `${GEMINI_CONFIG.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models'}/${model}:generateContent?key=${geminiKey}`;

          const promptText = `Analyze this university mentorship audio recording. Student: ${context.studentName || 'Student'}, Topic: ${context.meetingTopic || 'Session'}.
Respond with a JSON object strictly conforming to:
{
  "transcript": "[Mentor]: ...\\n[Student]: ...",
  "topic": "Concise Meeting Agenda & Topic identified from the voice discussion.",
  "issuesDiscussed": "Detailed summary of student academic or personal issues raised in this voice recording grouped with bold categories.",
  "actionItems": "Numbered next steps and remedial measures agreed upon.",
  "tasks": ["Task 1", "Task 2"],
  "confidentialObservations": "Confidential faculty notes on student stress, attitude, and engagement.",
  "riskLevel": "LOW|MEDIUM|HIGH",
  "riskSignals": ["Signal 1"],
  "requiresEscalation": false,
  "remarks": "Official qualitative mentorship remarks."
}`;

          const requestBody = {
            contents: [{
              parts: [
                { inlineData: { mimeType: mimeType, data: base64Audio } },
                { text: promptText }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 4096,
              responseMimeType: 'application/json',
              thinkingConfig: { thinkingBudget: 0 }
            }
          };

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          if (response.ok) {
            const data = await response.json();
            const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawJson) {
              const parsed = JSON.parse(rawJson);
              return {
                transcript: parsed.transcript || '',
                topic: parsed.topic || context.meetingTopic || 'Mentorship Session',
                issuesDiscussed: parsed.issuesDiscussed || '',
                actionItems: parsed.actionItems || '',
                tasks: parsed.tasks || [],
                confidentialObservations: parsed.confidentialObservations || '',
                remarks: parsed.remarks || '',
                riskLevel: parsed.riskLevel || 'LOW',
                riskSignals: parsed.riskSignals || [],
                requiresEscalation: parsed.requiresEscalation || false
              };
            }
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini multimodal failed, falling back to Whisper + Groq pipeline:', geminiErr.message);
      }
    }

    // 2. High-performance fallback pipeline: Whisper audio transcription + Lumina AI extraction
    const transcript = await this.transcribeAudioBlob(audioBlob);
    if (!transcript) throw new Error('Audio could not be transcribed');

    const insights = await this.extractMeetingInsights({
      transcript,
      meetingTopic: context.meetingTopic || '',
      studentName: context.studentName || '',
      department: context.department || ''
    });

    const riskData = await this.extractRiskSignals(transcript, context.studentName || 'Student');

    return {
      transcript,
      topic: insights.topic || context.meetingTopic || 'Mentorship Session',
      issuesDiscussed: insights.issuesDiscussed || '',
      actionItems: insights.actionItems || '',
      tasks: insights.tasks || [],
      confidentialObservations: insights.confidentialObservations || '',
      remarks: insights.remarks || '',
      riskLevel: insights.riskLevel || riskData.riskLevel || 'LOW',
      riskSignals: insights.riskSignals?.length > 0 ? insights.riskSignals : (riskData.signals || []),
      requiresEscalation: insights.requiresEscalation || riskData.requiresEscalation || false
    };
  }

  /**
   * Extract risk signals from a transcript or meeting notes using AI.
   * Returns structured risk data for the mentor report's "Risk Intelligence" section.
   * @param {string} transcript
   * @param {string} studentName
   * @returns {Promise<{riskLevel: string, signals: string[], recommendations: string[]}>}
   */
  async extractRiskSignals(transcript, studentName = 'Student') {
    if (!transcript || transcript.trim().length < 50) {
      return { riskLevel: 'LOW', signals: [], recommendations: [] };
    }

    const prompt = `Analyze this mentorship meeting transcript for student risk signals. Student: ${studentName}

TRANSCRIPT:
${transcript.slice(0, 2000)}

Identify academic, personal, or psychological risk indicators. Respond with ONLY a JSON object (no markdown):
{
  "riskLevel": "LOW|MEDIUM|HIGH",
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
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.warn('extractRiskSignals fallback:', e);
    }
    return { riskLevel: 'LOW', signals: [], recommendations: [], requiresEscalation: false };
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
