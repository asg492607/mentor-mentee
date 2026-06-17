import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';

export async function render(container) {
    const user = getUserProfile();
    container.innerHTML = `
        <div class="dashboard-layout fade-in">
            ${createSidebar(user.role, '/dean/analytics')}
            <div class="main-content">
                ${createHeader('Institution Analytics', user)}
                <div class="page-content">
                    <p class="text-muted">Deep dive analytics and charts.</p>
                </div>
            </div>
        </div>
    `;
}
