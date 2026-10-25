// scripts/build-seed-data.mjs
import fs from 'node:fs';
import path from 'node:path';

// -------------------------------------------------------------
// 1. GENERATE 200 STUDENTS WITH 6-CHAR ALPHANUMERIC JOIN CODES
// -------------------------------------------------------------
const studentNames = [
  'Aarav Sharma', 'Aditi Verma', 'Dhina Kumar', 'Priya Nair', 'Rohan Patel',
  'Sneha Iyer', 'Vikram Reddy', 'Ananya Gupta', 'Karthik Singh', 'Divya Rao',
  'Siddharth Chopra', 'Meera Joshi', 'Arjun Menon', 'Pooja Bose', 'Rahul Das',
  'Nisha Pillai', 'Varun Kapoor', 'Kavya Bhat', 'Gautam Sen', 'Deepa Ghosh',
  'Aman Saxena', 'Rhea Mehra', 'Karan Malhotra', 'Shreya Agarwal', 'Harsh Trivedi',
  'Tanya Kaul', 'Nikhil Desai', 'Bhavna Kulkarni', 'Tarun Hegde', 'Swati Shenoy',
  'Manish Pandey', 'Shalini Jain', 'Vivek Mishra', 'Pallavi Dubey', 'Rohit Tiwari',
  'Simran Kaur', 'Abhishek Yadav', 'Ritika Chauhan', 'Mayank Rajput', 'Payal Rathore',
  'Prateek Soni', 'Neha Goswami', 'Suresh Nambiar', 'Anjali Namboodiri', 'Dinesh Kurup',
  'Vidya Warrier', 'Ashwin George', 'Reshma Thomas', 'Jithin Mathew', 'Ancy Varghese',
  'Ravi Chandran', 'Gayatri Natarajan', 'Manoj Subramanian', 'Lakshmi Raman', 'Venkatesh Balan',
  'Saranya Krishnan', 'Praveen Sundaram', 'Archana Sridhar', 'Sanjay Raghavan', 'Radhika Madhavan',
  'Rajesh Prabhu', 'Sandhya Kamath', 'Mohit Pai', 'Sunita Nayak', 'Kishore Mallya',
  'Chitra Kudva', 'Naveen Kini', 'Preeti Shenoy', 'Sachin Shanbhag', 'Rekha Rao',
  'Amitabh Dutta', 'Moumita Banerjee', 'Sourav Mukherjee', 'Debolina Chatterjee', 'Subhashish Roy',
  'Sutapa Chakraborty', 'Anirban Mitra', 'Indrani Sengupta', 'Tanmoy Ganguly', 'Rupali Majumdar',
  'Prashant Patil', 'Snehal Shinde', 'Nitin Gaikwad', 'Aparna Kadam', 'Amol Jadhav',
  'Madhuri Pawar', 'Ganesh More', 'Priyanka Salunkhe', 'Deepak Chavan', 'Rupesh Bhosale',
  'Chirag Shah', 'Dhara Mehta', 'Bhavesh Parekh', 'Kinjal Vora', 'Jignesh Doshi',
  'Forum Sanghavi', 'Parth Trivedi', 'Urvi Dave', 'Hiren Bhatt', 'Bhoomi Raval',
  'Naresh Choudhary', 'Mamta Bishnoi', 'Rakesh Gehlot', 'Laxmi Bhati', 'Kamlesh Solanki',
  'Usha Panwar', 'Mukesh Parihar', 'Geeta Tak', 'Mahesh Deora', 'Anita Rathore',
  'Gurpreet Singh', 'Harpreet Kaur', 'Manpreet Sandhu', 'Jasleen Dhillon', 'Navjot Gill',
  'Sukhwinder Grewal', 'Amandeep Brar', 'Kirandeep Sidhu', 'Balwinder Bajwa', 'Simranjeet Cheema',
  'Ramesh Naidu', 'Sujatha Reddy', 'Srinivas Rao', 'Kavitha Chowdary', 'Bhaskar Raju',
  'Padma Varma', 'Satish Goud', 'Anusha Yadav', 'Chaitanya Krishna', 'Harika Lakshmi',
  'Prakash Gowda', 'Soumya Hegde', 'Chetan Shetty', 'Shilpa Alva', 'Darshan Poojary',
  'Meghana Rai', 'Vinay Kulal', 'Tejaswini Devadiga', 'Santosh Acharya', 'Nandini Bhat',
  'Alok Mohanty', 'Lipika Patnaik', 'Biswajit Das', 'Runu Panda', 'Satyajit Mishra',
  'Suchitra Sahoo', 'Debashis Tripathy', 'Rasmita Behera', 'Subrat Nayak', 'Monalisa Rout',
  'Tarun Saikia', 'Parinita Borah', 'Dhruba Kalita', 'Barnali Goswami', 'Manabendra Sarma',
  'Priyanka Das', 'Himangshu Baruah', 'Daisy Hazarika', 'Bhaskar Gogoi', 'Gitashree Dutta',
  'Prabhat Jha', 'Khushboo Thakur', 'Avinash Pandey', 'Soni Kumari', 'Kunal Shahi',
  'Nidhi Ojha', 'Rajnish Pathak', 'Archana Upadhyay', 'Pankaj Shukla', 'Babita Kashyap',
  'Hemant Rawat', 'Kiran Bisht', 'Suraj Negi', 'Pooja Kandpal', 'Devendra Bhatt',
  'Geetanjali Joshi', 'Arvind Danu', 'Bhagwati Arya', 'Chandan Mehta', 'Deepika Pant',
  'Tenzin Norbu', 'Pema Yangzom', 'Dorjee Khandu', 'Sonam Dolma', 'Lobsang Thupten',
  'Tsering Wangmo', 'Rigzin Namgyal', 'Dechen Chodon', 'Stanzin Angmo', 'Jigme Dorje',
  'Samuel Fernandes', 'Maria Dsouza', 'Kevin Rodrigues', 'Jessica Pereira', 'Anthony Sequeira',
  'Rachel Miranda', 'Jason Pinto', 'Vanessa Coutinho', 'Mark Lobo', 'Amanda Mascarenhas'
];

function generateJoinCode(index) {
  // Deterministic 6-char alphanumeric code per student
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let hash = (index * 2654435761) >>> 0;
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[hash % chars.length];
    hash = Math.floor(hash / chars.length) ^ (i * 7);
  }
  return code;
}

const students = studentNames.map((name, i) => {
  const college_id = `CS2024${String(i + 1).padStart(3, '0')}`;
  const join_code = generateJoinCode(i + 1);
  const id = `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`;
  return { id, college_id, name, join_code };
});

const studentSql = `-- ============================================================
-- SmartLink Git Quiz — Seed 200 Students
-- ============================================================
INSERT INTO students (id, college_id, name, join_code, is_active) VALUES
${students.map(s => `('${s.id}', '${s.college_id}', '${s.name.replace(/'/g, "''")}', '${s.join_code}', TRUE)`).join(',\n')}
ON CONFLICT (college_id) DO UPDATE
SET name = EXCLUDED.name, join_code = EXCLUDED.join_code, is_active = EXCLUDED.is_active;
`;

fs.writeFileSync('scripts/seed-students.sql', studentSql);
console.log('✓ Wrote scripts/seed-students.sql (200 students)');

// -------------------------------------------------------------
// 2. DEFINE 90 QUESTIONS (30 EASY, 30 MEDIUM, 30 HARD)
// -------------------------------------------------------------
const rawQuestions = [
  // ==================== 30 EASY ====================
  {
    num: 1, difficulty: 'easy', topic: 'basics',
    text: 'What command initializes a new Git repository in the current working directory?',
    explanation: 'git init creates a new .git directory containing Git object database and metadata.',
    options: [
      { label: 'A', text: 'git start', is_correct: false },
      { label: 'B', text: 'git init', is_correct: true },
      { label: 'C', text: 'git create', is_correct: false },
      { label: 'D', text: 'git new', is_correct: false },
    ]
  },
  {
    num: 2, difficulty: 'easy', topic: 'basics',
    text: 'Which command shows the chronological commit history of the current repository?',
    explanation: 'git log displays committed history in reverse chronological order.',
    options: [
      { label: 'A', text: 'git history', is_correct: false },
      { label: 'B', text: 'git commits', is_correct: false },
      { label: 'C', text: 'git log', is_correct: true },
      { label: 'D', text: 'git show-all', is_correct: false },
    ]
  },
  {
    num: 3, difficulty: 'easy', topic: 'staging',
    text: 'Which command stages all modified and newly created files in the repository?',
    explanation: 'git add . stages all modified and untracked files in the current repository path into the index.',
    options: [
      { label: 'A', text: 'git stage --everything', is_correct: false },
      { label: 'B', text: 'git add .', is_correct: true },
      { label: 'C', text: 'git track --all', is_correct: false },
      { label: 'D', text: 'git push --stage', is_correct: false },
    ]
  },
  {
    num: 4, difficulty: 'easy', topic: 'commits',
    text: 'Which command records staged snapshots with an inline descriptive message?',
    explanation: 'git commit -m "message" records staged changes to project history with a commit message.',
    options: [
      { label: 'A', text: 'git save "message"', is_correct: false },
      { label: 'B', text: 'git commit -m "message"', is_correct: true },
      { label: 'C', text: 'git push -m "message"', is_correct: false },
      { label: 'D', text: 'git record "message"', is_correct: false },
    ]
  },
  {
    num: 5, difficulty: 'easy', topic: 'cloning',
    text: 'What command copies an existing remote repository onto your local machine?',
    explanation: 'git clone downloads the remote repository including its entire commit history into a new directory.',
    options: [
      { label: 'A', text: 'git download <url>', is_correct: false },
      { label: 'B', text: 'git clone <url>', is_correct: true },
      { label: 'C', text: 'git copy <url>', is_correct: false },
      { label: 'D', text: 'git fetch-all <url>', is_correct: false },
    ]
  },
  {
    num: 6, difficulty: 'easy', topic: 'branching',
    text: 'What command creates a new branch named feature-login and immediately switches to it?',
    explanation: 'git checkout -b feature-login (or git switch -c feature-login) creates and activates the new branch.',
    options: [
      { label: 'A', text: 'git branch --move feature-login', is_correct: false },
      { label: 'B', text: 'git checkout -b feature-login', is_correct: true },
      { label: 'C', text: 'git create-branch feature-login', is_correct: false },
      { label: 'D', text: 'git switch --force feature-login', is_correct: false },
    ]
  },
  {
    num: 7, difficulty: 'easy', topic: 'branching',
    text: 'Which command lists all existing local branches in your repository?',
    explanation: 'git branch lists all local branches, marking the currently checked out branch with an asterisk.',
    options: [
      { label: 'A', text: 'git branch', is_correct: true },
      { label: 'B', text: 'git list-branches', is_correct: false },
      { label: 'C', text: 'git show --branches', is_correct: false },
      { label: 'D', text: 'git branches --all', is_correct: false },
    ]
  },
  {
    num: 8, difficulty: 'easy', topic: 'stashing',
    text: 'You have uncommitted modifications that you want to set aside without committing. What command do you run?',
    explanation: 'git stash saves uncommitted modifications to a stack and restores the working tree to HEAD.',
    options: [
      { label: 'A', text: 'git clean -f', is_correct: false },
      { label: 'B', text: 'git stash', is_correct: true },
      { label: 'C', text: 'git discard', is_correct: false },
      { label: 'D', text: 'git pause', is_correct: false },
    ]
  },
  {
    num: 9, difficulty: 'easy', topic: 'stashing',
    text: 'What command restores the most recently stashed changes and removes them from the stash list?',
    explanation: 'git stash pop reapplies the newest stash entry (stash@{0}) and removes it from the stash stack.',
    options: [
      { label: 'A', text: 'git stash apply', is_correct: false },
      { label: 'B', text: 'git stash pop', is_correct: true },
      { label: 'C', text: 'git stash restore', is_correct: false },
      { label: 'D', text: 'git stash drop', is_correct: false },
    ]
  },
  {
    num: 10, difficulty: 'easy', topic: 'stashing',
    text: 'Which command lists all currently stashed change sets in your repository?',
    explanation: 'git stash list displays all saved stash entries along with their reference names.',
    options: [
      { label: 'A', text: 'git stash show-all', is_correct: false },
      { label: 'B', text: 'git stash list', is_correct: true },
      { label: 'C', text: 'git stash --status', is_correct: false },
      { label: 'D', text: 'git list-stash', is_correct: false },
    ]
  },
  {
    num: 11, difficulty: 'easy', topic: 'status',
    text: 'Which command displays the state of the working directory and the staging area?',
    explanation: 'git status shows staged, unstaged, and untracked file statuses.',
    options: [
      { label: 'A', text: 'git status', is_correct: true },
      { label: 'B', text: 'git inspect', is_correct: false },
      { label: 'C', text: 'git check', is_correct: false },
      { label: 'D', text: 'git state', is_correct: false },
    ]
  },
  {
    num: 12, difficulty: 'easy', topic: 'diff',
    text: 'Which command shows differences between your working directory modifications and staged files?',
    explanation: 'git diff displays changes in the working directory that have not yet been staged.',
    options: [
      { label: 'A', text: 'git diff', is_correct: true },
      { label: 'B', text: 'git compare', is_correct: false },
      { label: 'C', text: 'git changes', is_correct: false },
      { label: 'D', text: 'git diff --history', is_correct: false },
    ]
  },
  {
    num: 13, difficulty: 'easy', topic: 'diff',
    text: 'Which command shows differences between staged modifications and the last commit?',
    explanation: 'git diff --staged (or --cached) inspects differences staged in the index against HEAD.',
    options: [
      { label: 'A', text: 'git diff --staged', is_correct: true },
      { label: 'B', text: 'git diff --commit', is_correct: false },
      { label: 'C', text: 'git diff --all', is_correct: false },
      { label: 'D', text: 'git show --diff', is_correct: false },
    ]
  },
  {
    num: 14, difficulty: 'easy', topic: 'remotes',
    text: 'What command shows all configured remote repository names along with their fetch/push URLs?',
    explanation: 'git remote -v lists remote names and their associated URLs.',
    options: [
      { label: 'A', text: 'git remote --urls', is_correct: false },
      { label: 'B', text: 'git remote -v', is_correct: true },
      { label: 'C', text: 'git show remotes', is_correct: false },
      { label: 'D', text: 'git origin --list', is_correct: false },
    ]
  },
  {
    num: 15, difficulty: 'easy', topic: 'remotes',
    text: 'What is the command to link a remote repository URL named origin to your local repo?',
    explanation: 'git remote add origin <url> registers the remote repository URL under the alias origin.',
    options: [
      { label: 'A', text: 'git link origin <url>', is_correct: false },
      { label: 'B', text: 'git remote add origin <url>', is_correct: true },
      { label: 'C', text: 'git remote set <url>', is_correct: false },
      { label: 'D', text: 'git attach origin <url>', is_correct: false },
    ]
  },
  {
    num: 16, difficulty: 'easy', topic: 'remotes',
    text: 'What is the primary difference between git fetch and git pull?',
    explanation: 'git fetch only downloads objects from the remote without merging them into your working files.',
    options: [
      { label: 'A', text: 'git fetch downloads commits without merging into your working tree', is_correct: true },
      { label: 'B', text: 'git fetch automatically merges changes into current branch', is_correct: false },
      { label: 'C', text: 'git fetch uploads commits to origin', is_correct: false },
      { label: 'D', text: 'git fetch deletes remote tracking branches', is_correct: false },
    ]
  },
  {
    num: 17, difficulty: 'easy', topic: 'remotes',
    text: 'What does the -u flag do in git push -u origin main?',
    explanation: '-u sets up upstream tracking references between the local branch and origin/main.',
    options: [
      { label: 'A', text: 'Forces an unconditional overwrite of remote history', is_correct: false },
      { label: 'B', text: 'Sets origin/main as the upstream tracking reference', is_correct: true },
      { label: 'C', text: 'Unzips packfiles on remote server', is_correct: false },
      { label: 'D', text: 'Updates Git software on the host', is_correct: false },
    ]
  },
  {
    num: 18, difficulty: 'easy', topic: 'ignore',
    text: 'What is the purpose of the .gitignore file in a project repository?',
    explanation: '.gitignore specifies intentionally untracked patterns that Git should ignore.',
    options: [
      { label: 'A', text: 'Locks files against read operations', is_correct: false },
      { label: 'B', text: 'Specifies intentionally untracked file patterns Git should ignore', is_correct: true },
      { label: 'C', text: 'Deletes binary files from repository history', is_correct: false },
      { label: 'D', text: 'Encrypts private keys before pushing', is_correct: false },
    ]
  },
  {
    num: 19, difficulty: 'easy', topic: 'config',
    text: 'Which command sets your global commit author name across all Git repositories on your computer?',
    explanation: 'git config --global user.name sets the author name stored in commits system-wide for the user.',
    options: [
      { label: 'A', text: 'git author "Name"', is_correct: false },
      { label: 'B', text: 'git config --global user.name "Name"', is_correct: true },
      { label: 'C', text: 'git set user "Name"', is_correct: false },
      { label: 'D', text: 'git profile --name "Name"', is_correct: false },
    ]
  },
  {
    num: 20, difficulty: 'easy', topic: 'config',
    text: 'How can you view all resolved Git configuration settings in your terminal?',
    explanation: 'git config --list prints all configuration variables from system, global, and local files.',
    options: [
      { label: 'A', text: 'git config --show', is_correct: false },
      { label: 'B', text: 'git config --list', is_correct: true },
      { label: 'C', text: 'git env', is_correct: false },
      { label: 'D', text: 'git settings', is_correct: false },
    ]
  },
  {
    num: 21, difficulty: 'easy', topic: 'commits',
    text: 'What command modifies the most recent commit by combining it with current staged changes?',
    explanation: 'git commit --amend combines staged modifications with the tip commit and allows updating message.',
    options: [
      { label: 'A', text: 'git commit --amend', is_correct: true },
      { label: 'B', text: 'git commit --update', is_correct: false },
      { label: 'C', text: 'git commit --fix', is_correct: false },
      { label: 'D', text: 'git commit --replace', is_correct: false },
    ]
  },
  {
    num: 22, difficulty: 'easy', topic: 'tags',
    text: 'Which command creates a lightweight tag named v1.0 pointing to the current commit?',
    explanation: 'git tag v1.0 creates a lightweight reference tag pointing directly to HEAD.',
    options: [
      { label: 'A', text: 'git tag v1.0', is_correct: true },
      { label: 'B', text: 'git label v1.0', is_correct: false },
      { label: 'C', text: 'git release v1.0', is_correct: false },
      { label: 'D', text: 'git bookmark v1.0', is_correct: false },
    ]
  },
  {
    num: 23, difficulty: 'easy', topic: 'inspect',
    text: 'Which command shows metadata and content changes for a specific Git object or commit?',
    explanation: 'git show displays commit metadata, author, and diff changes for a specified revision.',
    options: [
      { label: 'A', text: 'git show <hash>', is_correct: true },
      { label: 'B', text: 'git display <hash>', is_correct: false },
      { label: 'C', text: 'git print <hash>', is_correct: false },
      { label: 'D', text: 'git view <hash>', is_correct: false },
    ]
  },
  {
    num: 24, difficulty: 'easy', topic: 'internals',
    text: 'In Git architecture, what does the special pointer HEAD refer to?',
    explanation: 'HEAD points to the currently checked out branch or commit in your working directory.',
    options: [
      { label: 'A', text: 'The root commit created when repository was initialized', is_correct: false },
      { label: 'B', text: 'A pointer to the current branch or commit checked out in working tree', is_correct: true },
      { label: 'C', text: 'The primary remote repository branch on GitHub', is_correct: false },
      { label: 'D', text: 'The most recent tag in repository history', is_correct: false },
    ]
  },
  {
    num: 25, difficulty: 'easy', topic: 'removal',
    text: 'Which command removes a file from both the Git staging index and your local filesystem?',
    explanation: 'git rm <file> stages the deletion and deletes the file from the working tree.',
    options: [
      { label: 'A', text: 'git rm <file>', is_correct: true },
      { label: 'B', text: 'git delete <file>', is_correct: false },
      { label: 'C', text: 'git drop <file>', is_correct: false },
      { label: 'D', text: 'git erase <file>', is_correct: false },
    ]
  },
  {
    num: 26, difficulty: 'easy', topic: 'merge',
    text: 'What characterizes a fast-forward merge in Git?',
    explanation: 'In a fast-forward merge, the target branch tip directly advances to source commit without a merge commit.',
    options: [
      { label: 'A', text: 'A merge where branch pointer simply advances forward without a merge commit', is_correct: true },
      { label: 'B', text: 'A merge executed with git rebase --force', is_correct: false },
      { label: 'C', text: 'A squash merge performed on GitHub PRs', is_correct: false },
      { label: 'D', text: 'An automated resolution of merge conflicts', is_correct: false },
    ]
  },
  {
    num: 27, difficulty: 'easy', topic: 'log',
    text: 'Which git log option condenses each commit to a single line showing short hash and subject?',
    explanation: 'git log --oneline outputs compact single-line commit summaries.',
    options: [
      { label: 'A', text: 'git log --compact', is_correct: false },
      { label: 'B', text: 'git log --oneline', is_correct: true },
      { label: 'C', text: 'git log --summary', is_correct: false },
      { label: 'D', text: 'git log --brief', is_correct: false },
    ]
  },
  {
    num: 28, difficulty: 'easy', topic: 'checkout',
    text: 'In modern Git (2.23+), what command is recommended for switching branches instead of git checkout?',
    explanation: 'git switch was introduced in Git 2.23 specifically for switching and creating branches.',
    options: [
      { label: 'A', text: 'git hop', is_correct: false },
      { label: 'B', text: 'git switch', is_correct: true },
      { label: 'C', text: 'git move', is_correct: false },
      { label: 'D', text: 'git activate', is_correct: false },
    ]
  },
  {
    num: 29, difficulty: 'easy', topic: 'restore',
    text: 'In modern Git (2.23+), what command discards uncommitted changes in your working tree?',
    explanation: 'git restore <file> restores working tree files to their staged or committed state.',
    options: [
      { label: 'A', text: 'git restore <file>', is_correct: true },
      { label: 'B', text: 'git reset --clean', is_correct: false },
      { label: 'C', text: 'git revert-file <file>', is_correct: false },
      { label: 'D', text: 'git undo <file>', is_correct: false },
    ]
  },
  {
    num: 30, difficulty: 'easy', topic: 'basics',
    text: 'What hidden folder created by git init houses all repository databases, references, and configs?',
    explanation: 'The .git folder at the root of a repository contains all history, objects, and configurations.',
    options: [
      { label: 'A', text: '.git', is_correct: true },
      { label: 'B', text: '.github', is_correct: false },
      { label: 'C', text: '.vcs', is_correct: false },
      { label: 'D', text: '.gitdata', is_correct: false },
    ]
  },

  // ==================== 30 MEDIUM ====================
  {
    num: 31, difficulty: 'medium', topic: 'rebase',
    text: 'What is the fundamental difference between git merge and git rebase?',
    explanation: 'git merge creates a dedicated merge commit preserving topology; rebase reapplies commits for linear history.',
    options: [
      { label: 'A', text: 'Merge deletes branches; rebase keeps them', is_correct: false },
      { label: 'B', text: 'Merge preserves exact topology with a merge commit; rebase reapplies commits on target base for linear history', is_correct: true },
      { label: 'C', text: 'Rebase preserves commit hashes; merge rewrites them', is_correct: false },
      { label: 'D', text: 'Rebase can only run on remote repositories', is_correct: false },
    ]
  },
  {
    num: 32, difficulty: 'medium', topic: 'reset',
    text: 'What happens when you run git reset --soft HEAD~1?',
    explanation: '--soft moves the HEAD reference back by one commit while keeping modifications staged in the index.',
    options: [
      { label: 'A', text: 'Undoes last commit and discards working tree changes', is_correct: false },
      { label: 'B', text: 'Undoes last commit while keeping modifications staged in index', is_correct: true },
      { label: 'C', text: 'Leaves changes unstaged in working tree', is_correct: false },
      { label: 'D', text: 'Creates an inverse revert commit', is_correct: false },
    ]
  },
  {
    num: 33, difficulty: 'medium', topic: 'reset',
    text: 'What happens when you run git reset --mixed HEAD~1 (the default reset mode)?',
    explanation: '--mixed moves HEAD and resets the index, leaving modified files intact in working tree unstaged.',
    options: [
      { label: 'A', text: 'Discards all working tree files permanently', is_correct: false },
      { label: 'B', text: 'Undoes commit and un-stages files, preserving modifications in working directory', is_correct: true },
      { label: 'C', text: 'Keeps files staged in the index', is_correct: false },
      { label: 'D', text: 'Deletes orphaned commits immediately', is_correct: false },
    ]
  },
  {
    num: 34, difficulty: 'medium', topic: 'reset',
    text: 'What happens when you run git reset --hard HEAD~1?',
    explanation: '--hard rewinds HEAD and completely overwrites both the index and working directory to target commit.',
    options: [
      { label: 'A', text: 'Undoes commit while keeping changes staged', is_correct: false },
      { label: 'B', text: 'Rewinds HEAD and discards all uncommitted modifications from working tree and index', is_correct: true },
      { label: 'C', text: 'Stashes uncommitted changes automatically', is_correct: false },
      { label: 'D', text: 'Creates a backup tag before resetting', is_correct: false },
    ]
  },
  {
    num: 35, difficulty: 'medium', topic: 'cherry-pick',
    text: 'Which command applies a single specific commit from another branch onto your active branch as a new commit?',
    explanation: 'git cherry-pick <commit> copies the changes introduced by an existing commit as a new commit on current branch.',
    options: [
      { label: 'A', text: 'git graft <commit>', is_correct: false },
      { label: 'B', text: 'git cherry-pick <commit>', is_correct: true },
      { label: 'C', text: 'git apply-commit <commit>', is_correct: false },
      { label: 'D', text: 'git extract <commit>', is_correct: false },
    ]
  },
  {
    num: 36, difficulty: 'medium', topic: 'reflog',
    text: 'Which command records every movement of HEAD and branch tips locally, allowing recovery of deleted commits?',
    explanation: 'git reflog tracks every update to local references, providing a recovery safety net.',
    options: [
      { label: 'A', text: 'git history --all', is_correct: false },
      { label: 'B', text: 'git reflog', is_correct: true },
      { label: 'C', text: 'git audit', is_correct: false },
      { label: 'D', text: 'git fsck --dangling', is_correct: false },
    ]
  },
  {
    num: 37, difficulty: 'medium', topic: 'clean',
    text: 'What does git clean -fd do in your repository?',
    explanation: 'git clean forcefully (-f) removes untracked files and untracked directories (-d).',
    options: [
      { label: 'A', text: 'Reverts tracked files to HEAD state', is_correct: false },
      { label: 'B', text: 'Forcefully removes untracked files and directories from working tree', is_correct: true },
      { label: 'C', text: 'Removes unused Git packfiles', is_correct: false },
      { label: 'D', text: 'Cleans remote tracking branches', is_correct: false },
    ]
  },
  {
    num: 38, difficulty: 'medium', topic: 'revert',
    text: 'How does git revert <commit> differ from git reset <commit> regarding public branch safety?',
    explanation: 'git revert creates a new inverse commit preserving history, making it safe for published shared branches.',
    options: [
      { label: 'A', text: 'Revert destroys history; reset preserves it', is_correct: false },
      { label: 'B', text: 'Revert creates a new forward commit recording the inverse changes; reset alters history', is_correct: true },
      { label: 'C', text: 'Revert only works on uncommitted changes', is_correct: false },
      { label: 'D', text: 'Reset requires administrative sudo privileges', is_correct: false },
    ]
  },
  {
    num: 39, difficulty: 'medium', topic: 'rebase-interactive',
    text: 'What does git rebase -i HEAD~3 open in your editor?',
    explanation: 'git rebase -i HEAD~3 opens an interactive todo list script allowing squash, reword, drop, or edit of last 3 commits.',
    options: [
      { label: 'A', text: 'A visual git log tree', is_correct: false },
      { label: 'B', text: 'An interactive command list to reorder, squash, edit, or drop the last 3 commits', is_correct: true },
      { label: 'C', text: 'A diff file of merge conflicts', is_correct: false },
      { label: 'D', text: 'A commit message editor for commit 3', is_correct: false },
    ]
  },
  {
    num: 40, difficulty: 'medium', topic: 'rebase-interactive',
    text: 'In an interactive rebase todo list, what does the squash command do?',
    explanation: 'squash melds the commit into the previous commit and prompts you to combine the commit messages.',
    options: [
      { label: 'A', text: 'Melds commit into previous commit and combines messages', is_correct: true },
      { label: 'B', text: 'Discards commit changes completely', is_correct: false },
      { label: 'C', text: 'Splits commit into multiple micro-commits', is_correct: false },
      { label: 'D', text: 'Applies commit as a stash', is_correct: false },
    ]
  },
  {
    num: 41, difficulty: 'medium', topic: 'rebase-interactive',
    text: 'In an interactive rebase todo list, how does fixup differ from squash?',
    explanation: 'fixup melds the changes into previous commit like squash, but discards the fixup commit message.',
    options: [
      { label: 'A', text: 'Fixup automatically runs tests before committing', is_correct: false },
      { label: 'B', text: 'Fixup melds into previous commit while discarding its own commit message', is_correct: true },
      { label: 'C', text: 'Fixup applies only to staged files', is_correct: false },
      { label: 'D', text: 'Fixup cannot be aborted once started', is_correct: false },
    ]
  },
  {
    num: 42, difficulty: 'medium', topic: 'branching',
    text: 'Why does git branch -d feature fail if feature contains unmerged commits, and how do you force delete it?',
    explanation: 'git branch -d protects against unmerged work loss; -D (or -d --force) overrides this safeguard.',
    options: [
      { label: 'A', text: 'git branch -d is deprecated; use git remove', is_correct: false },
      { label: 'B', text: 'It prevents accidental data loss; use git branch -D to force deletion', is_correct: true },
      { label: 'C', text: 'You must prune remote branches first', is_correct: false },
      { label: 'D', text: 'You must squash before deleting any branch', is_correct: false },
    ]
  },
  {
    num: 43, difficulty: 'medium', topic: 'remotes',
    text: 'Which command deletes a remote branch named feature-auth on origin?',
    explanation: 'git push origin --delete feature-auth requests the remote server to remove the branch ref.',
    options: [
      { label: 'A', text: 'git remote rm origin/feature-auth', is_correct: false },
      { label: 'B', text: 'git push origin --delete feature-auth', is_correct: true },
      { label: 'C', text: 'git delete-remote origin feature-auth', is_correct: false },
      { label: 'D', text: 'git origin branch -d feature-auth', is_correct: false },
    ]
  },
  {
    num: 44, difficulty: 'medium', topic: 'blame',
    text: 'What information does git blame provide for a file?',
    explanation: 'git blame annotates each line with commit hash, author name, and timestamp of last modification.',
    options: [
      { label: 'A', text: 'Calculates code quality defect score', is_correct: false },
      { label: 'B', text: 'Shows line-by-line commit hash, author, and timestamp of last modification', is_correct: true },
      { label: 'C', text: 'Lists developers with write access', is_correct: false },
      { label: 'D', text: 'Detects compiler warnings', is_correct: false },
    ]
  },
  {
    num: 45, difficulty: 'medium', topic: 'merge',
    text: 'If you encounter unexpected merge conflicts, what command cleanly cancels the merge and restores pre-merge state?',
    explanation: 'git merge --abort resets index and working directory to state prior to starting the merge.',
    options: [
      { label: 'A', text: 'git merge --cancel', is_correct: false },
      { label: 'B', text: 'git merge --abort', is_correct: true },
      { label: 'C', text: 'git reset --merge-undo', is_correct: false },
      { label: 'D', text: 'git revert merge', is_correct: false },
    ]
  },
  {
    num: 46, difficulty: 'medium', topic: 'rebase',
    text: 'After manually resolving conflicts during a rebase, what command should you execute?',
    explanation: 'Stage resolved files with git add and run git rebase --continue (do not run git commit).',
    options: [
      { label: 'A', text: 'git commit -m "resolved"', is_correct: false },
      { label: 'B', text: 'git rebase --continue', is_correct: true },
      { label: 'C', text: 'git rebase --finish', is_correct: false },
      { label: 'D', text: 'git merge --rebase', is_correct: false },
    ]
  },
  {
    num: 47, difficulty: 'medium', topic: 'worktree',
    text: 'What Git feature allows you to checkout multiple branches simultaneously in separate linked directories?',
    explanation: 'git worktree allows multiple working trees linked to the same repository database.',
    options: [
      { label: 'A', text: 'git clone --local', is_correct: false },
      { label: 'B', text: 'git worktree', is_correct: true },
      { label: 'C', text: 'git multi-branch', is_correct: false },
      { label: 'D', text: 'git subrepo', is_correct: false },
    ]
  },
  {
    num: 48, difficulty: 'medium', topic: 'submodules',
    text: 'Which command initializes and fetches nested submodules after cloning a repository containing submodules?',
    explanation: 'git submodule update --init --recursive clones and checks out nested submodules.',
    options: [
      { label: 'A', text: 'git submodules --download', is_correct: false },
      { label: 'B', text: 'git submodule update --init --recursive', is_correct: true },
      { label: 'C', text: 'git fetch --submodules-all', is_correct: false },
      { label: 'D', text: 'git clone-deps', is_correct: false },
    ]
  },
  {
    num: 49, difficulty: 'medium', topic: 'stashing',
    text: 'What command creates a new branch named debug-fix directly from stash@{0} and drops the stash entry?',
    explanation: 'git stash branch <branch> checks out the stash commit parent, applies stash, and drops it if clean.',
    options: [
      { label: 'A', text: 'git branch --from-stash debug-fix', is_correct: false },
      { label: 'B', text: 'git stash branch debug-fix', is_correct: true },
      { label: 'C', text: 'git apply-stash --new-branch debug-fix', is_correct: false },
      { label: 'D', text: 'git pop --branch debug-fix', is_correct: false },
    ]
  },
  {
    num: 50, difficulty: 'medium', topic: 'internals',
    text: 'What condition causes a detached HEAD state in Git?',
    explanation: 'Checking out a specific commit hash, tag, or remote branch directly rather than a local named branch.',
    options: [
      { label: 'A', text: 'Repository corruption in packfiles', is_correct: false },
      { label: 'B', text: 'Checking out a specific commit hash or tag directly instead of a local branch', is_correct: true },
      { label: 'C', text: 'Network connection failure during git push', is_correct: false },
      { label: 'D', text: 'Deleting all unstaged files with git clean', is_correct: false },
    ]
  },
  {
    num: 51, difficulty: 'medium', topic: 'merge',
    text: 'In Git merge conflict markers, what content is enclosed between <<<<<<< HEAD and =======?',
    explanation: 'The changes present in your currently checked-out branch (HEAD) before the merge.',
    options: [
      { label: 'A', text: 'Changes from incoming remote branch being merged', is_correct: false },
      { label: 'B', text: 'Changes in your current branch (HEAD) before the merge', is_correct: true },
      { label: 'C', text: 'Common ancestor base version', is_correct: false },
      { label: 'D', text: 'Deprecated changes discarded automatically', is_correct: false },
    ]
  },
  {
    num: 52, difficulty: 'medium', topic: 'merge',
    text: 'What is a three-way merge in Git?',
    explanation: 'A merge algorithm comparing base commit, current branch commit, and incoming branch commit.',
    options: [
      { label: 'A', text: 'A merge between three remote repositories simultaneously', is_correct: false },
      { label: 'B', text: 'A merge using two branch tips and their common ancestor commit base', is_correct: true },
      { label: 'C', text: 'A squash merge spanning three commits', is_correct: false },
      { label: 'D', text: 'A merge requiring three approvals on GitHub', is_correct: false },
    ]
  },
  {
    num: 53, difficulty: 'medium', topic: 'tags',
    text: 'How does an annotated tag (git tag -a) differ fundamentally from a lightweight tag?',
    explanation: 'Annotated tags create full Git tag objects containing tagger info, date, signature, and message.',
    options: [
      { label: 'A', text: 'Lightweight tags cannot be deleted', is_correct: false },
      { label: 'B', text: 'Annotated tags are stored as full Git objects with tagger name, date, and message', is_correct: true },
      { label: 'C', text: 'Annotated tags only exist on remote servers', is_correct: false },
      { label: 'D', text: 'Lightweight tags require GPG key signatures', is_correct: false },
    ]
  },
  {
    num: 54, difficulty: 'medium', topic: 'tags',
    text: 'Why do created tags not appear on origin after git push origin main, and how do you push them?',
    explanation: 'Git does not automatically push tags; you must run git push origin --tags or push tag ref explicitly.',
    options: [
      { label: 'A', text: 'Tags are local-only by design and cannot be pushed', is_correct: false },
      { label: 'B', text: 'Tags must be pushed explicitly with git push origin --tags or git push origin <tag>', is_correct: true },
      { label: 'C', text: 'Tags require enterprise licenses to sync', is_correct: false },
      { label: 'D', text: 'You must commit tags to .gitignore', is_correct: false },
    ]
  },
  {
    num: 55, difficulty: 'medium', topic: 'log',
    text: 'Which git log command displays the commit topology as an ASCII text graph?',
    explanation: 'git log --graph draws an ASCII graph showing branch and merge topology.',
    options: [
      { label: 'A', text: 'git log --graph', is_correct: true },
      { label: 'B', text: 'git log --tree', is_correct: false },
      { label: 'C', text: 'git log --visual', is_correct: false },
      { label: 'D', text: 'git log --ascii', is_correct: false },
    ]
  },
  {
    num: 56, difficulty: 'medium', topic: 'log',
    text: 'Which command lists commit count summary per author in sorted descending order?',
    explanation: 'git shortlog -sn groups commits by author, displays count (-n for numeric sort, -s for summary).',
    options: [
      { label: 'A', text: 'git author-stats', is_correct: false },
      { label: 'B', text: 'git shortlog -sn', is_correct: true },
      { label: 'C', text: 'git committers --ranked', is_correct: false },
      { label: 'D', text: 'git log --authors-only', is_correct: false },
    ]
  },
  {
    num: 57, difficulty: 'medium', topic: 'remotes',
    text: 'Which command updates your local branch tracking refs and deletes stale references removed on origin?',
    explanation: 'git fetch --prune removes local references to branches deleted on the remote repository.',
    options: [
      { label: 'A', text: 'git remote clean', is_correct: false },
      { label: 'B', text: 'git fetch --prune', is_correct: true },
      { label: 'C', text: 'git branch -clean', is_correct: false },
      { label: 'D', text: 'git pull --purge', is_correct: false },
    ]
  },
  {
    num: 58, difficulty: 'medium', topic: 'config',
    text: 'In Git config hierarchy, which configuration level takes highest precedence if a key is defined at all levels?',
    explanation: 'Local config (.git/config) overrides global (~/.gitconfig), which overrides system (/etc/gitconfig).',
    options: [
      { label: 'A', text: 'System configuration (/etc/gitconfig)', is_correct: false },
      { label: 'B', text: 'Local repository configuration (.git/config)', is_correct: true },
      { label: 'C', text: 'Global user configuration (~/.gitconfig)', is_correct: false },
      { label: 'D', text: 'Environment default variables', is_correct: false },
    ]
  },
  {
    num: 59, difficulty: 'medium', topic: 'diff',
    text: 'What does git diff branchA..branchB output?',
    explanation: 'Changes on branchB since it diverged from branchA or differences between both tips.',
    options: [
      { label: 'A', text: 'Shows differences between the tips of branchA and branchB', is_correct: true },
      { label: 'B', text: 'Merges branchA into branchB dry-run', is_correct: false },
      { label: 'C', text: 'Deletes identical commits on both branches', is_correct: false },
      { label: 'D', text: 'Lists conflicting file names only', is_correct: false },
    ]
  },
  {
    num: 60, difficulty: 'medium', topic: 'rebase-interactive',
    text: 'What does the reword command in an interactive rebase todo list accomplish?',
    explanation: 'reword uses the commit as-is but stops the rebase to let you edit the commit message.',
    options: [
      { label: 'A', text: 'Renames all modified files in the commit', is_correct: false },
      { label: 'B', text: 'Applies commit changes and opens an editor to change the commit message', is_correct: true },
      { label: 'C', text: 'Rewrites branch name', is_correct: false },
      { label: 'D', text: 'Changes commit timestamp', is_correct: false },
    ]
  },

  // ==================== 30 HARD ====================
  {
    num: 61, difficulty: 'hard', topic: 'debugging',
    text: 'What binary search debugging command isolates the exact commit that introduced a regression?',
    explanation: 'git bisect uses binary search through history between known good and bad revisions.',
    options: [
      { label: 'A', text: 'git search --binary', is_correct: false },
      { label: 'B', text: 'git bisect', is_correct: true },
      { label: 'C', text: 'git isolate', is_correct: false },
      { label: 'D', text: 'git find-bug', is_correct: false },
    ]
  },
  {
    num: 62, difficulty: 'hard', topic: 'debugging',
    text: 'How can you automate git bisect to test each commit non-interactively using an automated test script?',
    explanation: 'git bisect run <script> runs automated binary search tests until bug commit is pinpointed.',
    options: [
      { label: 'A', text: 'git bisect --auto <script>', is_correct: false },
      { label: 'B', text: 'git bisect run <script>', is_correct: true },
      { label: 'C', text: 'git test --bisect <script>', is_correct: false },
      { label: 'D', text: 'git bisect eval <script>', is_correct: false },
    ]
  },
  {
    num: 63, difficulty: 'hard', topic: 'git-internals',
    text: 'In Git object database (.git/objects), what are the four fundamental immutable object types?',
    explanation: 'Git stores all history in four content-addressed object types: Blobs, Trees, Commits, and Annotated Tags.',
    options: [
      { label: 'A', text: 'Files, Folders, Symlinks, Hardlinks', is_correct: false },
      { label: 'B', text: 'Blobs, Trees, Commits, Tags', is_correct: true },
      { label: 'C', text: 'Branches, Remotes, Stashes, Indexes', is_correct: false },
      { label: 'D', text: 'Diffs, Patches, Headers, Footers', is_correct: false },
    ]
  },
  {
    num: 64, difficulty: 'hard', topic: 'git-internals',
    text: 'In Git object database, what fundamental entity do Blob objects store?',
    explanation: 'Blobs store file data/content only; they do not store file names, directories, or permissions.',
    options: [
      { label: 'A', text: 'Directory structures and timestamps', is_correct: false },
      { label: 'B', text: 'File data content only (no filename or mode metadata)', is_correct: true },
      { label: 'C', text: 'Author signatures and PGP keys', is_correct: false },
      { label: 'D', text: 'Delta compression tables', is_correct: false },
    ]
  },
  {
    num: 65, difficulty: 'hard', topic: 'git-internals',
    text: 'What plumbing command inspects the type and human-readable content of any raw Git object hash?',
    explanation: 'git cat-file -p <hash> pretty-prints content of blob, tree, commit, or tag.',
    options: [
      { label: 'A', text: 'git read-object <hash>', is_correct: false },
      { label: 'B', text: 'git cat-file -p <hash>', is_correct: true },
      { label: 'C', text: 'git dump <hash>', is_correct: false },
      { label: 'D', text: 'git inspect-raw <hash>', is_correct: false },
    ]
  },
  {
    num: 66, difficulty: 'hard', topic: 'git-internals',
    text: 'What does the Git reference notation HEAD^2 refer to?',
    explanation: 'HEAD^2 refers to the second parent commit of a merge commit, whereas HEAD~2 refers to two generations prior.',
    options: [
      { label: 'A', text: 'Two generations prior along first parent history', is_correct: false },
      { label: 'B', text: 'The second parent commit of a merge commit', is_correct: true },
      { label: 'C', text: 'The second line of the commit message', is_correct: false },
      { label: 'D', text: 'The second stash on the stack', is_correct: false },
    ]
  },
  {
    num: 67, difficulty: 'hard', topic: 'git-internals',
    text: 'How does HEAD~3 differ from HEAD^^^ in commit revision navigation?',
    explanation: 'HEAD~3 and HEAD^^^ both refer to 3 generations prior along first parent lineage.',
    options: [
      { label: 'A', text: 'HEAD~3 is invalid syntax in modern Git', is_correct: false },
      { label: 'B', text: 'Both traverse 3 generations prior along the primary first-parent ancestry line', is_correct: true },
      { label: 'C', text: 'HEAD^^^ looks for octopus merge third parent', is_correct: false },
      { label: 'D', text: 'HEAD~3 resets staged files', is_correct: false },
    ]
  },
  {
    num: 68, difficulty: 'hard', topic: 'git-internals',
    text: 'What plumbing command prints the full 40-character SHA-1 object ID pointed to by HEAD?',
    explanation: 'git rev-parse HEAD parses the revision reference and outputs raw object hash.',
    options: [
      { label: 'A', text: 'git hash-name HEAD', is_correct: false },
      { label: 'B', text: 'git rev-parse HEAD', is_correct: true },
      { label: 'C', text: 'git id HEAD', is_correct: false },
      { label: 'D', text: 'git get-hash HEAD', is_correct: false },
    ]
  },
  {
    num: 69, difficulty: 'hard', topic: 'git-internals',
    text: 'Which command checks repository database connectivity and identifies dangling/unreachable objects?',
    explanation: 'git fsck --lost-found verifies connectivity and writes dangling objects to .git/lost-found.',
    options: [
      { label: 'A', text: 'git doctor', is_correct: false },
      { label: 'B', text: 'git fsck --lost-found', is_correct: true },
      { label: 'C', text: 'git recover --all', is_correct: false },
      { label: 'D', text: 'git audit --dangling', is_correct: false },
    ]
  },
  {
    num: 70, difficulty: 'hard', topic: 'git-internals',
    text: 'What does git gc (garbage collection) perform within a repository?',
    explanation: 'Compresses loose objects into packfiles, consolidates packfile indexes, and prunes expired refs.',
    options: [
      { label: 'A', text: 'Deletes branches with no commits in 30 days', is_correct: false },
      { label: 'B', text: 'Packs loose objects into efficient packfiles, updates commit graphs, and prunes expired objects', is_correct: true },
      { label: 'C', text: 'Cleans remote origin servers', is_correct: false },
      { label: 'D', text: 'Empties .gitignore files', is_correct: false },
    ]
  },
  {
    num: 71, difficulty: 'hard', topic: 'rerere',
    text: 'What is Git rerere (reuse recorded resolution) used for?',
    explanation: 'Records how you resolved a conflicted chunk and automatically resolves identical conflicts in future.',
    options: [
      { label: 'A', text: 'Reverts repetitive commits', is_correct: false },
      { label: 'B', text: 'Records merge conflict resolutions and automatically re-applies them when identical conflicts recur', is_correct: true },
      { label: 'C', text: 'Rewrites remote commit authors', is_correct: false },
      { label: 'D', text: 'Reruns failing continuous integration pipelines', is_correct: false },
    ]
  },
  {
    num: 72, difficulty: 'hard', topic: 'hooks',
    text: 'What exit code must a Git hook script return to abort the current Git command (e.g. pre-commit)?',
    explanation: 'Any non-zero exit code (e.g. 1) aborts the Git execution and prevents commit creation.',
    options: [
      { label: 'A', text: 'Exit code 0', is_correct: false },
      { label: 'B', text: 'Any non-zero exit code (e.g., 1)', is_correct: true },
      { label: 'C', text: 'Exit code -1 only', is_correct: false },
      { label: 'D', text: 'Exit code 255 only', is_correct: false },
    ]
  },
  {
    num: 73, difficulty: 'hard', topic: 'hooks',
    text: 'Where are client-side Git hooks stored locally in a newly cloned or initialized repository?',
    explanation: 'In the .git/hooks directory inside repository root.',
    options: [
      { label: 'A', text: '.github/workflows', is_correct: false },
      { label: 'B', text: '.git/hooks', is_correct: true },
      { label: 'C', text: '.githooks.json', is_correct: false },
      { label: 'D', text: 'src/scripts/hooks', is_correct: false },
    ]
  },
  {
    num: 74, difficulty: 'hard', topic: 'security',
    text: 'You accidentally pushed private credentials to a public branch. What is the safest and most permanent remediation?',
    explanation: 'Purge the secret from all history with git-filter-repo/BFG, force push, and immediately revoke the secret.',
    options: [
      { label: 'A', text: 'Add the file to .gitignore and commit a deletion', is_correct: false },
      { label: 'B', text: 'Purge secret from history using git-filter-repo, force push, and immediately revoke credentials', is_correct: true },
      { label: 'C', text: 'Run git revert on the commit', is_correct: false },
      { label: 'D', text: 'Delete the branch and recreate it', is_correct: false },
    ]
  },
  {
    num: 75, difficulty: 'hard', topic: 'plumbing',
    text: 'Which plumbing command writes current staging index state into a new Tree object in object database?',
    explanation: 'git write-tree writes staging index files into a tree object and prints its SHA-1 hash.',
    options: [
      { label: 'A', text: 'git create-tree', is_correct: false },
      { label: 'B', text: 'git write-tree', is_correct: true },
      { label: 'C', text: 'git make-tree', is_correct: false },
      { label: 'D', text: 'git save-index', is_correct: false },
    ]
  },
  {
    num: 76, difficulty: 'hard', topic: 'plumbing',
    text: 'Which plumbing command creates a new Commit object directly given a tree hash and parent commit hash?',
    explanation: 'git commit-tree <tree-hash> -p <parent-hash> -m "msg" creates a raw commit object.',
    options: [
      { label: 'A', text: 'git commit-tree', is_correct: true },
      { label: 'B', text: 'git build-commit', is_correct: false },
      { label: 'C', text: 'git raw-commit', is_correct: false },
      { label: 'D', text: 'git make-commit', is_correct: false },
    ]
  },
  {
    num: 77, difficulty: 'hard', topic: 'plumbing',
    text: 'Which plumbing command calculates the SHA hash of a file and optionally writes it into .git/objects (-w)?',
    explanation: 'git hash-object computes object ID and with -w writes it into object database as a blob.',
    options: [
      { label: 'A', text: 'git sha256', is_correct: false },
      { label: 'B', text: 'git hash-object -w <file>', is_correct: true },
      { label: 'C', text: 'git write-blob <file>', is_correct: false },
      { label: 'D', text: 'git store-object <file>', is_correct: false },
    ]
  },
  {
    num: 78, difficulty: 'hard', topic: 'rebase-onto',
    text: 'What does git rebase --onto newbase upstream branch accomplish?',
    explanation: 'Takes commits on branch that diverged from upstream and replays them on top of newbase.',
    options: [
      { label: 'A', text: 'Renames newbase to upstream', is_correct: false },
      { label: 'B', text: 'Transplants commits on branch from upstream base onto a completely different newbase branch', is_correct: true },
      { label: 'C', text: 'Copies submodules onto branch', is_correct: false },
      { label: 'D', text: 'Performs a three-way squash merge', is_correct: false },
    ]
  },
  {
    num: 79, difficulty: 'hard', topic: 'internals',
    text: 'By default, what is the retention period before git gc prunes unreachable reflog entries?',
    explanation: 'Default gc.reflogExpireUnreachable is 30 days (while reachable entries expire in 90 days).',
    options: [
      { label: 'A', text: '24 hours', is_correct: false },
      { label: 'B', text: '30 days for unreachable entries (90 days for reachable)', is_correct: true },
      { label: 'C', text: '7 days', is_correct: false },
      { label: 'D', text: 'Indefinitely until manual deletion', is_correct: false },
    ]
  },
  {
    num: 80, difficulty: 'hard', topic: 'sparse-checkout',
    text: 'In monorepos, what Git feature allows checking out only a specific subset of directories or files?',
    explanation: 'git sparse-checkout restricts working tree to specified directory patterns while keeping full history.',
    options: [
      { label: 'A', text: 'git partial-clone', is_correct: false },
      { label: 'B', text: 'git sparse-checkout', is_correct: true },
      { label: 'C', text: 'git split-view', is_correct: false },
      { label: 'D', text: 'git filter-dir', is_correct: false },
    ]
  },
  {
    num: 81, difficulty: 'hard', topic: 'cloning',
    text: 'What is a shallow clone created via git clone --depth 1?',
    explanation: 'A clone truncated to only the latest commit snapshot without historical ancestry commits.',
    options: [
      { label: 'A', text: 'A clone with only text files', is_correct: false },
      { label: 'B', text: 'A clone containing only the most recent commit without complete historical commit ancestry', is_correct: true },
      { label: 'C', text: 'A read-only repository clone', is_correct: false },
      { label: 'D', text: 'A fork hosted on GitHub', is_correct: false },
    ]
  },
  {
    num: 82, difficulty: 'hard', topic: 'bundle',
    text: 'What command packages repository commits and refs into a single transferable offline binary archive?',
    explanation: 'git bundle create <file.bundle> packages refs and commits for offline sneaker-net git fetch.',
    options: [
      { label: 'A', text: 'git zip-repo', is_correct: false },
      { label: 'B', text: 'git bundle create <file.bundle> --all', is_correct: true },
      { label: 'C', text: 'git tar HEAD', is_correct: false },
      { label: 'D', text: 'git archive-all', is_correct: false },
    ]
  },
  {
    num: 83, difficulty: 'hard', topic: 'signatures',
    text: 'Which git commit flag signs a commit cryptographically using your configured GPG/SSH key?',
    explanation: 'git commit -S (capital S) creates a cryptographically signed commit verified by git log --show-signature.',
    options: [
      { label: 'A', text: 'git commit -s', is_correct: false },
      { label: 'B', text: 'git commit -S', is_correct: true },
      { label: 'C', text: 'git commit --gpg', is_correct: false },
      { label: 'D', text: 'git commit --signoff', is_correct: false },
    ]
  },
  {
    num: 84, difficulty: 'hard', topic: 'merge-strategies',
    text: 'What merge strategy is automatically invoked by Git when merging more than two head references at once?',
    explanation: 'The octopus merge strategy handles merges of 3 or more branches with no complex conflicts.',
    options: [
      { label: 'A', text: 'recursive strategy', is_correct: false },
      { label: 'B', text: 'octopus strategy', is_correct: true },
      { label: 'C', text: 'resolve strategy', is_correct: false },
      { label: 'D', text: 'ort strategy', is_correct: false },
    ]
  },
  {
    num: 85, difficulty: 'hard', topic: 'merge-strategies',
    text: 'What is the crucial difference between git merge -s ours vs git merge -X ours?',
    explanation: '-s ours records merge but discards all other branch changes; -X ours auto-resolves conflicts favoring our side.',
    options: [
      { label: 'A', text: '-s ours is deprecated; -X ours is preferred', is_correct: false },
      { label: 'B', text: '-s ours discards all incoming tree changes; -X ours uses three-way merge auto-resolving conflicts favoring current branch', is_correct: true },
      { label: 'C', text: '-X ours operates only on remote branches', is_correct: false },
      { label: 'D', text: 'Both commands have identical behavior', is_correct: false },
    ]
  },
  {
    num: 86, difficulty: 'hard', topic: 'ignore',
    text: 'What command debugs why a specific file path is being ignored and outputs the matching .gitignore line?',
    explanation: 'git check-ignore -v <path> prints the specific .gitignore file and line pattern responsible.',
    options: [
      { label: 'A', text: 'git why-ignored <path>', is_correct: false },
      { label: 'B', text: 'git check-ignore -v <path>', is_correct: true },
      { label: 'C', text: 'git debug-ignore <path>', is_correct: false },
      { label: 'D', text: 'git inspect-gitignore <path>', is_correct: false },
    ]
  },
  {
    num: 87, difficulty: 'hard', topic: 'plumbing',
    text: 'Which plumbing command updates a branch reference to point directly to a new commit hash safely?',
    explanation: 'git update-ref refs/heads/<branch> <new-hash> safely updates reference files.',
    options: [
      { label: 'A', text: 'git set-branch', is_correct: false },
      { label: 'B', text: 'git update-ref refs/heads/<branch> <hash>', is_correct: true },
      { label: 'C', text: 'git edit-head', is_correct: false },
      { label: 'D', text: 'git link-branch', is_correct: false },
    ]
  },
  {
    num: 88, difficulty: 'hard', topic: 'internals',
    text: 'What role does the packfile index (.idx file) serve in .git/objects/pack/?',
    explanation: 'Contains binary fan-out and hash lookup tables providing O(1) object offset searches in packfiles.',
    options: [
      { label: 'A', text: 'Stores plain-text commit messages', is_correct: false },
      { label: 'B', text: 'Provides fan-out binary search index mapping object SHA hashes to exact byte offsets in .pack file', is_correct: true },
      { label: 'C', text: 'Holds remote credentials securely', is_correct: false },
      { label: 'D', text: 'Tracks working tree modifications', is_correct: false },
    ]
  },
  {
    num: 89, difficulty: 'hard', topic: 'internals',
    text: 'In Git repository index (.git/index), what data is tracked for each staged file?',
    explanation: 'Tracks file path, SHA-1 blob hash, permissions mode, and stat cache (ctime, mtime, size, inode).',
    options: [
      { label: 'A', text: 'Only file name and author email', is_correct: false },
      { label: 'B', text: 'File path, blob SHA hash, file mode, and cached filesystem stat metadata (mtime, ctime, size)', is_correct: true },
      { label: 'C', text: 'Historical commit ancestry tree', is_correct: false },
      { label: 'D', text: 'Continuous integration results', is_correct: false },
    ]
  },
  {
    num: 90, difficulty: 'hard', topic: 'git-internals',
    text: 'What command verifies the cryptographic integrity and packing of Git packfiles on disk?',
    explanation: 'git verify-pack -v verifies packfile structure and prints per-object compression statistics.',
    options: [
      { label: 'A', text: 'git test-pack', is_correct: false },
      { label: 'B', text: 'git verify-pack -v <packfile.idx>', is_correct: true },
      { label: 'C', text: 'git check-objects', is_correct: false },
      { label: 'D', text: 'git inspect-pack', is_correct: false },
    ]
  }
];

// Assign deterministic UUIDs:
// Easy:   10000000-0000-0000-0000-000000000001 to ...0030
// Medium: 20000000-0000-0000-0000-000000000001 to ...0030
// Hard:   30000000-0000-0000-0000-000000000001 to ...0030
const questions = rawQuestions.map((q) => {
  let prefix = '1';
  let seq = q.num;
  if (q.difficulty === 'medium') {
    prefix = '2';
    seq = q.num - 30;
  } else if (q.difficulty === 'hard') {
    prefix = '3';
    seq = q.num - 60;
  }

  const qId = `${prefix}0000000-0000-0000-0000-${String(seq).padStart(12, '0')}`;
  const optionsWithIds = q.options.map((opt, optIdx) => ({
    id: `opt-${prefix}${String(seq).padStart(2, '0')}-${opt.label.toLowerCase()}`,
    question_id: qId,
    label: opt.label,
    text: opt.text,
    is_correct: opt.is_correct,
  }));

  return {
    id: qId,
    num: q.num,
    text: q.text,
    difficulty: q.difficulty,
    topic: q.topic,
    explanation: q.explanation,
    points_base: 1000,
    options: optionsWithIds,
  };
});

// -------------------------------------------------------------
// 3. WRITE seed-questions.sql
// -------------------------------------------------------------
const questionSql = `-- ============================================================
-- SmartLink Git Quiz — Master Question Bank (90 Questions)
-- Exactly 30 Easy, 30 Medium, 30 Hard
-- ============================================================

INSERT INTO questions (id, text, difficulty, topic, explanation, points_base, is_active) VALUES
${questions.map(q => `('${q.id}', '${q.text.replace(/'/g, "''")}', '${q.difficulty}', '${q.topic}', '${q.explanation.replace(/'/g, "''")}', ${q.points_base}, TRUE)`).join(',\n')}
ON CONFLICT (id) DO UPDATE
SET text = EXCLUDED.text, difficulty = EXCLUDED.difficulty, topic = EXCLUDED.topic, explanation = EXCLUDED.explanation;
`;

fs.writeFileSync('scripts/seed-questions.sql', questionSql);
console.log('✓ Wrote scripts/seed-questions.sql (90 questions)');

// -------------------------------------------------------------
// 4. WRITE seed-options.sql (360 options)
// -------------------------------------------------------------
const allOptions = questions.flatMap(q => q.options);
const optionSql = `-- ============================================================
-- SmartLink Git Quiz — Question Options (360 Options)
-- Exactly 4 per question with canonical labels A, B, C, D
-- ============================================================

INSERT INTO options (id, question_id, text, is_correct, label) VALUES
${allOptions.map(o => `('${o.id}', '${o.question_id}', '${o.text.replace(/'/g, "''")}', ${o.is_correct ? 'TRUE' : 'FALSE'}, '${o.label}')`).join(',\n')}
ON CONFLICT (id) DO UPDATE
SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct, label = EXCLUDED.label;
`;

fs.writeFileSync('scripts/seed-options.sql', optionSql);
console.log('✓ Wrote scripts/seed-options.sql (360 options)');

// Export JSON metadata for TypeScript scripts and in-memory store
fs.writeFileSync('scripts/data-questions.json', JSON.stringify(questions, null, 2));
fs.writeFileSync('scripts/data-students.json', JSON.stringify(students, null, 2));
console.log('✓ Exported questions and students JSON assets');
