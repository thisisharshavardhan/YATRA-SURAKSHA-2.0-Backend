# 🛡️ YATRA SURAKSHA 2.0
## Comprehensive Travel Safety Platform for India

---

# 📋 TABLE OF CONTENTS

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Key Features](#key-features)
4. [Technology Stack](#technology-stack)
5. [Data Models](#data-models)
6. [REST API Endpoints](#rest-api-endpoints)
7. [Real-Time WebSocket Events](#real-time-websocket-events)
8. [AI Voice Assistant](#ai-voice-assistant)
9. [Safety Score System](#safety-score-system)
10. [Security Features](#security-features)

---

# 🎯 SYSTEM OVERVIEW

**Yatra Suraksha** (यात्रा सुरक्षा - "Travel Safety") is a comprehensive safety platform designed specifically for tourists traveling in India. The platform provides real-time location tracking, emergency SOS alerts, AI-powered voice assistance, and safety scoring for 500+ Indian cities.

## Target Users

| User Type | Platform | Features |
|-----------|----------|----------|
| **Tourists/Travelers** | Mobile App (iOS/Android) | Location sharing, SOS alerts, Voice assistant, Trip planning |
| **Family/Friends** | Mobile App | Track loved ones, Receive alerts, Group coordination |
| **Administrators** | Web Dashboard | Monitor all users, Manage alerts, View analytics |

## Core Value Propositions

1. **🆘 Emergency SOS** - One-tap panic button with instant notifications
2. **📍 Real-time Location** - Live tracking with family/friends
3. **🎙️ AI Voice Assistant** - Multilingual help via Azure GPT-4o Realtime
4. **🏥 Nearby Facilities** - Find hospitals, police, pharmacies instantly
5. **📊 Safety Scores** - Risk assessment for 500+ Indian cities
6. **👥 Group Tracking** - Coordinate with travel companions
7. **🔒 Geofencing** - Safety/restricted zone alerts

---

# 🏗️ ARCHITECTURE

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              YATRA SURAKSHA 2.0                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────────────────────────┐
│  Mobile App  │     │ Admin Portal │     │    External Services             │
│  (Flutter)   │     │   (React)    │     │                                  │
│              │     │              │     │  ┌─────────────────────────────┐ │
│ • iOS        │     │ • Dashboard  │     │  │ Firebase Auth              │ │
│ • Android    │     │ • Analytics  │     │  │ Azure OpenAI GPT-4o        │ │
│              │     │ • Alerts     │     │  │ POI API (PostGIS)          │ │
└──────┬───────┘     └──────┬───────┘     │  │ Google Maps                │ │
       │                    │             │  └─────────────────────────────┘ │
       │   REST API + WebSocket           └──────────────────────────────────┘
       │                    │
       ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NODE.JS BACKEND SERVER                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Express.js REST API                           │   │
│  │  • Auth      • Users      • Groups     • Locations                   │   │
│  │  • Alerts    • Trips      • Geofences  • Safety Scores              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Socket.IO Real-time Engine                       │   │
│  │  • /user namespace (mobile users)                                    │   │
│  │  • /admin namespace (dashboard)                                      │   │
│  │  • Location broadcasting • SOS alerts • GPT Voice                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   GPT Realtime Voice Service                         │   │
│  │  • Azure WebSocket connection                                        │   │
│  │  • Function calling (hospitals, police, SOS)                         │   │
│  │  • Context-aware responses                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE LAYER                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         MongoDB Atlas                                │   │
│  │  • Users          • Alerts         • Geofences                       │   │
│  │  • Locations      • Groups         • Safety Scores                   │   │
│  │  • Trips          • Geospatial indexes (2dsphere)                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Communication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW DIAGRAM                                  │
└─────────────────────────────────────────────────────────────────────────────┘

1. AUTHENTICATION FLOW
   User → Firebase Auth → JWT Token → Backend Verification → MongoDB User

2. LOCATION UPDATE FLOW
   Mobile GPS → Socket.IO → Save to MongoDB → Broadcast to Groups → Admin Dashboard

3. SOS ALERT FLOW
   Panic Button → WebSocket → Create Alert → Notify Groups → Notify Admin → Push Notification

4. VOICE ASSISTANT FLOW
   User Voice → Socket.IO → Azure GPT-4o → Function Calls → Response Audio → User
```

---

# ✨ KEY FEATURES

## 1. 🆘 Emergency SOS System

| Feature | Description |
|---------|-------------|
| **One-Tap SOS** | Instant emergency alert with current location |
| **Auto-Notifications** | Alerts sent to emergency contacts, group members, and admins |
| **Google Maps Link** | Location shared as clickable map URL |
| **Alert Types** | SOS, Low Battery, Geofence Entry/Exit |
| **Severity Levels** | Low, Medium, High, Critical |
| **Resolution Tracking** | Cancel, Resolve with notes |

### SOS Notification Recipients:
```
SOS Triggered
     │
     ├──► Emergency Contacts (defined by user)
     │
     ├──► All Group Members (travel companions)
     │
     └──► Admin Dashboard (real-time alert)
```

## 2. 📍 Real-Time Location Tracking

| Feature | Description |
|---------|-------------|
| **Live Updates** | GPS coordinates via WebSocket |
| **Battery Monitoring** | Track device battery with alerts |
| **Speed & Heading** | Movement direction and velocity |
| **Location History** | Historical path with timestamps |
| **Group Sharing** | Share location with travel groups |
| **Accuracy Metrics** | GPS accuracy in meters |

### Location Data Captured:
- Latitude/Longitude (GeoJSON Point)
- Altitude (meters)
- Speed (m/s)
- Heading (0-360°)
- Accuracy (meters)
- Battery Level (%)
- Charging Status

## 3. 👥 Group Management

| Feature | Description |
|---------|-------------|
| **Create Groups** | For family trips, tours, etc. |
| **Join via Code** | 6-character unique join code |
| **Roles** | Admin (creator) and Members |
| **Live Member Locations** | See all group members on map |
| **Group Alerts** | Receive SOS from any member |

### Group Hierarchy:
```
Group (e.g., "Family Trip to Goa")
│
├── Admin (Creator)
│   └── Can: Remove members, Update group, Delete group
│
└── Members (Joined via code)
    └── Can: View locations, Send SOS, Leave group
```

## 4. 🎙️ AI Voice Assistant (GPT-4o Realtime)

| Feature | Description |
|---------|-------------|
| **Voice Interaction** | Real-time speech-to-speech |
| **Multilingual** | English, Hindi, Telugu, Tamil |
| **Context-Aware** | Knows user profile, health info, location |
| **Function Calling** | Can trigger actions (find hospitals, SOS) |
| **Personalized** | Uses user's name, health conditions |

### AI Capabilities (Tools/Functions):

| Function | Trigger Example |
|----------|-----------------|
| `get_nearby_hospitals` | "I'm having chest pain" |
| `get_nearby_police` | "I feel unsafe" |
| `get_nearby_pharmacies` | "I need medicine" |
| `get_safety_info` | "Is this area safe?" |
| `trigger_sos_alert` | "Send emergency alert!" |

### Voice Assistant Context:
```javascript
{
  user: {
    name: "John Doe",
    nationality: "American",
    gender: "male",
    healthInfo: {
      bloodGroup: "O+",
      allergies: ["Penicillin"],
      chronicDiseases: ["Diabetes"],
      medications: ["Metformin"]
    },
    emergencyContacts: [
      { name: "Jane Doe", relation: "Wife" }
    ]
  },
  currentLocation: {
    latitude: 12.9716,
    longitude: 77.5946,
    safetyScore: 85,
    riskLevel: "Low Risk"
  },
  activeTrips: [
    { name: "Bangalore Trip", status: "ongoing" }
  ]
}
```

## 5. 📊 Safety Score System

| Feature | Description |
|---------|-------------|
| **500+ Cities** | Pre-computed safety data for Indian cities |
| **Scoring (0-100)** | Based on crime rate, population density |
| **Risk Levels** | Low, Moderate, Medium, High, Extreme |
| **Geospatial Queries** | Find nearest city's safety score |

### Safety Score Data Fields:
```
- name: "Bangalore"
- population: 12,340,000
- populationDensity: 12,000/km²
- crimeRate: 450 per 100,000
- safetyScore: 78 (0-100)
- safetyRank: 45 (national ranking)
- riskLevel: "Moderate Risk"
```

### Risk Level Classification:
| Score Range | Risk Level |
|-------------|------------|
| 90-100 | Low Risk ✅ |
| 75-89 | Moderate Risk 🟡 |
| 50-74 | Medium Risk 🟠 |
| 25-49 | High Risk 🔴 |
| 0-24 | Extreme Risk ⛔ |

## 6. 🔒 Geofencing

| Feature | Description |
|---------|-------------|
| **Safety Zones** | Define safe areas (hotels, airports) |
| **Restricted Zones** | Mark dangerous areas |
| **Entry/Exit Alerts** | Automatic notifications |
| **Radius-Based** | Circular geofences (1m - 100km) |

### Geofence Types:
```
┌─────────────────────────────────────────────┐
│           SAFETY ZONE (Green)               │
│  • Alerts when user EXITS                   │
│  • e.g., Hotel area, Tourist spots          │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│         RESTRICTED ZONE (Red)               │
│  • Alerts when user ENTERS                  │
│  • e.g., High-crime areas, Unsafe zones     │
└─────────────────────────────────────────────┘
```

## 7. 🗺️ Trip Planning

| Feature | Description |
|---------|-------------|
| **Create Itineraries** | Start/End locations and dates |
| **Status Tracking** | Planned → Ongoing → Completed |
| **Active Trip Context** | Used by AI assistant |

### Trip States:
```
Planned ──► Ongoing ──► Completed
                │
                └──► Cancelled
```

---

# 💻 TECHNOLOGY STACK

## Backend

| Technology | Purpose |
|------------|---------|
| **Node.js** | Runtime environment |
| **Express.js 5** | REST API framework |
| **Socket.IO 4** | Real-time WebSocket |
| **MongoDB** | NoSQL database |
| **Mongoose** | ODM with geospatial support |
| **Firebase Admin** | Authentication |
| **WebSocket (ws)** | Azure GPT connection |

## External Services

| Service | Purpose |
|---------|---------|
| **Firebase Auth** | User authentication |
| **Azure OpenAI GPT-4o Realtime** | AI voice assistant |
| **POI API (PostGIS)** | Nearby places (hospitals, police) |
| **MongoDB Atlas** | Cloud database |

## Development Tools

| Tool | Purpose |
|------|---------|
| **Swagger UI** | API documentation |
| **dotenv** | Environment variables |
| **nodemon** | Hot reloading |

---

# 📊 DATA MODELS

## 1. User Model

```javascript
{
  firebaseUID: "abc123",           // Firebase Auth ID
  name: "John Doe",                // Full name
  email: "john@example.com",       // Unique email
  phoneNumber: "+919876543210",    // Primary phone
  whatsappNumber: "+919876543210", // WhatsApp
  profilePicture: "https://...",   // Avatar URL
  dateOfBirth: "1990-01-15",
  gender: "male",                  // male/female/other
  nationality: "American",
  role: "user",                    // user/admin
  isVerified: true,
  
  emergencyContacts: [
    {
      name: "Jane Doe",
      relation: "Wife",
      phoneNumber: "+919876543211"
    }
  ],
  
  healthInfo: {
    bloodGroup: "O+",
    allergies: ["Penicillin", "Peanuts"],
    chronicDiseases: ["Diabetes"],
    medications: ["Metformin 500mg"]
  },
  
  permissions: {
    locationSharing: true,
    pushNotifications: true
  }
}
```

## 2. Location Model

```javascript
{
  userID: ObjectId,
  location: {
    type: "Point",
    coordinates: [77.5946, 12.9716]  // [longitude, latitude]
  },
  altitude: 920,           // meters
  speed: 5.5,              // m/s
  heading: 180,            // degrees
  accuracy: 10,            // meters
  batteryLevel: 85,        // percentage
  isCharging: false,
  timestamp: ISODate()
}
```

## 3. Alert Model

```javascript
{
  userID: ObjectId,
  location: {
    type: "Point",
    coordinates: [77.5946, 12.9716]
  },
  alertType: "sos",        // sos/low_battery/enter_restricted_geofence/exit_safety_geofence
  severity: "critical",    // low/medium/high/critical
  status: "active",        // active/resolved/cancelled
  description: "Emergency SOS triggered",
  geofenceId: ObjectId,    // (optional) for geofence alerts
  resolvedAt: ISODate(),
  resolutionNotes: "User confirmed safe"
}
```

## 4. Group Model

```javascript
{
  name: "Family Trip to Goa",
  description: "Summer vacation 2026",
  groupPictureURL: "https://...",
  createdBy: ObjectId,
  joinCode: "FAM123",      // Unique 6-char code
  isActive: true,
  members: [
    {
      userID: ObjectId,
      role: "admin",       // admin/member
      joinedAt: ISODate()
    }
  ]
}
```

## 5. Geofence Model

```javascript
{
  name: "Mumbai Airport Safety Zone",
  description: "Safe zone around airport",
  location: {
    type: "Point",
    coordinates: [72.8777, 19.0896]
  },
  radius: 5000,            // meters (5km)
  fenceType: "safety",     // safety/restricted
  isActive: true
}
```

## 6. Trip Itinerary Model

```javascript
{
  userID: ObjectId,
  tripName: "Goa Beach Vacation",
  startLocation: {
    type: "Point",
    coordinates: [72.8777, 19.0896]  // Mumbai
  },
  endLocation: {
    type: "Point",
    coordinates: [73.8278, 15.4909]  // Goa
  },
  startDate: ISODate("2026-02-01"),
  endDate: ISODate("2026-02-07"),
  status: "planned"        // planned/ongoing/completed/cancelled
}
```

## 7. Safety Score Model

```javascript
{
  name: "Bangalore",
  location: {
    type: "Point",
    coordinates: [77.5946, 12.9716]
  },
  population: 12340000,
  populationDensity: 12000,  // per km²
  crimeRate: 450,            // per 100,000
  safetyScore: 78,           // 0-100
  safetyRank: 45,            // national rank
  riskLevel: "Moderate Risk" // Low/Moderate/Medium/High/Extreme
}
```

---

# 🌐 REST API ENDPOINTS

## Authentication (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/login` | Login/Register with Firebase token |
| GET | `/check` | Check if user exists |
| GET | `/me` | Get current user |
| POST | `/logout` | Logout user |
| DELETE | `/account` | Delete account |

## Users (`/api/users`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/profile` | Get user profile |
| PUT | `/profile` | Update profile |
| PUT | `/emergency-contacts` | Update emergency contacts |
| PUT | `/health-info` | Update health information |
| PUT | `/permissions` | Update privacy settings |
| GET | `/:id` | Get user by ID |
| GET | `/search` | Search users |

## Locations (`/api/locations`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Update current location |
| POST | `/batch` | Batch update locations |
| GET | `/me` | Get my last location |
| GET | `/me/history` | Get my location history |
| GET | `/user/:id` | Get specific user's location |
| GET | `/users` | Get multiple users' locations |
| GET | `/nearby` | Find nearby users |
| DELETE | `/history` | Delete location history |

## Groups (`/api/groups`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create group |
| GET | `/` | Get my groups |
| GET | `/:id` | Get group by ID |
| PUT | `/:id` | Update group |
| POST | `/join` | Join group via code |
| POST | `/:id/leave` | Leave group |
| DELETE | `/:id/members/:userId` | Remove member |
| PUT | `/:id/members/:userId/role` | Update member role |
| POST | `/:id/regenerate-code` | Regenerate join code |
| GET | `/:id/locations` | Get members' locations |
| DELETE | `/:id` | Delete group |

## Alerts (`/api/alerts`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/sos` | Trigger SOS alert |
| POST | `/low-battery` | Trigger low battery alert |
| POST | `/geofence` | Trigger geofence alert |
| GET | `/` | Get my alerts |
| GET | `/all` | Get all alerts (Admin) |
| GET | `/:id` | Get alert by ID |
| PUT | `/:id/resolve` | Resolve alert |
| GET | `/nearby` | Get nearby alerts |
| GET | `/contacts` | Get contacts' alerts |
| GET | `/stats` | Get alert statistics |

## Geofences (`/api/geofences`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create geofence (Admin) |
| GET | `/` | Get all geofences |
| GET | `/:id` | Get geofence by ID |
| PUT | `/:id` | Update geofence (Admin) |
| DELETE | `/:id` | Delete geofence (Admin) |
| GET | `/nearby` | Get nearby geofences |
| POST | `/check` | Check if in geofence |
| GET | `/stats` | Get geofence statistics |

## Trips (`/api/trips`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create trip |
| GET | `/` | Get my trips |
| GET | `/upcoming` | Get upcoming trips |
| GET | `/active` | Get active trip |
| GET | `/stats` | Get trip statistics |
| GET | `/:id` | Get trip by ID |
| PUT | `/:id` | Update trip |
| PUT | `/:id/status` | Update trip status |
| POST | `/:id/start` | Start trip |
| POST | `/:id/complete` | Complete trip |
| POST | `/:id/cancel` | Cancel trip |
| DELETE | `/:id` | Delete trip |

## Safety Scores (`/api/safety-scores`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create safety score (Admin) |
| GET | `/` | Get all safety scores |
| GET | `/nearby` | Get nearby safety score |
| GET | `/:id` | Get by ID |
| PUT | `/:id` | Update safety score (Admin) |

---

# 🔌 REAL-TIME WEBSOCKET EVENTS

## Namespaces

| Namespace | URL | Purpose |
|-----------|-----|---------|
| `/user` | `ws://server:3000/user` | Mobile app users |
| `/admin` | `ws://server:3000/admin` | Admin dashboard |

## User Namespace Events

### Location Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `location:update` | C→S | Update user location |
| `location:updated` | S→C | Location update confirmed |
| `location:broadcast` | S→C | Member location to group |
| `location:get-group` | C→S | Get group members' locations |
| `location:group-members` | S→C | Group members' locations |
| `location:stop` | C→S | Stop sharing location |

### SOS Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `sos:trigger` | C→S | Trigger SOS |
| `sos:confirmed` | S→C | SOS confirmed |
| `sos:alert` | S→C | SOS to group members |
| `sos:emergency-contact` | S→C | SOS to contacts |
| `sos:cancel` | C→S | Cancel SOS |
| `sos:resolved` | S→C | SOS resolved |
| `alert:low-battery` | C→S | Low battery alert |

### GPT Voice Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `gpt:connect` | C→S | Connect to AI |
| `gpt:audio` | C→S | Send audio chunk |
| `gpt:audio-commit` | C→S | End of speech |
| `gpt:text` | C→S | Send text message |
| `gpt:audio-delta` | S→C | AI audio response |
| `gpt:transcript-done` | S→C | AI text response |
| `gpt:function-calling` | S→C | AI calling tool |
| `gpt:disconnect` | C→S | Disconnect from AI |

## Admin Namespace Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `users:online` | S→C | All users list (online + offline) |
| `user:online` | S→C | User came online |
| `user:offline` | S→C | User went offline |
| `user:location` | S→C | Real-time location update |
| `sos:emergency` | S→C | SOS alert broadcast |
| `admin:get-all-locations` | C→S | Request all locations |
| `admin:all-locations` | S→C | All users' locations |
| `admin:get-active-alerts` | C→S | Request active alerts |
| `admin:active-alerts` | S→C | Active alerts list |
| `admin:resolve-alert` | C→S | Resolve an alert |

---

# 🎙️ AI VOICE ASSISTANT

## Azure OpenAI GPT-4o Realtime Integration

### Architecture
```
┌────────────────────────────────────────────────────────────────────────┐
│                    GPT REALTIME VOICE FLOW                              │
└────────────────────────────────────────────────────────────────────────┘

┌─────────┐      ┌──────────┐      ┌──────────────┐      ┌──────────────┐
│  User   │ ───► │ Socket.IO│ ───► │ GPT Service  │ ───► │ Azure GPT-4o │
│  Voice  │      │  Server  │      │ (WebSocket)  │      │  Realtime    │
└─────────┘      └──────────┘      └──────────────┘      └──────────────┘
     ▲                                    │
     │                                    │
     │           ┌──────────────┐         │
     │           │ Function     │ ◄───────┘
     │           │ Execution    │
     │           │              │
     │           │ • Hospitals  │
     │           │ • Police     │
     │           │ • Safety     │
     │           │ • SOS        │
     │           └──────────────┘
     │                 │
     └─────────────────┘
        Audio Response
```

### Function Calling Tools

| Tool | Trigger | Action |
|------|---------|--------|
| `get_nearby_hospitals` | Health issues, pain, injury | Fetches nearby hospitals from POI API |
| `get_nearby_police` | Safety concerns, crime | Fetches nearby police stations |
| `get_nearby_pharmacies` | Need medicine | Fetches nearby pharmacies |
| `get_safety_info` | "Is this area safe?" | Returns location safety score |
| `trigger_sos_alert` | Emergency request | Creates SOS alert |

### Context Provided to AI

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      AI CONTEXT WINDOW                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  USER PROFILE                                                            │
│  • Name, Gender, Nationality                                            │
│  • Health Info (blood group, allergies, medications)                    │
│  • Emergency Contacts (names only)                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  CURRENT LOCATION                                                        │
│  • Coordinates                                                          │
│  • Safety Score                                                         │
│  • Risk Level                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│  ACTIVE TRIPS                                                            │
│  • Trip names and dates                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  RECENT ALERTS                                                           │
│  • Previous SOS alerts                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  EMERGENCY NUMBERS                                                       │
│  • 112 (National), 100 (Police), 108 (Ambulance), 101 (Fire)           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Personality & Voice Style
- Warm, caring, like a helpful local friend
- Supports: English, Hindi, Telugu, Tamil
- Empathetic responses based on situation
- Quick, action-oriented for emergencies

---

# 📊 SAFETY SCORE SYSTEM

## Data Source

**500+ Indian cities** with safety metrics pre-computed from:
- Population data
- Crime statistics
- Population density

## Sample Data (Top 10 Safest Cities)

| Rank | City | State | Safety Score | Risk Level |
|------|------|-------|--------------|------------|
| 1 | Gangtok | Sikkim | 99.87 | Low Risk |
| 2 | Dimapur | Nagaland | 99.76 | Low Risk |
| 3 | Shillong | Meghalaya | 99.31 | Low Risk |
| 4 | Chandigarh | Chandigarh | 99.30 | Low Risk |
| 5 | Imphal | Manipur | 99.28 | Low Risk |
| 6 | Puducherry | Puducherry | 99.23 | Low Risk |
| 8 | Aizawl | Mizoram | 99.15 | Low Risk |
| 9 | Agartala | Tripura | 99.14 | Low Risk |
| 10 | Shimla | Himachal Pradesh | 96.87 | Low Risk |

## Geospatial Queries

```javascript
// Find nearest city safety score within 50km
SafetyScore.findOne({
  location: {
    $nearSphere: {
      $geometry: { type: "Point", coordinates: [lng, lat] },
      $maxDistance: 50000  // 50km
    }
  }
})
```

---

# 🔐 SECURITY FEATURES

## Authentication

| Layer | Implementation |
|-------|----------------|
| **Auth Provider** | Firebase Authentication |
| **Token Type** | Firebase ID Token (JWT) |
| **Verification** | Server-side verification via Firebase Admin SDK |
| **Session** | Stateless (token-based) |

## Authorization

| Role | Permissions |
|------|-------------|
| **User** | CRUD own data, Join/Leave groups, Trigger alerts |
| **Admin** | All user permissions + Manage geofences, View all alerts, View all users |

## Data Protection

| Feature | Implementation |
|---------|----------------|
| **HTTPS** | TLS encryption in transit |
| **CORS** | Configurable allowed origins |
| **Input Validation** | Mongoose schema validation |
| **Geospatial Indexes** | Efficient location queries |

---

# 📱 API DOCUMENTATION

## Swagger UI
- **URL:** `http://localhost:3000/api-docs`
- Full interactive API documentation

## Socket.IO Documentation
- **URL:** `http://localhost:3000/socket-docs`
- Real-time event testing interface

---

# 🚀 DEPLOYMENT

## Environment Variables

```env
# Server
PORT=3000
CORS=*

# Database
MONGODB_URI=mongodb+srv://...

# Firebase
FIREBASE_SERVICE_ACCOUNT=./config/firebase-admin.json

# Azure OpenAI
AZURE_OPENAI_REALTIME_ENDPOINT=wss://...
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT=gpt-realtime
AZURE_OPENAI_API_VERSION=2024-10-01-preview

# POI API
POI_API_URL=http://localhost:8000
```

## Running the Server

```bash
# Development
npm run dev

# Production
npm start
```

---

# 📈 FUTURE ENHANCEMENTS

1. **Push Notifications** - FCM integration for alerts
2. **Offline Mode** - Queue location updates when offline
3. **Route Safety** - Safety scores along travel routes
4. **Video SOS** - Live video streaming during emergencies
5. **Multi-language Voice** - Regional language support
6. **Wearable Integration** - Smartwatch SOS trigger
7. **AI Trip Planning** - GPT-powered itinerary suggestions

---

# 📞 EMERGENCY NUMBERS (INDIA)

| Service | Number |
|---------|--------|
| National Emergency | **112** |
| Police | 100 |
| Ambulance | 102 / 108 |
| Fire | 101 |
| Women Helpline | 1091 / 181 |
| Tourist Police | 1363 |
| Road Accident | 1073 |

---

*Yatra Suraksha - Ensuring Safe Travels Across India* 🇮🇳

*Last Updated: January 30, 2026*
