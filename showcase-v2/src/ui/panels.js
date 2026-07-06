// DOM 패널 렌더러 — 데이터(JSON)를 화이트 패널 카드로.
// ACT2 카드덱: 크루 3 + 프로젝트 소개 + 진행률 요약 + 링크.

const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

export async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** ACT2 카드덱: [{ el, kind }] — 부착은 호출부(overlay.anchor) 책임 */
export function buildDeckCards({ team, progress }) {
  const cards = [];
  const crew = team?.crew ?? [];
  for (const m of crew) {
    cards.push({
      kind: "crew",
      el: el(`
        <article class="deck-card deck-card--crew">
          <p class="deck-card__role mono">${escapeHtml(m.role)} · ${escapeHtml(m.gate || "")}</p>
          <h3 class="deck-card__name">${escapeHtml(m.name)}</h3>
          <p class="deck-card__line">${escapeHtml(m.line || "")}</p>
        </article>`),
    });
  }

  const t = team?.project ?? {};
  cards.push({
    kind: "intro",
    el: el(`
      <article class="deck-card deck-card--intro">
        <p class="deck-card__role mono">MISSION</p>
        <h3 class="deck-card__name">${escapeHtml(t.name || "성지덕")}</h3>
        <p class="deck-card__line">${escapeHtml(t.tagline || "")}</p>
        <p class="deck-card__sub">${escapeHtml(t.oneLiner || "")}</p>
      </article>`),
  });

  const ov = progress?.overall;
  cards.push({
    kind: "progress",
    el: el(`
      <article class="deck-card deck-card--progress">
        <p class="deck-card__role mono">LIVE PROGRESS</p>
        <h3 class="deck-card__name">${ov ? `${ov.percent}%` : "—"}</h3>
        <p class="deck-card__line">${
          ov ? `API 명세 ${ov.total}개 중 ${ov.done}개 착륙` : "진행률 데이터 없음"
        }</p>
        <div class="deck-card__bar"><span style="width:${ov ? ov.percent : 0}%"></span></div>
      </article>`),
  });

  const links = t.links ?? {};
  cards.push({
    kind: "links",
    el: el(`
      <article class="deck-card deck-card--links">
        <p class="deck-card__role mono">BOARDING PASS</p>
        <h3 class="deck-card__name">둘러보기</h3>
        <p class="deck-card__links">
          ${links.github ? `<a href="${escapeHtml(links.github)}" rel="noopener" target="_blank">GitHub</a>` : ""}
          ${links.backend ? `<a href="${escapeHtml(links.backend)}" rel="noopener" target="_blank">Backend</a>` : ""}
          ${links.swagger ? `<a href="${escapeHtml(links.swagger)}" rel="noopener" target="_blank">Swagger</a>` : ""}
        </p>
      </article>`),
  });

  return cards;
}

/* ---------- ACT3 정거장 패널 4종 ---------- */

const METHOD_COLORS = { GET: "m-get", POST: "m-post", PATCH: "m-patch", DELETE: "m-delete" };

/** 정거장 패널: { PLAN, PROGRESS, API, TS } — 각각 .station-panel 요소 */
export function buildStationPanels({ schedule, progress, apiSpec, troubleshooting }) {
  const panels = {};

  // PLAN — 일정 타임라인
  const today = new Date().toISOString().slice(0, 10);
  const legs = schedule?.legs ?? [];
  panels.PLAN = el(`
    <section class="station-panel">
      <p class="station-panel__tag mono">STATION 01 · PLAN</p>
      <h2 class="station-panel__title">여정 타임라인</h2>
      <ol class="station-panel__legs">
        ${legs
          .map((leg, i) => {
            const next = legs[i + 1]?.date;
            const isToday = leg.date <= today && (!next || today < next);
            const status = leg.done ? "완료" : isToday ? "진행 중" : "예정";
            const cls = leg.done ? "is-done" : isToday ? "is-today" : "";
            return `<li class="${cls}"><span class="mono">${escapeHtml(
              leg.range || leg.date
            )}</span> ${escapeHtml(leg.label)} <em class="mono">${status}</em></li>`;
          })
          .join("")}
      </ol>
    </section>`);

  // PROGRESS — 전체 게이지 + 파트별
  const ov = progress?.overall;
  panels.PROGRESS = el(`
    <section class="station-panel">
      <p class="station-panel__tag mono">STATION 02 · LIVE PROGRESS</p>
      <h2 class="station-panel__title">탑승 진행률 ${ov ? `${ov.percent}%` : "—"}</h2>
      <p class="station-panel__desc">API 명세 전체 ${ov?.total ?? "?"}개 엔드포인트 기준 ${
    ov?.done ?? "?"
  }개 착륙</p>
      <ul class="station-panel__parts">
        ${(progress?.parts ?? [])
          .map(
            (pt) => `
          <li>
            <span class="mono part-code">${escapeHtml(pt.code)}</span>
            <span class="part-name">${escapeHtml(pt.name)}</span>
            <span class="mono part-frac">${pt.done}/${pt.total}</span>
            <span class="part-bar"><i style="width:${pt.percent}%"></i></span>
          </li>`
          )
          .join("")}
      </ul>
    </section>`);

  // API — 노선도 (터미널·게이트 요약)
  const terminals = apiSpec?.terminals ?? [];
  const totalGates = terminals.reduce((n, t) => n + (t.endpoints?.length || 0), 0);
  panels.API = el(`
    <section class="station-panel station-panel--wide">
      <p class="station-panel__tag mono">STATION 03 · API MAP</p>
      <h2 class="station-panel__title">노선도 — ${totalGates} GATES</h2>
      <div class="station-panel__terminals">
        ${terminals
          .map(
            (t) => `
          <div class="terminal-mini">
            <p class="terminal-mini__head"><span class="mono">${escapeHtml(
              t.code
            )}</span> ${escapeHtml(t.domain)}</p>
            ${(t.endpoints ?? [])
              .map(
                (e) => `
              <p class="gate-mini mono">
                <span class="method-chip ${METHOD_COLORS[e.method] || ""}">${escapeHtml(
                  e.method
                )}</span>
                <span class="gate-mini__path">${escapeHtml(e.path)}</span>
                <span class="gate-mini__auth">${escapeHtml(e.auth || "-")}</span>
              </p>`
              )
              .join("")}
          </div>`
          )
          .join("")}
      </div>
    </section>`);

  // TS — 트러블슈팅 로그
  panels.TS = el(`
    <section class="station-panel station-panel--wide">
      <p class="station-panel__tag mono">STATION 04 · FLIGHT LOG</p>
      <h2 class="station-panel__title">트러블슈팅 기록</h2>
      <ul class="station-panel__ts">
        ${(troubleshooting?.items ?? [])
          .map(
            (it) => `
          <li>
            <p class="ts-head"><span class="mono">${escapeHtml(it.date)}</span> <b>${escapeHtml(
              it.title
            )}</b> <span class="mono ts-part">${escapeHtml(it.part || "")}</span></p>
            <p class="ts-body"><b>증상</b> ${escapeHtml(it.symptom)} · <b>해결</b> ${escapeHtml(
              it.fix
            )}</p>
          </li>`
          )
          .join("")}
      </ul>
    </section>`);

  return panels;
}
