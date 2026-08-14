import { FacultyService, StudentService } from '/js/services.js';
import { showToast } from '/js/components/toast.js';
import { getMentorsForSelectedClasses, exportMultiClassMentorsReport } from '/js/report-export.js';

let modalRoot = null;
let allMentorsData = [];
let allStudentsData = [];
let allClassesList = [];
let selectedClassSet = new Set();
let mentorSearchQuery = '';
let classSearchQuery = '';
let activeDrilldownMentor = null;

export async function openMultiClassMentorsModal(initialClasses = []) {
  showToast('Loading mentors and class data...', 'info');

  try {
    const [mentors, students] = await Promise.all([
      FacultyService.getAll(),
      StudentService.getAll()
    ]);

    allMentorsData = mentors;
    allStudentsData = students;

    // Extract all distinct classes
    const rawClasses = [...new Set(students.map(s => s.class).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    const hasUnassigned = students.some(s => !s.class);
    allClassesList = [...rawClasses];
    if (hasUnassigned) {
      allClassesList.push('UNASSIGNED_CLASS');
    }

    selectedClassSet.clear();
    if (initialClasses && initialClasses.length > 0) {
      initialClasses.forEach(c => selectedClassSet.add(c));
    } else {
      // Default: select all classes initially so admin immediately sees full mentor directory
      allClassesList.forEach(c => selectedClassSet.add(c));
    }

    mentorSearchQuery = '';
    classSearchQuery = '';
    activeDrilldownMentor = null;

    renderModalDom();
  } catch (err) {
    console.error('Error opening multi-class mentors modal:', err);
    showToast(`Failed to load data: ${err.message}`, 'error');
  }
}

function renderModalDom() {
  if (modalRoot) {
    modalRoot.remove();
    modalRoot = null;
  }

  modalRoot = document.createElement('div');
  modalRoot.id = 'multi-class-mentors-modal';
  modalRoot.className = 'modal-backdrop';
  modalRoot.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.75);backdrop-filter:blur(4px);z-index:99999;display:flex;justify-content:center;align-items:center;padding:16px;box-sizing:border-box;';

  document.body.appendChild(modalRoot);
  updateModalContent();
}

function updateModalContent() {
  if (!modalRoot) return;

  const selectedClassesArray = Array.from(selectedClassSet);
  const { mentorsList, relevantStudents } = getMentorsForSelectedClasses(selectedClassesArray, allMentorsData, allStudentsData);

  // Filter mentors list by search query
  let filteredMentors = mentorsList;
  if (mentorSearchQuery) {
    const q = mentorSearchQuery.toLowerCase();
    filteredMentors = filteredMentors.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.department.toLowerCase().includes(q) ||
      m.phone.toLowerCase().includes(q) ||
      m.employeeId.toLowerCase().includes(q)
    );
  }

  const totalAssignedStudents = filteredMentors.reduce((acc, m) => acc + m.selectedMenteesCount, 0);

  // Filter class pills by class search query
  let visibleClasses = allClassesList;
  if (classSearchQuery) {
    const cq = classSearchQuery.toLowerCase();
    visibleClasses = visibleClasses.filter(c => c.toLowerCase().includes(cq));
  }

  modalRoot.innerHTML = `
    <div class="card" style="width:100%;max-width:1200px;max-height:92vh;display:flex;flex-direction:column;background:var(--bg-primary,#1e1e2d);border-radius:14px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);overflow:hidden;border:1px solid var(--border,#334155);animation:fadeIn 0.2s ease;">
      
      <!-- Modal Header -->
      <div style="padding:18px 24px;background:var(--bg-secondary,#181824);border-bottom:1px solid var(--border,#334155);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#6c47ff,#a855f7);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.3rem;box-shadow:0 4px 12px rgba(108,71,255,0.3);">
            👥
          </div>
          <div>
            <h3 style="margin:0;font-size:1.15rem;font-weight:700;color:var(--text-primary,#fff);display:flex;align-items:center;gap:8px;">
              Multi-Class Selected Mentors Directory &amp; Details
            </h3>
            <p style="margin:2px 0 0;font-size:0.8rem;color:var(--text-secondary,#94a3b8);">
              Select multiple classes to filter and view mentor names, contact information, department, designation, and mentees list.
            </p>
          </div>
        </div>
        <button id="modal-close-btn" style="background:transparent;border:none;color:var(--text-secondary,#94a3b8);font-size:1.5rem;cursor:pointer;padding:4px 8px;border-radius:6px;line-height:1;" title="Close Modal">&times;</button>
      </div>

      <!-- Modal Body (Scrollable) -->
      <div style="padding:20px 24px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:18px;">
        
        <!-- STEP 1: Multiple Classes Selection Box -->
        <div style="background:var(--bg-secondary,#181824);border:1px solid var(--border,#334155);border-radius:10px;padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-weight:700;font-size:0.9rem;color:var(--text-primary,#fff);">1. Select Target Classes:</span>
              <span class="badge badge-accent" style="font-size:0.75rem;padding:3px 8px;background:#6c47ff;color:#fff;border-radius:6px;">
                ${selectedClassSet.size} of ${allClassesList.length} Selected
              </span>
            </div>
            
            <!-- Quick Class Selectors -->
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
              <input type="text" id="class-filter-search" placeholder="🔍 Search classes..." value="${classSearchQuery}" style="padding:4px 10px;font-size:0.8rem;background:var(--bg-primary,#1e1e2d);border:1px solid var(--border,#334155);color:var(--text-primary,#fff);border-radius:6px;width:150px;">
              <button class="btn btn-xs btn-secondary" id="btn-select-all-classes">Select All</button>
              <button class="btn btn-xs btn-secondary" id="btn-clear-classes">Clear</button>
              <button class="btn btn-xs btn-secondary" id="btn-select-ty">TY Classes</button>
              <button class="btn btn-xs btn-secondary" id="btn-select-sy">SY Classes</button>
              <button class="btn btn-xs btn-secondary" id="btn-select-fy">FY Classes</button>
            </div>
          </div>

          <!-- Class Selection Pills / Checkboxes Grid -->
          <div style="display:flex;flex-wrap:wrap;gap:8px;max-height:110px;overflow-y:auto;padding:6px;background:var(--bg-primary,#1e1e2d);border:1px solid var(--border,#334155);border-radius:8px;">
            ${visibleClasses.map(c => {
              const isSelected = selectedClassSet.has(c);
              const displayName = c === 'UNASSIGNED_CLASS' ? 'Unassigned Class' : `Class ${c}`;
              const count = allStudentsData.filter(s => (s.class || 'UNASSIGNED_CLASS') === c).length;
              return `
                <label class="class-pill-label" style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:20px;font-size:0.8rem;cursor:pointer;user-select:none;transition:all 0.15s ease;border:1px solid ${isSelected ? '#6c47ff' : 'var(--border,#334155)'};background:${isSelected ? 'rgba(108,71,255,0.18)' : 'transparent'};color:${isSelected ? '#a855f7' : 'var(--text-secondary,#94a3b8)'};">
                  <input type="checkbox" class="class-checkbox-item" data-class="${c}" ${isSelected ? 'checked' : ''} style="cursor:pointer;accent-color:#6c47ff;width:14px;height:14px;">
                  <strong>${displayName}</strong>
                  <span style="font-size:0.7rem;opacity:0.75;">(${count})</span>
                </label>
              `;
            }).join('')}
            ${visibleClasses.length === 0 ? '<p style="font-size:0.8rem;color:var(--text-muted);margin:4px 8px;">No matching classes found.</p>' : ''}
          </div>
        </div>

        <!-- STEP 2: Live Mentors List & Summary -->
        <div style="background:var(--bg-secondary,#181824);border:1px solid var(--border,#334155);border-radius:10px;padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:12px;">
            <div>
              <h4 style="margin:0;font-size:0.95rem;font-weight:700;color:var(--text-primary,#fff);display:flex;align-items:center;gap:8px;">
                <span>2. Mentors List (${filteredMentors.length} Mentors Found)</span>
                <span class="badge badge-success" style="font-size:0.75rem;padding:3px 8px;border-radius:6px;background:rgba(34,197,94,0.15);color:#22c55e;">
                  ${totalAssignedStudents} Mentees in Selection
                </span>
              </h4>
            </div>

            <!-- Mentor Search -->
            <div style="display:flex;align-items:center;gap:10px;">
              <input type="text" id="mentor-filter-search" placeholder="🔍 Search mentor name, email, dept..." value="${mentorSearchQuery}" style="padding:6px 12px;font-size:0.825rem;background:var(--bg-primary,#1e1e2d);border:1px solid var(--border,#334155);color:var(--text-primary,#fff);border-radius:6px;width:260px;">
            </div>
          </div>

          <!-- Mentors Table Container -->
          <div style="max-height:360px;min-height:180px;overflow-y:auto;border:1px solid var(--border,#334155);border-radius:8px;background:var(--bg-primary,#1e1e2d);">
            ${filteredMentors.length === 0 ? `
              <div style="padding:40px;text-align:center;color:var(--text-muted,#94a3b8);">
                <p style="font-size:1.1rem;margin-bottom:6px;">🔍 No mentors found for the selected classes</p>
                <p style="font-size:0.8rem;margin:0;">Try selecting additional classes or adjusting your search filters above.</p>
              </div>
            ` : `
              <table class="data-table" style="font-size:0.825rem;width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="position:sticky;top:0;background:var(--bg-secondary,#181824);z-index:2;">
                    <th style="width:40px;text-align:center;">#</th>
                    <th>Mentor Details</th>
                    <th>Contact Info</th>
                    <th>Department &amp; Designation</th>
                    <th>Classes Mentored</th>
                    <th style="text-align:center;">Mentees (Selected)</th>
                    <th style="text-align:center;">Total Mentees</th>
                    <th style="text-align:center;width:120px;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredMentors.map((m, idx) => `
                    <tr style="border-bottom:1px solid var(--border,#334155);">
                      <td style="text-align:center;color:var(--text-muted,#94a3b8);">${idx + 1}</td>
                      <td>
                        <div style="display:flex;align-items:center;gap:10px;">
                          <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#6c47ff,#a855f7);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;">
                            ${(m.name || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style="font-weight:600;color:var(--text-primary,#fff);">${m.name}</div>
                            ${m.employeeId && m.employeeId !== '—' ? `<div style="font-size:0.72rem;color:var(--text-muted,#94a3b8);">ID: ${m.employeeId}</div>` : ''}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style="font-size:0.8rem;color:var(--text-primary,#fff);">${m.email}</div>
                        <div style="font-size:0.75rem;color:var(--text-muted,#94a3b8);">${m.phone}</div>
                      </td>
                      <td>
                        <div style="font-weight:600;font-size:0.8rem;">${m.department}</div>
                        <div style="font-size:0.72rem;color:var(--text-muted,#94a3b8);">${m.designation}</div>
                      </td>
                      <td>
                        <div style="display:flex;flex-wrap:wrap;gap:4px;">
                          ${m.classesBreakdownList.map(c => `
                            <span class="badge" style="font-size:0.72rem;padding:2px 6px;border-radius:4px;background:rgba(108,71,255,0.15);color:#a855f7;border:1px solid rgba(108,71,255,0.3);">
                              ${c.className} <strong>(${c.count})</strong>
                            </span>
                          `).join('')}
                        </div>
                      </td>
                      <td style="text-align:center;">
                        <span class="badge badge-accent" style="font-weight:700;font-size:0.85rem;padding:4px 10px;background:linear-gradient(135deg,#6c47ff,#a855f7);color:#fff;border-radius:6px;">
                          ${m.selectedMenteesCount}
                        </span>
                      </td>
                      <td style="text-align:center;color:var(--text-secondary,#94a3b8);font-weight:600;">
                        ${m.totalPlatformMentees}
                      </td>
                      <td style="text-align:center;">
                        <button class="btn btn-xs btn-secondary btn-drilldown-mentee" data-mentor-id="${m.id}" style="padding:4px 8px;font-size:0.75rem;display:inline-flex;align-items:center;gap:4px;">
                          👁️ View Mentees
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>

        <!-- MENTEE DRILLDOWN SECTION (Rendered if activeDrilldownMentor is set) -->
        ${activeDrilldownMentor ? `
          <div id="mentee-drilldown-panel" style="background:var(--bg-secondary,#181824);border:2px solid #6c47ff;border-radius:10px;padding:16px;animation:fadeIn 0.2s ease;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="font-weight:700;font-size:0.95rem;color:var(--text-primary,#fff);">
                  👤 Assigned Mentees for <span style="color:#a855f7;">${activeDrilldownMentor.name}</span> in Selected Classes
                </div>
                <span class="badge badge-accent" style="font-size:0.75rem;padding:3px 8px;background:#6c47ff;color:#fff;border-radius:6px;">
                  ${activeDrilldownMentor.mentees.length} Students
                </span>
              </div>
              <button id="btn-close-drilldown" class="btn btn-xs btn-secondary" style="padding:2px 8px;">✕ Close Mentee View</button>
            </div>

            <div style="max-height:220px;overflow-y:auto;border:1px solid var(--border,#334155);border-radius:6px;background:var(--bg-primary,#1e1e2d);">
              <table class="data-table" style="font-size:0.8rem;width:100%;">
                <thead>
                  <tr style="position:sticky;top:0;background:var(--bg-secondary,#181824);">
                    <th style="width:30px;">#</th>
                    <th>Class</th>
                    <th>Student Name</th>
                    <th>Enrollment No</th>
                    <th>Email</th>
                    <th>Student Contact</th>
                    <th>Father Contact</th>
                    <th>Department</th>
                  </tr>
                </thead>
                <tbody>
                  ${activeDrilldownMentor.mentees.map((s, sIdx) => `
                    <tr>
                      <td>${sIdx + 1}</td>
                      <td><span class="badge" style="font-size:0.72rem;background:rgba(108,71,255,0.15);color:#a855f7;">Class ${s.class || 'Unassigned'}</span></td>
                      <td style="font-weight:600;color:var(--text-primary,#fff);">${s.name || '—'}</td>
                      <td>${s.enrollmentNumber || '—'}</td>
                      <td>${s.email || '—'}</td>
                      <td>${s.mobileNumber || s.phone || s.studentPhone || '—'}</td>
                      <td>${s.fatherContact || s.parentContact || s.fatherPhoneM || '—'}</td>
                      <td style="color:var(--text-muted,#94a3b8);">${s.department || '—'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

      </div>

      <!-- Modal Footer & Export Actions -->
      <div style="padding:16px 24px;background:var(--bg-secondary,#181824);border-top:1px solid var(--border,#334155);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div style="font-size:0.8rem;color:var(--text-secondary,#94a3b8);">
          Selected: <strong>${selectedClassSet.size} classes</strong> &bull; Showing <strong>${filteredMentors.length} mentors</strong> handling <strong>${totalAssignedStudents} mentees</strong>
        </div>

        <div style="display:flex;gap:10px;align-items:center;">
          <button class="btn btn-secondary" id="btn-export-multi-excel" style="display:flex;align-items:center;gap:6px;">
            <i class="ph ph-file-xls" style="font-size:1.1rem;color:var(--success,#22c55e);"></i>
            Export Excel (.xlsx)
          </button>
          <button class="btn btn-secondary" id="btn-export-multi-pdf" style="display:flex;align-items:center;gap:6px;">
            <i class="ph ph-file-pdf" style="font-size:1.1rem;color:var(--danger,#ef4444);"></i>
            Export PDF / Print
          </button>
          <button class="btn btn-primary" id="modal-footer-close-btn">
            Done / Close
          </button>
        </div>
      </div>

    </div>
  `;

  attachModalEvents();
}

function attachModalEvents() {
  if (!modalRoot) return;

  // Close modal
  const closeModal = () => {
    if (modalRoot) {
      modalRoot.remove();
      modalRoot = null;
    }
  };

  modalRoot.querySelector('#modal-close-btn')?.addEventListener('click', closeModal);
  modalRoot.querySelector('#modal-footer-close-btn')?.addEventListener('click', closeModal);

  // Close on backdrop click
  modalRoot.addEventListener('click', (e) => {
    if (e.target === modalRoot) closeModal();
  });

  // Class Checkboxes
  modalRoot.querySelectorAll('.class-checkbox-item').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const cls = e.target.dataset.class;
      if (e.target.checked) {
        selectedClassSet.add(cls);
      } else {
        selectedClassSet.delete(cls);
      }
      activeDrilldownMentor = null;
      updateModalContent();
    });
  });

  // Class Search Filter
  const classSearchInput = modalRoot.querySelector('#class-filter-search');
  if (classSearchInput) {
    classSearchInput.addEventListener('input', (e) => {
      classSearchQuery = e.target.value;
      updateModalContent();
      const updatedInput = modalRoot.querySelector('#class-filter-search');
      if (updatedInput) {
        updatedInput.focus();
        updatedInput.selectionStart = updatedInput.selectionEnd = updatedInput.value.length;
      }
    });
  }

  // Quick Class Buttons
  modalRoot.querySelector('#btn-select-all-classes')?.addEventListener('click', () => {
    allClassesList.forEach(c => selectedClassSet.add(c));
    activeDrilldownMentor = null;
    updateModalContent();
  });

  modalRoot.querySelector('#btn-clear-classes')?.addEventListener('click', () => {
    selectedClassSet.clear();
    activeDrilldownMentor = null;
    updateModalContent();
  });

  modalRoot.querySelector('#btn-select-ty')?.addEventListener('click', () => {
    selectedClassSet.clear();
    allClassesList.filter(c => c.toUpperCase().includes('TY')).forEach(c => selectedClassSet.add(c));
    activeDrilldownMentor = null;
    updateModalContent();
  });

  modalRoot.querySelector('#btn-select-sy')?.addEventListener('click', () => {
    selectedClassSet.clear();
    allClassesList.filter(c => c.toUpperCase().includes('SY')).forEach(c => selectedClassSet.add(c));
    activeDrilldownMentor = null;
    updateModalContent();
  });

  modalRoot.querySelector('#btn-select-fy')?.addEventListener('click', () => {
    selectedClassSet.clear();
    allClassesList.filter(c => c.toUpperCase().includes('FY')).forEach(c => selectedClassSet.add(c));
    activeDrilldownMentor = null;
    updateModalContent();
  });

  // Mentor Search Filter
  const mentorSearchInput = modalRoot.querySelector('#mentor-filter-search');
  if (mentorSearchInput) {
    mentorSearchInput.addEventListener('input', (e) => {
      mentorSearchQuery = e.target.value;
      updateModalContent();
      const updatedInput = modalRoot.querySelector('#mentor-filter-search');
      if (updatedInput) {
        updatedInput.focus();
        updatedInput.selectionStart = updatedInput.selectionEnd = updatedInput.value.length;
      }
    });
  }

  // Drilldown View Mentees
  modalRoot.querySelectorAll('.btn-drilldown-mentee').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mentorId = e.currentTarget.dataset.mentorId;
      const selectedClassesArray = Array.from(selectedClassSet);
      const { mentorsList } = getMentorsForSelectedClasses(selectedClassesArray, allMentorsData, allStudentsData);
      activeDrilldownMentor = mentorsList.find(m => m.id === mentorId) || null;
      updateModalContent();
      const drillPanel = modalRoot.querySelector('#mentee-drilldown-panel');
      if (drillPanel) drillPanel.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Close drilldown
  modalRoot.querySelector('#btn-close-drilldown')?.addEventListener('click', () => {
    activeDrilldownMentor = null;
    updateModalContent();
  });

  // Export Excel
  modalRoot.querySelector('#btn-export-multi-excel')?.addEventListener('click', async () => {
    const selectedClassesArray = Array.from(selectedClassSet);
    if (selectedClassesArray.length === 0) {
      return showToast('Please select at least one class first', 'warning');
    }
    await exportMultiClassMentorsReport(selectedClassesArray, 'excel', {
      allMentors: allMentorsData,
      allStudents: allStudentsData
    });
  });

  // Export PDF
  modalRoot.querySelector('#btn-export-multi-pdf')?.addEventListener('click', async () => {
    const selectedClassesArray = Array.from(selectedClassSet);
    if (selectedClassesArray.length === 0) {
      return showToast('Please select at least one class first', 'warning');
    }
    await exportMultiClassMentorsReport(selectedClassesArray, 'pdf', {
      allMentors: allMentorsData,
      allStudents: allStudentsData
    });
  });
}
