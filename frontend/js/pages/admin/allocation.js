import { api } from '/js/api.js';
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';

const MOCK_STUDENTS = [
  { id:'s1', name:'Arun Mehta',  department:'Computer Science', year:2, mentorId: null },
  { id:'s2', name:'Dev Nair',    department:'Computer Science', year:3, mentorId: null },
  { id:'s3', name:'Priya Roy',   department:'Electronics',      year:2, mentorId: null },
];

const MOCK_MENTORS = [
  { id:'m1', name:'Dr. Shah',   department:'Computer Science', assignedStudentCount:18, maxStudents:20 },
  { id:'m2', name:'Dr. Gupta',  department:'Computer Science', assignedStudentCount:15, maxStudents:20 },
  { id:'m3', name:'Dr. Sharma', department:'Electronics',      assignedStudentCount:17, maxStudents:20 },
];

const MOCK_ALLOC = [
  { studentName:'Ravi Kumar',  mentorName:'Dr. Shah',  department:'Computer Science' },
  { studentName:'Priya Singh', mentorName:'Dr. Gupta', department:'Computer Science' },
];

export async function render(container) {
  const user = getUserProfile();
  let students = MOCK_STUDENTS;
  let mentors  = MOCK_MENTORS;
  let allocs   = MOCK_ALLOC;
  let selectedStudent = null;
  let selectedMentor  = null;

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/admin/allocation')}
      <div class="main-content">
        ${createHeader('Mentor Allocation', user)}
        <div class="page-content">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
            <!-- Unassigned Students -->
            <div class="card">
              <div class="card-header"><h3>Unassigned Students</h3></div>
              <div id="student-pick-list" style="max-height:300px;overflow-y:auto;"></div>
            </div>
            <!-- Available Mentors -->
            <div class="card">
              <div class="card-header"><h3>Available Mentors</h3></div>
              <div id="mentor-pick-list" style="max-height:300px;overflow-y:auto;"></div>
            </div>
          </div>

          <!-- Assign Button -->
          <div class="card" style="padding:20px;margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:16px;">
              <div style="flex:1;">
                <p style="font-size:0.875rem;">
                  <span style="color:var(--text-muted);">Selected Student:</span>
                  <strong id="sel-student-label" style="color:var(--accent);">None</strong>
                </p>
                <p style="font-size:0.875rem;">
                  <span style="color:var(--text-muted);">Selected Mentor:</span>
                  <strong id="sel-mentor-label" style="color:var(--accent);">None</strong>
                </p>
              </div>
              <button class="btn btn-primary" id="btn-assign">Assign →</button>
              <div style="border-left:1px solid var(--border);padding-left:16px;">
                <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px;">Auto-allocate</p>
                <div style="display:flex;gap:8px;align-items:center;">
                  <select id="auto-dept" class="form-select" style="padding:6px 10px;font-size:0.8rem;">
                    <option value="">All Depts</option>
                    <option>Computer Science</option><option>Information Technology</option><option>Electronics</option><option>Mechanical</option>
                  </select>
                  <button class="btn btn-secondary btn-sm" id="btn-auto">Auto</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Current Allocations -->
          <div class="card">
            <div class="card-header"><h3>Current Allocations</h3></div>
            <table class="data-table">
              <thead><tr><th>Student</th><th>Mentor</th><th>Department</th></tr></thead>
              <tbody id="alloc-table-body">
                ${allocs.map(a => `
                  <tr>
                    <td style="font-weight:600;">${a.studentName}</td>
                    <td>${a.mentorName}</td>
                    <td style="color:var(--text-muted);font-size:0.825rem;">${a.department}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const { logout } = await import('/js/auth.js'); await logout();
  });

  try {
    const [s, m] = await Promise.allSettled([
      api.get('/api/admin/unassigned-students'),
      api.get('/api/admin/mentors')
    ]);
    if (s.status === 'fulfilled' && s.value.length) students = s.value;
    if (m.status === 'fulfilled' && m.value.length) mentors  = m.value;
  } catch {}

  function renderPickers() {
    document.getElementById('student-pick-list').innerHTML = students.length
      ? students.map(s => `
          <div class="list-item student-pick ${selectedStudent?.id===s.id?'selected-item':''}" data-id="${s.id}" style="cursor:pointer;${selectedStudent?.id===s.id?'background:var(--accent-light);':''}">
            <div>
              <p style="font-weight:600;font-size:0.875rem;">${s.name}</p>
              <p style="color:var(--text-muted);font-size:0.78rem;">${s.department} — Year ${s.year||'?'}</p>
            </div>
          </div>
        `).join('')
      : '<p style="padding:20px;color:var(--text-muted);">All students are assigned.</p>';

    document.getElementById('mentor-pick-list').innerHTML = mentors.map(m => `
      <div class="list-item mentor-pick ${selectedMentor?.id===m.id?'selected-item':''}" data-id="${m.id}" style="cursor:pointer;${selectedMentor?.id===m.id?'background:var(--accent-light);':''}">
        <div>
          <p style="font-weight:600;font-size:0.875rem;">${m.name}</p>
          <p style="color:var(--text-muted);font-size:0.78rem;">${m.department}</p>
        </div>
        <span class="badge ${m.assignedStudentCount>=m.maxStudents?'badge-danger':'badge-success'}">${m.assignedStudentCount}/${m.maxStudents}</span>
      </div>
    `).join('');

    document.querySelectorAll('.student-pick').forEach(el => {
      el.addEventListener('click', () => {
        selectedStudent = students.find(s => s.id === el.dataset.id);
        document.getElementById('sel-student-label').textContent = selectedStudent?.name || 'None';
        renderPickers();
      });
    });

    document.querySelectorAll('.mentor-pick').forEach(el => {
      el.addEventListener('click', () => {
        selectedMentor = mentors.find(m => m.id === el.dataset.id);
        document.getElementById('sel-mentor-label').textContent = selectedMentor?.name || 'None';
        renderPickers();
      });
    });
  }

  document.getElementById('btn-assign').addEventListener('click', async () => {
    if (!selectedStudent || !selectedMentor) { showToast('Select both student and mentor', 'warning'); return; }
    try {
      await api.post('/api/admin/allocate', { studentId: selectedStudent.id, mentorId: selectedMentor.id });
    } catch {}
    allocs.push({ studentName: selectedStudent.name, mentorName: selectedMentor.name, department: selectedStudent.department });
    const tbody = document.getElementById('alloc-table-body');
    tbody.innerHTML += `<tr><td style="font-weight:600;">${selectedStudent.name}</td><td>${selectedMentor.name}</td><td style="color:var(--text-muted);">${selectedStudent.department}</td></tr>`;
    students = students.filter(s => s.id !== selectedStudent.id);
    const m = mentors.find(m => m.id === selectedMentor.id);
    if (m) m.assignedStudentCount++;
    selectedStudent = null; selectedMentor = null;
    document.getElementById('sel-student-label').textContent = 'None';
    document.getElementById('sel-mentor-label').textContent  = 'None';
    showToast('Allocated successfully!', 'success');
    renderPickers();
  });

  document.getElementById('btn-auto').addEventListener('click', async () => {
    const dept = document.getElementById('auto-dept').value;
    try { await api.post('/api/admin/auto-allocate', { department: dept || null }); } catch {}
    showToast('Auto-allocation complete!', 'success');
  });

  renderPickers();
}
