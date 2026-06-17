import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';

export async function render(container) {
    const user = getUserProfile();
    container.innerHTML = `
        <div class="dashboard-layout fade-in">
            ${createSidebar(user.role, '/dean/dashboard')}
            <div class="main-content">
                ${createHeader('Dean Dashboard', user)}
                <div class="page-content">
                    <p class="text-muted">Institution-wide overview and stats.</p>
                </div>
            </div>
        </div>
    `;
}
