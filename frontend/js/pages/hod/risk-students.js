import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';

export async function render(container) {
    const user = getUserProfile();
    container.innerHTML = `
        <div class="dashboard-layout fade-in">
            ${createSidebar(user.role, '/hod/risk-students')}
            <div class="main-content">
                ${createHeader('At-Risk Students', user)}
                <div class="page-content">
                    <p class="text-muted">List of high and medium risk students.</p>
                </div>
            </div>
        </div>
    `;
}
