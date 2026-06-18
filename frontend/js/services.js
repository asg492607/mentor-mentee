/**
 * MentorOS — Firestore Service Layer
 * All data operations go directly through Firebase Firestore.
 * No mock data. No backend API calls for CRUD.
 */

import { db } from '/js/firebase-init.js';
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, onSnapshot, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

function snap(docSnapshot) {
  if (!docSnapshot.exists()) return null;
  return { id: docSnapshot.id, ...docSnapshot.data() };
}

function snaps(querySnapshot) {
  return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

function now() {
  return new Date().toISOString();
}

// ─── STUDENTS ─────────────────────────────────────────────────────────────────

export const StudentService = {
  async get(uid) {
    return snap(await getDoc(doc(db, 'students', uid)));
  },

  async getAll() {
    return snaps(await getDocs(collection(db, 'students')));
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
      ...data,
      status: 'REQUESTED',
      createdAt: now(),
      updatedAt: now()
    });
    return ref.id;
  },

  async get(id) {
    return snap(await getDoc(doc(db, 'meetings', id)));
  },

  async getByStudent(studentId) {
    const q = query(collection(db, 'meetings'), where('studentId', '==', studentId), orderBy('createdAt', 'desc'));
    return snaps(await getDocs(q));
  },

  async getByMentor(mentorId) {
    const q = query(collection(db, 'meetings'), where('mentorId', '==', mentorId), orderBy('createdAt', 'desc'));
    return snaps(await getDocs(q));
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
      ...data,
      status: 'OPEN',
      escalationLevel: 'MENTOR',
      escalationHistory: [],
      createdAt: now(),
      updatedAt: now()
    });
    return ref.id;
  },

  async get(id) {
    return snap(await getDoc(doc(db, 'issues', id)));
  },

  async getByStudent(studentId) {
    const q = query(collection(db, 'issues'), where('studentId', '==', studentId), orderBy('createdAt', 'desc'));
    return snaps(await getDocs(q));
  },

  async getByMentor(mentorId) {
    const q = query(collection(db, 'issues'), where('mentorId', '==', mentorId), orderBy('createdAt', 'desc'));
    return snaps(await getDocs(q));
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

  async resolve(id, resolution) {
    await updateDoc(doc(db, 'issues', id), { status: 'RESOLVED', resolution, updatedAt: now() });
  },

  async escalate(id, toLevel, reason, escalatedBy) {
    const issueSnap = await getDoc(doc(db, 'issues', id));
    const issue = issueSnap.data() || {};
    const history = issue.escalationHistory || [];
    history.push({ from: issue.escalationLevel, to: toLevel, reason, escalatedBy, at: now() });
    await updateDoc(doc(db, 'issues', id), {
      escalationLevel: toLevel,
      status: 'ESCALATED',
      escalationHistory: history,
      updatedAt: now()
    });
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
  async create({ userId, type, title, message, relatedId = null }) {
    await addDoc(collection(db, 'notifications'), {
      userId, type, title, message, relatedId,
      isRead: false,
      createdAt: now()
    });
  },

  async getForUser(userId, unreadOnly = false) {
    let q = query(collection(db, 'notifications'), where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(50));
    const all = snaps(await getDocs(q));
    return unreadOnly ? all.filter(n => !n.isRead) : all;
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

// ─── ALLOCATION ───────────────────────────────────────────────────────────────

export const AllocationService = {
  async assign(studentId, mentorId, mentorName) {
    // Update student
    await StudentService.assignMentor(studentId, mentorId);
    // Increment faculty counter
    const facultyDoc = await getDoc(doc(db, 'faculty', mentorId));
    if (facultyDoc.exists()) {
      const current = facultyDoc.data().assignedStudentCount || 0;
      await updateDoc(doc(db, 'faculty', mentorId), { assignedStudentCount: current + 1 });
    }
  },

  async autoAllocate(department = null) {
    const students = department
      ? await StudentService.getUnassigned(department)
      : await StudentService.getUnassigned();

    const mentors = department
      ? await FacultyService.getByDepartment(department)
      : await FacultyService.getAll();

    // Sort mentors by available capacity desc
    const available = mentors
      .filter(m => (m.assignedStudentCount || 0) < (m.maxStudents || 20))
      .sort((a, b) => (b.maxStudents - (b.assignedStudentCount || 0)) - (a.maxStudents - (a.assignedStudentCount || 0)));

    let mentorIdx = 0;
    const results = [];

    for (const student of students) {
      if (mentorIdx >= available.length) break;
      const mentor = available[mentorIdx];
      await AllocationService.assign(student.id, mentor.id, mentor.name);
      results.push({ studentId: student.id, mentorId: mentor.id });
      mentor.assignedStudentCount = (mentor.assignedStudentCount || 0) + 1;
      if (mentor.assignedStudentCount >= (mentor.maxStudents || 20)) mentorIdx++;
    }

    return results;
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
    const [students, meetings, issues, tasks] = await Promise.all([
      StudentService.getByMentor(mentorId),
      MeetingService.getByMentor(mentorId),
      IssueService.getByMentor(mentorId),
      TaskService.getByMentor(mentorId)
    ]);
    const highRisk = students.filter(s => s.riskLevel === 'HIGH').length;
    const pending  = meetings.filter(m => m.status === 'REQUESTED').length;
    const open     = issues.filter(i => i.status === 'OPEN').length;
    const done     = meetings.filter(m => m.status === 'COMPLETED').length;
    return { totalStudents: students.length, highRiskStudents: highRisk, pendingRequests: pending, openIssues: open, completedMeetings: done, students, meetings, issues, tasks };
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
    const [students, faculty, issues, depts] = await Promise.all([
      StudentService.getAll(),
      FacultyService.getAll(),
      IssueService.getAll(),
      DepartmentService.getAll()
    ]);
    const highRisk = students.filter(s => s.riskLevel === 'HIGH').length;
    return {
      totalStudents: students.length,
      totalFaculty: faculty.length,
      totalDepartments: depts.length,
      highRiskStudents: highRisk,
      openIssues: issues.filter(i => i.status === 'OPEN').length,
      completedMeetings: 0, // would need meeting count
      students, faculty, issues, depts
    };
  }
};
