import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { StatsService, IssueService, FacultyService } from '/js/services.js';
import { exportToCSV } from '/js/utils.js';
import { db } from '/js/firebase-init.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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
    const [instData, allIssues, allMentors, bookletsSnap] = await Promise.all([
      StatsService.getInstitutionStats(),
      IssueService.getAll(),
      FacultyService.getAll(),
      getDocs(collection(db, 'booklets'))
    ]);

    const { students } = instData;
    const booklets = bookletsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Merge booklets into students
    const enrichedStudents = students.map(s => {
      const b = booklets.find(bk => bk.id === s.id) || {};
      let latestSGPA = 0;
      let totalBacklogs = 0;
      if (b.academics) {
        const sems = ['SEM VIII', 'SEM VII', 'SEM VI', 'SEM V', 'SEM IV', 'SEM III', 'SEM II', 'SEM I'];
        for (const sem of sems) {
          if (b.academics[sem] && b.academics[sem].classAwarded) {
             latestSGPA = parseFloat(b.academics[sem].classAwarded) || 0;
             break;
          }
        }
        for (const sem of sems) {
          if (b.academics[sem] && b.academics[sem].backlogs) {
             totalBacklogs += parseInt(b.academics[sem].backlogs) || 0;
          }
        }
      }
      return { ...s, latestSGPA, totalBacklogs };
    });

    // Issue categories
    const issueCats = {};
    allIssues.forEach(i => { issueCats[i.category || 'Other'] = (issueCats[i.category || 'Other'] || 0) + 1; });

    // SGPA by dept
    const deptSGPASum = {};
    const deptCount = {};
    enrichedStudents.forEach(s => {
       if (s.latestSGPA > 0) {
           deptSGPASum[s.department || 'Unknown'] = (deptSGPASum[s.department || 'Unknown'] || 0) + s.latestSGPA;
           deptCount[s.department || 'Unknown'] = (deptCount[s.department || 'Unknown'] || 0) + 1;
       }
    });
    const deptAvgSGPA = {};
    for (const d in deptSGPASum) {
       deptAvgSGPA[d] = (deptSGPASum[d] / deptCount[d]).toFixed(2);
    }

    // Mentor performance (assigned count, issues)
    const mentorPerf = allMentors.filter(m => m.role === 'MENTOR' || m.role === 'FACULTY').map(m => ({
      name: m.name,
      students: m.assignedStudentCount || 0,
      openIssues: allIssues.filter(i => i.mentorId === m.id && i.status === 'OPEN').length
    })).sort((a,b) => b.students - a.students).slice(0, 8);

    (container.querySelector('#analytics-content') || {}).innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h2 style="font-size:1.5rem; font-weight:700;">Institution Overview</h2>
        <button id="btn-export-csv" class="btn btn-primary">
          <i class="ph ph-download-simple" style="margin-right:8px;"></i> Export Risk Report (CSV)
        </button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
        <div class="card" style="padding:20px;">
          <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Average SGPA by Department</h3>
          <div style="height:220px;"><canvas id="chart-sgpa"></canvas></div>
        </div>
        <div class="card" style="padding:20px;">
          <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Issue Categories</h3>
          <div style="height:220px;"><canvas id="chart-issues"></canvas></div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div class="card" style="padding:20px;">
          <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Student Risk Distribution</h3>
          <div style="height:200px;"><canvas id="chart-risk-dist"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Top Mentors Snapshot</h3></div>
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

    // Export CSV logic
    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
       const headers = ['Name', 'Enrollment No.', 'Department', 'Year', 'Latest SGPA', 'Total Backlogs', 'Risk Level'];
       const rows = [headers];
       enrichedStudents.forEach(s => {
           rows.push([
               s.name || 'Unknown',
               s.enrollmentNumber || '—',
               s.department || '—',
               s.year || '—',
               s.latestSGPA > 0 ? s.latestSGPA : '—',
               s.totalBacklogs,
               s.riskLevel || 'UNKNOWN'
           ]);
       });
       exportToCSV('Student_Risk_Report.csv', rows);
    });

    if (!window.Chart) return;
    const tc = '#777799';
    const gc = 'rgba(255,255,255,0.05)';

    // Avg SGPA Bar
    new window.Chart((container.querySelector('#chart-sgpa') || document.createElement('canvas')).getContext('2d'), {
      type:'bar',
      data:{ labels:Object.keys(deptAvgSGPA), datasets:[{ label:'Avg SGPA', data:Object.values(deptAvgSGPA), backgroundColor:['#34d399','#60a5fa','#7c6aff','#fbbf24'], borderRadius:6 }] },
      options:{ responsive:true,maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true, max:10, grid:{color:gc},ticks:{color:tc,stepSize:2}}, x:{grid:{display:false},ticks:{color:tc,font:{size:10}}} } }
    });

    // Issue categories doughnut
    new window.Chart((container.querySelector('#chart-issues') || document.createElement('canvas')).getContext('2d'), {
      type:'doughnut',
      data:{ labels:Object.keys(issueCats), datasets:[{ data:Object.values(issueCats), backgroundColor:['#7c6aff','#34d399','#fbbf24','#60a5fa','#f87171','#a78bfa'], borderWidth:0 }] },
      options:{ responsive:true,maintainAspectRatio:false,cutout:'65%', plugins:{ legend:{ position:'right',labels:{color:tc,font:{size:11}} } } }
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

