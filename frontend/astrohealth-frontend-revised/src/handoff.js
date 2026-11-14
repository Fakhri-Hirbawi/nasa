/** All report content is generated locally. No medical AI or ground upload. */
export function buildHandoff({ astronautId, scenarioId, analysis, measurements }) {
  const latest = measurements.at(-1);
  const report = {
    reportId: `HND-${Date.now()}`,
    reportVersion: "demo-v3-ui",
    createdAt: new Date().toISOString(),
    mission: "ARES / DEMO MISSION",
    astronautId,
    scenarioId,
    context: analysis.context,
    assessment: {
      status: analysis.status,
      confidence: analysis.confidence,
      baselineDays: analysis.baselineDays,
      signals: analysis.signals,
      notCounted: analysis.notCounted,
      trendWatch: analysis.trendWatch,
    },
    currentMeasurement: latest,
    dataQuality: analysis.dataQuality,
    suggestedReviewSteps: analysis.actions,
    limitations: [
      "Synthetic measurements used in all packaged scenarios.",
      "Demo-only context thresholds and statistical priors; not NASA clinical standards.",
      "Short and fixed baseline. No diagnosis, prediction, or medical clearance.",
      "This file is stored locally. No transmission to Earth has occurred.",
    ],
  };
  return report;
}

export function handoffToText(report) {
  const assessment = report.assessment;
  const lines = [
    "ASTROHEALTH / EARTH HANDOFF",
    "--------------------------------------------",
    `Astronaut: ${report.astronautId}`,
    `Scenario: ${report.scenarioId}`,
    `Context: ${report.context}`,
    `Prepared: ${report.createdAt}`,
    `Assessment: ${assessment.status.toUpperCase()}`,
    `Confidence: ${assessment.confidence} (${assessment.baselineDays} baseline days)`,
    "",
    "COUNTED CHANGES",
    ...((assessment.signals.length ? assessment.signals : [{ title: "None", reason: "No point signals met the demo criteria." }])
      .map((s) => `• ${s.title}: ${s.reason}`)),
    "",
    "NOT COUNTED / EXCLUSIONS",
    ...((assessment.notCounted.length ? assessment.notCounted : [{ title: "None", reason: "No excluded candidate signals." }])
      .map((s) => `• ${s.title}: ${s.reason}`)),
    "",
    "TREND WATCH",
    ...((assessment.trendWatch.length ? assessment.trendWatch : [{ description: "No gradual drift detected." }])
      .map((s) => `• ${s.description}`)),
    "",
    "DATA QUALITY",
    `Records: ${report.dataQuality.records}; missing fields: ${report.dataQuality.missingValues}; synthetic data: ${report.dataQuality.synthetic}`,
    "",
    "SUGGESTED REVIEW STEPS",
    ...report.suggestedReviewSteps.map((a) => `• ${a}`),
    "",
    "LIMITATIONS",
    ...report.limitations.map((l) => `• ${l}`),
  ];
  return lines.join("\n");
}

export function downloadHandoff(report) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `astrohealth-${report.astronautId}-${report.reportId}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
