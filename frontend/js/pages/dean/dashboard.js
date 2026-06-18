import { api } from '/js/api.js';
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';

const MOCK = {
  stats: { totalStudents:480, totalFaculty:24, totalDepartments:4, highRiskStudents:38, openIssues:22, completedMeetings:156 },
  departments: [
    { name:'Computer Science',      students:120, mentors:6, avgCGPA:7.4, highRisk:14, openIssues:8 },
    { name:'Information Technology',students:100, mentors:5, avgCGPA:7.1, highRisk:10, openIssues:6 },
    { name:'Electronics',           students:130, mentors:7, avgCGPA:6.9, highRisk:9,  openIssues:5 },
    { name:'Mechanical',            students:130, mentors:6, avgCGPA:7.2, highRisk:5,  openIssues:3 },
  ],
  meetingsPerMonth: [35,42,58,48,71,80]
};

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/dean/dashboard')}
      <div class="main-content">
        ${createHeader('Dean Dashboard', user)}
        <div class="page-content" id="dean-dash"></div>
      </div>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const { logout } = await import('/js/auth.js'); await logout();
  });

  let data = MOCK;
  try { data = { ...MOCK, ...await api.get('/api/dean/dashboard') }; } catch {}

  const s = data.stats;
  const dash = document.getElementById('dean-dash');

  dash.innerHTML = `
    <!-- Stats -->
    <div class="stats-grid" style="grid-template-columns:repeat(6,1fr);margin-bottom:24px;">
      ${[
        ['Students',      s.totalStudents,       'var(--info)',    'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z'],
        ['Faculty',       s.totalFaculty,        'var(--accent)',  'M20 6h-2.18c.07-.44.18-.88.18-1.3A4.68 4.68 0 0012.28.1C10.8.1 9.48.77 8.58 1.8L7 3.5 5.4 1.8C4.52.77 3.2.1 1.72.1A4.68 4.68 0 00.02 4.7c0 .42.11.86.18 1.3H-2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6zm-8.5 11.5h-3v-3h3v3z'],
        ['Departments',   s.totalDepartments,    'var(--success)', 'M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10z'],
        ['High Risk',     s.highRiskStudents,    'var(--danger)',  'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z'],
        ['Open Issues',   s.openIssues,          'var(--warning)', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'],
        ['Meetings Done', s.completedMeetings,   'var(--info)',    'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'],
      ].map(([label,value,color,icon]) => `
        <div class="stat-card">
          <div class="stat-icon" style="background:${color}22;">
            <svg viewBox="0 0 24 24" style="fill:${color};width:18px;height:18px;"><path d="${icon}"/></svg>
          </div>
          <div class="stat-label">${label}</div>
          <div class="stat-value" style="font-size:1.5rem;">${value}</div>
        </div>
      `).join('')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
      <!-- Chart -->
      <div class="card" style="padding:20px;">
        <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Institution-wide Meetings</h3>
        <div style="height:200px;">
          <canvas id="dean-chart"></canvas>
        </div>
      </div>

      <!-- Risk Summary -->
      <div class="card" style="padding:20px;">
        <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Department Risk Summary</h3>
        ${(data.departments||[]).map(d => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            <span style="flex:1;font-size:0.825rem;color:var(--text-secondary);">${d.name}</span>
            <div style="width:120px;"><div class="progress-bar-wrap"><div class="progress-bar-fill ${d.highRisk>10?'fill-danger':d.highRisk>5?'fill-warning':'fill-success'}" style="width:${Math.min(100,(d.highRisk/d.students)*100*3)}%"></div></div></div>
            <span style="font-size:0.78rem;color:${d.highRisk>10?'var(--danger)':d.highRisk>5?'var(--warning)':'var(--success)'};font-weight:600;width:28px;text-align:right;">${d.highRisk}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Department Table -->
    <div class="card">
      <div class="card-header"><h3>Department Overview</h3></div>
      <table class="data-table">
        <thead><tr><th>Department</th><th>Students</th><th>Mentors</th><th>Avg CGPA</th><th>High Risk</th><th>Open Issues</th></tr></thead>
        <tbody>
          ${(data.departments||[]).map(d => `
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
  `;

  // Chart
  if (window.Chart) {
    const ctx = document.getElementById('dean-chart').getContext('2d');
    new window.Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Jan','Feb','Mar','Apr','May','Jun'],
        datasets: [{
          label: 'Meetings',
          data: data.meetingsPerMonth || MOCK.meetingsPerMonth,
          borderColor: '#7c6aff',
          backgroundColor: 'rgba(124,106,255,0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#7c6aff',
          pointRadius: 4,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#777799' } },
          x: { grid: { display: false }, ticks: { color: '#777799' } }
        }
      }
    });
  }
}
