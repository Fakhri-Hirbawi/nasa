import React, { useEffect, useMemo, useState } from "react";
import { analyzeHealth } from "./analysis.js";
import { getScenarioData, getScenarioDetails, SCENARIOS } from "./data.js";
import { buildHandoff, downloadHandoff, handoffToText } from "./handoff.js";
import { enqueueHandoff, getQueuedHandoffs } from "./offlineQueue.js";

const STORAGE_KEY = "astrohealth-frontend-v3";
const DEFAULT_STATE = getScenarioData("same-jump-stable");

const iconPaths = {
  overview: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  readings: <><path d="M4 20h16M4 4v16M7 15l4-5 3 3 5-7"/></>,
  handoff: <><path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M13 3h8v8M21 3 10 14"/></>,
  arrow: <><path d="m5 12 14 0M13 6l6 6-6 6"/></>,
  circle: <><circle cx="12" cy="12" r="9"/><path d="M12 7v6l3 2"/></>,
  activity: <><path d="M2 12h5l3-7 4 14 3-7h5"/></>,
  download: <><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/></>,
  copy: <><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
  moon: <><path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z"/></>,
  check: <><path d="m4 12 5 5L20 6"/></>,
  alert: <><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v4m0 4h.01"/></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  close: <><path d="m5 5 14 14M19 5 5 19"/></>,
};

function Icon({ name, size = 18, className = "" }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name] || iconPaths.info}</svg>;
}

function initialState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && SCENARIOS.some((item) => item.id === saved.scenarioId) &&
      Array.isArray(saved.measurements) && saved.measurements.length &&
      Number.isInteger(saved.baselineCount)) {
      return { ...getScenarioData(saved.scenarioId), ...saved };
    }
  } catch { /* Start with safe, reproducible fixtures. */ }
  return DEFAULT_STATE;
}

function fmt(value, digits = 1) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)).toString() : "—";
}

function dayOf(date) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function StatusBadge({ status }) {
  return <span className={`status-badge ${status === "review" ? "review" : "normal"}`}><span className="status-dot" />{status === "review" ? "Review indicated" : "No escalation"}</span>;
}

function Sidebar({ view, onView, queuedCount, open, onClose }) {
  const navigation = [
    ["overview", "Overview", "overview"],
    ["readings", "Health log", "readings"],
    ["handoffs", "Earth handoffs", "handoff"],
  ];
  return <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
    <div className="identity">
      <div className="brand-symbol" aria-hidden="true"><span>A</span><i /></div>
      <div><div className="brand-name">ASTROHEALTH<span className="brand-period">.</span></div><div className="brand-subtitle">CREW MEDICAL SYSTEMS</div></div>
      <button className="mobile-close icon-button" onClick={onClose} aria-label="Close menu"><Icon name="close"/></button>
    </div>
    <div className="sidebar-rule"/>
    <p className="nav-heading">WORKSPACE</p>
    <nav className="nav-links" aria-label="Main navigation">
      {navigation.map(([key, label, icon]) => <button key={key} className={`nav-link ${view === key ? "active" : ""}`} onClick={() => { onView(key); onClose(); }}>
        <Icon name={icon} size={17}/><span>{label}</span>{key === "handoffs" && queuedCount > 0 && <em>{queuedCount}</em>}
      </button>)}
    </nav>
    <div className="sidebar-bottom">
      <div className="mission-tile"><span className="mission-label">ACTIVE MISSION</span><strong>ARES / TRANSIT 01</strong><span className="mission-meta"><b className="mission-led"/> Simulation workspace</span></div>
      <p>Prototype for NASA Space Apps.<br/>Not for clinical use.</p>
    </div>
  </aside>;
}

function HealthChart({ measurements, baselineCount, analysis, selected, onSelected }) {
  const options = [
    { key: "restingHeartRateBpm", text: "Heart rate" },
    { key: "sleepHours", text: "Sleep" },
  ];
  const details = analysis.metrics.find((metric) => metric.key === selected);
  const all = measurements.slice(-21);
  const values = all.map((row) => row[selected]).filter(Number.isFinite);
  const base = analysis.baseline[selected];
  const W = 700, H = 206, L = 38, R = 18, T = 22, B = 27;
  const lower = base ? base.mean - 2 * base.sd : null;
  const upper = base ? base.mean + 2 * base.sd : null;
  const allBounds = [...values, lower, upper].filter(Number.isFinite);
  const rawMin = Math.min(...allBounds), rawMax = Math.max(...allBounds);
  const padding = Math.max(0.4, (rawMax - rawMin) * 0.23);
  const min = rawMin - padding, max = rawMax + padding;
  const x = (i) => L + i * (W - L - R) / Math.max(1, all.length - 1);
  const y = (v) => H - B - (v - min) / Math.max(0.001, max - min) * (H - T - B);
  const path = all.map((row, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(row[selected]).toFixed(1)}`).join(" ");
  const yBand = upper !== null && lower !== null ? { top: y(upper), bottom: y(lower) } : null;
  const markers = [min, (min + max)/2, max];
  const currentRecordIndex = all.length - 1;

  return <section className="paper chart-panel">
    <div className="panel-heading"><div><p className="eyebrow">READING HISTORY</p><h2>Personal range</h2><p>Observed measurements against the astronaut's reference band.</p></div>
      <div className="chart-tabs" role="group" aria-label="Chart metric">{options.map((option) => <button key={option.key} className={selected === option.key ? "chosen" : ""} onClick={() => onSelected(option.key)}>{option.text}</button>)}</div>
    </div>
    <div className="chart-plot">
      <svg viewBox={`0 0 ${W} ${H}`} aria-label={`Trend chart for ${details?.label || "measurement"}`} role="img">
        {markers.map((v, i) => <g key={i}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#e6e8e5" strokeDasharray="3 6"/><text x={L - 9} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#88918f">{fmt(v, selected === "sleepHours" ? 1 : 0)}</text></g>)}
        {yBand && <rect x={L} y={yBand.top} width={W - L - R} height={yBand.bottom - yBand.top} fill="#e4eee9"/>}
        {base && <line x1={L} x2={W - R} y1={y(base.mean)} y2={y(base.mean)} stroke="#6e9a8f" strokeDasharray="5 5" strokeWidth="1.4"/>}
        <path d={path} fill="none" stroke="#294b48" strokeWidth="2.7" strokeLinejoin="round" strokeLinecap="round"/>
        {all.map((row, i) => <circle key={i} cx={x(i)} cy={y(row[selected])} r={i === currentRecordIndex ? 5.2 : 2.6} fill={i === currentRecordIndex ? "#ba694b" : "#294b48"} stroke="#fff" strokeWidth="1.5"/>)}
      </svg>
      <div className="chart-dates"><span>{dayOf(all[0].recordedAt)}</span><span>{dayOf(all.at(-1).recordedAt)}</span></div>
    </div>
    <div className="chart-foot"><span><b className="legend-line"/> Observed value</span><span><b className="legend-band"/> Baseline ±2 SD</span><span className="source-foot">{baselineCount} baseline days · synthetic data</span></div>
  </section>;
}

function SignalRow({ item, kind = "counted" }) {
  return <div className={`signal-row ${kind === "muted" ? "signal-muted" : ""}`}>
    <div className="signal-icon">{kind === "muted" ? "−" : <Icon name="activity" size={17}/>}</div>
    <div className="signal-body"><strong>{item.title}</strong><p>{item.reason}</p><div className="signal-tags"><span>Current {fmt(item.current)} </span><span>Baseline {fmt(item.baseline)}</span><span>{fmt(item.zScore)} personal SD</span><span>Limit: {item.limit}</span></div></div>
    <span className={`signal-type ${kind === "muted" ? "quiet" : ""}`}>{kind === "muted" ? "Not counted" : "Counted"}</span>
  </div>;
}

function HealthSummary({ analysis, astronautId, onHandoff }) {
  const alertCount = analysis.signals.length;
  const confidenceText = { none: "Not established", low: "Low", moderate: "Moderate", high: "High" }[analysis.confidence];
  return <section className="assessment" aria-label="Health assessment">
    <div className="assessment-top"><div><p className="eyebrow inverse">CURRENT ASSESSMENT / {astronautId}</p><StatusBadge status={analysis.status}/></div><span className="assessment-code">A/H · 001</span></div>
    <div className="assessment-middle"><div><h2>{analysis.status === "review" ? "A change worth\nreviewing." : "Nothing to escalate\nright now."}</h2><p>{analysis.status === "review" ? `${alertCount} independent demonstration checks are flagged. Review the details before taking action.` : "The current reading does not meet the demo escalation rule. A trend or individual signal may still need attention."}</p></div><div className="assessment-divider"/><div className="confidence-block"><span className="overline">ANALYSIS CONFIDENCE</span><strong>{confidenceText}</strong><span>Baseline from {analysis.baselineDays} days</span><div className="confidence-bars">{[1,2,3].map((n) => <i key={n} className={(analysis.confidence === "high" || (analysis.confidence === "moderate" && n <= 2) || (analysis.confidence === "low" && n === 1)) ? "filled" : ""}/>)}</div></div></div>
    <div className="assessment-footer"><span><Icon name="info" size={15}/> Demonstration logic, not a clinical determination</span><button className="light-outline-button" onClick={onHandoff}>Prepare handoff <Icon name="arrow" size={15}/></button></div>
  </section>;
}

function Overview({ state, analysis, onHandoff, chartMetric, setChartMetric }) {
  const metrics = [
    { key:"restingHeartRateBpm", label:"Resting heart rate", unit:"bpm", className:"heart" },
    { key:"sleepHours",label:"Sleep duration",unit:"hours",className:"sleep" },
    { key:"fatigueScore",label:"Fatigue level",unit:"/ 10",className:"fatigue" },
    { key:"stressScore",label:"Stress level",unit:"/ 10",className:"stress" },
  ];
  return <div className="overview-flow">
    <HealthSummary analysis={analysis} astronautId={state.astronautId} onHandoff={onHandoff}/>
    <section className="vitals-section">
      <div className="small-section-heading"><h2>Latest readings</h2><span>Compared with personal baseline</span></div>
      <div className="vitals-grid">{metrics.map((metric) => {
        const m = analysis.metrics.find((item) => item.key === metric.key);
        const value = m?.current;
        const delta = Number.isFinite(m?.baseline) && Number.isFinite(value) ? value - m.baseline : null;
        return <div className="vital" key={metric.key}>
          <span className="vital-label">{metric.label}</span><div className="vital-measure"><strong>{fmt(value, metric.key === "sleepHours" ? 1 : 0)}</strong><span>{metric.unit}</span></div>
          <div className="vital-foot"><span>Baseline {fmt(m?.baseline)}</span><span className={delta !== null && Math.abs(delta) > 0.3 ? "vital-delta" : ""}>{delta === null ? "—" : `${delta > 0 ? "+" : ""}${fmt(delta)}`}</span></div>
        </div>;
      })}</div>
    </section>
    {analysis.trendWatch.length > 0 && <section className="trend-banner"><span className="trend-symbol">↘</span><div><div className="trend-kicker">TREND WATCH · {analysis.trendWatch[0].days} READINGS</div><h3>Quiet changes add up.</h3><p>{analysis.trendWatch[0].description}</p></div><span className="trend-end">CUSUM {fmt(analysis.trendWatch[0].score)}</span></section>}
    <HealthChart measurements={state.measurements} baselineCount={state.baselineCount} analysis={analysis} selected={chartMetric} onSelected={setChartMetric}/>
    <section className="paper signals-panel">
      <div className="panel-heading"><div><p className="eyebrow">INTERPRETATION</p><h2>What the checks found</h2><p>Counted signals affect escalation. Other observations stay visible.</p></div><span className="count-indicator">{analysis.signals.length} counted</span></div>
      {analysis.signals.length ? analysis.signals.map((s) => <SignalRow item={s} key={s.key}/>) : <div className="empty-signals"><Icon name="check" size={18}/> No point signals met the demo rule for this reading.</div>}
      {analysis.notCounted.length > 0 && <div className="not-counted-section"><div className="muted-section-title">NOT COUNTED · PERSONAL VARIABILITY</div>{analysis.notCounted.map((s) => <SignalRow item={s} kind="muted" key={s.key}/>)}</div>}
      <div className="guidance"><span className="guidance-label">RECOMMENDED REVIEW</span><p>{analysis.actions.join(" ")}</p></div>
    </section>
  </div>;
}

function ScenarioPanel({ state, onScenario, onAstronaut, onContext, onReset }) {
  const scenarioInfo = getScenarioDetails(state.scenarioId);
  const canCompareCrew = state.scenarioId.startsWith("same-jump");
  return <section className="side-panel scenario-panel"><div className="side-header"><span className="eyebrow">DEMO CONTROLS</span><span className="vertical-dots" aria-hidden="true">•••</span></div><h2>Explore a scenario</h2><p className="side-help">Try the same measurements in different conditions.</p>
    <label htmlFor="scenario-select">Choose scenario</label><select id="scenario-select" value={state.scenarioId} onChange={(e) => onScenario(e.target.value)}>{SCENARIOS.map((item) => <option key={item.id} value={item.id}>{item.shortTitle}</option>)}</select>
    <p className="scenario-description">{scenarioInfo.note}</p>
    <div className="side-divider"/>
    <div className="field-header"><span>CREW MEMBER</span><small>{canCompareCrew ? "Switch to compare" : "Scenario-locked"}</small></div>
    <div className="segmented">{["AST-01","AST-02"].map((id) => <button key={id} disabled={!canCompareCrew && id !== state.astronautId} className={state.astronautId === id ? "selected" : ""} onClick={() => onAstronaut(id)}>{id}</button>)}</div>
    <div className="field-header context-title"><span>OPERATIONAL CONTEXT</span><small>Demo rules</small></div><div className="segmented">{["Earth","Orbit"].map((mode) => <button className={state.context === mode ? "selected" : ""} key={mode} onClick={() => onContext(mode)}>{mode}</button>)}</div>
    <div className="scenario-foot"><span><Icon name="info" size={15}/> No live sensor or NASA API connection</span><button className="text-button" onClick={onReset}>Reset fixture <span>↗</span></button></div>
  </section>;
}

function MissionNotes({ state, analysis }) {
  return <section className="side-panel context-panel"><p className="eyebrow">MISSION NOTES</p><h2>Understand the limits.</h2><div className="note-entry"><span>01</span><p>Every astronaut has a different reference range. One number does not tell the whole story.</p></div><div className="note-entry"><span>02</span><p>Current context: <strong>{state.context}</strong>. This changes demonstration limits, not medical standards.</p></div><div className="note-entry"><span>03</span><p>{analysis.dataQuality.synthetic ? "The selected fixture uses synthetic measurements." : "Manual measurements are mixed with synthetic history."} No diagnosis or treatment decision is made.</p></div>
    <a href="https://www.nasa.gov/humans-in-space/the-human-body-in-space/" target="_blank" rel="noreferrer">NASA / Human spaceflight research <span>↗</span></a>
  </section>;
}

function Readings({ state, analysis, onAdd, onReset }) {
  const [form, setForm] = useState({ restingHeartRateBpm: "", sleepHours: "", fatigueScore: "", stressScore: "", exerciseMinutes: "" });
  const [feedback, setFeedback] = useState("");
  const fields = [
    { key: "restingHeartRateBpm", label: "Resting heart rate", hint: "bpm", min: 30, max: 220, step: 1 },
    { key: "sleepHours", label: "Sleep last night", hint: "hours", min: 0, max: 24, step: 0.1 },
    { key: "fatigueScore", label: "Fatigue", hint: "1–10", min: 1, max: 10, step: 1 },
    { key: "stressScore", label: "Stress", hint: "1–10", min: 1, max: 10, step: 1 },
    { key: "exerciseMinutes", label: "Exercise", hint: "minutes", min: 0, max: 300, step: 1 },
  ];
  function submit(e) {
    e.preventDefault();
    const values = Object.fromEntries(fields.map((field) => [field.key, Number(form[field.key])]));
    if (fields.some((field) => form[field.key].trim() === "" || !Number.isFinite(values[field.key]) || values[field.key] < field.min || values[field.key] > field.max)) {
      setFeedback("Check the highlighted measurement ranges and try again."); return;
    }
    onAdd(values);
    setForm({ restingHeartRateBpm: "", sleepHours: "", fatigueScore: "", stressScore: "", exerciseMinutes: "" });
    setFeedback("Reading saved locally. The overview will use it as the most recent measurement.");
  }
  return <div className="readings-grid"><section className="paper reading-table-panel"><div className="panel-heading"><div><p className="eyebrow">LOCAL DATA</p><h2>Measurement history</h2><p>{state.measurements.length} measurements · {state.astronautId}</p></div><button onClick={onReset} className="outline-button">Reset scenario</button></div><div className="table-scroll"><table className="reading-table"><thead><tr><th>Recorded (UTC)</th><th>HR</th><th>Sleep</th><th>Fatigue</th><th>Source</th></tr></thead><tbody>{[...state.measurements].reverse().map((r, i) => <tr key={`${r.recordedAt}-${i}`}><td>{dayOf(r.recordedAt)}</td><td>{fmt(r.restingHeartRateBpm,0)} bpm</td><td>{fmt(r.sleepHours)} h</td><td>{fmt(r.fatigueScore,0)}/10</td><td><span className="source-chip">{r.source}</span></td></tr>)}</tbody></table></div></section>
    <section className="paper checkin-panel"><p className="eyebrow">DAILY ROUTINE</p><h2>Add a health check-in</h2><p className="form-help">Use a manual reading to see how the assessment responds. Stored only in this browser.</p><form onSubmit={submit} className="reading-form">{fields.map((f) => <label key={f.key}><span>{f.label}<small>{f.hint}</small></span><input name={f.key} type="number" min={f.min} max={f.max} step={f.step} required value={form[f.key]} onChange={(e) => setForm((old) => ({ ...old, [f.key]: e.target.value }))} placeholder={f.hint}/></label>)}<button type="submit" className="dark-button">Save measurement <Icon name="arrow" size={16}/></button>{feedback && <p className="form-feedback" role="status">{feedback}</p>}</form><p className="form-disclaimer">Input validation ranges are interface constraints, not clinical thresholds.</p></section>
  </div>;
}

function Handoffs({ reports, selectedReport, onSelect, onPrepare, onCopy, onDownload, notification }) {
  return <div className="handoff-grid"><section className="paper handoff-list"><div className="panel-heading"><div><p className="eyebrow">LOCAL OUTBOX</p><h2>Queued for Earth</h2><p>Reports are stored on this device. Nothing has been sent.</p></div></div><button className="dark-button handoff-create" onClick={onPrepare}>Prepare current assessment <Icon name="arrow" size={16}/></button>
    {reports.length ? <div className="handoff-items">{reports.map((report) => <button key={report.reportId} onClick={() => onSelect(report)} className={`handoff-item ${selectedReport?.reportId === report.reportId ? "picked" : ""}`}><div><strong>{report.astronautId} / {report.context}</strong><small>{new Date(report.createdAt).toLocaleString()}</small></div><span>Queued locally</span></button>)}</div> : <div className="empty-outbox">No reports yet. Prepare a handoff from the current assessment.</div>}
  </section>
  <section className="paper handoff-preview"><div className="panel-heading"><div><p className="eyebrow">HANDOFF REPORT</p><h2>{selectedReport ? "Review before sharing" : "Select a report"}</h2><p>Structured, reproducible summary for delayed communication.</p></div></div>{selectedReport ? <><div className="report-actions"><button className="outline-button" onClick={onCopy}><Icon name="copy" size={16}/> Copy text</button><button className="outline-button" onClick={onDownload}><Icon name="download" size={16}/> Download JSON</button></div><pre className="report-text">{handoffToText(selectedReport)}</pre></> : <div className="empty-outbox">Prepare or select a local report to preview it.</div>}{notification && <p className="form-feedback" role="status">{notification}</p>}</section></div>;
}

export default function App() {
  const [state, setState] = useState(initialState);
  const [view, setView] = useState("overview");
  const [chartMetric, setChartMetric] = useState("restingHeartRateBpm");
  const [queuedReports, setQueuedReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [notification, setNotification] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const analysis = useMemo(() => analyzeHealth(state), [state]);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);
  useEffect(() => { getQueuedHandoffs().then(setQueuedReports).catch(console.error); }, []);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  function selectScenario(id) { setState(getScenarioData(id)); setChartMetric("restingHeartRateBpm"); }
  function selectAstronaut(id) { selectScenario(id === "AST-01" ? "same-jump-stable" : "same-jump-variable"); }
  function updateContext(context) { setState((s) => ({ ...s, context })); }
  function resetScenario() { setState(getScenarioData(state.scenarioId)); }
  function addMeasurement(values) {
    const record = { astronautId: state.astronautId, recordedAt: new Date().toISOString(), source: "manual", ...values };
    setState((prev) => ({ ...prev, measurements: [...prev.measurements, record] }));
  }
  async function prepareHandoff() {
    setNotification("");
    const report = buildHandoff({ astronautId: state.astronautId, scenarioId: state.scenarioId, analysis, measurements: state.measurements });
    try {
      const storage = await enqueueHandoff(report);
      setQueuedReports(await getQueuedHandoffs());
      setSelectedReport(report);
      setNotification(`Handoff queued locally (${storage}). It has NOT been transmitted.`);
      setView("handoffs");
    } catch (error) {
      setNotification(`Unable to store report: ${error.message}`);
      setView("handoffs");
    }
  }
  async function copyReport() {
    if (!selectedReport) return;
    try { await navigator.clipboard.writeText(handoffToText(selectedReport)); setNotification("Report text copied to clipboard."); }
    catch { setNotification("Copy was blocked by the browser. Select the report text to copy manually."); }
  }

  const title = { overview: "Crew health overview", readings: "Health measurement log", handoffs: "Earth handoff outbox" }[view];
  return <div className="app-shell">
    <Sidebar view={view} onView={setView} queuedCount={queuedReports.length} open={mobileMenu} onClose={() => setMobileMenu(false)}/>
    {mobileMenu && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileMenu(false)}/>}
    <main className="main-area">
      <header className="top-bar"><button className="mobile-open icon-button" aria-label="Open navigation" onClick={() => setMobileMenu(true)}><Icon name="menu"/></button><span>MISSION OPERATIONS <span className="breadcrumb-slash">/</span> HEALTH SYSTEMS</span><div className="header-right"><span className="connection"><span className={online ? "online-led" : "offline-led"}/>{online ? "Browser online" : "Browser offline"}</span><span className="top-divider"/><span className="simulation-stamp">SIMULATION / 2026</span></div></header>
      <div className="content-area"><div className="page-intro"><div><p className="eyebrow">MISSION HEALTH / {state.astronautId} / {state.context.toUpperCase()}</p><h1>{title}<span className="title-mark">.</span></h1><p>{view === "overview" ? "A personal reading of how an astronaut changes over time." : view === "readings" ? "Review local history and record a new measurement." : "A clear record for when contact with Earth is delayed."}</p></div><div className="mission-day"><span>MISSION DAY</span><strong>{String(state.measurements.length).padStart(3, "0")}</strong></div></div>
        {view === "overview" ? <div className="content-columns"><Overview state={state} analysis={analysis} onHandoff={prepareHandoff} chartMetric={chartMetric} setChartMetric={setChartMetric}/><div className="right-rail"><ScenarioPanel state={state} onScenario={selectScenario} onAstronaut={selectAstronaut} onContext={updateContext} onReset={resetScenario}/><MissionNotes state={state} analysis={analysis}/></div></div> : view === "readings" ? <Readings state={state} analysis={analysis} onAdd={addMeasurement} onReset={resetScenario}/> : <Handoffs reports={queuedReports} selectedReport={selectedReport} onSelect={setSelectedReport} onPrepare={prepareHandoff} onCopy={copyReport} onDownload={() => selectedReport && downloadHandoff(selectedReport)} notification={notification}/>}
        <footer className="site-footer"><span>ASTROHEALTH / SPACE APPS PROTOTYPE</span><span>All scenario measurements are synthetic. Demo heuristics only. Not for medical decisions.</span></footer>
      </div>
    </main>
  </div>;
}
