import { FacultyService, StudentService } from '/js/services.js';
import { showToast } from '/js/components/toast.js';

export async function exportMentorStudentReport(format = 'excel') {
  showToast(`Preparing ${format.toUpperCase()} classwise allocation report...`, 'info');
  try {
    const [allMentors, allStudents] = await Promise.all([
      FacultyService.getAll(),
      StudentService.getAll()
    ]);

    const mentors = allMentors.filter(f => f.role === 'FACULTY' || f.role === 'MENTOR' || f.role === 'HOD' || (f.assignedStudentCount && f.assignedStudentCount > 0));

    if (mentors.length === 0 && allStudents.length === 0) {
      return showToast('No mentors or students found to generate report', 'warning');
    }

    // 1. Sort Primary: Classwise (TY CORE 1, TY CORE 2, etc.)
    // 2. Sort Secondary: Mentorwise (All mentees of Mentor 1 first, then Mentor 2, etc.)
    // 3. Sort Tertiary: Student Name
    const sortedStudents = [...allStudents].sort((a, b) => {
      const classA = a.class ? `${a.class}` : 'Unassigned';
      const classB = b.class ? `${b.class}` : 'Unassigned';
      if (classA === 'Unassigned' && classB !== 'Unassigned') return 1;
      if (classB === 'Unassigned' && classA !== 'Unassigned') return -1;
      const classComp = classA.localeCompare(classB, undefined, { numeric: true, sensitivity: 'base' });
      if (classComp !== 0) return classComp;

      const mA = mentors.find(x => x.id === a.mentorId)?.name || 'Unassigned Mentor';
      const mB = mentors.find(x => x.id === b.mentorId)?.name || 'Unassigned Mentor';
      if (mA === 'Unassigned Mentor' && mB !== 'Unassigned Mentor') return 1;
      if (mB === 'Unassigned Mentor' && mA !== 'Unassigned Mentor') return -1;
      const mentorComp = mA.localeCompare(mB);
      if (mentorComp !== 0) return mentorComp;

      return (a.name || '').localeCompare(b.name || '');
    });

    // Build flat row list ordered Classwise -> Mentorwise -> Studentwise
    const reportRows = sortedStudents.map((s, idx) => {
      const m = mentors.find(x => x.id === s.mentorId);
      return {
        'Sr No': idx + 1,
        'Class': s.class ? `Class ${s.class}` : 'Unassigned Class',
        'Assigned Mentor': m ? m.name : 'Unassigned',
        'Student Name': s.name || '—',
        'Enrollment No': s.enrollmentNumber || '—',
        'Mentor Dept': m ? (m.department || '—') : '—',
        'Mentor Designation': m ? (m.designation || 'Faculty') : '—',
        'Student Dept': s.department || '—'
      };
    });

    if (format === 'excel') {
      downloadExcelReport(reportRows, mentors, sortedStudents);
    } else if (format === 'pdf') {
      downloadPdfReport(reportRows, mentors, sortedStudents);
    }
  } catch (err) {
    console.error("Export error:", err);
    showToast(`Failed to export report: ${err.message}`, 'error');
  }
}

function downloadExcelReport(reportRows, mentors, sortedStudents) {
  if (typeof XLSX === 'undefined') {
    return showToast('Excel export library (SheetJS) is not loaded', 'error');
  }

  const wb = XLSX.utils.book_new();

  // Sheet 1: Classwise & Mentorwise Allocation List
  const ws1 = XLSX.utils.json_to_sheet(reportRows);
  ws1['!cols'] = [
    { wch: 8 },  // Sr No
    { wch: 18 }, // Class
    { wch: 25 }, // Assigned Mentor
    { wch: 25 }, // Student Name
    { wch: 18 }, // Enrollment No
    { wch: 20 }, // Mentor Dept
    { wch: 20 }, // Mentor Designation
    { wch: 20 }  // Student Dept
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Class & Mentor Allocations');

  // Sheet 2: Class Summary
  const classMap = {};
  sortedStudents.forEach(s => {
    const cName = s.class ? `Class ${s.class}` : 'Unassigned Class';
    if (!classMap[cName]) {
      classMap[cName] = { total: 0, assigned: 0, mentors: new Set() };
    }
    classMap[cName].total++;
    if (s.mentorId) {
      classMap[cName].assigned++;
      classMap[cName].mentors.add(s.mentorId);
    }
  });

  const classSummary = Object.keys(classMap).map((cName, idx) => ({
    'Sr No': idx + 1,
    'Class Name': cName,
    'Total Students': classMap[cName].total,
    'Assigned Mentees': classMap[cName].assigned,
    'Unassigned Students': classMap[cName].total - classMap[cName].assigned,
    'Unique Mentors Count': classMap[cName].mentors.size
  }));

  const ws2 = XLSX.utils.json_to_sheet(classSummary);
  ws2['!cols'] = [
    { wch: 8 },
    { wch: 22 },
    { wch: 16 },
    { wch: 18 },
    { wch: 22 },
    { wch: 22 }
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'Class Summary');

  // Sheet 3: Mentor Summary
  const mentorSummary = mentors.map((m, idx) => {
    const count = sortedStudents.filter(s => s.mentorId === m.id).length;
    return {
      'Sr No': idx + 1,
      'Mentor Name': m.name,
      'Department': m.department || '—',
      'Designation': m.designation || 'Faculty',
      'Total Assigned Students': count
    };
  });
  const ws3 = XLSX.utils.json_to_sheet(mentorSummary);
  ws3['!cols'] = [
    { wch: 8 },
    { wch: 25 },
    { wch: 20 },
    { wch: 22 },
    { wch: 25 }
  ];
  XLSX.utils.book_append_sheet(wb, ws3, 'Mentor Summary');

  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `Classwise_Mentor_Student_Allocations_${dateStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
  showToast('Excel classwise allocation report downloaded successfully!', 'success');
}

function downloadPdfReport(reportRows, mentors, sortedStudents) {
  if (window.jspdf && window.jspdf.jsPDF) {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Title & Header
      doc.setFontSize(16);
      doc.setTextColor(98, 84, 231);
      doc.text("Lumina — Classwise & Mentorwise Allocation Report", 14, 15);

      doc.setFontSize(9);
      doc.setTextColor(100);
      const assignedCount = sortedStudents.filter(s => s.mentorId).length;
      doc.text(`Generated on: ${new Date().toLocaleString()} | Total Students: ${sortedStudents.length} | Assigned Mentees: ${assignedCount} | Total Mentors: ${mentors.length}`, 14, 22);

      const headers = [['#', 'Class', 'Assigned Mentor', 'Student Name', 'Enrollment No', 'Mentor Dept', 'Student Dept']];
      const body = reportRows.map(r => [
        r['Sr No'],
        r['Class'],
        r['Assigned Mentor'],
        r['Student Name'],
        r['Enrollment No'],
        r['Mentor Dept'],
        r['Student Dept']
      ]);

      doc.autoTable({
        startY: 26,
        head: headers,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [98, 84, 231], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 35 },
          2: { cellWidth: 50 },
          3: { cellWidth: 50 },
          4: { cellWidth: 40 },
          5: { cellWidth: 40 },
          6: { cellWidth: 40 }
        }
      });

      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `Classwise_Mentor_Student_Allocations_${dateStr}.pdf`;
      doc.save(fileName);
      showToast('PDF classwise allocation report downloaded successfully!', 'success');
      return;
    } catch (err) {
      console.warn("jsPDF error, falling back to print window:", err);
    }
  }

  // Fallback: Printable HTML Report Window
  openPrintableReportWindow(reportRows, mentors, sortedStudents);
}

function openPrintableReportWindow(reportRows, mentors, sortedStudents) {
  const printWin = window.open('', '_blank', 'width=1050,height=800');
  if (!printWin) {
    return showToast('Pop-up blocked. Please allow pop-ups to view printable PDF report.', 'warning');
  }

  const assignedCount = sortedStudents.filter(s => s.mentorId).length;

  // Group reportRows by Class -> then by Mentor
  const classGroups = {};
  reportRows.forEach(r => {
    const c = r['Class'];
    if (!classGroups[c]) classGroups[c] = {};
    const m = r['Assigned Mentor'];
    if (!classGroups[c][m]) classGroups[c][m] = [];
    classGroups[c][m].push(r);
  });

  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Classwise & Mentorwise Allocation Report</title>
      <style>
        body { font-family: 'Inter', system-ui, sans-serif; padding: 24px; color: #1e293b; background: #fff; }
        h2 { color: #6254e7; margin-bottom: 4px; }
        .meta { color: #64748b; font-size: 0.85rem; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
        .class-header { background: #f1f5f9; padding: 10px 14px; border-left: 5px solid #6254e7; font-size: 1.05rem; font-weight: 800; margin: 28px 0 14px 0; border-radius: 0 6px 6px 0; display: flex; justify-content: space-between; align-items: center; }
        .mentor-header { background: #faf5ff; padding: 8px 12px; border-left: 4px solid #9333ea; font-size: 0.925rem; font-weight: 700; color: #6b21a8; margin: 16px 0 8px 0; border-radius: 0 4px 4px 0; display: flex; justify-content: space-between; }
        table { width: 100%; border-collapse: collapse; font-size: 0.825rem; margin-bottom: 16px; }
        th { background: #6254e7; color: #fff; text-align: left; padding: 8px; font-weight: 600; }
        td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background: #f8fafc; }
        @media print {
          body { padding: 0; }
          button { display: none; }
          .class-header, .mentor-header { break-after: avoid; }
        }
      </style>
    </head>
    <body>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h2>Classwise & Mentorwise Allocation Report</h2>
        <button onclick="window.print()" style="padding:8px 16px;background:#6254e7;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">🖨️ Print / Save as PDF</button>
      </div>
      <div class="meta">
        Generated: ${new Date().toLocaleString()} | Total Students: ${sortedStudents.length} | Assigned Mentees: ${assignedCount} | Total Mentors: ${mentors.length}
      </div>

      ${Object.keys(classGroups).map(cName => {
        const mentorsInClass = classGroups[cName];
        let totalInClass = 0;
        Object.values(mentorsInClass).forEach(arr => totalInClass += arr.length);

        return `
          <div class="class-header">
            <span>📌 ${cName}</span>
            <span style="font-size:0.85rem;font-weight:600;color:#64748b;">${totalInClass} Student(s) across ${Object.keys(mentorsInClass).length} Mentor(s)</span>
          </div>

          ${Object.keys(mentorsInClass).map(mName => {
            const rows = mentorsInClass[mName];
            return `
              <div class="mentor-header">
                <span>👤 Mentor: <strong>${mName}</strong></span>
                <span>${rows.length} Assigned Mentees</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th style="width:40px;">#</th>
                    <th>Student Name</th>
                    <th>Enrollment No</th>
                    <th>Mentor Dept</th>
                    <th>Student Dept</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.map(r => `
                    <tr>
                      <td>${r['Sr No']}</td>
                      <td><strong>${r['Student Name']}</strong></td>
                      <td>${r['Enrollment No']}</td>
                      <td>${r['Mentor Dept']}</td>
                      <td>${r['Student Dept']}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `;
          }).join('')}
        `;
      }).join('')}
    </body>
    </html>
  `);
  printWin.document.close();
}

export async function exportSingleMentorReport(mentorId, format = 'excel') {
  if (!mentorId) return showToast('Please select a mentor first', 'warning');
  showToast(`Preparing ${format.toUpperCase()} report for selected mentor...`, 'info');
  try {
    const mentor = await FacultyService.get(mentorId);
    if (!mentor) return showToast('Mentor not found', 'error');

    const students = await StudentService.getByMentor(mentorId);
    if (!students || students.length === 0) {
      return showToast(`No assigned mentees found for ${mentor.name}`, 'warning');
    }

    // Sort students classwise, then by student name
    const sorted = [...students].sort((a, b) => {
      const classA = a.class ? `${a.class}` : 'Unassigned';
      const classB = b.class ? `${b.class}` : 'Unassigned';
      if (classA === 'Unassigned' && classB !== 'Unassigned') return 1;
      if (classB === 'Unassigned' && classA !== 'Unassigned') return -1;
      const cComp = classA.localeCompare(classB, undefined, { numeric: true, sensitivity: 'base' });
      if (cComp !== 0) return cComp;
      return (a.name || '').localeCompare(b.name || '');
    });

    const reportRows = sorted.map((s, idx) => ({
      'Sr No': idx + 1,
      'Class': s.class ? `Class ${s.class}` : 'Unassigned Class',
      'Student Name': s.name || '—',
      'Enrollment No': s.enrollmentNumber || '—',
      'Department': s.department || '—'
    }));

    const sanitizeName = (mentor.name || 'Mentor').replace(/[^a-zA-Z0-9_-]/g, '_');

    if (format === 'excel') {
      if (typeof XLSX === 'undefined') return showToast('Excel export library is not loaded', 'error');
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(reportRows);
      ws['!cols'] = [
        { wch: 8 },  // Sr No
        { wch: 18 }, // Class
        { wch: 25 }, // Student Name
        { wch: 18 }, // Enrollment No
        { wch: 20 }  // Department
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Mentees List');
      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `${sanitizeName}_Mentees_${dateStr}.xlsx`);
      showToast(`Excel mentee report for ${mentor.name} downloaded successfully!`, 'success');
    } else if (format === 'pdf') {
      if (window.jspdf && window.jspdf.jsPDF) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        doc.setFontSize(14);
        doc.setTextColor(98, 84, 231);
        doc.text(`Mentee Allocation Report — ${mentor.name}`, 14, 15);

        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Department: ${mentor.department || '—'} | Designation: ${mentor.designation || 'Faculty'} | Total Mentees: ${students.length}`, 14, 22);

        const headers = [['#', 'Class', 'Student Name', 'Enrollment No', 'Department']];
        const body = reportRows.map(r => [
          r['Sr No'],
          r['Class'],
          r['Student Name'],
          r['Enrollment No'],
          r['Department']
        ]);

        doc.autoTable({
          startY: 26,
          head: headers,
          body: body,
          theme: 'grid',
          headStyles: { fillColor: [98, 84, 231], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
          styles: { fontSize: 8, cellPadding: 2.5 }
        });

        const dateStr = new Date().toISOString().slice(0, 10);
        doc.save(`${sanitizeName}_Mentees_${dateStr}.pdf`);
        showToast(`PDF mentee report for ${mentor.name} downloaded successfully!`, 'success');
      } else {
        openPrintableReportWindow(reportRows, [mentor], sorted);
      }
    }
  } catch (err) {
    console.error("Single mentor export error:", err);
    showToast(`Export failed: ${err.message}`, 'error');
  }
}

/**
 * Filter and compile a detailed list of mentors for one or more selected classes.
 * @param {Array<string>} selectedClasses - List of class names (e.g. ['TY CORE 1', 'TY CORE 2'])
 * @param {Array<object>} allMentors - Array of faculty/mentor objects
 * @param {Array<object>} allStudents - Array of student objects
 * @returns {object} { mentorsList, relevantStudents, selectedClasses, classSummaries }
 */
export function getMentorsForSelectedClasses(selectedClasses = [], allMentors = [], allStudents = []) {
  const isAll = !selectedClasses || selectedClasses.length === 0 || selectedClasses.includes('ALL');
  const classSet = new Set(selectedClasses || []);

  // Filter students belonging to selected classes
  const relevantStudents = allStudents.filter(s => {
    if (isAll) return true;
    const c = s.class || 'Unassigned Class';
    return classSet.has(c) || (classSet.has('UNASSIGNED_CLASS') && !s.class);
  });

  // Filter faculty eligible as mentors
  const mentors = allMentors.filter(f => {
    const r = (f.role || 'FACULTY').toUpperCase();
    return r === 'FACULTY' || r === 'MENTOR' || r === 'HOD' || (f.assignedStudentCount && f.assignedStudentCount > 0);
  });

  const mentorsList = [];

  mentors.forEach(mentor => {
    // Find all mentees of this mentor in the selected classes
    const mentorMenteesInSelected = relevantStudents.filter(s => s.mentorId === mentor.id);

    // Only include mentors who have at least one student in the selected classes (or if all mentors are requested with 0 filter)
    if (mentorMenteesInSelected.length > 0) {
      // Group mentees by class for detailed breakdown
      const classMap = {};
      mentorMenteesInSelected.forEach(s => {
        const cName = s.class ? `Class ${s.class}` : 'Unassigned Class';
        classMap[cName] = (classMap[cName] || 0) + 1;
      });

      const classesBreakdownList = Object.entries(classMap).map(([cName, count]) => ({
        className: cName,
        count
      }));

      const classesBreakdownStr = classesBreakdownList.map(c => `${c.className} (${c.count})`).join(', ');

      const totalPlatformMentees = allStudents.filter(s => s.mentorId === mentor.id).length || mentor.assignedStudentCount || 0;

      mentorsList.push({
        id: mentor.id,
        name: mentor.name || 'Unnamed Mentor',
        email: mentor.email || '—',
        phone: mentor.mobileNumber || mentor.phone || mentor.contactNumber || mentor.mobile || mentor.employeePhone || '—',
        employeeId: mentor.employeeId || '—',
        department: mentor.department || '—',
        designation: mentor.designation || 'Faculty',
        selectedMenteesCount: mentorMenteesInSelected.length,
        totalPlatformMentees,
        classesBreakdownList,
        classesBreakdownStr,
        mentees: mentorMenteesInSelected
      });
    }
  });

  // Sort mentors alphabetically by Name
  mentorsList.sort((a, b) => a.name.localeCompare(b.name));

  // Build Class Summaries
  const classSummaries = [];
  const classesToSummarize = isAll
    ? [...new Set(allStudents.map(s => s.class ? `Class ${s.class}` : 'Unassigned Class'))]
    : selectedClasses.map(c => c === 'UNASSIGNED_CLASS' ? 'Unassigned Class' : (c.startsWith('Class ') ? c : `Class ${c}`));

  classesToSummarize.forEach(cName => {
    const rawClass = cName.replace(/^Class\s+/i, '');
    const classStudents = allStudents.filter(s => (s.class || 'Unassigned Class') === rawClass || (rawClass === 'Unassigned Class' && !s.class));
    const assigned = classStudents.filter(s => s.mentorId);
    const uniqueMentorIds = new Set(assigned.map(s => s.mentorId));

    classSummaries.push({
      className: cName,
      totalStudents: classStudents.length,
      assignedStudents: assigned.length,
      unassignedStudents: classStudents.length - assigned.length,
      uniqueMentorsCount: uniqueMentorIds.size
    });
  });

  return {
    mentorsList,
    relevantStudents,
    selectedClasses: isAll ? ['All Classes'] : selectedClasses,
    classSummaries
  };
}

/**
 * Export a Multi-Class Selected Mentors Report (Excel or PDF) with full mentor details & student breakdown.
 * @param {Array<string>} selectedClasses - List of class names to include
 * @param {string} format - 'excel' | 'pdf'
 * @param {object|null} customData - Optional pre-loaded { allMentors, allStudents }
 */
export async function exportMultiClassMentorsReport(selectedClasses = [], format = 'excel', customData = null) {
  const classesLabel = selectedClasses.length > 0 ? selectedClasses.join(', ') : 'All Classes';
  showToast(`Preparing ${format.toUpperCase()} mentors report for [${classesLabel}]...`, 'info');

  try {
    let allMentors = customData?.allMentors;
    let allStudents = customData?.allStudents;

    if (!allMentors || !allStudents) {
      const [f, s] = await Promise.all([FacultyService.getAll(), StudentService.getAll()]);
      allMentors = f;
      allStudents = s;
    }

    const { mentorsList, relevantStudents, classSummaries } = getMentorsForSelectedClasses(selectedClasses, allMentors, allStudents);

    if (mentorsList.length === 0) {
      return showToast(`No mentors found with students in the selected class(es): ${classesLabel}`, 'warning');
    }

    if (format === 'excel') {
      downloadMultiClassMentorsExcel(mentorsList, relevantStudents, classSummaries, selectedClasses);
    } else if (format === 'pdf') {
      downloadMultiClassMentorsPdf(mentorsList, relevantStudents, classSummaries, selectedClasses);
    }
  } catch (err) {
    console.error("Multi-class export error:", err);
    showToast(`Export failed: ${err.message}`, 'error');
  }
}

function downloadMultiClassMentorsExcel(mentorsList, relevantStudents, classSummaries, selectedClasses) {
  if (typeof XLSX === 'undefined') {
    return showToast('Excel export library (SheetJS) is not loaded', 'error');
  }

  const wb = XLSX.utils.book_new();

  // Sheet 1: Mentors Summary (Selected Classes)
  const mentorsRows = mentorsList.map((m, idx) => ({
    'Sr No': idx + 1,
    'Mentor Name': m.name,
    'Employee ID': m.employeeId,
    'Email': m.email,
    'Contact Number': m.phone,
    'Department': m.department,
    'Designation': m.designation,
    'Classes Mentored': m.classesBreakdownStr,
    'Mentees in Selected Classes': m.selectedMenteesCount,
    'Total Platform Mentees': m.totalPlatformMentees
  }));

  const ws1 = XLSX.utils.json_to_sheet(mentorsRows);
  ws1['!cols'] = [
    { wch: 8 },  // Sr No
    { wch: 26 }, // Mentor Name
    { wch: 16 }, // Employee ID
    { wch: 28 }, // Email
    { wch: 18 }, // Contact
    { wch: 22 }, // Department
    { wch: 20 }, // Designation
    { wch: 32 }, // Classes Mentored
    { wch: 26 }, // Mentees in Selected Classes
    { wch: 22 }  // Total Platform Mentees
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Mentors Directory');

  // Sheet 2: Detailed Mentee Allocations
  // Sort students: Classwise -> Mentorwise -> Studentwise
  const sortedStudents = [...relevantStudents].filter(s => s.mentorId).sort((a, b) => {
    const cA = a.class || 'Unassigned';
    const cB = b.class || 'Unassigned';
    const cComp = cA.localeCompare(cB, undefined, { numeric: true, sensitivity: 'base' });
    if (cComp !== 0) return cComp;

    const mA = mentorsList.find(m => m.id === a.mentorId)?.name || '';
    const mB = mentorsList.find(m => m.id === b.mentorId)?.name || '';
    const mComp = mA.localeCompare(mB);
    if (mComp !== 0) return mComp;

    return (a.name || '').localeCompare(b.name || '');
  });

  const menteeRows = sortedStudents.map((s, idx) => {
    const mentor = mentorsList.find(m => m.id === s.mentorId);
    return {
      'Sr No': idx + 1,
      'Class': s.class ? `Class ${s.class}` : 'Unassigned Class',
      'Assigned Mentor': mentor ? mentor.name : 'Unassigned',
      'Mentor Email': mentor ? mentor.email : '—',
      'Mentor Phone': mentor ? mentor.phone : '—',
      'Student Name': s.name || '—',
      'Enrollment No': s.enrollmentNumber || '—',
      'Student Email': s.email || '—',
      'Student Contact': s.mobileNumber || s.phone || s.studentPhone || s.contactNumber || '—',
      'Father Contact': s.fatherContact || s.parentContact || s.fatherPhoneM || '—',
      'Department': s.department || '—'
    };
  });

  const ws2 = XLSX.utils.json_to_sheet(menteeRows);
  ws2['!cols'] = [
    { wch: 8 },  // Sr No
    { wch: 18 }, // Class
    { wch: 26 }, // Assigned Mentor
    { wch: 26 }, // Mentor Email
    { wch: 18 }, // Mentor Phone
    { wch: 26 }, // Student Name
    { wch: 18 }, // Enrollment No
    { wch: 28 }, // Student Email
    { wch: 18 }, // Student Contact
    { wch: 18 }, // Father Contact
    { wch: 20 }  // Department
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'Mentee Allocations');

  // Sheet 3: Class Summary
  const classRows = classSummaries.map((c, idx) => ({
    'Sr No': idx + 1,
    'Class Name': c.className,
    'Total Students': c.totalStudents,
    'Assigned Students': c.assignedStudents,
    'Unassigned Students': c.unassignedStudents,
    'Unique Mentors Count': c.uniqueMentorsCount
  }));

  const ws3 = XLSX.utils.json_to_sheet(classRows);
  ws3['!cols'] = [
    { wch: 8 },
    { wch: 24 },
    { wch: 16 },
    { wch: 18 },
    { wch: 22 },
    { wch: 22 }
  ];
  XLSX.utils.book_append_sheet(wb, ws3, 'Class Summaries');

  const dateStr = new Date().toISOString().slice(0, 10);
  const classesSlug = selectedClasses.length > 0 ? selectedClasses.slice(0, 3).join('_').replace(/[^a-zA-Z0-9_-]/g, '_') : 'All_Classes';
  const fileName = `Mentors_List_${classesSlug}_${dateStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
  showToast('Multi-class mentors report downloaded successfully!', 'success');
}

function downloadMultiClassMentorsPdf(mentorsList, relevantStudents, classSummaries, selectedClasses) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const classesLabel = selectedClasses.length > 0 ? selectedClasses.join(', ') : 'All Classes';

  if (window.jspdf && window.jspdf.jsPDF) {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Title & Header
      doc.setFontSize(15);
      doc.setTextColor(98, 84, 231);
      doc.text("Lumina — Mentors Directory & Details Report", 14, 14);

      doc.setFontSize(9);
      doc.setTextColor(90);
      const totalSelectedMentees = mentorsList.reduce((acc, m) => acc + m.selectedMenteesCount, 0);
      doc.text(`Selected Classes: ${classesLabel} | Total Mentors: ${mentorsList.length} | Total Mentees in Selection: ${totalSelectedMentees} | Generated: ${new Date().toLocaleString()}`, 14, 21);

      const headers = [['#', 'Mentor Name', 'Email', 'Phone', 'Department', 'Designation', 'Classes Mentored', 'Selected Mentees', 'Total Mentees']];
      const body = mentorsList.map((m, idx) => [
        idx + 1,
        m.name,
        m.email,
        m.phone,
        m.department,
        m.designation,
        m.classesBreakdownStr,
        m.selectedMenteesCount,
        m.totalPlatformMentees
      ]);

      doc.autoTable({
        startY: 25,
        head: headers,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [98, 84, 231], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
        styles: { fontSize: 8, cellPadding: 2.2 },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 40 },
          2: { cellWidth: 46 },
          3: { cellWidth: 28 },
          4: { cellWidth: 32 },
          5: { cellWidth: 28 },
          6: { cellWidth: 46 },
          7: { cellWidth: 20 },
          8: { cellWidth: 20 }
        }
      });

      const classesSlug = selectedClasses.length > 0 ? selectedClasses.slice(0, 3).join('_').replace(/[^a-zA-Z0-9_-]/g, '_') : 'All_Classes';
      doc.save(`Mentors_Directory_${classesSlug}_${dateStr}.pdf`);
      showToast('PDF mentors directory downloaded successfully!', 'success');
      return;
    } catch (err) {
      console.warn("jsPDF export error, falling back to print window:", err);
    }
  }

  // Fallback: Printable HTML Report Window
  openPrintableMultiClassMentorsWindow(mentorsList, relevantStudents, classSummaries, selectedClasses);
}

function openPrintableMultiClassMentorsWindow(mentorsList, relevantStudents, classSummaries, selectedClasses) {
  const printWin = window.open('', '_blank', 'width=1100,height=850');
  if (!printWin) {
    return showToast('Pop-up blocked. Please allow pop-ups to view printable PDF report.', 'warning');
  }

  const classesLabel = selectedClasses.length > 0 ? selectedClasses.join(', ') : 'All Classes';
  const totalSelectedMentees = mentorsList.reduce((acc, m) => acc + m.selectedMenteesCount, 0);

  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Mentors Directory — ${classesLabel}</title>
      <style>
        body { font-family: 'Inter', system-ui, -apple-system, sans-serif; padding: 24px; color: #1e293b; background: #fff; line-height: 1.4; }
        h2 { color: #6254e7; margin: 0 0 4px 0; font-size: 1.4rem; }
        .meta { color: #64748b; font-size: 0.85rem; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; background: #ede9fe; color: #6b21a8; }
        table { width: 100%; border-collapse: collapse; font-size: 0.825rem; margin-bottom: 24px; }
        th { background: #6254e7; color: #fff; text-align: left; padding: 8px 10px; font-weight: 600; font-size: 0.8rem; }
        td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background: #f8fafc; }
        .mentor-card { border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px; overflow: hidden; break-inside: avoid; }
        .mentor-card-header { background: #f1f5f9; padding: 10px 14px; border-left: 5px solid #6254e7; font-weight: 700; display: flex; justify-content: space-between; align-items: center; }
        .mentee-table { margin: 0; }
        .mentee-table th { background: #475569; }
        @media print {
          body { padding: 0; }
          button { display: none; }
          .mentor-card { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div>
          <h2>Lumina — Mentors Directory &amp; Allocation Details</h2>
          <div style="font-size:0.9rem;font-weight:600;color:#334155;margin-top:2px;">Selected Classes: <span class="badge">${classesLabel}</span></div>
        </div>
        <button onclick="window.print()" style="padding:8px 18px;background:#6254e7;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.9rem;">🖨️ Print / Save as PDF</button>
      </div>
      <div class="meta">
        Generated on: ${new Date().toLocaleString()} &bull; Total Mentors: <strong>${mentorsList.length}</strong> &bull; Total Mentees in Selection: <strong>${totalSelectedMentees}</strong>
      </div>

      <h3 style="font-size:1.05rem;color:#334155;margin-bottom:10px;">📋 Mentors Summary Table</h3>
      <table>
        <thead>
          <tr>
            <th style="width:30px;">#</th>
            <th>Mentor Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Department</th>
            <th>Designation</th>
            <th>Classes Mentored</th>
            <th style="text-align:center;">Selected Mentees</th>
            <th style="text-align:center;">Total Mentees</th>
          </tr>
        </thead>
        <tbody>
          ${mentorsList.map((m, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td><strong>${m.name}</strong></td>
              <td>${m.email}</td>
              <td>${m.phone}</td>
              <td>${m.department}</td>
              <td>${m.designation}</td>
              <td>${m.classesBreakdownStr}</td>
              <td style="text-align:center;font-weight:700;color:#6254e7;">${m.selectedMenteesCount}</td>
              <td style="text-align:center;">${m.totalPlatformMentees}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h3 style="font-size:1.05rem;color:#334155;margin-top:28px;margin-bottom:12px;">👥 Detailed Mentee Breakdown by Mentor</h3>
      ${mentorsList.map(m => `
        <div class="mentor-card">
          <div class="mentor-card-header">
            <div>
              <span>👤 <strong>${m.name}</strong> (${m.department} &bull; ${m.designation})</span>
              <span style="font-size:0.8rem;color:#64748b;margin-left:10px;">📧 ${m.email} | 📞 ${m.phone}</span>
            </div>
            <span class="badge">${m.selectedMenteesCount} Mentees in ${classesLabel}</span>
          </div>
          <table class="mentee-table">
            <thead>
              <tr>
                <th style="width:30px;">#</th>
                <th>Class</th>
                <th>Student Name</th>
                <th>Enrollment No</th>
                <th>Student Email</th>
                <th>Student Contact</th>
                <th>Father's Contact</th>
              </tr>
            </thead>
            <tbody>
              ${m.mentees.map((s, sIdx) => `
                <tr>
                  <td>${sIdx + 1}</td>
                  <td><strong>${s.class ? `Class ${s.class}` : 'Unassigned'}</strong></td>
                  <td>${s.name || '—'}</td>
                  <td>${s.enrollmentNumber || '—'}</td>
                  <td>${s.email || '—'}</td>
                  <td>${s.mobileNumber || s.phone || s.studentPhone || '—'}</td>
                  <td>${s.fatherContact || s.parentContact || s.fatherPhoneM || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
    </body>
    </html>
  `);
  printWin.document.close();
}

