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

// Convert text URLs into clickable links safely
function formatMessageContent(rawText) {
  const safeText = escapeHtml(rawText);
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return safeText.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:inherit; text-decoration:underline; font-weight:600;">${url}</a>`;
  });
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/chat')}
      <div class="main-content" style="display:flex; flex-direction:column; height:100vh; overflow:hidden;">
        ${createHeader('Messages & Discussions', user)}
        <div class="page-content" style="flex:1; padding:16px; overflow:hidden; display:flex; box-sizing:border-box;">
          <div class="chat-container" style="display:flex; width:100%; height:100%; background:var(--surface, #fff); border-radius:16px; border:1px solid var(--border); overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.05);">
            
            <!-- Left Sidebar -->
            <div class="chat-sidebar" style="width:340px; border-right:1px solid var(--border); display:flex; flex-direction:column; background:var(--surface, #fff); flex-shrink:0;">
              <div class="chat-sidebar-header" style="padding:16px; border-bottom:1px solid var(--border);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                  <h3 style="font-size:1.1rem; font-weight:700; margin:0; color:var(--text);">Chats</h3>
                  <span class="badge badge-primary" style="font-size:0.7rem; font-weight:700;">Realtime</span>
                </div>
                <div class="chat-search-wrap" style="position:relative;">
                  <i class="ph ph-magnifying-glass" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted); font-size:1rem;"></i>
                  <input type="text" id="chat-search" class="form-input" placeholder="Search direct or group chats..." style="width:100%; padding-left:36px; border-radius:20px; font-size:0.85rem;">
                </div>
              </div>

              <!-- Conversation List Container -->
              <div class="chat-list" id="chat-list" style="flex:1; overflow-y:auto; padding:8px;">
                <div style="padding:40px; text-align:center;"><div class="spinner"></div></div>
              </div>
            </div>

            <!-- Right Main Chat Pane -->
            <div class="chat-main" id="chat-main" style="flex:1; display:flex; flex-direction:column; background:var(--bg-primary, #f8fafc); overflow:hidden;">
              <div class="chat-empty" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--text-muted); text-align:center; padding:24px;">
                <div style="width:70px; height:70px; border-radius:50%; background:rgba(99, 102, 241, 0.1); color:var(--primary); display:flex; align-items:center; justify-content:center; font-size:2.2rem; margin-bottom:16px;">
                  <i class="ph ph-chats-teardrop"></i>
                </div>
                <h3 style="font-size:1.2rem; font-weight:700; color:var(--text); margin-bottom:6px;">Lumina Chat & Discussions</h3>
                <p style="font-size:0.875rem; color:var(--text-secondary); max-width:320px; margin:0;">Select the Mentor Cohort Group Chat or a direct contact from the left list to start messaging.</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  `;

  const isStudent = String(user.role).toUpperCase() === 'STUDENT';
  
  try {
    let directContacts = [];
    let groupChatInfo = null;
    let cohortStudents = [];
    let mentorObj = null;

    if (isStudent) {
      if (user.mentorId) {
        mentorObj = await FacultyService.get(user.mentorId);
        if (mentorObj) {
          directContacts.push({ id: mentorObj.id, name: mentorObj.name, role: 'FACULTY MENTOR' });
          // Fetch cohort peers
          try {
            cohortStudents = await StudentService.getByMentor(mentorObj.id);
          } catch (e) {
            cohortStudents = [];
          }
          groupChatInfo = {
            id: `group_${mentorObj.id}`,
            mentorId: mentorObj.id,
            mentorName: mentorObj.name,
            title: `${mentorObj.name}'s Mentee Cohort`,
            students: cohortStudents,
            memberCount: (cohortStudents.length || 1) + 1
          };
        }
      }
    } else {
      // Mentor view
      cohortStudents = await StudentService.getByMentor(user.id);
      directContacts = cohortStudents.map(s => ({ id: s.id, name: s.name, role: 'STUDENT', email: s.email, rollNo: s.rollNo || s.prn }));
      groupChatInfo = {
        id: `group_${user.id}`,
        mentorId: user.id,
        mentorName: user.name,
        title: `All Assigned Mentees (${cohortStudents.length} Students)`,
        students: cohortStudents,
        memberCount: cohortStudents.length + 1
      };
    }

    const chatList = document.getElementById('chat-list');

    async function renderChatList(filterQuery = '') {
      let html = '';

      // 1. Group Chat Card (Pinned at Top)
      if (groupChatInfo && (!filterQuery || groupChatInfo.title.toLowerCase().includes(filterQuery))) {
        html += `
          <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.05em; padding:8px 12px 4px;">
            Group Discussion Room
          </div>
          <div class="chat-contact group-contact card-hover" data-type="group" data-id="${groupChatInfo.id}" 
               style="display:flex; align-items:center; gap:12px; padding:12px; border-radius:12px; cursor:pointer; margin-bottom:12px; border:1px solid rgba(139, 92, 246, 0.25); background:linear-gradient(135deg, rgba(139, 92, 246, 0.06), rgba(99, 102, 241, 0.04)); transition:all 0.15s ease;">
            
            <div style="position:relative; width:44px; height:44px; border-radius:12px; background:linear-gradient(135deg,#8b5cf6,#6366f1); color:#fff; display:flex; align-items:center; justify-content:center; font-size:1.3rem; flex-shrink:0; box-shadow:0 4px 10px rgba(139, 92, 246, 0.25);">
              <i class="ph ph-users-three"></i>
              <span style="position:absolute; bottom:-2px; right:-2px; width:12px; height:12px; border-radius:50%; background:#10b981; border:2px solid #fff;"></span>
            </div>

            <div style="flex:1; overflow:hidden;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                <h4 style="font-size:0.92rem; font-weight:700; margin:0; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                  ${escapeHtml(groupChatInfo.title)}
                </h4>
              </div>
              <p style="font-size:0.78rem; color:#7c3aed; font-weight:600; margin:0; display:flex; align-items:center; gap:4px;">
                <i class="ph ph-broadcast"></i> Mentor & Whole Batch (${groupChatInfo.memberCount} Members)
              </p>
            </div>
          </div>
        `;
      }

      // 2. Direct 1-on-1 Messages Header
      html += `
        <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.05em; padding:8px 12px 4px;">
          Direct Messages (${directContacts.length})
        </div>
      `;

      const filteredContacts = directContacts.filter(c => 
        !filterQuery || c.name.toLowerCase().includes(filterQuery) || c.role.toLowerCase().includes(filterQuery)
      );

      if (filteredContacts.length === 0 && !groupChatInfo) {
        html += `<div style="padding:24px 12px; color:var(--text-muted); text-align:center; font-size:0.85rem;">No contacts found</div>`;
      } else {
        html += filteredContacts.map(c => {
          return `
            <div class="chat-contact direct-contact card-hover" data-type="direct" data-id="${c.id}" data-name="${escapeHtml(c.name)}" data-role="${escapeHtml(c.role)}"
                 style="display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:12px; cursor:pointer; margin-bottom:4px; transition:all 0.15s ease; border:1px solid transparent;">
              
              <div style="position:relative; width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg,#06b6d4,#3b82f6); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.9rem; flex-shrink:0;">
                ${(c.name || '?')[0].toUpperCase()}
                <span style="position:absolute; bottom:0; right:0; width:10px; height:10px; border-radius:50%; background:#10b981; border:2px solid #fff;"></span>
              </div>

              <div style="flex:1; overflow:hidden;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                  <h4 style="font-size:0.88rem; font-weight:600; margin:0; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${escapeHtml(c.name)}
                  </h4>
                  <span class="badge ${c.role === 'STUDENT' ? 'badge-info' : 'badge-primary'}" style="font-size:0.65rem; padding:1px 6px;">${c.role === 'STUDENT' ? 'Student' : 'Mentor'}</span>
                </div>
                <p style="font-size:0.76rem; color:var(--text-muted); margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                  Click to open 1-on-1 direct message
                </p>
              </div>
            </div>
          `;
        }).join('');
      }

      chatList.innerHTML = html;

      // Event Handlers for Contact selection
      chatList.querySelectorAll('.chat-contact').forEach(el => {
        el.addEventListener('click', async () => {
          chatList.querySelectorAll('.chat-contact').forEach(c => {
            c.classList.remove('active');
            c.style.background = c.classList.contains('group-contact') ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.06), rgba(99, 102, 241, 0.04))' : 'transparent';
            c.style.borderColor = c.classList.contains('group-contact') ? 'rgba(139, 92, 246, 0.25)' : 'transparent';
          });

          el.classList.add('active');
          el.style.background = 'rgba(99, 102, 241, 0.12)';
          el.style.borderColor = 'var(--primary)';

          const chatType = el.dataset.type;
          if (chatType === 'group') {
            await openGroupConversation(groupChatInfo, user);
          } else {
            const contactId = el.dataset.id;
            const contactName = el.dataset.name;
            const contactRole = el.dataset.role;
            const studentId = isStudent ? user.id : contactId;
            const mentorId = isStudent ? contactId : user.id;
            await openDirectConversation(studentId, mentorId, contactName, contactRole, user);
          }
        });
      });
    }

    await renderChatList();

    // Search filter listener
    const searchInput = document.getElementById('chat-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        renderChatList(query);
      });
    }

    // Auto-select group chat by default if exists
    const groupEl = container.querySelector('.group-contact');
    if (groupEl) {
      groupEl.click();
    } else {
      const firstDirectEl = container.querySelector('.direct-contact');
      if (firstDirectEl) firstDirectEl.click();
    }

  } catch (err) {
    console.error('Failed to load chat contacts:', err);
    document.getElementById('chat-list').innerHTML = `<div style="padding:20px; color:var(--danger); text-align:center;">Failed to load contacts: ${escapeHtml(err.message)}</div>`;
  }
}

/**
 * Open Group Conversation (Mentor + whole cohort of students)
 */
async function openGroupConversation(groupChatInfo, user) {
  const chatMain = document.getElementById('chat-main');
  const isMentorUser = String(user.role).toUpperCase() !== 'STUDENT';

  chatMain.innerHTML = `
    <!-- Group Chat Header -->
    <div class="chat-header" style="padding:14px 20px; border-bottom:1px solid var(--border); background:var(--surface, #fff); display:flex; align-items:center; justify-content:space-between; flex-shrink:0; box-shadow:0 1px 4px rgba(0,0,0,0.03);">
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="width:42px; height:42px; border-radius:12px; background:linear-gradient(135deg,#8b5cf6,#6366f1); color:#fff; display:flex; align-items:center; justify-content:center; font-size:1.3rem; box-shadow:0 4px 10px rgba(139, 92, 246, 0.25);">
          <i class="ph ph-users-three"></i>
        </div>
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <h3 style="font-size:1.05rem; font-weight:800; color:var(--text); margin:0;">${escapeHtml(groupChatInfo.title)}</h3>
            <span class="badge" style="background:#8b5cf6; color:#fff; font-size:0.68rem; font-weight:700;">Cohort Group</span>
          </div>
          <p style="font-size:0.78rem; color:var(--text-muted); margin:2px 0 0; display:flex; align-items:center; gap:8px;">
            <span><i class="ph ph-user-circle"></i> Mentor: <strong>${escapeHtml(groupChatInfo.mentorName)}</strong></span>
            <span>•</span>
            <span id="btn-view-members" style="color:var(--primary); font-weight:600; cursor:pointer; text-decoration:underline;">
              <i class="ph ph-users"></i> ${groupChatInfo.memberCount} Members
            </span>
          </p>
        </div>
      </div>

      <div style="display:flex; gap:8px; align-items:center;">
        <button class="btn btn-secondary btn-sm" id="btn-cohort-members" title="View Group Members" style="border-radius:10px; display:flex; align-items:center; gap:6px; font-weight:600;">
          <i class="ph ph-users"></i> Members
        </button>
        <button class="btn btn-primary btn-sm" id="btn-cohort-video" title="Launch Cohort Video Room" style="border-radius:10px; display:flex; align-items:center; gap:6px; font-weight:700; background:linear-gradient(135deg,#8b5cf6,#6366f1); border:none;">
          <i class="ph ph-video-camera" style="font-size:1.1rem;"></i> Group Video Meet
        </button>
      </div>
    </div>

    <!-- Messages Container -->
    <div class="chat-messages" id="chat-messages" style="flex:1; overflow-y:auto; padding:20px 24px; display:flex; flex-direction:column; gap:14px; background:var(--bg-primary, #f8fafc);">
      <div style="padding:60px; text-align:center;"><div class="spinner"></div></div>
    </div>

    <!-- Message Input Bar -->
    <div class="chat-input-area" style="padding:14px 20px; background:var(--surface, #fff); border-top:1px solid var(--border); display:flex; align-items:center; gap:10px; flex-shrink:0;">
      <input type="text" id="chat-input" class="form-input" placeholder="Post a message or announcement to the entire cohort..." autocomplete="off" style="flex:1; border-radius:24px; padding:11px 20px; font-size:0.9rem;">
      <button class="btn btn-primary" id="btn-send-msg" title="Send Message" style="border-radius:50%; width:44px; height:44px; padding:0; display:flex; align-items:center; justify-content:center; flex-shrink:0; background:linear-gradient(135deg,#8b5cf6,#6366f1); border:none; box-shadow:0 4px 12px rgba(139, 92, 246, 0.3);">
        <i class="ph ph-paper-plane-right" style="font-size:1.2rem;"></i>
      </button>
    </div>
  `;

  // Members Modal View Handler
  const showMembersModal = () => {
    openMembersDrawer(groupChatInfo);
  };
  document.getElementById('btn-cohort-members')?.addEventListener('click', showMembersModal);
  document.getElementById('btn-view-members')?.addEventListener('click', showMembersModal);

  // Group Video Call Handler
  document.getElementById('btn-cohort-video')?.addEventListener('click', async () => {
    try {
      if (isMentorUser) {
        const meetingId = await MeetingService.create({
          mentorId: user.id,
          mentorName: user.name,
          studentId: 'ALL',
          isGroup: true,
          type: 'Cohort Batch Mentoring Session',
          description: `Group session for ${groupChatInfo.title}`,
          status: 'APPROVED',
          scheduledAt: new Date().toISOString()
        });
        
        // Broadcast instant meeting link to group chat
        const meetingRoomUrl = `${window.location.origin}/#/meeting-room?id=${meetingId}`;
        await ChatService.sendMessage(
          groupChatInfo.id, 
          user.id, 
          `🚨 Group Video Mentoring Session started! Click to join: ${meetingRoomUrl}`,
          user.name,
          'MENTOR'
        );

        showToast('Group meeting launched! Redirecting to room...', 'success');
        navigateTo(`/meeting-room?id=${meetingId}`);
      } else {
        // Student checking for active group meeting
        const meetings = await MeetingService.getByStudent(user.id);
        const activeMeeting = meetings.find(m => (m.isGroup || m.studentId === 'ALL') && ['APPROVED', 'ONGOING'].includes(m.status));
        if (activeMeeting) {
          navigateTo(`/meeting-room?id=${activeMeeting.id}`);
        } else {
          showToast('No active group meeting session running. Your mentor will start the call.', 'info');
        }
      }
    } catch (e) {
      showToast('Could not launch video meeting: ' + e.message, 'error');
    }
  });

  // Initialize group chat document in Firestore
  const chatId = await ChatService.getGroupConversation(
    groupChatInfo.mentorId,
    groupChatInfo.mentorName,
    groupChatInfo.students
  );

  // Teardown previous listener
  if (currentChatUnsubscribe) {
    currentChatUnsubscribe();
  }

  const messagesContainer = document.getElementById('chat-messages');

  // Realtime snapshot listener for group messages
  currentChatUnsubscribe = ChatService.listenToMessages(chatId, (messages) => {
    if (messages.length === 0) {
      messagesContainer.innerHTML = `
        <div style="margin:auto; text-align:center; padding:40px; color:var(--text-muted);">
          <div style="width:60px; height:60px; border-radius:50%; background:rgba(139, 92, 246, 0.1); color:#8b5cf6; display:flex; align-items:center; justify-content:center; font-size:1.8rem; margin:0 auto 12px;">
            <i class="ph ph-chat-centered-text"></i>
          </div>
          <h4 style="font-size:1rem; font-weight:700; color:var(--text); margin-bottom:4px;">Welcome to the Cohort Group Chat</h4>
          <p style="font-size:0.85rem; color:var(--text-secondary); max-width:360px; margin:0 auto;">
            This is the shared space for ${escapeHtml(groupChatInfo.mentorName)} and all assigned mentees to discuss updates, ask doubts, and share resources.
          </p>
        </div>
      `;
      return;
    }

    messagesContainer.innerHTML = messages.map(m => {
      const isMine = m.senderId === user.id;
      const isMentorSender = (m.senderRole === 'MENTOR' || m.senderRole === 'FACULTY' || m.senderId === groupChatInfo.mentorId);
      const time = m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const senderName = m.senderName || (isMine ? 'You' : (isMentorSender ? groupChatInfo.mentorName : 'Mentee'));

      return `
        <div style="display:flex; flex-direction:column; align-items:${isMine ? 'flex-end' : 'flex-start'}; gap:4px;">
          ${!isMine ? `
            <div style="display:flex; align-items:center; gap:6px; font-size:0.75rem; color:var(--text-muted); margin-left:4px;">
              <strong style="color:var(--text);">${escapeHtml(senderName)}</strong>
              ${isMentorSender ? '<span class="badge" style="background:#8b5cf6; color:#fff; font-size:0.62rem; padding:1px 5px;">👑 Mentor</span>' : '<span class="badge badge-info" style="font-size:0.62rem; padding:1px 5px;">Student</span>'}
            </div>
          ` : ''}

          <div class="chat-bubble ${isMine ? 'mine' : 'theirs'}" style="${isMine ? 'background:linear-gradient(135deg,#8b5cf6,#6366f1); color:#fff; border-radius:18px 18px 4px 18px;' : 'background:var(--surface,#fff); border:1px solid var(--border); border-radius:18px 18px 18px 4px;'} padding:10px 16px; max-width:75%; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <div class="chat-text" style="font-size:0.9rem; line-height:1.45; word-break:break-word;">
              ${formatMessageContent(m.text)}
            </div>
            <div class="chat-time" style="font-size:0.7rem; text-align:right; margin-top:4px; opacity:${isMine ? '0.85' : '0.6'};">
              ${time}
            </div>
          </div>
        </div>
      `;
    }).join('');

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });

  // Message Send Logic
  const sendBtn = document.getElementById('btn-send-msg');
  const input = document.getElementById('chat-input');

  const sendMessage = async () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.focus();
    try {
      const roleStr = isMentorUser ? 'MENTOR' : 'STUDENT';
      await ChatService.sendMessage(chatId, user.id, text, user.name, roleStr);
    } catch (err) {
      console.error('Failed to send group message:', err);
      showToast('Failed to send message: ' + err.message, 'error');
    }
  };

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  input.focus();
}

/**
 * Open 1-on-1 Direct Conversation
 */
async function openDirectConversation(studentId, mentorId, contactName, contactRole, user) {
  const chatMain = document.getElementById('chat-main');
  const isMentorUser = String(user.role).toUpperCase() !== 'STUDENT';

  chatMain.innerHTML = `
    <!-- Direct Chat Header -->
    <div class="chat-header" style="padding:14px 20px; border-bottom:1px solid var(--border); background:var(--surface, #fff); display:flex; align-items:center; justify-content:space-between; flex-shrink:0; box-shadow:0 1px 4px rgba(0,0,0,0.03);">
      <div class="chat-header-user" style="display:flex; align-items:center; gap:12px;">
        <div style="width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg,#06b6d4,#3b82f6); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1rem;">
          ${(contactName || '?')[0].toUpperCase()}
        </div>
        <div>
          <h3 style="font-size:1.05rem; font-weight:700; color:var(--text); margin:0;">${escapeHtml(contactName)}</h3>
          <p style="font-size:0.75rem; color:var(--text-muted); margin:2px 0 0; display:flex; align-items:center; gap:6px;">
            <span style="display:inline-block; width:8px; height:8px; background:var(--success); border-radius:50%;"></span> ${escapeHtml(contactRole)}
          </p>
        </div>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-sm btn-primary" id="btn-quick-call" title="Start Direct Meeting" style="display:flex; align-items:center; gap:6px; font-weight:600; border-radius:20px; padding:6px 16px;">
          <i class="ph ph-video-camera" style="font-size:1.1rem;"></i> Video Call
        </button>
      </div>
    </div>

    <!-- Messages Container -->
    <div class="chat-messages" id="chat-messages" style="flex:1; overflow-y:auto; padding:20px 24px; display:flex; flex-direction:column; gap:10px; background:var(--bg-primary, #f8fafc);">
      <div style="padding:60px; text-align:center;"><div class="spinner"></div></div>
    </div>

    <!-- Message Input Bar -->
    <div class="chat-input-area" style="padding:14px 20px; background:var(--surface, #fff); border-top:1px solid var(--border); display:flex; align-items:center; gap:10px; flex-shrink:0;">
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
          status: 'APPROVED',
          scheduledAt: new Date().toISOString()
        });
        showToast('Meeting created! Redirecting to room...', 'success');
        navigateTo(`/meeting-room?id=${meetingId}`);
      } else {
        const meetings = await MeetingService.getByStudent(user.id);
        const activeMeeting = meetings.find(m => ['APPROVED', 'ONGOING'].includes(m.status));
        if (activeMeeting) {
          navigateTo(`/meeting-room?id=${activeMeeting.id}`);
        } else {
          showToast('No active approved meeting. Please request a meeting from the Meetings page.', 'info');
          navigateTo('/student/meetings');
        }
      }
    } catch (e) {
      showToast('Could not start call: ' + e.message, 'error');
    }
  });

  const chatId = await ChatService.getConversation(studentId, mentorId);

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
        <div class="chat-bubble ${isMine ? 'mine' : 'theirs'}" style="${isMine ? 'background:var(--primary); color:#fff; align-self:flex-end; border-radius:18px 18px 4px 18px;' : 'background:var(--surface,#fff); border:1px solid var(--border); align-self:flex-start; border-radius:18px 18px 18px 4px;'} padding:10px 16px; max-width:75%;">
          <div class="chat-text" style="font-size:0.9rem; line-height:1.45; word-break:break-word;">
            ${formatMessageContent(m.text)}
          </div>
          <div class="chat-time" style="font-size:0.7rem; text-align:right; margin-top:4px; opacity:${isMine ? '0.85' : '0.6'};">
            ${time}
          </div>
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
      const roleStr = isMentorUser ? 'MENTOR' : 'STUDENT';
      await ChatService.sendMessage(chatId, user.id, text, user.name, roleStr);
    } catch (err) {
      console.error('Failed to send message:', err);
      showToast('Failed to send message: ' + err.message, 'error');
    }
  };

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  input.focus();
}

/**
 * Open Group Members Drawer Modal
 */
function openMembersDrawer(groupChatInfo) {
  document.querySelectorAll('#group-members-modal-root').forEach(e => e.remove());

  const modalRoot = document.createElement('div');
  modalRoot.id = 'group-members-modal-root';
  modalRoot.className = 'modal-backdrop';
  modalRoot.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:9999; padding:16px; animation:fadeIn 0.2s ease-out;';

  modalRoot.innerHTML = `
    <div class="modal-card card" style="width:100%; max-width:500px; border-radius:20px; padding:24px; background:var(--surface, #fff); border:1px solid var(--border); box-shadow:0 20px 40px rgba(0,0,0,0.2);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border); padding-bottom:12px;">
        <div>
          <h3 style="font-size:1.15rem; font-weight:700; margin:0; color:var(--text);">Cohort Members</h3>
          <p style="font-size:0.8rem; color:var(--text-muted); margin:2px 0 0 0;">${groupChatInfo.memberCount} total participants in this cohort</p>
        </div>
        <button id="close-members-modal" class="btn btn-ghost" style="width:32px; height:32px; padding:0; border-radius:50%; display:flex; align-items:center; justify-content:center;">
          <i class="ph ph-x" style="font-size:1.1rem;"></i>
        </button>
      </div>

      <div style="display:flex; flex-direction:column; gap:12px; max-height:55vh; overflow-y:auto; padding-right:4px;">
        
        <!-- Mentor Row -->
        <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-radius:12px; background:rgba(139, 92, 246, 0.08); border:1px solid rgba(139, 92, 246, 0.2);">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg,#8b5cf6,#6366f1); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.85rem;">
              ${(groupChatInfo.mentorName || 'M')[0]}
            </div>
            <div>
              <div style="font-size:0.9rem; font-weight:700; color:var(--text);">${escapeHtml(groupChatInfo.mentorName)}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">Faculty Mentor (Group Lead)</div>
            </div>
          </div>
          <span class="badge" style="background:#8b5cf6; color:#fff; font-size:0.7rem;">Mentor</span>
        </div>

        <!-- Student Rows -->
        ${(groupChatInfo.students || []).map((s, idx) => `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-radius:10px; border:1px solid var(--border); background:var(--card-bg, #fff);">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,#06b6d4,#3b82f6); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.8rem;">
                ${(s.name || '?')[0].toUpperCase()}
              </div>
              <div>
                <div style="font-size:0.88rem; font-weight:600; color:var(--text);">${escapeHtml(s.name)}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">${s.rollNo || s.prn || s.email || `Student #${idx + 1}`}</div>
              </div>
            </div>
            <span class="badge badge-info" style="font-size:0.68rem;">Mentee</span>
          </div>
        `).join('')}

      </div>
    </div>
  `;

  document.body.appendChild(modalRoot);

  modalRoot.querySelector('#close-members-modal').onclick = () => modalRoot.remove();
  modalRoot.onclick = (e) => {
    if (e.target === modalRoot) modalRoot.remove();
  };
}
