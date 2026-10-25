// src/app/api/practice/submit-answer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  calculateNewRatings,
  difficultyToElo,
  INITIAL_RATING
} from '@/lib/practice/elo';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.question_id || !body.option_id) {
      return NextResponse.json({ error: 'missing_required_fields' }, { status: 400 });
    }

    const { question_id, option_id } = body;
    const currentRating = typeof body.current_rating === 'number' ? body.current_rating : INITIAL_RATING;
    const answerCount = typeof body.answer_count === 'number' ? body.answer_count : 0;

    // 1. Fetch question and options to check correctness
    let questionRow: any = null;
    let optionsList: any[] = [];

    const { data: qData } = await supabaseAdmin
      .from('questions')
      .select('id, difficulty, topic, explanation')
      .eq('id', question_id)
      .maybeSingle();

    if (qData) {
      questionRow = qData;
      const { data: optData } = await supabaseAdmin
        .from('options')
        .select('id, question_id, is_correct, text, label')
        .eq('question_id', question_id);
      optionsList = optData || [];
    } else {
      // Fallback to local questions asset
      const qPath = path.join(process.cwd(), 'scripts', 'data-questions.json');
      if (fs.existsSync(qPath)) {
        const parsed = JSON.parse(fs.readFileSync(qPath, 'utf8'));
        const found = parsed.find((item: any) => item.id === question_id);
        if (found) {
          questionRow = {
            id: found.id,
            difficulty: found.difficulty,
            topic: found.topic,
            explanation: found.explanation
          };
          optionsList = found.options.map((opt: any) => ({
            id: opt.id,
            question_id: found.id,
            is_correct: opt.is_correct,
            text: opt.text,
            label: opt.label
          }));
        }
      }
    }

    if (!questionRow || optionsList.length === 0) {
      return NextResponse.json({ error: 'question_not_found' }, { status: 404 });
    }

    const correctOption = optionsList.find((opt) => opt.is_correct);
    const chosenOption = optionsList.find((opt) => opt.id === option_id);

    if (!chosenOption) {
      return NextResponse.json({ error: 'invalid_option_id' }, { status: 400 });
    }

    const isCorrect = Boolean(chosenOption.is_correct);
    const questionRating = difficultyToElo(questionRow.difficulty);

    // Calculate Elo update
    const eloResult = calculateNewRatings(
      currentRating,
      questionRating,
      isCorrect,
      answerCount
    );

    return NextResponse.json({
      is_correct: isCorrect,
      correct_option_id: correctOption ? correctOption.id : null,
      correct_label: correctOption ? correctOption.label : null,
      new_rating: eloResult.newPlayerRating,
      rating_delta: eloResult.playerDelta,
      expected_win_rate: eloResult.expectedScore,
      explanation: questionRow.explanation,
      topic: questionRow.topic
    });
  } catch (err: any) {
    console.error('Practice submit-answer error:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
