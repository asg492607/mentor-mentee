import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { StudentService, FacultyService, DepartmentService, BookletService, NotificationService } from '/js/services.js';
import { escapeHtml, exportToCSV } from '/js/utils.js';

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user?.role || 'ADMIN', '/admin/compliance')}
      <div id="sidebar-backdrop" class="sidebar-backdrop"></div>
      <div class="main-content">
        ${createHeader('Booklet Compliance & Audit Center', user)}
        <div class="page-content" id="compliance-content">
          <div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  try {
    const [allStudents, allFaculty, depts, bookletsMap] = await Promise.all([
      StudentService.getAll().catch(err => { console.warn('StudentService error:', err); return []; }),
      FacultyService.getAll().catch(err => { console.warn('FacultyService error:', err); return []; }),
      DepartmentService.getAll().catch(err => { console.warn('DepartmentService error:', err); return []; }),
      BookletService.getAllBooklets().catch(err => { console.warn('BookletService error:', err); return {}; })
    ]);

    const content = container.querySelector('#compliance-content');
    if (!content) return;

    // Faculty lookup map
    const mentorMap = new Map();
    allFaculty.forEach(f => {
      if (f.id) mentorMap.set(f.id, f);
      if (f.uid) mentorMap.set(f.uid, f);
    });

    // Deduplicate students by email/enrollment/id
    const uniqueStudentMap = new Map();
    allStudents.forEach(s => {
      const key = (s.email || s.enrollmentNumber || s.id || '').toLowerCase().trim();
      if (key && !uniqueStudentMap.has(key)) {
        uniqueStudentMap.set(key, s);
      }
    });
    const students = Array.from(uniqueStudentMap.values());

    // Enrich students with booklet data & completion stats
    const enrichedStudents = students.map(s => {
      const bookletData = bookletsMap[s.id] || bookletsMap[s.uid] || null;
      const completionPct = bookletData ? BookletService.calculateCompletion(bookletData) : 0;
      const mentor = s.mentorId ? mentorMap.get(s.mentorId) : null;

      // Section scores for quick audit
      let personalFilled = 0;
      if (bookletData?.personal) {
        personalFilled = Object.values(bookletData.personal).filter(v => v !== undefined && v !== null && String(v).trim() !== '').length;
      }
      let healthFilled = 0;
      if (bookletData?.health) {
        healthFilled = Object.values(bookletData.health).filter(v => v !== undefined && v !== null && String(v).trim() !== '').length;
      }
      let perfFilled = 0;
      if (bookletData?.performance) {
        perfFilled = Object.values(bookletData.performance).filter(v => v !== undefined && v !== null && String(v).trim() !== '').length;
      }

      return {
        ...s,
        bookletData,
        completionPct,
        mentorName: mentor ? mentor.name : (s.mentorName || 'Unassigned'),
        mentorDept: mentor ? mentor.department : '',
        personalFilled,
        healthFilled,
        perfFilled,
        isCompliant: completionPct >= 60,
        isInProgress: completionPct >= 25 && completionPct < 60,
        isDefaulter: completionPct < 25
      };
    });

    // Extract unique classes for filter
    const classesList = [...new Set(enrichedStudents.map(s => s.class).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    // Initial KPI calculation
    const totalStudents = enrichedStudents.length;
    const compliantCount = enrichedStudents.filter(s => s.isCompliant).length;
    const inProgressCount = enrichedStudents.filter(s => s.isInProgress).length;
    const defaulterCount = enrichedStudents.filter(s => s.isDefaulter).length;
    const complianceRate = totalStudents > 0 ? Math.round((compliantCount / totalStudents) * 100) : 0;

    content.innerHTML = `
      <div class="dashboard-container">
        <!-- TOP HEADER & AUDIT ACTIONS -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:16px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <span class="badge badge-primary" style="font-size:0.75rem; padding:3px 10px; font-weight:700;">INSTITUTIONAL AUDIT</span>
              <span style="font-size:0.8rem; color:var(--text-muted);">Mandatory Threshold: <strong>60% Complete</strong></span>
            </div>
            <h2 style="font-size:1.4rem; font-weight:800; margin:0;">Booklet Compliance & Audit Center</h2>
            <p style="color:var(--text-muted); font-size:0.875rem; margin:2px 0 0;">
              Real-time university audit of student mentorship booklet completion, section analytics, and automated compliance nudges.
            </p>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn btn-sm btn-secondary" id="btn-export-compliance-csv" style="display:flex; align-items:center; gap:6px; font-weight:600;">
              <i class="ph ph-file-csv" style="font-size:1.1rem; color:var(--success);"></i> Export Audit (CSV)
            </button>
            <button class="btn btn-sm btn-secondary" onclick="window.print()" style="display:flex; align-items:center; gap:6px; font-weight:600;">
              <i class="ph ph-printer" style="font-size:1.1rem; color:var(--text-primary);"></i> Print Report
            </button>
            <button class="btn btn-sm btn-primary" id="btn-broadcast-nudge" style="display:flex; align-items:center; gap:6px; font-weight:600; background:linear-gradient(135deg, #ef4444, #f59e0b); border:none; color:#fff;">
              <i class="ph ph-bell-ringing" style="font-size:1.1rem;"></i> Nudge All Defaulters (${defaulterCount + inProgressCount})
            </button>
          </div>
        </div>

        <!-- KPI SUMMARY CARDS -->
        <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:24px;">
          <div class="card stat-card" style="padding:18px; border-left:4px solid var(--primary);">
            <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Overall Compliance Rate</div>
            <div style="font-size:1.8rem; font-weight:800; color:var(--primary); margin:6px 0;">${complianceRate}%</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${compliantCount} of ${totalStudents} students ≥ 60%</div>
          </div>

          <div class="card stat-card" style="padding:18px; border-left:4px solid var(--info);">
            <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Total Students</div>
            <div style="font-size:1.8rem; font-weight:800; color:var(--info); margin:6px 0;">${totalStudents}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Active across all departments</div>
          </div>

          <div class="card stat-card" style="padding:18px; border-left:4px solid var(--success);">
            <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Fully Compliant (≥ 60%)</div>
            <div style="font-size:1.8rem; font-weight:800; color:var(--success); margin:6px 0;">${compliantCount}</div>
            <div style="font-size:0.75rem; color:var(--success); font-weight:600;">Full portal access unlocked</div>
          </div>

          <div class="card stat-card" style="padding:18px; border-left:4px solid var(--warning);">
            <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">In Progress (25% - 59%)</div>
            <div style="font-size:1.8rem; font-weight:800; color:var(--warning); margin:6px 0;">${inProgressCount}</div>
            <div style="font-size:0.75rem; color:var(--warning); font-weight:600;">Pending final submissions</div>
          </div>

          <div class="card stat-card" style="padding:18px; border-left:4px solid var(--danger);">
            <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Critical Defaulters (< 25%)</div>
            <div style="font-size:1.8rem; font-weight:800; color:var(--danger); margin:6px 0;">${defaulterCount}</div>
            <div style="font-size:0.75rem; color:var(--danger); font-weight:600;">Immediate intervention required</div>
          </div>
        </div>

        <!-- SEARCH AND FILTER CONTROLS -->
        <div class="card" style="padding:16px 20px; margin-bottom:20px;">
          <div style="display:grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; gap:12px; align-items:end;">
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="font-size:0.78rem; font-weight:600;">Search Students</label>
              <div style="position:relative;">
                <i class="ph ph-magnifying-glass" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--text-muted);"></i>
                <input type="text" id="compliance-search" class="form-input" placeholder="Search by name, PRN, mentor, email..." style="padding-left:32px;">
              </div>
            </div>

            <div class="form-group" style="margin:0;">
              <label class="form-label" style="font-size:0.78rem; font-weight:600;">Department</label>
              <select id="compliance-dept-filter" class="form-select">
                <option value="">All Departments</option>
                ${depts.map(d => `<option value="${escapeHtml(d.name)}">${escapeHtml(d.name)}</option>`).join('')}
              </select>
            </div>

            <div class="form-group" style="margin:0;">
              <label class="form-label" style="font-size:0.78rem; font-weight:600;">Class / Year</label>
              <select id="compliance-class-filter" class="form-select">
                <option value="">All Classes</option>
                ${classesList.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
              </select>
            </div>

            <div class="form-group" style="margin:0;">
              <label class="form-label" style="font-size:0.78rem; font-weight:600;">Compliance Status</label>
              <select id="compliance-status-filter" class="form-select">
                <option value="ALL">All Records (${totalStudents})</option>
                <option value="COMPLIANT">Compliant (≥ 60%)</option>
                <option value="IN_PROGRESS">In Progress (25% - 59%)</option>
                <option value="DEFAULTER">Defaulters (< 25%)</option>
                <option value="UNASSIGNED">Unassigned Mentor</option>
              </select>
            </div>

            <div class="form-group" style="margin:0;">
              <label class="form-label" style="font-size:0.78rem; font-weight:600;">Sort By</label>
              <select id="compliance-sort-by" class="form-select">
                <option value="COMPLETION_ASC">Lowest % First (Defaulters)</option>
                <option value="COMPLETION_DESC">Highest % First</option>
                <option value="NAME_ASC">Student Name (A-Z)</option>
                <option value="CLASS_ASC">Class / Division</option>
              </select>
            </div>
          </div>
        </div>

        <!-- STUDENTS AUDIT TABLE -->
        <div class="card" style="padding:0; overflow:hidden;">
          <div style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
            <h3 style="font-size:0.95rem; font-weight:700; margin:0;" id="table-record-count">
              Showing ${totalStudents} Student Records
            </h3>
            <div style="font-size:0.8rem; color:var(--text-muted);">
              Click <strong>Audit Booklet</strong> to inspect full submissions
            </div>
          </div>

          <div style="overflow-x:auto;">
            <table class="data-table" style="width:100%; border-collapse:collapse;" id="compliance-table">
              <thead>
                <tr style="background:var(--bg-secondary); border-bottom:1px solid var(--border); text-align:left;">
                  <th style="padding:12px 16px; font-size:0.75rem; text-transform:uppercase; color:var(--text-muted);">#</th>
                  <th style="padding:12px 16px; font-size:0.75rem; text-transform:uppercase; color:var(--text-muted);">Student & PRN</th>
                  <th style="padding:12px 16px; font-size:0.75rem; text-transform:uppercase; color:var(--text-muted);">Dept & Class</th>
                  <th style="padding:12px 16px; font-size:0.75rem; text-transform:uppercase; color:var(--text-muted);">Assigned Mentor</th>
                  <th style="padding:12px 16px; font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); min-width:180px;">Booklet Progress</th>
                  <th style="padding:12px 16px; font-size:0.75rem; text-transform:uppercase; color:var(--text-muted);">Status</th>
                  <th style="padding:12px 16px; font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody id="compliance-tbody">
                <!-- Injected via renderTable -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Filter & Render logic
    function filterAndRender() {
      const searchTerm = (document.getElementById('compliance-search')?.value || '').toLowerCase().trim();
      const deptFilter = document.getElementById('compliance-dept-filter')?.value || '';
      const classFilter = document.getElementById('compliance-class-filter')?.value || '';
      const statusFilter = document.getElementById('compliance-status-filter')?.value || 'ALL';
      const sortBy = document.getElementById('compliance-sort-by')?.value || 'COMPLETION_ASC';

      let filtered = enrichedStudents.filter(s => {
        if (deptFilter && s.department !== deptFilter) return false;
        if (classFilter && s.class !== classFilter) return false;

        if (statusFilter === 'COMPLIANT' && !s.isCompliant) return false;
        if (statusFilter === 'IN_PROGRESS' && !s.isInProgress) return false;
        if (statusFilter === 'DEFAULTER' && !s.isDefaulter) return false;
        if (statusFilter === 'UNASSIGNED' && s.mentorId) return false;

        if (searchTerm) {
          const matchName = (s.name || '').toLowerCase().includes(searchTerm);
          const matchEmail = (s.email || '').toLowerCase().includes(searchTerm);
          const matchPRN = (s.enrollmentNumber || s.prn || '').toLowerCase().includes(searchTerm);
          const matchMentor = (s.mentorName || '').toLowerCase().includes(searchTerm);
          const matchClass = (s.class || '').toLowerCase().includes(searchTerm);
          if (!matchName && !matchEmail && !matchPRN && !matchMentor && !matchClass) {
            return false;
          }
        }
        return true;
      });

      // Sort
      filtered.sort((a, b) => {
        if (sortBy === 'COMPLETION_ASC') return a.completionPct - b.completionPct;
        if (sortBy === 'COMPLETION_DESC') return b.completionPct - a.completionPct;
        if (sortBy === 'NAME_ASC') return (a.name || '').localeCompare(b.name || '');
        if (sortBy === 'CLASS_ASC') return (a.class || '').localeCompare(b.class || '');
        return 0;
      });

      // Update count
      const countEl = document.getElementById('table-record-count');
      if (countEl) countEl.innerText = `Showing ${filtered.length} of ${totalStudents} Students`;

      const tbody = document.getElementById('compliance-tbody');
      if (!tbody) return;

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align:center; padding:40px; color:var(--text-muted);">
              <i class="ph ph-magnifying-glass" style="font-size:2rem; margin-bottom:8px; display:block;"></i>
              No students matched the selected filters.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = filtered.map((s, idx) => {
        let statusBadge = '';
        let progressColor = '';
        if (s.isCompliant) {
          statusBadge = '<span class="badge badge-success" style="font-size:0.75rem; font-weight:700;">✅ Compliant</span>';
          progressColor = 'linear-gradient(90deg, #10b981, #059669)';
        } else if (s.isInProgress) {
          statusBadge = '<span class="badge badge-warning" style="font-size:0.75rem; font-weight:700;">⚠️ In Progress</span>';
          progressColor = 'linear-gradient(90deg, #f59e0b, #d97706)';
        } else {
          statusBadge = '<span class="badge badge-danger" style="font-size:0.75rem; font-weight:700;">🚨 Defaulter (<25%)</span>';
          progressColor = 'linear-gradient(90deg, #ef4444, #dc2626)';
        }

        const isUnassigned = !s.mentorId || s.mentorName === 'Unassigned';

        return `
          <tr style="border-bottom:1px solid var(--border); transition:background 0.2s ease;">
            <td style="padding:12px 16px; font-size:0.85rem; color:var(--text-muted);">${idx + 1}</td>
            <td style="padding:12px 16px;">
              <div style="font-weight:700; font-size:0.9rem; color:var(--text-primary);">${escapeHtml(s.name || 'Unnamed')}</div>
              <div style="font-size:0.78rem; color:var(--text-muted); display:flex; gap:8px;">
                <span>PRN: <strong>${escapeHtml(s.enrollmentNumber || s.prn || 'N/A')}</strong></span>
                <span>•</span>
                <span>${escapeHtml(s.email || '')}</span>
              </div>
            </td>
            <td style="padding:12px 16px;">
              <div style="font-size:0.85rem; font-weight:600;">${escapeHtml(s.department || 'General')}</div>
              <div style="font-size:0.78rem; color:var(--text-muted);">${escapeHtml(s.class || 'Unassigned Class')}</div>
            </td>
            <td style="padding:12px 16px;">
              ${isUnassigned
                ? `<span class="badge badge-danger" style="font-size:0.75rem;">No Mentor</span>`
                : `<div style="font-size:0.85rem; font-weight:600;">${escapeHtml(s.mentorName)}</div>
                   <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(s.mentorDept || '')}</div>`
              }
            </td>
            <td style="padding:12px 16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:0.82rem; font-weight:700;">
                <span>${s.completionPct}%</span>
                <span style="font-size:0.72rem; color:var(--text-muted); font-weight:500;">
                  P:${s.personalFilled} · H:${s.healthFilled} · A:${s.perfFilled}
                </span>
              </div>
              <div style="height:7px; background:var(--bg-primary); border-radius:4px; overflow:hidden; border:1px solid var(--border);">
                <div style="height:100%; width:${s.completionPct}%; background:${progressColor}; border-radius:4px; transition:width 0.3s ease;"></div>
              </div>
            </td>
            <td style="padding:12px 16px;">
              ${statusBadge}
            </td>
            <td style="padding:12px 16px; text-align:right;">
              <div style="display:flex; justify-content:flex-end; gap:6px;">
                <a href="#/mentor/booklet?studentId=${s.id}" class="btn btn-sm btn-secondary" title="Audit Booklet Details" style="padding:5px 10px; font-size:0.78rem; font-weight:600; display:inline-flex; align-items:center; gap:4px;">
                  <i class="ph ph-file-text"></i> Audit
                </a>
                ${!s.isCompliant ? `
                  <button class="btn btn-sm btn-ghost btn-nudge-single" data-student-id="${s.id}" data-student-name="${escapeHtml(s.name)}" title="Send Completion Nudge" style="padding:5px 8px; color:var(--warning);">
                    <i class="ph ph-bell"></i>
                  </button>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Attach filter listeners
    ['compliance-search', 'compliance-dept-filter', 'compliance-class-filter', 'compliance-status-filter', 'compliance-sort-by'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', filterAndRender);
        el.addEventListener('change', filterAndRender);
      }
    });

    // Initial render of table
    filterAndRender();

    // Export CSV Listener
    const exportBtn = document.getElementById('btn-export-compliance-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        showToast('Exporting compliance audit CSV...', 'info');
        const rows = [
          ['Sr No', 'Student Name', 'PRN / Enrollment', 'Email', 'Department', 'Class', 'Mentor Name', 'Booklet Completion %', 'Compliance Status']
        ];
        enrichedStudents.forEach((s, idx) => {
          rows.push([
            idx + 1,
            s.name || '',
            s.enrollmentNumber || s.prn || '',
            s.email || '',
            s.department || '',
            s.class || '',
            s.mentorName || 'Unassigned',
            `${s.completionPct}%`,
            s.isCompliant ? 'Compliant' : (s.isInProgress ? 'In Progress' : 'Defaulter')
          ]);
        });
        exportToCSV(`MIT_ADT_Booklet_Compliance_${new Date().toISOString().split('T')[0]}.csv`, rows);
        showToast('Compliance audit exported successfully!', 'success');
      });
    }

    // Single Nudge Listener
    content.addEventListener('click', async (e) => {
      const nudgeBtn = e.target.closest('.btn-nudge-single');
      if (nudgeBtn) {
        const studentId = nudgeBtn.dataset.studentId;
        const studentName = nudgeBtn.dataset.studentName;
        nudgeBtn.disabled = true;
        try {
          await NotificationService.create({
            userId: studentId,
            type: 'ALERT',
            title: '⚠️ Action Required: Complete Mentorship Booklet',
            message: `Your mentorship booklet is currently below institutional compliance (minimum 60% required). Please update your personal, health, and academic details promptly.`
          });
          showToast(`Compliance reminder dispatched to ${studentName}`, 'success');
          nudgeBtn.innerHTML = '<i class="ph ph-check" style="color:var(--success);"></i>';
        } catch (err) {
          console.error('Nudge failed:', err);
          showToast('Failed to dispatch reminder', 'error');
          nudgeBtn.disabled = false;
        }
      }
    });

    // Broadcast Nudge Listener
    const broadcastBtn = document.getElementById('btn-broadcast-nudge');
    if (broadcastBtn) {
      broadcastBtn.addEventListener('click', async () => {
        const nonCompliant = enrichedStudents.filter(s => !s.isCompliant);
        if (nonCompliant.length === 0) {
          showToast('All students are fully compliant! No reminders needed.', 'success');
          return;
        }

        const confirmed = window.confirm(`Send an automated compliance reminder notification to all ${nonCompliant.length} students currently below 60% completion?`);
        if (!confirmed) return;

        broadcastBtn.disabled = true;
        broadcastBtn.innerHTML = `<div class="spinner" style="width:14px;height:14px;border-width:2px;"></div> Sending ${nonCompliant.length} Nudges...`;

        let sentCount = 0;
        for (const s of nonCompliant) {
          try {
            await NotificationService.create({
              userId: s.id,
              type: 'ALERT',
              title: '⚠️ Institutional Reminder: Mentorship Booklet Completion',
              message: `Your Mentorship Booklet is at ${s.completionPct}%, which is below the mandatory 60% threshold. Please log in to complete all required sections.`
            });
            sentCount++;
          } catch (err) {
            console.warn(`Could not nudge ${s.id}:`, err);
          }
        }

        showToast(`Dispatched compliance reminders to ${sentCount} students!`, 'success');
        broadcastBtn.disabled = false;
        broadcastBtn.innerHTML = `<i class="ph ph-check-circle" style="font-size:1.1rem;"></i> Sent ${sentCount} Nudges`;
      });
    }

  } catch (err) {
    console.error('Failed to load Booklet Compliance Center:', err);
    const content = container.querySelector('#compliance-content');
    if (content) {
      content.innerHTML = `
        <div class="card" style="padding:40px; text-align:center;">
          <h3 style="color:var(--danger); margin-bottom:8px;">Error Loading Compliance Center</h3>
          <p style="color:var(--text-muted);">${escapeHtml(err.message || 'Check database connectivity.')}</p>
          <button class="btn btn-primary mt-3" onclick="window.location.reload()">Retry</button>
        </div>
      `;
    }
  }
}
