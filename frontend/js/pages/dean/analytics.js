import { api } from '/js/api.js';
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';

const MOCK = {
  meetingsTrend: [35,42,58,48,71,80],
  issueCategories: { Academic:14, Career:6, Financial:5, Personal:4, Other:3 },
  deptRisk: { 'Computer Science':14, 'Information Technology':10, 'Electronics':9, 'Mechanical':5 },
  mentorPerformance: [
    { name:'Dr. Shah',   meetings:22, satisfaction:4.2 },
    { name:'Dr. Gupta',  meetings:18, satisfaction:4.5 },
    { name:'Dr. Sharma', meetings:25, satisfaction:4.0 },
    { name:'Dr. Singh',  meetings:19, satisfaction:4.3 },
  ]
};

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/dean/analytics')}
      <div class="main-content">
        ${createHeader('Analytics', user)}
        <div class="page-content" id="analytics-content">
          <div style="display:flex;align-items:center;justify-content:center;height:200px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const { logout } = await import('/js/auth.js'); await logout();
  });

  let data = MOCK;
  try { data = { ...MOCK, ...await api.get('/api/dean/analytics') }; } catch {}

  document.getElementById('analytics-content').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
      <!-- Meetings Trend -->
      <div class="card" style="padding:20px;">
        <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Monthly Meeting Trends</h3>
        <div style="height:220px;"><canvas id="chart-trend"></canvas></div>
      </div>
      <!-- Issue Categories -->
      <div class="card" style="padding:20px;">
        <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Issue Categories</h3>
        <div style="height:220px;"><canvas id="chart-issues"></canvas></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <!-- Dept Risk -->
      <div class="card" style="padding:20px;">
        <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Department Risk Distribution</h3>
        <div style="height:200px;"><canvas id="chart-risk"></canvas></div>
      </div>
      <!-- Mentor Performance Table -->
      <div class="card">
        <div class="card-header"><h3>Mentor Performance</h3></div>
        <table class="data-table">
          <thead><tr><th>Mentor</th><th>Meetings</th><th>Rating</th></tr></thead>
          <tbody>
            ${(data.mentorPerformance||[]).map(m => `
              <tr>
                <td style="font-weight:600;">${m.name}</td>
                <td>${m.meetings}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:6px;">
                    <span style="color:var(--warning);">★</span>
                    <span>${m.satisfaction.toFixed(1)}</span>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  if (!window.Chart) return;

  const textColor = '#777799';
  const gridColor = 'rgba(255,255,255,0.05)';

  // Trend Chart
  new window.Chart(document.getElementById('chart-trend').getContext('2d'), {
    type: 'line',
    data: {
      labels: ['Jan','Feb','Mar','Apr','May','Jun'],
      datasets: [{ label:'Meetings', data: data.meetingsTrend||MOCK.meetingsTrend, borderColor:'#7c6aff', backgroundColor:'rgba(124,106,255,0.1)', fill:true, tension:0.4, pointBackgroundColor:'#7c6aff', pointRadius:4 }]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true,grid:{color:gridColor},ticks:{color:textColor}}, x:{grid:{display:false},ticks:{color:textColor}} } }
  });

  // Issue Categories Doughnut
  const cats = data.issueCategories || MOCK.issueCategories;
  new window.Chart(document.getElementById('chart-issues').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(cats),
      datasets: [{ data: Object.values(cats), backgroundColor: ['#7c6aff','#34d399','#fbbf24','#60a5fa','#f87171'], borderWidth:0 }]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'right', labels:{color:textColor,font:{size:11}} } }, cutout:'65%' }
  });

  // Dept Risk Bar
  const deptRisk = data.deptRisk || MOCK.deptRisk;
  new window.Chart(document.getElementById('chart-risk').getContext('2d'), {
    type: 'bar',
    data: {
      labels: Object.keys(deptRisk),
      datasets: [{ label:'High Risk Students', data: Object.values(deptRisk), backgroundColor: ['#f87171','#fbbf24','#7c6aff','#34d399'], borderRadius:6 }]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true,grid:{color:gridColor},ticks:{color:textColor}}, x:{grid:{display:false},ticks:{color:textColor,font:{size:10}}} } }
  });
}
