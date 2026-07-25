import { FacultyService, StudentService } from '/js/services.js';
import { showToast } from '/js/components/toast.js';

export async function exportMentorStudentReport(format = 'excel') {
  showToast(`Preparing ${format.toUpperCase()} master allocation report...`, 'info');
  try {
    const [allMentors, allStudents] = await Promise.all([
      FacultyService.getAll(),
      StudentService.getAll()
    ]);

    const mentors = allMentors.filter(f => f.role === 'FACULTY' || f.role === 'MENTOR' || f.role === 'HOD' || (f.assignedStudentCount && f.assignedStudentCount > 0));

    if (mentors.length === 0 && allStudents.length === 0) {
      return showToast('No mentors or students found to generate report', 'warning');
    }

    // Build flat row list
    const reportRows = [];
    let srNo = 1;

    mentors.forEach(m => {
      const assignedStudents = allStudents.filter(s => s.mentorId === m.id);
      if (assignedStudents.length === 0) {
        reportRows.push({
          'Sr No': srNo++,
          'Mentor Name': m.name,
          'Mentor Department': m.department || '—',
          'Mentor Designation': m.designation || 'Faculty',
          'Student Name': 'No assigned students',
          'Enrollment No': '—',
          'Class': '—',
          'Student Dept': '—',
          'CGPA': '—',
          'Attendance (%)': '—',
          'Risk Level': '—'
        });
      } else {
        assignedStudents.forEach(s => {
          reportRows.push({
            'Sr No': srNo++,
            'Mentor Name': m.name,
            'Mentor Department': m.department || '—',
            'Mentor Designation': m.designation || 'Faculty',
            'Student Name': s.name,
            'Enrollment No': s.enrollmentNumber || '—',
            'Class': s.class ? `Class ${s.class}` : 'Unassigned',
            'Student Dept': s.department || '—',
            'CGPA': s.cgpa || '0',
            'Attendance (%)': (s.attendance || 0) + '%',
            'Risk Level': s.riskLevel || 'LOW'
          });
        });
      }
    });

    if (format === 'excel') {
      downloadExcelReport(reportRows, mentors, allStudents);
    } else if (format === 'pdf') {
      downloadPdfReport(reportRows, mentors, allStudents);
    }
  } catch (err) {
    console.error("Export error:", err);
    showToast(`Failed to export report: ${err.message}`, 'error');
  }
}

function downloadExcelReport(reportRows, mentors, allStudents) {
  if (typeof XLSX === 'undefined') {
    return showToast('Excel export library (SheetJS) is not loaded', 'error');
  }

  const wb = XLSX.utils.book_new();

  // Sheet 1: Master Allocation List
  const ws1 = XLSX.utils.json_to_sheet(reportRows);

  // Set column widths for readability
  ws1['!cols'] = [
    { wch: 8 },  // Sr No
    { wch: 25 }, // Mentor Name
    { wch: 20 }, // Mentor Dept
    { wch: 20 }, // Mentor Designation
    { wch: 25 }, // Student Name
    { wch: 18 }, // Enrollment No
    { wch: 15 }, // Class
    { wch: 20 }, // Student Dept
    { wch: 10 }, // CGPA
    { wch: 15 }, // Attendance
    { wch: 12 }  // Risk Level
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Mentor-Student Allocations');

  // Sheet 2: Mentor Summary
  const mentorSummary = mentors.map((m, idx) => {
    const count = allStudents.filter(s => s.mentorId === m.id).length;
    return {
      'Sr No': idx + 1,
      'Mentor Name': m.name,
      'Department': m.department || '—',
      'Designation': m.designation || 'Faculty',
      'Total Assigned Students': count
    };
  });
  const ws2 = XLSX.utils.json_to_sheet(mentorSummary);
  ws2['!cols'] = [
    { wch: 8 },
    { wch: 25 },
    { wch: 20 },
    { wch: 22 },
    { wch: 25 }
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'Mentor Summary');

  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `Master_Mentor_Student_Allocations_${dateStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
  showToast('Excel master report downloaded successfully!', 'success');
}

function downloadPdfReport(reportRows, mentors, allStudents) {
  if (window.jspdf && window.jspdf.jsPDF) {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Title & Header
      doc.setFontSize(16);
      doc.setTextColor(98, 84, 231); // App Accent color
      doc.text("Lumina — Master Mentor & Associated Students Allocation Report", 14, 15);

      doc.setFontSize(9);
      doc.setTextColor(100);
      const assignedCount = allStudents.filter(s => s.mentorId).length;
      doc.text(`Generated on: ${new Date().toLocaleString()} | Total Mentors: ${mentors.length} | Assigned Students: ${assignedCount} / ${allStudents.length}`, 14, 22);

      const headers = [['#', 'Mentor Name', 'Mentor Dept', 'Student Name', 'Enrollment No', 'Class', 'Student Dept', 'Risk Level']];
      const body = reportRows.map(r => [
        r['Sr No'],
        r['Mentor Name'],
        r['Mentor Department'],
        r['Student Name'],
        r['Enrollment No'],
        r['Class'],
        r['Student Dept'],
        r['Risk Level']
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
          1: { cellWidth: 45 },
          2: { cellWidth: 35 },
          3: { cellWidth: 45 },
          4: { cellWidth: 35 },
          5: { cellWidth: 25 },
          6: { cellWidth: 35 },
          7: { cellWidth: 25 }
        }
      });

      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `Master_Mentor_Student_Allocations_${dateStr}.pdf`;
      doc.save(fileName);
      showToast('PDF master report downloaded successfully!', 'success');
      return;
    } catch (err) {
      console.warn("jsPDF error, falling back to print window:", err);
    }
  }

  // Fallback: Printable HTML Report Window
  openPrintableReportWindow(reportRows, mentors, allStudents);
}

function openPrintableReportWindow(reportRows, mentors, allStudents) {
  const printWin = window.open('', '_blank', 'width=1000,height=750');
  if (!printWin) {
    return showToast('Pop-up blocked. Please allow pop-ups to view printable PDF report.', 'warning');
  }

  const assignedCount = allStudents.filter(s => s.mentorId).length;

  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Master Mentor & Associated Students Allocation Report</title>
      <style>
        body { font-family: 'Inter', system-ui, sans-serif; padding: 24px; color: #1e293b; background: #fff; }
        h2 { color: #6254e7; margin-bottom: 4px; }
        .meta { color: #64748b; font-size: 0.85rem; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 0.825rem; }
        th { background: #6254e7; color: #fff; text-align: left; padding: 8px; font-weight: 600; }
        td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background: #f8fafc; }
        .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
        .badge-low { background: #dcfce7; color: #166534; }
        .badge-high { background: #fee2e2; color: #991b1b; }
        @media print {
          body { padding: 0; }
          button { display: none; }
        }
      </style>
    </head>
    <body>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h2>Master Mentor & Associated Students Allocation Report</h2>
        <button onclick="window.print()" style="padding:8px 16px;background:#6254e7;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">🖨️ Print / Save as PDF</button>
      </div>
      <div class="meta">
        Generated: ${new Date().toLocaleString()} | Total Mentors: ${mentors.length} | Total Assigned Students: ${assignedCount} / ${allStudents.length}
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Mentor Name</th>
            <th>Mentor Dept</th>
            <th>Student Name</th>
            <th>Enrollment No</th>
            <th>Class</th>
            <th>Student Dept</th>
            <th>Risk</th>
          </tr>
        </thead>
        <tbody>
          ${reportRows.map(r => `
            <tr>
              <td>${r['Sr No']}</td>
              <td><strong>${r['Mentor Name']}</strong></td>
              <td>${r['Mentor Department']}</td>
              <td>${r['Student Name']}</td>
              <td>${r['Enrollment No']}</td>
              <td>${r['Class']}</td>
              <td>${r['Student Dept']}</td>
              <td><span class="badge ${r['Risk Level'] === 'HIGH' ? 'badge-high' : 'badge-low'}">${r['Risk Level']}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `);
  printWin.document.close();
}
