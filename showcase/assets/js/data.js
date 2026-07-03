// 성지덕 쇼케이스 — 데이터 로드 & 섹션 렌더
// 모든 값은 data/*.json 에서 읽는다(하드코딩 금지).

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

/* ---------- 팀 ---------- */
function renderTeam(team) {
  const t = team.project || {};
  $$("[data-team-tagline]").forEach((el) => {
    if (t.tagline) el.textContent = t.tagline;
  });
  $$("[data-team-oneliner]").forEach((el) => {
    if (t.oneLiner) el.textContent = t.oneLiner;
  });

  const crew = $("[data-crew]");
  if (crew && Array.isArray(team.crew)) {
    crew.innerHTML = team.crew
      .map(
        (m) => `
      <li class="crew-card">
        <div class="crew-card__role mono">${escapeHtml(m.role)}</div>
        <div class="crew-card__name">${escapeHtml(m.name)}</div>
        <div class="crew-card__gate mono">${escapeHtml(m.gate || "")}</div>
        <p class="crew-card__line">${escapeHtml(m.line || "")}</p>
      </li>`
      )
      .join("");
  }

  const links = t.links || {};
  const setLink = (sel, url) => {
    const el = $(sel);
    if (!el) return;
    if (url) {
      el.href = url;
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  };
  setLink("[data-link-github]", links.github);
  setLink("[data-link-backend]", links.backend);
  setLink("[data-link-swagger]", links.swagger);
}

/* ---------- 진행률 ---------- */
function renderProgress(p) {
  const overall = p.overall || { percent: 0, done: 0, total: 0 };
  const pctEl = $("[data-overall-pct]");
  const fracEl = $("[data-overall-frac]");
  const fillEl = $("[data-gauge-fill]");
  const C = 327; // 2πr, r=52

  if (pctEl) {
    // 카운트업
    const target = overall.percent | 0;
    let cur = 0;
    const step = Math.max(1, Math.round(target / 40));
    const tick = () => {
      cur = Math.min(target, cur + step);
      pctEl.textContent = `${cur}%`;
      if (cur < target) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  if (fracEl) fracEl.textContent = `${overall.done}/${overall.total}`;
  if (fillEl)
    requestAnimationFrame(() => {
      fillEl.style.strokeDashoffset = String(
        C - (C * (overall.percent || 0)) / 100
      );
    });

  const updated = $("[data-progress-updated]");
  if (updated && p.updatedAt) {
    const d = new Date(p.updatedAt);
    updated.textContent = `업데이트 ${d.toLocaleString("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
    })}`;
  }

  const partsEl = $("[data-parts]");
  if (partsEl && Array.isArray(p.parts)) {
    partsEl.innerHTML = p.parts
      .map(
        (pt) => `
      <li class="part-row">
        <div class="part-row__name">
          <span class="part-row__code mono">${escapeHtml(pt.code)}</span>${escapeHtml(
          pt.name
        )}
        </div>
        <div class="part-row__frac mono">${pt.done}/${pt.total} · ${pt.percent}%</div>
        <div class="part-row__bar"><span data-w="${pt.percent}"></span></div>
      </li>`
      )
      .join("");
    requestAnimationFrame(() => {
      $$(".part-row__bar > span", partsEl).forEach((b) => {
        b.style.width = `${b.dataset.w}%`;
      });
    });
  }

  const recentEl = $("[data-recent]");
  if (recentEl && Array.isArray(p.recentMerged)) {
    recentEl.innerHTML = p.recentMerged
      .map((r) => {
        const d = r.mergedAt
          ? new Date(r.mergedAt).toLocaleDateString("ko-KR", {
              month: "2-digit",
              day: "2-digit",
            })
          : "";
        return `
        <li class="ticket">
          <span class="ticket__num">#${escapeHtml(r.number)}</span>
          <span class="ticket__title">${escapeHtml(r.title)}</span>
          <span class="ticket__date">${escapeHtml(d)}</span>
        </li>`;
      })
      .join("");
  }
}

function renderProgressError() {
  const pctEl = $("[data-overall-pct]");
  if (pctEl) pctEl.textContent = "—";
  const updated = $("[data-progress-updated]");
  if (updated)
    updated.textContent = "진행률 데이터를 불러오지 못했습니다 (마지막 스냅샷 없음).";
}

/* ---------- API 노선도 ---------- */
function renderApiSpec(spec) {
  const meta = $("[data-route-meta]");
  const total = (spec.terminals || []).reduce(
    (n, t) => n + (t.endpoints?.length || 0),
    0
  );
  if (meta)
    meta.textContent = `BASE ${spec.baseUrl || "/api"} · AUTH ${
      spec.auth || "-"
    } · ${total} GATES`;

  const wrap = $("[data-terminals]");
  if (!wrap) return;
  wrap.innerHTML = (spec.terminals || [])
    .map(
      (t) => `
    <div class="terminal">
      <div class="terminal__head">
        <span class="terminal__code">${escapeHtml(t.code)}</span>
        <span class="terminal__name">${escapeHtml(t.domain)}</span>
      </div>
      <p class="terminal__desc">${escapeHtml(t.desc || "")}</p>
      <div class="gates">
        ${(t.endpoints || [])
          .map((e, i) => gateHtml(t.code, e, i))
          .join("")}
      </div>
    </div>`
    )
    .join("");

  // 펼침 토글 (접근성: aria-expanded)
  $$(".gate__btn", wrap).forEach((btn) => {
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      const detail = btn.parentElement.querySelector(".gate__detail");
      detail?.classList.toggle("is-open", !open);
    });
  });
}

function gateHtml(code, e, i) {
  const id = `gate-${code}-${i}`;
  const method = escapeHtml(e.method);
  return `
    <div class="gate">
      <button class="gate__btn" aria-expanded="false" aria-controls="${id}">
        <span class="method method--${method}">${method}</span>
        <span class="gate__path">${escapeHtml(e.path)}</span>
        <span class="gate__auth">${escapeHtml(e.auth || "-")}</span>
        <span class="gate__chev" aria-hidden="true">▶</span>
      </button>
      <dl class="gate__detail" id="${id}">
        <dt>설명</dt><dd>${escapeHtml(e.desc || "")}</dd>
        <dt>인증</dt><dd>${escapeHtml(e.auth || "-")}</dd>
        <dt>기능 ID</dt><dd class="mono">${escapeHtml(e.featureId || "-")}</dd>
      </dl>
    </div>`;
}

/* ---------- 일정 ---------- */
function renderSchedule(sch) {
  const el = $("[data-timeline]");
  if (!el) return;
  const today = new Date().toISOString().slice(0, 10);
  el.innerHTML = (sch.legs || [])
    .map((leg, i, arr) => {
      const next = arr[i + 1]?.date;
      const isToday = leg.date <= today && (!next || today < next);
      const cls = [
        "leg",
        leg.done ? "leg--done" : "",
        isToday ? "leg--today" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const status = leg.done ? "완료" : isToday ? "진행 중" : "예정";
      return `
      <li class="${cls}">
        <span class="leg__date">${escapeHtml(leg.range || leg.date)}</span>
        <span class="leg__label">${escapeHtml(leg.label)}<span class="leg__status">${status}</span></span>
      </li>`;
    })
    .join("");
}

/* ---------- reveal ---------- */
function setupReveal() {
  const els = $$(".reveal");
  if (!("IntersectionObserver" in window)) {
    els.forEach((e) => e.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("is-in");
          io.unobserve(en.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  els.forEach((e) => io.observe(e));
}

/* ---------- 부팅 ---------- */
async function boot() {
  setupReveal();

  // 병렬 로드, 각 섹션은 독립적으로 실패 허용
  const [team, spec, sch] = await Promise.allSettled([
    loadJSON("data/team.json"),
    loadJSON("data/api-spec.json"),
    loadJSON("data/schedule.json"),
  ]);
  if (team.status === "fulfilled") renderTeam(team.value);
  if (spec.status === "fulfilled") renderApiSpec(spec.value);
  if (sch.status === "fulfilled") renderSchedule(sch.value);

  try {
    const progress = await loadJSON("data/progress.json");
    renderProgress(progress);
  } catch (err) {
    console.warn("progress.json 로드 실패:", err.message);
    renderProgressError();
  }
}

boot();
