#!/usr/bin/env node
/**
 * 성지덕 쇼케이스 — 자동 진행률 집계기.
 *
 * GitHub Actions에서 GITHUB_TOKEN(또는 PAT)으로 실행한다.
 * 집계 기준:
 *   - 분모는 showcase/data/api-spec.json 의 terminal별 endpoint 수(계획된 전체 API).
 *     이슈로 만들지 않은 계획도 분모에 포함되어 진행률이 부풀지 않는다.
 *   - 분자는 해당 prefix(예: "TRIP-003")로 닫힌 이슈 수. 분모(endpoint 수)를 초과하면 cap.
 *   - API 명세에 없는 파트(INFRA 등)는 파트 목록에 이슈 기준 그대로 표시하되
 *     전체 진행률 집계에서는 제외한다.
 *   - endpoint가 있는데 이슈가 없는 파트도 0/N 으로 파트 목록에 포함한다.
 * 결과를 showcase/data/progress.json 으로 생성하고,
 * 브라우저는 이 정적 JSON만 fetch 한다(토큰 노출 방지).
 *
 * 환경변수:
 *   GITHUB_TOKEN   필수. repo 읽기 권한.
 *   TARGET_REPOS   선택. 쉼표구분 "owner/repo". 기본 sungjiduk/seongjiduk-backend
 *   OUT_FILE       선택. 출력 경로. 기본 showcase/data/progress.json
 *   API_SPEC_FILE  선택. API 명세 경로. 기본 showcase/data/api-spec.json
 *
 * OUT_FILE/API_SPEC_FILE 은 repo 루트에서 실행한다고 가정한 상대경로다.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const REPOS = (process.env.TARGET_REPOS || "sungjiduk/seongjiduk-backend")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const OUT_FILE = process.env.OUT_FILE || "showcase/data/progress.json";
const API_SPEC_FILE =
  process.env.API_SPEC_FILE || "showcase/data/api-spec.json";

// 이슈/PR 제목 prefix → 파트 라벨. (예: "[FEAT] TRIP-003 ..." → TRIP)
const PART_LABELS = {
  AUTH: "인증",
  TRIP: "여행 일정",
  CONTENT: "콘텐츠/성지",
  SPOT: "성지",
  VISIT: "방문 기록",
  EVENT: "이벤트 수집",
  ADMIN: "관리자",
  BOOKING: "예약/링크",
  INFRA: "인프라",
};
const PART_RE = /\b(AUTH|TRIP|CONTENT|SPOT|VISIT|EVENT|ADMIN|BOOKING|INFRA)-\d+/i;

if (!TOKEN) {
  console.error("GITHUB_TOKEN(또는 GH_TOKEN)이 필요합니다.");
  process.exit(1);
}

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "seongjiduk-showcase",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} ${res.statusText} for ${path}`);
  }
  return res.json();
}

/** 페이지네이션으로 모든 이슈(PR 제외)를 가져온다. */
async function fetchAllIssues(repo) {
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const items = await gh(
      `/repos/${repo}/issues?state=all&per_page=100&page=${page}`
    );
    if (!items.length) break;
    for (const it of items) {
      if (it.pull_request) continue; // 이슈만
      out.push(it);
    }
    if (items.length < 100) break;
  }
  return out;
}

/** 최근 머지된 PR 목록. */
async function fetchMergedPRs(repo) {
  const out = [];
  const items = await gh(
    `/repos/${repo}/pulls?state=closed&per_page=100&sort=updated&direction=desc`
  );
  for (const pr of items) {
    if (!pr.merged_at) continue;
    out.push({
      number: pr.number,
      title: pr.title,
      mergedAt: pr.merged_at,
      repo,
    });
  }
  return out;
}

function partOf(title) {
  const m = title.match(PART_RE);
  return m ? m[1].toUpperCase() : null;
}

/** api-spec.json 에서 terminal(code)별 endpoint 수를 읽는다. */
async function loadPlannedEndpoints() {
  const spec = JSON.parse(await readFile(API_SPEC_FILE, "utf8"));
  const planned = new Map(); // code → { name, total }
  for (const t of spec.terminals || []) {
    planned.set(t.code, {
      name: t.domain || PART_LABELS[t.code] || t.code,
      total: (t.endpoints || []).length,
    });
  }
  return planned;
}

async function main() {
  const planned = await loadPlannedEndpoints();
  const allIssues = [];
  const allMerged = [];

  for (const repo of REPOS) {
    try {
      const [issues, merged] = await Promise.all([
        fetchAllIssues(repo),
        fetchMergedPRs(repo),
      ]);
      allIssues.push(...issues);
      allMerged.push(...merged);
    } catch (err) {
      console.error(`[warn] ${repo} 조회 실패: ${err.message}`);
    }
  }

  // done 판정 = 닫힌 이슈 ∪ 머지된 PR 의 고유 "PART-번호" 토큰.
  // (같은 엔드포인트를 이슈와 PR로 이중 추적해도 1개로만 카운트)
  const doneTokens = new Map(); // code → Set<"PART-번호">  (완료)
  const seenTokens = new Map(); // code → Set<"PART-번호">  (전체 태그 항목, 명세 외 파트 분모용)
  const addToken = (title, isDone) => {
    const m = title.match(PART_RE);
    if (!m) return;
    const token = m[0].toUpperCase();
    const code = m[1].toUpperCase();
    if (!seenTokens.has(code)) seenTokens.set(code, new Set());
    seenTokens.get(code).add(token);
    if (isDone) {
      if (!doneTokens.has(code)) doneTokens.set(code, new Set());
      doneTokens.get(code).add(token);
    }
  };
  for (const it of allIssues) addToken(it.title, it.state === "closed");
  for (const pr of allMerged) addToken(pr.title, true); // 머지 = 완료

  // 태그 없이 머지된 핵심 엔드포인트 보정
  // (예: 이벤트 수집 API는 EVENT-001 태그 없이 "이벤트 수집 API"로 머지됨)
  const KEYWORD_DONE = { EVENT: /\/api\/events|이벤트\s*수집/i };
  for (const [code, re] of Object.entries(KEYWORD_DONE)) {
    if (allMerged.some((pr) => re.test(pr.title))) {
      if (!doneTokens.has(code)) doneTokens.set(code, new Set());
      doneTokens.get(code).add(`${code}-KW`);
    }
  }

  // 파트별 집계.
  // - API 명세에 있는 파트: 분모 = endpoint 수, 분자 = 완료 토큰 수(분모로 cap).
  //   이슈/PR이 하나도 없어도 0/N 으로 포함한다.
  // - 명세에 없는 파트(INFRA 등): 태그 기준 그대로 표시(전체 집계에서는 제외).
  const partsArr = [];
  let overallDone = 0;
  let overallTotal = 0;
  for (const [code, { name, total }] of planned) {
    const done = Math.min(doneTokens.get(code)?.size ?? 0, total);
    overallDone += done;
    overallTotal += total;
    partsArr.push({
      code,
      name: PART_LABELS[code] || name,
      done,
      total,
      percent: total ? Math.round((done / total) * 100) : 0,
    });
  }
  for (const [code, seen] of seenTokens) {
    if (planned.has(code)) continue;
    const done = doneTokens.get(code)?.size ?? 0;
    partsArr.push({
      code,
      name: PART_LABELS[code] || code,
      done,
      total: seen.size,
      percent: seen.size ? Math.round((done / seen.size) * 100) : 0,
    });
  }
  partsArr.sort((a, b) => b.total - a.total || a.code.localeCompare(b.code));

  // 전체: 분모 = API 명세의 전 endpoint 수, 분자 = API 파트들의 cap된 done 합.
  const overallPercent = overallTotal
    ? Math.round((overallDone / overallTotal) * 100)
    : 0;

  const recentMerged = allMerged
    .sort((a, b) => new Date(b.mergedAt) - new Date(a.mergedAt))
    .slice(0, 8);

  const payload = {
    updatedAt: new Date().toISOString(),
    repos: REPOS,
    overall: {
      done: overallDone,
      total: overallTotal,
      percent: overallPercent,
      basis: "api-spec.json 전체 endpoint 대비 완료(닫힌 이슈 ∪ 머지 PR, 파트별 cap)",
    },
    parts: partsArr,
    recentMerged,
  };

  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(
    `progress.json 생성: 전체 ${overallDone}/${overallTotal} (${overallPercent}%), 파트 ${partsArr.length}개, 최근 머지 ${recentMerged.length}건 → ${OUT_FILE}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
