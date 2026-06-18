import { api } from '/js/api.js';
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';

const MOCK = {
  stats: { totalStudents:18, highRiskStudents:3, openIssues:2, completedMeetings:12 },
  highRiskStudents: [
    { name:'Arun Mehta',  riskLevel:'HIGH',   cgpa:5.1, attendance:61, rollNumber:'CS2103' },
    { name:'Kiran Patel', riskLevel:'HIGH',   cgpa:5.8, attendance:68, rollNumber:'CS2105' },
    { name:'Sam Thomas',  riskLevel:'MEDIUM', cgpa:6.2, attendance:72, rollNumber:'CS2108' },
  ],
  meetingsPerMonth: [4,6,8,5,9,12]
};

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/mentor/reports')}
      <div class="main-content">
        ${createHeader('Reports', user)}
        <div class="page-content" id="reports-content">
          <div style="display:flex;align-items:center;justify-content:center;height:200px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const { logout } = await import('/js/auth.js'); await logout();
  });

  let data = MOCK;
  try { data = { ...MOCK, ...await api.get('/api/mentor/reports') }; } catch {}

  const s = data.stats;
  const rc = document.getElementById('reports-content');

  rc.innerHTML = `
    <!-- Stats -->
    <div class="stats-grid" style="margin-bottom:24px;">
      ${[
        ['Total Students',   s.totalStudents,      'var(--info)',    'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z'],
        ['High Risk',         s.highRiskStudents,   'var(--danger)',  'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z'],
        ['Open Issues',       s.openIssues,         'var(--warning)', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'],
        ['Completed Meetings',s.completedMeetings,  'var(--success)', 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'],
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

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <!-- Meetings Chart -->
      <div class="card" style="padding:20px;">
        <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Meetings Per Month</h3>
        <div class="chart-container" style="height:200px;">
          <canvas id="meetings-chart"></canvas>
        </div>
      </div>

      <!-- High Risk Students -->
      <div class="card">
        <div class="card-header"><h3>High Risk Students</h3></div>
        <table class="data-table">
          <thead><tr><th>Name</th><th>Roll No</th><th>CGPA</th><th>Att.</th><th>Risk</th></tr></thead>
          <tbody>
            ${(data.highRiskStudents||[]).map(s=>`
              <tr>
                <td style="font-weight:600;font-size:0.875rem;">${s.name}</td>
                <td style="color:var(--text-muted);font-size:0.8rem;">${s.rollNumber}</td>
                <td>${s.cgpa}</td>
                <td>${s.attendance}%</td>
                <td><span class="badge ${{HIGH:'badge-danger',MEDIUM:'badge-warning',LOW:'badge-success'}[s.riskLevel]||'badge-muted'}">${s.riskLevel}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Bar chart
  if (window.Chart) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun'];
    const ctx = document.getElementById('meetings-chart').getContext('2d');
    new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [{
          label: 'Meetings',
          data: data.meetingsPerMonth || MOCK.meetingsPerMonth,
          backgroundColor: 'rgba(124,106,255,0.6)',
          borderColor: '#7c6aff',
          borderWidth: 2,
          borderRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted') || '#555577', stepSize: 2 }, grid: { color: 'rgba(255,255,255,0.05)' } },
          x: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted') || '#555577' }, grid: { display: false } }
        }
      }
    });
  }
}
