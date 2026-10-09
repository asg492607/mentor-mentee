// Mentor � Reports Page
// Generates, previews, and exports per-student and cohort mentoring reports as PDF/Excel.
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { StatsService, MeetingService, TaskService } from '/js/services.js';
import { exportSingleMentorReport, exportMeetingSessionReport } from '/js/report-export.js';
import { AIService } from '/js/services/ai-service.js';

function riskBadge(r) {
  const map = { HIGH: 'badge-danger', MEDIUM: 'badge-warning', LOW: 'badge-success' };
  return `<span class="badge ${map[r] || 'badge-muted'}">${r || 'N/A'}</span>`;
}

function fmt(val, suffix = '') {
  return val !== undefined && val !== null && val !== '' ? `${val}${suffix}` : '—';
}

function statusBadge(s) {
  const cls = { REQUESTED: 'badge-warning', APPROVED: 'badge-success', ONGOING: 'badge-info', REJECTED: 'badge-danger', COMPLETED: 'badge-muted', CANCELLED: 'badge-muted' }[s] || 'badge-muted';
  return `<span class="badge ${cls}">${s || 'SCHEDULED'}</span>`;
}

// Render the AI Meeting Intelligence panel from aiInsights data
function renderAIIntelligencePanel(ai) {
  const analyzed = ai?.analyzed || 0;
  const total = ai?.total || 0;
  const pct = ai?.coveragePercent || 0;
  const rb = ai?.riskBreakdown || { HIGH: 0, MEDIUM: 0, LOW: 0 };
  const issues = ai?.recurringIssues || [];
  const escalations = ai?.escalationRequired || [];
  const recent = ai?.recentInsights || [];

  const issueChips = issues.length > 0
    ? issues.slice(0, 6).map(i =>
        `<span style="display:inline-block;background:rgba(139,92,246,0.2);border:1px solid rgba(139,92,246,0.3);color:#c4b5fd;font-size:0.72rem;padding:3px 8px;border-radius:6px;margin:2px;">${i}</span>`
      ).join('')
    : '<p style="color:#475569;font-size:0.8rem;font-style:italic;">Complete more AI-analyzed meetings to see patterns</p>';

  const escalationHTML = escalations.length > 0
    ? `<div style="font-size:0.85rem;color:#fca5a5;font-weight:700;">${escalations.length} meeting(s) need escalation</div><p style="font-size:0.75rem;color:#94a3b8;margin-top:4px;">AI flagged critical student issues</p>`
    : '<div style="font-size:0.85rem;color:#4ade80;">&#x2705; No escalations required</div><p style="font-size:0.75rem;color:#64748b;margin-top:4px;">All sessions within normal parameters</p>';

  const recentHTML = recent.length > 0 ? `
    <div style="padding:0 20px 20px;">
      <div style="font-size:0.78rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">&#x1F4C5; Recent AI-Analyzed Sessions</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${recent.map(ins => {
          const riskColor = ins.riskLevel === 'HIGH' ? '#fca5a5' : ins.riskLevel === 'MEDIUM' ? '#fcd34d' : '#6ee7b7';
          const riskBg = ins.riskLevel === 'HIGH' ? 'rgba(239,68,68,0.2)' : ins.riskLevel === 'MEDIUM' ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)';
          const summary = (ins.issuesSummary || '').slice(0, 120) + ((ins.issuesSummary || '').length > 120 ? '...' : '');
          const dateStr = ins.generatedAt ? new Date(ins.generatedAt).toLocaleDateString('en-IN') : '';
          const src = ins.transcriptSource === 'gemini+live' ? '&#x1F3A4; Gemini+Live' : '&#x1F3A4; Live Only';
          return `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:12px 16px;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;">
            <div>
              <div style="font-size:0.82rem;font-weight:600;color:#e2e8f0;margin-bottom:2px;">${ins.topic || 'Mentorship Session'}</div>
              <div style="font-size:0.75rem;color:#64748b;">${summary}</div>
              <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;">
                <span style="font-size:0.68rem;background:rgba(99,102,241,0.2);color:#a5b4fc;padding:2px 7px;border-radius:5px;">&#x2713; ${ins.taskCount || 0} Tasks</span>
                <span style="font-size:0.68rem;background:rgba(16,185,129,0.2);color:#6ee7b7;padding:2px 7px;border-radius:5px;">&#x2192; ${ins.actionCount || 0} Actions</span>
                <span style="font-size:0.68rem;background:rgba(100,116,139,0.2);color:#94a3b8;padding:2px 7px;border-radius:5px;">${src}</span>
              </div>
            </div>
            <div style="text-align:right;">
              <span style="display:inline-block;padding:3px 10px;border-radius:6px;font-size:0.72rem;font-weight:700;background:${riskBg};color:${riskColor};">${ins.riskLevel}</span>
              <div style="font-size:0.68rem;color:#475569;margin-top:4px;">${dateStr}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>` : '';

  const bodyHTML = analyzed > 0 ? `
    <div style="padding:20px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
      <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:16px;border:1px solid rgba(255,255,255,0.07);">
        <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;font-weight:700;margin-bottom:10px;">&#x26A0;&#xFE0F; AI Risk Breakdown</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;"><span style="width:10px;height:10px;border-radius:50%;background:#ef4444;flex-shrink:0;"></span><span style="font-size:0.82rem;color:#e2e8f0;flex:1;">High Risk</span><span style="font-size:1rem;font-weight:800;color:#ef4444;">${rb.HIGH}</span></div>
          <div style="display:flex;align-items:center;gap:8px;"><span style="width:10px;height:10px;border-radius:50%;background:#f59e0b;flex-shrink:0;"></span><span style="font-size:0.82rem;color:#e2e8f0;flex:1;">Medium Risk</span><span style="font-size:1rem;font-weight:800;color:#f59e0b;">${rb.MEDIUM}</span></div>
          <div style="display:flex;align-items:center;gap:8px;"><span style="width:10px;height:10px;border-radius:50%;background:#22c55e;flex-shrink:0;"></span><span style="font-size:0.82rem;color:#e2e8f0;flex:1;">Low Risk</span><span style="font-size:1rem;font-weight:800;color:#22c55e;">${rb.LOW}</span></div>
        </div>
      </div>
      <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:16px;border:1px solid rgba(255,255,255,0.07);">
        <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;font-weight:700;margin-bottom:10px;">&#x1F50D; Recurring Issue Topics</div>
        ${issueChips}
      </div>
      <div style="background:${escalations.length > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)'};border-radius:12px;padding:16px;border:1px solid ${escalations.length > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)'};">
        <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;font-weight:700;margin-bottom:10px;">&#x1F6A8; Escalation Alerts</div>
        ${escalationHTML}
      </div>
    </div>
    ${recentHTML}` :
    '<div style="padding:24px;text-align:center;"><p style="font-size:0.85rem;color:#64748b;">&#x1F916; No meetings analyzed yet. End a meeting with <strong style="color:#a5b4fc;">Live Captions (CC)</strong> turned on &mdash; AI will auto-generate a report immediately.</p></div>';

  return `
  <div id="ai-meeting-intelligence" class="card" style="margin-bottom:24px;background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%);border:1px solid rgba(139,92,246,0.3);overflow:hidden;">
    <div style="padding:16px 20px;border-bottom:1px solid rgba(139,92,246,0.2);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;background:linear-gradient(135deg,#6366f1,#a855f7);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;">&#x1F916;</div>
        <div>
          <h3 style="font-size:1rem;font-weight:800;margin:0;color:#c4b5fd;">AI Meeting Intelligence</h3>
          <p style="font-size:0.75rem;color:#94a3b8;margin:2px 0 0;">Auto-extracted from ${analyzed} of ${total} meetings &bull; ${pct}% transcript coverage &bull; No Google Drive needed</p>
        </div>
      </div>
      <span style="background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.3);color:#4ade80;font-size:0.72rem;padding:4px 10px;border-radius:8px;font-weight:600;">&#x1F3A4; Gemini Deep Transcription Active</span>
    </div>
    ${bodyHTML}
  </div>`;
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/mentor/reports')}
      <div class="main-content">
        ${createHeader('My Report Center', user)}
        <div class="page-content" id="mentor-reports-content">
          <div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  try {
    const data = await StatsService.getMentorStats(user.id);
    const { totalStudents, highRiskStudents, openIssues, completedMeetings, students, meetings, issues } = data;

    // Sort meetings: latest first
    const sortedMeetings = [...meetings].sort((a, b) => {
      const dateA = new Date(a.scheduledAt || a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.scheduledAt || b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    // Meetings per month (last 6)
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return d.toLocaleString('en-IN', { month: 'short' }) + ' ' + d.getFullYear().toString().slice(2);
    });
    const meetPerMonth = Array(6).fill(0);
    meetings.forEach(m => {
      if (!m.scheduledAt) return;
      const d = new Date(m.scheduledAt);
      for (let i = 0; i < 6; i++) {
        const ref = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        if (d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()) {
          meetPerMonth[i]++;
        }
      }
    });

    const atRisk = students.filter(s => s.riskLevel === 'HIGH' || s.riskLevel === 'MEDIUM')
      .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0));

    const sortedStudents = [...students].sort((a, b) => {
      const classA = a.class || 'ZZZ';
      const classB = b.class || 'ZZZ';
      const cComp = classA.localeCompare(classB, undefined, { numeric: true, sensitivity: 'base' });
      return cComp !== 0 ? cComp : (a.name || '').localeCompare(b.name || '');
    });

    // Fetch AI insights from the mentor report endpoint with dynamic client-side fallback
    let aiInsights = null;
    try {
      const { api } = await import('/js/api.js');
      const reportRes = await api.get('/mentor/reports');
      aiInsights = reportRes?.aiInsights || null;
    } catch (aiErr) {
      console.warn('Could not load AI insights from API:', aiErr.message);
    }

    // Dynamic client-side fallback/enhancement if backend doesn't provide complete aiInsights
    if (!aiInsights || !aiInsights.analyzed) {
      const analyzedMeetings = sortedMeetings.filter(m => m.aiNotes || m.report || m.hasAiNotes);
      const rb = { HIGH: 0, MEDIUM: 0, LOW: 0 };
      const recurringIssues = [];
      const escalationRequired = [];
      const recentInsights = [];

      analyzedMeetings.forEach(m => {
        const rLevel = (m.report?.riskLevel || m.aiNotes?.riskLevel || 'LOW').toUpperCase();
        if (rb[rLevel] !== undefined) rb[rLevel]++;
        else rb.LOW++;

        if (rLevel === 'HIGH') escalationRequired.push(m);

        const iss = m.report?.issuesDiscussed || m.aiNotes?.issuesDiscussed || m.notes?.issuesDiscussed || '';
        if (iss) {
          iss.split(/[\n,;]+/).map(s => s.replace(/^[-*•\d.]+\s*/, '').trim()).filter(s => s.length > 4 && s.length < 60).forEach(x => {
            if (!recurringIssues.includes(x)) recurringIssues.push(x);
          });
        }

        recentInsights.push({
          topic: m.type || m.description || 'Mentorship Session',
          issuesSummary: iss,
          riskLevel: rLevel,
          taskCount: m.aiNotes?.actionItems?.length || (m.report?.actionItems ? 1 : 0),
          actionCount: m.aiNotes?.remedialMeasures?.length || (m.report?.actionItems ? 1 : 0),
          generatedAt: m.report?.generatedAt || m.aiNotes?.extractedAt || m.scheduledAt,
          transcriptSource: m.aiNotes?.source || 'whisper+live'
        });
      });

      aiInsights = {
        total: meetings.length,
        analyzed: analyzedMeetings.length,
        coveragePercent: meetings.length ? Math.round((analyzedMeetings.length / meetings.length) * 100) : 0,
        riskBreakdown: rb,
        recurringIssues,
        escalationRequired,
        recentInsights: recentInsights.slice(0, 5)
      };
    }

    const rc = container.querySelector('#mentor-reports-content');
    if (!rc) return;

    rc.innerHTML = `
      <div class="dashboard-container">

        <!-- ── Header Toolbar ── -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
          <div>
            <h2 style="font-size:1.2rem;font-weight:800;margin:0;">📊 My Mentorship Report Center</h2>
            <p style="color:var(--text-muted);font-size:0.82rem;margin:3px 0 0;">Download comprehensive batch reports or official PDF reports per individual meeting session</p>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn-sm" id="btn-ai-cohort-audit" style="display:flex;align-items:center;gap:6px;font-weight:700;background:linear-gradient(135deg, #6366f1, #a855f7);color:white;border:none;border-radius:10px;padding:8px 16px;box-shadow:0 4px 12px rgba(99,102,241,0.3);">
              <span>✨</span> AI Cohort Audit & Insights
            </button>
            <button class="btn btn-sm btn-secondary" id="btn-mentor-excel" style="display:flex;align-items:center;gap:6px;font-weight:600;">
              <i class="ph ph-file-xls" style="font-size:1.1rem;color:var(--success);"></i> Download Mentee List (Excel)
            </button>
            <button class="btn btn-sm btn-secondary" id="btn-mentor-pdf" style="display:flex;align-items:center;gap:6px;font-weight:600;">
              <i class="ph ph-file-pdf" style="font-size:1.1rem;color:var(--danger);"></i> Download Summary Sheet (PDF)
            </button>
          </div>
        </div>

        <!-- ── Stat Cards ── -->
        <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:24px;">
          ${[
            ['My Students', totalStudents, 'var(--info)', 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z'],
            ['High Risk', highRiskStudents, 'var(--danger)', 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z'],
            ['Open Issues', openIssues, 'var(--warning)', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'],
            ['Completed Meetings', completedMeetings, 'var(--success)', 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'],
          ].map(([l, v, c, path]) => `
            <div class="stat-card">
              <div class="stat-icon" style="background:${c}22;">
                <svg viewBox="0 0 24 24" style="fill:${c};width:20px;height:20px;"><path d="${path}"/></svg>
              </div>
              <div class="stat-label">${l}</div>
              <div class="stat-value">${v}</div>
            </div>
          `).join('')}
        </div>

        <!-- ── AI Meeting Intelligence Live Panel ── -->
        ${renderAIIntelligencePanel(aiInsights)}

        <!-- ── AI Cohort Insights Panel (hidden by default) ── -->
        <div id="ai-cohort-insights" class="card" style="margin-bottom:24px;display:none;">
          <div class="card-header" style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:1.2rem;">🧠</span>
              <div>
                <h3 style="font-size:0.95rem;font-weight:700;margin:0;color:var(--accent);">AI Cohort Performance Intelligence</h3>
                <p style="font-size:0.75rem;color:var(--text-muted);margin:2px 0 0;">AI-generated analysis of your mentee cohort health, risk levels, and recommendations</p>
              </div>
            </div>
            <button class="btn btn-sm btn-ghost" id="btn-close-cohort-insights" style="color:var(--text-muted);">✕ Close</button>
          </div>
          <div id="ai-cohort-insights-content" style="padding:20px;font-size:0.88rem;line-height:1.6;color:var(--text-secondary);white-space:pre-wrap;"></div>
        </div>

        <!-- ── Chart + At-Risk ── -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">
          <div class="card" style="padding:20px;">
            <h3 style="font-size:0.95rem;font-weight:700;margin:0 0 16px;">📅 Meetings per Month (Last 6)</h3>
            <div style="height:220px;"><canvas id="chart-meetings-mentor"></canvas></div>
          </div>

          <div class="card">
            <div class="card-header" style="padding:14px 20px;border-bottom:1px solid var(--border);">
              <h3 style="font-size:0.95rem;font-weight:700;margin:0;">⚠️ At-Risk Students</h3>
            </div>
            ${atRisk.length === 0
              ? '<p style="padding:20px;color:var(--text-muted);">No at-risk students. 🎉</p>'
              : `<div class="table-responsive">
                  <table class="data-table" style="width:100%;">
                    <thead><tr><th>Student</th><th>CGPA</th><th>Att.</th><th>Score</th><th>Risk</th></tr></thead>
                    <tbody>
                      ${atRisk.map(s => `
                        <tr>
                          <td style="font-weight:600;">${s.name}</td>
                          <td style="color:${(parseFloat(s.cgpa) || 0) < 6 ? 'var(--danger)' : 'inherit'};">${fmt(s.cgpa)}</td>
                          <td style="color:${(parseFloat(s.attendance) || 0) < 75 ? 'var(--danger)' : 'inherit'};">${fmt(s.attendance, '%')}</td>
                          <td><span style="font-weight:700;color:${(s.riskScore || 0) > 60 ? 'var(--danger)' : 'var(--warning)'};">${s.riskScore || 0}</span><span style="color:var(--text-muted);font-size:0.75rem;">/100</span></td>
                          <td>${riskBadge(s.riskLevel)}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>`
            }
          </div>
        </div>

        <!-- ── Individual Meeting Session Reports (Download per Meeting) ── -->
        <div class="card" style="margin-bottom:24px;">
          <div class="card-header" style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <div>
              <h3 style="font-size:0.95rem;font-weight:700;margin:0;display:flex;align-items:center;gap:8px;">
                <span style="color:var(--accent);">📋</span> Individual Meeting Session Reports
              </h3>
              <p style="font-size:0.78rem;color:var(--text-muted);margin:3px 0 0;">
                Download official MIT-ADT University Mentorship Session Reports (with Issues Discussed, Remedial Actions, Signatures &amp; Verified Attendance)
              </p>
            </div>
            <span class="badge badge-accent" style="font-size:0.8rem;">${sortedMeetings.length} Total Sessions</span>
          </div>

          ${sortedMeetings.length === 0
            ? `<div style="padding:32px;text-align:center;color:var(--text-muted);">
                <p style="margin-bottom:10px;">No meeting sessions scheduled or logged yet.</p>
                <a href="#/mentor/meetings" class="btn btn-sm btn-primary">+ Schedule First Meeting</a>
              </div>`
            : `<div class="table-responsive">
                <table class="data-table" style="width:100%;font-size:0.875rem;">
                  <thead>
                    <tr>
                      <th style="padding:12px;">#</th>
                      <th style="padding:12px;">Topic / Agenda</th>
                      <th style="padding:12px;">Mentee / Attendees</th>
                      <th style="padding:12px;">Date &amp; Time</th>
                      <th style="padding:12px;">Status</th>
                      <th style="padding:12px;text-align:right;">Official Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${sortedMeetings.map((m, idx) => {
                      const topic = m.description || m.type || 'Mentorship Session';
                      const isGrp = m.isGroup || m.studentId === 'ALL';
                      const attendee = isGrp ? '👥 Group Meeting (All Mentees)' : (m.studentName || '—');
                      const dateStr = m.scheduledAt 
                        ? new Date(m.scheduledAt).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' })
                        : (m.preferredDate ? new Date(m.preferredDate).toLocaleDateString('en-IN', { dateStyle:'medium' }) : 'Date not set');

                      return `
                        <tr>
                          <td style="padding:12px;color:var(--text-muted);font-size:0.82rem;">${idx + 1}</td>
                          <td style="padding:12px;">
                            <strong style="color:var(--text-primary);display:block;font-size:0.9rem;">${topic}</strong>
                            ${m.notes?.issuesDiscussed ? `<small style="color:var(--text-muted);display:block;margin-top:2px;">Issues: ${m.notes.issuesDiscussed.slice(0, 60)}${m.notes.issuesDiscussed.length > 60 ? '...' : ''}</small>` : ''}
                          </td>
                          <td style="padding:12px;font-weight:600;">
                            ${isGrp ? `<span class="badge badge-accent">${attendee}</span>` : attendee}
                          </td>
                          <td style="padding:12px;color:var(--text-secondary);font-size:0.82rem;">${dateStr}</td>
                          <td style="padding:12px;">${statusBadge(m.status)}</td>
                          <td style="padding:12px;text-align:right;white-space:nowrap;">
                            <div style="display:flex;gap:6px;justify-content:flex-end;">
                              <button class="btn btn-sm ai-enhanced-report-btn" data-id="${m.id}" style="display:inline-flex;align-items:center;gap:5px;font-weight:600;padding:6px 12px;border-radius:8px;background:linear-gradient(135deg,#6366f1,#a855f7);color:white;border:none;font-size:0.8rem;">
                                <span>✨</span> AI Report
                              </button>
                              <button class="btn btn-sm btn-primary meeting-report-dl-btn" data-id="${m.id}" style="display:inline-flex;align-items:center;gap:6px;font-weight:600;padding:6px 14px;border-radius:8px;">
                                <i class="ph ph-file-pdf" style="font-size:1.1rem;"></i> Download
                              </button>
                            </div>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>`
          }
        </div>

        <!-- ── Full Mentee Directory ── -->
        <div class="card" style="margin-bottom:24px;">
          <div class="card-header" style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
            <div>
              <h3 style="font-size:0.95rem;font-weight:700;margin:0;">👥 My Complete Mentee Directory</h3>
              <p style="font-size:0.78rem;color:var(--text-muted);margin:3px 0 0;">All ${totalStudents} assigned students — sorted classwise</p>
            </div>
            <span class="badge badge-accent" style="font-size:0.8rem;">${totalStudents} Students</span>
          </div>

          ${sortedStudents.length === 0
            ? '<p style="padding:24px;color:var(--text-muted);text-align:center;">No students assigned to you yet.</p>'
            : `<div class="table-responsive">
                <table class="data-table" style="width:100%;">
                  <thead>
                    <tr>
                      <th style="padding:12px;">#</th>
                      <th style="padding:12px;">Student Name</th>
                      <th style="padding:12px;">Enrollment No.</th>
                      <th style="padding:12px;">Class</th>
                      <th style="padding:12px;">CGPA</th>
                      <th style="padding:12px;">Attendance</th>
                      <th style="padding:12px;">Risk Level</th>
                      <th style="padding:12px;">Department</th>
                      <th style="padding:12px;text-align:right;">Booklet</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${sortedStudents.map((s, i) => `
                      <tr>
                        <td style="padding:12px;color:var(--text-muted);font-size:0.82rem;">${i + 1}</td>
                        <td style="padding:12px;font-weight:600;">${s.name || '—'}</td>
                        <td style="padding:12px;font-size:0.85rem;">${s.enrollmentNumber || s.rollNumber || '—'}</td>
                        <td style="padding:12px;"><span class="badge badge-muted">${s.class ? `Class ${s.class}` : 'Unassigned'}</span></td>
                        <td style="padding:12px;color:${(parseFloat(s.cgpa) || 0) < 6 ? 'var(--danger)' : 'inherit'};font-weight:600;">${fmt(s.cgpa)}</td>
                        <td style="padding:12px;color:${(parseFloat(s.attendance) || 0) < 75 ? 'var(--danger)' : 'inherit'};">${fmt(s.attendance, '%')}</td>
                        <td style="padding:12px;">${riskBadge(s.riskLevel)}</td>
                        <td style="padding:12px;font-size:0.82rem;color:var(--text-muted);">${s.department || '—'}</td>
                        <td style="padding:12px;text-align:right;">
                          <a href="#/mentor/booklet?studentId=${s.id}" class="btn btn-xs btn-secondary" style="display:inline-flex;align-items:center;gap:4px;">
                            <i class="ph ph-book-open"></i> Booklet
                          </a>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>`
          }
        </div>

      </div>

        <!-- ── AI Enhanced Report Modal ── -->
        <div id="ai-report-modal" class="modal-backdrop" style="display:none;z-index:9999;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);position:fixed;inset:0;justify-content:center;align-items:center;">
          <div class="modal" style="max-width:680px;width:95%;max-height:90vh;overflow-y:auto;background:var(--bg-card,#1e293b);border-radius:16px;border:1px solid var(--border);color:var(--text-primary);padding:28px;box-shadow:0 16px 48px rgba(0,0,0,0.4);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:12px;">
              <h3 style="margin:0;font-size:1.1rem;font-weight:800;display:flex;align-items:center;gap:8px;">
                <span>✨</span> AI Enhanced Mentorship Report
              </h3>
              <button class="btn btn-ghost btn-sm" id="close-ai-report-modal" style="font-size:1.2rem;">✕</button>
            </div>
            <div id="ai-report-modal-body" style="font-size:0.88rem;">
              <div style="display:flex;justify-content:center;padding:40px;"><div class="spinner"></div></div>
            </div>
          </div>
        </div>
    `;

    // Chart
    if (window.Chart) {
      const canvas = container.querySelector('#chart-meetings-mentor');
      if (canvas) {
        if (activeMentorReportsChart) activeMentorReportsChart.destroy();
        const tc = '#475569';
        const gc = 'rgba(0,0,0,0.06)';

        activeMentorReportsChart = new window.Chart(canvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: months,
            datasets: [{
              label: 'Meetings',
              data: meetPerMonth,
              backgroundColor: 'rgba(124,106,255,0.55)',
              borderColor: '#7c6aff',
              borderWidth: 2,
              borderRadius: 6
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, ticks: { stepSize: 1, color: tc }, grid: { color: gc } },
              x: { grid: { display: false }, ticks: { color: tc } }
            }
          }
        });
      }
    }

    // Individual Meeting PDF Report Download Handlers
    container.querySelectorAll('.meeting-report-dl-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const m = meetings.find(x => x.id === btn.dataset.id);
        if (!m) {
          showToast('Meeting record not found', 'error');
          return;
        }

        const isValidIssue = m.report?.issuesDiscussed && m.report.issuesDiscussed.trim().length > 4 && !/^(n|na|nil|none)$/i.test(m.report.issuesDiscussed.trim());
        if (!isValidIssue) {
          try {
            const studentProfile = students.find(s => s.id === m.studentId) || {};
            const cleanNotes = (m.notes?.issuesDiscussed || m.notes?.summary || m.description || '').trim();
            const validNotes = cleanNotes.length > 4 && !/^(n|na|nil|none)$/i.test(cleanNotes) ? cleanNotes : '';

            const rep = await AIService.generateMentorMeetingReport({
              meeting: m,
              studentName: m.studentName || studentProfile.name || '',
              studentProfile,
              transcript: m.transcript || '',
              notes: validNotes
            });

            const updatedReport = {
              ...(m.report || {}),
              topic: rep.topic || m.type || 'Mentorship Session Review',
              issuesDiscussed: rep.issuesDiscussed,
              actionItems: rep.actionItems,
              tasks: rep.tasks || [],
              confidentialObservations: rep.confidentialObservations || '',
              remarks: rep.remarks || '',
              riskLevel: rep.riskLevel || m.riskLevel || 'LOW',
              riskSignals: rep.riskSignals || [],
              recordingUrl: m.recordingUrl || m.lastRecording?.url || m.report?.recordingUrl || '',
              savedAt: new Date().toISOString()
            };

            m.report = updatedReport;
            MeetingService.update(m.id, { report: updatedReport }).catch(e => console.warn('Persistence notice:', e));
          } catch (genErr) {
            console.warn('Auto-generation fallback on export:', genErr);
          }
        }

        exportMeetingSessionReport(m);
      });
    });

    // Batch Download Buttons
    container.querySelector('#btn-mentor-excel')?.addEventListener('click', async () => {
      await exportSingleMentorReport(user.id, 'excel');
    });

    container.querySelector('#btn-mentor-pdf')?.addEventListener('click', async () => {
      await exportSingleMentorReport(user.id, 'pdf');
    });

    // AI Cohort Audit
    container.querySelector('#btn-ai-cohort-audit')?.addEventListener('click', async () => {
      const insightsPanel = container.querySelector('#ai-cohort-insights');
      const insightsContent = container.querySelector('#ai-cohort-insights-content');
      if (!insightsPanel || !insightsContent) return;

      insightsPanel.style.display = 'block';
      insightsContent.innerHTML = '<div style="display:flex;justify-content:center;padding:30px;"><div class="spinner"></div><span style="margin-left:12px;color:var(--text-muted);">AI analyzing cohort data...</span></div>';

      try {
        const summary = await AIService.generateCohortExecutiveSummary({
          students,
          meetings,
          mentorName: user.name || ''
        });
        insightsContent.innerHTML = AIService.formatMarkdown(summary);
      } catch (err) {
        insightsContent.innerHTML = `<div style="color:var(--danger);">AI analysis failed: ${err.message}</div>`;
      }
    });

    container.querySelector('#btn-close-cohort-insights')?.addEventListener('click', () => {
      const panel = container.querySelector('#ai-cohort-insights');
      if (panel) panel.style.display = 'none';
    });


    // AI Enhanced Report per meeting
    container.querySelectorAll('.ai-enhanced-report-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const m = meetings.find(x => x.id === btn.dataset.id);
        if (!m) { showToast('Meeting not found', 'error'); return; }

        const modal = container.querySelector('#ai-report-modal');
        const body = container.querySelector('#ai-report-modal-body');
        if (!modal || !body) return;

        modal.style.display = 'flex';
        body.innerHTML = '<div style="display:flex;justify-content:center;padding:40px;"><div class="spinner"></div><span style="margin-left:12px;color:var(--text-muted);">AI generating enhanced report...</span></div>';

        try {
          const studentProfile = students.find(s => s.id === m.studentId) || {};
          const hasValidIssues = m.report?.issuesDiscussed && m.report.issuesDiscussed.trim().length > 4 && !/^(n|na|nil|none)$/i.test(m.report.issuesDiscussed.trim());
          const report = hasValidIssues
            ? m.report
            : await AIService.generateMentorMeetingReport({
                meeting: m,
                studentName: m.studentName || studentProfile.name || '',
                studentProfile,
                transcript: '',
                notes: m.notes?.issuesDiscussed || m.notes?.summary || m.description || ''
              });

          const topic = m.report?.topic || m.type || m.description || 'Mentorship Session';
          const dateStr = m.scheduledAt
            ? new Date(m.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
            : 'Date not set';

          const existingRisk = m.report?.riskLevel || m.aiNotes?.riskLevel || report.riskLevel || 'LOW';
          const existingConfidential = m.report?.confidentialObservations || m.report?.confidentialNotes || m.aiNotes?.confidentialObservations || '';
          const existingTasks = Array.isArray(m.aiNotes?.actionItems)
            ? m.aiNotes.actionItems.join('\n')
            : (Array.isArray(report.tasks) ? report.tasks.join('\n') : (report.actionItems || ''));
          const recUrl = m.recordingUrl || m.report?.recordingUrl || m.lastRecording?.url || '';

          body.innerHTML = `
            <div style="margin-bottom:16px;padding:14px;background:var(--bg-secondary,rgba(255,255,255,0.03));border-radius:12px;border:1px solid var(--border);">
              <div style="font-size:0.95rem;font-weight:700;margin-bottom:4px;">${topic}</div>
              <div style="font-size:0.8rem;color:var(--text-muted);">${dateStr} • ${m.studentName || 'Mentee'} • ${m.department || 'CSE'}</div>
              ${recUrl ? `
                <div style="margin-top:8px;font-size:0.8rem;">
                  <a href="${escapeHtml(recUrl)}" target="_blank" rel="noopener noreferrer" style="color:#60a5fa;text-decoration:none;display:inline-flex;align-items:center;gap:4px;font-weight:600;">
                    📁 View Voice Recording in Google Drive
                  </a>
                </div>
              ` : ''}
            </div>

            <div class="form-group" style="margin-bottom:12px;">
              <label style="font-weight:700;font-size:0.82rem;color:var(--text-secondary);">Issues Discussed</label>
              <textarea id="ai-rpt-issues" class="form-textarea" rows="3" style="border-radius:8px;">${report.issuesDiscussed || ''}</textarea>
            </div>
            <div class="form-group" style="margin-bottom:12px;">
              <label style="font-weight:700;font-size:0.82rem;color:var(--text-secondary);">Action Items & Remedial Measures</label>
              <textarea id="ai-rpt-actions" class="form-textarea" rows="3" style="border-radius:8px;">${report.actionItems || ''}</textarea>
            </div>
            <div class="form-group" style="margin-bottom:12px;">
              <label style="font-weight:700;font-size:0.82rem;color:var(--text-secondary);">Follow-Up Action Tasks (Assigned to Mentee/Mentor)</label>
              <textarea id="ai-rpt-tasks" class="form-textarea" rows="2" style="border-radius:8px;" placeholder="One task per line...">${existingTasks}</textarea>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
              <div class="form-group">
                <label style="font-weight:700;font-size:0.82rem;color:var(--text-secondary);">Risk Level Assessment</label>
                <select id="ai-rpt-risk" class="form-select" style="border-radius:8px;padding:8px 12px;width:100%;">
                  <option value="LOW" ${existingRisk === 'LOW' ? 'selected' : ''}>🟢 LOW RISK</option>
                  <option value="MEDIUM" ${existingRisk === 'MEDIUM' ? 'selected' : ''}>🟡 MEDIUM RISK</option>
                  <option value="HIGH" ${existingRisk === 'HIGH' ? 'selected' : ''}>🔴 HIGH RISK (Escalate)</option>
                </select>
              </div>
              <div class="form-group">
                <label style="font-weight:700;font-size:0.82rem;color:var(--text-secondary);">Confidential Mentor Observations</label>
                <textarea id="ai-rpt-confidential" class="form-textarea" rows="2" style="border-radius:8px;" placeholder="Internal confidential observations...">${existingConfidential}</textarea>
              </div>
            </div>
            <div class="form-group" style="margin-bottom:12px;">
              <label style="font-weight:700;font-size:0.82rem;color:var(--text-secondary);">General Remarks</label>
              <textarea id="ai-rpt-remarks" class="form-textarea" rows="2" style="border-radius:8px;">${report.remarks || ''}</textarea>
            </div>

            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
              <button class="btn btn-sm btn-secondary" id="btn-ai-rpt-close" style="border-radius:8px;">Close</button>
              <button class="btn btn-sm btn-primary" id="btn-ai-rpt-save-dl" data-id="${m.id}" style="border-radius:8px;font-weight:700;display:flex;align-items:center;gap:6px;">
                <i class="ph ph-file-pdf"></i> Save & Download Official PDF
              </button>
            </div>
          `;

          body.querySelector('#btn-ai-rpt-close')?.addEventListener('click', () => modal.style.display = 'none');
          body.querySelector('#btn-ai-rpt-save-dl')?.addEventListener('click', async () => {
            const saveBtn = body.querySelector('#btn-ai-rpt-save-dl');
            if (saveBtn) {
              saveBtn.disabled = true;
              saveBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;"></span> Saving...';
            }

            const issuesDiscussed = body.querySelector('#ai-rpt-issues')?.value || '';
            const actionItems = body.querySelector('#ai-rpt-actions')?.value || '';
            const tasksRaw = body.querySelector('#ai-rpt-tasks')?.value || '';
            const riskLevel = body.querySelector('#ai-rpt-risk')?.value || 'LOW';
            const confidentialNotes = body.querySelector('#ai-rpt-confidential')?.value || '';
            const remarks = body.querySelector('#ai-rpt-remarks')?.value || '';

            const taskLines = tasksRaw.split('\n').map(t => t.replace(/^[-*•\d.]+\s*/, '').trim()).filter(Boolean);

            const updatedReport = {
              ...(m.report || {}),
              issuesDiscussed,
              actionItems,
              remarks,
              riskLevel,
              confidentialNotes,
              tasks: taskLines,
              preparedBy: user.name || m.mentorName || 'Faculty Mentor',
              verifiedAt: new Date().toISOString(),
              generatedAt: m.report?.generatedAt || new Date().toISOString()
            };

            const updatedAiNotes = {
              ...(m.aiNotes || {}),
              topic: m.type || m.description || 'Mentorship Session',
              issuesDiscussed,
              actionItems: taskLines.length > 0 ? taskLines : (actionItems ? [actionItems] : []),
              riskLevel,
              confidentialNotes,
              remedialMeasures: actionItems ? [actionItems] : [],
              extractedAt: new Date().toISOString()
            };

            // Persist to Firestore
            try {
              await MeetingService.update(m.id, {
                report: updatedReport,
                aiNotes: updatedAiNotes,
                hasAiNotes: true,
                status: m.status === 'REQUESTED' ? 'APPROVED' : (m.status || 'COMPLETED'),
                notes: {
                  ...(m.notes || {}),
                  issuesDiscussed,
                  actionItems,
                  remarks,
                  aiGenerated: true,
                  aiGeneratedAt: new Date().toISOString()
                }
              });

              await MeetingService.saveAINotes(m.id, updatedAiNotes);

              // Sync action tasks into TaskService if single student
              if (taskLines.length > 0 && m.studentId && m.studentId !== 'ALL') {
                try {
                  for (const taskDesc of taskLines.slice(0, 5)) {
                    await TaskService.create({
                      title: taskDesc.slice(0, 80),
                      description: `Action item from meeting session on ${dateStr}: ${taskDesc}`,
                      studentId: m.studentId,
                      mentorId: user.id,
                      status: 'PENDING',
                      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
                    });
                  }
                } catch (tErr) {
                  console.warn('Could not sync task items:', tErr);
                }
              }

              // Update local memory
              m.report = updatedReport;
              m.aiNotes = updatedAiNotes;
              m.notes = { ...(m.notes || {}), issuesDiscussed, actionItems, remarks };
            } catch (saveErr) {
              console.error('Error saving AI report to Firestore:', saveErr);
            }

            // Export official PDF report
            exportMeetingSessionReport({ ...m, report: updatedReport });
            modal.style.display = 'none';
            showToast('Official AI-enhanced report saved and PDF downloaded!', 'success');
          });

        } catch (err) {
          body.innerHTML = `<div style="color:var(--danger);padding:20px;">AI report generation failed: ${err.message}</div>`;
        }
      });
    });

    container.querySelector('#close-ai-report-modal')?.addEventListener('click', () => {
      const modal = container.querySelector('#ai-report-modal');
      if (modal) modal.style.display = 'none';
    });

  } catch (err) {
    console.error('Mentor reports error:', err);
    const rc = container.querySelector('#mentor-reports-content');
    if (rc) rc.innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error loading reports</h3><p>${err.message}</p></div>`;
  }
}

let activeMentorReportsChart = null;

export function teardown() {
  if (activeMentorReportsChart && typeof activeMentorReportsChart.destroy === 'function') {
    activeMentorReportsChart.destroy();
    activeMentorReportsChart = null;
  }
}





