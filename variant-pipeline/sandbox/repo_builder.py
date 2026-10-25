# variant-pipeline/sandbox/repo_builder.py
"""
Build a Git repo from a list of setup commands.
Handles parameter substitution and implicit git init.
"""

from sandbox.git_runner import GitSandbox, SandboxResult


def build_repo(sandbox: GitSandbox, setup_commands: list[str],
               params: dict = None) -> list[SandboxResult]:
    """Execute setup commands in order to build starting repo state."""
    params = params or {}
    results = []

    commands = list(setup_commands)
    if not commands or 'init' not in commands[0]:
        commands.insert(0, 'git init')

    for cmd in commands:
        rendered = cmd
        for k, v in params.items():
            rendered = rendered.replace(f'{{{k}}}', str(v))

        result = sandbox.run_setup_command(rendered)
        results.append(result)

    return results
