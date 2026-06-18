import { api } from '/js/api.js';
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';

const MOCK = {
  stats: { totalStudents:120, totalMentors:6, highRiskStudents:14, openIssues:8, resolvedIssues:23 },
  highRiskStudents: [
    { name:'Arun Mehta',  mentor:'Dr. Shah',  cgpa:5.1, attendance:61, riskLevel:'HIGH' },
    { name:'Kiran Patel', mentor:'Dr. Gupta', cgpa:5.8, attendance:68, riskLevel:'HIGH' },
    { name:'Dev Nair',    mentor:'Dr. Shah',  cgpa:6.0, attendance:70, riskLevel:'HIGH' },
  ],
  recentEscalations: [
    { student:'Raj Kumar',   title:'Fee issue', status:'OPEN',     date:new Date(Date.now()-86400000*2).toISOString() },
    { student:'Meera Patel', title:'Attendance',status:'RESOLVED', date:new Date(Date.now()-86400000*5).toISOString() },
  ],
  mentors: [
    { name:'Dr. Shah',   students:20, completedMeetings:18, highRisk:3 },
    { name:'Dr. Gupta',  students:20, completedMeetings:15, highRisk:2 },
    { name:'Dr. Sharma', students:20, completedMeetings:22, highRisk:4 },
  ]
};

function riskBadge(r) {
  const map = {HIGH:'badge-danger',MEDIUM:'badge-warning',LOW:'badge-success'};
  return `<span class="badge ${map[r]||'badge-muted'}">${r}</span>`;
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/hod/dashboard')}
      <div class="main-content">
        ${createHeader('HOD Dashboard', user)}
        <div class="page-content" id="hod-dash"></div>
      </div>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const { logout } = await import('/js/auth.js'); await logout();
  });

  let data = MOCK;
  try { data = { ...MOCK, ...await api.get('/api/hod/dashboard') }; } catch {}

  const s = data.stats;
  const dash = document.getElementById('hod-dash');

  dash.innerHTML = `
    <!-- Stats -->
    <div class="stats-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:24px;">
      ${[
        ['Total Students',   s.totalStudents,      'var(--info)',    'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z'],
        ['Mentors',          s.totalMentors,        'var(--accent)',  'M20 6h-2.18c.07-.44.18-.88.18-1.3 0-2.6-2.1-4.7-4.7-4.7-1.48 0-2.8.67-3.7 1.7L8 3.51 6.4 1.7C5.5.67 4.2 0 2.7 0 .1 0-2 2.1-2 4.7c0 .43.11.86.18 1.3H-2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6zm-8.5 11.5h-3v-3h3v3zm0-4.5h-3v-3h3v3z'],
        ['High Risk',        s.highRiskStudents,    'var(--danger)',  'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z'],
        ['Open Issues',      s.openIssues,          'var(--warning)', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'],
        ['Resolved Issues',  s.resolvedIssues,      'var(--success)', 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'],
      ].map(([label,value,color,icon]) => `
        <div class="stat-card">
          <div class="stat-icon" style="background:${color}22;">
            <svg viewBox="0 0 24 24" style="fill:${color};width:20px;height:20px;"><path d="${icon}"/></svg>
          </div>
          <div class="stat-label">${label}</div>
          <div class="stat-value">${value}</div>
        </div>
      `).join('')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
      <!-- High Risk Students -->
      <div class="card">
        <div class="card-header">
          <h3>High Risk Students</h3>
          <a href="#/hod/risk-students" style="font-size:0.8rem;color:var(--accent);">View All</a>
        </div>
        <table class="data-table">
          <thead><tr><th>Student</th><th>Mentor</th><th>CGPA</th><th>Att.</th><th>Risk</th></tr></thead>
          <tbody>
            ${(data.highRiskStudents||[]).map(s=>`
              <tr>
                <td style="font-weight:600;font-size:0.875rem;">${s.name}</td>
                <td style="font-size:0.8rem;color:var(--text-secondary);">${s.mentor||'—'}</td>
                <td>${s.cgpa}</td>
                <td>${s.attendance}%</td>
                <td>${riskBadge(s.riskLevel)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Recent Escalations -->
      <div class="card">
        <div class="card-header">
          <h3>Recent Escalations</h3>
          <a href="#/hod/escalations" style="font-size:0.8rem;color:var(--accent);">View All</a>
        </div>
        ${(data.recentEscalations||[]).length === 0 ? '<p style="padding:20px;color:var(--text-muted);">No escalations.</p>' :
          (data.recentEscalations||[]).map(e=>`
            <div class="list-item">
              <div>
                <p style="font-weight:600;font-size:0.875rem;">${e.student}</p>
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
      <div class="card-header"><h3>Mentor Performance</h3></div>
      <table class="data-table">
        <thead><tr><th>Mentor</th><th>Students</th><th>Meetings Completed</th><th>High Risk Students</th></tr></thead>
        <tbody>
          ${(data.mentors||[]).map(m=>`
            <tr>
              <td style="font-weight:600;">${m.name}</td>
              <td>${m.students}</td>
              <td>${m.completedMeetings}</td>
              <td><span class="badge ${m.highRisk>3?'badge-danger':m.highRisk>1?'badge-warning':'badge-success'}">${m.highRisk}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
