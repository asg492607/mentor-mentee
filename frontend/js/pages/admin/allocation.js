import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { StudentService, FacultyService, AllocationService } from '/js/services.js';

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, window.location.hash.slice(1).split('?')[0] || '/admin/allocation')}
      <div class="main-content">
        ${createHeader('Mentor Allocation', user)}
        <div class="page-content" id="alloc-content">
          <div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  let students = [];
  let mentors  = [];
  let selectedStudents = [];
  let selectedMentor  = null;
  let assignedPairs   = [];
  let studentSearch   = '';
  let mentorSearch    = '';

  try {
    [students, mentors] = await Promise.all([
      StudentService.getUnassigned(),
      FacultyService.getAll().then(all => all.filter(f => f.role === 'FACULTY' || f.role === 'MENTOR'))
    ]);
    // Build current allocations
    const allStudents = await StudentService.getAll();
    assignedPairs = allStudents
      .filter(s => s.mentorId)
      .map(s => {
        const mentor = mentors.find(m => m.id === s.mentorId);
        return { studentName: s.name, mentorName: mentor?.name || 'Unknown', department: s.department };
      });
  } catch (err) {
    (container.querySelector('#alloc-content') || {}).innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error: ${err.message}</h3></div>`;
    return;
  }

  function buildUI() {
    (container.querySelector('#alloc-content') || {}).innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
        <!-- Unassigned Students -->
        <div class="card">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
            <h3>Unassigned Students (${students.length})</h3>
            <input type="text" id="search-students" class="form-input" style="padding:4px 8px;font-size:0.8rem;width:120px;" placeholder="Search..." value="${studentSearch}">
          </div>
          <div style="max-height:320px;overflow-y:auto;" id="student-pick">
            ${(() => {
              const fStudents = students.filter(s => !studentSearch || s.name.toLowerCase().includes(studentSearch.toLowerCase()));
              if (students.length === 0) return '<p style="padding:20px;color:var(--text-muted);">All students are assigned.</p>';
              if (fStudents.length === 0) return '<p style="padding:20px;color:var(--text-muted);">No match found.</p>';
              return fStudents.map(s => `
                <div class="list-item student-pick ${selectedStudents.some(x=>x.id===s.id)?'active-pick':''}" data-id="${s.id}"
                  style="cursor:pointer;${selectedStudents.some(x=>x.id===s.id)?'background:var(--accent-light);':''}">
                  <div>
                    <p style="font-weight:600;font-size:0.875rem;">${s.name}</p>
                    <p style="color:var(--text-muted);font-size:0.78rem;">${s.department||'—'} • Year ${s.year||'?'}</p>
                  </div>
                  ${selectedStudents.some(x=>x.id===s.id) ? '<span class="badge badge-accent">Selected</span>' : ''}
                </div>
              `).join('');
            })()}
          </div>
        </div>

        <!-- Available Mentors -->
        <div class="card">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
            <h3>Available Mentors</h3>
            <input type="text" id="search-mentors" class="form-input" style="padding:4px 8px;font-size:0.8rem;width:120px;" placeholder="Search..." value="${mentorSearch}">
          </div>
          <div style="max-height:320px;overflow-y:auto;" id="mentor-pick">
            ${(() => {
              const fMentors = mentors.filter(m => !mentorSearch || m.name.toLowerCase().includes(mentorSearch.toLowerCase()));
              if (fMentors.length === 0) return '<p style="padding:20px;color:var(--text-muted);">No match found.</p>';
              return fMentors.map(m => {
                const capacity = m.maxStudents || 20;
                const used     = m.assignedStudentCount || 0;
                const full     = used >= capacity;
                return `
                  <div class="list-item mentor-pick ${selectedMentor?.id===m.id?'active-pick':''}" data-id="${m.id}"
                    style="cursor:${full?'not-allowed':'pointer'};opacity:${full?0.5:1};${selectedMentor?.id===m.id?'background:var(--accent-light);':''}">
                    <div>
                      <p style="font-weight:600;font-size:0.875rem;">${m.name}</p>
                      <p style="color:var(--text-muted);font-size:0.78rem;">${m.department||'—'}</p>
                    </div>
                    <span class="badge ${full?'badge-danger':'badge-success'}">${used}/${capacity}</span>
                  </div>`;
              }).join('');
            })()}
          </div>
        </div>
      </div>

      <!-- Allocation Actions Grid -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:20px;margin-bottom:20px;">
        
        <!-- Manual Allocation -->
        <div class="card" style="padding:20px;">
            <h4 style="margin-bottom:12px;font-size:1rem;">Manual Allocation</h4>
            <p style="font-size:0.875rem;margin-bottom:8px;color:var(--text-secondary);">Assign specific students to a specific mentor.</p>
            <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;margin-bottom:16px;border:1px solid var(--border);">
              <p style="font-size:0.875rem;margin-bottom:4px;">Students: <strong id="sel-s" style="color:var(--accent);">${selectedStudents.length ? selectedStudents.length + ' Selected' : 'None'}</strong></p>
              <p style="font-size:0.875rem;">Mentor: <strong id="sel-m" style="color:var(--accent);">${selectedMentor?.name||'None'}</strong></p>
            </div>
            <button class="btn btn-primary" style="width:100%;" id="btn-assign" ${(selectedStudents.length===0||!selectedMentor)?'disabled':''}>Assign Selected Students</button>
        </div>

        <!-- Bulk Amount Allocation -->
        <div class="card" style="padding:20px;">
            <h4 style="margin-bottom:12px;font-size:1rem;">Bulk Mentor Allocation</h4>
            <p style="font-size:0.875rem;margin-bottom:8px;color:var(--text-secondary);">Assign a specific number of unassigned students to the selected mentor.</p>
            <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;margin-bottom:16px;border:1px solid var(--border);">
              <p style="font-size:0.875rem;">Selected Mentor: <strong style="color:var(--accent);">${selectedMentor?.name||'None'}</strong></p>
            </div>
            <div style="display:flex; gap:8px;">
                <input type="number" id="bulk-amount" class="form-input" placeholder="Amount (e.g. 5)" style="flex:1;" min="1" value="1">
                <button class="btn btn-primary" id="btn-bulk-assign" ${(!selectedMentor)?'disabled':''}>Assign Amount</button>
            </div>
        </div>

        <!-- Global Auto-Allocate -->
        <div class="card" style="padding:20px;">
            <h4 style="margin-bottom:12px;font-size:1rem;">Global Auto-Allocate</h4>
            <p style="font-size:0.875rem;margin-bottom:16px;color:var(--text-secondary);">Automatically distribute all unassigned students evenly among available mentors.</p>
            <div style="display:flex;flex-direction:column;gap:12px;">
              <select id="auto-dept" class="form-select" style="padding:10px;width:100%;">
                <option value="">All Departments</option>
                ${[...new Set(students.map(s => s.department).filter(Boolean))].map(d => `<option value="${d}">${d}</option>`).join('')}
              </select>
              <button class="btn btn-secondary" style="width:100%;" id="btn-auto">Run Auto-Allocate</button>
            </div>
        </div>
      </div>

      <!-- Current Allocations -->
      <div class="card">
        <div class="card-header"><h3>Current Allocations</h3></div>
        <div style="max-height:300px;overflow-y:auto;">
          ${assignedPairs.length === 0
            ? '<p style="padding:20px;color:var(--text-muted);">No allocations yet.</p>'
            : `<table class="data-table">
                <thead><tr><th>Student</th><th>Mentor</th><th>Department</th></tr></thead>
                <tbody id="alloc-tbody">
                  ${assignedPairs.map(a => `
                    <tr>
                      <td style="font-weight:600;">${a.studentName}</td>
                      <td>${a.mentorName}</td>
                      <td style="color:var(--text-muted);font-size:0.825rem;">${a.department||'—'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>`
          }
        </div>
      </div>
    `;

    // Student picks
    document.querySelectorAll('.student-pick').forEach(el => {
      el.addEventListener('click', () => {
        const student = students.find(s => s.id === el.dataset.id);
        if (selectedStudents.some(x => x.id === student.id)) {
            selectedStudents = selectedStudents.filter(x => x.id !== student.id);
        } else {
            selectedStudents.push(student);
        }
        buildUI();
      });
    });

    // Search inputs (Debounced or handle focus loss)
    const sInput = document.getElementById('search-students');
    if (sInput) {
      sInput.addEventListener('change', e => { studentSearch = e.target.value; buildUI(); });
    }
    const mInput = document.getElementById('search-mentors');
    if (mInput) {
      mInput.addEventListener('change', e => { mentorSearch = e.target.value; buildUI(); });
    }

    // Mentor picks
    document.querySelectorAll('.mentor-pick').forEach(el => {
      el.addEventListener('click', () => {
        const m = mentors.find(m => m.id === el.dataset.id);
        if ((m.assignedStudentCount||0) >= (m.maxStudents||20)) return;
        selectedMentor = m;
        buildUI();
      });
    });

    document.getElementById('btn-assign')?.addEventListener('click', async () => {
      if (selectedStudents.length === 0 || !selectedMentor) return;
      const btn = document.getElementById('btn-assign');
      btn.disabled = true; btn.textContent = 'Assigning...';
      try {
        let successCount = 0;
        for (const s of selectedStudents) {
          await AllocationService.assign(s.id, selectedMentor.id, selectedMentor.name);
          assignedPairs.push({ studentName:s.name, mentorName:selectedMentor.name, department:s.department });
          successCount++;
        }
        const m = mentors.find(m => m.id === selectedMentor.id);
        if (m) m.assignedStudentCount = (m.assignedStudentCount||0) + successCount;
        students = students.filter(s => !selectedStudents.some(x => x.id === s.id));
        selectedStudents = [];
        showToast('Allocated successfully!', 'success');
        buildUI();
      } catch (err) { showToast(err.message, 'error'); btn.disabled=false; btn.textContent='Assign Selected →'; }
    });

    document.getElementById('btn-bulk-assign')?.addEventListener('click', async () => {
      if (!selectedMentor) return;
      const amount = parseInt(document.getElementById('bulk-amount').value || '1', 10);
      if (amount <= 0) return showToast('Please enter a valid amount', 'warning');
      
      const unassignedForDept = students.filter(s => s.department === selectedMentor.department || !selectedMentor.department);
      if (unassignedForDept.length === 0) return showToast('No unassigned students available', 'warning');
      
      const toAssign = unassignedForDept.slice(0, amount);
      const btn = document.getElementById('btn-bulk-assign');
      btn.disabled = true; btn.textContent = 'Assigning...';

      try {
          let successCount = 0;
          for (const s of toAssign) {
              await AllocationService.assign(s.id, selectedMentor.id, selectedMentor.name);
              assignedPairs.push({ studentName: s.name, mentorName: selectedMentor.name, department: s.department });
              successCount++;
          }
          const m = mentors.find(m => m.id === selectedMentor.id);
          if (m) m.assignedStudentCount = (m.assignedStudentCount || 0) + successCount;
          students = students.filter(s => !toAssign.find(t => t.id === s.id));
          selectedStudents = selectedStudents.filter(s => !toAssign.find(t => t.id === s.id));
          showToast(`Successfully assigned ${successCount} student(s) to ${selectedMentor.name}!`, 'success');
          buildUI();
      } catch (err) {
          showToast(err.message, 'error');
          btn.disabled = false; btn.textContent = 'Bulk Assign';
      }
    });

    document.getElementById('btn-auto')?.addEventListener('click', async () => {
      const dept = document.getElementById('auto-dept').value || null;
      if (!confirm(`Are you sure you want to auto-allocate unassigned students${dept ? ` in the ${dept} department` : ''}? This action cannot be easily undone.`)) return;
      const btn = document.getElementById('btn-auto');
      btn.disabled = true; btn.textContent = '...';
      try {
        const results = await AllocationService.autoAllocate(dept);
        showToast(`Auto-allocated ${results.length} student(s)!`, 'success');
        // Reload
        students = await StudentService.getUnassigned(dept);
      } catch (err) { showToast(err.message, 'error'); }
      finally { btn.disabled=false; btn.textContent='Auto'; buildUI(); }
    });
  }

  buildUI();
}
