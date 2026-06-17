import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';

export async function render(container) {
    const user = getUserProfile();
    container.innerHTML = `
        <div class="dashboard-layout fade-in">
            ${createSidebar(user.role, '/admin/allocation')}
            <div class="main-content">
                ${createHeader('Mentor Allocation', user)}
                <div class="page-content">
                    <div class="card p-6 mb-6">
                        <h2 class="text-lg font-bold mb-4">Auto-Allocate Mentors</h2>
                        <p class="text-muted mb-4">Run the automatic assignment algorithm based on department constraints.</p>
                        <button class="btn btn-primary">Run Allocation</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}
