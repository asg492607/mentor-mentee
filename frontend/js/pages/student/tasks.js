import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';

export async function render(container) {
    const user = getUserProfile();
    container.innerHTML = `
        <div class="dashboard-layout fade-in">
            ${createSidebar(user.role, '/student/tasks')}
            <div class="main-content">
                ${createHeader('My Tasks', user)}
                <div class="page-content">
                    <h2 class="text-xl font-bold mb-4">Action Items</h2>
                    <p class="text-muted">No pending tasks.</p>
                </div>
            </div>
        </div>
    `;
}
