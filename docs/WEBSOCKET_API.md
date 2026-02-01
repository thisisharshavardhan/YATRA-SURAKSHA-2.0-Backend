# Yatra Suraksha WebSocket API Documentation

## Connection URLs

| Namespace | URL | Authentication |
|-----------|-----|----------------|
| **User** (mobile app) | `http://localhost:3000/user` | `socketAuth` (user JWT token) |
| **Admin** (dashboard) | `http://localhost:3000/admin` | `adminSocketAuth` (admin JWT token) |

## Connection Example

```javascript
import { io } from "socket.io-client";

// For user namespace
const userSocket = io("http://localhost:3000/user", {
    auth: {
        token: "YOUR_JWT_TOKEN"
    }
});

// For admin namespace
const adminSocket = io("http://localhost:3000/admin", {
    auth: {
        token: "YOUR_ADMIN_JWT_TOKEN"
    }
});

// Listen for connection
userSocket.on("connected", (data) => {
    console.log("Connected:", data);
});

userSocket.on("connect_error", (err) => {
    console.log("Connection error:", err.message);
});
```

---

# User Namespace (`/user`)

## Connection Events

### `connected` (Server → Client)
Sent when user successfully connects.

```json
{
  "userId": "507f1f77bcf86cd799439011",
  "name": "John Doe",
  "message": "Connected successfully"
}
```

### `group:refresh` (Client → Server)
Request to refresh user's group memberships.

```json
{}
```

### `group:refreshed` (Server → Client)
Response after groups are refreshed.

```json
{
  "success": true,
  "groups": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
  "message": "Joined 2 groups"
}
```

---

## Location Events

### `location:update` (Client → Server)
Update user's current location.

**Payload:**
```json
{
  "latitude": 12.9716,
  "longitude": 77.5946,
  "altitude": 920,
  "speed": 45.5,
  "accuracy": 10,
  "heading": 180,
  "battery": 85
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| latitude | number | ✅ | Latitude coordinate |
| longitude | number | ✅ | Longitude coordinate |
| altitude | number | ❌ | Altitude in meters |
| speed | number | ❌ | Speed in km/h |
| accuracy | number | ❌ | GPS accuracy in meters |
| heading | number | ❌ | Direction in degrees (0-360) |
| battery | number | ❌ | Battery percentage |

### `location:updated` (Server → Client)
Confirmation of location update.

```json
{
  "success": true,
  "timestamp": "2026-01-30T10:30:00.000Z"
}
```

### `location:broadcast` (Server → Client)
Broadcasted to group members when a member updates location.

```json
{
  "userId": "507f1f77bcf86cd799439011",
  "name": "John Doe",
  "profilePicture": "https://example.com/photo.jpg",
  "latitude": 12.9716,
  "longitude": 77.5946,
  "altitude": 920,
  "speed": 45.5,
  "accuracy": 10,
  "heading": 180,
  "battery": 85,
  "timestamp": "2026-01-30T10:30:00.000Z",
  "groupId": "507f1f77bcf86cd799439012"
}
```

### `location:get-group` (Client → Server)
Request all group members' last known locations.

**Payload:**
```json
{
  "groupId": "507f1f77bcf86cd799439012"
}
```

### `location:group-members` (Server → Client)
Response with all group members' locations.

```json
{
  "groupId": "507f1f77bcf86cd799439012",
  "groupName": "Family Trip",
  "members": [
    {
      "userId": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "profilePicture": "https://example.com/photo.jpg",
      "role": "admin",
      "isOnline": true,
      "location": {
        "latitude": 12.9716,
        "longitude": 77.5946,
        "speed": 45.5,
        "battery": 85,
        "timestamp": "2026-01-30T10:30:00.000Z"
      }
    },
    {
      "userId": "507f1f77bcf86cd799439013",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "profilePicture": null,
      "role": "member",
      "isOnline": false,
      "location": null
    }
  ]
}
```

### `location:stop` (Client → Server)
Notify that user stopped sharing location.

```json
{}
```

### `location:stop-confirmed` (Server → Client)
Confirmation of stop sharing.

```json
{
  "success": true
}
```

### `location:stopped` (Server → Client)
Broadcasted to group members when a member stops sharing.

```json
{
  "userId": "507f1f77bcf86cd799439011",
  "name": "John Doe",
  "timestamp": "2026-01-30T10:35:00.000Z"
}
```

---

## SOS/Alert Events

### `sos:trigger` (Client → Server)
Trigger an SOS emergency alert.

**Payload:**
```json
{
  "latitude": 12.9716,
  "longitude": 77.5946,
  "message": "I need help! Car broke down on highway."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| latitude | number | ✅ | Latitude coordinate |
| longitude | number | ✅ | Longitude coordinate |
| message | string | ❌ | Optional emergency message |

### `sos:confirmed` (Server → Client)
Confirmation that SOS was sent.

```json
{
  "alertId": "507f1f77bcf86cd799439099",
  "message": "SOS sent successfully",
  "timestamp": "2026-01-30T10:30:00.000Z"
}
```

### `sos:alert` (Server → Client)
Broadcasted to group members when someone triggers SOS.

```json
{
  "alertId": "507f1f77bcf86cd799439099",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "phone": "+919876543210",
    "email": "john@example.com",
    "profilePicture": "https://example.com/photo.jpg"
  },
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "googleMapsUrl": "https://maps.google.com/?q=12.9716,77.5946"
  },
  "message": "I need help! Car broke down on highway.",
  "timestamp": "2026-01-30T10:30:00.000Z",
  "status": "active",
  "group": {
    "id": "507f1f77bcf86cd799439012",
    "name": "Family Trip"
  }
}
```

### `sos:emergency-contact` (Server → Client)
Sent to user's emergency contacts.

```json
{
  "alertId": "507f1f77bcf86cd799439099",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "phone": "+919876543210",
    "email": "john@example.com",
    "profilePicture": "https://example.com/photo.jpg"
  },
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "googleMapsUrl": "https://maps.google.com/?q=12.9716,77.5946"
  },
  "message": "EMERGENCY: John Doe triggered an SOS!",
  "timestamp": "2026-01-30T10:30:00.000Z",
  "status": "active"
}
```

### `sos:cancel` (Client → Server)
Cancel an active SOS alert.

**Payload:**
```json
{
  "alertId": "507f1f77bcf86cd799439099",
  "reason": "False alarm, I'm okay now"
}
```

### `sos:cancelled` (Server → Client)
Confirmation of SOS cancellation.

```json
{
  "alertId": "507f1f77bcf86cd799439099",
  "message": "SOS cancelled successfully"
}
```

### `sos:resolved` (Server → Client)
Broadcasted when an SOS is resolved.

```json
{
  "alertId": "507f1f77bcf86cd799439099",
  "cancelledBy": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe"
  },
  "reason": "False alarm, I'm okay now",
  "timestamp": "2026-01-30T10:35:00.000Z"
}
```

### `alert:low-battery` (Client → Server)
Send low battery alert (battery ≤ 20%).

**Payload:**
```json
{
  "latitude": 12.9716,
  "longitude": 77.5946,
  "battery": 15
}
```

### `alert:low-battery` (Server → Client)
Broadcasted to groups/admins.

```json
{
  "alertId": "507f1f77bcf86cd799439100",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe"
  },
  "battery": 15,
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946
  },
  "timestamp": "2026-01-30T10:30:00.000Z"
}
```

### `alert:resolved-by-admin` (Server → Client)
Sent to user when admin resolves their alert.

```json
{
  "alertId": "507f1f77bcf86cd799439099",
  "resolvedBy": "Admin User",
  "notes": "User confirmed safe via phone call"
}
```

---

## GPT Realtime Voice Assistant Events

### `gpt:connect` (Client → Server)
Connect to AI voice assistant.

**Payload:**
```json
{
  "longitude": 77.5946,
  "latitude": 12.9716,
  "settings": {
    "voice": "alloy",
    "language": "en"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| latitude | number | ❌ | Current latitude |
| longitude | number | ❌ | Current longitude |
| settings | object | ❌ | Voice settings |

### `gpt:connected` (Server → Client)
Confirmation of AI connection.

```json
{
  "success": true,
  "message": "Connected to AI voice assistant",
  "userId": "507f1f77bcf86cd799439011",
  "settings": {
    "voice": "alloy",
    "language": "en"
  }
}
```

### `gpt:audio` (Client → Server)
Send audio data while recording.

**Payload:**
```json
{
  "audio": "UklGRiQAAABXQVZFZm10IBAAAA..."
}
```

> **Note:** Audio must be Base64 encoded PCM16 at 24kHz sample rate.

### `gpt:audio-commit` (Client → Server)
Signal end of speech, request AI response.

```json
{}
```

### `gpt:text` (Client → Server)
Send text message instead of voice.

**Payload:**
```json
{
  "text": "What's the safest route to the airport?"
}
```

### `gpt:text-sent` (Server → Client)
Confirmation that text was sent.

```json
{
  "success": true,
  "text": "What's the safest route to the airport?"
}
```

### `gpt:update-location` (Client → Server)
Update location context during session.

**Payload:**
```json
{
  "longitude": 77.6200,
  "latitude": 12.9800
}
```

### `gpt:location-updated` (Server → Client)
Confirmation with safety info.

```json
{
  "success": true,
  "location": {
    "longitude": 77.6200,
    "latitude": 12.9800
  },
  "safetyInfo": {
    "name": "Indiranagar, Bangalore",
    "safetyScore": 85,
    "riskLevel": "low"
  }
}
```

### `gpt:status` (Client → Server)
Get current session status.

```json
{}
```

### `gpt:status-response` (Server → Client)
Current session information.

```json
{
  "connected": true,
  "sessionInfo": {
    "sessionId": "sess_abc123",
    "createdAt": "2026-01-30T10:00:00.000Z",
    "model": "gpt-4o-realtime"
  }
}
```

### `gpt:disconnect` (Client → Server)
Disconnect from AI service.

```json
{}
```

### `gpt:disconnected` (Server → Client)
Confirmation of disconnection.

```json
{
  "success": true,
  "message": "Disconnected from AI voice assistant"
}
```

### `gpt:session-created` (Server → Client)
Azure session initialized.

```json
{
  "sessionId": "sess_abc123",
  "model": "gpt-4o-realtime"
}
```

### `gpt:audio-delta` (Server → Client)
Audio chunk from AI response.

```json
{
  "audio": "UklGRiQAAABXQVZFZm10IBAAAA..."
}
```

### `gpt:audio-done` (Server → Client)
AI audio response complete.

```json
{}
```

### `gpt:transcript-delta` (Server → Client)
Partial transcript of AI response.

```json
{
  "delta": "The safest route to the"
}
```

### `gpt:transcript-done` (Server → Client)
Complete transcript of AI response.

```json
{
  "transcript": "The safest route to the airport is via the outer ring road. It has good lighting and police patrols."
}
```

### `gpt:text-response` (Server → Client)
Text response from AI.

```json
{
  "text": "The safest route to the airport is via the outer ring road."
}
```

### `gpt:user-transcript` (Server → Client)
Transcription of user's speech.

```json
{
  "transcript": "What's the safest route to the airport?"
}
```

### `gpt:speech-started` (Server → Client)
User speech detected.

```json
{}
```

### `gpt:speech-stopped` (Server → Client)
User speech ended.

```json
{}
```

### `gpt:function-calling` (Server → Client)
AI is calling a function/tool.

```json
{
  "function": "get_safety_score"
}
```

### `gpt:function-executing` (Server → Client)
Function is being executed.

```json
{
  "function": "get_safety_score",
  "args": {
    "latitude": 12.9716,
    "longitude": 77.5946
  }
}
```

### `gpt:function-result` (Server → Client)
Function execution completed.

```json
{
  "function": "get_safety_score",
  "result": {
    "score": 85,
    "riskLevel": "low",
    "area": "Indiranagar"
  }
}
```

### `gpt:sos-confirmed` (Server → Client)
SOS triggered by AI was saved successfully.

```json
{
  "success": true,
  "alertId": "507f1f77bcf86cd799439099",
  "message": "SOS alert has been sent to your emergency contacts and group members"
}
```

### `gpt:sos-error` (Server → Client)
SOS processing failed.

```json
{
  "success": false,
  "message": "Failed to process SOS alert",
  "error": "Database connection failed"
}
```

### `gpt:error` (Server → Client)
General GPT error.

```json
{
  "message": "Failed to send audio",
  "hint": "Make sure to connect first using gpt:connect"
}
```

---

# Admin Namespace (`/admin`)

## Connection Events

### `users:online` (Server → Client)
Sent on connection with list of ALL users (both online and offline).

```json
{
  "count": 5,
  "onlineCount": 2,
  "users": [
    {
      "userId": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "profilePicture": "https://example.com/photo.jpg",
      "phoneNumber": "+919876543210",
      "isOnline": true,
      "connectedAt": "2026-01-30T10:00:00.000Z",
      "registeredAt": "2026-01-15T08:00:00.000Z"
    },
    {
      "userId": "507f1f77bcf86cd799439012",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "profilePicture": null,
      "phoneNumber": "+919876543211",
      "isOnline": true,
      "connectedAt": "2026-01-30T10:15:00.000Z",
      "registeredAt": "2026-01-10T12:00:00.000Z"
    },
    {
      "userId": "507f1f77bcf86cd799439013",
      "name": "Bob Smith",
      "email": "bob@example.com",
      "profilePicture": null,
      "phoneNumber": "+919876543212",
      "isOnline": false,
      "connectedAt": null,
      "registeredAt": "2026-01-20T09:30:00.000Z"
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| count | Total number of registered users |
| onlineCount | Number of currently online users |
| users[].isOnline | Whether the user is currently connected |
| users[].connectedAt | When user connected (null if offline) |
| users[].registeredAt | When user registered |

### `user:online` (Server → Client)
Real-time notification when a user comes online.

```json
{
  "userId": "507f1f77bcf86cd799439011",
  "name": "John Doe",
  "email": "john@example.com",
  "connectedAt": "2026-01-30T10:30:00.000Z"
}
```

### `user:offline` (Server → Client)
Real-time notification when a user goes offline.

```json
{
  "userId": "507f1f77bcf86cd799439011",
  "name": "John Doe",
  "reason": "client namespace disconnect",
  "disconnectedAt": "2026-01-30T11:00:00.000Z"
}
```

---

## Admin Location Events

### `admin:get-all-locations` (Client → Server)
Request all users' last known locations.

```json
{}
```

### `admin:all-locations` (Server → Client)
Response with all users' locations.

```json
{
  "count": 2,
  "users": [
    {
      "userId": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "profilePicture": "https://example.com/photo.jpg",
      "phoneNumber": "+919876543210",
      "latitude": 12.9716,
      "longitude": 77.5946,
      "battery": 85,
      "speed": 45.5,
      "accuracy": 10,
      "timestamp": "2026-01-30T10:30:00.000Z",
      "isOnline": true
    },
    {
      "userId": "507f1f77bcf86cd799439012",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "profilePicture": null,
      "phoneNumber": "+919876543211",
      "latitude": 13.0827,
      "longitude": 80.2707,
      "battery": 60,
      "speed": 0,
      "accuracy": 15,
      "timestamp": "2026-01-30T10:25:00.000Z",
      "isOnline": false
    }
  ]
}
```

### `admin:get-user-location` (Client → Server)
Request specific user's location history.

**Payload:**
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "limit": 20
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | ✅ | MongoDB ObjectId |
| limit | number | ❌ | Max locations to return (default: 50) |

### `admin:user-location-history` (Server → Client)
Response with user's location history.

```json
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "profilePicture": "https://example.com/photo.jpg",
    "isOnline": true
  },
  "locations": [
    {
      "latitude": 12.9716,
      "longitude": 77.5946,
      "battery": 85,
      "speed": 45.5,
      "timestamp": "2026-01-30T10:30:00.000Z"
    },
    {
      "latitude": 12.9700,
      "longitude": 77.5930,
      "battery": 86,
      "speed": 50.0,
      "timestamp": "2026-01-30T10:29:00.000Z"
    }
  ]
}
```

### `user:location` (Server → Client)
Real-time user location broadcast to admins.

```json
{
  "userId": "507f1f77bcf86cd799439011",
  "name": "John Doe",
  "profilePicture": "https://example.com/photo.jpg",
  "latitude": 12.9716,
  "longitude": 77.5946,
  "altitude": 920,
  "speed": 45.5,
  "accuracy": 10,
  "heading": 180,
  "battery": 85,
  "timestamp": "2026-01-30T10:30:00.000Z"
}
```

### `user:location-stopped` (Server → Client)
Notification when user stops sharing location.

```json
{
  "userId": "507f1f77bcf86cd799439011",
  "name": "John Doe",
  "timestamp": "2026-01-30T10:35:00.000Z"
}
```

---

## Admin Alert Events

### `admin:get-active-alerts` (Client → Server)
Request all active alerts.

```json
{}
```

### `admin:active-alerts` (Server → Client)
Response with active alerts.

```json
{
  "count": 2,
  "alerts": [
    {
      "alertId": "507f1f77bcf86cd799439099",
      "type": "sos",
      "severity": "critical",
      "user": {
        "id": "507f1f77bcf86cd799439011",
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+919876543210"
      },
      "location": {
        "latitude": 12.9716,
        "longitude": 77.5946
      },
      "message": "Emergency SOS triggered",
      "createdAt": "2026-01-30T10:30:00.000Z"
    },
    {
      "alertId": "507f1f77bcf86cd799439100",
      "type": "low_battery",
      "severity": "medium",
      "user": {
        "id": "507f1f77bcf86cd799439012",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "phone": "+919876543211"
      },
      "location": {
        "latitude": 13.0827,
        "longitude": 80.2707
      },
      "message": "Battery at 15%",
      "createdAt": "2026-01-30T10:25:00.000Z"
    }
  ]
}
```

### `admin:resolve-alert` (Client → Server)
Resolve an alert.

**Payload:**
```json
{
  "alertId": "507f1f77bcf86cd799439099",
  "notes": "User confirmed safe via phone call"
}
```

### `admin:alert-resolved` (Server → Client)
Confirmation of resolution.

```json
{
  "alertId": "507f1f77bcf86cd799439099",
  "message": "Alert resolved successfully"
}
```

### `sos:emergency` (Server → Client)
Real-time SOS alert broadcast to admins.

```json
{
  "alertId": "507f1f77bcf86cd799439099",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "phone": "+919876543210",
    "email": "john@example.com",
    "profilePicture": "https://example.com/photo.jpg"
  },
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "googleMapsUrl": "https://maps.google.com/?q=12.9716,77.5946"
  },
  "message": "Emergency SOS triggered",
  "timestamp": "2026-01-30T10:30:00.000Z",
  "status": "active"
}
```

### `alert:low-battery` (Server → Client)
Real-time low battery alert broadcast.

```json
{
  "alertId": "507f1f77bcf86cd799439100",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe"
  },
  "battery": 15,
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946
  },
  "timestamp": "2026-01-30T10:30:00.000Z"
}
```

---

## Admin Group Events

### `admin:get-groups` (Client → Server)
Request all groups.
```json

{}
```

### `admin:groups` (Server → Client)
Response with all groups.

```json
{
  "count": 2,
  "groups": [
    {
      "id": "507f1f77bcf86cd799439012",
      "name": "Family Trip",
      "description": "Summer vacation to Goa",
      "joinCode": "FAM123",
      "memberCount": 5,
      "createdBy": {
        "id": "507f1f77bcf86cd799439011",
        "name": "John Doe"
      },
      "createdAt": "2026-01-15T10:00:00.000Z"
    },
    {
      "id": "507f1f77bcf86cd799439013",
      "name": "Office Commute",
      "description": "Daily office travel group",
      "joinCode": "OFC456",
      "memberCount": 12,
      "createdBy": {
        "id": "507f1f77bcf86cd799439014",
        "name": "Admin User"
      },
      "createdAt": "2026-01-10T08:00:00.000Z"
    }
  ]
}
```

### `admin:get-group-locations` (Client → Server)
Request all members' locations for a specific group.

**Payload:**
```json
{
  "groupId": "507f1f77bcf86cd799439012"
}
```

### `admin:group-locations` (Server → Client)
Response with group members' locations.

```json
{
  "group": {
    "id": "507f1f77bcf86cd799439012",
    "name": "Family Trip"
  },
  "members": [
    {
      "userId": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+919876543210",
      "role": "admin",
      "isOnline": true,
      "location": {
        "latitude": 12.9716,
        "longitude": 77.5946,
        "battery": 85,
        "speed": 45.5,
        "timestamp": "2026-01-30T10:30:00.000Z"
      }
    },
    {
      "userId": "507f1f77bcf86cd799439015",
      "name": "Bob Smith",
      "email": "bob@example.com",
      "phone": "+919876543212",
      "role": "member",
      "isOnline": false,
      "location": null
    }
  ]
}
```

---

## Admin Subscription Events

### `admin:subscribe-user` (Client → Server)
Subscribe to a specific user's real-time updates.

**Payload:**
```json
{
  "userId": "507f1f77bcf86cd799439011"
}
```

### `admin:subscribed` (Server → Client)
Confirmation of subscription.

```json
{
  "userId": "507f1f77bcf86cd799439011"
}
```

### `admin:unsubscribe-user` (Client → Server)
Unsubscribe from a user's updates.

**Payload:**
```json
{
  "userId": "507f1f77bcf86cd799439011"
}
```

### `admin:unsubscribed` (Server → Client)
Confirmation of unsubscription.

```json
{
  "userId": "507f1f77bcf86cd799439011"
}
```

---

## Admin GPT Events

### `gpt:user-connected` (Server → Client)
Notification when a user connects to GPT.

```json
{
  "userId": "507f1f77bcf86cd799439011",
  "userName": "John Doe",
  "connectedAt": "2026-01-30T10:30:00.000Z",
  "voiceSettings": {
    "voice": "alloy",
    "language": "en"
  }
}
```

### `gpt:user-disconnected` (Server → Client)
Notification when a user disconnects from GPT.

```json
{
  "userId": "507f1f77bcf86cd799439011",
  "userName": "John Doe",
  "disconnectedAt": "2026-01-30T11:00:00.000Z"
}
```

---

# Global Error Event

### `error` (Server → Client)
Sent when an error occurs for any event.

```json
{
  "event": "location:update",
  "message": "latitude and longitude are required"
}
```

---

# Event Summary Table

## User Namespace Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `connected` | S → C | Connection success |
| `group:refresh` | C → S | Refresh groups |
| `group:refreshed` | S → C | Groups refreshed |
| `location:update` | C → S | Update location |
| `location:updated` | S → C | Location confirmed |
| `location:broadcast` | S → C | Location to group |
| `location:get-group` | C → S | Get group locations |
| `location:group-members` | S → C | Group members' locations |
| `location:stop` | C → S | Stop sharing |
| `location:stop-confirmed` | S → C | Stop confirmed |
| `location:stopped` | S → C | Member stopped sharing |
| `sos:trigger` | C → S | Trigger SOS |
| `sos:confirmed` | S → C | SOS confirmed |
| `sos:alert` | S → C | SOS to group |
| `sos:emergency-contact` | S → C | SOS to contacts |
| `sos:cancel` | C → S | Cancel SOS |
| `sos:cancelled` | S → C | Cancel confirmed |
| `sos:resolved` | S → C | SOS resolved |
| `alert:low-battery` | C → S | Low battery alert |
| `alert:resolved-by-admin` | S → C | Admin resolved alert |
| `gpt:connect` | C → S | Connect to AI |
| `gpt:connected` | S → C | AI connected |
| `gpt:audio` | C → S | Send audio |
| `gpt:audio-commit` | C → S | End speech |
| `gpt:text` | C → S | Send text |
| `gpt:text-sent` | S → C | Text sent |
| `gpt:update-location` | C → S | Update location |
| `gpt:location-updated` | S → C | Location updated |
| `gpt:status` | C → S | Get status |
| `gpt:status-response` | S → C | Status response |
| `gpt:disconnect` | C → S | Disconnect AI |
| `gpt:disconnected` | S → C | AI disconnected |
| `gpt:audio-delta` | S → C | AI audio chunk |
| `gpt:audio-done` | S → C | AI audio complete |
| `gpt:transcript-delta` | S → C | Partial transcript |
| `gpt:transcript-done` | S → C | Full transcript |
| `gpt:user-transcript` | S → C | User speech text |
| `gpt:function-calling` | S → C | AI calling function |
| `gpt:function-result` | S → C | Function result |
| `gpt:error` | S → C | GPT error |

## Admin Namespace Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `users:online` | S → C | Online users list |
| `user:online` | S → C | User came online |
| `user:offline` | S → C | User went offline |
| `admin:get-all-locations` | C → S | Get all locations |
| `admin:all-locations` | S → C | All locations |
| `admin:get-user-location` | C → S | Get user history |
| `admin:user-location-history` | S → C | User history |
| `user:location` | S → C | Real-time location |
| `admin:get-active-alerts` | C → S | Get active alerts |
| `admin:active-alerts` | S → C | Active alerts |
| `admin:resolve-alert` | C → S | Resolve alert |
| `admin:alert-resolved` | S → C | Resolution confirmed |
| `sos:emergency` | S → C | SOS emergency |
| `admin:get-groups` | C → S | Get all groups |
| `admin:groups` | S → C | Groups list |
| `admin:get-group-locations` | C → S | Get group locations |
| `admin:group-locations` | S → C | Group locations |
| `admin:subscribe-user` | C → S | Subscribe to user |
| `admin:subscribed` | S → C | Subscribed |
| `admin:unsubscribe-user` | C → S | Unsubscribe |
| `admin:unsubscribed` | S → C | Unsubscribed |
| `gpt:user-connected` | S → C | User connected to GPT |
| `gpt:user-disconnected` | S → C | User left GPT |
| `error` | S → C | Error occurred |

---

*Last updated: January 30, 2026*
