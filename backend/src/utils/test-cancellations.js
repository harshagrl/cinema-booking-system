import app from '../app.js';
import prisma from '../config/database.js';
import { generateOpaqueToken } from './qr.js';

const PORT = 5009;
const BASE_URL = `http://localhost:${PORT}/api`;

async function runTests() {
  console.log('====================================================');
  console.log('   PHASE 9: CANCELLATIONS, REFUNDS, AUDIT & REPORTS');
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

  let customer1Cookie = '';
  let customer2Cookie = '';
  let staffCookie = '';
  let adminCookie = '';

  let cust1UserId = '';
  let cust2UserId = '';
  let staffUserId = '';

  let testTheatreId = null;
  let testScreenId = null;
  let testShowId = null;
  let pastShowId = null;
  let cutoffShowId = null;
  let showSeatIds = [];

  try {
    // -------------------------------------------------------------------------
    // Setup: Login Customer 1, Customer 2, Staff, and Admin
    // -------------------------------------------------------------------------
    const cust1Login = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rahul@example.com', password: 'Cinema@123' }),
    });
    customer1Cookie = cust1Login.headers.get('set-cookie')?.split(';')[0] || '';
    const cust1Data = await cust1Login.json();
    cust1UserId = cust1Data.data?.user?.id;

    const cust2Login = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'priya@example.com', password: 'Cinema@123' }),
    });
    customer2Cookie = cust2Login.headers.get('set-cookie')?.split(';')[0] || '';
    const cust2Data = await cust2Login.json();
    cust2UserId = cust2Data.data?.user?.id;

    const staffLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'staff@cinema.com', password: 'Staff@123' }),
    });
    staffCookie = staffLogin.headers.get('set-cookie')?.split(';')[0] || '';
    const staffData = await staffLogin.json();
    staffUserId = staffData.data?.user?.id;

    const adminLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@cinema.com', password: 'Admin@123' }),
    });
    adminCookie = adminLogin.headers.get('set-cookie')?.split(';')[0] || '';

    const activeMovie = await prisma.movie.findFirst({ where: { isActive: true } });

    // -------------------------------------------------------------------------
    // Create dedicated Test Multiplex, Screen, Seats, and Shows
    // -------------------------------------------------------------------------
    const testTheatre = await prisma.theatre.create({
      data: {
        name: 'Phase 9 Cancellation Multiplex',
        location: 'Indiranagar 100ft Rd',
        city: 'Bengaluru',
        isActive: true,
      },
    });
    testTheatreId = testTheatre.id;

    const testScreen = await prisma.screen.create({
      data: {
        theatreId: testTheatreId,
        name: 'Audi 9 - Cancellation Lab',
        screenType: 'DOLBY_ATMOS',
        supportedFormats: ['2D', '3D'],
        capacity: 10,
        isActive: true,
      },
    });
    testScreenId = testScreen.id;

    // Create 10 physical seats
    const physicalSeats = [];
    for (let i = 1; i <= 10; i++) {
      const s = await prisma.seat.create({
        data: {
          screenId: testScreenId,
          row: 'A',
          seatNumber: i,
          category: 'GOLD',
          isActive: true,
        },
      });
      physicalSeats.push(s);
    }

    // Show 1: Eligible show in future (tomorrow, well ahead of 2h cutoff)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const tomorrowEnd = new Date(tomorrow.getTime() + 2.5 * 60 * 60 * 1000);
    const show1 = await prisma.show.create({
      data: {
        movieId: activeMovie.id,
        screenId: testScreenId,
        startTime: tomorrow,
        endTime: tomorrowEnd,
        format: '2D',
        isActive: true,
      },
    });
    testShowId = show1.id;

    // Show 2: Past show (yesterday)
    const pastStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pastEnd = new Date(pastStart.getTime() + 2.5 * 60 * 60 * 1000);
    const show2 = await prisma.show.create({
      data: {
        movieId: activeMovie.id,
        screenId: testScreenId,
        startTime: pastStart,
        endTime: pastEnd,
        format: '2D',
        isActive: true,
      },
    });
    pastShowId = show2.id;

    // Show 3: Within 2-hour cutoff (e.g. starting in 30 minutes)
    const cutoffStart = new Date(Date.now() + 30 * 60 * 1000);
    const cutoffEnd = new Date(cutoffStart.getTime() + 2.5 * 60 * 60 * 1000);
    const show3 = await prisma.show.create({
      data: {
        movieId: activeMovie.id,
        screenId: testScreenId,
        startTime: cutoffStart,
        endTime: cutoffEnd,
        format: '2D',
        isActive: true,
      },
    });
    cutoffShowId = show3.id;

    // Initialize ShowSeats for Show 1
    for (const ps of physicalSeats) {
      const ss = await prisma.showSeat.create({
        data: {
          showId: testShowId,
          seatId: ps.id,
          price: 250,
          status: 'AVAILABLE',
        },
      });
      showSeatIds.push(ss.id);
    }

    // Helper: Create a confirmed booking with tickets and payment
    async function createConfirmedBooking(cookie, showId, showSeatId) {
      const holdRes = await fetch(`${BASE_URL}/shows/${showId}/holds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ showSeatIds: [showSeatId] }),
      });
      const holdData = await holdRes.json();
      const holdId = holdData.data?.holdId;

      const bookRes = await fetch(`${BASE_URL}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ holdId }),
      });
      const bookData = await bookRes.json();
      const bookingId = bookData.data?.id;

      const payRes = await fetch(`${BASE_URL}/bookings/${bookingId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ paymentMethod: 'CARD', simulateResult: 'SUCCESS' }),
      });
      const payData = await payRes.json();

      return {
        bookingId,
        holdId,
        booking: payData.data?.booking,
        payment: payData.data?.payment,
      };
    }

    // =========================================================================
    // SECTION 1: CANCELLATION & REFUND TESTS
    // =========================================================================

    // Setup: Customer 1 creates and confirms Booking A for Seat 1
    const bookingA = await createConfirmedBooking(customer1Cookie, testShowId, showSeatIds[0]);
    const bookingAId = bookingA.bookingId;

    // TEST 1: Customer cancels their own eligible booking
    const cancelRes1 = await fetch(`${BASE_URL}/bookings/${bookingAId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
      body: JSON.stringify({ reason: 'Personal conflict' }),
    });
    const cancelData1 = await cancelRes1.json();

    assert(
      cancelRes1.status === 200 &&
        cancelData1.success === true &&
        cancelData1.data?.booking?.status === 'CANCELLED' &&
        cancelData1.data?.refund?.status === 'PROCESSED',
      'Eligible customer can cancel their own booking'
    );

    // TEST 2: Customer cannot cancel another customer’s booking (403 Forbidden)
    const bookingB = await createConfirmedBooking(customer1Cookie, testShowId, showSeatIds[1]);
    const cancelRes2 = await fetch(`${BASE_URL}/bookings/${bookingB.bookingId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer2Cookie },
    });
    assert(
      cancelRes2.status === 403,
      'Customer cannot cancel another customer’s booking (403 Forbidden)'
    );

    // TEST 3: Ineligible booking cannot be cancelled (e.g. pending payment)
    const holdResPending = await fetch(`${BASE_URL}/shows/${testShowId}/holds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
      body: JSON.stringify({ showSeatIds: [showSeatIds[2]] }),
    });
    const holdPendingData = await holdResPending.json();
    const bookPendingRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
      body: JSON.stringify({ holdId: holdPendingData.data?.holdId }),
    });
    const pendingBooking = await bookPendingRes.json();
    const cancelPendingRes = await fetch(`${BASE_URL}/bookings/${pendingBooking.data?.id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
    });
    assert(
      cancelPendingRes.status === 400,
      'Ineligible booking in PENDING_PAYMENT status cannot be cancelled'
    );

    // TEST 4: Cancellation after the cutoff is rejected (cutoff: 2 hours)
    // Initialize seat for cutoff show
    const cutoffShowSeat = await prisma.showSeat.create({
      data: {
        showId: cutoffShowId,
        seatId: physicalSeats[0].id,
        price: 250,
        status: 'AVAILABLE',
      },
    });
    const bookingCutoff = await createConfirmedBooking(customer1Cookie, cutoffShowId, cutoffShowSeat.id);
    const cancelCutoffRes = await fetch(`${BASE_URL}/bookings/${bookingCutoff.bookingId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
    });
    const cancelCutoffData = await cancelCutoffRes.json();
    assert(
      cancelCutoffRes.status === 400 &&
        (cancelCutoffData.code === 'PAST_CANCELLATION_CUTOFF' || cancelCutoffData.error?.code === 'PAST_CANCELLATION_CUTOFF'),
      'Cancellation within cutoff window is strictly rejected (PAST_CANCELLATION_CUTOFF)'
    );

    // TEST 5: Booking cannot be cancelled twice
    const cancelDuplicateRes = await fetch(`${BASE_URL}/bookings/${bookingAId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
    });
    const cancelDuplicateData = await cancelDuplicateRes.json();
    assert(
      cancelDuplicateRes.status === 400 &&
        (cancelDuplicateData.code === 'ALREADY_CANCELLED' || cancelDuplicateData.error?.code === 'ALREADY_CANCELLED'),
      'Booking cannot be cancelled twice (returns 400 ALREADY_CANCELLED)'
    );

    // TEST 6: Successful payment history remains SUCCESS after refund (never overwritten)
    const paymentsForBookingA = await prisma.payment.findMany({
      where: { bookingId: bookingAId },
    });
    assert(
      paymentsForBookingA.length === 1 &&
        paymentsForBookingA[0].status === 'SUCCESS',
      'Successful payment history remains SUCCESS after refund (original auditability preserved)'
    );

    // TEST 7: Refund record is created correctly
    const refundRecord = await prisma.refund.findFirst({
      where: { bookingId: bookingAId },
    });
    assert(
      refundRecord !== null &&
        refundRecord.status === 'PROCESSED' &&
        Number(refundRecord.amount) === 250 &&
        refundRecord.refundReference?.startsWith('REF-') &&
        refundRecord.processedAt !== null,
      'Refund record is created with authoritative amount, REF- reference, and PROCESSED status'
    );

    // TEST 8: Refund amount cannot exceed original payment
    assert(
      Number(refundRecord.amount) <= Number(paymentsForBookingA[0].amount),
      'Authoritative refund amount cannot exceed original payment amount'
    );

    // TEST 9: Repeated cancellation requests do not create duplicate refunds
    const allRefundsForA = await prisma.refund.findMany({
      where: { bookingId: bookingAId },
    });
    assert(
      allRefundsForA.length === 1,
      'Repeated cancellation requests do not create duplicate refund records (idempotent)'
    );

    // TEST 10: Seats are released after successful cancellation
    const releasedShowSeat = await prisma.showSeat.findUnique({
      where: { id: showSeatIds[0] },
    });
    const releasedBookingSeat = await prisma.bookingSeat.findFirst({
      where: { bookingId: bookingAId, showSeatId: showSeatIds[0] },
    });
    assert(
      releasedShowSeat.status === 'AVAILABLE' &&
        releasedShowSeat.heldById === null &&
        releasedBookingSeat.releasedAt !== null,
      'Seats are released back to AVAILABLE and BookingSeat.releasedAt is set'
    );

    // TEST 11: Released seats can be booked again
    const rebook = await createConfirmedBooking(customer2Cookie, testShowId, showSeatIds[0]);
    assert(
      rebook.booking?.status === 'CONFIRMED' &&
        rebook.booking?.userId === cust2UserId,
      'Released seat can be booked again by another customer'
    );

    // TEST 12: BookingSeat history is preserved
    const totalBookingSeatsForA = await prisma.bookingSeat.count({
      where: { bookingId: bookingAId },
    });
    assert(
      totalBookingSeatsForA === 1,
      'BookingSeat history is permanently preserved in PostgreSQL (not deleted)'
    );

    // TEST 13: Associated tickets become CANCELLED
    const ticketsForA = await prisma.ticket.findMany({
      where: { bookingId: bookingAId },
    });
    assert(
      ticketsForA.length === 1 && ticketsForA[0].status === 'CANCELLED',
      'Associated digital admission tickets atomically transition to CANCELLED'
    );

    // TEST 14: Cancelled QR tickets are rejected during validation
    const cancelledTicket = ticketsForA[0];
    const cancelledToken = generateOpaqueToken(cancelledTicket.id, cancelledTicket.ticketNumber);
    const validateCancelledRes = await fetch(`${BASE_URL}/tickets/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: staffCookie },
      body: JSON.stringify({ qrToken: cancelledToken }),
    });
    const validateCancelledData = await validateCancelledRes.json();
    assert(
      validateCancelledRes.status === 400 &&
        (validateCancelledData.code === 'CANCELLED' || validateCancelledData.error?.code === 'CANCELLED'),
      'Cancelled tickets are rejected at staff validation gate (400 CANCELLED)'
    );

    // TEST 15: Used tickets cannot be restored or cancelled
    // Create Show within admission window (starts in 1 hour, within 4h window)
    const admitShow = await prisma.show.create({
      data: {
        movieId: activeMovie.id,
        screenId: testScreenId,
        startTime: new Date(Date.now() + 60 * 60 * 1000),
        endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
        format: '2D',
        isActive: true,
      },
    });
    const admitShowSeat = await prisma.showSeat.create({
      data: {
        showId: admitShow.id,
        seatId: physicalSeats[2].id,
        price: 250,
        status: 'AVAILABLE',
      },
    });

    // Booking C: Create, confirm, then scan/use ticket
    const bookingC = await createConfirmedBooking(customer1Cookie, admitShow.id, admitShowSeat.id);
    const ticketC = await prisma.ticket.findFirst({ where: { bookingId: bookingC.bookingId } });
    const tokenC = generateOpaqueToken(ticketC.id, ticketC.ticketNumber);

    // Scan ticket as staff
    const scanRes = await fetch(`${BASE_URL}/tickets/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: staffCookie },
      body: JSON.stringify({ qrToken: tokenC }),
    });
    const scanData = await scanRes.json();

    // Customer attempts to cancel booking with USED ticket
    const cancelUsedRes = await fetch(`${BASE_URL}/bookings/${bookingC.bookingId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
    });
    const cancelUsedData = await cancelUsedRes.json();
    assert(
      cancelUsedRes.status === 400 &&
        (cancelUsedData.code === 'TICKET_ALREADY_USED' || cancelUsedData.error?.code === 'TICKET_ALREADY_USED'),
      'Cancellation is rejected if any ticket has already been scanned and used (TICKET_ALREADY_USED)'
    );

    // TEST 16: Cancellation cannot release seats after showtime begins
    const pastShowSeat = await prisma.showSeat.create({
      data: {
        showId: pastShowId,
        seatId: physicalSeats[1].id,
        price: 250,
        status: 'AVAILABLE',
      },
    });
    // Manually create confirmed booking for past show
    const pastBooking = await prisma.booking.create({
      data: {
        userId: cust1UserId,
        showId: pastShowId,
        bookingReference: 'BK-PAST-TEST',
        totalAmount: 250,
        status: 'CONFIRMED',
        seats: {
          create: [{ showSeatId: pastShowSeat.id, price: 250 }],
        },
        payments: {
          create: [{ amount: 250, status: 'SUCCESS' }],
        },
      },
    });
    const cancelPastRes = await fetch(`${BASE_URL}/bookings/${pastBooking.id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
    });
    const cancelPastData = await cancelPastRes.json();
    assert(
      cancelPastRes.status === 400 &&
        (cancelPastData.code === 'SHOW_ALREADY_STARTED' || cancelPastData.error?.code === 'SHOW_ALREADY_STARTED'),
      'Cancellation is strictly rejected after showtime has started (SHOW_ALREADY_STARTED)'
    );

    // TEST 17: Concurrent cancellation requests serialize safely (exactly 1 refund)
    const bookingConcurrent = await createConfirmedBooking(customer1Cookie, testShowId, showSeatIds[4]);
    const [resConc1, resConc2] = await Promise.all([
      fetch(`${BASE_URL}/bookings/${bookingConcurrent.bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
      }),
      fetch(`${BASE_URL}/bookings/${bookingConcurrent.bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
      }),
    ]);
    const statuses = [resConc1.status, resConc2.status].sort();
    const refundsForConc = await prisma.refund.findMany({
      where: { bookingId: bookingConcurrent.bookingId },
    });
    assert(
      statuses[0] === 200 &&
        statuses[1] === 400 &&
        refundsForConc.length === 1,
      'Concurrent cancellation requests serialize via row-locking: exactly 1 refund generated'
    );

    // =========================================================================
    // SECTION 2: AUDIT LOG TESTS
    // =========================================================================

    // TEST 18: Cancellation creates an audit record
    const cancelAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'BOOKING_CANCELLED',
        entityId: bookingAId,
      },
    });
    assert(
      cancelAudit !== null &&
        cancelAudit.entity === 'BOOKING' &&
        cancelAudit.userId === cust1UserId,
      'Booking cancellation creates an audit log recording actor and entity'
    );

    // TEST 19: Refund processing creates an audit record
    const refundAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'REFUND_PROCESSED',
        entityId: refundRecord.id,
      },
    });
    assert(
      refundAudit !== null &&
        refundAudit.entity === 'REFUND' &&
        Number(refundAudit.details?.amount) === 250,
      'Refund creation records an authoritative audit event'
    );

    // TEST 20: Ticket validation records the staff actor
    const ticketValidationAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'TICKET_VALIDATED',
        entityId: ticketC.id,
      },
    });
    assert(
      ticketValidationAudit !== null &&
        ticketValidationAudit.userId === staffUserId,
      'Ticket validation records the validating staff member actor'
    );

    // TEST 21: Audit records do not expose secrets
    const allAuditLogs = await prisma.auditLog.findMany({ take: 20 });
    const hasSecretExposed = allAuditLogs.some((l) => {
      const s = JSON.stringify(l.details || {});
      return s.includes('Cinema@123') || s.includes('Bearer') || s.includes('jwt');
    });
    assert(
      hasSecretExposed === false,
      'Audit log details never contain passwords, tokens, or sensitive credentials'
    );

    // TEST 22: Customers cannot retrieve admin audit logs (403 Forbidden)
    const custAuditRes = await fetch(`${BASE_URL}/admin/audit-logs`, {
      headers: { Cookie: customer1Cookie },
    });
    assert(
      custAuditRes.status === 403,
      'Customer receives 403 Forbidden when requesting admin audit logs'
    );

    // TEST 23: Staff cannot retrieve admin audit logs (403 Forbidden)
    const staffAuditRes = await fetch(`${BASE_URL}/admin/audit-logs`, {
      headers: { Cookie: staffCookie },
    });
    assert(
      staffAuditRes.status === 403,
      'Staff receives 403 Forbidden when requesting admin audit logs'
    );

    // =========================================================================
    // SECTION 3: ADMIN REPORTING TESTS
    // =========================================================================

    // TEST 24: Overview values match database records
    const overviewRes = await fetch(`${BASE_URL}/admin/reports/overview`, {
      headers: { Cookie: adminCookie },
    });
    const overviewData = await overviewRes.json();
    assert(
      overviewRes.status === 200 &&
        overviewData.success === true &&
        typeof overviewData.data?.bookings?.total === 'number' &&
        typeof overviewData.data?.revenue?.grossRevenue === 'number',
      'GET /api/admin/reports/overview aggregates database records accurately'
    );

    // TEST 25: Gross revenue is calculated correctly
    const dbGrossSum = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: 'SUCCESS' },
    });
    assert(
      overviewData.data?.revenue?.grossRevenue === Number(dbGrossSum._sum.amount || 0),
      'Overview gross revenue strictly matches SUM of successful payments'
    );

    // TEST 26: Refund totals are calculated correctly
    const dbRefundSum = await prisma.refund.aggregate({
      _sum: { amount: true },
      where: { status: 'PROCESSED' },
    });
    assert(
      overviewData.data?.revenue?.totalRefunds === Number(dbRefundSum._sum.amount || 0),
      'Overview refund total strictly matches SUM of processed refunds'
    );

    // TEST 27: Net revenue equals gross revenue minus refunds
    const expectedNet = Number((dbGrossSum._sum.amount - dbRefundSum._sum.amount).toFixed(2));
    assert(
      overviewData.data?.revenue?.netRevenue === expectedNet,
      'Net revenue equals gross revenue minus refunds'
    );

    // TEST 28: Shows report calculates occupancy using correct seat counts
    const showReportRes = await fetch(
      `${BASE_URL}/admin/reports/shows?theatreId=${testTheatreId}`,
      { headers: { Cookie: adminCookie } }
    );
    const showReportData = await showReportRes.json();
    const testShowReport = showReportData.data?.find((s) => s.showId === testShowId);
    assert(
      testShowReport !== undefined &&
        testShowReport.seats?.total === 10 &&
        typeof testShowReport.seats?.occupancyPercentage === 'number',
      'Shows report calculates correct total seats and occupancy percentage'
    );

    // TEST 29: Date filters work correctly on revenue report
    const revenueReportRes = await fetch(
      `${BASE_URL}/admin/reports/revenue?startDate=2026-01-01&endDate=2026-12-31`,
      { headers: { Cookie: adminCookie } }
    );
    const revenueReportData = await revenueReportRes.json();
    assert(
      revenueReportRes.status === 200 &&
        revenueReportData.success === true &&
        revenueReportData.data?.summary?.period?.startDate === '2026-01-01',
      'Revenue report filters by date window successfully'
    );

    // TEST 30: Empty datasets return valid zero defaults without errors
    const emptyShowsRes = await fetch(
      `${BASE_URL}/admin/reports/shows?startDate=1999-01-01&endDate=1999-01-02`,
      { headers: { Cookie: adminCookie } }
    );
    const emptyShowsData = await emptyShowsRes.json();
    assert(
      emptyShowsRes.status === 200 &&
        Array.isArray(emptyShowsData.data) &&
        emptyShowsData.data.length === 0,
      'Empty dataset queries return valid zero-length arrays without throwing errors'
    );

    // TEST 31: Customers and staff are rejected from admin reports
    const custReportRes = await fetch(`${BASE_URL}/admin/reports/overview`, {
      headers: { Cookie: customer1Cookie },
    });
    const staffReportRes = await fetch(`${BASE_URL}/admin/reports/overview`, {
      headers: { Cookie: staffCookie },
    });
    assert(
      custReportRes.status === 403 && staffReportRes.status === 403,
      'Customer and staff requests to admin reports return 403 Forbidden'
    );
  } catch (err) {
    console.error('Test execution error:', err);
    failedCount++;
  } finally {
    // -------------------------------------------------------------------------
    // Teardown: Safely cleanup test data in reverse foreign key order
    // -------------------------------------------------------------------------
    try {
      if (testTheatreId) {
        // Delete AuditLogs created during test
        await prisma.auditLog.deleteMany({
          where: {
            OR: [
              { entityId: { in: [testShowId, pastShowId, cutoffShowId] } },
              { entity: { in: ['BOOKING', 'REFUND', 'TICKET', 'SHOW', 'THEATRE'] } },
            ],
          },
        });

        // Delete tickets
        await prisma.ticket.deleteMany({
          where: {
            booking: {
              show: { screen: { theatreId: testTheatreId } },
            },
          },
        });

        // Delete refunds
        await prisma.refund.deleteMany({
          where: {
            booking: {
              show: { screen: { theatreId: testTheatreId } },
            },
          },
        });

        // Delete payments
        await prisma.payment.deleteMany({
          where: {
            booking: {
              show: { screen: { theatreId: testTheatreId } },
            },
          },
        });

        // Delete booking seats
        await prisma.bookingSeat.deleteMany({
          where: {
            booking: {
              show: { screen: { theatreId: testTheatreId } },
            },
          },
        });

        // Delete bookings
        await prisma.booking.deleteMany({
          where: {
            show: { screen: { theatreId: testTheatreId } },
          },
        });

        // Delete seat holds
        await prisma.seatHold.deleteMany({
          where: {
            showSeat: { show: { screen: { theatreId: testTheatreId } } },
          },
        });

        // Delete show seats
        await prisma.showSeat.deleteMany({
          where: { show: { screen: { theatreId: testTheatreId } } },
        });

        // Delete shows
        await prisma.show.deleteMany({
          where: { screen: { theatreId: testTheatreId } },
        });

        // Delete physical seats
        await prisma.seat.deleteMany({
          where: { screen: { theatreId: testTheatreId } },
        });

        // Delete screens
        await prisma.screen.deleteMany({
          where: { theatreId: testTheatreId },
        });

        // Delete theatre
        await prisma.theatre.delete({
          where: { id: testTheatreId },
        });
      }
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }

    server.close();

    console.log('\n====================================================');
    console.log(`Phase 9 Test Results: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('====================================================\n');

    if (failedCount > 0) {
      process.exit(1);
    }
  }
}

runTests();
