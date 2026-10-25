-- =========================================================================
-- SmartLink Git Quiz — Pre-Event Question Bank Import
-- Generated automatically from Layer 3 Quality Gates
-- =========================================================================

BEGIN;

-- Clear active quiz questions if refreshing
DELETE FROM quiz_questions;
DELETE FROM options WHERE question_id IN (SELECT id FROM questions);
DELETE FROM questions;
DELETE FROM reserve_options;
DELETE FROM reserve_questions;

-- ─── 15 Main Questions ──────────────────────────────────────────────
INSERT INTO questions (id, text, difficulty, topic, points_base, is_active, explanation) VALUES ('cand_bas_eas_001', 'Which command initializes a brand-new Git repository in the current folder?', 'easy', 'basics', 1000, true, 'git init creates the .git metadata directory and begins tracking the current folder as a Git repository.');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('a5091465-3044-4fed-a085-03d8f0787584', 'cand_bas_eas_001', 'git start', false, 'A');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('f2d3697f-854e-420e-b0b9-d6e9b5ea6ede', 'cand_bas_eas_001', 'git init', true, 'B');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('d36edf15-15eb-42db-b00d-c9b2c660039f', 'cand_bas_eas_001', 'git new', false, 'C');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('f10909fb-d070-4b82-8316-c0c3552c2d59', 'cand_bas_eas_001', 'git create', false, 'D');
INSERT INTO quiz_questions (position, question_id) VALUES (1, 'cand_bas_eas_001');

INSERT INTO questions (id, text, difficulty, topic, points_base, is_active, explanation) VALUES ('cand_bas_eas_002', 'Which command shows the working tree status, staged files, and untracked files?', 'easy', 'basics', 1000, true, 'git status displays paths that have differences between the index file and the current HEAD commit.');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('489eb292-d46a-4324-9879-52c0c6c19aed', 'cand_bas_eas_002', 'git status', true, 'A');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('4e1d9797-dafc-41c1-bbaa-5f7857a0755c', 'cand_bas_eas_002', 'git inspect', false, 'B');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('11fc48dc-3a39-41bd-ad62-3117c32c9f2b', 'cand_bas_eas_002', 'git log --status', false, 'C');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('e2cd1c47-02a9-4d29-a27b-b72f633ad8be', 'cand_bas_eas_002', 'git info', false, 'D');
INSERT INTO quiz_questions (position, question_id) VALUES (2, 'cand_bas_eas_002');

INSERT INTO questions (id, text, difficulty, topic, points_base, is_active, explanation) VALUES ('cand_bas_med_006', 'Which command stages all modified and deleted files in the entire working directory?', 'medium', 'basics', 1000, true, 'git add -A (or git add --all) stages new, modified, and deleted files throughout the repository.');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('ad929384-9c28-41c8-aaba-d28fcf28b678', 'cand_bas_med_006', 'git add -A', true, 'A');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('df063e8f-4592-4a53-851d-cd4e7d92a40e', 'cand_bas_med_006', 'git add --current', false, 'B');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('8099b436-fac4-4cc1-af66-59a3ca77571c', 'cand_bas_med_006', 'git stage --only-tracked', false, 'C');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('fae3feb3-1b61-49dc-924f-95c64c40fa70', 'cand_bas_med_006', 'git commit --all-stage', false, 'D');
INSERT INTO quiz_questions (position, question_id) VALUES (3, 'cand_bas_med_006');

INSERT INTO questions (id, text, difficulty, topic, points_base, is_active, explanation) VALUES ('cand_bra_eas_011', 'Which command creates a new branch named ''feature-login'' without switching to it?', 'easy', 'branching', 1000, true, 'git branch <name> creates the branch pointer at HEAD without moving the current HEAD pointer.');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('1e0f56f6-340a-47c9-bf38-99df6157a12c', 'cand_bra_eas_011', 'git branch feature-login', true, 'A');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('da7c8eb8-6eb0-473e-8ca5-05448b39b0c6', 'cand_bra_eas_011', 'git switch -c feature-login', false, 'B');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('d77fa178-4f6c-4739-8ed6-17173575c70f', 'cand_bra_eas_011', 'git checkout -b feature-login', false, 'C');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('cca83d8f-821e-48ba-b78d-c3fdfe491d00', 'cand_bra_eas_011', 'git fork feature-login', false, 'D');
INSERT INTO quiz_questions (position, question_id) VALUES (4, 'cand_bra_eas_011');

INSERT INTO questions (id, text, difficulty, topic, points_base, is_active, explanation) VALUES ('cand_bra_med_016', 'Which modern command switches your working directory to an existing branch named ''dev''?', 'medium', 'branching', 1000, true, 'git switch was introduced in Git 2.23 as the clean, dedicated command for switching branches.');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('ce27fdca-c1de-4d82-b363-72d0e16775c7', 'cand_bra_med_016', 'git switch dev', true, 'A');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('5a369c70-ff7e-4744-8a03-6aa332fea0f9', 'cand_bra_med_016', 'git move dev', false, 'B');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('e3373bd8-332d-4bd1-817b-b4da96da8740', 'cand_bra_med_016', 'git branch --goto dev', false, 'C');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('aeefe606-db14-4dc3-8388-3ddfdbed124c', 'cand_bra_med_016', 'git transfer dev', false, 'D');
INSERT INTO quiz_questions (position, question_id) VALUES (5, 'cand_bra_med_016');

INSERT INTO questions (id, text, difficulty, topic, points_base, is_active, explanation) VALUES ('cand_bra_med_017', 'You are on branch ''main''. Which command incorporates all commits from ''feature'' into ''main''?', 'medium', 'branching', 1000, true, 'git merge <branch> joins the specified branch''s history into the current active branch.');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('1d459218-cff8-4a38-ba3b-7d3e82583dc6', 'cand_bra_med_017', 'git merge feature', true, 'A');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('bbb122cb-9575-47dc-94ed-7d11cb9afb2e', 'cand_bra_med_017', 'git combine feature', false, 'B');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('cd3526b7-cb30-4e74-81f1-790b920bd4d3', 'cand_bra_med_017', 'git branch --join feature', false, 'C');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('7b13d8c8-9347-422f-97a7-a2b67c9ed137', 'cand_bra_med_017', 'git pull feature', false, 'D');
INSERT INTO quiz_questions (position, question_id) VALUES (6, 'cand_bra_med_017');

INSERT INTO questions (id, text, difficulty, topic, points_base, is_active, explanation) VALUES ('cand_bra_har_021', 'Which command aborts an ongoing merge conflict and restores the working tree to pre-merge state?', 'hard', 'branching', 1000, true, 'git merge --abort safely cleans up conflicts and resets HEAD to where it was before the merge began.');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('8149b5ea-2cb2-4e19-997a-8f5f5cfbaca8', 'cand_bra_har_021', 'git merge --abort', true, 'A');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('b93c1029-3319-4a4e-a675-638da03e1251', 'cand_bra_har_021', 'git merge --cancel', false, 'B');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('d0841164-d19c-400b-963f-5fee4950cb01', 'cand_bra_har_021', 'git undo merge', false, 'C');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('9f0cff67-b5af-4848-b3ef-7df3d683b956', 'cand_bra_har_021', 'git checkout --cancel-merge', false, 'D');
INSERT INTO quiz_questions (position, question_id) VALUES (7, 'cand_bra_har_021');

INSERT INTO questions (id, text, difficulty, topic, points_base, is_active, explanation) VALUES ('cand_rem_eas_026', 'Which command downloads a copy of an existing remote repository onto your local computer?', 'easy', 'remote', 1000, true, 'git clone copies the remote repository, sets up tracking branches, and checks out the default branch.');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('6b6c798a-bbf8-4fff-a574-6edc1d95385c', 'cand_rem_eas_026', 'git clone <url>', true, 'A');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('1f635e08-4afc-4be0-a6cf-12e8469b372d', 'cand_rem_eas_026', 'git download <url>', false, 'B');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('9ec01921-17dc-4e81-a36d-6f4390b054b4', 'cand_rem_eas_026', 'git fetch --all <url>', false, 'C');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('59f0fc0d-a7de-4ee4-ae47-8e8ed9392438', 'cand_rem_eas_026', 'git import <url>', false, 'D');
INSERT INTO quiz_questions (position, question_id) VALUES (8, 'cand_rem_eas_026');

INSERT INTO questions (id, text, difficulty, topic, points_base, is_active, explanation) VALUES ('cand_rem_med_031', 'What is the difference between ''git fetch'' and ''git pull''?', 'medium', 'remote', 1000, true, 'git pull is essentially a shortcut for running git fetch followed by git merge FETCH_HEAD.');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('3f58719d-bfe5-4a24-ab83-142a219106e9', 'cand_rem_med_031', 'git fetch downloads objects without merging; git pull fetches and merges into the current branch', true, 'A');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('66d4e6c6-d582-472d-aeee-b20c949ed387', 'cand_rem_med_031', 'git fetch works over SSH while git pull works only over HTTPS', false, 'B');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('24aff31d-2864-43ca-9f0f-80f30d6a0bff', 'cand_rem_med_031', 'git pull only updates tags while git fetch updates code files', false, 'C');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('ec6ff28c-0e3d-4da0-8b45-a31bb92e98ca', 'cand_rem_med_031', 'There is no difference; they are aliases for the same underlying operation', false, 'D');
INSERT INTO quiz_questions (position, question_id) VALUES (9, 'cand_rem_med_031');

INSERT INTO questions (id, text, difficulty, topic, points_base, is_active, explanation) VALUES ('cand_rem_har_036', 'Which command uploads a new local branch ''experiment'' and configures upstream tracking to origin?', 'hard', 'remote', 1000, true, 'The -u (or --set-upstream) flag links the local branch to the remote branch on origin for future git pull/push.');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('cb2edb6a-3d5d-451d-8b7c-8e2d50dd5a56', 'cand_rem_har_036', 'git push -u origin experiment', true, 'A');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('f31e75cc-0c2d-4aa6-9961-73f68c3685e7', 'cand_rem_har_036', 'git push --track experiment', false, 'B');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('6993db3e-a761-4641-b771-b9116f00147f', 'cand_rem_har_036', 'git remote push experiment', false, 'C');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('8cd2c036-3a4b-4d82-97c8-e2991b93ef6c', 'cand_rem_har_036', 'git push origin --bind experiment', false, 'D');
INSERT INTO quiz_questions (position, question_id) VALUES (10, 'cand_rem_har_036');

INSERT INTO questions (id, text, difficulty, topic, points_base, is_active, explanation) VALUES ('cand_und_eas_041', 'Which command unstages a file ''app.js'' from the staging area without discarding working edits?', 'easy', 'undoing', 1000, true, 'git restore --staged removes the specified file from the index while keeping modifications in the working tree.');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('ca83d907-a2be-480f-a10f-c2576c768a90', 'cand_und_eas_041', 'git restore --staged app.js', true, 'A');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('51e57a87-c59b-4069-9489-414643100b4e', 'cand_und_eas_041', 'git discard --cached app.js', false, 'B');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('f8fb4e51-ac16-4bf8-a152-54e21d29d0be', 'cand_und_eas_041', 'git clean app.js', false, 'C');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('a9014711-294f-4ac3-b9f4-398f56b50054', 'cand_und_eas_041', 'git revert app.js', false, 'D');
INSERT INTO quiz_questions (position, question_id) VALUES (11, 'cand_und_eas_041');

INSERT INTO questions (id, text, difficulty, topic, points_base, is_active, explanation) VALUES ('cand_und_med_046', 'You want to create a new commit that exactly inverts the changes of a faulty commit. Which command should you use?', 'medium', 'undoing', 1000, true, 'git revert safely produces a new commit that records the exact inverse of the targeted commit.');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('9892b6ef-218f-4fb7-b81e-a0911209d8c9', 'cand_und_med_046', 'git revert <commit-hash>', true, 'A');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('3a5f87d0-c246-4e99-b51d-750d13f00c55', 'cand_und_med_046', 'git reset --soft <commit-hash>', false, 'B');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('1691d914-7f22-4c68-aa7f-40ce84b3a62e', 'cand_und_med_046', 'git drop <commit-hash>', false, 'C');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('049e5aae-de64-4811-8cc7-d6b5c21efa08', 'cand_und_med_046', 'git checkout --inverse <commit-hash>', false, 'D');
INSERT INTO quiz_questions (position, question_id) VALUES (12, 'cand_und_med_046');

INSERT INTO questions (id, text, difficulty, topic, points_base, is_active, explanation) VALUES ('cand_und_har_051', 'You need to undo the last commit while keeping all its modified files in the staging area. What is the command?', 'hard', 'undoing', 1000, true, 'git reset --soft moves HEAD back one commit without touching the index or working tree.');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('c5e22900-b266-4688-970c-64fa43b78baf', 'cand_und_har_051', 'git reset --soft HEAD~1', true, 'A');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('49b55391-da7b-4eba-a704-879b7ea4b6e8', 'cand_und_har_051', 'git reset --hard HEAD~1', false, 'B');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('80f2cc52-d794-4043-8b5e-4d294817a224', 'cand_und_har_051', 'git revert --soft HEAD', false, 'C');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('0ccc881d-af06-49e9-b370-f2330bcb118c', 'cand_und_har_051', 'git checkout HEAD~1 --staged', false, 'D');
INSERT INTO quiz_questions (position, question_id) VALUES (13, 'cand_und_har_051');

INSERT INTO questions (id, text, difficulty, topic, points_base, is_active, explanation) VALUES ('cand_und_har_052', 'You accidentally ran ''git reset --hard'' and lost unpushed commits. Where can you find their commit hashes?', 'hard', 'undoing', 1000, true, 'git reflog records every update to the tip of branches and HEAD, allowing recovery of lost commits.');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('cbfe78a7-31a5-453b-9dbb-3a3608b9be73', 'cand_und_har_052', 'git reflog', true, 'A');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('a99d6c6e-68d1-466e-8893-60ba6fc59b17', 'cand_und_har_052', 'git log --lost', false, 'B');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('f33ab1a1-593f-422b-b070-25e2313bbd59', 'cand_und_har_052', 'git fsck --undo', false, 'C');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('225602c4-fe26-47fc-aedf-fdf8ba5c84b9', 'cand_und_har_052', 'git status --history', false, 'D');
INSERT INTO quiz_questions (position, question_id) VALUES (14, 'cand_und_har_052');

INSERT INTO questions (id, text, difficulty, topic, points_base, is_active, explanation) VALUES ('cand_adv_har_056', 'Which command applies the exact changes introduced by commit ''a1b2c3d'' from another branch onto your branch?', 'hard', 'advanced', 1000, true, 'git cherry-pick applies the changes recorded by an existing commit to your current branch as a new commit.');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('db0081a9-c579-4a21-b74e-1b4c08c70a0f', 'cand_adv_har_056', 'git cherry-pick a1b2c3d', true, 'A');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('8a57aefc-2067-4d69-b309-76c7bd7cd81a', 'cand_adv_har_056', 'git rebase --single a1b2c3d', false, 'B');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('edcc2f1c-9ce2-41df-aade-8f60e9fd4db5', 'cand_adv_har_056', 'git apply-commit a1b2c3d', false, 'C');
INSERT INTO options (id, question_id, text, is_correct, label) VALUES ('4fe300c0-4e12-4fc1-b689-9c2b74f54772', 'cand_adv_har_056', 'git merge --only a1b2c3d', false, 'D');
INSERT INTO quiz_questions (position, question_id) VALUES (15, 'cand_adv_har_056');

-- ─── 5 Reserve Questions (Sudden-Death & Tiebreaker Pool) ─────────
INSERT INTO reserve_questions (id, text, difficulty, topic, explanation, is_used) VALUES ('cand_bra_har_022', 'Which command aborts an ongoing merge conflict and restores the working tree to pre-merge state?', 'hard', 'branching', 'git merge --abort safely cleans up conflicts and resets HEAD to where it was before the merge began.', false);
INSERT INTO reserve_options (id, question_id, text, is_correct, label) VALUES ('5dcf1397-1603-473f-a576-9f7574012858', 'cand_bra_har_022', 'git merge --abort', true, 'A');
INSERT INTO reserve_options (id, question_id, text, is_correct, label) VALUES ('3a1c21f4-f0cb-47e8-b58b-678ff48dc72a', 'cand_bra_har_022', 'git merge --cancel', false, 'B');
INSERT INTO reserve_options (id, question_id, text, is_correct, label) VALUES ('d79408e5-117c-473e-9094-a35e5ef021f2', 'cand_bra_har_022', 'git undo merge', false, 'C');
INSERT INTO reserve_options (id, question_id, text, is_correct, label) VALUES ('55118408-852b-4fcc-b50a-ecce039d5c58', 'cand_bra_har_022', 'git checkout --cancel-merge', false, 'D');

INSERT INTO reserve_questions (id, text, difficulty, topic, explanation, is_used) VALUES ('cand_bra_har_023', 'Which command aborts an ongoing merge conflict and restores the working tree to pre-merge state?', 'hard', 'branching', 'git merge --abort safely cleans up conflicts and resets HEAD to where it was before the merge began.', false);
INSERT INTO reserve_options (id, question_id, text, is_correct, label) VALUES ('210e4de0-05a3-4b50-8e94-5d2bd88cbfb5', 'cand_bra_har_023', 'git merge --abort', true, 'A');
INSERT INTO reserve_options (id, question_id, text, is_correct, label) VALUES ('4b11722d-48c7-4218-92b7-26af13601b03', 'cand_bra_har_023', 'git merge --cancel', false, 'B');
INSERT INTO reserve_options (id, question_id, text, is_correct, label) VALUES ('5306f5e2-9cf1-4ff2-a61c-4eb4778b4554', 'cand_bra_har_023', 'git undo merge', false, 'C');
INSERT INTO reserve_options (id, question_id, text, is_correct, label) VALUES ('65c5d16c-a269-45ac-95cc-f0a3894bd31d', 'cand_bra_har_023', 'git checkout --cancel-merge', false, 'D');

INSERT INTO reserve_questions (id, text, difficulty, topic, explanation, is_used) VALUES ('cand_bra_har_024', 'Which command aborts an ongoing merge conflict and restores the working tree to pre-merge state?', 'hard', 'branching', 'git merge --abort safely cleans up conflicts and resets HEAD to where it was before the merge began.', false);
INSERT INTO reserve_options (id, question_id, text, is_correct, label) VALUES ('ccfb08ce-eeab-4345-a793-5f9f77aa508b', 'cand_bra_har_024', 'git merge --abort', true, 'A');
INSERT INTO reserve_options (id, question_id, text, is_correct, label) VALUES ('76af8803-d187-4d22-b352-385cc015de67', 'cand_bra_har_024', 'git merge --cancel', false, 'B');
INSERT INTO reserve_options (id, question_id, text, is_correct, label) VALUES ('0436d144-dd2d-4307-9e2a-08edd67cc716', 'cand_bra_har_024', 'git undo merge', false, 'C');
INSERT INTO reserve_options (id, question_id, text, is_correct, label) VALUES ('b6df0e9f-bed4-40a0-bea3-fcc1c9223169', 'cand_bra_har_024', 'git checkout --cancel-merge', false, 'D');

INSERT INTO reserve_questions (id, text, difficulty, topic, explanation, is_used) VALUES ('cand_bra_har_025', 'Which command aborts an ongoing merge conflict and restores the working tree to pre-merge state?', 'hard', 'branching', 'git merge --abort safely cleans up conflicts and resets HEAD to where it was before the merge began.', false);
INSERT INTO reserve_options (id, question_id, text, is_correct, label) VALUES ('e40d249c-2bac-41de-beb7-c2e291b94096', 'cand_bra_har_025', 'git merge --abort', true, 'A');
INSERT INTO reserve_options (id, question_id, text, is_correct, label) VALUES ('1168111b-43d0-4716-9b62-c8c75f7b282f', 'cand_bra_har_025', 'git merge --cancel', false, 'B');
INSERT INTO reserve_options (id, question_id, text, is_correct, label) VALUES ('b1b3fae3-5307-467e-aa5a-fc6bcf038a8f', 'cand_bra_har_025', 'git undo merge', false, 'C');
INSERT INTO reserve_options (id, question_id, text, is_correct, label) VALUES ('a3e66c2f-150d-42c2-8695-faddf51f3138', 'cand_bra_har_025', 'git checkout --cancel-merge', false, 'D');

INSERT INTO reserve_questions (id, text, difficulty, topic, explanation, is_used) VALUES ('cand_rem_har_037', 'Which command uploads a new local branch ''experiment'' and configures upstream tracking to origin?', 'hard', 'remote', 'The -u (or --set-upstream) flag links the local branch to the remote branch on origin for future git pull/push.', false);
INSERT INTO reserve_options (id, question_id, text, is_correct, label) VALUES ('c972db3e-42ab-4435-8f5e-cbafd43d6706', 'cand_rem_har_037', 'git push -u origin experiment', true, 'A');
INSERT INTO reserve_options (id, question_id, text, is_correct, label) VALUES ('25fa6118-d334-43a3-aa50-d9d06c37e14b', 'cand_rem_har_037', 'git push --track experiment', false, 'B');
INSERT INTO reserve_options (id, question_id, text, is_correct, label) VALUES ('7c9433d7-85db-4e3c-915c-e1d04ec24157', 'cand_rem_har_037', 'git remote push experiment', false, 'C');
INSERT INTO reserve_options (id, question_id, text, is_correct, label) VALUES ('6d3a1d7a-17e7-4288-aa2d-6646c25a5c36', 'cand_rem_har_037', 'git push origin --bind experiment', false, 'D');

COMMIT;