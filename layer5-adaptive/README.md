# Adaptive Practice Mode with Elo & IRT Seeding (ML)
*Part of SmartLink Git Quiz Post-Event Portfolio & Practice Suite*

## 1. Executive Summary & Anti-Competition Invariant

Adaptive Practice Mode is an intelligent post-event learning engine designed to present students with questions tailored to their personalized skill level (Zone of Proximal Development).

```
         ┌────────────────────────────────────────────────────────┐
         │              LIVE COMPETITION LEADERBOARD              │
         │         (Strictly Immutable by Practice Mode)          │
         └────────────────────────────────────────────────────────┘
                                     ▲
                                     │ [AIR-GAP BARRIER]
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      ADAPTIVE PRACTICE MODE (ML)                        │
│                                                                         │
│  [Student Request] ──► [Epsilon-Greedy Selector] ──► [Target Question]  │
│                                                            │            │
│  [Updated Student/Question Elo] ◄── [Dual-Update Engine] ◄─┘            │
└─────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **PRACTICE ONLY INVARIANT:** Practice drills, session logs, and practice Elo ratings reside in dedicated practice tables (`practice_ratings`, `practice_sessions`, `practice_answers`). They **NEVER** alter tournament scores, competition ranks, or official leaderboards.

---

## 2. Mathematical Foundation: IRT to Elo Mapping

During Layer 5 IRT calibration, questions were fitted to Item Response Theory models (1PL/2PL) producing difficulty parameters $\beta \in [-3.0, +3.0]$ on the logistic logit scale:
$$P(\theta) = \frac{1}{1 + e^{-a(\theta - \beta)}}$$

In classical Elo rating systems (Chess/competitive gaming), the expected probability of victory when player $A$ faces opponent $B$ is:
$$E_A = \frac{1}{1 + 10^{(R_B - R_A)/400}}$$

Equating the logistic exponent to the base-10 Elo exponent yields:
$$e^{-(\theta - \beta)} \equiv 10^{-(R_A - R_B)/400}$$
$$\ln(10) \times \frac{R_B - R_A}{400} = \beta - \theta$$
$$R_B - R_A = \frac{400}{\ln(10)} (\beta - \theta) \approx 173.7178 \times (\beta - \theta)$$

Anchoring the median student and median question at $R_0 = 1500$, we obtain the exact conversion formula:
$$\text{Elo}_{\text{question}} = 1500 + 173.7178 \times \beta_{\text{IRT}}$$

### Empirical Distribution in SmartLink Quiz
From 90 calibrated items:
- **Minimum Elo:** `1131.7` (Beginner basics like `git init`)
- **Median / Mean Elo:** `1498.4` (Intermediate staging/branching)
- **Maximum Elo:** `1788.1` (Advanced rebasing, reflogs, octopus merges)

---

## 3. Dynamic Elo Update Mechanism

When a student attempts a question, both the student's ability estimate and the question's difficulty rating update simultaneously in opposite directions:

$$\Delta_{\text{student}} = K \times (S_{\text{actual}} - E_{\text{expected}})$$
$$\Delta_{\text{question}} = K \times (E_{\text{expected}} - S_{\text{actual}})$$

### Two-Phase K-Factor Protocol
- **Fast Calibration ($N \le 20$ drills):** $K = 32$. Rapidly moves student Elo toward their true skill level with minimal latency.
- **Stabilization ($N > 20$ drills):** $K = 16$. Dampens noise and prevents erratic swings from accidental misclicks.

---

## 4. Question Selection: $\epsilon$-Greedy with Ability Matching

To avoid hyper-specialization or question starvation, the selector (`src/lib/question-selector.ts`) balances exploitation and exploration:

1. **Filtering:** Excludes questions already answered in the active practice session.
2. **Exploration ($15\%$ probability):** Selects uniformly at random from unattempted questions, discovering uncalibrated edges.
3. **Exploitation ($85\%$ probability):** Minimizes distance to the student's current Elo, weighted by question discrimination:
   $$\text{Score}(q) = \frac{|\text{Elo}_q - \text{Elo}_s|}{400} - 0.1 \times (a_q - 1.0)$$
   Questions with higher discrimination ($a_q > 1.0$) receive a prioritization bonus because they provide maximum Fisher information.

---

## 5. Lean Supabase Free Schema (`add_practice_tables.sql`)

```sql
practice_ratings (
    student_id UUID PRIMARY KEY,
    elo_rating REAL DEFAULT 1500.0,
    total_practice_answers INTEGER DEFAULT 0,
    total_correct INTEGER DEFAULT 0,
    last_practice_at TIMESTAMPTZ,
    seeded_from_irt BOOLEAN DEFAULT FALSE
);

practice_sessions (
    id UUID PRIMARY KEY,
    student_id UUID REFERENCES students(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    questions_answered INTEGER DEFAULT 0,
    questions_correct INTEGER DEFAULT 0,
    elo_start REAL NOT NULL,
    elo_end REAL
);

practice_answers (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES practice_sessions(id),
    student_id UUID REFERENCES students(id),
    question_id UUID REFERENCES questions(id),
    is_correct BOOLEAN NOT NULL,
    response_ms INTEGER NOT NULL,
    student_elo_before REAL NOT NULL,
    student_elo_after REAL NOT NULL,
    question_elo_before REAL NOT NULL,
    question_elo_after REAL NOT NULL,
    answered_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. Next.js API Routes

| Endpoint | Method | Function |
|---|---|---|
| `/api/practice/start` | `POST` | Authenticates student, seeds Elo from competition IRT if first time, creates session. |
| `/api/practice/next` | `GET` | Selects optimal adaptive question, applies deterministic Fisher-Yates option shuffle. |
| `/api/practice/answer` | `POST` | Submits choice, computes Elo update, updates student & question ratings, returns pedagogical explanation. |
| `/api/practice/stats` | `GET` | Returns full rating curve progression, accuracy by topic, and session history. |

---

## 7. Post-Hoc Analytics & Validation (`practice_analytics.py`)

Validation on a simulated cohort of 50 students across 1,250 drills demonstrated exceptional calibration:
- **0–40% Expected Win-Rate Bin:** Empirical win rate was $30.0\%$ (Gap: $+0.01$).
- **40–60% Expected Win-Rate Bin:** Empirical win rate was $48.0\%$ (Gap: $-0.02$).
- **60–80% Expected Win-Rate Bin:** Empirical win rate was $74.0\%$ (Gap: $+0.04$).
- **80–100% Expected Win-Rate Bin:** Empirical win rate was $92.0\%$ (Gap: $+0.08$).

The system keeps learners comfortably within their Zone of Proximal Development while continuously recalibrating question difficulties.
