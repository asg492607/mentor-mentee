import { db } from '/js/firebase-init.js';
import { CacheManager } from '/js/cache.js';
import {
  collection, doc, getDoc, getDocs, query, where, setDoc,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const timestamp = () => new Date().toISOString();
function invalidateAcademicCaches(studentId = null) {
  if (studentId) CacheManager.invalidate(`student_${studentId}`);
  CacheManager.invalidatePrefix('students_');
  CacheManager.invalidatePrefix('mentor_stats_');
}
const idPart = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const normalizeCourses = courses => (Array.isArray(courses) ? courses : []).map(course => {
  const requested = Number(course?.durationYears);
  const durationYears = Number.isInteger(requested) && requested >= 1 && requested <= 8 ? requested : 0;
  return { ...course, durationYears, semesterCount: durationYears * 2, semesterDurationMonths: 6 };
});

export function yearNumber(value) {
  const raw = String(value ?? '').trim().toUpperCase();
  const match = raw.match(/(?:^|\D)([1-8])(?:\D|$)/);
  if (match) return Number(match[1]);
  return ({ FY: 1, FIRST: 1, 'FIRST YEAR': 1, SY: 2, SECOND: 2, 'SECOND YEAR': 2, TY: 3, THIRD: 3, 'THIRD YEAR': 3, LY: 4, FINAL: 4, 'FINAL YEAR': 4, 'FOURTH YEAR': 4 })[raw] || null;
}

export function yearLabel(value, duration = 4) {
  const n = yearNumber(value);
  const labels = { 1: 'FY', 2: 'SY', 3: 'TY', 4: 'LY' };
  if (!n || n > Number(duration || 4)) return '';
  return labels[n] || `Year ${n}`;
}

export function getAttendanceStatus(student) {
  const attendance = Number(student?.attendance);
  const sessions = Number(student?.attendanceSessions || 0);
  const hasRecordedAttendance = Number.isFinite(sessions) && sessions > 0 || (Number.isFinite(attendance) && attendance > 0);
  if (!hasRecordedAttendance) return { key: 'NOT_RECORDED', label: 'Not recorded', badgeClass: 'badge-muted', isLow: false };
  if (attendance <= 40) return { key: 'LOW', label: 'Low attendance', badgeClass: 'badge-danger', isLow: true };
  if (attendance < 75) return { key: 'BELOW_TARGET', label: 'Below target', badgeClass: 'badge-warning', isLow: false };
  return { key: 'ON_TRACK', label: 'On track', badgeClass: 'badge-success', isLow: false };
}

export const AcademicConfigService = {
  async get() {
    const snap = await getDoc(doc(db, 'settings', 'academics'));
    if (!snap.exists()) {
      const year = new Date().getFullYear();
      return { activeAcademicYear: `${year}-${String(year + 1).slice(-2)}`, courses: [] };
    }
    const data = snap.data();
    return { ...data, courses: normalizeCourses(data.courses) };
  },
  async save(data) {
    const courses = normalizeCourses(data.courses);
    if (courses.some(course => !String(course.name || '').trim() || !Number.isInteger(course.durationYears) || course.durationYears < 1 || course.durationYears > 8)) {
      throw new Error('Every configured course needs a name and a duration from 1 to 8 years.');
    }
    await setDoc(doc(db, 'settings', 'academics'), { ...data, courses, updatedAt: timestamp() }, { merge: true });
  }
};

export const AcademicStudentService = {
  async findByEnrollment(enrollmentNumber) {
    const normalized = String(enrollmentNumber || '').trim();
    if (!normalized) return null;
    const students = await getDocs(query(collection(db, 'students'), where('enrollmentNumber', '==', normalized)));
    const match = students.docs[0];
    return match ? { id: match.id, ...match.data() } : null;
  },
  async getByClass(classInfo) {
    if (!classInfo?.id) return [];
    const byClass = await getDocs(query(collection(db, 'students'), where('classId', '==', classInfo.id)));
    return byClass.docs.map(s => ({ id: s.id, ...s.data() }))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }
};

export const AttendanceService = {
  async saveSession({ classInfo, date, period = '', students, actor }) {
    const normalizedPeriod = String(period || '').trim();
    if (!classInfo?.id || !date || !normalizedPeriod || normalizedPeriod.length > 60 || !Array.isArray(students) || !students.length) {
      throw new Error('Choose a class, date, session period, and at least one student before saving attendance.');
    }
    const sessionId = `${idPart(classInfo.id)}_${date}_${idPart(normalizedPeriod)}`;
    const present = students.filter(s => s.present).length;
    const session = {
      classId: classInfo.id,
      className: classInfo.className,
      schoolId: classInfo.schoolId || null,
      schoolName: classInfo.schoolName || '',
      departmentId: classInfo.departmentId || null,
      department: classInfo.department || '',
      course: classInfo.course || '',
      year: classInfo.year || null,
      date,
      period: normalizedPeriod,
      totalStudents: students.length,
      presentCount: present,
      absentCount: students.length - present,
      createdBy: actor?.id || actor?.uid || '',
      createdByName: actor?.name || '',
      updatedAt: timestamp()
    };
    const records = students.filter(s => s.id);
    for (let offset = 0; offset < records.length; offset += 400) {
      const batch = writeBatch(db);
      records.slice(offset, offset + 400).forEach(student => {
        const recordId = `${sessionId}_${idPart(student.id)}`;
        batch.set(doc(db, 'attendance_records', recordId), {
          sessionId,
          classId: classInfo.id,
          className: classInfo.className,
          schoolId: classInfo.schoolId || null,
          schoolName: classInfo.schoolName || '',
          departmentId: classInfo.departmentId || null,
          department: classInfo.department || '',
          date,
          period: normalizedPeriod,
          studentId: student.id,
          studentName: student.name || '',
          enrollmentNumber: student.enrollmentNumber || '',
          present: Boolean(student.present),
          updatedAt: timestamp()
        });
      });
      if (offset === 0) batch.set(doc(db, 'attendance_sessions', sessionId), { ...session, createdAt: timestamp() }, { merge: true });
      await batch.commit();
    }

    const { api } = await import('/js/api.js');
    try {
      await api.post(`/mentor/classes/${encodeURIComponent(classInfo.id)}/attendance/recalculate`, {});
    } finally {
      invalidateAcademicCaches();
    }
    return { id: sessionId, ...session };
  },
  async getByStudent(studentId) {
    const snap = await getDocs(query(collection(db, 'attendance_records'), where('studentId', '==', studentId)));
    return snap.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  },
  async getByClass(classId) {
    if (!classId) return [];
    const snap = await getDocs(query(collection(db, 'attendance_records'), where('classId', '==', classId)));
    return snap.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  },
  async getMonthlyByStudent(studentId) {
    const records = await this.getByStudent(studentId);
    const months = new Map();
    records.forEach(record => {
      const key = String(record.date || '').slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(key)) return;
      const month = months.get(key) || { month: key, sessions: 0, present: 0, absent: 0 };
      month.sessions++;
      if (record.present === true) month.present++;
      else month.absent++;
      months.set(key, month);
    });
    return [...months.values()].sort((a, b) => b.month.localeCompare(a.month)).map(month => ({
      ...month,
      attendance: month.sessions ? Math.round((month.present / month.sessions) * 1000) / 10 : 0
    }));
  }
};

export const AttendanceInterventionService = {
  async requestMeeting(studentId) {
    if (!studentId) throw new Error('Select a student first.');
    const { api } = await import('/js/api.js');
    const result = await api.post(`/meetings/students/${encodeURIComponent(studentId)}/attendance-intervention`, {});
    CacheManager.invalidatePrefix('mentor_stats_');
    return result;
  }
};

export function semesterNumber(value) {
  const text = String(value || '').trim().toUpperCase();
  const numeric = text.match(/^(?:SEM(?:ESTER)?\s*)?(\d{1,2})$/);
  if (numeric) return Number(numeric[1]);
  const roman = text.match(/^(?:SEM(?:ESTER)?\s*)?([IVXLCDM]+)$/);
  if (!roman) return 0;
  return ({ I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16 })[roman[1]] || 0;
}

export function semesterCountForDuration(durationYears) {
  const years = Number(durationYears);
  return Number.isInteger(years) && years >= 1 && years <= 8 ? years * 2 : 0;
}

export function semesterCountForCourse(student, courses = []) {
  const fromStudent = semesterCountForDuration(student?.durationYears);
  if (fromStudent) return fromStudent;
  const courseName = String(student?.course || student?.program || '').trim().toLowerCase();
  const configured = courses.find(course => String(course?.name || '').trim().toLowerCase() === courseName);
  return semesterCountForDuration(configured?.durationYears);
}

export const ResultService = {
  async save({ student, semester, examName = '', academicYear = '', sgpa = null, cgpa = null, backlogs = null, subjects = [], uploadedBy = '' }) {
    if (!student?.id || !String(semester || '').trim()) throw new Error('A student and semester are required.');
    const semesterValue = String(semester).trim();
    const { api } = await import('/js/api.js');
    const payload = {
      studentId: student.id,
      semester: semesterValue,
      semesterNumber: semesterNumber(semesterValue),
      examName: String(examName || '').trim(),
      academicYear: String(academicYear || '').trim(),
      sgpa: sgpa === '' || sgpa === null || sgpa === undefined ? null : Number(sgpa),
      cgpa: cgpa === '' || cgpa === null || cgpa === undefined ? null : Number(cgpa),
      backlogs: backlogs === '' || backlogs === null || backlogs === undefined ? null : Number(backlogs),
      subjects: Array.isArray(subjects) ? subjects : [],
    };
    const result = await api.post('/admissions/results', payload);
    invalidateAcademicCaches(student.id);
    return { ...result, ...payload, uploadedBy };
  },
  async getByStudent(studentId) {
    const snap = await getDocs(query(collection(db, 'academic_results'), where('studentId', '==', studentId)));
    return snap.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => (b.semesterNumber || 0) - (a.semesterNumber || 0) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  },
  async getAll() {
    const snap = await getDocs(collection(db, 'academic_results'));
    return snap.docs.map(item => ({ id: item.id, ...item.data() }));
  }
};
