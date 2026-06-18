import { api } from '/js/api.js';
import { navigateTo } from '/js/router.js';
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';

const MOCK = {
  stats: { totalStudents: 18, pendingRequests: 3, openIssues: 2, meetingsThisMonth: 12 },
  pendingMeetings: [
    { id:'m1', studentName:'Ravi Kumar', type:'Academic Issue', description:'Backlog subject help', preferredDate: new Date(Date.now()+86400000*2).toISOString() },
    { id:'m2', studentName:'Priya Singh', type:'Career Guidance', description:'Internship advice needed', preferredDate: null },
  ],
  recentStudents: [
    { id:'s1', name:'Ravi Kumar',  rollNumber:'CS2101', cgpa:7.2, attendance:82, riskLevel:'MEDIUM', department:'Computer Science' },
    { id:'s2', name:'Priya Singh', rollNumber:'CS2102', cgpa:8.9, attendance:91, riskLevel:'LOW',    department:'Computer Science' },
    { id:'s3', name:'Arun Mehta', rollNumber:'CS2103', cgpa:5.1, attendance:61, riskLevel:'HIGH',   department:'Computer Science' },
  ]
};

function riskBadge(r) {
  return `<span class="badge ${{HIGH:'badge-danger',MEDIUM:'badge-warning',LOW:'badge-success'}[r]||'badge-muted'}">${r||'N/A'}</span>`;
}

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}) : 'Flexible';
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/mentor/dashboard')}
      <div class="main-content">
        ${createHeader('Mentor Dashboard', user)}
        <div class="page-content" id="mentor-dash"></div>
      </div>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const { logout } = await import('/js/auth.js'); await logout();
  });

  let data = MOCK;
  try { data = { ...MOCK, ...await api.get('/api/mentor/dashboard') }; } catch {}

  const dash = document.getElementById('mentor-dash');
  const s = data.stats;

  dash.innerHTML = `
    <!-- Stats Row -->
    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:24px;">
      ${[
        { label:'Assigned Students', value: s.totalStudents,    icon:'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z', color:'var(--info)' },
        { label:'Pending Requests',  value: s.pendingRequests, icon:'M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z', color:'var(--warning)' },
        { label:'Open Issues',       value: s.openIssues,      icon:'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z', color:'var(--danger)' },
        { label:'Meetings This Month',value:s.meetingsThisMonth,icon:'M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z', color:'var(--success)' },
      ].map(c => `
        <div class="stat-card">
          <div class="stat-icon" style="background:${c.color}22;">
            <svg viewBox="0 0 24 24" style="fill:${c.color};width:20px;height:20px;"><path d="${c.icon}"/></svg>
          </div>
          <div class="stat-label">${c.label}</div>
          <div class="stat-value">${c.value}</div>
        </div>
      `).join('')}
    </div>

    <!-- Two column layout -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">

      <!-- Pending Meeting Requests -->
      <div class="card">
        <div class="card-header">
          <h3>Pending Requests</h3>
          <a href="#/mentor/meetings" style="font-size:0.8rem;color:var(--accent);">View All</a>
        </div>
        <div id="pending-requests-list">
          ${(data.pendingMeetings||[]).length === 0 ? '<p style="padding:20px;color:var(--text-muted);">No pending requests.</p>' :
            (data.pendingMeetings||[]).map(m => `
              <div class="list-item" style="flex-direction:column;align-items:flex-start;gap:10px;">
                <div style="width:100%;display:flex;justify-content:space-between;align-items:flex-start;">
                  <div>
                    <p style="font-weight:600;font-size:0.875rem;">${m.studentName}</p>
                    <p style="color:var(--text-secondary);font-size:0.8rem;">${m.type} — ${fmtDate(m.preferredDate)}</p>
                    <p style="color:var(--text-muted);font-size:0.78rem;margin-top:4px;">${m.description||''}</p>
                  </div>
                </div>
                <div style="display:flex;gap:8px;width:100%;">
                  <input type="datetime-local" class="form-input" id="sched-${m.id}" style="flex:1;padding:6px 10px;font-size:0.78rem;">
                  <button class="btn btn-sm btn-success approve-btn" data-id="${m.id}">✓ Approve</button>
                  <button class="btn btn-sm btn-danger reject-btn"  data-id="${m.id}">✗ Reject</button>
                </div>
              </div>
            `).join('')
          }
        </div>
      </div>

      <!-- Recent Students -->
      <div class="card">
        <div class="card-header">
          <h3>Students Overview</h3>
          <a href="#/mentor/students" style="font-size:0.8rem;color:var(--accent);">View All</a>
        </div>
        <table class="data-table">
          <thead><tr><th>Name</th><th>CGPA</th><th>Att.</th><th>Risk</th></tr></thead>
          <tbody>
            ${(data.recentStudents||[]).map(s => `
              <tr style="cursor:pointer;" onclick="window.location.hash='/mentor/students'">
                <td>
                  <p style="font-weight:600;font-size:0.875rem;">${s.name}</p>
                  <p style="color:var(--text-muted);font-size:0.75rem;">${s.rollNumber}</p>
                </td>
                <td>${s.cgpa||'—'}</td>
                <td>${s.attendance||0}%</td>
                <td>${riskBadge(s.riskLevel)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Approve / reject handlers
  document.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const scheduledAt = document.getElementById(`sched-${id}`)?.value;
      if (!scheduledAt) { showToast('Please select a date/time first', 'warning'); return; }
      try {
        await api.put(`/api/mentor/meetings/${id}`, { status:'APPROVED', scheduledAt });
        showToast('Meeting approved!', 'success');
      } catch { showToast('Approved (offline)', 'info'); }
      btn.closest('.list-item').remove();
    });
  });

  document.querySelectorAll('.reject-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const reason = prompt('Rejection reason (optional):') || 'No reason provided';
      try {
        await api.put(`/api/mentor/meetings/${id}`, { status:'REJECTED', rejectionReason: reason });
        showToast('Meeting rejected', 'info');
      } catch { showToast('Rejected (offline)', 'info'); }
      btn.closest('.list-item').remove();
    });
  });
}
