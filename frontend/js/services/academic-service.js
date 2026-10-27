import { db } from '/js/firebase-init.js';
import { StudentService } from '/js/services.js';
import {
  collection, doc, getDoc, getDocs, query, where, setDoc,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const timestamp = () => new Date().toISOString();
const idPart = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function academicRisk(student) {
  let score = 0;
  const cgpa = Number.parseFloat(student?.cgpa) || 0;
  const attendance = Number.parseFloat(student?.attendance) || 0;
  const openIssues = Number.parseInt(student?.openIssuesCount, 10) || 0;
  if (cgpa > 0) score += cgpa < 5 ? 40 : cgpa < 6 ? 30 : cgpa < 7 ? 15 : 0;
  if (student?.attendance !== undefined) score += attendance < 60 ? 40 : attendance < 75 ? 25 : attendance < 85 ? 10 : 0;
  if (openIssues >= 3) score += 20;
  else if (openIssues > 0) score += 10;
  return { riskScore: Math.min(100, score), riskLevel: score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW' };
}

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

export const AcademicConfigService = {
  async get() {
    const snap = await getDoc(doc(db, 'settings', 'academics'));
    if (!snap.exists()) {
      const year = new Date().getFullYear();
      return { activeAcademicYear: `${year}-${String(year + 1).slice(-2)}`, courses: [] };
    }
    return snap.data();
  },
  async save(data) {
    await setDoc(doc(db, 'settings', 'academics'), { ...data, updatedAt: timestamp() }, { merge: true });
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
    const [byClass, byLegacyClass] = await Promise.all([
      getDocs(query(collection(db, 'students'), where('classId', '==', classInfo.id))),
      getDocs(query(collection(db, 'students'), where('class', '==', classInfo.className)))
    ]);
    const records = new Map();
    [...byClass.docs, ...byLegacyClass.docs].forEach(s => {
      const data = s.data();
      if (data.department === classInfo.department) records.set(s.id, { id: s.id, ...data });
    });
    return [...records.values()].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }
};

export const AttendanceService = {
  async saveSession({ classInfo, date, period = '', students, actor }) {
    if (!classInfo?.id || !date || !Array.isArray(students) || !students.length) {
      throw new Error('Choose a class, date, and at least one student before saving attendance.');
    }
    const sessionId = `${idPart(classInfo.id)}_${date}_${idPart(period || 'regular')}`;
    const present = students.filter(s => s.present).length;
    const session = {
      classId: classInfo.id,
      className: classInfo.className,
      department: classInfo.department || '',
      course: classInfo.course || '',
      year: classInfo.year || null,
      date,
      period: String(period || '').trim(),
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
          department: classInfo.department || '',
          date,
          period: String(period || '').trim(),
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

    await Promise.all([...new Set(records.map(s => s.id))].map(async studentId => {
      const history = await getDocs(query(
        collection(db, 'attendance_records'),
        where('studentId', '==', studentId),
        where('classId', '==', classInfo.id)
      ));
      const count = history.size;
      const attended = history.docs.reduce((sum, item) => sum + (item.data().present ? 1 : 0), 0);
      const profileSnap = await getDoc(doc(db, 'students', studentId));
      const nextAttendance = count ? Math.round((attended / count) * 1000) / 10 : 0;
      const risk = academicRisk({ ...(profileSnap.exists() ? profileSnap.data() : {}), attendance: nextAttendance });
      await StudentService.update(studentId, {
        attendance: nextAttendance,
        attendanceSessions: count,
        attendancePresent: attended,
        ...risk,
      });
    }));
    return { id: sessionId, ...session };
  },
  async getByStudent(studentId) {
    const snap = await getDocs(query(collection(db, 'attendance_records'), where('studentId', '==', studentId)));
    return snap.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }
};

function semesterNumber(value) {
  const text = String(value || '').toUpperCase();
  const numeric = text.match(/\d+/);
  if (numeric) return Number(numeric[0]);
  const roman = text.match(/\b(VIII|VII|VI|V|IV|III|II|I)\b/);
  return roman ? ({ I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 })[roman[1]] : 0;
}

export const ResultService = {
  async save({ student, semester, examName = '', academicYear = '', sgpa = null, cgpa = null, backlogs = null, subjects = [], uploadedBy = '' }) {
    if (!student?.id || !String(semester || '').trim()) throw new Error('A student and semester are required.');
    const semesterValue = String(semester).trim();
    const resultId = `${idPart(student.id)}_${idPart(semesterValue)}_${idPart(academicYear || 'academic-year')}_${idPart(examName || 'result')}`;
    const payload = {
      studentId: student.id,
      studentName: student.name || '',
      enrollmentNumber: student.enrollmentNumber || '',
      department: student.department || '',
      course: student.course || student.program || '',
      year: student.year || null,
      semester: semesterValue,
      semesterNumber: semesterNumber(semesterValue),
      examName: String(examName || '').trim(),
      academicYear: String(academicYear || '').trim(),
      sgpa: sgpa === '' || sgpa === null || sgpa === undefined ? null : Number(sgpa),
      cgpa: cgpa === '' || cgpa === null || cgpa === undefined ? null : Number(cgpa),
      backlogs: backlogs === '' || backlogs === null || backlogs === undefined ? null : Number(backlogs),
      subjects: Array.isArray(subjects) ? subjects : [],
      uploadedBy,
      updatedAt: timestamp()
    };
    await setDoc(doc(db, 'academic_results', resultId), { ...payload, createdAt: timestamp() }, { merge: true });
    const resultSnap = await getDocs(query(collection(db, 'academic_results'), where('studentId', '==', student.id)));
    const history = resultSnap.docs.map(item => item.data()).sort((a, b) => (b.semesterNumber || 0) - (a.semesterNumber || 0) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    const latest = history[0] || payload;
    const updates = { latestSemester: latest.semester, latestSGPA: latest.sgpa ?? null, updatedAt: timestamp() };
    if (latest.cgpa !== null && latest.cgpa !== undefined) updates.cgpa = latest.cgpa;
    if (latest.backlogs !== null && latest.backlogs !== undefined) updates.backlogs = latest.backlogs;
    Object.assign(updates, academicRisk({ ...student, ...updates }));
    await StudentService.update(student.id, updates);
    return { id: resultId, ...payload };
  },
  async getByStudent(studentId) {
    const snap = await getDocs(query(collection(db, 'academic_results'), where('studentId', '==', studentId)));
    return snap.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => (b.semesterNumber || 0) - (a.semesterNumber || 0) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }
};
