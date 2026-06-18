const $ = selector => document.querySelector(selector);

const demoData = {
  metrics: [
    { label: "Active mentees", value: "48", detail: "Across 4 mentor groups" },
    { label: "Meetings this week", value: "12", detail: "9 completed, 3 upcoming" },
    { label: "Open issues", value: "7", detail: "2 need HOD review" },
    { label: "Attendance", value: "86%", detail: "4% above last month" }
  ],
  groups: [
    { name: "CSE Group A", mentor: "Dr. Meera Shah", students: 16, nextMeet: "Friday, 3:00 PM", room: "mentor-cse-a" },
    { name: "CSE Group B", mentor: "Prof. Arjun Rao", students: 15, nextMeet: "Monday, 11:30 AM", room: "mentor-cse-b" },
    { name: "IT Group A", mentor: "Dr. Neha Kulkarni", students: 17, nextMeet: "Tuesday, 2:00 PM", room: "mentor-it-a" }
  ],
  students: [
    { id: "STU-1024", name: "Aarav Patil", group: "CSE A", attendance: "92%", status: "On track", issue: "None" },
    { id: "STU-1031", name: "Isha Singh", group: "CSE A", attendance: "76%", status: "Watch", issue: "Attendance follow-up" },
    { id: "STU-1088", name: "Kabir Joshi", group: "CSE B", attendance: "68%", status: "Escalated", issue: "Academic support" },
    { id: "STU-1112", name: "Riya Deshmukh", group: "IT A", attendance: "84%", status: "Follow-up", issue: "Career guidance" }
  ],
  faculty: [
    { name: "Dr. Meera Shah", role: "Senior Mentor", section: "Computer Science", load: "16 assigned students" },
    { name: "Prof. Arjun Rao", role: "Faculty Mentor", section: "Computer Science", load: "15 assigned students" },
    { name: "Dr. Neha Kulkarni", role: "HOD", section: "Information Technology", load: "17 assigned students" }
  ],
  issues: [
    { title: "Low attendance — Kabir Joshi", owner: "Prof. Arjun Rao", level: "HOD", due: "20 Jun" },
    { title: "Exam form correction — Isha Singh", owner: "Exam Section", level: "Faculty", due: "19 Jun" },
    { title: "Travel approval — Riya Deshmukh", owner: "Student Section", level: "Mentor", due: "22 Jun" }
  ],
  reports: [
    "Weekly mentor interaction summary",
    "At-risk student follow-up report",
    "Department attendance trend",
    "Issue resolution and escalation audit"
  ]
};

const ui = {
  pageTitle: $("#pageTitle"),
  metricGrid: $("#metricGrid"),
  groupList: $("#groupList"),
  issuePreview: $("#issuePreview"),
  studentsTable: $("#studentsTable"),
  facultyList: $("#facultyList"),
  issueBoard: $("#issueBoard"),
  reportsList: $("#reportsList"),
  reportsRecordingsList: $("#reportsRecordingsList"),
  displayName: $("#displayName"),
  role: $("#role"),
  roomId: $("#roomId"),
  inviteLink: $("#inviteLink"),
  joinRoom: $("#joinRoom"),
  leaveRoom: $("#leaveRoom"),
  copyLink: $("#copyLink"),
  toggleMic: $("#toggleMic"),
  toggleCamera: $("#toggleCamera"),
  shareScreen: $("#shareScreen"),
  recordMeeting: $("#recordMeeting"),
  videoGrid: $("#videoGrid"),
  participants: $("#participants"),
  chatLog: $("#chatLog"),
  chatForm: $("#chatForm"),
  chatInput: $("#chatInput"),
  recordingsList: $("#recordingsList")
};

const themeToggle = $("#themeToggle");
updateThemeLabel();
themeToggle.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("campus-theme", next);
  updateThemeLabel();
});

const peers = new Map();
let socket;
let localStream;
let localScreenTrack;
let myId;
let roomId;
let displayName;
let mediaRecorder;
let recordedChunks = [];
const sessionRecordings = [];
let recordingStartedAt;
let micEnabled = true;
let cameraEnabled = true;

const params = new URLSearchParams(location.search);
ui.roomId.value = params.get("room") || `mentor-${Math.random().toString(36).slice(2, 7)}`;
ui.displayName.value = localStorage.getItem("campus-meet-name") || "";
ui.role.value = localStorage.getItem("campus-meet-role") || "Mentor";
updateInviteLink();
loadBootstrap();
loadRecordings();
if (params.get("room")) showSection("meet");

document.querySelectorAll("[data-target]").forEach(button => {
  button.addEventListener("click", () => {
    showSection(button.dataset.target);
  });
});
ui.joinRoom.addEventListener("click", joinRoom);
ui.leaveRoom.addEventListener("click", leaveRoom);
ui.toggleMic.addEventListener("click", toggleMic);
ui.toggleCamera.addEventListener("click", toggleCamera);
ui.shareScreen.addEventListener("click", shareScreen);
ui.recordMeeting.addEventListener("click", toggleRecording);
ui.copyLink.addEventListener("click", copyInvite);
ui.chatForm.addEventListener("submit", sendChat);
ui.roomId.addEventListener("input", updateInviteLink);

function showSection(sectionId) {
  document.querySelectorAll(".page-section").forEach(section => {
    section.classList.toggle("active", section.id === sectionId);
  });

  document.querySelectorAll(".module-list button").forEach(button => {
    button.classList.toggle("active", button.dataset.target === sectionId);
  });

  const titles = {
    dashboard: "Mentor dashboard",
    meet: "Own meeting room",
    students: "Student section",
    faculty: "Faculty and academic staff",
    issues: "Issue escalation",
    reports: "Reports and recordings"
  };
  ui.pageTitle.textContent = titles[sectionId] || "Mentor dashboard";
}

async function loadBootstrap() {
  try {
    const response = await fetch("/api/bootstrap");
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    const data = await response.json();
    renderMetrics(data.metrics || []);
    renderGroups(data.groups || []);
    renderStudents(data.students || []);
    renderFaculty(data.faculty || []);
    renderIssues(data.issues || []);
    renderReports(data.reports || []);
  } catch (error) {
    console.info("Using built-in dashboard data because the API is unavailable.", error.message);
    renderMetrics(demoData.metrics);
    renderGroups(demoData.groups);
    renderStudents(demoData.students);
    renderFaculty(demoData.faculty);
    renderIssues(demoData.issues);
    renderReports(demoData.reports);
  }
}

function renderMetrics(metrics) {
  ui.metricGrid.innerHTML = "";
  metrics.forEach(metric => {
    const card = document.createElement("article");
    card.innerHTML = `<span></span><strong></strong><small></small>`;
    card.querySelector("span").textContent = metric.label;
    card.querySelector("strong").textContent = metric.value;
    card.querySelector("small").textContent = metric.detail;
    ui.metricGrid.append(card);
  });
}

function renderGroups(groups) {
  ui.groupList.innerHTML = "";
  groups.forEach(group => {
    const card = document.createElement("article");
    card.className = "group-card";
    card.innerHTML = `<div><strong></strong><span></span></div><button type="button">Join</button>`;
    card.querySelector("strong").textContent = `${group.name} - ${group.mentor}`;
    card.querySelector("span").textContent = `${group.students} students, next meet ${group.nextMeet}`;
    card.querySelector("button").addEventListener("click", () => {
      ui.roomId.value = group.room;
      updateInviteLink();
      showSection("meet");
    });
    ui.groupList.append(card);
  });
}

function renderStudents(students) {
  ui.studentsTable.innerHTML = "";
  students.forEach(student => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td><span class="status"></span></td>
      <td></td>
    `;
    const cells = row.querySelectorAll("td");
    cells[0].textContent = student.id;
    cells[1].textContent = student.name;
    cells[2].textContent = student.group;
    cells[3].textContent = student.attendance;
    const status = row.querySelector(".status");
    status.textContent = student.status;
    status.classList.add(student.status.toLowerCase().replace(/\s+/g, "-"));
    cells[5].textContent = student.issue;
    ui.studentsTable.append(row);
  });
}

function renderFaculty(faculty) {
  ui.facultyList.innerHTML = "";
  faculty.forEach(member => {
    const card = document.createElement("article");
    card.className = "staff-card";
    card.innerHTML = `<strong></strong><span></span><span></span>`;
    card.querySelector("strong").textContent = member.name;
    card.querySelectorAll("span")[0].textContent = `${member.role} - ${member.section}`;
    card.querySelectorAll("span")[1].textContent = member.load;
    ui.facultyList.append(card);
  });
}

function renderIssues(issues) {
  ui.issuePreview.innerHTML = "";
  ui.issueBoard.innerHTML = "";
  issues.slice(0, 3).forEach(issue => {
    const item = document.createElement("li");
    item.textContent = `${issue.title} -> ${issue.level}`;
    ui.issuePreview.append(item);
  });

  issues.forEach(issue => {
    const card = document.createElement("article");
    card.className = "issue-card";
    card.innerHTML = `<strong></strong><span></span><span></span>`;
    card.querySelector("strong").textContent = issue.title;
    card.querySelectorAll("span")[0].textContent = `Owner: ${issue.owner}`;
    card.querySelectorAll("span")[1].textContent = `Escalation: ${issue.level}, due ${issue.due}`;
    ui.issueBoard.append(card);
  });
}

function renderReports(reports) {
  ui.reportsList.innerHTML = "";
  reports.forEach(report => {
    const item = document.createElement("li");
    item.textContent = report;
    ui.reportsList.append(item);
  });
}

async function joinRoom() {
  roomId = normalizeRoom(ui.roomId.value);
  displayName = `${ui.displayName.value.trim() || "Guest"} - ${ui.role.value}`;
  localStorage.setItem("campus-meet-name", ui.displayName.value.trim());
  localStorage.setItem("campus-meet-role", ui.role.value);

  localStream = await getLocalMedia();
  history.replaceState(null, "", `/?room=${encodeURIComponent(roomId)}`);
  updateInviteLink();

  if (localStream.getTracks().length > 0) {
    addVideoTile("local", `${displayName} (you)`, localStream, true);
  } else {
    appendSystemMessage("Joined without camera or microphone. You can still chat and listen if your browser allows playback.");
  }

  connectSocket();
  setMeetingEnabled(true);
}

async function getLocalMedia() {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      return new MediaStream();
    }
  }
}

function connectSocket() {
  const configuredBackend = localStorage.getItem("campus-api-origin");
  const socketOrigin = configuredBackend || location.origin;
  const socketUrl = socketOrigin
    .replace(/^http:/, "ws:")
    .replace(/^https:/, "wss:");
  socket = new WebSocket(`${socketUrl}/ws/meeting/${encodeURIComponent(roomId)}`);

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ type: "join", roomId, name: displayName }));
  });

  socket.addEventListener("message", async event => {
    const message = JSON.parse(event.data);

    if (message.type === "joined") {
      myId = message.id;
      for (const peer of message.peers) {
        await createPeer(peer.id, peer.name, true);
      }
    }

    if (message.type === "peer-joined") {
      await createPeer(message.id, message.name, false);
      appendSystemMessage(`${message.name} joined.`);
    }

    if (message.type === "signal") {
      await handleSignal(message.from, message.name, message.signal);
    }

    if (message.type === "peer-left") {
      removePeer(message.id);
    }

    if (message.type === "roster") {
      renderParticipants(message.participants);
    }

    if (message.type === "chat") {
      appendChat(message.name, message.text);
    }
  });

  socket.addEventListener("close", () => {
    appendSystemMessage("Signaling connection closed.");
  });

  socket.addEventListener("error", () => {
    appendSystemMessage("Meeting server is unavailable. Dashboard features remain available.");
  });
}

async function createPeer(id, name, shouldOffer) {
  if (peers.has(id)) return peers.get(id).connection;

  const connection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  peers.set(id, { connection, name, stream: new MediaStream() });
  localStream.getTracks().forEach(track => connection.addTrack(track, localStream));

  connection.ontrack = event => {
    const peer = peers.get(id);
    event.streams[0].getTracks().forEach(track => peer.stream.addTrack(track));
    addVideoTile(id, peer.name, peer.stream);
  };

  connection.onicecandidate = event => {
    if (event.candidate) {
      sendSignal(id, { candidate: event.candidate });
    }
  };

  connection.onconnectionstatechange = () => {
    if (["closed", "failed", "disconnected"].includes(connection.connectionState)) {
      removePeer(id);
    }
  };

  if (shouldOffer) {
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    sendSignal(id, { description: connection.localDescription });
  }

  return connection;
}

async function handleSignal(from, name, signal) {
  const connection = await createPeer(from, name, false);

  if (signal.description) {
    await connection.setRemoteDescription(signal.description);

    if (signal.description.type === "offer") {
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      sendSignal(from, { description: connection.localDescription });
    }
  }

  if (signal.candidate) {
    await connection.addIceCandidate(signal.candidate);
  }
}

function sendSignal(to, signal) {
  socket?.send(JSON.stringify({ type: "signal", to, signal }));
}

function addVideoTile(id, name, stream, muted = false) {
  ui.videoGrid.querySelector(".empty")?.remove();
  let tile = document.querySelector(`[data-peer="${id}"]`);

  if (!tile) {
    tile = document.createElement("article");
    tile.className = "tile";
    tile.dataset.peer = id;

    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.muted = muted;

    const label = document.createElement("span");
    label.className = "tile-name";
    label.textContent = name;

    tile.append(video, label);
    ui.videoGrid.append(tile);
  }

  tile.querySelector("video").srcObject = stream;
}

function removePeer(id) {
  const peer = peers.get(id);
  peer?.connection.close();
  peers.delete(id);
  document.querySelector(`[data-peer="${id}"]`)?.remove();
}

function toggleMic() {
  micEnabled = !micEnabled;
  localStream?.getAudioTracks().forEach(track => {
    track.enabled = micEnabled;
  });
  ui.toggleMic.textContent = micEnabled ? "Mic" : "Muted";
}

function toggleCamera() {
  cameraEnabled = !cameraEnabled;
  localStream?.getVideoTracks().forEach(track => {
    track.enabled = cameraEnabled;
  });
  ui.toggleCamera.textContent = cameraEnabled ? "Camera" : "Camera off";
}

async function shareScreen() {
  if (localScreenTrack) {
    await stopScreenShare();
    return;
  }

  const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  localScreenTrack = screenStream.getVideoTracks()[0];
  replaceVideoTrack(localScreenTrack);
  addVideoTile("local", `${displayName} (screen)`, screenStream, true);
  ui.shareScreen.textContent = "Stop share";

  localScreenTrack.onended = stopScreenShare;
}

async function stopScreenShare() {
  const cameraTrack = localStream.getVideoTracks()[0];
  if (cameraTrack) replaceVideoTrack(cameraTrack);
  addVideoTile("local", `${displayName} (you)`, localStream, true);
  localScreenTrack = null;
  ui.shareScreen.textContent = "Share";
}

function replaceVideoTrack(track) {
  for (const { connection } of peers.values()) {
    const sender = connection.getSenders().find(item => item.track?.kind === "video");
    sender?.replaceTrack(track);
  }
}

function toggleRecording() {
  if (mediaRecorder?.state === "recording") {
    mediaRecorder.stop();
    return;
  }

  const stream = buildRecordingStream();
  if (!stream.getTracks().length || !window.MediaRecorder) {
    appendSystemMessage("Recording is not available in this browser or no media is active.");
    return;
  }

  recordedChunks = [];
  recordingStartedAt = new Date();
  mediaRecorder = new MediaRecorder(stream, { mimeType: pickRecordingMimeType() });
  mediaRecorder.ondataavailable = event => {
    if (event.data.size > 0) recordedChunks.push(event.data);
  };
  mediaRecorder.onstop = saveRecording;
  mediaRecorder.start(1000);
  ui.recordMeeting.textContent = "Stop rec";
  ui.recordMeeting.classList.add("recording");
  appendSystemMessage("Recording started. It will be stored on this server when stopped.");
}

function buildRecordingStream() {
  const tracks = [];
  const videoTrack = localScreenTrack || localStream?.getVideoTracks()[0];
  if (videoTrack) tracks.push(videoTrack);
  localStream?.getAudioTracks().forEach(track => tracks.push(track));
  peers.forEach(peer => {
    peer.stream.getAudioTracks().forEach(track => tracks.push(track));
  });
  return new MediaStream(tracks);
}

function pickRecordingMimeType() {
  const preferred = "video/webm;codecs=vp8,opus";
  return MediaRecorder.isTypeSupported(preferred) ? preferred : "video/webm";
}

async function saveRecording() {
  ui.recordMeeting.textContent = "Saving...";
  ui.recordMeeting.disabled = true;

  const blob = new Blob(recordedChunks, { type: "video/webm" });
  const recordingName = `${displayName}-${recordingStartedAt.toISOString().slice(0, 16)}`;
  const url = URL.createObjectURL(blob);
  const saved = {
    file: `${recordingName}.webm`,
    url,
    size: blob.size,
    createdAt: new Date().toISOString()
  };
  sessionRecordings.unshift(saved);
  renderRecordingList(ui.recordingsList, sessionRecordings);
  renderRecordingList(ui.reportsRecordingsList, sessionRecordings);
  appendSystemMessage("Recording is ready in this browser session.");

  ui.recordMeeting.textContent = "Record";
  ui.recordMeeting.classList.remove("recording");
  ui.recordMeeting.disabled = false;
}

async function loadRecordings() {
  try {
    const response = await fetch("/api/recordings");
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    const recordings = await response.json();
    renderRecordingList(ui.recordingsList, recordings);
    renderRecordingList(ui.reportsRecordingsList, recordings);
  } catch (error) {
    console.info("Using browser-session recordings because storage is unavailable.", error.message);
    renderRecordingList(ui.recordingsList, sessionRecordings);
    renderRecordingList(ui.reportsRecordingsList, sessionRecordings);
  }
}

function updateThemeLabel() {
  const dark = document.documentElement.dataset.theme === "dark";
  themeToggle.textContent = dark ? "Light mode" : "Dark mode";
  themeToggle.setAttribute("aria-label", `Switch to ${dark ? "light" : "dark"} mode`);
}

function renderRecordingList(target, recordings) {
  target.innerHTML = "";
  if (!recordings.length) {
    const item = document.createElement("li");
    item.innerHTML = "<small>No stored recordings yet.</small>";
    target.append(item);
    return;
  }

  recordings.slice(0, 8).forEach(recording => {
    const item = document.createElement("li");
    const sizeMb = (recording.size / 1024 / 1024).toFixed(1);
    item.innerHTML = `<a></a><small></small>`;
    item.querySelector("a").href = recording.url;
    item.querySelector("a").target = "_blank";
    item.querySelector("a").textContent = recording.file;
    item.querySelector("small").textContent = `${sizeMb} MB stored ${new Date(recording.createdAt).toLocaleString()}`;
    target.append(item);
  });
}

function renderParticipants(participants) {
  ui.participants.innerHTML = "";
  participants.forEach(participant => {
    const item = document.createElement("li");
    item.textContent = participant.id === myId ? `${participant.name} (you)` : participant.name;
    ui.participants.append(item);
  });
}

function sendChat(event) {
  event.preventDefault();
  const text = ui.chatInput.value.trim();
  if (!text) return;
  socket?.send(JSON.stringify({ type: "chat", text }));
  ui.chatInput.value = "";
}

function appendChat(name, text) {
  const message = document.createElement("div");
  message.className = "message";
  message.innerHTML = `<strong></strong><span></span>`;
  message.querySelector("strong").textContent = name;
  message.querySelector("span").textContent = text;
  ui.chatLog.append(message);
  ui.chatLog.scrollTop = ui.chatLog.scrollHeight;
}

function appendSystemMessage(text) {
  appendChat("System", text);
}

function copyInvite() {
  updateInviteLink();
  ui.inviteLink.select();
  navigator.clipboard?.writeText(ui.inviteLink.value);
  ui.copyLink.textContent = "Copied";
  setTimeout(() => {
    ui.copyLink.textContent = "Copy invite";
  }, 1300);
}

function updateInviteLink() {
  const room = normalizeRoom(ui.roomId.value);
  ui.roomId.value = room;
  ui.inviteLink.value = `${location.origin}/?room=${encodeURIComponent(room)}`;
}

function leaveRoom() {
  if (mediaRecorder?.state === "recording") mediaRecorder.stop();
  for (const id of [...peers.keys()]) removePeer(id);
  localStream?.getTracks().forEach(track => track.stop());
  socket?.close();
  localStream = null;
  setMeetingEnabled(false);
  ui.videoGrid.innerHTML = `<article class="tile empty"><span>Join a room to start camera, mic, chat, and screen share.</span></article>`;
  ui.participants.innerHTML = "";
}

function setMeetingEnabled(enabled) {
  ui.joinRoom.disabled = enabled;
  ui.leaveRoom.disabled = !enabled;
  ui.toggleMic.disabled = !enabled;
  ui.toggleCamera.disabled = !enabled;
  ui.shareScreen.disabled = !enabled;
  ui.recordMeeting.disabled = !enabled;
  ui.chatInput.disabled = !enabled;
  ui.chatForm.querySelector("button").disabled = !enabled;
}

function normalizeRoom(value) {
  return (value || "mentor-room")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "mentor-room";
}
