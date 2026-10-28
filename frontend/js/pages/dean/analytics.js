// Dean — Analytics Page
// Comparative department analytics, attendance trends, and retention forecasting.
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { StatsService } from '/js/services.js';
import { exportToCSV, escapeHtml } from '/js/utils.js';

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
    const instData = await StatsService.getInstitutionStats();

    const { students = [], issues: allIssues = [], faculty: allMentors = [], depts = [] } = instData;
    const cohortAnalysis = StatsService.summarizeStudents(students);

    const enrichedStudents = students.map(student => ({
      ...student,
      latestSGPA: Number(student.latestSGPA) || 0,
      totalBacklogs: Number(student.backlogs) || 0
    }));

    // Issue categories
    const issueCats = {};
    allIssues.forEach(i => { issueCats[i.category || 'Other'] = (issueCats[i.category || 'Other'] || 0) + 1; });

    // Department analyses keep same-named departments separate across schools.
    const departmentBuckets = new Map();
    enrichedStudents.forEach(s => {
      const linkedDepartment = depts.find(department => department.id === s.departmentId);
      const school = s.schoolName || linkedDepartment?.schoolName || s.schoolId || 'School not set';
      const key = `${String(school).trim()} · ${String(s.department || linkedDepartment?.name || 'Department not set').trim()}`;
      const bucket = departmentBuckets.get(key) || { name: key, students: 0, marksSum: 0, marksCount: 0, attendanceSum: 0, attendanceCount: 0, fr: 0, slow: 0 };
      bucket.students++;
      const marks = s.latestSubjectAverage === null || s.latestSubjectAverage === undefined || s.latestSubjectAverage === '' ? NaN : Number(s.latestSubjectAverage);
      if (Number.isFinite(marks) && marks >= 0 && marks <= 100) { bucket.marksSum += marks; bucket.marksCount++; }
      const attendance = s.attendance === null || s.attendance === undefined || s.attendance === '' ? NaN : Number(s.attendance);
      const recorded = Number(s.attendanceSessions) > 0 || ['LOW', 'BELOW_TARGET', 'ON_TRACK'].includes(String(s.attendanceStatus || '').toUpperCase()) || attendance > 0;
      if (recorded && Number.isFinite(attendance) && attendance >= 0 && attendance <= 100) {
        bucket.attendanceSum += attendance;
        bucket.attendanceCount++;
        if (attendance <= 40) bucket.fr++;
      }
      if (s.learnerLevel === 'SLOW') bucket.slow++;
      departmentBuckets.set(key, bucket);
    });
    const departmentRows = [...departmentBuckets.values()].map(bucket => ({
      ...bucket,
      averageMarks: bucket.marksCount ? Math.round(bucket.marksSum / bucket.marksCount * 10) / 10 : null,
      averageAttendance: bucket.attendanceCount ? Math.round(bucket.attendanceSum / bucket.attendanceCount * 10) / 10 : null
    })).sort((a, b) => b.fr - a.fr || b.slow - a.slow || b.students - a.students);

    // Mentor rows use assigned records rather than the cached assignedStudentCount field.
    const mentorPerf = allMentors.filter(m => ['MENTOR', 'FACULTY'].includes(String(m.role || '').toUpperCase()) && m.isApproved !== false && !['PENDING', 'REJECTED', 'DISABLED'].includes(String(m.status || '').toUpperCase())).map(m => {
      const assigned = students.filter(student => student.mentorId === m.id);
      const analysis = StatsService.summarizeStudents(assigned);
      return {
        name: m.name,
        students: assigned.length,
        fr: analysis.frCount,
        slow: analysis.learnerCounts.SLOW,
        averageMarks: analysis.averageSubjectMarks,
        openIssues: allIssues.filter(i => i.mentorId === m.id && !['RESOLVED', 'CLOSED'].includes(String(i.status || '').toUpperCase())).length
      };
    }).sort((a,b) => b.fr - a.fr || b.slow - a.slow || b.students - a.students).slice(0, 8);

    (container.querySelector('#analytics-content') || {}).innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;gap:12px;flex-wrap:wrap;">
        <div><h2 style="font-size:1.5rem; font-weight:700;margin:0;">Institution Overview</h2><p style="margin:4px 0 0;color:var(--text-muted);font-size:.8rem;">School-aware academic, attendance, and support analysis. Each average includes its sample size.</p></div>
        <button id="btn-export-csv" class="btn btn-primary">
          <i class="ph ph-download-simple" style="margin-right:8px;"></i> Export Risk Report (CSV)
        </button>
      </div>

      <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:20px;">
        ${[
          ['Active Students', students.length, 'var(--info)'],
          ['Mean Subject Marks', cohortAnalysis.averageSubjectMarks === null ? '—' : `${cohortAnalysis.averageSubjectMarks}%`, 'var(--accent)'],
          ['Marks Assessed', `${cohortAnalysis.marksAssessed}/${students.length}`, 'var(--success)'],
          ['Mean Attendance', cohortAnalysis.averageAttendance === null ? '—' : `${cohortAnalysis.averageAttendance}%`, 'var(--info)'],
          ['FR ≤40%', cohortAnalysis.frCount, 'var(--danger)'],
          ['Slow Band', cohortAnalysis.learnerCounts.SLOW, 'var(--warning)']
        ].map(([label, value, color]) => `<div class="stat-card"><div class="stat-label">${label}</div><div class="stat-value" style="color:${color};font-size:1.35rem;">${value}</div></div>`).join('')}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
        <div class="card" style="padding:20px;">
          <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Mean latest subject marks by School / Department</h3>
          <div style="height:240px;"><canvas id="chart-marks"></canvas></div>
        </div>
        <div class="card" style="padding:20px;">
          <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Mean recorded attendance by School / Department</h3>
          <div style="height:240px;"><canvas id="chart-attendance"></canvas></div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div class="card" style="padding:20px;">
          <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Issue Categories</h3>
          <div style="height:200px;"><canvas id="chart-issues"></canvas></div>
        </div>
        <div class="card" style="padding:20px;">
          <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Student Risk Distribution</h3>
          <div style="height:200px;"><canvas id="chart-risk-dist"></canvas></div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px;">
        <div class="card" style="padding:20px;">
          <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Learner Bands from Latest Marks</h3>
          <div style="height:200px;"><canvas id="chart-learners"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Mentor Support Load</h3><p style="font-size:.76rem;color:var(--text-muted);margin:4px 0 0;">Sorted by FR cases, slow-band students, then assigned cohort size.</p></div>
          <div style="overflow:auto;"><table class="data-table">
            <thead><tr><th>Mentor</th><th>Students</th><th>Mean marks</th><th>FR</th><th>Slow</th><th>Open issues</th></tr></thead>
            <tbody>
              ${mentorPerf.map(m => `
                <tr>
                  <td style="font-weight:600;">${escapeHtml(m.name || 'Mentor')}</td>
                  <td>${m.students}</td>
                  <td>${m.averageMarks === null ? '—' : `${m.averageMarks}%`}</td>
                  <td><span class="badge ${m.fr ? 'badge-danger' : 'badge-success'}">${m.fr}</span></td>
                  <td>${m.slow}</td>
                  <td><span class="badge ${m.openIssues>3?'badge-danger':m.openIssues>1?'badge-warning':'badge-success'}">${m.openIssues}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        </div>
      </div>
    `;

    // Export CSV logic
    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
       const headers = ['Name', 'Enrollment No.', 'School', 'Department', 'Year', 'Latest Subject Average', 'Learner Band', 'Attendance', 'Risk', 'Latest SGPA', 'Total Backlogs'];
       const rows = [headers];
       enrichedStudents.forEach(s => {
           rows.push([
               s.name || 'Unknown',
               s.enrollmentNumber || '—',
               s.schoolName || '—',
               s.department || '—',
               s.year || '—',
               s.latestSubjectAverage ?? '—',
               s.learnerLevel || 'NOT_ASSESSED',
               s.attendanceStatus === 'NOT_RECORDED' ? 'Not recorded' : (s.attendance ?? '—'),
               s.riskLevel || 'NOT_ASSESSED',
               s.latestSGPA > 0 ? s.latestSGPA : '—',
               s.totalBacklogs
           ]);
       });
       exportToCSV('Student_Academic_Report.csv', rows);
    });

    if (!window.Chart) return;
    const tc = '#475569';
    const gc = 'rgba(0,0,0,0.06)';

    // Mean latest subject marks bar.
    const canvasMarks = container.querySelector('#chart-marks');
    if (canvasMarks) {
      if (activeCharts.marks) activeCharts.marks.destroy();
      activeCharts.marks = new window.Chart(canvasMarks.getContext('2d'), {
        type:'bar',
        data:{ labels:departmentRows.filter(row => row.averageMarks !== null).map(row => row.name), datasets:[{ label:'Mean marks %', data:departmentRows.filter(row => row.averageMarks !== null).map(row => row.averageMarks), backgroundColor:'#7c6aff', borderRadius:6 }] },
        options:{ responsive:true,maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true, max:100, grid:{color:gc},ticks:{color:tc,stepSize:20}}, x:{grid:{display:false},ticks:{color:tc,font:{size:10}}} } }
      });
    }

    const canvasAttendance = container.querySelector('#chart-attendance');
    if (canvasAttendance) {
      if (activeCharts.attendance) activeCharts.attendance.destroy();
      activeCharts.attendance = new window.Chart(canvasAttendance.getContext('2d'), {
        type:'bar',
        data:{ labels:departmentRows.filter(row => row.averageAttendance !== null).map(row => row.name), datasets:[{ label:'Mean attendance %', data:departmentRows.filter(row => row.averageAttendance !== null).map(row => row.averageAttendance), backgroundColor:'#34d399', borderRadius:6 }] },
        options:{ responsive:true,maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true, max:100, grid:{color:gc},ticks:{color:tc,stepSize:20}}, x:{grid:{display:false},ticks:{color:tc,font:{size:10}}} } }
      });
    }

    // Issue categories doughnut
    const canvasIssues = container.querySelector('#chart-issues');
    if (canvasIssues) {
      if (activeCharts.issues) activeCharts.issues.destroy();
      activeCharts.issues = new window.Chart(canvasIssues.getContext('2d'), {
        type:'doughnut',
        data:{ labels:Object.keys(issueCats), datasets:[{ data:Object.values(issueCats), backgroundColor:['#7c6aff','#34d399','#fbbf24','#60a5fa','#f87171','#a78bfa'], borderWidth:0 }] },
        options:{ responsive:true,maintainAspectRatio:false,cutout:'65%', plugins:{ legend:{ position:'right',labels:{color:tc,font:{size:11}} } } }
      });
    }

    // Risk level pie
    const riskCounts = cohortAnalysis.riskCounts;
    const canvasRisk = container.querySelector('#chart-risk-dist');
    if (canvasRisk) {
      if (activeCharts.risk) activeCharts.risk.destroy();
      activeCharts.risk = new window.Chart(canvasRisk.getContext('2d'), {
        type:'doughnut',
        data:{ labels:['High','Medium','Low','Not assessed'], datasets:[{ data:[riskCounts.HIGH,riskCounts.MEDIUM,riskCounts.LOW,riskCounts.NOT_ASSESSED], backgroundColor:['#f87171','#fbbf24','#34d399','#94a3b8'], borderWidth:0 }] },
        options:{ responsive:true,maintainAspectRatio:false,cutout:'60%', plugins:{ legend:{ position:'bottom',labels:{color:tc} } } }
      });
    }

    const canvasLearners = container.querySelector('#chart-learners');
    if (canvasLearners) {
      if (activeCharts.learners) activeCharts.learners.destroy();
      activeCharts.learners = new window.Chart(canvasLearners.getContext('2d'), {
        type:'doughnut',
        data:{ labels:['Slow (<50%)','Medium (50–74%)','Advanced (≥75%)','Not assessed'], datasets:[{ data:[cohortAnalysis.learnerCounts.SLOW,cohortAnalysis.learnerCounts.MEDIUM,cohortAnalysis.learnerCounts.ADVANCED,cohortAnalysis.learnerCounts.NOT_ASSESSED], backgroundColor:['#f87171','#fbbf24','#34d399','#94a3b8'], borderWidth:0 }] },
        options:{ responsive:true,maintainAspectRatio:false,cutout:'60%', plugins:{ legend:{ position:'bottom',labels:{color:tc,font:{size:11}} } } }
      });
    }

  } catch (err) {
    (container.querySelector('#analytics-content') || {}).innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error: ${err.message}</h3></div>`;
  }
}

let activeCharts = {};

export function teardown() {
  Object.values(activeCharts).forEach(chart => {
    if (chart && typeof chart.destroy === 'function') {
      chart.destroy();
    }
  });
  activeCharts = {};
}


