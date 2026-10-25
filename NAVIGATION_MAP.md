# SmartLink Git Tournament Platform — Unified Route & Navigation Map

All pages across the platform have been seamlessly connected with persistent navigation, role-aware routing, and interactive links.

---

## 🧭 Complete Application Route Map

### 1. 🏁 Participant & Contestant Journey
| Route | Page Name | Description & Interconnections |
| :--- | :--- | :--- |
| **`/`** | **Tournament Command Hub** | The central portal landing page. Features live status metrics, quick-entry hero, and interactive cards leading directly to Contestant Arena, Projector, Practice, Watcher, Standings, and Certificate Download. |
| **`/login`** | **Unified Login & Access** | Dual-mode sign-in: **Contestant Tab** (College ID + Join Code e.g. `CS2024001` / `baf4jc`) and **Organizer Tab** (Email + Password). Links directly to Practice Mode, Stage Projector, Leaderboard, and Admin Sign-in. |
| **`/lobby`** | **Contestant Arena Lobby** | Displays live contestant profile, system readiness checks, and assigned question track. Now contains warm-up quick links to **Adaptive Practice Arena (`/practice`)** and **Stage Projector (`/projector`)**. |
| **`/quiz`** | **Live Competitive Arena** | Real-time 15-question quiz engine with 45s countdown timer, anti-cheat tab-blur detection, and auto-submit. Links to results on completion. |
| **`/practice`** | **Adaptive Practice Arena** | Unlimited practice mode with instant explanations and IRT-scored mock questions. Connected to `/lobby`, `/`, and `/download`. |
| **`/final`** | **Official Standings & Leaderboard** | Real-time top 10 rankings, celebratory confetti, user rank display (`#Rank / 200`), and quick-action links to **Claim Certificate (`/download`)**, **Practice Mode (`/practice`)**, and **Portal (`/`)**. |
| **`/download`** | **Certificate Claim Center** | Cryptographically signed certificate generation and PDF download with cross-links back to the Portal (`/`) and Leaderboard (`/final`). |

---

### 2. 📺 Public & Stage Display
| Route | Page Name | Description & Interconnections |
| :--- | :--- | :--- |
| **`/projector`** | **Stage Projector & Audience View** | Fullscreen 1080p/4K high-contrast dark theme display designed for venue projection. Displays live top 10 rankings, active participant count, question-by-question progress, and winner reveal animations. Includes exit links back to the Portal (`/`) and Admin Center (`/admin/dashboard`). |

---

### 3. 🛡️ Admin Suite (`/admin/*`)
All admin pages now feature the unified **`AdminNav`** sticky sub-navigation bar with live badges, quick jump buttons to the **Projector Display** (new tab) and **Participant Lobby**, and active route highlighting:

| Route | Module | Purpose |
| :--- | :--- | :--- |
| **`/admin`** | **Admin Arena Gateway** | Quick jump hub between Live Telemetry Watcher and Advanced Control Center. |
| **`/admin/dashboard`** | **Command Dashboard** | High-level metrics, active quiz state toggle, participant turnout summary, and emergency actions. |
| **`/admin/students`** | **Contestant Roster (200)** | Full directory of 200 enrolled students across 10 colleges with join codes, track assignments, and export tools. |
| **`/admin/monitor`** | **Participant Condition Watcher** | Real-time telemetry monitoring: detects whether each student is **In Quiz**, **In Lobby**, **Away / Tab Blurred**, or **Offline**. |
| **`/admin/live`** | **Arena Conductor** | Broadcast live announcements, control question timers, advance quiz phases, or issue emergency freezes. |
| **`/admin/questions`** | **Question Bank (90 Qs)** | Catalog of 90 Git questions across 6 tracks (15 Qs each) + 5 reserve questions, with difficulty filters and tag search. |
| **`/admin/questions/generate`** | **AI Question Studio** | Interactive generator to craft new Git scenario questions conforming to schema and difficulty standards. |
| **`/admin/flags`** | **Anti-Cheat & Flags** | Tab-blur incident tracker, violation logs, disqualified user management, and manual flag resolution. |
| **`/admin/results`** | **Winners & Standings** | Final tabulation, score recomputation, frozen snapshot creation, and direct links to **Full Verification Workflow (`/admin/verify`)** and **Public Leaderboard (`/final`)**. |
| **`/admin/verify`** | **Winner Verification** | Strict two-person sign-off workflow with cryptographically backed validation before trophy distribution. |
| **`/admin/review`** | **Answer & Anomaly Review** | Detailed breakdown of contestant submissions, flagged attempts, and disputable answers. |
| **`/admin/settings`** | **Settings & Database Backup** | System configurations and full database state backups (supports JSON dump & restore). |
| **`/admin/audit`** | **Audit Trail** | Immutable log of all administrative actions, logins, state changes, and score updates. |
| **`/admin/reports`** | **Psychometric & IRT Reports** | Item Response Theory (IRT) question discrimination curves, facility indices, and tournament analytics. |
| **`/admin/login`** | **Organizer Sign-In** | Dedicated authentication portal for tournament officials and judges. |

---

## 🔗 Header & Global Navigation Integration
The persistent top **`Header`** component across the application now features:
- **Logo & Brand Title** linking directly to `/`.
- **Navigation Links**:
  - `Portal` (`/`)
  - `Arena / Lobby` (`/lobby`)
  - `Practice` (`/practice`)
  - `Leaderboard` (`/final`)
  - `Certificates` (`/download`)
  - `Stage Projector` (`/projector`, with TV icon)
  - `Admin Suite` (Dropdown menu with links to Dashboard, 200 Contestants, Live Monitor, Conductor, Question Bank, Anti-Cheat, and Settings)
- **Role Awareness**:
  - Logged-in Contestant: Displays avatar, college ID, and Logout action.
  - Logged-in Admin: Displays "Admin" badge and link to Control Center.
  - Guest: Displays "Sign In / Join Arena" button directing to `/login`.
