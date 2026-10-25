// src/app/api/admin/questions/import-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticatedAdmin } from '@/lib/auth/session';
import { getCurrentEvent, saveQuestion, getAllQuestions, updateEvent } from '@/lib/supabase/server';
import { Question } from '@/lib/utils/types';

export const dynamic = 'force-dynamic';

/**
 * Intelligent parser to extract questions from raw text extracted from a PDF document.
 */
function parseQuestionsFromText(text: string): Partial<Question>[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const questions: Partial<Question>[] = [];

  // Match question patterns: "1.", "1)", "Q1:", "Question 1:", "1 - "
  const qRegex = /(?:^|\n)\s*(?:Q(?:uestion)?\s*(\d+)[:.]?|(\d+)[\.\)\-:])\s+/gi;
  const matches = [...normalized.matchAll(qRegex)];

  if (matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const startIdx = (matches[i].index || 0) + matches[i][0].length;
      const endIdx = i + 1 < matches.length ? (matches[i + 1].index || normalized.length) : normalized.length;
      const block = normalized.slice(startIdx, endIdx).trim();

      const parsed = parseSingleQuestionBlock(block, i + 1);
      if (parsed) questions.push(parsed);
    }
  } else {
    // Fallback: split by double line breaks
    const blocks = normalized.split(/\n\s*\n+/);
    let count = 1;
    for (const b of blocks) {
      const trimmed = b.trim();
      if (trimmed.length > 15) {
        const parsed = parseSingleQuestionBlock(trimmed, count);
        if (parsed) {
          questions.push(parsed);
          count++;
        }
      }
    }
  }

  return questions;
}

function parseSingleQuestionBlock(block: string, index: number): Partial<Question> | null {
  // Option markers: A) or (A) or [A] or A. or A:
  const optRegex = /(?:^|\n|\s+)(?:[\[\(]?([A-Da-d])[\.\)\]:]\s*|\b([A-Da-d])\s*[:\-])\s*/g;
  const optMatches = [...block.matchAll(optRegex)];

  // Look for Correct Answer: Ans: B or Answer: B or Key: B
  const ansMatch = block.match(/(?:Ans(?:wer)?|Correct(?:\s*Answer)?|Key|Option)\s*[:=\-]?\s*[\(\[]?([A-Da-d])[\)\]]?/i);
  let correctAnswer: 'a' | 'b' | 'c' | 'd' = 'a';
  if (ansMatch) {
    const letter = ansMatch[1].toLowerCase();
    if (letter === 'a' || letter === 'b' || letter === 'c' || letter === 'd') {
      correctAnswer = letter;
    }
  }

  // Look for Explanation:
  const expMatch = block.match(/(?:Explanation|Reason|Note|Details)\s*[:=\-]?\s*([^\n]+(?:\n(?!(?:Topic|Difficulty|Ans|Question))[^\n]+)*)/i);
  const explanation = expMatch ? expMatch[1].trim() : 'Verified tournament question item.';

  // Look for Topic:
  const topicMatch = block.match(/Topic\s*[:=\-]?\s*([a-zA-Z0-9_\-]+)/i);
  const topic = topicMatch ? topicMatch[1].toLowerCase() : (index <= 5 ? 'basics' : index <= 10 ? 'branching' : 'advanced');

  // Look for Difficulty:
  const diffMatch = block.match(/Difficulty\s*[:=\-]?\s*(easy|medium|hard)/i);
  let difficulty: 'easy' | 'medium' | 'hard' = index <= 5 ? 'easy' : index <= 10 ? 'medium' : 'hard';
  if (diffMatch) {
    const d = diffMatch[1].toLowerCase();
    if (d === 'easy' || d === 'medium' || d === 'hard') difficulty = d;
  }

  let questionText = '';
  let optionA = '';
  let optionB = '';
  let optionC = '';
  let optionD = '';

  if (optMatches.length >= 2) {
    questionText = block.slice(0, optMatches[0].index).trim();

    for (let j = 0; j < optMatches.length; j++) {
      const letter = (optMatches[j][1] || optMatches[j][2]).toLowerCase();
      const start = (optMatches[j].index || 0) + optMatches[j][0].length;
      let end = j + 1 < optMatches.length ? (optMatches[j + 1].index || block.length) : block.length;

      if (j === optMatches.length - 1) {
        const stopMatch = block.slice(start).search(/(?:Ans(?:wer)?|Correct|Explanation|Topic|Difficulty)\s*[:=\-]/i);
        if (stopMatch !== -1) end = start + stopMatch;
      }

      const val = block.slice(start, end).trim().replace(/[;\.,]$/, '');
      if (letter === 'a') optionA = val;
      else if (letter === 'b') optionB = val;
      else if (letter === 'c') optionC = val;
      else if (letter === 'd') optionD = val;
    }
  } else {
    questionText = block;
  }

  // Clean question text of trailing metadata
  questionText = questionText.replace(/(?:Topic|Difficulty|Ans(?:wer)?)\s*[:=\-].*$/gis, '').trim();

  if (!questionText || questionText.length < 5) return null;

  return {
    question_number: index,
    question_text: questionText,
    option_a: optionA || 'Option A',
    option_b: optionB || 'Option B',
    option_c: optionC || 'Option C',
    option_d: optionD || 'Option D',
    correct_answer: correctAnswer,
    explanation,
    topic_tag: topic,
    difficulty,
    time_limit_seconds: 20,
    points: 100,
  };
}

/**
 * Extract text from a PDF Buffer using pdf-parse or fallback streams.
 */
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const pdfModule = require('pdf-parse');
    const PDFParse = pdfModule.PDFParse || pdfModule.default?.PDFParse || pdfModule;
    if (typeof PDFParse === 'function') {
      try {
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        if (typeof parser.destroy === 'function') await parser.destroy();
        if (result && result.text) return result.text;
      } catch (innerErr) {
        // Fallback to legacy function call if PDFParse class failed
        if (typeof pdfModule === 'function') {
          const res = await pdfModule(buffer);
          if (res?.text) return res.text;
        }
      }
    }
  } catch (err) {
    console.warn('[PDF Parser] pdf-parse library error, falling back to text stream extractor:', err);
  }

  // Fallback: extract plain text streams from raw PDF syntax
  const raw = buffer.toString('latin1');
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let extracted = '';
  let match;
  while ((match = streamRegex.exec(raw)) !== null) {
    const textChunk = match[1].replace(/[^\x20-\x7E\r\n\t]/g, ' ');
    if (textChunk.includes('(') && textChunk.includes(')')) {
      const parenRegex = /\(([^)]+)\)/g;
      let pMatch;
      while ((pMatch = parenRegex.exec(textChunk)) !== null) {
        extracted += pMatch[1] + ' ';
      }
      extracted += '\n';
    } else {
      extracted += textChunk + '\n';
    }
  }

  return extracted || raw;
}

export async function POST(req: NextRequest) {
  const isAdmin = await isAuthenticatedAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const contentType = req.headers.get('content-type') || '';

    // Case 1: Direct JSON save or text parse
    if (contentType.includes('application/json')) {
      const body = await req.json();

      // If already parsed questions and user clicks "Import/Save All"
      if (body.save && Array.isArray(body.questions)) {
        const event = await getCurrentEvent();
        const saved = [];
        for (let i = 0; i < body.questions.length; i++) {
          const q = body.questions[i];
          const res = await saveQuestion({
            ...q,
            event_id: event.id,
            question_number: i + 1,
            time_limit_seconds: q.time_limit_seconds || event.time_per_question_seconds || 20,
            points: q.points || 100,
          });
          saved.push(res);
        }
        await updateEvent(event.id, { total_questions: saved.length });
        return NextResponse.json({ success: true, count: saved.length, questions: saved });
      }

      // If user pasted raw PDF text directly
      if (body.text) {
        const questions = parseQuestionsFromText(body.text);
        return NextResponse.json({ success: true, count: questions.length, questions });
      }

      return NextResponse.json({ error: 'Invalid JSON request' }, { status: 400 });
    }

    // Case 2: File Upload (multipart/form-data)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'No PDF file uploaded' }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileName = file.name.toLowerCase();

      let extractedText = '';

      if (fileName.endsWith('.pdf')) {
        extractedText = await extractTextFromPdf(buffer);
      } else if (fileName.endsWith('.json')) {
        try {
          const json = JSON.parse(buffer.toString('utf-8'));
          if (Array.isArray(json)) {
            return NextResponse.json({ success: true, count: json.length, questions: json });
          }
        } catch {
          extractedText = buffer.toString('utf-8');
        }
      } else {
        // Plain text / Markdown / doc
        extractedText = buffer.toString('utf-8');
      }

      if (!extractedText || extractedText.trim().length === 0) {
        return NextResponse.json({ error: 'Could not extract text from the provided file.' }, { status: 400 });
      }

      const questions = parseQuestionsFromText(extractedText);
      return NextResponse.json({
        success: true,
        fileName: file.name,
        count: questions.length,
        questions,
        rawTextLength: extractedText.length,
      });
    }

    return NextResponse.json({ error: 'Unsupported Content-Type' }, { status: 415 });
  } catch (err: any) {
    console.error('[API /api/admin/questions/import-pdf] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to process PDF import.' }, { status: 500 });
  }
}
