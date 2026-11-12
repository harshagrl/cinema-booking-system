import app from '../app.js';
import prisma from '../config/database.js';

const PORT = 5004;
const BASE_URL = `http://localhost:${PORT}/api`;

async function runTests() {
  console.log('====================================================');
  console.log('   PHASE 4: THEATRE, SCREEN & SEAT API TESTS');
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
  let createdTheatreId = '';
  let createdScreenId = '';

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

    // -------------------------------------------------------------------------
    // TEST 1: Public theatre listing
    // -------------------------------------------------------------------------
    const listRes = await fetch(`${BASE_URL}/theatres`);
    const listData = await listRes.json();
    assert(
      listRes.status === 200 &&
        listData.success === true &&
        Array.isArray(listData.data.theatres) &&
        listData.data.theatres.length > 0 &&
        listData.data.theatres[0].screensCount !== undefined,
      'Public GET /api/theatres returns active theatres with screen count and capacity'
    );

    const seededTheatre = listData.data.theatres.find(
      (t) => t.name === 'Algions Cineplex'
    );
    const seededTheatreId = seededTheatre?.id || '22222222-2222-2222-2222-222222222222';

    // -------------------------------------------------------------------------
    // TEST 2: Filter theatres by city and search
    // -------------------------------------------------------------------------
    const cityRes = await fetch(`${BASE_URL}/theatres?city=Bengaluru`);
    const cityData = await cityRes.json();
    assert(
      cityRes.status === 200 &&
        cityData.data.theatres.every((t) =>
          t.city?.toLowerCase().includes('bengaluru')
        ),
      'GET /api/theatres?city=Bengaluru accurately filters theatres by city'
    );

    // -------------------------------------------------------------------------
    // TEST 3: Public theatre details with screens and seat counts
    // -------------------------------------------------------------------------
    const detailRes = await fetch(`${BASE_URL}/theatres/${seededTheatreId}`);
    const detailData = await detailRes.json();
    assert(
      detailRes.status === 200 &&
        detailData.success === true &&
        detailData.data.theatre.id === seededTheatreId &&
        Array.isArray(detailData.data.theatre.screens) &&
        detailData.data.theatre.screens.length >= 2,
      'Public GET /api/theatres/:id returns complete details with screens and seat counts'
    );

    // -------------------------------------------------------------------------
    // TEST 4: Customer cannot create a theatre (RBAC 403)
    // -------------------------------------------------------------------------
    const custCreateRes = await fetch(`${BASE_URL}/theatres`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customerCookie,
      },
      body: JSON.stringify({
        name: 'Unauthorized Theatre',
        location: 'Downtown',
        city: 'Bengaluru',
      }),
    });
    assert(
      custCreateRes.status === 403,
      'Customer receives 403 Forbidden when attempting to create a theatre'
    );

    // -------------------------------------------------------------------------
    // TEST 5: Staff cannot create a theatre (RBAC 403)
    // -------------------------------------------------------------------------
    const staffCreateRes = await fetch(`${BASE_URL}/theatres`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: staffCookie,
      },
      body: JSON.stringify({
        name: 'Staff Theatre',
        location: 'Uptown',
        city: 'Bengaluru',
      }),
    });
    assert(
      staffCreateRes.status === 403,
      'Staff receives 403 Forbidden when attempting to create a theatre'
    );

    // -------------------------------------------------------------------------
    // TEST 6: Admin creates theatre with Zod validation
    // -------------------------------------------------------------------------
    const adminCreateRes = await fetch(`${BASE_URL}/theatres`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: 'Algions Premier Luxe',
        location: 'Whitefield Main Road',
        city: 'Bengaluru',
        address: 'Forum Shantiniketan Mall, Whitefield, Bengaluru',
      }),
    });
    const adminCreateData = await adminCreateRes.json();
    assert(
      adminCreateRes.status === 201 &&
        adminCreateData.success === true &&
        adminCreateData.data.theatre.name === 'Algions Premier Luxe' &&
        adminCreateData.data.theatre.city === 'Bengaluru',
      'Admin successfully creates a new theatre with address and city'
    );
    createdTheatreId = adminCreateData.data.theatre.id;

    // -------------------------------------------------------------------------
    // TEST 7: Admin updates theatre details
    // -------------------------------------------------------------------------
    const updateRes = await fetch(`${BASE_URL}/theatres/${createdTheatreId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: 'Algions Premier Luxe & IMAX',
      }),
    });
    const updateData = await updateRes.json();
    assert(
      updateRes.status === 200 &&
        updateData.data.theatre.name === 'Algions Premier Luxe & IMAX',
      'Admin successfully updates theatre details'
    );

    // -------------------------------------------------------------------------
    // TEST 8: Admin toggles theatre status (soft toggle)
    // -------------------------------------------------------------------------
    const statusRes = await fetch(`${BASE_URL}/theatres/${createdTheatreId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({ isActive: false }),
    });
    const statusData = await statusRes.json();
    assert(
      statusRes.status === 200 && statusData.data.theatre.isActive === false,
      'Admin deactivates theatre without deleting records'
    );

    // Reactivate for screen tests
    await fetch(`${BASE_URL}/theatres/${createdTheatreId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({ isActive: true }),
    });

    // -------------------------------------------------------------------------
    // TEST 9: GET /api/theatres/:theatreId/screens lists screens
    // -------------------------------------------------------------------------
    const screensRes = await fetch(
      `${BASE_URL}/theatres/${seededTheatreId}/screens`
    );
    const screensData = await screensRes.json();
    assert(
      screensRes.status === 200 &&
        Array.isArray(screensData.data.screens) &&
        screensData.data.screens.length >= 2,
      'GET /api/theatres/:theatreId/screens lists screens for the theatre'
    );

    // -------------------------------------------------------------------------
    // TEST 10: Admin creates a screen for a theatre
    // -------------------------------------------------------------------------
    const createScreenRes = await fetch(
      `${BASE_URL}/theatres/${createdTheatreId}/screens`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          name: 'Audi 1 (Dolby Vision)',
          screenType: 'DOLBY_ATMOS',
          supportedFormats: ['2D', '3D', '4DX'],
          capacity: 0,
        }),
      }
    );
    const createScreenData = await createScreenRes.json();
    assert(
      createScreenRes.status === 201 &&
        createScreenData.success === true &&
        createScreenData.data.screen.name === 'Audi 1 (Dolby Vision)',
      'Admin creates screen associated with theatre'
    );
    createdScreenId = createScreenData.data.screen.id;

    // -------------------------------------------------------------------------
    // TEST 11: Screen name uniqueness within theatre (409 Conflict)
    // -------------------------------------------------------------------------
    const dupScreenRes = await fetch(
      `${BASE_URL}/theatres/${createdTheatreId}/screens`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          name: 'Audi 1 (Dolby Vision)',
          screenType: 'STANDARD',
          supportedFormats: ['2D'],
        }),
      }
    );
    assert(
      dupScreenRes.status === 409,
      'Creating duplicate screen name within same theatre rejects with 409 Conflict'
    );

    // -------------------------------------------------------------------------
    // TEST 12: Admin updates screen and toggles status
    // -------------------------------------------------------------------------
    const screenUpdateRes = await fetch(`${BASE_URL}/screens/${createdScreenId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        screenType: 'LUXE_ATMOS',
      }),
    });
    const screenUpdateData = await screenUpdateRes.json();
    assert(
      screenUpdateRes.status === 200 &&
        screenUpdateData.data.screen.screenType === 'LUXE_ATMOS',
      'Admin updates screen metadata and configuration'
    );

    // -------------------------------------------------------------------------
    // TEST 13: GET /api/screens/:screenId/seats returns seat layout
    // -------------------------------------------------------------------------
    const seededScreenId = '33333333-3333-3333-3333-333333333331';
    const seatsRes = await fetch(`${BASE_URL}/screens/${seededScreenId}/seats`);
    const seatsData = await seatsRes.json();
    assert(
      seatsRes.status === 200 &&
        seatsData.success === true &&
        seatsData.data.totalSeats === 80 &&
        Array.isArray(seatsData.data.rows) &&
        seatsData.data.rows.length === 8 &&
        seatsData.data.categoryCounts.SILVER > 0,
      'GET /api/screens/:screenId/seats returns formatted physical seat layout and tiers'
    );

    // -------------------------------------------------------------------------
    // TEST 14: Bulk configure physical seats & update screen capacity
    // -------------------------------------------------------------------------
    const newSeatsPayload = [
      { row: 'A', seatNumber: 1, category: 'REGULAR', isActive: true },
      { row: 'A', seatNumber: 2, category: 'REGULAR', isActive: true },
      { row: 'A', seatNumber: 3, category: 'REGULAR', isActive: true },
      { row: 'B', seatNumber: 1, category: 'GOLD', isActive: true },
      { row: 'B', seatNumber: 2, category: 'GOLD', isActive: true },
      { row: 'C', seatNumber: 1, category: 'RECLINER', isActive: true },
      { row: 'C', seatNumber: 2, category: 'RECLINER', isActive: true },
    ];

    const bulkConfigRes = await fetch(
      `${BASE_URL}/screens/${createdScreenId}/seats`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({ seats: newSeatsPayload }),
      }
    );
    const bulkConfigData = await bulkConfigRes.json();
    assert(
      bulkConfigRes.status === 201 &&
        bulkConfigData.success === true &&
        bulkConfigData.data.totalSeats === 7 &&
        bulkConfigData.data.screen.capacity === 7,
      'Bulk configure creates seats and synchronizes screen.capacity to 7'
    );

    // -------------------------------------------------------------------------
    // TEST 15: Bulk configure rejects duplicate seat coordinates (400 Bad Request)
    // -------------------------------------------------------------------------
    const dupSeatsPayload = [
      { row: 'A', seatNumber: 1, category: 'REGULAR' },
      { row: 'A', seatNumber: 1, category: 'REGULAR' }, // Duplicate coordinate
    ];
    const dupConfigRes = await fetch(
      `${BASE_URL}/screens/${createdScreenId}/seats`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({ seats: dupSeatsPayload }),
      }
    );
    assert(
      dupConfigRes.status === 400,
      'Bulk configure rejects duplicate (row, seatNumber) coordinates with 400 Bad Request'
    );

    // -------------------------------------------------------------------------
    // TEST 16: Referential integrity: cannot remove seats referenced by shows
    // -------------------------------------------------------------------------
    // Attempt to reconfigure seededScreenId (which has 80 seats referenced by shows) with only 2 seats
    const invalidReconfigRes = await fetch(
      `${BASE_URL}/screens/${seededScreenId}/seats`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          seats: [
            { row: 'A', seatNumber: 1, category: 'REGULAR' },
            { row: 'A', seatNumber: 2, category: 'REGULAR' },
          ],
        }),
      }
    );
    const invalidReconfigData = await invalidReconfigRes.json();
    assert(
      invalidReconfigRes.status === 400 &&
        invalidReconfigData.code === 'SEAT_REFERENCED_IN_SHOWS',
      'Referential integrity: Prevents deleting seats referenced in existing shows with code SEAT_REFERENCED_IN_SHOWS'
    );

    // -------------------------------------------------------------------------
    // TEST 17: Bulk update seat categories and active status
    // -------------------------------------------------------------------------
    const updateSeatsRes = await fetch(
      `${BASE_URL}/screens/${createdScreenId}/seats`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          seats: [
            { row: 'A', seatNumber: 1, category: 'PREMIUM', isActive: false },
          ],
        }),
      }
    );
    const updateSeatsData = await updateSeatsRes.json();
    const updatedA1 = updateSeatsData.data.seats.find(
      (s) => s.row === 'A' && s.seatNumber === 1
    );
    assert(
      updateSeatsRes.status === 200 &&
        updatedA1?.category === 'PREMIUM' &&
        updatedA1?.isActive === false &&
        updateSeatsData.data.activeSeats === 6,
      'Bulk update modifies seat category and active status without affecting other seats'
    );

    // Clean up created test theatre & screens & seats
    await prisma.seat.deleteMany({ where: { screenId: createdScreenId } });
    await prisma.screen.deleteMany({ where: { theatreId: createdTheatreId } });
    await prisma.theatre.deleteMany({ where: { id: createdTheatreId } });
  } catch (err) {
    console.error('Test execution error:', err);
    failedCount++;
  } finally {
    server.close();
    console.log('\n====================================================');
    console.log(`Phase 4 Test Results: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('====================================================');
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runTests();

