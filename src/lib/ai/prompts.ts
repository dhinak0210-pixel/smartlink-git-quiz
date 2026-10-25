export const GENERATE_QUESTIONS_PROMPT = `
You are a Git expert creating quiz questions for computer science students.

Generate {count} multiple-choice questions about Git with the following parameters:
- Topic: {topic} (e.g., "branching and merging", "rebasing", "git reset vs revert", "cherry-pick", "stashing", "git hooks", "git internals")
- Difficulty: {difficulty} (easy / medium / hard)

For each question, provide:
1. question_text: Clear, unambiguous question text
2. option_a, option_b, option_c, option_d: Four distinct options
3. correct_answer: The letter of the correct option (a, b, c, or d)
4. explanation: A 1-2 sentence explanation of why the correct answer is right
5. topic_tag: A short tag for the topic
6. difficulty: easy, medium, or hard

Rules:
- Questions should test practical Git knowledge, not trivia
- Avoid questions that depend on specific Git versions
- Include scenario-based questions (e.g., "You accidentally committed to main. What command would you use to...")
- Make wrong options plausible but clearly incorrect to someone who knows Git
- Avoid "All of the above" or "None of the above" options
- Each question should have exactly one correct answer

Return strictly a valid JSON array of objects without markdown formatting or backticks if possible, matching this schema:
[
  {
    "question_text": "What does 'git rebase -i HEAD~3' do?",
    "option_a": "Deletes the last 3 commits",
    "option_b": "Opens an interactive editor to modify the last 3 commits",
    "option_c": "Creates 3 new branches",
    "option_d": "Merges the last 3 commits into one",
    "correct_answer": "b",
    "explanation": "The -i flag starts an interactive rebase, and HEAD~3 specifies the last 3 commits. This lets you reorder, squash, edit, or drop commits.",
    "topic_tag": "rebase",
    "difficulty": "medium"
  }
]
`;

export const VALIDATE_QUESTION_PROMPT = `
You are a Git expert validator. Review this quiz question and check for:
1. Is the marked correct answer actually correct?
2. Are any of the wrong options also potentially correct?
3. Is the question ambiguous?
4. Is the explanation accurate?
5. Could the question confuse students unfairly?

Question: {question_text}
A: {option_a}
B: {option_b}
C: {option_c}
D: {option_d}
Marked correct: {correct_answer}
Explanation: {explanation}

Respond with strictly valid JSON:
{
  "is_valid": true,
  "issues": [],
  "suggestion": "None"
}
`;

export const STUDENT_FEEDBACK_PROMPT = `
Generate a brief, encouraging performance feedback for a student in a Git quiz.

Student: {name}
Score: {score}/{total_possible} (Rank: {rank}/{total_students})
Correct: {correct_count}/{total_questions}
Average response time: {avg_time}s

Topic breakdown:
{topic_breakdown}

Weak areas: {weak_topics}

Generate a 3-4 sentence personalized feedback. Be encouraging but specific about areas to improve. Suggest one specific Git concept they should practice.

Return strictly valid JSON:
{
  "feedback": "...",
  "recommended_practice": "...",
  "performance_level": "beginner"
}
`;
