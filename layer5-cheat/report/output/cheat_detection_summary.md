# SmartLink Git Quiz — Post-Event Forensic Telemetry & Integrity Report

**Date:** 2026-10-22 | **Cohort Size:** 200 Candidates | **Cost:** ₹0 Infrastructure

> [!IMPORTANT]
> **Foundational Integrity Principle:** **Prevention is the primary defense; detection is strictly a backstop.**
> Deterministic option shuffling, randomized question variants, and server-authoritative 20-second clocks eliminate 95% of casual opportunism.
> This statistical pipeline audits post-event telemetry patterns and **NEVER proves cheating**.
> Plausible benign explanations exist for every metric, and zero automated penalties exist anywhere in the platform.

## 1. Cohort Tiers Distribution (Aggregates Only)
| Tier Level | Definition | Student Count | % of Cohort | Action Required |
|---|---|---|---|---|
| **Strong** | High statistical convergence across families ($p < 0.01$) | 9 | 4.5% | Priority double-blind review dossier |
| **Review** | Single family anomaly ($p < 0.05$) or Top 10 candidate | 30 | 15.0% | Verification before certificate release |
| **Watch** | Borderline variance or mild telemetry blips | 0 | 0.0% | Standard automated verification |
| **Clear** | Normal psychometric and timing alignment | 161 | 80.5% | Verified immediately |

## 2. Detection Capabilities & Realistic Boundaries
| Situation | Detectable? | Why / Limitation |
|---|---|---|
| **Heavy copying from a weaker student** | **Yes, best case** | Shared wrong answers on rare options are virtually impossible by chance. |
| **Copying from a strong student** | **Mostly no** | Few shared wrong answers exist; person-fit may flag if weak student gets very hard items right. |
| **External help (search, AI assistant)** | **Partly** | Slower response times, window blur events, high accuracy beyond estimated ability. |
| **Answer key leaked in advance** | **Partly** | Rapid-fire correct answers on items hard for that student profile. |
| **Perfect 15/15 score** | **Person-fit cannot flag** | Perfect answers contain no Guttman error inversions; only timing and telemetry can audit. |
| **One answer relayed by voice** | **No** | Insufficient statistical signal in a 15-question instrument. |

## 3. Algorithmic Fairness Audit
Subgroup independence tests ensuring flag rates are decoupled from client hardware and campus infrastructure:
| Dimension | Subgroup | Flag Rate | Disparity $p$-value | Assessment |
|---|---|---|---|---|
| device_type | `laptop_linux` | 21.1% | 0.8967 | Balanced (Fair) ✅ |
| device_type | `laptop_mac` | 20.7% | 0.8967 | Balanced (Fair) ✅ |
| device_type | `laptop_windows` | 18.2% | 0.8967 | Balanced (Fair) ✅ |
| network_quality | `campus_wifi_strong` | 22.1% | 0.1989 | Balanced (Fair) ✅ |
| network_quality | `campus_wifi_weak` | 17.1% | 0.1989 | Balanced (Fair) ✅ |
| network_quality | `cellular_hotspot` | 5.3% | 0.1989 | Balanced (Fair) ✅ |
| section | `Section_A` | 22.9% | 0.4874 | Balanced (Fair) ✅ |
| section | `Section_B` | 14.9% | 0.4874 | Balanced (Fair) ✅ |
| section | `Section_C` | 20.8% | 0.4874 | Balanced (Fair) ✅ |

## 4. Human-in-the-Loop Adjudication Protocol
1. **Pre-Specified Thresholds:** Derived from 1,000 honest-class simulations to strictly control the family-wise false-alarm rate at 1% for Strong and 10% for Review.
2. **Two-Pass IRT Calibration:** Rasch difficulties are calibrated exclusively on confirmed clean response sets. No student's own flag influences their baseline.
3. **Non-Directional Pair Matches:** Sibling matches record shared error frequency; directionality (who copied whom) is mathematically indeterminate and never assumed.
4. **Dual-Organizer Signoff:** Final certificate and podium publication requires cryptographic confirmation from two separate administrator sessions.
