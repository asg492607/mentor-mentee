import os
import sys
import shutil
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

# Ensure pdf output directories exist
pdf_dir = os.path.join(os.path.dirname(__file__), 'pdf')
frontend_pdf_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend', 'docs', 'pdf')
os.makedirs(pdf_dir, exist_ok=True)
os.makedirs(frontend_pdf_dir, exist_ok=True)

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to calculate total page count and add headers/footers dynamically.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        
        # Header (Only on page 2 and later)
        if self._pageNumber > 1:
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(colors.HexColor('#6254e7'))
            self.drawString(36, 810, "LUMINA — STUDENT MENTORSHIP PLATFORM")
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor('#64748b'))
            self.drawRightString(576, 810, "Official Role Operating Guide")
            
            self.setStrokeColor(colors.HexColor('#e2e8f0'))
            self.setLineWidth(0.75)
            self.line(36, 802, 576, 802)

        # Footer (On all pages)
        self.setStrokeColor(colors.HexColor('#e2e8f0'))
        self.setLineWidth(0.75)
        self.line(36, 45, 576, 45)

        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor('#64748b'))
        self.drawString(36, 32, "Confidential — Educational Institution Operations | Lumina v2.0")
        
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(576, 32, page_text)
        self.restoreState()


def get_custom_styles():
    styles = getSampleStyleSheet()
    
    # Custom Palette
    PRIMARY = colors.HexColor('#6254e7')
    DARK = colors.HexColor('#0f172a')
    MUTED = colors.HexColor('#475569')
    
    styles.add(ParagraphStyle(
        name='DocTitle',
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=PRIMARY,
        spaceAfter=6
    ))

    styles.add(ParagraphStyle(
        name='DocSubtitle',
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=MUTED,
        spaceAfter=15
    ))

    styles.add(ParagraphStyle(
        name='SectionHeader',
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=PRIMARY,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    ))

    styles.add(ParagraphStyle(
        name='SubSectionHeader',
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=DARK,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    ))

    styles.add(ParagraphStyle(
        name='BodyCustom',
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=DARK,
        spaceAfter=6
    ))

    styles.add(ParagraphStyle(
        name='BulletCustom',
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=DARK,
        leftIndent=14,
        firstLineIndent=-10,
        spaceAfter=4
    ))

    styles.add(ParagraphStyle(
        name='CalloutText',
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor('#1e1b4b'),
        spaceAfter=0
    ))

    styles.add(ParagraphStyle(
        name='TableHeader',
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.white,
        alignment=0
    ))

    styles.add(ParagraphStyle(
        name='TableCell',
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=DARK
    ))

    return styles

def build_pdf_document(output_path, title, subtitle, credentials_data, workflow_steps, detailed_sections):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=50,
        bottomMargin=60
    )

    styles = get_custom_styles()
    story = []

    # 1. Header Banner
    story.append(Paragraph(title, styles['DocTitle']))
    story.append(Paragraph(subtitle, styles['DocSubtitle']))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#6254e7'), spaceBefore=0, spaceAfter=15))

    # 2. Credential Box Banner
    cred_table_data = [
        [Paragraph("<b>🔑 MANDATORY LOGIN CREDENTIALS INSTRUCTION</b>", styles['CalloutText'])],
        [Paragraph(f"• <b>Username / Login ID:</b> Registered Email Address (e.g., <i>{credentials_data['email_ex']}</i>)<br/>"
                   f"• <b>Password:</b> Registered Mobile Number (e.g., <i>{credentials_data['mobile_ex']}</i>)<br/>"
                   f"<i>Note: Go to <b>#/login</b>, enter your email as username and mobile number as password.</i>", styles['BodyCustom'])]
    ]
    cred_table = Table(cred_table_data, colWidths=[540])
    cred_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f0fdf4')),
        ('BOX', (0,0), (-1,-1), 1.5, colors.HexColor('#16a34a')),
        ('PADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,0), 4),
    ]))
    story.append(cred_table)
    story.append(Spacer(1, 15))

    # 3. Overall Working Flow
    story.append(Paragraph("🔄 Complete Role Working Flow", styles['SectionHeader']))
    flow_table_data = [[
        Paragraph("<b>Step</b>", styles['TableHeader']),
        Paragraph("<b>Phase & Module</b>", styles['TableHeader']),
        Paragraph("<b>Action Required</b>", styles['TableHeader'])
    ]]
    for idx, (phase, desc) in enumerate(workflow_steps, 1):
        flow_table_data.append([
            Paragraph(f"<b>Step {idx}</b>", styles['TableCell']),
            Paragraph(f"<b>{phase}</b>", styles['TableCell']),
            Paragraph(desc, styles['TableCell'])
        ])

    flow_table = Table(flow_table_data, colWidths=[60, 160, 320])
    flow_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#6254e7')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')]),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(flow_table)
    story.append(Spacer(1, 15))

    # 4. Detailed Feature Sections
    for sec_title, sec_paragraphs in detailed_sections:
        story.append(Paragraph(sec_title, styles['SectionHeader']))
        for p_type, p_text in sec_paragraphs:
            if p_type == 'h2':
                story.append(Paragraph(p_text, styles['SubSectionHeader']))
            elif p_type == 'bullet':
                story.append(Paragraph(f"• {p_text}", styles['BulletCustom']))
            elif p_type == 'callout':
                box_data = [[Paragraph(p_text, styles['BodyCustom'])]]
                box_table = Table(box_data, colWidths=[540])
                box_table.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#faf5ff')),
                    ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#9333ea')),
                    ('PADDING', (0,0), (-1,-1), 8),
                ]))
                story.append(Spacer(1, 4))
                story.append(box_table)
                story.append(Spacer(1, 4))
            else:
                story.append(Paragraph(p_text, styles['BodyCustom']))
        story.append(Spacer(1, 10))

    # Build Document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"[OK] Generated PDF: {output_path}")


# ==============================================================================
# DATA FOR 4 ROLES
# ==============================================================================

# 1. ADMIN GUIDE
admin_data = {
    'output': os.path.join(pdf_dir, 'Lumina_Admin_Guide.pdf'),
    'title': 'Lumina — Administrator Operating Manual',
    'subtitle': 'Complete Technical Guide for System Setup, Infrastructure Telemetry, Classwise Allocation & User Administration',
    'credentials': {
        'email_ex': 'admin@lumina.edu',
        'mobile_ex': '9876543210'
    },
    'workflow': [
        ('1. Login & Auth', 'Access #/login. Username = Admin Email, Password = Mobile Number.'),
        ('2. Infrastructure Telemetry', 'Monitor DB reads/writes, Firebase Spark quota ($0 free tier) & WebRTC nodes.'),
        ('3. System Sections', 'Configure operational Sections (Exam, Student Section) for issue escalation.'),
        ('4. Departments', 'Add academic departments, department codes & faculty ratios.'),
        ('5. User Registration', 'Single user creation or CSV bulk import (Role, Name, Email, Mobile No as Password).'),
        ('6. Classwise Allocation', 'Select Mentor -> Select Class -> Tick Students (max 50) -> Click Allocate.'),
        ('7. Auto & Reset', 'Run algorithmic load distribution or Reset/Unallot All for annual year transition.'),
        ('8. Report Generation', 'Export master classwise reports or single-mentor lists in Excel/PDF.')
    ],
    'sections': [
        ('⚙️ Section 1: System Telemetry & Settings', [
            ('h2', 'Infrastructure Telemetry (#/admin/infrastructure)'),
            ('bullet', 'Monitor live database performance, read/write counters, and active browser sessions.'),
            ('bullet', 'Track WebRTC STUN/TURN signaling nodes to ensure smooth video call connections institution-wide.'),
            ('h2', 'Escalation Section Configuration (#/admin/settings)'),
            ('bullet', 'Setup administrative sections such as Exam Section, Student Section, Financial Cell, and Hostel Office.'),
            ('bullet', 'These sections receive escalated issues from mentors when student matters require administrative intervention.')
        ]),
        ('📌 Section 2: Classwise Mentor-Mentee Allocation', [
            ('h2', 'Classwise Manual Allocation (#/admin/allocation)'),
            ('bullet', '<b>Step 1:</b> Select Faculty Mentor Name from dropdown.'),
            ('bullet', '<b>Step 2:</b> Select Class (e.g. TY CORE 1, TY CORE 2).'),
            ('bullet', '<b>Step 3:</b> Live search and tick up to 50 students per batch.'),
            ('bullet', '<b>Step 4:</b> Click <i>Allocate Ticked Students</i> to commit pairings.'),
            ('h2', 'Global Auto-Allocate & Academic Year Reset'),
            ('bullet', '<b>Auto-Allocate:</b> Evenly distributes unassigned students across department faculty up to capacity limit (20).'),
            ('bullet', '<b>Reset / Unallot All:</b> Clears all mentor-mentee pairings before a new academic year starts.')
        ]),
        ('📊 Section 3: Master & Single Mentor Export Center', [
            ('p', 'Generate complete classwise allocation reports ordered by Class -> Mentor -> Student:'),
            ('bullet', '<b>Export Master Excel / PDF:</b> Downloads full institution allocation roster.'),
            ('bullet', '<b>One-Click Single Mentor Export:</b> Select any faculty mentor to instantly download their mentee list.')
        ])
    ]
}

# 2. HOD GUIDE
hod_data = {
    'output': os.path.join(pdf_dir, 'Lumina_HOD_Guide.pdf'),
    'title': 'Lumina — Head of Department (HOD) Manual',
    'subtitle': 'Comprehensive Guide for Mentor Workload Capacity Management, Audit Trails, Reassignments & Escalations',
    'credentials': {
        'email_ex': 'hod.cs@lumina.edu',
        'mobile_ex': '9876543210'
    },
    'workflow': [
        ('1. Login & Auth', 'Access #/login. Username = HOD Department Email, Password = Mobile Number.'),
        ('2. Department Dashboard', 'Overview of department faculty, assigned mentees, and open escalations.'),
        ('3. Workload Summary', 'Review real-time table of mentor assigned count, max capacity, and load bars.'),
        ('4. Reallocate Mentees', 'Change mentor assignment on #/hod/management and provide mandatory Reason.'),
        ('5. Audit Trail Review', 'Track who allocated/reassigned students, timestamp, mode (Auto/Manual) & notes.'),
        ('6. Multi-Filter Directory', 'Filter mentees by Mentor, Class, Department, Risk Level, or PRN live search.'),
        ('7. Report Downloads', 'Export master department reports or one-click single mentor mentee lists in Excel/PDF.'),
        ('8. Escalations Review', 'Resolve issues escalated by Section Heads or escalate to Dean with history.')
    ],
    'sections': [
        ('📊 Section 1: Mentor Workload & Capacity Tracking', [
            ('h2', 'Real-Time Capacity Table (#/hod/reports)'),
            ('bullet', 'Track total assigned mentees vs maximum capacity (20) for every faculty mentor.'),
            ('bullet', 'Visual load bars highlight mentors nearing full capacity (Green <80%, Yellow 80-99%, Red 100%).')
        ]),
        ('🔄 Section 2: Reassignments & Audit Logging', [
            ('h2', 'Reassigning Students (#/hod/management)'),
            ('bullet', 'Select student and choose new mentor from dropdown.'),
            ('callout', '<b>Mandatory Audit Prompt:</b> The system requires HOD to enter a <b>Reason for Reassignment</b> (e.g., <i>Workload Balancing</i>). This ensures complete institutional accountability.'),
            ('h2', 'Allocation & Reassignment Audit Trail (#/hod/reports)'),
            ('bullet', 'Inspect audit history showing Student Name, Class, Previous Mentor -> New Mentor, Reassigned By (HOD), Timestamp, and Reason.')
        ]),
        ('⚡ Section 3: One-Click Mentor & Master Reports', [
            ('bullet', '<b>One-Click Single Mentor Export:</b> Select any department mentor from dropdown to download their mentee list in Excel or PDF.'),
            ('bullet', '<b>Export Master Department Report:</b> Download full department report ordered classwise.')
        ])
    ]
}

# 3. MENTOR GUIDE
mentor_data = {
    'output': os.path.join(pdf_dir, 'Lumina_Mentor_Guide.pdf'),
    'title': 'Lumina — Faculty Mentor Guide',
    'subtitle': 'Operating Guide for Student Mentorship, WebRTC Video Meetings, Session Notes & Issue Escalations',
    'credentials': {
        'email_ex': 'prof.smith@lumina.edu',
        'mobile_ex': '9876543210'
    },
    'workflow': [
        ('1. Login & Auth', 'Access #/login. Username = Faculty Email, Password = Mobile Number.'),
        ('2. Mentor Dashboard', 'Overview of mentee count, upcoming meetings, tasks & open student issues.'),
        ('3. Mentee Roster', 'View assigned students sorted by class with enrollment & academic profiles.'),
        ('4. Manage Meetings', 'Approve, reschedule, or create 1-on-1 meeting requests from students.'),
        ('5. Host Video Calls', 'Join call, manage Waiting Room (Admit/Deny), toggle audio/video, share screen & record.'),
        ('6. Session Notes', 'Document guidance notes, student goals, and assign actionable tasks.'),
        ('7. Issue Escalations', 'Resolve student issues directly or escalate to Section Head with notes.')
    ],
    'sections': [
        ('📅 Section 1: Meeting Management & Video Calling', [
            ('h2', 'Reviewing Requests (#/mentor/meetings)'),
            ('bullet', 'Approve or reschedule meeting requests submitted by mentees.'),
            ('h2', 'WebRTC Video Conference Room (#/meeting-room)'),
            ('bullet', '<b>Waiting Room Control:</b> Admit or deny students in the secure waiting lounge before entry.'),
            ('bullet', '<b>Screen Share & Recording:</b> Share presentation/code and record session for academic logs.')
        ]),
        ('📝 Section 2: Academic Booklet & Issue Resolution', [
            ('h2', 'Session Notes & Tasks (#/mentor/notes)'),
            ('bullet', 'Document mentorship discussions and assign tasks with due dates.'),
            ('h2', 'Issue Escalation Matrix (#/mentor/issues)'),
            ('bullet', 'Resolve student concerns directly or escalate administrative/financial issues to Section Heads.')
        ])
    ]
}

# 4. STUDENT GUIDE
student_data = {
    'output': os.path.join(pdf_dir, 'Lumina_Student_Mentee_Guide.pdf'),
    'title': 'Lumina — Student Mentee Guide',
    'subtitle': 'User Guide for Requesting Mentorship Meetings, Joining Video Calls & Tracking Issues',
    'credentials': {
        'email_ex': 'john.doe@student.lumina.edu',
        'mobile_ex': '9876543210'
    },
    'workflow': [
        ('1. Login & Auth', 'Access #/login. Username = Student Email, Password = Mobile Number.'),
        ('2. Student Dashboard', 'View assigned mentor contact card, upcoming meetings & active tasks.'),
        ('3. Request Meeting', 'Select preferred date, time slot, and topic (Academic, Career, Project).'),
        ('4. Video Call Entry', 'Click Join Meeting at scheduled time and enter Waiting Room until admitted.'),
        ('5. Raise Issues', 'Submit academic/administrative issues and track live status through escalation tiers.'),
        ('6. Complete Tasks', 'View tasks assigned by mentor, mark completed & review session booklet history.')
    ],
    'sections': [
        ('📌 Section 1: Connecting with Your Mentor', [
            ('h2', 'Requesting 1-on-1 Sessions (#/student/meetings)'),
            ('bullet', 'Choose date, time, and topic to send a formal meeting request to your assigned mentor.'),
            ('h2', 'Video Meetings (#/meeting-room)'),
            ('bullet', 'Join video call, interact via audio/video/chat, and present your screen to your mentor.')
        ]),
        ('🚩 Section 2: Raising Issues & Completing Tasks', [
            ('h2', 'Issue Tracking (#/student/issues)'),
            ('bullet', 'Raise issues (Academic, Exam, Fees, Hostel) and watch real-time resolution progress.'),
            ('h2', 'Mentorship Tasks (#/student/tasks)'),
            ('bullet', 'Complete actionable tasks assigned during guidance sessions to maintain steady progress.')
        ])
    ]
}


if __name__ == '__main__':
    print("Generating Lumina Role Guide PDFs...")
    for data in [admin_data, hod_data, mentor_data, student_data]:
        build_pdf_document(
            output_path=data['output'],
            title=data['title'],
            subtitle=data['subtitle'],
            credentials_data=data['credentials'],
            workflow_steps=data['workflow'],
            detailed_sections=data['sections']
        )
        # Also copy to frontend/docs/pdf/
        filename = os.path.basename(data['output'])
        dest_path = os.path.join(frontend_pdf_dir, filename)
        shutil.copyfile(data['output'], dest_path)
        print(f"[OK] Synced PDF to frontend: {dest_path}")
    print("All PDFs successfully generated and synced to frontend!")
