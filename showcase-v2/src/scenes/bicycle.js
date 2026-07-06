// 자전거 — 코드 프리미티브 로우폴리 (프레임·바퀴·핸들·안장·페달).
// 덕식이(정적 메시)를 안장 위에 얹는 용도. 바퀴/페달 회전만 코드로 돌린다.

import * as THREE from "three";

export function createBicycle() {
  const group = new THREE.Group();
  group.name = "bicycle";

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xe8395f, // 보딩 코럴 프레임
    roughness: 0.45,
    metalness: 0.25,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x2b3550,
    roughness: 0.8,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x22283c,
    roughness: 0.9,
  });

  // 바퀴 (림+타이어 겸용 토러스 + 스포크 디스크)
  const wheels = [];
  function wheel(x) {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.07, 10, 24), tireMat);
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.02, 16),
      new THREE.MeshStandardMaterial({
        color: 0xf2d0b3,
        roughness: 0.6,
        transparent: true,
        opacity: 0.5,
      })
    );
    disc.rotation.x = Math.PI / 2;
    w.add(tire, disc);
    w.position.set(x, 0.45, 0);
    group.add(w);
    wheels.push(w);
    return w;
  }
  wheel(-0.62); // 뒷바퀴
  wheel(0.62); // 앞바퀴

  // 프레임: 아래 다이아몬드 (실린더 3개)
  function tube(a, b, r = 0.045) {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), frameMat);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.lookAt(vb);
    m.rotateX(Math.PI / 2);
    group.add(m);
    return m;
  }
  tube([-0.62, 0.45, 0], [0.05, 0.95, 0]); // 시트 스테이
  tube([-0.62, 0.45, 0], [0.1, 0.42, 0]); // 체인 스테이
  tube([0.1, 0.42, 0], [0.05, 0.95, 0]); // 시트 튜브
  tube([0.05, 0.95, 0], [0.55, 0.95, 0]); // 탑 튜브
  tube([0.1, 0.42, 0], [0.55, 0.95, 0]); // 다운 튜브
  tube([0.55, 0.95, 0], [0.62, 0.45, 0]); // 포크

  // 핸들바
  const stem = tube([0.55, 0.95, 0], [0.58, 1.15, 0], 0.04);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 8), darkMat);
  bar.rotation.x = Math.PI / 2;
  bar.position.set(0.58, 1.15, 0);
  group.add(bar);

  // 안장
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.22), darkMat);
  seat.position.set(0.02, 1.0, 0);
  group.add(seat);

  // 페달 크랭크
  const crank = new THREE.Group();
  const pedalL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.08), darkMat);
  pedalL.position.set(0.14, 0, 0.14);
  const pedalR = pedalL.clone();
  pedalR.position.set(-0.14, 0, -0.14);
  crank.add(pedalL, pedalR);
  crank.position.set(0.1, 0.42, 0);
  group.add(crank);

  /** 이동 거리(월드 유닛)만큼 바퀴·페달 회전 */
  function spin(dist) {
    const angle = dist / 0.45; // r=0.45
    for (const w of wheels) w.rotation.z -= angle;
    crank.rotation.z -= angle * 0.5;
  }

  // 안장 위 덕식이 마운트 포인트
  const seatMount = new THREE.Object3D();
  seatMount.position.set(0.0, 1.06, 0);
  group.add(seatMount);

  return { group, spin, seatMount };
}
