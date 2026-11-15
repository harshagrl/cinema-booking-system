import app from '../app.js';
import prisma from '../config/database.js';

const PORT = 5007;
const BASE_URL = `http://localhost:${PORT}/api`;

async function runTests() {
  console.log('====================================================');
  console.log('   PHASE 7: BOOKING & SIMULATED PAYMENT TESTS');
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
  let user1Id = '';
  let user2Id = '';

  // Test entities
  let testTheatreId = null;
  let testScreenId = null;
  let testShowId = null;
  let showSeatIds = [];

  try {
    // -------------------------------------------------------------------------
    // Setup: Login Customer 1 (Rahul) and Customer 2 (Priya)
    // -------------------------------------------------------------------------
    const cust1Login = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rahul@example.com', password: 'Cinema@123' }),
    });
    customer1Cookie = cust1Login.headers.get('set-cookie')?.split(';')[0] || '';
    const cust1Data = await cust1Login.json();
    user1Id = cust1Data.data.user.id;

    const cust2Login = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'priya@example.com', password: 'Cinema@123' }),
    });
    customer2Cookie = cust2Login.headers.get('set-cookie')?.split(';')[0] || '';
    const cust2Data = await cust2Login.json();
    user2Id = cust2Data.data.user.id;

    // Fetch active movie
    const activeMovie = await prisma.movie.findFirst({ where: { isActive: true } });

    // -------------------------------------------------------------------------
    // Create dedicated Test Theatre, Screen, Physical Seats, and Show
    // -------------------------------------------------------------------------
    const testTheatre = await prisma.theatre.create({
      data: {
        name: 'Phase 7 Test Multiplex',
        location: 'MG Road',
        city: 'Bengaluru',
        isActive: true,
      },
    });
    testTheatreId = testTheatre.id;

    const testScreen = await prisma.screen.create({
      data: {
        theatreId: testTheatreId,
        name: 'Audi 7 - Booking Test',
        screenType: 'STANDARD',
        supportedFormats: ['2D', '3D'],
        capacity: 10,
        isActive: true,
      },
    });
    testScreenId = testScreen.id;

    // Create 8 physical seats in 2 rows
    const seatDefs = [
      { row: 'A', seatNumber: 1, category: 'SILVER' },
      { row: 'A', seatNumber: 2, category: 'SILVER' },
      { row: 'A', seatNumber: 3, category: 'SILVER' },
      { row: 'A', seatNumber: 4, category: 'SILVER' },
      { row: 'B', seatNumber: 1, category: 'GOLD' },
      { row: 'B', seatNumber: 2, category: 'GOLD' },
      { row: 'B', seatNumber: 3, category: 'GOLD' },
      { row: 'B', seatNumber: 4, category: 'GOLD' },
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

    // Create Show 4 hours in the future
    const startTime = new Date(Date.now() + 4 * 60 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 150 * 60 * 1000);

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
      const price = seat.category === 'SILVER' ? 180.0 : 250.0;
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
    // TEST 1: Customer creates booking from active hold
    // =========================================================================
    // First, Customer 1 holds seat A1 and A2
    const holdRes1 = await fetch(`${BASE_URL}/shows/${testShowId}/holds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer1Cookie,
      },
      body: JSON.stringify({ showSeatIds: [showSeatIds[0], showSeatIds[1]] }),
    });
    const holdData1 = await holdRes1.json();
    const holdId1 = holdData1.data?.holdId;

    const bookRes1 = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer1Cookie,
      },
      body: JSON.stringify({ holdId: holdId1 }),
    });
    const bookData1 = await bookRes1.json();
    const booking1 = bookData1.data;

    assert(
      bookRes1.status === 201 &&
        booking1 &&
        booking1.bookingReference.startsWith('BK-') &&
        booking1.status === 'PENDING_PAYMENT',
      'Customer creates booking from active hold with PENDING_PAYMENT status'
    );

    // =========================================================================
    // TEST 2: Unauthenticated booking creation rejected
    // =========================================================================
    const unauthBookRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holdId: holdId1 }),
    });
    assert(
      unauthBookRes.status === 401,
      'Unauthenticated request to POST /api/bookings returns 401 Unauthorized'
    );

    // =========================================================================
    // TEST 3: Booking from another customer's hold rejected
    // =========================================================================
    // Customer 2 holds seat A3
    const holdRes2 = await fetch(`${BASE_URL}/shows/${testShowId}/holds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer2Cookie,
      },
      body: JSON.stringify({ showSeatIds: [showSeatIds[2]] }),
    });
    const holdData2 = await holdRes2.json();
    const holdId2 = holdData2.data?.holdId;

    // Customer 1 tries to book Customer 2's hold
    const crossBookRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer1Cookie,
      },
      body: JSON.stringify({ holdId: holdId2 }),
    });
    assert(
      crossBookRes.status === 403,
      'Customer cannot create a booking from another customer’s hold (403 Forbidden)'
    );

    // =========================================================================
    // TEST 4: Expired hold cannot create booking
    // =========================================================================
    // Simulate expired hold by creating a past hold in DB directly
    const expiredHoldId = '99999999-9999-9999-9999-999999999999';
    await prisma.showSeat.update({
      where: { id: showSeatIds[3] },
      data: {
        status: 'HELD',
        heldById: user1Id,
        holdExpiresAt: new Date(Date.now() - 10000),
      },
    });
    await prisma.seatHold.create({
      data: {
        holdId: expiredHoldId,
        showSeatId: showSeatIds[3],
        userId: user1Id,
        expiresAt: new Date(Date.now() - 10000),
        status: 'ACTIVE',
      },
    });

    const expBookRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer1Cookie,
      },
      body: JSON.stringify({ holdId: expiredHoldId }),
    });
    const expBookData = await expBookRes.json();
    assert(
      expBookRes.status === 400 && expBookData.code === 'HOLD_EXPIRED',
      'Expired hold cannot create a booking and returns 400 HOLD_EXPIRED'
    );

    // =========================================================================
    // TEST 5: Duplicate booking creation returns original booking or is protected
    // =========================================================================
    const dupBookRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer1Cookie,
      },
      body: JSON.stringify({ holdId: holdId1 }),
    });
    const dupBookData = await dupBookRes.json();
    assert(
      (dupBookRes.status === 200 || dupBookRes.status === 201) &&
        dupBookData.data?.id === booking1.id,
      'Duplicate booking request for same hold returns original booking (idempotent)'
    );

    // =========================================================================
    // TEST 6: Booking contains correct seats
    // =========================================================================
    const seatNumbers = booking1.seats.map((s) => `${s.row}${s.seatNumber}`);
    assert(
      booking1.seats.length === 2 &&
        seatNumbers.includes('A1') &&
        seatNumbers.includes('A2'),
      'Booking contains the exact held seats (A1 and A2)'
    );

    // =========================================================================
    // TEST 7: Booking amount matches authoritative backend seat pricing
    // =========================================================================
    // Two SILVER seats at 180.00 each = 360.00
    assert(
      Number(booking1.totalAmount) === 360.0,
      'Booking totalAmount matches backend sum (₹360.00) without trusting client'
    );

    // =========================================================================
    // TEST 8: Successful simulated payment
    // =========================================================================
    const payRes1 = await fetch(`${BASE_URL}/bookings/${booking1.id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer1Cookie,
      },
      body: JSON.stringify({
        paymentMethod: 'CARD',
        simulateResult: 'SUCCESS',
      }),
    });
    const payData1 = await payRes1.json();
    assert(
      payRes1.status === 200 &&
        payData1.success === true &&
        payData1.data?.payment?.status === 'SUCCESS',
      'Successful simulated payment returns 200 with payment status SUCCESS'
    );

    // =========================================================================
    // TEST 9: Successful payment marks booking CONFIRMED
    // =========================================================================
    const confirmedBooking = payData1.data?.booking;
    assert(
      confirmedBooking && confirmedBooking.status === 'CONFIRMED',
      'Successful payment atomically marks booking status as CONFIRMED'
    );

    // =========================================================================
    // TEST 10: Successful payment marks ShowSeat records BOOKED
    // =========================================================================
    const dbSeats = await prisma.showSeat.findMany({
      where: { id: { in: [showSeatIds[0], showSeatIds[1]] } },
    });
    const allBooked = dbSeats.every((s) => s.status === 'BOOKED' && s.heldById === null);
    assert(
      allBooked,
      'Successful payment marks ShowSeat records as BOOKED and clears hold metadata'
    );

    // =========================================================================
    // TEST 11: Failed simulated payment
    // =========================================================================
    // Customer 2 creates booking from holdId2 (Seat A3, Silver: 180.00)
    const bookRes2 = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer2Cookie,
      },
      body: JSON.stringify({ holdId: holdId2 }),
    });
    const bookData2 = await bookRes2.json();
    const booking2 = bookData2.data;

    // Customer 2 simulates failed payment
    const failPayRes = await fetch(`${BASE_URL}/bookings/${booking2.id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer2Cookie,
      },
      body: JSON.stringify({
        paymentMethod: 'UPI',
        simulateResult: 'FAILURE',
      }),
    });
    const failPayData = await failPayRes.json();
    assert(
      failPayRes.status === 200 &&
        failPayData.data?.payment?.status === 'FAILED',
      'Simulated payment failure creates Payment record with status FAILED'
    );

    // =========================================================================
    // TEST 12: Failed payment does not confirm booking (remains PENDING_PAYMENT)
    // =========================================================================
    const unconfirmedBooking = failPayData.data?.booking;
    assert(
      unconfirmedBooking && unconfirmedBooking.status === 'PENDING_PAYMENT',
      'Failed payment leaves booking in PENDING_PAYMENT for retry'
    );

    // =========================================================================
    // TEST 13: Failed payment preserves payment history
    // =========================================================================
    const paymentsForBooking2 = await prisma.payment.findMany({
      where: { bookingId: booking2.id },
    });
    assert(
      paymentsForBooking2.length >= 1 &&
        paymentsForBooking2.some((p) => p.status === 'FAILED'),
      'Failed payment attempt is permanently preserved in the Payment history table'
    );

    // =========================================================================
    // TEST 14: Already-consumed hold cannot create another booking
    // =========================================================================
    // holdId1 was confirmed in Test 8, now attempt to create another booking with a forged ID
    const forgedHoldId = '88888888-8888-8888-8888-888888888888';
    await prisma.seatHold.create({
      data: {
        holdId: forgedHoldId,
        showSeatId: showSeatIds[4],
        userId: user1Id,
        expiresAt: new Date(Date.now() + 60000),
        status: 'CONSUMED',
      },
    });
    const consumedRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer1Cookie,
      },
      body: JSON.stringify({ holdId: forgedHoldId }),
    });
    const consumedData = await consumedRes.json();
    assert(
      consumedRes.status === 409 && consumedData.code === 'HOLD_ALREADY_CONSUMED',
      'Already-consumed hold cannot create another booking (409 HOLD_ALREADY_CONSUMED)'
    );

    // =========================================================================
    // TEST 15: Duplicate payment request on confirmed booking returns idempotent confirmation
    // =========================================================================
    const dupPayRes = await fetch(`${BASE_URL}/bookings/${booking1.id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer1Cookie,
      },
      body: JSON.stringify({
        paymentMethod: 'CARD',
        simulateResult: 'SUCCESS',
      }),
    });
    const dupPayData = await dupPayRes.json();
    assert(
      dupPayRes.status === 200 &&
        dupPayData.data?.isAlreadyConfirmed === true &&
        dupPayData.data?.booking?.status === 'CONFIRMED',
      'Duplicate payment request on confirmed booking returns existing confirmation without double charging'
    );

    // =========================================================================
    // TEST 16: Customer cannot access another customer's booking
    // =========================================================================
    const crossAccessRes = await fetch(`${BASE_URL}/bookings/${booking1.id}`, {
      headers: { Cookie: customer2Cookie },
    });
    assert(
      crossAccessRes.status === 403,
      'Customer 2 is forbidden from accessing Customer 1’s booking details (403 Forbidden)'
    );

    // =========================================================================
    // TEST 17: Customer cannot pay another customer's booking
    // =========================================================================
    const crossPayRes = await fetch(`${BASE_URL}/bookings/${booking2.id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer1Cookie, // Customer 1 attempts to pay Customer 2's booking
      },
      body: JSON.stringify({ paymentMethod: 'CARD', simulateResult: 'SUCCESS' }),
    });
    assert(
      crossPayRes.status === 403,
      'Customer 1 is forbidden from paying for Customer 2’s booking (403 Forbidden)'
    );

    // =========================================================================
    // TEST 18: Payment amount tampering is rejected / server authoritative
    // =========================================================================
    // Customer 2 attempts to send a tampered amount (e.g. ₹1.00 instead of ₹180.00)
    const tamperPayRes = await fetch(`${BASE_URL}/bookings/${booking2.id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer2Cookie,
      },
      body: JSON.stringify({
        paymentMethod: 'CARD',
        simulateResult: 'SUCCESS',
        amount: 1.0, // Client tries to override price
      }),
    });
    const tamperPayData = await tamperPayRes.json();
    // Verify server charged booking.totalAmount (180.00), not the injected 1.00
    assert(
      tamperPayRes.status === 200 &&
        Number(tamperPayData.data?.payment?.amount) === 180.0,
      'Server strictly charges authoritative booking totalAmount (₹180.00), ignoring client tampering'
    );

    // =========================================================================
    // TEST 19: Simultaneous payment requests cannot double-confirm
    // =========================================================================
    // Customer 1 holds seat B3 and creates a new pending booking
    const holdResSim = await fetch(`${BASE_URL}/shows/${testShowId}/holds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
      body: JSON.stringify({ showSeatIds: [showSeatIds[6]] }),
    });
    const holdDataSim = await holdResSim.json();
    const simHoldId = holdDataSim.data?.holdId;

    const simBookRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
      body: JSON.stringify({ holdId: simHoldId }),
    });
    const simBookData = await simBookRes.json();
    const simBookingId = simBookData.data?.id;

    // Fire 2 simultaneous payment requests in parallel
    const [simPay1, simPay2] = await Promise.all([
      fetch(`${BASE_URL}/bookings/${simBookingId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
        body: JSON.stringify({ paymentMethod: 'CARD', simulateResult: 'SUCCESS' }),
      }),
      fetch(`${BASE_URL}/bookings/${simBookingId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
        body: JSON.stringify({ paymentMethod: 'CARD', simulateResult: 'SUCCESS' }),
      }),
    ]);

    const simRes1 = await simPay1.json();
    const simRes2 = await simPay2.json();

    // Exactly one should confirm, and the other should return idempotent confirmation or already confirmed
    const oneConfirmed =
      (simRes1.data?.payment?.status === 'SUCCESS' && simRes2.data?.isAlreadyConfirmed) ||
      (simRes2.data?.payment?.status === 'SUCCESS' && simRes1.data?.isAlreadyConfirmed) ||
      (simPay1.status === 200 && simPay2.status === 200);

    const successfulPayments = await prisma.payment.count({
      where: { bookingId: simBookingId, status: 'SUCCESS' },
    });

    assert(
      oneConfirmed && successfulPayments === 1,
      'Simultaneous payments serialize via row-locking: exactly 1 SUCCESS payment recorded, 0 double confirmations'
    );

    // =========================================================================
    // TEST 20: Payment retry follows documented policy (failed -> retry success)
    // =========================================================================
    // Customer 1 holds seat B4 (Gold: 250) and books it
    const holdRetryRes = await fetch(`${BASE_URL}/shows/${testShowId}/holds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
      body: JSON.stringify({ showSeatIds: [showSeatIds[7]] }),
    });
    const holdRetryData = await holdRetryRes.json();
    const retryHoldId = holdRetryData.data?.holdId;

    const retryBookRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
      body: JSON.stringify({ holdId: retryHoldId }),
    });
    const retryBookData = await retryBookRes.json();
    const retryBookingId = retryBookData.data?.id;

    // Step 1: Attempt fails
    const attempt1 = await fetch(`${BASE_URL}/bookings/${retryBookingId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
      body: JSON.stringify({ paymentMethod: 'CARD', simulateResult: 'FAILURE' }),
    });
    const attempt1Data = await attempt1.json();

    // Step 2: Customer retries immediately with SUCCESS
    const attempt2 = await fetch(`${BASE_URL}/bookings/${retryBookingId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
      body: JSON.stringify({ paymentMethod: 'CARD', simulateResult: 'SUCCESS' }),
    });
    const attempt2Data = await attempt2.json();

    assert(
      attempt1Data.data?.payment?.status === 'FAILED' &&
        attempt2Data.data?.payment?.status === 'SUCCESS' &&
        attempt2Data.data?.booking?.status === 'CONFIRMED',
      'Documented retry policy: customer successfully retried after a failed attempt within their hold window'
    );

    // =========================================================================
    // TEST 21: Existing hold history is preserved
    // =========================================================================
    const retryHoldRecords = await prisma.seatHold.findMany({
      where: { holdId: retryHoldId },
    });
    assert(
      retryHoldRecords.length > 0 &&
        retryHoldRecords.every((h) => h.status === 'CONSUMED'),
      'SeatHold history is preserved in database with status transitioned to CONSUMED'
    );

    // =========================================================================
    // TEST 22: Existing booking and seat allocation constraints remain valid
    // =========================================================================
    // Test that the partial unique index unique_active_booking_seat prevents two active BookingSeat records
    let duplicateConstraintCaught = false;
    try {
      await prisma.bookingSeat.create({
        data: {
          bookingId: simBookingId,
          showSeatId: showSeatIds[7], // Already allocated actively to retryBookingId
          price: 250.0,
          releasedAt: null, // Attempt active allocation
        },
      });
    } catch (err) {
      // Prisma P2002 or unique constraint violation
      duplicateConstraintCaught = err.code === 'P2002' || err.message.includes('unique');
    }
    assert(
      duplicateConstraintCaught,
      'PostgreSQL partial unique index unique_active_booking_seat strictly prevents double active allocation'
    );

  } catch (err) {
    console.error('Test execution failed with error:', err);
  } finally {
    // -------------------------------------------------------------------------
    // Teardown: Clean up test data
    // -------------------------------------------------------------------------
    try {
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
      // Delete seats
      await prisma.seat.deleteMany({
        where: { screen: { theatreId: testTheatreId } },
      });
      // Delete screens
      await prisma.screen.deleteMany({
        where: { theatreId: testTheatreId },
      });
      // Delete theatre
      if (testTheatreId) {
        await prisma.theatre.delete({ where: { id: testTheatreId } });
      }
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }

    server.close();

    console.log('\n====================================================');
    console.log(`Phase 7 Test Results: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('====================================================\n');

    if (failedCount > 0) {
      process.exit(1);
    }
  }
}

runTests();
