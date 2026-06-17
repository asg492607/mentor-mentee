import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';

export async function render(container) {
    const user = getUserProfile();
    container.innerHTML = `
        <div class="dashboard-layout fade-in">
            ${createSidebar(user.role, '/admin/users')}
            <div class="main-content">
                ${createHeader('User Management', user)}
                <div class="page-content">
                    <div class="flex justify-between mb-4">
                        <input type="text" class="form-input w-64" placeholder="Search users...">
                        <button class="btn btn-primary">Add User</button>
                    </div>
                    <div class="card p-0">
                        <table class="w-full text-left">
                            <thead class="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th class="p-3">Name</th>
                                    <th class="p-3">Role</th>
                                    <th class="p-3">Department</th>
                                    <th class="p-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr class="border-t border-gray-200 dark:border-gray-700">
                                    <td class="p-3">Admin User</td>
                                    <td class="p-3"><span class="badge badge-info">admin</span></td>
                                    <td class="p-3">All</td>
                                    <td class="p-3">
                                        <button class="btn btn-sm btn-ghost text-primary">Edit</button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
}
