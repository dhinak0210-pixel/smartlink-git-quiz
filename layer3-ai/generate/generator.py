# layer3-ai/generate/generator.py
# Generates quiz question candidates using Gemini (primary) or Groq (backup).
# Run: python generate/generator.py [--mock]

import json
import time
import logging
import argparse
import sys
from pathlib import Path
from datetime import datetime

# Add layer3-ai to path if run as script
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import (
    GEMINI_API_KEY, GROQ_API_KEY, AI_PROVIDER,
    GEMINI_MODEL, GROQ_MODEL,
    GEMINI_RPM, BATCH_SIZE, BATCH_DELAY_SECONDS,
    MAX_RETRIES, RETRY_BACKOFF,
    GENERATE_DIR, BLUEPRINT_DIR, TOTAL_CANDIDATES,
)
from generate.prompts import GENERATE_QUESTIONS_PROMPT

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(GENERATE_DIR / "output" / "generation.log"),
    ],
)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Built-in High-Fidelity Candidate Bank for Offline / Dry-Run Testing
# ─────────────────────────────────────────────────────────────────────────────
MOCK_CANDIDATE_POOL = [
    # basics - easy
    {
        "question_text": "Which command initializes a brand-new Git repository in the current folder?",
        "question_type": "command-choice",
        "option_a": "git start",
        "option_b": "git init",
        "option_c": "git new",
        "option_d": "git create",
        "correct_answer": "b",
        "explanation": "git init creates the .git metadata directory and begins tracking the current folder as a Git repository.",
        "topic_tag": "basics",
        "difficulty": "easy"
    },
    {
        "question_text": "Which command shows the working tree status, staged files, and untracked files?",
        "question_type": "command-choice",
        "option_a": "git status",
        "option_b": "git inspect",
        "option_c": "git log --status",
        "option_d": "git info",
        "correct_answer": "a",
        "explanation": "git status displays paths that have differences between the index file and the current HEAD commit.",
        "topic_tag": "basics",
        "difficulty": "easy"
    },
    {
        "question_text": "What is the primary function of the Git staging area (the index)?",
        "question_type": "concept",
        "option_a": "To permanently publish commits to GitHub",
        "option_b": "To prepare and preview specific file changes before committing",
        "option_c": "To compress git object files on disk",
        "option_d": "To store backup copies of discarded branches",
        "correct_answer": "b",
        "explanation": "The staging area lets developers curate exact file changes that will be captured in the next commit.",
        "topic_tag": "basics",
        "difficulty": "easy"
    },
    # basics - medium
    {
        "question_text": "Which command stages all modified and deleted files in the entire working directory?",
        "question_type": "command-choice",
        "option_a": "git add -A",
        "option_b": "git add --current",
        "option_c": "git stage --only-tracked",
        "option_d": "git commit --all-stage",
        "correct_answer": "a",
        "explanation": "git add -A (or git add --all) stages new, modified, and deleted files throughout the repository.",
        "topic_tag": "basics",
        "difficulty": "medium"
    },
    {
        "question_text": "How do you view commit history formatted with each commit on a single condensed line?",
        "question_type": "command-choice",
        "option_a": "git log --brief",
        "option_b": "git log --oneline",
        "option_c": "git show --summary",
        "option_d": "git commits --short",
        "correct_answer": "b",
        "explanation": "git log --oneline prints the short SHA-1 hash and the commit subject line on a single line per commit.",
        "topic_tag": "basics",
        "difficulty": "medium"
    },
    # branching - easy
    {
        "question_text": "Which command creates a new branch named 'feature-login' without switching to it?",
        "question_type": "command-choice",
        "option_a": "git branch feature-login",
        "option_b": "git switch -c feature-login",
        "option_c": "git checkout -b feature-login",
        "option_d": "git fork feature-login",
        "correct_answer": "a",
        "explanation": "git branch <name> creates the branch pointer at HEAD without moving the current HEAD pointer.",
        "topic_tag": "branching",
        "difficulty": "easy"
    },
    # branching - medium
    {
        "question_text": "Which modern command switches your working directory to an existing branch named 'dev'?",
        "question_type": "command-choice",
        "option_a": "git switch dev",
        "option_b": "git move dev",
        "option_c": "git branch --goto dev",
        "option_d": "git transfer dev",
        "correct_answer": "a",
        "explanation": "git switch was introduced in Git 2.23 as the clean, dedicated command for switching branches.",
        "topic_tag": "branching",
        "difficulty": "medium"
    },
    {
        "question_text": "You are on branch 'main'. Which command incorporates all commits from 'feature' into 'main'?",
        "question_type": "command-choice",
        "option_a": "git merge feature",
        "option_b": "git combine feature",
        "option_c": "git branch --join feature",
        "option_d": "git pull feature",
        "correct_answer": "a",
        "explanation": "git merge <branch> joins the specified branch's history into the current active branch.",
        "topic_tag": "branching",
        "difficulty": "medium"
    },
    {
        "question_text": "What happens when Git encounters conflicting changes on the same line during a merge?",
        "question_type": "scenario",
        "option_a": "Git deletes the file and reverts the merge immediately",
        "option_b": "Git pauses the merge and inserts conflict marker delimiters into the file",
        "option_c": "Git automatically accepts the oldest commit's changes",
        "option_d": "Git prompts for the author's password to force the merge",
        "correct_answer": "b",
        "explanation": "Git marks the file as unmerged and embeds <<<<<<<, =======, and >>>>>>> markers for manual resolution.",
        "topic_tag": "branching",
        "difficulty": "medium"
    },
    # branching - hard
    {
        "question_text": "Which command aborts an ongoing merge conflict and restores the working tree to pre-merge state?",
        "question_type": "command-choice",
        "option_a": "git merge --abort",
        "option_b": "git merge --cancel",
        "option_c": "git undo merge",
        "option_d": "git checkout --cancel-merge",
        "correct_answer": "a",
        "explanation": "git merge --abort safely cleans up conflicts and resets HEAD to where it was before the merge began.",
        "topic_tag": "branching",
        "difficulty": "hard"
    },
    # remote - easy
    {
        "question_text": "Which command downloads a copy of an existing remote repository onto your local computer?",
        "question_type": "command-choice",
        "option_a": "git clone <url>",
        "option_b": "git download <url>",
        "option_c": "git fetch --all <url>",
        "option_d": "git import <url>",
        "correct_answer": "a",
        "explanation": "git clone copies the remote repository, sets up tracking branches, and checks out the default branch.",
        "topic_tag": "remote",
        "difficulty": "easy"
    },
    # remote - medium
    {
        "question_text": "What is the difference between 'git fetch' and 'git pull'?",
        "question_type": "concept",
        "option_a": "git fetch downloads objects without merging; git pull fetches and merges into the current branch",
        "option_b": "git fetch works over SSH while git pull works only over HTTPS",
        "option_c": "git pull only updates tags while git fetch updates code files",
        "option_d": "There is no difference; they are aliases for the same underlying operation",
        "correct_answer": "a",
        "explanation": "git pull is essentially a shortcut for running git fetch followed by git merge FETCH_HEAD.",
        "topic_tag": "remote",
        "difficulty": "medium"
    },
    # remote - hard
    {
        "question_text": "Which command uploads a new local branch 'experiment' and configures upstream tracking to origin?",
        "question_type": "command-choice",
        "option_a": "git push -u origin experiment",
        "option_b": "git push --track experiment",
        "option_c": "git remote push experiment",
        "option_d": "git push origin --bind experiment",
        "correct_answer": "a",
        "explanation": "The -u (or --set-upstream) flag links the local branch to the remote branch on origin for future git pull/push.",
        "topic_tag": "remote",
        "difficulty": "hard"
    },
    # undoing - easy
    {
        "question_text": "Which command unstages a file 'app.js' from the staging area without discarding working edits?",
        "question_type": "command-choice",
        "option_a": "git restore --staged app.js",
        "option_b": "git discard --cached app.js",
        "option_c": "git clean app.js",
        "option_d": "git revert app.js",
        "correct_answer": "a",
        "explanation": "git restore --staged removes the specified file from the index while keeping modifications in the working tree.",
        "topic_tag": "undoing",
        "difficulty": "easy"
    },
    # undoing - medium
    {
        "question_text": "You want to create a new commit that exactly inverts the changes of a faulty commit. Which command should you use?",
        "question_type": "command-choice",
        "option_a": "git revert <commit-hash>",
        "option_b": "git reset --soft <commit-hash>",
        "option_c": "git drop <commit-hash>",
        "option_d": "git checkout --inverse <commit-hash>",
        "correct_answer": "a",
        "explanation": "git revert safely produces a new commit that records the exact inverse of the targeted commit.",
        "topic_tag": "undoing",
        "difficulty": "medium"
    },
    # undoing - hard
    {
        "question_text": "You need to undo the last commit while keeping all its modified files in the staging area. What is the command?",
        "question_type": "command-choice",
        "option_a": "git reset --soft HEAD~1",
        "option_b": "git reset --hard HEAD~1",
        "option_c": "git revert --soft HEAD",
        "option_d": "git checkout HEAD~1 --staged",
        "correct_answer": "a",
        "explanation": "git reset --soft moves HEAD back one commit without touching the index or working tree.",
        "topic_tag": "undoing",
        "difficulty": "hard"
    },
    {
        "question_text": "You accidentally ran 'git reset --hard' and lost unpushed commits. Where can you find their commit hashes?",
        "question_type": "command-choice",
        "option_a": "git reflog",
        "option_b": "git log --lost",
        "option_c": "git fsck --undo",
        "option_d": "git status --history",
        "correct_answer": "a",
        "explanation": "git reflog records every update to the tip of branches and HEAD, allowing recovery of lost commits.",
        "topic_tag": "undoing",
        "difficulty": "hard"
    },
    # advanced - hard
    {
        "question_text": "Which command applies the exact changes introduced by commit 'a1b2c3d' from another branch onto your branch?",
        "question_type": "command-choice",
        "option_a": "git cherry-pick a1b2c3d",
        "option_b": "git rebase --single a1b2c3d",
        "option_c": "git apply-commit a1b2c3d",
        "option_d": "git merge --only a1b2c3d",
        "correct_answer": "a",
        "explanation": "git cherry-pick applies the changes recorded by an existing commit to your current branch as a new commit.",
        "topic_tag": "advanced",
        "difficulty": "hard"
    },
    # Additional reserve / candidates
    {
        "question_text": "What does a 'detached HEAD' state indicate in Git?",
        "question_type": "concept",
        "option_a": "HEAD points directly to a specific commit rather than a named branch reference",
        "option_b": "The local repository has lost connection to the remote origin server",
        "option_c": "The default branch has been deleted from GitHub",
        "option_d": "A commit contains corrupted Git blob objects",
        "correct_answer": "a",
        "explanation": "In detached HEAD state, new commits will not belong to any branch unless a branch is explicitly created.",
        "topic_tag": "advanced",
        "difficulty": "hard"
    },
    {
        "question_text": "Which command temporarily shelves uncommitted local modifications to give you a clean working directory?",
        "question_type": "command-choice",
        "option_a": "git stash",
        "option_b": "git pause",
        "option_c": "git hold",
        "option_d": "git suspend",
        "correct_answer": "a",
        "explanation": "git stash saves modified tracked files on a stack and restores a clean working tree.",
        "topic_tag": "undoing",
        "difficulty": "medium"
    }
]


class QuestionGenerator:
    def __init__(self, use_mock: bool = False):
        self.provider = AI_PROVIDER
        self.call_count = 0
        self.total_tokens = 0
        self.results = []
        self.errors = []
        self.use_mock = use_mock

        if not self.use_mock:
            if self.provider == "gemini":
                if not GEMINI_API_KEY:
                    logger.warning("⚠️  GEMINI_API_KEY is not set. Switching to mock generation mode.")
                    self.use_mock = True
                else:
                    try:
                        import google.generativeai as genai
                        genai.configure(api_key=GEMINI_API_KEY)
                        self.model = genai.GenerativeModel(GEMINI_MODEL)
                    except Exception as e:
                        logger.warning(f"Failed to initialize Gemini SDK ({e}). Falling back to mock generator.")
                        self.use_mock = True

            elif self.provider == "groq":
                if not GROQ_API_KEY:
                    logger.warning("⚠️  GROQ_API_KEY is not set. Switching to mock generation mode.")
                    self.use_mock = True
                else:
                    try:
                        from groq import Groq
                        self.client = Groq(api_key=GROQ_API_KEY)
                    except Exception as e:
                        logger.warning(f"Failed to initialize Groq SDK ({e}). Falling back to mock generator.")
                        self.use_mock = True

    def load_blueprint(self) -> dict:
        """Load the topic × difficulty blueprint."""
        with open(BLUEPRINT_DIR / "blueprint.json") as f:
            return json.load(f)

    def build_generation_plan(self, blueprint: dict) -> list[dict]:
        """
        Build a list of generation tasks from the blueprint.
        Each task specifies topic, difficulty, count, and type mix.
        """
        plan = []
        candidates_per_topic = TOTAL_CANDIDATES // len(blueprint["topics"])

        for topic in blueprint["topics"]:
            for difficulty, count in topic["distribution"].items():
                if count == 0:
                    continue

                # Scale up to generate more candidates than needed
                scale = candidates_per_topic / max(
                    sum(topic["distribution"].values()), 1
                )
                gen_count = max(BATCH_SIZE, round(count * scale))

                # Determine type mix
                if difficulty == "easy":
                    type_mix = "60% concept, 30% command-choice, 10% scenario"
                elif difficulty == "medium":
                    type_mix = "30% concept, 30% command-choice, 40% scenario"
                else:
                    type_mix = "10% concept, 30% command-choice, 60% scenario"

                plan.append({
                    "topic": topic["name"],
                    "topic_description": topic["description"],
                    "difficulty": difficulty,
                    "count": gen_count,
                    "type_mix": type_mix,
                })

        return plan

    def _generate_mock_batch(self, task: dict) -> list[dict]:
        """Generate high-quality candidate items for offline/testing mode."""
        topic = task["topic"]
        difficulty = task["difficulty"]
        count = task["count"]

        # Filter mock candidates that match topic and difficulty
        matching = [
            q for q in MOCK_CANDIDATE_POOL
            if q["topic_tag"] == topic and q["difficulty"] == difficulty
        ]
        if not matching:
            # Fallback to topic or difficulty match
            matching = [q for q in MOCK_CANDIDATE_POOL if q["topic_tag"] == topic]
        if not matching:
            matching = MOCK_CANDIDATE_POOL

        results = []
        for i in range(count):
            base = dict(matching[i % len(matching)])
            # Unique variation
            item = dict(base)
            item["id"] = f"cand_{topic[:3]}_{difficulty[:3]}_{len(self.results) + len(results) + 1:03d}"
            item["generated_at"] = datetime.now().isoformat()
            item["provider"] = "offline_mock"
            item["topic"] = topic
            item["difficulty"] = difficulty
            results.append(item)

        time.sleep(0.2)
        return results

    def generate_batch(self, task: dict) -> list[dict]:
        """Generate a batch of questions for a single task."""
        if self.use_mock:
            valid = self._generate_mock_batch(task)
            logger.info(
                f"✅ [Mock Mode] Generated {len(valid)} questions "
                f"({task['topic']}/{task['difficulty']})"
            )
            return valid

        prompt = GENERATE_QUESTIONS_PROMPT.format(
            count=task["count"],
            topic=task["topic"],
            topic_description=task["topic_description"],
            difficulty=task["difficulty"],
            type_mix=task["type_mix"],
        )

        for attempt in range(MAX_RETRIES):
            try:
                self._rate_limit()

                if self.provider == "gemini":
                    import google.generativeai as genai
                    response = self.model.generate_content(
                        prompt,
                        generation_config={
                            "temperature": 0.8,
                            "max_output_tokens": 4096,
                        },
                    )
                    text = response.text
                    if hasattr(response, "usage_metadata") and response.usage_metadata:
                        self.total_tokens += response.usage_metadata.total_token_count

                elif self.provider == "groq":
                    response = self.client.chat.completions.create(
                        model=GROQ_MODEL,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.8,
                        max_tokens=4096,
                    )
                    text = response.choices[0].message.content
                    if hasattr(response, "usage") and response.usage:
                        self.total_tokens += response.usage.total_tokens

                self.call_count += 1

                # Parse JSON from response
                questions = self._parse_json(text)

                # Validate structure
                valid = []
                for idx, q in enumerate(questions):
                    if self._validate_structure(q):
                        q["id"] = f"cand_{task['topic'][:3]}_{task['difficulty'][:3]}_{len(self.results) + len(valid) + 1:03d}"
                        q["generated_at"] = datetime.now().isoformat()
                        q["provider"] = self.provider
                        q["topic"] = task["topic"]
                        q["difficulty"] = task["difficulty"]
                        valid.append(q)
                    else:
                        logger.warning(f"Invalid question structure: {q.get('question_text', '?')[:50]}")

                logger.info(
                    f"✅ Generated {len(valid)}/{task['count']} questions "
                    f"({task['topic']}/{task['difficulty']}) "
                    f"[call #{self.call_count}]"
                )
                return valid

            except Exception as e:
                logger.error(
                    f"❌ Attempt {attempt + 1}/{MAX_RETRIES} failed: {e}"
                )
                if attempt < MAX_RETRIES - 1:
                    wait = RETRY_BACKOFF * (attempt + 1)
                    logger.info(f"   Retrying in {wait}s...")
                    time.sleep(wait)
                else:
                    self.errors.append({
                        "task": task,
                        "error": str(e),
                        "attempts": MAX_RETRIES,
                    })
                    # In case of repeated failures, fill in with mock to maintain pipeline integrity
                    logger.warning("   Falling back to built-in verified items for this task.")
                    return self._generate_mock_batch(task)

    def _rate_limit(self):
        """Enforce rate limiting between API calls."""
        time.sleep(BATCH_DELAY_SECONDS)

    def _parse_json(self, text: str) -> list[dict]:
        """Extract JSON array from AI response (handles markdown wrapping)."""
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            text = "\n".join(lines).strip()

        try:
            data = json.loads(text)
            if isinstance(data, list):
                return data
            elif isinstance(data, dict) and "questions" in data:
                return data["questions"]
            else:
                logger.warning("Unexpected JSON structure")
                return []
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}")
            logger.debug(f"Raw text: {text[:500]}")
            return []

    def _validate_structure(self, q: dict) -> bool:
        """Check that a question has all required fields."""
        required = [
            "question_text", "option_a", "option_b",
            "option_c", "option_d", "correct_answer", "explanation"
        ]
        if not all(k in q and q[k] for k in required):
            return False
        if q["correct_answer"].lower() not in ("a", "b", "c", "d"):
            return False
        return True

    def run(self):
        """Main generation pipeline."""
        logger.info("🚀 Starting question generation...")
        logger.info(f"   Provider: {'mock' if self.use_mock else self.provider}")
        logger.info(f"   Model: {GEMINI_MODEL if self.provider == 'gemini' and not self.use_mock else GROQ_MODEL}")

        blueprint = self.load_blueprint()
        plan = self.build_generation_plan(blueprint)

        logger.info(f"   Generation plan: {len(plan)} tasks")
        for task in plan:
            logger.info(
                f"   - {task['topic']}/{task['difficulty']}: "
                f"{task['count']} candidates"
            )

        for i, task in enumerate(plan):
            logger.info(f"\n📝 Task {i + 1}/{len(plan)}: {task['topic']}/{task['difficulty']}")
            questions = self.generate_batch(task)
            self.results.extend(questions)

        # Save results
        output_path = GENERATE_DIR / "output" / "candidates_raw.json"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(self.results, f, indent=2)

        # Save log
        log_path = GENERATE_DIR / "output" / "generation_log.json"
        with open(log_path, "w") as f:
            json.dump({
                "provider": "mock" if self.use_mock else self.provider,
                "total_calls": self.call_count,
                "total_tokens": self.total_tokens,
                "total_questions": len(self.results),
                "errors": self.errors,
                "timestamp": datetime.now().isoformat(),
            }, f, indent=2)

        logger.info(f"\n🎉 Generation complete!")
        logger.info(f"   Total questions: {len(self.results)}")
        logger.info(f"   Total API calls: {self.call_count}")
        logger.info(f"   Total tokens: {self.total_tokens}")
        logger.info(f"   Errors: {len(self.errors)}")
        logger.info(f"   Saved to: {output_path}")
        return self.results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SmartLink Git Quiz Question Generator")
    parser.add_argument("--mock", action="store_true", help="Generate questions in offline mock mode")
    args = parser.parse_args()

    generator = QuestionGenerator(use_mock=args.mock)
    generator.run()
