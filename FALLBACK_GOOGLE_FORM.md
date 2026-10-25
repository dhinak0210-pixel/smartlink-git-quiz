# Fallback Google Form Template — SmartLink Git Quiz

This document contains the exact question bank, option keys, and Google Form configuration for the emergency fallback mechanism activated via the Kill Switch (`POST /api/admin/kill-switch`).

---

## Google Form Setup Instructions
1. Create a new Google Form titled: **"SmartLink Git Quiz — Official Competition (Emergency Session)"**
2. In Settings:
   - Check **"Make this a quiz"**
   - Check **"Collect email addresses"** (Verified / College emails)
   - Limit to **1 response per contestant**
   - Uncheck "Show answers immediately" (Prevent mid-event answer sharing)
3. Set Question 1–15 as Multiple Choice (1 point each).

---

## Question Bank & Key (15 Questions)

### Question 1 (Basics)
**Prompt:** What command initializes a new Git repository in the current working directory?
- [ ] A) `git start`
- [x] B) `git init` *(Correct)*
- [ ] C) `git create`
- [ ] D) `git new`
*Explanation:* `git init` creates a new `.git` directory containing Git object database and metadata.

---

### Question 2 (Basics)
**Prompt:** Which command shows the chronological commit history of the current repository?
- [ ] A) `git history`
- [x] B) `git log` *(Correct)*
- [ ] C) `git show-all`
- [ ] D) `git commits`
*Explanation:* `git log` displays committed history in reverse chronological order.

---

### Question 3 (Staging)
**Prompt:** How do you stage all modified and newly created files in the repository?
- [x] A) `git add .` *(Correct)*
- [ ] B) `git stage --everything`
- [ ] C) `git commit -a`
- [ ] D) `git include --all`
*Explanation:* `git add .` adds all file modifications and untracked files in the current tree to the index.

---

### Question 4 (Branches)
**Prompt:** Which command creates a new branch named `feature-auth` and switches to it in one step?
- [ ] A) `git branch -c feature-auth`
- [x] B) `git checkout -b feature-auth` *(Correct)*
- [ ] C) `git switch feature-auth --new`
- [ ] D) `git branch --jump feature-auth`
*Explanation:* `git checkout -b <branch>` creates the branch and updates HEAD to it. Alternatively, `git switch -c`.

---

### Question 5 (Inspection)
**Prompt:** What command displays changes between the working directory and the staging area (index)?
- [ ] A) `git show`
- [x] B) `git diff` *(Correct)*
- [ ] C) `git status -v`
- [ ] D) `git compare`
*Explanation:* `git diff` shows unstaged modifications in working directory compared to index.

---

### Question 6 (Inspection)
**Prompt:** What command shows changes that have been staged for the next commit?
- [x] A) `git diff --staged` *(Correct)*
- [ ] B) `git diff --cached-only`
- [ ] C) `git status --diff`
- [ ] D) `git show --index`
*Explanation:* `git diff --staged` (or `--cached`) compares staged changes against HEAD.

---

### Question 7 (Undoing Changes)
**Prompt:** Which command removes a file from the staging area while preserving your working directory edits?
- [ ] A) `git discard <file>`
- [x] B) `git restore --staged <file>` *(Correct)*
- [ ] C) `git clean <file>`
- [ ] D) `git rm --cached <file>`
*Explanation:* `git restore --staged <file>` unstages the file without modifying its contents on disk.

---

### Question 8 (Undoing Changes)
**Prompt:** What does `git reset --soft HEAD~1` do?
- [x] A) Moves HEAD back one commit, keeping changes in the staging area *(Correct)*
- [ ] B) Deletes the last commit and all working files
- [ ] C) Moves HEAD back one commit and unstages all files
- [ ] D) Creates a revert commit preserving history
*Explanation:* `--soft` resets HEAD without touching the index or working tree.

---

### Question 9 (Remotes)
**Prompt:** Which command downloads commits and branches from a remote repository without merging them into your current branch?
- [ ] A) `git pull`
- [x] B) `git fetch` *(Correct)*
- [ ] C) `git sync`
- [ ] D) `git clone --update`
*Explanation:* `git fetch` downloads remote refs and objects without altering your active branch.

---

### Question 10 (Stashing)
**Prompt:** How do you temporarily save uncommitted changes without creating a permanent commit?
- [ ] A) `git pause`
- [x] B) `git stash` *(Correct)*
- [ ] C) `git store`
- [ ] D) `git shelve`
*Explanation:* `git stash` saves modified tracked files on a stack and reverts working directory to HEAD.

---

### Question 11 (Cherry-Picking)
**Prompt:** What command applies the changes from an existing commit on another branch onto your current branch?
- [ ] A) `git graft <hash>`
- [x] B) `git cherry-pick <hash>` *(Correct)*
- [ ] C) `git copy-commit <hash>`
- [ ] D) `git apply-ref <hash>`
*Explanation:* `git cherry-pick` introduces the diff of a specific commit as a new commit on HEAD.

---

### Question 12 (Rebasing)
**Prompt:** What is the primary difference between `git merge` and `git rebase`?
- [x] A) `git merge` creates a merge commit preserving parallel history; `git rebase` rewrites commits on top of the base for linear history *(Correct)*
- [ ] B) `git rebase` cannot resolve merge conflicts
- [ ] C) `git merge` only works with local branches
- [ ] D) `git rebase` is only used for remote repositories
*Explanation:* Rebasing re-applies commits sequentially on a new base tip, creating a linear project history.

---

### Question 13 (Tags)
**Prompt:** Which command creates an annotated tag `v1.0.0` with a message?
- [ ] A) `git tag v1.0.0 "Release 1.0.0"`
- [x] B) `git tag -a v1.0.0 -m "Release 1.0.0"` *(Correct)*
- [ ] C) `git create-tag v1.0.0`
- [ ] D) `git mark v1.0.0 -a`
*Explanation:* `-a` creates an annotated tag object containing tagger name, email, date, and message.

---

### Question 14 (Reflog)
**Prompt:** If you accidentally delete a branch containing unmerged commits, how can you find the lost commit hash?
- [ ] A) `git search-lost`
- [x] B) `git reflog` *(Correct)*
- [ ] C) `git history --deleted`
- [ ] D) `git restore --all`
*Explanation:* `git reflog` logs every update to tip of branches and HEAD, allowing recovery of unreachable commits.

---

### Question 15 (Internals)
**Prompt:** What type of data structure does Git use to represent repository history and files?
- [ ] A) B-Tree
- [x] B) Directed Acyclic Graph (DAG) with SHA-1/SHA-256 Merkle trees *(Correct)*
- [ ] C) Relational schema with foreign keys
- [ ] D) Doubly Linked List of patches
*Explanation:* Git models commit graphs as Directed Acyclic Graphs referencing content-addressed Merkle trees.

---

## Live Failover Deployment Checklist
1. Open Google Form responses spreadsheet.
2. If platform triggers killswitch, the student screen displays the link:
   `https://forms.google.com/d/e/.../viewform`
3. Export Google Sheet responses as CSV.
4. Run grading verification script:
   ```bash
   node scripts/compute-flags.js --csv google_form_responses.csv
   ```
