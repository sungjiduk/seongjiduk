#!/usr/bin/env node
/**
 * 성지덕 쇼케이스 — 자동 진행률 집계기.
 *
 * GitHub Actions에서 GITHUB_TOKEN(또는 PAT)으로 실행한다.
 * 대상 repo의 이슈·PR을 조회해 파트별/전체 진행률을 집계하고
 * showcase/data/progress.json 을 생성한다.
 * 브라우저는 이 정적 JSON만 fetch 한다(토큰 노출 방지).
 *
 * 환경변수:
 *   GITHUB_TOKEN   필수. repo 읽기 권한.
 *   TARGET_REPOS   선택. 쉼표구분 "owner/repo". 기본 sungjiduk/seongjiduk-backend
 *   OUT_FILE       선택. 출력 경로. 기본 showcase/data/progress.json
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const REPOS = (process.env.TARGET_REPOS || "sungjiduk/seongjiduk-backend")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const OUT_FILE = process.env.OUT_FILE || "showcase/data/progress.json";

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

async function main() {
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

  // 파트별 집계 (prefix 있는 이슈만).
  const parts = new Map();
  let taggedTotal = 0;
  let taggedDone = 0;
  for (const it of allIssues) {
    const code = partOf(it.title);
    if (!code) continue;
    taggedTotal += 1;
    const done = it.state === "closed";
    if (done) taggedDone += 1;
    if (!parts.has(code)) parts.set(code, { done: 0, total: 0 });
    const p = parts.get(code);
    p.total += 1;
    if (done) p.done += 1;
  }

  const partsArr = [...parts.entries()]
    .map(([code, v]) => ({
      code,
      name: PART_LABELS[code] || code,
      done: v.done,
      total: v.total,
      percent: v.total ? Math.round((v.done / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total || a.code.localeCompare(b.code));

  // 전체: prefix 태그된 이슈 기준. 태그가 없으면 전체 이슈 기준으로 폴백.
  let overallDone = taggedDone;
  let overallTotal = taggedTotal;
  if (overallTotal === 0) {
    overallTotal = allIssues.length;
    overallDone = allIssues.filter((i) => i.state === "closed").length;
  }
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
