// scripts/load-test.k6.js
// Run: k6 run scripts/load-test.k6.js

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    login_wave: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 200 },  // 200 students login in 30s
        { duration: '10s', target: 200 },  // hold
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],     // <1% errors
    http_req_duration: ['p(95)<2000'],  // 95th percentile <2s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Pre-generate 200 student credentials
const students = Array.from({ length: 200 }, (_, i) => ({
  college_id: `CS2024${String(i + 1).padStart(3, '0')}`,
  join_code: `code${String(i + 1).padStart(3, '0')}`,
}));

export default function () {
  const student = students[__VU - 1];
  if (!student) return;

  // Login
  const loginRes = http.post(`${BASE_URL}/api/login`, JSON.stringify(student), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(loginRes, { 'login ok': (r) => r.status === 200 });

  const cookies = loginRes.cookies;

  // Answer 15 questions (simulated timing)
  for (let q = 1; q <= 15; q++) {
    sleep(25); // wait for question cycle

    const qRes = http.get(`${BASE_URL}/api/question/${q}`, { cookies });
    check(qRes, { [`q${q} ok`]: (r) => r.status === 200 });

    if (qRes.status === 200) {
      const data = qRes.json();
      const optionId = data.options[0].id; // pick first option

      const ansRes = http.post(
        `${BASE_URL}/api/answer`,
        JSON.stringify({ question_position: q, option_id: optionId }),
        { headers: { 'Content-Type': 'application/json' }, cookies }
      );
      check(ansRes, { [`a${q} ok`]: (r) => r.status === 200 || r.status === 409 });
    }
  }
}
