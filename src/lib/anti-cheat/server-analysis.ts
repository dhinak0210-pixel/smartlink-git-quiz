import { AntiCheatLog, Answer, Student } from '@/lib/utils/types';

export interface CheatReportItem {
  student_id: string;
  name: string;
  college_id: string;
  tab_switches: number;
  window_blurs: number;
  copy_attempts: number;
  rapid_answers: number;
  risk_level: 'low' | 'medium' | 'high';
  flags: string[];
}

export function analyzeAntiCheatTelemetry(
  students: Student[],
  answers: Answer[],
  logs: AntiCheatLog[]
): CheatReportItem[] {
  const studentMap = new Map<string, Student>(students.map((s) => [s.id, s]));
  const statsMap = new Map<
    string,
    {
      tab_switches: number;
      window_blurs: number;
      copy_attempts: number;
      rapid_answers: number;
      correct_count: number;
      flags: Set<string>;
    }
  >();

  // Initialize
  students.forEach((s) => {
    statsMap.set(s.id, {
      tab_switches: 0,
      window_blurs: 0,
      copy_attempts: 0,
      rapid_answers: 0,
      correct_count: 0,
      flags: new Set(),
    });
  });

  // Count logs
  logs.forEach((log) => {
    const stat = statsMap.get(log.student_id);
    if (!stat) return;

    if (log.event_type === 'tab_switch') stat.tab_switches++;
    if (log.event_type === 'window_blur') stat.window_blurs++;
    if (log.event_type === 'copy_attempt') stat.copy_attempts++;
    if (log.event_type === 'rapid_answer') stat.rapid_answers++;
    if (log.event_type === 'devtools_attempt') stat.flags.add('Opened DevTools');
  });

  // Correlate with answers
  answers.forEach((ans) => {
    const stat = statsMap.get(ans.student_id);
    if (!stat) return;
    if (ans.is_correct) stat.correct_count++;

    // Sub-1.5s answers that are correct
    if (ans.time_taken_ms < 1500 && ans.is_correct) {
      stat.rapid_answers++;
      stat.flags.add(`Instant answer on Q${ans.question_number} (${(ans.time_taken_ms / 1000).toFixed(1)}s)`);
    }
  });

  const results: CheatReportItem[] = [];

  statsMap.forEach((stat, studentId) => {
    const student = studentMap.get(studentId);
    if (!student) return;

    let riskScore = 0;
    if (stat.tab_switches >= 3) {
      riskScore += 2;
      stat.flags.add(`${stat.tab_switches} Tab switches`);
    }
    if (stat.window_blurs >= 4) {
      riskScore += 1;
      stat.flags.add(`${stat.window_blurs} Window blurs`);
    }
    if (stat.copy_attempts >= 1) {
      riskScore += 2;
      stat.flags.add('Copy/Paste attempted');
    }
    if (stat.rapid_answers >= 2) {
      riskScore += 3;
      stat.flags.add('Multiple suspiciously fast answers');
    }

    // High correlation: tab switches + high accuracy
    if (stat.tab_switches >= 2 && stat.correct_count >= 10) {
      riskScore += 2;
      stat.flags.add('High tab switches correlated with high score');
    }

    let risk_level: 'low' | 'medium' | 'high' = 'low';
    if (riskScore >= 4) risk_level = 'high';
    else if (riskScore >= 2) risk_level = 'medium';

    results.push({
      student_id: studentId,
      name: student.name,
      college_id: student.college_id,
      tab_switches: stat.tab_switches,
      window_blurs: stat.window_blurs,
      copy_attempts: stat.copy_attempts,
      rapid_answers: stat.rapid_answers,
      risk_level,
      flags: Array.from(stat.flags),
    });
  });

  return results.sort((a, b) => {
    const weight = { high: 3, medium: 2, low: 1 };
    return weight[b.risk_level] - weight[a.risk_level];
  });
}
