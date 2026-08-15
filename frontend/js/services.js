/**
 * Lumina — Firestore Service Layer
 * All data operations go directly through Firebase Firestore.
 * No mock data. No backend API calls for CRUD.
 */

import { db } from '/js/firebase-init.js';
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, startAfter, serverTimestamp, onSnapshot, Timestamp, arrayUnion, writeBatch, increment, getCountFromServer
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ─── Cache Manager ─────────────────────────────────────────────────────────────
import { CacheManager } from '/js/cache.js';
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

// ─── STUDENTS ─────────────────────────────────────────────────────────────────

export const StudentService = {
  async get(uid) {
    const cacheKey = `student_${uid}`;
    const cached = CacheManager.get(cacheKey);
    if (cached) return cached;
    const res = snap(await getDoc(doc(db, 'students', uid)));
    if (res) CacheManager.set(cacheKey, res, 5 * 60 * 1000);
    return res;
  },

  async getAll(limitCount = null) {
    if (limitCount && typeof limitCount === 'number') {
      return snaps(await getDocs(query(collection(db, 'students'), limit(limitCount))));
    }
    const cacheKey = 'students_all';
    const cached = CacheManager.get(cacheKey);
    if (cached) return cached;
    const res = snaps(await getDocs(collection(db, 'students')));
    CacheManager.set(cacheKey, res, 3 * 60 * 1000);
    return res;
  },

  async getPaginated(lastDocSnapshot = null, pageSize = 50) {
    let q = lastDocSnapshot
      ? query(collection(db, 'students'), orderBy('createdAt', 'desc'), startAfter(lastDocSnapshot), limit(pageSize))
      : query(collection(db, 'students'), orderBy('createdAt', 'desc'), limit(pageSize));

    const snapResult = await getDocs(q);
    const students = snapResult.docs.map(d => ({ id: d.id, ...d.data() }));
    const lastVisible = snapResult.docs[snapResult.docs.length - 1] || null;
    return { students, lastDoc: lastVisible };
  },

  async getCount() {
    const snap = await getCountFromServer(collection(db, 'students'));
    return snap.data().count;
  },

  async getByMentor(mentorId) {
    if (!mentorId) return [];
    const cacheKey = `students_mentor_${mentorId}`;
    const cached = CacheManager.get(cacheKey);
    if (cached) return cached;
    const res = snaps(await getDocs(query(collection(db, 'students'), where('mentorId', '==', mentorId))));
    CacheManager.set(cacheKey, res, 5 * 60 * 1000);
    return res;
  },

  async getByDepartment(dept) {
    if (!dept) return [];
    const cacheKey = `students_dept_${dept}`;
    const cached = CacheManager.get(cacheKey);
    if (cached) return cached;
    const res = snaps(await getDocs(query(collection(db, 'students'), where('department', '==', dept))));
    CacheManager.set(cacheKey, res, 5 * 60 * 1000);
    return res;
  },

  async getUnassigned(dept = null) {
    let q = query(collection(db, 'students'), where('mentorId', '==', null));
    if (dept) q = query(collection(db, 'students'), where('mentorId', '==', null), where('department', '==', dept));
    return snaps(await getDocs(q));
  },

  async update(uid, data) {
    await updateDoc(doc(db, 'students', uid), { ...data, updatedAt: now() });
    CacheManager.invalidate(`student_${uid}`);
    CacheManager.invalidatePrefix('students_');
  },

  async assignMentor(studentId, mentorId, allocatedBy = 'Admin', allocationType = 'MANUAL') {
    const time = now();
    const batch = writeBatch(db);
    batch.update(doc(db, 'students', studentId), {
      mentorId,
      allocatedBy,
      allocatedAt: time,
      allocationType,
      updatedAt: time
    });
    if (mentorId) {
      batch.update(doc(db, 'faculty', mentorId), { assignedStudentCount: increment(1) });
    }
    await batch.commit();
    CacheManager.invalidate(`student_${studentId}`);
    CacheManager.invalidatePrefix('students_');
    CacheManager.invalidatePrefix('faculty_');
  },

  async reassignMentor(studentId, newMentorId, reassignedBy = 'HOD', reason = 'Reassigned by HOD') {
    const studentSnap = await getDoc(doc(db, 'students', studentId));
    if (!studentSnap.exists()) throw new Error('Student not found');
    const sData = studentSnap.data();
    const oldMentorId = sData.mentorId || null;

    let oldMentorName = 'Unassigned';
    let newMentorName = 'Unassigned';

    if (oldMentorId) {
      const oldSnap = await getDoc(doc(db, 'faculty', oldMentorId));
      if (oldSnap.exists()) oldMentorName = oldSnap.data().name || 'Faculty';
    }
    if (newMentorId) {
      const newSnap = await getDoc(doc(db, 'faculty', newMentorId));
      if (newSnap.exists()) newMentorName = newSnap.data().name || 'Faculty';
    }

    const time = now();
    const historyEntry = {
      previousMentorId: oldMentorId,
      previousMentorName: oldMentorName,
      newMentorId,
      newMentorName,
      reassignedBy,
      reassignedAt: time,
      reason
    };

    const batch = writeBatch(db);
    batch.update(doc(db, 'students', studentId), {
      mentorId: newMentorId,
      allocatedBy: reassignedBy,
      allocatedAt: time,
      allocationType: 'MANUAL',
      updatedAt: time,
      reassignmentHistory: arrayUnion(historyEntry)
    });

    if (oldMentorId && oldMentorId !== newMentorId) {
      batch.update(doc(db, 'faculty', oldMentorId), { assignedStudentCount: increment(-1) });
    }
    if (newMentorId && oldMentorId !== newMentorId) {
      batch.update(doc(db, 'faculty', newMentorId), { assignedStudentCount: increment(1) });
    }

    await batch.commit();
    CacheManager.invalidate(`student_${studentId}`);
    CacheManager.invalidatePrefix('students_');
    CacheManager.invalidatePrefix('faculty_');
    return historyEntry;
  },

  async approve(uid) {
    await updateDoc(doc(db, 'students', uid), { status: 'approved', isApproved: true, updatedAt: now() });
    CacheManager.invalidate(`student_${uid}`);
    CacheManager.invalidatePrefix('students_');
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
    CacheManager.invalidate(`student_${studentId}`);
    CacheManager.invalidatePrefix('students_');
    CacheManager.invalidatePrefix('faculty_');
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
    CacheManager.invalidate(`student_${studentId}`);
    CacheManager.invalidatePrefix('students_');
    CacheManager.invalidatePrefix('faculty_');
  }
};

// ─── BOOKLETS ─────────────────────────────────────────────────────────────────

export const BookletService = {
  calculateCompletion(data) {
    if (!data) return 0;
    
    // 1. Personal & Family Profile (Weight: 40%)
    const personalFields = [
      data.personal?.name,
      data.personal?.admissionYear,
      data.personal?.class,
      data.personal?.email,
      data.personal?.dob,
      data.personal?.placeOfBirth,
      data.personal?.state,
      data.personal?.nationality,
      data.personal?.religion,
      data.personal?.category,
      data.personal?.fatherName,
      data.personal?.fatherOccupation,
      data.personal?.fatherPhoneM,
      data.personal?.motherName,
      data.personal?.motherOccupation,
      data.personal?.motherPhoneM,
      data.personal?.guardianName,
      data.personal?.guardianPhone,
      data.personal?.presentAddress,
      data.personal?.permanentAddress
    ];
    let personalFilled = 0;
    personalFields.forEach(v => {
      if (v !== undefined && v !== null && String(v).trim() !== '') personalFilled++;
    });
    const personalScore = (personalFilled / personalFields.length) * 40;

    // 2. Health & Vitals Section (Weight: 20%)
    const healthFields = [
      data.health?.diet,
      data.health?.exercise,
      data.health?.height,
      data.health?.weight,
      data.health?.pulse,
      data.health?.bp,
      data.health?.cvs,
      data.health?.rs,
      data.health?.skin,
      data.health?.eyes
    ];
    let healthFilled = 0;
    healthFields.forEach(v => {
      if (v !== undefined && v !== null && String(v).trim() !== '') healthFilled++;
    });
    const healthScore = (healthFilled / healthFields.length) * 20;

    // 3. Previous Academic Performance Section (Weight: 20%)
    const perfFields = [
      data.performance?.examPassed,
      data.performance?.board,
      data.performance?.passingYear,
      data.performance?.collegeAttended,
      data.performance?.classAwarded,
      data.performance?.totalMarks,
      data.performance?.pcmMarks,
      data.performance?.selectionMethod
    ];
    let perfFilled = 0;
    perfFields.forEach(v => {
      if (v !== undefined && v !== null && String(v).trim() !== '') perfFilled++;
    });
    const perfScore = (perfFilled / perfFields.length) * 20;

    // 4. Activities & Co-Curricular Section (Weight: 10%)
    let actScore = 0;
    if (Array.isArray(data.activities) && data.activities.length > 0 && data.activities.some(a => (a.activity || '').trim())) {
      actScore = 10;
    } else if (data.performance?.extraCurricular || data.performance?.otherAchievements || data.performance?.ncc || data.performance?.scholarships) {
      actScore = 10;
    }

    // 5. Semester Academics & Mentorship Meets (Weight: 10%)
    let acadScore = 0;
    const sems = Object.keys(data.academics || {});
    if (sems.length > 0 && sems.some(s => (data.academics[s]?.subjects?.length > 0 || data.academics[s]?.classAwarded))) {
      acadScore = 10;
    } else if (Array.isArray(data.meets) && data.meets.length > 0) {
      acadScore = 10;
    }

    const totalPct = Math.round(personalScore + healthScore + perfScore + actScore + acadScore);
    return Math.min(100, Math.max(0, totalPct));
  },

  async getBooklet(studentId) {
    const snapResult = await getDoc(doc(db, 'booklets', studentId));
    if (!snapResult.exists()) return null;
    return snapResult.data();
  },

  async getCompletionPercentage(studentId) {
    const booklet = await this.getBooklet(studentId);
    return this.calculateCompletion(booklet);
  }
};


// ─── FACULTY ──────────────────────────────────────────────────────────────────

export const FacultyService = {
  async get(uid) {
    const cacheKey = `faculty_${uid}`;
    const cached = CacheManager.get(cacheKey);
    if (cached) return cached;
    const res = snap(await getDoc(doc(db, 'faculty', uid)));
    if (res) CacheManager.set(cacheKey, res, 5 * 60 * 1000);
    return res;
  },

  async getAll() {
    const cacheKey = 'faculty_all';
    const cached = CacheManager.get(cacheKey);
    if (cached) return cached;
    const res = snaps(await getDocs(collection(db, 'faculty')));
    CacheManager.set(cacheKey, res, 5 * 60 * 1000);
    return res;
  },

  async getByDepartment(dept) {
    if (!dept) return [];
    const cacheKey = `faculty_dept_${dept}`;
    const cached = CacheManager.get(cacheKey);
    if (cached) return cached;
    const res = snaps(await getDocs(query(collection(db, 'faculty'), where('department', '==', dept))));
    CacheManager.set(cacheKey, res, 5 * 60 * 1000);
    return res;
  },

  async update(uid, data) {
    await updateDoc(doc(db, 'faculty', uid), { ...data, updatedAt: now() });
    CacheManager.invalidate(`faculty_${uid}`);
    CacheManager.invalidatePrefix('faculty_');
  },

  async getPendingApprovals() {
    return snaps(await getDocs(query(collection(db, 'faculty'), where('status', '==', 'pending'))));
  },

  async approve(uid) {
    await updateDoc(doc(db, 'faculty', uid), { status: 'approved', isApproved: true, updatedAt: now() });
    CacheManager.invalidate(`faculty_${uid}`);
    CacheManager.invalidatePrefix('faculty_');
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
    try {
      const q1 = query(collection(db, 'meetings'), where('studentId', '==', studentId));
      let myMeetings = [];
      let mentorProfile = null;
      try {
        const [mRes, sRes] = await Promise.all([
          getDocs(q1).then(snaps),
          getDoc(doc(db, 'students', studentId)).then(snap)
        ]);
        myMeetings = mRes;
        mentorProfile = sRes;
      } catch (err1) {
        console.warn('Could not fetch student individual meetings:', err1);
        myMeetings = snaps(await getDocs(q1));
      }
      
      let allMeetings = myMeetings || [];
      if (mentorProfile && mentorProfile.mentorId) {
        try {
          const q2 = query(collection(db, 'meetings'), where('mentorId', '==', mentorProfile.mentorId), where('studentId', '==', 'ALL'), where('isGroup', '==', true));
          const groupMeetings = await getDocs(q2).then(snaps);
          const seen = new Set(allMeetings.map(m => m.id));
          for (const gm of groupMeetings) {
            if (!seen.has(gm.id)) allMeetings.push(gm);
          }
        } catch (grpErr) {
          console.warn('Could not fetch group meetings:', grpErr);
        }
      }
      return allMeetings.sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } catch (e) {
      console.warn('MeetingService.getByStudent overall fallback:', e);
      return [];
    }
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

  async updateActionTaken(id, actionTaken) {
    await updateDoc(doc(db, 'issues', id), {
      actionTaken,
      updatedAt: now()
    });
  },

  async resolve(id, resolution, resolvedByRole = null) {
    const updateData = { 
      status: 'RESOLVED', 
      resolution, 
      actionTaken: resolution,
      updatedAt: now() 
    };
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
        const studentSnap = await getDoc(doc(db, 'students', userId)).catch(() => null);
        if (studentSnap && studentSnap.exists()) {
          targetEmail = studentSnap.data()?.email;
        } else {
          const facultySnap = await getDoc(doc(db, 'faculty', userId)).catch(() => null);
          if (facultySnap && facultySnap.exists()) {
            targetEmail = facultySnap.data()?.email;
          }
        }
      } catch (e) {
        // email lookup is optional
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
    const cached = CacheManager.get('departments');
    if (cached) return cached;
    const res = snaps(await getDocs(collection(db, 'departments')));
    CacheManager.set('departments', res);
    return res;
  },

  async create(data) {
    const ref = await addDoc(collection(db, 'departments'), { ...data, createdAt: now() });
    CacheManager.invalidate('departments');
    return ref.id;
  },

  async update(id, data) {
    await updateDoc(doc(db, 'departments', id), data);
    CacheManager.invalidate('departments');
  },

  async delete(id) {
    await deleteDoc(doc(db, 'departments', id));
    CacheManager.invalidate('departments');
  }
};

// ─── CLASSES ──────────────────────────────────────────────────────────────────

export const ClassService = {
  async getAll() {
    const cached = CacheManager.get('classes');
    if (cached) return cached;
    const res = snaps(await getDocs(collection(db, 'classes')));
    CacheManager.set('classes', res);
    return res;
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
    CacheManager.invalidate('classes');
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
    CacheManager.invalidate('classes');
  }
};

// ─── ALLOCATION ───────────────────────────────────────────────────────────────

export const AllocationService = {
  async assign(studentId, mentorId, mentorName) {
    // Update student and increment faculty counter atomically via StudentService
    await StudentService.assignMentor(studentId, mentorId);
  },

  async batchAssign(studentIds, mentorId) {
    if (!studentIds || studentIds.length === 0) return;
    const batch = writeBatch(db);
    studentIds.forEach(id => {
      batch.update(doc(db, 'students', id), { mentorId: mentorId, updatedAt: new Date().toISOString() });
    });
    batch.update(doc(db, 'faculty', mentorId), { assignedStudentCount: increment(studentIds.length) });
    await batch.commit();
    CacheManager.invalidatePrefix('students_');
    CacheManager.invalidatePrefix('faculty_');
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
        await new Promise(r => setTimeout(r, 0));
      }
    }

    CacheManager.invalidatePrefix('students_');
    CacheManager.invalidatePrefix('faculty_');
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
        await new Promise(r => setTimeout(r, 0));
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
        await new Promise(r => setTimeout(r, 0));
      }
    }

    CacheManager.invalidatePrefix('students_');
    CacheManager.invalidatePrefix('faculty_');
    return assignedStudents.length;
  }
};

// ─── STATS & REPORTS ─────────────────────────────────────────────────────────

export const StatsService = {
  // Compute risk level based on academic data
  computeRisk(student) {
    if (!student) return { riskScore: 0, riskLevel: 'LOW', factors: [] };

    let score = 0;
    const factors = [];

    // CGPA (0 - 40 pts)
    const cgpa = parseFloat(student.cgpa) || 0;
    if (cgpa > 0) {
      if (cgpa < 5.0) { score += 40; factors.push('Critical CGPA (< 5.0)'); }
      else if (cgpa < 6.0) { score += 30; factors.push('Low CGPA (< 6.0)'); }
      else if (cgpa < 7.0) { score += 15; factors.push('Moderate CGPA (< 7.0)'); }
    }

    // Attendance (0 - 40 pts)
    const attendance = parseFloat(student.attendance) || 0;
    if (attendance > 0 || student.attendance !== undefined) {
      if (attendance < 60) { score += 40; factors.push('Critical Attendance (< 60%)'); }
      else if (attendance < 75) { score += 25; factors.push('Low Attendance (< 75%)'); }
      else if (attendance < 85) { score += 10; factors.push('Moderate Attendance (< 85%)'); }
    }

    // Active Issues (0 - 20 pts)
    const openIssues = parseInt(student.openIssuesCount) || 0;
    if (openIssues >= 3) { score += 20; factors.push('Multiple Open Issues (3+)'); }
    else if (openIssues > 0) { score += 10; factors.push('Open Grievance / Issues'); }

    // Risk Level Mapping
    let riskLevel = 'LOW';
    if (score >= 60) riskLevel = 'HIGH';
    else if (score >= 30) riskLevel = 'MEDIUM';

    return { riskScore: Math.min(100, score), riskLevel, factors };
  },

  async getMentorStats(mentorId) {
    const cacheKey = `mentor_stats_${mentorId}`;
    const cached = CacheManager.get(cacheKey);
    if (cached) return cached;

    const [students, meetings, issues] = await Promise.all([
      StudentService.getByMentor(mentorId),
      MeetingService.getByMentor(mentorId),
      IssueService.getByMentor(mentorId)
    ]);

    const totalStudents = students.length;
    const pendingRequests = meetings.filter(m => m.status === 'REQUESTED').length;
    const highRiskStudents = students.filter(s => s.riskLevel === 'HIGH').length;
    const openIssues = issues.filter(i => i.status === 'OPEN').length;
    const completedMeetings = meetings.filter(m => m.status === 'COMPLETED').length;

    const stats = {
      totalStudents,
      pendingRequests,
      highRiskStudents,
      openIssues,
      completedMeetings,
      students,
      meetings,
      issues
    };

    CacheManager.set(cacheKey, stats, 2 * 60 * 1000);
    return stats;
  },

  async getDeptStats(department) {
    const [students, allFaculty, issues] = await Promise.all([
      StudentService.getByDepartment(department),
      FacultyService.getByDepartment(department),
      IssueService.getByDepartment(department)
    ]);
    // Only count actual mentors (FACULTY/MENTOR role), not HOD/DEAN/ADMIN etc.
    const mentors = allFaculty.filter(f => f.role === 'FACULTY' || f.role === 'MENTOR');
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
    const email = (data.email || '').trim().toLowerCase();

    if (!email) throw new Error('Email is required.');

    // ── Pre-check: targeted O(1) reads for 20k scalability ──
    const normEmail = email.toLowerCase().trim();
    const normEnroll = (data.enrollmentNumber || data.enrollmentNo || data.employeeId || '').toLowerCase().trim();

    const [stuEmailSnap, facEmailSnap] = await Promise.all([
      getDocs(query(collection(db, 'students'), where('email', '==', normEmail), limit(1))),
      getDocs(query(collection(db, 'faculty'), where('email', '==', normEmail), limit(1)))
    ]);

    if (!stuEmailSnap.empty || !facEmailSnap.empty) {
      const dupErr = new Error('This email is already registered.');
      dupErr.code = 'auth/email-already-in-use';
      throw dupErr;
    }

    if (normEnroll) {
      const [stuEnrollSnap, facEnrollSnap] = await Promise.all([
        getDocs(query(collection(db, 'students'), where('enrollmentNumber', '==', normEnroll), limit(1))),
        getDocs(query(collection(db, 'faculty'), where('employeeId', '==', normEnroll), limit(1)))
      ]);

      if (!stuEnrollSnap.empty || !facEnrollSnap.empty) {
        const dupErr = new Error(`An account with ID "${normEnroll}" already exists.`);
        dupErr.code = 'auth/id-already-in-use';
        throw dupErr;
      }
    }
    
    let password = String(data.password || data.mobileNumber || '').trim();
    if (password.length < 6) {
      password = password.padEnd(6, '0');
    }

    let uid = null;

    // Try secondary Auth registration
    try {
      // Safely initialize or reuse the secondary Firebase app
      if (!secondaryApp) {
        try {
          secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
        } catch (appErr) {
          // 'app/duplicate-app' means it was already initialized — reuse it
          if (appErr.code === 'app/duplicate-app') {
            const { getApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
            secondaryApp = getApp('SecondaryApp');
          } else {
            throw appErr;
          }
        }
        secondaryAuth = getAuth(secondaryApp);
      }

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      uid = userCredential.user.uid;
      // Sign out the secondary session so the primary user stays logged in
      try { await signOut(secondaryAuth); } catch (_) { /* ignore */ }
    } catch (authErr) {
      if (authErr.code === 'auth/email-already-in-use') {
        const dupErr = new Error('This email is already registered.');
        dupErr.code = 'auth/email-already-in-use';
        throw dupErr;
      }
      // Only fall back to a Firestore-only doc for rate-limit / network errors.
      // For all other auth errors (invalid email, weak password, etc.) re-throw.
      const benignCodes = ['auth/too-many-requests', 'auth/network-request-failed', 'auth/quota-exceeded'];
      if (!benignCodes.includes(authErr.code)) {
        throw authErr;
      }
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
      if (data.specialization) profileData.specialization = data.specialization;
      if (data.fatherContact || data.parentContact || data.fatherPhoneM) {
        profileData.fatherContact = data.fatherContact || data.parentContact || data.fatherPhoneM;
      }
      if (data.rollNumber || data.rollNo) profileData.rollNumber = data.rollNumber || data.rollNo;
      if (data.batch) profileData.batch = data.batch;
      if (data.practicalBatch) profileData.practicalBatch = data.practicalBatch;
      if (data.mentorId) {
        profileData.allocatedBy = data.allocatedBy || 'Admin';
        profileData.allocatedAt = new Date().toISOString();
        profileData.allocationType = data.allocationType || 'MANUAL';
      }
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

    // If student was created with an assigned mentor, increment the mentor's count
    if (role === 'STUDENT' && profileData.mentorId) {
      try {
        await updateDoc(doc(db, 'faculty', profileData.mentorId), { assignedStudentCount: increment(1) });
      } catch (fErr) {
        console.warn('Could not increment faculty count:', fErr);
      }
    }

    // Initialize/prefill booklet document for student
    if (role === 'STUDENT') {
      const fatherContactVal = data.fatherContact || data.parentContact || data.fatherPhoneM || '';
      try {
        await setDoc(doc(db, 'booklets', uid), {
          personal: {
            name: data.name || '',
            email: email,
            class: data.class || data.batch || '',
            enrollmentNumber: profileData.enrollmentNumber || '',
            fatherPhoneM: fatherContactVal,
            studentPhone: data.mobileNumber || data.phone || data.mobile || ''
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (bErr) {
        console.warn('Could not prefill booklet doc:', bErr);
      }
      CacheManager.invalidatePrefix('students_');
    } else {
      CacheManager.invalidatePrefix('faculty_');
    }
    
    return profileData;
  }
};

// ─── WEB ISSUES ───────────────────────────────────────────────────────────────

export const WebIssueService = {
  async submitIssue(issueData) {
    const docRef = await addDoc(collection(db, 'web_issues'), {
      title: issueData.title || 'Web Issue Report',
      category: issueData.category || 'General',
      priority: issueData.priority || 'Medium',
      description: issueData.description || '',
      pageUrl: issueData.pageUrl || window.location.hash || '/#/',
      reporterId: issueData.reporterId || 'anonymous',
      reporterName: issueData.reporterName || 'Anonymous User',
      reporterRole: issueData.reporterRole || 'GUEST',
      reporterEmail: issueData.reporterEmail || '',
      status: 'OPEN', // OPEN, IN_PROGRESS, RESOLVED
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return { id: docRef.id, ...issueData };
  },

  async getAll() {
    return snaps(await getDocs(query(collection(db, 'web_issues'), orderBy('createdAt', 'desc'))));
  },

  async updateStatus(issueId, newStatus) {
    await updateDoc(doc(db, 'web_issues', issueId), {
      status: newStatus,
      updatedAt: new Date().toISOString()
    });
  },

  async deleteIssue(issueId) {
    await deleteDoc(doc(db, 'web_issues', issueId));
  }
};

