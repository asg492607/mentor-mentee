import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { ChatService, StudentService, FacultyService } from '/js/services.js';

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
      <div class="main-content">
        ${createHeader('Messages', user)}
        <div class="page-content" style="padding:0; height: calc(100vh - 70px); overflow:hidden;">
          <div class="chat-container">
            <div class="chat-sidebar">
              <div class="chat-sidebar-header">
                <h3>Conversations</h3>
              </div>
              <div class="chat-list" id="chat-list">
                <div style="padding:20px; text-align:center;"><div class="spinner"></div></div>
              </div>
            </div>
            <div class="chat-main" id="chat-main">
              <div class="chat-empty">
                <i class="ph ph-chat-circle-dots"></i>
                <p>Select a conversation to start messaging</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Determine role
  const isStudent = user.role.toUpperCase() === 'STUDENT';
  
  try {
    // If student, they only chat with their mentor. If mentor, they chat with all their students.
    let contacts = [];
    if (isStudent) {
      if (user.mentorId) {
        const mentor = await FacultyService.get(user.mentorId);
        if (mentor) contacts.push({ id: mentor.id, name: mentor.name, role: 'MENTOR' });
      }
    } else {
      const students = await StudentService.getByMentor(user.id);
      contacts = students.map(s => ({ id: s.id, name: s.name, role: 'STUDENT' }));
    }

    const chatList = document.getElementById('chat-list');
    
    if (contacts.length === 0) {
      chatList.innerHTML = `<div style="padding:20px; color:var(--text-muted); text-align:center;">No contacts available.</div>`;
      return;
    }

    // Render contacts
    chatList.innerHTML = contacts.map(c => `
      <div class="chat-contact" data-id="${c.id}" data-name="${c.name}">
        <div class="avatar avatar-sm">${c.name.charAt(0)}</div>
        <div class="chat-contact-info">
          <h4>${c.name}</h4>
          <p>${c.role}</p>
        </div>
      </div>
    `).join('');

    // Attach click listeners to contacts
    document.querySelectorAll('.chat-contact').forEach(el => {
      el.addEventListener('click', async () => {
        // Active state
        document.querySelectorAll('.chat-contact').forEach(c => c.classList.remove('active'));
        el.classList.add('active');

        const contactId = el.dataset.id;
        const contactName = el.dataset.name;
        
        const studentId = isStudent ? user.id : contactId;
        const mentorId = isStudent ? contactId : user.id;

        await openConversation(studentId, mentorId, contactName, user.id);
      });
    });

  } catch (err) {
    console.error(err);
    document.getElementById('chat-list').innerHTML = `<div style="padding:20px; color:var(--danger);">Error loading contacts</div>`;
  }
}

async function openConversation(studentId, mentorId, contactName, currentUserId) {
  const chatMain = document.getElementById('chat-main');
  chatMain.innerHTML = `
    <div class="chat-header">
      <div class="avatar avatar-sm">${contactName.charAt(0)}</div>
      <h3>${contactName}</h3>
    </div>
    <div class="chat-messages" id="chat-messages">
      <div style="padding:20px; text-align:center;"><div class="spinner"></div></div>
    </div>
    <div class="chat-input-area">
      <input type="text" id="chat-input" class="form-input" placeholder="Type a message..." autocomplete="off">
      <button class="btn btn-primary" id="btn-send-msg">
        <i class="ph ph-paper-plane-right"></i>
      </button>
    </div>
  `;

  const chatId = await ChatService.getConversation(studentId, mentorId);

  // Unsubscribe from previous if exists
  if (currentChatUnsubscribe) {
    currentChatUnsubscribe();
  }

  const messagesContainer = document.getElementById('chat-messages');
  
  // Listen to messages
  currentChatUnsubscribe = ChatService.listenToMessages(chatId, (messages) => {
    if (messages.length === 0) {
      messagesContainer.innerHTML = `<div style="padding:40px; text-align:center; color:var(--text-muted);">No messages yet. Say hi!</div>`;
      return;
    }

    messagesContainer.innerHTML = messages.map(m => {
      const isMine = m.senderId === currentUserId;
      const time = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="chat-bubble ${isMine ? 'mine' : 'theirs'}">
          <div class="chat-text">${m.text}</div>
          <div class="chat-time">${time}</div>
        </div>
      `;
    }).join('');

    // Scroll to bottom
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
      await ChatService.sendMessage(chatId, currentUserId, text);
    } catch (err) {
      console.error(err);
    }
  };

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  
  input.focus();
}
