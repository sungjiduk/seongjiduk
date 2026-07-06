// 구름 — 빌보드 스프라이트 클러스터(노이즈 변형 캔버스 텍스처 3~5장).
// setDensity(p): 전체 구름 농도 0..1. whiteout(p): ACT3 진입 화이트아웃(0=없음, 1=완전 백색).
// v1 hero.js의 라디얼 그라디언트 텍스처를 다중 블롭 + 시드 노이즈로 업그레이드.

import * as THREE from "three";

/** 결정적 의사난수(시드 고정 → 텍스처 변형 재현 가능) */
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

/** 소프트 블롭 여러 개를 겹친 구름 텍스처 (텍스처 없는 Sprite는 흰 사각형 — v1 교훈) */
function makeCloudTexture(seed) {
  const rand = mulberry32(seed);
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const blobs = 5 + Math.floor(rand() * 4);
  for (let i = 0; i < blobs; i++) {
    const x = size * (0.25 + rand() * 0.5);
    const y = size * (0.35 + rand() * 0.3);
    const r = size * (0.14 + rand() * 0.2);
    const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${0.5 + rand() * 0.35})`);
    g.addColorStop(0.6, "rgba(255,255,255,0.22)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 구름 클러스터 + 화이트아웃 오버레이를 설치한다.
 * @param {THREE.Scene} scene
 * @param {THREE.PerspectiveCamera} camera 화이트아웃 풀스크린 쿼드 부착 대상
 * @returns {{ group, setDensity(p):void, whiteout(p):void, update(dt):void }}
 */
export function createClouds(scene, camera, { clusterCount = 10, spritesPerCluster = 5, spread = 26 } = {}) {
  const textures = [11, 23, 37, 53, 71].map(makeCloudTexture);
  const group = new THREE.Group();
  group.name = "clouds";

  const sprites = [];
  for (let ci = 0; ci < clusterCount; ci++) {
    const cx = (Math.random() - 0.5) * spread * 2;
    const cy = (Math.random() - 0.5) * spread;
    const cz = -4 - Math.random() * spread;
    const n = 3 + Math.floor(Math.random() * (spritesPerCluster - 2));
    for (let i = 0; i < n; i++) {
      const mat = new THREE.SpriteMaterial({
        map: textures[(ci + i) % textures.length],
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: true,
      });
      const s = new THREE.Sprite(mat);
      const sc = 3 + Math.random() * 5;
      s.scale.set(sc * 1.7, sc, 1);
      s.position.set(
        cx + (Math.random() - 0.5) * 6,
        cy + (Math.random() - 0.5) * 2.5,
        cz + (Math.random() - 0.5) * 4
      );
      s.userData.baseOpacity = 0.35 + Math.random() * 0.4;
      s.userData.drift = 0.08 + Math.random() * 0.25;
      sprites.push(s);
      group.add(s);
    }
  }
  scene.add(group);

  // 화이트아웃: 카메라에 부착된 풀스크린 백색 쿼드 + 포그 조임
  const whiteMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    fog: false,
  });
  const whitePlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), whiteMat);
  whitePlane.renderOrder = 90;
  whitePlane.visible = false;
  // 카메라 앞 0.5 지점에서 FOV를 덮는 크기
  const dist = 0.5;
  const h = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.3;
  whitePlane.scale.set(h * camera.aspect * 1.4, h, 1);
  whitePlane.position.set(0, 0, -dist);
  camera.add(whitePlane);

  let density = 0;
  const baseFog = scene.fog ? { near: scene.fog.near, far: scene.fog.far } : null;
  const white = new THREE.Color(0xffffff);

  function applyOpacity() {
    for (const s of sprites) s.material.opacity = s.userData.baseOpacity * density;
    group.visible = density > 0.01;
  }

  /** 전체 구름 농도 0..1 */
  function setDensity(p) {
    density = Math.min(1, Math.max(0, p));
    applyOpacity();
  }

  /** ACT3 진입 화이트아웃 0..1 — 풀스크린 백색 + 포그를 카메라 쪽으로 조인다 */
  function whiteout(p) {
    const w = Math.min(1, Math.max(0, p));
    whitePlane.visible = w > 0.005;
    whiteMat.opacity = w;
    if (scene.fog && baseFog) {
      scene.fog.near = THREE.MathUtils.lerp(baseFog.near, 0.5, w);
      scene.fog.far = THREE.MathUtils.lerp(baseFog.far, 6, w);
      if (w > 0) scene.fog.color.lerp(white, w * 0.9);
    }
  }

  /** 은은한 수평 드리프트 */
  function update(dt) {
    if (!group.visible) return;
    for (const s of sprites) {
      s.position.x -= s.userData.drift * dt;
      if (s.position.x < -spread * 1.2) s.position.x = spread * 1.2;
    }
  }

  setDensity(0.6);
  return { group, setDensity, whiteout, update };
}
