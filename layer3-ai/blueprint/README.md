# SmartLink Git Quiz — Blueprint Instructions for Organizers

## Purpose
The **Blueprint** (`blueprint.json`) defines the topic-by-difficulty matrix for the SmartLink Git Quiz.
It guarantees that questions:
1. Cover the exact scope of the webinar or workshop delivered to participants.
2. Maintain a balanced difficulty curve (5 Easy, 5 Medium, 5 Hard in the main 15-question quiz).
3. Provide 5 Hard reserve questions for sudden-death tiebreakers and integrity replacements.

---

## Blueprint Structure

```json
{
  "topics": [
    {
      "name": "basics",
      "description": "init, add, commit, status, clone, log",
      "distribution": { "easy": 2, "medium": 1, "hard": 0 }
    },
    ...
  ],
  "total_per_difficulty": { "easy": 5, "medium": 5, "hard": 5 },
  "total": 15,
  "reserve": 5,
  "candidates_to_generate": 40
}
```

### Pre-Event Checklist for Organizers (Days 5–6 Before Event)
1. **Review Webinar Agenda**: Consult with the webinar speaker. If a topic was skipped or emphasized, adjust the numbers in `distribution`.
2. **Ensure Difficulty Balance**:
   - `easy`: 5 total questions (straightforward concept definitions or basic commands).
   - `medium`: 5 total questions (scenario-based branch/merge or remote interactions).
   - `hard`: 5 total questions (interactive undoing, rebase, reflog, detached HEAD).
3. **Reserve Pool**: Ensure at least 5 reserve questions are verified and staged in Supabase for sudden-death tiebreakers.
4. **Run Generation & Quality Gates**:
   ```bash
   bash scripts/run_before.sh
   ```
5. **Inspect Bank Output**:
   Review `bank/final_questions.json` and human-approve the final 20 questions before importing to Supabase.
