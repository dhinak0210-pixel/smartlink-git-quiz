// scripts/compute-flags.ts
// Run AFTER the quiz ends, BEFORE admin review.
// Computes all statistical flags and inserts them into the flags table.
// Run: npx tsx scripts/compute-flags.ts or node scripts/compute-flags.js

import { getSupabaseAdmin } from '../src/lib/supabase-server';

const supabase = getSupabaseAdmin();

// ─── Thresholds (calibrate from dry-run data!) ─────────

export const THRESHOLDS = {
  SUPERHUMAN_SPEED_MS: 2000, // Correct in < 2s
  SUPERHUMAN_SPEED_COUNT: 3, // On 3+ questions
  HARD_EASY_ACCURACY_GAP: 0.4, // 40% gap between hard and easy accuracy
  IDENTICAL_WRONG_COUNT: 3, // 3+ identical wrong answers between two students
  SYNC_TIMING_MS: 1000, // Within 1 second of each other
  SYNC_TIMING_QUESTIONS: 5, // On 5+ questions
  HEAVY_TAB_SWITCHES: 3, // 3+ tab switches
  HEAVY_AWAY_MS: 30_000, // 30+ seconds total away time
};

export interface StudentAnswers {
  student_id: string;
  name: string;
  college_id: string;
  answers: {
    question_id: string;
    position: number;
    option_id: string;
    option_text: string;
    is_correct: boolean;
    response_ms: number;
    points: number;
    difficulty: string;
  }[];
  events: {
    type: string;
    metadata: any;
    created_at: string;
  }[];
}

export async function computeFlags() {
  console.log('🔍 Starting flag computation...');

  // 1. Fetch all student data
  const { data: students } = await supabase
    .from('students')
    .select('id, name, college_id')
    .eq('is_active', true);

  if (!students || students.length === 0) {
    console.log('No students found.');
    return { flags: [], students_flagged: 0 };
  }

  const studentData: StudentAnswers[] = [];

  for (const student of students) {
    const { data: answers } = await supabase
      .from('answers')
      .select(`
        question_id,
        position,
        option_id,
        is_correct,
        response_ms,
        points,
        options (text),
        questions (difficulty)
      `)
      .eq('student_id', student.id);

    const { data: events } = await supabase
      .from('events')
      .select('type, metadata, created_at')
      .eq('student_id', student.id);

    studentData.push({
      student_id: student.id,
      name: student.name,
      college_id: student.college_id,
      answers: (answers ?? []).map((a: any) => ({
        question_id: a.question_id,
        position: a.position,
        option_id: a.option_id,
        option_text: (a.options as any)?.text ?? '',
        is_correct: a.is_correct,
        response_ms: a.response_ms,
        points: a.points,
        difficulty: (a.questions as any)?.difficulty ?? 'unknown',
      })),
      events: (events as any[]) ?? [],
    });
  }

  const allFlags: any[] = [];

  // 2. Compute flags per student
  for (const student of studentData) {
    // ─── Flag: Superhuman Speed ──────────────────────
    const fastCorrect = student.answers.filter(
      (a) => a.is_correct && a.response_ms < THRESHOLDS.SUPERHUMAN_SPEED_MS
    );

    if (fastCorrect.length >= THRESHOLDS.SUPERHUMAN_SPEED_COUNT) {
      allFlags.push({
        student_id: student.student_id,
        flag_type: 'superhuman_speed',
        severity: 'warning',
        evidence: {
          count: fastCorrect.length,
          questions: fastCorrect.map((a) => ({
            position: a.position,
            response_ms: a.response_ms,
          })),
          threshold: THRESHOLDS.SUPERHUMAN_SPEED_MS,
        },
        score_penalty: 0, // Penalty is via trust score, not direct deduction
      });
    }

    // ─── Flag: Hard-Right, Easy-Wrong ────────────────
    const easyAnswers = student.answers.filter((a) => a.difficulty === 'easy');
    const hardAnswers = student.answers.filter((a) => a.difficulty === 'hard');

    if (easyAnswers.length > 0 && hardAnswers.length > 0) {
      const easyAccuracy =
        easyAnswers.filter((a) => a.is_correct).length / easyAnswers.length;
      const hardAccuracy =
        hardAnswers.filter((a) => a.is_correct).length / hardAnswers.length;

      if (hardAccuracy - easyAccuracy > THRESHOLDS.HARD_EASY_ACCURACY_GAP) {
        allFlags.push({
          student_id: student.student_id,
          flag_type: 'hard_right_easy_wrong',
          severity: 'warning',
          evidence: {
            easy_accuracy: Math.round(easyAccuracy * 100),
            hard_accuracy: Math.round(hardAccuracy * 100),
            gap: Math.round((hardAccuracy - easyAccuracy) * 100),
            threshold: THRESHOLDS.HARD_EASY_ACCURACY_GAP * 100,
          },
          score_penalty: 0,
        });
      }
    }

    // ─── Flag: Heavy Tab Switching ───────────────────
    const tabSwitches = student.events.filter((e) => e.type === 'tab_switch');
    const tabReturns = student.events.filter((e) => e.type === 'tab_return');
    const totalAwayMs = tabReturns.reduce(
      (sum, e) => sum + (e.metadata?.away_duration_ms ?? 0),
      0
    );

    if (
      tabSwitches.length >= THRESHOLDS.HEAVY_TAB_SWITCHES ||
      totalAwayMs >= THRESHOLDS.HEAVY_AWAY_MS
    ) {
      allFlags.push({
        student_id: student.student_id,
        flag_type: 'heavy_tab_switching',
        severity: tabSwitches.length >= 5 ? 'critical' : 'warning',
        evidence: {
          tab_switches: tabSwitches.length,
          total_away_ms: totalAwayMs,
          total_away_seconds: Math.round(totalAwayMs / 1000),
        },
        score_penalty: 0,
      });
    }

    // ─── Flag: Second Login ──────────────────────────
    const logins = student.events.filter((e) => e.type === 'login');
    const kicks = student.events.filter((e) => e.type === 'kick');

    if (kicks.length > 0 || logins.length > 1) {
      allFlags.push({
        student_id: student.student_id,
        flag_type: 'second_login',
        severity: 'info',
        evidence: {
          login_count: logins.length,
          kick_count: kicks.length,
        },
        score_penalty: 0,
      });
    }
  }

  // 3. Cross-student flags (comparing pairs)
  // ─── Flag: Identical Wrong Answers ─────────────────
  for (let i = 0; i < studentData.length; i++) {
    for (let j = i + 1; j < studentData.length; j++) {
      const a = studentData[i];
      const b = studentData[j];

      // Compare wrong answers by option TEXT (not letter, since options are shuffled)
      const aWrong = a.answers
        .filter((ans) => !ans.is_correct)
        .map((ans) => `${ans.question_id}:${ans.option_text}`);
      const bWrong = b.answers
        .filter((ans) => !ans.is_correct)
        .map((ans) => `${ans.question_id}:${ans.option_text}`);

      const sharedWrong = aWrong.filter((w) => bWrong.includes(w));

      if (sharedWrong.length >= THRESHOLDS.IDENTICAL_WRONG_COUNT) {
        // Flag both students
        for (const student of [a, b]) {
          allFlags.push({
            student_id: student.student_id,
            flag_type: 'identical_wrong_answers',
            severity: 'critical',
            evidence: {
              matched_with: student === a ? b.college_id : a.college_id,
              matched_name: student === a ? b.name : a.name,
              shared_wrong_count: sharedWrong.length,
              shared_questions: sharedWrong,
              threshold: THRESHOLDS.IDENTICAL_WRONG_COUNT,
            },
            score_penalty: 0,
          });
        }
      }

      // ─── Flag: Synchronized Timing ───────────────
      const commonQuestions = a.answers.filter((aAns) =>
        b.answers.some((bAns) => bAns.question_id === aAns.question_id)
      );

      let syncCount = 0;
      for (const aAns of commonQuestions) {
        const bAns = b.answers.find((bA) => bA.question_id === aAns.question_id);
        if (
          bAns &&
          Math.abs(aAns.response_ms - bAns.response_ms) < THRESHOLDS.SYNC_TIMING_MS
        ) {
          syncCount++;
        }
      }

      if (syncCount >= THRESHOLDS.SYNC_TIMING_QUESTIONS) {
        for (const student of [a, b]) {
          allFlags.push({
            student_id: student.student_id,
            flag_type: 'synchronized_timing',
            severity: 'critical',
            evidence: {
              matched_with: student === a ? b.college_id : a.college_id,
              matched_name: student === a ? b.name : a.name,
              sync_count: syncCount,
              threshold: THRESHOLDS.SYNC_TIMING_QUESTIONS,
            },
            score_penalty: 0,
          });
        }
      }
    }
  }

  // 4. Deduplicate flags (one flag per student per type)
  const seen = new Set<string>();
  const uniqueFlags = allFlags.filter((f) => {
    const key = `${f.student_id}:${f.flag_type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 5. Insert flags
  if (uniqueFlags.length > 0) {
    const { error } = await supabase.from('flags').insert(uniqueFlags);
    if (error) console.error('[ComputeFlags] Error inserting flags:', error);
  }

  // 6. Compute trust scores
  const { data: scores } = await supabase.rpc('compute_all_trust_scores');

  if (scores) {
    for (const score of scores as any[]) {
      await supabase.from('student_status').upsert({
        student_id: score.student_id,
        trust_score: score.trust_score,
        status: score.status,
        total_penalty: 0,
        flags_count: uniqueFlags.filter((f) => f.student_id === score.student_id).length,
      });
    }
  }

  // 7. Summary
  console.log(`\n📊 Flag Computation Complete:`);
  console.log(`   Total flags: ${uniqueFlags.length}`);
  console.log(
    `   Students flagged: ${new Set(uniqueFlags.map((f) => f.student_id)).size}`
  );
  console.log(
    `   Critical flags: ${
      uniqueFlags.filter((f) => f.severity === 'critical').length
    }`
  );
  console.log(
    `   Warning flags: ${
      uniqueFlags.filter((f) => f.severity === 'warning').length
    }`
  );
  console.log(
    `   Info flags: ${uniqueFlags.filter((f) => f.severity === 'info').length}`
  );

  const held = (scores as any[])?.filter((s) => s.status === 'held') ?? [];
  const review = (scores as any[])?.filter((s) => s.status === 'review') ?? [];
  console.log(`   Students held: ${held.length}`);
  console.log(`   Students needing review: ${review.length}`);

  return {
    flags: uniqueFlags,
    students_flagged: new Set(uniqueFlags.map((f) => f.student_id)).size,
    scores,
  };
}

if (typeof require !== 'undefined' && require.main === module) {
  computeFlags().catch(console.error);
}
