# Yatra Suraksha 2.0 - API Documentation

A comprehensive travel safety backend application with real-time location tracking, SOS alerts, group management, and safety scoring.

## Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [REST API Endpoints](#rest-api-endpoints)
  - [Authentication](#authentication-endpoints)
  - [Users](#user-endpoints)
  - [Locations](#location-endpoints)
  - [Alerts](#alert-endpoints)
  - [Groups](#group-endpoints)
  - [Geofences](#geofence-endpoints)
  - [Trips](#trip-endpoints)
  - [Safety Scores](#safety-score-endpoints)
- [WebSocket API](#websocket-api)
  - [User Namespace](#user-namespace)
  - [Admin Namespace](#admin-namespace)

---

## Base URL

```
http://localhost:3000
```

## Authentication

All API endpoints (except health check) require Firebase Authentication. Include the Firebase ID token in the Authorization header:

```
Authorization: Bearer <firebase_id_token>
```

---

## REST API Endpoints

### Authentication Endpoints

Base path: `/api/auth`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/login` | Login or register user with Firebase token | Yes (Firebase Token) |
| `GET` | `/check` | Check if user exists in database | Yes (Firebase Token) |
| `GET` | `/me` | Get current authenticated user | Yes |
| `POST` | `/logout` | Logout user (tracking purposes) | Yes |
| `DELETE` | `/account` | Permanently delete user account | Yes |

#### POST `/api/auth/login`
Authenticates user with Firebase token. Creates new user if doesn't exist.

**Response:**
- `200` - Login successful
- `201` - User registered successfully
- `401` - Unauthorized

---

### User Endpoints

Base path: `/api/users`

All routes require authentication.

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/profile` | Get current user profile | Yes |
| `PUT` | `/profile` | Update user profile | Yes |
| `PUT` | `/emergency-contacts` | Update emergency contacts (max 5) | Yes |
| `PUT` | `/health-info` | Update health/medical information | Yes |
| `PUT` | `/permissions` | Update app permissions | Yes |
| `GET` | `/search` | Search users by email or phone | Yes |
| `GET` | `/:id` | Get user by ID (public profile) | Yes |

#### PUT `/api/users/profile`
**Request Body:**
```json
{
  "name": "John Doe",
  "phoneNumber": "+919876543210",
  "alternativePhoneNumber": "+919876543211",
  "whatsappNumber": "+919876543210",
  "profilePicture": "https://example.com/photo.jpg",
  "dateOfBirth": "1995-06-15",
  "gender": "male|female|other",
  "nationality": "Indian"
}
```

#### PUT `/api/users/emergency-contacts`
**Request Body:**
```json
{
  "emergencyContacts": [
    {
      "name": "Jane Doe",
      "relation": "Spouse",
      "phoneNumber": "+919876543211"
    }
  ]
}
```

#### PUT `/api/users/health-info`
**Request Body:**
```json
{
  "bloodGroup": "O+",
  "allergies": ["Peanuts", "Dust"],
  "chronicDiseases": ["Diabetes"],
  "medications": ["Metformin"]
}
```

#### PUT `/api/users/permissions`
**Request Body:**
```json
{
  "allowLocationAccess": true,
  "allowNotificationAccess": true,
  "allowSmsAccess": false
}
```

#### GET `/api/users/search`
**Query Parameters:**
- `q` (required) - Search query (min 3 characters)

---

### Location Endpoints

Base path: `/api/locations`

All routes require authentication.

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/` | Update current location | Yes |
| `POST` | `/batch` | Batch update locations (offline sync) | Yes |
| `GET` | `/me` | Get my latest location | Yes |
| `GET` | `/history` | Get my location history | Yes |
| `DELETE` | `/history` | Delete location history | Yes |
| `GET` | `/nearby` | Find nearby users ⚠️ | Yes |
| `POST` | `/users` | Get multiple users' locations | Yes |
| `GET` | `/user/:userId` | Get a specific user's location | Yes |

> ⚠️ `/nearby` endpoint is marked as not tested - use with caution

#### POST `/api/locations`
**Request Body:**
```json
{
  "longitude": 77.5946,
  "latitude": 12.9716,
  "altitude": 920,
  "speed": 5.5,
  "heading": 45,
  "accuracy": 10,
  "batteryLevel": 85,
  "isCharging": false
}
```

#### POST `/api/locations/batch`
**Request Body:**
```json
{
  "locations": [
    {
      "longitude": 77.5946,
      "latitude": 12.9716,
      "altitude": 920,
      "speed": 5.5,
      "heading": 45,
      "accuracy": 10,
      "batteryLevel": 85,
      "isCharging": false,
      "timestamp": "2026-01-28T10:00:00Z"
    }
  ]
}
```

#### GET `/api/locations/history`
**Query Parameters:**
- `startDate` - Start date for history range
- `endDate` - End date for history range
- `limit` - Number of records per page (default: 100, max: 500)
- `page` - Page number (default: 1)

#### DELETE `/api/locations/history`
**Query Parameters:**
- `before` - Delete records before this date (optional, deletes all if omitted)

#### GET `/api/locations/nearby`
**Query Parameters:**
- `longitude` (required) - Center longitude
- `latitude` (required) - Center latitude
- `radius` - Search radius in meters (default: 5000)
- `limit` - Max users to return (default: 20, max: 50)

#### POST `/api/locations/users`
**Request Body:**
```json
{
  "userIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]
}
```

---

### Alert Endpoints

Base path: `/api/alerts`

All routes require authentication.

| Method | Endpoint | Description | Auth Required | Admin |
|--------|----------|-------------|---------------|-------|
| `POST` | `/sos` | Trigger SOS emergency alert | Yes | No |
| `POST` | `/low-battery` | Trigger low battery alert | Yes | No |
| `POST` | `/geofence` | Trigger geofence alert | Yes | No |
| `GET` | `/me` | Get my alerts | Yes | No |
| `GET` | `/stats` | Get my alert statistics | Yes | No |
| `GET` | `/nearby` | Get nearby active alerts ⚠️ | Yes | No |
| `GET` | `/contacts` | Get alerts from my contacts | Yes | No |
| `GET` | `/admin/all` | Get all alerts (Admin) | Yes | Yes |
| `GET` | `/:id` | Get alert by ID | Yes | No |
| `PUT` | `/:id/resolve` | Resolve or cancel alert | Yes | No |

> ⚠️ `/nearby` endpoint is marked as not tested

#### POST `/api/alerts/sos`
**Request Body:**
```json
{
  "longitude": 77.5946,
  "latitude": 12.9716,
  "description": "Need immediate help!"
}
```

#### POST `/api/alerts/low-battery`
**Request Body:**
```json
{
  "longitude": 77.5946,
  "latitude": 12.9716,
  "batteryLevel": 5
}
```

Severity is auto-determined:
- ≤5% = critical
- ≤10% = high
- ≤15% = medium
- >15% = low

#### POST `/api/alerts/geofence`
**Request Body:**
```json
{
  "longitude": 77.5946,
  "latitude": 12.9716,
  "alertType": "enter_restricted_geofence|exit_safety_geofence",
  "geofenceId": "507f1f77bcf86cd799439011",
  "geofenceName": "Dangerous Area - River Bank"
}
```

#### GET `/api/alerts/me`
**Query Parameters:**
- `status` - Filter: `active`, `resolved`, `cancelled`
- `alertType` - Filter: `sos`, `low_battery`, `enter_restricted_geofence`, `exit_safety_geofence`
- `limit` - (default: 20)
- `page` - (default: 1)

#### PUT `/api/alerts/:id/resolve`
**Request Body:**
```json
{
  "status": "resolved|cancelled",
  "resolutionNotes": "Help arrived, situation resolved."
}
```

---

### Group Endpoints

Base path: `/api/groups`

All routes require authentication.

| Method | Endpoint | Description | Auth Required | Admin Only |
|--------|----------|-------------|---------------|------------|
| `POST` | `/` | Create a new group | Yes | No |
| `GET` | `/` | Get my groups | Yes | No |
| `POST` | `/join` | Join group using code | Yes | No |
| `GET` | `/:id` | Get group by ID | Yes | No |
| `PUT` | `/:id` | Update group details | Yes | Group Admin |
| `DELETE` | `/:id` | Delete group | Yes | Creator |
| `POST` | `/:id/leave` | Leave group | Yes | No |
| `POST` | `/:id/regenerate-code` | Regenerate join code | Yes | Group Admin |
| `GET` | `/:id/locations` | Get group members' locations | Yes | No |
| `DELETE` | `/:id/members/:userId` | Remove member | Yes | Group Admin |
| `PUT` | `/:id/members/:userId/role` | Update member role | Yes | Group Admin |

#### POST `/api/groups`
**Request Body:**
```json
{
  "name": "Family Trip to Goa",
  "description": "Our family vacation group",
  "groupPictureURL": "https://example.com/group-pic.jpg"
}
```

#### POST `/api/groups/join`
**Request Body:**
```json
{
  "joinCode": "ABC123"
}
```

#### PUT `/api/groups/:id`
**Request Body:**
```json
{
  "name": "Updated Group Name",
  "description": "Updated description",
  "groupPictureURL": "https://example.com/new-pic.jpg"
}
```

#### PUT `/api/groups/:id/members/:userId/role`
**Request Body:**
```json
{
  "role": "admin|member"
}
```

---

### Geofence Endpoints

Base path: `/api/geofences`

All routes require authentication. Create/Update/Delete require Admin role.

| Method | Endpoint | Description | Auth Required | Admin Only |
|--------|----------|-------------|---------------|------------|
| `POST` | `/` | Create a new geofence | Yes | Yes |
| `GET` | `/` | Get all geofences | Yes | No |
| `GET` | `/nearby` | Get nearby geofences | Yes | No |
| `POST` | `/check` | Check if point is inside geofences | Yes | No |
| `GET` | `/stats` | Get geofence statistics | Yes | Yes |
| `GET` | `/:id` | Get geofence by ID | Yes | No |
| `PUT` | `/:id` | Update geofence | Yes | Yes |
| `DELETE` | `/:id` | Delete geofence (soft delete) | Yes | Yes |

#### POST `/api/geofences`
**Request Body:**
```json
{
  "name": "Mumbai Airport Safety Zone",
  "description": "Safe zone around Mumbai International Airport",
  "location": {
    "coordinates": [72.8777, 19.0896]
  },
  "radius": 5000,
  "fenceType": "safety|restricted"
}
```

#### GET `/api/geofences`
**Query Parameters:**
- `fenceType` - Filter: `safety`, `restricted`
- `isActive` - Filter by active status
- `page` - (default: 1)
- `limit` - (default: 50)

#### GET `/api/geofences/nearby`
**Query Parameters:**
- `longitude` (required)
- `latitude` (required)
- `maxDistance` - Maximum distance in meters (default: 10000)
- `fenceType` - Filter: `safety`, `restricted`

#### POST `/api/geofences/check`
**Request Body:**
```json
{
  "longitude": 72.8777,
  "latitude": 19.0896
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isInsideSafetyZone": true,
    "isInsideRestrictedZone": false,
    "safetyZones": [...],
    "restrictedZones": [...]
  }
}
```

---

### Trip Endpoints

Base path: `/api/trips`

All routes require authentication.

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/` | Create a new trip | Yes |
| `GET` | `/` | Get my trips | Yes |
| `GET` | `/upcoming` | Get upcoming planned trips | Yes |
| `GET` | `/active` | Get currently active trip | Yes |
| `GET` | `/stats` | Get trip statistics | Yes |
| `GET` | `/:id` | Get trip by ID | Yes |
| `PUT` | `/:id` | Update trip | Yes |
| `DELETE` | `/:id` | Delete trip | Yes |
| `PUT` | `/:id/status` | Update trip status | Yes |
| `POST` | `/:id/start` | Start a planned trip | Yes |
| `POST` | `/:id/complete` | Complete an ongoing trip | Yes |
| `POST` | `/:id/cancel` | Cancel a trip | Yes |

#### POST `/api/trips`
**Request Body:**
```json
{
  "tripName": "Goa Beach Vacation",
  "startLocation": {
    "coordinates": [72.8777, 19.0896]
  },
  "endLocation": {
    "coordinates": [73.8278, 15.4909]
  },
  "startDate": "2026-02-01T10:00:00Z",
  "endDate": "2026-02-07T18:00:00Z"
}
```

#### GET `/api/trips`
**Query Parameters:**
- `status` - Filter: `planned`, `ongoing`, `completed`, `cancelled`
- `page` - (default: 1)
- `limit` - (default: 20)

#### PUT `/api/trips/:id/status`
**Request Body:**
```json
{
  "status": "planned|ongoing|completed|cancelled"
}
```

**Status Transitions:**
- `planned` → `ongoing` (use `/start`)
- `ongoing` → `completed` (use `/complete`)
- `planned`/`ongoing` → `cancelled` (use `/cancel`)

---

### Safety Score Endpoints

Base path: `/api/safety-scores`

All routes require authentication. Create/Update require Admin role.

| Method | Endpoint | Description | Auth Required | Admin Only |
|--------|----------|-------------|---------------|------------|
| `POST` | `/` | Create safety score entry | Yes | Yes |
| `GET` | `/` | Get all safety scores | Yes | No |
| `GET` | `/nearby` | Get nearby safety scores | Yes | No |
| `GET` | `/:id` | Get safety score by ID | Yes | No |
| `PUT` | `/:id` | Update safety score | Yes | Yes |

#### POST `/api/safety-scores`
**Request Body:**
```json
{
  "name": "Mumbai, Maharashtra",
  "location": {
    "coordinates": [72.8777, 19.0760]
  },
  "population": 12442373,
  "populationDensity": 20680,
  "crimeRate": 156.2,
  "safetyScore": 65,
  "safetyRank": 15,
  "riskLevel": "Low Risk|Moderate Risk|Medium Risk|High Risk|Extreme Risk"
}
```

#### GET `/api/safety-scores`
**Query Parameters:**
- `riskLevel` - Filter: `Low Risk`, `Moderate Risk`, `Medium Risk`, `High Risk`, `Extreme Risk`
- `minScore` - Minimum safety score
- `maxScore` - Maximum safety score
- `search` - Search by name
- `sortBy` - Field to sort by (default: `safetyScore`)
- `order` - `asc` or `desc` (default: `desc`)
- `page` - (default: 1)
- `limit` - (default: 50)

#### GET `/api/safety-scores/nearby`
**Query Parameters:**
- `longitude` (required)
- `latitude` (required)
- `maxDistance` - Maximum distance in meters (default: 50000)

---

## WebSocket API

The application uses Socket.IO for real-time communication with two namespaces.

### Connection URLs

- **User Namespace:** `ws://localhost:3000/user`
- **Admin Namespace:** `ws://localhost:3000/admin`

### Authentication

Both namespaces require Firebase token authentication. Pass the token in the connection:

```javascript
const socket = io('http://localhost:3000/user', {
  auth: {
    token: 'firebase_id_token'
  }
});
```

---

### User Namespace

Namespace: `/user`

#### Connection Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `connected` | Server → Client | Connection successful confirmation |
| `error` | Server → Client | Error notification |

#### Location Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `location:update` | Client → Server | Update user's location |
| `location:updated` | Server → Client | Location update confirmation |
| `location:broadcast` | Server → Client | Receive group member's location |
| `location:get-group` | Client → Server | Request group members' locations |
| `location:group-members` | Server → Client | Group members' locations response |
| `location:stop` | Client → Server | Stop sharing location |
| `location:stop-confirmed` | Server → Client | Stop sharing confirmation |
| `location:stopped` | Server → Client | Member stopped sharing (broadcast) |

##### `location:update` Payload
```json
{
  "latitude": 12.9716,
  "longitude": 77.5946,
  "altitude": 920,
  "speed": 5.5,
  "accuracy": 10,
  "heading": 45,
  "battery": 85
}
```

##### `location:get-group` Payload
```json
{
  "groupId": "507f1f77bcf86cd799439011"
}
```

#### SOS/Alert Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `sos:trigger` | Client → Server | Trigger SOS emergency |
| `sos:confirmed` | Server → Client | SOS trigger confirmation |
| `sos:alert` | Server → Client | Receive SOS from group member |
| `sos:emergency-contact` | Server → Client | SOS from emergency contact |
| `sos:cancel` | Client → Server | Cancel active SOS |
| `sos:cancelled` | Server → Client | SOS cancel confirmation |
| `sos:resolved` | Server → Client | SOS resolved notification |
| `alert:low-battery` | Client → Server | Send low battery alert |
| `alert:low-battery` | Server → Client | Receive low battery alert |
| `alert:resolved-by-admin` | Server → Client | Alert resolved by admin |

##### `sos:trigger` Payload
```json
{
  "latitude": 12.9716,
  "longitude": 77.5946,
  "message": "Emergency! Need help!"
}
```

##### `sos:cancel` Payload
```json
{
  "alertId": "507f1f77bcf86cd799439011",
  "reason": "False alarm, I'm okay"
}
```

##### `alert:low-battery` Payload
```json
{
  "latitude": 12.9716,
  "longitude": 77.5946,
  "battery": 5
}
```

#### Group Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `group:refresh` | Client → Server | Refresh group memberships |
| `group:refreshed` | Server → Client | Group refresh confirmation |
| `member:online` | Server → Client | Group member came online |
| `member:offline` | Server → Client | Group member went offline |

---

### Admin Namespace

Namespace: `/admin`

Requires admin role for authentication.

#### Connection Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `users:online` | Server → Client | List of currently online users |
| `user:online` | Server → Client | User came online |
| `user:offline` | Server → Client | User went offline |
| `user:location` | Server → Client | Real-time user location update |
| `user:location-stopped` | Server → Client | User stopped sharing location |

#### Admin Commands

| Event | Direction | Description |
|-------|-----------|-------------|
| `admin:get-all-locations` | Client → Server | Get all users' last locations |
| `admin:all-locations` | Server → Client | All users' locations response |
| `admin:get-user-location` | Client → Server | Get specific user's location history |
| `admin:user-location-history` | Server → Client | User's location history response |
| `admin:get-active-alerts` | Client → Server | Get all active alerts |
| `admin:active-alerts` | Server → Client | Active alerts response |
| `admin:resolve-alert` | Client → Server | Resolve an alert |
| `admin:alert-resolved` | Server → Client | Alert resolved confirmation |
| `admin:get-groups` | Client → Server | Get all groups |
| `admin:groups` | Server → Client | Groups response |
| `admin:get-group-locations` | Client → Server | Get group members' locations |
| `admin:group-locations` | Server → Client | Group locations response |
| `admin:subscribe-user` | Client → Server | Subscribe to user's updates |
| `admin:subscribed` | Server → Client | Subscription confirmation |
| `admin:unsubscribe-user` | Client → Server | Unsubscribe from user |
| `admin:unsubscribed` | Server → Client | Unsubscription confirmation |

##### `admin:get-user-location` Payload
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "limit": 50
}
```

##### `admin:resolve-alert` Payload
```json
{
  "alertId": "507f1f77bcf86cd799439011",
  "notes": "Situation resolved, help arrived"
}
```

##### `admin:get-group-locations` Payload
```json
{
  "groupId": "507f1f77bcf86cd799439011"
}
```

##### `admin:subscribe-user` / `admin:unsubscribe-user` Payload
```json
{
  "userId": "507f1f77bcf86cd799439011"
}
```

#### SOS Events (Admin)

| Event | Direction | Description |
|-------|-----------|-------------|
| `sos:emergency` | Server → Client | Receive SOS alert from any user |
| `sos:resolved` | Server → Client | SOS resolved notification |

---

## Additional Endpoints

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Server health check & stats |

**Response:**
```json
{
  "success": true,
  "message": "Yatra Suraksha Backend is running!",
  "timestamp": "2026-01-28T10:00:00Z",
  "endpoints": {
    "restApi": "/api-docs",
    "socketDocs": "/socket-docs",
    "userSocket": "ws://localhost:3000/user",
    "adminSocket": "ws://localhost:3000/admin"
  },
  "stats": {
    "onlineUsers": 0
  }
}
```

### Documentation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api-docs` | Swagger UI documentation |
| `GET` | `/api-docs.json` | Swagger JSON specification |
| `GET` | `/socket-docs` | Socket.IO documentation page |

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message (in development)"
}
```

### Common HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request - Invalid input |
| `401` | Unauthorized - Invalid or missing token |
| `403` | Forbidden - Insufficient permissions |
| `404` | Not Found |
| `500` | Internal Server Error |

---

## Rate Limiting

Currently no rate limiting is implemented. Consider implementing for production.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `CORS` | CORS origins (comma-separated or `*`) | `*` |
| `MONGODB_URI` | MongoDB connection string | - |
| `FIREBASE_*` | Firebase configuration | - |

---

*Generated on: January 28, 2026*
