import prisma from '../config/database.js';

async function main() {
  try {
    const indexes = await prisma.$queryRaw`
      SELECT indexname, tablename, indexdef 
      FROM pg_indexes 
      WHERE tablename IN ('BookingSeat', 'SeatHold', 'ShowSeat', 'Show', 'Screen')
      ORDER BY tablename, indexname;
    `;
    console.log('INDEXES_FOUND:', JSON.stringify(indexes, null, 2));

    const columns = await prisma.$queryRaw`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name IN ('BookingSeat', 'SeatHold', 'Show', 'Screen', 'Movie', 'ShowSeat')
      ORDER BY table_name, column_name;
    `;
    console.log('COLUMNS_VERIFIED:', columns.length);
  } catch (error) {
    console.error('VERIFY_ERROR:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

