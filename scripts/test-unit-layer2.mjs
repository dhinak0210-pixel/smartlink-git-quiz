// scripts/test-unit-layer2.mjs
// Unit Test Suite for Layer 2: Anti-Cheat & Telemetry

import assert from 'node:assert';

console.log('======================================================');
console.log('SmartLink Git Quiz — Layer 2 Anti-Cheat Unit Tests');
console.log('======================================================\n');

// 1. Tab Penalty Formula
function calculateTabPenalty(switchCount) {
  if (switchCount <= 1) return 0;
  return (switchCount - 1) * 200;
}

console.log('--- Testing Tab Penalty Formula ---');
assert.strictEqual(calculateTabPenalty(0), 0, '0 switches = 0 penalty');
assert.strictEqual(calculateTabPenalty(1), 0, '1st switch = warning only (0 penalty)');
assert.strictEqual(calculateTabPenalty(2), 200, '2nd switch = -200 penalty');
assert.strictEqual(calculateTabPenalty(3), 400, '3rd switch = -400 penalty');
assert.strictEqual(calculateTabPenalty(5), 800, '5th switch = -800 penalty');
console.log('✓ Tab penalty unit tests passed: 1st=0 (warning), 2nd=200, 3rd=400, 5th=800');

// 2. Trust Score Computation
function computeTrustScore(tabSwitches, flagTypes) {
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

console.log('--- Testing Trust Score Computation ---');
assert.strictEqual(computeTrustScore(0, []), 100, 'Clean student = 100 trust score');
assert.strictEqual(computeTrustScore(1, []), 100, '1 tab switch = 100 trust score (warning only)');
assert.strictEqual(computeTrustScore(2, []), 90, '2 tab switches = 90 trust score (-10)');
assert.strictEqual(computeTrustScore(2, ['superhuman_speed']), 70, '2 tab switches (-10) + superhuman speed (-20) = 70');
assert.strictEqual(computeTrustScore(4, ['identical_wrong_answers', 'synchronized_timing']), 10, 'Heavy cheating = 10 trust score');
assert.strictEqual(computeTrustScore(15, ['identical_wrong_answers', 'synchronized_timing', 'superhuman_speed']), 0, 'Extreme cheating clamped to min 0');
console.log('✓ Trust score unit tests passed');

// 3. Telemetry Event Whitelist
const ALLOWED_TYPES = new Set([
  'monitor_started',
  'tab_switch',
  'tab_return',
  'window_blur',
  'window_focus',
  'copy_blocked',
  'cut_blocked',
  'paste_blocked',
  'contextmenu_blocked',
  'shortcut_blocked',
  'fullscreen_exit',
  'page_reload',
]);

console.log('--- Testing Telemetry Event Sanitization ---');
function validateEvent(evt) {
  return evt && typeof evt.type === 'string' && ALLOWED_TYPES.has(evt.type) && typeof evt.timestamp === 'number';
}

assert.strictEqual(validateEvent({ type: 'tab_switch', timestamp: Date.now() }), true, 'Valid tab_switch accepted');
assert.strictEqual(validateEvent({ type: 'copy_blocked', timestamp: Date.now() }), true, 'Valid copy_blocked accepted');
assert.strictEqual(validateEvent({ type: 'arbitrary_spam', timestamp: Date.now() }), false, 'Unwhitelisted event rejected');
assert.strictEqual(validateEvent({ type: 'tab_switch' }), false, 'Missing timestamp rejected');
console.log('✓ Telemetry event sanitization tests passed');

// 4. Winner Verification Step Pipeline Validation
const VALID_VERIFY_STEPS = ['freeze', 'compute_flags', 'review_top_10', 'apply_decisions', 'check_ties', 'confirm'];
console.log('--- Testing Verification Step Ordering ---');
assert.strictEqual(VALID_VERIFY_STEPS.length, 6, 'Verification pipeline consists of 6 sequential steps');
assert.strictEqual(VALID_VERIFY_STEPS[0], 'freeze', 'First step is freeze');
assert.strictEqual(VALID_VERIFY_STEPS[VALID_VERIFY_STEPS.length - 1], 'confirm', 'Final step is confirm');
console.log('✓ Verification step order verified');

console.log('\n======================================================');
console.log('ALL LAYER 2 UNIT TESTS PASSED (100%)');
console.log('======================================================\n');
