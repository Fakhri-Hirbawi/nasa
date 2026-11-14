# AstroHealth — Codex Development Playbook

*NASA Space Apps Challenge 2026 · Version 1.0 · 14 November 2026 · formerly “ORBIT”*

This playbook turns your existing React dashboard and backend into the full AstroHealth demo, one Codex task at a time. It is built from the ORBIT specification (renamed AstroHealth everywhere) and your project brief. It contains **no application code**: only analysis, architecture, task order and copy-ready Codex prompts.

**How to use it:** do Section 6 “Setup” (10 minutes), then run prompts T0 → T27 in order, using the Parallel Strategy (Section 7) if you have several people. Verify each task before starting the next.

---

# 1. Project Understanding and Complete Feature Inventory

## 1.1 What the specification gives us

- **Product:** an offline-first, non-diagnostic astronaut self-monitoring companion. Loop: *Monitor → Interpret → Explain → Follow up → Handoff*.
- **Core innovation (what judges must see):** (1) the same reading means different things for different astronauts, (2) a slow drift is caught before any single day looks alarming, (3) the whole workflow survives losing Earth.
- **Hard rules from the spec:** all data is labeled synthetic; thresholds are labeled unvalidated heuristics; no diagnosis; no fabricated measurements; “queued” is never “sent”; private mood notes never leak; one observation record powers every screen (no separate “truths”).
- **Minimal data contract, three demo storylines, five build stages and a release gate** (cut polish, multi-environment, real sync and AI before cutting transparent analysis or the offline handoff).

## 1.2 What the documents do *not* give us (decisions this plan makes)

- Your **source code, stack, database and API shape** are unknown. Task T0 inspects the repo; nothing here assumes file names.
- The original **10-page team brief** was not uploaded. Environment mode, RAG, countermeasure planner, mental-health support and family connection appear in the spec only as one-liners, so their detailed behavior is **designed here** and marked as such.
- The spec lists no numeric rules. This plan proposes defaults (Shared Spec, Section 6) and marks them **experimental heuristics**. You may tune them; golden tests lock whatever you choose.

## 1.3 How the spec’s tiers map to your “include everything” goal

The spec puts some of your requested features in ADVANCED or FUTURE and explicitly **excludes** others. This plan builds all requested features, **in tiers**, so the core loop is never put at risk:

| Tier | Features | Build rule |
| --- | --- | --- |
| **Tier 1 – MVP** | F1–F11 | Must be fully functional and offline. Critical path. |
| **Tier 2 – Advanced** | F12–F16, F18 | Functional prototypes on top of the stable core. |
| **Tier 3 – Future-as-prototype** | F17 (family connectivity) | Small functional prototype, clearly labeled, built last. |
| **Excluded (per spec)** | Diagnosis chatbot, readiness score, leaderboards, bone-loss or exercise-prescription estimates, camera/ultrasound interpretation, 3D body map | **Not built.** Shown on the Evidence & Limits page as deliberate exclusions. This is a strength with judges. |

“AI assistance” is implemented the way the spec allows: **offline, source-cited procedure and knowledge search** (retrieval over a vetted corpus). It never invents clinical advice.

## 1.4 Complete feature inventory

| ID | Feature | Tier | Source |
| --- | --- | --- | --- |
| F1 | Daily health check-in and record (HR, sleep, fatigue, mood, stress, optional temp) | 1 | Spec §3A |
| F2 | Input validation and data-quality flags (missing, duplicate, stale, implausible) | 1 | Spec §3A |
| F3 | Personal baseline with maturity / confidence labels | 1 | Spec §3B |
| F4 | Point-deviation signal (“Needs review”) | 1 | Spec §3B |
| F5 | Trend Watch (cumulative drift detection) | 1 | Spec §3B |
| F6 | Status dashboard with explainable guidance and approved-instruction catalogue | 1 | Spec §3C |
| F7 | Daily countermeasure and follow-up checklist (“Today”) | 1 | Spec §3D |
| F8 | Offline handoff report (readable + JSON, queue states) | 1 | Spec §3E |
| F9 | Offline-first persistence (PWA, local store, resettable) | 1 | Spec §7 |
| F10 | Synthetic profiles, scenario switcher, provenance labels, privacy separation | 1 | Spec §6–8 |
| F11 | “Evidence & Limits” page and claims audit | 1 | Spec §5, §9 |
| F12 | Mission-context / environment awareness (educational context, reserved sensor inputs) | 2 | Spec §3 table, §6 |
| F13 | Earth-link simulator: delay, blackout, local queue, acknowledged handoff endpoint | 2 | Spec §6 (real handoff endpoint) |
| F14 | Adaptive schedule suggestions (non-prescriptive) | 2 | Spec §6 |
| F15 | Offline source-cited procedure search (“AI assistant”) | 2 | Spec §6 |
| F16 | Mental-health and isolation support (private journal, wellbeing prompts) | 2 | Spec §3A, §5 + brief |
| F17 | Family connectivity: Shared Moments, Memory Capsule, Connection Rhythm | 3 | Spec §6 FUTURE |
| F18 | Richer chart comparison (two astronauts side by side) | 2 | Spec §6; Demo 1 |
| F19 | Demo mode: guided walkthrough, one-click scenario reset | infra | Spec §8–9 |

## 1.5 Overlaps we merge (one implementation, several features)

- **F2+F3+F4+F5 → one deterministic analysis engine** (pure function, no UI, no network).
- **F6+F14 → one action catalogue** feeding both guidance text and schedule suggestions; **F7** stores their outcomes.
- **F8+F13 → one Report object and one outbox queue**; link state only changes how the queue behaves.
- **F12+F13 → one MissionContext config** (environment name, one-way delay, hazard notes).
- **F15+F6 → one knowledge/procedure corpus**: cards link into the same documents the assistant searches.
- **F16+F17 → one sharing-preferences and privacy model**, and both use the F13 outbox for delayed delivery.
- **F9+F10 → one storage layer and one fixture loader**, so “reset scenario” is a single call.

---

# 2. Recommended Final System Architecture

## 2.1 Design principles

1. **The core loop runs entirely in the browser.** The backend is optional for the demo: it acts as a simulated ground station that receives handoffs and returns an acknowledgement. This is what makes the offline claim true.
2. **Engine is a pure, deterministic module** (`assess(...)` with an injected `now`). Same input, same output, always. UI and backend never re-implement analysis.
3. **One observation store.** Dashboard, charts, checklist, report and assistant all read the same records.
4. **Fixtures are bundled with the frontend** (not fetched), so scenarios replay identically offline.
5. **Reuse first.** Wrap or extend existing dashboard components; add new routes/pages; avoid refactors.

## 2.2 Logical layers (map to real folders after T0)

```
UI (React): Today | Check-in | Trends/Why | Follow-up | Handoff | Assistant | Wellbeing | Family | Mission | Evidence & Limits | Ground Station (sim)
   │ reads/writes via
State + Store layer: astronaut/session state, observation store (local), outbox queue, private store (separate partition)
   │ calls
Engine (pure): validate → baseline(+maturity) → point deviation → trend (cumulative) → status + explanation → action suggestions
   │ uses
Catalogues (static JSON, versioned): metrics registry, action/procedure catalogue, knowledge corpus, mission contexts, scenarios
   │ optional
Backend: /health, POST /handoff (ack), GET /ground/inbox (sim), optional demo-fixture serving
```

## 2.3 Data models (logical; see Shared Spec for fields)

AstronautProfile · Observation · PrivateEntry (journal, separate partition) · Interpretation (per metric + overall) · ActionEvent · Task (scheduled item) · Report · OutboxItem · MissionContext · KnowledgePassage · FamilyMessage / MemoryItem · ScenarioDefinition.

## 2.4 Data flow (single source of truth)

Check-in → validate → save Observation(s) with provenance → `assess()` → Interpretation list (cached by rule version) → Today cards, Trends, suggestions → user marks ActionEvent → Report builder reads Observations + Interpretations + ActionEvents → Outbox → (link available) backend ack → status “Acknowledged”.

## 2.5 Personalized monitoring and mission context

- Each astronaut has an independent baseline computed from **their own** observations only; no cross-astronaut data is ever used.
- Mission context changes **education, hazard notes, link delay and check-in cadence suggestions**. It never changes health thresholds (no validated environment-adjusted ranges exist). Environmental sensor values, if shown, are **context only**, not used by the engine.

## 2.6 AI-powered features

- Default and demo path: **local retrieval** (keyword/TF-IDF) over a small corpus, returning cited passages, no generation. Works offline, cannot hallucinate.
- Optional stretch (T21B, off by default): an online “explain simply” rewrite restricted to retrieved passages. Never required for any demo step.
- Out-of-scope questions (diagnosis, dosing, treatment) get a fixed refusal pointing to authorized procedures / flight surgeon.

## 2.7 Offline and blackout handling

Service worker caches the app shell and bundled fixtures; store persists across reloads; the header shows **two independent indicators**: *Browser network* (real) and *Earth link* (simulated: Connected / Delayed / Blackout). Outbox items move Prepared → Queued locally → Acknowledged (only on a real backend response).

## 2.8 Decision gates (answered by T0’s report)

| Gate | Default if the repo has no strong preference |
| --- | --- |
| D1 Where does the engine live? | Frontend pure module. If the backend already analyzes data, keep it, but the tested engine used by the UI is the frontend one. |
| D2 Persistence | Reuse the repo’s existing client store; otherwise versioned local storage (data volume is tiny). IndexedDB only if already used. |
| D3 Charts | Reuse the existing chart library; otherwise lightweight inline SVG (no new dependency). |
| D4 Ground-station storage | Existing DB if trivial; otherwise in-memory plus a JSON file. |
| D5 Test runner | Whatever exists; otherwise the one bundled with the frontend toolchain. |

---

# 3. Feature Dependencies and Integration Map

| Feature | Needs | Feeds | Shared component |
| --- | --- | --- | --- |
| F10 Scenarios | Types/models (T3) | everything | Fixture loader, provenance labels |
| F1 Check-in | F2, F9, F10 | F3–F8 | Observation store |
| F2 Validation | Metrics registry | F1, F3, F8 | `validate()` |
| F3 Baseline | F2 | F4, F5, F6, F8 | Engine |
| F4 Point signal | F3 | F6, F14 | Engine |
| F5 Trend Watch | F3 | F6, F14, F16 | Engine |
| F6 Dashboard/guidance | F4, F5, catalogue | F7, F8, F15 | Action catalogue |
| F7 Checklist | F6, Task list | F8, F14 | ActionEvent store |
| F8 Handoff | F1–F7 | F13 | Report + Outbox |
| F9 Offline | store, service worker | all | Store |
| F11 Evidence page | all rules | judges | Rule registry |
| F12 Mission context | config | F13, F14, F15 | MissionContext |
| F13 Link + ack | F8, F12, backend | F17 | Outbox, link state |
| F14 Adaptive suggestions | F5, F6, F7, F12 | F7 | Action catalogue |
| F15 Procedure search | corpus, F6 | F6 links | Knowledge corpus |
| F16 Wellbeing | F5, private store | F8 (opt-in) | Privacy model |
| F17 Family | F13, F16 privacy | – | Outbox, sharing prefs |
| F18 Comparison charts | F3, F10 | Demo 1 | Chart component |

**Critical path:** T0 → T1 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11 → T13 → T14 → T15 → T26.

---

# 4. Detailed Feature-by-Feature Implementation Specifications

Legend: **R** = real functionality, **S** = deterministic simulation, **F** = future production capability (documented only). Task numbers refer to Section 5.

### F1 Daily Health Check-in and Record (T10)

- **Purpose:** capture a small, feasible set of indicators often enough for trends.
- **Behavior:** a ≤2-minute form (HR, sleep, fatigue, mood, stress, optional temp, with units shown). Save shows the resulting assessment immediately. Missing fields stay missing; never defaulted.
- **Frontend:** check-in page, history list with provenance badge, “data missing / recheck” state.
- **Backend:** none required.
- **Data:** Observation records (metric, value, unit, timestamp, method=manual/simulated, provenance, quality flag).
- **Integration:** triggers `assess()`; mood notes go to the private store.
- **Testing:** submit valid, partial, and invalid entries; reload; offline.
- **Demo:** Demo 3 (offline entry). **R:** form, storage. **S:** nothing. **F:** wearable ingestion.

### F2 Validation and Data Quality (T5)

- **Purpose:** keep bad data from becoming bad conclusions.
- **Behavior:** flags *missing, duplicate, stale (>48 h), implausible, unit-suspect* (e.g., Fahrenheit typed as Celsius). Quality problems outrank analytics and produce “Unable to assess” for that metric.
- **Frontend:** inline form errors; quality chips on cards and history.
- **Data:** metrics registry (unit, plausible range, scale, adverse direction).
- **Testing:** table-driven unit tests for every flag. **R** entirely.

### F3 Personal Baseline and Confidence (T6)

- **Purpose:** “normal” is personal.
- **Behavior:** robust median/spread from the astronaut’s own recent days, excluding the trend window. Shows **baseline maturity** (Not enough data / Limited / Established) and completeness. With few points, a cautious reference spread is borrowed and labeled “unvalidated heuristic.”
- **Frontend:** baseline band on charts, maturity badge, “why” text.
- **Data:** window parameters, per-metric spread floor.
- **Testing:** golden numbers for AST-01/02/04. **R:** math. **F:** calibrated, validated models.

### F4 Point Deviation (T7)

- **Purpose:** flag a single reading that is unusual *for this person*.
- **Behavior:** robust z-score against baseline; |z| ≥ threshold → “Needs review.” Same +14 bpm yields different outcomes for AST-01 vs AST-02.
- **Frontend:** card with current value, personal reference, window, quality, plain-English reason.
- **Testing:** Demo 1 contract test.

### F5 Trend Watch (T7)

- **Purpose:** catch silent drift.
- **Behavior:** cumulative-sum style statistic over the last 7 days in the *adverse* direction per metric; fires when it crosses a limit even if no single day is flagged. Informational only; never raises clinical urgency.
- **Frontend:** trend chart with highlighted window and a “why” sentence.
- **Testing:** Demo 2 contract test: sleep 7.2 → 6.5 h in seven days fires Trend Watch, no point flag.

### F6 Status Dashboard and Explainable Guidance (T11)

- **Purpose:** calm, explainable status instead of opaque colors.
- **Behavior:** four cards: *No new concern detected / Trend to watch / Review recommended / Unable to assess*, each opening *what changed / why / next check* with a link to the procedural reference. Never uses redundant-less color: icon + text + color.
- **Backend:** none. **Data:** versioned action catalogue (synthetic placeholders; real procedures come from authorized sources).
- **Integration:** links to F15 passages, creates F7 follow-ups.

### F7 Follow-up Checklist (T13)

- **Purpose:** close the loop with existing mission routines.
- **Behavior:** today’s scheduled tasks; mark complete / deferred / skipped; recheck suggestion appears when data warrant attention; no changes to exercise intensity or medication.
- **Data:** Task, ActionEvent (stored with the observation timeline).
- **Testing:** state persists after reload; appears in the report.

### F8 Offline Handoff Report (T14)

- **Purpose:** make the offline constraint a feature.
- **Behavior:** pick period and what to include; deterministic readable report + JSON export with provenance, baseline maturity, uncertainty, missing data, outstanding follow-ups, rule versions. Copy/download. Status: *Prepared* → *Queued locally* → (F13) *Acknowledged*.
- **Testing:** same inputs → byte-identical JSON (except generation timestamp field, which is injected).

### F9 Offline-First Persistence (T15)

- **Purpose:** everything works with networking disabled.
- **Behavior:** installable PWA; app shell cached; data survives reload; “Reset scenario” restores fixtures.
- **Risk:** service-worker caching can serve stale builds; plan includes a cache-version bump and a hard-reset button.

### F10 Synthetic Scenarios, Profiles, Privacy (T4, T9)

- **Purpose:** reproducible demos and honest labeling.
- **Behavior:** profile switcher (AST-01…04) and scenario picker; banner “Synthetic demonstration data” always visible; private entries partitioned per astronaut; no cross-astronaut leakage.
- **Demo:** Demo 1.

### F11 Evidence & Limits (T16)

- **Purpose:** show every assumption.
- **Behavior:** one page listing each rule, its version, its status (supported / team hypothesis / simulated), the five hazards table, NASA source links \[1–6\], and deliberate exclusions. A claims-audit list mirrors every on-screen scientific statement.

### F12 Mission Context (T19)

- **Purpose:** context-aware presentation without invented thresholds.
- **Behavior:** presets (Mars transit default, LEO station, lunar surface) change hazard notes, typical one-way delay and cadence hints. Reserved inputs for CO₂/radiation show “Not connected”; optional synthetic strip is labeled “context only, not used in assessment.”
- **R:** config + UI. **S:** environment values. **F:** real sensors.

### F13 Earth Link, Delay, Blackout, Acknowledged Handoff (T17, T18)

- **Purpose:** demonstrate asynchronous operations honestly.
- **Behavior:** header link control (Connected / Delayed / Blackout); outbox queues while not connected; on reconnect a countdown models one-way delay; the backend returns an ack that flips status to *Acknowledged by simulated ground station*.
- **Backend:** `/health`, `POST /handoff`, `GET /ground/inbox` (+ a tiny Ground Station page).
- **Fallback:** backend down → items stay “Queued locally”.

### F14 Adaptive Schedule Suggestions (T20)

- **Purpose:** connect findings to routines.
- **Behavior:** deterministic rules turn signals into **suggestions** (re-measure after rest; protect an existing rest window; review a cited procedure; schedule an existing private-time slot). User accepts/dismisses; nothing is prescriptive or automatic.

### F15 Offline Procedure Search / “AI Assistant” (T21, T21B)

- **Purpose:** answer “what does the approved guidance say?” offline.
- **Behavior:** ask a question → ranked passages with citations and a *verified by human* flag; refusals for diagnosis/dosing/treatment.
- **Data:** 10–14 short team paraphrases of NASA sources \[1–6\] plus clearly fictional “synthetic procedure cards.”

### F16 Mental-Health and Isolation Support (T22)

- **Purpose:** support without diagnosing.
- **Behavior:** private journal (never in reports unless intentionally selected), isolation-pattern prompts from mood/stress/sleep trends, supportive non-diagnostic prompts, link to a scheduled private conference item (synthetic).

### F17 Family Connectivity Prototype (T23)

- **Purpose:** keep human connection measurable only as *rhythm*, never as a score.
- **Behavior:** Shared Moments (curated text entries), Memory Capsule (saved items), Connection Rhythm (days since last exchange vs planned cadence, neutral wording), messages delayed via the F13 outbox. Family never sees health data.

### F18 Comparison Charts (T12)

- Side-by-side AST-01 vs AST-02 HR with each astronaut’s own band, same axis, shown on one screen for Demo 1.

### F19 Demo Mode (T25)

- Scenario buttons, one-click reset, optional presenter overlay with talking points and expected result for each step.

---

# 5. Complete Step-by-Step Codex Development Roadmap

**Difficulty:** E easy, M medium, H hard. **CP:** on critical path. Priority: P0 must, P1 should, P2 nice.

| # | Task | Depends on | Diff | Pri | CP | Fastest reliable approach |
| --- | --- | --- | --- | --- | --- | --- |
| T0 | Repository inspection (read-only) | Setup | E | P0 | ✔ | Report only, zero edits |
| T1 | Safety net, baseline tests, naming | T0 | E | P0 | ✔ | Branch + rename constants |
| T3 | Types, metrics registry, store API | T1 | M | P0 | ✔ | Plain modules, no new deps |
| T4 | Synthetic fixtures + scenario loader | T3 | M | P0 | ✔ | Hand-authored key arrays + seeded filler |
| T5 | Validation and quality flags | T3 | E | P0 | ✔ | Table-driven rules |
| T6 | Personal baseline + maturity | T5 | M | P0 | ✔ | Median/MAD, window rules |
| T7 | Point deviation, Trend Watch, status, explanations | T6 | H | P0 | ✔ | One pure `assess()` |
| T8 | Golden tests for the 3 demos | T4, T7 | M | P0 | ✔ | Assertions on fixtures |
| T9 | App shell, banners, switchers | T3, T4 | M | P0 | ✔ | Reuse existing layout |
| T10 | Check-in page | T5, T7, T9 | M | P0 | ✔ | Controlled form, store write |
| T11 | Today dashboard + detail drawer | T7, T9 | M | P0 | ✔ | Four card variants |
| T12 | Trends/Why + comparison view | T7, T9 | M | P0 | – | Existing chart lib or SVG |
| T13 | Follow-up checklist | T11 | M | P0 | ✔ | Task list + ActionEvent |
| T14 | Handoff report + export | T7, T13 | M | P0 | ✔ | Deterministic builder |
| T15 | Offline/PWA + privacy partition | T10, T14 | H | P0 | ✔ | Service worker + cache version |
| T16 | Evidence & Limits page, claims audit | T7 | E | P0 | – | Static page from rule registry |
| T17 | Earth-link simulator + outbox | T14 | M | P1 | – | State machine + timers |
| T18 | Backend ground station + ack | T17 | M | P1 | – | Two endpoints + tiny page |
| T19 | Mission context | T9 | E | P1 | – | JSON presets |
| T20 | Adaptive schedule suggestions | T13, T19 | M | P1 | – | Rule table |
| T21 | Offline procedure search | T11 | M | P1 | – | In-JS TF-IDF, no deps |
| T21B | Optional online “explain simply” | T21 | M | P2 | – | Flag-gated, skip if time-poor |
| T22 | Mental-health & isolation support | T7, T15 | M | P1 | – | Private store + prompts |
| T23 | Family connectivity prototype | T17, T22 | M | P2 | – | Text-only, outbox reuse |
| T24 | Responsive, accessibility, visual polish | T11–T23 | M | P1 | – | Targeted pass |
| T25 | Demo mode + presenter overlay | T8, T24 | M | P1 | ✔ | Scenario buttons + script |
| T26 | Full-project QA and integration | all | H | P0 | ✔ | Audit + fix loop |
| T27 | Demo-day freeze, fallback build | T26 | E | P0 | ✔ | Static build + recording |

(T2 is intentionally merged into T1.)

---

# 6. Ready-to-Copy Codex Prompts for Every Task

## 6.0 Setup (human, about 10 minutes, no Codex needed)

1. In your repo run `git checkout -b astrohealth-demo`, then `git tag pre-astrohealth` (your rollback anchor).
2. Create `AGENTS.md` in the repo root and paste Block A below. Codex reads this file automatically, so every prompt stays short. If your Codex setup ignores it, paste Block A at the top of each prompt.
3. Create `docs/ASTROHEALTH_SPEC.md` and paste Block B below. It is the single source of truth for labels, rules, data shapes and scenarios.
4. Commit both with `git add -A && git commit -m "AstroHealth: agents + spec"`.

**Per-task loop (every task):** paste the prompt, let Codex finish, read its report, run the app yourself for a minute. If good, run `git add -A && git commit -m "Tn" && git tag tn-ok`. If bad, run `git reset --hard t(n-1)-ok` (or `pre-astrohealth` for T0 and T1) and re-run with a tighter prompt. With Codex cloud, treat each task as its own branch/PR and merge in order. **Never start a task on a broken build.**

### Block A — AGENTS.md (paste as-is)

```
# AstroHealth — rules for every Codex task

1. Product: AstroHealth (formerly ORBIT) is a NASA Space Apps 2026 hackathon prototype: an offline-first, non-diagnostic astronaut self-monitoring demo that uses synthetic data. It is not a medical device. Read docs/ASTROHEALTH_SPEC.md before every task.
2. Inspect before editing. List the files you will read, read them, then state a 3-6 line plan before changing anything.
3. Make the smallest change that meets the acceptance criteria. Reuse existing components, styles, routes, utilities and patterns. No rewrites, no architecture changes, no renaming existing public things unless the task says so.
4. Add no new dependency unless unavoidable. If you must, explain why in the report and prefer zero-dependency solutions.
5. Preserve existing behavior. Existing pages, endpoints and tests must keep working. If something existing must change, say what and why.
6. Analysis code is pure and deterministic: no network, no reading the real clock (inject `now`), no unseeded randomness.
7. Honesty rules: never fabricate a measurement; label simulated data; never claim a diagnosis; never show 'Sent' or 'Delivered' without a real acknowledgement; use only the status vocabulary and labels in the spec.
8. Validate your work: run the existing lint/test/build commands, add tests for new logic, fix failures you introduced, never disable or delete tests to get green.
9. Do not commit and do not rewrite git history. Leave changes in the working tree.
10. Stay in scope. Report unrelated bugs; do not fix them.
11. If ambiguous, choose the simplest option consistent with the spec, record the assumption, and continue.
12. Finish every task with this report: Summary; Files changed (one-line reason each); Existing code reused; Commands run and results; Acceptance checklist (pass/fail per item); Known issues and assumptions; How to roll back (files to revert).
```

### Block B — docs/ASTROHEALTH\_SPEC.md (paste as-is)

```
ASTROHEALTH SHARED SPEC v1   (rules version: ah-rules-0.1)

A. LABELS (exact strings)
- Product name: AstroHealth. Do not show 'ORBIT' in the UI.
- Global banner (always visible): 'Synthetic demonstration data - not real astronaut data'
- Rules badge: 'Experimental heuristics (ah-rules-0.1) - not clinically validated. Not a medical device. No diagnosis.'
- Card statuses: 'No new concern detected' | 'Trend to watch' | 'Review recommended' | 'Unable to assess'
  internal enum: within_variation | trend_watch | needs_review | unable_to_assess
- Signal phrases: 'Within recent personal variation', 'Needs review', 'Trend Watch'. Trend Watch is informational and never raises clinical urgency.
- Provenance: 'simulated' | 'manual' (badge on every record). Mixed provenance in one view must be visibly flagged.
- Handoff/outbox states: prepared | queued_locally | acknowledged. Only 'acknowledged' (a real backend response) may be shown, as 'Acknowledged by simulated ground station'. Never use 'Sent' or 'Delivered' otherwise.
- Banned wording in UI/reports: diagnose/diagnosis (except in disclaimers), 'you are sick/ill', 'healthy', 'dangerous', 'readiness score', 'risk score', and 'normal' when data is incomplete. Prefer 'unusual for you', 'within your recent variation'.
- Every explanation ends with: 'Informational - not a diagnosis.'

B. METRICS REGISTRY (id | unit | plausible range | adverse direction | spread floor | cautious reference spread | required)
- resting_hr | bpm | 30-200 | up | 1.5 | 4.0 | yes
- sleep_hours | h | 0-16 | down | 0.25 | 0.6 | yes
- fatigue | 1-5 scale (5 = most fatigued) | 1-5 | up | 0.5 | 0.8 | no
- mood | 1-5 scale (5 = best) | 1-5 | down | 0.5 | 0.8 | no
- stress | 1-5 scale (5 = most stressed) | 1-5 | up | 0.5 | 0.8 | no
- body_temp_c | degC | 34-41 | up | 0.15 | 0.3 | no (optional). Values above 45 get flag 'unit_suspect' (possibly Fahrenheit).

C. RULES ah-rules-0.1 (EXPERIMENTAL HEURISTICS, tunable in one config object)
- One value per metric per local day; last entry wins; extra same-day entries flagged 'duplicate'.
- Trend window = last 7 days ending on the 'now' day. Baseline window = days now-21 .. now-8. If that window has fewer than 3 days of data, use up to 14 days before today (excluding today) instead.
- Center = median. Spread = 1.4826 x MAD, floored per metric. When maturity is 'limited', spread = max(spread, reference spread) and the explanation says 'borrowed reference spread (unvalidated heuristic)'.
- Baseline maturity by eligible baseline days: <3 'not_enough_data', 3-6 'limited', >=7 'established'. Completeness = days with data / days in window, shown as a percent.
- Point signal: z = (value - center) / spread. abs(z) >= 2.5 -> needs_review (say 'higher'/'lower than your recent pattern'). Requires maturity >= limited, otherwise unable_to_assess.
- Trend signal: adverseZ per day in the trend window (sign flipped for 'down' metrics); need >= 5 of the last 7 days; S_t = max(0, S_(t-1) + adverseZ_t - 0.5); fires trend_watch when S >= 4. Report the first day crossed and the current S. Requires maturity >= limited.
- Stale: latest observation of a metric older than 48 h relative to now -> quality 'stale' -> that metric is unable_to_assess.
- Implausible (outside range) or unit_suspect: excluded from analysis, flagged, never silently corrected.
- Per-metric status priority: quality problem -> unable_to_assess; else needs_review; else trend_watch; else within_variation.
- Overall status: any needs_review -> 'Review recommended'; else any trend_watch -> 'Trend to watch'; else if a required metric (resting_hr, sleep_hours) is unable_to_assess -> 'Unable to assess'; else 'No new concern detected'. Always list data-quality notices separately and first.
- Every Interpretation includes ruleVersion 'ah-rules-0.1' and sourceObservationIds.

D. DATA CONTRACT (logical field lists; adapt types to the repo)
- AstronautProfile: id, displayName (pseudonym), missionContextId, sharingPrefs {shareJournal:false, shareFamily:false, reportSections[]}, scenarioId.
- Observation: id, astronautId, metric, value, unit, timestamp (ISO), localDay, method (manual|simulated), provenance, qualityFlags[].
- PrivateEntry (separate partition): id, astronautId, timestamp, text, tags[].
- Interpretation: astronautId, metric, status, currentValue, unit, center, spread, windowDays, maturity, completenessPct, z, trendStat, trendFiredOn, qualityFlags[], explanation, ruleVersion, sourceObservationIds[].
- Task: id, title, scheduledTime, kind (measurement|checkin|exercise|rest|private_time|procedure_review), source ('catalogue').
- ActionEvent: id, astronautId, taskId or suggestionId, relatedMetric, state (suggested|completed|deferred|skipped|dismissed), timestamp.
- Report: id, astronautId, periodStart, periodEnd, generatedAt (injected), ruleVersion, sections, sharingChoices, state, provenanceSummary, uncertaintyNotes[].
- OutboxItem: id, kind (report|family_message), refId, state, createdAt, ackId, ackAt.
- MissionContext: id, name, oneWayDelaySecIllustrative, commsPattern, hazardNotes[], cadenceHint.
- KnowledgePassage: id, title, text, kind (nasa_paraphrase|synthetic_procedure), sourceLabel, sourceUrl, verifiedByHuman (boolean).

E. ENGINE API (logical names; pure functions, no I/O)
- validateObservation(input) -> {ok, flags[], message}
- computeBaseline(observations, metric, now) -> {center, spread, maturity, completenessPct, windowDays, usedReferenceSpread}
- assess({profile, observations, now}) -> {perMetric: Interpretation[], overall, dataQualityNotices[], provenanceSummary, ruleVersion}

F. CLOCK
The app uses a virtual 'now' (default = scenario nowISO) with a demo control 'Advance 1 day'. The engine never reads the real clock.

G. ASTRONAUTS AND SCENARIOS (30 days of history unless stated)
- AST-01 'stable': resting_hr center ~58, spread ~2.5; sleep ~7.4 +/- 0.3
- AST-02 'variable': resting_hr center ~64, spread ~6.5
- AST-03 'silent drift': sleep center ~7.2, spread ~0.3; last 7 days: 7.2, 7.1, 7.0, 6.9, 6.8, 6.7, 6.5; other metrics stable
- AST-04 'new arrival': only 4 days of history
- S1 same-change-different-person: AST-01 today HR = 72, AST-02 today HR = 78 (both +14 over their own center). Expected: AST-01 needs_review; AST-02 within_variation.
- S2 silent-drift: AST-03. Expected: trend_watch on sleep_hours on the final day; no needs_review on any metric.
- S3 earth-unavailable: AST-01, Earth link = blackout, offline check-in, handoff prepared and queued locally.
- S4 sparse-baseline: AST-04. Expected: limited or not_enough_data, never 'No new concern detected' for missing required metrics.
- S5 bad-data: implausible HR, duplicate, missing sleep, stale last entry, Fahrenheit-looking temperature.
- S6 isolation-week: AST-02 mood falls, stress rises, sleep shortens over 10 days (wellbeing support surfaces).
- S7 blackout-and-reconnect: 3 queued items, then reconnect, then acknowledgement.
Storyline-critical series are hand-authored arrays; filler values use a seeded PRNG (seed per astronaut). Reloading a scenario always yields identical data.

H. MISSION CONTEXTS (illustrative values only)
mars_transit (default; one-way delay illustrative 3-22 min), leo_station (continuous, negligible delay), lunar_surface (about 1.3 s, intermittent). Context changes education, hazard text, delay and cadence hints. It NEVER changes health thresholds.

I. PERSISTENCE
Key prefix 'astrohealth:v1:'. Observations, actions, reports and outbox are partitioned per astronaut. Private entries live in a separate key space and are never read by report or analysis code unless the user explicitly includes them.

J. DECISION GATES
D1 engine location (default: frontend pure module); D2 persistence (reuse existing client store, else versioned local storage); D3 charts (reuse existing library, else inline SVG); D4 ground-station storage (existing DB if trivial, else in-memory + JSON file); D5 test runner (existing, else the toolchain default).
```

## 6.1 Phase 0 — Inspection and safety net

### T0 — Repository inspection (read-only)

**Objective:** know exactly what exists. **Depends on:** Setup. **E · P0 · critical path.** **Done when:** you trust the report; use its answers to gates D1–D5.

```
TASK T0 — Repository inspection. READ-ONLY: do not create, edit or delete any file.
Read AGENTS.md and docs/ASTROHEALTH_SPEC.md. Then inspect the whole repository and print a report with these sections:
1. Stack: frontend framework and version, language (JS/TS), build tool, router, state management, UI/CSS library, chart library, test runner(s), linter/formatter, package manager, and the exact commands to install, run dev, test, lint and build.
2. Backend: language/framework, entry point, every route (method, path, purpose), data storage and models, auth, env vars, and how the frontend calls it (base URL, proxy, API client).
3. Frontend map: routes/pages, main components, existing dashboard widgets, data-fetching approach, where types/models live, any service worker, manifest or PWA setup.
4. A table mapping these features to existing files, each marked reusable as-is / extend / absent: check-in form, validation, baseline, point signal, trend detection, status dashboard, follow-up checklist, handoff report, offline storage, scenarios/sample data, evidence page, mission context, link/outbox, schedule suggestions, procedure search, wellbeing/journal, family messaging, comparison charts, demo mode.
5. Existing health data models, seeds or sample data, and every place the string 'ORBIT' or 'Orbit' appears (file, line, user-visible or internal).
6. Run install, test, lint and build now and paste the results. List pre-existing failures.
7. Recommended answers to decision gates D1-D5 in the spec, each with a one-line reason based on what you found.
8. Proposed locations (following existing conventions) for: engine module, catalogues and fixtures, store layer, new pages, backend ground-station routes, tests.
Write 'not found' explicitly for anything missing. Do not guess.
```

### T1 — Safety net, command notes, AstroHealth naming

**Objective:** a green baseline and consistent naming. **Depends on:** T0. **E · P0 · critical path.**

```
TASK T1 — Safety net and naming.
Inspect first: your T0 findings, the app title, manifest, package metadata, header/logo, page titles, README, and every user-visible 'ORBIT'/'Orbit' string.
Implement:
1. Create docs/COMMANDS.md listing the exact commands to install, run, test, lint and build, plus any pre-existing failures (do not fix unrelated failures).
2. Create one constants module (where the repo keeps shared constants) exporting: product name 'AstroHealth', the synthetic-data banner, the rules badge, the disclaimer sentence, the rules version 'ah-rules-0.1', and the status vocabulary and handoff-state labels exactly as in spec section A.
3. Replace user-visible 'ORBIT' with 'AstroHealth' (page title, header, manifest name/short_name, README heading). Do NOT rename internal identifiers, package names, folders, routes or env vars; list them in the report.
4. If no tests exist, add one smoke test that checks the constants and that the app root renders without crashing.
Preserve: all existing pages, routes and API calls.
Test: install, existing tests, lint, build, start the app and confirm the home page renders.
Acceptance: no user-visible 'ORBIT'; build and tests pass; COMMANDS.md is accurate; constants exported with the exact spec strings.
```

## 6.2 Phase 1 — Data, scenarios and the deterministic engine

### T3 — Types, metrics registry, store API

**Objective:** the shared data layer. **Depends on:** T1. **M · P0 · critical path.** **Freeze after this task:** field names, so UI and engine work can run in parallel.

```
TASK T3 — Data types, metrics registry and store API.
Inspect first: how the frontend currently stores and shares state (context, store, hooks), existing model/type files, and the persistence approach you recommended for D2.
Implement (in the locations you proposed in T0):
1. Types (or JSDoc typedefs if the repo is JS) for every record in spec section D.
2. A metrics registry as plain data from spec section B, and one rules config object from spec section C (rule version included).
3. A store module with synchronous reads from an in-memory cache and persistence under the key prefix in spec section I. API: getObservations/addObservation (per astronaut), replaceScenarioData, getPrivateEntries/addPrivateEntry (separate key space), getActionEvents/addActionEvent, getReports/saveReport, getOutbox/enqueue/updateOutbox, getSession/setSession (selected astronaut, scenario, virtual now), resetAll. Add a React hook, or reuse the repo's state pattern, so components re-render on change.
4. Unit tests: round-trip persistence, per-astronaut isolation, private entries never returned by observation reads, resetAll.
Preserve: existing state and API client code; add alongside, do not replace.
Acceptance: tests and build pass; no existing page changed behavior; no new dependency.
```

### T4 — Synthetic fixtures and scenario loader

**Objective:** reproducible data for every demo. **Depends on:** T3. **M · P0 · critical path.**

```
TASK T4 — Synthetic fixtures and scenario loader.
Inspect first: the store API from T3 and any existing sample data (reuse its shape where possible).
Implement per spec section G:
1. Profiles AST-01..AST-04 and scenarios S1..S7 as bundled static modules (not fetched at runtime). Each scenario has: id, title, description, nowISO, astronaut ids, default link state, presenterNotes {whatToClick, expectedOutcome}, and an optional scriptedNextDays list (simulated observations released one day at a time by 'Advance 1 day'). S2 uses it: AST-03 loads with the first 5 days of the sleep decline visible, and the last 2 days (6.7 h, 6.5 h) are scriptedNextDays, so Trend Watch appears live on day 7.
2. Observations for 30 days (AST-04: 4 days). Storyline-critical series (AST-01/02 baselines and the +14 bpm day, AST-03 sleep drift, S5 bad data) are hand-authored arrays. Filler values use a tiny seeded PRNG you write yourself (no dependency), seeded per astronaut.
3. Every fixture observation has method 'simulated', provenance 'simulated', and the dataset label 'Synthetic demonstration data'.
4. loadScenario(id) resets the store to exactly that scenario's data and virtual now. Loading twice must give deep-equal state.
If, after T7, a computed baseline does not match the spec targets, adjust the fixture values, not the rules.
Test: determinism (load twice, deep equal), provenance all simulated, counts per astronaut, AST-04 has exactly 4 days, S5 contains each bad-data type.
Acceptance: tests and build pass; loadScenario('S1') then reading observations works.
```

### T5 — Validation and data-quality flags

**Objective:** engine piece for F2. **Depends on:** T3. **E · P0 · critical path.** *Can run in parallel with T4.*

```
TASK T5 — Validation and data-quality flags (pure functions).
Inspect first: the metrics registry and rules config from T3.
Implement validateObservation and a function that derives quality flags for a set of observations: missing, duplicate (same metric, same local day), stale (>48 h before now), implausible (outside range), unit_suspect (temperature > 45), scale_error (1-5 metrics outside 1-5 or non-integer). Return human-readable messages that include the metric's unit. Never coerce or fix a value silently. Pure code, no I/O, 'now' injected.
Test: table-driven tests for every flag and boundary (HR 29/30/200/201, sleep 0/16/16.1, temp 45/45.1), plus a valid case.
Acceptance: tests pass; no UI changes; no new dependency.
```

### T6 — Personal baseline and confidence

**Objective:** F3. **Depends on:** T5. **M · P0 · critical path.**

```
TASK T6 — Personal baseline, maturity and completeness (pure).
Inspect first: spec section C and the T5 output shape.
Implement computeBaseline exactly as spec section C: one value per local day (last wins), baseline window now-21..now-8 with the documented fallback, median, 1.4826 x MAD with the per-metric floor, maturity levels (<3, 3-6, >=7), completeness percent, borrowed reference spread when maturity is 'limited' (set usedReferenceSpread). Exclude observations flagged implausible, unit_suspect or duplicate-loser.
Test: golden cases with hand-computed values (a constant series hits the floor; one outlier is resisted by the MAD; 2, 3, 6 and 7 baseline days map to the right maturity; window edges behave as specified). Add a fixture check that AST-01 and AST-02 resting_hr center and spread are within +/-1 and +/-0.5 of spec section G.
Acceptance: tests pass; the function is pure; repeated calls give identical results.
```

### T7 — Point deviation, Trend Watch, status and explanations

**Objective:** F4 + F5 + F6 logic. **Depends on:** T6. **H · P0 · critical path (highest technical risk).**

```
TASK T7 — assess(): point signal, Trend Watch, status mapping, explanation strings.
Inspect first: the T5 and T6 modules and spec sections C and E.
Implement assess({profile, observations, now}) returning perMetric Interpretations, overall status, dataQualityNotices, provenanceSummary (flag 'mixed_provenance' when both simulated and manual observations are present) and ruleVersion. Follow spec section C exactly: point signal at abs(z) >= 2.5, trend statistic (k=0.5, limit 4, need >=5 of the last 7 days), stale handling, status priority and overall mapping. Each explanation must include: current value and unit, personal reference (center and spread), window, baseline maturity and completeness, data quality, a calm plain-English reason, and end with 'Informational - not a diagnosis.' Obey the banned-wording list. Keep every threshold in the rules config only.
Test: unit tests for each branch (within variation, needs_review high and low, trend_watch fires and does not fire with 4/7 days, stale, not_enough_data, overall mapping, mixed provenance) and tests that explanation strings contain the required parts.
Acceptance: tests pass; pure and deterministic; no UI changes.
```

### T8 — Golden tests for the three demos and edge cases

**Objective:** lock the demo contract. **Depends on:** T4, T7. **M · P0 · critical path.** **Gate:** no UI polish until this is green.

```
TASK T8 — Golden tests for demo scenarios.
Inspect first: loadScenario from T4 and assess from T7.
Implement tests. Change no production logic; if a test fails because a fixture is off, tune the fixture values, never the rules or thresholds:
1. S1: AST-01 resting_hr = needs_review; AST-02 resting_hr = within_variation; both current values = center + 14; explanations differ and show each personal reference.
2. S2: on load AST-03 shows 5 decline days and no trend_watch; after releasing both scriptedNextDays, sleep_hours = trend_watch on the final day; no needs_review on any metric; overall = 'Trend to watch'; explanation has no banned wording.
3. S3: assess works with fetch mocked to throw, and gives the same result.
4. S4: AST-04 maturity is limited or not_enough_data; overall is never 'No new concern detected' when a required metric is missing.
5. S5: each bad-data type gives the expected flag and 'Unable to assess' for that metric, and no value is invented.
6. Determinism: assess twice, and after reloading the scenario, gives deep-equal output.
7. Privacy: private entries never appear in assess inputs or outputs.
Acceptance: all tests green; the report lists the actual center, spread, z and trend statistic for S1 and S2.
```

## 6.3 Phase 2 — Human-facing core (Tier 1)

### T9 — App shell, global banners, astronaut and scenario switchers

**Objective:** one coherent frame every later page plugs into. **Depends on:** T3, T4. **M · P0 · critical path.** *Can start in parallel with T5–T8 once T3 and T4 are merged.*

```
TASK T9 — App shell and global controls.
Inspect first: the existing layout, navigation, routes, header, theme/styles, and how the selected user or context is currently held.
Implement inside the existing layout (reuse its components and styling):
1. A persistent header showing: AstroHealth name, the synthetic-data banner (always visible), the rules badge (small, always reachable), an astronaut switcher (AST-01..04, labeled 'Demo profile switcher'), a scenario picker (S1..S7) that calls loadScenario, the virtual mission date with an 'Advance 1 day' button (it moves the virtual date by one day and releases the scenario's next scriptedNextDays observations, if any, into the store as simulated data), a 'Reset scenario' button, and a real browser online/offline indicator labeled 'Browser network'. Leave a labeled empty slot for the 'Earth link' control (added in T17).
2. Navigation entries and routes for: Today, Check-in, Trends, Follow-up, Handoff. Pages not yet built render a simple placeholder with the page title. Keep all existing routes and pages reachable.
3. Selection persists across reload. Switching astronaut clears any on-screen private content.
4. Keyboard focus order and visible focus styles for all new controls.
Test: render tests for the header, switchers and routes; manual check that reload keeps the selection and the banner never disappears.
Acceptance: existing pages still load; build passes; banner and badge visible on every page.
```

### T10 — Daily check-in page (F1)

**Objective:** a two-minute, validated check-in that triggers assessment. **Depends on:** T5, T7, T9. **M · P0 · critical path.**

```
TASK T10 — Check-in page.
Inspect first: the T3 store API, validateObservation (T5), assess (T7), and existing form components.
Implement:
1. A check-in form with: resting heart rate (bpm), sleep duration (h), fatigue (1-5), mood (1-5), stress (1-5), optional body temperature (degC, explicit unit label). Every field optional except that at least one must be filled; empty fields are saved as nothing, never as a default.
2. Live validation using validateObservation; show clear messages and a 'recheck' prompt for implausible values; block saving of invalid values.
3. If a value already exists for that metric today, show 'Replace today's value?' with confirm.
4. A 'Private note' textarea saved only to the private store (never to observations), labeled 'Private - not shared unless you choose'.
5. On save: write Observations with method 'manual', provenance 'manual', the virtual now timestamp and unit; run assess; navigate to Today and show a confirmation that lists what was saved and the resulting overall status.
6. A history list below the form (last 14 days) with a provenance badge and quality chips; missing days shown as 'No data', never filled in.
Test: unit/render tests for valid, partial, invalid, replace and private-note flows; manual: reload and offline (disable network) still saves.
Acceptance: tests and build pass; observations appear on Today and Trends; the private note is absent from every observation read.
```

### T11 — Today dashboard, status cards and explainable guidance (F6)

**Objective:** the at-a-glance, calm status screen. **Depends on:** T7, T9. **M · P0 · critical path.**

```
TASK T11 — Today dashboard and action catalogue.
Inspect first: existing dashboard widgets and cards (reuse their styling), assess output shape (T7), and the spec status vocabulary.
Implement:
1. An action catalogue as versioned static data: about 8 entries keyed by signal type and metric (needs_review high HR, trend_watch sleep, unable_to_assess, mood/stress trend, etc.). Each has id, title, text, procedureRef, and the label 'Synthetic placeholder - real guidance must come from authorized mission procedures'. Entries must only suggest re-measuring, reviewing authorized guidance, or consulting the flight surgeon/crew medical officer; no exercise intensity, medication or treatment content.
2. Today page: overall status card (spec vocabulary, icon + text + color, never color alone), a data-quality notice list shown first, and one card per metric showing current value, personal reference (center +/- spread), baseline maturity badge, completeness percent, age of last observation, provenance badge, and status.
3. Each card opens a detail drawer or page with: what changed, why (the explanation text), data quality, next check, and the catalogue entry with its procedure reference. Show the 'mixed provenance' flag when present.
4. Never display 'No new concern detected' for a metric or overall when a required metric is unable to assess.
Test: render tests for all four statuses using fixtures S1, S2, S4, S5; accessibility check that status is conveyed by text and icon.
Acceptance: S1 shows different statuses for AST-01 vs AST-02 after switching; S2 shows Trend to watch with an explanation; build passes.
```

### T12 — Trends/Why page and comparison view (F5 display, F18)

**Objective:** make the baseline and drift visible. **Depends on:** T7, T9. **M · P0.**

```
TASK T12 — Trends and comparison charts.
Inspect first: the existing chart library or components (decision D3); if none, use inline SVG with no new dependency.
Implement:
1. Trends page: a metric selector and a chart for the selected astronaut showing raw points, the personal baseline band (center +/- spread), the 7-day trend window shaded, flagged points with distinct shapes (not only color), and the day Trend Watch first fired. Axis labels with units; a legend; a 'Show data table' toggle that lists the same values.
2. A 'Why' panel under the chart repeating the interpretation explanation and baseline maturity.
3. Comparison view: AST-01 and AST-02 resting heart rate side by side on the same y-axis, each with its own band and today's value, with a one-sentence caption generated from the two interpretations. It reads only fixture data for those two astronauts and labels it 'Synthetic demonstration data'.
4. Charts must be responsive and readable at mobile width.
Test: render tests with S1 and S2; confirm the trend window shading appears for S2 and bands differ between AST-01 and AST-02.
Acceptance: Demo 1 and Demo 2 are understandable from the charts alone; build passes.
```

### T13 — Follow-up checklist (F7)

**Objective:** close the loop between signals and routine tasks. **Depends on:** T11. **M · P0 · critical path.**

```
TASK T13 — Follow-up checklist.
Inspect first: the store's ActionEvent API (T3), the action catalogue (T11), existing task/list components.
Implement:
1. A static daily task catalogue (preconfigured measurement time, check-in, a crew-approved exercise block, a rest window, a private-time block, 'review authorized procedure' as needed) as plain data labeled 'Illustrative schedule'.
2. A Today checklist (also usable as a section on the Follow-up page): each task can be marked completed, deferred or skipped; each action writes an ActionEvent with timestamp; state persists across reload.
3. When any metric is trend_watch, needs_review or unable_to_assess, add a suggested follow-up from the catalogue (for example 'Re-measure after rest' or 'Review authorized procedure') that can be accepted or dismissed. Suggestions never auto-complete and never change exercise intensity, medication or treatment.
4. A timeline on the Follow-up page listing ActionEvents next to the observation or signal they relate to.
Test: tests for state transitions, persistence after reload, suggestion creation per status.
Acceptance: completing a suggested follow-up is visible on the timeline; build passes; no content about intensity, drugs or treatment appears.
```

### T14 — Offline handoff report (F8)

**Objective:** the deterministic report and export. **Depends on:** T7, T13. **M · P0 · critical path.**

```
TASK T14 — Handoff report builder and page.
Inspect first: the Report and OutboxItem types, store API, assess output, ActionEvents, and any existing export/print utilities.
Implement:
1. A pure buildReport({profile, observations, interpretations, actionEvents, period, includeOptions, generatedAt, missionContext}) producing a deterministic structure (same input gives identical JSON; generatedAt is injected). Contents: period, per-metric summary, trend/needs-review flags with explanations, data provenance summary, baseline maturity and completeness, data gaps, completed and outstanding follow-ups, rule versions, a fixed uncertainty statement, and the synthetic-data label.
2. Handoff page: period selector (7/14/30 days), include toggles, a readable preview, 'Copy', 'Download JSON' and 'Download readable text'. Private journal and wellbeing notes are excluded by default; including them requires an explicit toggle with a warning.
3. 'Save as prepared' sets state prepared. 'Queue for later transmission' sets queued_locally and shows the exact text 'Queued locally - not sent'. The UI never says 'Sent' or 'Delivered'.
4. Everything works with the network disabled.
Test: determinism test, privacy test (private notes absent by default), state transitions, banned-wording test, offline test with fetch mocked to throw.
Acceptance: Demo 3 works through report preparation and queueing; build passes.
```

## 6.4 Phase 3 — Offline and trust (Tier 1 finish)

### T15 — Offline-first PWA and privacy partition (F9, F10)

**Objective:** the whole core works with networking disabled. **Depends on:** T10, T14. **H · P0 · critical path (service-worker risk).**

```
TASK T15 — Offline-first behavior and privacy checks.
Inspect first: any existing service worker, manifest, caching code, build config, and how API calls fail when the backend is unreachable.
Implement:
1. Make the production build installable and offline-capable using the simplest approach that fits the toolchain (reuse an existing PWA plugin if present; otherwise a small hand-written service worker). Cache the app shell and all bundled assets and fixtures. Version the cache by build so a new build replaces the old cache.
2. Provide a 'Reset app data and cache' control (confirm dialog) that clears the AstroHealth storage keys, unregisters the service worker and reloads.
3. Every existing and new page must show a friendly message, never a blank screen, when a backend call fails; core pages (Today, Check-in, Trends, Follow-up, Handoff) must not depend on any network call.
4. Document in docs/COMMANDS.md how to run the production build locally and test offline (build, serve, load once, disable network, reload).
5. Verify privacy: private entries are stored in a separate key space and never read by analysis, charts, Today or the report unless the user opts in.
Test: automated tests for storage persistence across a simulated reload and for the privacy partition; manual offline script (load, go offline, reload, add a check-in, build and queue a handoff report) written into docs/OFFLINE_TEST.md and executed, with results in the report.
Acceptance: the offline script passes end to end; build passes; no cache serves a stale build after a rebuild.
```

### T16 — Evidence & Limits page and claims audit (F11)

**Objective:** make every assumption visible. **Depends on:** T7. **E · P0.**

```
TASK T16 — Evidence & Limits page.
Inspect first: the rules config (T3), status vocabulary and any existing static/info pages.
Implement a static page generated from data modules (no network):
1. Rules table: each rule in the rules config (baseline window, spread, maturity levels, point threshold, trend parameters, stale limit) with its value, the rule version, and the status 'Team hypothesis - not clinically validated'.
2. Evidence classification: three labeled groups - 'NASA-supported context' (the five hazards; the importance of self-sufficiency when Earth communication is delayed; exercise as a countermeasure), 'Team hypothesis' (baseline, thresholds, trend heuristic, confidence labels), 'Simulated' (all astronaut readings, profiles, outages, outcomes).
3. The five-hazards table: Isolation and confinement; Distance from Earth; Altered gravity; Hostile/closed environment; Space radiation - each with the prototype's response and its boundary. Use exactly this wording of boundaries: isolation: 'Self-reports are indirect indicators; no mental-health diagnosis or proof of causal effect.' distance: 'A local queue is not proof of delivery; communications delay is a context constraint, not a health reading.' gravity: 'Routine completion cannot directly measure bone density, muscle loss or cardiovascular fitness.' environment: 'Do not infer CO2 exposure, microbial risks or air quality from unrelated vital signs.' radiation: 'Radiation exposure cannot be estimated from mood, sleep or heart rate alone.'
4. Deliberate exclusions list: diagnosis chatbot, readiness/risk score, leaderboards, bone-loss or exercise-prescription estimates, camera/ultrasound interpretation, 3D body map.
5. Sources list with links: [1] Space Apps challenge https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/ ; [2] https://www.nasa.gov/hrp/hazards/ ; [3] https://www.nasa.gov/hrp/hazard-distance-from-earth/ ; [4] https://www.nasa.gov/general/astronaut-exercise/ ; [5] https://www.nasa.gov/hrp/hazard-isolation-and-confinement/ ; [6] https://www.nasa.gov/hrp/winners-of-nasa-hrps-artemis-ii-data-methodology-challenge/ (note: small-sample individualized analysis; not validation of AstroHealth). Add the sentence: 'AstroHealth is a hackathon demonstration with fictional data. It is not NASA-endorsed, not an approved flight system, not a medical diagnosis tool, and not a substitute for flight-surgeon judgment.'
6. Add docs/CLAIMS_AUDIT.md listing every scientific or clinical statement shown in the UI, its location, and its support (NASA source / team hypothesis / simulated). Do not add claims beyond those given here.
Also add a test that scans all user-visible strings for the banned wording in spec section A.
Acceptance: page reachable from the footer/nav; test passes; build passes.
```

## 6.5 Phase 4 — Advanced features (Tier 2) and the Earth link

### T17 — Earth-link simulator and outbox (F13, frontend)

**Objective:** demonstrate delay, blackout and honest queue states. **Depends on:** T14. **M · P1.**

```
TASK T17 — Earth-link simulator and outbox.
Inspect first: the Outbox types and store API (T3), the report page (T14), and the header slot reserved in T9.
Implement:
1. A link state machine with states Connected, Delayed, Blackout, controlled from a header 'Earth link (simulated)' control; the state persists and each scenario can set its default. Show it separately from the real 'Browser network' indicator.
2. An outbox: queueing a report (T14) adds an OutboxItem. While Blackout, items stay queued_locally. When the state becomes Connected or Delayed, process the queue one item at a time through a 'ground adapter' interface (send(item) -> ack or failure). In this task the adapter is a stub that returns 'no ground endpoint', so items remain queued_locally and the UI says 'Queued locally - not sent'.
3. For Delayed mode, show a visible countdown of the simulated one-way delay, labeled 'illustrative, demo-accelerated', and the text 'In transit (simulated)'. The default delay comes from a constant now and from the mission context in T19.
4. An Outbox panel listing items, state, created time, ack id (when present). States use only prepared / queued_locally / acknowledged; 'acknowledged' may be set only by a real adapter response.
Test: state transitions, persistence across reload, no 'Sent' or 'Delivered' string anywhere, blackout keeps items queued.
Acceptance: S3 and S7 flows work up to the point of acknowledgement; build passes.
```

### T18 — Backend ground-station simulator with acknowledgement (F13, backend)

**Objective:** a real acknowledgement path. **Depends on:** T17. **M · P1.** *Can run in parallel with T19–T21.*

```
TASK T18 — Ground-station simulator endpoints and wiring.
Inspect first: the backend entry point, routing style, storage, CORS/proxy configuration, existing tests, and your decision for D4.
Implement in the backend, following its existing conventions:
1. GET /api/ground/health -> {status:'ok'}.
2. POST /api/ground/handoff accepts the report JSON from T14. Validate: JSON object, has astronautId, ruleVersion, the synthetic-data label, size under a small limit; otherwise return 400 with a message. On success store it and return {ackId, receivedAt, payloadHash} where payloadHash is a hash of the received payload. The ack is returned only after the record is stored.
3. GET /api/ground/inbox returns stored reports (summary fields only).
4. Storage: the existing database if trivial, otherwise in-memory plus a JSON file that survives restart.
Implement in the frontend:
5. Replace the stub adapter from T17 with a real adapter that calls these endpoints with a 5-second timeout; on success set acknowledged and show 'Acknowledged by simulated ground station' with the ack id; on timeout or error keep queued_locally and show a calm retry message.
6. A 'Ground Station (simulated)' page listing received reports with ack ids, labeled 'Simulated mission-control view - synthetic data'.
Test: backend tests for valid, invalid and oversized payloads; frontend test with the adapter mocked for success and failure; manual: stop the backend and confirm items stay queued_locally.
Acceptance: S7 end to end (queue three items in Blackout, switch to Connected, see three acknowledgements and the inbox); build and backend tests pass.
```

### T19 — Mission context and environment awareness (F12)

**Objective:** context-aware presentation without invented thresholds. **Depends on:** T9 (and T16 for shared hazard data). **E · P1.**

```
TASK T19 — Mission context.
Inspect first: the MissionContext type (T3), the hazards table data from the Evidence & Limits page (T16), the header, and the Earth-link simulator (T17) if present.
Implement:
1. Static mission contexts from spec section H (mars_transit default, leo_station, lunar_surface) with name, illustrative one-way delay, comms pattern, hazard notes and a cadence hint. Label delay values 'illustrative'.
2. A Mission page: current context card (mission day computed from the virtual date, labeled illustrative), context selector, the hazards table reused from T16 (import the same data; do not duplicate), and reserved input tiles 'CO2' and 'Radiation dosimeter' showing 'Not connected - reserved for future sensor input'. An optional toggle 'Show synthetic cabin environment' displays labeled values 'Synthetic context only - not used in assessment'.
3. Feed the context's delay into the Earth-link simulator and its name into the report header (T14).
4. Add a test proving that changing the mission context does not change assess() output (deep equal) for the same observations.
Preserve: all scoring rules; the context must never alter thresholds.
Acceptance: context switch changes delay, hazard text and report header only; the test passes; build passes.
```

### T20 — Adaptive schedule suggestions (F14)

**Objective:** turn signals into optional, non-prescriptive schedule suggestions. **Depends on:** T13, T19. **M · P1.**

```
TASK T20 - Adaptive schedule suggestions (deterministic).
Inspect first: the task catalogue and suggestion code from T13, the action catalogue from T11, assess output, mission context, and Earth-link state.
Implement a pure function suggestSchedule({tasks, interpretations, missionContext, linkState, now}) driven by a rule table, and an 'Adapted Today' view (a toggle on the Follow-up page) showing the base schedule with suggested items highlighted. Rules (each suggestion shows 'Why' linking to the triggering signal):
- needs_review resting_hr: suggest an additional re-measurement after rest, and verifying sensor placement.
- trend_watch sleep_hours: highlight the existing rest window task and suggest reviewing the cited sleep procedure card.
- trend_watch or needs_review on mood or stress: suggest the existing private-time task and a scheduled private conference when the link allows (synthetic catalogue item).
- trend_watch fatigue: suggest that non-critical tasks may be deferred 'if mission rules allow'.
- unable_to_assess: suggest completing the missing check-in or re-measuring.
- link Blackout or Delayed: suggest preparing a handoff report ahead of the next communication window.
Each suggestion can be accepted (writes an ActionEvent and adds the item to the day) or dismissed (writes an ActionEvent). Show 'Suggestion only - you decide. Does not change exercise intensity, medication or treatment.' Never alter or auto-complete existing tasks.
Test: table-driven tests per rule, determinism, no banned wording, and no suggestion text about intensity, drugs or treatment.
Acceptance: S2 produces the sleep suggestions; S6 produces the wellbeing suggestions; S7 shows the handoff reminder; build passes.
```

### T21 — Offline source-cited procedure search, the “AI assistant” (F15)

**Objective:** answer “what does the guidance say?” offline, with citations, and refuse medical advice. **Depends on:** T11. **M · P1.**

```
TASK T21 - Offline knowledge search (retrieval only, no generation, no dependency).
Inspect first: the action catalogue and procedureRef values from T11, and existing page/route patterns.
Implement:
1. A corpus of 10-14 KnowledgePassages as static data. Kind 'nasa_paraphrase' (use only these facts, in the team's own short wording, each with its source label and URL and verifiedByHuman=false): the five hazards of human spaceflight are space radiation, isolation and confinement, distance from Earth, altered gravity, and hostile/closed environments [https://www.nasa.gov/hrp/hazards/]; distance from Earth makes communication delay and crew self-sufficiency important [https://www.nasa.gov/hrp/hazard-distance-from-earth/]; isolation and confinement are linked to behavioral and sleep risks [https://www.nasa.gov/hrp/hazard-isolation-and-confinement/]; exercise is a countermeasure used in spaceflight [https://www.nasa.gov/general/astronaut-exercise/]; small-sample individualized analysis is valued in NASA's methodology challenge [https://www.nasa.gov/hrp/winners-of-nasa-hrps-artemis-ii-data-methodology-challenge/]. Kind 'synthetic_procedure' (clearly fictional, labeled 'Synthetic procedure card - not an authorized procedure'): SYN-HR-01 re-measuring resting heart rate after rest; SYN-SLP-01 reviewing the sleep log; SYN-MOOD-01 private time and requesting a crew or ground conference; SYN-DQ-01 handling missing or implausible data; SYN-COMM-01 preparing a handoff report when the link is unavailable; SYN-ESC-01 'contact the flight surgeon / follow authorized mission procedures'. Do not add any other medical or NASA claims.
2. A small in-code retrieval function (tokenize, lowercase, stop-words, a tiny synonym map, TF-IDF or BM25), returning the top 3 passages with scores. Deterministic.
3. An Assistant page: question box, example question chips, results as cited passages showing kind badge, source link, and the badge 'Team paraphrase - verify against source' when verifiedByHuman is false. No generated prose.
4. Safety: if the question seeks diagnosis, dosing, medication or treatment (keyword list), or no passage passes a minimum score, show a fixed message: 'This prototype cannot give medical advice. Please follow authorized mission procedures or contact the flight surgeon.' (and for low score: 'No matching vetted passage found.').
5. 'Ask about this' links from Today cards open the Assistant with a prefilled question, and procedureRef values from T11 deep-link to the matching passage.
Test: expected passages for 6 sample questions, refusal cases, no-match case, determinism, works with fetch mocked to throw.
Acceptance: works fully offline; every answer shows at least one citation; build passes.
```

### T21B — Optional online “explain simply” (F15 stretch, P2, skip if short of time)

**Depends on:** T21. **M.** Off by default; never required for any demo step.

```
TASK T21B - Optional online rewrite, flag-gated.
Inspect first: how the backend reads configuration/env vars, and whether any LLM key or client exists. If none, STOP and report; do not add keys.
Implement behind an env flag (default off): POST /api/assist/explain receives the question and the already-retrieved passages and returns a short plain-language summary that may only use those passages and must cite their ids. In the Assistant page show an 'Explain simply (online)' button only when the flag is on and the browser is online; show the output labeled 'AI-rewritten, online only - original passages below'. On any failure or when offline, show nothing extra and keep the retrieval results. Never send private entries or observations.
Test: with the flag off the UI and backend are unchanged; with a mocked backend the output renders with the label; offline hides the button.
Acceptance: flag off equals T21 behavior exactly; build passes.
```

## 6.6 Phase 5 — Wellbeing, family connection (Tier 2/3) and polish

### T22 — Mental-health and isolation support (F16)

**Objective:** private, non-diagnostic support tied to the same data. **Depends on:** T7, T15. **M · P1.**

```
TASK T22 - Wellbeing page.
Inspect first: the private store API (T3), check-in private note handling (T10), assess output, the report include options (T14), and mission context.
Implement:
1. A Wellbeing page with: a private journal (add, list, delete the selected astronaut's own entries; stored only in the private key space; label 'Private - not shared unless you choose').
2. An 'Isolation-related patterns' card shown only when at least two of these are trend_watch or needs_review at the same time: mood (lower), stress (higher), sleep_hours (lower), fatigue (higher). Wording must be calm and non-diagnostic, for example 'Several of your recent check-ins have shifted together. Self-reports are indirect indicators.' Link to the trend chart and to the relevant suggestions (T20).
3. A small static catalogue of supportive, non-clinical prompts labeled synthetic (plan a call with someone you trust; schedule private time; request a scheduled conference with ground support when the link allows). Include a fixed line: 'If you feel unsafe or in crisis, follow mission emergency procedures and contact the crew medical officer immediately.'
4. In the Handoff page (T14) add an opt-in list of individual journal entries to include; default none selected; clear warning text.
5. Switching astronaut or scenario hides the previous astronaut's entries immediately.
Test: S6 shows the card, S2 (sleep only) does not; privacy tests (entries absent from reports and from other astronauts); banned-wording test.
Acceptance: S6 flow works; nothing private leaks; build passes.
```

### T23 — Family connectivity prototype (F17)

**Objective:** asynchronous human connection with privacy and no scoring. **Depends on:** T17, T22. **M · P2.** *Build last; cut first.*

```
TASK T23 - Family connectivity prototype (text only).
Inspect first: the outbox and link simulator (T17/T18), sharing preferences in AstronautProfile, fixtures, and existing list/card components.
Implement a Family page, labeled 'Future-concept prototype - synthetic messages', with three parts:
1. Shared Moments: compose short text moments and send them as OutboxItems of kind family_message; incoming synthetic family messages from fixtures appear with timestamps and a 'received after simulated delay' note. Sending follows the same states and wording as reports ('Queued locally - not sent'; 'Acknowledged by simulated relay' only if a real backend response exists; if the backend has no relay endpoint, add minimal POST /api/ground/relay with the same validation style as T18).
2. Memory Capsule: the astronaut can save any message or moment to a local capsule list and view it later; export as JSON.
3. Connection Rhythm: shows days since the last exchange next to the planned rhythm from the mission context cadence hint, in neutral words (for example 'Last exchange 4 days ago; planned rhythm every 3 days'). No scores, streaks, rankings or guilt language.
Privacy: the Family module must never read observations, interpretations or journal entries; add a test that fails if the module imports health data selectors. No health information is ever included in family messages.
Test: delayed queue behavior, capsule persistence, rhythm text for 3 cases, privacy import test.
Acceptance: a message queued in Blackout is acknowledged after reconnect; build passes.
```

### T24 — Responsive, accessibility and visual polish

**Objective:** modern, coherent, readable under workload. **Depends on:** T11–T23. **M · P1.**

```
TASK T24 - Polish pass (no logic changes).
Inspect first: the existing theme/design tokens and every page added in T9-T23.
Improve using the existing styling system and no new dependency:
1. One consistent set of components for cards, status chips, badges, buttons, drawers, empty/loading/error states across all pages.
2. Responsive layouts at 375, 768 and 1280 px widths with no horizontal scrolling and no clipped text; touch-friendly tap targets.
3. Accessibility: visible focus, full keyboard operation of forms, drawers and tabs, text labels and icons in addition to color for every status, sufficient contrast, aria labels on charts with the data-table alternative, respect prefers-reduced-motion.
4. Calm, modern visual language suited to a space-mission tool: clear hierarchy, generous spacing, one accent color, a restrained dark theme if the app already supports themes.
5. Make the banner and badges unobtrusive but permanent.
Test: existing tests pass; add a few render/a11y smoke tests if a tool already exists; screenshot checks at the three widths if Playwright or similar is already installed.
Acceptance: no regressions; all pages usable at all three widths; build passes.
```

### T25 — Demo mode and presenter guide (F19)

**Objective:** one click to each storyline, always resettable. **Depends on:** T8, T24. **M · P1 · critical path.**

```
TASK T25 - Demo mode.
Inspect first: scenario presenterNotes (T4), header controls (T9), Earth-link and outbox state (T17/T18), and routes.
Implement:
1. A /demo route and a 'Demo guide' toggle that opens a side panel listing ordered steps: Demo 1 Same reading different person (S1), Demo 2 Silent drift (S2), Demo 3 Earth unavailable (S3), then S7 blackout and reconnect, S6 isolation week, Assistant, Mission context, Family. Each step has a 'Go' button that loads the scenario, selects the astronaut, sets the link state and navigates to the right page, plus the scenario's whatToClick and expectedOutcome text.
2. A 'Reset everything' control that reloads the current scenario, clears the outbox, wellbeing and capsule state for the demo, and (if the backend exists) calls a demo-only reset endpoint that clears the ground inbox (add it behind an env flag).
3. A presenter mode that enlarges key text, hides developer-only controls, and keeps the banner visible.
4. Keyboard shortcuts for next/previous step.
Test: for each step, assert the resulting astronaut, scenario, route and (for S1/S2) the expected statuses.
Acceptance: each step reaches its expected state from a clean start in one click; reset returns to a clean state; build passes.
```

## 6.7 Phase 6 — Verification and demo-day freeze

### T26 — Full-project quality and integration audit

**Objective:** find and fix broken functionality across features. **Depends on:** all. **H · P0 · critical path.** Run this twice: once at feature freeze, once after the last fix.

```
TASK T26 - Full-project audit and fix loop. Do not add features.
Inspect first: docs/COMMANDS.md, docs/ASTROHEALTH_SPEC.md, docs/CLAIMS_AUDIT.md, docs/OFFLINE_TEST.md, all tests, all routes.
Perform and document in docs/QA_REPORT.md:
1. Run install, lint, all frontend tests, all backend tests, and the production build. Fix failures you can fix with minimal changes.
2. Script or manually execute every scenario S1-S7 and the three core demos from a clean reset, recording pass/fail against each scenario's expectedOutcome.
3. Verify these integration rules: one observation store feeds Today, Trends, Follow-up and Handoff with identical numbers; mission context never changes assess() output; private entries never appear in observations, reports, family module or other astronauts; no UI text contains 'Sent' or 'Delivered' outside acknowledged state; banned wording scan passes; every record shows provenance; mixed provenance is flagged; rule version appears on cards and reports.
4. Offline test: production build, load once, disable network, reload, run Demo 3, add a check-in, prepare and queue a report, reconnect, confirm acknowledgement only when the backend is reachable.
5. Failure tests: backend stopped, corrupted local storage, empty store, rapid scenario switching, page reload in each route, invalid inputs.
6. Responsive check at 375, 768, 1280 px; keyboard-only pass of check-in and handoff; console must be free of errors and warnings you introduced.
7. Fix each defect with the smallest change, re-run the relevant tests, and list every fix.
Output: QA matrix (feature x checks), fixes made, remaining issues ranked by demo risk, and an explicit go/no-go for each of the three core demos.
```

### T27 — Demo-day freeze and fallback build

**Objective:** a one-command, offline-safe demo. **Depends on:** T26. **E · P0 · critical path.**

```
TASK T27 - Demo-day freeze.
Inspect first: package scripts, backend start command, environment variables, and docs/COMMANDS.md.
Implement:
1. A single documented command (script) that builds and serves the production frontend and starts the backend together, plus an .env.example with only the variables needed.
2. docs/DEMO_RUNBOOK.md: startup, URLs and ports, how to reset, the order of the demo (from /demo), what to do if the backend does not start (core demos still work; handoff stays 'Queued locally'), what to do if the service worker serves stale content (Reset app data and cache), and a 60-second pre-demo checklist.
3. Ensure the app boots to a clean default scenario (S1, AST-01) after reset, with no console errors.
4. Create a static backup of the production build folder and document how to serve it with any static server.
Test: cold start from a clean clone using only the runbook; offline run of Demos 1-3.
Acceptance: the runbook works exactly as written; build and tests pass.
```

---

# 7. Parallel Development and Team Coordination Strategy

## 7.1 Tracks

| Track | Tasks | Can start when | Merge rule |
| --- | --- | --- | --- |
| **A – Engine** | T5 → T6 → T7 → T8 | T3 merged | Merge T7 before any UI relies on real output |
| **B – Data** | T4 (then fixture tuning) | T3 merged | Fixtures change only via T4 or T8 tuning |
| **C – UI core** | T9 → T10, T11, T12, T13 → T14 | T3 + T4 merged (build against types and mock `assess` output until T7 lands) | One owner for header, router and shared styles |
| **D – Offline/Backend** | T15, then T17 → T18 | T14 merged (report JSON shape frozen) | Backend work touches no frontend files except the adapter |
| **E – Advanced** | T19, T20, T21, T22, T23 | Their dependencies in Section 5 | Independent pages; merge in any order |
| **F – Human work (no Codex)** | demo script, slides, corpus verification against NASA pages, claims-audit review, recording a backup video, Q&A rehearsal | Day one | Review T16/T21 text before final freeze |

## 7.2 Safe parallel pairs and forced sequences

- **Parallel:** T4 ‖ T5 · T6/T7 ‖ T9 · T12 ‖ T13 · T15 ‖ T16 · T17 ‖ T19 · T18 ‖ T20 ‖ T21 · T21 ‖ T22.
- **Sequential:** T3 before everything · T7 before T8 and before all real-data UI verification · T14 → T17 → T18 → T23 · T13 → T20 · T24 only after features freeze · T26 → T27.

## 7.3 Coordination rules (prevent Codex collisions)

1. **Two contracts are frozen early:** data shapes after T3, and the `assess()` output shape after T7. Changes require a team message and a rerun of T8.
2. **One task = one branch/PR.** Never run two Codex tasks that touch the same shared file (header, routes, store, rules config) at once.
3. **One integrator** merges in dependency order, runs `COMMANDS.md` checks after each merge, and tags `tn-ok`.
4. **Hotspots to guard:** router/navigation, header controls, store module, global styles, rules config. Ask Codex to add, never reorganize.
5. **Solo or two-person team:** follow the critical path first (T0→T16), then T17, T19, T21, T22, T20, T25, T24, T26, T27; skip T23 and T21B unless ahead.

---

# 8. Simulated Data and Demo Scenario Design

Everything here is **synthetic** and says so on screen. Thresholds and rules are **unvalidated heuristics**.

## 8.1 Astronaut profiles

| ID | Purpose | Resting HR | Sleep | Notes |
| --- | --- | --- | --- | --- |
| AST-01 | Stable baseline | median \~58 bpm, spread \~2.5 | \~7.4 h ± 0.3 | Used for Demos 1 and 3 |
| AST-02 | Naturally variable | median \~64 bpm, spread \~6.5 | \~7.0 h ± 0.5 | Demo 1 contrast; S6 isolation week |
| AST-03 | Silent drift | stable | \~7.2 h ± 0.3, then declining | Demo 2 |
| AST-04 | New arrival | 4 days of data only | 4 days | Baseline maturity and “unable to assess” |

## 8.2 Scenario catalogue

| ID | Story | Trigger | Expected result | Features shown |
| --- | --- | --- | --- | --- |
| S1 | Same +14 bpm, different person | Switch AST-01 ↔ AST-02 | AST-01 “Review recommended”; AST-02 “No new concern detected” with both bands shown | F3, F4, F6, F18 |
| S2 | Silent drift | Click “Advance 1 day” twice | Sleep reaches “Trend to watch” on day 7; no point flag; suggestions appear | F5, F6, F7, F14 |
| S3 | Earth unavailable | Set link to Blackout; check in; build report | Everything works; “Queued locally – not sent” | F1, F8, F9, F13 |
| S4 | New arrival | Select AST-04 | Limited baseline, “Unable to assess” where data are missing | F2, F3 |
| S5 | Bad data | Open S5 | Each problem flagged; nothing invented | F2 |
| S6 | Isolation week | AST-02, open Wellbeing | Several shifting indicators; supportive prompts; private journal stays private | F16, F14 |
| S7 | Blackout then reconnect | Queue 3 items, switch to Connected | Three acknowledgements from the simulated ground station | F13, F8, F17 |

## 8.3 How gradual change and delay are simulated

- **Gradual change:** key series are hand-authored; S2 uses `scriptedNextDays` so each “Advance 1 day” releases one new simulated observation and the audience watches Trend Watch form live.
- **Delay and blackout:** the Earth-link control is simulated; the delay countdown is **demo-accelerated** (for example, an illustrative 12-minute one-way delay shown as an 8-second countdown) and labeled so.
- **Acknowledgement:** only a real response from the backend ground simulator can set “Acknowledged by simulated ground station.”

## 8.4 Assistant demo content

| Question | Expected result |
| --- | --- |
| “What are the five hazards of spaceflight?” | Hazards passage, NASA source link, “Team paraphrase – verify” badge |
| “Why does distance from Earth matter?” | Distance-from-Earth passage |
| “My resting heart rate looks high. What now?” | SYN-HR-01 re-measure card (synthetic) |
| “I am sleeping badly lately.” | SYN-SLP-01 card |
| “Do I have a heart problem?” | Fixed refusal: no medical advice |
| “What dose of a drug should I take?” | Fixed refusal |

## 8.5 Other fixtures

- Two synthetic family messages per astronaut for S7 and the Family page; two synthetic private journal entries for AST-02 in S6.
- Every fixture file, report and export carries “Synthetic demonstration data.”

## 8.6 What is real, simulated and future

| Real functionality | Simulated | Future production capability |
| --- | --- | --- |
| Validation, baseline, point and trend logic, status mapping, check-in, storage, checklist, report builder, offline operation, outbox, backend acknowledgement round-trip, retrieval search | All readings and profiles, mission context values, link delay, ground station, family messages, procedure cards | Validated wearables, calibrated models, real environmental and radiation sensors, authorized procedure library, clinical workflow integration, real relay to ground |

---

# 9. Testing, Debugging, and Integration Checklist

Run this checklist after T14 (core), after T21 (advanced) and again at T26. The **final Codex prompt for the whole project is T26**; use it as the last automated gate.

### Frontend functionality

- [ ] Every route loads, reloads and deep-links without errors.
- [ ] Check-in accepts valid, partial and invalid input as specified; nothing is auto-filled.
- [ ] Today, Trends, Follow-up and Handoff show identical numbers for the same observation.
- [ ] Banner, rules badge and provenance badges visible on every page.

### Backend endpoints

- [ ] `/api/ground/health`, `/handoff` (valid, invalid, oversized), `/inbox`, optional `/relay` and reset behave as specified.
- [ ] Existing endpoints still pass their original tests.

### Database / storage

- [ ] Per-astronaut partitions; private store separate; reset clears everything intended and nothing else.
- [ ] Corrupted or empty storage recovers to a clean state without crashing.

### API integration and offline

- [ ] Backend stopped: core pages work; outbox stays “Queued locally – not sent.”
- [ ] Production build offline: reload works; Demo 3 completes.
- [ ] “Acknowledged” appears only after a real backend response.

### Feature interactions

- [ ] Mission-context switch changes delay, hazards text and report header only (assess output identical).
- [ ] Suggestions accepted in Follow-up appear in the timeline and in the next report.
- [ ] Journal entries never reach reports unless explicitly selected; family module reads no health data.

### Simulated scenarios

- [ ] S1–S7 each reach their expected outcome after “Reset everything.”
- [ ] Reloading any scenario twice gives identical screens.

### Error handling and recovery

- [ ] Invalid inputs, empty states, timeouts and rapid scenario switching show calm messages, never blank screens.
- [ ] “Reset app data and cache” recovers from a stale service worker.

### Responsiveness and accessibility

- [ ] 375 / 768 / 1280 px: no horizontal scroll, no clipped text.
- [ ] Keyboard-only check-in and handoff; status never conveyed by color alone.

### Honesty and safety

- [ ] Banned-wording test passes; no diagnosis language; no “Sent” or “Delivered” outside the acknowledged state.
- [ ] Evidence & Limits page matches what the UI actually does; claims audit reviewed by a human.

### Rollback and debugging playbook

- A task broke something → `git reset --hard t(n-1)-ok`, re-run the prompt with the failure output pasted under “Fix only this.”
- Codex changed unrelated files → revert those files, re-run with “Only modify files listed in your plan.”
- Same failure twice → split the task in two prompts; do the pure-logic half first.
- Test fails because a number moved → change the fixture, never the rule, then update the golden values deliberately.

---

# 10. Final NASA Space Apps Demonstration Walkthrough

**Total about 7 minutes.** Start every run from `/demo` after “Reset everything.” Keep the Mission page and Evidence & Limits page open in other tabs for questions.

| Time | What you do | What judges see | What you say (key point) |
| --- | --- | --- | --- |
| 0:00 | Open the app on AST-01, Today | Calm dashboard, “Synthetic demonstration data” banner, four status cards | “Long missions mean Earth may be unreachable. AstroHealth interprets each astronaut against their own pattern and works offline.” |
| 0:45 | **Demo 1:** switch to AST-02, then open Comparison | Same +14 bpm: AST-01 “Review recommended,” AST-02 “No new concern detected,” both bands visible | “Identical reading, different meaning. A fixed cutoff would treat them the same.” |
| 1:45 | **Demo 2:** load AST-03, click Advance 1 day twice | Sleep chart drifts; on day 7 “Trend to watch” with a “Why” panel; no single-day alarm | “No single day looked alarming. The cumulative trend caught a slow change. It is informational, not a diagnosis.” |
| 2:45 | Open Follow-up, accept the suggested re-measure and rest-window highlight | Adapted schedule, timeline entry | “Suggestions connect to existing routines. We never change exercise intensity or medication.” |
| 3:15 | **Demo 3:** set Earth link to Blackout, make a check-in, open Handoff, prepare and queue | Report with provenance, uncertainty, outstanding follow-ups; “Queued locally – not sent” | “The offline limit is a design feature. We never claim Earth received it.” |
| 4:15 | Disable browser network (or note it is already offline), reload, show data persists; switch link to Connected | Countdown, then “Acknowledged by simulated ground station”; Ground Station page shows the report | “Delivery status comes from a real acknowledgement.” |
| 5:00 | Assistant: ask “My resting heart rate looks high. What now?” then “Do I have a heart problem?” | Cited synthetic procedure card; then a firm refusal | “Offline, citation-based, no invented medical advice.” |
| 5:30 | Mission page, then Wellbeing (S6) and Family (S7) briefly | Context changes delay and hazards only; private journal; neutral Connection Rhythm | “Mission context never changes thresholds. Mental health stays private; family never sees health data.” |
| 6:15 | Evidence & Limits page | Rules table, hazards, sources, exclusions | “Every rule is labeled a team hypothesis. We deliberately excluded diagnosis, scores and leaderboards.” |
| 6:45 | Close | – | “Monitor, interpret, explain, follow up, hand off. Observation and communication support, not diagnosis.” |

## Key technical and scientific points to communicate

- **Innovation:** personal robust baseline + separate cumulative drift signal + data-quality-first status + offline handoff with honest delivery states.
- **Scientific alignment:** NASA’s five hazards, the importance of self-sufficiency when Earth communication is delayed, exercise as a countermeasure and the value of small-sample individualized analysis \[1–6\]. Say clearly that this alignment is *context*, not validation.
- **Honesty:** synthetic data, experimental heuristics, no diagnosis, no “sent” without acknowledgement.

## Fallback strategy

| Failure | Fallback |
| --- | --- |
| No internet at the venue | Nothing needed: the core loop is offline by design; only the optional T21B depends on internet |
| Backend will not start | Demos 1–2 unaffected; Demo 3 stops at “Queued locally” (still the honest story); show the Ground Station page from a prior recording |
| Stale service worker or odd state | “Reset app data and cache”, then “Reset everything” |
| Laptop failure | Run the static backup build from the runbook on a second machine; keep a screen-recorded backup video |
| Questions about validity | Open Evidence & Limits and read the scientific boundary |

---

# 11. Prioritized Execution Timeline and Critical Path

Hours assume a 36–48 hour hackathon and about 20–45 minutes per Codex task including your review. Scale proportionally; if you have only about 24 hours, see “Short schedule” below.

**Critical path:** Setup → T0 → T1 → T3 → T4/T5 → T6 → T7 → T8 → T9 → T10 → T11 → T13 → T14 → T15 → (T17 → T18) → T25 → T26 → T27.

| Phase | Hours | Tasks | Parallel | Biggest risk | Test before moving on | Minimum acceptable | Simplify first |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 Setup and inspection | 0–1.5 | Setup, T0, T1 | – | Misreading the repo | Build and tests green; D1–D5 decided | Baseline green, naming done | Skip nothing |
| 1 Data and engine | 1.5–6 | T3, T4, T5, T6, T7, T8 | T4 ‖ T5 | T7 numeric behavior | T8 golden tests green | Demos 1 and 2 reproduce in tests | Drop the optional temperature metric |
| 2 Core UI | 6–13 | T9, T10, T11, T12, T13, T14 | T12 ‖ T13 | Shared header/router conflicts | Click through Demos 1–3 manually | Check-in, Today, Follow-up, Handoff work | Trends page: keep chart, drop data-table toggle |
| 3 Offline and trust | 13–16 | T15, T16 | T15 ‖ T16 | Service-worker staleness | OFFLINE\_TEST script passes | Demo 3 works with network off | Install prompt/manifest polish |
| **Gate A: MVP freeze** | 16 | – | – | – | Run T26 once | All of Tier 1 passes | – |
| 4 Advanced | 16–25 | T17, T18, T19, T20, T21, T22 | T18 ‖ T19 ‖ T20 ‖ T21 ‖ T22 | Backend integration with unknown stack; corpus accuracy | S3, S6, S7 pass; assistant answers 6 sample questions | Link simulator + queued state; assistant search | Adaptive rules to 3 rules; keyword-only search |
| 5 Family, polish, demo mode | 25–31 | T23, T24, T25 | T23 ‖ T24 | Polish causing regressions | Re-run T8 tests; all steps in /demo work | Demo mode with 3 core demos | Cut T23 first; polish only Today, Trends, Handoff |
| 6 Verification and freeze | 31–36 | T26, T27, rehearsal, backup video | – | Late bugs | Runbook cold start; offline run | Go decision for Demos 1–3 | Fix only demo-blocking defects |

## Cut order if time runs short (earliest cut first)

1. T21B online rewrite · 2. T23 family prototype · 3. T19 reduced to the Mars context plus reserved sensor tiles · 4. T22 reduced to journal plus isolation card · 5. T20 reduced to the static suggestions already in T13 · 6. T21 reduced to keyword matching · 7. T24 limited to Today, Trends and Handoff.

**Never cut:** T5–T8 (transparent analysis), T10, T11, T13, T14, T15 (offline handoff), T16, T26. This follows the specification’s release gate.

## Short schedule (about 24 hours)

Setup, T0, T1, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16 → minimal T17 with a stubbed adapter (items show “Queued locally – not sent”) → T25 limited to the three core demos → T26 → T27. Add T18, T19, T21, T22 as time allows.

---

# 12. Final Definition of Done

**Core (Tier 1)**

- [ ] Check-in, validation, personal baseline with maturity, point signal, Trend Watch, status cards with explanations, follow-up checklist, handoff report with JSON export, offline persistence, scenario switcher and reset all work end to end.
- [ ] Demos 1, 2 and 3 pass from a clean reset, offline, with identical results on every run.

**Advanced (Tier 2/3)**

- [ ] Mission context, Earth-link simulator, backend acknowledgement, adaptive suggestions, offline cited search, wellbeing support and the family prototype work as specified, or are explicitly cut and removed from navigation.

**Trust and safety**

- [ ] Synthetic banner and rules badge on every page; provenance on every record; Evidence & Limits page and claims audit reviewed by a person.
- [ ] No diagnosis language; no “Sent” or “Delivered” without acknowledgement; private data never leaks; mission context never changes thresholds.
- [ ] Corpus passages verified against the NASA pages by a human, or still labeled “Team paraphrase – verify.”

**Quality**

- [ ] Existing app functionality still works; all tests, lint and build pass; T26 report shows go for all three core demos.
- [ ] Responsive at 375/768/1280 px; keyboard operable; console clean.

**Demo readiness**

- [ ] `DEMO_RUNBOOK.md` works from a cold start; static backup build and screen-recorded video exist; team has rehearsed the 7-minute walkthrough twice.

*AstroHealth is a hackathon demonstration with fictional data. It is not NASA-endorsed, not an approved flight system, not a medical diagnosis tool, and not a substitute for flight-surgeon judgment.*
