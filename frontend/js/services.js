/**
 * MentorOS — Firestore Service Layer
 * All data operations go directly through Firebase Firestore.
 * No mock data. No backend API calls for CRUD.
 */

import { db } from '/js/firebase-init.js';
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, onSnapshot, Timestamp, arrayUnion
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
      const q2 = query(collection(db, 'meetings'), where('mentorId', '==', mentorProfile.mentorId), where('isGroup', '==', true));
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

  async resolve(id, resolution) {
    await updateDoc(doc(db, 'issues', id), { status: 'RESOLVED', resolution, updatedAt: now() });
  },

  async escalate(id, toLevel, reason, escalatedBy) {
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
        at: now()
      }),
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
    return snaps(await getDocs(query(collection(db, 'classes'), where('department', '==', dept))));
  },

  async create(data) {
    const ref = await addDoc(collection(db, 'classes'), { ...data, createdAt: now() });
    return ref.id;
  },

  async delete(id) {
    const cls = snap(await getDoc(doc(db, 'classes', id)));
    if (cls) {
      // Find all students in this class and department, set class to null
      const q = query(collection(db, 'students'), where('department', '==', cls.department), where('class', '==', cls.className));
      const students = snaps(await getDocs(q));
      for (const s of students) {
        await updateDoc(doc(db, 'students', s.id), { class: null, updatedAt: now() });
      }
    }
    await deleteDoc(doc(db, 'classes', id));
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

// ─── ADMIN TOOLS ─────────────────────────────────────────────────────────────

import { firebaseConfig } from '/js/config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';


let secondaryApp = null;
let secondaryAuth = null;

export const AdminService = {
  async createUser(data) {
    if (!secondaryApp) {
      secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
      secondaryAuth = getAuth(secondaryApp);
    }

    // Create user in secondary auth (doesn't affect primary admin session)
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password);
    const uid = userCredential.user.uid;

    const role = data.role.toUpperCase();
    const profileData = {
      id: uid,
      email: data.email,
      name: data.name,
      role: role,
      department: data.department || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (role === 'STUDENT') {
      profileData.cgpa = 0;
      profileData.attendance = 0;
      profileData.riskLevel = 'LOW';
      profileData.mentorId = null;
      profileData.status = 'approved';
      profileData.isApproved = true;
      if (data.class) profileData.class = data.class;
      if (data.year) profileData.year = data.year;
    } else if (role === 'SECTION_HEAD') {
      profileData.maxStudents = 0;
      profileData.assignedStudentCount = 0;
      profileData.status = 'approved';
      profileData.isApproved = true;
    } else {
      profileData.maxStudents = role === 'FACULTY' ? 20 : 0;
      profileData.assignedStudentCount = 0;
      profileData.status = 'approved';
      profileData.isApproved = true;
    }

    if (role === 'ADMIN') {
      profileData.status = 'approved';
      profileData.isApproved = true;
    }

    const collectionName = role === 'STUDENT' ? 'students' : 'faculty';
    
    // Admin has global write access, so this will succeed on the primary db
    await setDoc(doc(db, collectionName, uid), profileData);
    
    // Sign out the secondary app immediately
    await signOut(secondaryAuth);
    
    return profileData;
  }
};
