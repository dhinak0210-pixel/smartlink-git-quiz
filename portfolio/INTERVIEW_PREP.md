# Technical Interview Preparation Guide: SmartLink Git Quiz

This document contains in-depth architectural and systems design explanations for six critical engineering questions frequently asked in senior engineering interviews.

---

### Question 1: "Why didn't you use WebSockets or Server-Sent Events (SSE) for synchronizing the live quiz across 200 participants?"

**Answer:**
We deliberately chose **server-authoritative HTTP polling with monotonic client drift correction** over persistent WebSockets or SSE for three architectural reasons:

1. **Free-Tier Serverless Concurrency Limits:** The platform is deployed on Vercel Hobby and Supabase Free. Serverless edge functions terminate immediately after responding; maintaining 200 persistent duplex WebSocket connections triggers connection timeouts, exceeds free connection pooling limits, and incurs cold-start reconnection storms.
2. **Campus Wi-Fi Resilience:** University auditorium Wi-Fi frequently experiences packet loss, aggressive firewall NAT timeouts, and transient connection drops. A dropped WebSocket requires bidirectional handshake renegotiation, during which a student might miss an entire 20-second question phase.
3. **Stateless Idempotency:** In our model, the server state (`started_at`, `question_seconds`, `gap_seconds`) is purely a function of time:
   $$\text{Current Question Index} = \left\lfloor \frac{t_{\text{now}} - t_{\text{start}}}{T_{\text{question}} + T_{\text{gap}}} \right\rfloor$$
   Any client polling `/api/state` immediately calculates the exact current question and elapsed milliseconds, even if they refresh their browser or switch networks mid-quiz.

---

### Question 2: "How did you prevent student timing and answer pattern leakage during post-event data anonymization?"

**Answer:**
Simply dropping names and email addresses is insufficient to prevent re-identification. In high-dimensional educational datasets:
1. **Timing Fingerprint Coarsening:** High-precision millisecond response times form unique fingerprints when aggregated across 15 questions. In `anonymize.py`, all response latencies are aggressively coarsened into 500ms bins (`np.round(t / 500) * 500`) and clamped at the 20,000ms window ceiling. This groups continuous latency curves into discrete frequency intervals, increasing the k-anonymity equivalence group size.
2. **Surrogate Key Shuffling:** Student UUIDs are stripped and mapped to randomly shuffled integers (1 to $N$) using a fixed seed. The mapping table is stored in an uncommitted local file (`_id_mapping_private.json`) that is purged prior to public repository release.
3. **Metadata Sanitization:** Browser user-agents, IP addresses, screen resolutions, and device fingerprints are completely excluded from the anonymized export. Only categorical behavioral events (e.g. `tab_switch`) with coarsened durations are preserved.

---

### Question 3: "Why did you use classical Item Response Theory (IRT) and linear baselines instead of Deep Learning or Transformers for score prediction?"

**Answer:**
This decision is rooted in empirical sample complexity and statistical validity:
1. **Sample Size Constraints:** The event generated ~3,000 answers across 200 students. Deep neural networks or transformer architectures operating on $N=200$ samples with 15 binary features will catastrophically overfit, memorizing student noise rather than generalizing latent traits.
2. **Psychometric Interpretability:** Classical IRT (1PL/2PL models) estimates parameters with direct physical meanings: item difficulty ($b$), item discrimination ($a$), and student latent ability ($\theta$). This allows departmental faculty to mathematically inspect whether easy questions were truly easier than hard questions across the logistic curve:
   $$P(Y_{ij} = 1 \mid \theta_i, a_j, b_j) = \frac{1}{1 + e^{-a_j(\theta_i - b_j)}}$$
3. **Honest Baseline Discipline:** In `skill_prediction.py`, we enforced that every model must beat a trivial mean-score baseline under strict student-level cross-validation (`GroupKFold`). Linear regression achieved an MAE of 1,330 points (beating the 1,993 baseline with $R^2 = 0.521$), whereas complex gradient boosting (XGBoost) yielded an MAE of 1,366 points without statistically significant gain. Reporting the linear model's superiority is honest, rigorous engineering.

---

### Question 4: "How does your two-organizer consensus gate work, and why is human-in-the-loop validation mandatory?"

**Answer:**
Hard Rule #1 of our architecture states: **Automate messages and files, NEVER decisions.**

1. **Two-Organizer Cryptographic Gate:** In `src/app/api/admin/results-page/publish/route.ts`, publication of the public results page is gated behind two approvals recorded in `results_approval`. The server validates that:
   - Both approvers hold verified admin JWT sessions.
   - Approver 2 possesses a distinct identity from Approver 1 (`approver_id !== existingApprovals[0].approved_by`). Attempts by the same organizer to approve twice return an `HTTP 409 Conflict`.
2. **Why Human Adjudication is Mandatory:** Automated disqualifications based solely on client telemetry (e.g. tab switching or rapid responses) are susceptible to false alarms. In our post-event audit, 5 students flagged by machine learning models were inspected by human proctors and found to have experienced benign network reconnects or rapid reading speeds. Automatic disqualification would have unjustly penalized legitimate top performers.

---

### Question 5: "Why did you build custom client-side heuristics instead of relying on third-party proctoring plugins?"

**Answer:**
1. **Zero Budget Constraint:** Commercial proctoring extensions (e.g. Proctorio, Honorlock) charge significant per-student licensing fees and require intrusive software installations that violate university privacy policies.
2. **Privacy & Sandboxing:** Many third-party plugins require root system access, camera feeds, and biometric scanning. Our platform operates cleanly in a standard browser tab without plugins or native permissions, measuring only the student's interaction with the quiz viewport (`document.visibilityState`, `window.onblur`, `window.onfocus`).
3. **Transparent Trust Score:** Rather than locking a student out mid-exam, anomalies incrementally decrement a local Trust Score. This guarantees the student finishes their assessment uninterrupted while providing proctors with a timestamped review dossier.

---

### Question 6: "How does the Elo rating update system select questions in practice mode?"

**Answer:**
Version 2 uses an adaptive Elo matchmaking engine (`apps/practice/src/lib/elo.ts`) based on the **Zone of Proximal Development (ZPD)**:

1. **Expected Win Probability:**
   $$E_A = \frac{1}{1 + 10^{(R_{\text{question}} - R_{\text{student}}) / 400}}$$
2. **Targeted Matchmaking:** When selecting the next question, rather than pairing students with questions of equal rating ($E_A = 0.50$, which causes student frustration), the algorithm targets an expected success rate of **$E_A \approx 0.65$**. This guarantees students feel challenged while experiencing sufficient positive reinforcement to maintain flow state.
3. **Dynamic K-Factor:** A dynamic $K$-factor is applied: $K=40$ for the first 10 placement drills to accelerate rating convergence, settling to $K=16$ for stabilized practice.
