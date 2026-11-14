ASTROHEALTH SHARED SPEC v1 (rules version: ah-rules-0.1)

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
- Trend signal: adverseZ per day in the trend window (sign flipped for 'down' metrics); need >= 5 of the last 7 days; S*t = max(0, S*(t-1) + adverseZ_t - 0.5); fires trend_watch when S >= 4. Report the first day crossed and the current S. Requires maturity >= limited.
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
