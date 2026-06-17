import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';

export async function render(container) {
    const user = getUserProfile();
    container.innerHTML = `
        <div class="dashboard-layout fade-in">
            ${createSidebar(user.role, '/admin/settings')}
            <div class="main-content">
                ${createHeader('Platform Settings', user)}
                <div class="page-content">
                    <div class="card p-6 max-w-2xl">
                        <form class="space-y-4">
                            <div class="form-group">
                                <label class="form-label">Platform Name</label>
                                <input type="text" class="form-input w-full" value="MentorOS">
                            </div>
                            <div class="form-group flex items-center gap-2">
                                <input type="checkbox" id="email-notifs" checked>
                                <label for="email-notifs">Enable Email Notifications</label>
                            </div>
                            <button type="button" class="btn btn-primary">Save Settings</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `;
}
