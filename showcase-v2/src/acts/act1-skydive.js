// ACT 1 — SKYDIVE (전역 t 0 → 0.30)
// 고글 덕식이 자유낙하: 카메라는 등 뒤 상단에서 아래(구름)를 향한다 (레퍼런스 1 구도).
// 마우스 X/Y → 덕식이 기울기 + 카메라 미세 패럴랙스. 낙하 체감은 구름 수직 스크롤로.

import * as THREE from "three";

export function createAct1({ camera, duck, clouds }) {
  const mouse = { x: 0, y: 0 }; // 목표(-1..1)
  const smooth = { x: 0, y: 0 }; // 스무딩된 현재값

  window.addEventListener("pointermove", (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  });

  const lookTarget = new THREE.Vector3();
  let localP = 0;
  let active = false;

  /** 스크롤 진행(막 로컬 p 0..1) 반영 */
  function update(p) {
    localP = p;
    active = true;
    // 낙하 속도: 초반 가속 → 덱 접근(p→1)에서 감속
    const speed = 7 * Math.min(1, p * 4 + 0.25) * (1 - 0.85 * p * p);
    clouds.setFall(speed);
  }

  /** 막을 벗어날 때(덱 진입) 잔여 상태 정리 */
  function leave() {
    active = false;
    clouds.setFall(0.6); // 덱에선 아주 느린 부유만
  }

  /** 매 프레임: 마우스 스무딩 + 텀블링 + 카메라 */
  function tickFrame(dt, elapsed) {
    if (!active || !duck) return;
    const k = Math.min(1, dt * 5);
    smooth.x += (mouse.x - smooth.x) * k;
    smooth.y += (mouse.y - smooth.y) * k;

    const g = duck.group;
    // 마우스 좌우 → 옆으로 슬라이드 + 뱅크, 상하 → 피치
    g.position.x = smooth.x * 1.7;
    g.position.y = -smooth.y * 0.6 + Math.sin(elapsed * 1.1) * 0.12;
    g.position.z = 0;
    g.rotation.z = -smooth.x * 0.55 + Math.sin(elapsed * 0.7) * 0.05;
    duck.pivot.rotation.x =
      Math.PI * 0.45 + smooth.y * 0.2 + Math.sin(elapsed * 0.9) * 0.04;

    // 카메라: 측하단에서 헤드다운 다이빙을 올려다봄 — 고글·하늘·구름이 모두 프레임에
    camera.position.set(0.9 + smooth.x * 0.5, -2.3 - localP * 0.4, 3.5);
    lookTarget.set(g.position.x, g.position.y - 0.3, 0);
    camera.lookAt(lookTarget);
  }

  return { update, leave, tickFrame };
}
