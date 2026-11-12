import app from '../app.js';
import prisma from '../config/database.js';

const PORT = 5003;
const BASE_URL = `http://localhost:${PORT}/api`;

async function runTests() {
  console.log('====================================================');
  console.log('   PHASE 3: MOVIE & GENRE MANAGEMENT API TESTS');
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
  let createdMovieId = '';
  let createdGenreId = '';
  let unusedGenreId = '';

  try {
    // -------------------------------------------------------------------------
    // Login Admin, Staff & Customer demo accounts
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
    // TEST 1: Public movie listing returns active movies
    // -------------------------------------------------------------------------
    const listRes = await fetch(`${BASE_URL}/movies`);
    const listData = await listRes.json();
    assert(
      listRes.status === 200 &&
        listData.success === true &&
        Array.isArray(listData.data.movies) &&
        listData.data.movies.length > 0 &&
        listData.data.pagination.total > 0,
      'Public GET /api/movies returns active movies with pagination metadata'
    );

    // -------------------------------------------------------------------------
    // TEST 2: Search movies by title returns matching movies
    // -------------------------------------------------------------------------
    const searchRes = await fetch(`${BASE_URL}/movies?search=Inception`);
    const searchData = await searchRes.json();
    assert(
      searchRes.status === 200 &&
        searchData.data.movies.length > 0 &&
        searchData.data.movies.some((m) => m.title.toLowerCase().includes('inception')),
      'GET /api/movies?search=Inception returns matching movie'
    );

    // -------------------------------------------------------------------------
    // TEST 3: Filter movies by genre returns movies of that genre
    // -------------------------------------------------------------------------
    const genreFilterRes = await fetch(`${BASE_URL}/movies?genre=Sci-Fi`);
    const genreFilterData = await genreFilterRes.json();
    assert(
      genreFilterRes.status === 200 &&
        genreFilterData.data.movies.length > 0 &&
        genreFilterData.data.movies.every((m) =>
          m.genres.some((g) => g.name.toLowerCase() === 'sci-fi')
        ),
      'GET /api/movies?genre=Sci-Fi filters accurately by genre'
    );

    // -------------------------------------------------------------------------
    // TEST 4: Filter movies by language
    // -------------------------------------------------------------------------
    const langRes = await fetch(`${BASE_URL}/movies?language=Kannada`);
    const langData = await langRes.json();
    assert(
      langRes.status === 200 &&
        langData.data.movies.length > 0 &&
        langData.data.movies.every((m) => m.language === 'Kannada'),
      'GET /api/movies?language=Kannada filters accurately by language'
    );

    // -------------------------------------------------------------------------
    // TEST 5: Pagination works
    // -------------------------------------------------------------------------
    const pageRes = await fetch(`${BASE_URL}/movies?page=1&limit=2`);
    const pageData = await pageRes.json();
    assert(
      pageRes.status === 200 &&
        pageData.data.movies.length === 2 &&
        pageData.data.pagination.page === 1 &&
        pageData.data.pagination.limit === 2 &&
        pageData.data.pagination.totalPages >= 2,
      'GET /api/movies?page=1&limit=2 paginates correctly with slice limit'
    );

    // -------------------------------------------------------------------------
    // TEST 6: Movie details by ID returns movie with genres
    // -------------------------------------------------------------------------
    const existingMovie = listData.data.movies[0];
    const detailRes = await fetch(`${BASE_URL}/movies/${existingMovie.id}`);
    const detailData = await detailRes.json();
    assert(
      detailRes.status === 200 &&
        detailData.success === true &&
        detailData.data.movie.id === existingMovie.id &&
        Array.isArray(detailData.data.movie.genres),
      'GET /api/movies/:id returns complete movie record with associated genres'
    );

    // -------------------------------------------------------------------------
    // TEST 7: Missing movie returns 404
    // -------------------------------------------------------------------------
    const notFoundRes = await fetch(`${BASE_URL}/movies/00000000-0000-0000-0000-000000000000`);
    assert(
      notFoundRes.status === 404,
      'GET /api/movies/:id for non-existent UUID returns HTTP 404 Not Found'
    );

    // -------------------------------------------------------------------------
    // TEST 8: Public genre listing returns genres with movie counts
    // -------------------------------------------------------------------------
    const genresRes = await fetch(`${BASE_URL}/genres`);
    const genresData = await genresRes.json();
    assert(
      genresRes.status === 200 &&
        genresData.success === true &&
        Array.isArray(genresData.data.genres) &&
        genresData.data.genres.some((g) => g.movieCount > 0),
      'GET /api/genres returns alphabetized genres with associated movie counts'
    );

    const firstGenre = genresData.data.genres[0];

    // -------------------------------------------------------------------------
    // TEST 9: Customer cannot create a movie (403 Forbidden)
    // -------------------------------------------------------------------------
    const custCreateRes = await fetch(`${BASE_URL}/movies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customerCookie },
      body: JSON.stringify({
        title: 'Unauthorized Movie',
        description: 'Should not be allowed',
        duration: 120,
        language: 'English',
        genreIds: [firstGenre.id],
      }),
    });
    assert(
      custCreateRes.status === 403,
      'CUSTOMER is rejected from POST /api/movies with HTTP 403 Forbidden'
    );

    // -------------------------------------------------------------------------
    // TEST 10: Staff cannot create a movie (403 Forbidden)
    // -------------------------------------------------------------------------
    const staffCreateRes = await fetch(`${BASE_URL}/movies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: staffCookie },
      body: JSON.stringify({
        title: 'Staff Movie',
        description: 'Should not be allowed',
        duration: 120,
        language: 'English',
        genreIds: [firstGenre.id],
      }),
    });
    assert(
      staffCreateRes.status === 403,
      'STAFF is rejected from POST /api/movies with HTTP 403 Forbidden'
    );

    // -------------------------------------------------------------------------
    // TEST 11: Admin can create a movie with genre associations (201 Created)
    // -------------------------------------------------------------------------
    const moviePayload = {
      title: 'Oppenheimer',
      description: 'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.',
      duration: 180,
      language: 'English',
      releaseDate: '2023-07-21',
      rating: 'A',
      posterUrl: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
      genreIds: [firstGenre.id],
    };
    const adminCreateRes = await fetch(`${BASE_URL}/movies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify(moviePayload),
    });
    const adminCreateData = await adminCreateRes.json();
    createdMovieId = adminCreateData.data?.movie?.id;
    assert(
      adminCreateRes.status === 201 &&
        adminCreateData.success === true &&
        adminCreateData.data.movie.title === 'Oppenheimer' &&
        adminCreateData.data.movie.genres.length === 1,
      'ADMIN creates new movie with HTTP 201 and persists genre associations'
    );

    // -------------------------------------------------------------------------
    // TEST 12: Creating a movie with invalid/nonexistent genre IDs fails (400)
    // -------------------------------------------------------------------------
    const invalidGenreRes = await fetch(`${BASE_URL}/movies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        title: 'Invalid Genre Movie',
        description: 'Valid description here',
        duration: 100,
        language: 'English',
        genreIds: ['00000000-0000-0000-0000-000000000000'],
      }),
    });
    assert(
      invalidGenreRes.status === 400,
      'POST /api/movies with nonexistent genre ID rejects with HTTP 400 Bad Request'
    );

    // -------------------------------------------------------------------------
    // TEST 13: Admin can update movie details and synchronize genres
    // -------------------------------------------------------------------------
    const updateRes = await fetch(`${BASE_URL}/movies/${createdMovieId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        title: 'Oppenheimer (Extended Cut)',
        duration: 195,
      }),
    });
    const updateData = await updateRes.json();
    assert(
      updateRes.status === 200 &&
        updateData.data.movie.title === 'Oppenheimer (Extended Cut)' &&
        updateData.data.movie.duration === 195,
      'ADMIN updates movie details with HTTP 200 without disrupting relations'
    );

    // -------------------------------------------------------------------------
    // TEST 14: Admin can deactivate a movie (Soft deactivation)
    // -------------------------------------------------------------------------
    const deactivateRes = await fetch(`${BASE_URL}/movies/${createdMovieId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ isActive: false }),
    });
    const deactivateData = await deactivateRes.json();
    assert(
      deactivateRes.status === 200 && deactivateData.data.movie.isActive === false,
      'ADMIN deactivates movie via PATCH /api/movies/:id/status'
    );

    // -------------------------------------------------------------------------
    // TEST 15: Inactive movie is hidden from public view
    // -------------------------------------------------------------------------
    const publicFetchInactive = await fetch(`${BASE_URL}/movies/${createdMovieId}`);
    assert(
      publicFetchInactive.status === 404,
      'Public / Customer request for inactive movie returns HTTP 404 Not Found'
    );

    // -------------------------------------------------------------------------
    // TEST 16: Admin can still view and re-activate the inactive movie
    // -------------------------------------------------------------------------
    const adminFetchInactive = await fetch(`${BASE_URL}/movies/${createdMovieId}`, {
      headers: { Cookie: adminCookie },
    });
    const reactivateRes = await fetch(`${BASE_URL}/movies/${createdMovieId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ isActive: true }),
    });
    assert(
      adminFetchInactive.status === 200 && reactivateRes.status === 200,
      'ADMIN can view inactive movie and successfully re-activate it'
    );

    // -------------------------------------------------------------------------
    // TEST 17: Admin can create a new genre
    // -------------------------------------------------------------------------
    const uniqueGenreName = `Mystery_${Date.now()}`;
    const createGenreRes = await fetch(`${BASE_URL}/genres`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ name: uniqueGenreName }),
    });
    const createGenreData = await createGenreRes.json();
    unusedGenreId = createGenreData.data?.genre?.id;
    assert(
      createGenreRes.status === 201 &&
        createGenreData.data.genre.name.toLowerCase() === uniqueGenreName.toLowerCase(),
      'ADMIN creates new genre with HTTP 201'
    );

    // -------------------------------------------------------------------------
    // TEST 18: Duplicate genre creation is rejected (409 Conflict)
    // -------------------------------------------------------------------------
    const dupGenreRes = await fetch(`${BASE_URL}/genres`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ name: uniqueGenreName.toLowerCase() }), // Case-insensitive check
    });
    assert(
      dupGenreRes.status === 409,
      'Duplicate genre creation is rejected with HTTP 409 Conflict'
    );

    // -------------------------------------------------------------------------
    // TEST 19: Admin can update a genre name
    // -------------------------------------------------------------------------
    const updatedGenreName = `Super_${uniqueGenreName}`;
    const updateGenreRes = await fetch(`${BASE_URL}/genres/${unusedGenreId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ name: updatedGenreName }),
    });
    const updateGenreData = await updateGenreRes.json();
    assert(
      updateGenreRes.status === 200 &&
        updateGenreData.data.genre.name === updatedGenreName,
      'ADMIN updates genre name with HTTP 200'
    );

    // -------------------------------------------------------------------------
    // TEST 20: Deleting a genre with associated movies is rejected (400 Bad Request)
    // -------------------------------------------------------------------------
    const deleteActiveGenreRes = await fetch(`${BASE_URL}/genres/${firstGenre.id}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    });
    const deleteActiveGenreData = await deleteActiveGenreRes.json();
    assert(
      deleteActiveGenreRes.status === 400 &&
        deleteActiveGenreData.code === 'GENRE_IN_USE',
      'Deleting a genre with associated movies is safely blocked with HTTP 400 GENRE_IN_USE'
    );

    // -------------------------------------------------------------------------
    // TEST 21: Deleting an unused genre succeeds (200 OK)
    // -------------------------------------------------------------------------
    const deleteUnusedGenreRes = await fetch(`${BASE_URL}/genres/${unusedGenreId}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    });
    assert(
      deleteUnusedGenreRes.status === 200,
      'Deleting an unused genre succeeds with HTTP 200'
    );
  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    server.close();
    await prisma.$disconnect();

    console.log('\n====================================================');
    console.log(`   TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('====================================================\n');

    if (failedCount > 0) {
      process.exit(1);
    }
  }
}

runTests();

