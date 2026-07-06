import { test } from "node:test";
import assert from "node:assert/strict";
import { segment, actProgress } from "../src/core/timeline.js";

test("segment는 구간 안에서 0..1 선형", () => {
  // 부동소수점: 0.55 - 0.3 !== 0.25 이므로 기대값도 동일 식으로 계산
  assert.equal(segment(0.4, 0.3, 0.55), (0.4 - 0.3) / (0.55 - 0.3));
});

test("segment는 구간 밖에서 클램프", () => {
  assert.equal(segment(0.1, 0.3, 0.55), 0);
  assert.equal(segment(0.9, 0.3, 0.55), 1);
});

test("actProgress는 t=0.6에서 arrival 초입", () => {
  const r = actProgress(0.6);
  assert.equal(r.act, "arrival");
  assert.ok(r.p > 0 && r.p < 0.2);
});
