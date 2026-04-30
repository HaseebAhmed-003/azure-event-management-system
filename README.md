# Event Ticketing System — Backend API

**Milestone 3 — Backend Implementation**
**Web-Based Application Development**

**Group Members:** Haseeb Ahmed · Fatima Naeem · Afaf Irfan

---

## 1. Project Overview

This is the backend for an Event Ticketing System built for Milestone 3 of the Web-Based Application Development course. The system supports three fully implemented backend workflows:

| Workflow | Description |
|----------|-------------|
| WF1 — User Ticket Booking | Event browsing with search and filters, seat reservation with availability check, simulated payment toggle, QR ticket generation, and automated email confirmation. |
| WF2 — Organizer Event Creation | Organizer-only dashboard, event form with server-side validation, image/banner upload, seat capacity control, and one-click publish to the public catalogue. |
| WF3 — QR Scanning and Attendance | QR code scan pipeline with duplicate fraud prevention, real-time attendance summary, and per-user attendance history. |

---

## 2. Technology Stack

| Layer | Technology | Version / Notes |
|-------|------------|-----------------|
| Runtime | Node.js | 18 or higher |
| Framework | Express.js | 4.19 |
| Database | PostgreSQL | 14 or higher |
| ORM | Prisma | 5.13 |
| Auth | jsonwebtoken + bcryptjs | 9.0 / 2.4 |
| QR Codes | qrcode | 1.5 |
| Email | Nodemailer | 6.9 — SMTP-based HTML email |
| Payments | Stripe + simulated toggle endpoint | 15.7 |
| File Upload | Multer | 1.4 — images up to 5 MB |

---

## 3. Prerequisites

- Node.js v18 or higher — https://nodejs.org
- PostgreSQL 14 or higher running locally or on a remote host
- npm (bundled with Node.js)
- A Gmail account or any SMTP provider — optional; email is skipped gracefully when not configured
- A Stripe account — optional; the simulated payment endpoint works without Stripe credentials

---

## 4. Installation and Setup

### Step 1 — Clone the Repository
```bash
git clone https://github.com/fatimanaeem2004/Web_Development_Project.git
cd Web_Development_Project
```

### Step 2 — Install Dependencies
```bash
npm install
```

### Step 3 — Configure Environment Variables

Copy the example file and edit the values for your local environment:
```bash
cp .env.example .env
```

| Variable | Description | Example Value |
|----------|-------------|---------------|
| DATABASE_URL | PostgreSQL connection string | postgresql://postgres:password@localhost:5432/event_system_db |
| JWT_SECRET | Secret key for signing JWT tokens | a-long-random-secret-string |
| JWT_EXPIRES_IN | Token lifetime | 7d |
| PORT | Express server port | 3000 |
| APP_BASE_URL | Base URL for redirect and email links | http://localhost:3000 |
| SMTP_HOST | SMTP server host (optional) | smtp.gmail.com |
| SMTP_PORT | SMTP port (optional) | 587 |
| SMTP_USER | SMTP login email (optional) | your_email@gmail.com |
| SMTP_PASS | SMTP app password (optional) | your_app_password |
| EMAIL_FROM | Sender address for confirmation emails | your_email@gmail.com |
| STRIPE_SECRET_KEY | Stripe secret key (optional) | sk_test_... |
| STRIPE_WEBHOOK_SECRET | Stripe webhook signing secret (optional) | whsec_... |
| UPLOAD_DIR | Folder for uploaded banner images | uploads |

> SMTP and Stripe keys are optional for local testing. Email sending is skipped gracefully when SMTP_USER/SMTP_PASS are absent. The simulated payment endpoint confirms bookings without any Stripe credentials.

### Step 4 — Create the Database and Run Migrations
```bash
# Create the PostgreSQL database:
createdb event_system_db

# Apply Prisma migrations (creates all tables):
npx prisma migrate dev --name init

# Alternative — push schema without migration history:
npx prisma db push
```

### Step 5 — Seed Test Data

The seed script creates three test accounts (one per role) and one sample published event:
```bash
npm run db:seed
```

| Role | Email | Password |
|------|-------|----------|
| ADMIN | admin@eventsystem.com | admin123 |
| ORGANIZER | organizer@eventsystem.com | organizer123 |
| ATTENDEE | attendee@eventsystem.com | attendee123 |

### Step 6 — Start the Server
```bash
# Development (auto-restart on save):
npm run dev

# Production:
npm start
```

The server starts at **http://localhost:3000**

A root endpoint `GET /` lists all route prefixes. A health check is available at `GET /health`.

---

## 5. Project Structure

| Path | Description |
|------|-------------|
| `src/index.js` | Express app entry point — registers all route modules and middleware |
| `src/routes/auth.routes.js` | Register, login, and user management endpoints |
| `src/routes/event.routes.js` | Event CRUD, search/filter, banner upload, publish |
| `src/routes/booking.routes.js` | Seat reservation and booking lifecycle management |
| `src/routes/payment.routes.js` | Stripe checkout, webhook handler, simulated payment |
| `src/routes/ticket.routes.js` | QR ticket listing, base64 image, and PNG download |
| `src/routes/attendance.routes.js` | QR scan, attendance tracking, dashboard summary |
| `src/services/auth.service.js` | Register, login, and user CRUD business logic |
| `src/services/event.service.js` | Event creation, validation, seat management, search |
| `src/services/booking.service.js` | Booking lifecycle, atomic seat reservation/release |
| `src/services/payment.service.js` | Stripe integration, webhook processing, simulated flow |
| `src/services/ticket.service.js` | Per-ticket QR code generation (UUID-based), CRUD |
| `src/services/attendance.service.js` | Scan pipeline, duplicate prevention, attendance summaries |
| `src/services/email.service.js` | HTML email with embedded QR images via Nodemailer |
| `src/middleware/auth.middleware.js` | JWT verification, requireOrganizer, requireAdmin guards |
| `src/middleware/upload.middleware.js` | Multer config — JPEG/PNG/WEBP/GIF, 5 MB limit |
| `src/lib/prisma.js` | Prisma client singleton with query logging in dev mode |
| `prisma/schema.prisma` | Database schema — 6 models and 6 enums |
| `prisma/migrations/` | Auto-generated SQL migration files |
| `prisma/seed.js` | Seeds test accounts and one sample event |
| `.env.example` | Environment variable template |

---

## 6. Database Schema Overview

Six Prisma models map to PostgreSQL tables. All foreign keys are enforced at the database level.

| Model | Table | Purpose |
|-------|-------|---------|
| User | users | All user accounts. Role: ATTENDEE, ORGANIZER, or ADMIN. Soft-delete via isActive flag. |
| Event | events | Events created by organisers. Tracks totalSeats and availableSeats separately for real-time inventory. |
| Booking | bookings | Links a user to an event and a quantity. Seats are reserved on creation and released on cancellation or payment failure. |
| Payment | payments | One payment record per booking. Supports Stripe session IDs and the simulated payment toggle. |
| Ticket | tickets | One row per individual ticket. Contains a unique QR code string generated from ticket ID, event ID, user ID, and a UUID. |
| Attendance | attendance | Scan log for every QR scan attempt. Status values: PRESENT, DUPLICATE, INVALID. ticketId is unique to enforce one valid entry per ticket. |

### Enumerations

| Enum | Allowed Values |
|------|---------------|
| Role | ATTENDEE · ORGANIZER · ADMIN |
| EventStatus | DRAFT · PUBLISHED · CANCELLED · COMPLETED |
| BookingStatus | PENDING · CONFIRMED · CANCELLED · REFUNDED |
| PaymentStatus | PENDING · SUCCEEDED · FAILED · REFUNDED |
| TicketStatus | ACTIVE · USED · CANCELLED |
| AttendanceStatus | PRESENT · DUPLICATE · INVALID |

---

## 7. Available npm Scripts

| Script | Command | Description |
|--------|---------|-------------|
| start | `npm start` | Run server with Node.js |
| dev | `npm run dev` | Run with nodemon — auto-restarts on file changes |
| db:migrate | `npm run db:migrate` | Create and apply a new Prisma migration |
| db:push | `npm run db:push` | Push schema directly to DB (no migration file) |
| db:studio | `npm run db:studio` | Open Prisma Studio — browser-based DB GUI |
| db:seed | `npm run db:seed` | Seed test user accounts and sample event |

---

## 8. Version Control Summary

| Practice | Implementation Detail |
|----------|-----------------------|
| Branching | Separate branches per member and workflow: `fatima/feature/auth-and-setup`, `feature/events-bookings-payments`, `feature/tickets-qr-attendance/afaf`, `fix/decimal-seat-validation` |
| Pull Requests | All features merged to main via pull requests. No direct pushes to main branch. |
| Commit Messages | Consistently prefixed: `feat:` for new features, `fix:` for bug fixes, `docs:` for documentation, `chore:` for config changes. |
| Collaboration | All three group members contributed to the commits. Work divided clearly by workflow and responsibility. |
| Final State | All pull requests merged into main before submission deadline. Code in other branches was not submitted. |



---

## 9. API Endpoints

All endpoints are prefixed with `http://localhost:3000`. Protected routes require the header:
`Authorization: Bearer YOUR_JWT_TOKEN`

---

### 9.1 Authentication — `/api/auth`

---

#### POST `/api/auth/register`
Register a new user account.

**Auth required:** No

**Request body:**
```json
{
  "name": "Fatima Naeem",
  "email": "fatima@test.com",
  "password": "password123",
  "role": "ATTENDEE"
}
```
> `role` is optional. Accepted values: `ATTENDEE`, `ORGANIZER`, `ADMIN`. Defaults to `ATTENDEE`.

**Example response (201):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "Fatima Naeem",
    "email": "fatima@test.com",
    "role": "ATTENDEE"
  }
}
```

---

#### POST `/api/auth/login`
Login and receive a JWT token.

**Auth required:** No

**Request body:**
```json
{
  "email": "fatima@test.com",
  "password": "password123"
}
```

**Example response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "Fatima Naeem",
    "email": "fatima@test.com",
    "role": "ATTENDEE"
  }
}
```

---

#### GET `/api/auth/me`
Get the currently logged-in user's profile.

**Auth required:** Yes

**Example response (200):**
```json
{
  "id": 1,
  "name": "Fatima Naeem",
  "email": "fatima@test.com",
  "role": "ATTENDEE",
  "createdAt": "2026-01-01T10:00:00.000Z"
}
```

---

#### GET `/api/auth/users`
List all users. Admin only.

**Auth required:** Yes (ADMIN)

**Query params (optional):** `?skip=0&take=50`

**Example response (200):**
```json
[
  { "id": 1, "name": "Fatima Naeem", "email": "fatima@test.com", "role": "ATTENDEE" },
  { "id": 2, "name": "Haseeb Ahmed", "email": "haseeb@test.com", "role": "ORGANIZER" }
]
```

---

#### GET `/api/auth/users/:id`
Get a single user by ID.

**Auth required:** Yes

**Example response (200):**
```json
{
  "id": 2,
  "name": "Haseeb Ahmed",
  "email": "haseeb@test.com",
  "role": "ORGANIZER"
}
```

---

#### PUT `/api/auth/users/:id`
Update a user profile. Users can only update their own profile. Admins can update anyone.

**Auth required:** Yes

**Request body (all fields optional):**
```json
{
  "name": "Haseeb Ahmed Updated",
  "email": "newemail@test.com"
}
```

**Example response (200):**
```json
{
  "id": 2,
  "name": "Haseeb Ahmed Updated",
  "email": "newemail@test.com",
  "role": "ORGANIZER"
}
```

---

#### DELETE `/api/auth/users/:id`
Deactivate a user account. Admin only.

**Auth required:** Yes (ADMIN)

**Example response (200):**
```json
{
  "message": "User 2 deactivated"
}
```

---

### 9.2 Events — `/api/events`

---

#### GET `/api/events`
Browse all published events. Supports search and filtering.

**Auth required:** No

**Query params (all optional):**

| Param | Description | Example |
|-------|-------------|---------|
| `search` | Filter by title or description keyword | `?search=tech` |
| `venue` | Filter by venue name | `?venue=karachi` |
| `from` | Filter events on or after this date | `?from=2026-01-01` |
| `to` | Filter events on or before this date | `?to=2026-12-31` |
| `skip` | Pagination offset | `?skip=0` |
| `take` | Number of results to return | `?take=20` |

**Example response (200):**
```json
{
  "events": [
    {
      "id": 1,
      "title": "Tech Conference Karachi",
      "venue": "Karachi Expo Center",
      "eventDate": "2026-12-01T10:00:00.000Z",
      "ticketPrice": 500,
      "availableSeats": 98,
      "totalSeats": 100,
      "status": "PUBLISHED"
    }
  ],
  "total": 1,
  "skip": 0,
  "take": 50
}
```

---

#### GET `/api/events/:id`
Get a single event with real-time seat availability.

**Auth required:** No

**Example response (200):**
```json
{
  "id": 1,
  "title": "Tech Conference Karachi",
  "venue": "Karachi Expo Center",
  "eventDate": "2026-12-01T10:00:00.000Z",
  "ticketPrice": 500,
  "totalSeats": 100,
  "availableSeats": 98,
  "seatsSold": 2,
  "seatsAvailable": 98,
  "isSoldOut": false,
  "status": "PUBLISHED"
}
```

---

#### POST `/api/events`
Create a new event. Organizer only.

**Auth required:** Yes (ORGANIZER)

**Request body:**
```json
{
  "title": "Tech Conference Karachi",
  "description": "Annual tech meetup",
  "venue": "Karachi Expo Center",
  "eventDate": "2026-12-01T10:00:00.000Z",
  "totalSeats": 100,
  "ticketPrice": 500
}
```
> `ticketPrice` set to `0` makes the event free. `description` is optional.

**Example response (201):**
```json
{
  "id": 1,
  "title": "Tech Conference Karachi",
  "status": "DRAFT",
  "totalSeats": 100,
  "availableSeats": 100,
  "ticketPrice": 500,
  "organizer": { "id": 2, "name": "Haseeb Ahmed" }
}
```

---

#### PUT `/api/events/:id`
Update an event. Only the organizer who created it can update it.

**Auth required:** Yes (ORGANIZER)

**Request body (all fields optional):**
```json
{
  "title": "Updated Title",
  "venue": "New Venue",
  "totalSeats": 150,
  "ticketPrice": 750
}
```

**Example response (200):**
```json
{
  "id": 1,
  "title": "Updated Title",
  "venue": "New Venue",
  "totalSeats": 150,
  "status": "DRAFT"
}
```

---

#### POST `/api/events/:id/publish`
Publish a DRAFT event so it appears in the public listing.

**Auth required:** Yes (ORGANIZER)

**No request body needed.**

**Example response (200):**
```json
{
  "id": 1,
  "title": "Tech Conference Karachi",
  "status": "PUBLISHED"
}
```

---

#### POST `/api/events/:id/banner`
Upload a banner image for an event. Send as `multipart/form-data`.

**Auth required:** Yes (ORGANIZER)

**Form field:** `banner` — image file (JPEG, PNG, WEBP, or GIF, max 5 MB)

**Example response (200):**
```json
{
  "id": 1,
  "title": "Tech Conference Karachi",
  "bannerUrl": "http://localhost:3000/uploads/banners/1735000000000-123456789.jpg"
}
```

---

#### GET `/api/events/:id/dashboard`
Get attendance and revenue stats for an event. Only the event's organizer can access this.

**Auth required:** Yes (ORGANIZER)

**Example response (200):**
```json
{
  "event": { "id": 1, "title": "Tech Conference Karachi" },
  "stats": {
    "totalBookings": 3,
    "confirmedBookings": 2,
    "totalRevenue": 1000,
    "ticketsSold": 2,
    "seatsRemaining": 98,
    "attendedCount": 1,
    "notYetArrived": 1,
    "fillRatePct": 2
  }
}
```

---

#### GET `/api/events/my`
List all events created by the logged-in organizer.

**Auth required:** Yes (ORGANIZER)

**Example response (200):**
```json
[
  { "id": 1, "title": "Tech Conference Karachi", "status": "PUBLISHED" },
  { "id": 2, "title": "Art Workshop", "status": "DRAFT" }
]
```

---

#### DELETE `/api/events/:id`
Cancel an event (sets status to CANCELLED).

**Auth required:** Yes (ORGANIZER)

**Example response (200):**
```json
{
  "message": "Event 'Tech Conference Karachi' cancelled"
}
```

---

### 9.3 Bookings — `/api/bookings`

---

#### POST `/api/bookings`
Create a booking and reserve seats. Seats are held immediately.

**Auth required:** Yes (ATTENDEE)

**Request body:**
```json
{
  "eventId": 1,
  "quantity": 2
}
```
> `quantity` must be between 1 and 10.

**Example response (201):**
```json
{
  "id": 1,
  "userId": 5,
  "eventId": 1,
  "quantity": 2,
  "totalAmount": 1000,
  "status": "PENDING",
  "event": { "id": 1, "title": "Tech Conference Karachi" }
}
```

---

#### GET `/api/bookings/my`
List all bookings made by the logged-in user.

**Auth required:** Yes

**Example response (200):**
```json
[
  {
    "id": 1,
    "quantity": 2,
    "totalAmount": 1000,
    "status": "CONFIRMED",
    "event": { "title": "Tech Conference Karachi", "eventDate": "2026-12-01T10:00:00.000Z" },
    "tickets": [ { "id": 1, "qrCode": "TKT-1-EVT-1-USR-5-BKG-1-..." } ]
  }
]
```

---

#### GET `/api/bookings/:id`
Get a single booking by ID. Users can only view their own bookings.

**Auth required:** Yes

**Example response (200):**
```json
{
  "id": 1,
  "quantity": 2,
  "totalAmount": 1000,
  "status": "CONFIRMED",
  "payment": { "status": "SUCCEEDED", "paidAt": "2026-11-01T12:00:00.000Z" },
  "tickets": [ { "id": 1 }, { "id": 2 } ]
}
```

---

#### GET `/api/bookings/event/:eventId`
List all bookings for a specific event. Organizer only.

**Auth required:** Yes (ORGANIZER)

**Example response (200):**
```json
[
  {
    "id": 1,
    "quantity": 2,
    "status": "CONFIRMED",
    "user": { "name": "Afaf Irfan", "email": "afaf@test.com" }
  }
]
```

---

#### DELETE `/api/bookings/:id`
Cancel a booking. Users can only cancel their own bookings.

**Auth required:** Yes

**Example response (200):**
```json
{
  "message": "Booking 1 cancelled"
}
```

---

### 9.4 Payments — `/api/payments`

---

#### POST `/api/payments/simulate/:bookingId`
Simulate a payment confirmation or failure without Stripe. This is the primary payment method for demos and testing.

**Auth required:** Yes

**Request body:**
```json
{
  "success": true
}
```
> Set `"success": false` to simulate a failed payment — the booking is cancelled and seats are restored.

**Example response when success is true (200):**
```json
{
  "success": true,
  "message": "Simulated payment success — booking confirmed, tickets generated, email sent",
  "bookingId": 1,
  "ticketsGenerated": 2,
  "tickets": [
    { "id": 1, "qrCode": "TKT-1-EVT-1-USR-5-BKG-1-8e56ce52-...", "seatNumber": "GEN-1" },
    { "id": 2, "qrCode": "TKT-2-EVT-1-USR-5-BKG-1-0c184b13-...", "seatNumber": "GEN-2" }
  ]
}
```

**Example response when success is false (200):**
```json
{
  "success": false,
  "message": "Simulated payment failure — booking cancelled, seats restored",
  "bookingId": 1
}
```

---

#### POST `/api/payments/checkout/:bookingId`
Create a real Stripe Checkout session. Requires `STRIPE_SECRET_KEY` in `.env`.

**Auth required:** Yes

**No request body needed.**

**Example response (200):**
```json
{
  "checkoutUrl": "https://checkout.stripe.com/pay/cs_test_...",
  "stripeSessionId": "cs_test_...",
  "bookingId": 1
}
```

---

#### GET `/api/payments/booking/:bookingId`
Get the payment record for a booking.

**Auth required:** Yes

**Example response (200):**
```json
{
  "id": 1,
  "bookingId": 1,
  "amount": 1000,
  "currency": "usd",
  "status": "SUCCEEDED",
  "paidAt": "2026-11-01T12:00:00.000Z"
}
```

---

### 9.5 Tickets — `/api/tickets`

---

#### GET `/api/tickets/my`
List all tickets belonging to the logged-in user.

**Auth required:** Yes

**Example response (200):**
```json
[
  {
    "id": 1,
    "qrCode": "TKT-1-EVT-1-USR-5-BKG-1-8e56ce52-...",
    "seatNumber": "GEN-1",
    "status": "ACTIVE",
    "issuedAt": "2026-11-01T12:00:00.000Z",
    "event": { "title": "Tech Conference Karachi", "venue": "Karachi Expo Center" }
  }
]
```

---

#### GET `/api/tickets/:id`
Get a single ticket by ID.

**Auth required:** Yes (own ticket, or ORGANIZER/ADMIN)

**Example response (200):**
```json
{
  "id": 1,
  "qrCode": "TKT-1-EVT-1-USR-5-BKG-1-8e56ce52-...",
  "seatNumber": "GEN-1",
  "status": "ACTIVE",
  "event": { "title": "Tech Conference Karachi" },
  "user": { "name": "Afaf Irfan" }
}
```

---

#### GET `/api/tickets/:id/qr`
Get the ticket's QR code as a base64 PNG image string (for displaying in a frontend).

**Auth required:** Yes (own ticket, or ORGANIZER/ADMIN)

**Example response (200):**
```json
{
  "id": 1,
  "qrCode": "TKT-1-EVT-1-USR-5-BKG-1-...",
  "qrImageBase64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

---

#### GET `/api/tickets/:id/qr/download`
Download the QR code as a PNG file directly to your computer.

**Auth required:** Yes (own ticket, or ORGANIZER/ADMIN)

**No request body needed.**

> In Postman: click the dropdown arrow next to Send → click **"Send and Download"** → save as `ticket-1-qr.png`. Open the file to see the QR code image.

**Response:** Binary PNG file download (`ticket-N-qr.png`)

---

#### GET `/api/tickets/booking/:bookingId`
List all tickets for a specific booking.

**Auth required:** Yes

**Example response (200):**
```json
[
  { "id": 1, "qrCode": "TKT-1-...", "seatNumber": "GEN-1", "status": "ACTIVE" },
  { "id": 2, "qrCode": "TKT-2-...", "seatNumber": "GEN-2", "status": "ACTIVE" }
]
```

---

#### GET `/api/tickets/event/:eventId`
List all tickets issued for an event. Organizer only.

**Auth required:** Yes (ORGANIZER)

**Example response (200):**
```json
[
  {
    "id": 1,
    "seatNumber": "GEN-1",
    "status": "USED",
    "user": { "name": "Afaf Irfan", "email": "afaf@test.com" }
  }
]
```

---

#### DELETE `/api/tickets/:id`
Cancel a ticket and restore one seat to the event.

**Auth required:** Yes (own ticket, or ORGANIZER/ADMIN)

**Example response (200):**
```json
{
  "message": "Ticket 1 cancelled"
}
```

---

### 9.6 Attendance — `/api/attendance`

---

#### POST `/api/attendance/scan`
Scan a QR code to mark an attendee as present. The full validation pipeline runs: ticket lookup → duplicate check → status check → mark USED → record attendance.

**Auth required:** Yes (ORGANIZER)

**Request body:**
```json
{
  "qrCode": "TKT-1-EVT-1-USR-5-BKG-1-8e56ce52-be08-4c57-89fe-defb1a60a167"
}
```

**Example response — valid scan (200):**
```json
{
  "success": true,
  "status": "PRESENT",
  "message": "Entry allowed — attendance marked successfully",
  "ticketId": 1,
  "eventId": 1,
  "attendeeName": "Afaf Irfan",
  "seatNumber": "GEN-1",
  "scanTime": "2026-12-01T10:15:00.000Z"
}
```

**Example response — duplicate scan (200):**
```json
{
  "success": false,
  "status": "DUPLICATE",
  "message": "Duplicate entry blocked — this ticket has already been scanned",
  "ticketId": 1
}
```

**Example response — invalid QR (200):**
```json
{
  "success": false,
  "status": "INVALID",
  "message": "Invalid QR code — not found in system"
}
```

---

#### GET `/api/attendance/event/:eventId`
List all confirmed attendees (PRESENT scans only) for an event.

**Auth required:** Yes (ORGANIZER)

**Example response (200):**
```json
[
  {
    "id": 1,
    "status": "PRESENT",
    "scanTime": "2026-12-01T10:15:00.000Z",
    "ticket": {
      "seatNumber": "GEN-1",
      "user": { "name": "Afaf Irfan", "email": "afaf@test.com" }
    }
  }
]
```

---

#### GET `/api/attendance/event/:eventId/summary`
Get real-time attendance stats for an event.

**Auth required:** Yes (ORGANIZER)

**Example response (200):**
```json
{
  "eventId": 1,
  "eventTitle": "Tech Conference Karachi",
  "totalSeats": 100,
  "availableSeats": 98,
  "attended": 1,
  "totalScanAttempts": 3,
  "duplicateAttemptsBlocked": 2,
  "invalidAttempts": 0
}
```

---

#### GET `/api/attendance/event/:eventId/all-scans`
List every scan attempt for an event including duplicates and invalid scans. Useful for fraud auditing.

**Auth required:** Yes (ORGANIZER)

**Example response (200):**
```json
[
  { "id": 1, "status": "PRESENT", "scanTime": "2026-12-01T10:15:00.000Z" },
  { "id": 2, "status": "DUPLICATE", "scanTime": "2026-12-01T10:16:00.000Z" },
  { "id": 3, "status": "INVALID", "scanTime": "2026-12-01T10:17:00.000Z" }
]
```

---

#### GET `/api/attendance/user/:userId`
Get all events a user has attended (their personal attendance history).

**Auth required:** Yes (own history, or ORGANIZER/ADMIN)

**Example response (200):**
```json
{
  "userId": 5,
  "totalEventsAttended": 2,
  "history": [
    {
      "attendanceId": 1,
      "scanTime": "2026-12-01T10:15:00.000Z",
      "event": {
        "id": 1,
        "title": "Tech Conference Karachi",
        "venue": "Karachi Expo Center",
        "eventDate": "2026-12-01T10:00:00.000Z"
      },
      "ticket": { "id": 1, "seatNumber": "GEN-1" }
    }
  ]
}
```

---

#### GET `/api/attendance/:id`
Get a single attendance record by ID.

**Auth required:** Yes (ORGANIZER)

**Example response (200):**
```json
{
  "id": 1,
  "status": "PRESENT",
  "scanTime": "2026-12-01T10:15:00.000Z",
  "notes": "Entry granted",
  "ticket": { "id": 1, "qrCode": "TKT-1-..." }
}
```

---

#### DELETE `/api/attendance/:id`
Delete an attendance record and reset the linked ticket back to ACTIVE. Admin only.

**Auth required:** Yes (ADMIN)

**Example response (200):**
```json
{
  "message": "Attendance record 1 deleted"
}
```

---

### 9.7 Quick Reference — All Routes

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login and get token |
| GET | `/api/auth/me` | Yes | Get current user |
| GET | `/api/auth/users` | Admin | List all users |
| GET | `/api/auth/users/:id` | Yes | Get user by ID |
| PUT | `/api/auth/users/:id` | Yes | Update user |
| DELETE | `/api/auth/users/:id` | Admin | Deactivate user |
| GET | `/api/events` | No | Browse/search events |
| GET | `/api/events/:id` | No | Get event with seat status |
| POST | `/api/events` | Organizer | Create event |
| PUT | `/api/events/:id` | Organizer | Update event |
| POST | `/api/events/:id/publish` | Organizer | Publish event |
| POST | `/api/events/:id/banner` | Organizer | Upload banner image |
| GET | `/api/events/:id/dashboard` | Organizer | Get event stats |
| GET | `/api/events/my` | Organizer | My events |
| DELETE | `/api/events/:id` | Organizer | Cancel event |
| POST | `/api/bookings` | Yes | Create booking |
| GET | `/api/bookings/my` | Yes | My bookings |
| GET | `/api/bookings/:id` | Yes | Get booking |
| GET | `/api/bookings/event/:eventId` | Organizer | Bookings for event |
| DELETE | `/api/bookings/:id` | Yes | Cancel booking |
| POST | `/api/payments/simulate/:bookingId` | Yes | Simulate payment (no Stripe) |
| POST | `/api/payments/checkout/:bookingId` | Yes | Create Stripe checkout |
| GET | `/api/payments/booking/:bookingId` | Yes | Get payment record |
| GET | `/api/tickets/my` | Yes | My tickets |
| GET | `/api/tickets/:id` | Yes | Get ticket |
| GET | `/api/tickets/:id/qr` | Yes | Get QR as base64 image |
| GET | `/api/tickets/:id/qr/download` | Yes | Download QR as PNG file |
| GET | `/api/tickets/booking/:bookingId` | Yes | Tickets for booking |
| GET | `/api/tickets/event/:eventId` | Organizer | Tickets for event |
| DELETE | `/api/tickets/:id` | Yes | Cancel ticket |
| POST | `/api/attendance/scan` | Organizer | Scan QR code |
| GET | `/api/attendance/event/:eventId` | Organizer | Confirmed attendees |
| GET | `/api/attendance/event/:eventId/summary` | Organizer | Attendance stats |
| GET | `/api/attendance/event/:eventId/all-scans` | Organizer | All scan attempts |
| GET | `/api/attendance/user/:userId` | Yes | User attendance history |
| GET | `/api/attendance/:id` | Organizer | Get attendance record |
| DELETE | `/api/attendance/:id` | Admin | Delete attendance record |






Milestone 4 — Frontend Implementation and Integration*
Web-Based Application Development*

Group Members: Fatima Naeem · Haseeb Ahmed · Afaf Irfan

---

## 1. Project Overview

EventHub is a full-stack web application for managing events, bookings, payments, and QR-based attendance tracking. It supports three user roles — Attendee, Organizer, and Admin — each with their own protected workflows.

The React frontend connects to an Express/PostgreSQL backend via a JWT-authenticated REST API. All core workflows are fully implemented end-to-end: browsing and booking events, simulated payment and ticket generation, organizer event management, and real-time QR scan attendance.

---

## 2. Implemented Features

### Attendee Workflows
- Browse and search published events with keyword, venue, and date filters
- View event details with real-time seat availability
- Book tickets (1–10 seats) with instant seat reservation
- Simulate payment confirmation or failure
- Receive QR-code tickets after confirmed payment
- View and manage personal bookings and tickets
- Cancel bookings with automatic seat restoration

### Organizer Workflows
- Create and manage events with full CRUD
- Upload banner images for events
- Publish draft events to the public catalogue
- View per-event dashboard: bookings, revenue, attendance stats
- Scan attendee QR codes to mark attendance
- Duplicate scan prevention and fraud detection

### Authentication & Infrastructure
- JWT-based login and registration with role selection
- Persistent sessions via localStorage token
- Role-aware navigation (Navbar adapts per role)
- Protected routes (redirect to login if unauthenticated, Access Denied if wrong role)
- Automatic token expiry handling with redirect

---

## 3. Frameworks and Libraries

### Frontend
| Library | Version | Purpose |
|---------|---------|---------|
| React | 19 | UI component framework |
| React Router DOM | 7 | Client-side routing |
| Axios | 1.15 | HTTP client with JWT interceptors |


## 4. Setup and Installation

### Prerequisites
- Node.js v18 or higher — https://nodejs.org
- PostgreSQL 14 or higher running locally
- npm (bundled with Node.js)

---

### Step 1 — Clone the Repository
bash
git clone https://github.com/fatimanaeem2004/Web_Development_Project.git
cd Web_Development_Project


---

### Step 2 — Install Backend Dependencies
bash
npm install


---

### Step 3 — Configure Environment Variables
bash
cp .env.example .env


Open .env and fill in your values:

| Variable | Description | Example |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | postgresql://postgres:password@localhost:5432/event_system_db |
| JWT_SECRET | Secret key for JWT tokens | any-long-random-string |
| JWT_EXPIRES_IN | Token lifetime | 7d |
| PORT | Backend server port | 3000 |
| APP_BASE_URL | Base URL for links | http://localhost:3000 |
| SMTP_HOST | SMTP host (optional) | smtp.gmail.com |
| SMTP_PORT | SMTP port (optional) | 587 |
| SMTP_USER | SMTP email (optional) | your@gmail.com |
| SMTP_PASS | SMTP password (optional) | your_app_password |
| EMAIL_FROM | Sender address (optional) | your@gmail.com |
| STRIPE_SECRET_KEY | Stripe key (optional) | sk_test_... |
| UPLOAD_DIR | Folder for banner images | uploads |

> SMTP and Stripe are optional. The app works fully without them using the simulated payment endpoint.

---

### Step 4 — Set Up the Database
bash
# Create the PostgreSQL database
createdb event_system_db

# Apply migrations
npx prisma migrate dev --name init


---

### Step 5 — Seed Test Data
bash
npm run db:seed


This creates three test accounts:

| Role | Email | Password |
|------|-------|----------|
| ADMIN | admin@eventsystem.com | admin123 |
| ORGANIZER | organizer@eventsystem.com | organizer123 |
| ATTENDEE | attendee@eventsystem.com | attendee123 |

---

### Step 6 — Start the Backend
bash
npm start

Backend runs at *http://localhost:3000*

---

### Step 7 — Install Frontend Dependencies
bash
cd event-frontend
npm install


---

### Step 8 — Start the Frontend
bash
npm start


When prompted about port 3000 being in use, press *Y* to use port 3001.

Frontend runs at *http://localhost:3001*

---

### Step 9 — Open the App

Go to *http://localhost:3001* in your browser.

Use the demo credentials above to log in, or register a new account.

---

## 5. Project Structure
Web_Development_Project/
├── event-frontend/              
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── api.js               # Axios client + all API calls
│   │   ├── AuthContext.js       # Global JWT auth state
│   │   ├── App.js               # All 12 routes
│   │   ├── index.js             # React entry point
│   │   ├── index.css            # Global dark design system
│   │   ├── components/
│   │   │   ├── Navbar.js        # Role-aware navigation
│   │   │   ├── ProtectedRoute.js# Auth + role route guard
│   │   │   └── NotFound.js      # 404 page
│   │   └── pages/
│   │       ├── Home.js          # Landing page
│   │       ├── Login.js         # Login form
│   │       ├── Register.js      # Register form
│   │       ├── Events.js        # Browse events
│   │       ├── EventDetail.js   # Event detail + booking
│   │       ├── MyBookings.js    # Attendee bookings
│   │       ├── MyTickets.js     # Attendee tickets
│   │       ├── OrganizerEvents.js     # Organizer dashboard
│   │       ├── EventForm.js           # Create/edit event
│   │       ├── OrganizerDashboard.js  # Event analytics
│   │       └── QRScanner.js           # Attendance scanner
│   └── package.json
├── src/                         # Express backend
│   ├── index.js                 # App entry point
│   ├── routes/                  # All API route files
│   ├── services/                # Business logic
│   ├── middleware/              # Auth + upload middleware
│   └── lib/                    # Prisma client
├── prisma/
│   ├── schema.prisma            # Database schema
│   ├── migrations/              # SQL migrations
│   └── seed.js                  # Test data seeder
├── .env.example
└── package.json

---

## 6. Team Contributions

### Member 1 — Fatima Naeem

Responsible for the entire frontend foundation and authentication layer:
- src/api.js — Axios HTTP client with JWT request interceptor and 401 auto-logout response interceptor. Exports all API call functions for every backend endpoint.
- src/AuthContext.js — React Context providing global auth state. Handles login, logout, and session re-hydration on page refresh using GET /api/auth/me.
- src/index.css — Complete dark-theme CSS design system with custom properties, typography (DM Sans + Fraunces), buttons, cards, forms, badges, alerts, modals, tables, and responsive grid.
- src/components/Navbar.js — Sticky navigation bar that adapts links based on user role (Guest / Attendee / Organizer).
- src/components/ProtectedRoute.js — Route guard that redirects unauthenticated users to /login and shows Access Denied for wrong roles.
- src/components/NotFound.js — 404 fallback page.
- src/pages/Login.js — Login form with validation, JWT storage, and role-based redirect.
- src/pages/Register.js — Registration form with role selection and auto-login on success.
- src/pages/Home.js — Public landing page with hero section, feature overview, and live upcoming events grid.
- src/App.js — Root component wiring all 12 routes with React Router v7 and AuthProvider.
- Database schema design (Prisma models), backend auth routes and service, JWT middleware.

---

### Member 2 — Haseeb Ahmed

Responsible for event management pages and organizer tools:
- src/pages/Events.js — Public event browser with search, venue and date filters, and paginated results grid.
- src/pages/EventDetail.js — Event detail page with seat availability, booking form, and payment simulation.
- src/pages/OrganizerEvents.js — Organizer's event list with create, publish, edit, and cancel actions.
- src/pages/EventForm.js — Create and edit event form with validation and banner upload.
- src/pages/OrganizerDashboard.js — Per-event analytics dashboard showing bookings, revenue, and attendance stats.
- Backend event routes and service (CRUD, publish, banner upload, dashboard).
- Backend booking routes and service (seat reservation, cancellation).
- Backend payment routes and service (Stripe integration, simulated payment endpoint).

---

### Member 3 — Afaf Irfan

Responsible for attendee-facing pages and QR attendance:
- src/pages/MyBookings.js — Attendee bookings list with payment simulation and cancellation.
- src/pages/MyTickets.js — Attendee tickets with QR code display and ticket cancellation.
- src/pages/QRScanner.js — Organizer QR scanner with real-time scan result feedback (valid / duplicate / invalid).
- Backend ticket routes and service (QR generation, base64 image, PNG download).
- Backend attendance routes and service (scan pipeline, duplicate prevention, attendance summary).
- Email confirmation service (Nodemailer with embedded QR image).

---

## 7. Version Control Practices

| Practice | Detail |
|----------|--------|
| Branching | One branch per member. No direct pushes to main. |
| Pull Requests | All features merged to main via pull requests. |
| Commit Messages | Prefixed: feat: · fix: · style: · refactor: · docs: · chore: |
| Collaboration | Work divided clearly by member. Each member owns their files. |

---

## 8. Available Scripts

### Backend (repo root)
| Script | Command | Description |
|--------|---------|-------------|
| Start | npm start | Run backend server |
| Dev | npm run dev | Run with nodemon auto-restart |
| Migrate | npm run db:migrate | Create and apply Prisma migration |
| Seed | npm run db:seed | Seed test accounts and sample event |
| Studio | npm run db:studio | Open Prisma database GUI |

### Frontend (event-frontend/)
| Script | Command | Description |
|--------|---------|-------------|
| Start | npm start | Start React development server |
| Build | npm run build | Build for production |
| Test | npm test | Run test suite |

