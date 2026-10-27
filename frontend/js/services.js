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

function normalizeOrgValue(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

async function sameDepartment(student, mentor) {
  const records = (await DepartmentService.getAll().catch(() => []))
    .filter(item => !['SCHOOL', 'COLLEGE'].includes(String(item.type || '').toUpperCase()));
  const schools = (await DepartmentService.getSchools().catch(() => []));
  const resolveKey = profile => {
    if (profile?.departmentId) return records.some(item => item.id === profile.departmentId) ? profile.departmentId : null;
    const name = normalizeOrgValue(profile?.department);
    if (!name) return null;
    let matches = records.filter(item => normalizeOrgValue(item.name) === name);
    if (profile.schoolId) matches = matches.filter(item => item.schoolId === profile.schoolId);
    const schoolName = normalizeOrgValue(profile.schoolName);
    if (schoolName) matches = matches.filter(item => {
      const school = schools.find(candidate => candidate.id === item.schoolId);
      return normalizeOrgValue(item.schoolName || school?.name) === schoolName;
    });
    if (matches.length === 1) return matches[0].id;
    if (records.length) return null;
    return `legacy:${name}|${profile.schoolId || schoolName}`;
  };
  const studentKey = resolveKey(student);
  const mentorKey = resolveKey(mentor);
  return Boolean(studentKey && mentorKey && studentKey === mentorKey);
}

async function batchUpdateDocs(collectionName, documents, updatesFor) {
  for (let offset = 0; offset < documents.length; offset += 450) {
    const batch = writeBatch(db);
    documents.slice(offset, offset + 450).forEach(item => {
      batch.update(doc(db, collectionName, item.id), { ...updatesFor(item), updatedAt: now() });
    });
    await batch.commit();
  }
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

import { getAllCellNames } from '/js/utils/mit-cells-data.js';

export const SettingsService = {
  async getSections() {
    const defaultSections = getAllCellNames();
    const snap = await getDoc(doc(db, 'settings', 'general'));
    if (!snap.exists()) return defaultSections;
    const existing = snap.data().sections || [];
    // Ensure all official cells are included without duplicates
    const combined = Array.from(new Set([...defaultSections, ...existing]));
    return combined;
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

  async getFresh(uid) {
    const res = snap(await getDoc(doc(db, 'students', uid)));
    if (res) CacheManager.set(`student_${uid}`, res, 5 * 60 * 1000);
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

  async getAllFresh() {
    const res = snaps(await getDocs(collection(db, 'students')));
    CacheManager.set('students_all', res, 3 * 60 * 1000);
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

  async getByMentor(mentorId, forceRefresh = false) {
    if (!mentorId) return [];
    const cacheKey = `students_mentor_${mentorId}`;
    const cached = forceRefresh ? null : CacheManager.get(cacheKey);
    if (cached) return cached;
    try {
      const [p1, p2, p3] = await Promise.all([
        getDocs(query(collection(db, 'students'), where('mentorId', '==', mentorId))),
        getDocs(query(collection(db, 'students'), where('secondaryMentorId', '==', mentorId))),
        getDocs(query(collection(db, 'students'), where('mentorIds', 'array-contains', mentorId))).catch(() => ({ docs: [] }))
      ]);
      const map = new Map();
      [...p1.docs, ...p2.docs, ...(p3?.docs || [])].forEach(d => {
        map.set(d.id, { id: d.id, ...d.data() });
      });
      const res = Array.from(map.values());
      CacheManager.set(cacheKey, res, 5 * 60 * 1000);
      return res;
    } catch (e) {
      console.warn('Error fetching students by mentor:', e);
      const res = snaps(await getDocs(query(collection(db, 'students'), where('mentorId', '==', mentorId))));
      CacheManager.set(cacheKey, res, 5 * 60 * 1000);
      return res;
    }
  },

  async getByDepartment(dept) {
    if (!dept) return [];
    const cacheKey = `students_dept_${dept}`;
    const cached = CacheManager.get(cacheKey);
    if (cached) return cached;
    const res = dept.startsWith('id:')
      ? snaps(await getDocs(query(collection(db, 'students'), where('departmentId', '==', dept.slice(3)))))
      : snaps(await getDocs(query(collection(db, 'students'), where('department', '==', dept))));
    CacheManager.set(cacheKey, res, 5 * 60 * 1000);
    return res;
  },

  async getUnassigned(dept = null) {
    let q = query(collection(db, 'students'), where('mentorId', '==', null));
    if (dept?.startsWith('id:')) q = query(collection(db, 'students'), where('mentorId', '==', null), where('departmentId', '==', dept.slice(3)));
    else if (dept) q = query(collection(db, 'students'), where('mentorId', '==', null), where('department', '==', dept));
    return snaps(await getDocs(q));
  },

  async update(uid, data) {
    await updateDoc(doc(db, 'students', uid), { ...data, updatedAt: now() });
    CacheManager.invalidate(`student_${uid}`);
    CacheManager.invalidatePrefix('students_');
  },

  async assignMentor(studentId, mentorId, allocatedBy = 'Admin', allocationType = 'MANUAL', secondaryMentorId = undefined) {
    const time = now();
    const sDoc = await getDoc(doc(db, 'students', studentId));
    if (!sDoc.exists()) throw new Error('Student not found');
    const sData = { id: sDoc.id, ...sDoc.data() };
    
    const oldPrimary = sData.mentorId || null;
    const oldSecondary = sData.secondaryMentorId || null;
    const newPrimary = mentorId !== undefined ? (mentorId || null) : oldPrimary;
    const newSecondary = secondaryMentorId !== undefined ? (secondaryMentorId || null) : oldSecondary;

    const countDeltas = new Map();
    [[oldPrimary, newPrimary], [oldSecondary, newSecondary]].forEach(([previousId, nextId]) => {
      if (previousId === nextId) return;
      if (previousId) countDeltas.set(previousId, (countDeltas.get(previousId) || 0) - 1);
      if (nextId) countDeltas.set(nextId, (countDeltas.get(nextId) || 0) + 1);
    });
    for (const id of [newPrimary, newSecondary].filter(Boolean)) {
      const mentorSnap = await getDoc(doc(db, 'faculty', id));
      if (!mentorSnap.exists()) throw new Error('Selected mentor was not found');
      const mentor = { id: mentorSnap.id, ...mentorSnap.data() };
      if (!['FACULTY', 'MENTOR', 'HOD'].includes(String(mentor.role || '').toUpperCase())) {
        throw new Error(`${mentor.name || 'Selected user'} is not eligible to mentor students`);
      }
      if (!(await sameDepartment(sData, mentor))) {
        throw new Error(`Mentors must belong to the student's department${sData.schoolName ? ` and school (${sData.schoolName})` : ''}.`);
      }
      if ((mentor.assignedStudentCount || 0) + (countDeltas.get(id) || 0) > (mentor.maxStudents || 20)) {
        throw new Error(`${mentor.name || 'Selected mentor'} has reached student capacity.`);
      }
    }
    if (newPrimary && newPrimary === newSecondary) {
      throw new Error('A student cannot have the same primary and secondary mentor.');
    }

    const batch = writeBatch(db);
    
    const mentorIds = [newPrimary, newSecondary].filter(Boolean);

    batch.update(doc(db, 'students', studentId), {
      mentorId: newPrimary,
      secondaryMentorId: newSecondary,
      mentorIds: mentorIds,
      allocatedBy,
      allocatedAt: time,
      allocationType,
      updatedAt: time
    });

    if (oldPrimary && oldPrimary !== newPrimary) {
      batch.update(doc(db, 'faculty', oldPrimary), { assignedStudentCount: increment(-1) });
    }
    if (newPrimary && oldPrimary !== newPrimary) {
      batch.update(doc(db, 'faculty', newPrimary), { assignedStudentCount: increment(1) });
    }
    if (oldSecondary && oldSecondary !== newSecondary) {
      batch.update(doc(db, 'faculty', oldSecondary), { assignedStudentCount: increment(-1) });
    }
    if (newSecondary && oldSecondary !== newSecondary) {
      batch.update(doc(db, 'faculty', newSecondary), { assignedStudentCount: increment(1) });
    }

    await batch.commit();
    CacheManager.invalidate(`student_${studentId}`);
    CacheManager.invalidatePrefix('students_');
    CacheManager.invalidatePrefix('faculty_');
  },

  async reassignMentor(studentId, newMentorId, reassignedBy = 'HOD', reason = 'Reassigned by HOD', isSecondary = false) {
    const studentSnap = await getDoc(doc(db, 'students', studentId));
    if (!studentSnap.exists()) throw new Error('Student not found');
    const sData = studentSnap.data();
    const oldMentorId = (isSecondary ? sData.secondaryMentorId : sData.mentorId) || null;

    if (newMentorId) {
      const newMentorSnap = await getDoc(doc(db, 'faculty', newMentorId));
      if (!newMentorSnap.exists()) throw new Error('Selected mentor was not found');
      if (!(await sameDepartment(sData, newMentorSnap.data()))) {
        throw new Error(`Mentors must belong to the student's department${sData.schoolName ? ` and school (${sData.schoolName})` : ''}.`);
      }
      if (oldMentorId !== newMentorId && (newMentorSnap.data().assignedStudentCount || 0) >= (newMentorSnap.data().maxStudents || 20)) {
        throw new Error('Selected mentor has reached student capacity.');
      }
      if (isSecondary && newMentorId === sData.mentorId) throw new Error('Primary and secondary mentors must be different.');
      if (!isSecondary && newMentorId === sData.secondaryMentorId) throw new Error('Primary and secondary mentors must be different.');
    }

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
      role: isSecondary ? 'Secondary Mentor' : 'Primary Mentor',
      previousMentorId: oldMentorId,
      previousMentorName: oldMentorName,
      newMentorId,
      newMentorName,
      reassignedBy,
      reassignedAt: time,
      reason
    };

    const newPrimary = isSecondary ? (sData.mentorId || null) : (newMentorId || null);
    const newSecondary = isSecondary ? (newMentorId || null) : (sData.secondaryMentorId || null);
    const mentorIds = [newPrimary, newSecondary].filter(Boolean);

    const batch = writeBatch(db);
    batch.update(doc(db, 'students', studentId), {
      mentorId: newPrimary,
      secondaryMentorId: newSecondary,
      mentorIds: mentorIds,
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
    const { auth } = await import('/js/firebase-init.js');
    if (!auth.currentUser) throw new Error('Sign in to approve student accounts.');
    const { claims } = await auth.currentUser.getIdTokenResult(true);
    const { api } = await import('/js/api.js');
    let path = null;
    if (claims.admin === true) path = `/admin/users/${uid}/approve`;
    else if (claims.role === 'FACULTY' || claims.role === 'MENTOR') path = `/mentor/students/${uid}/approve`;
    if (!path) throw new Error('Your account is not authorized to approve student accounts.');
    await api.put(path, {});
    CacheManager.invalidate(`student_${uid}`);
    CacheManager.invalidatePrefix('students_');
  },

  async unassignMentor(studentId, which = 'all') {
    const studentSnap = await getDoc(doc(db, 'students', studentId));
    if (!studentSnap.exists()) throw new Error('Student not found');
    const sData = studentSnap.data();
    const oldPrimary = sData.mentorId || null;
    const oldSecondary = sData.secondaryMentorId || null;
    
    const batch = writeBatch(db);
    let newPrimary = oldPrimary;
    let newSecondary = oldSecondary;

    if (which === 'all') {
      newPrimary = null;
      newSecondary = null;
      if (oldPrimary) batch.update(doc(db, 'faculty', oldPrimary), { assignedStudentCount: increment(-1) });
      if (oldSecondary) batch.update(doc(db, 'faculty', oldSecondary), { assignedStudentCount: increment(-1) });
    } else if (which === 'primary') {
      newPrimary = null;
      if (oldPrimary) batch.update(doc(db, 'faculty', oldPrimary), { assignedStudentCount: increment(-1) });
    } else if (which === 'secondary') {
      newSecondary = null;
      if (oldSecondary) batch.update(doc(db, 'faculty', oldSecondary), { assignedStudentCount: increment(-1) });
    }

    const mentorIds = [newPrimary, newSecondary].filter(Boolean);
    batch.update(doc(db, 'students', studentId), {
      mentorId: newPrimary,
      secondaryMentorId: newSecondary,
      mentorIds: mentorIds,
      updatedAt: now()
    });

    await batch.commit();
    CacheManager.invalidate(`student_${studentId}`);
    CacheManager.invalidatePrefix('students_');
    CacheManager.invalidatePrefix('faculty_');
  },

  async deleteStudent(studentId) {
    const studentSnap = await getDoc(doc(db, 'students', studentId));
    if (!studentSnap.exists()) throw new Error('Student not found');
    const sData = studentSnap.data();
    const mentorId = sData.mentorId;
    const secondaryMentorId = sData.secondaryMentorId;
    const batch = writeBatch(db);
    batch.delete(doc(db, 'students', studentId));
    if (mentorId) {
      batch.update(doc(db, 'faculty', mentorId), { assignedStudentCount: increment(-1) });
    }
    if (secondaryMentorId) {
      batch.update(doc(db, 'faculty', secondaryMentorId), { assignedStudentCount: increment(-1) });
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
  },

  async getAllBooklets() {
    try {
      const snapResult = await getDocs(collection(db, 'booklets'));
      const map = {};
      snapResult.docs.forEach(d => {
        map[d.id] = d.data();
      });
      return map;
    } catch (e) {
      console.warn('Failed to fetch all booklets:', e);
      return {};
    }
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
    if (dept.startsWith('id:')) return snaps(await getDocs(query(collection(db, 'faculty'), where('departmentId', '==', dept.slice(3)))));
    const cacheKey = `faculty_dept_${dept}`;
    const cached = CacheManager.get(cacheKey);
    if (cached) return cached;
    const res = snaps(await getDocs(query(collection(db, 'faculty'), where('department', '==', dept))));
    CacheManager.set(cacheKey, res, 5 * 60 * 1000);
    return res;
  },

  async getByDepartmentId(departmentId) {
    if (!departmentId) return [];
    return snaps(await getDocs(query(collection(db, 'faculty'), where('departmentId', '==', departmentId))));
  },

  async getDeans() {
    return snaps(await getDocs(query(
      collection(db, 'faculty'),
      where('role', '==', 'DEAN'),
      where('status', '==', 'approved'),
      where('isApproved', '==', true)
    )));
  },

  async update(uid, data) {
    if (data?.role) {
      const { api } = await import('/js/api.js');
      await api.put(`/dean/faculty/${uid}/role`, data);
    } else {
      await updateDoc(doc(db, 'faculty', uid), { ...data, updatedAt: now() });
    }
    CacheManager.invalidate(`faculty_${uid}`);
    CacheManager.invalidatePrefix('faculty_');
  },

  async getPendingApprovals() {
    return snaps(await getDocs(query(collection(db, 'faculty'), where('status', '==', 'pending'))));
  },

  async approve(uid) {
    const { auth } = await import('/js/firebase-init.js');
    if (!auth.currentUser) throw new Error('Sign in to approve faculty accounts.');
    const { claims } = await auth.currentUser.getIdTokenResult(true);
    const { api } = await import('/js/api.js');
    let path = null;
    if (claims.admin === true) path = `/admin/users/${uid}/approve`;
    else if (claims.platform_role === 'DEAN') path = `/dean/faculty/${uid}/approve`;
    else if (claims.platform_role === 'HOD') path = `/hod/faculty/${uid}/approve`;
    if (!path) throw new Error('Your account is not authorized to approve faculty accounts.');
    await api.put(path, {});
    CacheManager.invalidate(`faculty_${uid}`);
    CacheManager.invalidatePrefix('faculty_');
  }
};

// ─── MEETINGS ─────────────────────────────────────────────────────────────────

export const MeetingService = {
  async getAll() {
    try {
      const list = snaps(await getDocs(collection(db, 'meetings')));
      return list.sort((a, b) => new Date(b.scheduledAt || b.createdAt || 0) - new Date(a.scheduledAt || a.createdAt || 0));
    } catch (e) {
      console.warn('MeetingService.getAll error:', e);
      return [];
    }
  },

  async getByDepartment(dept) {
    if (!dept) return this.getAll();
    try {
      const allMeetings = await this.getAll();
      const userDept = String(dept).trim().toLowerCase();
      const filtered = allMeetings.filter(m => {
        if (!m) return false;
        const mDept = String(m.department || m.mentorDepartment || '').trim().toLowerCase();
        return mDept === userDept;
      });
      return filtered.length > 0 ? filtered : allMeetings;
    } catch (e) {
      console.warn('MeetingService.getByDepartment error:', e);
      return [];
    }
  },

  async recordAttendance(meetingId, user) {
    if (!meetingId || !user) return;
    try {
      const attendee = {
        userId: user.id || user.uid,
        name: user.name || 'Participant',
        email: user.email || '',
        role: user.role || 'STUDENT',
        class: user.class || '',
        enrollmentNumber: user.enrollmentNumber || user.prn || '',
        department: user.department || '',
        joinedAt: new Date().toISOString(),
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        status: 'ATTENDED',
        attended: true
      };

      const meetingRef = doc(db, 'meetings', meetingId);
      const meetingSnap = await getDoc(meetingRef);
      if (!meetingSnap.exists()) return;
      const data = meetingSnap.data();
      const attendees = Array.isArray(data.attendees) ? [...data.attendees] : [];

      const existingIdx = attendees.findIndex(a => a.userId === attendee.userId || (a.email && a.email === attendee.email));
      if (existingIdx >= 0) {
        attendees[existingIdx] = { ...attendees[existingIdx], ...attendee };
      } else {
        attendees.push(attendee);
      }

      await updateDoc(meetingRef, {
        attendees,
        attendanceCount: attendees.length,
        updatedAt: now()
      });
    } catch (err) {
      console.warn('[Meeting Attendance] Error recording attendance:', err);
    }
  },

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
    const { api } = await import('/js/api.js');
    return deepEscape(await api.get(`/meetings/${id}`));
  },

  async getById(id) {
    return this.get(id);
  },

  async getByStudent(studentId) {
    const { api } = await import('/js/api.js');
    const meetings = deepEscape(await api.get('/student/meetings'));
    return meetings.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
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
  },

  /**
   * Save AI-generated notes to a meeting document in Firestore.
   * Called automatically by autoExtractAndSaveMeetingReport() at meeting end.
   * @param {string} id - Meeting document ID
   * @param {Object} aiNotes - Structured AI notes (topic, issuesDiscussed, actionItems, tasks, riskSignals, etc.)
   */
  async saveAINotes(id, aiNotes) {
    const { api } = await import('/js/api.js');
    return api.post(`/meetings/${id}/ai-notes`, {
      ...aiNotes,
      savedAt: new Date().toISOString()
    });
  },

  async getAINotes(id) {
    const { api } = await import('/js/api.js');
    return deepEscape(await api.get(`/meetings/${id}/ai-notes`));
  },

  async saveReport(id, report) {
    const { api } = await import('/js/api.js');
    return api.post(`/meetings/${id}/report`, report);
  },

  async getReport(id) {
    const { api } = await import('/js/api.js');
    return deepEscape(await api.get(`/meetings/${id}/report`));
  },

  async getMinutes(id) {
    const { api } = await import('/js/api.js');
    return deepEscape(await api.get(`/meetings/${id}/minutes`));
  },

  /**
   * Upload meeting recording to backend Google Drive service.
   * Updates meeting document with Drive view link and download URL.
   */
  async uploadRecording(meetingId, fileBlob, metadata = {}) {
    const formData = new FormData();
    const mode = metadata.mode || 'audio';
    const ext = 'webm';
    const filename = metadata.filename || `Session_${meetingId}_${mode}.${ext}`;
    
    formData.append('file', fileBlob, filename);
    formData.append('mode', mode);
    formData.append('duration', String(metadata.duration || 0));

    let token = null;
    try {
      const { auth } = await import('/js/firebase-init.js');
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken();
      }
    } catch (e) {
      console.warn('Could not retrieve Firebase auth token for recording upload:', e);
    }

    if (!token) throw new Error('Sign in before uploading a meeting recording.');
    const { API_BASE_URL } = await import('/js/config.js');
    const res = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}/upload-recording`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    const resData = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(resData.detail || `Recording upload failed (${res.status})`);
    }
    const data = resData.data || resData;
    for (const field of ['webViewLink', 'downloadLink']) {
      if (data[field]?.startsWith('/')) data[field] = `${API_BASE_URL}${data[field]}`;
    }
    return data;
  },

  /**
   * Retrieve recording details and Google Drive link for a meeting.
   */
  async getRecording(meetingId) {
    const { auth } = await import('/js/firebase-init.js');
    if (!auth.currentUser) throw new Error('Sign in to view recording details.');
    const { API_BASE_URL } = await import('/js/config.js');
    const token = await auth.currentUser.getIdToken();
    const response = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}/recording`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'Could not retrieve recording details.');
    return data;
  },

  async downloadRecording(meetingId) {
    const { auth } = await import('/js/firebase-init.js');
    if (!auth.currentUser) throw new Error('Sign in to view this recording.');
    const { API_BASE_URL } = await import('/js/config.js');
    const token = await auth.currentUser.getIdToken();
    const response = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}/recording/content`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || 'Could not download this recording.');
    }
    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `meeting-${meetingId}-recording`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  },

  generateGoogleCalendarUrl(meeting) {
    const title = encodeURIComponent(meeting.type || meeting.topic || 'Mentorship Session');
    const startIso = meeting.scheduledAt || meeting.preferredDate;
    if (!startIso) return null;

    const startDate = new Date(startIso);
    if (isNaN(startDate.getTime())) return null;

    const endDate = new Date(startDate.getTime() + 45 * 60 * 1000); // 45 min duration default
    
    const formatGCalTime = (d) => d.toISOString().replace(/-|:|\.\d+/g, '');
    const dates = `${formatGCalTime(startDate)}/${formatGCalTime(endDate)}`;
    
    const origin = window.location.origin;
    const meetingRoomUrl = `${origin}/#/meeting-room?id=${meeting.id}`;
    const desc = encodeURIComponent(
      `Mentorship Meeting\n\n` +
      `Topic/Type: ${meeting.type || meeting.topic || 'General Mentoring'}\n` +
      `Purpose & Agenda: ${meeting.description || 'Routine mentorship discussion'}\n` +
      `Host: ${meeting.mentorName || 'Faculty Mentor'}\n` +
      `Student(s): ${meeting.isGroup ? 'Mentor Cohort' : (meeting.studentName || 'Mentee')}\n\n` +
      `Join Live Video Room: ${meetingRoomUrl}`
    );
    const location = encodeURIComponent(meetingRoomUrl);

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${desc}&location=${location}`;
  },

  // Generate .ics iCalendar file string
  generateIcsContent(meeting) {
    const startIso = meeting.scheduledAt || meeting.preferredDate;
    if (!startIso) return null;
    const startDate = new Date(startIso);
    if (isNaN(startDate.getTime())) return null;
    const endDate = new Date(startDate.getTime() + 45 * 60 * 1000);

    const pad = n => String(n).padStart(2, '0');
    const formatIcsDate = d => 
      `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

    const origin = window.location.origin;
    const meetingRoomUrl = `${origin}/#/meeting-room?id=${meeting.id}`;
    const summary = (meeting.type || meeting.topic || 'Mentorship Session').replace(/\n/g, ' ');
    const description = `Mentorship Session\\nTopic: ${summary}\\nAgenda/Why: ${(meeting.description || 'Mentoring').replace(/\n/g, ' ')}\\nJoin: ${meetingRoomUrl}`;

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Lumina Mentorship//Meeting Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:lumina-${meeting.id}@mitadt.edu`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(startDate)}`,
      `DTEND:${formatIcsDate(endDate)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${meetingRoomUrl}`,
      `URL:${meetingRoomUrl}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
  },

  // Download .ics file
  downloadIcs(meeting) {
    const ics = this.generateIcsContent(meeting);
    if (!ics) return;
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting_${meeting.id || 'event'}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Student Dual Sign-Off / Acknowledgment
  async acknowledgeMeeting(meetingId, studentId, feedback = '', rating = 5) {
    await updateDoc(doc(db, 'meetings', meetingId), {
      studentAcknowledged: true,
      acknowledgedAt: now(),
      acknowledgedByStudentId: studentId,
      studentFeedback: feedback,
      studentRating: rating,
      updatedAt: now()
    });
  },

  // Save MOM Notes with Auto Action Task Sync
  async saveMOMWithActionItems(meetingId, momData) {
    const { 
      issuesDiscussed = '', 
      actionTaken = '', 
      tasks = [], 
      remarks = '', 
      privateObservations = '',
      whiteboardSnapshot = null,
      voiceNoteUrl = null,
      checkedAgendaItems = [],
      studentId = null,
      mentorId = null
    } = momData;

    const notesObj = {
      issuesDiscussed,
      actionTaken,
      problem: issuesDiscussed,
      advice: actionTaken,
      summary: remarks || issuesDiscussed,
      tasks: Array.isArray(tasks) ? tasks : [],
      remarks,
      privateObservations,
      whiteboardSnapshot,
      voiceNoteUrl,
      checkedAgendaItems
    };

    await updateDoc(doc(db, 'meetings', meetingId), {
      notes: notesObj,
      status: 'COMPLETED',
      endedAt: now(),
      updatedAt: now()
    });

    // Auto-create individual Action Tasks for student
    if (studentId && studentId !== 'ALL' && Array.isArray(tasks) && tasks.length > 0) {
      for (const t of tasks) {
        const taskText = typeof t === 'string' ? t.trim() : (t.text || '').trim();
        if (taskText) {
          try {
            await TaskService.create({
              studentId,
              mentorId,
              description: taskText,
              category: 'Meeting Action Item',
              meetingId,
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 7 days default
            });
          } catch (e) {
            console.warn('Could not auto-create action task:', e);
          }
        }
      }
    }
  }
};

// ─── AVAILABILITY SERVICE ─────────────────────────────────────────────────────

export const AvailabilityService = {
  // Get mentor's configured office hours
  async get(mentorId) {
    try {
      const docSnap = await getDoc(doc(db, 'mentor_availability', mentorId));
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
    } catch (e) {
      console.warn('AvailabilityService get error:', e);
    }
    // Sensible default office hours
    return {
      activeDays: ['Monday', 'Wednesday', 'Friday'],
      startTime: '14:00',
      endTime: '17:00',
      slotDuration: 30, // in minutes
      bufferMinutes: 10,
      maxDailyMeets: 4,
      locationMode: 'ONLINE'
    };
  },

  // Save mentor's availability configuration
  async save(mentorId, data) {
    await setDoc(doc(db, 'mentor_availability', mentorId), {
      ...data,
      mentorId,
      updatedAt: now()
    }, { merge: true });
  },

  // Calculate available slots for a target date
  async getAvailableSlots(mentorId, targetDateStr, existingMeetings = []) {
    const config = await this.get(mentorId);
    const targetDate = new Date(targetDateStr);
    if (isNaN(targetDate.getTime())) return [];

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const targetDayName = days[targetDate.getDay()];

    if (!config.activeDays.includes(targetDayName)) {
      return []; // Mentor does not take meetings on this day
    }

    const [startH, startM] = (config.startTime || '14:00').split(':').map(Number);
    const [endH, endM] = (config.endTime || '17:00').split(':').map(Number);
    const slotDuration = Number(config.slotDuration) || 30;
    const buffer = Number(config.bufferMinutes) || 10;
    const maxDaily = Number(config.maxDailyMeets) || 4;

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // Filter existing meetings on target date
    const targetDateYMD = targetDate.toISOString().split('T')[0];
    const dayMeetings = existingMeetings.filter(m => {
      if (['CANCELLED', 'REJECTED'].includes(m.status)) return false;
      const sched = m.scheduledAt || m.preferredDate;
      return sched && sched.startsWith(targetDateYMD);
    });

    if (dayMeetings.length >= maxDaily) {
      return []; // Daily cap reached
    }

    // Generate candidate slots
    const slots = [];
    let currentMin = startMinutes;

    while (currentMin + slotDuration <= endMinutes) {
      const h = Math.floor(currentMin / 60);
      const m = currentMin % 60;
      const timeString = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      
      const slotStartIso = `${targetDateYMD}T${timeString}:00`;
      const slotStartTime = new Date(slotStartIso).getTime();
      const slotEndTime = slotStartTime + slotDuration * 60 * 1000;

      // Check conflict with existing meetings (including buffer)
      const hasConflict = dayMeetings.some(meet => {
        const mStartIso = meet.scheduledAt || meet.preferredDate;
        if (!mStartIso) return false;
        const mStartTime = new Date(mStartIso).getTime();
        const mEndTime = mStartTime + (45 * 60 * 1000); // assume 45 min meet
        
        // Overlap test with buffer
        const bufferMs = buffer * 60 * 1000;
        return (slotStartTime < mEndTime + bufferMs) && (slotEndTime + bufferMs > mStartTime);
      });

      slots.push({
        time: timeString,
        label: new Date(`${targetDateYMD}T${timeString}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        iso: slotStartIso,
        duration: slotDuration,
        isAvailable: !hasConflict
      });

      currentMin += (slotDuration + buffer);
    }

    return slots;
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
    if (userId) {
      try {
        await Promise.race([
          addDoc(collection(db, 'notifications'), {
            userId, type, title, message, relatedId,
            isRead: false,
            createdAt: now()
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Notification save timeout')), 4000))
        ]);
      } catch (notifErr) {
        console.warn('In-app notification notice:', notifErr.message);
      }
    }

    // Non-blocking background email queueing
    (async () => {
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
        } catch (e) { }
      }

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
        } catch (err) { }
      }
    })().catch(e => console.warn('Background mail queue notice:', e));
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
  // Get or create a 1-on-1 conversation document
  async getConversation(studentId, mentorId) {
    const chatId = `${studentId}_${mentorId}`;
    const docRef = doc(db, 'chats', chatId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      await setDoc(docRef, {
        studentId,
        mentorId,
        isGroup: false,
        createdAt: now(),
        updatedAt: now(),
        lastMessage: '',
        unreadCount: 0
      });
    }
    return chatId;
  },

  // Get or create a mentor cohort group conversation document
  async getGroupConversation(mentorId, mentorName = 'Faculty Mentor', students = []) {
    const chatId = `group_${mentorId}`;
    const studentIds = (students || []).map(s => s.id || s);

    try {
      const docRef = doc(db, 'chats', chatId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        await setDoc(docRef, {
          mentorId,
          mentorName,
          studentId: 'ALL',
          studentIds,
          participantIds: [mentorId, ...studentIds],
          title: `${mentorName}'s Mentee Cohort`,
          isGroup: true,
          createdAt: now(),
          updatedAt: now(),
          lastMessage: 'Cohort Group Chat initialized.',
          lastSenderName: 'System',
          unreadCount: 0
        });
      } else {
        // Sync student IDs to keep member list updated
        try {
          await updateDoc(docRef, {
            mentorName,
            studentIds,
            participantIds: [mentorId, ...studentIds],
            updatedAt: now()
          });
        } catch (e) {
          console.warn('Could not update group participant list:', e);
        }
      }
    } catch (err) {
      console.warn('getGroupConversation non-critical warning:', err);
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

  // Send a message with sender name, role, and text
  async sendMessage(chatId, senderId, text, senderName = '', senderRole = '') {
    const msgData = {
      senderId,
      text,
      createdAt: now()
    };
    if (senderName) msgData.senderName = senderName;
    if (senderRole) msgData.senderRole = senderRole;

    await addDoc(collection(db, 'chats', chatId, 'messages'), msgData);
    
    // Update parent conversation summary
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: text,
        lastSenderName: senderName || '',
        updatedAt: now()
      });
    } catch (e) {
      console.warn('Failed to update chat doc summary:', e);
    }
  },

  // Get all conversations for a user (1-on-1 & groups)
  async getUserConversations(userId, role) {
    const isStudent = (String(role).toUpperCase() === 'STUDENT');
    const field = isStudent ? 'studentId' : 'mentorId';
    
    const q = query(collection(db, 'chats'), where(field, '==', userId));
    const snapsResult = await getDocs(q);
    const convs = snapsResult.docs.map(d => ({ id: d.id, ...d.data() }));

    // For students, also fetch group chats where student is in studentIds or studentId is ALL
    if (isStudent) {
      try {
        const groupQ = query(collection(db, 'chats'), where('studentId', '==', 'ALL'));
        const groupSnaps = await getDocs(groupQ);
        groupSnaps.docs.forEach(d => {
          const data = { id: d.id, ...d.data() };
          if (!convs.some(c => c.id === data.id)) {
            convs.push(data);
          }
        });
      } catch (e) {
        console.warn('Group chat query fallback:', e);
      }
    }

    return convs.sort((a,b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
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

  async getSchools() {
    return (await this.getAll()).filter(item => ['SCHOOL', 'COLLEGE'].includes(String(item.type || '').toUpperCase()));
  },

  async backfillReferences() {
    const [departmentDocs, classDocs, studentDocs, facultyDocs] = await Promise.all([
      getDocs(collection(db, 'departments')),
      getDocs(collection(db, 'classes')),
      getDocs(collection(db, 'students')),
      getDocs(collection(db, 'faculty'))
    ]);
    const records = snaps(departmentDocs);
    const schools = records.filter(item => ['SCHOOL', 'COLLEGE'].includes(String(item.type || '').toUpperCase()));
    const departments = records.filter(item => !['SCHOOL', 'COLLEGE'].includes(String(item.type || '').toUpperCase()));
    const parentUpdates = [];
    departments.forEach(department => {
      if (department.schoolId || !department.schoolName) return;
      const matches = schools.filter(school => normalizeOrgValue(school.name) === normalizeOrgValue(department.schoolName));
      if (matches.length !== 1) return;
      department.schoolId = matches[0].id;
      department.schoolName = matches[0].name;
      parentUpdates.push({ ...department, _placement: { schoolId: matches[0].id, schoolName: matches[0].name } });
    });
    const resolveDepartment = item => {
      if (item.departmentId) return departments.find(department => department.id === item.departmentId) || null;
      const name = normalizeOrgValue(item.department);
      if (!name) return null;
      let matches = departments.filter(department => normalizeOrgValue(department.name) === name);
      if (item.schoolId) matches = matches.filter(department => department.schoolId === item.schoolId);
      const schoolName = normalizeOrgValue(item.schoolName);
      if (schoolName) matches = matches.filter(department => {
        const linkedSchool = schools.find(school => school.id === department.schoolId);
        return normalizeOrgValue(department.schoolName || linkedSchool?.name) === schoolName;
      });
      return matches.length === 1 ? matches[0] : null;
    };
    const placementFor = (item, department) => {
      if (!department) return null;
      const school = schools.find(entry => entry.id === department.schoolId);
      const placement = {
        departmentId: department.id,
        department: department.name,
        schoolId: department.schoolId || null,
        schoolName: department.schoolName || school?.name || null
      };
      return Object.entries(placement).some(([key, value]) => item[key] !== value) ? placement : null;
    };
    const classes = snaps(classDocs);
    await batchUpdateDocs('departments', parentUpdates, item => item._placement);
    for (const [collectionName, docs] of [['classes', classes], ['students', snaps(studentDocs)], ['faculty', snaps(facultyDocs)]]) {
      const updates = docs.map(item => {
        const department = resolveDepartment(item);
        const placement = placementFor(item, department);
        const next = { ...(placement || {}) };
        if (collectionName === 'students' && !item.classId && item.class && department) {
          const classMatches = classes.filter(cls => cls.className === item.class && resolveDepartment(cls)?.id === department.id);
          if (classMatches.length === 1) next.classId = classMatches[0].id;
        }
        if (!Object.keys(next).length) return null;
        return { ...item, _placement: next };
      }).filter(Boolean);
      await batchUpdateDocs(collectionName, updates, item => item._placement);
    }
    CacheManager.invalidate('departments');
    CacheManager.invalidate('classes');
    CacheManager.invalidatePrefix('students_');
    CacheManager.invalidatePrefix('faculty_');
  },

  async create(data) {
    const ref = await addDoc(collection(db, 'departments'), { ...data, createdAt: now() });
    CacheManager.invalidate('departments');
    return ref.id;
  },

  async update(id, data) {
    const currentSnap = await getDoc(doc(db, 'departments', id));
    if (!currentSnap.exists()) throw new Error('School or department not found');
    const current = { id, ...currentSnap.data() };
    CacheManager.invalidate('departments');
    await updateDoc(doc(db, 'departments', id), { ...data, updatedAt: now() });
    const isSchool = ['SCHOOL', 'COLLEGE'].includes(String(current.type || '').toUpperCase());
    if (isSchool && (data.name !== undefined || data.code !== undefined || data.hodName !== undefined)) {
      const newName = data.name ?? current.name;
      const [allDepartments, allClasses, allStudents, allFaculty] = await Promise.all([
        this.getAll(), ClassService.getAll(), StudentService.getAllFresh(), FacultyService.getAll()
      ]);
      const belongsToSchool = item => item.schoolId === id || (!item.schoolId && normalizeOrgValue(item.schoolName) === normalizeOrgValue(current.name));
      await batchUpdateDocs('departments', allDepartments.filter(item => item.id !== id && belongsToSchool(item)), () => ({ schoolId: id, schoolName: newName }));
      await batchUpdateDocs('classes', allClasses.filter(belongsToSchool), () => ({ schoolId: id, schoolName: newName }));
      await batchUpdateDocs('students', allStudents.filter(belongsToSchool), () => ({ schoolId: id, schoolName: newName }));
      await batchUpdateDocs('faculty', allFaculty.filter(belongsToSchool), () => ({ schoolId: id, schoolName: newName }));
    } else if (data.name !== undefined || data.schoolId !== undefined || data.schoolName !== undefined) {
      const [allDepartments, allClasses, allStudents, allFaculty] = await Promise.all([
        this.getAll(), ClassService.getAll(), StudentService.getAllFresh(), FacultyService.getAll()
      ]);
      const school = allDepartments.find(item => item.id === (data.schoolId ?? current.schoolId));
      const placement = {
        department: data.name ?? current.name,
        departmentId: id,
        schoolId: data.schoolId ?? current.schoolId ?? null,
        schoolName: data.schoolName ?? school?.name ?? current.schoolName ?? null
      };
      const matches = items => items.filter(item => item.departmentId === id || (
        !item.departmentId && normalizeOrgValue(item.department) === normalizeOrgValue(current.name) &&
        (!current.schoolId || !item.schoolId || item.schoolId === current.schoolId) &&
        (!current.schoolName || !item.schoolName || normalizeOrgValue(item.schoolName) === normalizeOrgValue(current.schoolName))
      ));
      await batchUpdateDocs('classes', matches(allClasses), () => placement);
      await batchUpdateDocs('students', matches(allStudents), () => placement);
      await batchUpdateDocs('faculty', matches(allFaculty), () => placement);
    }
    CacheManager.invalidate('departments');
    CacheManager.invalidate('classes');
    CacheManager.invalidatePrefix('students_');
    CacheManager.invalidatePrefix('faculty_');
  },

  async changeHOD(departmentId, deptName, newHodFacultyId = null, previousHodFacultyId = null, newHodName = '') {
    const time = now();
    const department = snap(await getDoc(doc(db, 'departments', departmentId)));

    // Role changes must go through the trusted backend so matching Firebase claims are set.
    if (newHodFacultyId) {
      await AdminService.updateUser(newHodFacultyId, {
        role: 'HOD',
        department: deptName,
        departmentId,
        schoolId: department?.schoolId || null,
        schoolName: department?.schoolName || null,
      });
    }

    if (previousHodFacultyId && previousHodFacultyId !== newHodFacultyId) {
      await AdminService.updateUser(previousHodFacultyId, { role: 'FACULTY' });
    }

    await updateDoc(doc(db, 'departments', departmentId), {
      hodName: newHodName || '—',
      hodId: newHodFacultyId || null,
      updatedAt: time
    });

    CacheManager.invalidate('departments');
    CacheManager.invalidatePrefix('faculty_');
  },

  async delete(id) {
    const [all, classes, students, faculty] = await Promise.all([
      this.getAll(), ClassService.getAll(), StudentService.getAllFresh(), FacultyService.getAll()
    ]);
    const item = all.find(entry => entry.id === id);
    if (!item) return;
    const isSchool = ['SCHOOL', 'COLLEGE'].includes(String(item.type || '').toUpperCase());
    const belongsToDepartment = entry => entry.departmentId === id || (
      !entry.departmentId && normalizeOrgValue(entry.department) === normalizeOrgValue(item.name) &&
      (!item.schoolId || !entry.schoolId || entry.schoolId === item.schoolId) &&
      (!item.schoolName || !entry.schoolName || normalizeOrgValue(entry.schoolName) === normalizeOrgValue(item.schoolName))
    );
    const hasChildren = isSchool
      ? all.some(entry => entry.schoolId === id || (!entry.schoolId && normalizeOrgValue(entry.schoolName) === normalizeOrgValue(item.name))) ||
        classes.some(entry => entry.schoolId === id || (!entry.schoolId && normalizeOrgValue(entry.schoolName) === normalizeOrgValue(item.name))) ||
        students.some(entry => entry.schoolId === id || (!entry.schoolId && normalizeOrgValue(entry.schoolName) === normalizeOrgValue(item.name))) ||
        faculty.some(entry => entry.schoolId === id || (!entry.schoolId && normalizeOrgValue(entry.schoolName) === normalizeOrgValue(item.name)))
      : classes.some(belongsToDepartment) || students.some(belongsToDepartment) || faculty.some(belongsToDepartment);
    if (hasChildren) throw new Error(`Move or remove this ${isSchool ? 'school’s departments' : 'department’s classes and users'} before deleting it.`);
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
    if (dept.startsWith('id:')) return snaps(await getDocs(query(collection(db, 'classes'), where('departmentId', '==', dept.slice(3)))));
    return snaps(await getDocs(query(collection(db, 'classes'), where('department', '==', dept))));
  },

  async getByDepartmentId(departmentId) {
    if (!departmentId) return [];
    return snaps(await getDocs(query(collection(db, 'classes'), where('departmentId', '==', departmentId))));
  },

  async create(data) {
    const className = (data.className || '').trim();
    const department = (data.department || '').trim();
    if (!className || !department) {
      throw new Error('Both Department and Class Name are required.');
    }
    const departmentRecords = await DepartmentService.getAll();
    const academicDepartments = departmentRecords.filter(item => !['SCHOOL', 'COLLEGE'].includes(String(item.type || '').toUpperCase()));
    const departmentMatches = data.departmentId
      ? academicDepartments.filter(item => item.id === data.departmentId)
      : academicDepartments.filter(item => normalizeOrgValue(item.name) === normalizeOrgValue(department));
    if (data.departmentId && !departmentMatches.length) throw new Error('Selected department was not found.');
    if (!data.departmentId && departmentMatches.length > 1) throw new Error('Select a department ID to disambiguate this class.');
    const linkedDepartment = departmentMatches[0] || null;
    const schoolsConfigured = departmentRecords.some(item => ['SCHOOL', 'COLLEGE'].includes(String(item.type || '').toUpperCase()));
    if (schoolsConfigured && linkedDepartment && !linkedDepartment.schoolId) {
      throw new Error('Link this department to a school before creating classrooms.');
    }
    if (schoolsConfigured && !linkedDepartment) throw new Error('Select a department configured under a school.');
    const ref = await addDoc(collection(db, 'classes'), {
      ...data,
      className,
      department: linkedDepartment?.name || department,
      departmentId: data.departmentId || linkedDepartment?.id || null,
      schoolId: data.schoolId || linkedDepartment?.schoolId || null,
      schoolName: data.schoolName || linkedDepartment?.schoolName || null,
      createdAt: now()
    });
    CacheManager.invalidate('classes');
    return ref.id;
  },

  async assignTeacher(classId, teacherId = null) {
    if (teacherId) {
      const cls = snap(await getDoc(doc(db, 'classes', classId)));
      const teacher = snap(await getDoc(doc(db, 'faculty', teacherId)));
      if (!cls || !teacher) throw new Error('Class or teacher not found');
      if (!(await sameDepartment(cls, teacher))) throw new Error('Class teachers must belong to the class department.');
    }
    await updateDoc(doc(db, 'classes', classId), {
      classTeacherId: teacherId || null,
      updatedAt: now()
    });
    CacheManager.invalidate('classes');
  },

  async update(id, data) {
    const current = snap(await getDoc(doc(db, 'classes', id)));
    if (!current) throw new Error('Class not found');
    const updates = { ...data, updatedAt: now() };
    await updateDoc(doc(db, 'classes', id), updates);
    if (data.className && data.className !== current.className) {
      const students = await StudentService.getAllFresh();
      const linked = students.filter(student => student.classId === id || (
        !student.classId && student.class === current.className &&
        (student.departmentId ? student.departmentId === current.departmentId : student.department === current.department)
      ));
      await batchUpdateDocs('students', linked, () => ({ class: data.className, classId: id }));
    }
    CacheManager.invalidate('classes');
    CacheManager.invalidatePrefix('students_');
  },

  async delete(id) {
    const cls = snap(await getDoc(doc(db, 'classes', id)));
    if (cls) {
      const allStudents = await StudentService.getAllFresh();
      const students = allStudents.filter(student => student.classId === id || (
        !student.classId && student.class === cls.className &&
        (cls.departmentId ? student.departmentId === cls.departmentId : student.department === cls.department) &&
        (!cls.schoolId || !student.schoolId || student.schoolId === cls.schoolId)
      ));
      
      const batch = writeBatch(db);
      for (const s of students) {
        batch.update(doc(db, 'students', s.id), { class: null, classId: null, updatedAt: now() });
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
  async assign(studentId, mentorId, mentorName, secondaryMentorId = undefined) {
    // Update student and increment faculty counter atomically via StudentService
    await StudentService.assignMentor(studentId, mentorId, 'Admin', 'MANUAL', secondaryMentorId);
  },

  async batchAssign(studentIds, mentorId, isSecondary = false) {
    if (!studentIds || studentIds.length === 0 || !mentorId) return;
    const mentorSnap = await getDoc(doc(db, 'faculty', mentorId));
    if (!mentorSnap.exists()) throw new Error('Selected mentor was not found');
    const mentor = { id: mentorSnap.id, ...mentorSnap.data() };
    const studentSnaps = await Promise.all(studentIds.map(id => getDoc(doc(db, 'students', id))));
    const students = studentSnaps.map((item, index) => {
      if (!item.exists()) throw new Error('One or more selected students no longer exist');
      return { id: item.id, ...item.data(), selectedId: studentIds[index] };
    });
    const departmentMatches = await Promise.all(students.map(student => sameDepartment(student, mentor)));
    if (departmentMatches.some(matches => !matches)) {
      throw new Error('A mentor can only be assigned to students from the same department and school.');
    }
    if (!['FACULTY', 'MENTOR', 'HOD'].includes(String(mentor.role || '').toUpperCase())) {
      throw new Error('Selected user is not eligible to mentor students.');
    }
    const assignmentField = isSecondary ? 'secondaryMentorId' : 'mentorId';
    const additionalStudents = students.filter(student => student[assignmentField] !== mentorId).length;
    if ((mentor.assignedStudentCount || 0) + additionalStudents > (mentor.maxStudents || 20)) {
      throw new Error('Selected mentor does not have enough capacity for this batch.');
    }
    const batch = writeBatch(db);
    const mentorCountDeltas = new Map();
    students.forEach(student => {
      const id = student.id;
      const field = assignmentField;
      if (isSecondary && student.mentorId === mentorId) throw new Error('Primary and secondary mentors must be different.');
      if (!isSecondary && student.secondaryMentorId === mentorId) throw new Error('Primary and secondary mentors must be different.');
      const previousMentorId = student[field] || null;
      if (previousMentorId !== mentorId) {
        if (previousMentorId) mentorCountDeltas.set(previousMentorId, (mentorCountDeltas.get(previousMentorId) || 0) - 1);
        mentorCountDeltas.set(mentorId, (mentorCountDeltas.get(mentorId) || 0) + 1);
      }
      batch.update(doc(db, 'students', id), {
        [field]: mentorId,
        mentorIds: [...new Set([student.mentorId, student.secondaryMentorId, mentorId].filter(Boolean))],
        updatedAt: new Date().toISOString()
      });
    });
    mentorCountDeltas.forEach((delta, id) => {
      if (delta) batch.update(doc(db, 'faculty', id), { assignedStudentCount: increment(delta) });
    });
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
    mentors = mentors.filter(m => ['FACULTY', 'MENTOR', 'HOD'].includes(String(m.role || '').toUpperCase()));
    const results = [];
    const groups = new Map();
    students.forEach(student => {
      const key = student.departmentId
        ? `id:${student.departmentId}`
        : `name:${normalizeOrgValue(student.schoolId || student.schoolName)}|${normalizeOrgValue(student.department)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(student);
    });

    let processed = 0;
    for (const group of groups.values()) {
      const groupMentorMatches = await Promise.all(mentors.map(mentor => sameDepartment(group[0], mentor)));
      const groupMentors = mentors.filter((mentor, index) => groupMentorMatches[index])
        .sort((a, b) => ((a.assignedStudentCount || 0) - (b.assignedStudentCount || 0)));
      for (const student of group) {
        const mentor = groupMentors.find(item => (item.assignedStudentCount || 0) < (item.maxStudents || 20));
        if (mentor) {
          const batch = writeBatch(db);
          batch.update(doc(db, 'students', student.id), { mentorId: mentor.id, mentorIds: [mentor.id], updatedAt: now() });
          batch.update(doc(db, 'faculty', mentor.id), { assignedStudentCount: increment(1) });
          await batch.commit();
          mentor.assignedStudentCount = (mentor.assignedStudentCount || 0) + 1;
          results.push({ studentId: student.id, mentorId: mentor.id });
        }
        processed++;
        if (onProgress && processed % 25 === 0) onProgress(processed, students.length);
      }
    }
    if (onProgress) onProgress(processed, students.length);

    CacheManager.invalidatePrefix('students_');
    CacheManager.invalidatePrefix('faculty_');
    return results;
  },

  async unallotAll(department = null, onProgress = null) {
    let students = department
      ? await StudentService.getByDepartment(department)
      : await StudentService.getAll();
    const assignedStudents = students.filter(s => s.mentorId || s.secondaryMentorId);

    let mentors = department
      ? await FacultyService.getByDepartment(department)
      : await FacultyService.getAll();

    let currentBatch = writeBatch(db);
    let batchCount = 0;
    let processed = 0;

    // Reset student mentorId & secondaryMentorId assignments
    for (let i = 0; i < assignedStudents.length; i++) {
      const student = assignedStudents[i];
      currentBatch.update(doc(db, 'students', student.id), {
        mentorId: null,
        secondaryMentorId: null,
        mentorIds: [],
        updatedAt: now()
      });
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

  async getMentorStats(mentorId, forceRefresh = false) {
    const cacheKey = `mentor_stats_${mentorId}`;
    const cached = forceRefresh ? null : CacheManager.get(cacheKey);
    if (cached) return cached;

    const [students, meetings, issues] = await Promise.all([
      StudentService.getByMentor(mentorId, forceRefresh),
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

export const AdminService = {
  async createUser(data) {
    const payload = { ...data };
    payload.email = String(payload.email || '').trim().toLowerCase();
    if (!payload.email) throw new Error('Email is required.');
    if (String(payload.password || '').length < 6) {
      throw new Error('A password with at least 6 characters is required.');
    }
    const { api } = await import('/js/api.js');
    const profile = await api.post('/admin/users', payload);
    CacheManager.invalidatePrefix('students_');
    CacheManager.invalidatePrefix('faculty_');
    return profile;
  },

  async updateUser(userId, data) {
    const { api } = await import('/js/api.js');
    const profile = await api.put(`/admin/users/${userId}`, data);
    CacheManager.invalidate(`faculty_${userId}`);
    CacheManager.invalidate(`student_${userId}`);
    CacheManager.invalidatePrefix('faculty_');
    CacheManager.invalidatePrefix('students_');
    return profile;
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

