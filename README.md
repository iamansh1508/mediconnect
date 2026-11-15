# MediConnect

Find a doctor nearby, book a slot, pay, and watch your place in the clinic queue update live. Doctors run their queue and write prescriptions; admins approve doctors.

Built as one Express + MongoDB app with a React frontend. Two problems are handled with care, and both are measured below:

1. **Two patients booking the same slot at the same moment.** A Redis lock stops the race, and a unique index in MongoDB guarantees it even if the lock fails.
2. **A live queue that stays fast as it grows.** Each doctor's queue for the day is a Redis sorted set, so "call next" and "what's my position?" are O(log N).

The app runs as two copies behind nginx, with SMS and email sent by a separate worker, to show how it scales out. It also runs as a single process on a free host.

## Interview pitch

> I built a doctor appointment platform and spent my effort on the parts that are easy to get wrong. Booking takes a Redis `SET NX PX` lock, and a partial unique index in MongoDB backs it up, so two patients can't get the same slot even if the lock fails. I fired 100 simultaneous bookings through nginx at two API copies: one succeeded, 99 got a 409. The live queue is a Redis sorted set per doctor per day: calling the next patient takes 0.08 ms with 10,000 waiting, against 88 ms for rewriting a position field on every appointment. Payments take the price from the database, reuse one Razorpay order per appointment, and treat the HMAC-signed webhook as the source of truth, so a retry can't double-charge and a closed tab can't lose a payment. I scaled it to two API copies, which needed the Socket.io Redis adapter, and moved SMS and email to a BullMQ worker, because Twilio being slow or down should never affect a booking. I kept booking and payment in one service, since they must succeed or fail together.

## What it does

| Patient | Doctor | Admin |
|---|---|---|
| Search by name, specialty, rating, or distance on a map | Set clinic location, fee and working hours | Approve or reject new doctors |
| Book a slot (held 15 minutes until paid) | See today's queue and press "Call next" | See users, appointments, revenue and ratings |
| Pay with Razorpay; cancel for a refund | Write a prescription | Ban and unban users |
| See their place in line update live, and get an SMS when they're next | See a patient's past visits | Retry SMS or emails that failed |
| Download the prescription as a PDF and review the visit | | |

Doctor licence checks against the National Medical Commission register are **mocked**: there is no public API, so the app only checks the number's format.

## Measured

Run on a laptop-class VM with MongoDB 8.2 and Redis 7. Every number comes from a script in `backend/scripts`, so you can rerun them yourself.

**Double-booking** (`npm run race -- 100 http://localhost:8080`, through nginx to two API copies):

```
100 simultaneous bookings for one slot, 287 ms
HTTP status: { '201': 1, '409': 99 }
Served by: { 'vm#2923': 50, 'vm#2922': 50 }
Appointments in MongoDB for that slot: 1
```

**Queue of 10,000 patients** (`npm run bench:queue`):

| | my position | call next |
|---|---|---|
| Redis sorted set | 0.08 ms | 0.08 ms |
| position field on each appointment in MongoDB (indexed) | 0.42 ms | 88 ms |

**Live updates across API copies** (`node scripts/scale-check.js http://localhost:5001 http://localhost:5002`):

```
Patient on http://localhost:5001: position 2 of 3
Doctor pressed "Call next" on http://localhost:5002 (served by vm#2923, HTTP 200)
Patient on http://localhost:5001 received the update: now position 1 of 2
```

**Notification worker** (checked by hand):
- With the worker stopped, booking and payment still succeed (201, 200), and the SMS waits in the queue.
- With bad Twilio credentials, the worker tries 5 times with growing delays, then moves the job to the failed set.
- An admin presses Retry once Twilio works again, and the message is sent (attempt 6).

**Tests:** 21 backend tests (`npm test`) against a real Redis and an in-memory MongoDB. They cover:
- 50 concurrent bookings for one slot, and a duplicate inserted with the lock bypassed
- cancel then re-book, and the 15-minute hold
- forged and repeated webhooks, a tampered price, retried orders, and a payment that arrives after the slot was re-sold
- separate queues per doctor, live updates over Socket.io, and refusing to let anyone watch someone else's queue
- refresh-token reuse, bans, password reset, and the prescription PDF

## Architecture

```text
 Browser (React, Leaflet map, Socket.io client)
        │  HTTPS + WebSocket, one origin
        ▼
 ┌──────────────┐
 │    nginx     │  round-robin, WebSocket upgrade, X-Request-Id
 └──┬────────┬──┘
    ▼        ▼
 ┌──────┐ ┌──────┐   Express + Socket.io, same code, no local state
 │ API  │ │ API  │   auth · doctor · booking (+ queue) · payment · admin
 └─┬──┬─┘ └─┬──┬─┘
   │  └──┬──┘  │
   ▼     ▼     ▼
 MongoDB   Redis ─────────────► Notification worker ──► Twilio (SMS), SMTP (email)
 records   lock, queues, cache,   BullMQ, 5 tries,
           Socket.io pub/sub,     failed set for retry
           rate limits, jobs
```

The API serves the built React app too, so the site and API share one origin. That means no CORS setup, and login cookies stay first-party on every host.

### Decisions

| Concern | Naive approach | What's built | Why |
|---|---|---|---|
| Double-booking | Check, then insert | Redis lock + partial unique index on (doctor, date, time) for live statuses | Two requests can both pass the check before either writes. The index holds even if the lock expires or Redis restarts, and being partial lets a cancelled slot be booked again. |
| Lock algorithm | Redlock | Single `SET NX PX` with compare-and-delete release | Redlock coordinates several independent Redis nodes. With one Redis it adds nothing. |
| Queue order | `position` field rewritten on every call | Sorted set per doctor per day, scored by slot time | 0.08 ms vs 88 ms with 10,000 waiting. MongoDB stays the record, and the queue is rebuilt from it if Redis loses it. |
| Paying | Trust the browser's success callback and price | Price from the database, one order per appointment, signed webhook as source of truth | A forged call can't mark a booking paid, a retry can't create a second order, and a closed tab still gets confirmed. |
| Abandoned checkouts | Slot held forever | Unpaid bookings hold the slot for 15 minutes | A late payment for a slot someone else has since taken is refunded automatically. |
| Booking + payment | Separate services | Same service, one document, one atomic update | They must succeed or fail together. Splitting them would need a saga for no gain. |
| SMS and email | Await Twilio inside the request | BullMQ queue and a separate worker | A slow or failing provider never delays or fails a booking. Repeated events are queued once (job id = event + appointment). |
| Several API copies | Local Socket.io and rate-limit state | Socket.io Redis adapter, rate limit counted in Redis, WebSocket-only transport | An event from copy B reaches a patient on copy A. WebSocket-only means no sticky sessions. |
| Sessions | One long-lived token | 15-minute access token + 7-day refresh token in httpOnly cookies, rotated on every use | A refresh token used twice means it was copied, so every session of that user ends. A token version on the user also ends sessions on ban or password change. |
| Search pages | `skip(page × size)` | Cursor on `_id`, 60-second Redis cache | `skip` walks every skipped document. A few seconds of staleness is fine for search. |
| Prescriptions | Upload a PDF to Cloudinary | Store the data; build the PDF on download | Nothing to upload or keep in sync. |

Deliberate shortcuts are marked in the code with `ponytail:` comments that name the limit and how to lift it, for example "regex search, move to Atlas Search beyond thousands of doctors".

## Run it

**Everything in Docker** (two API copies, worker, nginx, MongoDB, Redis):

```bash
docker compose up --build -d
```

```bash
docker compose exec api node scripts/seed.js --force
```

Then open http://localhost:8080 and log in with `patient@mediconnect.demo`, `doctor@mediconnect.demo` or `admin@mediconnect.demo` (password `demo1234`). The demo patient is already second in the demo doctor's queue for today.

**For development** (needs Node 22, plus MongoDB and Redis running locally):

```bash
cd backend && cp .env.example .env    # set the two token secrets
```

```bash
npm install && npm run seed && npm run dev    # API on :5000
```

```bash
npm run worker    # in another terminal: sends SMS and email
```

```bash
cd frontend && npm install && npm run dev    # app on :5173, proxies /api to :5000
```

Payments, SMS and email run in **test mode** until you add keys to `.env`:
- Payments: a "Pay (test mode)" button marks the booking paid.
- SMS and email: messages, including the email verification and reset links, are written to the worker's log.

## Deploy

`render.yaml` deploys the whole app as one free Render web service, with MongoDB Atlas and Redis Cloud free tiers for the databases. On the free plan the worker runs inside the API process (`RUN_WORKER_IN_API=true`); `docker-compose.yml` shows the separate-worker setup. For real payments, set the Razorpay keys and point a Razorpay webhook at `/api/v1/payments/webhook` for the `payment.captured` event.

## API

All routes are under `/api/v1`. Authentication is by httpOnly cookie.

| | Route | Who |
|---|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout` | anyone |
| | `GET`/`PUT /auth/me`, `POST /auth/change-password`, `/auth/resend-verification` | logged in |
| | `POST /auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email` | anyone |
| Doctors | `GET /doctors?q=&specialty=&minRating=&lat=&lng=&radiusKm=&cursor=`, `/doctors/specialties`, `/doctors/:id`, `/doctors/:id/slots?date=` | anyone |
| | `GET`/`PUT /doctors/me`, `PUT /doctors/me/schedule`, `DELETE /doctors/me/schedule/:date` | doctor |
| | `GET /doctors/me/appointments?date=`, `/doctors/me/patients/:patientId` | doctor |
| | `GET /doctors/me/queue`, `POST /doctors/me/queue/next` | doctor |
| Appointments | `POST /appointments`, `GET /appointments/my`, `DELETE /appointments/:id`, `POST /appointments/:id/review` | patient |
| | `GET /appointments/:id`, `GET /appointments/:id/prescription.pdf` | patient or doctor of that visit |
| | `POST /appointments/:id/prescription` | doctor of that visit |
| Payments | `POST /payments/order`, `/payments/verify`, `/payments/test-pay` (test mode only) | patient |
| | `POST /payments/webhook` | Razorpay (HMAC-signed) |
| Admin | `GET /admin/stats`, `/admin/doctors?status=`, `/admin/users?q=`, `/admin/notifications/failed` | admin |
| | `PATCH /admin/doctors/:id`, `/admin/users/:id`, `POST /admin/notifications/:id/retry` | admin |

Socket.io events:
- The client sends `queue:watch` with an appointment id.
- The server sends `queue:update` with `{ order }` to that queue's room, and `queue:called` to the patient being called.

`GET /health` checks MongoDB and Redis.

## Code layout

```text
backend/src
  app.js, server.js, worker.js
  shared/      auth (cookies, tokens, scrypt), http (errors, validation, logging, rate limit),
               redis (+ lock), socket, notify (queue + Twilio/SMTP senders), log
  modules/     auth · doctor · booking (appointments, queue, PDF) · payment (Razorpay) · admin
backend/tests  21 tests     backend/scripts  seed, race, queue-bench, scale-check
frontend/src   pages/{public,patient,doctor,admin}, components, lib (api, auth, socket)
```

## Not built, on purpose

- **Sharding.** One MongoDB replica set covers this app's volume for years. If it ever didn't, the shard key would be `doctorId`: sharding by date would put each day's traffic on one shard.
- **Real NMC licence verification.** No public API exists, so this is mocked.
- **Circuit breakers** around Twilio and Razorpay. Retries with growing delays cover a provider being down for a while.
- **Text search.** Search uses a case-insensitive match on name, specialty and clinic, which is fine for thousands of doctors. Beyond that, Atlas Search.

## License

MIT
