import app from '../app.js';
import prisma from '../config/database.js';

const PORT = 5006;
const BASE_URL = `http://localhost:${PORT}/api`;

async function runTests() {
  console.log('====================================================');
  console.log('   PHASE 6: SEAT HOLD & CONCURRENCY ENGINE TESTS');
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
  let testShowId1 = null;
  let testShowId2 = null;
  let show1SeatIds = [];
  let show2SeatIds = [];
  let inactivePhysicalSeatId = null;

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
    // Create dedicated Test Theatre, Screen, Physical Seats, and Shows
    // -------------------------------------------------------------------------
    const testTheatre = await prisma.theatre.create({
      data: {
        name: 'Phase 6 Test Multiplex',
        location: 'Indiranagar 100ft Road',
        city: 'Bengaluru',
        isActive: true,
      },
    });
    testTheatreId = testTheatre.id;

    const testScreen = await prisma.screen.create({
      data: {
        theatreId: testTheatreId,
        name: 'Audi Phase 6',
        screenType: 'STANDARD',
        supportedFormats: ['2D', '3D'],
        capacity: 12,
        isActive: true,
      },
    });
    testScreenId = testScreen.id;

    // Create 12 physical seats:
    // Rows A: 4 seats (SILVER)
    // Rows B: 4 seats (GOLD)
    // Rows C: 3 seats (RECLINER, active) + 1 seat (RECLINER, inactive/broken)
    const physicalSeatsData = [];
    for (let i = 1; i <= 4; i++) {
      physicalSeatsData.push({ screenId: testScreenId, row: 'A', seatNumber: i, category: 'SILVER', isActive: true });
      physicalSeatsData.push({ screenId: testScreenId, row: 'B', seatNumber: i, category: 'GOLD', isActive: true });
    }
    physicalSeatsData.push({ screenId: testScreenId, row: 'C', seatNumber: 1, category: 'RECLINER', isActive: true });
    physicalSeatsData.push({ screenId: testScreenId, row: 'C', seatNumber: 2, category: 'RECLINER', isActive: true });
    physicalSeatsData.push({ screenId: testScreenId, row: 'C', seatNumber: 3, category: 'RECLINER', isActive: true });
    physicalSeatsData.push({ screenId: testScreenId, row: 'C', seatNumber: 4, category: 'RECLINER', isActive: false }); // Inactive

    await prisma.seat.createMany({ data: physicalSeatsData });
    const inactSeat = await prisma.seat.findFirst({ where: { screenId: testScreenId, isActive: false } });
    inactivePhysicalSeatId = inactSeat.id;

    // Create 2 test shows on this screen
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const start1 = new Date(tomorrow);
    start1.setHours(11, 0, 0, 0);
    const end1 = new Date(start1.getTime() + 150 * 60 * 1000);

    const start2 = new Date(tomorrow);
    start2.setHours(15, 0, 0, 0);
    const end2 = new Date(start2.getTime() + 150 * 60 * 1000);

    const show1 = await prisma.show.create({
      data: {
        movieId: activeMovie.id,
        screenId: testScreenId,
        startTime: start1,
        endTime: end1,
        format: '2D',
        isActive: true,
      },
    });
    testShowId1 = show1.id;

    const show2 = await prisma.show.create({
      data: {
        movieId: activeMovie.id,
        screenId: testScreenId,
        startTime: start2,
        endTime: end2,
        format: '2D',
        isActive: true,
      },
    });
    testShowId2 = show2.id;

    // Generate ShowSeats for Show 1 (all 12 physical seats)
    const allSeats = await prisma.seat.findMany({ where: { screenId: testScreenId } });
    const showSeats1Data = allSeats.map((s) => ({
      showId: testShowId1,
      seatId: s.id,
      price: s.category === 'SILVER' ? 180 : s.category === 'GOLD' ? 250 : 450,
      status: 'AVAILABLE',
    }));
    await prisma.showSeat.createMany({ data: showSeats1Data });

    const showSeats2Data = allSeats.map((s) => ({
      showId: testShowId2,
      seatId: s.id,
      price: 200,
      status: 'AVAILABLE',
    }));
    await prisma.showSeat.createMany({ data: showSeats2Data });

    const show1SeatsFromDb = await prisma.showSeat.findMany({
      where: { showId: testShowId1 },
      include: { seat: true },
      orderBy: [{ seat: { row: 'asc' } }, { seat: { seatNumber: 'asc' } }],
    });
    show1SeatIds = show1SeatsFromDb.map((s) => s.id);

    const show2SeatsFromDb = await prisma.showSeat.findMany({
      where: { showId: testShowId2 },
      include: { seat: true },
    });
    show2SeatIds = show2SeatsFromDb.map((s) => s.id);

    // -------------------------------------------------------------------------
    // TEST 1: Public show seat layout retrieval
    // -------------------------------------------------------------------------
    const layoutRes = await fetch(`${BASE_URL}/shows/${testShowId1}/seats`);
    const layoutData = await layoutRes.json();
    assert(
      layoutRes.status === 200 &&
        layoutData.success === true &&
        layoutData.data.show.id === testShowId1 &&
        Array.isArray(layoutData.data.rows) &&
        layoutData.data.rows.length === 3 &&
        layoutData.data.stats.totalSeats === 12 &&
        layoutData.data.categoryPricing.SILVER === 180,
      'Public GET /api/shows/:showId/seats returns complete seat layout, categories, and availability'
    );

    // -------------------------------------------------------------------------
    // TEST 2: Unauthenticated customer cannot create a hold (401 Unauthorized)
    // -------------------------------------------------------------------------
    const unauthHoldRes = await fetch(`${BASE_URL}/shows/${testShowId1}/holds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showSeatIds: [show1SeatIds[0]] }),
    });
    assert(
      unauthHoldRes.status === 401,
      'Unauthenticated request to POST /api/shows/:showId/holds returns 401 Unauthorized'
    );

    // -------------------------------------------------------------------------
    // TEST 3: Customer 1 successfully holds one seat
    // -------------------------------------------------------------------------
    const singleSeatId = show1SeatIds[0]; // A1 (SILVER, ₹180)
    const hold1Res = await fetch(`${BASE_URL}/shows/${testShowId1}/holds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer1Cookie,
      },
      body: JSON.stringify({ showSeatIds: [singleSeatId] }),
    });
    const hold1Data = await hold1Res.json();
    assert(
      hold1Res.status === 201 &&
        hold1Data.success === true &&
        hold1Data.data.holdId &&
        hold1Data.data.expiresInSeconds === 300 &&
        hold1Data.data.totalAmount === 180 &&
        hold1Data.data.seats.length === 1 &&
        hold1Data.data.seats[0].row === 'A' &&
        hold1Data.data.seats[0].seatNumber === 1,
      'Customer successfully holds one seat; receives holdId, 5-minute expiry, and total amount'
    );
    const hold1Id = hold1Data.data.holdId;

    // Verify ShowSeat status in PostgreSQL
    const heldSeatDb = await prisma.showSeat.findUnique({ where: { id: singleSeatId } });
    assert(
      heldSeatDb.status === 'HELD' && heldSeatDb.heldById === user1Id,
      'Database ShowSeat row transitioned to HELD with heldById set to customer ID'
    );

    // -------------------------------------------------------------------------
    // TEST 4: Customer 1 successfully holds multiple seats atomically
    // -------------------------------------------------------------------------
    const multiSeatIds = [show1SeatIds[1], show1SeatIds[2]]; // A2 (180) + A3 (180) = ₹360
    const holdMultiRes = await fetch(`${BASE_URL}/shows/${testShowId1}/holds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer1Cookie,
      },
      body: JSON.stringify({ showSeatIds: multiSeatIds }),
    });
    const holdMultiData = await holdMultiRes.json();
    assert(
      holdMultiRes.status === 201 &&
        holdMultiData.data.seats.length === 2 &&
        holdMultiData.data.totalAmount === 360,
      'Customer holds multiple seats atomically with accurate total amount'
    );
    const holdMultiId = holdMultiData.data.holdId;

    // -------------------------------------------------------------------------
    // TEST 5: Invalid ShowSeat ID rejection (404 Not Found)
    // -------------------------------------------------------------------------
    const fakeSeatRes = await fetch(`${BASE_URL}/shows/${testShowId1}/holds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer1Cookie,
      },
      body: JSON.stringify({
        showSeatIds: ['00000000-0000-0000-0000-000000000000'],
      }),
    });
    assert(
      fakeSeatRes.status === 404,
      'Holding non-existent ShowSeat ID rejects with 404 Not Found'
    );

    // -------------------------------------------------------------------------
    // TEST 6: Seat belonging to another show rejection (400 SEAT_SHOW_MISMATCH)
    // -------------------------------------------------------------------------
    // Attempt to hold a seat from Show 2 while targeting Show 1 URL
    const mismatchRes = await fetch(`${BASE_URL}/shows/${testShowId1}/holds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer1Cookie,
      },
      body: JSON.stringify({ showSeatIds: [show2SeatIds[0]] }),
    });
    const mismatchData = await mismatchRes.json();
    assert(
      mismatchRes.status === 400 && mismatchData.code === 'SEAT_SHOW_MISMATCH',
      'Holding seat belonging to another show rejected with 400 SEAT_SHOW_MISMATCH'
    );

    // -------------------------------------------------------------------------
    // TEST 7: Duplicate seat IDs rejection (400 Bad Request)
    // -------------------------------------------------------------------------
    const dupRes = await fetch(`${BASE_URL}/shows/${testShowId1}/holds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer1Cookie,
      },
      body: JSON.stringify({ showSeatIds: [show1SeatIds[3], show1SeatIds[3]] }),
    });
    assert(
      dupRes.status === 400,
      'Holding duplicate seat IDs in one request rejected with 400 Bad Request'
    );

    // -------------------------------------------------------------------------
    // TEST 8: Customer 2 rejected from holding already held seat (409 Conflict)
    // -------------------------------------------------------------------------
    const alreadyHeldRes = await fetch(`${BASE_URL}/shows/${testShowId1}/holds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer2Cookie,
      },
      body: JSON.stringify({ showSeatIds: [singleSeatId] }), // A1 is held by Cust 1
    });
    const alreadyHeldData = await alreadyHeldRes.json();
    assert(
      alreadyHeldRes.status === 409 && alreadyHeldData.code === 'SEAT_ALREADY_HELD',
      'Customer 2 rejected with 409 SEAT_ALREADY_HELD when requesting a seat held by Customer 1'
    );

    // -------------------------------------------------------------------------
    // TEST 9: Already booked seat rejection (409 Conflict)
    // -------------------------------------------------------------------------
    // Manually mark seat A4 as BOOKED in DB
    const bookedSeatId = show1SeatIds[3];
    await prisma.showSeat.update({
      where: { id: bookedSeatId },
      data: { status: 'BOOKED' },
    });

    const bookedHoldRes = await fetch(`${BASE_URL}/shows/${testShowId1}/holds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer2Cookie,
      },
      body: JSON.stringify({ showSeatIds: [bookedSeatId] }),
    });
    const bookedHoldData = await bookedHoldRes.json();
    assert(
      bookedHoldRes.status === 409 && bookedHoldData.code === 'SEAT_ALREADY_BOOKED',
      'Requesting already booked seat rejects with 409 SEAT_ALREADY_BOOKED'
    );

    // -------------------------------------------------------------------------
    // TEST 10: Inactive physical seat rejection (400 SEAT_UNAVAILABLE)
    // -------------------------------------------------------------------------
    const inactShowSeat = show1SeatsFromDb.find((s) => s.seatId === inactivePhysicalSeatId);
    const inactHoldRes = await fetch(`${BASE_URL}/shows/${testShowId1}/holds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer2Cookie,
      },
      body: JSON.stringify({ showSeatIds: [inactShowSeat.id] }),
    });
    const inactHoldData = await inactHoldRes.json();
    assert(
      inactHoldRes.status === 400 && inactHoldData.code === 'SEAT_UNAVAILABLE',
      'Requesting physically inactive seat rejects with 400 SEAT_UNAVAILABLE'
    );

    // -------------------------------------------------------------------------
    // TEST 11: Maximum seat limit enforcement (> 10 seats rejected)
    // -------------------------------------------------------------------------
    const elevenSeatIds = [
      ...show1SeatIds.slice(0, 10),
      show2SeatIds[0], // 11 items
    ];
    const limitRes = await fetch(`${BASE_URL}/shows/${testShowId1}/holds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer1Cookie,
      },
      body: JSON.stringify({ showSeatIds: elevenSeatIds }),
    });
    assert(
      limitRes.status === 400,
      'Requesting more than maximum allowed seats (10) rejected with 400 Bad Request'
    );

    // -------------------------------------------------------------------------
    // TEST 12: Customer 1 retrieves active hold (GET /api/holds/current)
    // -------------------------------------------------------------------------
    const myHoldRes = await fetch(`${BASE_URL}/holds/current`, {
      headers: { Cookie: customer1Cookie },
    });
    const myHoldData = await myHoldRes.json();
    assert(
      myHoldRes.status === 200 &&
        myHoldData.data.hold !== null &&
        myHoldData.data.hold.holdId === holdMultiId &&
        myHoldData.data.hold.seats.length === 2 &&
        myHoldData.data.hold.expiresInSeconds > 0,
      'Customer 1 retrieves active hold with remaining countdown and seat details'
    );

    // -------------------------------------------------------------------------
    // TEST 13: Customer 2 has no active hold (User Isolation)
    // -------------------------------------------------------------------------
    const cust2HoldRes = await fetch(`${BASE_URL}/holds/current`, {
      headers: { Cookie: customer2Cookie },
    });
    const cust2HoldData = await cust2HoldRes.json();
    assert(
      cust2HoldRes.status === 200 && cust2HoldData.data.hold === null,
      'User isolation: Customer 2 cannot access Customer 1 active hold (returns hold: null)'
    );

    // -------------------------------------------------------------------------
    // TEST 14: Customer 1 releases their hold (DELETE /api/holds/:holdId)
    // -------------------------------------------------------------------------
    const releaseRes = await fetch(`${BASE_URL}/holds/${holdMultiId}`, {
      method: 'DELETE',
      headers: { Cookie: customer1Cookie },
    });
    const releaseData = await releaseRes.json();
    assert(
      releaseRes.status === 200 && releaseData.data.released === true,
      'Customer 1 successfully releases their temporary seat hold'
    );

    // Verify ShowSeats reverted to AVAILABLE in DB
    const multiSeatsAfterRelease = await prisma.showSeat.findMany({
      where: { id: { in: multiSeatIds } },
    });
    assert(
      multiSeatsAfterRelease.every((s) => s.status === 'AVAILABLE' && s.heldById === null),
      'Database ShowSeat rows atomically reverted to AVAILABLE with heldById cleared'
    );

    // -------------------------------------------------------------------------
    // TEST 15: Customer 2 cannot release Customer 1 hold (403 Forbidden)
    // -------------------------------------------------------------------------
    // hold1Id is still held by Customer 1
    const unauthReleaseRes = await fetch(`${BASE_URL}/holds/${hold1Id}`, {
      method: 'DELETE',
      headers: { Cookie: customer2Cookie },
    });
    assert(
      unauthReleaseRes.status === 403,
      'Customer 2 attempting to release Customer 1 hold rejected with 403 Forbidden'
    );

    // -------------------------------------------------------------------------
    // TEST 16 & 17: Expired hold is marked EXPIRED and seat becomes available again
    // -------------------------------------------------------------------------
    // Manually expire hold1Id by setting expiresAt and holdExpiresAt in the past
    const pastDate = new Date(Date.now() - 60000);
    await prisma.seatHold.updateMany({
      where: { holdId: hold1Id },
      data: { expiresAt: pastDate },
    });
    await prisma.showSeat.update({
      where: { id: singleSeatId },
      data: { holdExpiresAt: pastDate },
    });

    // Customer 2 now requests the seat (A1) whose hold expired
    const reHoldRes = await fetch(`${BASE_URL}/shows/${testShowId1}/holds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer2Cookie,
      },
      body: JSON.stringify({ showSeatIds: [singleSeatId] }),
    });
    const reHoldData = await reHoldRes.json();
    assert(
      reHoldRes.status === 201 && reHoldData.success === true,
      'Expired hold is automatically transitioned to EXPIRED, and seat is successfully held by Customer 2'
    );
    const hold2Id = reHoldData.data.holdId;

    // Verify old SeatHold record is EXPIRED
    const oldHoldRecord = await prisma.seatHold.findFirst({
      where: { holdId: hold1Id },
    });
    assert(
      oldHoldRecord.status === 'EXPIRED',
      'Stale SeatHold record is marked EXPIRED in historical database records'
    );

    // -------------------------------------------------------------------------
    // TEST 18: Expiration cleanup is idempotent
    // -------------------------------------------------------------------------
    const { HoldService } = await import('../services/hold.service.js');
    const clean1 = await HoldService.cleanupExpiredHolds(testShowId1);
    const clean2 = await HoldService.cleanupExpiredHolds(testShowId1);
    assert(
      clean1 && clean2 && clean2.expiredCount === 0,
      'Hold expiration cleanup is idempotent and safe to execute repeatedly'
    );

    // -------------------------------------------------------------------------
    // TEST 19: All-or-nothing behavior when one seat is unavailable
    // -------------------------------------------------------------------------
    // Customer 1 requests [B1 (available), A1 (currently held by Customer 2)]
    const seatB1 = show1SeatIds[4]; // Available
    const allOrNothingRes = await fetch(`${BASE_URL}/shows/${testShowId1}/holds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer1Cookie,
      },
      body: JSON.stringify({ showSeatIds: [seatB1, singleSeatId] }),
    });
    assert(
      allOrNothingRes.status === 409,
      'All-or-nothing: Requesting batch with one unavailable seat fails with 409 Conflict'
    );

    // Verify seat B1 was NOT partially held
    const seatB1Db = await prisma.showSeat.findUnique({ where: { id: seatB1 } });
    assert(
      seatB1Db.status === 'AVAILABLE' && seatB1Db.heldById === null,
      'All-or-nothing verified: Seat B1 was NOT partially allocated'
    );

    // -------------------------------------------------------------------------
    // TEST 20: Concurrency protection: Two simultaneous customers for same seat
    // -------------------------------------------------------------------------
    // Release hold2Id first so singleSeatId is available
    await fetch(`${BASE_URL}/holds/${hold2Id}`, {
      method: 'DELETE',
      headers: { Cookie: customer2Cookie },
    });

    // Fire genuinely simultaneous requests for singleSeatId
    const [raceA, raceB] = await Promise.all([
      fetch(`${BASE_URL}/shows/${testShowId1}/holds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
        body: JSON.stringify({ showSeatIds: [singleSeatId] }),
      }),
      fetch(`${BASE_URL}/shows/${testShowId1}/holds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: customer2Cookie },
        body: JSON.stringify({ showSeatIds: [singleSeatId] }),
      }),
    ]);

    const raceASuccess = raceA.status === 201;
    const raceBSuccess = raceB.status === 201;
    const raceAConflict = raceA.status === 409;
    const raceBConflict = raceB.status === 409;

    // Verify in PostgreSQL: exactly one active hold exists
    const activeHoldsDb = await prisma.seatHold.findMany({
      where: { showSeatId: singleSeatId, status: 'ACTIVE' },
    });

    assert(
      ((raceASuccess && raceBConflict) || (raceBSuccess && raceAConflict)) &&
        activeHoldsDb.length === 1,
      'Concurrency protection: Exactly one simultaneous request succeeds (201) and the other fails (409 Conflict)'
    );

    // -------------------------------------------------------------------------
    // TEST 21: Two customers can hold different seats simultaneously
    // -------------------------------------------------------------------------
    const seatB2 = show1SeatIds[5];
    const seatB3 = show1SeatIds[6];

    const [diffA, diffB] = await Promise.all([
      fetch(`${BASE_URL}/shows/${testShowId1}/holds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: customer1Cookie },
        body: JSON.stringify({ showSeatIds: [seatB2] }),
      }),
      fetch(`${BASE_URL}/shows/${testShowId1}/holds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: customer2Cookie },
        body: JSON.stringify({ showSeatIds: [seatB3] }),
      }),
    ]);

    const diffAData = await diffA.json();
    const diffBData = await diffB.json();

    assert(
      diffA.status === 201 && diffB.status === 201,
      'Concurrent non-conflicting seats: Both Customer 1 and Customer 2 successfully hold different seats concurrently'
    );

    // Clean up created holds
    if (diffAData.data?.holdId) {
      await fetch(`${BASE_URL}/holds/${diffAData.data.holdId}`, {
        method: 'DELETE',
        headers: { Cookie: customer1Cookie },
      });
    }
    if (diffBData.data?.holdId) {
      await fetch(`${BASE_URL}/holds/${diffBData.data.holdId}`, {
        method: 'DELETE',
        headers: { Cookie: customer2Cookie },
      });
    }

    // Clean up test database entities
    await prisma.seatHold.deleteMany({
      where: { showSeat: { showId: { in: [testShowId1, testShowId2] } } },
    });
    await prisma.showSeat.deleteMany({
      where: { showId: { in: [testShowId1, testShowId2] } },
    });
    await prisma.show.deleteMany({
      where: { id: { in: [testShowId1, testShowId2] } },
    });
    await prisma.seat.deleteMany({ where: { screenId: testScreenId } });
    await prisma.screen.deleteMany({ where: { id: testScreenId } });
    await prisma.theatre.deleteMany({ where: { id: testTheatreId } });
  } catch (err) {
    console.error('Test execution error:', err);
    failedCount++;
  } finally {
    server.close();
    console.log('\n====================================================');
    console.log(`Phase 6 Test Results: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('====================================================');
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runTests();
