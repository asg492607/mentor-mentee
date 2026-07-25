import { getUserProfile } from '/js/auth.js';
import { navigateTo } from '/js/router.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { StudentService, MeetingService, IssueService, TaskService, StatsService } from '/js/services.js';
import { startTour } from '/js/components/tour.js';

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
      localStorage.setItem('lumina_profile', JSON.stringify(user));
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
      <div class="dashboard-container">
        <!-- Quick Actions Bar -->
        <div style="display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap;">
          <a href="#/student/meetings" class="btn btn-sm btn-primary" style="display:flex; align-items:center; gap:6px; border-radius:20px; font-weight:600;">
            <i class="ph ph-calendar-plus" style="font-size:1.1rem;"></i> Request Meeting
          </a>
          <a href="#/chat" class="btn btn-sm btn-secondary" style="display:flex; align-items:center; gap:6px; border-radius:20px; font-weight:600;">
            <i class="ph ph-chat-circle-text" style="font-size:1.1rem; color:var(--accent);"></i> Messages
          </a>
          <a href="#/student/booklet" class="btn btn-sm btn-secondary" style="display:flex; align-items:center; gap:6px; border-radius:20px; font-weight:600;">
            <i class="ph ph-book-open" style="font-size:1.1rem; color:var(--info);"></i> Mentorship Booklet
          </a>
          <a href="#/student/issues" class="btn btn-sm btn-secondary" style="display:flex; align-items:center; gap:6px; border-radius:20px; font-weight:600;">
            <i class="ph ph-warning-circle" style="font-size:1.1rem; color:var(--warning);"></i> Report Issue
          </a>
        </div>

        <!-- Stats -->
        <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:24px;">
          ${[
            { label:'Upcoming Meetings', value: upcomingMeetings.length, color:'var(--info)',    icon:'ph-calendar-check' },
            { label:'Pending Tasks',     value: pendingTasks.length,     color:'var(--warning)', icon:'ph-clipboard-text' },
            { label:'Open Issues',       value: openIssues.length,       color:'var(--danger)',  icon:'ph-warning-circle' },
            { label:'CGPA',              value: fullProfile.cgpa || '—', color:'var(--success)', icon:'ph-graduation-cap' },
          ].map(c => `
            <div class="stat-card" style="display:flex; align-items:center; gap:14px; padding:18px;">
              <div class="stat-icon" style="background:${c.color}18; color:${c.color}; font-size:1.4rem; width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <i class="ph ${c.icon}"></i>
              </div>
              <div>
                <div class="stat-label" style="font-size:0.72rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.04em;">${c.label}</div>
                <div class="stat-value" style="font-size:1.5rem; font-weight:700; color:var(--text-primary); margin-top:2px;">${c.value}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="display:grid;grid-template-columns:300px 1fr;gap:20px;">
          <!-- Left Column -->
          <div style="display:flex;flex-direction:column;gap:16px;">
            <!-- My Mentor Card -->
            <div class="card" style="padding:24px;text-align:center;">
              <p style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:16px;">My Mentor</p>
              ${mentor ? `
                <div class="avatar avatar-xl" style="margin:0 auto 12px; background:var(--accent-gradient); color:#fff; font-weight:700; box-shadow:0 4px 14px rgba(124,106,255,0.3);">${initials}</div>
                <h3 style="font-size:1.05rem;font-weight:700;margin-bottom:4px;color:var(--text-primary);">${mentor.name}</h3>
                <p style="color:var(--text-muted);font-size:0.825rem;margin-bottom:2px;">${mentor.designation || 'Faculty Mentor'}</p>
                <p style="color:var(--text-muted);font-size:0.78rem;margin-bottom:18px;">${mentor.department || ''}</p>
                <button class="btn btn-primary w-full" id="btn-req-meeting" style="border-radius:20px; font-weight:600;">Request Meeting</button>
              ` : `
                <div style="color:var(--text-muted);padding:20px;">
                  <i class="ph ph-user-minus" style="font-size:2.8rem; margin-bottom:8px; opacity:0.4; display:block;"></i>
                  <p style="font-size:0.875rem;">No mentor assigned yet</p>
                </div>
              `}
            </div>

            <!-- Academic Status Card -->
            <div class="card" style="padding:20px;">
              <p style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:14px;">Academic Status</p>
              <div style="display:flex;flex-direction:column;gap:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="color:var(--text-secondary);font-size:0.875rem;">CGPA</span>
                  <strong style="font-size:1.1rem; color:${(fullProfile.cgpa||0)<6?'var(--danger)':(fullProfile.cgpa||0)<7?'var(--warning)':'var(--success)'};">${fullProfile.cgpa || '—'}</strong>
                </div>
                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                    <span style="color:var(--text-secondary);font-size:0.875rem;">Attendance</span>
                    <strong style="color:${(fullProfile.attendance||100)<75?'var(--danger)':(fullProfile.attendance||100)<85?'var(--warning)':'var(--success)'};">${fullProfile.attendance || 0}%</strong>
                  </div>
                  <div class="progress-bar-wrap" style="height:8px; border-radius:4px; background:var(--bg-input);">
                    <div class="progress-bar-fill ${(fullProfile.attendance||0)<75?'fill-danger':(fullProfile.attendance||0)<85?'fill-warning':'fill-success'}" style="width:${fullProfile.attendance||0}%; border-radius:4px;"></div>
                  </div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
                  <span style="color:var(--text-secondary);font-size:0.875rem;">Academic Risk</span>
                  ${riskBadge(fullProfile.riskLevel || risk.riskLevel)}
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column -->
          <div style="display:flex;flex-direction:column;gap:16px;">
            <!-- Upcoming Meetings Card -->
            <div class="card">
              <div class="card-header" style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                <h3 style="font-size:0.95rem; font-weight:700; margin:0;">Upcoming Meetings</h3>
                <a href="#/student/meetings" style="font-size:0.8rem;color:var(--accent);font-weight:600;">View All</a>
              </div>
              ${upcomingMeetings.length === 0
                ? `<div style="padding:28px 20px; text-align:center; color:var(--text-muted);">
                    <i class="ph ph-calendar-x" style="font-size:2.2rem; opacity:0.4; margin-bottom:6px; display:block;"></i>
                    <p style="font-size:0.875rem; font-weight:500; color:var(--text-secondary); margin:0;">No upcoming meetings scheduled</p>
                    <a href="#/student/meetings" class="btn btn-sm btn-ghost mt-2" style="color:var(--accent); font-weight:600; font-size:0.8rem;">+ Request Meeting</a>
                  </div>`
                : upcomingMeetings.slice(0,3).map(m => `
                  <div class="list-item" style="padding:14px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                    <div>
                      <p style="font-weight:600;font-size:0.875rem;margin:0 0 2px;">${m.type}</p>
                      <p style="color:var(--text-muted);font-size:0.78rem;margin:0;">${fmt(m.scheduledAt)}</p>
                    </div>
                    <button class="btn btn-sm btn-primary join-btn" data-id="${m.id}" style="border-radius:16px; padding:4px 14px; font-weight:600;">Join Call</button>
                  </div>
                `).join('')
              }
            </div>

            <!-- Pending Tasks Card -->
            <div class="card">
              <div class="card-header" style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                <h3 style="font-size:0.95rem; font-weight:700; margin:0;">Pending Action Items</h3>
                <a href="#/student/tasks" style="font-size:0.8rem;color:var(--accent);font-weight:600;">View All</a>
              </div>
              ${pendingTasks.length === 0
                ? `<div style="padding:28px 20px; text-align:center; color:var(--text-muted);">
                    <i class="ph ph-check-circle" style="font-size:2.2rem; color:var(--success); opacity:0.6; margin-bottom:6px; display:block;"></i>
                    <p style="font-size:0.875rem; font-weight:500; color:var(--text-secondary); margin:0;">No pending tasks. You're all caught up!</p>
                  </div>`
                : pendingTasks.slice(0,3).map(t => `
                  <div class="list-item" style="padding:14px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                    <div style="flex:1;">
                      <p style="font-weight:600;font-size:0.875rem;margin:0 0 2px;">${t.description}</p>
                      <p style="color:var(--text-muted);font-size:0.78rem;margin:0;">Due: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-IN',{dateStyle:'medium'}) : '—'}</p>
                    </div>
                    <span class="badge badge-warning" style="margin-left:12px; text-transform:capitalize;">${t.status.replace('_',' ').toLowerCase()}</span>
                  </div>
                `).join('')
              }
            </div>
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll('.join-btn').forEach(b => {
      b.addEventListener('click', () => navigateTo(`/meeting-room?id=${b.dataset.id}`));
    });

    container.querySelector('#btn-req-meeting')?.addEventListener('click', () => navigateTo('/student/meetings'));

    const tourSteps = [
      { selector: '.sidebar', title: 'Navigation', desc: 'Use this sidebar to quickly jump between your modules like Meetings, Booklet, and Issues.', position: 'right' },
      { selector: '.stats-grid', title: 'Quick Overview', desc: 'Get a birds-eye view of all your upcoming meetings, pending tasks, and open issues here.', position: 'bottom' },
      { selector: '.card', title: 'Your Mentor', desc: 'Here is your assigned mentor. You can quickly request a meeting with them at any time.', position: 'bottom' }
    ];

    startTour('student_dashboard', tourSteps);

    const tourBtn = document.getElementById('start-tour-btn');
    if (tourBtn) {
      tourBtn.addEventListener('click', () => startTour('student_dashboard', tourSteps, true));
    }

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
