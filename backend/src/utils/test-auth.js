import app from '../app.js';
import prisma from '../config/database.js';
import jwt from 'jsonwebtoken';
import { clearRateLimitStore } from '../middleware/rate-limit.middleware.js';

const PORT = 5002;
const BASE_URL = `http://localhost:${PORT}/api/auth`;

async function runTests() {
  console.log('====================================================');
  console.log('   PHASE 2 AUTHENTICATION & AUTHORIZATION TESTS');
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

  const testEmail = `testuser_${Date.now()}@example.com`;
  let customerCookie = '';
  let adminCookie = '';
  let staffCookie = '';

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Customer registration succeeds
    // -------------------------------------------------------------------------
    const regRes = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Customer',
        email: testEmail,
        password: 'Password@123',
      }),
    });
    const regData = await regRes.json();
    const setCookieHeader = regRes.headers.get('set-cookie');
    customerCookie = setCookieHeader ? setCookieHeader.split(';')[0] : '';

    assert(
      regRes.status === 201 &&
        regData.success === true &&
        regData.data.user.email === testEmail &&
        regData.data.user.role === 'CUSTOMER' &&
        customerCookie.includes('token='),
      'Customer registration succeeds with HTTP 201 and sets HTTP-only cookie'
    );

    // -------------------------------------------------------------------------
    // TEST 2: Duplicate email registration fails
    // -------------------------------------------------------------------------
    const dupRes = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Another Name',
        email: testEmail,
        password: 'Password@123',
      }),
    });
    const dupData = await dupRes.json();
    assert(
      dupRes.status === 409 &&
        dupData.success === false &&
        dupData.code === 'EMAIL_ALREADY_EXISTS',
      'Duplicate email registration fails with HTTP 409 Conflict'
    );

    // -------------------------------------------------------------------------
    // TEST 3: Registration cannot create ADMIN through request manipulation
    // -------------------------------------------------------------------------
    const hackerEmail = `hacker_${Date.now()}@example.com`;
    const hackRes = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Malicious User',
        email: hackerEmail,
        password: 'Password@123',
        role: 'ADMIN', // Tampering attempt
      }),
    });
    const hackData = await hackRes.json();
    assert(
      hackRes.status === 201 && hackData.data.user.role === 'CUSTOMER',
      'Registration enforces CUSTOMER role and ignores client-supplied ADMIN role'
    );

    // -------------------------------------------------------------------------
    // TEST 4: Valid login succeeds
    // -------------------------------------------------------------------------
    const loginRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'Password@123',
      }),
    });
    const loginData = await loginRes.json();
    const loginCookie = loginRes.headers.get('set-cookie') || '';
    assert(
      loginRes.status === 200 &&
        loginData.success === true &&
        loginData.data.user.email === testEmail &&
        loginCookie.includes('token='),
      'Valid login succeeds with HTTP 200 and issues new session cookie'
    );

    // -------------------------------------------------------------------------
    // TEST 5: Invalid password fails
    // -------------------------------------------------------------------------
    const badPwRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword999!',
      }),
    });
    const badPwData = await badPwRes.json();
    assert(
      badPwRes.status === 401 &&
        badPwData.success === false &&
        badPwData.message === 'Invalid email or password',
      'Invalid password fails with HTTP 401 and generic error message'
    );

    // -------------------------------------------------------------------------
    // TEST 6: Invalid email fails with same generic message
    // -------------------------------------------------------------------------
    const badEmailRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent_user_999999@example.com',
        password: 'Password@123',
      }),
    });
    const badEmailData = await badEmailRes.json();
    assert(
      badEmailRes.status === 401 &&
        badEmailData.success === false &&
        badEmailData.message === 'Invalid email or password',
      'Invalid email fails with HTTP 401 and identical generic message (no user enumeration)'
    );

    // -------------------------------------------------------------------------
    // TEST 7: Current user endpoint works with valid authentication
    // -------------------------------------------------------------------------
    const meRes = await fetch(`${BASE_URL}/me`, {
      headers: { Cookie: customerCookie },
    });
    const meData = await meRes.json();
    assert(
      meRes.status === 200 &&
        meData.success === true &&
        meData.data.user.email === testEmail,
      'GET /api/auth/me returns authenticated user profile'
    );

    // -------------------------------------------------------------------------
    // TEST 8: Current user endpoint rejects missing authentication
    // -------------------------------------------------------------------------
    const noAuthRes = await fetch(`${BASE_URL}/me`);
    const noAuthData = await noAuthRes.json();
    assert(
      noAuthRes.status === 401 &&
        noAuthData.success === false &&
        noAuthData.code === 'AUTH_TOKEN_MISSING',
      'GET /api/auth/me rejects unauthenticated requests with HTTP 401'
    );

    // -------------------------------------------------------------------------
    // TEST 9: Expired JWT is rejected
    // -------------------------------------------------------------------------
    const expiredToken = jwt.sign(
      { id: 'some-id', email: 'expired@example.com', role: 'CUSTOMER' },
      process.env.JWT_SECRET || 'dev-secret-key-change-in-production-123456',
      { expiresIn: '0s' } // Immediately expired
    );
    const expiredRes = await fetch(`${BASE_URL}/me`, {
      headers: { Cookie: `token=${expiredToken}` },
    });
    const expiredData = await expiredRes.json();
    assert(
      expiredRes.status === 401 &&
        expiredData.success === false &&
        expiredData.code === 'TOKEN_EXPIRED',
      'Expired JWT token is rejected with HTTP 401 and TOKEN_EXPIRED code'
    );

    // Login Admin & Staff demo accounts for authorization tests
    const adminLogin = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@cinema.com', password: 'Admin@123' }),
    });
    adminCookie = adminLogin.headers.get('set-cookie')?.split(';')[0] || '';

    const staffLogin = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'staff@cinema.com', password: 'Staff@123' }),
    });
    staffCookie = staffLogin.headers.get('set-cookie')?.split(';')[0] || '';

    // -------------------------------------------------------------------------
    // TEST 10: Customer cannot access admin endpoint
    // -------------------------------------------------------------------------
    const custAdminRes = await fetch(`${BASE_URL}/admin-check`, {
      headers: { Cookie: customerCookie },
    });
    const custAdminData = await custAdminRes.json();
    assert(
      custAdminRes.status === 403 &&
        custAdminData.success === false &&
        custAdminData.code === 'INSUFFICIENT_ROLE',
      'Customer is rejected from ADMIN endpoint with HTTP 403 Forbidden'
    );

    // -------------------------------------------------------------------------
    // TEST 11: Staff cannot access admin-only endpoint
    // -------------------------------------------------------------------------
    const staffAdminRes = await fetch(`${BASE_URL}/admin-check`, {
      headers: { Cookie: staffCookie },
    });
    const staffAdminData = await staffAdminRes.json();
    assert(
      staffAdminRes.status === 403 &&
        staffAdminData.success === false &&
        staffAdminData.code === 'INSUFFICIENT_ROLE',
      'Staff is rejected from ADMIN-only endpoint with HTTP 403 Forbidden'
    );

    // -------------------------------------------------------------------------
    // TEST 12: Admin can access admin endpoint
    // -------------------------------------------------------------------------
    const adminAdminRes = await fetch(`${BASE_URL}/admin-check`, {
      headers: { Cookie: adminCookie },
    });
    const adminAdminData = await adminAdminRes.json();
    assert(
      adminAdminRes.status === 200 &&
        adminAdminData.success === true &&
        adminAdminData.data.user.role === 'ADMIN',
      'Admin successfully accesses ADMIN endpoint with HTTP 200'
    );

    // -------------------------------------------------------------------------
    // TEST 13: Logout clears authentication cookie
    // -------------------------------------------------------------------------
    const logoutRes = await fetch(`${BASE_URL}/logout`, {
      method: 'POST',
      headers: { Cookie: customerCookie },
    });
    const logoutSetCookie = logoutRes.headers.get('set-cookie') || '';
    assert(
      logoutRes.status === 200 &&
        (logoutSetCookie.includes('token=;') ||
          logoutSetCookie.includes('Max-Age=0') ||
          logoutSetCookie.includes('Expires=Thu, 01 Jan 1970')),
      'POST /api/auth/logout clears the session cookie with matching path'
    );

    // -------------------------------------------------------------------------
    // TEST 14: Password hashes are never returned
    // -------------------------------------------------------------------------
    const hasHashInReg = 'password' in regData.data.user;
    const hasHashInLogin = 'password' in loginData.data.user;
    const hasHashInMe = 'password' in meData.data.user;
    assert(
      !hasHashInReg && !hasHashInLogin && !hasHashInMe,
      'Password hash is completely excluded from all API responses (registration, login, profile)'
    );

    // -------------------------------------------------------------------------
    // TEST 15: Login rate limiting works
    // -------------------------------------------------------------------------
    clearRateLimitStore();
    let rateLimited = false;
    let rateLimitStatus = 0;

    // Send 6 rapid login requests from the same client
    for (let i = 0; i < 6; i++) {
      const res = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-rate-limit': 'true', // Flag to trigger rate limiter in test mode
        },
        body: JSON.stringify({
          email: 'rate_test@example.com',
          password: 'WrongPassword123!',
        }),
      });
      if (res.status === 429) {
        rateLimited = true;
        rateLimitStatus = res.status;
        break;
      }
    }
    assert(
      rateLimited && rateLimitStatus === 429,
      'Rate limiter blocks brute-force requests with HTTP 429 Too Many Requests'
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

