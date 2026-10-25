"""
Inference pipeline for NL→Git.
Supports two backends:
  1. Fine-tuned t5-small (primary, for portfolio)
  2. Free LLM prompting via Gemini (fallback, for quick demo)
  3. Rule-based offline fallback (safety net if no model weights or API key)
"""
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path

# Support relative or absolute imports
try:
    from risk_taxonomy import assess_risk, RiskLevel, RiskAssessment
except ImportError:
    try:
        from .risk_taxonomy import assess_risk, RiskLevel, RiskAssessment
    except ImportError:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from risk_taxonomy import assess_risk, RiskLevel, RiskAssessment


@dataclass
class NL2GitResult:
    command: str
    risk_level: RiskLevel
    explanation: str
    warning: str
    reversible: bool
    source: str  # "finetuned", "llm", or "offline_fallback"


class NL2GitPipeline:
    def __init__(self, model_dir: str | None = None, use_llm_fallback: bool = True):
        self.model = None
        self.tokenizer = None
        self.llm = None
        self.use_llm_fallback = use_llm_fallback

        if model_dir and os.path.isdir(model_dir):
            try:
                self._load_finetuned(model_dir)
            except Exception as e:
                print(f"Warning: Failed to load fine-tuned model from {model_dir}: {e}")
                if use_llm_fallback:
                    self._load_llm()
        elif use_llm_fallback:
            self._load_llm()

    def _load_finetuned(self, model_dir: str):
        from transformers import T5ForConditionalGeneration, T5Tokenizer
        self.tokenizer = T5Tokenizer.from_pretrained(model_dir)
        self.model = T5ForConditionalGeneration.from_pretrained(model_dir)
        self.model.eval()
        print(f"Loaded fine-tuned model from {model_dir}")

    def _load_llm(self):
        api_key = os.environ.get("GEMINI_API_KEY", "")
        # Also attempt loading from .env if empty
        if not api_key:
            env_paths = [
                Path(__file__).resolve().parent.parent.parent / ".env",
                Path(__file__).resolve().parent.parent.parent / ".env.local",
            ]
            for ep in env_paths:
                if ep.exists():
                    for line in ep.read_text().splitlines():
                        if line.startswith("GEMINI_API_KEY="):
                            api_key = line.split("=", 1)[1].strip().strip('"').strip("'")
                            break
                if api_key:
                    break

        try:
            import google.generativeai as genai
            if api_key:
                genai.configure(api_key=api_key)
                self.llm = genai.GenerativeModel("gemini-2.0-flash")
                print("Using Gemini LLM fallback")
            else:
                self.llm = None
                print("Notice: No GEMINI_API_KEY found, rule-based fallback will handle requests when model weights are missing.")
        except Exception as e:
            self.llm = None
            print(f"Notice: Google GenAI not initialized ({e}), rule-based fallback active.")

    def generate(self, goal: str) -> NL2GitResult:
        if self.model is not None:
            return self._generate_finetuned(goal)
        elif self.llm is not None:
            return self._generate_llm(goal)
        else:
            return self._generate_offline(goal)

    def _generate_finetuned(self, goal: str) -> NL2GitResult:
        import torch
        input_text = f"translate goal to git: {goal}"
        inputs = self.tokenizer(input_text, return_tensors="pt", max_length=128, truncation=True)

        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_length=256,
                num_beams=4,
                early_stopping=True,
            )

        decoded = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        parts = decoded.split("[SEP]")
        command = parts[0].strip() if len(parts) > 0 else ""
        model_risk = parts[1].strip() if len(parts) > 1 else None
        explanation = parts[2].strip() if len(parts) > 2 else ""

        risk = assess_risk(command, model_risk)
        return NL2GitResult(
            command=command,
            risk_level=risk.level,
            explanation=explanation,
            warning=risk.warning,
            reversible=risk.reversible,
            source="finetuned",
        )

    def _generate_llm(self, goal: str) -> NL2GitResult:
        prompt = f"""Convert this Git goal into a single Git command.

Goal: "{goal}"

Respond in this exact format (no markdown, no backticks):
COMMAND: <the git command>
RISK: <SAFE|CAUTION|DANGEROUS|CRITICAL>
EXPLANATION: <one sentence>"""

        try:
            response = self.llm.generate_content(
                prompt,
                generation_config={"temperature": 0.2, "max_output_tokens": 200},
            )
            text = response.text.strip()
        except Exception as e:
            return self._generate_offline(goal)

        # Parse response
        command = ""
        model_risk = None
        explanation = ""
        for line in text.split("\n"):
            line = line.strip()
            if line.startswith("COMMAND:"):
                command = line.split(":", 1)[1].strip().strip("`")
            elif line.startswith("RISK:"):
                model_risk = line.split(":", 1)[1].strip()
            elif line.startswith("EXPLANATION:"):
                explanation = line.split(":", 1)[1].strip()

        if not command:
            return self._generate_offline(goal)

        risk = assess_risk(command, model_risk)
        return NL2GitResult(
            command=command,
            risk_level=risk.level,
            explanation=explanation or f"Executes: {command}",
            warning=risk.warning,
            reversible=risk.reversible,
            source="llm",
        )

    def _generate_offline(self, goal: str) -> NL2GitResult:
        """
        Deterministic rule-based mapping for offline / zero-dependency demonstration.
        Ensures high reliability even when fine-tuned weights or network API keys are absent.
        """
        g = goal.lower().strip()

        mapping = [
            (r"undo.*last commit.*keep.*stage", "git reset --soft HEAD~1", "Moves HEAD back one commit; changes remain staged."),
            (r"undo.*last commit.*keep", "git reset --soft HEAD~1", "Moves HEAD back one commit; changes remain in working directory."),
            (r"undo.*last commit.*(throw|discard|lose)", "git reset --hard HEAD~1", "Resets HEAD and working tree to previous commit; discards changes."),
            (r"undo.*last commit.*unstage", "git reset HEAD~1", "Undoes the last commit and unstages changes."),
            (r"undo.*last commit", "git reset --soft HEAD~1", "Moves HEAD back one commit, keeping changes."),
            (r"amend.*message|change.*commit message", 'git commit --amend -m "new message"', "Amends the previous commit's message."),
            (r"amend.*last commit|add.*changes to.*last commit", "git commit --amend", "Appends staged changes into the previous commit."),
            (r"stash.*pop|bring back.*stash", "git stash pop", "Restores the most recently stashed changes."),
            (r"stash|save.*uncommitted", "git stash", "Temporarily shelves uncommitted changes."),
            (r"create.*switch.*branch|new branch.*switch|checkout -b", "git checkout -b new-branch", "Creates and switches to a new branch."),
            (r"create.*branch|make.*branch", "git branch new-branch", "Creates a new branch without switching."),
            (r"switch.*branch|checkout", "git checkout main", "Switches to the specified branch."),
            (r"force delete.*branch|delete.*unmerged branch", "git branch -D old-branch", "Forcibly deletes an unmerged local branch."),
            (r"delete.*branch", "git branch -d old-branch", "Deletes a merged local branch safely."),
            (r"diff.*branch|compare.*branch", "git diff main...HEAD", "Shows difference between main and current branch."),
            (r"diff|what did i change", "git diff", "Shows unstaged working tree changes."),
            (r"status|current state", "git status", "Shows status of working directory and staged files."),
            (r"log.*oneline|compact.*log|last \d+ commits", "git log --oneline -10", "Shows concise commit log."),
            (r"log|commit history", "git log --oneline", "Shows commit history."),
            (r"discard.*file|revert.*file|throw away.*changes to", "git checkout -- file.txt", "Discards working tree modifications for a file."),
            (r"unstage|take.*out of.*stage", "git reset HEAD file.txt", "Unstages a file from the index."),
            (r"squash.*commits|combine.*commits", "git rebase -i HEAD~3", "Starts interactive rebase to squash commits."),
            (r"cherry.?pick", "git cherry-pick abc1234", "Applies the specified commit onto current branch."),
            (r"force push", "git push --force origin main", "Overwrites remote branch with local changes."),
            (r"push", "git push origin main", "Pushes commits to the upstream repository."),
            (r"pull.*rebase", "git pull --rebase", "Fetches and rebases current branch on remote."),
            (r"pull", "git pull origin main", "Fetches and integrates remote changes."),
            (r"stage all|add -a|add \.", "git add -A", "Stages all changes and untracked files."),
            (r"stage.*interactive|add -p", "git add -p", "Interactively stages file hunks."),
            (r"clean.*untracked|delete.*untracked", "git clean -fd", "Removes untracked files and directories."),
            (r"create.*tag", "git tag v1.0", "Creates a lightweight tag at HEAD."),
            (r"list.*tags|all the tags", "git tag -l", "Lists all repository tags."),
            (r"blame|who changed each line", "git blame file.txt", "Shows line-by-line authorship of a file."),
            (r"revert.*commit", "git revert abc1234", "Creates a new commit undoing the specified commit."),
            (r"clone", "git clone https://github.com/user/repo.git", "Clones a remote repository."),
            (r"config.*user\.name|git username", "git config --global user.name 'Developer'", "Sets global Git username."),
            (r"bisect", "git bisect start", "Begins binary search for a bug-introducing commit."),
            (r"fetch --all|fetch all", "git fetch --all", "Fetches branches and tags from all remotes."),
            (r"remove.*tracking but keep|rm --cached", "git rm --cached file.txt", "Untracks a file while preserving disk copy."),
            (r"show.*commit", "git show --stat HEAD", "Inspects metadata and diff for a commit."),
        ]

        for pattern, cmd, expl in mapping:
            if re.search(pattern, g):
                risk = assess_risk(cmd)
                return NL2GitResult(
                    command=cmd,
                    risk_level=risk.level,
                    explanation=expl,
                    warning=risk.warning,
                    reversible=risk.reversible,
                    source="offline_fallback",
                )

        # Fallback default
        cmd = "git status"
        risk = assess_risk(cmd)
        return NL2GitResult(
            command=cmd,
            risk_level=risk.level,
            explanation="Shows repository status and current branch information.",
            warning=risk.warning,
            reversible=risk.reversible,
            source="offline_fallback",
        )
