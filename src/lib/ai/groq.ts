import { GENERATE_QUESTIONS_PROMPT } from './prompts';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

export async function generateQuestionsWithGroq(params: {
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  count: number;
}): Promise<any[]> {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const prompt = GENERATE_QUESTIONS_PROMPT
    .replace('{topic}', params.topic)
    .replace('{difficulty}', params.difficulty)
    .replace('{count}', params.count.toString());

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq API error (${res.status})`);
  }

  const data = await res.json();
  const content = data.choices[0]?.message?.content;
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : parsed.questions || [];
}
