import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';

export async function render(container) {
    const user = getUserProfile();
    container.innerHTML = `
        <div class="dashboard-layout fade-in">
            ${createSidebar(user.role, '/mentor/reports')}
            <div class="main-content">
                ${createHeader('Reports & Analytics', user)}
                <div class="page-content">
                    <h2 class="text-xl font-bold mb-4">Mentor Reports</h2>
                    <p class="text-muted">Charts and tables will be rendered here.</p>
                </div>
            </div>
        </div>
    `;
}
