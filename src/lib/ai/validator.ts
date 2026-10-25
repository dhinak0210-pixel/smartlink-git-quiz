import { VALIDATE_QUESTION_PROMPT } from './prompts';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export interface QuestionValidationResult {
  is_valid: boolean;
  issues: string[];
  suggestion: string;
}

export async function validateQuestion(question: {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string;
}): Promise<QuestionValidationResult> {
  // Local Rule Heuristics
  const issues: string[] = [];
  if (!question.question_text || question.question_text.length < 10) {
    issues.push('Question text is too short or empty');
  }
  const options = [question.option_a, question.option_b, question.option_c, question.option_d];
  if (new Set(options).size !== 4) {
    issues.push('Options must be distinct from one another');
  }
  if (!['a', 'b', 'c', 'd'].includes(question.correct_answer?.toLowerCase())) {
    issues.push('Correct answer must be one of a, b, c, or d');
  }

  if (issues.length > 0) {
    return {
      is_valid: false,
      issues,
      suggestion: 'Fix syntax and option uniqueness before proceeding.',
    };
  }

  if (!GEMINI_API_KEY) {
    // If no key, rule heuristics passed
    return {
      is_valid: true,
      issues: [],
      suggestion: 'Passed rule-based checks: options are distinct and answer is valid.',
    };
  }

  try {
    const prompt = VALIDATE_QUESTION_PROMPT
      .replace('{question_text}', question.question_text)
      .replace('{option_a}', question.option_a)
      .replace('{option_b}', question.option_b)
      .replace('{option_c}', question.option_c)
      .replace('{option_d}', question.option_d)
      .replace('{correct_answer}', question.correct_answer)
      .replace('{explanation}', question.explanation || '');

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(rawText);
      return {
        is_valid: Boolean(parsed.is_valid),
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        suggestion: parsed.suggestion || 'None',
      };
    }
  } catch {
    // Fall back to rule heuristics
  }

  return {
    is_valid: true,
    issues: [],
    suggestion: 'Validated by heuristic syntax analyzer.',
  };
}
