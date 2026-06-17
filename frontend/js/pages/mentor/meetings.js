import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';

export async function render(container) {
    const user = getUserProfile();
    container.innerHTML = `
        <div class="dashboard-layout fade-in">
            ${createSidebar(user.role, '/mentor/meetings')}
            <div class="main-content">
                ${createHeader('Meeting Schedule', user)}
                <div class="page-content">
                    <h2 class="text-xl font-bold mb-4">Upcoming Meetings</h2>
                    <div class="card p-4">
                        <p class="text-muted">No upcoming meetings.</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}
