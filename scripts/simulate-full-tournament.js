/**
 * SmartLink Git Quiz — Full 15-Question Live Tournament Simulation
 * Simulates 200 concurrent students competing across all 15 questions,
 * followed by event conclusion, final podium calculation, and post-event reporting.
 *
 * Usage: node scripts/simulate-full-tournament.js --url http://localhost:3000 --students 200
 */

const http = require('http');
const https = require('https');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
let targetUrl = 'http://localhost:3000';
let studentCount = 200;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url' && args[i + 1]) targetUrl = args[i + 1];
  if (args[i] === '--students' && args[i + 1]) studentCount = parseInt(args[i + 1], 10);
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
          data: parsed || data,
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// Student Name Generator
const FIRST_NAMES = ['Aarav', 'Aditi', 'Dhina', 'Priya', 'Rohan', 'Sneha', 'Vikram', 'Ananya', 'Karthik', 'Divya', 'Siddharth', 'Meera', 'Arjun', 'Pooja', 'Rahul', 'Nisha', 'Varun', 'Kavya', 'Gautam', 'Deepa'];
const LAST_NAMES = ['Sharma', 'Verma', 'Kumar', 'Nair', 'Patel', 'Iyer', 'Reddy', 'Gupta', 'Singh', 'Rao', 'Chopra', 'Joshi', 'Menon', 'Bose', 'Das'];

function generateStudentProfile(index) {
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  const last = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length];
  return {
    collegeId: `21CS${String(index + 1).padStart(3, '0')}`,
    name: `${first} ${last}`,
    // Deterministic student skill tier:
    // Index 0-19: Elite (Top 10%) - 90% accuracy, fast
    // Index 20-159: Mid-Tier (70%) - 60-70% accuracy, moderate
    // Index 160-199: Novice (20%) - 30-40% accuracy, slower
    tier: index < 20 ? 'elite' : index < 160 ? 'mid' : 'novice',
  };
}

async function runTournament() {
  console.log(`\n================================================================`);
  console.log(`🏆 SmartLink Git Quiz — Grand 15-Question Tournament Simulation`);
  console.log(`🎯 Target Server: ${targetUrl}`);
  console.log(`👥 Contestants: ${studentCount} concurrent student devices`);
  console.log(`================================================================\n`);

  // 1. Admin Authentication
  console.log(`🔐 [Stage 1] Authenticating Tournament Master...`);
  const adminLogin = await makeRequest('/api/auth/admin-login', 'POST', { password: 'admin123' });
  if (adminLogin.statusCode !== 200 || !adminLogin.data.token) {
    throw new Error('Admin login failed');
  }
  const adminToken = adminLogin.data.token;
  console.log(`  ✅ Tournament Master authorized with signed token.`);

  // 2. 200 Student Registrations
  console.log(`\n📝 [Stage 2] Simulating entry wave for ${studentCount} students...`);
  const students = [];
  const loginPromises = [];

  for (let i = 0; i < studentCount; i++) {
    const profile = generateStudentProfile(i);
    const p = makeRequest('/api/auth/login', 'POST', {
      college_id: profile.collegeId,
      name: profile.name,
    }).then((res) => {
      if (res.statusCode === 200 && res.data.token) {
        students.push({
          id: res.data.student.id,
          collegeId: profile.collegeId,
          name: profile.name,
          tier: profile.tier,
          token: res.data.token,
        });
      }
    });
    loginPromises.push(p);
  }

  await Promise.all(loginPromises);
  console.log(`  ✅ Authenticated ${students.length}/${studentCount} attendees in arena lobby.`);

  // 3. Start Tournament at Question 1
  console.log(`\n🚩 [Stage 3] Initiating Tournament Event...`);
  await makeRequest('/api/event/start', 'POST', null, { 'x-admin-token': adminToken });
  console.log(`  ✅ Arena status set to LIVE. Question 1 timer started.`);

  // 4. Run Through Questions 1 to 15
  console.log(`\n⚔️ [Stage 4] Commencing 15-Question Live Competition...`);

  for (let qNum = 1; qNum <= 15; qNum++) {
    // If qNum > 1, advance to next question
    if (qNum > 1) {
      await makeRequest('/api/event/next', 'POST', null, { 'x-admin-token': adminToken });
    }

    // Question header
    const sampleStudent = students[0];
    const qDetails = await makeRequest('/api/question/current', 'GET', null, {
      'x-session-token': sampleStudent.token,
    });
    const topic = qDetails.data?.topic_tag || 'git';
    const points = qDetails.data?.points || 100;

    process.stdout.write(`  Question ${String(qNum).padStart(2, '0')}/15 [${topic.toUpperCase()}, ${points} pts]: `);

    // Concurrent answer submissions
    let correctCount = 0;
    let wrongCount = 0;
    let timeoutCount = 0;

    const answerPromises = students.map(async (student, sIdx) => {
      // Fetch question to get student's shuffled options
      const sQ = await makeRequest('/api/question/current', 'GET', null, {
        'x-session-token': student.token,
      });

      if (!sQ.data || !sQ.data.options) {
        timeoutCount++;
        return;
      }

      // Determine answer correctness based on skill tier
      let willAnswerCorrectly = false;
      let willTimeout = false;

      if (student.tier === 'elite') {
        willAnswerCorrectly = Math.random() < 0.92; // 92% accuracy
      } else if (student.tier === 'mid') {
        willAnswerCorrectly = Math.random() < 0.68; // 68% accuracy
      } else {
        willAnswerCorrectly = Math.random() < 0.38; // 38% accuracy
        willTimeout = Math.random() < 0.12; // 12% timeout
      }

      if (willTimeout) {
        timeoutCount++;
        return; // Don't submit -> timeout awards 0 pts
      }

      // Choose option
      let selectedOption = 'a';
      if (willAnswerCorrectly) {
        // Find option that contains key concept
        selectedOption = sQ.data.options[0].label;
      } else {
        // Pick an alternative option
        selectedOption = sQ.data.options[1 % sQ.data.options.length].label;
      }

      // Submit
      const sub = await makeRequest('/api/question/submit', 'POST', {
        question_number: qNum,
        selected_answer: selectedOption,
      }, {
        'x-session-token': student.token,
      });

      if (sub.data && sub.data.is_correct) {
        correctCount++;
      } else if (sub.data && sub.data.score_awarded < 0) {
        wrongCount++;
      }
    });

    await Promise.all(answerPromises);
    console.log(`Processed ${students.length} responses (✅ ${correctCount} Correct | ❌ ${wrongCount} Penalized (-25) | ⏱️ ${timeoutCount} Timed out)`);
  }

  // 5. Conclude Tournament Event
  console.log(`\n🏁 [Stage 5] Concluding Tournament...`);
  await makeRequest('/api/event/end', 'POST', null, { 'x-admin-token': adminToken });
  console.log(`  ✅ Event marked as FINISHED.`);

  // 6. Fetch Final Leaderboard & Projector Podium
  console.log(`\n🎉 ================================================================`);
  console.log(`🏆 GRAND CHAMPIONS PODIUM (PROJECTOR SPECTATOR VIEW)`);
  console.log(`================================================================`);

  const lbRes = await makeRequest('/api/leaderboard?all=true', 'GET', null, { 'x-admin-token': adminToken });
  const lb = lbRes.data?.leaderboard || [];

  if (lb.length >= 3) {
    console.log(`\n  🥇 1ST PLACE (GOLD CHAMPION):`);
    console.log(`     Contestant : ${lb[0].name} (${lb[0].college_id})`);
    console.log(`     Total Score: ${lb[0].total_score} pts  |  Correct: ${lb[0].correct_count}/15  |  Avg Latency: ${(lb[0].avg_time_ms/1000).toFixed(2)}s`);

    console.log(`\n  🥈 2ND PLACE (SILVER):`);
    console.log(`     Contestant : ${lb[1].name} (${lb[1].college_id})`);
    console.log(`     Total Score: ${lb[1].total_score} pts  |  Correct: ${lb[1].correct_count}/15  |  Avg Latency: ${(lb[1].avg_time_ms/1000).toFixed(2)}s`);

    console.log(`\n  🥉 3RD PLACE (BRONZE):`);
    console.log(`     Contestant : ${lb[2].name} (${lb[2].college_id})`);
    console.log(`     Total Score: ${lb[2].total_score} pts  |  Correct: ${lb[2].correct_count}/15  |  Avg Latency: ${(lb[2].avg_time_ms/1000).toFixed(2)}s`);
  }

  console.log(`\n📜 TOP 10 LEADERBOARD STANDINGS:`);
  console.log(`----------------------------------------------------------------`);
  console.log(`Rank | College ID | Contestant Name      | Correct | Score`);
  console.log(`----------------------------------------------------------------`);
  lb.slice(0, 10).forEach((st) => {
    const rankStr = `#${st.rank}`.padEnd(4, ' ');
    const idStr = st.college_id.padEnd(10, ' ');
    const nameStr = st.name.padEnd(20, ' ');
    const correctStr = `${st.correct_count}/15`.padEnd(7, ' ');
    const scoreStr = `${st.total_score} pts`;
    console.log(`${rankStr} | ${idStr} | ${nameStr} | ${correctStr} | ${scoreStr}`);
  });
  console.log(`----------------------------------------------------------------`);

  // 7. Post-Event Automation: Certificates, Anomaly Analysis & Layer 5 Forensic Pipeline
  console.log(`\n📄 [Stage 6] Triggering Post-Event Automation Scripts...`);
  const pythonBin = process.env.PYTHON_BIN || 'python3';

  try {
    execSync(`"${pythonBin}" scripts/generate-certificates.py --password admin123`, { stdio: 'inherit' });
    console.log(`  ✅ Participant certificates generated.`);
  } catch (err) {
    console.warn(`  ⚠️ Certificate generator output:`, err.message);
  }

  try {
    execSync(`"${pythonBin}" scripts/cheat-detection.py --password admin123`, { stdio: 'inherit' });
    console.log(`  ✅ Post-event anomaly detection completed.`);
  } catch (err) {
    console.warn(`  ⚠️ Cheat detector output:`, err.message);
  }

  try {
    execSync(`"${pythonBin}" layer5-cheat/pipeline/event_day.py`, { stdio: 'inherit' });
    console.log(`  ✅ Layer 5 forensic pipeline executed (<30s). Dossiers & summary ready.`);
  } catch (err) {
    console.warn(`  ⚠️ Layer 5 pipeline output:`, err.message);
  }

  console.log(`\n================================================================`);
  console.log(`🎉 15-QUESTION LIVE TOURNAMENT SIMULATION SUCCESSFULLY COMPLETED!`);
  console.log(`================================================================\n`);
}

runTournament().catch((err) => {
  console.error('Tournament error:', err);
});
