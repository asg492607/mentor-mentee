import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { StatsService } from '/js/services.js';
import { exportSingleMentorReport, exportMeetingSessionReport } from '/js/report-export.js';

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
                            <button class="btn btn-sm btn-primary meeting-report-dl-btn" data-id="${m.id}" style="display:inline-flex;align-items:center;gap:6px;font-weight:600;padding:6px 14px;border-radius:8px;">
                              <i class="ph ph-file-pdf" style="font-size:1.1rem;"></i> Download Report
                            </button>
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
    `;

    // Chart
    if (window.Chart) {
      const canvas = container.querySelector('#chart-meetings-mentor');
      if (canvas) {
        if (activeMentorReportsChart) activeMentorReportsChart.destroy();
        const isLight = (document.documentElement.getAttribute('data-theme') || localStorage.getItem('theme')) === 'light';
        const tc = isLight ? '#475569' : '#777799';
        const gc = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';

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
      btn.addEventListener('click', () => {
        const m = meetings.find(x => x.id === btn.dataset.id);
        if (!m) {
          showToast('Meeting record not found', 'error');
          return;
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
