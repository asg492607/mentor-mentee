import { getUserProfile } from '/js/auth.js';
import { navigateTo } from '/js/router.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { StudentService, MeetingService, IssueService, TaskService, StatsService } from '/js/services.js';

function fmt(iso) {
  return iso ? new Date(iso).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' }) : '—';
}

function riskBadge(r) {
  const cls = {HIGH:'badge-danger',MEDIUM:'badge-warning',LOW:'badge-success'}[r] || 'badge-muted';
  return `<span class="badge ${cls}">${r || 'N/A'}</span>`;
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/student/dashboard')}
      <div class="main-content">
        ${createHeader('Dashboard', user)}
        <div class="page-content" id="dash-content">
          <div style="display:flex;align-items:center;justify-content:center;height:300px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  try {
    // Load all data from Firestore directly
    const [profile, meetings, issues, tasks] = await Promise.all([
      StudentService.get(user.id),
      MeetingService.getByStudent(user.id),
      IssueService.getByStudent(user.id),
      TaskService.getByStudent(user.id)
    ]);

    const fullProfile = profile || user;
    if (profile) {
      Object.assign(user, profile);
      localStorage.setItem('mentorOS_profile', JSON.stringify(user));
    }
    // Update risk if needed
    const risk = StatsService.computeRisk(fullProfile);

    const upcomingMeetings = meetings.filter(m => (m.status === 'APPROVED' || m.status === 'ONGOING') && (m.status === 'ONGOING' || (m.scheduledAt && new Date(m.scheduledAt) > new Date())));
    const pendingTasks     = tasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS');
    const openIssues       = issues.filter(i => i.status === 'OPEN');

    // Load mentor info if assigned
    let mentor = null;
    if (fullProfile.mentorId) {
      const { FacultyService } = await import('/js/services.js');
      mentor = await FacultyService.get(fullProfile.mentorId);
    }

    const initials = (mentor?.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const content = container.querySelector('#dash-content');
    if (!content) return;

    content.innerHTML = `
      <!-- Stats -->
      <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:24px;">
        ${[
          { label:'Upcoming Meetings', value: upcomingMeetings.length, color:'var(--info)',    icon:'M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z' },
          { label:'Pending Tasks',     value: pendingTasks.length,     color:'var(--warning)', icon:'M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z' },
          { label:'Open Issues',       value: openIssues.length,       color:'var(--danger)',  icon:'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z' },
          { label:'CGPA',              value: fullProfile.cgpa || '—', color:'var(--success)', icon:'M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z' },
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

      <div style="display:grid;grid-template-columns:280px 1fr;gap:20px;">
        <!-- My Mentor -->
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div class="card" style="padding:24px;text-align:center;">
            <p style="font-size:0.72rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:16px;">My Mentor</p>
            ${mentor ? `
              <div class="avatar avatar-xl" style="margin:0 auto 12px;">${initials}</div>
              <h3 style="font-size:1rem;font-weight:700;margin-bottom:4px;">${mentor.name}</h3>
              <p style="color:var(--text-muted);font-size:0.825rem;margin-bottom:4px;">${mentor.designation || 'Faculty'}</p>
              <p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:16px;">${mentor.department || ''}</p>
              <button class="btn btn-primary w-full" id="btn-req-meeting">Request Meeting</button>
            ` : `
              <div style="color:var(--text-muted);padding:20px;">
                <svg viewBox="0 0 24 24" style="width:48px;height:48px;fill:currentColor;margin-bottom:8px;opacity:0.4;"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                <p style="font-size:0.875rem;">No mentor assigned yet</p>
              </div>
            `}
          </div>

          <div class="card" style="padding:20px;">
            <p style="font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">Academic Status</p>
            <div style="display:flex;flex-direction:column;gap:10px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:var(--text-secondary);font-size:0.875rem;">CGPA</span>
                <strong style="color:${(fullProfile.cgpa||0)<6?'var(--danger)':(fullProfile.cgpa||0)<7?'var(--warning)':'var(--success)'};">${fullProfile.cgpa || '—'}</strong>
              </div>
              <div>
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                  <span style="color:var(--text-secondary);font-size:0.875rem;">Attendance</span>
                  <strong style="color:${(fullProfile.attendance||100)<75?'var(--danger)':(fullProfile.attendance||100)<85?'var(--warning)':'var(--success)'};">${fullProfile.attendance || 0}%</strong>
                </div>
                <div class="progress-bar-wrap">
                  <div class="progress-bar-fill ${(fullProfile.attendance||0)<75?'fill-danger':(fullProfile.attendance||0)<85?'fill-warning':'fill-success'}" style="width:${fullProfile.attendance||0}%"></div>
                </div>
              </div>
              <div style="display:flex;justify-content:space-between;"><span style="color:var(--text-secondary);font-size:0.875rem;">Risk</span>${riskBadge(fullProfile.riskLevel || risk.riskLevel)}</div>
            </div>
          </div>
        </div>

        <!-- Right column -->
        <div style="display:flex;flex-direction:column;gap:16px;">
          <!-- Upcoming Meetings -->
          <div class="card">
            <div class="card-header">
              <h3>Upcoming Meetings</h3>
              <a href="#/student/meetings" style="font-size:0.8rem;color:var(--accent);">View All</a>
            </div>
            ${upcomingMeetings.length === 0
              ? '<p style="padding:20px;color:var(--text-muted);font-size:0.875rem;">No upcoming meetings.</p>'
              : upcomingMeetings.slice(0,3).map(m => `
                <div class="list-item">
                  <div>
                    <p style="font-weight:600;font-size:0.875rem;">${m.type}</p>
                    <p style="color:var(--text-muted);font-size:0.78rem;">${fmt(m.scheduledAt)}</p>
                  </div>
                  <button class="btn btn-sm btn-primary join-btn" data-id="${m.id}">Join</button>
                </div>
              `).join('')
            }
          </div>

          <!-- Pending Tasks -->
          <div class="card">
            <div class="card-header">
              <h3>Pending Tasks</h3>
              <a href="#/student/tasks" style="font-size:0.8rem;color:var(--accent);">View All</a>
            </div>
            ${pendingTasks.length === 0
              ? '<p style="padding:20px;color:var(--text-muted);font-size:0.875rem;">No pending tasks. Great work!</p>'
              : pendingTasks.slice(0,3).map(t => `
                <div class="list-item">
                  <div style="flex:1;">
                    <p style="font-weight:600;font-size:0.875rem;">${t.description}</p>
                    <p style="color:var(--text-muted);font-size:0.78rem;">Due: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-IN',{dateStyle:'medium'}) : '—'}</p>
                    <div class="progress-bar-wrap" style="margin-top:6px;"><div class="progress-bar-fill" style="width:${t.progress||0}%"></div></div>
                  </div>
                  <span class="badge badge-warning" style="margin-left:12px;">${t.status.replace('_',' ')}</span>
                </div>
              `).join('')
            }
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll('.join-btn').forEach(b => {
      b.addEventListener('click', () => navigateTo(`/meeting-room?id=${b.dataset.id}`));
    });

    container.querySelector('#btn-req-meeting')?.addEventListener('click', () => navigateTo('/student/meetings'));

  } catch (err) {
    console.error('Dashboard load error:', err);
    const content = container.querySelector('#dash-content');
    if (content) content.innerHTML = `
      <div class="empty-state">
        <h3 style="color:var(--danger);">Failed to load dashboard</h3>
        <p>${err.message}</p>
      </div>
    `;
    showToast('Failed to load dashboard: ' + err.message, 'error');
  }
}
