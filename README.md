# 🏥 MediConnect — Doctor Appointment & Clinic Management Platform

A booking platform for three problems everyone in India has run into: opaque clinic queues, lost paper prescriptions, and no easy way to find a nearby doctor by specialty and rating.

Built as a single Express + MongoDB backend with a React frontend — no microservices, no message broker, no multi-instance deployment. That's not a limitation to apologize for: at this project's actual scale, that infrastructure wouldn't be solving a real problem, so it isn't there. What *is* handled carefully: two patients can't book the same slot, and the live queue stays fast as it grows.

![Node](https://img.shields.io/badge/Node.js-18.x-green)
![React](https://img.shields.io/badge/React-18.x-blue)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-brightgreen)
![Redis](https://img.shields.io/badge/Redis-Cache%20%2B%20Lock%20%2B%20Queue-red)
![License](https://img.shields.io/badge/License-MIT-yellow)

**Live Demo:** `mediconnect.vercel.app` &nbsp;|&nbsp; **API:** `mediconnect-api.onrender.com`

---

## 📌 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Folder Structure](#folder-structure)
- [Database Schema](#database-schema)
- [Concurrency Control: Preventing Double-Booking](#concurrency-control-preventing-double-booking)
- [Real-Time Queue Engine](#real-time-queue-engine)
- [Caching Strategy](#caching-strategy)
- [Payments](#payments)
- [SMS Notifications](#sms-notifications)
- [Prescription PDFs](#prescription-pdfs)
- [Security](#security)
- [API Reference](#api-reference)
- [Doctor Verification (Mocked)](#doctor-verification-mocked)
- [Design Decisions](#design-decisions)
- [What's Not Built Yet](#whats-not-built-yet)
- [Testing](#testing)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Interview Pitch](#interview-pitch)

---

## Overview

Three roles — **patient**, **doctor**, **admin** — one Express API, one MongoDB database, one Redis instance. A patient finds a nearby doctor on a map, books a slot, pays, watches their live queue position, and gets an SMS when it's almost their turn. A doctor manages their schedule, calls patients forward, and writes a digital prescription. An admin approves doctor registrations and checks basic platform stats.

The two genuinely non-trivial problems this project solves on purpose:

1. **Two patients booking the same slot at the same moment** — solved with a Redis lock plus a database-level backstop, so it's correct even if the lock itself ever fails.
2. **A live queue that stays fast as it grows** — solved by storing the queue as a Redis Sorted Set instead of a document field that gets rewritten every time someone moves up.

---

## Features

### Patient
- Search doctors by specialty, location (map-based), and rating
- Book an available slot and pay the consultation fee (Razorpay)
- See a live queue position that updates without refreshing
- Get an SMS when it's nearly their turn
- Download their prescription as a PDF after the visit
- Rate the doctor afterward

### Doctor
- Set available time slots
- See today's queue and click "Call Next"
- Write a prescription — generates a downloadable PDF automatically
- View a patient's appointment history

### Admin
- Approve or reject doctor registrations
- View basic platform stats (users, appointments, revenue) via a MongoDB aggregation pipeline
- Ban/unban users

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + Vite | UI framework |
| Tailwind CSS | Styling |
| Leaflet.js + React-Leaflet | Interactive maps (free, no API key) |
| TanStack Query | Server-state caching — avoids manual `useEffect` + loading-state juggling |
| React Router v6 | Client-side routing |
| Socket.io Client | Real-time queue position updates |

### Backend
| Technology | Purpose |
|---|---|
| Node.js 18 + Express | REST API |
| MongoDB Atlas + Mongoose | Primary datastore |
| Redis | Booking lock, doctor-search cache, live queue (Sorted Set) |
| Socket.io | Real-time updates, single instance |
| JWT (access + refresh) | Auth |
| bcrypt | Password hashing |
| Zod | Request validation |

### Third-Party Services
| Service | Purpose |
|---|---|
| Razorpay | Payments, with webhook verification |
| Twilio | SMS turn-alerts |
| Cloudinary | Prescription PDF storage |
| PDFKit | Generates the prescription PDF |
| OpenStreetMap + Leaflet | Free map tiles, no API key |

### Hosting
Vercel (frontend) · Render, one web service (backend) · MongoDB Atlas · Redis Cloud — all free tiers.
Alternatively, self-hosted via Docker Compose with nginx as a reverse proxy — see [Docker deployment](#docker-deployment-self-hosted-alternative) below.

---

## Architecture

```text
┌─────────────────────┐
│   React SPA          │
│  (Vite, Leaflet,      │
│   Socket.io client)   │
└──────────┬────────────┘
           │ HTTPS / WSS
           ▼
┌───────────────────────────────────┐
│   Express API (single instance)    │
│   + Socket.io (same process)       │
└─────────┬─────────────────┬───────┘
          │                 │
          ▼                 ▼
┌──────────────────┐  ┌───────────────────────┐
│  MongoDB Atlas     │  │  Redis                │
│  (single replica   │  │  • booking lock        │
│   set)             │  │  • doctor-search cache │
└──────────────────┘  │  • live queue (ZSET)   │
                        └───────────────────────┘
          │
          ▼
┌───────────────────────────────────┐
│  Razorpay · Twilio · Cloudinary    │
│  (called directly, no job queue)   │
└───────────────────────────────────┘
```

One API instance, one database, one Redis instance. Nothing here needs a load balancer or a message broker to work correctly — see [What's Not Built Yet](#whats-not-built-yet) for exactly what would change if that stopped being true.

### Self-hosted variant: nginx as a reverse proxy, not a load balancer

For a Docker-based deployment (a VPS, or local docker-compose demo), nginx sits in front — but as a **reverse proxy for one backend container**, not a load balancer distributing across replicas. That distinction matters: a true load balancer implies 2+ backend instances, which would bring back the exact multi-instance problems this project deliberately avoided — Socket.io needing the Redis adapter again, and the in-memory rate limiter needing to move to Redis so limits are counted correctly instead of per-instance.

```text
┌─────────────────────┐
│   React SPA (built    │
│   static files)        │
└──────────┬────────────┘
           │ HTTPS
           ▼
┌───────────────────────────────────┐
│              nginx                 │
│  • serves the frontend build       │
│  • proxies /api/* → backend        │
│  • proxies /socket.io/* → backend  │
│    (with WebSocket upgrade headers)│
└─────────────┬─────────────────────┘
              ▼
┌───────────────────────────────────┐
│   Express API (still ONE instance) │
│   + Socket.io (same process)       │
└─────────┬─────────────────┬───────┘
          ▼                 ▼
   MongoDB Atlas          Redis
```

```nginx
# nginx.conf
server {
  listen 80;

  location / {
    root /usr/share/nginx/html;   # the built React app
    try_files $uri /index.html;
  }

  location /api/ {
    proxy_pass http://backend:5000;
    proxy_set_header Host $host;
  }

  location /socket.io/ {
    proxy_pass http://backend:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;      # required — without these two headers,
    proxy_set_header Connection "upgrade";        # nginx won't let the WebSocket handshake through
  }
}
```

```yaml
# docker-compose.yml (self-hosted variant)
services:
  nginx:
    image: nginx:alpine
    ports: ["80:80"]
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - ./frontend/dist:/usr/share/nginx/html
    depends_on: [backend]

  backend:
    build: ./backend
    env_file: ./backend/.env
    depends_on: [mongo, redis]

  mongo:
    image: mongo:7
    volumes: ["mongo-data:/data/db"]

  redis:
    image: redis:7-alpine

volumes:
  mongo-data:
```

The two `proxy_set_header` lines in the `/socket.io/` block aren't optional — Socket.io's real-time connection starts as a normal HTTP request and then upgrades to a WebSocket. Without those headers, nginx treats it as a plain HTTP request, the upgrade handshake fails, and Socket.io silently falls back to HTTP long-polling instead of a real WebSocket connection.

---

## Folder Structure

Organized by domain (auth, doctor, booking, payment, admin) rather than by technical layer, so everything about "booking" lives in one folder instead of scattered across separate `routes/`, `controllers/`, `services/` directories. Costs nothing extra to set up this way, and makes it obvious where a bug or a change lives.

```text
mediconnect/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── auth.routes.js
│   │   │   │   ├── auth.controller.js
│   │   │   │   ├── auth.service.js
│   │   │   │   └── auth.schema.js
│   │   │   ├── doctor/
│   │   │   │   ├── doctor.routes.js
│   │   │   │   ├── doctor.controller.js
│   │   │   │   ├── doctor.service.js
│   │   │   │   ├── doctor.schema.js
│   │   │   │   ├── Doctor.model.js
│   │   │   │   └── nmcVerification.service.js   # mocked — see Doctor Verification
│   │   │   ├── booking/
│   │   │   │   ├── booking.routes.js
│   │   │   │   ├── booking.controller.js
│   │   │   │   ├── booking.service.js            # lock + transaction logic
│   │   │   │   ├── booking.schema.js
│   │   │   │   ├── Appointment.model.js
│   │   │   │   ├── Prescription.model.js
│   │   │   │   ├── Review.model.js
│   │   │   │   ├── queue.service.js               # Redis Sorted Set queue
│   │   │   │   └── pdf.service.js                 # prescription PDF generation
│   │   │   ├── payment/
│   │   │   │   ├── payment.routes.js
│   │   │   │   ├── payment.controller.js
│   │   │   │   └── payment.service.js
│   │   │   ├── notification/
│   │   │   │   └── sms.service.js                 # Twilio, fire-and-forget
│   │   │   └── admin/
│   │   │       ├── admin.routes.js
│   │   │       ├── admin.controller.js
│   │   │       └── admin.service.js
│   │   │
│   │   ├── shared/
│   │   │   ├── config/
│   │   │   │   ├── db.js
│   │   │   │   ├── redis.js
│   │   │   │   └── socket.js
│   │   │   ├── middleware/
│   │   │   │   ├── auth.middleware.js
│   │   │   │   ├── role.middleware.js
│   │   │   │   ├── error.middleware.js
│   │   │   │   └── index.js  # re-exports middleware helpers
│   │   │   ├── utils/
│   │   │   │   ├── AppError.js
│   │   │   │   ├── asyncHandler.js
│   │   │   │   └── lock.js                        # SET NX PX + compare-and-delete
│   │   │   └── User.model.js
│   │   │
│   │   ├── routes/
│   │   │   └── v1/index.js
│   │   │
│   │   ├── app.js
│   │   └── server.js
│   │
│   ├── tests/
│   │   ├── unit/lock.test.js
│   │   └── integration/booking.test.js
│   │
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/          # Login, Register
│   │   │   ├── patient/       # FindDoctors (map), BookAppointment, QueueTracker, MyAppointments
│   │   │   ├── doctor/        # Dashboard, TodayQueue, WritePrescription
│   │   │   └── admin/         # Approvals, Analytics
│   │   ├── shared/
│   │   │   ├── components/    # map/, queue/, ui/
│   │   │   ├── SocketContext.jsx
│   │   │   ├── api.js
│   │   │   └── distance.js    # haversine formula
│   │   └── App.jsx
│   └── package.json
│
├── docker-compose.yml   # local mongo + redis only, for dev convenience
└── README.md
```

---

## Database Schema

```js
// User
{
  name: String,
  email: { type: String, unique: true },
  password: String,                              // bcrypt
  role: { type: String, enum: ["patient", "doctor", "admin"] },
  phone: String,
  isActive: { type: Boolean, default: true },
  createdAt: Date
}

// Doctor
{
  userId: ObjectId,
  specialty: String,
  consultationFee: Number,
  availableSlots: [{ day, startTime, endTime, interval }],
  location: {
    type: { type: String, default: "Point" },
    coordinates: [Number]                         // [lng, lat]
  },
  isApproved: Boolean,
  nmcRegistrationNumber: String,
  isNmcVerified: Boolean,                         // set by the mocked check — see below
  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 }
}
DoctorSchema.index({ location: "2dsphere" })       // powers the nearby-doctor search
DoctorSchema.index({ specialty: 1, rating: -1 })   // filter + sort in one index

// Appointment — the one index that actually prevents double-booking
{
  patientId: ObjectId,
  doctorId: ObjectId,
  date: Date,
  timeSlot: String,
  status: { type: String, enum: ["booked","in-queue","completed","cancelled"] },
  paymentId: String,
  paymentStatus: { type: String, enum: ["pending","paid","refunded"] },
  createdAt: Date
}
AppointmentSchema.index(
  { doctorId: 1, date: 1, timeSlot: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: "cancelled" } } }
)
// "partial" matters: a plain unique index would permanently block re-booking a
// cancelled slot. This only enforces uniqueness among non-cancelled appointments.

// Prescription
{
  appointmentId: ObjectId,
  doctorId: ObjectId,
  patientId: ObjectId,
  medicines: [{ name: String, dosage: String, duration: String, instructions: String }],
  notes: String,
  pdfUrl: String,        // Cloudinary URL
  createdAt: Date
}

// Review
{
  patientId: ObjectId,
  doctorId: ObjectId,
  appointmentId: ObjectId,
  rating: { type: Number, min: 1, max: 5 },
  comment: String
}
ReviewSchema.index({ patientId: 1, appointmentId: 1 }, { unique: true }) // one review per visit
```

No `RefreshToken` collection — see [Security](#security) for why refresh tokens are handled statelessly here.

---

## Concurrency Control: Preventing Double-Booking

The naive version — "check if the slot is free, then create the appointment" — has a race window: two requests can both read "free" before either one writes. The fix is two layers.

**Layer 1 — a Redis lock, correctly scoped to what this app actually runs on:**

```js
// shared/utils/lock.js
async function acquireLock(key, ttlMs) {
  const token = crypto.randomUUID();
  const acquired = await redisClient.set(key, token, "PX", ttlMs, "NX");
  return acquired ? token : null;
}

async function releaseLock(key, token) {
  // Compare-and-delete via a Lua script — only release the lock if we're
  // still the one holding it (avoids deleting a lock someone else acquired
  // after ours expired).
  const script = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end`;
  await redisClient.eval(script, 1, key, token);
}
```

This is a plain `SET NX PX` lock, not the Redlock algorithm — deliberately. Redlock exists to coordinate a lock across *multiple independent Redis nodes*, so no single node's failure breaks the lock. This deployment runs one Redis instance, so that coordination has nothing to add here; a single `SET NX PX` with a TTL is the *correct* tool for this scale, not a simplified stand-in for a fancier one.

**Layer 2 — a database-level backstop**, in case the lock ever fails to prevent a race (TTL expiry under load, a Redis restart):

```js
// modules/booking/booking.service.js
async function bookAppointment(patientId, doctorId, date, timeSlot) {
  const lockKey = `lock:booking:${doctorId}:${date}:${timeSlot}`;
  const token = await acquireLock(lockKey, 5000);
  if (!token) throw new AppError(409, "Someone else is booking this slot, try again");

  try {
    const existing = await Appointment.findOne({
      doctorId, date, timeSlot, status: { $ne: "cancelled" }
    });
    if (existing) throw new AppError(409, "Slot no longer available");

    return await Appointment.create({
      patientId, doctorId, date, timeSlot, status: "booked", paymentStatus: "pending"
    });
  } catch (err) {
    // The unique partial index throws E11000 here if the lock ever failed to
    // prevent a race — the app still can't end up with two bookings for one slot.
    if (err.code === 11000) throw new AppError(409, "Slot no longer available");
    throw err;
  } finally {
    await releaseLock(lockKey, token);
  }
}
```

Why both: the lock is fast and stops almost every race by itself, but it isn't infallible under a failover or an expired TTL. The unique index guarantees correctness regardless — it's the fallback, not the main mechanism.

---

## Real-Time Queue Engine

The obvious-but-wrong approach: store `queuePosition` as a field on every `Appointment`, and rewrite it on every document each time the doctor clicks "Call Next" — an O(N) write, every single time.

Instead, the live queue lives in a Redis Sorted Set:

```js
// modules/booking/queue.service.js
const queueKey = (doctorId, date) => `queue:${doctorId}:${date}`;

async function joinQueue(doctorId, date, appointmentId) {
  const seq = await redisClient.incr(`seq:${doctorId}:${date}`);
  await redisClient.zadd(queueKey(doctorId, date), seq, appointmentId);   // O(log N)
}

async function getPosition(doctorId, date, appointmentId) {
  return redisClient.zrank(queueKey(doctorId, date), appointmentId);     // O(log N)
}

async function callNext(doctorId, date) {
  const [nextId] = await redisClient.zpopmin(queueKey(doctorId, date));  // O(log N)
  io.to(`queue-${doctorId}-${date}`).emit("queue-update", {
    called: nextId,
    positions: await redisClient.zrange(queueKey(doctorId, date), 0, -1, "WITHSCORES")
  });
  return nextId;
}
```

Insertion, rank lookup, and removal are all **O(log N)** instead of an **O(N)** document rewrite — the same trade-off as picking a balanced structure over a plain array when you need ordered access with frequent updates, which is where this idea actually came from (some scheduling problems worked through separately using Binary Indexed Trees for the same reason).

**Single Socket.io instance, on purpose, for now.** With one backend instance, `io.emit()` reaches every connected client directly — no coordination needed. If this ever ran on 2+ instances behind a load balancer, a client connected to instance A wouldn't receive an event emitted from instance B, and the fix would be `@socket.io/redis-adapter`, which fans events out through Redis pub/sub to every instance. Worth knowing where it plugs in; not worth building for one instance.

---

## Caching Strategy

Doctor search is read-heavy and doesn't need to be perfectly fresh — a short TTL cache in front of it is enough:

```js
const cacheKey = `search:${hash(queryParams)}`;
const cached = await redisClient.get(cacheKey);
if (cached) return JSON.parse(cached);

const results = await Doctor.find(query).limit(20);
await redisClient.set(cacheKey, JSON.stringify(results), "EX", 60);  // 60s TTL
return results;
```

A doctor's profile changing doesn't need to show up within milliseconds — a patient seeing data that's a few seconds stale is a fine trade for taking repeated identical searches off the database.

---

## Payments

```text
1. Client → POST /payments/create-order   (Idempotency-Key header — a retried request
                                            with the same key returns the same order
                                            instead of creating a second one)
2. Client → Razorpay Checkout SDK
3. Client → POST /payments/verify         (checks the client-supplied signature)
4. Razorpay → POST /payments/webhook      (server-to-server, HMAC-verified — this is
                                            the actual source of truth, in case the
                                            user closes the tab before step 3 fires)
```

Relying only on step 3 is the common mistake — a closed browser tab leaves the appointment stuck in "pending" forever unless the webhook is treated as authoritative, not just a nice-to-have.

```js
// modules/payment/payment.service.js
function verifyWebhookSignature(rawBody, signatureHeader) {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return expected === signatureHeader;
}
```

---

## SMS Notifications

When the doctor calls the next patient, an SMS goes out via Twilio — fire-and-forget, not on a job queue. The booking flow was already fast without it; adding a queueing library just to send one SMS type would be infrastructure the actual traffic here doesn't need yet.

```js
// modules/notification/sms.service.js
async function sendTurnAlert(phone, doctorName) {
  try {
    await twilioClient.messages.create({
      to: `+91${phone}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      body: `Your turn at Dr. ${doctorName}'s clinic! Please check in.`
    });
  } catch (err) {
    logger.error("SMS failed (non-blocking):", err.message);
    // Deliberately doesn't throw — the queue call already succeeded, and the
    // patient still sees their live position in-app regardless of the SMS.
  }
}
```

```js
// modules/booking/booking.controller.js — called after the queue update, not awaited
setImmediate(() => smsService.sendTurnAlert(patient.phone, doctor.name));
```

If SMS volume or reliability ever mattered enough to justify it, this is exactly the call site that would move to a real job queue (BullMQ) with retries — noted here on purpose rather than built, since it isn't earning its cost yet.

---

## Prescription PDFs

```js
// modules/booking/pdf.service.js
async function generatePrescriptionPdf(prescription) {
  const doc = new PDFDocument();
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  doc.fontSize(18).text("Prescription", { align: "center" });
  doc.moveDown();
  prescription.medicines.forEach((m) => {
    doc.fontSize(12).text(`${m.name} — ${m.dosage}, ${m.duration}`);
    if (m.instructions) doc.fontSize(10).text(m.instructions, { indent: 20 });
  });

  doc.end();
  return new Promise((resolve) => {
    doc.on("end", async () => {
      const buffer = Buffer.concat(chunks);
      const uploadResult = await cloudinary.uploader.upload_stream({ resource_type: "raw" });
      resolve(uploadResult.secure_url);
    });
  });
}
```

Generated synchronously when the doctor submits the prescription — it's a small document, this doesn't need to be a background job.

---

## Security


### 🥇 TOP PONYTAIL RECOMMENDATION: Refresh Token Reuse Detection

**Why it’s perfect:**
- **Effort**: ~15 lines (store/revoke JTIs in Redis)
- **Signal**: Shows you know token theft is a real threat—not just theoretical.
- **Current gap**: Your current auth implements token rotation but lacks explicit reuse detection.

**Implementation sketch:**

```javascript
// On successful refresh:
const jti = decodedRefreshToken.jti;
await redis.set(`used_jti:${jti}`, "1", "EX", jwtRefreshExpirySeconds);

// Before issuing new tokens:
if (await redis.exists(`used_jti:${jti}`)) {
  // Token replay detected → nukes all user sessions
  await redis.del(`refresh_token:${userId}`);
  throw new AppError("Token reuse detected", 401);
}
```

**Why recruiters notice:**
This is a specific, production-hardening tactic most juniors don’t know exists. It signals you’ve thought about real attacks—not just textbook auth.

---

- `helmet()`, CORS allowlist
- `express-rate-limit`, in-memory (correct choice for one instance — a Redis-backed store would only matter across multiple instances, which this doesn't run)
- `express-mongo-sanitize` against NoSQL injection
- Every request body validated through a Zod schema before it reaches a controller
- Passwords: bcrypt, cost factor 12
- **Auth:** short-lived JWT access token (15 min) + a longer-lived refresh token (7 days, httpOnly cookie). On refresh, a **new** refresh token is issued each time (basic rotation) — verified statelessly by signature and expiry, no server-side token table. **Known limitation, not hidden:** there's no reuse detection — if a refresh token were ever stolen, using it wouldn't be flagged as suspicious the way it would be with a tracked token-family approach. That's a real gap for a production system and a reasonable one for this project's current scope.
- Razorpay webhook verified via HMAC-SHA256 before any payment status is trusted

---

## API Reference

### Auth
| Method | Route |
|---|---|
| POST | `/api/v1/auth/register` |
| POST | `/api/v1/auth/login` |
| POST | `/api/v1/auth/refresh-token` |
| POST | `/api/v1/auth/send-otp` |
| POST | `/api/v1/auth/verify-otp` |
| POST | `/api/v1/auth/logout` |

### Doctors (public)
| Method | Route |
|---|---|
| GET | `/api/v1/doctors?specialty=&rating=&cursor=` |
| GET | `/api/v1/doctors/search?q=<doctor_name_or_bio>` |
| GET | `/api/v1/doctors/nearby?lat=&lng=&radius=` |
| GET | `/api/v1/doctors/:id` |

### Patient
| Method | Route |
|---|---|
| POST | `/api/v1/appointments/book` |
| GET | `/api/v1/appointments/my` |
| GET | `/api/v1/appointments/:id/queue` |
| DELETE | `/api/v1/appointments/:id` |
| GET | `/api/v1/prescriptions/:id/download` |
| POST | `/api/v1/reviews/:doctorId` |

### Doctor
| Method | Route |
|---|---|
| GET / PUT | `/api/v1/doctor/profile` |
| POST | `/api/v1/doctor/verify-registration` |
| PUT | `/api/v1/doctor/availability` |
| GET | `/api/v1/doctor/appointments/today` |
| PUT | `/api/v1/doctor/appointments/:id/call-next` |
| POST | `/api/v1/doctor/prescriptions` |
| GET | `/api/v1/doctor/patients/:id/history` |

### Admin
| Method | Route |
|---|---|
| GET | `/api/v1/admin/doctors/pending` |
| PUT | `/api/v1/admin/doctors/:id/approve` \| `/reject` |
| GET | `/api/v1/admin/analytics` |
| GET | `/api/v1/admin/users` |
| PUT | `/api/v1/admin/users/:id/ban` \| `/unban` |

### Payments
| Method | Route |
|---|---|
| POST | `/api/v1/payments/create-order` |
| POST | `/api/v1/payments/verify` |
| POST | `/api/v1/payments/webhook` |
| POST | `/api/v1/payments/refund/:id` |

---

## Doctor Search

Patients can search for doctors by name or bio using three methods:

### 1. **Text Search** (full-name or bio match)
```bash
GET /api/v1/doctors/search?q=cardiology
GET /api/v1/doctors/search?q=John%20Smith
```
Returns doctors where name or bio contains the search term (case-insensitive, stemmed). Uses MongoDB text index on `doctorName` and `bio` fields. Limits results to 20.

**Example response:**
```json
{
  "doctors": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "userId": { "name": "Dr. John Smith", "email": "john@clinic.com" },
      "specialty": "Cardiology",
      "bio": "10+ years in cardiac surgery",
      "rating": 4.8,
      "consultationFee": 500
    }
  ]
}
```

### 2. **Filter by Specialty & Rating**
```bash
GET /api/v1/doctors?specialty=cardiology&minRating=4.0
```
Filters by specialty and min rating. Returns up to 20 results.

### 3. **Nearby Search (Geolocation)**
```bash
GET /api/v1/doctors/nearby?lat=27.7172&lng=85.3240&radius=5000
```
Finds doctors within radius (default 5000m). Uses MongoDB 2dsphere geospatial index. Returns up to 50 results sorted by distance.

---

## Doctor Verification (Mocked)

Real doctor licenses in India are checked against the **National Medical Commission's** public registry (`nmc.org.in`) — not a scraped contact database. For this project, that check is **mocked**, not integrated:

```js
// modules/doctor/nmcVerification.service.js
async function verifyDoctorRegistration(registrationNumber) {
  // MOCKED for this project. A real integration would call NMC's public
  // registry lookup and confirm the registration number, name, and state
  // council match, storing only a boolean + the registration number —
  // never bulk contact data. Left mocked here since it depends on an
  // external service this project doesn't have credentials to call reliably.
  return { verified: true, registrationNumber };
}
```

Demo doctors are seeded with `faker.js`-generated fake data, not real people's information.

---

## Design Decisions

| Concern | Naive approach | What's built | Why |
|---|---|---|---|
| Double-booking | Check-then-insert, no lock | `SET NX PX` lock + partial unique index | Two requests can both pass the check before either writes; the index guarantees correctness even if the lock ever fails |
| Queue position | Rewrite `queuePosition` on every appointment, every "Call Next" | Redis Sorted Set, O(log N) | Rewriting N documents on every click doesn't scale with queue length |
| SMS delivery | Await Twilio inline, block the response | Fire-and-forget, logged on failure | A slow/flaky third-party API shouldn't make booking itself unreliable |
| Payment confirmation | Trust only the client-side success callback | Client verification + signed webhook | A closed tab or a forged client call can't be distinguished from a real success without the webhook |
| Auth sessions | One long-lived token | Short access token + rotating refresh token | Limits how long a leaked access token stays useful, without needing a server-side session store |
| Doctor list pagination | `skip(page*limit)` | Cursor-based (`_id` cursor) | `skip()` gets slower the deeper you page — Mongo still walks past every skipped document |

---

## What's Not Built Yet

Said plainly instead of hidden — these are real production concerns, deliberately out of scope for this version:

- **Background job queue (BullMQ).** SMS is a direct, fire-and-forget call. If volume or reliability requirements grew, this is the first thing to add.
- **Refresh token reuse detection.** Tokens rotate, but a stolen one isn't detected as reused — that needs a tracked token-family model this project doesn't have.
- **Multi-instance scaling.** Runs as one Express + Socket.io instance. Scaling out would need `@socket.io/redis-adapter` for real-time events and a Redis-backed rate limiter — noted where each applies above, not built.
- **Sharding.** A single MongoDB replica set easily covers this app's realistic volume for years. If that changed, `doctorId` (not `date`) is the right shard key — sharding by date creates a hot shard every single day.
- **Circuit breakers around Twilio/Razorpay.** Failures are caught and logged; nothing actively stops repeated calls into a failing dependency.
- **Schema migration tooling.** The schema is small enough to evolve by hand for now.

---

## Testing

```js
// tests/unit/lock.test.js
it("prevents a second lock while the first is held", async () => {
  const t1 = await acquireLock("test-key", 5000);
  const t2 = await acquireLock("test-key", 5000);
  expect(t1).not.toBeNull();
  expect(t2).toBeNull();
});
```

```js
// tests/integration/booking.test.js — Supertest + mongodb-memory-server
it("rejects a double-booking attempt on the same slot", async () => {
  await request(app).post("/api/v1/appointments/book").send(payload);
  const res = await request(app).post("/api/v1/appointments/book").send(payload);
  expect(res.status).toBe(409);
});
```

A basic GitHub Actions workflow runs `npm run lint` and `npm test` on every push.

---

## Getting Started

```bash
git clone https://github.com/YOUR_USERNAME/mediconnect.git

# Backend
cd mediconnect/backend
npm install
cp .env.example .env       # fill in your values
npm run dev                 # http://localhost:5000

# Frontend (new terminal)
cd ../frontend
npm install
cp .env.example .env
npm run dev                 # http://localhost:5173

# Optional — local Mongo + Redis instead of Atlas/Redis Cloud
docker-compose up
```

---

## Environment Variables

```bash
# Server
PORT=5000

# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/mediconnect

# Redis
REDIS_URL=redis://default:password@redis-host:port

# JWT
JWT_SECRET=...
JWT_REFRESH_SECRET=...
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# Twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

CLIENT_URL=http://localhost:5173
```

---

## Deployment

| Component | Where |
|---|---|
| Frontend | Vercel, auto-deploy on push to `main` |
| API | Render, single Web Service |
| Database | MongoDB Atlas, free tier |
| Cache/Queue | Redis Cloud, free tier |

### Docker deployment (self-hosted alternative)

```bash
cd frontend && npm run build && cd ..   # build the static frontend first — nginx serves this
docker-compose up -d
```

Same architecture as above — one backend container, one nginx container, Mongo and Redis either as containers (for a fully self-contained demo) or swapped for Atlas/Redis Cloud by pointing `MONGODB_URI`/`REDIS_URL` at them instead. nginx handles TLS termination and routing; the app itself doesn't change.

---

## Roadmap

- [x] Geospatial doctor search + cursor pagination
- [x] Race-condition-safe booking (lock + partial unique index)
- [x] Redis Sorted Set queue engine
- [x] Razorpay payments with idempotency key + webhook verification
- [x] SMS turn-alerts (Twilio, fire-and-forget)
- [x] Prescription PDF generation
- [x] Admin analytics via aggregation pipeline
- [ ] Background job queue for notifications (BullMQ)
- [ ] Refresh token reuse detection
- [ ] Multi-instance scaling (Socket.io Redis adapter)
- [ ] Real NMC doctor-verification integration
- [ ] Mobile app (React Native)

---

## Ponytail Recommendation: Refresh Token Reuse Detection

### 🥇 TOP PONYTAIL RECOMMENDATION: Refresh Token Reuse Detection

  Why it’s perfect:

   - Effort: ~15 lines (store/revoke JTIs in Redis)
   - Signal: Shows you know token theft is a real threat—not just theoretical.
   - Current gap: You have refresh tokens but not reuse detection (noted in your roadmap).

   Implementation sketch:

   // On successful refresh:
   const jti = decodedRefreshToken.jti;
   await redis.set(`used_jti:${jti}`, 1, , jwtRefreshExpirySeconds);

   // Before issuing new tokens:
   if (await redis.exists(`used_jti:${jti}`)) {
     // Token replay detected → nukes all user sessions
     await redis.del(`refresh_token:${userId}`);
     throw new AppError("Token reuse detected", 401);
   }

   Why recruiters notice:
   This is a specific, production-hardening tactic most juniors don’t know exists. It signals you’ve
   thought about real attacks—not just textbook auth.

## Interview Pitch

> "I built a doctor appointment platform and focused on getting a couple of genuinely tricky parts right, rather than maximizing feature count. Booking uses a Redis lock plus a MongoDB partial unique index as a backstop, so two patients can't book the same slot even under concurrent requests — a single-node `SET NX PX` lock, not Redlock, because there's one Redis instance here and Redlock's cross-node coordination isn't solving a problem this deployment has. The live queue is a Redis Sorted Set instead of a document field rewritten on every update, so position lookups and 'call next' are O(log N) instead of O(N) — that came out of some scheduling problems I'd worked through separately using Binary Indexed Trees for the same reason. Payments go through Razorpay with an idempotency key on order creation and a signature-verified webhook, so a network retry can't double-charge and a closed browser tab doesn't leave a payment stuck in an unclear state. Everything else — one Express instance, SMS sent directly rather than through a job queue, no sharding — is deliberately simple, because none of that infrastructure is earning its cost at this project's actual scale. I'd rather be able to explain everything in this README than have unbuilt pieces in it."

---

## License

Distributed under the MIT License.
