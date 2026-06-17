import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';

export async function render(container) {
    const user = getUserProfile();
    container.innerHTML = `
        <div class="dashboard-layout fade-in">
            ${createSidebar(user.role, '/mentor/notes')}
            <div class="main-content">
                ${createHeader('Meeting Notes', user)}
                <div class="page-content">
                    <h2 class="text-xl font-bold mb-4">Recent Notes</h2>
                    <div class="card p-4">
                        <p class="text-muted">No notes available.</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}
