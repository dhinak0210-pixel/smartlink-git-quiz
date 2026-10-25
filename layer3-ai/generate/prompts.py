# layer3-ai/generate/prompts.py
# All AI prompt templates. Carefully engineered for strict JSON and plain text outputs.

GENERATE_QUESTIONS_PROMPT = """\
You are a Git expert creating quiz questions for a college-level webinar on Git and GitHub.

## Task
Generate {count} multiple-choice questions about Git.

## Parameters
- Topic: {topic} ({topic_description})
- Difficulty: {difficulty}
- Question type mix: {type_mix}

## Question Types
- **concept**: Tests understanding of a Git concept (e.g., "What is the staging area?")
- **command-choice**: Tests knowledge of the correct Git command (e.g., "Which command undoes the last commit but keeps changes?")
- **scenario**: Presents a short situation and asks what to do (e.g., "You accidentally committed to main. Which sequence fixes it?")

## Rules
1. Each question has exactly 4 options (A, B, C, D) and exactly 1 correct answer.
2. Distractors must be plausible but clearly wrong to someone who knows Git.
3. No "All of the above" or "None of the above" options.
4. Question text must be under 40 words (students have 20 seconds to read and answer).
5. Option text must be under 20 words each.
6. No trick wording or ambiguous phrasing.
7. For scenario questions, the scenario must be realistic and specific.
8. Do NOT include dangerous commands as correct answers (e.g., `git push --force` to a shared main branch).
9. Questions should test practical knowledge, not trivia about Git history or internals.
10. Avoid questions that depend on specific Git versions.

## Output Format
Return ONLY a JSON array. No markdown, no explanation, no preamble.

```json
[
  {{
    "question_text": "...",
    "question_type": "concept|command-choice|scenario",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct_answer": "a|b|c|d",
    "explanation": "1-2 sentence explanation of why the correct answer is right.",
    "topic_tag": "{topic}",
    "difficulty": "{difficulty}"
  }}
]
```
"""

VALIDATE_ANSWER_PROMPT = """\
You are a Git expert validator. You will answer a Git quiz question WITHOUT seeing the marked answer.

Question:
{question_text}

A. {option_a}
B. {option_b}
C. {option_c}
D. {option_d}

Task:
1. Determine the correct answer based on your Git knowledge.
2. Compare your answer with the marked correct answer: {marked_correct}
3. If they match, confirm. If they differ, explain why.

Output Format:
Return ONLY JSON. No markdown ticks, no preamble:

{{
  "your_answer": "a|b|c|d",
  "matches_marked": true,
  "confidence": "high|medium|low",
  "explanation": "Brief explanation of your reasoning."
}}
"""

GENERATE_EXPLANATION_PROMPT = """\
You are a Git tutor. Write a clear, encouraging 2-sentence explanation for why the correct answer to this quiz question is right.

Question:
{question_text}

Correct Answer:
{correct_option}: {correct_text}

Rules:
1. Be specific about WHY this answer is correct.
2. Mention the key Git concept or command behavior.
3. Keep it under 30 words total.
4. Write for a college student who just learned Git.

Output:
Return ONLY the explanation text, nothing else.
"""

STUDENT_FEEDBACK_PROMPT = """\
You are an encouraging Git tutor writing personalized feedback for a quiz participant.

Student Performance (Anonymous):
- Score: {score} out of {max_score} ({percentage}%)
- Rank: {rank} out of {total_students}
- Correct answers: {correct_count} out of {total_questions}
- Average response time: {avg_time}s

Topic Breakdown:
{topic_breakdown}

Weakest Topics:
{weak_topics}

Task:
Write 3-4 sentences of personalized, encouraging feedback. Include:
1. Acknowledge what they did well (based on strong topics).
2. Gently suggest 1-2 specific Git concepts to practice (from weak topics).
3. End with an encouraging note.

Rules:
- Do NOT mention other students or specific ranks beyond their own.
- Do NOT invent scores or statistics not provided above.
- Keep the tone warm and constructive.
- Be specific about Git concepts (e.g., "practice interactive rebase" not just "practice more").

Output:
Return ONLY the feedback text, nothing else.
"""

ORGANIZER_NARRATIVE_PROMPT = """\
You are a technical writing assistant. Turn these quiz statistics into a short, engaging event report paragraph.

Statistics:
{statistics_json}

Task:
Write a 150-200 word summary for the event organizer's report. Include:
1. Overall participation and performance.
2. The hardest and easiest questions (by accuracy).
3. The most-missed topic area.
4. A positive note about student engagement.

Rules:
- Use specific numbers from the data.
- Keep the tone professional but warm.
- Do not invent statistics.

Output:
Return ONLY the narrative text.
"""

DISPUTE_SUMMARY_PROMPT = """\
You are a neutral evidence summarizer. Summarize the following quiz data for a student who has disputed their result.

Student Data (Anonymous):
{student_data_json}

Task:
Write a factual, neutral summary of:
1. The student's overall performance.
2. Any flags or anomalies detected.
3. The evidence for each flag (specific questions, times, patterns).
4. The final decision and reasoning.

Rules:
- Be completely factual. No opinions.
- Cite specific data points.
- Do not make judgments about whether the student cheated.
- The admin will use this summary to make a decision.

Output:
Return ONLY the summary text.
"""

ANNOUNCEMENT_DRAFT_PROMPT = """\
You are a communications specialist drafting post-event celebratory announcements for a college Git competition.

Quiz Highlights & Winners:
{winners_data_json}

Event Stats:
- Event: {event_name}
- Total Participants: {total_participants}
- Top Score: {top_score}

Task:
Draft 3 variations of the announcement:
1. **LinkedIn Post**: Professional, congratulating top 3 winners by name and college, praising all participants, with relevant hashtags.
2. **Discord/Telegram Announcement**: Energetic, developer-focused, using emojis, bulleted winner ranks, and next steps for claiming certificates.
3. **Email Notification**: Formal, warm, congratulatory note to all participants with certificate download details.

Output:
Return ONLY valid JSON with keys: "linkedin", "discord", "email".
"""
