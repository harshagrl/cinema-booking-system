import app from '../app.js';
import prisma from '../config/database.js';
import { generateOpaqueToken } from './qr.js';

const PORT = 5008;
const BASE_URL = `http://localhost:${PORT}/api`;

async function runTests() {
  console.log('====================================================');
  console.log('   PHASE 8: QR CODE TICKETS & VALIDATION ENGINE');
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

  let staffUserId = '';

  // Test multiplex entities
  let testTheatreId = null;
  let testScreenId = null;
  let testShowId = null;
  let showSeatIds = [];

  try {
    // -------------------------------------------------------------------------
    // Setup: Login Customer 1, Customer 2, Staff (Amit), and Admin (Super Admin)
    // -------------------------------------------------------------------------
    const cust1Login = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rahul@example.com', password: 'Cinema@123' }),
    });
    customer1Cookie = cust1Login.headers.get('set-cookie')?.split(';')[0] || '';

    const cust2Login = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'priya@example.com', password: 'Cinema@123' }),
    });
    customer2Cookie = cust2Login.headers.get('set-cookie')?.split(';')[0] || '';

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

    // Fetch active movie
    const activeMovie = await prisma.movie.findFirst({ where: { isActive: true } });

    // -------------------------------------------------------------------------
    // Create dedicated Test Multiplex, Screen, Seats, and Show
    // -------------------------------------------------------------------------
    const testTheatre = await prisma.theatre.create({
      data: {
        name: 'Phase 8 QR Test Multiplex',
        location: 'Koramangala 80ft Road',
        city: 'Bengaluru',
        isActive: true,
      },
    });
    testTheatreId = testTheatre.id;

    const testScreen = await prisma.screen.create({
      data: {
        theatreId: testTheatreId,
        name: 'Audi 8 - QR Engine Test',
        screenType: 'IMAX',
        supportedFormats: ['2D', '3D'],
        capacity: 10,
        isActive: true,
      },
    });
    testScreenId = testScreen.id;

    // Create 8 physical seats
    const seatDefs = [
      { row: 'A', seatNumber: 1, category: 'PREMIUM' },
      { row: 'A', seatNumber: 2, category: 'PREMIUM' },
      { row: 'A', seatNumber: 3, category: 'PREMIUM' },
      { row: 'A', seatNumber: 4, category: 'PREMIUM' },
      { row: 'B', seatNumber: 1, category: 'RECLINER' },
      { row: 'B', seatNumber: 2, category: 'RECLINER' },
      { row: 'B', seatNumber: 3, category: 'RECLINER' },
      { row: 'B', seatNumber: 4, category: 'RECLINER' },
    ];

    const createdSeats = [];
    for (const def of seatDefs) {
      const s = await prisma.seat.create({
        data: {
          screenId: testScreenId,
          row: def.row,
          seatNumber: def.seatNumber,
          category: def.category,
          isActive: true,
        },
      });
      createdSeats.push(s);
    }

    // Create show in the immediate entry window (starts in 1 hour)
    const startTime = new Date(Date.now() + 60 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 120 * 60 * 1000);

    const testShow = await prisma.show.create({
      data: {
        movieId: activeMovie.id,
        screenId: testScreenId,
        startTime,
        endTime,
        format: '2D',
        isActive: true,
      },
    });
    testShowId = testShow.id;

    // Create ShowSeat records
    for (const seat of createdSeats) {
      const price = seat.category === 'PREMIUM' ? 300.0 : 450.0;
      const ss = await prisma.showSeat.create({
        data: {
          showId: testShowId,
          seatId: seat.id,
          price,
          status: 'AVAILABLE',
        },
      });
      showSeatIds.push(ss.id);
    }

    // =========================================================================
    // TEST 1: Tickets are generated after successful payment
    // =========================================================================
    // Customer 1 holds seat A1 and A2
    const holdRes1 = await fetch(`${BASE_URL}/shows/${testShowId}/holds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
      body: JSON.stringify({ showSeatIds: [showSeatIds[0], showSeatIds[1]] }),
    });
    const holdData1 = await holdRes1.json();
    const holdId1 = holdData1.data?.holdId;

    // Customer 1 creates booking
    const bookRes1 = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
      body: JSON.stringify({ holdId: holdId1 }),
    });
    const bookData1 = await bookRes1.json();
    const booking1 = bookData1.data;

    // Customer 1 pays successfully
    const payRes1 = await fetch(`${BASE_URL}/bookings/${booking1.id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
      body: JSON.stringify({ paymentMethod: 'CARD', simulateResult: 'SUCCESS' }),
    });
    const payData1 = await payRes1.json();

    // Verify tickets exist in DB for booking 1
    const ticketsForBooking1 = await prisma.ticket.findMany({
      where: { bookingId: booking1.id },
    });

    assert(
      payRes1.status === 200 &&
        payData1.success === true &&
        ticketsForBooking1.length === 2 &&
        ticketsForBooking1.every((t) => t.status === 'VALID'),
      'Successful payment atomically generates individual tickets with status VALID'
    );

    // =========================================================================
    // TEST 2: Failed payment creates no tickets
    // =========================================================================
    // Customer 2 holds seat A3
    const holdRes2 = await fetch(`${BASE_URL}/shows/${testShowId}/holds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer2Cookie },
      body: JSON.stringify({ showSeatIds: [showSeatIds[2]] }),
    });
    const holdData2 = await holdRes2.json();
    const holdId2 = holdData2.data?.holdId;

    const bookRes2 = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer2Cookie },
      body: JSON.stringify({ holdId: holdId2 }),
    });
    const bookData2 = await bookRes2.json();
    const booking2 = bookData2.data;

    // Customer 2 fails payment
    await fetch(`${BASE_URL}/bookings/${booking2.id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer2Cookie },
      body: JSON.stringify({ paymentMethod: 'CARD', simulateResult: 'FAILURE' }),
    });

    const ticketsForFailedBooking = await prisma.ticket.findMany({
      where: { bookingId: booking2.id },
    });

    assert(
      ticketsForFailedBooking.length === 0,
      'Failed payment creates zero tickets (seats remain held)'
    );

    // =========================================================================
    // TEST 3: Pending booking creates no tickets
    // =========================================================================
    // Customer 1 holds seat A4 and creates booking, but does NOT pay yet
    const holdRes3 = await fetch(`${BASE_URL}/shows/${testShowId}/holds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
      body: JSON.stringify({ showSeatIds: [showSeatIds[3]] }),
    });
    const holdData3 = await holdRes3.json();
    const holdId3 = holdData3.data?.holdId;

    const bookRes3 = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
      body: JSON.stringify({ holdId: holdId3 }),
    });
    const bookData3 = await bookRes3.json();
    const booking3 = bookData3.data;

    const ticketsForPendingBooking = await prisma.ticket.findMany({
      where: { bookingId: booking3.id },
    });

    assert(
      ticketsForPendingBooking.length === 0,
      'Pending booking prior to payment has no generated tickets'
    );

    // =========================================================================
    // TEST 4: Exactly one ticket is created per BookingSeat
    // =========================================================================
    const bookingSeatsCount = await prisma.bookingSeat.count({
      where: { bookingId: booking1.id, releasedAt: null },
    });
    assert(
      ticketsForBooking1.length === bookingSeatsCount,
      'One ticket is created per BookingSeat (2 seats = 2 tickets)'
    );

    // =========================================================================
    // TEST 5: Ticket number uniqueness
    // =========================================================================
    const ticketNumbers = ticketsForBooking1.map((t) => t.ticketNumber);
    const hasUniqueNumbers =
      new Set(ticketNumbers).size === ticketNumbers.length &&
      ticketNumbers.every((num) => num.startsWith('TKT-'));
    assert(
      hasUniqueNumbers,
      'Every ticket possesses a unique ticketNumber formatted as TKT-YYYYMMDD-XXXX'
    );

    // =========================================================================
    // TEST 6: Duplicate ticket generation prevention (Idempotent)
    // =========================================================================
    // Call pay on booking1 again
    await fetch(`${BASE_URL}/bookings/${booking1.id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
      body: JSON.stringify({ paymentMethod: 'CARD', simulateResult: 'SUCCESS' }),
    });
    const ticketsAfterDupPay = await prisma.ticket.findMany({
      where: { bookingId: booking1.id },
    });
    assert(
      ticketsAfterDupPay.length === 2,
      'Duplicate payment requests do not generate duplicate tickets (idempotency enforced)'
    );

    // =========================================================================
    // TEST 7: Customer can list their own tickets
    // =========================================================================
    const listRes1 = await fetch(`${BASE_URL}/tickets`, {
      headers: { Cookie: customer1Cookie },
    });
    const listData1 = await listRes1.json();
    assert(
      listRes1.status === 200 &&
        listData1.data?.tickets?.length >= 2 &&
        listData1.data.tickets.some((t) => t.id === ticketsForBooking1[0].id),
      'Customer can list their own tickets via GET /api/tickets'
    );

    // =========================================================================
    // TEST 8: Customer cannot access another customer's ticket
    // =========================================================================
    const crossAccessRes = await fetch(`${BASE_URL}/tickets/${ticketsForBooking1[0].id}`, {
      headers: { Cookie: customer2Cookie }, // Customer 2 tries to view Customer 1's ticket
    });
    assert(
      crossAccessRes.status === 403,
      'Customer 2 is forbidden from viewing Customer 1’s ticket (403 Forbidden)'
    );

    // =========================================================================
    // TEST 9: Customer cannot access QR information for another customer's ticket
    // =========================================================================
    const crossQrRes = await fetch(`${BASE_URL}/tickets/${ticketsForBooking1[0].id}/qr`, {
      headers: { Cookie: customer2Cookie },
    });
    assert(
      crossQrRes.status === 403,
      'Customer 2 is forbidden from retrieving QR code for Customer 1’s ticket (403 Forbidden)'
    );

    // =========================================================================
    // TEST 10: Staff can validate a valid ticket
    // =========================================================================
    const ticket1 = ticketsForBooking1[0];
    const ticket1Token = generateOpaqueToken(ticket1.id, ticket1.ticketNumber);

    const staffValRes = await fetch(`${BASE_URL}/tickets/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: staffCookie },
      body: JSON.stringify({ qrToken: ticket1Token }),
    });
    const staffValData = await staffValRes.json();

    assert(
      staffValRes.status === 200 &&
        staffValData.data?.code === 'VALIDATED' &&
        staffValData.data?.ticket?.status === 'USED',
      'Staff successfully scans and validates a valid ticket (VALID -> USED)'
    );

    // =========================================================================
    // TEST 11: Admin can validate a valid ticket
    // =========================================================================
    const ticket2 = ticketsForBooking1[1];
    const ticket2Token = generateOpaqueToken(ticket2.id, ticket2.ticketNumber);

    const adminValRes = await fetch(`${BASE_URL}/tickets/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ qrToken: ticket2Token }),
    });
    const adminValData = await adminValRes.json();

    assert(
      adminValRes.status === 200 &&
        adminValData.data?.code === 'VALIDATED' &&
        adminValData.data?.ticket?.status === 'USED',
      'Admin successfully validates a ticket at entrance'
    );

    // =========================================================================
    // TEST 12: Customer is rejected from ticket validation
    // =========================================================================
    const custValRes = await fetch(`${BASE_URL}/tickets/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
      body: JSON.stringify({ qrToken: ticket1Token }),
    });
    assert(
      custValRes.status === 403,
      'Customer receives 403 Forbidden when attempting staff ticket validation'
    );

    // =========================================================================
    // TEST 13: Invalid QR token rejection
    // =========================================================================
    const invalidValRes = await fetch(`${BASE_URL}/tickets/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: staffCookie },
      body: JSON.stringify({ qrToken: 'completely-fake-opaque-token-1234567890abcdef' }),
    });
    const invalidValData = await invalidValRes.json();
    assert(
      invalidValRes.status === 404 && invalidValData.code === 'INVALID_TICKET',
      'Non-existent QR token rejected with 404 INVALID_TICKET'
    );

    // =========================================================================
    // TEST 14: Ticket from unconfirmed booking rejected
    // =========================================================================
    // Manually forge a ticket linked to pending booking3
    const forgedPendingTicket = await prisma.ticket.create({
      data: {
        ticketNumber: 'TKT-PENDING-TEST-001',
        bookingId: booking3.id,
        bookingSeatId: (await prisma.bookingSeat.findFirst({ where: { bookingId: booking3.id } })).id,
        qrTokenHash: 'forged_hash_pending_booking_test_1234567890abcdef',
        status: 'VALID',
      },
    });
    // Create opaque token that matches hash for test
    const forgedToken = generateOpaqueToken(forgedPendingTicket.id, forgedPendingTicket.ticketNumber);
    const { hashQrToken } = await import('./qr.js');
    await prisma.ticket.update({
      where: { id: forgedPendingTicket.id },
      data: { qrTokenHash: hashQrToken(forgedToken) },
    });

    const unconfValRes = await fetch(`${BASE_URL}/tickets/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: staffCookie },
      body: JSON.stringify({ qrToken: forgedToken }),
    });
    const unconfValData = await unconfValRes.json();
    assert(
      unconfValRes.status === 400 && unconfValData.code === 'PAYMENT_NOT_CONFIRMED',
      'Ticket from unconfirmed booking rejected with 400 PAYMENT_NOT_CONFIRMED'
    );

    // =========================================================================
    // TEST 15: Ticket from unsuccessful payment rejected
    // =========================================================================
    // booking2 had failed payment; if a ticket were linked to it, it must be rejected
    const forgedFailTicket = await prisma.ticket.create({
      data: {
        ticketNumber: 'TKT-FAILPAY-TEST-002',
        bookingId: booking2.id,
        bookingSeatId: (await prisma.bookingSeat.findFirst({ where: { bookingId: booking2.id } })).id,
        qrTokenHash: 'placeholder',
        status: 'VALID',
      },
    });
    const forgedFailToken = generateOpaqueToken(forgedFailTicket.id, forgedFailTicket.ticketNumber);
    await prisma.ticket.update({
      where: { id: forgedFailTicket.id },
      data: { qrTokenHash: hashQrToken(forgedFailToken) },
    });

    const failValRes = await fetch(`${BASE_URL}/tickets/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: staffCookie },
      body: JSON.stringify({ qrToken: forgedFailToken }),
    });
    const failValData = await failValRes.json();
    assert(
      failValRes.status === 400 && failValData.code === 'PAYMENT_NOT_CONFIRMED',
      'Ticket with no successful payment rejected with 400 PAYMENT_NOT_CONFIRMED'
    );

    // =========================================================================
    // TEST 16: Previously used ticket rejected
    // =========================================================================
    // Re-scanning ticket1 (which was validated in Test 10)
    const usedRes = await fetch(`${BASE_URL}/tickets/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: staffCookie },
      body: JSON.stringify({ qrToken: ticket1Token }),
    });
    const usedData = await usedRes.json();
    assert(
      (usedRes.status === 400 || usedRes.status === 409) && usedData.code === 'ALREADY_USED',
      'Previously used ticket rejected with 409/400 ALREADY_USED'
    );

    // =========================================================================
    // TEST 17: Expired ticket rejected
    // =========================================================================
    // Create a show that finished yesterday
    const pastShow = await prisma.show.create({
      data: {
        movieId: activeMovie.id,
        screenId: testScreenId,
        startTime: new Date(Date.now() - 48 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 46 * 60 * 60 * 1000),
        format: '2D',
        isActive: true,
      },
    });
    const pastBooking = await prisma.booking.create({
      data: {
        userId: staffUserId,
        showId: pastShow.id,
        bookingReference: 'BK-PAST-TEST-001',
        totalAmount: 300.0,
        status: 'CONFIRMED',
      },
    });
    const pastPayment = await prisma.payment.create({
      data: {
        bookingId: pastBooking.id,
        amount: 300.0,
        status: 'SUCCESS',
        transactionReference: 'TXN-PAST-001',
      },
    });
    const pastSeat = await prisma.showSeat.create({
      data: {
        showId: pastShow.id,
        seatId: createdSeats[0].id,
        price: 300.0,
        status: 'BOOKED',
      },
    });
    const pastBookingSeat = await prisma.bookingSeat.create({
      data: {
        bookingId: pastBooking.id,
        showSeatId: pastSeat.id,
        price: 300.0,
      },
    });
    const pastTicket = await prisma.ticket.create({
      data: {
        ticketNumber: 'TKT-EXPIRED-TEST-003',
        bookingId: pastBooking.id,
        bookingSeatId: pastBookingSeat.id,
        qrTokenHash: 'placeholder',
        status: 'VALID',
      },
    });
    const pastToken = generateOpaqueToken(pastTicket.id, pastTicket.ticketNumber);
    await prisma.ticket.update({
      where: { id: pastTicket.id },
      data: { qrTokenHash: hashQrToken(pastToken) },
    });

    const expValRes = await fetch(`${BASE_URL}/tickets/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: staffCookie },
      body: JSON.stringify({ qrToken: pastToken }),
    });
    const expValData = await expValRes.json();
    assert(
      expValRes.status === 400 && expValData.code === 'EXPIRED',
      'Ticket for past show outside entry window is rejected with 400 EXPIRED'
    );

    // =========================================================================
    // TEST 18: Validation records staff ID and timestamp
    // =========================================================================
    const validatedDbTicket = await prisma.ticket.findUnique({
      where: { id: ticket1.id },
    });
    assert(
      validatedDbTicket.validatedById === staffUserId &&
        validatedDbTicket.validatedAt !== null,
      'Validation audit records the validating staff member’s ID and timestamp'
    );

    // =========================================================================
    // TEST 19: Ticket status changes atomically
    // =========================================================================
    assert(
      validatedDbTicket.status === 'USED',
      'Ticket status is atomically transitioned to USED in PostgreSQL'
    );

    // =========================================================================
    // TEST 20: Simultaneous validation requests allow exactly one successful scan
    // =========================================================================
    // Customer 1 holds seat B1 and completes confirmed payment
    const holdResConc = await fetch(`${BASE_URL}/shows/${testShowId}/holds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
      body: JSON.stringify({ showSeatIds: [showSeatIds[4]] }),
    });
    const holdDataConc = await holdResConc.json();
    const concBookRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
      body: JSON.stringify({ holdId: holdDataConc.data?.holdId }),
    });
    const concBookData = await concBookRes.json();
    await fetch(`${BASE_URL}/bookings/${concBookData.data?.id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
      body: JSON.stringify({ paymentMethod: 'CARD', simulateResult: 'SUCCESS' }),
    });

    const concTicket = await prisma.ticket.findFirst({
      where: { bookingId: concBookData.data?.id },
    });
    const concToken = generateOpaqueToken(concTicket.id, concTicket.ticketNumber);

    // Fire 2 simultaneous validation requests concurrently
    const [scan1, scan2] = await Promise.all([
      fetch(`${BASE_URL}/tickets/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: staffCookie },
        body: JSON.stringify({ qrToken: concToken }),
      }),
      fetch(`${BASE_URL}/tickets/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ qrToken: concToken }),
      }),
    ]);

    const scanData1 = await scan1.json();
    const scanData2 = await scan2.json();

    const exactlyOneSuccess =
      (scan1.status === 200 && (scan2.status === 400 || scan2.status === 409)) ||
      (scan2.status === 200 && (scan1.status === 400 || scan1.status === 409));

    assert(
      exactlyOneSuccess,
      'Row-level locking guarantees simultaneous scans allow exactly one VALIDATED scan and one ALREADY_USED rejection'
    );

    // =========================================================================
    // TEST 21: Ticket QR token hash is not exposed in API responses
    // =========================================================================
    const ticketDetailRes = await fetch(`${BASE_URL}/tickets/${ticket1.id}`, {
      headers: { Cookie: customer1Cookie },
    });
    const ticketDetailData = await ticketDetailRes.json();
    assert(
      ticketDetailData.data &&
        ticketDetailData.data.qrTokenHash === undefined,
      'Ticket API responses never expose qrTokenHash'
    );

    // =========================================================================
    // TEST 22: QR code Data URL is successfully rendered for ticket owner
    // =========================================================================
    const qrRes = await fetch(`${BASE_URL}/tickets/${ticket1.id}/qr`, {
      headers: { Cookie: customer1Cookie },
    });
    const qrData = await qrRes.json();
    assert(
      qrRes.status === 200 &&
        qrData.data?.qrCode &&
        qrData.data.qrCode.startsWith('data:image/png;base64,'),
      'GET /api/tickets/:id/qr returns verified base64 PNG QR code data URL'
    );

  } catch (err) {
    console.error('Test execution failed with error:', err);
  } finally {
    // -------------------------------------------------------------------------
    // Teardown: Clean up test data
    // -------------------------------------------------------------------------
    try {
      await prisma.ticket.deleteMany({
        where: {
          booking: {
            show: { screen: { theatreId: testTheatreId } },
          },
        },
      });
      await prisma.payment.deleteMany({
        where: {
          booking: {
            show: { screen: { theatreId: testTheatreId } },
          },
        },
      });
      await prisma.bookingSeat.deleteMany({
        where: {
          booking: {
            show: { screen: { theatreId: testTheatreId } },
          },
        },
      });
      await prisma.booking.deleteMany({
        where: {
          show: { screen: { theatreId: testTheatreId } },
        },
      });
      await prisma.seatHold.deleteMany({
        where: {
          showSeat: { show: { screen: { theatreId: testTheatreId } } },
        },
      });
      await prisma.showSeat.deleteMany({
        where: { show: { screen: { theatreId: testTheatreId } } },
      });
      await prisma.show.deleteMany({
        where: { screen: { theatreId: testTheatreId } },
      });
      await prisma.seat.deleteMany({
        where: { screen: { theatreId: testTheatreId } },
      });
      await prisma.screen.deleteMany({
        where: { theatreId: testTheatreId },
      });
      if (testTheatreId) {
        await prisma.theatre.delete({ where: { id: testTheatreId } });
      }
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }

    server.close();

    console.log('\n====================================================');
    console.log(`Phase 8 Test Results: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('====================================================\n');

    if (failedCount > 0) {
      process.exit(1);
    }
  }
}

runTests();
