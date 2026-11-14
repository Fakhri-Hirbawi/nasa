# AstroHealth · Crew medical systems (NASA Space Apps MVP)

A junior-friendly **React + Vite + plain CSS** prototype built from the uploaded 10-page challenge document. The interface is intentionally **in English for the judges**. No Tailwind, UI component library, or charting dependency.

## Run locally

```bash
npm install
npm run dev
```

Open the address Vite prints (usually `http://localhost:5173`). **Do not use VS Code Live Server on port 5500.**

```bash
npm test       # demo logic checks
npm run build  # production build
npm run preview
```

## How to show the project to judges

1. On **Overview**, use the crew switcher AST-01 → AST-02. Their latest measurements are identical, but one has a much wider heart-rate history. One triggers a counted heart-rate signal; the other shows **Not counted**.
2. Select **Silent drift**: the reading is not escalated, but a **Trend watch** appears after accumulated sleep changes.
3. Select **Day 4**: confidence is **Low**, because there are only 3 baseline days.
4. Select **Same reading / context**: switch **Earth** and **Orbit** to compare the demonstration rules.
5. Click **Prepare handoff**: it writes a structured report into **IndexedDB**, shows **Queued locally**, supports **Copy text** and **Download JSON**. Nothing is transmitted.
6. Open **Health log** to see the measurements and manually enter a new reading. It is stored in `localStorage` for the current scenario.

## File guide

- `src/App.jsx`: React components, screen navigation, forms, event handlers, simple SVG graph.
- `src/styles.css`: handwritten responsive UI, warm neutral colors, compact operations layout.
- `src/data.js`: five reproducible synthetic scenario fixtures, with AST-01 and AST-02.
- `src/analysis.js`: personal baseline, variance shrinkage, z-score, confidence, point signals, CUSUM trend watch.
- `src/handoff.js`: report JSON and printable explanation.
- `src/offlineQueue.js`: IndexedDB-based local report outbox, with localStorage fallback.
- `src/analysis.test.js`: easy-to-run demonstrations/test cases.
- `public/sw.js`: caches the production app shell for offline re-opening after an initial online visit.

## What comes from the uploaded document

- Pages 1–3: health monitoring and assessment UI, clear explanations, history graphs, easy manual input, and mission-context considerations.
- Pages 5–7: N-of-1 personalized confidence, two-astronaut comparison, gradual drift / CUSUM, `Not counted`, `Trend watch`, baseline band, and local Earth handoff queue.
- Pages 8–10: *optional or separate future concepts*, such as mental-health features and family connectivity. These were intentionally **not included** in the hackathon MVP.

## Technical contract and limitations

`analyzeHealth({ measurements, baselineCount, context })` returns:

```json
{
  "version": "demo-v3-ui",
  "status": "review",
  "confidence": "high",
  "baselineDays": 14,
  "signals": [],
  "notCounted": [],
  "trendWatch": [],
  "dataQuality": {}
}
```

This module is **a self-contained JavaScript implementation of the *described* demo rules**. The separate TypeScript analysis bundle named in the PDF (`health-analyzer.ts`, `stats.ts`, etc.) was **not attached**. Our thresholds, priors, and scenario records are **demo heuristics**, not validated NASA algorithms or clinical limits. Check actual values with the AI engineer before presenting them as exact reproductions of their version.

The five packaged fixtures are all clearly labeled `source: "simulated"`. Manual readings have `source: "manual"`; these are stored only in the browser. We do **not** collect real astronaut medical records, diagnose disease, or provide treatment orders.

The browser connection indicator reflects `navigator.onLine` only; it is not a spacecraft ground-link state. **Queued** never means **sent**. A server-side sync endpoint, authorization, encryption, and safety review are not implemented.

The offline service worker supports the built/previewed production app after one successful load. Offline on `npm run dev` cannot work without the Vite development server.

## Connecting to your ASP.NET Core backend later

Keep the agreed measurement DTO:

```json
{
  "astronautId": "AST-01",
  "recordedAt": "2026-11-15T08:00:00Z",
  "source": "simulated",
  "restingHeartRateBpm": 78,
  "sleepHours": 5.4,
  "fatigueScore": 5,
  "stressScore": 6,
  "exerciseMinutes": 25
}
```

After the backend adds AST-02 and the new fixtures, replace `getScenarioData()` in `App.jsx` with an API data loader, but preserve a cached local version for offline use. Prefer letting the AI engineer own `analysis.js` after your contracts match. There is **no backend connection yet**.

## Research/resources

The challenge PDF recommends NASA Human Research Program resources (five hazards, human spaceflight risks, ongoing HRP research) and CSA material on radiation. This UI links to NASA background research but **does not claim any live NASA data integration**. The team should cite the exact selected challenge resources in its Space Apps submission.
