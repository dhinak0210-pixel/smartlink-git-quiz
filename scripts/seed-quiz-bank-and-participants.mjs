// scripts/seed-quiz-bank-and-participants.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';

// -------------------------------------------------------------
// 1. OFFICIAL 20 QUESTIONS FROM "SmartLink Git Quiz Question Bank.pdf"
// -------------------------------------------------------------
export const OFFICIAL_PDF_QUESTIONS = [
  // --- 5 EASY (Competition Q1 - Q5) ---
  {
    num: 1,
    difficulty: 'easy',
    topic: 'basics',
    text: 'Which command turns the current folder into a new Git repository?',
    explanation: 'git init creates the hidden .git folder that stores the repository. The other three are not Git commands.',
    points_base: 1000,
    options: [
      { label: 'A', text: 'git start', is_correct: false },
      { label: 'B', text: 'git init', is_correct: true },
      { label: 'C', text: 'git new', is_correct: false },
      { label: 'D', text: 'git create', is_correct: false },
    ],
    correct_index: 1,
  },
  {
    num: 2,
    difficulty: 'easy',
    topic: 'basics',
    text: 'Which command shows which files are modified, staged, or untracked?',
    explanation: 'git status lists staged, modified and untracked files. git diff --stat ignores untracked files, git log shows history, and git show displays a single commit.',
    points_base: 1000,
    options: [
      { label: 'A', text: 'git log', is_correct: false },
      { label: 'B', text: 'git diff --stat', is_correct: false },
      { label: 'C', text: 'git status', is_correct: true },
      { label: 'D', text: 'git show', is_correct: false },
    ],
    correct_index: 2,
  },
  {
    num: 3,
    difficulty: 'easy',
    topic: 'branching',
    text: 'You want to create a new branch called feature and switch to it in one command. Which one?',
    explanation: 'The -c flag creates the branch and switches to it. git branch only creates it, and git checkout or git switch without -c fail when the branch does not exist yet.',
    points_base: 1000,
    options: [
      { label: 'A', text: 'git branch feature', is_correct: false },
      { label: 'B', text: 'git checkout feature', is_correct: false },
      { label: 'C', text: 'git switch feature', is_correct: false },
      { label: 'D', text: 'git switch -c feature', is_correct: true },
    ],
    correct_index: 3,
  },
  {
    num: 4,
    difficulty: 'easy',
    topic: 'remote',
    text: 'Which command copies an existing remote repository, with its full history, to your computer?',
    explanation: 'git clone downloads the whole repository and sets up the origin remote. git pull only works inside an existing repository, and "fork" is a GitHub feature, not a Git command.',
    points_base: 1000,
    options: [
      { label: 'A', text: 'git clone', is_correct: true },
      { label: 'B', text: 'git copy', is_correct: false },
      { label: 'C', text: 'git fork', is_correct: false },
      { label: 'D', text: 'git pull', is_correct: false },
    ],
    correct_index: 0,
  },
  {
    num: 5,
    difficulty: 'easy',
    topic: 'undo',
    text: 'You staged notes.txt by mistake. You want to unstage it but keep your edits in the file. Which command?',
    explanation: 'git restore --staged moves the file out of the staging area and leaves your edits in place. git restore without --staged and git reset --hard throw the edits away, and git stash removes them from the file.',
    points_base: 1000,
    options: [
      { label: 'A', text: 'git reset --hard', is_correct: false },
      { label: 'B', text: 'git stash', is_correct: false },
      { label: 'C', text: 'git restore --staged notes.txt', is_correct: true },
      { label: 'D', text: 'git restore notes.txt', is_correct: false },
    ],
    correct_index: 2,
  },

  // --- 5 MEDIUM (Competition Q6 - Q10) ---
  {
    num: 6,
    difficulty: 'medium',
    topic: 'basics',
    text: 'debug.log is already tracked by Git. You now add *.log to .gitignore. What happens to debug.log?',
    explanation: '.gitignore only affects untracked files. A tracked file stays tracked until you run git rm --cached on it.',
    points_base: 1000,
    options: [
      { label: 'A', text: 'Git deletes it from the repository', is_correct: false },
      { label: 'B', text: 'Git keeps tracking it and still reports its changes', is_correct: true },
      { label: 'C', text: 'Git automatically stops tracking it', is_correct: false },
      { label: 'D', text: 'Git refuses to commit any further changes to it', is_correct: false },
    ],
    correct_index: 1,
  },
  {
    num: 7,
    difficulty: 'medium',
    topic: 'branching',
    text: 'main has no new commits since you created feature from it. On main you run git merge feature. What happens?',
    explanation: 'When main has not diverged, Git simply moves the main pointer forward. No merge commit is needed unless you pass --no-ff.',
    points_base: 1000,
    options: [
      { label: 'A', text: 'A merge commit is always created', is_correct: false },
      { label: 'B', text: 'Git reports a merge conflict', is_correct: false },
      { label: 'C', text: 'main moves forward to feature with no merge commit (fast-forward)', is_correct: true },
      { label: 'D', text: 'Nothing happens unless you add --force', is_correct: false },
    ],
    correct_index: 2,
  },
  {
    num: 8,
    difficulty: 'medium',
    topic: 'branching',
    text: 'Branch old-login has commits that were never merged anywhere, and you want it gone. Which command deletes it?',
    explanation: '-d is the safe delete and refuses when commits are unmerged. -D forces the deletion. git switch -d only detaches HEAD, and --remove is not a valid option.',
    points_base: 1000,
    options: [
      { label: 'A', text: 'git branch -d old-login', is_correct: false },
      { label: 'B', text: 'git branch --remove old-login', is_correct: false },
      { label: 'C', text: 'git switch -d old-login', is_correct: false },
      { label: 'D', text: 'git branch -D old-login', is_correct: true },
    ],
    correct_index: 3,
  },
  {
    num: 9,
    difficulty: 'medium',
    topic: 'remote',
    text: 'What is the difference between git fetch and git pull?',
    explanation: 'git fetch only updates your remote-tracking branches. git pull is a fetch followed by a merge (or a rebase if configured).',
    points_base: 1000,
    options: [
      { label: 'A', text: 'fetch merges new commits into your branch; pull only downloads them', is_correct: false },
      { label: 'B', text: 'fetch downloads new commits without changing your current branch; pull downloads and then merges them', is_correct: true },
      { label: 'C', text: 'They do exactly the same thing', is_correct: false },
      { label: 'D', text: 'fetch uploads your commits; pull downloads them', is_correct: false },
    ],
    correct_index: 1,
  },
  {
    num: 10,
    difficulty: 'medium',
    topic: 'undo',
    text: 'A bad commit was already pushed to the shared main branch. What is the safest way to undo it without rewriting history?',
    explanation: 'git revert adds a new commit that cancels the bad one and keeps history intact. The other options rewrite history, which causes problems for teammates who already pulled.',
    points_base: 1000,
    options: [
      { label: 'A', text: 'git reset --hard HEAD~1 , then git push --force', is_correct: false },
      { label: 'B', text: 'git commit --amend', is_correct: false },
      { label: 'C', text: 'git revert HEAD', is_correct: true },
      { label: 'D', text: 'git rebase -i and drop the commit', is_correct: false },
    ],
    correct_index: 2,
  },

  // --- 5 HARD (Competition Q11 - Q15) ---
  {
    num: 11,
    difficulty: 'hard',
    topic: 'undo',
    text: 'You made your last 3 commits by mistake. Undo them, but keep all their changes staged and ready to recommit. Which command?',
    explanation: '--soft moves the branch back and keeps the changes staged. --mixed leaves them unstaged, --hard discards them, and HEAD~2 only undoes two commits.',
    points_base: 1000,
    options: [
      { label: 'A', text: 'git reset --hard HEAD~3', is_correct: false },
      { label: 'B', text: 'git reset --mixed HEAD~3', is_correct: false },
      { label: 'C', text: 'git reset --soft HEAD~2', is_correct: false },
      { label: 'D', text: 'git reset --soft HEAD~3', is_correct: true },
    ],
    correct_index: 3,
  },
  {
    num: 12,
    difficulty: 'hard',
    topic: 'undo',
    text: 'You ran git reset --hard HEAD~2 by mistake and lost two commits. Nothing was pushed or stashed. Which command helps you find them?',
    explanation: 'git reflog records where HEAD has been, so the lost commits appear there. You can recover with git reset --hard <hash> . git log --all does not list commits no branch points to.',
    points_base: 1000,
    options: [
      { label: 'A', text: 'git log --all', is_correct: false },
      { label: 'B', text: 'git stash list', is_correct: false },
      { label: 'C', text: 'git status', is_correct: false },
      { label: 'D', text: 'git reflog', is_correct: true },
    ],
    correct_index: 3,
  },
  {
    num: 13,
    difficulty: 'hard',
    topic: 'merging',
    text: 'git merge feature stops with a conflict in app.py. Which sequence correctly finishes the merge?',
    explanation: 'Resolve the file, stage it to mark it resolved, then commit to complete the merge. Committing right away fails, git reset --hard abandons the merge, and there is no rebase to continue.',
    points_base: 1000,
    options: [
      { label: 'A', text: 'git commit immediately', is_correct: false },
      { label: 'B', text: 'git reset --hard', is_correct: false },
      { label: 'C', text: 'Edit app.py to remove the conflict markers, git add app.py , then git commit', is_correct: true },
      { label: 'D', text: 'git rebase --continue', is_correct: false },
    ],
    correct_index: 2,
  },
  {
    num: 14,
    difficulty: 'hard',
    topic: 'remote',
    text: 'Your push is rejected because a teammate pushed first. You want to keep history linear (no merge commit) without overwriting their work. What do you run?',
    explanation: "git pull --rebase replays your commits on top of the teammate's work, so history stays linear and the next push is accepted. A plain pull creates a merge commit, fetch alone does not integrate anything, and --force would erase their commit.",
    points_base: 1000,
    options: [
      { label: 'A', text: 'git push --force', is_correct: false },
      { label: 'B', text: 'git pull , then git push', is_correct: false },
      { label: 'C', text: 'git fetch , then git push', is_correct: false },
      { label: 'D', text: 'git pull --rebase , then git push', is_correct: true },
    ],
    correct_index: 3,
  },
  {
    num: 15,
    difficulty: 'hard',
    topic: 'remote',
    text: 'You rebased feature onto main after pushing it, and git push is now rejected. What is the safest way to update the remote branch?',
    explanation: 'Rebasing rewrites commit hashes, so a force push is needed. --force-with-lease refuses if someone else pushed in the meantime, while --force overwrites blindly. Pulling merges the old and new copies and duplicates commits, and --no-verify only skips hooks.',
    points_base: 1000,
    options: [
      { label: 'A', text: 'git push --force', is_correct: false },
      { label: 'B', text: 'git pull , then git push', is_correct: false },
      { label: 'C', text: 'git push --no-verify', is_correct: false },
      { label: 'D', text: 'git push --force-with-lease', is_correct: true },
    ],
    correct_index: 3,
  },

  // --- 5 SUDDEN-DEATH RESERVE QUESTIONS (R1 - R5) ---
  {
    num: 16,
    difficulty: 'medium',
    topic: 'undo',
    text: 'You have a modified tracked file and a brand-new untracked file. Which command shelves both so you can switch tasks?',
    explanation: '-u (include untracked) stashes new files too. Plain git stash leaves untracked files behind, and pop and apply bring a stash back rather than creating one.',
    points_base: 1000,
    options: [
      { label: 'A', text: 'git stash', is_correct: false },
      { label: 'B', text: 'git stash -u', is_correct: true },
      { label: 'C', text: 'git stash pop', is_correct: false },
      { label: 'D', text: 'git stash apply', is_correct: false },
    ],
    correct_index: 1,
  },
  {
    num: 17,
    difficulty: 'medium',
    topic: 'undo',
    text: 'You just committed but forgot to include a new file, forgotten.txt. How do you add it to that same commit without changing the message?',
    explanation: 'Stage the file first, then amend. Amending without staging does not include the new file, and a second commit would not be the same commit.',
    points_base: 1000,
    options: [
      { label: 'A', text: 'git commit --amend --no-edit', is_correct: false },
      { label: 'B', text: 'git add forgotten.txt , then git commit --amend --no-edit', is_correct: true },
      { label: 'C', text: 'git commit -m "oops"', is_correct: false },
      { label: 'D', text: 'git revert HEAD', is_correct: false },
    ],
    correct_index: 1,
  },
  {
    num: 18,
    difficulty: 'medium',
    topic: 'debugging',
    text: 'Which command starts a binary search through your history to find the commit that introduced a bug?',
    explanation: 'git bisect marks a known good and a known bad commit, then checks out commits in between so you find the culprit in a few steps.',
    points_base: 1000,
    options: [
      { label: 'A', text: 'git blame', is_correct: false },
      { label: 'B', text: 'git bisect start', is_correct: true },
      { label: 'C', text: 'git grep', is_correct: false },
      { label: 'D', text: 'git log --oneline', is_correct: false },
    ],
    correct_index: 1,
  },
  {
    num: 19,
    difficulty: 'hard',
    topic: 'merging',
    text: 'You want to bring the changes of a 2-commit feature branch into main as staged changes, with no commit made yet, so you can commit them as one. Which command?',
    explanation: '--squash stages the combined changes and leaves the commit to you. --no-ff creates a merge commit, cherry-pick applies only the tip commit, and a plain merge may fast-forward and keep both commits.',
    points_base: 1000,
    options: [
      { label: 'A', text: 'git merge --no-ff feature', is_correct: false },
      { label: 'B', text: 'git cherry-pick feature', is_correct: false },
      { label: 'C', text: 'git merge --squash feature', is_correct: true },
      { label: 'D', text: 'git merge feature', is_correct: false },
    ],
    correct_index: 2,
  },
  {
    num: 20,
    difficulty: 'medium',
    topic: 'remote',
    text: 'You created a tag v1.0 locally. Which command shares just that tag with the remote?',
    explanation: 'Tags are not sent by a normal push. Name the tag explicitly: git push origin v1.0 .',
    points_base: 1000,
    options: [
      { label: 'A', text: 'git push', is_correct: false },
      { label: 'B', text: 'git tag --push v1.0', is_correct: false },
      { label: 'C', text: 'git push origin v1.0', is_correct: true },
      { label: 'D', text: 'git commit --tag v1.0', is_correct: false },
    ],
    correct_index: 2,
  },
];

const DEFAULT_EVENT_ID = process.env.DEFAULT_EVENT_ID || '00000000-0000-0000-0000-000000000001';

async function run() {
  console.log('🚀 Starting SmartLink Quiz Seeding & Assignment Generation...');

  // 1. Load existing data-questions.json to preserve extra practice/variant questions
  let additionalQuestions = [];
  try {
    const existing = JSON.parse(fs.readFileSync('scripts/data-questions.json', 'utf8'));
    additionalQuestions = existing.slice(20);
  } catch (err) {
    console.warn('Note: Could not load existing data-questions.json');
  }

  // 2. Build full master question list
  const masterQuestions = [];
  const masterOptions = [];
  const reserveQuestions = [];
  const reserveOptions = [];

  for (let i = 0; i < OFFICIAL_PDF_QUESTIONS.length; i++) {
    const q = OFFICIAL_PDF_QUESTIONS[i];
    const qId = `10000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`;
    const questionObj = {
      id: qId,
      event_id: DEFAULT_EVENT_ID,
      question_number: q.num,
      difficulty: q.difficulty,
      question_text: q.text,
      text: q.text,
      correct_answer_index: q.correct_index,
      is_active: true,
      topic: q.topic,
      explanation: q.explanation,
      points_base: q.points_base,
    };

    const qOptions = q.options.map((opt, optIdx) => {
      const optId = `20000000-0000-0000-${String(i + 1).padStart(4, '0')}-${String(optIdx + 1).padStart(12, '0')}`;
      return {
        id: optId,
        question_id: qId,
        option_text: opt.text,
        text: opt.text,
        option_index: optIdx,
        label: opt.label,
        is_correct: opt.is_correct,
      };
    });

    masterQuestions.push({
      ...questionObj,
      options: qOptions,
    });

    for (const opt of qOptions) {
      masterOptions.push(opt);
    }

    // Reserve questions (Q16 - Q20)
    if (i >= 15) {
      const resQId = `30000000-0000-0000-0000-${String(i - 14).padStart(12, '0')}`;
      reserveQuestions.push({
        id: resQId,
        event_id: DEFAULT_EVENT_ID,
        question_text: q.text,
        difficulty: q.difficulty === 'hard' ? 'hard' : 'medium',
        topic: q.topic,
        explanation: q.explanation,
        is_used: false,
      });

      for (const opt of qOptions) {
        reserveOptions.push({
          id: `40000000-0000-0000-${String(i - 14).padStart(4, '0')}-${String(opt.option_index + 1).padStart(12, '0')}`,
          reserve_question_id: resQId,
          option_text: opt.option_text,
          option_index: opt.option_index,
          label: opt.label,
          is_correct: opt.is_correct,
        });
      }
    }
  }

  // Keep additional 70 questions from existing pool to maintain 90-question bank
  for (let k = 0; k < additionalQuestions.length && masterQuestions.length < 90; k++) {
    const aq = additionalQuestions[k];
    const qNum = masterQuestions.length + 1;
    const qId = `10000000-0000-0000-0000-${String(qNum).padStart(12, '0')}`;
    const qObj = {
      id: qId,
      event_id: DEFAULT_EVENT_ID,
      question_number: qNum,
      difficulty: aq.difficulty || 'medium',
      question_text: aq.text || aq.question_text,
      text: aq.text || aq.question_text,
      correct_answer_index: aq.correct_answer_index || 0,
      is_active: true,
      topic: aq.topic || 'general',
      explanation: aq.explanation || '',
      points_base: 1000,
    };
    const opts = (aq.options || []).map((o, oIdx) => ({
      id: `20000000-0000-0000-${String(qNum).padStart(4, '0')}-${String(oIdx + 1).padStart(12, '0')}`,
      question_id: qId,
      option_text: o.text || o.option_text,
      text: o.text || o.option_text,
      option_index: oIdx,
      label: o.label || ['A', 'B', 'C', 'D'][oIdx],
      is_correct: o.is_correct || false,
    }));
    masterQuestions.push({ ...qObj, options: opts });
    masterOptions.push(...opts);
  }

  // Save scripts/data-questions.json
  fs.writeFileSync('scripts/data-questions.json', JSON.stringify(masterQuestions, null, 2));
  console.log(`✓ Saved ${masterQuestions.length} questions to scripts/data-questions.json`);

  // 3. Load 200 Students from scripts/data-students.json
  const students = JSON.parse(fs.readFileSync('scripts/data-students.json', 'utf8')).map((s) => ({
    id: s.id,
    event_id: DEFAULT_EVENT_ID,
    college_id: s.college_id,
    name: s.name,
    email: s.email || `${s.college_id.toLowerCase()}@klu.ac.in`,
    register_no: s.register_no || s.college_id,
    join_code: s.join_code,
    status: 'registered',
    is_active: true,
  }));
  console.log(`✓ Loaded ${students.length} students from scripts/data-students.json`);

  // 4. Generate 3,000 Assignments (15 questions each for 200 students)
  // Positions 1..5: Easy (Q1-Q5)
  // Positions 6..10: Medium (Q6-Q10)
  // Positions 11..15: Hard (Q11-Q15)
  // Option order deterministically randomized per student
  const assignments = [];
  function shuffleDeterministic(arr, seed) {
    const a = [...arr];
    let s = seed;
    for (let i = a.length - 1; i > 0; i--) {
      s = (s * 9301 + 49297) % 233280;
      const j = Math.floor((s / 233280) * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  for (let sIdx = 0; sIdx < students.length; sIdx++) {
    const student = students[sIdx];
    const studentSeed = (sIdx + 1) * 31337;

    for (let pos = 1; pos <= 15; pos++) {
      const q = masterQuestions[pos - 1];
      const optionOrder = shuffleDeterministic([0, 1, 2, 3], studentSeed + pos * 101);
      const asgId = `50000000-0000-0000-${String(sIdx + 1).padStart(4, '0')}-${String(pos).padStart(12, '0')}`;

      assignments.push({
        id: asgId,
        student_id: student.id,
        question_id: q.id,
        position: pos,
        option_order: optionOrder,
      });
    }
  }

  fs.writeFileSync('scripts/data-assignments.json', JSON.stringify(assignments, null, 2));
  console.log(`✓ Generated ${assignments.length} assignments in scripts/data-assignments.json`);

  // Write SQL seed files for backup
  const assignmentSql = `-- SmartLink Git Quiz — Student Question Assignments (3,000 Rows)\nDELETE FROM student_questions;\nINSERT INTO student_questions (id, student_id, question_id, position, option_order) VALUES\n${assignments.map(a => `('${a.id}', '${a.student_id}', '${a.question_id}', ${a.position}, '${JSON.stringify(a.option_order)}')`).join(',\n')};\n`;
  fs.writeFileSync('scripts/seed-assignments.sql', assignmentSql);

  // 5. Connect to Supabase REST API & Batch Upsert
  const url = process.env.SUPABASE_URL || 'https://ndplgalpfqtvaveabnox.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('❌ Supabase credentials missing');
    return;
  }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates',
  };

  async function postBatch(endpoint, items, batchSize = 100) {
    console.log(`Uploading ${items.length} records to ${endpoint}...`);
    for (let i = 0; i < items.length; i += batchSize) {
      const chunk = items.slice(i, i + batchSize);
      const res = await fetch(`${url}/rest/v1/${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error(`Error uploading to ${endpoint} at batch ${i}:`, res.status, errText);
        throw new Error(`Failed batch insert into ${endpoint}: ${errText}`);
      }
    }
    console.log(`✓ Completed ${endpoint}`);
  }

  // Clear existing student_questions to cleanly recreate
  console.log('Cleaning student_questions and old questions if needed...');
  await fetch(`${url}/rest/v1/student_questions?position=gt.0`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });

  // A. Upsert Questions (strip options array)
  const questionsToInsert = masterQuestions.map(q => {
    const { options, ...rest } = q;
    return rest;
  });
  await postBatch('questions', questionsToInsert, 50);

  // B. Upsert Options
  await postBatch('options', masterOptions, 100);

  // C. Upsert Reserve Questions & Options
  await postBatch('reserve_questions', reserveQuestions, 20);
  await postBatch('reserve_options', reserveOptions, 50);

  // D. Upsert 200 Students
  await postBatch('students', students, 50);

  // E. Upsert Student Questions Assignments
  await postBatch('student_questions', assignments, 200);

  // 6. Update smartlink_backup_00000000_1792720638403.json
  console.log('Generating updated backup file with full checksum...');
  const [
    settingsRes,
    studentsRes,
    questionsRes,
    answersRes,
    auditRes,
  ] = await Promise.all([
    fetch(`${url}/rest/v1/event_settings?event_id=eq.${DEFAULT_EVENT_ID}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
    fetch(`${url}/rest/v1/students?select=id,college_id,name,email,register_no,status,consent_at,created_at&order=college_id.asc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
    fetch(`${url}/rest/v1/questions?select=id,text,difficulty,topic,points_base,is_active&order=question_number.asc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
    fetch(`${url}/rest/v1/answers?select=*`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
    fetch(`${url}/rest/v1/audit_log?event_id=eq.${DEFAULT_EVENT_ID}&order=created_at.asc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
  ]);

  const settingsData = await settingsRes.json();
  const studentsData = await studentsRes.json();
  const questionsData = await questionsRes.json();
  const answersData = await answersRes.json();
  const auditData = await auditRes.json();

  const exportPayload = {
    metadata: {
      eventId: DEFAULT_EVENT_ID,
      exportedAt: new Date().toISOString(),
      exportedBy: {
        id: 'admin-user-dhina',
        name: 'Dhina (Owner)',
        role: 'owner',
      },
      schemaVersion: '2026.1',
    },
    tables: {
      event_settings: settingsData || [],
      students: studentsData || [],
      questions: questionsData || [],
      answers: answersData || [],
      question_voids: [],
      flag_decisions: [],
      winner_verification: [],
      audit_log: auditData || [],
    },
  };

  const rawJson = JSON.stringify(exportPayload, null, 2);
  const checksum = crypto.createHash('sha256').update(rawJson).digest('hex');

  const finalBackup = {
    ...exportPayload,
    checksum: {
      algorithm: 'SHA-256',
      hash: checksum,
    },
  };

  fs.writeFileSync('smartlink_backup_00000000_1792720638403.json', JSON.stringify(finalBackup, null, 2));
  console.log(`✓ Updated smartlink_backup_00000000_1792720638403.json with ${studentsData.length} students, ${questionsData.length} questions, and SHA-256: ${checksum}`);

  console.log('\n🎉 ALL DONE! Verification summary:');
  console.log(`- Questions: ${masterQuestions.length} in bank (Q1-Q15 canonical competition, Q16-Q20 reserve)`);
  console.log(`- Reserve Questions: ${reserveQuestions.length}`);
  console.log(`- Students: ${students.length} seeded`);
  console.log(`- Question Assignments: ${assignments.length} (15 per student)`);
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
