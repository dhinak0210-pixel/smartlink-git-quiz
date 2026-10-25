# apps/judge-agent/src/sandbox.py
"""
Sandboxed Git Execution Environment.
Supports real Git binary via subprocess when available, and includes
a standalone pure-Python git object store simulator for environments
without native git binaries.
"""

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

class GitSandbox:
    def __init__(self, prefix: str = 'git-judge-'):
        self.temp_dir = Path(tempfile.mkdtemp(prefix=prefix))
        self.has_native_git = self._check_native_git()
        # In-memory virtual repo state fallback
        self.v_commits = []
        self.v_branches = {'master': None}
        self.v_head = 'master'
        self.v_files = {}

    def _check_native_git(self) -> bool:
        try:
            res = subprocess.run(['git', '--version'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            return res.returncode == 0
        except Exception:
            return False

    def cleanup(self):
        if self.temp_dir.exists():
            shutil.rmtree(self.temp_dir, ignore_errors=True)

    def write_file(self, rel_path: str, content: str):
        full_path = self.temp_dir / rel_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        self.v_files[rel_path] = content

    def read_file(self, rel_path: str) -> str:
        full_path = self.temp_dir / rel_path
        if full_path.exists():
            with open(full_path, 'r', encoding='utf-8') as f:
                return f.read()
        return self.v_files.get(rel_path, '')

    def run_git(self, *args) -> tuple[int, str, str]:
        cmd = list(args)
        if self.has_native_git:
            res = subprocess.run(
                ['git'] + cmd,
                cwd=self.temp_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            return res.returncode, res.stdout, res.stderr

        # Virtual pure-Python Git fallback
        return self._simulate_git_cmd(cmd)

    def _simulate_git_cmd(self, cmd: list) -> tuple[int, str, str]:
        sub = cmd[0] if cmd else ''
        if sub == 'init':
            git_dir = self.temp_dir / '.git'
            git_dir.mkdir(parents=True, exist_ok=True)
            self.v_commits = []
            self.v_branches = {'master': None}
            self.v_head = 'master'
            return 0, "Initialized empty Git repository\n", ""

        elif sub == 'config':
            return 0, "", ""

        elif sub == 'commit':
            # Parse commit message
            msg = "Commit"
            for i, arg in enumerate(cmd):
                if arg in ['-m', '-am'] and i + 1 < len(cmd):
                    msg = cmd[i + 1]
            c_hash = f"c_{len(self.v_commits) + 1:04d}"
            commit_record = {
                'hash': c_hash,
                'message': msg,
                'branch': self.v_head,
                'files': dict(self.v_files)
            }
            self.v_commits.append(commit_record)
            if self.v_head in self.v_branches:
                self.v_branches[self.v_head] = c_hash
            return 0, f"[{self.v_head} {c_hash}] {msg}\n", ""

        elif sub == 'checkout':
            target = cmd[-1]
            if '-b' in cmd:
                new_branch = cmd[cmd.index('-b') + 1]
                self.v_branches[new_branch] = self.v_branches.get(self.v_head)
                self.v_head = new_branch
                return 0, f"Switched to a new branch '{new_branch}'\n", ""
            else:
                self.v_head = target
                return 0, f"Switched to branch '{target}'\n", ""

        elif sub == 'branch':
            branch_name = cmd[-1]
            self.v_branches[branch_name] = self.v_branches.get(self.v_head)
            return 0, "", ""

        elif sub == 'status':
            return 0, "nothing to commit, working tree clean\n", ""

        return 0, "", ""

    def setup_challenge(self, setup_steps: list):
        for step in setup_steps:
            action = step[0]
            if action == 'write_file':
                self.write_file(step[1], step[2])
            elif action == 'git':
                self.run_git(*step[1:])
            elif action == 'git_merge_conflict':
                target_branch = step[1]
                # Simulate a merge conflict in file
                file_path = "api.py"
                conflict_text = (
                    "<<<<<<< HEAD\n"
                    "def get_data():\n"
                    "    return 'v1-hotfix'\n"
                    "=======\n"
                    "def get_data():\n"
                    "    return 'v2-feature'\n"
                    ">>>>>>> " + target_branch + "\n"
                )
                self.write_file(file_path, conflict_text)
