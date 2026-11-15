# API Reference Documentation

**Project:** Algions AI Labs Cinema Hall Ticket Booking System  
**Base URL:** `/api` (e.g. `http://localhost:5000/api`)  
**Authentication:** HTTP-only session cookie (`token=<jwt>`). All role-protected routes read and verify this cookie.

---

## Response Envelope Conventions

### Success Response
```json
{
  "success": true,
  "message": "Optional human-readable confirmation",
  "data": { ... },
  "pagination": { ... } // Optional for list endpoints
}
```

### Error Response
```json
{
  "success": false,
  "message": "Detailed error message",
  "code": "ERROR_CODE_STRING",
  "errors": [ ... ] // Optional Zod validation field errors
}
```

---

## 1. Authentication & Profile (`/api/auth`)

### 1.1 Register Customer
- **Method:** `POST`
- **URL:** `/api/auth/register`
- **Role:** Public
- **Request Body:**
  ```json
  {
    "name": "Aarav Sharma",
    "email": "aarav@example.com",
    "password": "Password@123",
    "phone": "9876543210"
  }
  ```
- **Success Response (`201 Created`):** Sets `token` HTTP-only cookie.
  ```json
  {
    "success": true,
    "message": "Registration successful",
    "data": {
      "user": {
        "id": "e4b55c68-07d4-4a41-b847-a4c330f81d11",
        "name": "Aarav Sharma",
        "email": "aarav@example.com",
        "phone": "9876543210",
        "role": "CUSTOMER"
      }
    }
  }
  ```
- **Common Errors:** `409 Conflict` (`EMAIL_ALREADY_EXISTS`), `400 Bad Request` (`VALIDATION_ERROR`).

### 1.2 User Login
- **Method:** `POST`
- **URL:** `/api/auth/login`
- **Role:** Public (Rate limited: 5 requests / 15 mins)
- **Request Body:**
  ```json
  {
    "email": "aarav@example.com",
    "password": "Password@123"
  }
  ```
- **Success Response (`200 OK`):** Sets `token` HTTP-only cookie.
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "user": {
        "id": "e4b55c68-07d4-4a41-b847-a4c330f81d11",
        "name": "Aarav Sharma",
        "email": "aarav@example.com",
        "role": "CUSTOMER"
      }
    }
  }
  ```
- **Common Errors:** `401 Unauthorized` (`INVALID_CREDENTIALS`), `429 Too Many Requests` (`RATE_LIMIT_EXCEEDED`).

### 1.3 Get Current User Profile
- **Method:** `GET`
- **URL:** `/api/auth/me`
- **Role:** Authenticated (`CUSTOMER`, `STAFF`, `ADMIN`)
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "e4b55c68-07d4-4a41-b847-a4c330f81d11",
        "name": "Aarav Sharma",
        "email": "aarav@example.com",
        "role": "CUSTOMER"
      }
    }
  }
  ```
- **Common Errors:** `401 Unauthorized` (`AUTH_TOKEN_MISSING`, `TOKEN_EXPIRED`).

### 1.4 User Logout
- **Method:** `POST`
- **URL:** `/api/auth/logout`
- **Role:** Authenticated
- **Success Response (`200 OK`):** Clears `token` cookie.
  ```json
  {
    "success": true,
    "message": "Logged out successfully"
  }
  ```

---

## 2. Movies & Genres (`/api/movies`, `/api/genres`)

### 2.1 List Active Movies
- **Method:** `GET`
- **URL:** `/api/movies?search=Inception&genre=Sci-Fi&language=English&page=1&limit=10`
- **Role:** Public
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "movies": [
        {
          "id": "c1f7a0b2-3d84-4e92-9f31-897b5d1e4c3a",
          "title": "Inception",
          "description": "A thief who steals corporate secrets through dream-sharing technology...",
          "duration": 148,
          "language": "English",
          "releaseDate": "2010-07-16T00:00:00.000Z",
          "posterUrl": "https://images.unsplash.com/photo-1440404653325-ab127d49abc1",
          "isActive": true,
          "genres": [
            { "id": "g1-uuid", "name": "Sci-Fi" },
            { "id": "g2-uuid", "name": "Action" }
          ]
        }
      ],
      "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
    }
  }
  ```

### 2.2 Get Movie by ID
- **Method:** `GET`
- **URL:** `/api/movies/:id`
- **Role:** Public (inactive movies only accessible to `ADMIN`)
- **Success Response (`200 OK`):** Single movie object with associated genres.
- **Common Errors:** `404 Not Found` (`MOVIE_NOT_FOUND`).

### 2.3 Create Movie
- **Method:** `POST`
- **URL:** `/api/movies`
- **Role:** `ADMIN`
- **Request Body:**
  ```json
  {
    "title": "Dune: Part Two",
    "description": "Paul Atreides unites with Chani and the Fremen...",
    "duration": 166,
    "language": "English",
    "releaseDate": "2024-03-01T00:00:00.000Z",
    "posterUrl": "https://example.com/dune2.jpg",
    "genreIds": ["genre-uuid-1", "genre-uuid-2"]
  }
  ```
- **Success Response (`201 Created`)**
- **Common Errors:** `403 Forbidden` (`FORBIDDEN`), `400 Bad Request` (`INVALID_GENRES`).

### 2.4 Update Movie
- **Method:** `PUT`
- **URL:** `/api/movies/:id`
- **Role:** `ADMIN`

### 2.5 Toggle Movie Status
- **Method:** `PATCH`
- **URL:** `/api/movies/:id/status`
- **Role:** `ADMIN`
- **Request Body:** `{ "isActive": false }`

### 2.6 List Genres
- **Method:** `GET`
- **URL:** `/api/genres`
- **Role:** Public
- **Success Response (`200 OK`):** Returns alphabetized genres with movie counts.

### 2.7 Create / Update / Delete Genre
- **Method:** `POST` / `PUT` / `DELETE`
- **URL:** `/api/genres`, `/api/genres/:id`
- **Role:** `ADMIN`
- **Note:** Genre deletion is blocked (`400 GENRE_IN_USE`) if any movie references it.

---

## 3. Theatres, Screens & Seats (`/api/theatres`, `/api/screens`)

### 3.1 List Theatres
- **Method:** `GET`
- **URL:** `/api/theatres?city=Bengaluru`
- **Role:** Public
- **Success Response (`200 OK`):** Active theatres with screen count and total physical capacity.

### 3.2 Get Theatre Details
- **Method:** `GET`
- **URL:** `/api/theatres/:id`
- **Role:** Public
- **Success Response (`200 OK`):** Includes screen configurations and seating capacities.

### 3.3 Create Theatre
- **Method:** `POST`
- **URL:** `/api/theatres`
- **Role:** `ADMIN`
- **Request Body:**
  ```json
  {
    "name": "PVR Forum Mall",
    "location": "Koramangala",
    "city": "Bengaluru"
  }
  ```

### 3.4 Manage Screens
- `GET /api/theatres/:id/screens` — List screens for a theatre (Public).
- `POST /api/theatres/:id/screens` — Create screen (`ADMIN`).
- `PUT /api/screens/:id` — Update screen name/formats (`ADMIN`).

### 3.5 Physical Seat Configuration
- `GET /api/screens/:id/seats` — Physical layout grouped by row with seat categories (Public).
- `POST /api/screens/:id/seats/bulk` — Batch configure screen layout (`ADMIN`).
  ```json
  {
    "seats": [
      { "row": "A", "seatNumber": 1, "category": "SILVER" },
      { "row": "A", "seatNumber": 2, "category": "SILVER" },
      { "row": "B", "seatNumber": 1, "category": "GOLD" }
    ]
  }
  ```
- `PUT /api/screens/:id/seats/bulk` — Update category/active state of existing seats (`ADMIN`).

---

## 4. Shows & Scheduling (`/api/shows`)

### 4.1 Discover Shows
- `GET /api/shows?date=2026-11-20&movieId=...` — Active scheduled shows with pricing ranges (Public).
- `GET /api/movies/:movieId/shows` — Showtimes grouped by theatre (Public).
- `GET /api/theatres/:theatreId/shows` — Showtimes grouped by movie (Public).

### 4.2 Schedule Showtime
- **Method:** `POST`
- **URL:** `/api/shows`
- **Role:** `ADMIN`
- **Concurrency & Overlap Protection:** Employs PostgreSQL row-level locks on `Screen` to serialize scheduling and prevent overlapping time windows (`SHOWTIME_OVERLAP`).
- **Request Body:**
  ```json
  {
    "movieId": "movie-uuid",
    "screenId": "screen-uuid",
    "startTime": "2026-11-20T14:30:00.000Z",
    "format": "2D",
    "bufferMinutes": 15,
    "pricing": {
      "SILVER": 180,
      "GOLD": 250,
      "RECLINER": 450
    }
  }
  ```
- **Success Response (`201 Created`):** Automatically initializes `ShowSeat` records for all active physical seats.

### 4.3 Get Show Seat Map
- **Method:** `GET`
- **URL:** `/api/shows/:id/seats`
- **Role:** Public
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "show": { "id": "show-uuid", "format": "2D", "startTime": "..." },
      "rows": [
        {
          "row": "A",
          "seats": [
            {
              "id": "show-seat-uuid-1",
              "seatNumber": 1,
              "category": "SILVER",
              "price": 180,
              "status": "AVAILABLE"
            }
          ]
        }
      ],
      "stats": { "totalSeats": 60, "availableSeats": 58, "heldSeats": 2, "bookedSeats": 0 }
    }
  }
  ```

---

## 5. Seat Holds & Concurrency Engine (`/api/shows/:id/holds`)

### 5.1 Create Temporary Seat Hold
- **Method:** `POST`
- **URL:** `/api/shows/:showId/holds`
- **Role:** Authenticated (`CUSTOMER`)
- **Hold Duration:** 300 seconds (5 minutes). Stored in `SeatHold` and `ShowSeat.holdExpiresAt`.
- **Request Body:**
  ```json
  {
    "showSeatIds": ["show-seat-uuid-1", "show-seat-uuid-2"]
  }
  ```
- **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "2 seat(s) held successfully for 5 minutes",
    "data": {
      "holdId": "hold-uuid-abc",
      "expiresInSeconds": 300,
      "totalAmount": 360,
      "seats": [
        { "id": "show-seat-uuid-1", "row": "A", "seatNumber": 1, "category": "SILVER", "price": 180 }
      ]
    }
  }
  ```
- **Common Errors:** `409 Conflict` (`SEAT_ALREADY_HELD`, `SEAT_ALREADY_BOOKED`), `400 Bad Request` (`SEAT_LIMIT_EXCEEDED`, max 10 seats).

### 5.2 Get User's Active Hold
- **Method:** `GET`
- **URL:** `/api/shows/:showId/holds/active`
- **Role:** Authenticated (`CUSTOMER`)
- **Success Response (`200 OK`):** Returns hold status, dynamic remaining seconds, and seat details.

### 5.3 Release Hold Manually
- **Method:** `DELETE`
- **URL:** `/api/shows/:showId/holds/:holdId`
- **Role:** Authenticated (`CUSTOMER` who created the hold)
- **Success Response (`200 OK`):** Atomically transitions `ShowSeat` rows to `AVAILABLE` and marks `SeatHold.status = 'RELEASED'`.

---

## 6. Bookings & Simulated Payments (`/api/bookings`)

### 6.1 Create Booking from Hold
- **Method:** `POST`
- **URL:** `/api/bookings`
- **Role:** Authenticated (`CUSTOMER`)
- **Request Body:**
  ```json
  {
    "holdId": "hold-uuid-abc",
    "paymentMethod": "UPI"
  }
  ```
- **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "Booking created successfully in PENDING_PAYMENT status",
    "data": {
      "id": "booking-uuid-xyz",
      "bookingReference": "BK-20261120-ABCD",
      "status": "PENDING_PAYMENT",
      "totalAmount": 360,
      "paymentMethod": "UPI",
      "seats": [ ... ]
    }
  }
  ```
- **Common Errors:** `400 Bad Request` (`HOLD_EXPIRED`), `409 Conflict` (`HOLD_ALREADY_CONSUMED`).

### 6.2 Execute Simulated Payment
- **Method:** `POST`
- **URL:** `/api/bookings/:id/pay`
- **Role:** Authenticated (Booking owner)
- **Concurrency & Idempotency:** Employs row-level locking (`SELECT ... FOR UPDATE`). If already `CONFIRMED`, returns existing confirmation without duplicate charging.
- **Request Body:**
  ```json
  {
    "paymentMethod": "CARD",
    "simulateResult": "SUCCESS" // Options: "SUCCESS" | "FAILED"
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Payment processed successfully. Booking confirmed!",
    "data": {
      "booking": {
        "id": "booking-uuid-xyz",
        "status": "CONFIRMED",
        "bookingReference": "BK-20261120-ABCD"
      },
      "payment": {
        "id": "pay-uuid-1",
        "status": "SUCCESS",
        "amount": 360,
        "paymentMethod": "CARD",
        "transactionId": "TXN-..."
      },
      "tickets": [ ... ]
    }
  }
  ```

### 6.3 List Customer Bookings
- **Method:** `GET`
- **URL:** `/api/bookings`
- **Role:** Authenticated (`CUSTOMER`)
- **Success Response (`200 OK`):** List of bookings with movie info, seats, payment status, tickets, and refund records.

### 6.4 Get Booking Details
- **Method:** `GET`
- **URL:** `/api/bookings/:id`
- **Role:** Authenticated (Booking owner or `ADMIN`)

---

## 7. Digital Tickets & Entrance Validation (`/api/tickets`)

### 7.1 List User Tickets
- **Method:** `GET`
- **URL:** `/api/tickets`
- **Role:** Authenticated (`CUSTOMER`)
- **Success Response (`200 OK`):** Digital tickets including ticket number, seat, show time, and validity status. `qrTokenHash` is strictly excluded.

### 7.2 Get Ticket QR Code
- **Method:** `GET`
- **URL:** `/api/tickets/:id/qr`
- **Role:** Authenticated (Ticket owner or `ADMIN`)
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "ticketId": "ticket-uuid",
      "ticketNumber": "TKT-20261120-WXYZ",
      "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAY..."
    }
  }
  ```

### 7.3 Validate Ticket at Entrance Gate
- **Method:** `POST`
- **URL:** `/api/tickets/validate`
- **Role:** Authenticated (`STAFF` or `ADMIN`)
- **Admission Window:** Open 4 hours before showtime until 30 minutes after start.
- **Request Body:**
  ```json
  {
    "qrToken": "opaque-scanned-token-string"
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Ticket validated successfully! Entry granted.",
    "data": {
      "code": "VALIDATED",
      "ticket": {
        "ticketNumber": "TKT-20261120-WXYZ",
        "status": "USED",
        "seat": { "row": "A", "seatNumber": 1 }
      },
      "validatedBy": { "name": "Ramesh Staff", "role": "STAFF" }
    }
  }
  ```
- **Common Errors:**
  - `400 Bad Request` (`NOT_YET_VALID`, `EXPIRED`, `CANCELLED`).
  - `409 Conflict` (`ALREADY_USED` — duplicate scan prevention).
  - `404 Not Found` (`INVALID_TICKET`).

---

## 8. Booking Cancellation & Refunds (`/api/bookings/:id/cancel`)

### 8.1 Cancel Confirmed Booking
- **Method:** `POST`
- **URL:** `/api/bookings/:id/cancel`
- **Role:** Authenticated (Booking owner or `ADMIN`)
- **Policy Invariants:**
  1. Show start time must be $\ge 2$ hours in the future (`PAST_CANCELLATION_CUTOFF`).
  2. No ticket in the booking has been scanned/used (`TICKET_ALREADY_USED`).
  3. Original `Payment.status` remains `SUCCESS` permanently.
  4. Distinct `Refund` record created with `status = 'PROCESSED'`.
  5. `BookingSeat.releasedAt = now()`, `ShowSeat.status = 'AVAILABLE'`, `Ticket.status = 'CANCELLED'`.
- **Request Body:**
  ```json
  {
    "reason": "Change of plans"
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Booking cancelled successfully. 100% refund of ₹360.00 processed.",
    "data": {
      "booking": {
        "id": "booking-uuid",
        "status": "CANCELLED"
      },
      "refund": {
        "id": "refund-uuid",
        "refundReference": "REF-d7a8e5f2",
        "amount": 360,
        "status": "PROCESSED"
      }
    }
  }
  ```

### 8.2 Get Booking Refunds
- **Method:** `GET`
- **URL:** `/api/bookings/:id/refunds`
- **Role:** Authenticated (Booking owner or `ADMIN`)

---

## 9. Admin Reports & Audit Logs (`/api/admin`)

### 9.1 Overview KPIs
- **Method:** `GET`
- **URL:** `/api/admin/reports/overview`
- **Role:** `ADMIN`
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "revenue": {
        "grossRevenue": 48500,
        "totalRefunds": 1200,
        "netRevenue": 47300,
        "currency": "INR"
      },
      "bookings": {
        "total": 124,
        "confirmed": 115,
        "cancelled": 8,
        "pending": 1,
        "cancellationRate": 6.45
      },
      "occupancy": {
        "totalSeats": 840,
        "bookedSeats": 412,
        "heldSeats": 6,
        "occupancyPercentage": 49.76
      }
    }
  }
  ```

### 9.2 Shows Occupancy Report
- **Method:** `GET`
- **URL:** `/api/admin/reports/shows`
- **Role:** `ADMIN`
- **Success Response (`200 OK`):** Per-show breakdown of capacity, sold seats, occupancy %, and revenue.

### 9.3 Revenue Report
- **Method:** `GET`
- **URL:** `/api/admin/reports/revenue?startDate=2026-11-01&endDate=2026-11-30&groupBy=day`
- **Role:** `ADMIN`
- **Success Response (`200 OK`):** Daily or monthly time-series financial aggregates.

### 9.4 Bookings Report
- **Method:** `GET`
- **URL:** `/api/admin/reports/bookings?startDate=...&status=CONFIRMED`
- **Role:** `ADMIN`

### 9.5 Security Audit Trail
- **Method:** `GET`
- **URL:** `/api/admin/audit-logs?action=BOOKING_CANCELLED&page=1&limit=20`
- **Role:** `ADMIN`
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "log-uuid",
        "action": "BOOKING_CANCELLED",
        "entity": "BOOKING",
        "entityId": "booking-uuid",
        "userId": "user-uuid",
        "createdAt": "2026-11-15T12:00:00.000Z",
        "user": { "name": "Rahul Verma", "email": "rahul@example.com", "role": "CUSTOMER" },
        "details": {
          "bookingReference": "BK-20261115-A1B2",
          "refundReference": "REF-d7a8e5f2",
          "refundAmount": 360
        }
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 }
  }
  ```
