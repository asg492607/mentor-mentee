import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { StatsService, FacultyService } from '/js/services.js';
import { showToast } from '/js/components/toast.js';
import { exportMentorStudentReport, exportSingleMentorReport } from '/js/report-export.js';

function riskBadge(r) {
  const cls = {HIGH:'badge-danger',MEDIUM:'badge-warning',LOW:'badge-success'}[r]||'badge-muted';
  return `<span class="badge ${cls}">${r||'N/A'}</span>`;
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/dean/dashboard')}
      <div class="main-content">
        ${createHeader('Dean Dashboard', user)}
        <div class="page-content" id="dean-content">
          <div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  try {
    const data = await StatsService.getInstitutionStats();
    const { totalStudents = 0, totalFaculty = 0, totalDepartments = 0, highRiskStudents = 0, openIssues = 0, totalIssues = 0, students = [], faculty = [], issues = [], depts = [] } = data;

    // Per-department breakdown
    const deptMap = {};
    (depts || []).forEach(d => { deptMap[d.name] = { name:d.name, students:0, mentors:0, highRisk:0, openIssues:0, cgpaSum:0 }; });
    (students || []).forEach(s => {
      const d = deptMap[s.department];
      if (d) { d.students++; d.cgpaSum += parseFloat(s.cgpa)||0; if (s.riskLevel==='HIGH') d.highRisk++; }
    });
    (faculty || []).forEach(f => {
      const d = deptMap[f.department];
      if (d) d.mentors++;
    });
    (issues || []).forEach(i => {
      if (i.status === 'OPEN' && deptMap[i.department]) deptMap[i.department].openIssues++;
    });
    const deptRows = Object.values(deptMap).map(d => ({
      ...d, avgCGPA: d.students > 0 ? (d.cgpaSum / d.students).toFixed(2) : '—'
    }));

    // Meetings per month
    const now = new Date();
    const months = Array.from({length:6}, (_,i) => {
      const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1);
      return d.toLocaleString('en-IN',{month:'short'});
    });
    const meetPerMonth = Array(6).fill(0); // populated if meeting data available

    const dash = container.querySelector('#dean-content');
    if (!dash) return;
    dash.innerHTML = `
      <div class="dashboard-container">
        <!-- Quick Actions Bar -->
        <div style="display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap;">
          <a href="#/dean/reports" class="btn btn-sm btn-primary" style="display:flex; align-items:center; gap:6px; border-radius:20px; font-weight:600;">
            <i class="ph ph-chart-bar" style="font-size:1.1rem;"></i> Mentor Reports
          </a>
          <a href="#/dean/analytics" class="btn btn-sm btn-secondary" style="display:flex; align-items:center; gap:6px; border-radius:20px; font-weight:600;">
            <i class="ph ph-chart-line-up" style="font-size:1.1rem; color:var(--accent);"></i> Institution Analytics
          </a>
          <a href="#/dean/escalations" class="btn btn-sm btn-secondary" style="display:flex; align-items:center; gap:6px; border-radius:20px; font-weight:600;">
            <i class="ph ph-siren" style="font-size:1.1rem; color:var(--warning);"></i> Escalations
          </a>
        </div>

        <div class="stats-grid" style="grid-template-columns:repeat(6,1fr);margin-bottom:24px;">
        ${[
          ['Students',     totalStudents,    'var(--info)',   'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z'],
          ['Faculty',      totalFaculty,     'var(--accent)', 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'],
          ['Departments',  totalDepartments, 'var(--success)','M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2z'],
          ['High Risk',    highRiskStudents, 'var(--danger)', 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z'],
          ['Open Issues',  openIssues,       'var(--warning)','M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'],
          ['Total Issues', issues.length,    'var(--info)',   'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z'],
        ].map(([l,v,c,i]) => `
          <div class="stat-card">
            <div class="stat-icon" style="background:${c}22;"><svg viewBox="0 0 24 24" style="fill:${c};width:18px;height:18px;"><path d="${i}"/></svg></div>
            <div class="stat-label">${l}</div>
            <div class="stat-value" style="font-size:1.5rem;">${v}</div>
          </div>
        `).join('')}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
        <!-- Chart -->
        <div class="card" style="padding:20px;">
          <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Risk Distribution</h3>
          <div style="height:200px;"><canvas id="dean-risk-chart"></canvas></div>
        </div>
        <!-- Dept Risk bars -->
        <div class="card" style="padding:20px;">
          <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">High Risk by Department</h3>
          ${deptRows.length === 0
            ? '<p style="color:var(--text-muted);">No departments configured.</p>'
            : deptRows.map(d => `
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                <span style="flex:1;font-size:0.825rem;color:var(--text-secondary);">${d.name}</span>
                <div style="width:120px;" class="progress-bar-wrap">
                  <div class="progress-bar-fill ${d.highRisk>10?'fill-danger':d.highRisk>5?'fill-warning':'fill-success'}" style="width:${d.students>0?Math.min(100,(d.highRisk/d.students)*100*3):0}%"></div>
                </div>
                <span style="font-size:0.78rem;font-weight:600;width:28px;text-align:right;color:${d.highRisk>5?'var(--danger)':d.highRisk>2?'var(--warning)':'var(--success)'};">${d.highRisk}</span>
              </div>
            `).join('')
          }
        </div>
      </div>

      </div>

      <!-- Approvals Queue -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><h3>Pending HOD Approvals</h3></div>
        ${faculty.filter(f => f.role === 'HOD' && !f.isApproved).length === 0
          ? '<p style="padding:20px;color:var(--text-muted);">No pending approvals.</p>'
          : `<table class="data-table">
              <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Action</th></tr></thead>
              <tbody>
                ${faculty.filter(f => f.role === 'HOD' && !f.isApproved).map(f => `
                  <tr>
                    <td><strong>${f.name}</strong></td>
                    <td>${f.email}</td>
                    <td>${f.department||'—'}</td>
                    <td><button class="btn btn-xs btn-primary btn-approve" data-id="${f.id}">Approve</button></td>
                  </tr>
                `).join('')}
              </tbody>
             </table>`
        }
      </div>

      <!-- At Risk Students Table -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><h3>High Risk Students</h3></div>
        ${students.filter(s => s.riskLevel === 'HIGH').length === 0
          ? '<p style="padding:20px;color:var(--text-muted);">No high risk students currently.</p>'
          : `<table class="data-table">
              <thead><tr><th>Name</th><th>Department</th><th>CGPA</th><th>Actions</th></tr></thead>
              <tbody>
                ${students.filter(s => s.riskLevel === 'HIGH').map(s => `
                  <tr>
                    <td><strong>${s.name || '—'}</strong></td>
                    <td>${s.department || '—'}</td>
                    <td>${s.cgpa || '—'}</td>
                    <td>
                      <a href="#/mentor/booklet?studentId=${s.id}" class="btn btn-xs btn-primary">Booklet</a>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
             </table>`
        }
      </div>

      <!-- Department Table -->
      <div class="card">
        <div class="card-header"><h3>Department Overview</h3></div>
        <table class="data-table">
          <thead><tr><th>Department</th><th>Students</th><th>Mentors</th><th>Avg CGPA</th><th>High Risk</th><th>Open Issues</th></tr></thead>
          <tbody>
            ${deptRows.map(d => `
              <tr>
                <td style="font-weight:600;">${d.name}</td>
                <td>${d.students}</td>
                <td>${d.mentors}</td>
                <td>${d.avgCGPA}</td>
                <td><span class="badge ${d.highRisk>10?'badge-danger':d.highRisk>5?'badge-warning':'badge-success'}">${d.highRisk}</span></td>
                <td><span class="badge ${d.openIssues>5?'badge-danger':d.openIssues>2?'badge-warning':'badge-success'}">${d.openIssues}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- ===== Dean Reports & Downloads Section ===== -->
      <div class="card" style="margin-top:20px;padding:0;overflow:hidden;border:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border);background:linear-gradient(135deg,rgba(108,71,255,0.07),rgba(168,85,247,0.04));">
          <div>
            <h3 style="margin:0;font-size:0.95rem;font-weight:700;display:flex;align-items:center;gap:8px;">
              📊 Institution Reports
              <span class="badge badge-accent" style="font-size:0.68rem;padding:2px 7px;">Export Center</span>
            </h3>
            <p style="margin:3px 0 0;font-size:0.78rem;color:var(--text-muted);">Download institution-wide mentor allocation reports</p>
          </div>
          <div style="display:flex;gap:10px;">
            <button id="btn-dean-dash-excel" class="btn btn-sm btn-secondary" style="display:flex;align-items:center;gap:6px;">
              <i class="ph ph-file-xls" style="font-size:1rem;color:var(--success);"></i> Master Excel
            </button>
            <button id="btn-dean-dash-pdf" class="btn btn-sm btn-secondary" style="display:flex;align-items:center;gap:6px;">
              <i class="ph ph-file-pdf" style="font-size:1rem;color:var(--danger);"></i> Master PDF
            </button>
            <a href="#/dean/reports" class="btn btn-sm btn-primary" style="display:flex;align-items:center;gap:6px;font-weight:600;">
              <i class="ph ph-chart-bar"></i> Full Reports →
            </a>
          </div>
        </div>
        <div style="padding:14px 20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
          <i class="ph ph-lightbulb" style="color:var(--accent);"></i>
          <span style="font-size:0.8rem;color:var(--text-muted);">Master reports include all departments — classwise allocation list, mentor summary, and class-wise breakdown sheets. For per-mentor reports, visit <a href="#/dean/reports" style="color:var(--accent);font-weight:600;">Full Reports</a>.</span>
        </div>
      </div>

    </div>
  `;

    container.querySelectorAll('.btn-approve').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget?.dataset?.id || e.target.closest('.btn-approve')?.dataset?.id;
        if (!id) return;
        btn.disabled = true; btn.textContent = '...';
        try {
          await FacultyService.approve(id);
          showToast('HOD approved successfully!', 'success');
          setTimeout(() => render(container), 1000); // refresh page
        } catch (err) {
          showToast(err.message, 'error');
          btn.disabled = false; btn.textContent = 'Approve';
        }
      });
    });

    // Dean Dashboard Report Buttons
    container.querySelector('#btn-dean-dash-excel')?.addEventListener('click', async () => {
      await exportMentorStudentReport('excel');
    });
    container.querySelector('#btn-dean-dash-pdf')?.addEventListener('click', async () => {
      await exportMentorStudentReport('pdf');
    });

    if (window.Chart && students.length) {
      const high   = students.filter(s => s.riskLevel === 'HIGH').length;
      const medium = students.filter(s => s.riskLevel === 'MEDIUM').length;
      const low    = students.filter(s => !s.riskLevel || s.riskLevel === 'LOW').length;

      const canvas = container.querySelector('#dean-risk-chart');
      if (canvas) {
        if (activeDeanChart) activeDeanChart.destroy();
        const isLight = (document.documentElement.getAttribute('data-theme') || localStorage.getItem('theme')) === 'light';
        activeDeanChart = new window.Chart(canvas.getContext('2d'), {
          type: 'doughnut',
          data: {
            labels: ['High Risk', 'Medium Risk', 'Low Risk'],
            datasets: [{ data: [high, medium, low], backgroundColor:['#f87171','#fbbf24','#34d399'], borderWidth:0 }]
          },
          options: {
            responsive:true, maintainAspectRatio:false, cutout:'65%',
            plugins:{ legend:{ position:'right', labels:{color: isLight ? '#475569' : '#777799',font:{size:11}} } }
          }
        });
      }
    }

  } catch (err) {
    const content = container.querySelector('#dean-content');
    if (content) content.innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error: ${err.message}</h3></div>`;
  }
}

let activeDeanChart = null;

export function teardown() {
  if (activeDeanChart && typeof activeDeanChart.destroy === 'function') {
    activeDeanChart.destroy();
    activeDeanChart = null;
  }
}
