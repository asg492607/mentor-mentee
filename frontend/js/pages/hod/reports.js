import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { StatsService, MeetingService } from '/js/services.js';
import { exportMentorStudentReport } from '/js/report-export.js';
import { showToast } from '/js/components/toast.js';

function riskBadge(r) {
  const cls = {HIGH:'badge-danger',MEDIUM:'badge-warning',LOW:'badge-success'}[r]||'badge-muted';
  return `<span class="badge ${cls}">${r||'N/A'}</span>`;
}

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
    const data = await StatsService.getDeptStats(dept);
    const { totalStudents, totalMentors, highRiskStudents, openIssues, resolvedIssues, students, mentors, issues } = data;

    const content = container.querySelector('#hod-reports-content');
    if (!content) return;

    content.innerHTML = `
      <div class="dashboard-container">
        <!-- Export Bar -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:1.25rem; font-weight:800; margin:0;">${dept || 'Department'} Mentor Activity & Reports</h2>
            <p style="color:var(--text-muted); font-size:0.85rem; margin:2px 0 0;">Comprehensive oversight of faculty mentor allocations and meeting statistics</p>
          </div>
          <div style="display:flex; gap:10px;">
            <button class="btn btn-sm btn-secondary" id="btn-export-excel" style="display:flex; align-items:center; gap:6px; font-weight:600;">
              <i class="ph ph-file-xls" style="font-size:1.1rem; color:var(--success);"></i> Export Excel Report
            </button>
            <button class="btn btn-sm btn-secondary" id="btn-export-pdf" style="display:flex; align-items:center; gap:6px; font-weight:600;">
              <i class="ph ph-file-pdf" style="font-size:1.1rem; color:var(--danger);"></i> Export PDF Report
            </button>
          </div>
        </div>

        <!-- Metric Stat Cards -->
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

        <!-- Mentors Overview Table -->
        <div class="card" style="margin-bottom:24px;">
          <div class="card-header" style="padding:16px 20px; border-bottom:1px solid var(--border);">
            <h3 style="font-size:0.95rem; font-weight:700; margin:0;">Faculty Mentor Performance & Allocation Summary</h3>
          </div>
          ${mentors.length === 0
            ? '<p style="padding:24px; color:var(--text-muted); text-align:center;">No mentors found in this department.</p>'
            : `<div class="table-responsive">
                <table class="data-table" style="width:100%;">
                  <thead>
                    <tr>
                      <th style="padding:12px;">Faculty Mentor</th>
                      <th style="padding:12px;">Designation</th>
                      <th style="padding:12px;">Assigned Students</th>
                      <th style="padding:12px;">High Risk Mentees</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${mentors.map(m => {
                      const mStudents = students.filter(s => s.mentorId === m.id);
                      const mRisk = mStudents.filter(s => s.riskLevel === 'HIGH').length;
                      return `
                        <tr>
                          <td style="padding:12px; font-weight:600;">${m.name}</td>
                          <td style="padding:12px; color:var(--text-secondary);">${m.designation || 'Faculty'}</td>
                          <td style="padding:12px;"><span class="badge badge-info">${mStudents.length} / ${m.maxStudents || 20}</span></td>
                          <td style="padding:12px;"><span class="badge ${mRisk > 0 ? 'badge-danger' : 'badge-success'}">${mRisk}</span></td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>`
          }
        </div>
      </div>
    `;

    document.getElementById('btn-export-excel')?.addEventListener('click', async () => {
      await exportMentorStudentReport('excel');
    });

    document.getElementById('btn-export-pdf')?.addEventListener('click', async () => {
      await exportMentorStudentReport('pdf');
    });

  } catch (err) {
    console.error('HOD Reports load error:', err);
    const content = container.querySelector('#hod-reports-content');
    if (content) content.innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error loading reports</h3><p>${err.message}</p></div>`;
  }
}
