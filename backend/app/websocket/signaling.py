from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.rooms = {}

    async def connect(self, room_id: str, websocket: WebSocket):
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = []
        self.rooms[room_id].append(websocket)

    def disconnect(self, room_id: str, websocket: WebSocket):
        if room_id in self.rooms:
            self.rooms[room_id].remove(websocket)
            if not self.rooms[room_id]:
                del self.rooms[room_id]

    async def relay(self, room_id: str, message: dict, sender: WebSocket):
        if room_id in self.rooms:
            for connection in self.rooms[room_id]:
                if connection != sender:
                    await connection.send_json(message)

manager = ConnectionManager()

async def signaling_endpoint(websocket: WebSocket, meeting_id: str):
    await manager.connect(meeting_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.relay(meeting_id, data, websocket)
    except Exception:
        manager.disconnect(meeting_id, websocket)
