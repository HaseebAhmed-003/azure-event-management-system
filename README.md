# EventHub — Azure Event Management & QR Attendance System

A full-stack event management platform deployed entirely on **Microsoft Azure**. Organisers create and publish events, attendees book and pay for tickets, venue staff scan QR codes for real-time attendance, and Azure Logic Apps automatically notify attendees when an event is cancelled.

---

## Azure Infrastructure

| Resource | Type | Purpose |
|---|---|---|
| `TestIBA` | Virtual Machine (Windows) | Hosts the Node.js backend (port 3000) and React frontend (port 3001) |
| `testiba-ip` | Public IP | Static IP `20.174.16.183` — entry point for all traffic |
| `event-kv-iba` | Key Vault | Stores all secrets — DB password, JWT, Stripe, ACS connection strings |
| `event-pg-server` | PostgreSQL Flexible Server | Primary database — `event_system_db` |
| `event-comms` | Communication Service | Azure Communication Services — email dispatch hub |
| `event-email-service` | Email Communication Service | ACS verified sender domain for outbound email |
| `event-search-iba` | AI Search | Full-text event search with filters (venue, date, price) |
| `event-insights` | Application Insights | Live telemetry — HTTP requests, exceptions, dependencies |
| `ibab2cf` | Storage Account | File storage for banner images and uploads |
| `event-cancel-notify` | Logic App (Consumption) | Automated attendee notification on event cancellation |
| `IBA` | Resource Group | Container for all resources above |

**Region:** UAE North · **Subscription:** Azure for Students

---

## Architecture Overview

```
Browser (React :3001)
        │
        ▼
Azure VM — TestIBA (20.174.16.183)
   ├── Backend: Node.js / Express  :3000
   │      ├── src/lib/keyvault.js        → loads all secrets at startup from Key Vault
   │      ├── src/lib/prisma.js          → lazy Prisma client (initialised after vault)
   │      ├── src/lib/search.js          → Azure AI Search client
   │      ├── src/services/              → business logic per domain
   │      ├── src/routes/                → REST API endpoints
   │      └── src/middleware/            → JWT auth, file upload
   │
   ├── Azure Key Vault      ← secrets injected into process.env on startup
   ├── PostgreSQL           ← Prisma ORM
   ├── Azure AI Search      ← full-text search index for events
   ├── Azure ACS Email      ← booking confirmation emails with PDF + QR attachment
   ├── Azure Logic Apps     ← event cancellation notification workflow
   └── App Insights         ← live telemetry and error tracking

Azure Function (eventReport/)
   └── Timer trigger: 06:00 UTC daily — PDF attendance report emailed to organisers
```

### Critical Startup Sequence

```
node src/index.js
  └── loadSecretsFromKeyVault()        ← MUST run first (Managed Identity)
        └── ensureIndexExists()        ← bootstraps AI Search index if missing
              └── DATABASE_URL built
                    └── Routes loaded  ← Prisma safe to use here
                          └── app.listen(:3000)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express.js 4.19 |
| Database | Azure PostgreSQL Flexible Server via Prisma ORM 5.13 |
| Auth | jsonwebtoken + bcryptjs |
| Secrets | `@azure/keyvault-secrets` + `@azure/identity` (DefaultAzureCredential) |
| Search | `@azure/search-documents` (Azure AI Search) |
| Email | `@azure/communication-email` (ACS) |
| Payments | Stripe 15.7 + simulated payment toggle |
| QR / PDF | qrcode + pdfkit |
| File Upload | Multer (5 MB, JPEG/PNG/WEBP/GIF) |
| Monitoring | `applicationinsights` (Azure Monitor) |
| Automation | Azure Logic Apps (Consumption) — HTTP trigger + Foreach loop |
| Frontend | React (Create React App) + React Router + Axios |

---

## Project Structure

```
├── src/
│   ├── index.js                         # Entry — vault → search bootstrap → listen
│   ├── lib/
│   │   ├── keyvault.js                  # DefaultAzureCredential secret loader
│   │   ├── prisma.js                    # Lazy PrismaClient singleton
│   │   └── search.js                   # Azure AI Search index bootstrap
│   ├── middleware/
│   │   ├── auth.middleware.js           # JWT verify, requireOrganizer, requireAdmin
│   │   └── upload.middleware.js         # Multer — banner images
│   ├── routes/
│   │   ├── auth.routes.js               # /api/auth
│   │   ├── event.routes.js              # /api/events  (+ cancel + internal notify)
│   │   ├── booking.routes.js            # /api/bookings
│   │   ├── payment.routes.js            # /api/payments
│   │   ├── ticket.routes.js             # /api/tickets
│   │   └── attendance.routes.js         # /api/attendance
│   └── services/
│       ├── auth.service.js
│       ├── event.service.js             # cancelEvent fires Logic App trigger
│       ├── booking.service.js
│       ├── payment.service.js
│       ├── ticket.service.js
│       ├── attendance.service.js
│       ├── search.service.js            # Azure AI Search index + query
│       ├── email.service.js             # ACS — booking confirmation + cancellation email
│       └── logicapp.service.js          # HTTP trigger caller for Logic App
├── eventReport/
│   ├── index.js                         # Azure Timer Function — daily PDF reports
│   └── function.json                    # Cron: 0 0 6 * * * (06:00 UTC)
├── logic-app/
│   └── cancellation-logic-app-arm.json  # ARM template — deploys event-cancel-notify
├── scripts/
│   └── seedSearch.js                    # Seeds existing events into AI Search index
├── prisma/
│   ├── schema.prisma
│   ├── seed.js
│   └── migrations/
├── event-frontend/
│   └── src/
│       ├── api.js                       # Axios client + all API call exports
│       ├── AuthContext.js               # Global JWT auth state
│       ├── App.js                       # React Router — all 12 routes
│       ├── index.css                    # Dark-theme design system
│       ├── components/
│       │   ├── Navbar.js                # Role-aware navigation
│       │   ├── ProtectedRoute.js        # Auth + role guard
│       │   └── NotFound.js
│       └── pages/
│           ├── Home.js                  # Landing page + upcoming events
│           ├── Events.js                # Browse + search events (AI Search powered)
│           ├── EventDetail.js           # Detail page + booking form
│           ├── Login.js / Register.js
│           ├── MyBookings.js            # Attendee bookings + payment simulation
│           ├── MyTickets.js             # QR ticket viewer
│           ├── OrganizerEvents.js       # Organiser dashboard (publish / cancel / delete)
│           ├── EventForm.js             # Create / edit event
│           ├── OrganizerDashboard.js    # Per-event analytics
│           └── QRScanner.js            # Live QR scanner for venue staff
├── .env.example
└── package.json
```

---

## Azure Key Vault Secrets

All secrets live in `event-kv-iba` and are loaded automatically at startup via `DefaultAzureCredential` (VM Managed Identity — no credentials in code or `.env`).

| Key Vault Secret Name | Environment Variable | Description |
|---|---|---|
| `DB-PASSWORD` | `DB_PASSWORD` | PostgreSQL password |
| `JWT-SECRET` | `JWT_SECRET` | JWT signing secret |
| `JWT-EXPIRES-IN` | `JWT_EXPIRES_IN` | Token expiry (e.g. `7d`) |
| `STRIPE-SECRET-KEY` | `STRIPE_SECRET_KEY` | Stripe secret key |
| `ACS-CONNECTION-STRING` | `ACS_CONNECTION_STRING` | Azure Communication Services connection string |
| `EMAIL-FROM` | `EMAIL_FROM` | Verified ACS sender address |
| `SEARCH-ENDPOINT` | `SEARCH_ENDPOINT` | Azure AI Search endpoint URL |
| `SEARCH-API-KEY` | `SEARCH_API_KEY` | Azure AI Search admin key |

After loading, `keyvault.js` automatically constructs:
```
DATABASE_URL = postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:5432/{DB_NAME}?sslmode=require
```

---

## Non-Secret Environment Variables (`.env` on VM)

```env
PORT=3000
APP_BASE_URL=http://20.174.16.183:3000
FRONTEND_URL=http://20.174.16.183:3001
KEY_VAULT_URL=https://event-kv-iba.vault.azure.net/
DB_HOST=event-pg-server.postgres.database.azure.com
DB_USER=pgadmin
DB_NAME=event_system_db
UPLOAD_DIR=uploads
APPLICATIONINSIGHTS_CONNECTION_STRING=<from App Insights portal>

# Logic Apps — Event Cancellation Notification
LOGIC_APP_CANCEL_URL=<HTTP POST URL from Logic App trigger blade in Azure portal>
LOGIC_APP_SECRET=<shared secret string — must match X-Logic-App-Secret header in Logic App>
```

---

## Setup & Deployment (Azure VM)

### Step 1 — Connect to the VM via RDP
1. Azure Portal → **Virtual machines** → **TestIBA** → **Connect** → **RDP**
2. Download the `.rdp` file and open it
3. Enter your VM credentials

### Step 2 — Install and Run Backend
```bash
npm install
cp .env.example .env        # fill in non-secret values only
npx prisma migrate deploy   # applies migrations against Azure PostgreSQL
npm start                   # loads Key Vault → bootstraps Search → starts on port 3000
```

### Step 3 — Seed the AI Search Index
```bash
node scripts/seedSearch.js  # indexes existing events into Azure AI Search
```

### Step 4 — Build and Serve Frontend
```bash
cd event-frontend
npm install
npm run build
serve -s build -l 3001
```

### Step 5 — Set Up the Logic App
1. Azure Portal → **Logic Apps** → **+ Create**
   - Name: `event-cancel-notify` · Region: UAE North · Plan: Consumption
2. **Logic App Designer** → trigger: "When a HTTP request is received"
3. Paste the request body JSON schema (see `logic-app/cancellation-logic-app-arm.json`)
4. Add **For each** loop over `attendees`
5. Inside loop → **HTTP** action → `POST http://20.174.16.183:3000/api/events/internal/notify-cancellation`
6. Headers: `Content-Type: application/json`, `X-Logic-App-Secret: <your-secret>`
7. Copy the trigger HTTP POST URL → paste into `LOGIC_APP_CANCEL_URL` in `.env`
8. Restart the backend

> **ARM template alternative:** Deploy `logic-app/cancellation-logic-app-arm.json` via Azure Portal → "Deploy a custom template" for one-click setup.

### First-Time Database Setup
```bash
npx prisma migrate dev --name init   # development
npx prisma migrate deploy            # production (VM)
npm run db:seed                      # optional — creates 3 test accounts + 1 sample event
```

### Test Accounts (after seeding)
| Role | Email | Password |
|------|-------|----------|
| ADMIN | admin@eventsystem.com | admin123 |
| ORGANIZER | organizer@eventsystem.com | organizer123 |
| ATTENDEE | attendee@eventsystem.com | attendee123 |

---

## API Reference

All endpoints are prefixed with `http://20.174.16.183:3000`. Protected routes require:
`Authorization: Bearer <JWT>`

### Auth — `/api/auth`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/register` | — | Register (role: ATTENDEE or ORGANIZER) |
| POST | `/login` | — | Login, returns JWT |
| GET | `/me` | ✓ | Current user profile |
| GET | `/users` | Admin | List all users |
| PUT | `/users/:id` | ✓ | Update profile |
| DELETE | `/users/:id` | Admin | Delete user |

### Events — `/api/events`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | — | List published events (AI Search powered — `?search=&from=&to=&venue=&isFree=&minPrice=&maxPrice=`) |
| GET | `/my` | Organizer | Organiser's own events |
| GET | `/admin/all` | Admin | All events (all statuses) |
| GET | `/:id` | — | Event detail + seat availability |
| GET | `/:id/dashboard` | Organizer | Event analytics |
| POST | `/` | Organizer | Create event (status: DRAFT) |
| POST | `/:id/publish` | Organizer | Publish event |
| POST | `/:id/cancel` | Organizer | **Cancel event + trigger Logic App → notify all attendees** |
| POST | `/:id/banner` | Organizer | Upload banner image |
| PUT | `/:id` | Organizer | Update event |
| DELETE | `/:id` | Organizer | Hard-delete (DRAFT only, no confirmed bookings) |
| POST | `/internal/notify-cancellation` | Logic App secret | Internal — ACS sends one cancellation email per call |

### Bookings — `/api/bookings`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/` | ✓ | Create booking (reserves seats, status: PENDING) |
| GET | `/my` | ✓ | My bookings |
| GET | `/event/:eventId` | Organizer | All bookings for an event |
| GET | `/admin/all` | Admin | All bookings |
| GET | `/:id` | ✓ | Single booking |
| PUT | `/:id/status` | Admin | Update status manually |
| DELETE | `/:id` | ✓ | Cancel booking |

### Payments — `/api/payments`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/checkout/:bookingId` | ✓ | Create Stripe Checkout session |
| POST | `/simulate/:bookingId` | ✓ | Simulate payment (no Stripe needed) |
| POST | `/webhook` | — | Stripe webhook (raw body) |
| GET | `/booking/:bookingId` | ✓ | Get payment record |
| GET | `/admin/all` | Admin | All payments |

### Tickets — `/api/tickets`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/my` | ✓ | My tickets |
| GET | `/booking/:bookingId` | ✓ | Tickets for a booking |
| GET | `/event/:eventId` | Organizer | All tickets for event |
| GET | `/:id/qr` | ✓ | QR code as base64 PNG |
| GET | `/:id/qr/download` | ✓ | Download QR as PNG file |
| DELETE | `/:id` | ✓ | Cancel ticket (restores seat) |

### Attendance — `/api/attendance`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/scan` | Organizer | Scan QR code — returns PRESENT / DUPLICATE / INVALID |
| GET | `/event/:eventId` | Organizer | Confirmed attendees |
| GET | `/event/:eventId/all-scans` | Organizer | All scan attempts including fraud |
| GET | `/event/:eventId/summary` | Organizer | Live summary: seat fill rate, attendance rate |
| GET | `/user/:userId` | ✓ | User's attendance history |

---

## Core Workflows

### WF1 — Attendee Books a Ticket
1. `POST /api/bookings` → reserves seats atomically, status: PENDING
2. `POST /api/payments/checkout/:bookingId` → Stripe Checkout session (or simulate)
3. Stripe webhook fires `checkout.session.completed`
4. Booking → CONFIRMED · Payment → SUCCEEDED
5. QR tickets auto-generated and emailed as PDF via **Azure ACS**

### WF2 — Free Event Booking
1. `POST /api/bookings` → creates booking
2. `POST /api/payments/checkout/:bookingId` → detects `totalAmount = 0`, skips Stripe
3. Booking confirmed immediately, tickets issued and emailed via **Azure ACS**

### WF3 — QR Scan at Venue
1. Organiser opens QRScanner page on any device
2. `POST /api/attendance/scan` with `{ qrCode }`
3. System checks: valid? already scanned? cancelled?
4. Returns `{ status: PRESENT | DUPLICATE | INVALID, attendeeName, message }`
5. Ticket marked USED on first successful scan (fraud prevention)

### WF4 — Organiser Cancels Event ← NEW
1. Organiser clicks **Cancel Event** on their dashboard
2. `POST /api/events/:id/cancel` → event marked CANCELLED, all active tickets cancelled
3. Backend collects all confirmed attendees' emails from the database
4. **Azure Logic App** `event-cancel-notify` is triggered via HTTP POST
5. Logic App loops over each attendee (up to 5 concurrent) with automatic retry
6. Each iteration calls `/api/events/internal/notify-cancellation` (secret-protected)
7. Backend sends a branded "Event Cancelled" email via **Azure ACS** to that attendee
8. Response includes `notifiedAttendees` count confirming how many were queued

### WF5 — Daily Attendance Report (Azure Function)
1. Triggers daily at 06:00 UTC via timer
2. Finds all events where `eventDate <= now`, status = PUBLISHED
3. Generates PDF: tickets sold, attended, no-shows, attendance rate, revenue
4. Emails PDF to organiser; marks event COMPLETED

---

## Database Schema

Six Prisma models mapped to PostgreSQL. All foreign keys enforced at the database level.

| Model | Table | Description |
|-------|-------|-------------|
| User | users | All accounts. Role: ATTENDEE / ORGANIZER / ADMIN |
| Event | events | Events. Tracks `totalSeats` and `availableSeats` separately |
| Booking | bookings | Links user + event + quantity. Seats reserved/released atomically |
| Payment | payments | One record per booking. Stripe or simulated |
| Ticket | tickets | One row per physical ticket. Unique QR code string |
| Attendance | attendance | Scan log. `ticketId` unique — enforces one valid scan per ticket |

### Enumerations
| Enum | Values |
|------|--------|
| Role | ATTENDEE · ORGANIZER · ADMIN |
| EventStatus | DRAFT · PUBLISHED · CANCELLED · COMPLETED |
| BookingStatus | PENDING · CONFIRMED · CANCELLED · REFUNDED |
| PaymentStatus | PENDING · SUCCEEDED · FAILED · REFUNDED |
| TicketStatus | ACTIVE · USED · CANCELLED |
| AttendanceStatus | PRESENT · DUPLICATE · INVALID |

---

## User Roles
| Role | Capabilities |
|------|-------------|
| ATTENDEE | Browse events, book tickets, pay, view own tickets and bookings |
| ORGANIZER | All attendee capabilities + create / publish / cancel events, scan QR codes, view dashboards |
| ADMIN | Full access — manage users, all bookings / payments, delete attendance records |

---

## Monitoring
`event-insights` (Azure Application Insights) collects all HTTP request traces, unhandled exceptions, and external dependency calls (PostgreSQL, Stripe, ACS, Key Vault, AI Search). View in Azure Portal → `event-insights` → **Live Metrics** for real-time, or **Transaction Search** to debug specific requests.

---

## npm Scripts

### Backend (repo root)
| Script | Command | Description |
|--------|---------|-------------|
| start | `npm start` | Run backend with Node |
| dev | `npm run dev` | Run with nodemon auto-restart |
| db:migrate | `npm run db:migrate` | Create + apply Prisma migration |
| db:push | `npm run db:push` | Push schema (no migration file) |
| db:studio | `npm run db:studio` | Open Prisma Studio GUI |
| db:seed | `npm run db:seed` | Seed test accounts and sample event |

### Frontend (`event-frontend/`)
| Script | Command | Description |
|--------|---------|-------------|
| start | `npm start` | React dev server |
| build | `npm run build` | Production build |

---

## Known Limitations / Notes
- Banner images are stored locally on the VM under `uploads/banners/`. For production, connect `ibab2cf` (Azure Blob Storage) for persistent cloud storage.
- The `eventReport` Azure Function uses `nodemailer` (SMTP). For consistency, migrate it to ACS.
- CORS is locked to `20.174.16.183:3001`. Update `src/index.js` if a domain or HTTPS is added.
- The Logic App trigger URL contains a SAS signature — if the Logic App is deleted and recreated, `LOGIC_APP_CANCEL_URL` in `.env` must be updated and the backend restarted.
- AI Search falls back to Prisma full-text search automatically if `SEARCH_ENDPOINT` is not set.
