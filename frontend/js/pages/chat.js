import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { ChatService, StudentService, FacultyService, MeetingService } from '/js/services.js';
import { escapeHtml } from '/js/utils.js';
import { navigateTo } from '/js/router.js';
import { showToast } from '/js/components/toast.js';

let currentChatUnsubscribe = null;

export function teardown() {
  if (currentChatUnsubscribe) {
    currentChatUnsubscribe();
    currentChatUnsubscribe = null;
  }
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/chat')}
      <div class="main-content" style="display:flex; flex-direction:column; height:100vh; overflow:hidden;">
        ${createHeader('Messages', user)}
        <div class="page-content" style="flex:1; padding:16px; overflow:hidden; display:flex; box-sizing:border-box;">
          <div class="chat-container">
            <div class="chat-sidebar">
              <div class="chat-sidebar-header">
                <h3>Messages</h3>
                <div class="chat-search-wrap">
                  <i class="ph ph-magnifying-glass chat-search-icon"></i>
                  <input type="text" id="chat-search" class="chat-search-input" placeholder="Search conversations...">
                </div>
              </div>
              <div class="chat-list" id="chat-list">
                <div style="padding:40px; text-align:center;"><div class="spinner"></div></div>
              </div>
            </div>
            <div class="chat-main" id="chat-main">
              <div class="chat-empty">
                <i class="ph ph-chats-teardrop" style="font-size:3.5rem; color:#cbd5e1; margin-bottom:12px;"></i>
                <h3 style="font-size:1.1rem; font-weight:600; color:#475569; margin-bottom:4px;">Your Messages</h3>
                <p style="font-size:0.875rem; color:#94a3b8;">Select a contact from the list to start chatting</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const isStudent = String(user.role).toUpperCase() === 'STUDENT';
  
  try {
    let contacts = [];
    if (isStudent) {
      if (user.mentorId) {
        const mentor = await FacultyService.get(user.mentorId);
        if (mentor) contacts.push({ id: mentor.id, name: mentor.name, role: 'FACULTY MENTOR' });
      }
    } else {
      const students = await StudentService.getByMentor(user.id);
      contacts = students.map(s => ({ id: s.id, name: s.name, role: 'STUDENT' }));
    }

    const chatList = document.getElementById('chat-list');
    
    if (contacts.length === 0) {
      chatList.innerHTML = `<div style="padding:32px 16px; color:var(--text-muted); text-align:center; font-size:0.875rem;">
        <i class="ph ph-user-minus" style="font-size:2rem; margin-bottom:8px; display:block; opacity:0.5;"></i>
        No contacts available for messaging.
      </div>`;
      return;
    }

    async function renderContacts(list) {
      if (!list.length) {
        chatList.innerHTML = `<div style="padding:24px; color:var(--text-muted); text-align:center; font-size:0.825rem;">No matching contacts</div>`;
        return;
      }

      // Fetch user conversations to get last messages
      let userConvs = [];
      try {
        userConvs = await ChatService.getUserConversations(user.id, user.role);
      } catch (e) {
        console.warn('Could not fetch conversations for preview', e);
      }

      const convMap = {};
      userConvs.forEach(cv => {
        const otherId = isStudent ? cv.mentorId : cv.studentId;
        if (otherId) convMap[otherId] = cv;
      });

      chatList.innerHTML = list.map(c => {
        const conv = convMap[c.id];
        const previewText = conv && conv.lastMessage ? escapeHtml(conv.lastMessage) : 'Click to open conversation';
        return `
          <div class="chat-contact" data-id="${c.id}" data-name="${escapeHtml(c.name)}" data-role="${escapeHtml(c.role)}">
            <div class="chat-contact-avatar-wrap">
              <div class="chat-contact-avatar">${(c.name || '?')[0].toUpperCase()}</div>
              <span class="chat-status-dot"></span>
            </div>
            <div class="chat-contact-info" style="overflow:hidden;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                <h4 style="font-size:0.9rem; font-weight:600; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1;">${escapeHtml(c.name)}</h4>
                <span class="chat-contact-badge" style="font-size:0.6rem; padding:2px 6px; border-radius:10px; background:var(--accent-light); color:var(--accent); font-weight:700; flex-shrink:0; margin-left:6px;">${c.role}</span>
              </div>
              <p class="chat-contact-preview" style="font-size:0.78rem; color:var(--text-muted); margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${previewText}</p>
            </div>
          </div>
        `;
      }).join('');

      // Attach click handlers
      document.querySelectorAll('.chat-contact').forEach(el => {
        el.addEventListener('click', async () => {
          document.querySelectorAll('.chat-contact').forEach(c => c.classList.remove('active'));
          el.classList.add('active');

          const contactId = el.dataset.id;
          const contactName = el.dataset.name;
          const contactRole = el.dataset.role;
          
          const studentId = isStudent ? user.id : contactId;
          const mentorId = isStudent ? contactId : user.id;

          await openConversation(studentId, mentorId, contactName, contactRole, user);
        });
      });
    }

    await renderContacts(contacts);

    // Live contact search filtering
    const searchInput = document.getElementById('chat-search');
    if (searchInput) {
      searchInput.addEventListener('input', async (e) => {
        const q = e.target.value.toLowerCase().trim();
        const filtered = contacts.filter(c => c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q));
        await renderContacts(filtered);
      });
    }

    // Auto-select first contact
    const firstContactEl = container.querySelector('.chat-contact');
    if (firstContactEl) {
      firstContactEl.click();
    }

  } catch (err) {
    console.error('Failed to load chat contacts:', err);
    document.getElementById('chat-list').innerHTML = `<div style="padding:20px; color:var(--danger); text-align:center;">Failed to load contacts</div>`;
  }
}

async function openConversation(studentId, mentorId, contactName, contactRole, user) {
  const chatMain = document.getElementById('chat-main');
  const isMentorUser = String(user.role).toUpperCase() !== 'STUDENT';

  chatMain.innerHTML = `
    <div class="chat-header" style="padding:14px 20px; border-bottom:1px solid var(--border); background:var(--bg-card); display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">
      <div class="chat-header-user" style="display:flex; align-items:center; gap:12px;">
        <div class="chat-contact-avatar" style="width:40px; height:40px; font-size:1rem;">${(contactName || '?')[0].toUpperCase()}</div>
        <div>
          <h3 style="font-size:1rem; font-weight:700; color:var(--text-primary); margin:0;">${escapeHtml(contactName)}</h3>
          <p style="font-size:0.75rem; color:var(--text-muted); margin:2px 0 0; display:flex; align-items:center; gap:6px;">
            <span style="display:inline-block; width:8px; height:8px; background:var(--success); border-radius:50%;"></span> ${escapeHtml(contactRole)}
          </p>
        </div>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-sm btn-primary" id="btn-quick-call" title="Start Meeting" style="display:flex; align-items:center; gap:6px; font-weight:600; border-radius:20px; padding:6px 16px;">
          <i class="ph ph-video-camera" style="font-size:1.1rem;"></i> Video Call
        </button>
      </div>
    </div>
    <div class="chat-messages" id="chat-messages" style="flex:1; overflow-y:auto; padding:20px 24px; display:flex; flex-direction:column; gap:10px; background:var(--bg-primary);">
      <div style="padding:60px; text-align:center;"><div class="spinner"></div></div>
    </div>
    <div class="chat-input-area" style="padding:14px 20px; background:var(--bg-card); border-top:1px solid var(--border); display:flex; align-items:center; gap:10px; flex-shrink:0;">
      <input type="text" id="chat-input" class="form-input" placeholder="Type your message to ${escapeHtml(contactName)}..." autocomplete="off" style="flex:1; border-radius:24px; padding:10px 18px;">
      <button class="btn btn-primary" id="btn-send-msg" title="Send Message" style="border-radius:50%; width:42px; height:42px; padding:0; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
        <i class="ph ph-paper-plane-right" style="font-size:1.2rem;"></i>
      </button>
    </div>
  `;

  // Quick Video Call handler
  document.getElementById('btn-quick-call')?.addEventListener('click', async () => {
    try {
      if (isMentorUser) {
        const meetingId = await MeetingService.create({
          mentorId: user.id,
          mentorName: user.name,
          studentId: studentId,
          type: '1-on-1 Mentorship Meeting',
          status: 'APPROVED'
        });
        showToast('Meeting created! Redirecting to meeting room...', 'success');
        navigateTo(`/meeting?id=${meetingId}`);
      } else {
        const meetings = await MeetingService.getByStudent(user.id);
        const activeMeeting = meetings.find(m => ['APPROVED', 'ONGOING'].includes(m.status));
        if (activeMeeting) {
          navigateTo(`/meeting?id=${activeMeeting.id}`);
        } else {
          showToast('No active approved meeting. Please request a meeting first.', 'info');
          navigateTo('/student/meetings');
        }
      }
    } catch (e) {
      showToast('Could not start call: ' + e.message, 'error');
    }
  });

  const chatId = await ChatService.getConversation(studentId, mentorId);

  // Unsubscribe previous snapshot listener
  if (currentChatUnsubscribe) {
    currentChatUnsubscribe();
  }

  const messagesContainer = document.getElementById('chat-messages');
  
  // Listen to live messages
  currentChatUnsubscribe = ChatService.listenToMessages(chatId, (messages) => {
    if (messages.length === 0) {
      messagesContainer.innerHTML = `
        <div style="margin:auto; text-align:center; padding:40px; color:var(--text-muted);">
          <i class="ph ph-chat-teardrop-text" style="font-size:2.8rem; color:var(--text-muted); opacity:0.4; margin-bottom:8px; display:block;"></i>
          <p style="font-size:0.925rem; font-weight:600; color:var(--text-primary);">No messages yet with ${escapeHtml(contactName)}</p>
          <p style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Type a message below to start the conversation.</p>
        </div>
      `;
      return;
    }

    messagesContainer.innerHTML = messages.map(m => {
      const isMine = m.senderId === user.id;
      const time = m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      return `
        <div class="chat-bubble ${isMine ? 'mine' : 'theirs'}">
          <div class="chat-text">${escapeHtml(m.text)}</div>
          <div class="chat-time">${time}</div>
        </div>
      `;
    }).join('');

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });

  // Send message handler
  const sendBtn = document.getElementById('btn-send-msg');
  const input = document.getElementById('chat-input');

  const sendMessage = async () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.focus();
    try {
      await ChatService.sendMessage(chatId, user.id, text);
    } catch (err) {
      console.error('Failed to send message:', err);
      showToast('Failed to send message. Check connection.', 'error');
    }
  };

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  
  input.focus();
}
