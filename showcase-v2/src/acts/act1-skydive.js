// ACT 1 — SKYDIVE (전역 t 0 → 0.30)
// 오프닝: 경비행기가 프레임을 가로질러 날고, 덕식이가 p≈0.03에 분리(점프)해 자유낙하로 전환.
// 고글 덕식이 자유낙하: 카메라는 등 뒤 상단에서 아래(구름)를 향한다 (레퍼런스 1 구도).
// 마우스 X/Y → 덕식이 기울기 + 카메라 미세 패럴랙스. 낙하 체감은 구름 수직 스크롤로.
// 모든 연출 상태는 로컬 p의 순수 함수 — 역방향 스크롤에도 그대로 복원된다(누적 상태 금지).

import * as THREE from "three";
import { segment } from "../core/timeline.js";
import { createAirplane } from "../scenes/airplane.js";

const DETACH = 0.03; // 비행기에서 분리(점프) 시점
const DROP_END = 0.13; // 분리 → 자유낙하 자세/위치 블렌드 완료
const PLANE_HIDE = 0.15; // 비행기 퇴장(프레임 밖 + 숨김)

/** 비행기 궤적 — p의 순수 함수: 좌→우 직진 통과 + 살짝 상승 (p 0.15에 프레임 밖) */
function planePose(p, out) {
  const s = Math.min(1, p / PLANE_HIDE);
  out.set(-4.5 + 14 * s, 3.9 + 1.3 * s, -2.3);
  return out;
}

export function createAct1({ camera, duck, clouds }) {
  const mouse = { x: 0, y: 0 }; // 목표(-1..1)
  const smooth = { x: 0, y: 0 }; // 스무딩된 현재값

  window.addEventListener("pointermove", (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  });

  const lookTarget = new THREE.Vector3();
  const planePos = new THREE.Vector3();
  const carryPos = new THREE.Vector3();
  let localP = 0;
  let active = false;

  const DEPLOY_AT = 0.72; // 팀 소개(덱) 직전 낙하산 전개
  let chuteScale = 0;

  // 경비행기: 기수 +Z → 요 회전으로 +X 방향 비행, 살짝 뱅크
  const airplane = createAirplane();
  const group = new THREE.Group(); // 씬 부착용 (main.js가 add)
  group.name = "act1-props";
  airplane.group.rotation.set(0.04, Math.PI / 2, -0.05);
  airplane.group.scale.setScalar(0.85); // 덕식이 대비 과점유 방지(측하단 구도에서 원근 크게 잡힘)
  group.add(airplane.group);

  /** 비행기 배치 — p의 순수 함수(리듀스드 모션의 단발 update에서도 동작) */
  function placePlane(p) {
    airplane.group.visible = active && p < PLANE_HIDE;
    if (!airplane.group.visible) return;
    airplane.group.position.copy(planePose(p, planePos));
  }

  /** 스크롤 진행(막 로컬 p 0..1) 반영 */
  function update(p) {
    localP = p;
    active = true;
    placePlane(p);
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
      // 탑승 중엔 순항(거의 정지) → 분리 후 자유낙하 가속
      const fallRamp = segment(p, DETACH, DROP_END);
      clouds.setFall(0.5 + 11.5 * fallRamp * fallRamp);
    }
  }

  /** 막을 벗어날 때(덱 진입) 잔여 상태 정리 */
  function leave() {
    active = false;
    airplane.group.visible = false;
    clouds.setFall(0.6); // 덱에선 아주 느린 부유만
  }

  /** 매 프레임: 마우스 스무딩 + 텀블링 + 카메라 (+ 프로펠러 스핀) */
  function tickFrame(dt, elapsed) {
    if (!active || !duck) return;
    const p = localP;
    const k = Math.min(1, dt * 5);
    smooth.x += (mouse.x - smooth.x) * k;
    smooth.y += (mouse.y - smooth.y) * k;

    // 프로펠러: elapsed의 함수(순수 시각 효과)
    if (airplane.group.visible) airplane.propeller.rotation.z = elapsed * 26;

    // 분리 블렌드: 0(탑승) → 1(자유낙하), ease-in으로 낙하 가속감
    const d = segment(p, DETACH, DROP_END);
    const drop = d * d;

    const g = duck.group;
    // 자유낙하 목표: 마우스 좌우 → 옆으로 슬라이드 + 뱅크, 상하 → 피치
    const fx = smooth.x * 1.7;
    const fy = -smooth.y * 0.6 + Math.sin(elapsed * 1.1) * 0.12;
    // 탑승 목표: 비행기(분리 전엔 현재 위치, 분리 후엔 분리 시점 위치) 문가에 매달림
    planePose(Math.min(p, DETACH), carryPos);
    carryPos.x += 0.1; // 기체 등(동체 위)에 앉은 오프닝
    carryPos.y += 0.85;
    carryPos.z -= 0.1;
    g.position.set(
      THREE.MathUtils.lerp(carryPos.x, fx, drop),
      THREE.MathUtils.lerp(carryPos.y, fy, drop),
      THREE.MathUtils.lerp(carryPos.z, 0, drop)
    );
    // 뱅크(롤)는 자유낙하에서만 + 점프 직후 360° 스핀(p의 순수 함수, 역방향 복원)
    g.rotation.z = (-smooth.x * 0.55 + Math.sin(elapsed * 0.7) * 0.05) * drop;
    g.rotation.y = segment(p, DETACH, DROP_END + 0.08) * Math.PI * 2;

    // 낙하산 전개 후: 직립으로 세워지고 캐노피가 팝(스케일 스프링)
    const deployed = duck.parachute?.visible;
    // 탑승(직립 대기) → 헤드다운 다이브 → 전개 후 직립
    const targetPitch = deployed
      ? 0.12
      : THREE.MathUtils.lerp(0.15, Math.PI * 0.45, drop);
    duck.pivot.rotation.x +=
      (targetPitch + smooth.y * 0.2 * drop + Math.sin(elapsed * 0.9) * 0.04 -
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
    // 초반(p<0.08)엔 살짝 위(비행기 쪽)를 봐서 점프 순간이 프레임에 들어오게
    const upBias = 1 - segment(p, 0, 0.08);
    if (upBias > 0) lookTarget.lerp(planePose(p, planePos), 0.32 * upBias);
    camera.lookAt(lookTarget);
  }

  return { group, update, leave, tickFrame };
}
