# apps/judge-agent/src/test_judge.py
"""
Test suite for Git Judge Agent.
"""

import unittest
from sandbox import GitSandbox
from judge import GitJudge

class TestGitJudge(unittest.TestCase):
    def setUp(self):
        self.judge = GitJudge()

    def test_rebase_squash_resolution(self):
        sandbox = GitSandbox()
        challenge = self.judge.get_challenge('rebase-squash')
        sandbox.setup_challenge(challenge['setup_steps'])

        # Before student resolution: 4 commits, should fail
        result_before = self.judge.evaluate(sandbox, 'rebase-squash')
        self.assertFalse(result_before['passed'])

        # Simulate student squash into 2 commits with target commit message
        sandbox.v_commits = [
            {'hash': 'c_0001', 'message': 'Initial commit', 'branch': 'master', 'files': {}},
            {'hash': 'c_0002', 'message': 'feat: consolidated authentication flow', 'branch': 'master', 'files': {}}
        ]
        result_after = self.judge.evaluate(sandbox, 'rebase-squash')
        self.assertTrue(result_after['passed'])
        self.assertEqual(result_after['score'], 100)
        sandbox.cleanup()

    def test_merge_conflict_unresolved(self):
        sandbox = GitSandbox()
        challenge = self.judge.get_challenge('merge-conflict')
        sandbox.setup_challenge(challenge['setup_steps'])

        # Conflict is currently unresolved (contains <<<<<<<)
        result = self.judge.evaluate(sandbox, 'merge-conflict')
        self.assertFalse(result['passed'])
        self.assertTrue(any('conflict markers' in f for f in result['feedback']))
        sandbox.cleanup()

    def test_merge_conflict_resolved(self):
        sandbox = GitSandbox()
        challenge = self.judge.get_challenge('merge-conflict')
        sandbox.setup_challenge(challenge['setup_steps'])

        # Student resolves conflict cleanly
        sandbox.write_file('api.py', "def get_data():\n    return 'v2-feature'\n")
        result = self.judge.evaluate(sandbox, 'merge-conflict')
        self.assertTrue(result['passed'])
        self.assertEqual(result['score'], 100)
        sandbox.cleanup()

    def test_detached_head_recovery(self):
        sandbox = GitSandbox()
        challenge = self.judge.get_challenge('detached-head-recovery')
        sandbox.setup_challenge(challenge['setup_steps'])

        # Missing branch initially
        res_before = self.judge.evaluate(sandbox, 'detached-head-recovery')
        self.assertFalse(res_before['passed'])

        # Student creates required branch and recovers file
        sandbox.run_git('branch', 'fix/orphaned-auth')
        sandbox.write_file('auth_patch.py', "AUTHENTICATION_KEY = 'SECURE_RECOVERED'\n")
        res_after = self.judge.evaluate(sandbox, 'detached-head-recovery')
        self.assertTrue(res_after['passed'])
        sandbox.cleanup()

if __name__ == '__main__':
    unittest.main()
