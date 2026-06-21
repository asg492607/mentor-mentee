# MentorOS: Comprehensive Documentation

MentorOS is a robust, serverless college mentor-mentee platform built entirely on client-side web technologies and Firebase. It provides specialized, role-based dashboards to manage the academic lifecycle of students, issue escalation, scheduling, and real-time video meetings.

## Technical Architecture

The platform has been upgraded to a **100% Serverless Architecture**. There is no backend server required.

*   **Frontend Framework**: Vanilla JavaScript (ES6 Modules), HTML5, CSS3.
*   **Routing**: Client-side hash-based Single Page Application (SPA) routing (`router.js`).
*   **Database**: Firebase Firestore (NoSQL, real-time sync).
*   **Authentication**: Firebase Authentication (Email/Password).
*   **Video Conferencing**: Native WebRTC APIs (`navigator.mediaDevices`, `RTCPeerConnection`).
*   **Signaling Server**: Serverless WebRTC signaling using Firestore real-time listeners (`onSnapshot`).
*   **Media Processing**: Web Audio API for mixing local microphone tracks with screen audio during recordings.
*   **Hosting**: Netlify / any static web host.

## User Roles & Hierarchy

The system operates on a strict multi-tier hierarchy:

1.  **Student**: Can view their profile, request meetings with their assigned mentor, join video calls, raise issues, and track tasks.
2.  **Mentor (Faculty)**: Assigned to a cohort of students. Can view mentee stats, schedule/approve meetings, host video calls, manage waiting rooms, track action items, and resolve/escalate issues.
3.  **Section Head**: Manages specific operational sections defined by the Admin (e.g., Exam Section, Travel Section). Handles escalated issues routed to their section.
4.  **HOD (Head of Department)**: Views deep analytics for their specific department, handles escalated departmental issues, and bulk imports faculty/students via CSV.
5.  **Dean**: Views global analytics across the entire institution and handles the highest-level issue escalations.
6.  **Admin**: The system operator. Manages system-wide settings, creates dynamic Sections, registers user accounts, and allocates mentors (algorithmically or manually).

## Core Features & Workflows

### 1. User Onboarding & Bulk Import
*   Admins and HODs have access to a CSV Bulk Import tool to rapidly onboard hundreds of students and faculty members.
*   The system parses the CSV, validates required fields, and registers the users securely via Firebase Auth while storing metadata in Firestore.

### 2. Algorithmic Mentor Allocation
*   Admins can use the "Auto-Allocate" feature.
*   The algorithm balances the load across all available Faculty members within a department (up to their `maxStudents` capacity, typically 20).
*   Students are assigned sequentially based on their Enrollment Number to ensure fair distribution.

### 3. The Issue Escalation Matrix
The platform features a multi-tiered ticketing system for student issues:
*   A Student raises an issue (e.g., Academic, Financial, Personal).
*   The Mentor attempts to resolve it. If unable, they escalate it to the appropriate **Section Head** (e.g., Exam Section).
*   If the Section Head cannot resolve it, they escalate it up the chain to the **HOD**.
*   The HOD can resolve it or escalate it globally to the **Dean**.
*   A complete audit trail (`escalationHistory`) is permanently attached to the issue.

### 4. Serverless WebRTC Video Meetings
The platform includes a built-in, Google Meet-style video conferencing tool that runs entirely peer-to-peer without a media server.
*   **Signaling:** When users join a room, they exchange WebRTC SDP Offers/Answers and ICE Candidates by writing documents to a temporary Firestore collection.
*   **Host Controls & Waiting Room:** 
    *   Mentors join immediately as Hosts.
    *   Students join as Guests and are placed in a **Waiting Room**.
    *   Mentors receive a ringing audio notification and a UI popup when someone waits.
    *   Mentors can Admit/Deny specific students, or Admit/Deny all.
    *   Mentors can kick disruptive participants, immediately terminating their peer connection.
*   **Permanent End:** Mentors can "End Meeting for All," changing the database status to `COMPLETED` and instantly kicking all active participants while preventing future joins.
*   **Advanced Screen Recording:** If a mentor clicks "Record", the browser captures the screen and tab audio, while the Web Audio API digitally mixes in the mentor's local microphone stream, ensuring a perfect two-way audio recording.

## Directory Structure

*   `/frontend/index.html`: The main entry point.
*   `/frontend/css/`: Modular stylesheets (`main.css`, `dashboard.css`, `meeting.css`).
*   `/frontend/js/router.js`: Core SPA navigation logic.
*   `/frontend/js/services.js`: The central Firebase Firestore data layer (contains all CRUD operations).
*   `/frontend/js/auth.js`: Firebase Authentication logic and session management.
*   `/frontend/js/pages/`: Controller logic for every specific dashboard view (Admin, Dean, HOD, Mentor, Section, Student).
*   `/frontend/js/webrtc/`: WebRTC peer connection, media capture, and Firestore signaling logic.

## Local Setup & Deployment

Since the backend Python server has been fully deprecated in favor of Firebase, setup is incredibly simple:

1.  **Firebase Setup**: 
    *   Create a Firebase project.
    *   Enable **Authentication** (Email/Password).
    *   Enable **Firestore Database**.
2.  **Configuration**: Update `frontend/js/config.js` with your Firebase API keys and credentials.
3.  **Local Development**: Run a simple local HTTP server in the frontend directory.
    ```powershell
    cd frontend
    python -m http.server 4173
    ```
4.  **Deployment**: Drag and drop the `frontend/` folder into Netlify, Vercel, or GitHub Pages. The SPA routing requires a redirect rule (included in `_redirects` and `netlify.toml` for Netlify) to map all routes to `index.html`.

## Scaling Risks & Architectural Considerations

While the MVP is robust for early adoption, there are important architectural trade-offs to keep in mind as the platform scales:

### 1. WebRTC Signaling over Firestore
Relying on Firestore for WebRTC signaling (SDP/ICE candidate exchange) is functional but inherently fragile at scale.
*   **Costs:** High chatty read/write operations during connection establishment can drive up Firestore billing.
*   **State Management:** Stale ICE candidates, orphan room documents, and race conditions during multi-participant joins require careful handling and regular garbage collection.
*   **Future Mitigation:** Transitioning to a dedicated WebSocket server (e.g., Socket.io or WebRTC specific SFU/TURN solutions like Mediasoup or LiveKit) will be necessary for large, stable, multi-party meetings.

### 2. "Serverless" State Integrity
"No backend" operationally simplifies deployment, but it pushes massive responsibilities onto the client-side logic and Firestore Security Rules.
*   The "backend" still exists; it is just decentralized across client-side services, Firebase Auth logic, and Firestore listeners.
*   **Security & Integrity:** Protecting the system requires incredibly rigorous, battle-tested `firestore.rules` to prevent malicious writes, privilege escalation, and corrupted state changes.

### 3. Complex Role-Based Access Control (RBAC)
With 6 different organizational roles (Student, Mentor, Section Head, HOD, Dean, Admin), the risk of visibility leaks and logic bugs increases exponentially.
*   **Workflow Fragility:** Ensuring that approval logic routes correctly, CSV imports don't create malformed data, and users only see their designated data silos is the highest-risk area for bugs.
*   **Future Mitigation:** Implement comprehensive End-to-End (E2E) testing specifically focused on role-based dashboard visibility and escalation routing to ensure data never moves to the wrong tier.
