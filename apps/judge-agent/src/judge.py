# apps/judge-agent/src/judge.py
"""
Git Challenge Verification & Grading Engine.
Inspects repository state against verification criteria and provides
detailed pedagogical feedback.
"""

import json
from pathlib import Path
from sandbox import GitSandbox

class GitJudge:
    def __init__(self, challenges_file: str = None):
        if challenges_file is None:
            challenges_file = str(Path(__file__).parent / 'challenges.json')
        with open(challenges_file, 'r', encoding='utf-8') as f:
            self.challenges = {c['id']: c for c in json.load(f)}

    def get_challenge(self, challenge_id: str) -> dict | None:
        return self.challenges.get(challenge_id)

    def evaluate(self, sandbox: GitSandbox, challenge_id: str) -> dict:
        challenge = self.get_challenge(challenge_id)
        if not challenge:
            return {'passed': False, 'score': 0, 'feedback': [f"Unknown challenge: {challenge_id}"]}

        verification = challenge.get('verification', {})
        feedback = []
        passed = True

        # 1. Total commits check
        if 'total_commits' in verification:
            expected_commits = verification['total_commits']
            if sandbox.has_native_git:
                rc, out, _ = sandbox.run_git('rev-list', '--count', 'HEAD')
                actual_commits = int(out.strip()) if rc == 0 and out.strip().isdigit() else 0
            else:
                actual_commits = len(sandbox.v_commits)

            if actual_commits != expected_commits:
                passed = False
                feedback.append(f"Expected {expected_commits} commits in branch history, found {actual_commits}.")
            else:
                feedback.append(f"✅ Correct commit count ({actual_commits}).")

        # 2. HEAD commit message check
        if 'head_commit_message' in verification:
            expected_msg = verification['head_commit_message']
            if sandbox.has_native_git:
                rc, out, _ = sandbox.run_git('log', '-1', '--pretty=%B')
                actual_msg = out.strip() if rc == 0 else ''
            else:
                actual_msg = sandbox.v_commits[-1]['message'] if sandbox.v_commits else ''

            if expected_msg not in actual_msg:
                passed = False
                feedback.append(f"HEAD commit message mismatch. Expected '{expected_msg}', got '{actual_msg}'.")
            else:
                feedback.append(f"✅ HEAD commit message matches expectation.")

        # 3. File content check
        if 'file_contains' in verification:
            for filename, expected_snippet in verification['file_contains'].items():
                content = sandbox.read_file(filename)
                if expected_snippet.strip() not in content:
                    passed = False
                    feedback.append(f"File '{filename}' does not contain expected snippet.")
                else:
                    feedback.append(f"✅ File '{filename}' verified.")

        # 4. Conflict markers check
        if 'no_conflict_markers' in verification:
            for filename in verification['no_conflict_markers']:
                content = sandbox.read_file(filename)
                markers = ['<<<<<<<', '=======', '>>>>>>>']
                found_markers = [m for m in markers if m in content]
                if found_markers:
                    passed = False
                    feedback.append(f"File '{filename}' still contains unresolved Git conflict markers ({', '.join(found_markers)}).")
                else:
                    feedback.append(f"✅ File '{filename}' has no unresolved conflict markers.")

        # 5. Branch existence check
        if 'branch_exists' in verification:
            branch_name = verification['branch_exists']
            if sandbox.has_native_git:
                rc, out, _ = sandbox.run_git('branch', '--list', branch_name)
                branch_found = (rc == 0 and branch_name in out)
            else:
                branch_found = branch_name in sandbox.v_branches

            if not branch_found:
                passed = False
                feedback.append(f"Required branch '{branch_name}' was not found.")
            else:
                feedback.append(f"✅ Branch '{branch_name}' exists.")

        # 6. Working tree clean check
        if verification.get('working_tree_clean'):
            if sandbox.has_native_git:
                rc, out, _ = sandbox.run_git('status', '--porcelain')
                is_clean = (rc == 0 and len(out.strip()) == 0)
            else:
                is_clean = True

            if not is_clean:
                passed = False
                feedback.append("Working directory has unstaged or uncommitted changes.")
            else:
                feedback.append("✅ Working directory is clean.")

        score = 100 if passed else max(0, 100 - len([f for f in feedback if not f.startswith('✅')]) * 30)
        return {
            'passed': passed,
            'score': score,
            'challenge_id': challenge_id,
            'feedback': feedback
        }
