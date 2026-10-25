import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticatedAdmin } from '@/lib/auth/session';
import { generateQuestionsWithGemini } from '@/lib/ai/gemini';
import { generateQuestionsWithGroq } from '@/lib/ai/groq';
import { validateQuestion } from '@/lib/ai/validator';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await isAuthenticatedAdmin(req);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 });
    }

    const body = await req.json();
    const topic = body.topic || 'branching and merging';
    const difficulty = body.difficulty || 'medium';
    const count = Math.min(10, Math.max(1, Number(body.count) || 3));

    let questions: any[] = [];
    let provider = 'gemini';

    try {
      questions = await generateQuestionsWithGemini({ topic, difficulty, count });
    } catch (geminiErr: any) {
      console.warn('Gemini generation failed, trying Groq backup:', geminiErr.message);
      try {
        questions = await generateQuestionsWithGroq({ topic, difficulty, count });
        provider = 'groq';
      } catch (groqErr: any) {
        throw new Error(`AI generation failed on both providers. Gemini: ${geminiErr.message}; Groq: ${groqErr.message}`);
      }
    }

    // Auto-validate each generated question
    const validatedQuestions = await Promise.all(
      questions.map(async (q) => {
        const validation = await validateQuestion(q);
        return {
          ...q,
          is_valid: validation.is_valid,
          validation_issues: validation.issues,
          validation_suggestion: validation.suggestion,
        };
      })
    );

    return NextResponse.json({
      success: true,
      provider,
      questions: validatedQuestions,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Question generation failed' },
      { status: 500 }
    );
  }
}
