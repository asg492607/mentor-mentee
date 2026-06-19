import { getUserProfile } from '/js/auth.js';
import { navigateTo } from '/js/router.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { MeetingService, NotificationService, TaskService } from '/js/services.js';

function statusBadge(s) {
  const cls = {REQUESTED:'badge-warning',APPROVED:'badge-success',ONGOING:'badge-info',REJECTED:'badge-danger',COMPLETED:'badge-muted',CANCELLED:'badge-muted'}[s]||'badge-muted';
  return `<span class="badge ${cls}">${s}</span>`;
}
function fmt(iso) {
  return iso ? new Date(iso).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}) : '—';
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/mentor/meetings')}
      <div class="main-content">
        ${createHeader('Meetings', user)}
        <div class="page-content">
          <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
            <button class="btn btn-primary" id="btn-schedule-meeting">+ Schedule Meeting</button>
          </div>
          <div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:20px;" id="tab-bar">
            ${['Pending','Approved','Completed','All'].map((t,i) =>
              `<button class="tab-btn ${i===0?'tab-active':''}" data-tab="${t.toLowerCase()}"
                style="padding:10px 20px;background:none;border:none;border-bottom:2px solid ${i===0?'var(--accent)':'transparent'};
                color:${i===0?'var(--accent)':'var(--text-secondary)'};font-weight:500;cursor:pointer;font-size:0.875rem;transition:all 0.2s;">
                ${t}
              </button>`
            ).join('')}
          </div>
          <div id="meetings-panel">
            <div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>
          </div>
        </div>
      </div>
    </div>
  `;

  let meetings = [];
  let students = [];
  let activeTab = 'pending';

  try {
    const [mList, sList] = await Promise.all([
      MeetingService.getByMentor(user.id),
      import('/js/services.js').then(s => s.StudentService.getByMentor(user.id))
    ]);
    meetings = mList;
    students = sList;
  } catch (err) {
    showToast('Error loading meetings: ' + err.message, 'error');
  }

  function renderTab() {
    const panel = container.querySelector('#meetings-panel');
    if (!panel) return; // Prevent null errors if component is unmounted
    let list = meetings;
    if (activeTab === 'pending')   list = meetings.filter(m => m.status === 'REQUESTED');
    if (activeTab === 'approved')  list = meetings.filter(m => m.status === 'APPROVED');
    if (activeTab === 'completed') list = meetings.filter(m => m.status === 'COMPLETED');

    if (!list.length) {
      panel.innerHTML = `<div class="empty-state card" style="padding:48px;">
        <svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
        <h3>No meetings in this category</h3>
      </div>`;
      return;
    }

    panel.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;">
      ${list.map(m => `
        <div class="card" style="padding:20px;" id="card-${m.id}">
          <div style="display:flex;gap:16px;align-items:flex-start;">
            <div class="avatar avatar-sm">${(m.studentName||'?')[0]}</div>
            <div style="flex:1;">
              <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:6px;">
                <strong style="font-size:0.9rem;">${m.studentName || '—'}</strong>
                <span class="badge badge-accent">${m.type}</span>
                ${statusBadge(m.status)}
              </div>
              <p style="color:var(--text-secondary);font-size:0.825rem;margin-bottom:6px;">${m.description || ''}</p>
              <p style="color:var(--text-muted);font-size:0.78rem;">
                ${m.scheduledAt ? 'Scheduled: ' + fmt(m.scheduledAt) : m.preferredDate ? 'Preferred: ' + fmt(m.preferredDate) : 'No date set'}
              </p>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0;">
              ${m.status === 'REQUESTED' ? `
                <input type="datetime-local" class="form-input sched-i" data-id="${m.id}" style="width:210px;padding:7px 10px;font-size:0.8rem;">
                <div style="display:flex;gap:8px;">
                  <button class="btn btn-sm btn-success appr-btn" data-id="${m.id}" data-sid="${m.studentId}">✓ Approve</button>
                  <button class="btn btn-sm btn-danger  rej-btn"  data-id="${m.id}" data-sid="${m.studentId}">✗ Reject</button>
                </div>
              ` : (m.status === 'APPROVED' || m.status === 'ONGOING') ? `
                <button class="btn btn-sm btn-primary join-btn" data-id="${m.id}">${m.status === 'ONGOING' ? '● Join Live' : 'Join Meeting'}</button>
                <button class="btn btn-sm btn-secondary note-btn" data-id="${m.id}">Add Notes</button>
              ` : m.status === 'COMPLETED' ? `
                <button class="btn btn-sm btn-secondary note-btn" style="margin-bottom:8px;" data-id="${m.id}">View Notes</button>
                <button class="btn btn-sm btn-primary report-btn" data-id="${m.id}">Download Report</button>
              ` : ''}
            </div>
          </div>

          <!-- Notes form (hidden) -->
          <div id="notes-${m.id}" style="display:none;" class="inline-form" style="margin-top:12px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div class="form-group"><label class="form-label">Problem Discussed</label><textarea class="form-textarea np" style="min-height:60px;" placeholder="What was discussed?">${m.notes?.problem||''}</textarea></div>
              <div class="form-group"><label class="form-label">Advice Given</label><textarea class="form-textarea na" style="min-height:60px;" placeholder="Guidance provided?">${m.notes?.advice||''}</textarea></div>
              <div class="form-group" style="grid-column:1/-1;"><label class="form-label">Summary</label><textarea class="form-textarea ns" style="min-height:60px;" placeholder="Meeting summary...">${m.notes?.summary||''}</textarea></div>
              <div class="form-group" style="grid-column:1/-1;"><label class="form-label">Action Items (one per line)</label><textarea class="form-textarea nt" style="min-height:60px;" placeholder="Task 1&#10;Task 2">${(m.notes?.tasks||[]).join('\n')}</textarea></div>
            </div>
            <div style="display:flex;gap:8px;margin-top:8px;">
              <button class="btn btn-sm btn-primary save-note-btn" data-id="${m.id}" data-sid="${m.studentId}">Save Notes</button>
              <button class="btn btn-sm btn-secondary cancel-note-btn" data-id="${m.id}">Cancel</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>`;

    // Approve
    document.querySelectorAll('.appr-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const scheduledAt = document.querySelector(`.sched-i[data-id="${btn.dataset.id}"]`)?.value;
        if (!scheduledAt) { showToast('Select date/time first', 'warning'); return; }
        try {
          await MeetingService.update(btn.dataset.id, { status:'APPROVED', scheduledAt });
          if (btn.dataset.sid) {
            await NotificationService.create({
              userId: btn.dataset.sid, type:'MEETING_APPROVED',
              title:'Meeting Approved!', message:`Scheduled for ${fmt(scheduledAt)}`, relatedId:btn.dataset.id
            });
          }
          meetings.find(m => m.id === btn.dataset.id).status = 'APPROVED';
          showToast('Meeting approved!', 'success'); renderTab();
        } catch (err) { showToast(err.message, 'error'); }
      });
    });

    // Reject
    document.querySelectorAll('.rej-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const reason = prompt('Enter rejection reason (optional):', 'Unavailable at the requested time') ?? '';
        if (reason === null) return; // user cancelled prompt
        try {
          await MeetingService.update(btn.dataset.id, { status:'REJECTED', rejectionReason: reason || 'Unavailable at the requested time' });
          if (btn.dataset.sid) {
            await NotificationService.create({
              userId: btn.dataset.sid, type:'MEETING_REJECTED',
              title:'Meeting Request Declined',
              message: reason ? `Reason: ${reason}` : 'The mentor is unavailable at the requested time.',
              relatedId: btn.dataset.id
            });
          }
          meetings.find(m => m.id === btn.dataset.id).status = 'REJECTED';
          showToast('Meeting rejected', 'info'); renderTab();
        } catch (err) { showToast(err.message, 'error'); }
      });
    });

    // Join
    document.querySelectorAll('.join-btn').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(`/meeting-room?id=${btn.dataset.id}`));
    });

    // Notes panel toggle
    document.querySelectorAll('.note-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = document.getElementById(`notes-${btn.dataset.id}`);
        w.style.display = w.style.display === 'none' ? 'block' : 'none';
      });
    });

    // Report Download
    document.querySelectorAll('.report-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const m = meetings.find(x => x.id === btn.dataset.id);
        if(!m) return;
        const w = window.open('', '_blank');
        w.document.write(`
          <html>
            <head>
              <title>Meeting Report - ${m.studentName}</title>
              <style>
                body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 40px auto; padding: 0 20px; }
                h1 { border-bottom: 2px solid #eaeaea; padding-bottom: 10px; }
                .header-info { display: grid; grid-template-columns: 1fr 1fr; background: #f9f9fb; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
                .header-info p { margin: 5px 0; }
                h3 { margin-top: 30px; color: #444; }
                .box { border: 1px solid #e1e4e8; padding: 15px; border-radius: 6px; margin-bottom: 15px; background: #fff; }
                ul { padding-left: 20px; }
                @media print { body { margin: 0; padding: 20px; } .no-print { display: none; } }
              </style>
            </head>
            <body>
              <div class="no-print" style="text-align:right; margin-bottom: 20px;">
                <button onclick="window.print()" style="padding: 8px 16px; background: #0066cc; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Print / Save PDF</button>
              </div>
              <h1>Meeting Report</h1>
              <div class="header-info">
                <div>
                  <p><strong>Student:</strong> ${m.studentName}</p>
                  <p><strong>Mentor:</strong> ${m.mentorName}</p>
                </div>
                <div>
                  <p><strong>Date:</strong> ${new Date(m.scheduledAt || m.updatedAt).toLocaleString()}</p>
                  <p><strong>Type:</strong> ${m.type}</p>
                </div>
              </div>
              <p><strong>Description/Topic:</strong> ${m.description}</p>
              
              <h3>Discussion Summary</h3>
              <div class="box">${(m.notes?.summary || 'No summary provided').replace(/\n/g, '<br>')}</div>
              
              <h3>Problem Identified</h3>
              <div class="box">${(m.notes?.problem || 'None').replace(/\n/g, '<br>')}</div>
              
              <h3>Advice & Guidance</h3>
              <div class="box">${(m.notes?.advice || 'None').replace(/\n/g, '<br>')}</div>
              
              <h3>Action Items (Tasks)</h3>
              <div class="box">
                ${m.notes?.tasks?.length ? `<ul>${m.notes.tasks.map(t => `<li>${t}</li>`).join('')}</ul>` : 'No action items.'}
              </div>
            </body>
          </html>
        `);
        w.document.close();
      });
    });

    // Save notes
    document.querySelectorAll('.save-note-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const card = document.getElementById(`card-${btn.dataset.id}`);
        const notes = {
          problem: card.querySelector('.np')?.value || '',
          advice:  card.querySelector('.na')?.value || '',
          summary: card.querySelector('.ns')?.value || '',
          tasks:   card.querySelector('.nt')?.value?.split('\n').filter(Boolean) || []
        };
        try {
          await MeetingService.addNotes(btn.dataset.id, notes);
          // Create action items from tasks list
          if (btn.dataset.sid && notes.tasks.length) {
            for (const desc of notes.tasks) {
              await TaskService.create({
                studentId: btn.dataset.sid,
                mentorId: user.id,
                description: desc,
                category: 'Meeting Action',
                dueDate: null
              });
            }
          }
          showToast('Notes saved!', 'success');
          document.getElementById(`notes-${btn.dataset.id}`).style.display = 'none';
          meetings.find(m => m.id === btn.dataset.id).status = 'COMPLETED';
          renderTab();
        } catch (err) { showToast(err.message, 'error'); }
      });
    });

    document.querySelectorAll('.cancel-note-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById(`notes-${btn.dataset.id}`).style.display = 'none';
      });
    });
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => { b.style.borderBottomColor='transparent'; b.style.color='var(--text-secondary)'; });
      btn.style.borderBottomColor = 'var(--accent)'; btn.style.color = 'var(--accent)';
      activeTab = btn.dataset.tab; renderTab();
    });
  });

  renderTab();

  // Schedule Modal
  const modalHtml = `
    <div id="schedule-modal" class="modal-backdrop" style="display:none;z-index:9999;">
      <div class="modal">
        <div class="modal-header">
          <h3>Schedule Meeting</h3>
          <button class="btn btn-ghost btn-sm" id="close-sched-modal">✕</button>
        </div>
        <div class="modal-body">
          <form id="sched-form">
            <div class="form-group">
              <label class="form-label">Student(s)</label>
              <select id="sched-student" class="form-select" required>
                <option value="">Select Student</option>
                <option value="ALL" style="font-weight:bold;color:var(--accent);">Group Meeting (All Assigned Students)</option>
                ${students.map(s => `<option value="${s.id}">${s.name} (${s.rollNumber||'N/A'})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Type</label>
              <select id="sched-type" class="form-select" required>
                <option>Academic Issue</option><option>Career Guidance</option><option>Project Guidance</option><option>General Check-in</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Topic / Description</label>
              <input type="text" id="sched-desc" class="form-input" required placeholder="What will this meeting cover?">
            </div>
            <div class="form-group">
              <label class="form-label">Date & Time</label>
              <input type="datetime-local" id="sched-date" class="form-input" required>
            </div>
            <div class="modal-footer mt-4" style="border:none;padding:0;margin-top:24px;justify-content:flex-end;">
              <button type="button" class="btn btn-secondary" id="cancel-sched-modal">Cancel</button>
              <button type="submit" class="btn btn-primary" id="btn-submit-sched">Schedule</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', modalHtml);

  const schedModal = container.querySelector('#schedule-modal');
  container.querySelector('#btn-schedule-meeting').addEventListener('click', () => {
    // Re-populate students dynamically just in case
    const studentSelect = container.querySelector('#sched-student');
    studentSelect.innerHTML = '<option value="">Select Student</option><option value="ALL" style="font-weight:bold;color:var(--accent);">Group Meeting (All Assigned Students)</option>' + 
      students.map(s => `<option value="${s.id}">${s.name} (${s.rollNumber||'N/A'})</option>`).join('');
    schedModal.style.display = 'flex';
  });
  container.querySelector('#close-sched-modal').addEventListener('click', () => schedModal.style.display = 'none');
  container.querySelector('#cancel-sched-modal').addEventListener('click', () => schedModal.style.display = 'none');

  container.querySelector('#sched-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = container.querySelector('#btn-submit-sched');
    btn.disabled = true; btn.textContent = 'Scheduling...';
    try {
      const studentId = container.querySelector('#sched-student').value;
      const type = container.querySelector('#sched-type').value;
      const desc = container.querySelector('#sched-desc').value;
      const date = container.querySelector('#sched-date').value;

      if (studentId === 'ALL') {
        // Group Meeting
        const mId = await MeetingService.create({
          mentorId: user.id, mentorName: user.name,
          studentId: 'ALL', studentName: 'Group Meeting',
          isGroup: true, type, description: desc, scheduledAt: date,
          status: 'APPROVED'
        });
        meetings.unshift({ id: mId, studentName: 'Group Meeting (All)', type, description: desc, scheduledAt: date, status: 'APPROVED' });
        
        // Notify all students
        for (const s of students) {
          await NotificationService.create({
            userId: s.id, type: 'MEETING_APPROVED',
            title: 'New Group Meeting', message: `Scheduled for ${fmt(date)}: ${type}`, relatedId: mId
          });
        }
      } else {
        // Individual
        const student = students.find(s => s.id === studentId);
        const mId = await MeetingService.create({
          mentorId: user.id, mentorName: user.name,
          studentId: student.id, studentName: student.name,
          type, description: desc, scheduledAt: date,
          status: 'APPROVED' // Pre-approved since mentor created it
        });
        meetings.unshift({ id: mId, studentId, studentName: student.name, type, description: desc, scheduledAt: date, status: 'APPROVED' });
        
        await NotificationService.create({
          userId: student.id, type: 'MEETING_APPROVED',
          title: 'Meeting Scheduled', message: `Your mentor scheduled a meeting for ${fmt(date)}`, relatedId: mId
        });
      }

      showToast('Meeting scheduled successfully!', 'success');
      schedModal.style.display = 'none';
      e.target.reset();
      renderTab();
    } catch(err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Schedule';
    }
  });
}
