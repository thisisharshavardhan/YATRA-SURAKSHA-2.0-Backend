# Yatra Suraksha - WebSocket API Documentation (Frontend Guide)

## 📋 Table of Contents

- [Overview](#overview)
- [Connection Setup](#connection-setup)
- [Authentication](#authentication)
- [Namespaces](#namespaces)
- [Admin Namespace Events](#admin-namespace-events)
  - [Safety Score Events](#safety-score-events)
  - [Geofence Events](#geofence-events)
  - [Location Monitoring Events](#location-monitoring-events)
  - [Alert Management Events](#alert-management-events)
  - [Video Management Events](#video-management-events)
  - [Group Management Events](#group-management-events)
- [User Namespace Events](#user-namespace-events)
  - [Location Events](#location-events)
  - [SOS Events](#sos-events)
- [Error Handling](#error-handling)
- [Code Examples](#code-examples)

---

## Overview

Yatra Suraksha uses **Socket.IO** for real-time bidirectional communication. The WebSocket server runs alongside the REST API on the same port.

| Property | Value |
|----------|-------|
| **WebSocket Library** | Socket.IO 4.x |
| **Base URL** | `ws://localhost:3000` or `wss://your-domain.com` |
| **Protocol** | WebSocket with Socket.IO protocol |
| **Reconnection** | Automatic (enabled by default) |

---

## Connection Setup

### Installation

```bash
# npm
npm install socket.io-client

# yarn
yarn add socket.io-client
```

### Basic Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/admin', {
  transports: ['websocket'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});
```

---

## Authentication

### Admin Namespace (`/admin`)
**No authentication required.** Simply connect to the namespace.

```javascript
const adminSocket = io('http://localhost:3000/admin');
```

### User Namespace (`/user`)
**Firebase Authentication required.** Pass the Firebase ID token in auth.

```javascript
const userSocket = io('http://localhost:3000/user', {
  auth: {
    token: 'firebase-id-token-here'
  }
});
```

---

## Namespaces

| Namespace | Path | Auth Required | Purpose |
|-----------|------|---------------|---------|
| **Admin** | `/admin` | ❌ No | Admin dashboard, monitoring, CRUD operations |
| **User** | `/user` | ✅ Yes (Firebase) | Mobile app, location updates, SOS |

---

## Admin Namespace Events

### Safety Score Events

#### 1. Get All Safety Scores

**Emit Event:** `admin:get-all-safety-scores`

**Payload:**
```javascript
{
  page: 1,                    // Optional (default: 1)
  limit: 50,                  // Optional (default: 50, max: 500)
  riskLevel: 'High Risk',     // Optional - 'Low Risk', 'Moderate Risk', 'Medium Risk', 'High Risk', 'Extreme Risk'
  sortBy: 'safetyScore',      // Optional - 'safetyScore', 'name', 'crimeRate', 'population'
  order: 'desc',              // Optional - 'asc' or 'desc'
  search: 'Mumbai'            // Optional - search by name
}
```

**Response Event:** `admin:all-safety-scores`

**Response:**
```javascript
{
  scores: [
    {
      id: '507f1f77bcf86cd799439011',
      name: 'Mumbai Central',
      latitude: 19.076,
      longitude: 72.8777,
      population: 12500000,
      populationDensity: 29650,
      crimeRate: 245.5,
      safetyScore: 68,
      safetyRank: 15,
      riskLevel: 'Medium Risk',
      lastUpdated: '2024-01-15T10:30:00.000Z',
      createdAt: '2024-01-01T00:00:00.000Z'
    }
    // ... more scores
  ],
  pagination: {
    page: 1,
    limit: 50,
    total: 150,
    pages: 3
  },
  filters: {
    riskLevel: 'High Risk',
    search: 'Mumbai'
  }
}
```

---

#### 2. Get Single Safety Score

**Emit Event:** `admin:get-safety-score`

**Payload:**
```javascript
{
  scoreId: '507f1f77bcf86cd799439011'  // Required
}
```

**Response Event:** `admin:safety-score-details`

**Response:**
```javascript
{
  id: '507f1f77bcf86cd799439011',
  name: 'Mumbai Central',
  latitude: 19.076,
  longitude: 72.8777,
  population: 12500000,
  populationDensity: 29650,
  crimeRate: 245.5,
  safetyScore: 68,
  safetyRank: 15,
  riskLevel: 'Medium Risk',
  lastUpdated: '2024-01-15T10:30:00.000Z',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-15T10:30:00.000Z'
}
```

---

#### 3. Get Nearby Safety Scores

**Emit Event:** `admin:get-nearby-safety-scores`

**Payload:**
```javascript
{
  latitude: 19.076,      // Required
  longitude: 72.8777,    // Required
  radiusKm: 50           // Optional (default: 50, max: 500)
}
```

**Response Event:** `admin:nearby-safety-scores`

**Response:**
```javascript
{
  center: {
    latitude: 19.076,
    longitude: 72.8777
  },
  radiusKm: 50,
  count: 12,
  scores: [
    {
      id: '507f1f77bcf86cd799439011',
      name: 'Mumbai Central',
      latitude: 19.076,
      longitude: 72.8777,
      safetyScore: 68,
      riskLevel: 'Medium Risk',
      crimeRate: 245.5
    }
    // ... more scores sorted by distance
  ]
}
```

---

#### 4. Get Safety Statistics

**Emit Event:** `admin:get-safety-stats`

**Payload:** `{}` (empty object or no payload)

**Response Event:** `admin:safety-stats`

**Response:**
```javascript
{
  totalLocations: 150,
  summary: {
    avgSafetyScore: 62.5,
    avgCrimeRate: 198.75,
    maxSafetyScore: 95,
    minSafetyScore: 12,
    totalPopulation: 485000000
  },
  byRiskLevel: {
    'Low Risk': {
      count: 25,
      avgScore: 85.2,
      avgCrimeRate: 45.3
    },
    'Moderate Risk': {
      count: 35,
      avgScore: 72.1,
      avgCrimeRate: 98.7
    },
    'Medium Risk': {
      count: 40,
      avgScore: 55.8,
      avgCrimeRate: 178.4
    },
    'High Risk': {
      count: 30,
      avgScore: 38.2,
      avgCrimeRate: 312.5
    },
    'Extreme Risk': {
      count: 20,
      avgScore: 18.5,
      avgCrimeRate: 458.9
    }
  }
}
```

---

### Geofence Events

#### 1. Get All Geofences

**Emit Event:** `admin:get-all-geofences`

**Payload:**
```javascript
{
  page: 1,                    // Optional (default: 1)
  limit: 50,                  // Optional (default: 50, max: 100)
  fenceType: 'safety',        // Optional - 'safety' or 'restricted'
  isActive: true,             // Optional - filter by active status
  search: 'Airport'           // Optional - search by name
}
```

**Response Event:** `admin:all-geofences`

**Response:**
```javascript
{
  geofences: [
    {
      id: '507f1f77bcf86cd799439012',
      name: 'Airport Safety Zone',
      description: 'Safe zone around international airport',
      latitude: 19.0896,
      longitude: 72.8656,
      radius: 5000,
      fenceType: 'safety',
      isActive: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-15T10:30:00.000Z'
    }
    // ... more geofences
  ],
  pagination: {
    page: 1,
    limit: 50,
    total: 25,
    pages: 1
  },
  filters: {
    fenceType: 'safety',
    isActive: true,
    search: 'Airport'
  }
}
```

---

#### 2. Get Single Geofence

**Emit Event:** `admin:get-geofence`

**Payload:**
```javascript
{
  geofenceId: '507f1f77bcf86cd799439012'  // Required
}
```

**Response Event:** `admin:geofence-details`

**Response:**
```javascript
{
  id: '507f1f77bcf86cd799439012',
  name: 'Airport Safety Zone',
  description: 'Safe zone around international airport',
  latitude: 19.0896,
  longitude: 72.8656,
  radius: 5000,
  fenceType: 'safety',
  isActive: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-15T10:30:00.000Z'
}
```

---

#### 3. Create Geofence

**Emit Event:** `admin:create-geofence`

**Payload:**
```javascript
{
  name: 'New Safety Zone',           // Required (max 100 chars)
  description: 'A safe area',        // Optional (max 500 chars)
  latitude: 19.076,                  // Required
  longitude: 72.8777,                // Required
  radius: 1000,                      // Required (1-100000 meters)
  fenceType: 'safety',               // Required - 'safety' or 'restricted'
  isActive: true                     // Optional (default: true)
}
```

**Response Event:** `admin:geofence-created` (broadcast to all admin sockets)

**Response:**
```javascript
{
  id: '507f1f77bcf86cd799439013',
  name: 'New Safety Zone',
  description: 'A safe area',
  latitude: 19.076,
  longitude: 72.8777,
  radius: 1000,
  fenceType: 'safety',
  isActive: true,
  createdAt: '2024-01-20T15:30:00.000Z'
}
```

---

#### 4. Update Geofence

**Emit Event:** `admin:update-geofence`

**Payload:**
```javascript
{
  geofenceId: '507f1f77bcf86cd799439013',  // Required
  name: 'Updated Zone Name',               // Optional
  description: 'Updated description',      // Optional
  latitude: 19.080,                        // Optional (both lat/lng required if updating location)
  longitude: 72.880,                       // Optional
  radius: 1500,                            // Optional (1-100000 meters)
  fenceType: 'restricted',                 // Optional
  isActive: false                          // Optional
}
```

**Response Event:** `admin:geofence-updated` (broadcast to all admin sockets)

**Response:**
```javascript
{
  id: '507f1f77bcf86cd799439013',
  name: 'Updated Zone Name',
  description: 'Updated description',
  latitude: 19.080,
  longitude: 72.880,
  radius: 1500,
  fenceType: 'restricted',
  isActive: false,
  createdAt: '2024-01-20T15:30:00.000Z',
  updatedAt: '2024-01-20T16:45:00.000Z'
}
```

---

#### 5. Delete Geofence

**Emit Event:** `admin:delete-geofence`

**Payload:**
```javascript
{
  geofenceId: '507f1f77bcf86cd799439013'  // Required
}
```

**Response Event:** `admin:geofence-deleted` (broadcast to all admin sockets)

**Response:**
```javascript
{
  geofenceId: '507f1f77bcf86cd799439013',
  name: 'Deleted Zone Name',
  deletedBy: 'Admin'
}
```

---

#### 6. Toggle Geofence Active Status

**Emit Event:** `admin:toggle-geofence`

**Payload:**
```javascript
{
  geofenceId: '507f1f77bcf86cd799439013'  // Required
}
```

**Response Event:** `admin:geofence-toggled` (broadcast to all admin sockets)

**Response:**
```javascript
{
  geofenceId: '507f1f77bcf86cd799439013',
  name: 'Zone Name',
  isActive: true,  // The new status after toggle
  toggledBy: 'Admin'
}
```

---

#### 7. Get Geofences at Location

**Emit Event:** `admin:get-geofences-at-location`

**Payload:**
```javascript
{
  latitude: 19.076,      // Required
  longitude: 72.8777     // Required
}
```

**Response Event:** `admin:geofences-at-location`

**Response:**
```javascript
{
  point: {
    latitude: 19.076,
    longitude: 72.8777
  },
  count: 2,
  geofences: [
    {
      id: '507f1f77bcf86cd799439012',
      name: 'Airport Safety Zone',
      fenceType: 'safety',
      radius: 5000,
      latitude: 19.0896,
      longitude: 72.8656
    }
    // ... more geofences containing this point
  ]
}
```

---

#### 8. Get Geofence Statistics

**Emit Event:** `admin:get-geofence-stats`

**Payload:** `{}` (empty object or no payload)

**Response Event:** `admin:geofence-stats`

**Response:**
```javascript
{
  total: 25,
  active: 20,
  inactive: 5,
  byType: {
    safety: 15,
    restricted: 10
  },
  radiusStats: {
    avg: 2500,
    max: 10000,
    min: 100
  }
}
```

---

### Location Monitoring Events

#### 1. Get All User Locations

**Emit Event:** `admin:get-user-locations`

**Payload:**
```javascript
{
  page: 1,              // Optional (default: 1)
  limit: 50,            // Optional (default: 50)
  activeOnly: true      // Optional - only users active in last 5 min
}
```

**Response Event:** `admin:user-locations`

**Response:**
```javascript
{
  locations: [
    {
      id: '507f1f77bcf86cd799439014',
      userId: '507f1f77bcf86cd799439001',
      userName: 'John Doe',
      latitude: 19.076,
      longitude: 72.8777,
      accuracy: 10,
      speed: 5.5,
      heading: 180,
      altitude: 15,
      timestamp: '2024-01-20T16:45:00.000Z',
      isActive: true
    }
  ],
  pagination: {
    page: 1,
    limit: 50,
    total: 120
  }
}
```

---

#### 2. Subscribe to User Location Updates

**Emit Event:** `admin:subscribe-user-location`

**Payload:**
```javascript
{
  userId: '507f1f77bcf86cd799439001'  // Required
}
```

**Response Event:** `admin:user-location-update` (real-time updates)

**Response:**
```javascript
{
  userId: '507f1f77bcf86cd799439001',
  userName: 'John Doe',
  latitude: 19.0765,
  longitude: 72.8780,
  accuracy: 8,
  speed: 12.5,
  heading: 90,
  timestamp: '2024-01-20T16:46:00.000Z'
}
```

---

### Alert Management Events

#### 1. Get All Alerts

**Emit Event:** `admin:get-all-alerts`

**Payload:**
```javascript
{
  page: 1,
  limit: 20,
  status: 'pending',    // Optional - 'pending', 'resolved', 'dismissed'
  alertType: 'sos'      // Optional
}
```

**Response Event:** `admin:all-alerts`

---

#### 2. Update Alert Status

**Emit Event:** `admin:update-alert-status`

**Payload:**
```javascript
{
  alertId: '507f1f77bcf86cd799439015',
  status: 'resolved',    // 'pending', 'resolved', 'dismissed'
  notes: 'Issue resolved by support team'
}
```

**Response Event:** `admin:alert-updated` (broadcast)

---

### Video Management Events

#### 1. Get All Videos

**Emit Event:** `admin:get-all-videos`

**Payload:**
```javascript
{
  page: 1,
  limit: 20,
  userId: '507f1f77bcf86cd799439001'  // Optional - filter by user
}
```

**Response Event:** `admin:all-videos`

---

#### 2. Delete Video

**Emit Event:** `admin:delete-video`

**Payload:**
```javascript
{
  videoId: '507f1f77bcf86cd799439016'
}
```

**Response Event:** `admin:video-deleted` (broadcast)

---

#### 3. Cleanup Orphaned Videos

**Emit Event:** `admin:cleanup-orphaned-videos`

**Payload:**
```javascript
{
  dryRun: true  // Optional (default: true) - set false to actually delete
}
```

**Response Event:** `admin:orphaned-videos-cleaned`

---

### Group Management Events

#### 1. Get All Groups

**Emit Event:** `admin:get-all-groups`

**Payload:**
```javascript
{
  page: 1,
  limit: 20
}
```

**Response Event:** `admin:all-groups`

---

## User Namespace Events

> ⚠️ **Authentication Required**: All events in the `/user` namespace require a valid Firebase token.

### Location Events

#### 1. Update Location

**Emit Event:** `location:update`

**Payload:**
```javascript
{
  latitude: 19.076,
  longitude: 72.8777,
  accuracy: 10,
  speed: 5.5,
  heading: 180,
  altitude: 15
}
```

**Response Event:** `location:updated`

---

#### 2. Get Own Location History

**Emit Event:** `location:get-history`

**Payload:**
```javascript
{
  startDate: '2024-01-01T00:00:00.000Z',
  endDate: '2024-01-20T23:59:59.000Z',
  limit: 100
}
```

**Response Event:** `location:history`

---

### SOS Events

#### 1. Trigger SOS Alert

**Emit Event:** `sos:trigger`

**Payload:**
```javascript
{
  latitude: 19.076,
  longitude: 72.8777,
  message: 'Emergency! Need help!',
  alertType: 'emergency'  // Optional
}
```

**Response Event:** `sos:triggered`

---

#### 2. Cancel SOS Alert

**Emit Event:** `sos:cancel`

**Payload:**
```javascript
{
  alertId: '507f1f77bcf86cd799439017'
}
```

**Response Event:** `sos:cancelled`

---

## Error Handling

All errors are emitted to the `error` event:

```javascript
socket.on('error', (error) => {
  console.error('Error:', error);
  // error = {
  //   event: 'admin:create-geofence',  // The event that caused the error
  //   message: 'name is required'       // Error description
  // }
});
```

### Common Error Messages

| Event | Error Message |
|-------|---------------|
| `admin:get-safety-score` | "Valid scoreId is required" |
| `admin:get-geofence` | "Valid geofenceId is required" |
| `admin:create-geofence` | "name, latitude, longitude, radius, and fenceType are required" |
| `admin:create-geofence` | "fenceType must be 'safety' or 'restricted'" |
| `admin:create-geofence` | "radius must be between 1 and 100000 meters" |
| `admin:delete-geofence` | "Geofence not found" |

---

## Code Examples

### React.js Admin Dashboard

```jsx
import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3000/admin';

export function useAdminSocket() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [safetyScores, setSafetyScores] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('Admin socket connected');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Admin socket disconnected');
      setConnected(false);
    });

    // Safety Score Listeners
    newSocket.on('admin:all-safety-scores', (data) => {
      setSafetyScores(data.scores);
      setLoading(false);
    });

    // Geofence Listeners
    newSocket.on('admin:all-geofences', (data) => {
      setGeofences(data.geofences);
      setLoading(false);
    });

    newSocket.on('admin:geofence-created', (geofence) => {
      setGeofences((prev) => [geofence, ...prev]);
    });

    newSocket.on('admin:geofence-updated', (updated) => {
      setGeofences((prev) =>
        prev.map((g) => (g.id === updated.id ? updated : g))
      );
    });

    newSocket.on('admin:geofence-deleted', ({ geofenceId }) => {
      setGeofences((prev) => prev.filter((g) => g.id !== geofenceId));
    });

    newSocket.on('admin:geofence-toggled', ({ geofenceId, isActive }) => {
      setGeofences((prev) =>
        prev.map((g) => (g.id === geofenceId ? { ...g, isActive } : g))
      );
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      setLoading(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Safety Score Methods
  const fetchSafetyScores = useCallback((filters = {}) => {
    if (!socket) return;
    setLoading(true);
    socket.emit('admin:get-all-safety-scores', filters);
  }, [socket]);

  // Geofence Methods
  const fetchGeofences = useCallback((filters = {}) => {
    if (!socket) return;
    setLoading(true);
    socket.emit('admin:get-all-geofences', filters);
  }, [socket]);

  const createGeofence = useCallback((data) => {
    if (!socket) return;
    socket.emit('admin:create-geofence', data);
  }, [socket]);

  const updateGeofence = useCallback((geofenceId, data) => {
    if (!socket) return;
    socket.emit('admin:update-geofence', { geofenceId, ...data });
  }, [socket]);

  const deleteGeofence = useCallback((geofenceId) => {
    if (!socket) return;
    socket.emit('admin:delete-geofence', { geofenceId });
  }, [socket]);

  const toggleGeofence = useCallback((geofenceId) => {
    if (!socket) return;
    socket.emit('admin:toggle-geofence', { geofenceId });
  }, [socket]);

  return {
    socket,
    connected,
    loading,
    safetyScores,
    geofences,
    fetchSafetyScores,
    fetchGeofences,
    createGeofence,
    updateGeofence,
    deleteGeofence,
    toggleGeofence
  };
}
```

### Usage in Component

```jsx
import { useAdminSocket } from './useAdminSocket';

function GeofenceManager() {
  const {
    connected,
    loading,
    geofences,
    fetchGeofences,
    createGeofence,
    deleteGeofence,
    toggleGeofence
  } = useAdminSocket();

  useEffect(() => {
    if (connected) {
      fetchGeofences({ isActive: true });
    }
  }, [connected, fetchGeofences]);

  const handleCreate = () => {
    createGeofence({
      name: 'New Safety Zone',
      latitude: 19.076,
      longitude: 72.8777,
      radius: 1000,
      fenceType: 'safety'
    });
  };

  return (
    <div>
      <h2>Geofences {connected ? '🟢' : '🔴'}</h2>
      <button onClick={handleCreate}>Create Geofence</button>
      
      {loading ? (
        <p>Loading...</p>
      ) : (
        <ul>
          {geofences.map((fence) => (
            <li key={fence.id}>
              {fence.name} - {fence.fenceType} 
              ({fence.isActive ? 'Active' : 'Inactive'})
              <button onClick={() => toggleGeofence(fence.id)}>
                Toggle
              </button>
              <button onClick={() => deleteGeofence(fence.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

### React Native Mobile App

```javascript
import { io } from 'socket.io-client';
import auth from '@react-native-firebase/auth';

const SOCKET_URL = 'https://your-domain.com/user';

class LocationSocketService {
  socket = null;

  async connect() {
    const user = auth().currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const token = await user.getIdToken();

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true
    });

    this.socket.on('connect', () => {
      console.log('Connected to location service');
    });

    this.socket.on('location:updated', (data) => {
      console.log('Location update confirmed:', data);
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    return this.socket;
  }

  updateLocation(location) {
    if (!this.socket?.connected) return;

    this.socket.emit('location:update', {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      speed: location.speed,
      heading: location.heading,
      altitude: location.altitude
    });
  }

  triggerSOS(latitude, longitude, message) {
    if (!this.socket?.connected) return;

    this.socket.emit('sos:trigger', {
      latitude,
      longitude,
      message,
      alertType: 'emergency'
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const locationSocket = new LocationSocketService();
```

---

## Quick Reference Card

### Admin Namespace (`/admin`) - No Auth Required

| Action | Emit Event | Response Event |
|--------|------------|----------------|
| Get all safety scores | `admin:get-all-safety-scores` | `admin:all-safety-scores` |
| Get single safety score | `admin:get-safety-score` | `admin:safety-score-details` |
| Get nearby safety scores | `admin:get-nearby-safety-scores` | `admin:nearby-safety-scores` |
| Get safety statistics | `admin:get-safety-stats` | `admin:safety-stats` |
| Get all geofences | `admin:get-all-geofences` | `admin:all-geofences` |
| Get single geofence | `admin:get-geofence` | `admin:geofence-details` |
| Create geofence | `admin:create-geofence` | `admin:geofence-created` |
| Update geofence | `admin:update-geofence` | `admin:geofence-updated` |
| Delete geofence | `admin:delete-geofence` | `admin:geofence-deleted` |
| Toggle geofence | `admin:toggle-geofence` | `admin:geofence-toggled` |
| Get geofences at point | `admin:get-geofences-at-location` | `admin:geofences-at-location` |
| Get geofence stats | `admin:get-geofence-stats` | `admin:geofence-stats` |
| Get user locations | `admin:get-user-locations` | `admin:user-locations` |
| Subscribe to user | `admin:subscribe-user-location` | `admin:user-location-update` |
| Get alerts | `admin:get-all-alerts` | `admin:all-alerts` |
| Update alert | `admin:update-alert-status` | `admin:alert-updated` |
| Get videos | `admin:get-all-videos` | `admin:all-videos` |
| Delete video | `admin:delete-video` | `admin:video-deleted` |
| Cleanup orphaned videos | `admin:cleanup-orphaned-videos` | `admin:orphaned-videos-cleaned` |

### User Namespace (`/user`) - Firebase Auth Required

| Action | Emit Event | Response Event |
|--------|------------|----------------|
| Update location | `location:update` | `location:updated` |
| Get location history | `location:get-history` | `location:history` |
| Trigger SOS | `sos:trigger` | `sos:triggered` |
| Cancel SOS | `sos:cancel` | `sos:cancelled` |

---

## Support

For issues or questions, contact the backend team or create an issue in the repository.

**Last Updated:** January 2025
