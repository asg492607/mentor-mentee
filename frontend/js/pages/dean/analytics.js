import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { StatsService, IssueService, MeetingService, FacultyService } from '/js/services.js';

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/dean/analytics')}
      <div class="main-content">
        ${createHeader('Analytics', user)}
        <div class="page-content" id="analytics-content">
          <div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  try {
    const [instData, allIssues, allMentors] = await Promise.all([
      StatsService.getInstitutionStats(),
      IssueService.getAll(),
      FacultyService.getAll()
    ]);

    const { students } = instData;

    // Issue categories
    const issueCats = {};
    allIssues.forEach(i => { issueCats[i.category || 'Other'] = (issueCats[i.category || 'Other'] || 0) + 1; });

    // Risk by dept
    const deptRisk = {};
    students.forEach(s => {
      if (s.riskLevel === 'HIGH') {
        deptRisk[s.department || 'Unknown'] = (deptRisk[s.department || 'Unknown'] || 0) + 1;
      }
    });

    // Mentor performance (assigned count, issues)
    const mentorPerf = allMentors.map(m => ({
      name: m.name,
      students: m.assignedStudentCount || 0,
      openIssues: allIssues.filter(i => i.mentorId === m.id && i.status === 'OPEN').length
    })).sort((a,b) => b.students - a.students).slice(0, 8);

    // Meetings trend
    const now = new Date();
    const months = Array.from({length:6}, (_,i) => {
      const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1);
      return d.toLocaleString('en-IN',{month:'short'});
    });
    const meetPerMonth = Array(6).fill(0);
    // Note: would need MeetingService.getAll() but could be large; skip for now

    (container.querySelector('#analytics-content') || {}).innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
        <div class="card" style="padding:20px;">
          <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Issue Categories</h3>
          <div style="height:220px;"><canvas id="chart-issues"></canvas></div>
        </div>
        <div class="card" style="padding:20px;">
          <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Department Risk Distribution</h3>
          <div style="height:220px;"><canvas id="chart-risk"></canvas></div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div class="card" style="padding:20px;">
          <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Student Risk Levels</h3>
          <div style="height:200px;"><canvas id="chart-risk-dist"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Mentor Snapshot</h3></div>
          <table class="data-table">
            <thead><tr><th>Mentor</th><th>Students</th><th>Open Issues</th></tr></thead>
            <tbody>
              ${mentorPerf.map(m => `
                <tr>
                  <td style="font-weight:600;">${m.name}</td>
                  <td>${m.students}</td>
                  <td><span class="badge ${m.openIssues>3?'badge-danger':m.openIssues>1?'badge-warning':'badge-success'}">${m.openIssues}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    if (!window.Chart) return;
    const tc = '#777799';
    const gc = 'rgba(255,255,255,0.05)';

    // Issue categories doughnut
    new window.Chart((container.querySelector('#chart-issues') || document.createElement('canvas')).getContext('2d'), {
      type:'doughnut',
      data:{ labels:Object.keys(issueCats), datasets:[{ data:Object.values(issueCats), backgroundColor:['#7c6aff','#34d399','#fbbf24','#60a5fa','#f87171','#a78bfa'], borderWidth:0 }] },
      options:{ responsive:true,maintainAspectRatio:false,cutout:'65%', plugins:{ legend:{ position:'right',labels:{color:tc,font:{size:11}} } } }
    });

    // Dept risk bar
    new window.Chart((container.querySelector('#chart-risk') || document.createElement('canvas')).getContext('2d'), {
      type:'bar',
      data:{ labels:Object.keys(deptRisk), datasets:[{ label:'High Risk', data:Object.values(deptRisk), backgroundColor:['#f87171','#fbbf24','#7c6aff','#34d399'], borderRadius:6 }] },
      options:{ responsive:true,maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true,grid:{color:gc},ticks:{color:tc,stepSize:1}}, x:{grid:{display:false},ticks:{color:tc,font:{size:10}}} } }
    });

    // Risk level pie
    const high   = students.filter(s => s.riskLevel==='HIGH').length;
    const medium = students.filter(s => s.riskLevel==='MEDIUM').length;
    const low    = students.filter(s => !s.riskLevel||s.riskLevel==='LOW').length;
    new window.Chart((container.querySelector('#chart-risk-dist') || document.createElement('canvas')).getContext('2d'), {
      type:'doughnut',
      data:{ labels:['High','Medium','Low'], datasets:[{ data:[high,medium,low], backgroundColor:['#f87171','#fbbf24','#34d399'], borderWidth:0 }] },
      options:{ responsive:true,maintainAspectRatio:false,cutout:'60%', plugins:{ legend:{ position:'bottom',labels:{color:tc} } } }
    });

  } catch (err) {
    (container.querySelector('#analytics-content') || {}).innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error: ${err.message}</h3></div>`;
  }
}

