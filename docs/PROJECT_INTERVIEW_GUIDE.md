# Cinema Booking System — Engineering Interview & Architecture Guide

> **Author / Context:** Final-year Computer Science & Engineering (CSE) Capstone Project  
> **System:** Algions AI Labs Cinema Hall Ticket Booking System  
> **Repository:** `E:\cinema-booking-system`

This document provides clear, honest, and technically grounded explanations of the architectural choices, database constraints, concurrency safeguards, and business logic implemented across the application.

---

### 1. Why were React, Express, and PostgreSQL selected?

* **React (v19) + Vite:** I chose React because cinema booking requires highly interactive, state-driven interfaces — especially the dynamic seat grid where seats rapidly toggle between available, selected, held, and booked states. React's component model allowed me to isolate complex UI components like the interactive seating canvas and countdown timers cleanly. Vite provided instant HMR during development and optimized production bundling with Rollup.
* **Node.js + Express (v5):** Express 5 gives native async error propagation, meaning any rejected promise inside an async route handler flows directly to our centralized error middleware without requiring cumbersome `try/catch` boilerplate everywhere. Node's single-threaded event loop is lightweight and handles concurrent I/O-bound requests (database queries, cookie parsing) with very low memory footprint.
* **PostgreSQL (v18):** Cinema ticketing is fundamentally an ACID transaction problem. Multiple users must never be able to hold or book the same physical seat. PostgreSQL was non-negotiable because it provides row-level pessimistic locking (`SELECT ... FOR UPDATE`), transaction isolation levels (`READ COMMITTED`), partial unique indexes, check constraints, and battle-tested foreign keys. Document databases like MongoDB cannot provide these relational integrity guarantees as cleanly under high concurrency.

---

### 2. Why was Prisma ORM used?

I chose Prisma 6.19.3 because it bridges relational type-safety with declarative schema definitions. 
1. **Schema as Single Source of Truth:** `schema.prisma` defines models, relations, cascades, and enum types in one readable file, eliminating discrepancies between database tables and JavaScript models.
2. **Deterministic Additive Migrations:** Using `prisma migrate dev` and `prisma migrate deploy` produces human-reviewable SQL migration files (`migration.sql`), allowing us to verify database changes before they touch PostgreSQL.
3. **Interactive Transactions:** Prisma provides `$transaction(async (tx) => { ... })`, allowing us to bundle multiple operations (seat status updates, hold records, booking creation, ticket issuance) into a single atomic database transaction. If any step fails, PostgreSQL automatically rolls back the entire batch.
4. **Native SQL Escape Hatch:** Where Prisma's query builder abstracts away row-level locks, Prisma allows `$queryRaw` to execute raw PostgreSQL queries like `SELECT ... FOR UPDATE` directly inside the transaction scope without sacrificing transaction boundaries.

---

### 3. Why was a modular monolith chosen over microservices?

For a ticket booking application of this scope, a modular monolith is the most appropriate architecture. Microservices introduce distributed transactions (requiring Two-Phase Commit or Saga patterns), network latency between services, distributed tracing overhead, and eventual consistency issues. 

In ticket booking, strong consistency is mandatory — we cannot afford a scenario where the Booking Service thinks a seat is confirmed but the Inventory Service failed to update. By placing Auth, Theatres, Shows, Holds, Bookings, Tickets, and Admin Reports in structured domain modules (`controllers/`, `services/`, `validators/`, `routes/`) within one Express application talking to one PostgreSQL database, we preserve ACID transactions, simplify local debugging, avoid network serialization costs, and can easily deploy the entire system on a single free or low-cost server instance.

---

### 4. How do authentication and role-based authorization work?

* **Passwords:** Passwords are hashed using `bcryptjs` with a cost factor of 10 (`bcrypt.hash(password, 10)`). Hashes are never returned in any API response (the user DTO explicitly strips `passwordHash`).
* **JWT & Cookies:** On successful login, the server signs a JSON Web Token containing the user's `id`, `email`, and `role`, signed with `JWT_SECRET`. This token is sent to the client inside an **HTTP-only cookie** (`token`). Because it is `httpOnly: true`, client-side JavaScript cannot read it, preventing Cross-Site Scripting (XSS) token theft.
* **CSRF Protection:** In development, cookies use `sameSite: 'lax'`. In production cross-origin deployments, `sameSite: 'none'` with `secure: true` is configured. Additionally, a custom `csrfProtection` middleware checks the `Origin` header on state-changing methods (`POST`, `PUT`, `DELETE`, `PATCH`) to block unauthorized cross-origin forged requests.
* **Role Enforcement:** Middleware runs in sequence: `authenticate` validates the JWT and attaches `req.user`, followed by `requireRole(['ADMIN'])` or `requireStaff` which compares `req.user.role`. Unauthorized requests are immediately rejected with `403 FORBIDDEN`.

---

### 5. How do temporary seat holds work?

When a customer selects seats on the interactive map, they shouldn't lose those seats to someone else while entering payment details. 
1. The client sends `POST /api/shows/:showId/holds` with an array of `showSeatIds`.
2. Inside a PostgreSQL transaction, the server executes:
   ```sql
   SELECT id, status, "holdExpiresAt" 
   FROM show_seats 
   WHERE id = ANY($1) 
   FOR UPDATE
   ```
3. Before granting the hold, the system checks if any requested seat is `BOOKED`, or currently `HELD` by another customer with `holdExpiresAt > NOW()`. If an existing hold on a seat has expired (`holdExpiresAt <= NOW()`), the system atomically marks that stale hold as `EXPIRED` and reallocates the seat to the new customer.
4. If all seats are available, the server sets `status = 'HELD'`, `heldById = user.id`, and `holdExpiresAt = NOW() + 5 minutes`. It also writes a historical record into `SeatHold`.
5. The frontend starts a synchronized 5-minute countdown timer. If the timer reaches zero, the hold expires and the seats become available for anyone else to claim.

---

### 6. How does the system prevent double booking?

Double booking is prevented through multiple defensive layers:
1. **Row-Level Locking:** During hold creation and payment confirmation, candidate seats are locked via PostgreSQL `SELECT ... FOR UPDATE`. This forces concurrent requests for the same seat to execute sequentially.
2. **Authoritative State on `ShowSeat`:** `ShowSeat` is the single source of truth for seat status (`AVAILABLE`, `HELD`, `BOOKED`). No booking can proceed unless the candidate seats are in `HELD` status belonging to the requesting user.
3. **Database Partial Unique Index:** We implemented a PostgreSQL partial unique index on the `booking_seats` table:
   ```sql
   CREATE UNIQUE INDEX idx_booking_seats_active_show_seat 
   ON booking_seats("showSeatId") 
   WHERE "releasedAt" IS NULL;
   ```
   This guarantees that PostgreSQL itself physically rejects any attempt to insert a second active allocation for the same `showSeatId`, even if application code had a bug or race condition.

---

### 7. How are PostgreSQL transactions and row-level locks used?

Prisma's `$transaction` is used for every multi-step workflow. For example, during booking confirmation:
1. `tx.$queryRaw` acquires an exclusive lock on the `Booking` record:
   ```sql
   SELECT id, status FROM bookings WHERE id = $1 FOR UPDATE
   ```
2. If another concurrent request was waiting for this booking, it unblocks only after the first transaction completes, sees that `booking.status` is already `CONFIRMED`, and safely returns the existing confirmation instead of executing a duplicate charge.
3. In the same transaction:
   - A `Payment` record is created.
   - Associated `ShowSeat` rows transition from `HELD` to `BOOKED`.
   - `SeatHold` record transitions from `ACTIVE` to `CONSUMED`.
   - Digital `Ticket` records with hashed QR tokens are generated.
   - `AuditLog` records the confirmation event.

If any single step fails, the entire transaction is rolled back, leaving the database in its exact previous state.

---

### 8. How does simulated payment work?

Since this project does not integrate live banking credentials, the backend simulates the complete payment gateway lifecycle:
* The client calls `POST /api/bookings/:id/pay` with `{ paymentMethod: 'CARD' | 'UPI', simulateResult: 'SUCCESS' | 'FAILED' }`.
* **Price Tampering Protection:** The server completely ignores any price submitted by the frontend. It computes `totalAmount` strictly by summing the authoritative prices of the held seats stored in the database.
* **Failure Simulation:** If `simulateResult === 'FAILED'`, the server records a `Payment` record with `status: 'FAILED'`, leaving the booking in `PENDING_PAYMENT`. The customer can retry payment within their remaining hold window without losing their seats.

---

### 9. How is payment idempotency handled?

If a user double-clicks "Pay Now" or network retries fire simultaneously:
1. The server enters a transaction and locks the booking row: `SELECT ... FOR UPDATE`.
2. It inspects `booking.status`. If `booking.status === 'CONFIRMED'`, it immediately recognizes that payment was already processed.
3. The server retrieves the existing successful `Payment` and associated tickets, and returns HTTP 200 with the existing confirmation.
4. No second `Payment` record is created, no duplicate tickets are generated, and the user's card/UPI is not charged twice.

---

### 10. How are QR tickets generated and validated?

1. **Generation:** When payment succeeds, the server generates a ticket for each seat with a unique format: `TKT-YYYYMMDD-XXXX`.
2. **Opaque Token & Hash:** The server constructs an opaque token string from the ticket's UUID and random bytes, computes its SHA-256 cryptographic hash (`crypto.createHash('sha256').update(rawToken).digest('hex')`), and saves ONLY the hash in `Ticket.qrTokenHash`. The raw token is encoded into a base64 PNG QR code data URL (`qrcode.toDataURL(token)`).
3. **Database Security:** The raw token is never saved in PostgreSQL; only its hash is persisted. This means even a database leak would not allow an attacker to forge valid entry tickets.
4. **Validation:** Staff at the entrance scan the QR code or type the token. The server hashes the incoming token and looks up the ticket:
   - Checks admission window: show start time must be within 4 hours before screening until 30 minutes after start.
   - Verifies `status === 'VALID'` and booking is `CONFIRMED`.
   - Transitions `status` to `USED` and records `validatedById` and `validatedAt`.

---

### 11. How are simultaneous QR scans handled?

If someone copies a ticket QR code and two people try to enter through two different turnstiles at the exact same millisecond:
1. Both scan requests hit `POST /api/tickets/validate`.
2. Inside the validation transaction, the ticket row is locked:
   ```sql
   SELECT id, status, "qrTokenHash" FROM tickets WHERE "qrTokenHash" = $1 FOR UPDATE
   ```
3. PostgreSQL serializes the two requests. The first transaction reads `status = 'VALID'`, changes it to `status = 'USED'`, logs the staff member, and commits.
4. The second transaction unblocks, reads the updated `status`, sees it is already `USED`, and rejects the ticket with HTTP 409 `ALREADY_USED`, displaying the exact time and staff member who performed the first validation.

---

### 12. How do cancellations and refunds work?

A customer can cancel their booking via `POST /api/bookings/:id/cancel`:
1. **Pessimistic Locking:** The booking is locked with `SELECT ... FOR UPDATE`.
2. **Cutoff Check:** The system calculates:
   $$\text{Hours to Show} = \frac{\text{show.startTime} - \text{NOW}}{3,600,000}$$
   If $\text{Hours to Show} < 2\text{ hours}$, the cancellation is rejected with `PAST_CANCELLATION_CUTOFF`. If the show has already started, it is rejected with `SHOW_ALREADY_STARTED`.
3. **Usage Check:** If any ticket in the booking has already been scanned (`status = 'USED'`), cancellation is completely blocked (`TICKET_ALREADY_USED`).
4. **Refund Processing:** A distinct `Refund` row is created with `status = 'PROCESSED'`, referencing `booking.totalAmount` and `payment.id`.
5. **Seat Release:** `BookingSeat.releasedAt` is stamped with `NOW()`, and `ShowSeat` records transition back to `AVAILABLE`.
6. **Ticket Invalidation:** All tickets for the booking transition to `CANCELLED`, ensuring they will be rejected if presented at the gate.

---

### 13. Why is payment history not overwritten on cancellation?

In production accounting and financial auditing, **the ledger must remain immutable**.
* If a customer pays ₹500 and later cancels, mutating the original `Payment.status` from `SUCCESS` to `REFUNDED` destroys historical transaction logs. In financial audits, the company did receive ₹500 from the payment processor, and subsequently issued a separate ₹500 payout via the banking network.
* Therefore:
  - `Payment` records remain `status: 'SUCCESS'` forever.
  - A separate `Refund` table records the payout with its own unique reference (`REF-...`), amount, and timestamp.
  - Gross Revenue is calculated as `SUM(payments.amount WHERE status = 'SUCCESS')`.
  - Refunds are calculated as `SUM(refunds.amount WHERE status = 'PROCESSED')`.
  - Net Revenue is derived purely as:
    $$\text{Net Revenue} = \text{Gross Revenue} - \text{Refunds}$$

---

### 14. How are audit logs maintained?

The `AuditLog` table records critical administrative, security, and financial operations (`BOOKING_CANCELLED`, `REFUND_PROCESSED`, `TICKET_VALIDATED`, `SHOW_CREATED`, etc.).
* **Non-Blocking Architecture:** `AuditService.log` wraps the database insert in a try/catch block so an audit logging glitch never aborts the core customer transaction.
* **Credential Redaction:** Before storing request details into `AuditLog.details` (JSONB), a recursive sanitizer strips sensitive keys: `password`, `token`, `qrToken`, `secret`, `authorization`, `cookie`, and `creditCard`.
* **Query Performance:** The table is indexed by `action`, `entity`, `userId`, and `createdAt` for fast admin filtering.

---

### 15. How are admin occupancy and revenue reports calculated?

Rather than storing cached totals that could fall out of sync, the reporting engine (`report.service.js`) computes metrics dynamically directly in PostgreSQL:
* **Seat Occupancy:**
  $$\text{Occupancy Rate} = \frac{\text{Count of BOOKED and HELD ShowSeats}}{\text{Total ShowSeats}} \times 100\%$$
* **Cancellation Rate:**
  $$\text{Cancellation Rate} = \frac{\text{Count of CANCELLED Bookings}}{\text{Total Bookings}} \times 100\%$$
* **Revenue Time-Series:** Uses Prisma `groupBy` on `Payment` and `Refund` filtered by date ranges, calculating daily and monthly gross, refunded, and net amounts.

---

### 16. What are the main limitations of the current implementation?

Being completely honest about the project's current boundaries:
1. **Single-Instance In-Memory Rate Limiter:** The IP-based rate limiter uses a Node.js `Map` with periodic expiration cleanup. In a horizontally scaled multi-server deployment behind a load balancer, clients hitting different instances wouldn't share rate limit counters.
2. **Synchronous Polling for Hold Expiration:** Seat holds expire after 5 minutes. Currently, expired holds are cleared lazily whenever holds are requested or when the seat map is loaded. In a massive enterprise deployment, a background job or Redis TTL keyspace notification would proactively broadcast expirations.
3. **Simulated Payment Gateway:** While the database state machine accurately mirrors real gateways (PENDING $\rightarrow$ SUCCESS / FAILED), real credit card handling would require webhook integration with Stripe or Razorpay.

---

### 17. What would you improve with more time?

1. **Redis Integration for Distributed Holds & Caching:** Replace the in-memory rate limiter with Redis and utilize Redis key expiration (TTL) for temporary seat holds to offload transient lock queries from PostgreSQL.
2. **WebSockets for Real-Time Seat Map Updates:** Currently, users refresh or poll to see seats claimed by others. Integrating Socket.io or Server-Sent Events (SSE) would allow the seat grid to update in real time as other users click and hold seats.
3. **Live Payment Gateway Webhooks:** Integrate Razorpay or Stripe with cryptographic webhook signature verification (`stripe-signature`) to process real payments and handle asynchronous payment drop-offs.
4. **Email / SMS Ticket Delivery:** Integrate SendGrid or AWS SES to send high-resolution digital ticket PDFs with embedded QR codes directly to the customer's email upon booking confirmation.
