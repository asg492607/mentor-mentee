import { db } from '/js/firebase-init.js';
import { collection, query, where, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getCurrentUser } from '/js/auth.js';
import { NotificationService } from '/js/services.js';
import { navigateTo } from '/js/router.js';

let unsubscribe = null;
let currentNotifications = [];

export function initNotificationListener() {
  const user = getCurrentUser();
  if (!user) {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    return;
  }
  
  if (unsubscribe) return; // already listening

  const q = query(collection(db, 'notifications'), where('userId', '==', user.uid));
  
  unsubscribe = onSnapshot(q, (snapshot) => {
    currentNotifications = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    currentNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    renderNotifications();
  });
}

export function stopNotificationListener() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

function timeAgo(dateString) {
    if (!dateString) return '';
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
}

function getIconForType(type) {
    switch(type) {
        case 'MEETING_APPROVED': return 'ph-calendar-check';
        case 'MEETING_REQUESTED': return 'ph-calendar-plus';
        case 'MEETING_REJECTED': return 'ph-calendar-x';
        case 'ISSUE_ESCALATED': return 'ph-warning-circle';
        default: return 'ph-bell';
    }
}

export function renderNotifications() {
  const badge = document.getElementById('global-notification-badge');
  const list = document.getElementById('global-notification-list');
  if (!badge || !list) return; // header not in DOM

  const unread = currentNotifications.filter(n => !n.isRead);
  
  if (unread.length > 0) {
    badge.style.display = 'flex';
    badge.textContent = unread.length > 9 ? '9+' : unread.length;
  } else {
    badge.style.display = 'none';
  }

  if (currentNotifications.length === 0) {
    list.innerHTML = `
      <div class="notification-empty">
        <i class="ph ph-bell-slash"></i>
        <p>No notifications yet</p>
      </div>
    `;
    return;
  }

  list.innerHTML = currentNotifications.slice(0, 50).map(n => `
    <div class="notification-item ${n.isRead ? '' : 'unread'}" data-id="${n.id}">
      <div class="notification-icon">
        <i class="ph ${getIconForType(n.type)}"></i>
      </div>
      <div class="notification-content">
        <h4>${n.title || 'Notification'}</h4>
        <p>${n.message || ''}</p>
        <span class="notification-time">${timeAgo(n.createdAt)}</span>
      </div>
    </div>
  `).join('');
}

// Global UI listeners
document.addEventListener('click', async (e) => {
  const bell = e.target.closest('#global-notification-bell');
  const dropdown = document.getElementById('global-notification-dropdown');
  
  if (bell && dropdown) {
    // If clicked the bell icon/container, but not inside the dropdown itself
    if (!e.target.closest('#global-notification-dropdown')) {
       dropdown.classList.toggle('show');
    }
  } else if (dropdown && dropdown.classList.contains('show') && !e.target.closest('#global-notification-dropdown')) {
    dropdown.classList.remove('show');
  }

  // Click on a notification item
  const item = e.target.closest('.notification-item');
  if (item && dropdown && dropdown.contains(item)) {
    const id = item.dataset.id;
    const n = currentNotifications.find(x => x.id === id);
    if (n && !n.isRead) {
       await NotificationService.markRead(id);
    }
    dropdown.classList.remove('show');
  }

  // Click mark all read
  const markAll = e.target.closest('#global-mark-all-read');
  if (markAll) {
    const user = getCurrentUser();
    if (user) {
      await NotificationService.markAllRead(user.uid);
    }
  }
});
