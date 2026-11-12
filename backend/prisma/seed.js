import { PrismaClient, Role, SeatCategory, ShowSeatStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Deterministic UUIDs for repeatable seeding
const THEATRE_ID = '22222222-2222-2222-2222-222222222222';
const SCREEN_1_ID = '33333333-3333-3333-3333-333333333331';
const SCREEN_2_ID = '33333333-3333-3333-3333-333333333332';

const MOVIE_IDS = {
  INCEPTION: '11111111-1111-1111-1111-111111111111',
  INTERSTELLAR: '11111111-1111-1111-1111-111111111112',
  DARK_KNIGHT: '11111111-1111-1111-1111-111111111113',
  KANTARA: '11111111-1111-1111-1111-111111111114',
  SPIRITED_AWAY: '11111111-1111-1111-1111-111111111115',
};

const SHOW_IDS = {
  SHOW_1: '44444444-4444-4444-4444-444444444441',
  SHOW_2: '44444444-4444-4444-4444-444444444442',
  SHOW_3: '44444444-4444-4444-4444-444444444443',
  SHOW_4: '44444444-4444-4444-4444-444444444444',
  SHOW_5: '44444444-4444-4444-4444-444444444445',
  SHOW_6: '44444444-4444-4444-4444-444444444446',
};

// Helper: Anchor show times to deterministic upcoming calendar slots relative to today
function getShowTime(dayOffset, hour, minute) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  console.log('🌱 Starting deterministic, idempotent seed...');

  // =========================================================================
  // 1. DEMO USERS
  // =========================================================================
  console.log('👤 Seeding users...');
  const defaultPasswordHash = await bcrypt.hash('Cinema@123', 10);
  const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
  const staffPasswordHash = await bcrypt.hash('Staff@123', 10);

  const usersData = [
    {
      email: 'admin@cinema.com',
      name: 'System Administrator',
      password: adminPasswordHash,
      role: Role.ADMIN,
    },
    {
      email: 'staff@cinema.com',
      name: 'Cinema Gate Staff',
      password: staffPasswordHash,
      role: Role.STAFF,
    },
    {
      email: 'rahul@example.com',
      name: 'Rahul Sharma',
      password: defaultPasswordHash,
      role: Role.CUSTOMER,
    },
    {
      email: 'priya@example.com',
      name: 'Priya Patel',
      password: defaultPasswordHash,
      role: Role.CUSTOMER,
    },
    {
      email: 'amit@example.com',
      name: 'Amit Verma',
      password: defaultPasswordHash,
      role: Role.CUSTOMER,
    },
  ];

  for (const user of usersData) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        password: user.password,
        role: user.role,
      },
      create: user,
    });
  }

  // =========================================================================
  // 2. GENRES
  // =========================================================================
  console.log('🎭 Seeding genres...');
  const genreNames = [
    'Action',
    'Sci-Fi',
    'Drama',
    'Thriller',
    'Comedy',
    'Romance',
    'Animation',
    'Horror',
  ];

  const genres = {};
  for (const name of genreNames) {
    const genre = await prisma.genre.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    genres[name] = genre.id;
  }

  // =========================================================================
  // 3. MOVIES & MOVIE_GENRES
  // =========================================================================
  console.log('🎬 Seeding movies...');
  const moviesData = [
    {
      id: MOVIE_IDS.INCEPTION,
      title: 'Inception',
      description:
        'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.',
      duration: 148,
      language: 'English',
      releaseDate: new Date('2010-07-16'),
      posterUrl:
        'https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
      rating: 'UA',
      genreNames: ['Action', 'Sci-Fi', 'Thriller'],
    },
    {
      id: MOVIE_IDS.INTERSTELLAR,
      title: 'Interstellar',
      description:
        'When Earth becomes uninhabitable in the future, a farmer and ex-NASA pilot, Joseph Cooper, is tasked to pilot a spacecraft along with a team of researchers to find a new planet for humans.',
      duration: 169,
      language: 'English',
      releaseDate: new Date('2014-11-07'),
      posterUrl:
        'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
      rating: 'UA',
      genreNames: ['Sci-Fi', 'Drama'],
    },
    {
      id: MOVIE_IDS.DARK_KNIGHT,
      title: 'The Dark Knight',
      description:
        'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.',
      duration: 152,
      language: 'English',
      releaseDate: new Date('2008-07-18'),
      posterUrl:
        'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
      rating: 'UA',
      genreNames: ['Action', 'Thriller', 'Drama'],
    },
    {
      id: MOVIE_IDS.KANTARA,
      title: 'Kantara',
      description:
        'When greed paves the way for betrayal, scheming and murder, a young tribal man reluctantly dons the traditions of his ancestors to seek justice for his people.',
      duration: 148,
      language: 'Kannada',
      releaseDate: new Date('2022-09-30'),
      posterUrl:
        'https://image.tmdb.org/t/p/w500/jReea1wQ525mGjXkYV9Z6Z1W7Qd.jpg',
      rating: 'UA',
      genreNames: ['Action', 'Drama', 'Thriller'],
    },
    {
      id: MOVIE_IDS.SPIRITED_AWAY,
      title: 'Spirited Away',
      description:
        'During her family\'s move to the suburbs, a sullen 10-year-old girl wanders into a world ruled by gods, witches, and spirits, and where humans are changed into beasts.',
      duration: 125,
      language: 'Japanese',
      releaseDate: new Date('2001-07-20'),
      posterUrl:
        'https://image.tmdb.org/t/p/w500/393mh1AJ0GYWVD7Desq9KkFaBqH.jpg',
      rating: 'U',
      genreNames: ['Animation', 'Drama'],
    },
  ];

  for (const movieData of moviesData) {
    const { genreNames: movieGenres, id, ...rest } = movieData;

    await prisma.movie.upsert({
      where: { id },
      update: rest,
      create: { id, ...rest },
    });

    // Link Movie to Genres idempotently
    for (const gName of movieGenres) {
      const genreId = genres[gName];
      if (genreId) {
        await prisma.movieGenre.upsert({
          where: {
            movieId_genreId: {
              movieId: id,
              genreId,
            },
          },
          update: {},
          create: {
            movieId: id,
            genreId,
          },
        });
      }
    }
  }

  // =========================================================================
  // 4. THEATRE & SCREENS
  // =========================================================================
  console.log('🏛️ Seeding theatre and screens...');
  await prisma.theatre.upsert({
    where: { id: THEATRE_ID },
    update: {
      name: 'Algions Cineplex',
      location: 'Nexus Mall, Koramangala, Bengaluru',
      isActive: true,
    },
    create: {
      id: THEATRE_ID,
      name: 'Algions Cineplex',
      location: 'Nexus Mall, Koramangala, Bengaluru',
      isActive: true,
    },
  });

  // Screen 1: Standard / Dolby Atmos (80 seats: 8 rows A-H x 10 seats)
  await prisma.screen.upsert({
    where: {
      theatreId_name: {
        theatreId: THEATRE_ID,
        name: 'Audi 1 (Dolby Atmos)',
      },
    },
    update: {
      id: SCREEN_1_ID,
      screenType: 'STANDARD',
      supportedFormats: ['2D', '3D'],
      isActive: true,
    },
    create: {
      id: SCREEN_1_ID,
      name: 'Audi 1 (Dolby Atmos)',
      theatreId: THEATRE_ID,
      screenType: 'STANDARD',
      supportedFormats: ['2D', '3D'],
      isActive: true,
    },
  });

  // Screen 2: IMAX Laser (48 seats: 6 rows A-F x 8 seats)
  await prisma.screen.upsert({
    where: {
      theatreId_name: {
        theatreId: THEATRE_ID,
        name: 'Audi 2 (IMAX Laser)',
      },
    },
    update: {
      id: SCREEN_2_ID,
      screenType: 'IMAX',
      supportedFormats: ['2D', '3D', 'IMAX'],
      isActive: true,
    },
    create: {
      id: SCREEN_2_ID,
      name: 'Audi 2 (IMAX Laser)',
      theatreId: THEATRE_ID,
      screenType: 'IMAX',
      supportedFormats: ['2D', '3D', 'IMAX'],
      isActive: true,
    },
  });

  // =========================================================================
  // 5. PHYSICAL SEATS
  // =========================================================================
  console.log('🪑 Seeding physical seats for Screen 1 and Screen 2...');

  // Screen 1: 8 rows (A-H), 10 seats per row = 80 seats
  // A, B -> SILVER (20 seats)
  // C, D, E, F -> GOLD (40 seats)
  // G, H -> PREMIUM (20 seats)
  const screen1Rows = [
    { row: 'A', category: SeatCategory.SILVER },
    { row: 'B', category: SeatCategory.SILVER },
    { row: 'C', category: SeatCategory.GOLD },
    { row: 'D', category: SeatCategory.GOLD },
    { row: 'E', category: SeatCategory.GOLD },
    { row: 'F', category: SeatCategory.GOLD },
    { row: 'G', category: SeatCategory.PREMIUM },
    { row: 'H', category: SeatCategory.PREMIUM },
  ];

  for (const { row, category } of screen1Rows) {
    for (let seatNumber = 1; seatNumber <= 10; seatNumber++) {
      await prisma.seat.upsert({
        where: {
          screenId_row_seatNumber: {
            screenId: SCREEN_1_ID,
            row,
            seatNumber,
          },
        },
        update: { category },
        create: {
          screenId: SCREEN_1_ID,
          row,
          seatNumber,
          category,
        },
      });
    }
  }

  // Screen 2: 6 rows (A-F), 8 seats per row = 48 seats
  // A, B -> GOLD (16 seats)
  // C, D, E, F -> PREMIUM (32 seats)
  const screen2Rows = [
    { row: 'A', category: SeatCategory.GOLD },
    { row: 'B', category: SeatCategory.GOLD },
    { row: 'C', category: SeatCategory.PREMIUM },
    { row: 'D', category: SeatCategory.PREMIUM },
    { row: 'E', category: SeatCategory.PREMIUM },
    { row: 'F', category: SeatCategory.PREMIUM },
  ];

  for (const { row, category } of screen2Rows) {
    for (let seatNumber = 1; seatNumber <= 8; seatNumber++) {
      await prisma.seat.upsert({
        where: {
          screenId_row_seatNumber: {
            screenId: SCREEN_2_ID,
            row,
            seatNumber,
          },
        },
        update: { category },
        create: {
          screenId: SCREEN_2_ID,
          row,
          seatNumber,
          category,
        },
      });
    }
  }

  // =========================================================================
  // 6. SHOWS (Non-overlapping, format validated)
  // =========================================================================
  console.log('🕒 Seeding scheduled shows...');

  const showsData = [
    // Audi 1 (Screen 1, Standard): 3 shows today
    {
      id: SHOW_IDS.SHOW_1,
      movieId: MOVIE_IDS.INCEPTION,
      screenId: SCREEN_1_ID,
      startTime: getShowTime(0, 11, 30),
      endTime: getShowTime(0, 14, 0),
      format: '2D',
    },
    {
      id: SHOW_IDS.SHOW_2,
      movieId: MOVIE_IDS.DARK_KNIGHT,
      screenId: SCREEN_1_ID,
      startTime: getShowTime(0, 15, 0),
      endTime: getShowTime(0, 17, 35),
      format: '2D',
    },
    {
      id: SHOW_IDS.SHOW_3,
      movieId: MOVIE_IDS.KANTARA,
      screenId: SCREEN_1_ID,
      startTime: getShowTime(0, 18, 30),
      endTime: getShowTime(0, 21, 0),
      format: '2D',
    },
    // Audi 2 (Screen 2, IMAX): 2 shows today, 1 show tomorrow
    {
      id: SHOW_IDS.SHOW_4,
      movieId: MOVIE_IDS.INTERSTELLAR,
      screenId: SCREEN_2_ID,
      startTime: getShowTime(0, 13, 0),
      endTime: getShowTime(0, 15, 50),
      format: 'IMAX',
    },
    {
      id: SHOW_IDS.SHOW_5,
      movieId: MOVIE_IDS.INCEPTION,
      screenId: SCREEN_2_ID,
      startTime: getShowTime(0, 17, 0),
      endTime: getShowTime(0, 19, 30),
      format: 'IMAX',
    },
    {
      id: SHOW_IDS.SHOW_6,
      movieId: MOVIE_IDS.INTERSTELLAR,
      screenId: SCREEN_2_ID,
      startTime: getShowTime(1, 14, 0),
      endTime: getShowTime(1, 16, 50),
      format: 'IMAX',
    },
  ];

  for (const show of showsData) {
    await prisma.show.upsert({
      where: { id: show.id },
      update: {
        movieId: show.movieId,
        screenId: show.screenId,
        startTime: show.startTime,
        endTime: show.endTime,
        format: show.format,
        isActive: true,
      },
      create: {
        id: show.id,
        movieId: show.movieId,
        screenId: show.screenId,
        startTime: show.startTime,
        endTime: show.endTime,
        format: show.format,
        isActive: true,
      },
    });
  }

  // =========================================================================
  // 7. SHOWSEATS GENERATION (Category-based pricing)
  // =========================================================================
  console.log('🎫 Generating ShowSeat records for every show...');

  // Pricing rules by Screen and Category
  // Screen 1: SILVER: ₹180, GOLD: ₹250, PREMIUM: ₹350
  // Screen 2 (IMAX): GOLD: ₹350, PREMIUM: ₹500
  const getSeatPrice = (screenId, category) => {
    if (screenId === SCREEN_2_ID) {
      return category === SeatCategory.PREMIUM ? 500.0 : 350.0;
    }
    switch (category) {
      case SeatCategory.SILVER:
        return 180.0;
      case SeatCategory.GOLD:
        return 250.0;
      case SeatCategory.PREMIUM:
        return 350.0;
      default:
        return 200.0;
    }
  };

  let totalShowSeatsGenerated = 0;

  for (const show of showsData) {
    const seats = await prisma.seat.findMany({
      where: { screenId: show.screenId },
    });

    for (const seat of seats) {
      const price = getSeatPrice(show.screenId, seat.category);

      await prisma.showSeat.upsert({
        where: {
          showId_seatId: {
            showId: show.id,
            seatId: seat.id,
          },
        },
        update: {
          price,
        },
        create: {
          showId: show.id,
          seatId: seat.id,
          price,
          status: ShowSeatStatus.AVAILABLE,
        },
      });
      totalShowSeatsGenerated++;
    }
  }

  console.log(`✅ Processed ${totalShowSeatsGenerated} ShowSeat entries across ${showsData.length} shows.`);
  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

