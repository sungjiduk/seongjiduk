import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoad } from "../src/core/path.js";

const road = createRoad([
  [0, 0, 0],
  [10, 0, 0],
  [10, 0, -10],
  [20, 0, -10],
]);

test("p=0은 시작점", () => {
  assert.deepEqual(road.at(0).pos.map(Math.round), [0, 0, 0]);
});

test("p=1은 끝점", () => {
  assert.deepEqual(road.at(1).pos.map(Math.round), [20, 0, -10]);
});

test("tangent는 단위 벡터", () => {
  const t = road.at(0.5).tangent;
  assert.ok(Math.abs(Math.hypot(...t) - 1) < 1e-6);
});
