import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { StatsService } from '/js/services.js';
import { exportMentorStudentReport, exportSingleMentorReport } from '/js/report-export.js';
import { showToast } from '/js/components/toast.js';
import { escapeHtml } from '/js/utils.js';

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

        <!-- 🔍 SEARCH & ADVANCED MULTI-FILTER MENTEE LIST -->
        <div class="card" style="margin-bottom:24px;">
          <div class="card-header" style="padding:16px 20px; border-bottom:1px solid var(--border);">
            <h3 style="font-size:0.95rem; font-weight:700; margin:0; margin-bottom:12px;">🔍 Department Mentee Directory & Multi-Filter</h3>
            
            <!-- Filters Control Bar -->
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px;">
              <input type="text" id="filter-search-prn" class="form-input" placeholder="🔍 Search Name / PRN / Enrollment..." style="padding:8px 12px; font-size:0.85rem;">
              
              <select id="filter-mentor" class="form-select" style="padding:8px 12px; font-size:0.85rem;">
                <option value="">All Mentors</option>
                ${mentors.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')}
                <option value="UNASSIGNED">Unassigned Mentees</option>
              </select>

              <select id="filter-class" class="form-select" style="padding:8px 12px; font-size:0.85rem;">
                <option value="">All Classes</option>
                ${classesList.map(c => `<option value="${c}">Class ${escapeHtml(c)}</option>`).join('')}
              </select>

              <select id="filter-risk" class="form-select" style="padding:8px 12px; font-size:0.85rem;">
                <option value="">All Risk Levels</option>
                <option value="HIGH">High Risk</option>
                <option value="MEDIUM">Medium Risk</option>
                <option value="LOW">Low Risk</option>
              </select>
            </div>
          </div>

          <div id="mentee-directory-table-wrap" style="overflow-x:auto;"></div>
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
    function renderMenteeDirectory() {
      const wrap = container.querySelector('#mentee-directory-table-wrap');
      if (!wrap) return;

      const prnQuery = (container.querySelector('#filter-search-prn')?.value || '').toLowerCase().trim();
      const selectedMentor = container.querySelector('#filter-mentor')?.value || '';
      const selectedClass = container.querySelector('#filter-class')?.value || '';
      const selectedRisk = container.querySelector('#filter-risk')?.value || '';

      let filtered = [...students];

      if (prnQuery) {
        filtered = filtered.filter(s =>
          (s.name || '').toLowerCase().includes(prnQuery) ||
          (s.enrollmentNumber || s.rollNumber || s.prn || '').toLowerCase().includes(prnQuery)
        );
      }

      if (selectedMentor === 'UNASSIGNED') {
        filtered = filtered.filter(s => !s.mentorId);
      } else if (selectedMentor) {
        filtered = filtered.filter(s => s.mentorId === selectedMentor);
      }

      if (selectedClass) {
        filtered = filtered.filter(s => s.class === selectedClass);
      }

      if (selectedRisk) {
        filtered = filtered.filter(s => (s.riskLevel || 'LOW') === selectedRisk);
      }

      if (filtered.length === 0) {
        wrap.innerHTML = `<p style="padding:24px; color:var(--text-muted); text-align:center;">No matching mentees found for selected filters.</p>`;
        return;
      }

      wrap.innerHTML = `
        <table class="data-table" style="width:100%;">
          <thead>
            <tr>
              <th>Student Name</th>
              <th>PRN / Enrollment</th>
              <th>Class</th>
              <th>Assigned Mentor</th>
              <th>CGPA</th>
              <th>Attendance</th>
              <th>Risk Level</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(s => {
              const m = mentors.find(x => x.id === s.mentorId);
              const rBadge = s.riskLevel === 'HIGH' ? 'badge-danger' : s.riskLevel === 'MEDIUM' ? 'badge-warning' : 'badge-success';
              return `
                <tr>
                  <td style="font-weight:600;">${escapeHtml(s.name)}</td>
                  <td>${escapeHtml(s.enrollmentNumber || s.rollNumber || '—')}</td>
                  <td><span class="badge badge-muted">${s.class ? `Class ${escapeHtml(s.class)}` : 'Unassigned'}</span></td>
                  <td style="color:var(--accent); font-weight:600;">${m ? escapeHtml(m.name) : '<span style="color:var(--warning);">Unassigned</span>'}</td>
                  <td>${s.cgpa || '0'}</td>
                  <td>${s.attendance || 0}%</td>
                  <td><span class="badge ${rBadge}">${escapeHtml(s.riskLevel || 'LOW')}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        <div style="padding:10px 16px; border-top:1px solid var(--border); font-size:0.8rem; color:var(--text-muted);">
          Showing ${filtered.length} of ${students.length} mentees in ${escapeHtml(dept || 'Department')}
        </div>
      `;
    }

    // Render Allocation Audit Trail
    function renderAuditTrail() {
      const wrap = container.querySelector('#audit-trail-table-wrap');
      if (!wrap) return;

      const auditEntries = [];

      students.forEach(s => {
        if (s.reassignmentHistory && Array.isArray(s.reassignmentHistory)) {
          s.reassignmentHistory.forEach(h => {
            auditEntries.push({
              studentName: s.name,
              enrollmentNumber: s.enrollmentNumber || '—',
              className: s.class || '—',
              type: 'REASSIGNMENT',
              prevMentor: h.previousMentorName || 'Unassigned',
              newMentor: h.newMentorName || 'Unassigned',
              allocatedBy: h.reassignedBy || 'HOD',
              timestamp: h.reassignedAt || s.updatedAt || s.createdAt || '—',
              reason: h.reason || 'Academic Reassignment'
            });
          });
        } else if (s.mentorId) {
          const m = mentors.find(x => x.id === s.mentorId);
          auditEntries.push({
            studentName: s.name,
            enrollmentNumber: s.enrollmentNumber || '—',
            className: s.class || '—',
            type: s.allocationType || 'INITIAL_ALLOCATION',
            prevMentor: 'Unassigned',
            newMentor: m ? m.name : 'Assigned',
            allocatedBy: s.allocatedBy || 'Admin / System',
            timestamp: s.allocatedAt || s.createdAt || '—',
            reason: s.allocationType === 'AUTO' ? 'Auto-Allocation Algorithm' : 'Manual Allocation'
          });
        }
      });

      auditEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      if (auditEntries.length === 0) {
        wrap.innerHTML = `<p style="padding:24px; color:var(--text-muted); text-align:center;">No allocation or reassignment history logged yet.</p>`;
        return;
      }

      wrap.innerHTML = `
        <table class="data-table" style="width:100%; font-size:0.825rem;">
          <thead>
            <tr>
              <th>Student</th>
              <th>Class</th>
              <th>Type</th>
              <th>Previous Mentor</th>
              <th>New Mentor</th>
              <th>Allocated / Reassigned By</th>
              <th>When</th>
              <th>Reason / Notes</th>
            </tr>
          </thead>
          <tbody>
            ${auditEntries.slice(0, 30).map(a => `
              <tr>
                <td style="font-weight:600;">${escapeHtml(a.studentName)}<br><span style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(a.enrollmentNumber)}</span></td>
                <td><span class="badge badge-muted">${escapeHtml(a.className)}</span></td>
                <td><span class="badge ${a.type === 'REASSIGNMENT' ? 'badge-warning' : 'badge-info'}">${escapeHtml(a.type)}</span></td>
                <td style="color:var(--text-secondary);">${escapeHtml(a.prevMentor)}</td>
                <td style="color:var(--accent); font-weight:600;">${escapeHtml(a.newMentor)}</td>
                <td><strong>${escapeHtml(a.allocatedBy)}</strong></td>
                <td style="font-size:0.75rem; color:var(--text-muted);">${a.timestamp !== '—' ? new Date(a.timestamp).toLocaleString() : '—'}</td>
                <td style="color:var(--text-secondary);">${escapeHtml(a.reason)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    renderMenteeDirectory();
    renderAuditTrail();

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
