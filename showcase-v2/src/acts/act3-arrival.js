// ACT 3 — ARRIVAL (전역 t 0.55 → 1.0)
// 화이트아웃을 뚫고 성지 마을 착륙 → 덕식이가 자전거로 도로를 달리며
// 정거장 4곳(PLAN/PROGRESS/API/TS)에서 패널이 도킹된다. 마지막은 토리이 앞 도착.

import * as THREE from "three";
import { stationWindow } from "../core/stations.js";
import { segment } from "../core/timeline.js";
import { createAirplane } from "../scenes/airplane.js";

const RIDE_START = 0.12; // 화이트아웃이 걷힌 뒤 주행 시작(로컬 p)
const RIDE_END = 0.96;

export function createAct3({ camera, duck, clouds, overlay, village, road, bicycle, flag, panels }) {
  let active = false;
  let entered = false;
  let lastDist = 0;
  let localP = 0;

  const camPos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  // 정거장 앵커에 패널 부착
  const anchors = village.group.userData.stationAnchors || {};
  for (const st of village.stations) {
    const a = anchors[st.name];
    const el = panels[st.name];
    if (a && el) overlay.anchor(a, el);
  }

  // 피날레 CTA: 토리이(도로 p 0.95) 위쪽 앵커
  let finaleAnchor = null;
  if (panels.FINALE) {
    const toriiAt = road.at(0.95);
    finaleAnchor = new THREE.Object3D();
    finaleAnchor.position.set(toriiAt.pos[0], 3.4, toriiAt.pos[2]);
    village.group.add(finaleAnchor);
    overlay.anchor(finaleAnchor, panels.FINALE);
  }

  // 피날레 픽업 비행기 (토리이 상공으로 하강 → 덕식이 태우고 상승)
  const plane = createAirplane();
  plane.group.visible = false;
  plane.group.rotation.y = Math.PI; // 기수 -Z (도로 진행 방향)
  village.group.add(plane.group);

  // 자전거 + 깃발 배치 (깃발은 짐받이 뒤 바깥쪽 — 덕식이와 겹치지 않게)
  bicycle.group.scale.setScalar(1.45);
  flag.group.scale.setScalar(0.6);
  flag.group.position.set(-0.85, 0.4, 0.3);
  flag.group.rotation.y = -0.35;
  bicycle.group.add(flag.group);
  bicycle.group.visible = false;
  village.group.add(bicycle.group);

  function enter() {
    entered = true;
    village.group.visible = true;
    bicycle.group.visible = true;
    duck.setPose("ride");
    // 덕식이를 안장에 재부모화 (월드 → 자전거 로컬)
    bicycle.seatMount.add(duck.group);
    duck.group.position.set(0, 0.05, 0);
    duck.group.rotation.set(0, Math.PI / 2, 0); // 모델 정면(+Z)→자전거 전방(+X)
    duck.group.scale.setScalar(0.5); // seatMount는 자전거 스케일(1.45)을 상속
    clouds.setFall(0);
  }

  function exit() {
    entered = false;
    village.group.visible = false;
    bicycle.group.visible = false;
    duck.setPose("skydive");
    // 씬 루트로 복귀 (ACT1/2가 월드 좌표로 제어)
    duck.group.removeFromParent();
    duck.group.rotation.set(0, 0, 0);
    duck.group.scale.setScalar(1);
    village.group.parent?.add?.(duck.group);
  }

  /** 로컬 p(0..1) 반영 */
  function update(p) {
    localP = p;
    active = true;
    if (!entered) enter();

    // 주행 진행도 — 종점은 토리이(도로 p 0.95) 직전에서 멈춘다
    const rideP =
      THREE.MathUtils.clamp((p - RIDE_START) / (RIDE_END - RIDE_START), 0, 1) * 0.93;

    const { pos, tangent } = road.at(rideP);
    bicycle.group.position.set(pos[0], pos[1], pos[2]);
    // 탄젠트 방향으로 회전 (도로는 y=0 평면)
    const yaw = Math.atan2(-tangent[2], tangent[0]);
    bicycle.group.rotation.set(0, yaw, 0);

    // 바퀴 회전
    const dist = rideP * (road.length || 80);
    bicycle.spin(dist - lastDist);
    lastDist = dist;

    // 카메라: 뒤따라오는 팔로우 (도로 뒤 + 위)
    const back = road.at(Math.max(0, rideP - 0.045));
    camPos.set(back.pos[0], back.pos[1] + 3.4, back.pos[2]); // 마치야 지붕 높이 위로
    // 진행 방향 반대쪽으로 살짝 당겨 어깨 너머 구도
    camPos.x -= tangent[0] * 1.6;
    camPos.z -= tangent[2] * 1.6;
    look.set(pos[0] + tangent[0] * 3, pos[1] + 1.15, pos[2] + tangent[2] * 3);

    // 피날레 CTA: 종점 접근 시 페이드 인
    if (panels.FINALE) {
      const fw =
        THREE.MathUtils.clamp((rideP - 0.9) / 0.03, 0, 1) *
        (1 - segment(p, 0.968, 0.985)); // TS 정거장 통과 후 토리이 도착 시점에만
      panels.FINALE.style.opacity = String(fw);
      panels.FINALE.style.pointerEvents = fw > 0.5 ? "auto" : "none";
    }

    // 정거장 패널 페이드 + 카메라가 패널 쪽으로 살짝 팬
    for (const st of village.stations) {
      const w = stationWindow(rideP, st.p, 0.085);
      const el = panels[st.name];
      if (el) {
        el.style.opacity = String(w);
        el.style.pointerEvents = w > 0.4 ? "auto" : "none";
      }
      if (w > 0) {
        const a = anchors[st.name];
        if (a) {
          look.lerp(a.position, w * 0.35);
          camPos.y += w * 0.3;
        }
      }
    }

    // 피날레 루프: 비행기 하강(0.90~0.95) → 탑승(0.945, 덕식이 숨김) → 상승 → 화이트아웃(0.962~1)
    const pick = segment(p, 0.955, 0.985);
    const climb = segment(p, 0.985, 1);
    plane.group.visible = pick > 0;
    if (plane.group.visible) {
      plane.group.position.set(
        pos[0],
        9 - 6.6 * pick + 9 * climb * climb,
        pos[2] - 4 - 6 * pick - 22 * climb
      );
      plane.group.rotation.x = -0.35 * climb; // 상승 피치
    }
    duck.group.visible = p < 0.982; // 탑승 순간 자전거에서 비행기로
    if (p > 0.97) clouds.whiteout(segment(p, 0.985, 0.999)); // 상승하며 구름 속으로

    // 카메라 적용은 tickFrame의 감쇠 추적이 담당 (스크롤 스냅 방지)
  }

  function leave() {
    active = false;
    plane.group.visible = false;
    duck.group.visible = true;
    if (entered) exit();
    for (const st of village.stations) {
      const el = panels[st.name];
      if (el) el.style.opacity = "0";
    }
    // 피날레 CTA도 반드시 리셋 — 역스크롤/루프로 이탈 시 문구가 다른 막 위에 잔존하던 버그
    if (panels.FINALE) {
      panels.FINALE.style.opacity = "0";
      panels.FINALE.style.pointerEvents = "none";
    }
  }

  function tickFrame(dt) {
    if (!active) return;
    flag.update(dt);
    if (plane.group.visible) plane.propeller.rotation.z += dt * 26;
    // 페달링 느낌: 안장 위 미세 바운스 (정적 메시 보완)
    if (duck.group.visible && entered) {
      duck.group.position.y = 0.05 + Math.abs(Math.sin(performance.now() * 0.008)) * 0.045;
    }
    // 부드러운 팔로우: 목표 지점으로 감쇠 추적 (프레임 경합 방지 겸)
    const k = 1 - Math.pow(0.002, dt); // dt 독립 감쇠
    camera.position.lerp(camPos, k);
    camera.up.copy(up);
    camera.lookAt(look);
  }

  return { update, leave, tickFrame };
}
