/** Curated Lumina Copilot actions. Exactly 60 prompts across all roles. */
const STUDENT = [
  ['ph-calendar-check', 'Make an attendance recovery plan from my recorded attendance and remaining classes.'],
  ['ph-chat-circle-dots', 'Help me write a respectful message to my mentor about my attendance.'],
  ['ph-calendar-x', 'My register shows no present marks for a month. Help me ask for a register check and plan my catch-up.'],
  ['ph-notebook', 'Turn the classes I missed into a topic-by-topic catch-up checklist.'],
  ['ph-calendar', 'Build a realistic study timetable for the next two weeks around my classes.'],
  ['ph-books', 'Create a weekly revision plan for my upcoming assessments.'],
  ['ph-list-checks', 'Help me prioritize my pending assignments by deadline and effort.'],
  ['ph-exam', 'Quiz me on a subject topic, one question at a time, and explain mistakes.'],
  ['ph-lightbulb', 'Explain a difficult course concept with a simple example and a short practice problem.'],
  ['ph-pencil-line', 'Review my draft and make it clearer while keeping my meaning.'],
  ['ph-users', 'Prepare a short agenda for my next mentor meeting.'],
  ['ph-target', 'Help me set three measurable academic goals for this semester.'],
  ['ph-book-open', 'Help me write a clear mentorship booklet entry about my semester progress.'],
  ['ph-briefcase', 'Create a beginner-friendly career preparation plan for my course.'],
  ['ph-hand-heart', 'Help me explain a personal or academic obstacle to my mentor while sharing only what I choose.']
];

const MENTOR = [
  ['ph-heart', 'Draft a supportive first check-in for a student with FR attendance (40% or below).'],
  ['ph-calendar-x', 'A student has no present marks recorded for a month. Draft a check-in and register-verification steps.'],
  ['ph-chat-circle-dots', 'Write a non-judgmental outreach message for a student with repeated absences. Do not guess the reason.'],
  ['ph-calendar-check', 'Create a 20-minute attendance support meeting agenda with fact-check questions.'],
  ['ph-magnifying-glass', 'Help me distinguish confirmed absences from missing or incomplete attendance records.'],
  ['ph-chart-line-down', 'Build a practical attendance recovery plan using the recorded percentage and sessions.'],
  ['ph-bell', 'Draft a brief attendance notice that is factual, supportive, and clear about next steps.'],
  ['ph-question', 'Suggest five open questions to understand a student’s attendance barriers without making assumptions.'],
  ['ph-notebook', 'Make a checklist for confirming a student’s attendance register with the administrator.'],
  ['ph-books', 'Create a catch-up plan for missed classes that avoids overloading the student.'],
  ['ph-chart-bar', 'Summarize the academic information I provide into strengths, concerns, and unknowns.'],
  ['ph-book-open', 'Draft constructive, specific feedback for a mentorship booklet entry.'],
  ['ph-calendar-plus', 'Write a follow-up plan with a check-in date, owner, and measurable next step.'],
  ['ph-clipboard-text', 'Turn my meeting notes into a neutral factual record with actions and open questions.'],
  ['ph-warning-circle', 'Help me triage a student concern and identify what needs confirmation before escalation.'],
  ['ph-users-three', 'Create a weekly review routine for my mentees who need follow-up.'],
  ['ph-graduation-cap', 'Draft a support plan for a student with backlogs using only the details I provide.'],
  ['ph-chart-pie-slice', 'Suggest an aggregate attendance review for my mentees and flag data gaps to verify.'],
  ['ph-handshake', 'Draft an attendance recovery agreement with student-owned steps and a review date.'],
  ['ph-shield-check', 'Review my outreach draft for respectful language, privacy, and unsupported assumptions.']
];

const HOD = [
  ['ph-chart-pie-slice', 'Outline a department attendance review using aggregate data and clear data-quality caveats.'],
  ['ph-magnifying-glass', 'Create an audit checklist to find missing, duplicate, or inconsistent attendance records.'],
  ['ph-heart', 'Design a supportive intervention workflow for students at the FR attendance threshold.'],
  ['ph-users-three', 'Draft a mentor follow-up cadence for students with sustained low attendance.'],
  ['ph-chart-bar', 'Compare attendance trends across cohorts without ranking individual students unfairly.'],
  ['ph-clipboard-text', 'Prepare a monthly department mentorship and attendance summary from figures I provide.'],
  ['ph-scales', 'Draft guidance for separating verified absence data from incomplete registers.'],
  ['ph-arrows-clockwise', 'Suggest a fair way to review mentor follow-up workload across the department.']
];

const DEAN = [
  ['ph-buildings', 'Draft an institutional attendance support strategy focused on early, respectful outreach.'],
  ['ph-chart-line-up', 'Suggest institution-wide indicators for attendance support and recovery outcomes.'],
  ['ph-shield-check', 'Review an attendance reporting plan for privacy, fairness, and data-quality safeguards.'],
  ['ph-file-text', 'Turn these aggregate figures into a concise executive attendance brief with limitations.'],
  ['ph-users-three', 'Outline a cross-department process for students who need sustained attendance support.']
];

const SECTION_HEAD = [
  ['ph-clipboard-text', 'Create an admissions document-checklist response for an applicant.'],
  ['ph-chat-circle-dots', 'Draft a clear, polite update for an applicant whose documents are incomplete.'],
  ['ph-list-checks', 'Turn this admission request into a checklist of facts to verify and next steps.'],
  ['ph-chart-bar', 'Summarize the admissions workload figures I provide and identify missing data.']
];

const ADMIN = [
  ['ph-notebook', 'Create a validation checklist before importing semester marks.'],
  ['ph-calendar-check', 'Create a class attendance register audit checklist for the admin team.'],
  ['ph-magnifying-glass', 'Help identify likely duplicate or inconsistent marks records from this anonymized sample.'],
  ['ph-chart-bar', 'Summarize attendance coverage and missing-register counts from figures I provide.'],
  ['ph-shield-check', 'Review an academic-record workflow for permissions, auditability, and privacy.'],
  ['ph-list-checks', 'Draft a safe correction workflow for an attendance entry reported as incorrect.'],
  ['ph-file-text', 'Prepare an admin checklist for publishing semester results after validation.'],
  ['ph-arrows-clockwise', 'Suggest a repeatable weekly quality review for marks and attendance data.']
];

const ROLE_PROMPTS = {
  STUDENT,
  FACULTY: MENTOR,
  MENTOR,
  HOD,
  DEAN,
  SECTION_HEAD,
  ADMIN
};

export function getAISuggestions(role) {
  const normalized = String(role || 'STUDENT').toUpperCase();
  return ROLE_PROMPTS[normalized] || STUDENT;
}

export const AI_SUGGESTION_COUNT = Object.values({ STUDENT, MENTOR, HOD, DEAN, SECTION_HEAD, ADMIN })
  .reduce((sum, prompts) => sum + prompts.length, 0);
