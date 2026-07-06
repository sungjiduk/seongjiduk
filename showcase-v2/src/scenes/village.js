// 성지 마을 — 프로시저럴 로우폴리 석양 마을(외부 에셋 없음).
// 도로 리본(커브 좌우 오프셋 스트립) + 지면 + 인스턴스드 건물/창문/나무 + 토리이 + 정거장 표지판.
// 조명은 main.js(키/림/헤미)가 관리 — 여기서는 창문 자체 발광만 쓴다.
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
  leaf: "#c96f5c",
  leafAlt: "#e2957f",
  torii: "#c33f2e",
  signBoard: "#f6e3cf",
};

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
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < dashCount; i++) {
      const { pos: p, tangent } = road.at((i + 0.5) / dashCount);
      // 점선은 yaw만 반영(노면에 눕힘)
      const yaw = Math.atan2(tangent[0], tangent[2]);
      q.setFromAxisAngle(up, yaw);
      m.compose(new THREE.Vector3(p[0], 0.04, p[2]), q, new THREE.Vector3(1, 1, 1));
      dashes.setMatrixAt(i, m);
    }
  }
  dashes.name = "road-dashes";
  group.add(dashes);

  // ── 건물: 인스턴스드 박스(도로에서 4~10유닛, 침범 금지) + 자체 발광 창문 ──
  const BUILDING_COUNT = 42;
  const buildings = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }),
    BUILDING_COUNT
  );
  const windowSpecs = []; // { pos, yaw, lit }
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const color = new THREE.Color();
    let placed = 0;
    let guard = 0;
    while (placed < BUILDING_COUNT && guard++ < 800) {
      const p = 0.03 + rand() * 0.88; // 토리이(p≈0.95) 앞까지만
      const { pos: rp, tangent } = road.at(p);
      const [nx, , nz] = sideNormal(tangent);
      const side = rand() < 0.5 ? 1 : -1;
      const dist = 4 + rand() * 6; // 도로에서 4~10유닛 이격
      const w = 1.6 + rand() * 1.8;
      const d = 1.6 + rand() * 1.8;
      const h = 1.5 + rand() * 3.2;
      const x = rp[0] + nx * side * dist;
      const z = rp[2] + nz * side * dist;
      // S자 반대편 노면 침범 검사(건물 반폭 + 노면 반폭 + 여유)
      if (distToRoad(x, z) < HALF_W + Math.max(w, d) * 0.5 + 0.6) continue;
      const yaw = Math.atan2(rp[0] - x, rp[2] - z); // 도로를 향해 정면
      q.setFromAxisAngle(up, yaw);
      m.compose(new THREE.Vector3(x, h / 2, z), q, new THREE.Vector3(w, h, d));
      buildings.setMatrixAt(placed, m);
      color.set(PALETTE.buildings[Math.floor(rand() * PALETTE.buildings.length)]);
      buildings.setColorAt(placed, color);

      // 창문: 도로 쪽 정면에 그리드 배치
      const cols = Math.min(3, Math.max(1, Math.floor(w / 0.9)));
      const rows = Math.min(3, Math.max(1, Math.floor(h / 1.1)));
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
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

  // 창문: MeshBasicMaterial = 조명 무관 자체 발광(석양 창불), 어두운 창은 인스턴스 컬러
  const windows = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.3, 0.38, 0.06),
    new THREE.MeshBasicMaterial(),
    Math.max(1, windowSpecs.length)
  );
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const lit = new THREE.Color(PALETTE.windowLit);
    const dark = new THREE.Color(PALETTE.windowDark);
    windowSpecs.forEach((wSpec, i) => {
      q.setFromAxisAngle(up, wSpec.yaw);
      m.compose(new THREE.Vector3(...wSpec.pos), q, new THREE.Vector3(1, 1, 1));
      windows.setMatrixAt(i, m);
      windows.setColorAt(i, wSpec.lit ? lit : dark);
    });
    windows.count = windowSpecs.length;
    windows.instanceMatrix.needsUpdate = true;
    if (windows.instanceColor) windows.instanceColor.needsUpdate = true;
  }
  windows.name = "windows";
  group.add(windows);

  // ── 가로수: 원뿔(잎) + 실린더(줄기) 인스턴스, 도로변(침범 금지) ──
  const TREE_COUNT = 22;
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.12, 0.16, 0.9, 6),
    new THREE.MeshStandardMaterial({ color: PALETTE.trunk, roughness: 1, flatShading: true }),
    TREE_COUNT
  );
  const leaves = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.75, 1.9, 7),
    new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }),
    TREE_COUNT
  );
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const color = new THREE.Color();
    const leafA = new THREE.Color(PALETTE.leaf);
    const leafB = new THREE.Color(PALETTE.leafAlt);
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
      // 수관(원뿔 반경 0.75*s)까지 노면 밖으로 — 침범 금지
      if (distToRoad(x, z) < HALF_W + 0.75 * s + 0.15) continue;
      m.compose(new THREE.Vector3(x, 0.45 * s, z), q, new THREE.Vector3(s, s, s));
      trunks.setMatrixAt(placed, m);
      m.compose(new THREE.Vector3(x, (0.9 + 0.85) * s, z), q, new THREE.Vector3(s, s, s));
      leaves.setMatrixAt(placed, m);
      color.copy(leafA).lerp(leafB, rand());
      leaves.setColorAt(placed, color);
      placed++;
    }
    trunks.count = leaves.count = placed;
    trunks.instanceMatrix.needsUpdate = true;
    leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  }
  trunks.name = "tree-trunks";
  leaves.name = "tree-leaves";
  group.add(trunks, leaves);

  // ── 토리이 게이트: 도로 끝(p≈0.95), 빨간 기둥 2 + 가로보 2, 높이 ~6 ──
  {
    const torii = new THREE.Group();
    torii.name = "torii";
    const mat = new THREE.MeshStandardMaterial({
      color: PALETTE.torii,
      roughness: 0.7,
      flatShading: true,
    });
    const pillarGeo = new THREE.CylinderGeometry(0.24, 0.3, 5.4, 8);
    for (const s of [-1, 1]) {
      const pillar = new THREE.Mesh(pillarGeo, mat);
      pillar.position.set(s * (HALF_W + 1.0), 2.7, 0);
      torii.add(pillar);
    }
    const kasagi = new THREE.Mesh(new THREE.BoxGeometry(ROAD_WIDTH + 4.2, 0.45, 0.6), mat);
    kasagi.position.y = 5.7;
    torii.add(kasagi);
    const nuki = new THREE.Mesh(new THREE.BoxGeometry(ROAD_WIDTH + 2.6, 0.32, 0.42), mat);
    nuki.position.y = 4.4;
    torii.add(nuki);

    const { pos: tp, tangent } = road.at(0.95);
    torii.position.set(tp[0], 0, tp[2]);
    torii.rotation.y = Math.atan2(tangent[0], tangent[2]); // 도로 진행 방향과 직교
    group.add(torii);
  }

  // ── 정거장 표지판(기둥+판) + 카드 도킹 앵커(도로 옆 2.5유닛) ──
  const stationAnchors = {};
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
    });
  }
  group.userData.stationAnchors = stationAnchors;

  scene.add(group);
  return { group, roadPoints: ROAD_POINTS, stations: STATIONS };
}
