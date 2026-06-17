export function createDataTable(columns, data, options = {}) {
  const { searchable = true, emptyMessage = 'No data available' } = options;

  let html = `<div class="table-container w-full">`;
  
  if (searchable) {
    html += `
      <div class="flex justify-end mb-4">
        <input type="text" class="form-input" style="max-width: 300px;" placeholder="Search..." id="dt-search">
      </div>
    `;
  }

  html += `
    <div style="overflow-x: auto; border-radius: var(--radius-md); border: 1px solid var(--border);">
      <table class="data-table">
        <thead>
          <tr>
            ${columns.map(col => `<th>${col.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody id="dt-body">
  `;

  if (data.length === 0) {
    html += `
      <tr>
        <td colspan="${columns.length}" style="text-align: center; padding: 32px; color: var(--text-muted);">
          ${emptyMessage}
        </td>
      </tr>
    `;
  } else {
    data.forEach((row, rowIndex) => {
      html += `<tr data-index="${rowIndex}" style="cursor: ${options.onRowClick ? 'pointer' : 'default'}">`;
      columns.forEach(col => {
        let cellData = row[col.key] || '';
        if (col.render) {
          cellData = col.render(row);
        }
        html += `<td>${cellData}</td>`;
      });
      html += `</tr>`;
    });
  }

  html += `
        </tbody>
      </table>
    </div>
  </div>`;

  return {
    html,
    init: (container) => {
      // Row click listener
      if (options.onRowClick) {
        const rows = container.querySelectorAll('#dt-body tr[data-index]');
        rows.forEach(tr => {
          tr.addEventListener('click', () => {
            const index = tr.getAttribute('data-index');
            options.onRowClick(data[index]);
          });
        });
      }

      // Search functionality
      if (searchable) {
        const searchInput = container.querySelector('#dt-search');
        if (searchInput) {
          searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const rows = container.querySelectorAll('#dt-body tr[data-index]');
            
            rows.forEach(tr => {
              const text = tr.textContent.toLowerCase();
              if (text.includes(term)) {
                tr.style.display = '';
              } else {
                tr.style.display = 'none';
              }
            });
          });
        }
      }
    }
  };
}
