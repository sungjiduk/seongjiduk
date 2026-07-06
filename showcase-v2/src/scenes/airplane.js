// 경비행기 — 코드 프리미티브 로우폴리(외부 에셋 없음).
// 동체 캡슐 + 기수 원뿔 + 고익 주익 + 꼬리날개 + 프로펠러.
// 화이트 베이스 + 코럴 포인트 + 성지덕 옐로우 라인. 배치/비행은 act1이 제어한다.

import * as THREE from "three";

/**
 * 경비행기 생성. 기수는 +Z 방향(요 회전은 호출부 책임).
 * @returns {{ group: THREE.Group, propeller: THREE.Group }}
 */
export function createAirplane() {
  const group = new THREE.Group();
  group.name = "airplane";

  const white = new THREE.MeshStandardMaterial({
    color: "#f4efe6",
    roughness: 0.55,
    flatShading: true,
  });
  const coral = new THREE.MeshStandardMaterial({
    color: "#e8395f",
    roughness: 0.6,
    flatShading: true,
  });
  const yellow = new THREE.MeshStandardMaterial({
    color: "#f5a80c",
    roughness: 0.5,
    flatShading: true,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: "#2b3550",
    roughness: 0.6,
    flatShading: true,
  });

  // 동체: 캡슐을 Z축으로 눕힘
  const fuselageGeo = new THREE.CapsuleGeometry(0.5, 2.2, 4, 10);
  fuselageGeo.rotateX(Math.PI / 2);
  const fuselage = new THREE.Mesh(fuselageGeo, white);
  fuselage.name = "fuselage";
  group.add(fuselage);

  // 기수 원뿔(코럴 카울) — 꼭짓점이 +Z
  const noseGeo = new THREE.ConeGeometry(0.42, 0.7, 10);
  noseGeo.rotateX(Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo, coral);
  nose.position.z = 1.55;
  group.add(nose);

  // 조종석 캐노피(다크 글래스 느낌 박스)
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.62), dark);
  canopy.position.set(0, 0.42, 0.55);
  group.add(canopy);

  // 주익: 고익 배치 + 앞전 옐로우 라인
  const wing = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.1, 1.05), white);
  wing.position.set(0, 0.56, 0.25);
  group.add(wing);
  const wingLine = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.03, 0.2), yellow);
  wingLine.position.set(0, 0.62, 0.66);
  group.add(wingLine);

  // 동체 옆 성지덕 옐로우 라인(좌우로 살짝 돌출된 띠)
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.12, 1.9), yellow);
  stripe.position.set(0, -0.02, 0.1);
  group.add(stripe);

  // 꼬리: 수직 안정판(코럴) + 수평 안정판
  const vfin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.78, 0.62), coral);
  vfin.position.set(0, 0.55, -1.5);
  vfin.rotation.x = -0.18; // 뒤로 살짝 젖힘
  group.add(vfin);
  const hstab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.07, 0.52), white);
  hstab.position.set(0, 0.15, -1.5);
  group.add(hstab);

  // 프로펠러: 스피너 원뿔 + 십자 블레이드 + 회전 잔상 디스크 — Z축 스핀
  const propeller = new THREE.Group();
  propeller.name = "propeller";
  const spinnerGeo = new THREE.ConeGeometry(0.13, 0.3, 8);
  spinnerGeo.rotateX(Math.PI / 2);
  propeller.add(new THREE.Mesh(spinnerGeo, yellow));
  for (const rz of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.05), dark);
    blade.rotation.z = rz;
    propeller.add(blade);
  }
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.78, 20),
    new THREE.MeshBasicMaterial({
      color: "#dfe6ef",
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  disc.position.z = 0.02;
  propeller.add(disc);
  propeller.position.z = 1.98;
  group.add(propeller);

  // 고정 랜딩기어: 스트럿 + 바퀴 2
  for (const sx of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.14), white);
    strut.position.set(sx * 0.42, -0.62, 0.45);
    strut.rotation.z = sx * 0.35;
    group.add(strut);
    const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), dark);
    wheel.position.set(sx * 0.52, -0.88, 0.45);
    group.add(wheel);
  }

  return { group, propeller };
}
