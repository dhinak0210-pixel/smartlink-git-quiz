// src/app/api/practice/next-question/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  PracticeQuestion,
  selectBestQuestion,
  difficultyToElo,
  INITIAL_RATING
} from '@/lib/practice/elo';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const ratingParam = url.searchParams.get('rating');
    const playerRating = ratingParam ? parseInt(ratingParam, 10) : INITIAL_RATING;
    const seenParam = url.searchParams.get('seen') || '';
    const seenIds = new Set(seenParam.split(',').filter(Boolean));
    const topicFilter = url.searchParams.get('topic');

    // 1. Fetch questions and options from Supabase or local assets
    let rawQuestions: any[] = [];
    let rawOptions: any[] = [];

    const { data: qData } = await supabaseAdmin
      .from('questions')
      .select('id, text, difficulty, topic, explanation')
      .eq('is_active', true);

    if (qData && qData.length > 0) {
      rawQuestions = qData;
      const { data: optData } = await supabaseAdmin
        .from('options')
        .select('id, question_id, text, label');
      rawOptions = optData || [];
    } else {
      // Fallback to local questions asset
      const qPath = path.join(process.cwd(), 'scripts', 'data-questions.json');
      if (fs.existsSync(qPath)) {
        const parsed = JSON.parse(fs.readFileSync(qPath, 'utf8'));
        for (const item of parsed) {
          rawQuestions.push({
            id: item.id,
            text: item.text,
            difficulty: item.difficulty,
            topic: item.topic,
            explanation: item.explanation
          });
          for (const opt of item.options) {
            rawOptions.push({
              id: opt.id,
              question_id: item.id,
              text: opt.text,
              label: opt.label
            });
          }
        }
      }
    }

    // Apply optional topic filter
    if (topicFilter) {
      rawQuestions = rawQuestions.filter((q) => q.topic.toLowerCase() === topicFilter.toLowerCase());
    }

    if (rawQuestions.length === 0) {
      return NextResponse.json({ error: 'no_questions_available' }, { status: 404 });
    }

    // Map options by question
    const optionsMap = new Map<string, any[]>();
    for (const opt of rawOptions) {
      if (!optionsMap.has(opt.question_id)) {
        optionsMap.set(opt.question_id, []);
      }
      optionsMap.get(opt.question_id)!.push({
        id: opt.id,
        text: opt.text,
        label: opt.label
      });
    }

    const candidateQuestions: PracticeQuestion[] = rawQuestions.map((q) => ({
      id: q.id,
      text: q.text,
      difficulty: q.difficulty,
      topic: q.topic,
      explanation: q.explanation,
      rating: difficultyToElo(q.difficulty),
      options: optionsMap.get(q.id) || []
    }));

    // Select the best question matched to player Elo
    const selected = selectBestQuestion(playerRating, candidateQuestions, seenIds);

    if (!selected) {
      // All questions seen, reset seen pool
      const fallback = selectBestQuestion(playerRating, candidateQuestions, new Set());
      if (!fallback) {
        return NextResponse.json({ error: 'no_questions_left' }, { status: 404 });
      }
      return NextResponse.json({
        question: {
          id: fallback.id,
          text: fallback.text,
          difficulty: fallback.difficulty,
          topic: fallback.topic,
          rating: fallback.rating,
          options: fallback.options
        },
        has_reset: true
      });
    }

    return NextResponse.json({
      question: {
        id: selected.id,
        text: selected.text,
        difficulty: selected.difficulty,
        topic: selected.topic,
        rating: selected.rating,
        options: selected.options
      },
      has_reset: false
    });
  } catch (err: any) {
    console.error('Practice next-question error:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
