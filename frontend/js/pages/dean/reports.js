import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { StatsService } from '/js/services.js';
import { exportMentorStudentReport } from '/js/report-export.js';
import { showToast } from '/js/components/toast.js';

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/dean/reports')}
      <div class="main-content">
        ${createHeader('Institution Mentor Reports', user)}
        <div class="page-content" id="dean-reports-content">
          <div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  try {
    const data = await StatsService.getInstitutionStats();
    const { totalStudents = 0, totalFaculty = 0, totalDepartments = 0, highRiskStudents = 0, openIssues = 0, students = [], faculty = [], depts = [] } = data;

    const content = container.querySelector('#dean-reports-content');
    if (!content) return;

    // Build department breakdown
    const deptRows = (depts || []).map(d => {
      const deptStudents = students.filter(s => s.department === d.name);
      const deptMentors = faculty.filter(f => f.department === d.name);
      const deptHighRisk = deptStudents.filter(s => s.riskLevel === 'HIGH').length;
      return {
        name: d.name,
        studentCount: deptStudents.length,
        mentorCount: deptMentors.length,
        highRiskCount: deptHighRisk
      };
    });

    content.innerHTML = `
      <div class="dashboard-container">
        <!-- Export Bar -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:1.25rem; font-weight:800; margin:0;">Global Mentorship Reports</h2>
            <p style="color:var(--text-muted); font-size:0.85rem; margin:2px 0 0;">Institution-wide mentor allocation analytics and academic risk reporting</p>
          </div>
          <div style="display:flex; gap:10px;">
            <button class="btn btn-sm btn-secondary" id="btn-export-excel" style="display:flex; align-items:center; gap:6px; font-weight:600;">
              <i class="ph ph-file-xls" style="font-size:1.1rem; color:var(--success);"></i> Export Master Excel
            </button>
            <button class="btn btn-sm btn-secondary" id="btn-export-pdf" style="display:flex; align-items:center; gap:6px; font-weight:600;">
              <i class="ph ph-file-pdf" style="font-size:1.1rem; color:var(--danger);"></i> Export Master PDF
            </button>
          </div>
        </div>

        <!-- Metric Stat Cards -->
        <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:24px;">
          ${[
            ['Total Faculty Mentors', totalFaculty, 'var(--accent)', 'ph-users'],
            ['Total Mentees', totalStudents, 'var(--info)', 'ph-graduation-cap'],
            ['Departments', totalDepartments, 'var(--success)', 'ph-buildings'],
            ['High Risk Mentees', highRiskStudents, 'var(--danger)', 'ph-warning-circle']
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

        <!-- Department Breakdown Table -->
        <div class="card" style="margin-bottom:24px;">
          <div class="card-header" style="padding:16px 20px; border-bottom:1px solid var(--border);">
            <h3 style="font-size:0.95rem; font-weight:700; margin:0;">Department Mentorship & Risk Summary</h3>
          </div>
          ${deptRows.length === 0
            ? '<p style="padding:24px; color:var(--text-muted); text-align:center;">No departments found.</p>'
            : `<div class="table-responsive">
                <table class="data-table" style="width:100%;">
                  <thead>
                    <tr>
                      <th style="padding:12px;">Department</th>
                      <th style="padding:12px;">Faculty Mentors</th>
                      <th style="padding:12px;">Total Mentees</th>
                      <th style="padding:12px;">High Risk Students</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${deptRows.map(d => `
                      <tr>
                        <td style="padding:12px; font-weight:600;">${d.name}</td>
                        <td style="padding:12px;">${d.mentorCount}</td>
                        <td style="padding:12px;"><span class="badge badge-info">${d.studentCount}</span></td>
                        <td style="padding:12px;"><span class="badge ${d.highRiskCount > 0 ? 'badge-danger' : 'badge-success'}">${d.highRiskCount}</span></td>
                      </tr>
                    `).join('')}
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
    console.error('Dean Reports load error:', err);
    const content = container.querySelector('#dean-reports-content');
    if (content) content.innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error loading reports</h3><p>${err.message}</p></div>`;
  }
}
