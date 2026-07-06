// 덕식이 — GLB 로드(meshopt) + 코드 프리미티브 고글 + 포즈 프리셋.
// 모델은 정적 메시(리그 없음): 모든 포즈/모션은 그룹 트랜스폼으로 연출한다.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const DUCK_URL = "models/duck.glb";
const TARGET_SIZE = 2.0; // 오토스케일 목표 크기(최장축, 월드 유닛)

/** 코드 프리미티브 고글: 렌즈 테 2 + 반투명 렌즈 2 + 뒤통수 밴드 */
function buildGoggles() {
  const g = new THREE.Group();
  g.name = "goggles";

  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xf5a80c, // 덕 옐로우 테
    roughness: 0.35,
    metalness: 0.15,
  });
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x8fd0ff,
    transparent: true,
    opacity: 0.4,
    roughness: 0.1,
    metalness: 0.3,
    side: THREE.DoubleSide,
  });
  const bandMat = new THREE.MeshStandardMaterial({
    color: 0x2b3550,
    roughness: 0.7,
  });

  // 그룹 원점 = 머리 중심. 스키고글: 크고 두꺼운 렌즈 컵 + 넓은 브릿지 (안경처럼 얇으면 안 됨)
  const FRONT = 0.42; // 머리 반지름 근사
  const rimGeo = new THREE.TorusGeometry(0.2, 0.055, 12, 26);
  const lensGeo = new THREE.CircleGeometry(0.19, 26);
  lensMat.opacity = 0.62;
  lensMat.color.set(0x5fb6e8);
  for (const sx of [-1, 1]) {
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.set(sx * 0.21, 0, FRONT);
    rim.scale.z = 1.6; // 고글 컵 깊이감
    g.add(rim);
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.set(sx * 0.21, 0, FRONT + 0.02);
    g.add(lens);
  }
  // 넓은 브릿지(고글 프레임 느낌)
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.07), rimMat);
  bridge.position.set(0, 0, FRONT + 0.03);
  g.add(bridge);
  // 머리를 수평으로 감는 스트랩(풀 토러스, 살짝 납작)
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(FRONT + 0.015, 0.026, 8, 32),
    bandMat
  );
  band.rotation.x = Math.PI / 2; // XZ 평면(수평 링)
  band.scale.set(1, 1, 0.92);
  g.add(band);

  return g;
}

/** 낙하산: 덕 옐로우 캐노피(반구) + 코럴 패널 + 산줄 6가닥 */
function buildParachute() {
  const g = new THREE.Group();
  g.name = "parachute";
  const R = 1.7;
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(R, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0xf5a80c,
      emissive: 0xf5a80c,
      emissiveIntensity: 0.28, // 역광 밑면도 옐로우로 읽히게
      roughness: 0.75,
      side: THREE.DoubleSide,
    })
  );
  canopy.scale.y = 0.62;
  g.add(canopy);
  // 코럴 세로 패널 4장 (살짝 띄워 겹침)
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(R + 0.015, 14, 7, (i * Math.PI) / 2, Math.PI / 6, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xe8395f, emissive: 0xe8395f, emissiveIntensity: 0.28, roughness: 0.75, side: THREE.DoubleSide })
    );
    p.scale.y = 0.62;
    g.add(p);
  }
  // 산줄: 캐노피 림 → 하네스 지점
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * R * 0.92, -0.1, Math.sin(a) * R * 0.92));
    pts.push(new THREE.Vector3(0, -2.1, 0));
  }
  g.add(
    new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xdcd6c9 })
    )
  );
  return g;
}

/**
 * 덕식이 로드. 오토센터/오토스케일(v1 검증 패턴) 후 포즈 프리셋 제공.
 * @param {THREE.LoadingManager} [manager]
 * @returns {Promise<{group, model, goggles, setPose(name:'skydive'|'stand'|'ride'):void}>}
 */
export function loadDuck(manager) {
  const loader = new GLTFLoader(manager);
  loader.setMeshoptDecoder(MeshoptDecoder);

  return new Promise((resolve, reject) => {
    loader.load(
      DUCK_URL,
      (gltf) => {
        const model = gltf.scene;
        // 바운딩 박스 기준 원점 정렬 + 목표 크기 정규화
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        const norm = TARGET_SIZE / (Math.max(size.x, size.y, size.z) || 1);
        model.position.sub(center);
        model.scale.setScalar(norm);
        model.traverse((o) => {
          if (o.isMesh && o.material) o.material.envMapIntensity = 0.8;
        });

        // 포즈 피벗(모델 회전 전용) ← 그룹(월드 배치 전용)과 분리
        const pivot = new THREE.Group();
        pivot.name = "duck-pivot";
        pivot.add(model);

        // 고글: 그룹 원점 = 머리 중심 (수치는 프리뷰로 튜닝)
        const goggles = buildGoggles();
        goggles.position.set(0, 0.34, 0.12);
        pivot.add(goggles);

        const group = new THREE.Group();
        group.name = "duck";
        group.add(pivot);

        // 낙하산 (덱 진입 전 전개 — 표시/스케일은 act1이 제어)
        const parachute = buildParachute();
        parachute.position.set(0, 2.35, 0);
        parachute.visible = false;
        group.add(parachute);

        function setPose(name) {
          group.userData.pose = name;
          if (name === "skydive") {
            // 배를 아래로(스카이다이브): 등·배낭이 위(카메라)를 향한다. 고글 착용.
            pivot.rotation.set(Math.PI * 0.45, 0, 0);
            goggles.visible = true;
          } else if (name === "ride") {
            parachute.visible = false;
            // 자전거 안장 기준 직립 + 살짝 앞 기울임. 고글 해제.
            pivot.rotation.set(-0.12, 0, 0);
            goggles.visible = false;
          } else {
            pivot.rotation.set(0, 0, 0);
            goggles.visible = false;
            parachute.visible = false;
          }
        }
        setPose("stand");

        resolve({ group, model, pivot, goggles, parachute, setPose });
      },
      undefined,
      reject
    );
  });
}
