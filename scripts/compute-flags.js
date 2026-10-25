/**
 * SmartLink Git Quiz — Post-Quiz Statistical Flag & Trust Score Computation
 * Run AFTER the quiz ends, BEFORE admin review.
 * Computes all statistical flags and populates the flags table.
 * 
 * Usage: node scripts/compute-flags.js --url http://localhost:3000
 */

const http = require('http');
const https = require('https');

const args = process.argv.slice(2);
let targetUrl = 'http://localhost:3000';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url' && args[i + 1]) targetUrl = args[i + 1];
}

const client = targetUrl.startsWith('https') ? https : http;

function makeRequest(urlPath, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(urlPath, targetUrl);
    const options = {
      hostname: fullUrl.hostname,
      port: fullUrl.port || (targetUrl.startsWith('https') ? 443 : 80),
      path: fullUrl.pathname + fullUrl.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      timeout: 15000,
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed || data,
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

const THRESHOLDS = {
  SUPERHUMAN_SPEED_MS: 2000,
  SUPERHUMAN_SPEED_COUNT: 3,
  HARD_EASY_ACCURACY_GAP: 0.4,
  IDENTICAL_WRONG_COUNT: 3,
  SYNC_TIMING_MS: 1000,
  SYNC_TIMING_QUESTIONS: 5,
  HEAVY_TAB_SWITCHES: 3,
  HEAVY_AWAY_MS: 30000,
};

async function run() {
  console.log('🔍 Connecting to server at:', targetUrl);

  // Authenticate admin
  const loginRes = await makeRequest('/api/admin/login', 'POST', { password: 'admin123' });
  if (loginRes.statusCode !== 200) {
    throw new Error('Admin authentication failed');
  }
  const cookieHeader = loginRes.headers['set-cookie'];
  const adminCookie = (Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader || '').split(';')[0];

  console.log('✅ Admin session verified. Triggering statistical flag analysis...');

  // Step 2 of verify route triggers computation audit
  const verifyRes = await makeRequest(
    '/api/admin/verify',
    'POST',
    { step: 'compute_flags', admin_name: 'Flag Engine' },
    { Cookie: adminCookie }
  );

  console.log(`\n📊 Flag Computation Status:`, verifyRes.data);
  console.log(`   Registered active flags in database: ${verifyRes.data?.total_flags ?? 0}`);
  console.log('✅ Post-quiz flag analysis complete. Ready for Organizer Review.');
}

run().catch((err) => {
  console.error('Computation error:', err);
  process.exit(1);
});
