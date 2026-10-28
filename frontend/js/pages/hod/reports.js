// HOD � Departmental Reports
// Generates mentoring compliance and semester progress reports for the department.
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { StatsService, MeetingService } from '/js/services.js';
import { showModal } from '/js/components/modal.js';
import { exportMentorStudentReport, exportSingleMentorReport, exportMeetingSessionReport } from '/js/report-export.js';
import { showToast } from '/js/components/toast.js';
import { departmentScope, escapeHtml } from '/js/utils.js';

const attendanceTime = value => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const attendanceDuration = seconds => {
  if (seconds === null || seconds === undefined || seconds === '') return '—';
  const duration = Number(seconds);
  if (!Number.isFinite(duration) || duration < 0) return '—';
  const mins = Math.floor(duration / 60);
  const hours = Math.floor(mins / 60);
  return hours ? `${hours}h ${mins % 60}m` : `${mins}m`;
};
const distinctAttendeeCount = attendees => new Set(attendees.map(item => item?.userId || item?.name).filter(Boolean)).size;

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/hod/reports')}
      <div class="main-content">
        ${createHeader('Department Mentor Reports', user)}
        <div class="page-content" id="hod-reports-content">
          <div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  try {
    const dept = user.department;
    const deptScope = departmentScope(user);
    const [data, meetings] = await Promise.all([
      StatsService.getDeptStats(deptScope),
      MeetingService.getByDepartment(deptScope).catch(() => [])
    ]);
    const { totalStudents = 0, totalMentors = 0, highRiskStudents = 0, resolvedIssues = 0, students = [], mentors = [] } = data;

    const content = container.querySelector('#hod-reports-content');
    if (!content) return;

    const classesList = [...new Set(students.map(s => s.class).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    content.innerHTML = `
      <div class="dashboard-container">
        <!-- TOP TOOLBAR & MASTER EXPORTS -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:1.25rem; font-weight:800; margin:0;">${dept || 'Department'} Mentorship & Workload Center</h2>
            <p style="color:var(--text-muted); font-size:0.85rem; margin:2px 0 0;">Comprehensive oversight of mentor workload, capacity, allocation audit trails & mentee analytics</p>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn btn-sm btn-secondary" id="btn-export-excel" style="display:flex; align-items:center; gap:6px; font-weight:600;">
              <i class="ph ph-file-xls" style="font-size:1.1rem; color:var(--success);"></i> Export Master Excel
            </button>
            <button class="btn btn-sm btn-secondary" id="btn-export-pdf" style="display:flex; align-items:center; gap:6px; font-weight:600;">
              <i class="ph ph-file-pdf" style="font-size:1.1rem; color:var(--danger);"></i> Export Master PDF
            </button>
          </div>
        </div>

        <!-- STAT METRICS -->
        <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:24px;">
          ${[
            ['Department Mentors', totalMentors, 'var(--accent)', 'ph-users'],
            ['Assigned Students', totalStudents, 'var(--info)', 'ph-graduation-cap'],
            ['At-Risk Students', highRiskStudents, 'var(--danger)', 'ph-warning-circle'],
            ['Resolved Issues', resolvedIssues, 'var(--success)', 'ph-check-circle']
          ].map(([label, val, color, icon]) => `
            <div class="stat-card" style="display:flex; align-items:center; gap:14px; padding:18px;">
              <div class="stat-icon" style="background:${color}18; color:${color}; font-size:1.4rem; width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <i class="ph ${icon}"></i>
              </div>
              <div>
                <div class="stat-label" style="font-size:0.72rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.04em;">${label}</div>
                <div class="stat-value" style="font-size:1.5rem; font-weight:700; color:var(--text-primary); margin-top:2px;">${val}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- ⚡ ONE-CLICK SINGLE MENTOR REPORT BAR -->
        <div class="card" style="padding:18px 24px; margin-bottom:24px; background:var(--bg-secondary); border:1px solid var(--border);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:36px; height:36px; border-radius:8px; background:var(--accent-light); color:var(--accent); display:flex; align-items:center; justify-content:center; font-size:1.2rem;">
                <i class="ph ph-file-arrow-down"></i>
              </div>
              <div>
                <h4 style="margin:0; font-size:0.95rem; font-weight:700;">One-Click Mentor Report Download</h4>
                <p style="margin:2px 0 0; font-size:0.8rem; color:var(--text-secondary);">Select a specific mentor to generate & download their complete classwise mentee list instantly.</p>
              </div>
            </div>
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
              <select id="single-mentor-select" class="form-select" style="padding:8px 12px; font-size:0.85rem; min-width:240px;">
                <option value="">-- Select Mentor Name --</option>
                ${mentors.map(m => {
                  const mCount = students.filter(s => s.mentorId === m.id).length;
                  return `<option value="${m.id}">${escapeHtml(m.name)} (${mCount} Mentees)</option>`;
                }).join('')}
              </select>
              <button class="btn btn-primary btn-sm" id="btn-single-mentor-excel" style="display:flex; align-items:center; gap:6px;">
                <i class="ph ph-file-xls"></i> Excel List
              </button>
              <button class="btn btn-secondary btn-sm" id="btn-single-mentor-pdf" style="display:flex; align-items:center; gap:6px;">
                <i class="ph ph-file-pdf"></i> PDF List
              </button>
            </div>
          </div>
        </div>

        <!-- 📊 MENTOR WORKLOAD & CAPACITY SUMMARY TABLE -->
        <div class="card" style="margin-bottom:24px;">
          <div class="card-header" style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <h3 style="font-size:0.95rem; font-weight:700; margin:0;">📊 Mentor Workload, Capacity & Individual Reports</h3>
              <p style="font-size:0.8rem; color:var(--text-secondary); margin:2px 0 0;">Real-time allocation + one-click per-mentor report download</p>
            </div>
            <span class="badge badge-info" style="font-size:0.8rem;">${mentors.length} Faculty Mentors</span>
          </div>

          ${mentors.length === 0
            ? '<p style="padding:24px; color:var(--text-muted); text-align:center;">No mentors found in this department.</p>'
            : `<div class="table-responsive">
                <table class="data-table" style="width:100%;">
                  <thead>
                    <tr>
                      <th style="padding:12px;">#</th>
                      <th style="padding:12px;">Faculty Mentor</th>
                      <th style="padding:12px;">Designation</th>
                      <th style="padding:12px; text-align:center;">Assigned Mentees</th>
                      <th style="padding:12px; text-align:center;">Capacity (Max)</th>
                      <th style="padding:12px; text-align:center;">Remaining</th>
                      <th style="padding:12px;">Load Bar</th>
                      <th style="padding:12px; text-align:center;">Download Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${mentors.map((m, idx) => {
                      const assignedCount = students.filter(s => s.mentorId === m.id).length;
                      const maxCapacity = m.maxStudents || 20;
                      const remaining = Math.max(0, maxCapacity - assignedCount);
                      const pct = Math.min(100, Math.round((assignedCount / maxCapacity) * 100));
                      const barColor = pct >= 100 ? 'var(--danger)' : pct >= 80 ? 'var(--warning)' : 'var(--accent)';

                      return `
                        <tr>
                          <td style="padding:12px;color:var(--text-muted);font-size:0.82rem;">${idx + 1}</td>
                          <td style="padding:12px; font-weight:600; color:var(--text-primary);">${escapeHtml(m.name)}</td>
                          <td style="padding:12px; color:var(--text-secondary); font-size:0.85rem;">${escapeHtml(m.designation || 'Faculty')}</td>
                          <td style="padding:12px; text-align:center;"><span class="badge badge-accent" style="font-weight:700;">${assignedCount}</span></td>
                          <td style="padding:12px; text-align:center; font-weight:600;">${maxCapacity}</td>
                          <td style="padding:12px; text-align:center;">
                            <span class="badge ${remaining === 0 ? 'badge-danger' : remaining <= 3 ? 'badge-warning' : 'badge-success'}" style="font-weight:700;">
                              ${remaining} slots
                            </span>
                          </td>
                          <td style="padding:12px; width:160px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                              <div style="flex:1; height:8px; background:var(--bg-tertiary); border-radius:4px; overflow:hidden;">
                                <div style="width:${pct}%; height:100%; background:${barColor}; border-radius:4px;"></div>
                              </div>
                              <span style="font-size:0.75rem; font-weight:600; color:var(--text-muted); width:36px;">${pct}%</span>
                            </div>
                          </td>
                          <td style="padding:12px; text-align:center;">
                            <div style="display:flex;gap:6px;justify-content:center;">
                              <button class="btn btn-xs btn-secondary btn-mentor-dl-excel" data-mentor-id="${m.id}" data-mentor-name="${escapeHtml(m.name)}" title="Download Excel report for ${escapeHtml(m.name)}" style="display:flex;align-items:center;gap:4px;font-size:0.75rem;">
                                <i class="ph ph-file-xls" style="color:var(--success);"></i> XLS
                              </button>
                              <button class="btn btn-xs btn-secondary btn-mentor-dl-pdf" data-mentor-id="${m.id}" data-mentor-name="${escapeHtml(m.name)}" title="Download PDF report for ${escapeHtml(m.name)}" style="display:flex;align-items:center;gap:4px;font-size:0.75rem;">
                                <i class="ph ph-file-pdf" style="color:var(--danger);"></i> PDF
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

        <!-- 📁 CENTRALIZED MEETING REPORTS REPOSITORY (SINGLE PLACE FOR ALL MEETINGS) -->
        <div class="card" style="margin-bottom:24px; border:1px solid var(--border);">
          <div class="card-header" style="padding:18px 22px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div>
              <h3 style="font-size:1.05rem; font-weight:800; margin:0; display:flex; align-items:center; gap:8px;">
                <i class="ph ph-folder-notch-open" style="color:var(--primary); font-size:1.25rem;"></i> Centralized Meeting Reports &amp; Documentation Hub
              </h3>
              <p style="font-size:0.8rem; color:var(--text-secondary); margin:3px 0 0;">
                All mentorship session reports, attendee rosters with timestamps &amp; AI-extracted minutes stored in a single repository
              </p>
            </div>
            <span class="badge badge-primary" style="font-size:0.8rem; font-weight:700;" id="meet-repo-count">${(meetings || []).length} Meeting Reports</span>
          </div>

          <!-- Filters Control Bar -->
          <div style="padding:14px 20px; background:var(--bg-secondary); border-bottom:1px solid var(--border); display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:10px;">
            <input type="text" id="filter-meeting-search" class="form-input" placeholder="🔍 Search Topic, Mentor, or Mentee..." style="padding:8px 12px; font-size:0.85rem;">
            
            <select id="filter-meeting-mentor" class="form-select" style="padding:8px 12px; font-size:0.85rem;">
              <option value="">All Faculty Mentors</option>
              ${mentors.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')}
            </select>

            <select id="filter-meeting-type" class="form-select" style="padding:8px 12px; font-size:0.85rem;">
              <option value="">All Session Types</option>
              <option value="1-on-1">1-on-1 Mentorship</option>
              <option value="Group">Group Session</option>
              <option value="Academic">Academic Review</option>
              <option value="Attendance">Attendance Review</option>
            </select>

            <select id="filter-meeting-status" class="form-select" style="padding:8px 12px; font-size:0.85rem;">
              <option value="">All Statuses</option>
              <option value="COMPLETED">Completed Reports</option>
              <option value="HAS_ATTENDEES">With Attendance Events</option>
              <option value="HAS_AI">AI Intelligence Generated</option>
            </select>
          </div>

          <div id="meeting-reports-table-wrap" style="overflow-x:auto;"></div>
        </div>

        <!-- 📜 ALLOCATION & REASSIGNMENT AUDIT HISTORY -->
        <div class="card" style="margin-bottom:24px;">
          <div class="card-header" style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
            <div>
              <h3 style="font-size:0.95rem; font-weight:700; margin:0;">📜 Allocation & Reassignment Audit Trail</h3>
              <p style="font-size:0.8rem; color:var(--text-secondary); margin:2px 0 0;">Complete audit trail of mentor assignments, year changes & reassignment reasons</p>
            </div>
            <span class="badge badge-secondary" style="font-size:0.8rem;">System Audit</span>
          </div>

          <div id="audit-trail-table-wrap" style="overflow-x:auto;"></div>
        </div>

      </div>
    `;

    // Render Mentee Directory Table with filter logic
    function renderMeetingReports() {
      const wrap = container.querySelector('#meeting-reports-table-wrap');
      const countBadge = container.querySelector('#meet-repo-count');
      if (!wrap) return;

      const query = (container.querySelector('#filter-meeting-search')?.value || '').toLowerCase().trim();
      const selectedMentor = container.querySelector('#filter-meeting-mentor')?.value || '';
      const selectedType = (container.querySelector('#filter-meeting-type')?.value || '').toLowerCase();
      const selectedStatus = container.querySelector('#filter-meeting-status')?.value || '';

      let filtered = [...(meetings || [])];

      if (query) {
        filtered = filtered.filter(m =>
          (m.type || '').toLowerCase().includes(query) ||
          (m.topic || '').toLowerCase().includes(query) ||
          (m.mentorName || '').toLowerCase().includes(query) ||
          (m.studentName || '').toLowerCase().includes(query) ||
          (m.description || '').toLowerCase().includes(query)
        );
      }

      if (selectedMentor) {
        filtered = filtered.filter(m => m.mentorId === selectedMentor);
      }

      if (selectedType) {
        filtered = filtered.filter(m =>
          (m.type || '').toLowerCase().includes(selectedType) ||
          (m.topic || '').toLowerCase().includes(selectedType)
        );
      }

      if (selectedStatus === 'COMPLETED') {
        filtered = filtered.filter(m => m.status === 'COMPLETED');
      } else if (selectedStatus === 'HAS_ATTENDEES') {
        filtered = filtered.filter(m => Array.isArray(m.attendees) && m.attendees.length > 0);
      } else if (selectedStatus === 'HAS_AI') {
        filtered = filtered.filter(m => m.hasAiNotes || m.aiNotes);
      }

      if (countBadge) countBadge.textContent = `${filtered.length} Meeting Reports`;

      if (filtered.length === 0) {
        wrap.innerHTML = `<div style="padding:48px 20px; text-align:center; color:var(--text-muted);">
          <i class="ph ph-folder-notch-open" style="font-size:2.5rem; opacity:0.4; display:block; margin-bottom:8px;"></i>
          <h4 style="margin:0 0 4px; font-weight:700; color:var(--text-secondary);">No Meeting Reports Found</h4>
          <p style="margin:0; font-size:0.85rem;">No mentorship meetings match the specified search or filter criteria.</p>
        </div>`;
        return;
      }

      wrap.innerHTML = `
        <table class="data-table" style="width:100%;">
          <thead>
            <tr>
              <th style="padding:12px; width:40px;">#</th>
              <th style="padding:12px;">Session Topic &amp; Type</th>
              <th style="padding:12px;">Faculty Mentor</th>
              <th style="padding:12px;">Mentee / Target</th>
              <th style="padding:12px;">Attendance &amp; Timestamps</th>
              <th style="padding:12px;">Key Summary / Notes</th>
              <th style="padding:12px; text-align:center;">Status</th>
              <th style="padding:12px; text-align:center;">Report Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((m, idx) => {
              const dtStr = m.scheduledAt || m.createdAt;
              const dateFormatted = dtStr ? new Date(dtStr).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
              const timeFormatted = dtStr ? new Date(dtStr).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) : '';
              
              const attendees = Array.isArray(m.attendees) ? m.attendees : [];
              const attendeeCount = attendees.length > 0 ? distinctAttendeeCount(attendees) : (m.attendanceCount || (m.studentId && m.studentId !== 'ALL' ? 1 : 0));
              
              const notesSnippet = m.notes?.issuesDiscussed || m.notes?.problem || m.notes?.summary || m.aiNotes?.summary || m.description || 'No written minutes';
              const cleanNotes = String(notesSnippet).replace(/<[^>]*>/g, '').slice(0, 75) + (notesSnippet.length > 75 ? '...' : '');

              return `
                <tr>
                  <td style="padding:12px; color:var(--text-muted); font-size:0.8rem;">${idx + 1}</td>
                  <td style="padding:12px;">
                    <div style="font-weight:700; font-size:0.88rem; color:var(--text-primary); margin-bottom:2px;">
                      ${escapeHtml(m.type || m.topic || 'Mentorship Session')}
                    </div>
                    <div style="font-size:0.75rem; color:var(--text-secondary); display:flex; align-items:center; gap:6px;">
                      <i class="ph ph-calendar"></i> ${dateFormatted} ${timeFormatted ? '• ' + timeFormatted : ''}
                      ${m.hasAiNotes || m.aiNotes ? '<span class="badge badge-accent" style="font-size:0.65rem; padding:1px 6px;">🤖 AI Extracted</span>' : ''}
                    </div>
                  </td>
                  <td style="padding:12px;">
                    <div style="font-weight:600; font-size:0.84rem;">${escapeHtml(m.mentorName || 'Faculty Mentor')}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(dept || 'Department')}</div>
                  </td>
                  <td style="padding:12px;">
                    <div style="font-weight:600; font-size:0.84rem;">
                      ${m.studentId === 'ALL' ? '<span class="badge badge-info" style="font-size:0.72rem;">👥 All Mentees (Group)</span>' : escapeHtml(m.studentName || 'Student')}
                    </div>
                    ${m.studentEnrollment ? `<div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(m.studentEnrollment)}</div>` : ''}
                  </td>
                  <td style="padding:12px;">
                    <button class="badge ${attendeeCount > 0 ? 'badge-success' : 'badge-secondary'} btn-view-attendance" data-id="${m.id}" style="cursor:pointer; border:none; display:inline-flex; align-items:center; gap:4px; font-weight:700; padding:4px 8px;" title="Click to view attendee timestamps">
                      <i class="ph ph-users"></i> ${attendeeCount} Attended
                    </button>
                    ${attendees.length > 0 && [...attendees].sort((a, b) => new Date(a.joinedAt || 0) - new Date(b.joinedAt || 0))[0]?.joinedAt ? `
                      <div style="font-size:0.72rem; color:var(--text-muted); margin-top:3px;">
                        First joined: ${attendanceTime([...attendees].sort((a, b) => new Date(a.joinedAt || 0) - new Date(b.joinedAt || 0))[0].joinedAt)}
                      </div>
                    ` : ''}
                  </td>
                  <td style="padding:12px; font-size:0.8rem; color:var(--text-secondary); max-width:220px;">
                    ${escapeHtml(cleanNotes)}
                  </td>
                  <td style="padding:12px; text-align:center;">
                    <span class="badge ${m.status==='COMPLETED'?'badge-success':m.status==='APPROVED'?'badge-info':'badge-warning'}" style="font-size:0.72rem;">
                      ${escapeHtml(m.status || 'SCHEDULED')}
                    </span>
                  </td>
                  <td style="padding:12px; text-align:center;">
                    <div style="display:flex; gap:6px; justify-content:center; align-items:center; flex-wrap:nowrap;">
                      <button class="btn btn-xs btn-primary btn-view-report" data-id="${m.id}" title="View meeting report" style="display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; font-weight:600; border-radius:6px;">
                        <i class="ph ph-file-text"></i> View
                      </button>
                      <button class="btn btn-xs btn-secondary btn-download-meet-pdf" data-id="${m.id}" title="Download / Print PDF" style="display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; font-weight:600; border-radius:6px;">
                        <i class="ph ph-printer" style="color:var(--danger);"></i> PDF
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;

      // Attach row action listeners
      wrap.querySelectorAll('.btn-download-meet-pdf').forEach(btn => {
        btn.addEventListener('click', async () => {
          const mId = btn.dataset.id;
          const targetMeeting = meetings.find(x => x.id === mId);
          if (targetMeeting) {
            try {
              const [reportResult, notesResult] = await Promise.all([
                MeetingService.getReport(mId),
                MeetingService.getAINotes(mId)
              ]);
              exportMeetingSessionReport({
                ...targetMeeting,
                report: reportResult?.report || {},
                aiNotes: notesResult?.aiNotes || {}
              });
            } catch (error) {
              showToast(error.message || 'Could not load the private meeting report.', 'error');
            }
          } else {
            showToast('Meeting data not found', 'error');
          }
        });
      });

      wrap.querySelectorAll('.btn-view-report').forEach(btn => {
        btn.addEventListener('click', async () => {
          const mId = btn.dataset.id;
          const targetMeeting = meetings.find(x => x.id === mId);
          if (!targetMeeting) return showToast('Meeting data not found', 'error');
          let rpt = {};
          let ai = {};
          try {
            const [reportResult, notesResult] = await Promise.all([
              MeetingService.getReport(mId),
              MeetingService.getAINotes(mId)
            ]);
            rpt = reportResult?.report || {};
            ai = notesResult?.aiNotes || {};
          } catch (error) {
            showToast(error.message || 'Could not load the private meeting report.', 'error');
            return;
          }
          const topic = targetMeeting.type || rpt.topic || ai.topic || 'Mentorship Session';
          const issues = rpt.issuesDiscussed || ai.issuesDiscussed || targetMeeting.notes?.issuesDiscussed || targetMeeting.notes?.summary || 'No issues recorded';
          const action = rpt.actionItems || ai.actionItems || targetMeeting.notes?.actionTaken || targetMeeting.notes?.advice || 'No action specified';
          const attendees = Array.isArray(targetMeeting.attendees) ? targetMeeting.attendees : [];
          const timeline = [...attendees].sort((a, b) => new Date(a.joinedAt || 0) - new Date(b.joinedAt || 0));

          showModal({
            title: 'Meeting Report',
            size: 'lg',
            content: `
              <div style="display:flex; flex-direction:column; gap:16px;">
                <div style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:10px; padding:14px; display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
                  <div><strong style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Topic</strong><div style="font-weight:700; font-size:0.9rem;">${escapeHtml(topic)}</div></div>
                  <div><strong style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Faculty Mentor</strong><div style="font-weight:600;">${escapeHtml(targetMeeting.mentorName || 'Faculty')}</div></div>
                  <div><strong style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Department</strong><div>${escapeHtml(dept || 'Department')}</div></div>
                  <div><strong style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Head of Department</strong><div style="font-weight:600; color:var(--accent);">${escapeHtml(user.name || 'Head of Department')}</div></div>
                </div>

                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label" style="font-weight:700; font-size:0.85rem;">Issues Discussed &amp; Academic Observations</label>
                  <div style="padding:12px; background:var(--surface); border:1px solid var(--border); border-radius:8px; font-size:0.85rem; line-height:1.5;">
                    ${escapeHtml(issues)}
                  </div>
                </div>

                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label" style="font-weight:700; font-size:0.85rem;">Remedial Measures &amp; Action Taken</label>
                  <div style="padding:12px; background:var(--surface); border:1px solid var(--border); border-radius:8px; font-size:0.85rem; line-height:1.5;">
                    ${escapeHtml(action)}
                  </div>
                </div>

                <div class="form-group" style="margin-bottom:0;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <label class="form-label" style="font-weight:700; font-size:0.85rem; margin:0;">Attendance Timeline</label>
                    <span class="badge badge-success">${distinctAttendeeCount(attendees)} Participant${distinctAttendeeCount(attendees) === 1 ? '' : 's'} · ${attendees.length} interval${attendees.length === 1 ? '' : 's'}</span>
                  </div>
                  ${attendees.length === 0 ? `
                    <p style="color:var(--text-muted); font-size:0.82rem; margin:0;">No individual attendees logged.</p>
                  ` : `
                    <div style="max-height:180px; overflow-y:auto; border:1px solid var(--border); border-radius:8px;">
                      <table class="data-table" style="width:100%; margin:0;">
                        <thead><tr><th>#</th><th>Participant</th><th>Role</th><th>PRN / Enrollment</th><th>Joined</th><th>Left</th><th>Duration</th></tr></thead>
                        <tbody>
                          ${timeline.map((a, i) => `
                            <tr>
                              <td style="font-size:0.8rem; color:var(--text-muted);">${i + 1}</td>
                              <td style="font-weight:600;">${escapeHtml(a.name || 'Participant')}</td>
                              <td><span class="badge badge-secondary" style="font-size:0.7rem;">${escapeHtml(a.role || 'STUDENT')}</span></td>
                              <td>${escapeHtml(a.enrollmentNumber || a.prn || '—')}</td>
                              <td style="color:var(--accent); font-weight:600;">${attendanceTime(a.joinedAt)}</td>
                              <td>${attendanceTime(a.leftAt)}</td>
                              <td>${attendanceDuration(a.durationSeconds)}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </div>
                  `}
                </div>
              </div>
            `,
            confirmText: 'Download PDF',
            cancelText: 'Close',
            onConfirm: (close) => {
              exportMeetingSessionReport(targetMeeting);
              close();
            }
          });
        });
      });

      wrap.querySelectorAll('.btn-view-attendance').forEach(btn => {
        btn.addEventListener('click', () => {
          const mId = btn.dataset.id;
          const targetMeeting = meetings.find(x => x.id === mId);
          if (!targetMeeting) return showToast('Meeting data not found', 'error');
          const attendees = [...(Array.isArray(targetMeeting.attendees) ? targetMeeting.attendees : [])]
            .sort((a, b) => new Date(a.joinedAt || 0) - new Date(b.joinedAt || 0));

          showModal({
            title: 'Meeting Attendance Timeline',
            size: 'md',
            content: `
              <div style="display:flex; flex-direction:column; gap:12px;">
                <div style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:4px;">
                  Session: <strong>${escapeHtml(targetMeeting.type || 'Mentorship Session')}</strong>. Times use local time; a missing leave time means no departure event was recorded.
                </div>
                ${attendees.length === 0 ? `
                  <p style="padding:20px; text-align:center; color:var(--text-muted);">No attendee check-in records found.</p>
                ` : `
                  <div style="max-height:300px; overflow-y:auto; border:1px solid var(--border); border-radius:8px;">
                    <table class="data-table" style="width:100%; margin:0;">
                      <thead><tr><th>#</th><th>Participant</th><th>PRN / ID</th><th>Joined</th><th>Left</th><th>Duration</th></tr></thead>
                      <tbody>
                        ${attendees.map((a, i) => `
                          <tr>
                            <td>${i + 1}</td>
                            <td style="font-weight:600;">${escapeHtml(a.name || 'Participant')}</td>
                            <td>${escapeHtml(a.enrollmentNumber || a.prn || '—')}</td>
                            <td style="color:var(--success); font-weight:700;">${attendanceTime(a.joinedAt)}</td>
                            <td>${attendanceTime(a.leftAt)}</td>
                            <td>${attendanceDuration(a.durationSeconds)}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                `}
              </div>
            `,
            confirmText: 'Close',
            cancelText: 'Cancel'
          });
        });
      });
    }

    // Attach search and filter listeners
    container.querySelector('#filter-meeting-search')?.addEventListener('input', renderMeetingReports);
    container.querySelector('#filter-meeting-mentor')?.addEventListener('change', renderMeetingReports);
    container.querySelector('#filter-meeting-type')?.addEventListener('change', renderMeetingReports);
    container.querySelector('#filter-meeting-status')?.addEventListener('change', renderMeetingReports);

    renderMeetingReports();

    // Attach Event Listeners for Filters
    ['#filter-search-prn', '#filter-mentor', '#filter-class', '#filter-risk'].forEach(id => {
      const el = container.querySelector(id);
      if (el) {
        el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', renderMenteeDirectory);
      }
    });

    // Master Export Listeners
    container.querySelector('#btn-export-excel')?.addEventListener('click', async () => {
      await exportMentorStudentReport('excel');
    });

    container.querySelector('#btn-export-pdf')?.addEventListener('click', async () => {
      await exportMentorStudentReport('pdf');
    });

    // Single Mentor Report Listeners (dropdown)
    container.querySelector('#btn-single-mentor-excel')?.addEventListener('click', async () => {
      const mId = container.querySelector('#single-mentor-select')?.value;
      if (!mId) return showToast('Please select a Mentor Name from the dropdown first', 'warning');
      await exportSingleMentorReport(mId, 'excel');
    });

    container.querySelector('#btn-single-mentor-pdf')?.addEventListener('click', async () => {
      const mId = container.querySelector('#single-mentor-select')?.value;
      if (!mId) return showToast('Please select a Mentor Name from the dropdown first', 'warning');
      await exportSingleMentorReport(mId, 'pdf');
    });

    // Per-mentor row download buttons (in workload table)
    content.addEventListener('click', async (e) => {
      const excelBtn = e.target.closest('.btn-mentor-dl-excel');
      const pdfBtn   = e.target.closest('.btn-mentor-dl-pdf');
      if (excelBtn) {
        const mId = excelBtn.dataset.mentorId;
        if (mId) await exportSingleMentorReport(mId, 'excel');
      } else if (pdfBtn) {
        const mId = pdfBtn.dataset.mentorId;
        if (mId) await exportSingleMentorReport(mId, 'pdf');
      }
    });

  } catch (err) {
    console.error('HOD Reports load error:', err);
    const content = container.querySelector('#hod-reports-content');
    if (content) content.innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error loading reports</h3><p>${err.message}</p></div>`;
  }
}

