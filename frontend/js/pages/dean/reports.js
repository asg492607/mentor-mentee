import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { StatsService, StudentService, FacultyService } from '/js/services.js';
import { exportMentorStudentReport, exportSingleMentorReport } from '/js/report-export.js';
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
    // Fetch institution-level stats + full faculty+student lists for breakdowns
    const [statsData, allFaculty, allStudents] = await Promise.all([
      StatsService.getInstitutionStats(),
      FacultyService.getAll(),
      StudentService.getAll()
    ]);

    const { totalStudents = 0, totalFaculty = 0, totalDepartments = 0, highRiskStudents = 0, openIssues = 0, depts = [] } = statsData;

    // Only actual mentors (FACULTY / MENTOR role)
    const mentors = allFaculty.filter(f => {
      const r = (f.role || '').toUpperCase();
      return r === 'FACULTY' || r === 'MENTOR' || r === 'HOD';
    });

    // Department breakdown
    const deptRows = (depts || []).map(d => {
      const deptStudents = allStudents.filter(s => s.department === d.name);
      const deptMentors  = mentors.filter(f => f.department === d.name);
      const deptHighRisk = deptStudents.filter(s => s.riskLevel === 'HIGH').length;
      const unassigned   = deptStudents.filter(s => !s.mentorId).length;
      return {
        name: d.name,
        studentCount: deptStudents.length,
        mentorCount: deptMentors.length,
        highRiskCount: deptHighRisk,
        unassigned,
        ratio: deptMentors.length > 0 ? (deptStudents.length / deptMentors.length).toFixed(1) : '—'
      };
    }).sort((a, b) => b.studentCount - a.studentCount);

    // Sort mentors by student count desc
    const mentorRows = mentors.map(m => {
      const count = allStudents.filter(s => s.mentorId === m.id).length;
      const highRisk = allStudents.filter(s => s.mentorId === m.id && s.riskLevel === 'HIGH').length;
      return { ...m, studentCount: count, highRiskCount: highRisk };
    }).sort((a, b) => b.studentCount - a.studentCount);

    const content = container.querySelector('#dean-reports-content');
    if (!content) return;

    content.innerHTML = `
      <div class="dashboard-container">

        <!-- ── Header Toolbar ── -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
          <div>
            <h2 style="font-size:1.2rem;font-weight:800;margin:0;">🏛️ Institution-Wide Mentor Reports</h2>
            <p style="color:var(--text-muted);font-size:0.82rem;margin:3px 0 0;">Complete mentor allocation analytics, department breakdowns & individual report downloads</p>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn-sm btn-secondary" id="btn-export-excel" style="display:flex;align-items:center;gap:6px;font-weight:600;">
              <i class="ph ph-file-xls" style="font-size:1.1rem;color:var(--success);"></i> Master Excel Report
            </button>
            <button class="btn btn-sm btn-secondary" id="btn-export-pdf" style="display:flex;align-items:center;gap:6px;font-weight:600;">
              <i class="ph ph-file-pdf" style="font-size:1.1rem;color:var(--danger);"></i> Master PDF Report
            </button>
          </div>
        </div>

        <!-- ── Stat Cards ── -->
        <div class="stats-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:24px;">
          ${[
            ['Total Faculty Mentors', mentors.length,       'var(--accent)',  'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z'],
            ['Total Students',        totalStudents,         'var(--info)',    'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'],
            ['Departments',           totalDepartments,      'var(--success)', 'M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2z'],
            ['High Risk Students',    highRiskStudents,      'var(--danger)',  'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z'],
            ['Unassigned Students',   allStudents.filter(s => !s.mentorId).length, 'var(--warning)', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'],
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

        <!-- ── Department Summary ── -->
        <div class="card" style="margin-bottom:24px;">
          <div class="card-header" style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
            <div>
              <h3 style="font-size:0.95rem;font-weight:700;margin:0;">🏫 Department-wise Mentorship Summary</h3>
              <p style="font-size:0.78rem;color:var(--text-muted);margin:3px 0 0;">Student-to-mentor ratio and risk overview per department</p>
            </div>
            <span class="badge badge-info">${deptRows.length} Departments</span>
          </div>
          ${deptRows.length === 0
            ? '<p style="padding:24px;color:var(--text-muted);text-align:center;">No departments found.</p>'
            : `<div class="table-responsive">
                <table class="data-table" style="width:100%;">
                  <thead>
                    <tr>
                      <th style="padding:12px;">#</th>
                      <th style="padding:12px;">Department</th>
                      <th style="padding:12px;text-align:center;">Faculty Mentors</th>
                      <th style="padding:12px;text-align:center;">Total Students</th>
                      <th style="padding:12px;text-align:center;">Unassigned</th>
                      <th style="padding:12px;text-align:center;">Student:Mentor Ratio</th>
                      <th style="padding:12px;text-align:center;">High Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${deptRows.map((d, i) => `
                      <tr>
                        <td style="padding:12px;color:var(--text-muted);font-size:0.82rem;">${i + 1}</td>
                        <td style="padding:12px;font-weight:600;">${d.name}</td>
                        <td style="padding:12px;text-align:center;"><span class="badge badge-accent">${d.mentorCount}</span></td>
                        <td style="padding:12px;text-align:center;"><span class="badge badge-info">${d.studentCount}</span></td>
                        <td style="padding:12px;text-align:center;">
                          <span class="badge ${d.unassigned > 0 ? 'badge-warning' : 'badge-success'}">${d.unassigned}</span>
                        </td>
                        <td style="padding:12px;text-align:center;font-weight:600;">${d.ratio}</td>
                        <td style="padding:12px;text-align:center;">
                          <span class="badge ${d.highRiskCount > 0 ? 'badge-danger' : 'badge-success'}">${d.highRiskCount}</span>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>`
          }
        </div>

        <!-- ── Mentor Roster Table ── -->
        <div class="card">
          <div class="card-header" style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
            <div>
              <h3 style="font-size:0.95rem;font-weight:700;margin:0;">👨‍🏫 Complete Mentor Roster & Individual Reports</h3>
              <p style="font-size:0.78rem;color:var(--text-muted);margin:3px 0 0;">All ${mentors.length} faculty mentors — download individual or master reports</p>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <input type="text" id="dean-mentor-search" class="form-input" placeholder="🔍 Search mentor name / dept..." style="padding:7px 12px;font-size:0.83rem;min-width:220px;">
              <select id="dean-dept-filter" class="form-select" style="padding:7px 12px;font-size:0.83rem;">
                <option value="">All Departments</option>
                ${[...new Set(mentors.map(m => m.department).filter(Boolean))].sort().map(d => `<option value="${d}">${d}</option>`).join('')}
              </select>
            </div>
          </div>

          <div id="dean-mentor-table-wrap" class="table-responsive"></div>
        </div>

      </div>
    `;

    // Render mentor roster table with filter
    function renderMentorTable() {
      const wrap = content.querySelector('#dean-mentor-table-wrap');
      if (!wrap) return;
      const q = (content.querySelector('#dean-mentor-search')?.value || '').toLowerCase().trim();
      const dept = content.querySelector('#dean-dept-filter')?.value || '';

      let filtered = mentorRows;
      if (q) filtered = filtered.filter(m => (m.name || '').toLowerCase().includes(q) || (m.department || '').toLowerCase().includes(q));
      if (dept) filtered = filtered.filter(m => m.department === dept);

      if (filtered.length === 0) {
        wrap.innerHTML = `<p style="padding:24px;color:var(--text-muted);text-align:center;">No mentors match the selected filters.</p>`;
        return;
      }

      wrap.innerHTML = `
        <table class="data-table" style="width:100%;">
          <thead>
            <tr>
              <th style="padding:12px;">#</th>
              <th style="padding:12px;">Mentor Name</th>
              <th style="padding:12px;">Department</th>
              <th style="padding:12px;">Designation</th>
              <th style="padding:12px;text-align:center;">Assigned Students</th>
              <th style="padding:12px;text-align:center;">High Risk Students</th>
              <th style="padding:12px;text-align:center;">Download Report</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((m, i) => `
              <tr>
                <td style="padding:12px;color:var(--text-muted);font-size:0.82rem;">${i + 1}</td>
                <td style="padding:12px;font-weight:600;">${m.name || '—'}</td>
                <td style="padding:12px;font-size:0.85rem;color:var(--text-secondary);">${m.department || '—'}</td>
                <td style="padding:12px;font-size:0.85rem;">${m.designation || 'Faculty'}</td>
                <td style="padding:12px;text-align:center;"><span class="badge badge-accent">${m.studentCount}</span></td>
                <td style="padding:12px;text-align:center;">
                  <span class="badge ${m.highRiskCount > 0 ? 'badge-danger' : 'badge-success'}">${m.highRiskCount}</span>
                </td>
                <td style="padding:12px;text-align:center;">
                  <div style="display:flex;gap:6px;justify-content:center;">
                    <button class="btn btn-xs btn-secondary btn-dean-mentor-excel" data-mentor-id="${m.id}" title="Download Excel for ${m.name}" style="display:flex;align-items:center;gap:4px;font-size:0.75rem;">
                      <i class="ph ph-file-xls" style="color:var(--success);"></i> XLS
                    </button>
                    <button class="btn btn-xs btn-secondary btn-dean-mentor-pdf" data-mentor-id="${m.id}" title="Download PDF for ${m.name}" style="display:flex;align-items:center;gap:4px;font-size:0.75rem;">
                      <i class="ph ph-file-pdf" style="color:var(--danger);"></i> PDF
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="padding:10px 16px;border-top:1px solid var(--border);font-size:0.78rem;color:var(--text-muted);">
          Showing ${filtered.length} of ${mentors.length} mentors
        </div>
      `;
    }

    renderMentorTable();

    // Filter listeners
    content.querySelector('#dean-mentor-search')?.addEventListener('input', renderMentorTable);
    content.querySelector('#dean-dept-filter')?.addEventListener('change', renderMentorTable);

    // Per-mentor download via event delegation
    content.addEventListener('click', async e => {
      const excelBtn = e.target.closest('.btn-dean-mentor-excel');
      const pdfBtn   = e.target.closest('.btn-dean-mentor-pdf');
      if (excelBtn) {
        const mId = excelBtn.dataset.mentorId;
        if (mId) await exportSingleMentorReport(mId, 'excel');
      } else if (pdfBtn) {
        const mId = pdfBtn.dataset.mentorId;
        if (mId) await exportSingleMentorReport(mId, 'pdf');
      }
    });

    // Master export buttons
    content.querySelector('#btn-export-excel')?.addEventListener('click', async () => {
      await exportMentorStudentReport('excel');
    });

    content.querySelector('#btn-export-pdf')?.addEventListener('click', async () => {
      await exportMentorStudentReport('pdf');
    });

  } catch (err) {
    console.error('Dean Reports load error:', err);
    const content = container.querySelector('#dean-reports-content');
    if (content) content.innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error loading reports</h3><p>${err.message}</p></div>`;
  }
}
