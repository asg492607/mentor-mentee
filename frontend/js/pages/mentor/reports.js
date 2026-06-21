import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { StatsService } from '/js/services.js';

function riskBadge(r) {
  const cls = {HIGH:'badge-danger',MEDIUM:'badge-warning',LOW:'badge-success'}[r]||'badge-muted';
  return `<span class="badge ${cls}">${r||'N/A'}</span>`;
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/mentor/reports')}
      <div class="main-content">
        ${createHeader('Reports', user)}
        <div class="page-content" id="reports-content">
          <div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  try {
    const data = await StatsService.getMentorStats(user.id);
    const { totalStudents, highRiskStudents, openIssues, completedMeetings, students, meetings } = data;

    // Build meetings-per-month (last 6 months)
    const now = new Date();
    const months = Array.from({length:6}, (_,i) => {
      const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1);
      return d.toLocaleString('en-IN',{month:'short'}) + ' ' + d.getFullYear().toString().slice(2);
    });
    const meetPerMonth = Array(6).fill(0);
    meetings.forEach(m => {
      if (!m.scheduledAt) return;
      const d = new Date(m.scheduledAt);
      for (let i = 0; i < 6; i++) {
        const ref = new Date(now.getFullYear(), now.getMonth()-5+i, 1);
        if (d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()) {
          meetPerMonth[i]++;
        }
      }
    });

    const highRiskList = students
      .filter(s => s.riskLevel === 'HIGH' || s.riskLevel === 'MEDIUM')
      .sort((a,b) => (b.riskScore||0) - (a.riskScore||0));

    const rc = document.getElementById('reports-content');
    rc.innerHTML = `
      <div class="stats-grid" style="margin-bottom:24px;">
        ${[
          ['Total Students',   totalStudents,    'var(--info)',    'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z'],
          ['High Risk',        highRiskStudents, 'var(--danger)', 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z'],
          ['Open Issues',      openIssues,       'var(--warning)','M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'],
          ['Completed Meetings',completedMeetings,'var(--success)','M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'],
        ].map(([l,v,c,i]) => `
          <div class="stat-card">
            <div class="stat-icon" style="background:${c}22;">
              <svg viewBox="0 0 24 24" style="fill:${c};width:20px;height:20px;"><path d="${i}"/></svg>
            </div>
            <div class="stat-label">${l}</div>
            <div class="stat-value">${v}</div>
          </div>
        `).join('')}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div class="card" style="padding:20px;">
          <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Meetings per Month</h3>
          <div style="height:200px;"><canvas id="chart-meetings"></canvas></div>
        </div>

        <div class="card">
          <div class="card-header"><h3>At-Risk Students</h3></div>
          ${highRiskList.length === 0
            ? '<p style="padding:20px;color:var(--text-muted);">No at-risk students.</p>'
            : `<table class="data-table">
                <thead><tr><th>Student</th><th>CGPA</th><th>Att.</th><th>Risk Score</th><th>Level</th></tr></thead>
                <tbody>
                  ${highRiskList.map(s => `
                    <tr>
                      <td style="font-weight:600;">${s.name}</td>
                      <td style="color:${(s.cgpa||0)<6?'var(--danger)':'inherit'};">${s.cgpa||'—'}</td>
                      <td style="color:${(s.attendance||0)<75?'var(--danger)':'inherit'};">${s.attendance||0}%</td>
                      <td><span style="font-weight:700;color:${(s.riskScore||0)>60?'var(--danger)':'var(--warning)'};">${s.riskScore||0}</span><span style="color:var(--text-muted);font-size:0.75rem;">/100</span></td>
                      <td>${riskBadge(s.riskLevel)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>`
          }
        </div>
      </div>
    `;

    if (window.Chart) {
      new window.Chart((container.querySelector('#chart-meetings') || document.createElement('canvas')).getContext('2d'), {
        type: 'bar',
        data: {
          labels: months,
          datasets: [{ label:'Meetings', data:meetPerMonth, backgroundColor:'rgba(124,106,255,0.6)', borderColor:'#7c6aff', borderWidth:2, borderRadius:6 }]
        },
        options: {
          responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{display:false} },
          scales:{
            y:{ beginAtZero:true, ticks:{stepSize:1,color:'#777799'}, grid:{color:'rgba(255,255,255,0.05)'} },
            x:{ grid:{display:false}, ticks:{color:'#777799'} }
          }
        }
      });
    }

  } catch (err) {
    const rc = container.querySelector('#reports-content');
    if (rc) rc.innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error loading reports</h3><p>${err.message}</p></div>`;
  }
}

