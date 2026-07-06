#!/usr/bin/env node
/**
 * 성지덕 쇼케이스 — 트러블슈팅 로그 집계기.
 *
 * `troubleshooting` 라벨이 붙은 GitHub 이슈(이슈 폼으로 제출됨)를 읽어
 * 커밋된 시드 항목과 합쳐 troubleshooting.json 을 생성한다.
 * 팀원은 쇼케이스의 "＋ 기록 추가" 버튼 → 이슈 폼 제출만 하면
 * 다음 빌드에서 자동으로 페이지에 반영된다.
 *
 * 환경변수:
 *   GITHUB_TOKEN   선택. 있으면 이슈를 조회해 병합. 없으면 시드 그대로 사용.
 *   TS_REPO        선택. 이슈를 읽을 repo. 기본 sungjiduk/seongjiduk
 *   OUT_FILE       선택. 출력 경로(시드 겸용). 기본 showcase/data/troubleshooting.json
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const REPO = process.env.TS_REPO || "sungjiduk/seongjiduk";
const OUT_FILE = process.env.OUT_FILE || "showcase/data/troubleshooting.json";

async function readSeed() {
  try {
    const j = JSON.parse(await readFile(OUT_FILE, "utf8"));
    return Array.isArray(j.items) ? j.items : [];
  } catch {
    return [];
  }
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
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${path}`);
  return res.json();
}

/** 이슈 폼 본문("### 라벨\n\n값") → { 라벨: 값 } 맵 */
function parseIssueForm(body) {
  const out = {};
  const parts = String(body || "").split(/^### +/m);
  for (const seg of parts) {
    const nl = seg.indexOf("\n");
    if (nl < 0) continue;
    const key = seg.slice(0, nl).trim();
    let val = seg.slice(nl + 1).trim();
    if (!key || val === "_No response_") continue;
    out[key] = val;
  }
  return out;
}

const PART_MAP = {
  BACKEND: "BACKEND",
  AI: "AI",
  SHOWCASE: "SHOWCASE",
  INFRA: "INFRA",
  FRONTEND: "FRONTEND",
};

async function issuesToItems() {
  if (!TOKEN) return [];
  const items = [];
  const list = await gh(
    `/repos/${REPO}/issues?state=all&labels=troubleshooting&per_page=100`
  );
  for (const it of list) {
    if (it.pull_request) continue;
    const f = parseIssueForm(it.body);
    const title = f["제목"] || it.title.replace(/^\[TS\]\s*/i, "").trim();
    if (!title) continue;
    items.push({
      date: (f["날짜"] || it.created_at.slice(0, 10)).slice(0, 10),
      title,
      symptom: f["증상"] || "",
      cause: f["원인"] || "",
      fix: f["해결"] || "",
      lesson: f["배운 점 / 재발 방지"] || f["배운 점"] || "",
      refs: [`이슈 #${it.number}`],
      part: PART_MAP[(f["파트"] || "").toUpperCase()] || "BACKEND",
    });
  }
  return items;
}

async function main() {
  const seed = await readSeed();
  let fromIssues = [];
  try {
    fromIssues = await issuesToItems();
  } catch (err) {
    console.error(`[warn] 이슈 조회 실패, 시드만 사용: ${err.message}`);
  }

  // 병합 + 제목 기준 dedup(시드 우선) + 날짜 내림차순
  const byTitle = new Map();
  for (const it of [...seed, ...fromIssues]) {
    const key = (it.title || "").trim().toLowerCase();
    if (!key || byTitle.has(key)) continue;
    byTitle.set(key, it);
  }
  const items = [...byTitle.values()].sort((a, b) =>
    String(b.date).localeCompare(String(a.date))
  );

  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(
    OUT_FILE,
    JSON.stringify({ items }, null, 2) + "\n",
    "utf8"
  );
  console.log(
    `troubleshooting.json 생성: 시드 ${seed.length} + 이슈 ${fromIssues.length} → ${items.length}건 → ${OUT_FILE}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
