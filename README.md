# SmartLink Git Quiz — Zero-Cost Real-Time Arena Engine

> **Production-grade live Git quiz platform designed for 200 concurrent attendees at zero financial cost (₹0).**

---

## 🎯 Architecture & Performance Overview

| Layer | Service / Tech | Zero-Cost Provisioning Strategy |
| :--- | :--- | :--- |
| **Framework** | Next.js 14+ (App Router) | Server Components, Edge Headers, Dynamic Route Handlers |
| **Hosting** | Vercel Hobby | 100 GB Bandwidth, 1M edge invocations, 100 build min/mo |
| **Database** | Supabase Free (PostgreSQL) | Connection pooling, RLS policies, custom indexed queries |
| **Auth** | Custom Session Tokens | Cookie + Header based, no external auth fees or rate-limits |
| **AI Layer** | Google Gemini (Groq Backup) | Pre-event question synthesis & post-event batched reports |
| **Spectator** | Big-Screen Projector | Top 10 rankings, large typography, top 3 podium animations |
| **Anti-Cheat** | Server-Side Analysis | Tab switch & blur detection, option shuffling, rapid answer flags |
| **Certificates** | Python Vector PDF Generator | High-res verifiable PDFs generated in <1 min |
| **Fallback** | Google Forms Quiz Mode | Pre-configured backup ready in <2 minutes |

---

## ⚡ Polling Intervals & Traffic Matrix

| Endpoint | Target Audience | Polling Rate | Approx Peak Traffic | Cache Policy |
| :--- | :--- | :--- | :--- | :--- |
| `/api/event/status` | 200 Students | 3 seconds | ~67 req/s | `public, max-age=1, stale-while-revalidate=2` |
| `/api/leaderboard` | 200 Students | 5 seconds | ~40 req/s | Server memory cache (5s TTL) |
| `/api/question/current` | 200 Students | On question shift | Burst of 200 | Per-student deterministic option shuffle |
| `/api/clock-sync` | 200 Students | On join + 2min | Negligible | Median of 3 round-trips (NTP-Lite) |

---

## 🚀 Quick Start & Local Execution

### 1. Requirements
- Node.js 18+ or 20+
- Python 3.8+ (for post-event scripts)

### 2. Installation
```bash
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
- Default admin password: `admin123`
- Default Supabase: Built-in local fallback store operates immediately if remote Supabase is offline or unconfigured.

### 4. Running the Dev Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to participate.

- **Student Portal**: [http://localhost:3000](http://localhost:3000)
- **Admin Portal**: [http://localhost:3000/admin](http://localhost:3000/admin) (Password: `admin123`)
- **Projector Spectator Screen**: [http://localhost:3000/projector](http://localhost:3000/projector)

---

## 🧪 Simulation & Load Testing

Run the 200 concurrent student simulation:
```bash
node scripts/load-test.js --url http://localhost:3000 --students 200
```

Generate verifiable student PDF certificates:
```bash
python3 scripts/generate-certificates.py --url http://localhost:3000
```

Run statistical cheat & collusion detection:
```bash
python3 scripts/cheat-detection.py --url http://localhost:3000
```

---

## 🛡️ Anti-Cheat & Security Measures

1. **Deterministic Option Shuffling**: Each student receives a unique deterministic permutation of options based on their student ID and question seed, preventing visual copying and screen sharing.
2. **Server-Side Grading & Timing**: The browser is never trusted. Answer points are calculated server-side using the `question_started_at` anchor.
3. **NTP-Lite Clock Sync**: Calibrates client clock drift using median round-trip measurements.
4. **Sub-1.5s Speed Flags**: Flags answers submitted too fast to be humanly read.
5. **Telemetry Stream**: Tracks tab visibility loss, window blur, and devtools keyboard attempts.

---

## 📋 Emergency Google Forms Fallback Protocol
In case of campus WiFi blackout or upstream cloud outage:
1. Admin toggles the Google Forms fallback link broadcasted on the projector.
2. All 15 questions are pre-loaded in Google Forms Quiz Mode.
3. Transition completes in under 2 minutes with zero student disruption.
