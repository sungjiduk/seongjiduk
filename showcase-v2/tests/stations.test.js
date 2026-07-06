import { test } from "node:test";
import assert from "node:assert/strict";
import { stationWindow } from "../src/core/stations.js";

test("정거장 중심에서 1", () => {
  assert.equal(stationWindow(0.4, 0.4, 0.08), 1);
});

test("창 밖에서 0", () => {
  assert.equal(stationWindow(0.1, 0.4, 0.08), 0);
  assert.equal(stationWindow(0.49, 0.4, 0.08), 0);
});

test("창 안에서 0..1 사이 부드러운 값", () => {
  const v = stationWindow(0.44, 0.4, 0.08);
  assert.ok(v > 0 && v < 1);
  // 대칭
  assert.ok(Math.abs(v - stationWindow(0.36, 0.4, 0.08)) < 1e-9);
});
