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

  let allStudents = [];
  let unassignedStudents = [];
  let mentors = [];
  let assignedPairs = [];
  let allDepartments = [];
  let allClasses = [];

  // Classwise Allocation state
  let selectedClasswiseMentorId = '';
  let selectedClasswiseClass = '';
  let classwiseSearchQuery = '';
  let tickedStudentIds = new Set();
  let allocFilterClass = '';
  let allocPage = 1;
  const allocPageSize = 20;

  async function loadData() {
    const [unassigned, allMentors, fullStudentList] = await Promise.all([
      StudentService.getUnassigned(),
      FacultyService.getAll().then(all => all.filter(f => f.role === 'FACULTY' || f.role === 'MENTOR')),
      StudentService.getAll()
    ]);

    unassignedStudents = unassigned;
    mentors = allMentors;
    allStudents = fullStudentList;

    assignedPairs = allStudents
      .filter(s => s.mentorId)
      .map(s => {
        const m = mentors.find(x => x.id === s.mentorId);
        return {
          studentId: s.id,
          studentName: s.name,
          enrollmentNumber: s.enrollmentNumber || '—',
          mentorName: m?.name || 'Unknown',
          department: s.department || '—',
          className: s.class ? `${s.class}` : 'Unassigned'
        };
      });

    // Natural classwise sorting: TY CORE 1 first, then TY CORE 2, etc.
    // Secondary sorting: Mentorwise (for one mentor first all, then other)
    assignedPairs.sort((a, b) => {
      const classA = a.className || 'Unassigned';
      const classB = b.className || 'Unassigned';
      if (classA === 'Unassigned' && classB !== 'Unassigned') return 1;
      if (classB === 'Unassigned' && classA !== 'Unassigned') return -1;
      const classComp = classA.localeCompare(classB, undefined, { numeric: true, sensitivity: 'base' });
      if (classComp !== 0) return classComp;

      const mentorComp = (a.mentorName || '').localeCompare(b.mentorName || '');
      if (mentorComp !== 0) return mentorComp;

      return a.studentName.localeCompare(b.studentName);
    });

    allDepartments = [...new Set([
      ...allStudents.map(s => s.department),
      ...mentors.map(m => m.department)
    ].filter(Boolean))].sort();

    allClasses = [...new Set(allStudents.map(s => s.class).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }

  try {
    await loadData();
  } catch (err) {
    (container.querySelector('#alloc-content') || {}).innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error loading data: ${err.message}</h3></div>`;
    return;
  }

  function buildUI() {
    const content = container.querySelector('#alloc-content');
    if (!content) return;

    const selectedMentor = mentors.find(m => m.id === selectedClasswiseMentorId) || null;
    const mentorCurrentAssigned = selectedMentor ? (selectedMentor.assignedStudentCount || 0) : 0;

    content.innerHTML = `
      <!-- CLASSWISE MANUAL ALLOCATION SECTION -->
      <div class="card" style="padding:24px;margin-bottom:24px;border:1px solid var(--border);">
        <div class="card-header" style="padding-bottom:16px;border-bottom:1px solid var(--border);margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <h3 style="margin:0;font-size:1.1rem;display:flex;align-items:center;gap:8px;">
              📌 Classwise Manual Mentor Allocation
            </h3>
            <p style="margin:4px 0 0 0;font-size:0.85rem;color:var(--text-secondary);">
              Step 1: Select Mentor → Step 2: Select Class → Step 3: Search & Tick Students → Step 4: Allocate (Max 50 per batch)
            </p>
          </div>
          <span class="badge ${selectedMentor ? 'badge-accent' : 'badge-muted'}" style="font-size:0.8rem;padding:6px 12px;">
            ${selectedMentor ? `Selected Mentor: ${selectedMentor.name} (${mentorCurrentAssigned} assigned)` : 'No Mentor Selected'}
          </span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
          <!-- Step 1: Select Mentor -->
          <div>
            <label style="font-size:0.85rem;font-weight:600;display:block;margin-bottom:6px;">1. Select Mentor Name</label>
            <select id="classwise-mentor-select" class="form-select" style="width:100%;padding:10px;">
              <option value="">-- Select Mentor Name --</option>
              ${mentors.map(m => {
                const used = m.assignedStudentCount || 0;
                const sel = selectedClasswiseMentorId === m.id ? 'selected' : '';
                return `<option value="${m.id}" ${sel}>${m.name} (${m.department || 'No Dept'}) — ${used} Assigned</option>`;
              }).join('')}
            </select>
          </div>

          <!-- Step 2: Select Class -->
          <div>
            <label style="font-size:0.85rem;font-weight:600;display:block;margin-bottom:6px;">2. Select Class</label>
            <select id="classwise-class-select" class="form-select" style="width:100%;padding:10px;">
              <option value="">-- Select Class --</option>
              ${allClasses.map(c => {
                const count = allStudents.filter(s => s.class === c).length;
                const sel = selectedClasswiseClass === c ? 'selected' : '';
                return `<option value="${c}" ${sel}>Class ${c} (${count} students)</option>`;
              }).join('')}
              <option value="UNASSIGNED_CLASS" ${selectedClasswiseClass === 'UNASSIGNED_CLASS' ? 'selected' : ''}>Unassigned Class (${allStudents.filter(s => !s.class).length} students)</option>
            </select>
          </div>
        </div>

        <!-- Step 3: Tick Students Table -->
        ${selectedClasswiseClass ? `
          <div id="classwise-students-wrap" style="margin-top:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;background:var(--bg-secondary);padding:12px 16px;border-radius:8px;border:1px solid var(--border);flex-wrap:wrap;gap:12px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <input type="checkbox" id="classwise-select-all" style="width:18px;height:18px;cursor:pointer;">
                <label for="classwise-select-all" style="font-weight:600;font-size:0.875rem;cursor:pointer;margin:0;">
                  Tick All in Class ${selectedClasswiseClass === 'UNASSIGNED_CLASS' ? '(Unassigned)' : selectedClasswiseClass} (Max 50)
                </label>
              </div>

              <!-- Search Bar & Counter -->
              <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                <input type="text" id="classwise-student-search" class="form-input" placeholder="🔍 Search name or roll no..." value="${classwiseSearchQuery}" style="padding:6px 12px;font-size:0.85rem;width:240px;background:var(--bg-primary);">
                <span class="badge ${tickedStudentIds.size >= 50 ? 'badge-warning' : 'badge-info'}" id="ticked-counter" style="font-size:0.85rem;padding:6px 12px;">
                  ${tickedStudentIds.size} / 50 Selected
                </span>
              </div>
            </div>

            <!-- Expanded Height Container (520px max-height) -->
            <div style="max-height:520px;min-height:280px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:var(--bg-primary);">
              <table class="data-table" style="font-size:0.825rem;">
                <thead>
                  <tr>
                    <th style="width:50px;text-align:center;">Tick</th>
                    <th>Student Name</th>
                    <th>Enrollment No</th>
                    <th>Department</th>
                    <th>Class</th>
                    <th>Current Mentor Status</th>
                  </tr>
                </thead>
                <tbody id="classwise-students-tbody">
                  <!-- Dynamically rendered by renderClasswiseTableRows -->
                </tbody>
              </table>
            </div>

            <div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
              <span style="font-size:0.75rem;color:var(--text-muted);">
                Each batch can allocate up to 50 students at once to the selected mentor. Use search to filter students instantly.
              </span>
              <button class="btn btn-primary" id="btn-classwise-allocate" ${(!selectedClasswiseMentorId || tickedStudentIds.size === 0) ? 'disabled' : ''}>
                Allocate ${tickedStudentIds.size} Ticked Student(s) →
              </button>
            </div>
          </div>
        ` : `
          <div style="padding:24px;text-align:center;background:var(--bg-secondary);border-radius:8px;border:1px dashed var(--border);">
            <p style="color:var(--text-secondary);margin:0;font-size:0.9rem;">
              👆 Select a <strong>Mentor Name</strong> and a <strong>Class</strong> above to view, search, and tick students for allocation.
            </p>
          </div>
        `}
      </div>

      <!-- SECONDARY ACTIONS GRID -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:20px;margin-bottom:24px;">
        <!-- Global Auto-Allocate & Reset -->
        <div class="card" style="padding:20px;">
          <h4 style="margin-bottom:8px;font-size:1rem;">Auto-Allocate & Year Reset</h4>
          <p style="font-size:0.85rem;margin-bottom:16px;color:var(--text-secondary);">Distribute or reset student-mentor pairings for academic year transition.</p>
          <div style="display:flex;flex-direction:column;gap:12px;">
            <select id="auto-dept" class="form-select" style="padding:10px;width:100%;">
              <option value="">All Departments</option>
              ${allDepartments.map(d => `<option value="${d}">${d}</option>`).join('')}
            </select>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <button class="btn btn-secondary" style="flex:1;min-width:120px;" id="btn-auto">Run Auto-Allocate</button>
              <button class="btn btn-danger" style="flex:1;min-width:140px;background:var(--danger);color:#fff;" id="btn-unallot-all" title="Unallot all students to reset for academic year change">
                <i class="ph ph-arrow-counter-clockwise"></i> Reset / Unallot All
              </button>
            </div>
          </div>
        </div>

        <!-- Quick Summary Stats -->
        <div class="card" style="padding:20px;">
          <h4 style="margin-bottom:8px;font-size:1rem;">Allocation Statistics</h4>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px;">
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;">
              <span style="color:var(--text-secondary);">Total Students:</span>
              <strong>${allStudents.length}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;">
              <span style="color:var(--text-secondary);">Assigned Students:</span>
              <strong style="color:var(--success);">${assignedPairs.length}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;">
              <span style="color:var(--text-secondary);">Unassigned Students:</span>
              <strong style="color:var(--warning);">${unassignedStudents.length}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;">
              <span style="color:var(--text-secondary);">Available Mentors:</span>
              <strong>${mentors.length}</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- ONE-CLICK SINGLE MENTOR REPORT BAR -->
      <div class="card" style="padding:16px 20px;margin-bottom:24px;background:var(--bg-secondary);border:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <i class="ph ph-file-arrow-down" style="font-size:1.3rem;color:var(--accent);"></i>
            <div>
              <h4 style="margin:0;font-size:0.9rem;font-weight:700;">One-Click Single Mentor Report Download</h4>
              <p style="margin:2px 0 0;font-size:0.78rem;color:var(--text-secondary);">Download mentee list for a specific faculty mentor</p>
            </div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <select id="single-mentor-select-admin" class="form-select" style="padding:6px 10px;font-size:0.85rem;min-width:220px;">
              <option value="">-- Select Mentor Name --</option>
              ${mentors.map(m => `<option value="${m.id}">${m.name} (${m.assignedStudentCount || 0}/${m.maxStudents || 20} assigned)</option>`).join('')}
            </select>
            <button class="btn btn-sm btn-primary" id="btn-single-mentor-excel-admin"><i class="ph ph-file-xls"></i> Excel</button>
            <button class="btn btn-sm btn-secondary" id="btn-single-mentor-pdf-admin"><i class="ph ph-file-pdf"></i> PDF</button>
          </div>
        </div>
      </div>

      <!-- CURRENT ALLOCATIONS TABLE -->
      <div class="card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <h3 style="margin:0;">Current Allocations (${assignedPairs.length})</h3>
            <p style="margin:2px 0 0 0;font-size:0.8rem;color:var(--text-secondary);">Ordered Classwise (e.g., TY CORE 1 first, TY CORE 2 next, likewise)</p>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <select id="alloc-class-filter" class="form-select" style="padding:6px 12px;font-size:0.85rem;min-width:200px;">
              <option value="">All Classes (Classwise Order)</option>
              ${allClasses.map(c => `<option value="${c}" ${allocFilterClass === c ? 'selected' : ''}>Class: ${c}</option>`).join('')}
              <option value="Unassigned" ${allocFilterClass === 'Unassigned' ? 'selected' : ''}>Unassigned Class</option>
            </select>
            <button class="btn btn-sm btn-secondary" id="btn-export-excel" style="display:flex;align-items:center;gap:6px;">
              <i class="ph ph-file-xls" style="font-size:1rem;"></i> Export Excel
            </button>
            <button class="btn btn-sm btn-secondary" id="btn-export-pdf" style="display:flex;align-items:center;gap:6px;">
              <i class="ph ph-file-pdf" style="font-size:1rem;"></i> Export PDF
            </button>
          </div>
        </div>
        <div id="alloc-table-wrap" style="overflow-x:auto;"></div>
      </div>
    `;

    renderClasswiseTableRows();
    renderAllocationsTable();
    attachEventListeners();
  }

  function renderClasswiseTableRows() {
    const tbody = container.querySelector('#classwise-students-tbody');
    if (!tbody) return;

    let classFilteredStudents = [];
    if (selectedClasswiseClass === 'UNASSIGNED_CLASS') {
      classFilteredStudents = allStudents.filter(s => !s.class);
    } else if (selectedClasswiseClass) {
      classFilteredStudents = allStudents.filter(s => s.class === selectedClasswiseClass);
    }

    if (classwiseSearchQuery) {
      const q = classwiseSearchQuery.toLowerCase();
      classFilteredStudents = classFilteredStudents.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.enrollmentNumber || s.employeeId || '').toLowerCase().includes(q) ||
        (s.department || '').toLowerCase().includes(q)
      );
    }

    if (classFilteredStudents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">${classwiseSearchQuery ? 'No matching students found.' : 'No students found in this class.'}</td></tr>`;
      return;
    }

    tbody.innerHTML = classFilteredStudents.map(s => {
      const isTicked = tickedStudentIds.has(s.id);
      const curMentor = s.mentorId ? mentors.find(m => m.id === s.mentorId) : null;
      return `
        <tr style="${isTicked ? 'background:var(--accent-light);' : ''}">
          <td style="text-align:center;">
            <input type="checkbox" class="classwise-student-cb" data-id="${s.id}" ${isTicked ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;">
          </td>
          <td style="font-weight:600;">${s.name}</td>
          <td>${s.enrollmentNumber || '—'}</td>
          <td>${s.department || '—'}</td>
          <td>${s.class ? `Class ${s.class}` : 'Unassigned'}</td>
          <td>
            ${curMentor ? `<span class="badge badge-info">Mentor: ${curMentor.name}</span>` : '<span class="badge badge-warning">Unassigned</span>'}
          </td>
        </tr>
      `;
    }).join('');

    attachRowCheckboxListeners();
  }

  function updateTickedUI() {
    const counter = container.querySelector('#ticked-counter');
    if (counter) {
      counter.textContent = `${tickedStudentIds.size} / 50 Selected`;
      counter.className = `badge ${tickedStudentIds.size >= 50 ? 'badge-warning' : 'badge-info'}`;
    }

    const btnAllocate = container.querySelector('#btn-classwise-allocate');
    if (btnAllocate) {
      btnAllocate.disabled = !selectedClasswiseMentorId || tickedStudentIds.size === 0;
      btnAllocate.textContent = `Allocate ${tickedStudentIds.size} Ticked Student(s) →`;
    }

    const selectAllCb = container.querySelector('#classwise-select-all');
    if (selectAllCb) {
      let classFiltered = [];
      if (selectedClasswiseClass === 'UNASSIGNED_CLASS') {
        classFiltered = allStudents.filter(s => !s.class);
      } else if (selectedClasswiseClass) {
        classFiltered = allStudents.filter(s => s.class === selectedClasswiseClass);
      }
      selectAllCb.checked = classFiltered.length > 0 && classFiltered.every(s => tickedStudentIds.has(s.id));
    }
  }

  function attachRowCheckboxListeners() {
    container.querySelectorAll('.classwise-student-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        const row = e.target.closest('tr');
        const maxAllowed = 50;

        if (e.target.checked) {
          if (tickedStudentIds.size >= maxAllowed) {
            e.target.checked = false;
            showToast(`Maximum ${maxAllowed} students can be selected for this allocation batch`, 'warning');
            return;
          }
          tickedStudentIds.add(id);
          if (row) row.style.background = 'var(--accent-light)';
        } else {
          tickedStudentIds.delete(id);
          if (row) row.style.background = '';
        }
        updateTickedUI();
      });
    });
  }

  function renderAllocationsTable() {
    const tableWrap = container.querySelector('#alloc-table-wrap');
    if (!tableWrap) return;

    let targetPairs = assignedPairs;
    if (allocFilterClass) {
      targetPairs = assignedPairs.filter(a => a.className === allocFilterClass);
    }

    const totalAllocPages = Math.ceil(targetPairs.length / allocPageSize) || 1;
    if (allocPage > totalAllocPages) allocPage = totalAllocPages;
    if (allocPage < 1) allocPage = 1;

    const startIdx = (allocPage - 1) * allocPageSize;
    const endIdx = Math.min(startIdx + allocPageSize, targetPairs.length);
    const visiblePairs = targetPairs.slice(startIdx, endIdx);

    if (targetPairs.length === 0) {
      tableWrap.innerHTML = `<p style="padding:24px;color:var(--text-muted);text-align:center;">${allocFilterClass ? `No allocations found for Class "${allocFilterClass}".` : 'No allocations recorded yet.'}</p>`;
      return;
    }

    tableWrap.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Class</th>
            <th>Assigned Mentor</th>
            <th>Student Name</th>
            <th>Enrollment No</th>
            <th>Department</th>
          </tr>
        </thead>
        <tbody>
          ${visiblePairs.map(a => `
            <tr>
              <td><span class="badge badge-accent" style="font-weight:600;">Class ${a.className}</span></td>
              <td style="color:var(--accent);font-weight:600;">${a.mentorName}</td>
              <td style="font-weight:600;">${a.studentName}</td>
              <td>${a.enrollmentNumber}</td>
              <td style="color:var(--text-muted);font-size:0.825rem;">${a.department}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-top:1px solid var(--border);flex-wrap:wrap;gap:8px;">
        <span style="font-size:0.8rem;color:var(--text-secondary);">Showing ${startIdx + 1}–${endIdx} of ${targetPairs.length} ${allocFilterClass ? `in Class ${allocFilterClass}` : 'allocations (classwise order)'}</span>
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="btn btn-xs btn-secondary" id="btn-alloc-prev" ${allocPage === 1 ? 'disabled' : ''}>← Prev</button>
          <span style="font-size:0.8rem;font-weight:600;">Page ${allocPage} of ${totalAllocPages}</span>
          <button class="btn btn-xs btn-secondary" id="btn-alloc-next" ${allocPage === totalAllocPages ? 'disabled' : ''}>Next →</button>
        </div>
      </div>
    `;

    document.getElementById('btn-alloc-prev')?.addEventListener('click', () => {
      if (allocPage > 1) { allocPage--; renderAllocationsTable(); }
    });
    document.getElementById('btn-alloc-next')?.addEventListener('click', () => {
      if (allocPage < totalAllocPages) { allocPage++; renderAllocationsTable(); }
    });
  }

  function attachEventListeners() {
    // Current Allocations Class Filter Listener
    const classFilterSelect = container.querySelector('#alloc-class-filter');
    if (classFilterSelect) {
      classFilterSelect.addEventListener('change', (e) => {
        allocFilterClass = e.target.value;
        allocPage = 1;
        renderAllocationsTable();
      });
    }
    // Step 1: Mentor Selection
    const mentorSelect = container.querySelector('#classwise-mentor-select');
    if (mentorSelect) {
      mentorSelect.addEventListener('change', (e) => {
        selectedClasswiseMentorId = e.target.value;
        tickedStudentIds.clear();
        buildUI();
      });
    }

    // Step 2: Class Selection
    const classSelect = container.querySelector('#classwise-class-select');
    if (classSelect) {
      classSelect.addEventListener('change', (e) => {
        selectedClasswiseClass = e.target.value;
        classwiseSearchQuery = '';
        tickedStudentIds.clear();
        buildUI();
      });
    }

    // Live Search Filter Listener
    const searchInput = container.querySelector('#classwise-student-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        classwiseSearchQuery = e.target.value.toLowerCase().trim();
        renderClasswiseTableRows();
      });
    }

    // Select All in Class
    const selectAllCb = container.querySelector('#classwise-select-all');
    if (selectAllCb) {
      selectAllCb.addEventListener('change', (e) => {
        let classFiltered = [];
        if (selectedClasswiseClass === 'UNASSIGNED_CLASS') {
          classFiltered = allStudents.filter(s => !s.class);
        } else if (selectedClasswiseClass) {
          classFiltered = allStudents.filter(s => s.class === selectedClasswiseClass);
        }

        const maxAllowed = 50;
        tickedStudentIds.clear();

        if (e.target.checked) {
          const toTick = classFiltered.slice(0, maxAllowed);
          toTick.forEach(s => tickedStudentIds.add(s.id));
          if (classFiltered.length > maxAllowed) {
            showToast(`Selected first 50 students (batch limit)`, 'info');
          }
        }

        renderClasswiseTableRows();
        updateTickedUI();
      });
    }

    // Step 4: Allocate Action
    const btnAllocate = container.querySelector('#btn-classwise-allocate');
    if (btnAllocate) {
      btnAllocate.addEventListener('click', async () => {
        const selectedMentor = mentors.find(m => m.id === selectedClasswiseMentorId);
        if (!selectedMentor) return showToast('Please select a Mentor name first', 'warning');
        if (tickedStudentIds.size === 0) return showToast('Please tick at least one student to allocate', 'warning');

        btnAllocate.disabled = true;
        btnAllocate.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Allocating...';

        try {
          const studentIdsArray = Array.from(tickedStudentIds);
          await AllocationService.batchAssign(studentIdsArray, selectedMentor.id);

          showToast(`Successfully allocated ${studentIdsArray.length} student(s) to ${selectedMentor.name}!`, 'success');

          // Reset selection state & refresh
          tickedStudentIds.clear();
          await loadData();
          buildUI();
        } catch (err) {
          console.error("Allocation error:", err);
          showToast(err.message || 'Failed to allocate students', 'error');
          btnAllocate.disabled = false;
          btnAllocate.textContent = `Allocate ${tickedStudentIds.size} Ticked Student(s) →`;
        }
      });
    }

    // Global Auto Allocate Action
    const btnAuto = container.querySelector('#btn-auto');
    if (btnAuto) {
      btnAuto.addEventListener('click', async () => {
        const dept = container.querySelector('#auto-dept').value || null;
        if (!confirm(`Are you sure you want to auto-allocate unassigned students${dept ? ` in ${dept}` : ''}?`)) return;

        btnAuto.disabled = true;
        btnAuto.textContent = 'Allocating...';

        try {
          const results = await AllocationService.autoAllocate(dept, (count, total) => {
            btnAuto.textContent = `Allocating (${count}/${total})...`;
          });
          showToast(`Auto-allocated ${results.length} student(s)!`, 'success');
          await loadData();
          buildUI();
        } catch (err) {
          console.error("Auto allocate error:", err);
          showToast(err.message, 'error');
        } finally {
          btnAuto.disabled = false;
          btnAuto.textContent = 'Run Auto-Allocate';
        }
      });
    }

    // Unallot All / Year Change Reset Action
    const btnUnallot = container.querySelector('#btn-unallot-all');
    if (btnUnallot) {
      btnUnallot.addEventListener('click', async () => {
        const dept = container.querySelector('#auto-dept').value || null;
        const targetDesc = dept ? `all students in ${dept}` : 'ALL students across all departments';
        if (!confirm(`⚠️ ACADEMIC YEAR RESET CONFIRMATION:\n\nAre you sure you want to UNALLOT ${targetDesc}?\n\nThis will clear all current mentor assignments so you can cleanly re-allocate students for the new academic year.`)) return;

        btnUnallot.disabled = true;
        btnUnallot.textContent = 'Resetting...';

        try {
          const count = await AllocationService.unallotAll(dept, (processed, total) => {
            btnUnallot.textContent = `Resetting (${processed}/${total})...`;
          });
          showToast(`Successfully unallocated ${count} student(s)! You can now run Auto-Allocate.`, 'success');
          await loadData();
          buildUI();
        } catch (err) {
          console.error("Unallot error:", err);
          showToast(err.message || 'Failed to unallocate students', 'error');
        } finally {
          btnUnallot.disabled = false;
          btnUnallot.innerHTML = '<i class="ph ph-arrow-counter-clockwise"></i> Reset / Unallot All';
        }
      });
    }

    // Master Export Buttons
    container.querySelector('#btn-export-excel')?.addEventListener('click', async () => {
      const { exportMentorStudentReport } = await import('/js/report-export.js');
      await exportMentorStudentReport('excel');
    });

    container.querySelector('#btn-export-pdf')?.addEventListener('click', async () => {
      const { exportMentorStudentReport } = await import('/js/report-export.js');
      await exportMentorStudentReport('pdf');
    });

    // Single Mentor Report Listeners
    container.querySelector('#btn-single-mentor-excel-admin')?.addEventListener('click', async () => {
      const mId = container.querySelector('#single-mentor-select-admin')?.value;
      if (!mId) return showToast('Please select a Mentor Name first', 'warning');
      const { exportSingleMentorReport } = await import('/js/report-export.js');
      await exportSingleMentorReport(mId, 'excel');
    });

    container.querySelector('#btn-single-mentor-pdf-admin')?.addEventListener('click', async () => {
      const mId = container.querySelector('#single-mentor-select-admin')?.value;
      if (!mId) return showToast('Please select a Mentor Name first', 'warning');
      const { exportSingleMentorReport } = await import('/js/report-export.js');
      await exportSingleMentorReport(mId, 'pdf');
    });
  }

  buildUI();
}
