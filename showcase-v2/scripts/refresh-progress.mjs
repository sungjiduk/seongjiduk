#!/usr/bin/env node
// Vercel 빌드 시 진행률 스냅샷 갱신 래퍼.
// SHOWCASE_TOKEN(또는 GITHUB_TOKEN)이 있으면 문서 repo의 집계 스크립트를 실행해
// public/data/progress.json 을 갱신하고, 없거나 실패하면 커밋된 스냅샷을 그대로 쓴다.
// (빌드는 절대 실패시키지 않는다 — 진행률은 부가 데이터)

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const token = process.env.SHOWCASE_TOKEN || process.env.GITHUB_TOKEN;
if (!token) {
  console.log("[refresh-progress] 토큰 없음 — 커밋된 progress.json 사용");
  process.exit(0);
}

const script = "../showcase/scripts/build-progress.mjs";
if (!existsSync(script)) {
  console.log("[refresh-progress] 집계 스크립트 없음 — 스킵");
  process.exit(0);
}

const r = spawnSync(process.execPath, [script], {
  stdio: "inherit",
  env: {
    ...process.env,
    GITHUB_TOKEN: token,
    OUT_FILE: "public/data/progress.json",
    API_SPEC_FILE: "../showcase/data/api-spec.json",
  },
});
if (r.status !== 0) {
  console.warn("[refresh-progress] 집계 실패 — 커밋된 스냅샷으로 진행");
}
process.exit(0);
