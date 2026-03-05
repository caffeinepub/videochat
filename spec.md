# VideoChat App

## Current State
New project. No existing code.

## Requested Changes (Diff)

### Add
- Video chat room with WebRTC peer-to-peer video/audio streaming
- Reversible (front/back) camera toggle button during a call
- Shareable room link that can be sent via WhatsApp or any messenger
- Text chat panel alongside the video feed (in-call text messaging)
- Video recording capability for the session
- Room creation and join-by-link flow

### Modify
N/A

### Remove
N/A

## Implementation Plan

### Backend (Motoko)
- `createRoom(name: Text) -> RoomId` -- creates a new chat room, returns unique room ID
- `getRoom(roomId: Text) -> ?Room` -- fetches room info by ID
- `listRooms() -> [Room]` -- list active rooms
- `sendMessage(roomId: Text, sender: Text, content: Text) -> MessageId` -- save a text chat message
- `getMessages(roomId: Text) -> [Message]` -- retrieve all messages for a room
- Room data: { id, name, createdAt }
- Message data: { id, roomId, sender, content, timestamp }

### Frontend
- **Home page**: Create room form + join room by ID field
- **Room page** (`/room/:roomId`):
  - Local video preview (self) + remote video feed (peer)
  - Camera flip button (front/back toggle via `facingMode` constraint)
  - Mute/unmute audio toggle
  - Share link button: generates a WhatsApp-shareable URL with the room ID
  - Text chat sidebar: message input + scrollable message history pulled from backend
  - Record button: uses MediaRecorder API to record local stream, download on stop
  - Leave/end call button
- WebRTC signaling via backend polling (offer/answer/ICE stored in backend as simple signal messages)
- Responsive layout: video takes primary space, text chat as a side/bottom panel
