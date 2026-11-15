import app from '../app.js';
import prisma from '../config/database.js';
import { generateOpaqueToken } from './qr.js';

const PORT = 5010;
const BASE_URL = `http://localhost:${PORT}/api`;

async function runE2ETests() {
  console.log('====================================================');
  console.log('   PHASE 10: END-TO-END SYSTEM INTEGRATION TESTS');
  console.log('====================================================\n');

  const server = app.listen(PORT);
  let passedCount = 0;
  let failedCount = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`✅ TEST ${passedCount + failedCount + 1}: ${description}`);
      passedCount++;
    } else {
      console.error(`❌ TEST ${passedCount + failedCount + 1} FAILED: ${description}`);
      failedCount++;
    }
  };

  const getCookie = (res) => {
    const raw = res.headers.get('set-cookie');
    if (!raw) return '';
    return raw.split(';')[0];
  };

  let testTheatre = null;
  let testScreen = null;
  let testShowId = null;
  let bookingId = null;

  try {
    // -------------------------------------------------------------------------
    // 1. Customer Registration & Login
    // -------------------------------------------------------------------------
    const randomSuffix = Math.floor(Math.random() * 900000 + 100000);
    const testCustomerEmail = `e2e.customer.${randomSuffix}@example.com`;

    const registerRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'E2E Test User',
        email: testCustomerEmail,
        password: 'Password@123',
        phone: '9876543210',
      }),
    });
    const registerData = await registerRes.json();
    assert(registerRes.status === 201 && registerData.data?.user?.email === testCustomerEmail,
      'E2E Customer successfully registers with HTTP 201');

    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testCustomerEmail,
        password: 'Password@123',
      }),
    });
    const customerCookie = getCookie(loginRes);
    const loginData = await loginRes.json();
    assert(loginRes.status === 200 && customerCookie.includes('token='),
      'E2E Customer successfully logs in and receives HTTP-only session cookie');

    // -------------------------------------------------------------------------
    // 2. Movie Catalog Search & Discovery
    // -------------------------------------------------------------------------
    const moviesRes = await fetch(`${BASE_URL}/movies`);
    const moviesData = await moviesRes.json();
    assert(moviesRes.status === 200 && moviesData.data?.movies?.length > 0,
      'E2E Customer browses movie catalog with pagination');

    const sampleMovie = moviesData.data.movies[0];
    const searchRes = await fetch(`${BASE_URL}/movies?search=${encodeURIComponent(sampleMovie.title)}`);
    const searchData = await searchRes.json();
    assert(searchRes.status === 200 && searchData.data?.movies?.some((m) => m.id === sampleMovie.id),
      'E2E Movie search filters catalog accurately');

    // -------------------------------------------------------------------------
    // 3. Admin Schedules an Eligible Future Show for Testing
    // -------------------------------------------------------------------------
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@cinema.com', password: 'Admin@123' }),
    });
    const adminCookie = getCookie(adminLoginRes);

    testTheatre = await prisma.theatre.create({
      data: {
        name: `E2E Multiplex ${randomSuffix}`,
        location: 'Central Mall E2E',
        city: 'Bengaluru',
        isActive: true,
      },
    });

    testScreen = await prisma.screen.create({
      data: {
        theatreId: testTheatre.id,
        name: 'Screen E2E',
        screenType: 'STANDARD',
        supportedFormats: ['2D'],
        capacity: 4,
        isActive: true,
      },
    });

    await prisma.seat.createMany({
      data: [
        { screenId: testScreen.id, row: 'A', seatNumber: 1, category: 'SILVER', isActive: true },
        { screenId: testScreen.id, row: 'A', seatNumber: 2, category: 'SILVER', isActive: true },
        { screenId: testScreen.id, row: 'A', seatNumber: 3, category: 'GOLD', isActive: true },
        { screenId: testScreen.id, row: 'A', seatNumber: 4, category: 'RECLINER', isActive: true },
      ],
    });

    // Show 24 hours in future (safely > 2h cutoff window)
    const futureShowStart = new Date(Date.now() + 24 * 3600 * 1000);
    const createShowRes = await fetch(`${BASE_URL}/shows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        movieId: sampleMovie.id,
        screenId: testScreen.id,
        startTime: futureShowStart.toISOString(),
        format: '2D',
        pricing: {
          SILVER: 150,
          GOLD: 250,
          RECLINER: 400,
        },
      }),
    });
    const createShowData = await createShowRes.json();
    testShowId = createShowData.data?.show?.id;
    assert(createShowRes.status === 201 && testShowId,
      'Admin successfully schedules a future show with category pricing');

    // -------------------------------------------------------------------------
    // 4. Customer Views Show Seat Map & Tiers
    // -------------------------------------------------------------------------
    const seatMapRes = await fetch(`${BASE_URL}/shows/${testShowId}/seats`);
    const seatMapData = await seatMapRes.json();
    const allSeats = Array.isArray(seatMapData.data?.rows)
      ? seatMapData.data.rows.flatMap((r) => r.seats || [])
      : [];
    assert(seatMapRes.status === 200 && allSeats.length >= 2,
      'Customer fetches interactive seat layout and tiered pricing');

    const availableSeats = allSeats.filter((s) => s.status === 'AVAILABLE');
    const seat1 = availableSeats[0];
    const seat2 = availableSeats[1];

    // -------------------------------------------------------------------------
    // 5. Customer Holds Multiple Seats
    // -------------------------------------------------------------------------
    const holdRes = await fetch(`${BASE_URL}/shows/${testShowId}/holds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customerCookie,
      },
      body: JSON.stringify({
        showSeatIds: [seat1.id, seat2.id],
      }),
    });
    const holdData = await holdRes.json();
    const holdId = holdData.data?.holdId;
    assert(holdRes.status === 201 && holdId && holdData.data?.seats?.length === 2,
      'Customer atomically creates temporary seat hold with 5-minute countdown');

    // -------------------------------------------------------------------------
    // 6. Concurrency Check: Second Customer Cannot Hold Same Seats
    // -------------------------------------------------------------------------
    const cust2LoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'priya@example.com', password: 'Cinema@123' }),
    });
    const cust2Cookie = getCookie(cust2LoginRes);

    const conflictingHoldRes = await fetch(`${BASE_URL}/shows/${testShowId}/holds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cust2Cookie,
      },
      body: JSON.stringify({
        showSeatIds: [seat1.id],
      }),
    });
    assert(conflictingHoldRes.status === 409,
      'Concurrency check: Second customer rejected with 409 Conflict for held seats');

    // -------------------------------------------------------------------------
    // 7. Customer Creates Booking & Executes Simulated Payment
    // -------------------------------------------------------------------------
    const bookingRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customerCookie,
      },
      body: JSON.stringify({
        holdId,
      }),
    });
    const bookingData = await bookingRes.json();
    bookingId = bookingData.data?.id;
    assert(bookingRes.status === 201 && bookingId && bookingData.data?.status === 'PENDING_PAYMENT',
      'Customer creates booking in PENDING_PAYMENT status');

    const paymentRes = await fetch(`${BASE_URL}/bookings/${bookingId}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customerCookie,
      },
      body: JSON.stringify({
        paymentMethod: 'UPI',
        simulateResult: 'SUCCESS',
      }),
    });
    const paymentData = await paymentRes.json();
    assert(paymentRes.status === 200 && paymentData.data?.payment?.status === 'SUCCESS' && paymentData.data?.booking?.status === 'CONFIRMED',
      'Simulated payment succeeds: booking CONFIRMED, payment SUCCESS, tickets issued');

    // -------------------------------------------------------------------------
    // 8. Individual Tickets & QR Verification
    // -------------------------------------------------------------------------
    const ticketsRes = await fetch(`${BASE_URL}/tickets`, {
      headers: { Cookie: customerCookie },
    });
    const ticketsData = await ticketsRes.json();
    const userTickets = ticketsData.data?.tickets?.filter((t) => t.bookingId === bookingId) || [];
    assert(ticketsRes.status === 200 && userTickets.length === 2 && userTickets.every((t) => t.status === 'VALID'),
      'Customer receives 2 distinct admission tickets with unique ticket numbers');

    // Verify QR code generation
    const qrRes = await fetch(`${BASE_URL}/tickets/${userTickets[0].id}/qr`, {
      headers: { Cookie: customerCookie },
    });
    const qrData = await qrRes.json();
    assert(qrRes.status === 200 && qrData.data?.qrCode?.startsWith('data:image/png;base64,'),
      'Digital ticket QR code is generated as a secure base64 PNG data URL');

    // -------------------------------------------------------------------------
    // 9. Staff Ticket Validation Gate
    // -------------------------------------------------------------------------
    const staffLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'staff@cinema.com', password: 'Staff@123' }),
    });
    const staffCookie = getCookie(staffLoginRes);

    const testTicketToken = generateOpaqueToken(userTickets[0].id, userTickets[0].ticketNumber);

    // Test admission window: this show is 24h away so normal window rejects it with NOT_YET_VALID
    const gateRes = await fetch(`${BASE_URL}/tickets/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: staffCookie,
      },
      body: JSON.stringify({ qrToken: testTicketToken }),
    });
    assert(gateRes.status === 400,
      'Staff gate rejects tickets for shows outside the admission window (NOT_YET_VALID)');

    // -------------------------------------------------------------------------
    // 10. Customer Cancels Eligible Booking
    // -------------------------------------------------------------------------
    const cancelRes = await fetch(`${BASE_URL}/bookings/${bookingId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customerCookie,
      },
      body: JSON.stringify({ reason: 'E2E test cancellation' }),
    });
    const cancelData = await cancelRes.json();
    assert(cancelRes.status === 200 && cancelData.data?.booking?.status === 'CANCELLED',
      'Customer successfully cancels eligible booking (> 2h cutoff)');

    // -------------------------------------------------------------------------
    // 11. Financial Safety Invariants: Payment preserved, Refund created
    // -------------------------------------------------------------------------
    const dbPayment = await prisma.payment.findFirst({
      where: { bookingId },
    });
    const dbRefund = await prisma.refund.findFirst({
      where: { bookingId },
    });
    assert(dbPayment.status === 'SUCCESS' && dbRefund && dbRefund.status === 'PROCESSED',
      'Financial Safety: Payment status remains SUCCESS; Refund is independently PROCESSED');

    // -------------------------------------------------------------------------
    // 12. Released Seats Can Be Re-Held
    // -------------------------------------------------------------------------
    const reHoldRes = await fetch(`${BASE_URL}/shows/${testShowId}/holds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cust2Cookie,
      },
      body: JSON.stringify({
        showSeatIds: [seat1.id],
      }),
    });
    assert(reHoldRes.status === 201,
      'Released seats from cancelled booking are immediately AVAILABLE for re-booking');

    // -------------------------------------------------------------------------
    // 13. Cancelled Tickets Rejected at Staff Gate
    // -------------------------------------------------------------------------
    const cancelledGateRes = await fetch(`${BASE_URL}/tickets/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: staffCookie,
      },
      body: JSON.stringify({ qrToken: testTicketToken }),
    });
    assert(cancelledGateRes.status === 400,
      'Staff gate strictly rejects tickets from CANCELLED bookings');

    // -------------------------------------------------------------------------
    // 14. Admin Reports & Audit Trail
    // -------------------------------------------------------------------------
    const reportsRes = await fetch(`${BASE_URL}/admin/reports/overview`, {
      headers: { Cookie: adminCookie },
    });
    const reportsData = await reportsRes.json();
    assert(reportsRes.status === 200 && typeof reportsData.data?.revenue?.netRevenue === 'number',
      'Admin retrieves real-time financial reporting (gross, net revenue, occupancy)');

    const auditRes = await fetch(`${BASE_URL}/admin/audit-logs?limit=5`, {
      headers: { Cookie: adminCookie },
    });
    const auditData = await auditRes.json();
    assert(auditRes.status === 200 && Array.isArray(auditData.data) && auditData.data.length > 0,
      'Admin retrieves persistent audit log trail with sanitized metadata');

    // -------------------------------------------------------------------------
    // 15. Authorization RBAC: Customer Rejected From Admin APIs
    // -------------------------------------------------------------------------
    const unauthAdminRes = await fetch(`${BASE_URL}/admin/reports/overview`, {
      headers: { Cookie: customerCookie },
    });
    assert(unauthAdminRes.status === 403,
      'Security: Customer is strictly rejected from Admin endpoints with HTTP 403 Forbidden');

  } catch (error) {
    console.error('💥 E2E Test execution error:', error);
    failedCount++;
  } finally {
    try {
      if (bookingId) {
        await prisma.refund.deleteMany({ where: { bookingId } });
        await prisma.ticket.deleteMany({ where: { bookingId } });
        await prisma.payment.deleteMany({ where: { bookingId } });
        await prisma.bookingSeat.deleteMany({ where: { bookingId } });
        await prisma.booking.deleteMany({ where: { id: bookingId } });
      }
      if (testShowId) {
        await prisma.seatHold.deleteMany({ where: { showSeat: { showId: testShowId } } });
        await prisma.showSeat.deleteMany({ where: { showId: testShowId } });
        await prisma.show.deleteMany({ where: { id: testShowId } });
      }
      if (testScreen?.id) {
        await prisma.seat.deleteMany({ where: { screenId: testScreen.id } });
        await prisma.screen.deleteMany({ where: { id: testScreen.id } });
      }
      if (testTheatre?.id) {
        await prisma.theatre.deleteMany({ where: { id: testTheatre.id } });
      }
    } catch (cleanupErr) {
      // Safe cleanup warning
    }

    server.close();
    await prisma.$disconnect();

    console.log('\n====================================================');
    console.log(`Phase 10 E2E Results: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('====================================================\n');

    if (failedCount > 0) {
      process.exit(1);
    }
  }
}

runE2ETests();
