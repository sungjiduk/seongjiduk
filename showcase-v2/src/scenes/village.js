// 성지 마을 — 프로시저럴 로우폴리 석양 마을(외부 에셋 없음).
// 도로 리본(커브 좌우 오프셋 스트립) + 지면 + 인스턴스드 건물/창문/나무 + 토리이 + 정거장 표지판.
// 아키하바라풍 디테일: 간판(캔버스 텍스처)·옥상 구조물·차양·가로등·전신주+전선·자판기·성지 핀.
// 조명은 main.js(키/림/헤미)가 관리 — 여기서는 창문/간판/가로등 자체 발광만 쓴다.
// ACT3가 켤 때까지 group.visible = false.

import * as THREE from "three";
import { createRoad } from "../core/path.js";

/** 석양 팔레트 — 노면/지면/건물(sebastien-lempens 마을 무드) */
const PALETTE = {
  road: "#d98a74",
  roadDash: "#f6e3cf",
  groundA: "#e8b89a",
  groundB: "#d9a184",
  buildings: ["#e2957f", "#c96f5c", "#e8b89a", "#f2d0b3", "#b95e4e"],
  windowLit: "#ffd08a",
  windowDark: "#5a3a33",
  trunk: "#8a5a48",
  leafGreenA: "#7fa15f",
  leafGreenB: "#5c7f4e",
  leafPink: "#f2a9bd",
  torii: "#c33f2e",
  toriiBase: "#2a211e",
  signBoard: "#f6e3cf",
  lampPole: "#4a3f3a",
  lampGlow: "#ffd9a0",
  wire: "#3a2c28",
  duckYellow: "#f5a80c",
  awnings: ["#c33f2e", "#f6e3cf", "#2e4a66"],
  vending: ["#c62f2f", "#2e5f9e", "#f6e3cf"],
};

/** 간판 텍스트 — 아키하바라풍 세로 간판(캔버스 텍스처, 자체 발광) */
const SIGN_DEFS = [
  { text: "성지덕", bg: "#b3402e", fg: "#ffe9c9" },
  { text: "카페", bg: "#284a63", fg: "#ffd08a" },
  { text: "라멘", bg: "#8a2f3c", fg: "#ffe9c9" },
  { text: "온천", bg: "#3c6e5a", fg: "#f6e3cf" },
  { text: "덕질", bg: "#f5a80c", fg: "#10203b" },
];

const ROAD_WIDTH = 3.2;
const HALF_W = ROAD_WIDTH / 2;

/** 완만한 S자 도로(y=0 평면, 총 길이 ~80유닛) */
const ROAD_POINTS = [
  [0, 0, 40],
  [-6, 0, 24],
  [6, 0, 6],
  [-5, 0, -12],
  [3, 0, -27],
  [0, 0, -40],
];

/** ACT3 로컬 진행도 기준 정거장 */
const STATIONS = [
  { name: "PLAN", p: 0.15 },
  { name: "PROGRESS", p: 0.4 },
  { name: "API", p: 0.65 },
  { name: "TS", p: 0.85 },
];

/** 결정적 의사난수(시드 고정 → 마을 배치 재현 가능, clouds.js와 동일 패턴) */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 탄젠트의 xz 평면 좌측 법선(도로 좌우 오프셋 방향) */
function sideNormal([tx, , tz]) {
  const len = Math.hypot(tx, tz) || 1;
  return [tz / len, 0, -tx / len];
}

/** 커브를 따라 좌우 오프셋 정점 스트립 리본 지오메트리 생성 */
function makeRibbonGeometry(road, segments = 140, halfW = HALF_W, y = 0.02) {
  const pos = new Float32Array((segments + 1) * 2 * 3);
  const index = [];
  for (let i = 0; i <= segments; i++) {
    const { pos: p, tangent } = road.at(i / segments);
    const [nx, , nz] = sideNormal(tangent);
    const o = i * 6;
    pos[o] = p[0] + nx * halfW;
    pos[o + 1] = y;
    pos[o + 2] = p[2] + nz * halfW;
    pos[o + 3] = p[0] - nx * halfW;
    pos[o + 4] = y;
    pos[o + 5] = p[2] - nz * halfW;
    if (i < segments) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** 도로 근접 판정용 샘플 캐시 — 배치 후보가 노면을 침범하지 않게 거리 검사 */
function makeRoadSampler(road, n = 220) {
  const samples = [];
  for (let i = 0; i <= n; i++) samples.push(road.at(i / n).pos);
  return (x, z) => {
    let min = Infinity;
    for (const [sx, , sz] of samples) {
      const d = Math.hypot(sx - x, sz - z);
      if (d < min) min = d;
    }
    return min;
  };
}

/**
 * 세로 간판 캔버스 텍스처 — 글자를 위→아래로 쌓는다.
 * document가 없으면(node 스모크) null → 호출부가 단색 플레이스홀더 처리.
 */
function makeSignTexture(def) {
  if (typeof document === "undefined") return null;
  try {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 160;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = def.bg;
    ctx.fillRect(0, 0, 64, 160);
    ctx.strokeStyle = def.fg;
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 56, 152);
    ctx.fillStyle = def.fg;
    ctx.font = "700 38px Pretendard, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const chars = [...def.text];
    const step = 148 / chars.length;
    chars.forEach((ch, i) => ctx.fillText(ch, 32, 8 + step * (i + 0.5), 50));
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  } catch {
    return null;
  }
}

/**
 * 성지 마을을 씬에 설치한다(초기 visible=false, ACT3가 켠다).
 * @param {THREE.Scene} scene
 * @returns {{
 *   group: THREE.Group,
 *   roadPoints: number[][],
 *   stations: { name: 'PLAN'|'PROGRESS'|'API'|'TS', p: number }[]
 * }}
 *   group.userData.stationAnchors = { PLAN: Object3D, ... } — 도로 옆 2.5유닛, 카드 도킹용
 */
export function buildVillage(scene) {
  const rand = mulberry32(20260706);
  const group = new THREE.Group();
  group.name = "village";
  group.visible = false;

  const road = createRoad(ROAD_POINTS);
  const distToRoad = makeRoadSampler(road);

  // 공용 스크래치(행렬 조립)
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const V = new THREE.Vector3();
  const S = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const E = new THREE.Euler();

  // ── 지면: 로우폴리 요철 평면(석양 그라디언트 버텍스 컬러) ──
  const groundGeo = new THREE.PlaneGeometry(160, 160, 48, 48);
  groundGeo.rotateX(-Math.PI / 2);
  {
    const posAttr = groundGeo.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);
    const ca = new THREE.Color(PALETTE.groundA);
    const cb = new THREE.Color(PALETTE.groundB);
    const c = new THREE.Color();
    for (let i = 0; i < posAttr.count; i++) {
      // 요철은 아래쪽(-0.25..0)으로만 — 노면(y=0.02) 위로 튀어나오지 않게
      posAttr.setY(i, -0.03 - rand() * 0.22);
      c.copy(ca).lerp(cb, rand());
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    groundGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    groundGeo.computeVertexNormals();
  }
  const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })
  );
  ground.name = "ground";
  group.add(ground);

  // ── 도로 리본 + 중앙 점선 ──
  const roadMesh = new THREE.Mesh(
    makeRibbonGeometry(road),
    new THREE.MeshStandardMaterial({ color: PALETTE.road, roughness: 0.95 })
  );
  roadMesh.name = "road";
  group.add(roadMesh);

  const dashCount = 34;
  const dashes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.16, 0.02, 1.0),
    new THREE.MeshStandardMaterial({ color: PALETTE.roadDash, roughness: 0.9 }),
    dashCount
  );
  for (let i = 0; i < dashCount; i++) {
    const { pos: p, tangent } = road.at((i + 0.5) / dashCount);
    // 점선은 yaw만 반영(노면에 눕힘)
    const yaw = Math.atan2(tangent[0], tangent[2]);
    Q.setFromAxisAngle(UP, yaw);
    M.compose(V.set(p[0], 0.04, p[2]), Q, S.set(1, 1, 1));
    dashes.setMatrixAt(i, M);
  }
  dashes.name = "road-dashes";
  group.add(dashes);

  // ── 건물: 인스턴스드 박스(도로에서 4~10유닛, 침범 금지) + 자체 발광 창문 ──
  // 높이·폭 변주 확대(1.4~5.8 / 1.5~4.1) — 아키하바라풍 들쭉날쭉 스카이라인
  const BUILDING_COUNT = 42;
  const buildings = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }),
    BUILDING_COUNT
  );
  const windowSpecs = []; // { pos, yaw, lit }
  const buildingSpecs = []; // { x, z, yaw, w, d, h, fx, fz } — 부속물(간판/차양/옥상) 배치용
  {
    const color = new THREE.Color();
    let placed = 0;
    let guard = 0;
    while (placed < BUILDING_COUNT && guard++ < 800) {
      const p = 0.03 + rand() * 0.88; // 토리이(p≈0.95) 앞까지만
      const { pos: rp, tangent } = road.at(p);
      const [nx, , nz] = sideNormal(tangent);
      const side = rand() < 0.5 ? 1 : -1;
      const dist = 4 + rand() * 6; // 도로에서 4~10유닛 이격
      const w = 1.5 + rand() * 2.6;
      const d = 1.5 + rand() * 2.2;
      const h = 1.4 + rand() * 4.4;
      const x = rp[0] + nx * side * dist;
      const z = rp[2] + nz * side * dist;
      // S자 반대편 노면 침범 검사(건물 반폭 + 노면 반폭 + 여유)
      if (distToRoad(x, z) < HALF_W + Math.max(w, d) * 0.5 + 0.6) continue;
      const yaw = Math.atan2(rp[0] - x, rp[2] - z); // 도로를 향해 정면
      Q.setFromAxisAngle(UP, yaw);
      M.compose(V.set(x, h / 2, z), Q, S.set(w, h, d));
      buildings.setMatrixAt(placed, M);
      color.set(PALETTE.buildings[Math.floor(rand() * PALETTE.buildings.length)]);
      buildings.setColorAt(placed, color);

      const fx = Math.sin(yaw); // 정면(도로 쪽) 방향
      const fz = Math.cos(yaw);
      buildingSpecs.push({ x, z, yaw, w, d, h, fx, fz });

      // 창문: 도로 쪽 정면에 그리드 배치
      const cols = Math.min(3, Math.max(1, Math.floor(w / 0.9)));
      const rows = Math.min(4, Math.max(1, Math.floor(h / 1.1)));
      for (let r = 0; r < rows; r++) {
        for (let cIdx = 0; cIdx < cols; cIdx++) {
          const lx = (cIdx - (cols - 1) / 2) * 0.8;
          const ly = h * 0.28 + r * 1.0;
          if (ly > h - 0.5) continue;
          windowSpecs.push({
            pos: [
              x + fx * (d / 2 + 0.03) + fz * lx,
              ly,
              z + fz * (d / 2 + 0.03) - fx * lx,
            ],
            yaw,
            lit: rand() < 0.7,
          });
        }
      }
      placed++;
    }
    buildings.count = placed;
    buildings.instanceMatrix.needsUpdate = true;
    if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
  }
  buildings.name = "buildings";
  group.add(buildings);

  /** 건물 로컬(lx: 정면 가로, lz: 정면 바깥) → 월드 xz (창문 배치와 동일 규약) */
  const bLocal = (b, lx, lz) => [b.x + b.fz * lx + b.fx * lz, b.z - b.fx * lx + b.fz * lz];

  // 창문: MeshBasicMaterial = 조명 무관 자체 발광(석양 창불), 어두운 창은 인스턴스 컬러
  const windows = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.3, 0.38, 0.06),
    new THREE.MeshBasicMaterial(),
    Math.max(1, windowSpecs.length)
  );
  {
    const lit = new THREE.Color(PALETTE.windowLit);
    const dark = new THREE.Color(PALETTE.windowDark);
    windowSpecs.forEach((wSpec, i) => {
      Q.setFromAxisAngle(UP, wSpec.yaw);
      M.compose(V.set(...wSpec.pos), Q, S.set(1, 1, 1));
      windows.setMatrixAt(i, M);
      windows.setColorAt(i, wSpec.lit ? lit : dark);
    });
    windows.count = windowSpecs.length;
    windows.instanceMatrix.needsUpdate = true;
    if (windows.instanceColor) windows.instanceColor.needsUpdate = true;
  }
  windows.name = "windows";
  group.add(windows);

  // ── 옥상 구조물: 물탱크/실외기 느낌의 작은 박스(인스턴스드) ──
  {
    const roofSpecs = [];
    for (const b of buildingSpecs) {
      if (rand() > 0.5) continue;
      const n = rand() < 0.3 ? 2 : 1;
      for (let k = 0; k < n && roofSpecs.length < 40; k++) {
        const sw = 0.3 + rand() * 0.55;
        const sh = 0.3 + rand() * 0.65;
        const sd = 0.3 + rand() * 0.5;
        const lx = (rand() - 0.5) * Math.max(0, b.w - sw - 0.3);
        const lz = (rand() - 0.5) * Math.max(0, b.d - sd - 0.3);
        const [x, z] = bLocal(b, lx, lz);
        roofSpecs.push({ x, z, y: b.h + sh / 2, yaw: b.yaw, sw, sh, sd });
      }
    }
    if (roofSpecs.length) {
      const roofUnits = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }),
        roofSpecs.length
      );
      const cA = new THREE.Color("#a9765f");
      const cB = new THREE.Color("#e8d3bd");
      const c = new THREE.Color();
      roofSpecs.forEach((r, i) => {
        Q.setFromAxisAngle(UP, r.yaw);
        M.compose(V.set(r.x, r.y, r.z), Q, S.set(r.sw, r.sh, r.sd));
        roofUnits.setMatrixAt(i, M);
        roofUnits.setColorAt(i, c.copy(cA).lerp(cB, rand()));
      });
      roofUnits.name = "roof-units";
      group.add(roofUnits);
    }
  }

  // ── 차양: 정면 1층 위 얇은 박스(살짝 아래로 기울임) ──
  {
    const awningSpecs = [];
    for (const b of buildingSpecs) {
      if (b.h < 1.8 || rand() > 0.4) continue;
      const y = 0.95 + rand() * 0.25;
      const [x, z] = bLocal(b, 0, b.d / 2 + 0.24);
      awningSpecs.push({ x, z, y, yaw: b.yaw, w: b.w * 0.72, ci: Math.floor(rand() * PALETTE.awnings.length) });
    }
    if (awningSpecs.length) {
      const awnings = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 0.06, 0.5),
        new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }),
        awningSpecs.length
      );
      const c = new THREE.Color();
      awningSpecs.forEach((a, i) => {
        Q.setFromEuler(E.set(0.28, a.yaw, 0, "YXZ")); // 바깥쪽으로 살짝 처짐
        M.compose(V.set(a.x, a.y, a.z), Q, S.set(a.w, 1, 1));
        awnings.setMatrixAt(i, M);
        awnings.setColorAt(i, c.set(PALETTE.awnings[a.ci]));
      });
      awnings.name = "awnings";
      group.add(awnings);
    }
  }

  // ── 간판: 세로 간판(캔버스 텍스처, 자체 발광) — 텍스처별 인스턴스드 ──
  {
    const buckets = SIGN_DEFS.map(() => []);
    for (const b of buildingSpecs) {
      if (b.h < 2.0 || rand() > 0.45) continue;
      const defIdx = Math.floor(rand() * SIGN_DEFS.length);
      const lx = (rand() < 0.5 ? -1 : 1) * Math.max(0.1, b.w / 2 - 0.42);
      const y = Math.min(b.h - 0.85, 1.3 + rand() * 1.1);
      if (y < 0.9) continue;
      const [x, z] = bLocal(b, lx, b.d / 2 + 0.1);
      buckets[defIdx].push({ x, z, y, yaw: b.yaw, s: 0.85 + rand() * 0.3 });
    }
    SIGN_DEFS.forEach((def, di) => {
      const specs = buckets[di];
      if (!specs.length) return;
      const tex = makeSignTexture(def);
      const mat = tex
        ? new THREE.MeshBasicMaterial({ map: tex })
        : new THREE.MeshBasicMaterial({ color: def.bg }); // node 스모크 플레이스홀더
      const signs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 1.35, 0.1), mat, specs.length);
      specs.forEach((sp, i) => {
        Q.setFromAxisAngle(UP, sp.yaw);
        M.compose(V.set(sp.x, sp.y, sp.z), Q, S.set(sp.s, sp.s, 1));
        signs.setMatrixAt(i, M);
      });
      signs.name = `sign-boards-${di}`;
      group.add(signs);
    });
  }

  // ── 가로수: 콘 2~3단 겹침 + 색 변주(녹색 2종 + 벚꽃 핑크) ──
  const TREE_COUNT = 22;
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.12, 0.16, 0.9, 6),
    new THREE.MeshStandardMaterial({ color: PALETTE.trunk, roughness: 1, flatShading: true }),
    TREE_COUNT
  );
  const leafTierGeos = [
    new THREE.ConeGeometry(0.8, 1.3, 7),
    new THREE.ConeGeometry(0.6, 1.1, 7),
    new THREE.ConeGeometry(0.42, 0.95, 7),
  ];
  const leafTierY = [1.45, 2.05, 2.6];
  const leafMat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true });
  const leafTiers = leafTierGeos.map((g, i) => {
    const im = new THREE.InstancedMesh(g, leafMat, TREE_COUNT);
    im.name = `tree-leaves-${i + 1}`;
    return im;
  });
  {
    const greenA = new THREE.Color(PALETTE.leafGreenA);
    const greenB = new THREE.Color(PALETTE.leafGreenB);
    const pink = new THREE.Color(PALETTE.leafPink);
    const tint = new THREE.Color("#ffe9c9");
    const base = new THREE.Color();
    const c = new THREE.Color();
    let placed = 0;
    let guard = 0;
    while (placed < TREE_COUNT && guard++ < 400) {
      const p = 0.02 + rand() * 0.9;
      // 정거장 표지판 주변은 비워둔다
      if (STATIONS.some((s) => Math.abs(s.p - p) < 0.035)) continue;
      const { pos: rp, tangent } = road.at(p);
      const [nx, , nz] = sideNormal(tangent);
      const side = rand() < 0.5 ? 1 : -1;
      const dist = 2.4 + rand() * 1.4; // 도로변 2.4~3.8유닛
      const x = rp[0] + nx * side * dist;
      const z = rp[2] + nz * side * dist;
      const s = 0.8 + rand() * 0.7;
      // 수관(최대 콘 반경 0.8*s)까지 노면 밖으로 — 침범 금지
      if (distToRoad(x, z) < HALF_W + 0.8 * s + 0.15) continue;
      Q.identity();
      M.compose(V.set(x, 0.45 * s, z), Q, S.set(s, s, s));
      trunks.setMatrixAt(placed, M);
      // 벚꽃 25%, 나머지는 녹색 2종 사이 변주
      if (rand() < 0.25) base.copy(pink).lerp(tint, rand() * 0.25);
      else base.copy(greenA).lerp(greenB, rand());
      const tiers = rand() < 0.4 ? 2 : 3; // 콘 2~3단
      for (let t = 0; t < leafTiers.length; t++) {
        // 2단 나무는 최상단 콘을 아래 단에 숨긴다(스케일 0으로 두지 않고 겹침 처리)
        const yT = t < tiers ? leafTierY[t] : leafTierY[tiers - 1] - 0.2;
        const sT = t < tiers ? s : s * 0.55;
        M.compose(V.set(x, yT * s, z), Q, S.set(sT, sT, sT));
        leafTiers[t].setMatrixAt(placed, M);
        // 위 단으로 갈수록 살짝 밝게 — 로우폴리 층 분리감
        leafTiers[t].setColorAt(placed, c.copy(base).lerp(tint, t * 0.12));
      }
      placed++;
    }
    trunks.count = placed;
    trunks.instanceMatrix.needsUpdate = true;
    for (const im of leafTiers) {
      im.count = placed;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }
  trunks.name = "tree-trunks";
  group.add(trunks, ...leafTiers);

  // ── 가로등: 기둥 + 자체 발광 구, 도로변 좌우 교대(반폭 1.6 침범 금지) ──
  {
    const lampSpecs = [];
    const N = 14;
    for (let i = 0; i < N; i++) {
      const p = 0.05 + (i / (N - 1)) * 0.84 + (rand() - 0.5) * 0.02;
      if (STATIONS.some((s) => Math.abs(s.p - p) < 0.03)) continue;
      const { pos: rp, tangent } = road.at(Math.min(0.92, Math.max(0.02, p)));
      const [nx, , nz] = sideNormal(tangent);
      const side = i % 2 === 0 ? 1 : -1;
      const x = rp[0] + nx * side * 2.05;
      const z = rp[2] + nz * side * 2.05;
      if (distToRoad(x, z) < HALF_W + 0.25) continue;
      lampSpecs.push({ x, z });
    }
    if (lampSpecs.length) {
      const poles = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.05, 0.07, 2.5, 6),
        new THREE.MeshStandardMaterial({ color: PALETTE.lampPole, roughness: 0.9, flatShading: true }),
        lampSpecs.length
      );
      const bulbs = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.15, 8, 6),
        new THREE.MeshBasicMaterial({ color: PALETTE.lampGlow }),
        lampSpecs.length
      );
      Q.identity();
      S.set(1, 1, 1);
      lampSpecs.forEach((l, i) => {
        M.compose(V.set(l.x, 1.25, l.z), Q, S);
        poles.setMatrixAt(i, M);
        M.compose(V.set(l.x, 2.55, l.z), Q, S);
        bulbs.setMatrixAt(i, M);
      });
      poles.name = "street-lamps";
      bulbs.name = "lamp-bulbs";
      group.add(poles, bulbs);
    }
  }

  // ── 전신주 + 처진 전선: 도로 한쪽(+측)을 따라 연속 배치, 스팬마다 전선 3가닥 ──
  {
    const polePs = [0.04, 0.18, 0.3, 0.44, 0.57, 0.7, 0.82, 0.9];
    const poleTops = []; // { top: V3, left: V3, right: V3 }
    const poleSpecs = [];
    for (const p of polePs) {
      const { pos: rp, tangent } = road.at(p);
      const [nx, , nz] = sideNormal(tangent);
      let x = rp[0] + nx * 2.75;
      let z = rp[2] + nz * 2.75;
      if (distToRoad(x, z) < HALF_W + 0.3) {
        x = rp[0] + nx * 3.4;
        z = rp[2] + nz * 3.4;
        if (distToRoad(x, z) < HALF_W + 0.3) continue;
      }
      const yaw = Math.atan2(tangent[0], tangent[2]); // 가로대가 진행 방향과 직교(=법선 방향)
      poleSpecs.push({ x, z, yaw });
      const ax = Math.cos(yaw) * 0.45; // 가로대 끝 오프셋(법선 방향)
      const az = -Math.sin(yaw) * 0.45;
      poleTops.push({
        top: new THREE.Vector3(x, 4.5, z),
        left: new THREE.Vector3(x - ax, 4.32, z - az),
        right: new THREE.Vector3(x + ax, 4.32, z + az),
      });
    }
    if (poleSpecs.length) {
      const poles = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.08, 0.11, 4.5, 6),
        new THREE.MeshStandardMaterial({ color: PALETTE.wire, roughness: 1, flatShading: true }),
        poleSpecs.length
      );
      const arms = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1.05, 0.08, 0.08),
        new THREE.MeshStandardMaterial({ color: PALETTE.wire, roughness: 1, flatShading: true }),
        poleSpecs.length
      );
      poleSpecs.forEach((ps, i) => {
        Q.identity();
        M.compose(V.set(ps.x, 2.25, ps.z), Q, S.set(1, 1, 1));
        poles.setMatrixAt(i, M);
        Q.setFromAxisAngle(UP, ps.yaw);
        M.compose(V.set(ps.x, 4.32, ps.z), Q, S.set(1, 1, 1));
        arms.setMatrixAt(i, M);
      });
      poles.name = "utility-poles";
      arms.name = "utility-crossarms";
      group.add(poles, arms);

      // 전선: 스팬마다 3가닥(좌/중앙/우), 2차 베지에 새그 → LineSegments 1드로우콜
      const wirePts = [];
      const a3 = new THREE.Vector3();
      const b3 = new THREE.Vector3();
      const mid = new THREE.Vector3();
      const prev = new THREE.Vector3();
      const cur = new THREE.Vector3();
      const SEG = 8;
      for (let i = 0; i < poleTops.length - 1; i++) {
        for (const key of ["left", "top", "right"]) {
          a3.copy(key === "top" ? poleTops[i].top : poleTops[i][key]);
          b3.copy(key === "top" ? poleTops[i + 1].top : poleTops[i + 1][key]);
          mid.lerpVectors(a3, b3, 0.5);
          mid.y -= 0.3 + rand() * 0.15; // 처짐
          for (let sIdx = 0; sIdx <= SEG; sIdx++) {
            const t = sIdx / SEG;
            // 2차 베지에: (1-t)^2 a + 2t(1-t) mid + t^2 b
            cur
              .copy(a3)
              .multiplyScalar((1 - t) * (1 - t))
              .addScaledVector(mid, 2 * t * (1 - t))
              .addScaledVector(b3, t * t);
            if (sIdx > 0) wirePts.push(prev.x, prev.y, prev.z, cur.x, cur.y, cur.z);
            prev.copy(cur);
          }
        }
      }
      const wireGeo = new THREE.BufferGeometry();
      wireGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(wirePts), 3));
      const wires = new THREE.LineSegments(
        wireGeo,
        new THREE.LineBasicMaterial({ color: PALETTE.wire })
      );
      wires.name = "power-lines";
      group.add(wires);
    }
  }

  // ── 자판기: 도로변 작은 발광 박스(본체 + 자체 발광 전면 패널) ──
  {
    const vendSpecs = [];
    let guard = 0;
    while (vendSpecs.length < 8 && guard++ < 120) {
      const p = 0.05 + rand() * 0.85;
      if (STATIONS.some((s) => Math.abs(s.p - p) < 0.03)) continue;
      const { pos: rp, tangent } = road.at(p);
      const [nx, , nz] = sideNormal(tangent);
      const side = rand() < 0.5 ? 1 : -1;
      const dist = 2.0 + rand() * 0.4;
      const x = rp[0] + nx * side * dist;
      const z = rp[2] + nz * side * dist;
      if (distToRoad(x, z) < HALF_W + 0.35) continue;
      const yaw = Math.atan2(rp[0] - x, rp[2] - z); // 도로를 향해
      vendSpecs.push({ x, z, yaw, ci: Math.floor(rand() * PALETTE.vending.length) });
    }
    if (vendSpecs.length) {
      const bodies = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.55, 1.05, 0.5),
        new THREE.MeshStandardMaterial({ roughness: 0.6, flatShading: true }),
        vendSpecs.length
      );
      const panels = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.4, 0.62, 0.04),
        new THREE.MeshBasicMaterial({ color: "#fff2d6" }), // 자체 발광 전면
        vendSpecs.length
      );
      const c = new THREE.Color();
      vendSpecs.forEach((vd, i) => {
        Q.setFromAxisAngle(UP, vd.yaw);
        M.compose(V.set(vd.x, 0.525, vd.z), Q, S.set(1, 1, 1));
        bodies.setMatrixAt(i, M);
        bodies.setColorAt(i, c.set(PALETTE.vending[vd.ci]));
        const fx = Math.sin(vd.yaw);
        const fz = Math.cos(vd.yaw);
        M.compose(V.set(vd.x + fx * 0.27, 0.62, vd.z + fz * 0.27), Q, S.set(1, 1, 1));
        panels.setMatrixAt(i, M);
      });
      bodies.name = "vending-bodies";
      panels.name = "vending-panels";
      group.add(bodies, panels);
    }
  }

  // ── 토리이 게이트: 도로 끝(p≈0.95) — 가로보 2단 + 끝단 들림 + 검은 받침 ──
  {
    const torii = new THREE.Group();
    torii.name = "torii";
    const mat = new THREE.MeshStandardMaterial({
      color: PALETTE.torii,
      roughness: 0.7,
      flatShading: true,
    });
    const baseMat = new THREE.MeshStandardMaterial({
      color: PALETTE.toriiBase,
      roughness: 0.9,
      flatShading: true,
    });
    const pillarGeo = new THREE.CylinderGeometry(0.24, 0.3, 5.4, 8);
    const baseGeo = new THREE.CylinderGeometry(0.4, 0.46, 0.5, 8);
    for (const s of [-1, 1]) {
      const pillar = new THREE.Mesh(pillarGeo, mat);
      pillar.position.set(s * (HALF_W + 1.0), 2.7, 0);
      torii.add(pillar);
      // 기둥 하단 검은 받침(카메바시라)
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.set(s * (HALF_W + 1.0), 0.25, 0);
      torii.add(base);
    }
    // 최상단 카사기 + 바로 아래 시마키(가로보 2단)
    const kasagiLen = ROAD_WIDTH + 4.2;
    const kasagi = new THREE.Mesh(new THREE.BoxGeometry(kasagiLen, 0.45, 0.6), mat);
    kasagi.position.y = 5.7;
    torii.add(kasagi);
    const shimaki = new THREE.Mesh(new THREE.BoxGeometry(kasagiLen - 0.7, 0.28, 0.52), mat);
    shimaki.position.y = 5.34;
    torii.add(shimaki);
    // 카사기 끝단 들림 — 기울인 박스로 곡률 느낌
    for (const s of [-1, 1]) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.42, 0.58), mat);
      tip.position.set(s * (kasagiLen / 2 - 0.25), 5.82, 0);
      tip.rotation.z = -s * 0.14;
      torii.add(tip);
    }
    const nuki = new THREE.Mesh(new THREE.BoxGeometry(ROAD_WIDTH + 2.6, 0.32, 0.42), mat);
    nuki.position.y = 4.4;
    torii.add(nuki);
    // 가쿠즈카 — 누키와 시마키 사이 중앙 편액
    const gakuzuka = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.65, 0.3),
      new THREE.MeshStandardMaterial({ color: PALETTE.signBoard, roughness: 0.85, flatShading: true })
    );
    gakuzuka.position.y = 4.88;
    torii.add(gakuzuka);

    const { pos: tp, tangent } = road.at(0.95);
    torii.position.set(tp[0], 0, tp[2]);
    torii.rotation.y = Math.atan2(tangent[0], tangent[2]); // 도로 진행 방향과 직교
    group.add(torii);
  }

  // ── 정거장 표지판(기둥+판) + 카드 도킹 앵커(도로 옆 2.5유닛) ──
  const stationAnchors = {};
  const pinSpecs = []; // 성지 핀(표지판 근처 부유)
  {
    const poleMat = new THREE.MeshStandardMaterial({ color: PALETTE.trunk, roughness: 1 });
    const boardMat = new THREE.MeshStandardMaterial({ color: PALETTE.signBoard, roughness: 0.9 });
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.7, 6);
    const boardGeo = new THREE.BoxGeometry(1.15, 0.65, 0.08);
    STATIONS.forEach((st, i) => {
      const { pos: rp, tangent } = road.at(st.p);
      const [nx, , nz] = sideNormal(tangent);
      const side = i % 2 === 0 ? 1 : -1; // 좌우 번갈아 배치
      const x = rp[0] + nx * side * 2.5;
      const z = rp[2] + nz * side * 2.5;
      const yaw = Math.atan2(rp[0] - x, rp[2] - z); // 판이 도로를 향하게

      const sign = new THREE.Group();
      sign.name = `sign-${st.name}`;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 0.85;
      const board = new THREE.Mesh(boardGeo, boardMat);
      board.position.y = 1.65;
      sign.add(pole, board);
      sign.position.set(x, 0, z);
      sign.rotation.y = yaw;
      group.add(sign);

      // 앵커: ACT3 카드 도킹 기준점(표지판 위치, 카드 높이 y=1.6)
      const anchor = new THREE.Object3D();
      anchor.name = `anchor-${st.name}`;
      anchor.position.set(x, 1.6, z);
      group.add(anchor);
      stationAnchors[st.name] = anchor;

      // 성지 핀: 표지판 옆(진행 방향으로 0.9유닛) 부유 — 카드(y=1.6)와 겹치지 않게 위로
      const tl = Math.hypot(tangent[0], tangent[2]) || 1;
      pinSpecs.push({
        x: x + (tangent[0] / tl) * 0.9,
        z: z + (tangent[2] / tl) * 0.9,
        y: 2.7 + (i % 2) * 0.25,
      });
    });
  }
  group.userData.stationAnchors = stationAnchors;

  // ── 성지 핀: 덕 옐로우 부유 핀(구 + 아래로 향한 콘), 살짝 emissive ──
  {
    const pinMat = new THREE.MeshStandardMaterial({
      color: PALETTE.duckYellow,
      emissive: PALETTE.duckYellow,
      emissiveIntensity: 0.45,
      roughness: 0.5,
      flatShading: true,
    });
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 10, 8), pinMat, pinSpecs.length);
    const tipGeo = new THREE.ConeGeometry(0.15, 0.5, 8);
    tipGeo.rotateX(Math.PI); // 꼭짓점이 아래로
    const tips = new THREE.InstancedMesh(tipGeo, pinMat, pinSpecs.length);
    Q.identity();
    S.set(1, 1, 1);
    pinSpecs.forEach((pin, i) => {
      M.compose(V.set(pin.x, pin.y, pin.z), Q, S);
      heads.setMatrixAt(i, M);
      M.compose(V.set(pin.x, pin.y - 0.4, pin.z), Q, S);
      tips.setMatrixAt(i, M);
    });
    heads.name = "pin-heads";
    tips.name = "pin-tips";
    group.add(heads, tips);
  }

  scene.add(group);
  return { group, roadPoints: ROAD_POINTS, stations: STATIONS };
}
