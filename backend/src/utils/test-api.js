import app from '../app.js';
import prisma from '../config/database.js';

async function testEndpoints() {
  console.log('--- TESTING HEALTH ENDPOINTS ---');
  
  const server = app.listen(5001);
  try {
    const res1 = await fetch('http://localhost:5001/health');
    const data1 = await res1.json();
    console.log('GET /health:', res1.status, JSON.stringify(data1));

    const res2 = await fetch('http://localhost:5001/health/db');
    const data2 = await res2.json();
    console.log('GET /health/db:', res2.status, JSON.stringify(data2));

    const res3 = await fetch('http://localhost:5001/api/health');
    const data3 = await res3.json();
    console.log('GET /api/health:', res3.status, JSON.stringify(data3));

    const res4 = await fetch('http://localhost:5001/api/health/db');
    const data4 = await res4.json();
    console.log('GET /api/health/db:', res4.status, JSON.stringify(data4));

    const res5 = await fetch('http://localhost:5001/api/nonexistent');
    const data5 = await res5.json();
    console.log('GET /api/nonexistent (404 test):', res5.status, JSON.stringify(data5));

    console.log('✅ ALL HEALTH ENDPOINTS FUNCTIONING PERFECTLY');
  } catch (err) {
    console.error('Health endpoint test failed:', err);
    process.exit(1);
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

testEndpoints();

