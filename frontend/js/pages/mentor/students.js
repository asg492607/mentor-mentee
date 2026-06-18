import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { StudentService, StatsService } from '/js/services.js';

function riskBadge(r) {
  const cls = {HIGH:'badge-danger',MEDIUM:'badge-warning',LOW:'badge-success'}[r]||'badge-muted';
  return `<span class="badge ${cls}">${r||'N/A'}</span>`;
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/mentor/students')}
      <div class="main-content">
        ${createHeader('My Students', user)}
        <div class="page-content">
          <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
            <div class="search-box" style="flex:1;min-width:200px;">
              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
              <input type="text" id="s-search" placeholder="Search by name or roll number...">
            </div>
            ${['ALL','HIGH','MEDIUM','LOW'].map((r,i) =>
              `<button class="btn btn-sm ${i===0?'btn-primary':'btn-secondary'} rf" data-r="${r}">${r}</button>`
            ).join('')}
          </div>

          <div id="students-wrap">
            <div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>
          </div>

          <div id="student-detail" style="display:none;margin-top:16px;" class="card" style="padding:24px;"></div>
        </div>
      </div>
    </div>
  `;

  let students = [];
  let pendingStudents = [];
  let search = '';
  let riskFilter = 'ALL';

  try {
    const [assigned, unassigned] = await Promise.all([
      StudentService.getByMentor(user.id),
      StudentService.getUnassigned(user.department)
    ]);
    
    students = assigned.map(s => {
      if (!s.riskLevel) return { ...s, ...StatsService.computeRisk(s) };
      return s;
    });

    // Only show unapproved students in the pending queue
    pendingStudents = unassigned.filter(s => !s.isApproved);
  } catch (err) {
    showToast('Error loading students: ' + err.message, 'error');
  }

  function render_table() {
    const wrap = document.getElementById('students-wrap');
    let list = students;
    if (riskFilter !== 'ALL') list = list.filter(s => s.riskLevel === riskFilter);
    if (search) list = list.filter(s => s.name?.toLowerCase().includes(search) || s.rollNumber?.toLowerCase().includes(search));

    if (!list.length && !pendingStudents.length) {
      wrap.innerHTML = `<div class="empty-state card" style="padding:48px;">
        <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
        <h3>${students.length === 0 ? 'No students assigned yet' : 'No students match filter'}</h3>
      </div>`;
      return;
    }

    let pendingHtml = '';
    if (pendingStudents.length > 0) {
      pendingHtml = `
      <div class="card" style="margin-bottom:24px;border-color:var(--warning);">
        <div class="card-header" style="background:var(--warning-light);border-bottom:1px solid var(--warning);">
          <h3 style="color:var(--warning);">Pending Students (Department: ${user.department || 'All'})</h3>
        </div>
        <table class="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Year</th><th>Action</th></tr></thead>
          <tbody>
            ${pendingStudents.map(s => `
              <tr>
                <td><strong>${s.name}</strong></td>
                <td>${s.email}</td>
                <td>${s.year ? `Y${s.year}` : '—'}</td>
                <td><button class="btn btn-xs btn-primary btn-approve-student" data-id="${s.id}">Approve & Assign to me</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      `;
    }

    let assignedHtml = '';
    if (list.length > 0) {
      assignedHtml = `<div class="card">
        <div class="card-header"><h3>My Assigned Students</h3></div>
      <table class="data-table">
        <thead><tr><th>Student</th><th>Dept</th><th>Year</th><th>CGPA</th><th>Attendance</th><th>Risk</th><th></th></tr></thead>
        <tbody>
          ${list.map(s => `
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:10px;">
                  <div class="avatar avatar-sm">${(s.name||'?')[0]}</div>
                  <div>
                    <p style="font-weight:600;font-size:0.875rem;">${s.name || '—'}</p>
                    <p style="color:var(--text-muted);font-size:0.75rem;">${s.rollNumber || ''}</p>
                  </div>
                </div>
              </td>
              <td style="font-size:0.825rem;">${s.department || '—'}</td>
              <td>${s.year ? `Y${s.year}` : '—'}</td>
              <td style="font-weight:600;color:${(s.cgpa||0)<6?'var(--danger)':(s.cgpa||0)<7?'var(--warning)':'var(--success)'};">${s.cgpa || '—'}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px;">
                  <div style="flex:1;max-width:60px;" class="progress-bar-wrap">
                    <div class="progress-bar-fill ${(s.attendance||0)<75?'fill-danger':(s.attendance||0)<85?'fill-warning':'fill-success'}" style="width:${s.attendance||0}%"></div>
                  </div>
                  <span style="font-size:0.78rem;color:var(--text-muted);">${s.attendance||0}%</span>
                </div>
              </td>
              <td>${riskBadge(s.riskLevel)}</td>
              <td><button class="btn btn-xs btn-secondary view-btn" data-id="${s.id}">View</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
    }

    wrap.innerHTML = pendingHtml + assignedHtml;

    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = students.find(x => x.id === btn.dataset.id);
        const panel = document.getElementById('student-detail');
        panel.style.display = 'block';
        panel.style.padding = '24px';
        panel.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
            <h3 style="font-size:1rem;font-weight:600;margin:0;">${s.name}</h3>
            <button class="btn btn-sm btn-secondary" id="student-detail-close">Close</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
            ${[['Email',s.email||'—'],['Roll No',s.rollNumber||'—'],['Department',s.department||'—'],['Year',s.year?`Year ${s.year}`:'—'],['CGPA',s.cgpa||'—'],['Attendance',`${s.attendance||0}%`],['Interests',s.interests||'—'],['Skills',s.skills||'—'],['Career Goal',s.careerGoal||'—']].map(([l,v]) => `
              <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:12px;">
                <p style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px;">${l}</p>
                <p style="font-weight:600;font-size:0.825rem;word-break:break-word;">${v}</p>
              </div>
            `).join('')}
          </div>
          <div style="display:flex;gap:8px;">
            ${riskBadge(s.riskLevel)}
            <span style="color:var(--text-muted);font-size:0.825rem;">Risk Score: ${s.riskScore||0}/100</span>
          </div>
        `;
        document.getElementById('student-detail-close').addEventListener('click', () => {
          panel.style.display = 'none';
        });
        panel.scrollIntoView({ behavior: 'smooth' });
      });
    });

    document.querySelectorAll('.btn-approve-student').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        btn.disabled = true; btn.textContent = '...';
        try {
          // Approve and assign in parallel
          await Promise.all([
            StudentService.approve(id),
            StudentService.assignMentor(id, user.id)
          ]);
          // Increment assigned count for mentor locally/remote could be handled via cloud functions, but we just want UI to work
          showToast('Student approved and assigned!', 'success');
          setTimeout(() => render(container), 1000); // refresh page
        } catch (err) {
          showToast(err.message, 'error');
          btn.disabled = false; btn.textContent = 'Approve';
        }
      });
    });
  }

  document.getElementById('s-search').addEventListener('input', e => { search = e.target.value.toLowerCase(); render_table(); });
  document.querySelectorAll('.rf').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rf').forEach(b => b.className = 'btn btn-sm btn-secondary rf');
      btn.className = 'btn btn-sm btn-primary rf';
      riskFilter = btn.dataset.r;
      render_table();
    });
  });

  render_table();
}
