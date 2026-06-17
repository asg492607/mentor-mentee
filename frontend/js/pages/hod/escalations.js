import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';

export async function render(container) {
    const user = getUserProfile();
    container.innerHTML = `
        <div class="dashboard-layout fade-in">
            ${createSidebar(user.role, '/hod/escalations')}
            <div class="main-content">
                ${createHeader('Escalations', user)}
                <div class="page-content">
                    <p class="text-muted">Escalated issues requiring HOD attention.</p>
                </div>
            </div>
        </div>
    `;
}
