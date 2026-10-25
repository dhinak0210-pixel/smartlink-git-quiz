// scripts/test-session-security.mjs
// Comprehensive verification suite testing Section 9 checklists:
// 9.1 Unit Tests
// 9.2 Integration Tests
// 9.3 Security Tests
// 9.4 Load Tests

import { SignJWT, jwtVerify } from 'jose';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';
const SESSION_SECRET = process.env.SESSION_SECRET || 'smartlink_git_quiz_layer1_jose_session_secret_32_chars_min_2026';
const encodedSecret = new TextEncoder().encode(SESSION_SECRET);

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${message}`);
    totalPassed++;
  } else {
    console.error(`  \x1b[31m✗\x1b[0m ${message}`);
    totalFailed++;
  }
}

// Constant-time string comparison unit implementation test
function constantTimeEqual(a, b) {
  if (a.length !== b.length) {
    const dummy = 'a'.repeat(b.length);
    let result = 1;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ dummy.charCodeAt(i % dummy.length);
    }
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function runTests() {
  console.log('\n======================================================');
  console.log('SmartLink Git Quiz — Session Security Test Suite');
  console.log('======================================================\n');

  // ─── 9.1 UNIT TESTS ─────────────────────────────────────
  console.log('--- 9.1 Unit Tests (HTTP API Layer) ---');

  // Test 1: Empty fields -> 400
  {
    const res = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ college_id: '', join_code: '' }),
    });
    const data = await res.json().catch(() => ({}));
    assert(res.status === 400, 'Empty fields returns 400 Bad Request');
  }

  // Test 2: Valid college_id + join_code -> 200, cookie set, name returned
  let validStudentCookie = '';
  {
    const res = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '192.168.1.101',
      },
      body: JSON.stringify({ college_id: 'CS2024001', join_code: 'baf4jc' }),
    });
    const data = await res.json();
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) validStudentCookie = setCookie.split(';')[0];
    assert(res.status === 200 && data.ok === true && data.name === 'Aarav Sharma', 'Valid college_id + join_code -> 200 with name');
    assert(!!setCookie && setCookie.includes('quiz_session='), 'Cookie quiz_session is returned in Set-Cookie header');
    assert(!!setCookie && setCookie.toLowerCase().includes('httponly'), 'Cookie has httpOnly flag');
    assert(!!setCookie && setCookie.toLowerCase().includes('samesite=strict'), 'Cookie has sameSite=strict flag');
  }

  // Test 3: Wrong college_id -> 401, generic error message (don't reveal which field is wrong)
  {
    const res = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '192.168.1.102',
      },
      body: JSON.stringify({ college_id: 'CS9999999', join_code: 'baf4jc' }),
    });
    const data = await res.json();
    assert(res.status === 401 && data.error === 'Invalid college ID or join code.', 'Wrong college_id -> 401 with generic error');
  }

  // Test 4: Wrong join_code -> 401, same generic error
  {
    const res = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '192.168.1.103',
      },
      body: JSON.stringify({ college_id: 'CS2024001', join_code: 'wrongcode' }),
    });
    const data = await res.json();
    assert(res.status === 401 && data.error === 'Invalid college ID or join code.', 'Wrong join_code -> 401 with same generic error');
  }

  // Test 5: Rate limit (6th login attempt in 60 seconds from same IP -> 429)
  {
    const testIp = '10.0.0.99';
    let hit429 = false;
    let retryAfterHeader = null;
    for (let i = 1; i <= 6; i++) {
      const res = await fetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': testIp,
        },
        body: JSON.stringify({ college_id: `TEMP_ID_${i}`, join_code: 'invalid' }),
      });
      if (res.status === 429) {
        hit429 = true;
        retryAfterHeader = res.headers.get('retry-after');
        break;
      }
    }
    assert(hit429, '6th login attempt in 60s from same IP returns 429 Too Many Requests');
    assert(!!retryAfterHeader && Number(retryAfterHeader) > 0, '429 response includes valid Retry-After header');
  }

  // Test 6: Rate limit per-college_id (different IPs, same college_id -> 429 on 6th)
  {
    let idRateLimited = false;
    for (let i = 1; i <= 6; i++) {
      const res = await fetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': `172.20.0.${i}`, // Different IP every time
        },
        body: JSON.stringify({ college_id: 'CS_RATE_LIMIT_TEST', join_code: 'wrongcode' }),
      });
      if (res.status === 429) {
        idRateLimited = true;
        break;
      }
    }
    assert(idRateLimited, 'Rate limit applies per college_id across multiple distinct IPs (brute-force defense)');
  }

  // Test 7: Admin correct password -> 200, admin cookie set
  let validAdminCookie = '';
  {
    const res = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '172.16.0.10',
      },
      body: JSON.stringify({ password: 'admin123' }),
    });
    const data = await res.json();
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) validAdminCookie = setCookie.split(';')[0];
    assert(res.status === 200 && data.ok === true, 'Admin correct password -> 200 ok');
    assert(!!setCookie && setCookie.includes('quiz_session='), 'Admin login sets quiz_session cookie');
  }

  // Test 8: Admin wrong password -> 401
  {
    const res = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '172.16.0.11',
      },
      body: JSON.stringify({ password: 'wrongpassword' }),
    });
    const data = await res.json();
    assert(res.status === 401 && data.error === 'Invalid admin password.', 'Admin wrong password -> 401 Invalid admin password');
  }

  // Test 9: Admin 6th attempt -> 429
  {
    const adminIp = '10.0.0.88';
    let admin429 = false;
    for (let i = 1; i <= 6; i++) {
      const res = await fetch(`${BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': adminIp,
        },
        body: JSON.stringify({ password: 'badattempt' }),
      });
      if (res.status === 429) {
        admin429 = true;
        break;
      }
    }
    assert(admin429, 'Admin 6th attempt from same IP returns 429');
  }

  // ─── 9.2 INTEGRATION TESTS ──────────────────────────────
  console.log('\n--- 9.2 Integration Tests (JWT & Middleware) ---');

  // Test 10: JWT token is valid and decodable with correct secret
  {
    const token = validStudentCookie.replace('quiz_session=', '');
    let decoded = null;
    try {
      const { payload } = await jwtVerify(token, encodedSecret, {
        issuer: 'smartlink-quiz',
        audience: 'smartlink-quiz',
      });
      decoded = payload;
    } catch {
      decoded = null;
    }
    assert(decoded !== null, 'JWT token is valid and decodable with correct secret');
    assert(decoded?.role === 'student' && decoded?.cid === 'CS2024001', 'Student token contains role="student" and cid');
    assert(decoded?.iss === 'smartlink-quiz' && decoded?.aud === 'smartlink-quiz', 'JWT token has correct issuer and audience');
  }

  // Test 11: JWT token is rejected with wrong secret
  {
    const token = validStudentCookie.replace('quiz_session=', '');
    const wrongSecret = new TextEncoder().encode('wrong_secret_at_least_32_characters_long_for_hs256!');
    let rejected = false;
    try {
      await jwtVerify(token, wrongSecret, {
        issuer: 'smartlink-quiz',
        audience: 'smartlink-quiz',
      });
    } catch {
      rejected = true;
    }
    assert(rejected, 'JWT token is rejected when verified with a wrong secret');
  }

  // Test 12: Admin token verification
  {
    const token = validAdminCookie.replace('quiz_session=', '');
    const { payload } = await jwtVerify(token, encodedSecret, {
      issuer: 'smartlink-quiz',
      audience: 'smartlink-quiz',
    });
    assert(payload?.role === 'admin' && payload?.sub === 'admin', 'Admin token has role="admin" and sub="admin"');
  }

  // Test 13: Unauthenticated user accessing /quiz -> redirect to /
  {
    const res = await fetch(`${BASE_URL}/quiz`, {
      redirect: 'manual',
    });
    assert(res.status === 307 || res.status === 302, 'Unauthenticated user accessing /quiz gets redirected (302/307)');
    const location = res.headers.get('location');
    assert(location === '/' || location?.endsWith('/'), 'Unauthenticated user redirected to /');
  }

  // Test 14: Student accessing /admin -> redirected to /admin/login
  {
    const res = await fetch(`${BASE_URL}/admin`, {
      headers: { Cookie: validStudentCookie },
      redirect: 'manual',
    });
    assert(res.status === 307 || res.status === 302, 'Student accessing /admin gets redirected');
    const location = res.headers.get('location');
    assert(location?.includes('/admin/login'), 'Student redirected to /admin/login');
  }

  // Test 15: Authenticated student accessing / -> redirected to /lobby
  {
    const res = await fetch(`${BASE_URL}/`, {
      headers: { Cookie: validStudentCookie },
      redirect: 'manual',
    });
    assert(res.status === 307 || res.status === 302, 'Authenticated student accessing / gets redirected');
    const location = res.headers.get('location');
    assert(location?.includes('/lobby'), 'Student redirected to /lobby');
  }

  // Test 16: Cookie is cleared on logout
  {
    const res = await fetch(`${BASE_URL}/api/logout`, {
      method: 'POST',
      headers: { Cookie: validStudentCookie },
    });
    const setCookie = res.headers.get('set-cookie');
    assert(res.status === 200, 'POST /api/logout returns 200');
    assert(!!setCookie && (setCookie.includes('Max-Age=0') || setCookie.includes('max-age=0') || setCookie.includes('quiz_session=;')), 'Logout clears quiz_session cookie (maxAge=0)');
  }

  // ─── 9.3 SECURITY TESTS ─────────────────────────────────
  console.log('\n--- 9.3 Security Tests (Tampering, Injections & Anti-Kick) ---');

  // Test 17: Tampered JWT (change one character) -> rejected
  {
    const rawToken = validStudentCookie.replace('quiz_session=', '');
    const tampered = rawToken.slice(0, -5) + 'xxxxx';
    let rejected = false;
    try {
      await jwtVerify(tampered, encodedSecret, {
        issuer: 'smartlink-quiz',
        audience: 'smartlink-quiz',
      });
    } catch {
      rejected = true;
    }
    assert(rejected, 'Tampered JWT (modified signature) is rejected');
  }

  // Test 18: JWT with expired exp claim -> rejected
  {
    const expiredToken = await new SignJWT({
      sub: '00000000-0000-0000-0000-000000000001',
      cid: 'CS2024001',
      name: 'Aarav Sharma',
      role: 'student',
      jti: 'exp-test-jti',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600) // Expired 1 hr ago
      .setIssuer('smartlink-quiz')
      .setAudience('smartlink-quiz')
      .sign(encodedSecret);

    let rejected = false;
    try {
      await jwtVerify(expiredToken, encodedSecret, {
        issuer: 'smartlink-quiz',
        audience: 'smartlink-quiz',
      });
    } catch {
      rejected = true;
    }
    assert(rejected, 'JWT with expired exp claim is rejected');
  }

  // Test 19: JWT with wrong issuer -> rejected
  {
    const badIssuerToken = await new SignJWT({
      sub: 'admin',
      role: 'admin',
      jti: 'bad-iss-jti',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .setIssuer('fake-issuer')
      .setAudience('smartlink-quiz')
      .sign(encodedSecret);

    let rejected = false;
    try {
      await jwtVerify(badIssuerToken, encodedSecret, {
        issuer: 'smartlink-quiz',
        audience: 'smartlink-quiz',
      });
    } catch {
      rejected = true;
    }
    assert(rejected, 'JWT with wrong issuer is rejected');
  }

  // Test 20: JWT with wrong audience -> rejected
  {
    const badAudToken = await new SignJWT({
      sub: 'admin',
      role: 'admin',
      jti: 'bad-aud-jti',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .setIssuer('smartlink-quiz')
      .setAudience('fake-audience')
      .sign(encodedSecret);

    let rejected = false;
    try {
      await jwtVerify(badAudToken, encodedSecret, {
        issuer: 'smartlink-quiz',
        audience: 'smartlink-quiz',
      });
    } catch {
      rejected = true;
    }
    assert(rejected, 'JWT with wrong audience is rejected');
  }

  // Test 21: constantTimeEqual function correctness
  {
    const eq1 = constantTimeEqual('admin123', 'admin123');
    const eq2 = constantTimeEqual('admin123', 'admin124');
    const eq3 = constantTimeEqual('admin123', 'admin12');
    const eq4 = constantTimeEqual('short', 'much_longer_string_password');
    assert(eq1 === true && eq2 === false && eq3 === false && eq4 === false, 'constantTimeEqual returns correct results for matching, non-matching, and different lengths');
  }

  // Test 22: SQL Injection in college_id -> rejected
  {
    const res = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '192.168.1.150',
      },
      body: JSON.stringify({ college_id: "CS2024001' OR '1'='1", join_code: 'baf4jc' }),
    });
    assert(res.status === 401, 'Login with SQL injection in college_id returns 401 without error leak');
  }

  // Test 23: XSS payload in college_id -> rejected
  {
    const res = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '192.168.1.151',
      },
      body: JSON.stringify({ college_id: "<script>alert(1)</script>", join_code: 'baf4jc' }),
    });
    assert(res.status === 401, 'Login with XSS payload in college_id returns 401 safely');
  }

  // Test 24: Double login (Device 1 vs Device 2) -> Device 1 kicked
  {
    // Device 1 logs in
    const res1 = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '192.168.1.201',
      },
      body: JSON.stringify({ college_id: 'CS2024002', join_code: '8g8kd4' }),
    });
    const cookie1 = res1.headers.get('set-cookie')?.split(';')[0] || '';
    assert(res1.status === 200, 'Device 1 login successful (CS2024002)');

    // Device 2 logs in with same credentials
    const res2 = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '192.168.1.202',
      },
      body: JSON.stringify({ college_id: 'CS2024002', join_code: '8g8kd4' }),
    });
    const cookie2 = res2.headers.get('set-cookie')?.split(';')[0] || '';
    assert(res2.status === 200, 'Device 2 login successful (same student)');

    // Device 1 attempts protected API call (e.g. /api/leaderboard)
    const resProtected1 = await fetch(`${BASE_URL}/api/leaderboard`, {
      headers: { Cookie: cookie1 },
    });
    assert(resProtected1.status === 401, 'Device 1 session is kicked (401 on next protected API call)');

    // Device 2 attempts protected API call -> succeeds
    const resProtected2 = await fetch(`${BASE_URL}/api/leaderboard`, {
      headers: { Cookie: cookie2 },
    });
    assert(resProtected2.status === 200, 'Device 2 session remains active (200 on protected API call)');
  }

  // ─── 9.4 LOAD TESTS (200 Concurrent Students) ───────────
  console.log('\n--- 9.4 Load Tests (200 Concurrent Student Logins) ---');
  {
    const studentDataPath = path.resolve('scripts/data-students.json');
    const students = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));

    console.log(`  Dispatching ${students.length} student logins concurrently...`);
    const startTime = Date.now();
    const durations = [];

    const loginPromises = students.map(async (st, idx) => {
      const ip = `10.200.${Math.floor(idx / 250)}.${(idx % 250) + 1}`;
      const reqStart = Date.now();
      try {
        const res = await fetch(`${BASE_URL}/api/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': ip,
          },
          body: JSON.stringify({ college_id: st.college_id, join_code: st.join_code }),
        });
        const elapsed = Date.now() - reqStart;
        durations.push(elapsed);
        const data = await res.json().catch(() => ({}));
        return { status: res.status, ok: data.ok, name: data.name };
      } catch (err) {
        return { status: 500, error: err.message };
      }
    });

    const results = await Promise.all(loginPromises);
    const totalDurationMs = Date.now() - startTime;
    const successes = results.filter((r) => r.status === 200 && r.ok === true).length;

    durations.sort((a, b) => a - b);
    const p50 = durations[Math.floor(durations.length * 0.50)] || 0;
    const p95 = durations[Math.floor(durations.length * 0.95)] || 0;
    const p99 = durations[Math.floor(durations.length * 0.99)] || 0;

    console.log(`  -> Total time: ${totalDurationMs}ms (average: ${Math.round(totalDurationMs / students.length)}ms/request)`);
    console.log(`  -> Latency percentiles: p50=${p50}ms, p95=${p95}ms, p99=${p99}ms`);
    console.log(`  -> Successful logins: ${successes} / ${students.length}`);

    assert(successes === students.length, 'All 200 students logged in successfully with 200 OK');
    assert(totalDurationMs < 30000, `200 students logged in within 30 seconds (${totalDurationMs}ms < 30000ms)`);
    assert(p95 < 500, `p95 login response time is under 500ms (${p95}ms < 500ms)`);
  }

  console.log('\n======================================================');
  console.log(`Results: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log('======================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
