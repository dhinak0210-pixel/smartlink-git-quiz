# variant-pipeline/generate/prompts.py
"""
Prompt templates for Gemini question template drafting.
"""

TEMPLATE_DRAFT_PROMPT = """You are a senior Git internals and DevOps assessment author.

Create a parameterized Git quiz question template in YAML format for the SmartLink Git Quiz.

TOPIC: {topic}
DIFFICULTY: {difficulty}

REQUIREMENTS:
1. Format: Valid YAML matching our template specification.
2. Parameterized: At least 1-2 parameters (e.g. branch names, commit counts N, file names) that change the correct command.
3. Setup commands: Exact shell/git commands that construct the initial git repo.
4. Stem: Question text with {param} placeholders. Under 40 words.
5. Correct: The exact Git command that achieves the goal.
6. Distractors: Exactly 3 plausible distractors with a 'reason' tag (e.g. wrong_flag, wrong_count, destroys_changes, leaves_unstaged).
7. Goal: Checkable predicate expression (e.g., "head_offset(main)=={N} AND worktree_clean==true").
8. Explanation: Technical explanation with {param} placeholders.

SCHEMA EXAMPLE:
id: q_example
topic: {topic}
difficulty: {difficulty}
type: variant
parameters:
  - name: N
    values: [2, 3, 4]
    type: int
setup:
  - "git init"
  - "for i in $(seq 1 5); do echo $i > f$i.txt && git add f$i.txt && git commit -m $i; done"
stem: "Undo the last {N} commits without losing staged changes."
correct: "git reset --soft HEAD~{N}"
distractors:
  - text: "git reset --hard HEAD~{N}"
    reason: destroys_changes
  - text: "git reset --mixed HEAD~{N}"
    reason: leaves_unstaged
  - text: "git reset --soft HEAD~{N_minus_1}"
    reason: wrong_count
goal: "head_offset(main)=={N} AND worktree_clean==true"
explanation: "git reset --soft moves HEAD without modifying the index."

Return ONLY valid YAML inside ```yaml blocks.
"""
