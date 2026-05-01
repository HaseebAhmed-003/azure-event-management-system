# EventHub — Azure Event Management & QR Attendance System

A full-stack event management platform built on Azure infrastructure. Organizers can create and publish events, attendees can book tickets and pay via Stripe, and venue staff can scan QR codes for real-time attendance tracking.

---

## Azure Infrastructure

| Resource | Type | Purpose |
|---|---|---|
| `TestIBA` | Virtual Machine | Hosts the Node.js backend (port 3000) and React frontend (port 3001) |
| `testiba-ip` | Public IP | Static IP `20.174.16.183` — entry point for all traffic |
| `event-kv-iba` | Key Vault | Stores all secrets (DB password, JWT, Stripe, ACS keys) |
| `event-pg-server` | PostgreSQL Flexible Server | Primary database — `event_system_db` |
| `event-comms` | Communication Service | Azure Communication Services — email dispatch |
| `event-email-service` | Email Communication Service | ACS email domain/sender configuration |
| `event-insights` | Application Insights | Live monitoring — requests, exceptions, dependencies |
| `ibab2cf` | Storage Account | File storage (banner images, uploads) |
| `IBA` | Resource Group | Container for all the above resources |

---

## Architecture Overview

```
Browser (React :3001)
        │
        ▼
Azure VM (20.174.16.183)
   ├── Backend: Node.js/Express :3000
   │      ├── src/lib/keyvault.js   → loads secrets at startup
   │      ├── src/lib/prisma.js     → lazy Prisma client (initialized after vault)
   │      ├── src/services/         → business logic
   │      ├── src/routes/           → REST API endpoints
   │      └── src/middleware/       → JWT auth, file upload
   │
   ├── Azure Key Vault  ←  secrets injected into process.env at startup
   ├── PostgreSQL       ←  Prisma ORM
   ├── Azure ACS        ←  ticket emails with PDF attachments
   └── App Insights     ←  telemetry (requests, errors, dependencies)

Azure Function (eventReport/)
   └── Timer: daily 06:00 UTC — generates PDF attendance reports, emails organizers
```

### Startup sequence (critical)

```
node src/index.js
  └── loadSecretsFromKeyVault()        ← MUST run first
        └── DATABASE_URL constructed
              └── Routes required      ← services load here, Prisma safe to use
                    └── app.listen()
```

---

## Tech Stack

**Backend**
- Node.js + Express
- Prisma ORM (PostgreSQL)
- `@azure/keyvault-secrets` + `@azure/identity` (DefaultAzureCredential)
- `applicationinsights` (Azure Monitor)
- `@azure/communication-email` (ACS email)
- Stripe (payments)
- `jsonwebtoken` + `bcryptjs` (auth)
- `qrcode` + `pdfkit` (ticket generation)
- `multer` (banner image uploads)

**Frontend**
- React (Create React App)
- React Router
- Axios

**Database**
- Azure PostgreSQL Flexible Server
- Prisma schema with 6 models: `User`, `Event`, `Booking`, `Payment`, `Ticket`, `Attendance`

---

## Project Structure

```
├── src/
│   ├── index.js                    # Entry point — vault → app startup
│   ├── lib/
│   │   ├── keyvault.js             # Loads secrets from Azure Key Vault
│   │   └── prisma.js               # Lazy PrismaClient (never top-level)
│   ├── middleware/
│   │   ├── auth.middleware.js      # JWT authenticate, requireOrganizer, requireAdmin
│   │   └── upload.middleware.js    # Multer — banner images (5MB, JPEG/PNG/WEBP/GIF)
│   ├── routes/
│   │   ├── auth.routes.js          # /api/auth
│   │   ├── event.routes.js         # /api/events
│   │   ├── booking.routes.js       # /api/bookings
│   │   ├── payment.routes.js       # /api/payments
│   │   ├── ticket.routes.js        # /api/tickets
│   │   └── attendance.routes.js    # /api/attendance
│   └── services/
│       ├── auth.service.js
│       ├── event.service.js
│       ├── booking.service.js
│       ├── payment.service.js
│       ├── ticket.service.js
│       ├── attendance.service.js
│       └── email.service.js        # ACS email + PDF ticket attachment
├── eventReport/
│   ├── index.js                    # Azure Timer Function — daily reports
│   └── function.json               # Timer trigger: 0 0 6 * * * (06:00 UTC daily)
├── prisma/
│   ├── schema.prisma
│   ├── seed.js
│   └── migrations/
├── event-frontend/                 # React app
│   └── src/
│       ├── pages/
│       │   ├── Home.js
│       │   ├── Events.js
│       │   ├── EventDetail.js
│       │   ├── EventForm.js
│       │   ├── Login.js / Register.js
│       │   ├── MyBookings.js
│       │   ├── MyTickets.js
│       │   ├── OrganizerDashboard.js
│       │   ├── OrganizerEvents.js
│       │   └── QRScanner.js
│       └── components/
├── .env.example
└── package.json
```

---

## Azure Key Vault Secrets

All secrets are stored in `event-kv-iba` and loaded automatically at startup via `DefaultAzureCredential` (Managed Identity on the VM).

| Key Vault Secret Name | env var injected | Description |
|---|---|---|
| `DB-HOST` | `DB_HOST` | PostgreSQL server hostname |
| `DB-USER` | `DB_USER` | Database username |
| `DB-NAME` | `DB_NAME` | Database name |
| `DB-PASSWORD` | `DB_PASSWORD` | Database password |
| `JWT-SECRET` | `JWT_SECRET` | JWT signing secret |
| `JWT-EXPIRES-IN` | `JWT_EXPIRES_IN` | Token expiry (e.g. `7d`) |
| `STRIPE-SECRET-KEY` | `STRIPE_SECRET_KEY` | Stripe secret key |
| `ACS-CONNECTION-STRING` | `ACS_CONNECTION_STRING` | Azure Communication Services connection string |
| `EMAIL-FROM` | `EMAIL_FROM` | Sender email address |
| `ACS-SENDER` | `ACS_SENDER` | ACS verified sender address |

After loading, `keyvault.js` automatically builds:
```
DATABASE_URL = postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:5432/{DB_NAME}?sslmode=require
```

---

## Non-Secret Environment Variables (.env)

These go in `.env` on the VM (not in Key Vault):

```env
PORT=3000
APP_BASE_URL=http://20.174.16.183:3000
KEY_VAULT_URL=https://event-kv-iba.vault.azure.net/
APPLICATIONINSIGHTS_CONNECTION_STRING=<from App Insights portal>
UPLOAD_DIR=uploads
FRONTEND_URL=http://20.174.16.183:3001
```

---

## Setup & Deployment

### Prerequisites
- Node.js 18+
- Azure VM with Managed Identity assigned (needed for Key Vault access without credentials)
- Key Vault access policy: `Get` + `List` on secrets for the VM's Managed Identity

### Install & run

```bash
# On the Azure VM
git clone <repo>
cd azure-event-management-system-feature-keyvault-fix

# Backend
npm install
cp .env.example .env          # fill in non-secret values only
npx prisma migrate deploy      # run migrations against Azure PostgreSQL
npm start                      # loads vault → starts on port 3000

# Frontend (separate terminal)
cd event-frontend
npm install
npm start                      # runs on port 3001
```

### First-time database setup

```bash
npx prisma migrate dev --name init    # development
npx prisma migrate deploy             # production (VM)
npx prisma db seed                    # optional seed data
npx prisma studio                     # visual DB browser (dev only)
```

---

## API Reference

### Auth — `/api/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/register` | — | Register (role: ATTENDEE or ORGANIZER) |
| POST | `/login` | — | Login, returns JWT |
| GET | `/me` | ✓ | Current user profile |
| GET | `/users` | Admin | List all users |
| GET | `/users/:id` | ✓ | Get user by ID |
| PUT | `/users/:id` | ✓ | Update name/email |
| DELETE | `/users/:id` | Admin | Delete user |

### Events — `/api/events`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | — | List published events (supports `?search=&from=&to=&venue=`) |
| GET | `/my` | Organizer | Organizer's own events |
| GET | `/admin/all` | Admin | All events (all statuses) |
| GET | `/:id` | — | Event detail + seat availability |
| GET | `/:id/dashboard` | Organizer | Event analytics dashboard |
| POST | `/` | Organizer | Create event (status: DRAFT) |
| POST | `/:id/publish` | Organizer | Publish event |
| POST | `/:id/banner` | Organizer | Upload banner image |
| PUT | `/:id` | Organizer | Update event |
| DELETE | `/:id` | Organizer | Delete event |

### Bookings — `/api/bookings`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/` | ✓ | Create booking (reserves seats, status: PENDING) |
| GET | `/my` | ✓ | My bookings |
| GET | `/event/:eventId` | Organizer | All bookings for an event |
| GET | `/admin/all` | Admin | All bookings |
| GET | `/:id` | ✓ | Single booking |
| PUT | `/:id/status` | Admin | Manually update status |
| DELETE | `/:id` | ✓ | Cancel booking |

### Payments — `/api/payments`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/checkout/:bookingId` | ✓ | Create Stripe Checkout session |
| POST | `/simulate/:bookingId` | ✓ | Simulate payment (no Stripe needed for testing) |
| POST | `/webhook` | — | Stripe webhook (raw body required) |
| GET | `/success` | — | Stripe success redirect |
| GET | `/cancel` | — | Stripe cancel redirect |
| GET | `/booking/:bookingId` | ✓ | Get payment record |
| GET | `/admin/all` | Admin | All payments |

### Tickets — `/api/tickets`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/my` | ✓ | My tickets |
| GET | `/booking/:bookingId` | ✓ | Tickets for a booking |
| GET | `/event/:eventId` | Organizer | All tickets for event |
| GET | `/:id` | ✓ | Single ticket |
| GET | `/:id/qr` | ✓ | QR code as base64 PNG |
| GET | `/:id/qr/download` | ✓ | Download QR as PNG file |
| PUT | `/:id` | Organizer | Update seat number / status |
| DELETE | `/:id` | ✓ | Cancel ticket (restores seat) |

### Attendance — `/api/attendance`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/scan` | Organizer | Scan QR code at venue entrance |
| GET | `/event/:eventId` | Organizer | Confirmed attendees (PRESENT only) |
| GET | `/event/:eventId/all-scans` | Organizer | All scan attempts (including DUPLICATE, INVALID) |
| GET | `/event/:eventId/summary` | Organizer | Live summary: seats, attendance rate, fraud attempts |
| GET | `/user/:userId` | ✓ | User's attendance history |
| GET | `/:id` | Organizer | Single attendance record |
| PUT | `/:id` | Organizer | Update notes |
| DELETE | `/:id` | Admin | Delete record (resets ticket to ACTIVE) |

---

## User Roles

| Role | Capabilities |
|---|---|
| `ATTENDEE` | Browse events, book tickets, view own tickets/bookings, view attendance history |
| `ORGANIZER` | All attendee capabilities + create/publish/manage events, scan QR codes, view event dashboards |
| `ADMIN` | Full access — manage users, view all bookings/payments, delete attendance records |

---

## Core Workflows

### Workflow 1 — Attendee books a ticket
1. `POST /api/bookings` — creates booking, decrements `availableSeats`, status: PENDING
2. `POST /api/payments/checkout/:bookingId` — Stripe Checkout session created
3. Stripe webhook fires `checkout.session.completed`
4. Booking → CONFIRMED, Payment → SUCCEEDED
5. QR tickets generated automatically, emailed as PDF via ACS

### Workflow 2 — Free event booking
1. `POST /api/bookings` — creates booking
2. `POST /api/payments/checkout/:bookingId` — detects `totalAmount = 0`, skips Stripe
3. Booking confirmed immediately, tickets issued and emailed

### Workflow 3 — QR scan at venue
1. Organizer opens QRScanner page on any device
2. `POST /api/attendance/scan` with `{ qrCode }` body
3. System checks: is ticket valid? already scanned? cancelled?
4. Returns `{ success, status, attendeeName, message }` — status is PRESENT / DUPLICATE / INVALID
5. Ticket marked USED if PRESENT

### Workflow 4 — Daily event report (Azure Function)
- Triggers daily at 06:00 UTC
- Finds all events where `eventDate <= now` and status = PUBLISHED
- Generates PDF report: tickets sold, attended, no-shows, attendance rate, revenue
- Emails PDF to organizer
- Updates event status to COMPLETED

---

## Monitoring (App Insights)

`event-insights` collects:
- HTTP request traces (all routes)
- Unhandled exceptions
- External dependency calls (PostgreSQL, Stripe, ACS, Key Vault)

View in Azure Portal → `event-insights` → **Live Metrics** for real-time, or **Transaction Search** to debug specific requests.

---

## Database Schema (Summary)

```
User ──< Event (organizer)
User ──< Booking
User ──< Ticket
User ──< Attendance (scannedBy)

Event ──< Booking
Event ──< Ticket
Event ──< Attendance

Booking ──1 Payment
Booking ──< Ticket

Ticket ──1 Attendance
```

Enums: `Role` (ATTENDEE/ORGANIZER/ADMIN), `EventStatus` (DRAFT/PUBLISHED/CANCELLED/COMPLETED), `BookingStatus`, `PaymentStatus`, `TicketStatus`, `AttendanceStatus`

---

## Known Limitations / Notes

- Banner images are stored locally on the VM under `uploads/banners/`. For production, wire `ibab2cf` (Azure Blob Storage) instead.
- The `eventReport` Azure Function uses `nodemailer` (SMTP) while the main app uses ACS. Both work but it is cleaner to use ACS everywhere.
- CORS is currently locked to `20.174.16.183:3001`. Update `src/index.js` if you add a domain or HTTPS.
- Stripe webhooks require the `STRIPE_WEBHOOK_SECRET` env variable. For local testing use the Stripe CLI: `stripe listen --forward-to localhost:3000/api/payments/webhook`.
