# Algions AI Labs Cinema Hall Ticket Booking System

A full-stack, enterprise-grade cinema hall ticket booking platform built with **React 19**, **Express 5**, **PostgreSQL 18**, and **Prisma ORM 6**. Designed from first principles to guarantee ACID transactional integrity, prevent double-bookings under heavy concurrency, deliver cryptographically verifiable QR admission tickets, enforce immutable financial ledgers, and provide real-time administrative analytics.

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Main Features](#2-main-features)
3. [Technology Stack](#3-technology-stack)
4. [Architecture Overview](#4-architecture-overview)
5. [Folder Structure](#5-folder-structure)
6. [Database Design Overview](#6-database-design-overview)
7. [Core Booking Lifecycle](#7-core-booking-lifecycle)
8. [Seat Hold and Concurrency Approach](#8-seat-hold-and-concurrency-approach)
9. [Payment Simulation Explanation](#9-payment-simulation-explanation)
10. [QR Ticket Generation and Validation](#10-qr-ticket-generation-and-validation)
11. [Cancellation and Refund Rules](#11-cancellation-and-refund-rules)
12. [Admin Reports and Audit Logs](#12-admin-reports-and-audit-logs)
13. [API Endpoint Summary](#13-api-endpoint-summary)
14. [Local Installation Instructions](#14-local-installation-instructions)
15. [PostgreSQL Setup](#15-postgresql-setup)
16. [Environment Configuration](#16-environment-configuration)
17. [Prisma Migration and Seed Commands](#17-prisma-migration-and-seed-commands)
18. [Backend Startup Instructions](#18-backend-startup-instructions)
19. [Frontend Startup Instructions](#19-frontend-startup-instructions)
20. [Test Execution Commands](#20-test-execution-commands)
21. [Demo Accounts](#21-demo-accounts)
22. [Production Deployment Guide](#22-production-deployment-guide)
23. [Known Limitations](#23-known-limitations)

---

## 1. Project Overview

The **Cinema Hall Ticket Booking System** replicates the core operational architecture of commercial ticketing platforms (such as BookMyShow and AMC). The system coordinates the complete cinema ticketing lifecycle:
* **Theatres & Screens:** Multi-screen multiplex layouts with tiered seat categories (`SILVER`, `GOLD`, `PLATINUM`, `RECLINER`).
* **Movie Discovery:** Filterable movie catalog with genres, release dates, durations, and formats (`2D`, `3D`, `IMAX`).
* **Show Scheduling:** Screen-locked scheduling preventing overlapping shows and deriving category pricing.
* **Temporary Seat Holds:** Atomic 5-minute holds with real-time countdown to reserve seats during checkout.
* **Simulated Payments:** Gateway state machine with idempotent payment execution and tamper-proof price calculation.
* **Digital Admission:** Cryptographically hashed QR admission tickets validated by cinema staff at the gate.
* **Cancellations & Refunds:** 2-hour pre-show cancellation policy with automated seat release and immutable financial ledgers.
* **Admin Analytics:** Real-time occupancy, revenue time-series, and credential-sanitized security audit trails.

---

## 2. Main Features

### Customer
- **Authentication:** Secure registration and login using HTTP-only cookies and JWTs.
- **Movie Catalog:** Search by title, filter by genre or language, and view movie synopses with upcoming showtimes.
- **Interactive Seat Map:** Visual screen layout displaying real-time seat availability across price tiers.
- **Atomic Holds:** Multi-seat hold reservation with synchronized 5-minute countdown timer.
- **Simulated Checkout:** Instant simulated payment supporting UPI and Card payment methods.
- **Digital Tickets:** Instant issuance of individual digital admission tickets with scannable QR codes.
- **Self-Service Cancellation:** Instant 100% refund on cancellations requested $\ge 2$ hours prior to showtime.

### Staff
- **Gate Validation:** Real-time verification of QR admission codes via live camera scan or manual token entry.
- **Duplicate Prevention:** Immediate rejection of already-scanned tickets with validation timestamps.
- **Admission Window Enforcement:** Gates open 4 hours prior to showtime and close 30 minutes after start.

### Administrator
- **Catalog Management:** Create, edit, and archive movies, genres, theatres, and screens.
- **Physical Layouts:** Configure seat layouts and tiers per screen with referential integrity protection.
- **Show Scheduling:** Schedule shows with automatic end-time derivation and overlap prevention.
- **Live KPI Dashboard:** Track Gross Revenue, Refunds, Net Revenue, Occupancy Rate, and Cancellation Rate.
- **Audit Logs:** Filterable, paginated audit trail of all administrative and financial activities.

---

## 3. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite 8, Tailwind CSS 4, React Router 7, Axios, Lucide React |
| **Backend** | Node.js (ES Modules), Express 5, Prisma ORM 6.19.3, Helmet, CORS |
| **Database** | PostgreSQL 18 with ACID transactions, row-level locks, and partial unique indexes |
| **Security** | bcryptjs (passwords), jsonwebtoken (HTTP-only cookies), crypto (SHA-256 tokens) |
| **Validation** | Zod (strict schema validation for request bodies and query parameters) |
| **Testing** | Native Node.js test harness with 9 automated suites (191 tests, 0 failures) |

---

## 4. Architecture Overview

The system is architected as a **Modular Monolith** to maximize transactional consistency, eliminate distributed network failure modes, and keep hosting costs minimal.

```mermaid
flowchart TD
    Client["React 19 Client (SPA)"]
    Proxy["Vite Dev Proxy / Netlify CDN"]
    Express["Express 5 REST API Server"]
    Middleware["Security & Auth Middleware<br/>(Helmet, CORS, CookieParser, CSRF, RateLimit)"]
    Controllers["Domain Controllers<br/>(Auth, Movies, Shows, Holds, Bookings, Tickets, Admin)"]
    Services["Transactional Services Layer<br/>(Pessimistic Locks, Validation, Audit)"]
    Prisma["Prisma ORM 6.19.3 Engine"]
    Postgres[("PostgreSQL 18 Database<br/>ACID Transactions, Row Locks, Partial Indexes")]

    Client -->|HTTP / JSON with Credentials| Proxy
    Proxy -->|Forward /api| Express
    Express --> Middleware
    Middleware --> Controllers
    Controllers --> Services
    Services -->|Interactive Transactions| Prisma
    Prisma -->|Raw SQL & Prepared Statements| Postgres
```

---

## 5. Folder Structure

```
cinema-booking-system/
├── .env.example                  # Root environment configuration template
├── .gitignore                    # Git ignore file (excludes .env, node_modules, dist)
├── package.json                  # Root npm workspace convenience scripts
├── README.md                     # Comprehensive project documentation
├── docs/                         # Architecture guides and API references
│   ├── API_DOCUMENTATION.md      # Full API reference catalog
│   └── PROJECT_INTERVIEW_GUIDE.md # 17 technical CSE interview Q&As
├── backend/                      # Node.js + Express backend
│   ├── .env.example              # Backend environment template
│   ├── package.json              # Backend dependencies (Express 5, Prisma 6)
│   ├── prisma.config.ts          # Prisma CLI configuration
│   ├── prisma/
│   │   ├── schema.prisma         # Authoritative PostgreSQL schema
│   │   ├── seed.js               # Deterministic database seeder
│   │   └── migrations/           # 8 additive database migrations
│   └── src/
│       ├── server.js             # HTTP server entry point & graceful shutdown
│       ├── app.js                # Express app configuration & middleware
│       ├── config/               # Database and business configurations
│       ├── controllers/          # Request handling & HTTP response mapping
│       ├── middleware/           # Auth, RBAC, cookies, errors, rate limiting
│       ├── routes/               # Modular Express API route definitions
│       ├── services/             # Business logic & PostgreSQL transaction services
│       ├── utils/                # QR helpers, error classes, and test suites
│       └── validators/           # Zod schema validation
└── frontend/                     # React 19 + Vite frontend
    ├── .env.example              # Frontend environment template
    ├── package.json              # Frontend dependencies (React 19, Tailwind 4)
    ├── vite.config.js            # Vite configuration with proxy
    ├── vercel.json               # SPA routing rewrite for Vercel
    ├── public/
    │   └── _redirects            # SPA routing rewrite for Netlify
    └── src/
        ├── App.jsx               # Client-side router & protected routes
        ├── components/           # Reusable UI (Navbar, MovieCard, ProtectedRoute)
        ├── context/              # Authentication context & custom hooks
        ├── pages/                # Customer, Staff, and Admin views
        ├── services/             # Axios API client with error interceptors
        └── utils/                # Date/time, currency, and duration formatters
```

---

## 6. Database Design Overview

The database design adheres to 3NF relational modeling and relies on PostgreSQL-native constraints:

1. **Authoritative Seat Status:** `ShowSeat` is the single source of truth for seat availability (`AVAILABLE`, `HELD`, `BOOKED`).
2. **Partial Unique Indexes:**
   - Active Hold Prevention: Guarantees that only one active hold exists per seat.
   - Active Booking Allocation: `idx_booking_seats_active_show_seat` on `booking_seats("showSeatId") WHERE "releasedAt" IS NULL` physically prevents double confirmed bookings.
3. **Ledger Immutability:** When a booking is cancelled, `Payment.status` remains `SUCCESS`. A separate `Refund` row tracks the transaction, preserving gross vs. net financial history.

---

## 7. Core Booking Lifecycle

```mermaid
flowchart TD
    A[Customer Selects Show] --> B[View Interactive Seat Map]
    B --> C[Select Multiple Seats]
    C --> D[POST /api/shows/:id/holds]
    D -->|Row Lock Acquired| E{Seats Available?}
    E -->|No / Already Held| F[409 Conflict: Seats Unavailable]
    E -->|Yes| G[Set ShowSeat = HELD<br/>Start 5-Minute Timer]
    G --> H[POST /api/bookings]
    H --> I[Booking Created: PENDING_PAYMENT]
    I --> J[POST /api/bookings/:id/pay]
    J -->|Simulate Payment| K{Payment Result}
    K -->|Failed| L[Payment = FAILED<br/>Booking Remains PENDING_PAYMENT<br/>Customer Can Retry Within Hold]
    K -->|Success| M[Payment = SUCCESS<br/>Booking = CONFIRMED<br/>ShowSeat = BOOKED<br/>SeatHold = CONSUMED<br/>Tickets Generated with QR]
    M --> N[Customer Receives Tickets & View in My Bookings]
```

---

## 8. Seat Hold and Concurrency Approach

To eliminate race conditions when thousands of customers compete for limited cinema seats:
1. **Pessimistic Row Locking:** During hold requests, seats are locked using PostgreSQL `SELECT ... FOR UPDATE`. Concurrent requests block until the active transaction commits or rolls back.
2. **Automatic Expiration Reclaim:** If a seat was held by a previous customer whose timer expired (`holdExpiresAt <= NOW()`), the engine marks the old hold as `EXPIRED` and atomically reallocates the seat to the new customer in the same transaction.
3. **All-or-Nothing Guarantee:** If a user requests 4 seats and even 1 is unavailable, the entire batch fails (`409 Conflict`), and zero seats are reserved.

---

## 9. Payment Simulation Explanation

The application simulates the real-world payment gateway lifecycle:
* **Tamper-Proof Totals:** The frontend never supplies ticket prices. The backend computes `totalAmount` by summing the authoritative database prices of the held seats.
* **Payment Idempotency:** If a customer double-clicks "Pay Now", the row-level lock serializes the requests. The first processes the payment; the second recognizes `booking.status === 'CONFIRMED'` and returns the existing confirmation without double charging.
* **Retry Window:** If a payment fails, the booking remains in `PENDING_PAYMENT`, allowing the customer to retry payment using another card or UPI ID before their 5-minute hold expires.

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant API as Backend (Express)
    participant DB as PostgreSQL
    Customer->>API: POST /api/bookings/:id/pay { paymentMethod: "CARD", simulateResult: "SUCCESS" }
    API->>DB: BEGIN TRANSACTION
    API->>DB: SELECT * FROM bookings WHERE id = $1 FOR UPDATE
    alt Booking is already CONFIRMED
        API->>DB: COMMIT
        API-->>Customer: HTTP 200 (Return Existing Confirmation - Idempotent)
    else Booking is PENDING_PAYMENT
        API->>DB: INSERT INTO payments (status = SUCCESS, amount = authoritativeSum)
        API->>DB: UPDATE bookings SET status = CONFIRMED
        API->>DB: UPDATE show_seats SET status = BOOKED
        API->>DB: UPDATE seat_holds SET status = CONSUMED
        API->>DB: INSERT INTO tickets (with SHA-256 hashed qrToken)
        API->>DB: INSERT INTO audit_logs (BOOKING_CONFIRMED)
        API->>DB: COMMIT
        API-->>Customer: HTTP 200 { booking, payment, tickets }
    end
```

---

## 10. QR Ticket Generation and Validation

* **Opaque Tokens:** Individual tickets receive a unique reference (`TKT-YYYYMMDD-XXXX`). The server creates an opaque cryptographic token string.
* **Hash-Only Database Storage:** Only `SHA-256(qrToken)` is stored in `tickets.qrTokenHash`. The plaintext token is never stored in PostgreSQL, guaranteeing that database snapshots cannot leak entry passes.
* **Base64 QR Rendering:** The owner receives the token encoded into a base64 PNG data URL (`data:image/png;base64,...`) for instant display and printing.
* **Admission Window Check:** Gate validation enforces:
  $$\text{show.startTime} - 4\text{ hours} \le \text{NOW} \le \text{show.startTime} + 30\text{ minutes}$$
* **Simultaneous Scan Serialization:** At the entrance, the ticket row is locked via `SELECT ... FOR UPDATE`. Duplicate scans reject with `409 ALREADY_USED`.

---

## 11. Cancellation and Refund Rules

```mermaid
flowchart TD
    A[Customer Clicks Cancel Booking] --> B[Check: Is Show Time >= 2 Hours Away?]
    B -->|No / Past Cutoff| C[Reject: PAST_CANCELLATION_CUTOFF / SHOW_ALREADY_STARTED]
    B -->|Yes| D[Check: Have Any Tickets Been Scanned?]
    D -->|Yes| E[Reject: TICKET_ALREADY_USED]
    D -->|No| F[Acquire Row Lock: SELECT * FROM bookings FOR UPDATE]
    F --> G[Preserve Original Payment as SUCCESS]
    G --> H[Create Distinct Refund: status = PROCESSED]
    H --> I[Set BookingSeat.releasedAt = NOW]
    I --> J[Revert ShowSeat.status = AVAILABLE]
    J --> K[Set Ticket.status = CANCELLED]
    K --> L[Set Booking.status = CANCELLED]
    L --> M[Write AuditLog: BOOKING_CANCELLED & REFUND_PROCESSED]
    M --> N[Return HTTP 200 with Refund Reference]
```

---

## 12. Admin Reports and Audit Logs

All reports are derived dynamically via native PostgreSQL queries without stale caches:
* **Gross Revenue:** $\sum \text{payments.amount}$ for `status = 'SUCCESS'`.
* **Total Refunds:** $\sum \text{refunds.amount}$ for `status = 'PROCESSED'`.
* **Net Revenue:** $\text{Gross Revenue} - \text{Total Refunds}$.
* **Occupancy Rate:** $\frac{\text{BOOKED} + \text{HELD Seats}}{\text{Total Show Seats}} \times 100\%$.
* **Audit Trail:** Recursive data sanitization ensures passwords, JWTs, and QR tokens are stripped before storing in `audit_logs.details`.

---

## 13. API Endpoint Summary

| Module | Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/auth/register` | Public | Register customer account |
| **Auth** | `POST` | `/api/auth/login` | Public | Rate-limited login (sets session cookie) |
| **Auth** | `GET` | `/api/auth/me` | Authenticated | Fetch current profile |
| **Auth** | `POST` | `/api/auth/logout` | Authenticated | Clear session cookie |
| **Movies** | `GET` | `/api/movies` | Public | Paginated movie search & filters |
| **Movies** | `GET` | `/api/movies/:id` | Public | Movie details with associated genres |
| **Movies** | `POST` | `/api/movies` | `ADMIN` | Create movie record |
| **Genres** | `GET` | `/api/genres` | Public | List genres with movie counts |
| **Theatres** | `GET` | `/api/theatres` | Public | List active theatres by city |
| **Theatres** | `POST` | `/api/theatres` | `ADMIN` | Create theatre multiplex |
| **Screens** | `POST` | `/api/screens/:id/seats/bulk`| `ADMIN` | Bulk configure physical seat layout |
| **Shows** | `GET` | `/api/shows` | Public | List scheduled shows with pricing ranges |
| **Shows** | `POST` | `/api/shows` | `ADMIN` | Schedule show (prevents overlap) |
| **Shows** | `GET` | `/api/shows/:id/seats` | Public | Visual seat map with categories & status |
| **Holds** | `POST` | `/api/shows/:id/holds` | `CUSTOMER` | Atomically hold seats (5-min countdown) |
| **Holds** | `DELETE`| `/api/shows/:id/holds/:id`| `CUSTOMER` | Release temporary seat hold |
| **Bookings** | `POST` | `/api/bookings` | `CUSTOMER` | Create reservation from active hold |
| **Bookings** | `POST` | `/api/bookings/:id/pay` | `CUSTOMER` | Simulate payment & issue tickets |
| **Bookings** | `POST` | `/api/bookings/:id/cancel`| `CUSTOMER` | Cancel booking & process refund |
| **Tickets** | `GET` | `/api/tickets` | `CUSTOMER` | List digital admission tickets |
| **Tickets** | `GET` | `/api/tickets/:id/qr` | `CUSTOMER` | Generate scannable QR PNG data URL |
| **Tickets** | `POST` | `/api/tickets/validate` | `STAFF` | Entrance admission check & scan |
| **Admin** | `GET` | `/api/admin/reports/overview`| `ADMIN` | Real-time financial & occupancy KPIs |
| **Admin** | `GET` | `/api/admin/audit-logs` | `ADMIN` | Paginated security audit trail |

---

## 14. Local Installation Instructions

### Prerequisites
- **Node.js:** v18.0.0 or higher (v20+ recommended)
- **npm:** v9.0.0 or higher
- **PostgreSQL:** v14, v15, v16, or v18 running locally or on cloud

### Clone Repository
```bash
git clone https://github.com/your-username/cinema-booking-system.git
cd cinema-booking-system
```

---

## 15. PostgreSQL Setup

1. Open `psql` or pgAdmin and create the database:
   ```sql
   CREATE DATABASE cinema_booking;
   ```
2. Verify PostgreSQL is listening on port `5432`.

---

## 16. Environment Configuration

### Backend Setup
Create `backend/.env` (copied from `backend/.env.example`):
```ini
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/cinema_booking?schema=public"
JWT_SECRET="dev-secret-key-change-in-production-123456"
JWT_EXPIRES_IN="24h"
CORS_ORIGIN="http://localhost:5173"
COOKIE_SAME_SITE="lax"
```

To generate a cryptographically strong 256-bit JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Frontend Setup
Create `frontend/.env` (copied from `frontend/.env.example`):
```ini
# Leave empty in local development to use Vite's proxy (/api -> http://localhost:5000)
VITE_API_URL=
```

---

## 17. Prisma Migration and Seed Commands

From the `backend` directory:

1. **Deploy Migrations:**
   ```bash
   cd backend
   npx prisma migrate deploy
   ```
2. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```
3. **Seed Database:**
   ```bash
   npm run prisma:seed
   ```
   *Seeds 5 demo accounts, 5 movies, 7 genres, 3 theatres, 6 screens, 360 physical seats, 8 scheduled shows, and demo bookings.*

---

## 18. Backend Startup Instructions

```bash
cd backend
npm run dev
```
* Backend runs at: `http://localhost:5000`
* API Health Check: `http://localhost:5000/health`
* Database Connectivity: `http://localhost:5000/health/db`

---

## 19. Frontend Startup Instructions

```bash
cd frontend
npm run dev
```
* Frontend runs at: `http://localhost:5173`

---

## 20. Test Execution Commands

The project includes 9 automated integration test suites verifying the entire system:

```bash
# Run all test suites sequentially
cd backend
npm test

# Or run individual phase test suites:
npm run test:auth          # Phase 2: Authentication & RBAC (15 tests)
npm run test:movies        # Phase 3: Movies & Genres (21 tests)
npm run test:theatres      # Phase 4: Theatres, Screens & Seats (17 tests)
npm run test:shows         # Phase 5: Showtime Scheduling & Concurrency (19 tests)
npm run test:holds         # Phase 6: Seat Holds & Race Conditions (24 tests)
npm run test:bookings      # Phase 7: Booking & Simulated Payments (22 tests)
npm run test:tickets       # Phase 8: QR Code Tickets & Admission (22 tests)
npm run test:cancellations # Phase 9: Cancellations, Refunds & Audit (31 tests)
npm run test:e2e           # Phase 10: Complete End-to-End System Journey (20 tests)
```
**Total Test Count:** **191 PASSED, 0 FAILED**.

---

## 21. Demo Accounts

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@cinema.com` | `Admin@123` | Full access: movies, theatres, shows, analytics, audit logs |
| **STAFF** | `staff@cinema.com` | `Staff@123` | Entrance turnstile access: QR scanning & manual validation |
| **CUSTOMER** | `rahul@example.com` | `Cinema@123` | Book tickets, view seat map, holds, digital QR tickets |
| **CUSTOMER** | `priya@example.com` | `Cinema@123` | Concurrency testing & multi-user simulations |
| **CUSTOMER** | `amit@example.com` | `Cinema@123` | Booking history & cancellation testing |

---

## 22. Production Deployment Guide

The application is structured to run on zero-cost free tiers for student demonstrations and evaluations.

### Recommended Free-Tier Architecture

| Component | Recommended Provider | Free Tier Characteristics & Constraints |
| :--- | :--- | :--- |
| **Database** | **Neon** Serverless PostgreSQL | • 0.5 GiB free storage.<br/>• Scales to zero when inactive.<br/>• *Note:* 1–3s cold-start latency when waking from sleep. |
| **Backend API** | **Render** Web Service | • 512 MB RAM, 750 free hours/month.<br/>• *Note:* Spins down after 15 minutes of inactivity (50s cold start). |
| **Frontend SPA**| **Vercel** or **Netlify** | • Edge CDN distribution, zero cold start.<br/>• SPA routing handled via `_redirects` and `vercel.json`. |

### Backend Deployment Steps (e.g. Render)
1. Link your GitHub repository.
2. Root directory: `backend`.
3. Build command: `npm install && npx prisma generate && npx prisma migrate deploy`
4. Start command: `node src/server.js`
5. Environment Variables:
   - `DATABASE_URL`: Your cloud PostgreSQL pooled connection string.
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: Random 256-bit string.
   - `CORS_ORIGIN`: Your production frontend URL (e.g. `https://mycinema.vercel.app`).
   - `COOKIE_SAME_SITE`: `none` (Required for cross-site cookie transmission over HTTPS).

### Frontend Deployment Steps (e.g. Vercel)
1. Link your GitHub repository.
2. Root directory: `frontend`.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Environment Variable:
   - `VITE_API_URL`: Your deployed backend URL (e.g. `https://cinema-api.onrender.com`).

---

## 23. Known Limitations

1. **In-Memory Rate Limiting:** The IP-based rate limiter stores counters in a Node.js `Map` with periodic 30-minute memory cleanup. In a multi-instance horizontally scaled cluster, counters are local to each process rather than globally synchronized via Redis.
2. **Lazy Seat Hold Expiration:** Stale seat holds are expired on-demand when holds are evaluated or when seat maps are requested, rather than proactively via a background cron or Redis TTL eviction keyspace.
3. **Simulated Payment Gateway:** Payments are simulated via an ACID transaction state machine. Real credit card transactions would require external webhook integration (Stripe / Razorpay).
