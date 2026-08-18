import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { SettingsService, WebIssueService } from '/js/services.js';
import { db } from '/js/firebase-init.js';
import {
  collection, getDocs, deleteDoc, doc, query, orderBy,
  updateDoc, increment, writeBatch, setDoc, getDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';



function getSetting(key, def) {
  const v = localStorage.getItem(`lumina_${key}`);
  return v !== null ? JSON.parse(v) : def;
}

function setSetting(key, val) {
  localStorage.setItem(`lumina_${key}`, JSON.stringify(val));
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/admin/settings')}
      <div class="main-content">
        ${createHeader('Platform Settings', user)}
        <div class="page-content">
          <div style="max-width:920px;display:flex;flex-direction:column;gap:20px;">

            <!-- Reported Web Issues Management Engine (Admin Only) -->
            <div class="card" style="padding:24px;border-color:rgba(239,68,68,0.35);background:linear-gradient(180deg, rgba(239,68,68,0.03) 0%, var(--bg-card) 100%);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
                <div>
                  <h3 style="font-size:1.05rem;font-weight:700;margin:0;display:flex;align-items:center;gap:8px;color:var(--text-primary);">
                    🐞 Reported Web Issues &amp; Bug Management Engine
                    <span class="badge badge-accent" style="font-size:0.7rem;padding:2px 8px;">ADMIN ONLY</span>
                  </h3>
                  <p style="color:var(--text-secondary);font-size:0.82rem;margin-top:4px;max-width:680px;line-height:1.5;">
                    Centralized platform tracking tool for user-submitted web issues, UI/UX bug reports, and site feedback collected via the global <strong>'Web Issue'</strong> header button across all user pages.
                  </p>
                </div>
                <button class="btn btn-secondary btn-sm" id="btn-refresh-web-issues" style="white-space:nowrap;gap:6px;">
                  🔄 Refresh Web Issues
                </button>
              </div>

              <div id="web-issues-container" style="margin-top:16px;">
                <!-- Populated via loadWebIssues() -->
              </div>
            </div>

            <!-- General Settings -->
            <div class="card" style="padding:24px;">
              <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:20px;">General Settings</h3>

              <div class="form-group">
                <label class="form-label">Max Students Per Mentor</label>
                <input type="number" id="setting-max-students" class="form-input" value="${getSetting('maxStudents',20)}" min="1" max="50" style="max-width:160px;">
                <p style="font-size:0.78rem;color:var(--text-muted);margin-top:6px;">Default capacity for each mentor</p>
              </div>

              <div class="divider"></div>

              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                <div>
                  <p style="font-weight:500;font-size:0.875rem;">Auto-Allocation</p>
                  <p style="color:var(--text-muted);font-size:0.78rem;">Automatically assign mentors to new students</p>
                </div>
                <label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer;">
                  <input type="checkbox" id="setting-auto-alloc" ${getSetting('autoAlloc',true)?'checked':''} style="opacity:0;width:0;height:0;">
                  <span id="toggle-auto" style="position:absolute;inset:0;background:${getSetting('autoAlloc',true)?'var(--accent)':'var(--bg-glass-hover)'};border-radius:24px;transition:0.2s;">
                    <span style="position:absolute;left:${getSetting('autoAlloc',true)?'22':'2'}px;top:2px;width:20px;height:20px;background:white;border-radius:50%;transition:0.2s;"></span>
                  </span>
                </label>
              </div>

              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
                <div>
                  <p style="font-weight:500;font-size:0.875rem;">Email Notifications</p>
                  <p style="color:var(--text-muted);font-size:0.78rem;">Send email notifications for meetings and issues</p>
                </div>
                <label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer;">
                  <input type="checkbox" id="setting-email-notif" ${getSetting('emailNotif',false)?'checked':''} style="opacity:0;width:0;height:0;">
                  <span id="toggle-email" style="position:absolute;inset:0;background:${getSetting('emailNotif',false)?'var(--accent)':'var(--bg-glass-hover)'};border-radius:24px;transition:0.2s;">
                    <span style="position:absolute;left:${getSetting('emailNotif',false)?'22':'2'}px;top:2px;width:20px;height:20px;background:white;border-radius:50%;transition:0.2s;"></span>
                  </span>
                </label>
              </div>

              <button class="btn btn-primary" id="btn-save-settings">Save Settings</button>
            </div>

            <!-- Issue Sections -->
            <div class="card" style="padding:24px;">
              <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Manage Issue Sections</h3>
              <p style="color:var(--text-secondary);font-size:0.875rem;margin-bottom:16px;">Add or remove sections available for students and mentors to raise issues against.</p>
              
              <div id="sections-list" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
                <div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>
              </div>

              <div style="display:flex;gap:8px;">
                <input type="text" id="new-section-name" class="form-input" placeholder="New Section Name" style="flex:1;">
                <button class="btn btn-primary" id="btn-add-section">Add Section</button>
              </div>
            </div>

            <!-- Theme -->
            <div class="card" style="padding:24px;">
              <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Appearance</h3>
              <div style="display:flex;gap:12px;">
                <button class="btn ${document.documentElement.getAttribute('data-theme')==='dark'?'btn-primary':'btn-secondary'}" id="theme-dark">🌙 Dark Mode</button>
                <button class="btn ${document.documentElement.getAttribute('data-theme')==='light'?'btn-primary':'btn-secondary'}" id="theme-light">☀️ Light Mode</button>
              </div>
            </div>

            <!-- Danger Zone -->
            <div class="card" style="padding:24px;border-color:var(--danger);">
              <h3 style="font-size:0.95rem;font-weight:600;color:var(--danger);margin-bottom:8px;">⚠ Danger Zone</h3>
              <p style="color:var(--text-secondary);font-size:0.875rem;margin-bottom:16px;">These actions are irreversible. Please proceed with caution.</p>
              <button class="btn btn-danger" id="btn-reset-alloc">Reset All Allocations</button>
            </div>

            <!-- Department Migration -->
            <div class="card" style="padding:24px;border-color:#6c47ff44;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;flex-wrap:wrap;gap:10px;">
                <div>
                  <h3 style="font-size:0.95rem;font-weight:600;margin:0;">🏗 Department Name Migration &amp; Auto-Create Classes</h3>
                  <p style="color:var(--text-secondary);font-size:0.8rem;margin-top:4px;">
                    Finds inconsistent department names (e.g. <code>CSE-CORE</code> vs <code>BTech CSE - Core</code>) across all
                    student &amp; faculty records and lets you rename them to one canonical name.
                    Also <strong>auto-creates class entries</strong> from the <code>class</code> field on existing student records.
                  </p>
                </div>
                <button class="btn btn-sm" id="btn-scan-depts"
                  style="background:linear-gradient(135deg,#6c47ff,#a855f7);color:#fff;border:none;white-space:nowrap;min-width:120px;">
                  🔍 Scan Departments
                </button>
              </div>
              <div id="dept-migration-results" style="margin-top:16px;display:none;"></div>
            </div>

            <!-- Data Cleanup -->
            <div class="card" style="padding:24px;border-color:var(--warning);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div>
                  <h3 style="font-size:0.95rem;font-weight:600;margin:0;">🧹 Data Cleanup — Remove Duplicate Records</h3>
                  <p style="color:var(--text-secondary);font-size:0.8rem;margin-top:4px;">
                    Scans Firestore for duplicate user accounts (same email). Keeps the <strong>oldest</strong> record; marks extras for deletion.
                  </p>
                </div>
                <button class="btn btn-secondary btn-sm" id="btn-scan-duplicates" style="white-space:nowrap;min-width:120px;">🔍 Scan Now</button>
              </div>

              <div id="cleanup-results" style="margin-top:16px;display:none;">
                <!-- Populated by JS -->
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  `;

  // ── WEB ISSUES & BUG TRACKER (ADMIN ONLY) ──────────────────────────────
  const webIssuesContainer = document.getElementById('web-issues-container');

  async function loadWebIssues() {
    if (!webIssuesContainer) return;
    webIssuesContainer.innerHTML = '<div style="padding:20px;text-align:center;"><div class="spinner" style="width:24px;height:24px;border-width:2px;margin:0 auto 8px auto;"></div><p style="font-size:0.85rem;color:var(--text-muted);">Loading user-reported web issues...</p></div>';

    try {
      const issues = await WebIssueService.getAll();
      if (!issues || issues.length === 0) {
        webIssuesContainer.innerHTML = `
          <div style="padding:24px;text-align:center;background:var(--bg-secondary);border-radius:12px;border:1px dashed var(--border);">
            <i class="ph ph-check-circle" style="font-size:1.8rem;color:var(--success);margin-bottom:6px;display:block;"></i>
            <p style="font-weight:600;font-size:0.9rem;margin-bottom:2px;">No Web Issues Reported</p>
            <p style="font-size:0.8rem;color:var(--text-muted);">When users report bugs or UI feedback using the 'Web Issue' button, they will appear here.</p>
          </div>
        `;
        return;
      }

      webIssuesContainer.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${issues.map(iss => {
            const statusBadge = iss.status === 'RESOLVED' 
              ? '<span class="badge badge-success">✓ RESOLVED</span>'
              : iss.status === 'IN_PROGRESS'
              ? '<span class="badge badge-warning">⚡ IN PROGRESS</span>'
              : '<span class="badge badge-danger">🔴 OPEN</span>';

            const priorityBadge = iss.priority === 'Critical'
              ? '<span class="badge" style="background:#ef4444;color:#fff;">CRITICAL</span>'
              : iss.priority === 'High'
              ? '<span class="badge" style="background:#f97316;color:#fff;">HIGH</span>'
              : '<span class="badge" style="background:var(--bg-secondary);color:var(--text-secondary);">MEDIUM</span>';

            return `
              <div class="card" style="padding:16px;border-left:4px solid ${iss.status==='RESOLVED'?'#22c55e':iss.status==='IN_PROGRESS'?'#f59e0b':'#ef4444'};">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <h4 style="font-size:0.98rem;font-weight:700;margin:0;color:var(--text-primary);">${iss.title}</h4>
                    <span class="badge badge-info" style="font-size:0.75rem;">${iss.category || 'General'}</span>
                    ${priorityBadge}
                    ${statusBadge}
                  </div>
                  <div style="display:flex;align-items:center;gap:8px;">
                    <select class="form-select status-select-btn" data-id="${iss.id}" style="padding:4px 8px;font-size:0.8rem;max-width:140px;">
                      <option value="OPEN" ${iss.status==='OPEN'?'selected':''}>Set: OPEN</option>
                      <option value="IN_PROGRESS" ${iss.status==='IN_PROGRESS'?'selected':''}>Set: IN PROGRESS</option>
                      <option value="RESOLVED" ${iss.status==='RESOLVED'?'selected':''}>Set: RESOLVED</option>
                    </select>
                    <button class="btn btn-ghost btn-sm delete-issue-btn" data-id="${iss.id}" style="color:var(--danger);" title="Delete Record">
                      🗑 Delete
                    </button>
                  </div>
                </div>

                <p style="font-size:0.88rem;color:var(--text-secondary);line-height:1.5;margin-bottom:12px;white-space:pre-wrap;background:var(--bg-secondary);padding:10px;border-radius:8px;">${iss.description}</p>

                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;font-size:0.78rem;color:var(--text-muted);border-top:1px solid var(--border);padding-top:10px;">
                  <div>
                    <strong>Reporter:</strong> ${iss.reporterName} (${iss.reporterRole}) ${iss.reporterEmail ? '— ' + iss.reporterEmail : ''}
                  </div>
                  <div>
                    <strong>Route URL:</strong> <code style="font-size:0.75rem;background:var(--bg-secondary);padding:2px 6px;border-radius:4px;">${iss.pageUrl || '/'}</code>
                  </div>
                  <div>
                    <strong>Reported:</strong> ${new Date(iss.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      // Wire status selects & delete buttons
      webIssuesContainer.querySelectorAll('.status-select-btn').forEach(sel => {
        sel.addEventListener('change', async (e) => {
          const issueId = e.currentTarget?.dataset?.id || e.target.closest('.status-select-btn')?.dataset?.id;
          if (!issueId) return;
          const newStatus = e.target.value;
          try {
            await WebIssueService.updateStatus(issueId, newStatus);
            showToast(`Issue status updated to ${newStatus}`, 'success');
            loadWebIssues();
          } catch(err) {
            showToast('Failed to update status', 'error');
          }
        });
      });

      webIssuesContainer.querySelectorAll('.delete-issue-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const issueId = e.currentTarget.dataset.id;
          if (!confirm('Delete this web issue report permanently?')) return;
          try {
            await WebIssueService.deleteIssue(issueId);
            showToast('Web issue deleted', 'info');
            loadWebIssues();
          } catch(err) {
            showToast('Failed to delete issue', 'error');
          }
        });
      });

    } catch (err) {
      console.error('Error loading web issues:', err);
      webIssuesContainer.innerHTML = '<p class="text-danger">Failed to load web issues from Firestore.</p>';
    }
  }

  document.getElementById('btn-refresh-web-issues')?.addEventListener('click', loadWebIssues);
  loadWebIssues();

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const { logout } = await import('/js/auth.js'); await logout();
  });

  // Toggle helpers
  function wireToggle(checkId, spanId, key) {
    const chk  = document.getElementById(checkId);
    const span = document.getElementById(spanId);
    chk.addEventListener('change', () => {
      const v = chk.checked;
      setSetting(key, v);
      span.style.background = v ? 'var(--accent)' : 'var(--bg-glass-hover)';
      span.children[0].style.left = v ? '22px' : '2px';
    });
  }

  wireToggle('setting-auto-alloc', 'toggle-auto',  'autoAlloc');
  wireToggle('setting-email-notif','toggle-email', 'emailNotif');

  document.getElementById('btn-save-settings').addEventListener('click', () => {
    setSetting('maxStudents', parseInt(document.getElementById('setting-max-students').value) || 20);
    showToast('Settings saved!', 'success');
  });

  document.getElementById('btn-reset-alloc').addEventListener('click', () => {
    if (confirm('Are you sure you want to reset ALL mentor allocations? This cannot be undone.')) {
      showToast('Allocations reset (offline mode)', 'warning');
    }
  });

  // Sections management
  let sections = [];
  async function loadSections() {
    try {
      sections = await SettingsService.getSections();
      renderSections();
    } catch(err) {
      document.getElementById('sections-list').innerHTML = '<p class="text-danger">Failed to load sections</p>';
    }
  }

  function renderSections() {
    const list = document.getElementById('sections-list');
    list.innerHTML = sections.map((sec, i) => `
      <span class="badge badge-info" style="display:flex;align-items:center;gap:6px;font-size:0.85rem;padding:6px 12px;">
        ${sec}
        <button class="btn-del-section" data-idx="${i}" style="background:none;border:none;color:currentColor;cursor:pointer;opacity:0.7;padding:0;">✕</button>
      </span>
    `).join('');

    list.querySelectorAll('.btn-del-section').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if(!confirm('Delete this section?')) return;
        const idx = parseInt(e.currentTarget.dataset.idx);
        const removed = sections.splice(idx, 1);
        renderSections();
        try {
          await SettingsService.updateSections(sections);
          showToast('Section deleted', 'success');
        } catch(err) {
          sections.splice(idx, 0, removed[0]); // revert
          renderSections();
          showToast('Error deleting section', 'error');
        }
      });
    });
  }

  document.getElementById('btn-add-section').addEventListener('click', async () => {
    const input = document.getElementById('new-section-name');
    const name = input.value.trim();
    if (!name) return;
    if (sections.includes(name)) {
      showToast('Section already exists', 'warning');
      return;
    }
    const btn = document.getElementById('btn-add-section');
    btn.disabled = true;
    sections.push(name);
    renderSections();
    try {
      await SettingsService.updateSections(sections);
      showToast('Section added', 'success');
      input.value = '';
    } catch(err) {
      sections.pop(); // revert
      renderSections();
      showToast('Error adding section', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  loadSections();

  // ── Department Migration & Auto-Create Classes Logic ────────────────────
  const deptResultsEl = document.getElementById('dept-migration-results');

  async function scanDepartmentsAndClasses() {
    const [stuSnap, facSnap, deptSnap, classSnap] = await Promise.all([
      getDocs(collection(db, 'students')),
      getDocs(collection(db, 'faculty')),
      getDocs(collection(db, 'departments')),
      getDocs(collection(db, 'classes'))
    ]);

    const existingDepts = deptSnap.docs.map(d => d.data().name).filter(Boolean);
    const existingClasses = classSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const deptCounts = new Map();
    const classMap = new Map(); // deptName -> Set of classNames

    function addRecord(deptRaw, className, role, docId, colName) {
      if (!deptRaw) return;
      const dept = deptRaw.trim();
      if (!deptCounts.has(dept)) {
        deptCounts.set(dept, { name: dept, studentCount: 0, facultyCount: 0, docs: [] });
      }
      const entry = deptCounts.get(dept);
      if (role === 'STUDENT') entry.studentCount++;
      else entry.facultyCount++;
      entry.docs.push({ id: docId, col: colName });

      if (className && className.trim()) {
        const cName = className.trim();
        if (!classMap.has(dept)) classMap.set(dept, new Set());
        classMap.get(dept).add(cName);
      }
    }

    stuSnap.docs.forEach(d => {
      const data = d.data();
      addRecord(data.department, data.class, 'STUDENT', d.id, 'students');
    });

    facSnap.docs.forEach(d => {
      const data = d.data();
      addRecord(data.department, null, 'FACULTY', d.id, 'faculty');
    });

    return {
      deptCounts: Array.from(deptCounts.values()),
      existingDepts,
      existingClasses,
      classMap
    };
  }

  function renderDeptMigrationUI(data) {
    const { deptCounts, existingDepts, existingClasses, classMap } = data;
    deptResultsEl.style.display = 'block';

    if (deptCounts.length === 0) {
      deptResultsEl.innerHTML = `
        <div style="padding:16px;background:var(--bg-secondary);border-radius:8px;">
          <p style="margin:0;color:var(--text-muted);">No student or faculty records with departments found.</p>
        </div>`;
      return;
    }

    // Default target suggestion
    const targetDeptDefault = existingDepts.includes('BTech CSE - Core')
      ? 'BTech CSE - Core'
      : (existingDepts[0] || 'BTech CSE - Core');

    let html = `
      <div style="margin-bottom:16px;background:var(--bg-secondary);padding:14px;border-radius:8px;border:1px solid var(--border);">
        <h4 style="margin:0 0 8px 0;font-size:0.875rem;">1. Standardize Department Names</h4>
        <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px;">
          Select variations (like <code>CSE-CORE</code>, <code>CSE Core</code>, etc.) and convert them to a uniform department name (e.g. <code>BTech CSE - Core</code>).
        </p>
        <div style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);margin-bottom:12px;">
          <table class="data-table" style="font-size:0.8rem;">
            <thead>
              <tr>
                <th style="width:30px;"><input type="checkbox" id="chk-dept-all-select"></th>
                <th>Found Department Name</th>
                <th>Students</th>
                <th>Faculty</th>
                <th>Total Records</th>
              </tr>
            </thead>
            <tbody>
              ${deptCounts.map((d, i) => `
                <tr>
                  <td><input type="checkbox" class="chk-dept-item" data-idx="${i}"></td>
                  <td><strong>${d.name}</strong> ${existingDepts.includes(d.name) ? '<span class="badge badge-success" style="font-size:0.65rem;">Official Dept</span>' : ''}</td>
                  <td>${d.studentCount}</td>
                  <td>${d.facultyCount}</td>
                  <td>${d.studentCount + d.facultyCount}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <label style="font-size:0.8rem;font-weight:600;">Convert Selected To:</label>
          <input type="text" id="target-dept-name" class="form-input" value="${targetDeptDefault}" style="max-width:240px;font-size:0.85rem;" placeholder="e.g. BTech CSE - Core">
          <button class="btn btn-sm btn-primary" id="btn-execute-dept-merge">⚡ Convert Department Names</button>
        </div>
      </div>

      <div style="background:var(--bg-secondary);padding:14px;border-radius:8px;border:1px solid var(--border);">
        <h4 style="margin:0 0 8px 0;font-size:0.875rem;">2. Auto-Create Missing Classes</h4>
        <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px;">
          Scans all student records for <code>class</code> values and auto-registers any missing classes in the system's class directory.
        </p>
        <div id="class-scan-summary" style="margin-bottom:12px;font-size:0.8rem;"></div>
        <button class="btn btn-sm btn-accent" id="btn-execute-auto-classes">✨ Auto-Create Missing Classes</button>
      </div>
    `;

    deptResultsEl.innerHTML = html;

    // Checkbox toggle all
    const selectAllChk = document.getElementById('chk-dept-all-select');
    selectAllChk?.addEventListener('change', (e) => {
      document.querySelectorAll('.chk-dept-item').forEach(c => c.checked = e.target.checked);
    });

    // Populate class summary
    const classSummaryEl = document.getElementById('class-scan-summary');
    let missingClassesToCreate = [];

    classMap.forEach((classesSet, deptName) => {
      classesSet.forEach(cName => {
        const exists = existingClasses.some(ec => (ec.department || '').toLowerCase() === deptName.toLowerCase() && (ec.className || '').toLowerCase() === cName.toLowerCase());
        if (!exists) {
          missingClassesToCreate.push({ department: deptName, className: cName });
        }
      });
    });

    if (missingClassesToCreate.length === 0) {
      classSummaryEl.innerHTML = `<span style="color:var(--success);">✅ All student class values already exist in the system classes directory.</span>`;
    } else {
      classSummaryEl.innerHTML = `Found <strong style="color:var(--warning);">${missingClassesToCreate.length} missing class(es)</strong> from student data:
        <ul style="margin:6px 0 0 16px;padding:0;color:var(--text-secondary);">
          ${missingClassesToCreate.map(m => `<li><strong>${m.className}</strong> (Dept: ${m.department})</li>`).join('')}
        </ul>`;
    }

    // Merge Depts Handler
    document.getElementById('btn-execute-dept-merge')?.addEventListener('click', async () => {
      const selectedIndexes = [];
      document.querySelectorAll('.chk-dept-item:checked').forEach(c => {
        selectedIndexes.push(parseInt(c.dataset.idx));
      });

      if (selectedIndexes.length === 0) {
        showToast('Please select at least one department variation to convert.', 'warning');
        return;
      }

      const targetDept = document.getElementById('target-dept-name').value.trim();
      if (!targetDept) {
        showToast('Please enter a target department name.', 'warning');
        return;
      }

      const btn = document.getElementById('btn-execute-dept-merge');
      btn.disabled = true; btn.textContent = 'Converting...';

      try {
        let totalDocsToUpdate = [];
        selectedIndexes.forEach(idx => {
          totalDocsToUpdate.push(...deptCounts[idx].docs);
        });

        if (totalDocsToUpdate.length === 0) {
          showToast('No records to update.', 'info');
          return;
        }

        // Write batch in chunks of 400
        let batch = writeBatch(db);
        let count = 0;
        let updatedCount = 0;

        for (let i = 0; i < totalDocsToUpdate.length; i++) {
          const item = totalDocsToUpdate[i];
          batch.update(doc(db, item.col, item.id), { department: targetDept });
          count++;
          updatedCount++;

          if (count >= 400 || i === totalDocsToUpdate.length - 1) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }

        showToast(`Successfully updated ${updatedCount} user record(s) to "${targetDept}"!`, 'success');

        // Re-scan
        const newData = await scanDepartmentsAndClasses();
        renderDeptMigrationUI(newData);
      } catch (err) {
        console.error('Department merge failed:', err);
        showToast('Error converting departments: ' + err.message, 'error');
      } finally {
        btn.disabled = false; btn.textContent = '⚡ Convert Department Names';
      }
    });

    // Auto Create Classes Handler
    document.getElementById('btn-execute-auto-classes')?.addEventListener('click', async () => {
      if (missingClassesToCreate.length === 0) {
        showToast('No missing classes to create.', 'info');
        return;
      }

      const btn = document.getElementById('btn-execute-auto-classes');
      btn.disabled = true; btn.textContent = 'Creating Classes...';

      try {
        let createdCount = 0;
        const { ClassService } = await import('/js/services.js');
        for (const item of missingClassesToCreate) {
          await ClassService.create({ department: item.department, className: item.className });
          createdCount++;
        }

        showToast(`Successfully created ${createdCount} new class(es)!`, 'success');

        // Re-scan
        const newData = await scanDepartmentsAndClasses();
        renderDeptMigrationUI(newData);
      } catch (err) {
        console.error('Auto class creation failed:', err);
        showToast('Error creating classes: ' + err.message, 'error');
      } finally {
        btn.disabled = false; btn.textContent = '✨ Auto-Create Missing Classes';
      }
    });
  }

  document.getElementById('btn-scan-depts')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-scan-depts');
    btn.disabled = true; btn.textContent = 'Scanning...';
    deptResultsEl.style.display = 'block';
    deptResultsEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;padding:16px;">
        <div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>
        <span style="font-size:0.85rem;color:var(--text-secondary);">Scanning department names and student class records...</span>
      </div>`;
    try {
      const data = await scanDepartmentsAndClasses();
      renderDeptMigrationUI(data);
    } catch (err) {
      deptResultsEl.innerHTML = `<p style="color:var(--danger);padding:8px;">Error scanning: ${err.message}</p>`;
    } finally {
      btn.disabled = false; btn.textContent = '🔍 Scan Departments';
    }
  });


  // ── Data Cleanup Logic ────────────────────────────────────────────────────
  const cleanupResultsEl = document.getElementById('cleanup-results');

  /**
   * Scan all students + faculty docs for duplicate emails.
   * Returns an array of groups, each group being an array of records sharing the same email.
   * Groups are sorted so index 0 is the "keeper" (oldest createdAt).
   */
  async function scanDuplicates() {
    const [stuSnap, facSnap] = await Promise.all([
      getDocs(collection(db, 'students')),
      getDocs(collection(db, 'faculty'))
    ]);

    const allRecords = [];
    stuSnap.docs.forEach(d => allRecords.push({ id: d.id, collection: 'students', ...d.data() }));
    facSnap.docs.forEach(d => allRecords.push({ id: d.id, collection: 'faculty',  ...d.data() }));

    const visitedDocs = new Set();
    const duplicateGroups = [];

    // 1. Group by email
    const byEmail = new Map();
    allRecords.forEach(rec => {
      const email = (rec.email || '').toLowerCase().trim();
      if (!email) return;
      if (!byEmail.has(email)) byEmail.set(email, []);
      byEmail.get(email).push(rec);
    });

    byEmail.forEach((recs, email) => {
      if (recs.length < 2) return;
      recs.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
      recs.forEach(r => visitedDocs.add(r.id));
      duplicateGroups.push({ email, type: 'Email', records: recs });
    });

    // 2. Group by Enrollment / Employee ID (for docs not already caught in email dupes)
    const byId = new Map();
    allRecords.forEach(rec => {
      if (visitedDocs.has(rec.id)) return;
      const idVal = (rec.enrollmentNumber || rec.rollNumber || rec.employeeId || '').toLowerCase().trim();
      if (!idVal) return;
      if (!byId.has(idVal)) byId.set(idVal, []);
      byId.get(idVal).push(rec);
    });

    byId.forEach((recs, idVal) => {
      if (recs.length < 2) return;
      recs.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
      duplicateGroups.push({ email: `ID: ${idVal}`, type: 'ID', records: recs });
    });

    return duplicateGroups;
  }

  function renderCleanupResults(groups) {
    cleanupResultsEl.style.display = 'block';

    if (groups.length === 0) {
      cleanupResultsEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;padding:16px;background:var(--bg-secondary);border-radius:8px;border:1px solid var(--success)44;">
          <span style="font-size:1.5rem;">✅</span>
          <div>
            <p style="font-weight:600;color:var(--success);margin:0;">No duplicate records found!</p>
            <p style="font-size:0.8rem;color:var(--text-muted);margin:0;">All student and faculty emails are unique in Firestore.</p>
          </div>
        </div>`;
      return;
    }

    // Collect all "extra" (duplicate, non-keeper) records
    const allExtras = [];
    groups.forEach(g => g.records.slice(1).forEach(r => allExtras.push(r)));

    cleanupResultsEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <div>
          <p style="font-weight:600;margin:0;font-size:0.9rem;">
            Found <span style="color:var(--danger);">${allExtras.length} duplicate record(s)</span>
            across <span style="color:var(--warning);">${groups.length} email(s)</span>
          </p>
          <p style="font-size:0.75rem;color:var(--text-muted);margin:2px 0 0;">
            ✅ = Kept (oldest). 🗑 = Duplicate to delete.
          </p>
        </div>
        <button class="btn btn-danger btn-sm" id="btn-delete-all-dupes" style="white-space:nowrap;">
          🗑 Delete All ${allExtras.length} Duplicates
        </button>
      </div>

      <div style="max-height:400px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:var(--bg-primary);">
        <table class="data-table" style="font-size:0.8rem;">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Collection</th>
              <th>Doc ID</th>
              <th>Created</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="cleanup-tbody">
            ${groups.map(g => g.records.map((rec, idx) => {
              const isKeeper = idx === 0;
              const created = rec.createdAt ? new Date(rec.createdAt).toLocaleString('en-IN') : '—';
              return `<tr id="cleanup-row-${rec.id}" style="${!isKeeper ? 'background:rgba(239,68,68,0.05);' : ''}">
                <td style="font-family:monospace;font-size:0.75rem;">${g.email}</td>
                <td style="font-weight:600;">${rec.name || '—'}</td>
                <td><span class="badge badge-muted" style="font-size:0.7rem;">${rec.role || '—'}</span></td>
                <td style="color:var(--text-muted);">${rec.collection}</td>
                <td style="font-family:monospace;font-size:0.7rem;color:var(--text-muted);">${rec.id.slice(0,12)}…</td>
                <td style="font-size:0.75rem;color:var(--text-muted);">${created}</td>
                <td>
                  ${isKeeper
                    ? '<span class="badge badge-success" style="font-size:0.7rem;">✅ Keep</span>'
                    : '<span class="badge badge-danger"  style="font-size:0.7rem;">🗑 Duplicate</span>'}
                </td>
                <td>
                  ${isKeeper
                    ? '<span style="color:var(--text-muted);font-size:0.75rem;">—</span>'
                    : `<button class="btn btn-xs btn-danger btn-del-single"
                          data-id="${rec.id}"
                          data-col="${rec.collection}"
                          data-mentor="${rec.mentorId || ''}"
                          style="white-space:nowrap;">Delete</button>`}
                </td>
              </tr>`;
            }).join('')).join('')}
          </tbody>
        </table>
      </div>`;

    // Wire individual delete buttons
    cleanupResultsEl.querySelectorAll('.btn-del-single').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id       = btn.dataset.id;
        const col      = btn.dataset.col;
        const mentorId = btn.dataset.mentor;
        if (!confirm(`Delete this duplicate record (ID: ${id.slice(0,12)}…)? This cannot be undone.`)) return;
        btn.disabled = true; btn.textContent = '…';
        try {
          await deleteDuplicateRecord(id, col, mentorId);
          document.getElementById(`cleanup-row-${id}`)?.remove();
          showToast('Duplicate record deleted.', 'success');
        } catch (err) {
          showToast('Failed to delete: ' + err.message, 'error');
          btn.disabled = false; btn.textContent = 'Delete';
        }
      });
    });

    // Wire "Delete All" button
    document.getElementById('btn-delete-all-dupes')?.addEventListener('click', async () => {
      if (!confirm(`Delete ALL ${allExtras.length} duplicate records? This cannot be undone.`)) return;
      const btn = document.getElementById('btn-delete-all-dupes');
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;margin-right:6px;"></div> Deleting…';

      let successCount = 0, failCount = 0;
      for (const rec of allExtras) {
        try {
          await deleteDuplicateRecord(rec.id, rec.collection, rec.mentorId || '');
          document.getElementById(`cleanup-row-${rec.id}`)?.remove();
          successCount++;
        } catch (err) {
          console.error('Delete failed for', rec.id, err);
          failCount++;
        }
      }

      showToast(
        `Done! ${successCount} duplicate(s) deleted.${failCount ? ` ${failCount} failed.` : ''}`,
        successCount > 0 ? 'success' : 'error'
      );

      // Re-scan to refresh the view
      await runScan();
    });
  }

  /**
   * Delete a single duplicate Firestore document.
   * If it's a student with a mentor, decrement the mentor's assignedStudentCount.
   */
  async function deleteDuplicateRecord(docId, colName, mentorId) {
    // If this duplicate student was assigned to a mentor, fix the count
    if (colName === 'students' && mentorId) {
      try {
        await updateDoc(doc(db, 'faculty', mentorId), {
          assignedStudentCount: increment(-1)
        });
      } catch (_) { /* Mentor may already be deleted; ignore */ }
    }
    await deleteDoc(doc(db, colName, docId));
  }

  async function runScan() {
    const scanBtn = document.getElementById('btn-scan-duplicates');
    if (scanBtn) { scanBtn.disabled = true; scanBtn.textContent = 'Scanning…'; }
    cleanupResultsEl.style.display = 'block';
    cleanupResultsEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;padding:16px;">
        <div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>
        <span style="font-size:0.85rem;color:var(--text-secondary);">Scanning all student &amp; faculty records in Firestore…</span>
      </div>`;
    try {
      const groups = await scanDuplicates();
      renderCleanupResults(groups);
    } catch (err) {
      cleanupResultsEl.innerHTML = `<p style="color:var(--danger);padding:8px;">Error scanning: ${err.message}</p>`;
    } finally {
      if (scanBtn) { scanBtn.disabled = false; scanBtn.textContent = '🔍 Scan Now'; }
    }
  }

  document.getElementById('btn-scan-duplicates')?.addEventListener('click', runScan);



  document.getElementById('theme-dark').addEventListener('click', () => {
    document.documentElement.setAttribute('data-theme','dark');
    localStorage.setItem('theme','dark');
    document.getElementById('theme-dark').className = 'btn btn-primary';
    document.getElementById('theme-light').className = 'btn btn-secondary';
    showToast('Dark mode enabled', 'info');
  });

  document.getElementById('theme-light').addEventListener('click', () => {
    document.documentElement.setAttribute('data-theme','light');
    localStorage.setItem('theme','light');
    document.getElementById('theme-light').className = 'btn btn-primary';
    document.getElementById('theme-dark').className  = 'btn btn-secondary';
    showToast('Light mode enabled', 'info');
  });
}
