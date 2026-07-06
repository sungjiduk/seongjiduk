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
