/**
 * Lumina — Firestore Service Layer
 * All data operations go directly through Firebase Firestore.
 * No mock data. No backend API calls for CRUD.
 */

import { db } from '/js/firebase-init.js';
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, onSnapshot, Timestamp, arrayUnion, writeBatch, increment, getCountFromServer
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

import { escapeHtml } from '/js/utils.js';

function deepEscape(obj) {
  if (obj === null || typeof obj !== 'object') {
    return typeof obj === 'string' ? escapeHtml(obj) : obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(deepEscape);
  }
  const escapedObj = {};
  for (const key in obj) {
    escapedObj[key] = deepEscape(obj[key]);
  }
  return escapedObj;
}

function snap(docSnapshot) {
  if (!docSnapshot.exists()) return null;
  return deepEscape({ id: docSnapshot.id, ...docSnapshot.data() });
}

function snaps(querySnapshot) {
  return querySnapshot.docs.map(d => deepEscape({ id: d.id, ...d.data() }));
}

function now() {
  return new Date().toISOString();
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

export const SettingsService = {
  async getSections() {
    const snap = await getDoc(doc(db, 'settings', 'general'));
    if (!snap.exists()) return ['Exam Section', 'Student Section', 'Academic Section', 'Teaching (Mentor-mentee)', 'Non-Teaching', 'Travel Section', 'Non-Academic Section'];
    return snap.data().sections || ['Exam Section', 'Student Section', 'Academic Section', 'Teaching (Mentor-mentee)', 'Non-Teaching', 'Travel Section', 'Non-Academic Section'];
  },
  async updateSections(sections) {
    await setDoc(doc(db, 'settings', 'general'), { sections }, { merge: true });
  }
};

// ─── STUDENTS ─────────────────────────────────────────────────────────────────

export const StudentService = {
  async get(uid) {
    return snap(await getDoc(doc(db, 'students', uid)));
  },

  async getAll(limitCount = null) {
    if (limitCount && typeof limitCount === 'number') {
      return snaps(await getDocs(query(collection(db, 'students'), limit(limitCount))));
    }
    return snaps(await getDocs(collection(db, 'students')));
  },

  async getCount() {
    const snap = await getCountFromServer(collection(db, 'students'));
    return snap.data().count;
  },

  async getByMentor(mentorId) {
    return snaps(await getDocs(query(collection(db, 'students'), where('mentorId', '==', mentorId))));
  },

  async getByDepartment(dept) {
    return snaps(await getDocs(query(collection(db, 'students'), where('department', '==', dept))));
  },

  async getUnassigned(dept = null) {
    let q = query(collection(db, 'students'), where('mentorId', '==', null));
    if (dept) q = query(collection(db, 'students'), where('mentorId', '==', null), where('department', '==', dept));
    return snaps(await getDocs(q));
  },

  async update(uid, data) {
    await updateDoc(doc(db, 'students', uid), { ...data, updatedAt: now() });
  },

  async assignMentor(studentId, mentorId) {
    await updateDoc(doc(db, 'students', studentId), { mentorId, updatedAt: now() });
  },

  async approve(uid) {
    await updateDoc(doc(db, 'students', uid), { status: 'approved', isApproved: true, updatedAt: now() });
  },

  async unassignMentor(studentId) {
    const studentSnap = await getDoc(doc(db, 'students', studentId));
    if (!studentSnap.exists()) throw new Error('Student not found');
    const mentorId = studentSnap.data().mentorId;
    const batch = writeBatch(db);
    batch.update(doc(db, 'students', studentId), { mentorId: null, updatedAt: now() });
    if (mentorId) {
      batch.update(doc(db, 'faculty', mentorId), { assignedStudentCount: increment(-1) });
    }
    await batch.commit();
  },

  async deleteStudent(studentId) {
    const studentSnap = await getDoc(doc(db, 'students', studentId));
    if (!studentSnap.exists()) throw new Error('Student not found');
    const mentorId = studentSnap.data().mentorId;
    const batch = writeBatch(db);
    batch.delete(doc(db, 'students', studentId));
    if (mentorId) {
      batch.update(doc(db, 'faculty', mentorId), { assignedStudentCount: increment(-1) });
    }
    await batch.commit();
  }
};


// ─── FACULTY ──────────────────────────────────────────────────────────────────

export const FacultyService = {
  async get(uid) {
    return snap(await getDoc(doc(db, 'faculty', uid)));
  },

  async getAll() {
    return snaps(await getDocs(collection(db, 'faculty')));
  },

  async getByDepartment(dept) {
    return snaps(await getDocs(query(collection(db, 'faculty'), where('department', '==', dept))));
  },

  async update(uid, data) {
    await updateDoc(doc(db, 'faculty', uid), { ...data, updatedAt: now() });
  },

  async getPendingApprovals() {
    return snaps(await getDocs(query(collection(db, 'faculty'), where('status', '==', 'pending'))));
  },

  async approve(uid) {
    await updateDoc(doc(db, 'faculty', uid), { status: 'approved', isApproved: true, updatedAt: now() });
  }
};

// ─── MEETINGS ─────────────────────────────────────────────────────────────────

export const MeetingService = {
  async create(data) {
    const ref = await addDoc(collection(db, 'meetings'), {
      status: 'REQUESTED',
      ...data,
      createdAt: now(),
      updatedAt: now()
    });
    return ref.id;
  },

  async get(id) {
    return snap(await getDoc(doc(db, 'meetings', id)));
  },

  async getByStudent(studentId) {
    // Also fetch group meetings where studentId === 'GROUP' or similar. 
    // Wait, simpler: A group meeting is just a meeting where mentor scheduled it for all their students.
    // Let's query by studentId, but also query group meetings by mentorId where isGroup is true.
    // Actually, Firestore doesn't support OR queries easily without 'in'. 
    // Let's fetch where studentId == studentId AND a separate query for isGroup == true where we know the student's mentor.
    // It's cleaner to just let the mentor create N individual meeting records, one for each student, OR we can fetch group meetings.
    // Since Firebase V10 supports 'or' queries, we can use it! Wait, we don't have 'or' imported.
    // Let's just fetch all meetings where studentId == studentId, and separately fetch group meetings for their mentor.
    const q1 = query(collection(db, 'meetings'), where('studentId', '==', studentId));
    const [myMeetings, mentorProfile] = await Promise.all([
      getDocs(q1).then(snaps),
      getDoc(doc(db, 'students', studentId)).then(snap)
    ]);
    
    let allMeetings = myMeetings;
    if (mentorProfile && mentorProfile.mentorId) {
      const q2 = query(collection(db, 'meetings'), where('mentorId', '==', mentorProfile.mentorId), where('studentId', '==', 'ALL'), where('isGroup', '==', true));
      const groupMeetings = await getDocs(q2).then(snaps);
      // Merge and deduplicate by ID just in case
      const seen = new Set(allMeetings.map(m => m.id));
      for (const gm of groupMeetings) {
        if (!seen.has(gm.id)) allMeetings.push(gm);
      }
    }
    return allMeetings.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getByMentor(mentorId) {
    const q = query(collection(db, 'meetings'), where('mentorId', '==', mentorId));
    const list = snaps(await getDocs(q));
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async update(id, data) {
    await updateDoc(doc(db, 'meetings', id), { ...data, updatedAt: now() });
  },

  async addNotes(id, notes) {
    await updateDoc(doc(db, 'meetings', id), {
      notes,
      status: 'COMPLETED',
      endedAt: now(),
      updatedAt: now()
    });
  }
};

// ─── ISSUES ───────────────────────────────────────────────────────────────────

export const IssueService = {
  async create(data) {
    const ref = await addDoc(collection(db, 'issues'), {
      status: 'OPEN',
      escalationLevel: 'MENTOR',
      escalationHistory: [],
      ...data,
      createdAt: now(),
      updatedAt: now()
    });
    return ref.id;
  },

  async get(id) {
    return snap(await getDoc(doc(db, 'issues', id)));
  },

  async getByStudent(studentId) {
    const q = query(collection(db, 'issues'), where('studentId', '==', studentId));
    const list = snaps(await getDocs(q));
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getByMentor(mentorId) {
    const q = query(collection(db, 'issues'), where('mentorId', '==', mentorId));
    const list = snaps(await getDocs(q));
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getByDepartment(dept) {
    return snaps(await getDocs(query(collection(db, 'issues'), where('department', '==', dept))));
  },

  async getEscalated(level) {
    return snaps(await getDocs(query(collection(db, 'issues'), where('escalationLevel', '==', level))));
  },

  async getAll() {
    return snaps(await getDocs(collection(db, 'issues')));
  },

  async update(id, data) {
    await updateDoc(doc(db, 'issues', id), { ...data, updatedAt: now() });
  },

  async resolve(id, resolution, resolvedByRole = null) {
    const updateData = { status: 'RESOLVED', resolution, updatedAt: now() };
    if (resolvedByRole) updateData.resolvedByRole = resolvedByRole;
    await updateDoc(doc(db, 'issues', id), updateData);
  },

  async escalate(id, toLevel, reason, escalatedBy, byRole = null) {
    const issueSnap = await getDoc(doc(db, 'issues', id));
    if (!issueSnap.exists()) throw new Error("Issue not found");
    const issue = issueSnap.data();
    
    await updateDoc(doc(db, 'issues', id), {
      escalationLevel: toLevel,
      status: 'ESCALATED',
      escalationHistory: arrayUnion({
        from: issue.escalationLevel || 'MENTOR',
        to: toLevel,
        reason,
        escalatedBy,
        byRole: byRole || issue.escalationLevel || 'MENTOR',
        at: now()
      }),
      updatedAt: now()
    });
  },

  sanitizeForStudent(issue) {
    if (!issue) return issue;
    const sanitized = { ...issue };

    // Filter comments if any exist
    if (Array.isArray(sanitized.comments)) {
      sanitized.comments = sanitized.comments.filter(c => {
        const role = String(c.authorRole || c.byRole || '').toUpperCase();
        return role !== 'HOD' && role !== 'DEAN';
      });
    }

    // Filter escalation history
    if (Array.isArray(sanitized.escalationHistory)) {
      sanitized.escalationHistory = sanitized.escalationHistory.filter(h => {
        const fromRole = String(h.from || '').toUpperCase();
        const toRole = String(h.to || '').toUpperCase();
        const byRole = String(h.byRole || '').toUpperCase();
        return fromRole !== 'HOD' && fromRole !== 'DEAN' && toRole !== 'HOD' && toRole !== 'DEAN' && byRole !== 'HOD' && byRole !== 'DEAN';
      });
    }

    // If resolved by HOD or DEAN, display generic resolution badge for privacy
    const resolvedBy = String(sanitized.resolvedByRole || '').toUpperCase();
    if (resolvedBy === 'HOD' || resolvedBy === 'DEAN') {
      sanitized.resolution = 'Resolved by Academic Administration';
    }

    return sanitized;
  }
};

// ─── ACTION ITEMS (Tasks) ─────────────────────────────────────────────────────

export const TaskService = {
  async create(data) {
    const ref = await addDoc(collection(db, 'action_items'), {
      ...data,
      status: 'PENDING',
      progress: 0,
      createdAt: now(),
      updatedAt: now()
    });
    return ref.id;
  },

  async getByStudent(studentId) {
    return snaps(await getDocs(query(collection(db, 'action_items'), where('studentId', '==', studentId))));
  },

  async getByMentor(mentorId) {
    return snaps(await getDocs(query(collection(db, 'action_items'), where('mentorId', '==', mentorId))));
  },

  async update(id, data) {
    await updateDoc(doc(db, 'action_items', id), { ...data, updatedAt: now() });
  },

  async markComplete(id) {
    await updateDoc(doc(db, 'action_items', id), { status: 'COMPLETED', progress: 100, updatedAt: now() });
  }
};

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

export const NotificationService = {
  async create({ userId, userEmail = null, type, title, message, relatedId = null }) {
    await addDoc(collection(db, 'notifications'), {
      userId, type, title, message, relatedId,
      isRead: false,
      createdAt: now()
    });

    // Obtain target user email if not explicitly passed
    let targetEmail = userEmail;
    if (!targetEmail && userId) {
      try {
        const userSnap = await getDoc(doc(db, 'users', userId));
        if (userSnap.exists()) {
          targetEmail = userSnap.data().email;
        }
      } catch (e) {
        console.warn('Could not fetch user email for notification dispatch:', e);
      }
    }

    // Queue email payload to Firestore /mail collection for Firebase Trigger Email Extension (firestore-send-email)
    if (targetEmail) {
      try {
        await addDoc(collection(db, 'mail'), {
          to: [targetEmail],
          message: {
            subject: `[Lumina Mentorship] ${title}`,
            text: `${title}\n\n${message}\n\nLumina Mentorship Platform — MIT-ADT University`,
            html: `
              <div style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b;">
                <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                  <div style="background: linear-gradient(135deg, #C2185B 0%, #5C1B5E 100%); padding: 20px 24px; color: #ffffff;">
                    <h1 style="margin: 0; font-size: 1.4rem; font-weight: 800; letter-spacing: -0.5px;">Lumina</h1>
                    <p style="margin: 4px 0 0; font-size: 0.8rem; opacity: 0.9;">Student Mentorship Platform — MIT-ADT University</p>
                  </div>
                  <div style="padding: 24px;">
                    <h2 style="font-size: 1.1rem; color: #5C1B5E; margin-top: 0;">${title}</h2>
                    <p style="font-size: 0.95rem; line-height: 1.6; color: #334155;">${message}</p>
                    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 0.8rem; color: #64748b;">
                      This is an automated notification from Lumina. Please log in to your dashboard to view complete details.
                    </div>
                  </div>
                </div>
              </div>
            `
          },
          createdAt: now()
        });
      } catch (err) {
        console.warn('Could not queue email payload to Firestore /mail:', err);
      }
    }
  },

  async getForUser(userId, unreadOnly = false) {
    let q = query(collection(db, 'notifications'), where('userId', '==', userId));
    const all = snaps(await getDocs(q));
    all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const limited = all.slice(0, 50);
    return unreadOnly ? limited.filter(n => !n.isRead) : limited;
  },

  async markRead(id) {
    await updateDoc(doc(db, 'notifications', id), { isRead: true });
  },

  async markAllRead(userId) {
    const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('isRead', '==', false));
    const docs = await getDocs(q);
    const updates = docs.docs.map(d => updateDoc(d.ref, { isRead: true }));
    await Promise.all(updates);
  }
};

// ─── CHAT SERVICE ─────────────────────────────────────────────────────────────

export const ChatService = {
  // Get or create a conversation document
  async getConversation(studentId, mentorId) {
    const chatId = `${studentId}_${mentorId}`;
    const docRef = doc(db, 'chats', chatId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      await setDoc(docRef, {
        studentId,
        mentorId,
        createdAt: now(),
        updatedAt: now(),
        lastMessage: '',
        unreadCount: 0
      });
    }
    return chatId;
  },

  // Listen to messages in a conversation
  listenToMessages(chatId, callback) {
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(msgs);
    }, (error) => {
      console.error('ChatService listenToMessages failed:', error);
    });
  },

  // Send a message
  async sendMessage(chatId, senderId, text) {
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      senderId,
      text,
      createdAt: now()
    });
    // Update the parent chat document
    await updateDoc(doc(db, 'chats', chatId), {
      lastMessage: text,
      updatedAt: now()
    });
  },

  // Get all conversations for a user
  async getUserConversations(userId, role) {
    const field = (role === 'STUDENT') ? 'studentId' : 'mentorId';
    const q = query(collection(db, 'chats'), where(field, '==', userId));
    const snapsResult = await getDocs(q);
    return snapsResult.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }
};

// ─── DEPARTMENTS ──────────────────────────────────────────────────────────────

export const DepartmentService = {
  async getAll() {
    return snaps(await getDocs(collection(db, 'departments')));
  },

  async create(data) {
    const ref = await addDoc(collection(db, 'departments'), { ...data, createdAt: now() });
    return ref.id;
  },

  async update(id, data) {
    await updateDoc(doc(db, 'departments', id), data);
  },

  async delete(id) {
    await deleteDoc(doc(db, 'departments', id));
  }
};

// ─── CLASSES ──────────────────────────────────────────────────────────────────

export const ClassService = {
  async getAll() {
    return snaps(await getDocs(collection(db, 'classes')));
  },

  async getByDepartment(dept) {
    if (!dept) return [];
    return snaps(await getDocs(query(collection(db, 'classes'), where('department', '==', dept))));
  },

  async create(data) {
    const className = (data.className || '').trim();
    const department = (data.department || '').trim();
    if (!className || !department) {
      throw new Error('Both Department and Class Name are required.');
    }
    const ref = await addDoc(collection(db, 'classes'), {
      ...data,
      className,
      department,
      createdAt: now()
    });
    return ref.id;
  },

  async delete(id) {
    const cls = snap(await getDoc(doc(db, 'classes', id)));
    if (cls) {
      const q = query(collection(db, 'students'), where('department', '==', cls.department), where('class', '==', cls.className));
      const students = snaps(await getDocs(q));
      
      const batch = writeBatch(db);
      for (const s of students) {
        batch.update(doc(db, 'students', s.id), { class: null, updatedAt: now() });
      }
      batch.delete(doc(db, 'classes', id));
      await batch.commit();
    } else {
      await deleteDoc(doc(db, 'classes', id));
    }
  }
};

// ─── ALLOCATION ───────────────────────────────────────────────────────────────

export const AllocationService = {
  async assign(studentId, mentorId, mentorName) {
    // Update student
    await StudentService.assignMentor(studentId, mentorId);
    // Increment faculty counter atomically
    await updateDoc(doc(db, 'faculty', mentorId), { assignedStudentCount: increment(1) });
  },

  async batchAssign(studentIds, mentorId) {
    if (!studentIds || studentIds.length === 0) return;
    const batch = writeBatch(db);
    studentIds.forEach(id => {
      batch.update(doc(db, 'students', id), { mentorId: mentorId, updatedAt: new Date().toISOString() });
    });
    batch.update(doc(db, 'faculty', mentorId), { assignedStudentCount: increment(studentIds.length) });
    await batch.commit();
  },

  async autoAllocate(department = null, onProgress = null) {
    let students = department
      ? await StudentService.getUnassigned(department)
      : await StudentService.getUnassigned();

    // Sort sequentially by Enrollment Number
    students = students.sort((a, b) => {
      const numA = parseInt((a.enrollmentNumber || a.rollNumber || '').replace(/[^0-9]/g, ''), 10) || 0;
      const numB = parseInt((b.enrollmentNumber || b.rollNumber || '').replace(/[^0-9]/g, ''), 10) || 0;
      return numA - numB;
    });

    let mentors = department
      ? await FacultyService.getByDepartment(department)
      : await FacultyService.getAll();
    mentors = mentors.filter(m => m.role === 'FACULTY' || m.role === 'MENTOR');

    // Sort mentors by available capacity desc
    const available = mentors
      .filter(m => (m.assignedStudentCount || 0) < (m.maxStudents || 20))
      .sort((a, b) => (b.maxStudents - (b.assignedStudentCount || 0)) - (a.maxStudents - (a.assignedStudentCount || 0)));

    let mentorIdx = 0;
    const results = [];
    let mentorIncrements = {};

    let currentBatch = writeBatch(db);
    let batchCount = 0;

    for (let i = 0; i < students.length; i++) {
      if (mentorIdx >= available.length) break;
      const student = students[i];
      const mentor = available[mentorIdx];

      currentBatch.update(doc(db, 'students', student.id), { mentorId: mentor.id, updatedAt: now() });
      batchCount++;
      mentorIncrements[mentor.id] = (mentorIncrements[mentor.id] || 0) + 1;
      results.push({ studentId: student.id, mentorId: mentor.id });

      mentor.assignedStudentCount = (mentor.assignedStudentCount || 0) + 1;
      if (mentor.assignedStudentCount >= (mentor.maxStudents || 20)) mentorIdx++;

      if (batchCount >= 400 || i === students.length - 1 || mentorIdx >= available.length) {
        for (const [mId, inc] of Object.entries(mentorIncrements)) {
          currentBatch.update(doc(db, 'faculty', mId), { assignedStudentCount: increment(inc) });
        }
        await currentBatch.commit();
        if (onProgress) onProgress(results.length, students.length);

        currentBatch = writeBatch(db);
        batchCount = 0;
        mentorIncrements = {};
      }
    }

    return results;
  },

  async unallotAll(department = null, onProgress = null) {
    let students = department
      ? await StudentService.getByDepartment(department)
      : await StudentService.getAll();
    const assignedStudents = students.filter(s => s.mentorId);

    let mentors = department
      ? await FacultyService.getByDepartment(department)
      : await FacultyService.getAll();

    let currentBatch = writeBatch(db);
    let batchCount = 0;
    let processed = 0;

    // Reset student mentorId assignments
    for (let i = 0; i < assignedStudents.length; i++) {
      const student = assignedStudents[i];
      currentBatch.update(doc(db, 'students', student.id), { mentorId: null, updatedAt: now() });
      batchCount++;
      processed++;

      if (batchCount >= 400 || i === assignedStudents.length - 1) {
        await currentBatch.commit();
        if (onProgress) onProgress(processed, assignedStudents.length);
        currentBatch = writeBatch(db);
        batchCount = 0;
      }
    }

    // Reset faculty assigned counts to 0
    let facultyBatch = writeBatch(db);
    let fCount = 0;
    for (let i = 0; i < mentors.length; i++) {
      facultyBatch.update(doc(db, 'faculty', mentors[i].id), { assignedStudentCount: 0 });
      fCount++;
      if (fCount >= 400 || i === mentors.length - 1) {
        await facultyBatch.commit();
        facultyBatch = writeBatch(db);
        fCount = 0;
      }
    }

    return assignedStudents.length;
  }
};

// ─── STATS & REPORTS ─────────────────────────────────────────────────────────

export const StatsService = {
  // Compute risk level based on academic data
  computeRisk(student) {
    let score = 0;
    const cgpa = parseFloat(student.cgpa) || 0;
    const att  = parseFloat(student.attendance) || 100;
    if (cgpa < 5.0) score += 40;
    else if (cgpa < 6.0) score += 25;
    else if (cgpa < 7.0) score += 10;
    if (att < 60)  score += 40;
    else if (att < 75) score += 25;
    else if (att < 85) score += 10;
    const level = score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW';
    return { riskScore: score, riskLevel: level };
  },

  async getMentorStats(mentorId) {
    const results = await Promise.allSettled([
      StudentService.getByMentor(mentorId),
      MeetingService.getByMentor(mentorId),
      IssueService.getByMentor(mentorId),
      TaskService.getByMentor(mentorId)
    ]);
    const students = results[0].status === 'fulfilled' ? results[0].value : [];
    const meetings = results[1].status === 'fulfilled' ? results[1].value : [];
    const issues = results[2].status === 'fulfilled' ? results[2].value : [];
    const tasks = results[3].status === 'fulfilled' ? results[3].value : [];

    // Fetch booklets for these students
    const booklets = [];
    if (students.length > 0) {
      const bookletPromises = students.map(s => getDoc(doc(db, 'booklets', s.id)));
      const bookletResults = await Promise.allSettled(bookletPromises);
      const bookletSnaps = bookletResults.filter(r => r.status === 'fulfilled').map(r => r.value);
      bookletSnaps.forEach(snap => {
        if (snap.exists()) {
           booklets.push({ id: snap.id, ...snap.data() });
        }
      });
    }

    // Attach booklet data to student objects
    const enrichedStudents = students.map(s => {
      const b = booklets.find(bk => bk.id === s.id);
      return { ...s, booklet: b || null };
    });

    const highRisk = enrichedStudents.filter(s => s.riskLevel === 'HIGH').length;
    const pending  = meetings.filter(m => m.status === 'REQUESTED').length;
    const open     = issues.filter(i => i.status === 'OPEN').length;
    const done     = meetings.filter(m => m.status === 'COMPLETED').length;
    return { totalStudents: enrichedStudents.length, highRiskStudents: highRisk, pendingRequests: pending, openIssues: open, completedMeetings: done, students: enrichedStudents, meetings, issues, tasks };
  },

  async getDeptStats(department) {
    const [students, mentors, issues] = await Promise.all([
      StudentService.getByDepartment(department),
      FacultyService.getByDepartment(department),
      IssueService.getByDepartment(department)
    ]);
    const highRisk = students.filter(s => s.riskLevel === 'HIGH').length;
    return { totalStudents: students.length, totalMentors: mentors.length, highRiskStudents: highRisk, openIssues: issues.filter(i => i.status === 'OPEN').length, resolvedIssues: issues.filter(i => i.status === 'RESOLVED').length, students, mentors, issues };
  },

  async getInstitutionStats() {
    const [
      studentCountSnap,
      facultyCountSnap,
      highRiskSnap,
      openIssueSnap,
      totalIssueSnap,
      depts,
      facultySample
    ] = await Promise.all([
      getCountFromServer(collection(db, 'students')).catch(() => ({ data: () => ({ count: 0 }) })),
      getCountFromServer(collection(db, 'faculty')).catch(() => ({ data: () => ({ count: 0 }) })),
      getCountFromServer(query(collection(db, 'students'), where('riskLevel', '==', 'HIGH'))).catch(() => ({ data: () => ({ count: 0 }) })),
      getCountFromServer(query(collection(db, 'issues'), where('status', '==', 'OPEN'))).catch(() => ({ data: () => ({ count: 0 }) })),
      getCountFromServer(collection(db, 'issues')).catch(() => ({ data: () => ({ count: 0 }) })),
      DepartmentService.getAll(),
      FacultyService.getAll()
    ]);

    const totalStudents = studentCountSnap.data().count;
    const totalFaculty = facultyCountSnap.data().count;
    const highRiskStudents = highRiskSnap.data().count;
    const openIssues = openIssueSnap.data().count;
    const totalIssues = totalIssueSnap.data().count;

    return {
      totalStudents,
      totalFaculty,
      totalDepartments: depts.length,
      highRiskStudents,
      openIssues,
      totalIssues,
      completedMeetings: 0,
      students: [],
      faculty: facultySample,
      issues: [],
      depts
    };
  }
};

// ─── ADMIN TOOLS ─────────────────────────────────────────────────────────────

import { firebaseConfig } from '/js/config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';


let secondaryApp = null;
let secondaryAuth = null;

export const AdminService = {
  async createUser(data) {
    const role = (data.role || 'STUDENT').toUpperCase();
    const collectionName = role === 'STUDENT' ? 'students' : 'faculty';
    const email = data.email.trim();
    
    let password = String(data.password || data.mobileNumber || '').trim();
    if (password.length < 6) {
      password = password.padEnd(6, '0');
    }

    let uid = null;

    // Try secondary Auth registration
    try {
      if (!secondaryApp) {
        secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
        secondaryAuth = getAuth(secondaryApp);
      }

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      uid = userCredential.user.uid;
      await signOut(secondaryAuth);
    } catch (authErr) {
      if (authErr.code === 'auth/email-already-in-use') {
        const dupErr = new Error('This email is already registered.');
        dupErr.code = 'auth/email-already-in-use';
        throw dupErr;
      }
      // If rate-limited (too-many-requests) or network throttled, generate a new Firestore doc ID
      console.warn(`Auth API rate-limited/skipped for ${email} (${authErr.code || authErr.message}). Writing profile to Firestore directly.`);
      const newDocRef = doc(collection(db, collectionName));
      uid = newDocRef.id;
    }

    const profileData = {
      id: uid,
      email: email,
      name: data.name || '',
      role: role,
      department: data.department || null,
      mobileNumber: data.mobileNumber || data.phone || data.mobile || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (role === 'STUDENT') {
      profileData.enrollmentNumber = data.enrollmentNumber || data.enrollmentNo || data.employeeId || null;
      profileData.cgpa = data.cgpa || 0;
      profileData.attendance = data.attendance || 0;
      profileData.riskLevel = data.riskLevel || 'LOW';
      profileData.mentorId = data.mentorId || null;
      profileData.status = 'approved';
      profileData.isApproved = true;
      if (data.class) profileData.class = data.class;
      if (data.year) profileData.year = data.year;
    } else if (role === 'SECTION_HEAD') {
      profileData.employeeId = data.employeeId || data.enrollmentNumber || null;
      profileData.designation = data.designation || 'Section Head';
      profileData.maxStudents = 0;
      profileData.assignedStudentCount = 0;
      profileData.status = 'approved';
      profileData.isApproved = true;
    } else {
      profileData.employeeId = data.employeeId || data.enrollmentNumber || null;
      profileData.designation = data.designation || (role === 'HOD' ? 'Head of Department' : role === 'DEAN' ? 'Dean' : 'Faculty / Mentor');
      profileData.maxStudents = role === 'FACULTY' || role === 'TEACHER' || role === 'MENTOR' ? 20 : 0;
      profileData.assignedStudentCount = 0;
      profileData.status = 'approved';
      profileData.isApproved = true;
    }

    if (role === 'ADMIN') {
      profileData.status = 'approved';
      profileData.isApproved = true;
    }

    // Remove undefined values
    Object.keys(profileData).forEach(key => {
      if (profileData[key] === undefined) delete profileData[key];
    });

    // Admin has global write access, so this will succeed on the primary db
    await setDoc(doc(db, collectionName, uid), profileData);
    
    return profileData;
  }
};
