#!/usr/bin/env node
// Vercel 빌드 시 데이터 스냅샷 갱신 래퍼 (진행률 + 트러블슈팅).
// SHOWCASE_TOKEN(또는 GITHUB_TOKEN)이 있으면 문서 repo의 집계 스크립트를 실행해
// public/data/*.json 을 갱신하고, 없거나 실패하면 커밋된 스냅샷을 그대로 쓴다.
// (빌드는 절대 실패시키지 않는다 — 부가 데이터)

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const token = process.env.SHOWCASE_TOKEN || process.env.GITHUB_TOKEN;
if (!token) {
  console.log("[refresh-data] 토큰 없음 — 커밋된 스냅샷 사용");
  process.exit(0);
}

/** 집계 스크립트 1개 실행 (실패해도 빌드는 계속) */
function run(script, extraEnv) {
  if (!existsSync(script)) {
    console.log(`[refresh-data] ${script} 없음 — 스킵`);
    return;
  }
  const r = spawnSync(process.execPath, [script], {
    stdio: "inherit",
    env: { ...process.env, GITHUB_TOKEN: token, ...extraEnv },
  });
  if (r.status !== 0) {
    console.warn(`[refresh-data] ${script} 실패 — 커밋 스냅샷으로 진행`);
  }
}

run("../showcase/scripts/build-progress.mjs", {
  OUT_FILE: "public/data/progress.json",
  API_SPEC_FILE: "../showcase/data/api-spec.json",
});
run("../showcase/scripts/build-troubleshooting.mjs", {
  OUT_FILE: "public/data/troubleshooting.json",
  TS_REPO: process.env.TS_REPO || "sungjiduk/seongjiduk",
});

process.exit(0);
