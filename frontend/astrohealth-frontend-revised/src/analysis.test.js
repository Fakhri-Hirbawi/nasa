import test from "node:test";
import assert from "node:assert/strict";
import { analyzeHealth } from "./analysis.js";
import { getScenarioData } from "./data.js";
import { buildHandoff, handoffToText } from "./handoff.js";

const run = (name) => analyzeHealth(getScenarioData(name));

test("identical reading escalates for steady astronaut", () => {
  const a = run("same-jump-stable");
  assert.equal(a.status, "review");
  assert.ok(a.signals.some((s) => s.key === "restingHeartRateBpm"));
  assert.ok(a.signals.some((s) => s.key === "sleepHours"));
  assert.equal(a.confidence, "high");
});

test("same reading is not counted as heart-rate signal for variable astronaut", () => {
  const a = run("same-jump-variable");
  assert.equal(a.status, "normal");
  assert.ok(a.notCounted.some((s) => s.key === "restingHeartRateBpm"));
  assert.equal(a.signals.length, 1);
});

test("gradual sleep change gets trend watch without point escalation", () => {
  const a = run("silent-drift");
  assert.equal(a.status, "normal");
  assert.ok(a.trendWatch.length > 0);
});

test("three baseline days produce low confidence", () => {
  assert.equal(run("day-4-onboarding").confidence, "low");
});

test("Earth / Orbit contexts can change demo assessment", () => {
  const data = getScenarioData("orbit-vs-earth");
  assert.equal(analyzeHealth({ ...data, context: "Earth" }).status, "review");
  assert.equal(analyzeHealth({ ...data, context: "Orbit" }).status, "normal");
});

test("report includes uncertainty and cannot imply transmission", () => {
  const data = getScenarioData("same-jump-variable");
  const analysis = analyzeHealth(data);
  const report = buildHandoff({ ...data, analysis });
  assert.ok(report.assessment.notCounted.length > 0);
  assert.ok(handoffToText(report).includes("No transmission to Earth has occurred"));
});
