import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { IssueService } from '/js/services.js';

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/section/dashboard')}
      <div class="main-content">
        ${createHeader(`${user.department || 'Section'} Dashboard`, user)}
        <div class="page-content" id="section-dash-content">
          <div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  try {
    const issues = await IssueService.getEscalated(user.department);
    const open = issues.filter(i => i.status !== 'RESOLVED').length;
    const resolved = issues.filter(i => i.status === 'RESOLVED').length;

    (container.querySelector('#section-dash-content') || {}).innerHTML = `
      <div class="stats-grid" style="grid-template-columns:1fr 1fr;margin-bottom:24px;">
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--warning)22;">
            <svg viewBox="0 0 24 24" style="fill:var(--warning);width:20px;height:20px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          </div>
          <div class="stat-label">Open Issues</div>
          <div class="stat-value">${open}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--success)22;">
            <svg viewBox="0 0 24 24" style="fill:var(--success);width:20px;height:20px;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          </div>
          <div class="stat-label">Resolved Issues</div>
          <div class="stat-value">${resolved}</div>
        </div>
      </div>

      <!-- Bulk Registration -->
      <div class="card" style="margin-bottom:24px;">
        <div class="card-header">
          <h3>Bulk User Registration</h3>
          <span style="font-size:0.8rem;color:var(--text-secondary);">Register staff for your section via CSV</span>
        </div>
        <div style="padding:16px; display:flex; gap:12px; align-items:center;">
          <button id="btn-sec-download-template" class="btn btn-secondary">⬇️ Download Template</button>
          <label class="btn btn-primary" style="margin:0;cursor:pointer;">
            📁 Bulk Import (CSV)
            <input type="file" id="sec-csv-upload" accept=".csv" style="display:none;">
          </label>
        </div>
      </div>

      <div class="card" style="padding:24px;text-align:center;">
        <h3 style="margin-bottom:12px;">Welcome to the ${user.department || 'Section'} Portal</h3>
        <p style="color:var(--text-secondary);margin-bottom:24px;">Manage issues escalated by Mentors specifically for your department.</p>
        <a class="btn btn-primary" href="#/section/escalations">View Escalations</a>
      </div>
    `;

    // --- Bulk CSV Upload Logic ---
    const btnDownloadTemplate = document.getElementById('btn-sec-download-template');
    if (btnDownloadTemplate) {
      btnDownloadTemplate.addEventListener('click', () => {
        const csvContent = "role,name,email,password,employeeId\nFACULTY,Jane Doe,jane@example.com,pass123,EMP001\n";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "Staff_Registration_Template.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    }

    const csvUpload = document.getElementById('sec-csv-upload');
    if (csvUpload) {
      csvUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!confirm(\`Are you sure you want to bulk import staff into \${user.department}?\`)) {
          e.target.value = '';
          return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
          const text = event.target.result;
          const lines = text.split('\\n').map(l => l.trim()).filter(l => l.length > 0);
          if (lines.length <= 1) return showToast('CSV is empty or only contains headers', 'warning');

          const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
          const expected = ['role', 'name', 'email', 'password'];
          for (const req of expected) {
            if (!headers.includes(req)) return showToast(\`Missing required column: \${req}\`, 'error');
          }

          showToast(\`Processing \${lines.length - 1} staff for \${user.department}...\`, 'info');
          let successCount = 0; let failCount = 0;
          const { AdminService } = await import('/js/services.js');

          for (let i = 1; i < lines.length; i++) {
            try {
              const cols = lines[i].split(',').map(c => c.trim());
              const row = {};
              headers.forEach((h, idx) => { row[h] = cols[idx] || ''; });
              if (!row.role || !row.email || !row.password) { failCount++; continue; }

              const data = {
                role: row.role.toUpperCase(),
                name: row.name,
                email: row.email,
                password: row.password,
                department: user.department,
                employeeId: row.employeeid || null
              };

              await AdminService.createUser(data);
              successCount++;
            } catch(err) {
              console.error(err);
              failCount++;
            }
          }
          e.target.value = '';
          showToast(\`Bulk Import Complete. \${successCount} successful, \${failCount} failed.\`, successCount > 0 ? 'success' : 'warning');
          if (successCount > 0) setTimeout(() => render(container), 1500);
        };
        reader.readAsText(file);
      });
    }

  } catch (err) {
    (container.querySelector('#section-dash-content') || {}).innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error</h3><p>${err.message}</p></div>`;
  }
}

