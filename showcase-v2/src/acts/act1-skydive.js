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

  const DEPLOY_AT = 0.72; // 팀 소개(덱) 직전 낙하산 전개
  let chuteScale = 0;

  /** 스크롤 진행(막 로컬 p 0..1) 반영 */
  function update(p) {
    localP = p;
    active = true;
    const chute = duck.parachute;
    if (p >= DEPLOY_AT) {
      // 전개: 급감속 (구름 스크롤 뚝 떨어짐)
      if (chute && !chute.visible) {
        chute.visible = true;
        chuteScale = 0.05;
      }
      clouds.setFall(2.2 * (1 - p) + 0.8);
    } else {
      if (chute) chute.visible = false;
      chuteScale = 0;
      // 자유낙하: 초반부터 빠르게 (점프 직후 가속감)
      clouds.setFall(12 * Math.min(1, p * 5 + 0.35));
    }
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
    // 낙하산 전개 후: 직립으로 세워지고 캐노피가 팝(스케일 스프링)
    const deployed = duck.parachute?.visible;
    const targetPitch = deployed ? 0.12 : Math.PI * 0.45;
    duck.pivot.rotation.x +=
      (targetPitch + smooth.y * 0.2 + Math.sin(elapsed * 0.9) * 0.04 -
        duck.pivot.rotation.x) *
      Math.min(1, dt * 6);
    if (deployed && chuteScale < 1) {
      chuteScale = Math.min(1, chuteScale + dt * 3.2);
      const s = 1 + Math.sin(chuteScale * Math.PI) * 0.18; // 오버슈트 팝
      duck.parachute.scale.setScalar(chuteScale * s);
    }

    // 카메라: 측하단에서 헤드다운 다이빙을 올려다봄 — 고글·하늘·구름이 모두 프레임에
    // 좁은 화면(모바일)에선 뒤로 물러나 덕식이가 프레임을 다 채우지 않게
    const mob = window.innerWidth <= 640 ? 1 : 0;
    camera.position.set(
      0.9 + smooth.x * 0.5,
      -2.3 - localP * 0.4 - mob * 0.7,
      3.5 + mob * 2.4
    );
    lookTarget.set(g.position.x, g.position.y - 0.3, 0);
    camera.lookAt(lookTarget);
  }

  return { update, leave, tickFrame };
}
