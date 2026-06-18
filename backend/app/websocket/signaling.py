from uuid import uuid4
from fastapi import WebSocket, APIRouter, WebSocketDisconnect
from app.config import settings
from app.firebase.client import firebase_auth, db

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.rooms: dict[str, dict[str, dict]] = {}

    async def connect(self, room_id: str, websocket: WebSocket, name: str):
        participant_id = uuid4().hex
        room = self.rooms.setdefault(room_id, {})
        peers = [{"id": peer_id, "name": peer["name"]} for peer_id, peer in room.items()]
        room[participant_id] = {"socket": websocket, "name": name}

        await websocket.send_json({"type": "joined", "id": participant_id, "peers": peers})
        await self.broadcast(room_id, {
            "type": "peer-joined",
            "id": participant_id,
            "name": name,
        }, exclude=participant_id)
        await self.send_roster(room_id)
        return participant_id

    async def disconnect(self, room_id: str, participant_id: str):
        room = self.rooms.get(room_id)
        if not room:
            return
        room.pop(participant_id, None)
        if not room:
            self.rooms.pop(room_id, None)
            return
        await self.broadcast(room_id, {"type": "peer-left", "id": participant_id})
        await self.send_roster(room_id)

    async def send_to(self, room_id: str, participant_id: str, message: dict):
        participant = self.rooms.get(room_id, {}).get(participant_id)
        if participant:
            await participant["socket"].send_json(message)

    async def broadcast(self, room_id: str, message: dict, exclude: str | None = None):
        for participant_id, participant in self.rooms.get(room_id, {}).items():
            if participant_id != exclude:
                await participant["socket"].send_json(message)

    async def send_roster(self, room_id: str):
        participants = [
            {"id": participant_id, "name": participant["name"]}
            for participant_id, participant in self.rooms.get(room_id, {}).items()
        ]
        await self.broadcast(room_id, {"type": "roster", "participants": participants})

manager = ConnectionManager()

@router.websocket("/meeting/{meeting_id}")
async def signaling_endpoint(websocket: WebSocket, meeting_id: str):
    participant_id = None
    try:
        token = websocket.query_params.get("token")
        authenticated_user = None
        if token and firebase_auth:
            authenticated_user = firebase_auth.verify_id_token(token, check_revoked=True)
        elif not settings.ALLOW_ANONYMOUS_MEETINGS:
            await websocket.close(code=4401, reason="Authentication required")
            return

        if authenticated_user and db:
            meeting_doc = db.collection("meetings").document(meeting_id).get()
            if not meeting_doc.exists:
                await websocket.close(code=4404, reason="Meeting not found")
                return
            meeting = meeting_doc.to_dict()
            uid = authenticated_user.get("uid")
            if uid not in {meeting.get("studentId"), meeting.get("mentorId")}:
                await websocket.close(code=4403, reason="Not a meeting participant")
                return

        await websocket.accept()
        join_message = await websocket.receive_json()
        name = str(
            authenticated_user.get("name") if authenticated_user
            else join_message.get("name") or "Guest"
        )[:80]
        participant_id = await manager.connect(meeting_id, websocket, name)
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "signal" and data.get("to"):
                await manager.send_to(meeting_id, data["to"], {
                    "type": "signal",
                    "from": participant_id,
                    "name": name,
                    "signal": data.get("signal", {}),
                })
            elif data.get("type") == "chat":
                text = str(data.get("text") or "").strip()[:2000]
                if text:
                    await manager.broadcast(meeting_id, {
                        "type": "chat",
                        "name": name,
                        "text": text,
                    })
    except WebSocketDisconnect:
        pass
    finally:
        if participant_id:
            await manager.disconnect(meeting_id, participant_id)
