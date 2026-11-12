import prisma from '../config/database.js';
import bcrypt from 'bcryptjs';

export async function getDatabaseSummary() {
  const usersCount = await prisma.user.count();
  const genresCount = await prisma.genre.count();
  const moviesCount = await prisma.movie.count();
  const movieGenresCount = await prisma.movieGenre.count();
  const theatresCount = await prisma.theatre.count();
  const screensCount = await prisma.screen.count();
  const seatsCount = await prisma.seat.count();
  const showsCount = await prisma.show.count();
  const showSeatsCount = await prisma.showSeat.count();

  return {
    usersCount,
    genresCount,
    moviesCount,
    movieGenresCount,
    theatresCount,
    screensCount,
    seatsCount,
    showsCount,
    showSeatsCount,
  };
}

async function verifyAll() {
  console.log('--- STARTING DATABASE VALIDATION ---');
  
  const summary = await getDatabaseSummary();
  console.log('TABLE COUNTS:', JSON.stringify(summary, null, 2));

  // Verify ShowSeats match physical seats per show
  const shows = await prisma.show.findMany({
    include: {
      screen: {
        include: {
          _count: { select: { seats: true } },
        },
      },
      _count: { select: { showSeats: true } },
    },
  });

  console.log('\n--- SHOW TO PHYSICAL SEAT VERIFICATION ---');
  let allShowsMatch = true;
  for (const s of shows) {
    const physicalSeats = s.screen._count.seats;
    const showSeats = s._count.showSeats;
    const matches = physicalSeats === showSeats;
    if (!matches) allShowsMatch = false;

    console.log(
      `Show: ${s.id.slice(-6)} | Screen: "${s.screen.name}" | Format: ${s.format} | Physical Seats: ${physicalSeats} | ShowSeats: ${showSeats} | Match: ${matches ? '✅' : '❌'}`
    );
  }

  // Verify Demo User Logins
  console.log('\n--- USER AUTHENTICATION VERIFICATION ---');
  const admin = await prisma.user.findUnique({ where: { email: 'admin@cinema.com' } });
  const adminPwValid = admin ? await bcrypt.compare('Admin@123', admin.password) : false;
  console.log(`Admin login check (admin@cinema.com / Admin@123): ${adminPwValid ? '✅ VALID' : '❌ FAILED'}`);

  const customer = await prisma.user.findUnique({ where: { email: 'rahul@example.com' } });
  const customerPwValid = customer ? await bcrypt.compare('Cinema@123', customer.password) : false;
  console.log(`Customer login check (rahul@example.com / Cinema@123): ${customerPwValid ? '✅ VALID' : '❌ FAILED'}`);

  // Verify Show Overlaps
  console.log('\n--- SCHEDULE OVERLAP VERIFICATION ---');
  let hasOverlap = false;
  for (let i = 0; i < shows.length; i++) {
    for (let j = i + 1; j < shows.length; j++) {
      const s1 = shows[i];
      const s2 = shows[j];
      if (s1.screenId === s2.screenId) {
        const overlap = (s1.startTime < s2.endTime && s1.endTime > s2.startTime);
        if (overlap) {
          hasOverlap = true;
          console.log(`❌ OVERLAP DETECTED between ${s1.id} and ${s2.id} on screen ${s1.screenId}`);
        }
      }
    }
  }
  if (!hasOverlap) {
    console.log('✅ No overlapping shows on the same screen.');
  }

  console.log('\n--- OVERALL PHASE 1 STATUS ---');
  if (allShowsMatch && adminPwValid && customerPwValid && !hasOverlap) {
    console.log('✅ ALL PHASE 1 DATABASE REQUIREMENTS SATISFIED');
  } else {
    console.log('❌ SOME CHECKS FAILED');
    process.exit(1);
  }
}

verifyAll()
  .catch((err) => {
    console.error('Validation error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

