/**
 * Transparent demo heuristics inspired by the user-supplied project brief.
 * Not medical thresholds, validated risk predictions, or NASA algorithms.
 * The AI engineer can later replace this module without changing the UI.
 */

const PRIOR_SPREAD = {
  restingHeartRateBpm: 5,
  sleepHours: 0.7,
  fatigueScore: 1.5,
};

// Deliberately chosen scenario limits. These are NOT medical standards.
const CONTEXT_RULES = {
  Earth: { hrIncrease: 10, sleepMinimum: 6.0, fatigueMinimum: 7, fatigueIncrease: 3 },
  Orbit: { hrIncrease: 16, sleepMinimum: 5.0, fatigueMinimum: 8, fatigueIncrease: 4 },
};

const METRICS = [
  { key: "restingHeartRateBpm", label: "Resting heart rate", unit: "bpm", digits: 0 },
  { key: "sleepHours", label: "Sleep duration", unit: "h", digits: 1 },
  { key: "fatigueScore", label: "Fatigue", unit: "/10", digits: 0 },
  { key: "stressScore", label: "Stress", unit: "/10", digits: 0 },
];

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleVariance(values, average) {
  if (values.length < 2) return 0;
  return values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
}

/** Shrink a small personal variance estimate toward a declared demo prior. */
function makeBaseline(records, key) {
  const values = records.map((item) => item[key]).filter(Number.isFinite);
  if (!values.length) return null;
  const average = mean(values);
  const prior = PRIOR_SPREAD[key];
  const variance = sampleVariance(values, average);
  const spread = prior
    ? Math.sqrt((values.length * variance + 5 * prior ** 2) / (values.length + 5))
    : Math.sqrt(variance);
  const predictedSpread = Math.max(0.001, spread) * Math.sqrt(1 + 1 / values.length);
  return { mean: average, sd: spread, predictedSpread, count: values.length };
}

function confidenceFor(count) {
  if (count < 3) return "none";
  if (count < 7) return "low";
  if (count < 14) return "moderate";
  return "high";
}

function round(value, places = 1) {
  return Math.round(value * 10 ** places) / 10 ** places;
}

function signal(key, title, latest, baseline, z, limit, reason) {
  return {
    key,
    title,
    current: latest[key],
    baseline: round(baseline.mean),
    zScore: round(z),
    limit,
    reason,
  };
}

/** One-sided CUSUM. k=0.5 and h=4 are *demonstration* constants. */
function detectSleepDrift(readings, baseline, hasPointSignal) {
  if (!baseline || hasPointSignal || readings.length < 4) return null;
  let sum = 0;
  let wasTriggered = false;
  readings.forEach((item) => {
    if (!Number.isFinite(item.sleepHours)) return;
    const standardizedDrop = (baseline.mean - item.sleepHours) / baseline.predictedSpread;
    sum = Math.max(0, sum + standardizedDrop - 0.5);
    if (sum >= 4) wasTriggered = true;
  });
  if (!wasTriggered) return null;
  return {
    key: "sleepHours",
    label: "Sleep duration",
    days: readings.length,
    score: round(sum),
    description: "Trending down over successive readings. No single day crossed the point-alert limit, but the cumulative shift deserves attention.",
  };
}

export function analyzeHealth({ measurements = [], baselineCount = 0, context = "Earth" }) {
  const records = [...measurements].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const n = Math.min(Math.max(0, baselineCount), Math.max(0, records.length - 1));
  const history = records.slice(0, n);
  const latest = records.at(-1) || null;
  const rules = CONTEXT_RULES[context] || CONTEXT_RULES.Earth;
  const baseline = Object.fromEntries(METRICS.map((metric) => [metric.key, makeBaseline(history, metric.key)]));
  const confidence = confidenceFor(n);
  const signals = [];
  const notCounted = [];
  const metricDetails = METRICS.map((metric) => {
    const reference = baseline[metric.key];
    const current = latest?.[metric.key];
    return {
      ...metric,
      current,
      baseline: reference?.mean ?? null,
      sd: reference?.sd ?? null,
      lower: reference ? reference.mean - 2 * reference.sd : null,
      upper: reference ? reference.mean + 2 * reference.sd : null,
      zScore: reference && Number.isFinite(current)
        ? (current - reference.mean) / reference.predictedSpread : null,
    };
  });

  if (latest && n >= 3) {
    const hr = baseline.restingHeartRateBpm;
    if (hr && Number.isFinite(latest.restingHeartRateBpm)) {
      const change = latest.restingHeartRateBpm - hr.mean;
      const z = change / hr.predictedSpread;
      if (change >= rules.hrIncrease && z >= 2) {
        signals.push(signal("restingHeartRateBpm", "Heart rate above personal range", latest, hr, z,
          `+${rules.hrIncrease} bpm and ≥2 personal SD`,
          `+${round(change)} bpm compared with this astronaut's baseline.`));
      } else if (change >= rules.hrIncrease && z < 2) {
        notCounted.push(signal("restingHeartRateBpm", "Within normal variation", latest, hr, z,
          `Requires ≥2 personal SD`,
          `A +${round(change)} bpm change is within this astronaut's broader historical variation. Not counted toward escalation.`));
      }
    }

    const sleep = baseline.sleepHours;
    if (sleep && Number.isFinite(latest.sleepHours) && latest.sleepHours < rules.sleepMinimum) {
      signals.push(signal("sleepHours", "Sleep below context target", latest, sleep,
        (sleep.mean - latest.sleepHours) / sleep.predictedSpread,
        `<${rules.sleepMinimum} h (${context} demo)`,
        `A ${latest.sleepHours} h night is below the ${context} scenario target.`));
    }

    const fatigue = baseline.fatigueScore;
    if (fatigue && Number.isFinite(latest.fatigueScore)) {
      const change = latest.fatigueScore - fatigue.mean;
      const z = change / fatigue.predictedSpread;
      if (latest.fatigueScore >= rules.fatigueMinimum && change >= rules.fatigueIncrease && z >= 2) {
        signals.push(signal("fatigueScore", "Fatigue above personal range", latest, fatigue, z,
          `≥${rules.fatigueMinimum}/10, +${rules.fatigueIncrease}, and ≥2 SD`,
          `A self-reported increase of ${round(change)} points compared with baseline.`));
      } else if (latest.fatigueScore >= rules.fatigueMinimum && change >= rules.fatigueIncrease && z < 2) {
        notCounted.push(signal("fatigueScore", "Within normal variation", latest, fatigue, z,
          `Requires ≥2 personal SD`,
          "The increase did not pass the personal-variation check. Not counted toward escalation."));
      }
    }
  }

  const drift = detectSleepDrift(records.slice(n), baseline.sleepHours,
    signals.some((item) => item.key === "sleepHours"));
  const missingValues = records.reduce((count, entry) => count + METRICS.filter((m) => !Number.isFinite(entry[m.key])).length, 0);

  return {
    version: "demo-v3-ui",
    status: signals.length >= 2 ? "review" : "normal",
    confidence,
    baselineDays: n,
    context,
    latest,
    metrics: metricDetails,
    baseline,
    signals,
    notCounted,
    trendWatch: drift ? [drift] : [],
    dataQuality: {
      records: records.length,
      missingValues,
      synthetic: records.some((r) => r.source === "simulated"),
    },
    actions: signals.length || drift
      ? ["Verify the measurements and note any symptoms.", "Check the approved crew medical procedures and consult designated support when indicated."]
      : ["Continue recording measurements and reviewing changes over time."],
  };
}
