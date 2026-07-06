// 성지 마을 — 프로시저럴 로우폴리 석양 마을(외부 에셋 없음).
// 도로 리본(커브 좌우 오프셋 스트립) + 지면 + 인스턴스드 마치야/창호/나무 + 토리이 + 정거장 표지판.
// 교토 골목풍 디테일: 목조 마치야(투톤+박공 기와지붕)·신사·노렌·초칭/홍등 스트링·석등·전신주+전선·간판(캔버스 텍스처).
// 조명은 main.js(키/림/헤미)가 관리 — 여기서는 창호지/간판/랜턴 자체 발광(emissive)만 쓴다.
// ACT3가 켤 때까지 group.visible = false.

import * as THREE from "three";
import { createRoad } from "../core/path.js";

/** 석양 팔레트 — 노면/지면 + 교토 목조(다크우드/회벽/차콜기와/버밀리언/랜턴 레드) */
const PALETTE = {
  road: "#d98a74",
  roadDash: "#f6e3cf",
  groundA: "#e8b89a",
  groundB: "#d9a184",
  woodA: "#5a4636",
  woodB: "#6b5442",
  plaster: "#f0e8d8",
  roofTile: "#3a3d45",
  roofTileB: "#2f323a",
  frameWood: "#2e241d",
  shoji: "#ffe9c4",
  noren: "#2b3a5c",
  shrineRed: "#c73e2e",
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
  vending: ["#c62f2f", "#2e5f9e", "#f6e3cf"],
  // 여행지 무드(원경·참배로) 팔레트
  fuji: "#7d8fb3",
  fujiSnow: "#f2efe9",
  hills: ["#93a3c0", "#a3b1c9", "#8a9ab8"],
  stone: "#a9a294",
  lanternRed: "#d93a2b",
  lanternGlow: "#ff6a3d",
  infoText: "#6b4a3a",
};

/** 간판 텍스트 — 세로 간판(캔버스 텍스처, 자체 발광) + 목조 프레임 */
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
 * 단위 박공지붕 프리즘(폭1·높이1·깊이1, 용마루는 x축 방향 = 정면과 평행).
 * 인스턴스 스케일 (벽폭+처마, 지붕높이, 벽깊이+처마)로 마치야/신사 지붕에 공용.
 * 논-인덱스드 + computeVertexNormals → 플랫 셰이딩 경사면.
 */
function makeGableGeometry() {
  const tris = [
    // +z 경사면
    [-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 1, 0],
    [-0.5, 0, 0.5], [0.5, 1, 0], [-0.5, 1, 0],
    // -z 경사면
    [0.5, 0, -0.5], [-0.5, 0, -0.5], [-0.5, 1, 0],
    [0.5, 0, -0.5], [-0.5, 1, 0], [0.5, 1, 0],
    // 박공면(x+ / x-)
    [0.5, 0, 0.5], [0.5, 0, -0.5], [0.5, 1, 0],
    [-0.5, 0, -0.5], [-0.5, 0, 0.5], [-0.5, 1, 0],
    // 바닥(처마 밑면, 아래 방향)
    [-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5],
    [-0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5],
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(tris.flat()), 3));
  geo.computeVertexNormals();
  return geo;
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
 * 가로형 관광 안내판 캔버스 텍스처 — makeSignTexture와 동일한 방어 규약.
 * document가 없으면(node 스모크) null → 호출부가 단색 플레이스홀더 처리.
 */
function makeInfoTexture(text) {
  if (typeof document === "undefined") return null;
  try {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 88;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = PALETTE.signBoard;
    ctx.fillRect(0, 0, 256, 88);
    ctx.strokeStyle = PALETTE.infoText;
    ctx.lineWidth = 5;
    ctx.strokeRect(6, 6, 244, 76);
    ctx.fillStyle = PALETTE.infoText;
    ctx.font = "700 32px Pretendard, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 46, 232);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  } catch {
    return null;
  }
}

/** 격자 창호지(쇼지) 텍스처 — 따뜻한 발광 창 + 어두운 격자. document 없으면 null. */
function makeShojiTexture() {
  if (typeof document === "undefined") return null;
  try {
    const c = document.createElement("canvas");
    c.width = 48;
    c.height = 64;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = PALETTE.shoji;
    ctx.fillRect(0, 0, 48, 64);
    ctx.strokeStyle = "#4a382a";
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, 45, 61);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const x of [16, 32]) {
      ctx.moveTo(x, 2);
      ctx.lineTo(x, 62);
    }
    for (const y of [16, 32, 48]) {
      ctx.moveTo(2, y);
      ctx.lineTo(46, y);
    }
    ctx.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  } catch {
    return null;
  }
}

/** 벚꽃잎 스프라이트 텍스처 — 부드러운 원형 그라디언트. document 없으면 null. */
function makePetalTexture() {
  if (typeof document === "undefined") return null;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const g = ctx.createRadialGradient(16, 16, 2, 16, 16, 15);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.55, "rgba(255,214,228,0.8)");
    g.addColorStop(1, "rgba(255,214,228,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
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

  // 공용 지오메트리 — 마치야/신사 박공지붕
  const gableGeo = makeGableGeometry();

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

  // ── 신사 자리 선점: 도로변 명당(정거장 회피) — 마치야/나무가 이 반경을 비켜 배치 ──
  const SHRINE_DEFS = [
    { p: 0.25, side: -1, dist: 6.2, w: 3.4, d: 2.8, ph: 2.1, wide: false },
    { p: 0.5, side: 1, dist: 6.4, w: 3.2, d: 2.6, ph: 2.0, wide: false },
    { p: 0.76, side: 1, dist: 6.8, w: 6.2, d: 3.2, ph: 2.3, wide: true }, // 배전(신사 입구 안내판 뒤)
  ];
  const shrineSpots = []; // { x, z, r, def }
  for (const def of SHRINE_DEFS) {
    const { pos: rp, tangent } = road.at(def.p);
    const [nx, , nz] = sideNormal(tangent);
    let dist = def.dist;
    let x = rp[0] + nx * def.side * dist;
    let z = rp[2] + nz * def.side * dist;
    // 처마(+1.7/2)까지 노면 밖으로 — 침범 시 한 번 더 바깥으로
    if (distToRoad(x, z) < HALF_W + Math.max(def.w, def.d) / 2 + 1.3) {
      dist += 1.8;
      x = rp[0] + nx * def.side * dist;
      z = rp[2] + nz * def.side * dist;
      if (distToRoad(x, z) < HALF_W + Math.max(def.w, def.d) / 2 + 1.3) continue;
    }
    const yaw = Math.atan2(rp[0] - x, rp[2] - z); // 도로를 향해 정면
    shrineSpots.push({ x, z, yaw, r: Math.max(def.w, def.d) / 2 + 1.4, def });
  }
  const nearShrine = (x, z, halfSize) =>
    shrineSpots.some((sp) => Math.hypot(sp.x - x, sp.z - z) < sp.r + halfSize);

  // ── 마치야(町家): 다크우드+회벽 투톤 몸체 + 박공 기와지붕(처마 0.4 돌출) + 용마루 ──
  const BUILDING_COUNT = 34;
  const lowerWalls = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.92, flatShading: true }),
    BUILDING_COUNT
  );
  const upperWalls = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }),
    BUILDING_COUNT
  );
  const roofs = new THREE.InstancedMesh(
    gableGeo,
    new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }),
    BUILDING_COUNT
  );
  const ridges = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 0.09, 0.24),
    new THREE.MeshStandardMaterial({ color: PALETTE.roofTileB, roughness: 0.85, flatShading: true }),
    BUILDING_COUNT
  );
  const windowSpecs = []; // { pos, yaw, lit }
  const buildingSpecs = []; // { x, z, yaw, w, d, h, fx, fz } — 부속물(간판/노렌/초칭) 배치용
  {
    const color = new THREE.Color();
    const woodA = new THREE.Color(PALETTE.woodA);
    const woodB = new THREE.Color(PALETTE.woodB);
    const plaster = new THREE.Color(PALETTE.plaster);
    const tileA = new THREE.Color(PALETTE.roofTile);
    const tileB = new THREE.Color(PALETTE.roofTileB);
    let placed = 0;
    let guard = 0;
    while (placed < BUILDING_COUNT && guard++ < 900) {
      const p = 0.03 + rand() * 0.88; // 토리이(p≈0.95) 앞까지만
      // 정거장 카드 도킹 시야 확보
      if (STATIONS.some((s) => Math.abs(s.p - p) < 0.04)) continue;
      const { pos: rp, tangent } = road.at(p);
      const [nx, , nz] = sideNormal(tangent);
      const side = rand() < 0.5 ? 1 : -1;
      const dist = 3.8 + rand() * 5.0; // 도로에서 3.8~8.8유닛 — 골목 스케일
      const w = 1.8 + rand() * 1.6;
      const d = 1.6 + rand() * 1.0;
      const twoStory = rand() < 0.55;
      const h = twoStory ? 2.4 + rand() * 0.8 : 1.6 + rand() * 0.6; // 1~2층(1.6~3.2)
      const x = rp[0] + nx * side * dist;
      const z = rp[2] + nz * side * dist;
      // S자 반대편 노면 침범 검사(건물 반폭 + 처마 0.4 + 노면 반폭 + 여유)
      if (distToRoad(x, z) < HALF_W + Math.max(w, d) * 0.5 + 1.0) continue;
      if (nearShrine(x, z, Math.max(w, d) * 0.5 + 0.4)) continue;
      const yaw = Math.atan2(rp[0] - x, rp[2] - z); // 도로를 향해 정면
      Q.setFromAxisAngle(UP, yaw);
      // 1층부(다크우드)
      M.compose(V.set(x, h * 0.25, z), Q, S.set(w, h * 0.5, d));
      lowerWalls.setMatrixAt(placed, M);
      lowerWalls.setColorAt(placed, color.copy(rand() < 0.5 ? woodA : woodB));
      // 상부(백색 회벽 위주, 일부는 통목조)
      M.compose(V.set(x, h * 0.75, z), Q, S.set(w, h * 0.5, d));
      upperWalls.setMatrixAt(placed, M);
      upperWalls.setColorAt(placed, color.copy(rand() < 0.78 ? plaster : woodB));
      // 박공지붕: 처마가 벽보다 0.4 돌출, 용마루는 정면과 평행
      const rh = 0.55 + h * 0.14;
      M.compose(V.set(x, h, z), Q, S.set(w + 0.8, rh, d + 0.8));
      roofs.setMatrixAt(placed, M);
      roofs.setColorAt(placed, color.copy(tileA).lerp(tileB, rand() * 0.7));
      M.compose(V.set(x, h + rh, z), Q, S.set(w + 0.9, 1, 1));
      ridges.setMatrixAt(placed, M);

      const fx = Math.sin(yaw); // 정면(도로 쪽) 방향
      const fz = Math.cos(yaw);
      buildingSpecs.push({ x, z, yaw, w, d, h, fx, fz });

      // 격자 창호(쇼지): 1층 + (2층이면) 처마 밑 상층 창
      const cols = Math.min(3, Math.max(1, Math.floor(w / 1.0)));
      const rowYs = h >= 2.3 ? [0.95, h - 0.62] : [0.95];
      for (const ly of rowYs) {
        if (ly > h - 0.45) continue;
        for (let cIdx = 0; cIdx < cols; cIdx++) {
          const lx = (cIdx - (cols - 1) / 2) * 0.85;
          windowSpecs.push({
            pos: [x + fx * (d / 2 + 0.05) + fz * lx, ly, z + fz * (d / 2 + 0.05) - fx * lx],
            yaw,
            lit: rand() < 0.78,
          });
        }
      }
      placed++;
    }
    for (const im of [lowerWalls, upperWalls, roofs, ridges]) {
      im.count = placed;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }
  lowerWalls.name = "machiya-lower";
  upperWalls.name = "machiya-upper";
  roofs.name = "machiya-roofs";
  ridges.name = "machiya-ridges";
  group.add(lowerWalls, upperWalls, roofs, ridges);

  /** 건물 로컬(lx: 정면 가로, lz: 정면 바깥) → 월드 xz (창문 배치와 동일 규약) */
  const bLocal = (b, lx, lz) => [b.x + b.fz * lx + b.fx * lz, b.z - b.fx * lx + b.fz * lz];

  // ── 창호: 어두운 목재 프레임 + 격자 창호지(자체 발광, 조명 무관) ──
  {
    const frames = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.46, 0.54, 0.06),
      new THREE.MeshStandardMaterial({ color: PALETTE.frameWood, roughness: 0.95, flatShading: true }),
      Math.max(1, windowSpecs.length)
    );
    const shojiTex = makeShojiTexture();
    const panes = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.36, 0.44, 0.05),
      shojiTex
        ? new THREE.MeshBasicMaterial({ map: shojiTex })
        : new THREE.MeshBasicMaterial({ color: PALETTE.shoji }), // node 스모크 플레이스홀더
      Math.max(1, windowSpecs.length)
    );
    const lit = new THREE.Color("#ffffff"); // 텍스처 원색(따뜻한 창호지)
    const dark = new THREE.Color("#6b5a4a"); // 불 꺼진 창(텍스처 곱셈 틴트)
    windowSpecs.forEach((wSpec, i) => {
      Q.setFromAxisAngle(UP, wSpec.yaw);
      M.compose(V.set(...wSpec.pos), Q, S.set(1, 1, 1));
      frames.setMatrixAt(i, M);
      const fx = Math.sin(wSpec.yaw);
      const fz = Math.cos(wSpec.yaw);
      M.compose(
        V.set(wSpec.pos[0] + fx * 0.025, wSpec.pos[1], wSpec.pos[2] + fz * 0.025),
        Q,
        S.set(1, 1, 1)
      );
      panes.setMatrixAt(i, M);
      panes.setColorAt(i, wSpec.lit ? lit : dark);
    });
    frames.count = panes.count = windowSpecs.length;
    frames.instanceMatrix.needsUpdate = true;
    panes.instanceMatrix.needsUpdate = true;
    if (panes.instanceColor) panes.instanceColor.needsUpdate = true;
    frames.name = "window-frames";
    panes.name = "window-shoji";
    group.add(frames, panes);
  }

  // ── 노렌: 입구 처마 밑 짧은 인디고 천(얇은 박스) ──
  {
    const norenSpecs = [];
    for (const b of buildingSpecs) {
      if (b.h < 2.0 || rand() > 0.42) continue;
      const nw = Math.min(1.15, b.w * 0.42);
      const lx = (rand() < 0.5 ? -1 : 1) * b.w * 0.16;
      const [x, z] = bLocal(b, lx, b.d / 2 + 0.08);
      norenSpecs.push({ x, z, yaw: b.yaw, w: nw });
    }
    if (norenSpecs.length) {
      const noren = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 0.45, 0.04),
        new THREE.MeshStandardMaterial({ color: PALETTE.noren, roughness: 0.95, flatShading: true }),
        norenSpecs.length
      );
      norenSpecs.forEach((n, i) => {
        Q.setFromAxisAngle(UP, n.yaw);
        M.compose(V.set(n.x, 1.42, n.z), Q, S.set(n.w, 1, 1));
        noren.setMatrixAt(i, M);
      });
      noren.name = "noren";
      group.add(noren);
    }
  }

  // ── 간판: 세로 간판(캔버스 텍스처 유지) + 목조 프레임 백킹 ──
  {
    const buckets = SIGN_DEFS.map(() => []);
    const frameSpecs = [];
    for (const b of buildingSpecs) {
      if (b.h < 2.0 || rand() > 0.45) continue;
      const defIdx = Math.floor(rand() * SIGN_DEFS.length);
      const lx = (rand() < 0.5 ? -1 : 1) * Math.max(0.1, b.w / 2 - 0.42);
      const y = Math.min(b.h - 0.85, 1.3 + rand() * 1.1);
      if (y < 0.9) continue;
      const [x, z] = bLocal(b, lx, b.d / 2 + 0.12);
      const spec = { x, z, y, yaw: b.yaw, s: 0.85 + rand() * 0.3 };
      buckets[defIdx].push(spec);
      frameSpecs.push(spec);
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
    if (frameSpecs.length) {
      const signFrames = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.68, 1.5, 0.07),
        new THREE.MeshStandardMaterial({ color: PALETTE.frameWood, roughness: 0.95, flatShading: true }),
        frameSpecs.length
      );
      frameSpecs.forEach((sp, i) => {
        const fx = Math.sin(sp.yaw);
        const fz = Math.cos(sp.yaw);
        Q.setFromAxisAngle(UP, sp.yaw);
        M.compose(V.set(sp.x - fx * 0.05, sp.y, sp.z - fz * 0.05), Q, S.set(sp.s, sp.s, 1));
        signFrames.setMatrixAt(i, M);
      });
      signFrames.name = "sign-frames";
      group.add(signFrames);
    }
  }

  // ── 신사: 버밀리언 기둥 + 백색 벽 + 크게 뻗은 박공지붕(배전 1채 포함) ──
  {
    const redMat = new THREE.MeshStandardMaterial({
      color: PALETTE.shrineRed,
      roughness: 0.75,
      flatShading: true,
    });
    const whiteMat = new THREE.MeshStandardMaterial({
      color: PALETTE.plaster,
      roughness: 0.9,
      flatShading: true,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: PALETTE.roofTileB,
      roughness: 0.85,
      flatShading: true,
    });
    const stoneMat = new THREE.MeshStandardMaterial({
      color: PALETTE.stone,
      roughness: 1,
      flatShading: true,
    });
    for (const spot of shrineSpots) {
      const { w, d, ph, wide } = spot.def;
      const roofH = wide ? 1.35 : 1.05;
      const g = new THREE.Group();
      g.name = wide ? "shrine-haiden" : "shrine";
      // 기단(돌 플랫폼)
      const platform = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.35, d + 0.8), stoneMat);
      platform.position.y = 0.175;
      g.add(platform);
      // 버밀리언 기둥: 네 모서리 + (배전은) 정면 중간 2주
      const pillarGeo = new THREE.CylinderGeometry(0.11, 0.13, ph, 7);
      const pillarXs = wide ? [-w / 2 + 0.18, -w / 6, w / 6, w / 2 - 0.18] : [-w / 2 + 0.18, w / 2 - 0.18];
      for (const px of pillarXs) {
        for (const pz of [-d / 2 + 0.18, d / 2 - 0.18]) {
          const pillar = new THREE.Mesh(pillarGeo, redMat);
          pillar.position.set(px, 0.35 + ph / 2, pz);
          g.add(pillar);
        }
      }
      // 백색 벽(기둥 안쪽으로 인셋)
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w - 0.7, ph * 0.82, d - 0.7), whiteMat);
      wall.position.y = 0.35 + ph * 0.41;
      g.add(wall);
      // 처마 밑 버밀리언 도리(가로보)
      const beam = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.22, 0.3), redMat);
      beam.position.set(0, 0.35 + ph - 0.11, d / 2 - 0.05);
      g.add(beam);
      // 크게 뻗은 박공지붕(처마 0.85 돌출) + 용마루
      const roof = new THREE.Mesh(gableGeo, roofMat);
      roof.position.y = 0.35 + ph;
      roof.scale.set(w + 1.7, roofH, d + 1.5);
      g.add(roof);
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(w + 1.9, 0.13, 0.28), roofMat);
      ridge.position.y = 0.35 + ph + roofH;
      g.add(ridge);
      g.position.set(spot.x, 0, spot.z);
      g.rotation.y = spot.yaw;
      group.add(g);
    }
  }

  // ── 가로수: 콘 2~3단 겹침 + 색 변주(녹색 2종 + 벚꽃 핑크) ──
  const TREE_COUNT = 22;
  const APPROACH_TREES = 6; // 토리이 앞 참배로 벚꽃(별도 집중 배치)
  const TREE_CAP = TREE_COUNT + APPROACH_TREES;
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.12, 0.16, 0.9, 6),
    new THREE.MeshStandardMaterial({ color: PALETTE.trunk, roughness: 1, flatShading: true }),
    TREE_CAP
  );
  const leafTierGeos = [
    new THREE.ConeGeometry(0.8, 1.3, 7),
    new THREE.ConeGeometry(0.6, 1.1, 7),
    new THREE.ConeGeometry(0.42, 0.95, 7),
  ];
  const leafTierY = [1.45, 2.05, 2.6];
  const leafMat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true });
  const leafTiers = leafTierGeos.map((g, i) => {
    const im = new THREE.InstancedMesh(g, leafMat, TREE_CAP);
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
      // 수관(최대 콘 반경 0.8*s)까지 노면 밖으로 — 침범 금지, 신사 기단도 회피
      if (distToRoad(x, z) < HALF_W + 0.8 * s + 0.15) continue;
      if (nearShrine(x, z, 0.8 * s)) continue;
      Q.identity();
      M.compose(V.set(x, 0.45 * s, z), Q, S.set(s, s, s));
      trunks.setMatrixAt(placed, M);
      // 벚꽃 45%(여행지 무드), 나머지는 녹색 2종 사이 변주
      if (rand() < 0.45) base.copy(pink).lerp(tint, rand() * 0.25);
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
    // 참배로 벚꽃: 토리이 직전(p 0.886~0.935) 양옆 쌍으로 집중 배치 — 항상 핑크
    for (let i = 0; i < APPROACH_TREES && placed < TREE_CAP; i++) {
      const p = 0.886 + (i >> 1) * 0.022 + rand() * 0.005;
      const { pos: rp, tangent } = road.at(p);
      const [nx, , nz] = sideNormal(tangent);
      const side = i % 2 === 0 ? 1 : -1; // 좌우 쌍
      const s = 0.65 + rand() * 0.2;
      const dist = HALF_W + 0.8 * s + 0.35 + rand() * 0.25;
      const x = rp[0] + nx * side * dist;
      const z = rp[2] + nz * side * dist;
      // 수관까지 노면 밖으로 — 침범 금지(S자 반대편 포함 재검사)
      if (distToRoad(x, z) < HALF_W + 0.8 * s + 0.15) continue;
      Q.identity();
      M.compose(V.set(x, 0.45 * s, z), Q, S.set(s, s, s));
      trunks.setMatrixAt(placed, M);
      base.copy(pink).lerp(tint, rand() * 0.2);
      for (let t = 0; t < leafTiers.length; t++) {
        M.compose(V.set(x, leafTierY[t] * s, z), Q, S.set(s, s, s));
        leafTiers[t].setMatrixAt(placed, M);
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
      if (nearShrine(x, z, 0.4)) continue;
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

  // ── 원경: 후지산 실루엣 + 능선 언덕 — 마을 바깥(z -60~-80), 포그 너머 은은히 ──
  {
    const fuji = new THREE.Mesh(
      new THREE.ConeGeometry(24, 17, 14),
      new THREE.MeshStandardMaterial({ color: PALETTE.fuji, roughness: 1, flatShading: true })
    );
    fuji.position.set(-16, 8.4, -70);
    fuji.name = "fuji";
    // 흰 눈 캡: 살짝 큰 반경의 짧은 콘을 정상에 겹침(z-fight 없이 덮임)
    const snow = new THREE.Mesh(
      new THREE.ConeGeometry(9.3, 6.3, 14),
      new THREE.MeshStandardMaterial({ color: PALETTE.fujiSnow, roughness: 1, flatShading: true })
    );
    snow.position.set(-16, 13.8, -70);
    snow.name = "fuji-snow";
    group.add(fuji, snow);
    // 능선 언덕: 낮고 넓은 콘 3개(채도 낮은 블루로 공기원근)
    [
      { x: 20, z: -64, r: 20, h: 5.6 },
      { x: 46, z: -76, r: 24, h: 7.0 },
      { x: -48, z: -78, r: 26, h: 6.2 },
    ].forEach((hd, i) => {
      const hill = new THREE.Mesh(
        new THREE.ConeGeometry(hd.r, hd.h, 10),
        new THREE.MeshStandardMaterial({
          color: PALETTE.hills[i % PALETTE.hills.length],
          roughness: 1,
          flatShading: true,
        })
      );
      hill.position.set(hd.x, hd.h / 2 - 0.2, hd.z);
      hill.name = `hill-${i}`;
      group.add(hill);
    });
  }

  // ── 홍등 스트링: 도로를 가로지르는 축제 랜턴 8스팬+ (전선 새그 + 홍등 emissive) ──
  {
    const spans = []; // { a: V3, b: V3 }
    const postSpecs = [];
    for (const p of [0.06, 0.12, 0.2, 0.28, 0.36, 0.46, 0.56, 0.7, 0.78, 0.91]) {
      const { pos: rp, tangent } = road.at(p);
      const [nx, , nz] = sideNormal(tangent);
      const ends = [];
      for (const side of [1, -1]) {
        const x = rp[0] + nx * side * 2.0;
        const z = rp[2] + nz * side * 2.0;
        if (distToRoad(x, z) < HALF_W + 0.3) break; // 반대편 노면 침범 시 스팬 포기
        ends.push(new THREE.Vector3(x, 3.4, z));
      }
      if (ends.length < 2) continue;
      postSpecs.push(...ends);
      spans.push({ a: ends[0], b: ends[1] });
    }
    if (spans.length) {
      const posts = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.05, 0.07, 3.4, 6),
        new THREE.MeshStandardMaterial({ color: PALETTE.lampPole, roughness: 0.9, flatShading: true }),
        postSpecs.length
      );
      Q.identity();
      S.set(1, 1, 1);
      postSpecs.forEach((pt, i) => {
        M.compose(V.set(pt.x, 1.7, pt.z), Q, S);
        posts.setMatrixAt(i, M);
      });
      posts.name = "lantern-posts";
      group.add(posts);

      // 전선: 스팬당 2차 베지에 새그(전신주 전선과 동일 패턴) → LineSegments 1드로우콜
      const SEG = 10;
      const SAG = 0.4;
      const wirePts = [];
      const mid = new THREE.Vector3();
      const prev = new THREE.Vector3();
      const cur = new THREE.Vector3();
      const bezier = (span, t, out) =>
        out
          .copy(span.a)
          .multiplyScalar((1 - t) * (1 - t))
          .addScaledVector(mid, 2 * t * (1 - t))
          .addScaledVector(span.b, t * t);
      const lanternSpecs = [];
      for (const span of spans) {
        mid.lerpVectors(span.a, span.b, 0.5);
        mid.y -= SAG;
        for (let sIdx = 0; sIdx <= SEG; sIdx++) {
          bezier(span, sIdx / SEG, cur);
          if (sIdx > 0) wirePts.push(prev.x, prev.y, prev.z, cur.x, cur.y, cur.z);
          prev.copy(cur);
        }
        // 홍등 4개/스팬: 전선 아래로 살짝 매달림
        for (const t of [0.2, 0.4, 0.6, 0.8]) {
          bezier(span, t, cur);
          lanternSpecs.push({ x: cur.x, y: cur.y - 0.24, z: cur.z });
        }
      }
      const wireGeo = new THREE.BufferGeometry();
      wireGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(wirePts), 3));
      const wires = new THREE.LineSegments(
        wireGeo,
        new THREE.LineBasicMaterial({ color: PALETTE.wire })
      );
      wires.name = "lantern-wires";
      group.add(wires);

      const lanterns = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.17, 10, 8),
        new THREE.MeshStandardMaterial({
          color: PALETTE.lanternRed,
          emissive: PALETTE.lanternGlow,
          emissiveIntensity: 0.85,
          roughness: 0.6,
          flatShading: true,
        }),
        lanternSpecs.length
      );
      S.set(1, 1.25, 1); // 초롱 실루엣(세로로 살짝 김)
      lanternSpecs.forEach((l, i) => {
        M.compose(V.set(l.x, l.y, l.z), Q, S);
        lanterns.setMatrixAt(i, M);
      });
      lanterns.name = "red-lanterns";
      group.add(lanterns);
      group.userData.stringLanternCount = lanternSpecs.length;
    }
  }

  // ── 초칭(提灯): 처마 밑 홍등(건물당 1~2개) + 토리이 참배로 양옆 연등 기둥 ──
  {
    const chochinSpecs = []; // { x, z, y }
    for (const b of buildingSpecs) {
      const two = rand() < 0.5;
      const sides = two ? [-1, 1] : [rand() < 0.5 ? -1 : 1];
      for (const sgn of sides) {
        const lx = sgn * Math.max(0.2, b.w / 2 - 0.32);
        const [x, z] = bLocal(b, lx, b.d / 2 + 0.3);
        chochinSpecs.push({ x, z, y: b.h - 0.32 });
      }
    }
    // 참배로 연등 기둥 8기: 석등(dist 2.0)과 p 인터리브, 살짝 바깥 열(dist 2.35)
    const approachPostSpecs = [];
    for (let i = 0; i < 8; i++) {
      const p = 0.8785 + (i >> 1) * 0.0205;
      const { pos: rp, tangent } = road.at(p);
      const [nx, , nz] = sideNormal(tangent);
      const side = i % 2 === 0 ? 1 : -1;
      const x = rp[0] + nx * side * 2.35;
      const z = rp[2] + nz * side * 2.35;
      if (distToRoad(x, z) < HALF_W + 0.3) continue;
      approachPostSpecs.push({ x, z });
      chochinSpecs.push({ x, z, y: 2.08 });
    }
    if (approachPostSpecs.length) {
      const posts = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.045, 0.06, 1.9, 6),
        new THREE.MeshStandardMaterial({ color: PALETTE.frameWood, roughness: 0.95, flatShading: true }),
        approachPostSpecs.length
      );
      Q.identity();
      S.set(1, 1, 1);
      approachPostSpecs.forEach((pt, i) => {
        M.compose(V.set(pt.x, 0.95, pt.z), Q, S);
        posts.setMatrixAt(i, M);
      });
      posts.name = "approach-lantern-posts";
      group.add(posts);
    }
    if (chochinSpecs.length) {
      const chochin = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.16, 10, 8),
        new THREE.MeshStandardMaterial({
          color: PALETTE.lanternRed,
          emissive: PALETTE.lanternGlow,
          emissiveIntensity: 0.5,
          roughness: 0.6,
          flatShading: true,
        }),
        chochinSpecs.length
      );
      Q.identity();
      S.set(1, 1.35, 1); // 타원 초칭 실루엣
      chochinSpecs.forEach((l, i) => {
        M.compose(V.set(l.x, l.y, l.z), Q, S);
        chochin.setMatrixAt(i, M);
      });
      chochin.name = "chochin";
      group.add(chochin);
      group.userData.chochinCount = chochinSpecs.length;
    }
  }

  // ── 석등(石燈): 참배로(토리이 직전 p 0.888~0.93) 집중 + 도로변 일반 배치 ──
  {
    const specs = []; // { x, z, yaw, s }
    const addLantern = (p, side, dist, s) => {
      const { pos: rp, tangent } = road.at(p);
      const [nx, , nz] = sideNormal(tangent);
      const x = rp[0] + nx * side * dist;
      const z = rp[2] + nz * side * dist;
      if (distToRoad(x, z) < HALF_W + 0.35) return;
      specs.push({ x, z, yaw: Math.atan2(rp[0] - x, rp[2] - z), s });
    };
    // 일반 4기(정거장 회피 지점, 좌우 교대)
    for (const [p, side] of [[0.08, 1], [0.33, -1], [0.57, 1], [0.72, -1]])
      addLantern(p + (rand() - 0.5) * 0.01, side, 2.1 + rand() * 0.3, 1.0 + rand() * 0.15);
    // 참배로 6기: 양옆 쌍 — 벚꽃(안쪽 열)과 함께 짧은 참배로 느낌
    for (let i = 0; i < 6; i++)
      addLantern(0.888 + (i >> 1) * 0.021, i % 2 ? -1 : 1, 2.0, 1.1);
    if (specs.length) {
      const stoneMat = new THREE.MeshStandardMaterial({
        color: PALETTE.stone,
        roughness: 1,
        flatShading: true,
      });
      const glowMat = new THREE.MeshBasicMaterial({ color: PALETTE.lampGlow });
      const roofGeo = new THREE.ConeGeometry(0.4, 0.24, 4);
      roofGeo.rotateY(Math.PI / 4); // 처마 모서리를 불집 면과 정렬
      const parts = [
        { geo: new THREE.BoxGeometry(0.5, 0.18, 0.5), y: 0.09, mat: stoneMat, nm: "base" },
        { geo: new THREE.CylinderGeometry(0.09, 0.12, 0.55, 6), y: 0.455, mat: stoneMat, nm: "pillar" },
        { geo: new THREE.BoxGeometry(0.34, 0.3, 0.34), y: 0.88, mat: stoneMat, nm: "firebox" },
        { geo: new THREE.BoxGeometry(0.2, 0.14, 0.36), y: 0.88, mat: glowMat, nm: "glow" }, // 불빛 창(도로 방향 관통)
        { geo: roofGeo, y: 1.15, mat: stoneMat, nm: "roof" },
        { geo: new THREE.SphereGeometry(0.07, 6, 5), y: 1.32, mat: stoneMat, nm: "orb" },
      ];
      for (const part of parts) {
        const im = new THREE.InstancedMesh(part.geo, part.mat, specs.length);
        specs.forEach((sp, i) => {
          Q.setFromAxisAngle(UP, sp.yaw);
          M.compose(V.set(sp.x, part.y * sp.s, sp.z), Q, S.set(sp.s, sp.s, sp.s));
          im.setMatrixAt(i, M);
        });
        im.name = `stone-lantern-${part.nm}`;
        group.add(im);
      }
    }
  }

  // ── 관광 안내판: 가로형 캔버스 텍스처 보드(온천·신사 입구) ──
  {
    const defs = [
      { text: "♨ 온천 200m", p: 0.3, side: -1 },
      { text: "⛩ 신사 입구", p: 0.755, side: 1 },
    ];
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.06, 1.5, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: PALETTE.lampPole, roughness: 1 });
    for (const def of defs) {
      const { pos: rp, tangent } = road.at(def.p);
      const [nx, , nz] = sideNormal(tangent);
      const x = rp[0] + nx * def.side * 2.15;
      const z = rp[2] + nz * def.side * 2.15;
      if (distToRoad(x, z) < HALF_W + 0.3) continue;
      const sign = new THREE.Group();
      sign.name = `info-sign-${def.p}`;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 0.75;
      const tex = makeInfoTexture(def.text);
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(1.45, 0.5, 0.06),
        tex
          ? new THREE.MeshBasicMaterial({ map: tex })
          : new THREE.MeshBasicMaterial({ color: PALETTE.signBoard }) // node 스모크 플레이스홀더
      );
      board.position.y = 1.55;
      sign.add(pole, board);
      sign.position.set(x, 0, z);
      sign.rotation.y = Math.atan2(rp[0] - x, rp[2] - z); // 판이 도로를 향하게
      group.add(sign);
    }
  }

  // ── 벚꽃잎 파티클: 은은히 흩날리는 핑크 스프라이트(정적 배치, userData.petals 노출) ──
  {
    const petals = new THREE.Group();
    petals.name = "petals";
    const mat = new THREE.SpriteMaterial({
      color: PALETTE.leafPink,
      map: makePetalTexture(),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const N = 16;
    for (let i = 0; i < N; i++) {
      // 후반 6장은 참배로(토리이 직전)에 집중
      const p = i < 10 ? 0.08 + rand() * 0.78 : 0.88 + rand() * 0.055;
      const { pos: rp, tangent } = road.at(p);
      const [nx, , nz] = sideNormal(tangent);
      const off = (rand() < 0.5 ? -1 : 1) * (0.4 + rand() * 2.6);
      const sp = new THREE.Sprite(mat);
      sp.position.set(rp[0] + nx * off, 0.5 + rand() * 2.4, rp[2] + nz * off);
      const sc = 0.09 + rand() * 0.07;
      sp.scale.set(sc, sc, 1);
      petals.add(sp);
    }
    group.add(petals);
    group.userData.petals = petals;
  }

  scene.add(group);
  return { group, roadPoints: ROAD_POINTS, stations: STATIONS };
}
