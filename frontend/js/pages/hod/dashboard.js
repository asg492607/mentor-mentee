import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { StatsService, IssueService } from '/js/services.js';

function riskBadge(r) {
  const cls = {HIGH:'badge-danger',MEDIUM:'badge-warning',LOW:'badge-success'}[r]||'badge-muted';
  return `<span class="badge ${cls}">${r||'N/A'}</span>`;
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/hod/dashboard')}
      <div class="main-content">
        ${createHeader('HOD Dashboard', user)}
        <div class="page-content" id="hod-content">
          <div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  try {
    const dept = user.department;
    const data = await StatsService.getDeptStats(dept);
    const { totalStudents, totalMentors, highRiskStudents, openIssues, resolvedIssues, students, mentors, issues } = data;

    const highRiskList = students
      .filter(s => s.riskLevel === 'HIGH')
      .sort((a,b) => (b.riskScore||0) - (a.riskScore||0));

    const escalations = issues.filter(i => i.escalationLevel === 'HOD');

    // Build mentor performance
    const mentorStats = mentors.map(m => {
      const mStudents = students.filter(s => s.mentorId === m.id);
      const mRisk     = mStudents.filter(s => s.riskLevel === 'HIGH').length;
      return { ...m, studentCount: mStudents.length, highRisk: mRisk };
    });

    const content = document.getElementById('hod-content');
    content.innerHTML = `
      <!-- Stats -->
      <div class="stats-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:24px;">
        ${[
          ['Total Students',   totalStudents,    'var(--info)',    'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z'],
          ['Mentors',          totalMentors,     'var(--accent)', 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'],
          ['High Risk',        highRiskStudents, 'var(--danger)', 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z'],
          ['Open Issues',      openIssues,       'var(--warning)','M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'],
          ['Resolved Issues',  resolvedIssues,   'var(--success)','M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'],
        ].map(([l,v,c,i]) => `
          <div class="stat-card">
            <div class="stat-icon" style="background:${c}22;"><svg viewBox="0 0 24 24" style="fill:${c};width:20px;height:20px;"><path d="${i}"/></svg></div>
            <div class="stat-label">${l}</div>
            <div class="stat-value">${v}</div>
          </div>
        `).join('')}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
        <!-- High Risk -->
        <div class="card">
          <div class="card-header">
            <h3>High Risk Students</h3>
            <a href="#/hod/risk-students" style="font-size:0.8rem;color:var(--accent);">View All</a>
          </div>
          ${highRiskList.length === 0
            ? '<p style="padding:20px;color:var(--text-muted);">No high-risk students.</p>'
            : `<table class="data-table">
                <thead><tr><th>Student</th><th>Mentor</th><th>CGPA</th><th>Att.</th><th>Risk</th></tr></thead>
                <tbody>
                  ${highRiskList.slice(0,6).map(s => {
                    const mentor = mentors.find(m => m.id === s.mentorId);
                    return `<tr>
                      <td style="font-weight:600;font-size:0.875rem;">${s.name}</td>
                      <td style="font-size:0.8rem;color:var(--text-secondary);">${mentor?.name||'Unassigned'}</td>
                      <td>${s.cgpa||'—'}</td>
                      <td>${s.attendance||0}%</td>
                      <td>${riskBadge(s.riskLevel)}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>`
          }
        </div>

        <!-- Escalations -->
        <div class="card">
          <div class="card-header">
            <h3>Escalated Issues</h3>
            <a href="#/hod/escalations" style="font-size:0.8rem;color:var(--accent);">View All</a>
          </div>
          ${escalations.length === 0
            ? '<p style="padding:20px;color:var(--text-muted);">No escalations.</p>'
            : escalations.slice(0,5).map(e => `
                <div class="list-item">
                  <div>
                    <p style="font-weight:600;font-size:0.875rem;">${e.studentName||'—'}</p>
                    <p style="color:var(--text-secondary);font-size:0.8rem;">${e.title}</p>
                  </div>
                  <span class="badge ${e.status==='OPEN'?'badge-warning':'badge-success'}">${e.status}</span>
                </div>
              `).join('')
          }
        </div>
      </div>

      <!-- Mentor Performance -->
      <div class="card">
        <div class="card-header"><h3>Mentor Performance — ${dept || 'Department'}</h3></div>
        ${mentorStats.length === 0
          ? '<p style="padding:20px;color:var(--text-muted);">No mentors found.</p>'
          : `<table class="data-table">
              <thead><tr><th>Mentor</th><th>Students</th><th>High Risk</th></tr></thead>
              <tbody>
                ${mentorStats.map(m => `
                  <tr>
                    <td style="font-weight:600;">${m.name}</td>
                    <td>${m.studentCount}</td>
                    <td><span class="badge ${m.highRisk>3?'badge-danger':m.highRisk>1?'badge-warning':'badge-success'}">${m.highRisk}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>`
        }
      </div>
    `;
  } catch (err) {
    document.getElementById('hod-content').innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error loading dashboard</h3><p>${err.message}</p></div>`;
  }
}
