import app from '../app.js';
import prisma from '../config/database.js';

const PORT = 5005;
const BASE_URL = `http://localhost:${PORT}/api`;

async function runTests() {
  console.log('====================================================');
  console.log('   PHASE 5: SHOWTIME SCHEDULING & CONCURRENCY TESTS');
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

  let adminCookie = '';
  let customerCookie = '';
  let staffCookie = '';

  // Track created entities for clean cleanup
  const createdShowIds = [];
  let testTheatreId = null;
  let testScreenId1 = null;
  let testScreenId2 = null;
  let inactiveMovieId = null;
  let inactiveScreenId = null;

  try {
    // -------------------------------------------------------------------------
    // Setup: Login Admin, Staff & Customer accounts
    // -------------------------------------------------------------------------
    const adminLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@cinema.com', password: 'Admin@123' }),
    });
    adminCookie = adminLogin.headers.get('set-cookie')?.split(';')[0] || '';

    const staffLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'staff@cinema.com', password: 'Staff@123' }),
    });
    staffCookie = staffLogin.headers.get('set-cookie')?.split(';')[0] || '';

    const custLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rahul@example.com', password: 'Cinema@123' }),
    });
    customerCookie = custLogin.headers.get('set-cookie')?.split(';')[0] || '';

    // Fetch existing active movie and screen for base tests
    const activeMovie = await prisma.movie.findFirst({ where: { isActive: true } });
    const activeScreen = await prisma.screen.findFirst({
      where: { isActive: true },
      include: { theatre: true },
    });

    // -------------------------------------------------------------------------
    // TEST 1: Public show listing returns active shows with pricing summary
    // -------------------------------------------------------------------------
    const listRes = await fetch(`${BASE_URL}/shows`);
    const listData = await listRes.json();
    assert(
      listRes.status === 200 &&
        listData.success === true &&
        Array.isArray(listData.data.shows) &&
        listData.data.shows.length > 0 &&
        listData.data.shows[0].pricing?.minPrice !== undefined &&
        listData.data.shows[0].availableSeats !== undefined,
      'Public GET /api/shows returns active shows with pricing summary and availability'
    );

    // -------------------------------------------------------------------------
    // TEST 2: Movie-specific show discovery
    // -------------------------------------------------------------------------
    const movieShowsRes = await fetch(`${BASE_URL}/movies/${activeMovie.id}/shows`);
    const movieShowsData = await movieShowsRes.json();
    assert(
      movieShowsRes.status === 200 &&
        movieShowsData.success === true &&
        movieShowsData.data.movie.id === activeMovie.id &&
        Array.isArray(movieShowsData.data.theatres),
      'GET /api/movies/:movieId/shows returns showtimes grouped by theatre'
    );

    // -------------------------------------------------------------------------
    // TEST 3: Theatre-specific show discovery
    // -------------------------------------------------------------------------
    const theatreShowsRes = await fetch(
      `${BASE_URL}/theatres/${activeScreen.theatreId}/shows`
    );
    const theatreShowsData = await theatreShowsRes.json();
    assert(
      theatreShowsRes.status === 200 &&
        theatreShowsData.success === true &&
        theatreShowsData.data.theatre.id === activeScreen.theatreId &&
        Array.isArray(theatreShowsData.data.movies),
      'GET /api/theatres/:theatreId/shows returns showtimes grouped by movie'
    );

    // -------------------------------------------------------------------------
    // TEST 4: Date filtering
    // -------------------------------------------------------------------------
    const sampleShow = listData.data.shows[0];
    const sampleDate = sampleShow.startTime.split('T')[0];
    const dateQueryRes = await fetch(`${BASE_URL}/shows?date=${sampleDate}`);
    const dateQueryData = await dateQueryRes.json();
    assert(
      dateQueryRes.status === 200 &&
        Array.isArray(dateQueryData.data.shows) &&
        dateQueryData.data.shows.length > 0 &&
        dateQueryData.data.shows.every((s) => s.startTime.startsWith(sampleDate)),
      `GET /api/shows?date=${sampleDate} accurately filters shows by date`
    );

    // -------------------------------------------------------------------------
    // Set up dedicated test theatre & screens with seats for precise scheduling tests
    // -------------------------------------------------------------------------
    const testTheatre = await prisma.theatre.create({
      data: {
        name: 'Phase 5 Test Multiplex',
        location: 'Electronic City Phase 1',
        city: 'Bengaluru',
        isActive: true,
      },
    });
    testTheatreId = testTheatre.id;

    // Screen 1: Standard screen with 2D, 3D
    const screen1 = await prisma.screen.create({
      data: {
        theatreId: testTheatreId,
        name: 'Audi 1 Test',
        screenType: 'STANDARD',
        supportedFormats: ['2D', '3D'],
        capacity: 4,
        isActive: true,
      },
    });
    testScreenId1 = screen1.id;

    // Create 4 physical seats for Screen 1 (2 SILVER, 1 GOLD, 1 RECLINER)
    await prisma.seat.createMany({
      data: [
        { screenId: testScreenId1, row: 'A', seatNumber: 1, category: 'SILVER', isActive: true },
        { screenId: testScreenId1, row: 'A', seatNumber: 2, category: 'SILVER', isActive: true },
        { screenId: testScreenId1, row: 'B', seatNumber: 1, category: 'GOLD', isActive: true },
        { screenId: testScreenId1, row: 'C', seatNumber: 1, category: 'RECLINER', isActive: true },
      ],
    });

    // Screen 2: IMAX screen with IMAX, 2D
    const screen2 = await prisma.screen.create({
      data: {
        theatreId: testTheatreId,
        name: 'Audi 2 IMAX Test',
        screenType: 'IMAX',
        supportedFormats: ['IMAX', '2D'],
        capacity: 2,
        isActive: true,
      },
    });
    testScreenId2 = screen2.id;

    await prisma.seat.createMany({
      data: [
        { screenId: testScreenId2, row: 'A', seatNumber: 1, category: 'PREMIUM', isActive: true },
        { screenId: testScreenId2, row: 'A', seatNumber: 2, category: 'PREMIUM', isActive: true },
      ],
    });

    // Create inactive movie and inactive screen for rejection tests
    const inactMovie = await prisma.movie.create({
      data: {
        title: 'Archived Film',
        description: 'Test inactive film',
        duration: 90,
        language: 'English',
        isActive: false,
      },
    });
    inactiveMovieId = inactMovie.id;

    const inactScreen = await prisma.screen.create({
      data: {
        theatreId: testTheatreId,
        name: 'Closed Audi',
        screenType: 'STANDARD',
        supportedFormats: ['2D'],
        isActive: false,
      },
    });
    inactiveScreenId = inactScreen.id;

    // -------------------------------------------------------------------------
    // TEST 5: Admin creates show with custom category pricing
    // -------------------------------------------------------------------------
    const startTime1 = '2026-11-20T10:00:00.000Z';
    const adminCreateRes = await fetch(`${BASE_URL}/shows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        movieId: activeMovie.id,
        screenId: testScreenId1,
        startTime: startTime1,
        format: '2D',
        bufferMinutes: 15,
        pricing: {
          SILVER: 190,
          GOLD: 260,
          RECLINER: 450,
        },
      }),
    });
    const adminCreateData = await adminCreateRes.json();
    if (adminCreateRes.status !== 201) {
      console.log('TEST 5 DEBUG:', adminCreateRes.status, JSON.stringify(adminCreateData));
    }
    assert(
      adminCreateRes.status === 201 &&
        adminCreateData.success === true &&
        adminCreateData.data.show.screenId === testScreenId1 &&
        adminCreateData.data.show.totalSeats === 4,
      'Admin creates show; end time auto-derived using duration and buffer'
    );
    if (adminCreateData.data?.show?.id) {
      createdShowIds.push(adminCreateData.data.show.id);
    }
    const show1EndTime = adminCreateData.data?.show?.endTime;

    // -------------------------------------------------------------------------
    // TEST 6: Customer rejected from show creation (403 Forbidden)
    // -------------------------------------------------------------------------
    const custCreateRes = await fetch(`${BASE_URL}/shows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customerCookie,
      },
      body: JSON.stringify({
        movieId: activeMovie.id,
        screenId: testScreenId1,
        startTime: '2026-11-21T10:00:00.000Z',
        format: '2D',
      }),
    });
    assert(
      custCreateRes.status === 403,
      'Customer receives 403 Forbidden when attempting to schedule a show'
    );

    // -------------------------------------------------------------------------
    // TEST 7: Staff rejected from show creation (403 Forbidden)
    // -------------------------------------------------------------------------
    const staffCreateRes = await fetch(`${BASE_URL}/shows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: staffCookie,
      },
      body: JSON.stringify({
        movieId: activeMovie.id,
        screenId: testScreenId1,
        startTime: '2026-11-21T10:00:00.000Z',
        format: '2D',
      }),
    });
    assert(
      staffCreateRes.status === 403,
      'Staff receives 403 Forbidden when attempting to schedule a show'
    );

    // -------------------------------------------------------------------------
    // TEST 8: Invalid movie ID handling (404 Not Found)
    // -------------------------------------------------------------------------
    const nonExistentMovieRes = await fetch(`${BASE_URL}/shows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        movieId: '00000000-0000-0000-0000-000000000000',
        screenId: testScreenId1,
        startTime: '2026-11-21T10:00:00.000Z',
        format: '2D',
      }),
    });
    assert(
      nonExistentMovieRes.status === 404,
      'Non-existent movie ID returns 404 Not Found'
    );

    // -------------------------------------------------------------------------
    // TEST 9: Inactive movie rejection (400 Bad Request)
    // -------------------------------------------------------------------------
    const inactMovieRes = await fetch(`${BASE_URL}/shows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        movieId: inactiveMovieId,
        screenId: testScreenId1,
        startTime: '2026-11-21T10:00:00.000Z',
        format: '2D',
      }),
    });
    const inactMovieData = await inactMovieRes.json();
    assert(
      inactMovieRes.status === 400 && inactMovieData.code === 'INACTIVE_MOVIE',
      'Cannot schedule a show for an inactive movie (400 INACTIVE_MOVIE)'
    );

    // -------------------------------------------------------------------------
    // TEST 10: Inactive screen rejection (400 Bad Request)
    // -------------------------------------------------------------------------
    const inactScreenRes = await fetch(`${BASE_URL}/shows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        movieId: activeMovie.id,
        screenId: inactiveScreenId,
        startTime: '2026-11-21T10:00:00.000Z',
        format: '2D',
      }),
    });
    const inactScreenData = await inactScreenRes.json();
    assert(
      inactScreenRes.status === 400 && inactScreenData.code === 'INACTIVE_SCREEN',
      'Cannot schedule a show for an inactive screen (400 INACTIVE_SCREEN)'
    );

    // -------------------------------------------------------------------------
    // TEST 11: Unsupported screen format rejection (400 Bad Request)
    // -------------------------------------------------------------------------
    // testScreenId1 supports ['2D', '3D']. Attempting 'IMAX' should fail!
    const unsuppFormatRes = await fetch(`${BASE_URL}/shows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        movieId: activeMovie.id,
        screenId: testScreenId1,
        startTime: '2026-11-21T14:00:00.000Z',
        format: 'IMAX',
      }),
    });
    const unsuppFormatData = await unsuppFormatRes.json();
    assert(
      unsuppFormatRes.status === 400 && unsuppFormatData.code === 'UNSUPPORTED_FORMAT',
      'Unsupported screen format rejected with 400 UNSUPPORTED_FORMAT'
    );

    // -------------------------------------------------------------------------
    // TEST 12: Overlapping show rejection on same screen (409 Conflict)
    // -------------------------------------------------------------------------
    // Show 1 is scheduled from startTime1 (10:00) to show1EndTime (~12:43).
    // Attempting to schedule a show starting at 11:00 on testScreenId1 must conflict!
    const overlapRes = await fetch(`${BASE_URL}/shows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        movieId: activeMovie.id,
        screenId: testScreenId1,
        startTime: '2026-11-20T11:00:00.000Z',
        format: '2D',
      }),
    });
    const overlapData = await overlapRes.json();
    assert(
      overlapRes.status === 409 && overlapData.code === 'SHOWTIME_OVERLAP',
      'Overlapping show on the same screen rejected with 409 SHOWTIME_OVERLAP'
    );

    // -------------------------------------------------------------------------
    // TEST 13: Different screens can schedule simultaneous shows
    // -------------------------------------------------------------------------
    // Schedule a show at the exact same startTime1 on testScreenId2 (Audi 2 IMAX)
    const diffScreenRes = await fetch(`${BASE_URL}/shows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        movieId: activeMovie.id,
        screenId: testScreenId2,
        startTime: startTime1,
        format: 'IMAX',
      }),
    });
    const diffScreenData = await diffScreenRes.json();
    assert(
      diffScreenRes.status === 201 &&
        diffScreenData.data.show.screenId === testScreenId2,
      'Different screens in same theatre can run shows simultaneously'
    );
    if (diffScreenData.data?.show?.id) {
      createdShowIds.push(diffScreenData.data.show.id);
    }

    // -------------------------------------------------------------------------
    // TEST 14: Concurrent requests cannot create conflicting shows
    // -------------------------------------------------------------------------
    // Fire genuinely simultaneous POST requests for the exact same timeslot on testScreenId1
    const concurrentStartTime = '2026-11-22T15:00:00.000Z';
    const concurrentPayload = {
      movieId: activeMovie.id,
      screenId: testScreenId1,
      startTime: concurrentStartTime,
      format: '2D',
    };

    const [resA, resB] = await Promise.all([
      fetch(`${BASE_URL}/shows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify(concurrentPayload),
      }),
      fetch(`${BASE_URL}/shows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify(concurrentPayload),
      }),
    ]);

    const dataA = await resA.json();
    const dataB = await resB.json();

    const successCount = (resA.status === 201 ? 1 : 0) + (resB.status === 201 ? 1 : 0);
    const conflictCount = (resA.status === 409 ? 1 : 0) + (resB.status === 409 ? 1 : 0);

    // Track whichever succeeded
    if (dataA.data?.show?.id) createdShowIds.push(dataA.data.show.id);
    if (dataB.data?.show?.id) createdShowIds.push(dataB.data.show.id);

    // Verify DB count for this screen at this timeslot
    const dbShows = await prisma.show.findMany({
      where: {
        screenId: testScreenId1,
        startTime: new Date(concurrentStartTime),
      },
    });

    assert(
      successCount === 1 && conflictCount === 1 && dbShows.length === 1,
      'Concurrency protection: Exactly one concurrent request succeeds (201) and the other fails with 409 Conflict'
    );

    // -------------------------------------------------------------------------
    // TEST 15: Correct ShowSeat initialization
    // -------------------------------------------------------------------------
    // Check ShowSeats created for Show 1 (which had 4 physical seats on Screen 1)
    const show1Id = createdShowIds[0];
    const show1Seats = await prisma.showSeat.findMany({
      where: { showId: show1Id },
      include: { seat: true },
    });
    assert(
      show1Seats.length === 4 &&
        show1Seats.every((ss) => ss.status === 'AVAILABLE'),
      'ShowSeat snapshot correctly initialized for all eligible physical seats'
    );

    // -------------------------------------------------------------------------
    // TEST 16: Inactive physical seats excluded from ShowSeat creation
    // -------------------------------------------------------------------------
    // Create a new screen with 1 active seat and 1 inactive seat
    const screenWithInactSeat = await prisma.screen.create({
      data: {
        theatreId: testTheatreId,
        name: 'Audi with Broken Seat',
        screenType: 'STANDARD',
        supportedFormats: ['2D'],
        capacity: 2,
        isActive: true,
      },
    });

    await prisma.seat.create({
      data: {
        screenId: screenWithInactSeat.id,
        row: 'A',
        seatNumber: 1,
        category: 'SILVER',
        isActive: true,
      },
    });
    await prisma.seat.create({
      data: {
        screenId: screenWithInactSeat.id,
        row: 'A',
        seatNumber: 2,
        category: 'SILVER',
        isActive: false, // Broken / blocked seat
      },
    });

    const brokenSeatShowRes = await fetch(`${BASE_URL}/shows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        movieId: activeMovie.id,
        screenId: screenWithInactSeat.id,
        startTime: '2026-11-23T10:00:00.000Z',
        format: '2D',
      }),
    });
    const brokenSeatShowData = await brokenSeatShowRes.json();
    const brokenShowId = brokenSeatShowData.data?.show?.id;
    if (brokenShowId) createdShowIds.push(brokenShowId);

    const brokenShowSeats = await prisma.showSeat.findMany({
      where: { showId: brokenShowId },
    });

    assert(
      brokenSeatShowRes.status === 201 && brokenShowSeats.length === 1,
      'Inactive physical seats (isActive=false) are excluded from ShowSeat generation'
    );

    // Clean up screenWithInactSeat
    await prisma.showSeat.deleteMany({ where: { showId: brokenShowId } });
    await prisma.show.deleteMany({ where: { id: brokenShowId } });
    await prisma.seat.deleteMany({ where: { screenId: screenWithInactSeat.id } });
    await prisma.screen.deleteMany({ where: { id: screenWithInactSeat.id } });

    // -------------------------------------------------------------------------
    // TEST 17: Correct category-wise pricing
    // -------------------------------------------------------------------------
    // In Show 1: SILVER price was configured as 190, GOLD as 260, RECLINER as 450
    const silverSeat = show1Seats.find((s) => s.seat.category === 'SILVER');
    const goldSeat = show1Seats.find((s) => s.seat.category === 'GOLD');
    const reclinerSeat = show1Seats.find((s) => s.seat.category === 'RECLINER');

    assert(
      Number(silverSeat?.price) === 190 &&
        Number(goldSeat?.price) === 260 &&
        Number(reclinerSeat?.price) === 450,
      'ShowSeats correctly store category-specific pricing (Silver: ₹190, Gold: ₹260, Recliner: ₹450)'
    );

    // -------------------------------------------------------------------------
    // TEST 18: Show update validation
    // -------------------------------------------------------------------------
    const updateRes = await fetch(`${BASE_URL}/shows/${show1Id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        format: '3D',
        pricing: {
          SILVER: 210,
        },
      }),
    });
    const updateData = await updateRes.json();

    const updatedSilverSeat = await prisma.showSeat.findFirst({
      where: { showId: show1Id, seat: { category: 'SILVER' } },
    });

    assert(
      updateRes.status === 200 &&
        updateData.data.show.format === '3D' &&
        Number(updatedSilverSeat.price) === 210,
      'Admin updates show format and updates pricing for available seats'
    );

    // -------------------------------------------------------------------------
    // TEST 19: Show deactivation (soft toggle)
    // -------------------------------------------------------------------------
    const deactRes = await fetch(`${BASE_URL}/shows/${show1Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({ isActive: false }),
    });
    const deactData = await deactRes.json();

    // Verify ordinary customer GET /api/shows/:id returns 404
    const custGetRes = await fetch(`${BASE_URL}/shows/${show1Id}`);

    assert(
      deactRes.status === 200 &&
        deactData.data.show.isActive === false &&
        custGetRes.status === 404,
      'Admin deactivates show; customer can no longer access it and records are preserved'
    );

    // -------------------------------------------------------------------------
    // Clean up Phase 5 test records
    // -------------------------------------------------------------------------
    for (const sid of createdShowIds) {
      await prisma.showSeat.deleteMany({ where: { showId: sid } });
      await prisma.show.deleteMany({ where: { id: sid } });
    }
    await prisma.seat.deleteMany({ where: { screenId: { in: [testScreenId1, testScreenId2] } } });
    await prisma.screen.deleteMany({
      where: { id: { in: [testScreenId1, testScreenId2, inactiveScreenId] } },
    });
    await prisma.theatre.deleteMany({ where: { id: testTheatreId } });
    await prisma.movie.deleteMany({ where: { id: inactiveMovieId } });
  } catch (err) {
    console.error('Test execution error:', err);
    failedCount++;
  } finally {
    server.close();
    console.log('\n====================================================');
    console.log(`Phase 5 Test Results: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('====================================================');
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runTests();
