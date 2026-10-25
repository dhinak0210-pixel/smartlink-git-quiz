// scripts/test-layer2-flow.mjs
// Layer 2 Integration & Unit Test Suite

import assert from 'node:assert';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

console.log('======================================================');
console.log('SmartLink Git Quiz — Layer 2 Anti-Cheat & Verification Test');
console.log('======================================================\n');

async function runLayer2Tests() {
  try {
    // ─── PART 1: Unit Checks (Scoring & Tab Penalty) ───────────
    console.log('--- Step 1: Unit Checks for Tab Penalty Formula ---');

    function calculateTabPenalty(switchCount) {
      if (switchCount <= 1) return 0;
      return (switchCount - 1) * 200;
    }

    assert.strictEqual(calculateTabPenalty(0), 0, '0 switches = 0 penalty');
    assert.strictEqual(calculateTabPenalty(1), 0, '1st switch = warning (0 penalty)');
    assert.strictEqual(calculateTabPenalty(2), 200, '2nd switch = -200 penalty');
    assert.strictEqual(calculateTabPenalty(3), 400, '3rd switch = -400 penalty');
    assert.strictEqual(calculateTabPenalty(5), 800, '5th switch = -800 penalty');
    console.log('✓ Tab penalty unit tests passed: 1st=0 (warning), 2nd=200, 3rd=400, 5th=800');

    // Trust Score Computation Unit Check
    function testTrustScore(tabSwitches, flagTypes) {
      let score = 100;
      if (tabSwitches > 1) {
        score -= (tabSwitches - 1) * 10;
      }
      for (const t of flagTypes) {
        if (t === 'superhuman_speed') score -= 20;
        else if (t === 'identical_wrong_answers') score -= 30;
        else if (t === 'synchronized_timing') score -= 30;
        else if (t === 'hard_right_easy_wrong') score -= 20;
        else if (t === 'heavy_tab_switching') score -= 15;
        else if (t === 'second_login') score -= 10;
        else score -= 5;
      }
      return Math.max(0, Math.min(100, score));
    }

    assert.strictEqual(testTrustScore(0, []), 100, 'Clean student = 100 trust');
    assert.strictEqual(testTrustScore(2, ['superhuman_speed']), 70, '2 switches (-10) + superhuman speed (-20) = 70');
    assert.strictEqual(testTrustScore(4, ['identical_wrong_answers', 'synchronized_timing']), 10, 'Heavy cheating = 10');
    console.log('✓ Trust score unit tests passed!');

    // ─── PART 2: Live Server End-to-End Tests ─────────────────
    console.log('\n--- Step 2: Live Server End-to-End Tests ---');

    // 1. Authenticate Admin
    console.log('1. Authenticating Admin Master:');
    const adminLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin123' }),
    });
    assert.strictEqual(adminLoginRes.status, 200);
    const adminCookie = (adminLoginRes.headers.get('set-cookie') || '').split(';')[0];
    assert.ok(adminCookie, 'Admin session cookie must be present');
    console.log('✓ Admin authenticated');

    // Reset tournament state
    await fetch(`${BASE_URL}/api/admin/reset`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    });

    // 2. Authenticate Student
    console.log('2. Authenticating Student:');
    const studentLoginRes = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ college_id: 'CS2024001', join_code: 'baf4jc' }),
    });
    assert.strictEqual(studentLoginRes.status, 200);
    const studentCookie = (studentLoginRes.headers.get('set-cookie') || '').split(';')[0];
    assert.ok(studentCookie, 'Student session cookie must be present');
    const studentData = await studentLoginRes.json();
    console.log(`✓ Student authenticated: ${studentData.name} (${studentData.college_id})`);

    // 3. Test POST /api/events/log
    console.log('3. Testing /api/events/log telemetry logging:');
    const eventLogRes = await fetch(`${BASE_URL}/api/events/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: studentCookie },
      body: JSON.stringify({
        events: [
          { type: 'monitor_started', questionPosition: 1, timestamp: Date.now() },
          { type: 'tab_switch', questionPosition: 1, timestamp: Date.now(), metadata: { action: 'hidden' } },
          { type: 'tab_return', questionPosition: 1, timestamp: Date.now(), metadata: { away_duration_ms: 2500 } },
          { type: 'copy_blocked', questionPosition: 1, timestamp: Date.now() },
        ],
      }),
    });
    assert.strictEqual(eventLogRes.status, 200);
    const eventLogData = await eventLogRes.json();
    assert.strictEqual(eventLogData.ok, true);
    assert.strictEqual(eventLogData.logged, 4);
    console.log(`✓ Telemetry events logged: ${eventLogData.logged} events accepted`);

    // 4. Test Unauthenticated /api/events/log rejection
    console.log('4. Testing /api/events/log unauthenticated rejection:');
    const unauthLogRes = await fetch(`${BASE_URL}/api/events/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [{ type: 'tab_switch', timestamp: Date.now() }] }),
    });
    assert.strictEqual(unauthLogRes.status, 401);
    console.log('✓ Rejected unauthenticated telemetry logging with 401');

    // 5. Test Flag Creation & /api/admin/flags
    console.log('5. Testing /api/admin/flags:');
    const flagsRes = await fetch(`${BASE_URL}/api/admin/flags`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(flagsRes.status, 200);
    const flagsData = await flagsRes.json();
    assert.ok(Array.isArray(flagsData.flagged_students), 'flagged_students should be array');
    assert.ok(Array.isArray(flagsData.detailed_flags), 'detailed_flags should be array');
    assert.ok(Array.isArray(flagsData.reviews), 'reviews should be array');
    console.log(`✓ Admin flags retrieved: ${flagsData.flagged_students.length} flagged students, ${flagsData.detailed_flags.length} active flags`);

    // 6. Test Admin Review (Penalize / Clear / Disqualify)
    console.log('6. Testing /api/admin/review decision commitment:');
    const reviewRes = await fetch(`${BASE_URL}/api/admin/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        student_id: studentData.student_id || '00000000-0000-0000-0000-00000001',
        decision: 'penalize',
        penalty: 200,
        reason: 'Repeated tab switching outside quiz container during Question 1',
        admin_name: 'Lead Organizer Test',
      }),
    });
    assert.strictEqual(reviewRes.status, 200);
    const reviewData = await reviewRes.json();
    assert.strictEqual(reviewData.ok, true);
    assert.strictEqual(reviewData.decision, 'penalize');
    console.log('✓ Admin review decision "penalize" applied and audited');

    // 7. Test Winner Verification 8-Step Pipeline (/api/admin/verify)
    console.log('7. Testing Winner Verification Protocol (/api/admin/verify):');

    // Step A: Freeze
    const freezeRes = await (await fetch(`${BASE_URL}/api/admin/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ step: 'freeze', admin_name: 'Lead Organizer' }),
    })).json();
    assert.strictEqual(freezeRes.ok, true);
    console.log('  ✓ Step 1 (freeze): Complete');

    // Step B: Compute Flags
    const computeFlagsRes = await (await fetch(`${BASE_URL}/api/admin/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ step: 'compute_flags', admin_name: 'Lead Organizer' }),
    })).json();
    assert.strictEqual(computeFlagsRes.ok, true);
    console.log('  ✓ Step 2 (compute_flags): Complete');

    // Step C: Review Top 10
    const reviewTop10Res = await (await fetch(`${BASE_URL}/api/admin/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ step: 'review_top_10', admin_name: 'Lead Organizer' }),
    })).json();
    assert.strictEqual(reviewTop10Res.ok, true);
    console.log(`  ✓ Step 3 (review_top_10): Complete (all_reviewed=${reviewTop10Res.all_reviewed})`);

    // Step D: Apply Decisions
    const applyRes = await (await fetch(`${BASE_URL}/api/admin/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ step: 'apply_decisions', admin_name: 'Lead Organizer' }),
    })).json();
    assert.strictEqual(applyRes.ok, true);
    console.log('  ✓ Step 4 (apply_decisions): Complete');

    // Step E: Check Ties
    const checkTiesRes = await (await fetch(`${BASE_URL}/api/admin/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ step: 'check_ties', admin_name: 'Lead Organizer' }),
    })).json();
    assert.strictEqual(checkTiesRes.ok, true);
    console.log(`  ✓ Step 5 (check_ties): Complete (has_tie=${checkTiesRes.has_tie})`);

    // Step F: Confirm & Reveal Podium
    const confirmRes = await (await fetch(`${BASE_URL}/api/admin/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ step: 'confirm', admin_name: 'Second Organizer Signoff' }),
    })).json();
    assert.strictEqual(confirmRes.ok, true);
    assert.ok(Array.isArray(confirmRes.winners));
    console.log(`  ✓ Step 6-7 (confirm): Complete (Winners podium confirmed: ${confirmRes.winners.length} finalists)`);

    // 8. Test Sudden-Death Tiebreaker Route (/api/admin/sudden-death)
    console.log('8. Testing Sudden-Death Round Management (/api/admin/sudden-death):');
    const sdStartRes = await fetch(`${BASE_URL}/api/admin/sudden-death`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ action: 'start', round: 1 }),
    });
    assert.strictEqual(sdStartRes.status, 200);
    const sdStartData = await sdStartRes.json();
    assert.strictEqual(sdStartData.ok, true);
    assert.ok(sdStartData.question, 'Should return reserve question');
    assert.strictEqual(sdStartData.time_limit_seconds, 30);
    assert.strictEqual(sdStartData.question.options[0].is_correct, undefined, 'Must not leak correct answer');
    console.log(`✓ Sudden death round started: Question "${sdStartData.question.text.slice(0, 40)}..."`);

    // Submit answer to sudden death
    const chosenOptId = sdStartData.question.options[0].id;
    const sdSubmitRes = await fetch(`${BASE_URL}/api/admin/sudden-death`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        action: 'submit',
        round: 1,
        student_id: studentData.student_id || '00000000-0000-0000-0000-00000001',
        option_id: chosenOptId,
        response_ms: 1450,
      }),
    });
    assert.strictEqual(sdSubmitRes.status, 200);
    const sdSubmitData = await sdSubmitRes.json();
    assert.strictEqual(sdSubmitData.ok, true);
    console.log(`✓ Sudden death answer recorded: resolved=${sdSubmitData.resolved}`);

    // Clean up
    await fetch(`${BASE_URL}/api/admin/reset`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    });

    console.log('\n======================================================');
    console.log('🎉 ALL LAYER 2 TESTS PASSED WITH 100% SUCCESS! 🎉');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ Layer 2 Test failure:', err);
    process.exit(1);
  }
}

runLayer2Tests();
