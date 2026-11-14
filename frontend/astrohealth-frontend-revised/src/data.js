/**
 * Reproducible, synthetic mission fixtures. None are real astronaut records.
 * The baseline window is fixed within each scenario so a changing measurement
 * does not quietly rewrite the reference it is being compared against.
 */
export const SCENARIOS = [
  {
    id: "same-jump-stable",
    title: "Personal baseline · steady",
    shortTitle: "Same jump / AST-01",
    note: "The same 78 bpm reading matters more for a person with a steady history.",
    astronautId: "AST-01",
    context: "Earth",
  },
  {
    id: "same-jump-variable",
    title: "Personal baseline · variable",
    shortTitle: "Same jump / AST-02",
    note: "Identical current readings. A wider personal range changes the interpretation.",
    astronautId: "AST-02",
    context: "Earth",
  },
  {
    id: "silent-drift",
    title: "Slow drift in sleep",
    shortTitle: "Silent drift",
    note: "A gradual change adds up, even when no single reading triggers a point alert.",
    astronautId: "AST-01",
    context: "Orbit",
  },
  {
    id: "day-4-onboarding",
    title: "Early in the mission",
    shortTitle: "Day 4 / low confidence",
    note: "There are only three prior readings. The assessment must show uncertainty.",
    astronautId: "AST-01",
    context: "Earth",
  },
  {
    id: "orbit-vs-earth",
    title: "Earth / Orbit comparison",
    shortTitle: "Same reading / context",
    note: "Switch operational context to see how demonstration limits affect the assessment.",
    astronautId: "AST-01",
    context: "Earth",
  },
];

// Steady: mean 64, modest day-to-day fluctuations.
const steadyHeartRates = [61, 67, 62, 66, 63, 65, 59, 69, 62, 66, 63, 65, 64, 64];
// Variable: same mean of 64, but a far wider natural spread.
const variableHeartRates = [49, 79, 55, 73, 53, 75, 57, 71, 54, 74, 56, 72, 60, 68];
const baselineSleep = [7.4, 7.2, 7.3, 7.4, 7.1, 7.2, 7.4, 7.3, 7.2, 7.4, 7.1, 7.3, 7.2, 7.3];
const baselineFatigue = [2, 3, 2, 3, 2, 2, 3, 2, 3, 2, 3, 2, 2, 3];

function record(id, day, hr, sleep, fatigue, stress = 3, exercise = 48) {
  return {
    astronautId: id,
    recordedAt: new Date(Date.UTC(2026, 9, day, 8)).toISOString(),
    source: "simulated",
    restingHeartRateBpm: hr,
    sleepHours: sleep,
    fatigueScore: fatigue,
    stressScore: stress,
    exerciseMinutes: exercise,
  };
}

function makeBaseline(id, hrs, days = 14, sleepArray = baselineSleep) {
  return Array.from({ length: days }, (_, index) =>
    record(id, index + 1, hrs[index], sleepArray[index], baselineFatigue[index]),
  );
}

export function getScenarioData(scenarioId) {
  const config = SCENARIOS.find((item) => item.id === scenarioId) || SCENARIOS[0];
  const astronautId = config.astronautId;
  let baselineCount = 14;
  let measurements;

  if (scenarioId === "silent-drift") {
    // Fourteen steady baseline nights followed by seven slowly declining nights.
    const historical = makeBaseline("AST-01", steadyHeartRates, 14, Array(14).fill(7.2));
    const driftDays = [7.1, 7.0, 6.9, 6.8, 6.7, 6.6, 6.5];
    measurements = [
      ...historical,
      ...driftDays.map((sleep, i) => record("AST-01", i + 15, 64, sleep, 3)),
    ];
  } else if (scenarioId === "day-4-onboarding") {
    baselineCount = 3;
    measurements = [
      ...makeBaseline("AST-01", steadyHeartRates, 3),
      record("AST-01", 4, 72, 6.6, 5),
    ];
  } else {
    const hrs = scenarioId === "same-jump-variable" ? variableHeartRates : steadyHeartRates;
    measurements = [
      ...makeBaseline(astronautId, hrs),
      record(astronautId, 15, 78, 5.4, 5, 6, 25),
    ];
  }

  return {
    scenarioId: config.id,
    astronautId,
    context: config.context,
    baselineCount,
    measurements,
  };
}

export function getScenarioDetails(scenarioId) {
  return SCENARIOS.find((item) => item.id === scenarioId) || SCENARIOS[0];
}
