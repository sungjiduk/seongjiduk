// ACT 2 — CLOUD DECK (전역 t 0.30 → 0.55)
// 낙하 감속 → 구름 바다 위 부유. 구름 사이 3D 앵커에 팀/소개/진행률/링크 카드가
// 스태거로 떠오른다 (레퍼런스 2 구도). 카드 본문은 DOM(가독성), 3D엔 앵커만.

import * as THREE from "three";

const easeOut = (x) => 1 - Math.pow(1 - x, 3);

// 카드 앵커 월드 좌표 (카메라 z≈6.5, fov50 기준 프레임 안)
const SLOTS = [
  // 크루 3 (윗줄)
  { pos: [-3.2, 1.35, -0.6], at: 0.18 },
  { pos: [0, 1.55, -1.0], at: 0.26 },
  { pos: [3.2, 1.35, -0.6], at: 0.34 },
  // 소개 · 진행률 · 링크 (아랫줄)
  { pos: [-3.1, -1.05, 0.2], at: 0.46 },
  { pos: [0, -1.25, -0.2], at: 0.54 },
  { pos: [3.1, -1.05, 0.2], at: 0.62 },
];

export function createAct2({ camera, duck, clouds, overlay, cards }) {
  const group = new THREE.Group();
  group.name = "deck-anchors";

  cards.forEach((card, i) => {
    const slot = SLOTS[i % SLOTS.length];
    const a = new THREE.Object3D();
    a.position.set(...slot.pos);
    a.userData.at = slot.at;
    a.userData.bobPhase = i * 1.3;
    group.add(a);
    card.el.classList.add("deck-card--hidden");
    overlay.anchor(a, card.el);
    card.anchorObj = a;
  });

  const camFrom = new THREE.Vector3(0.9, -2.7, 3.5); // act1 종료 근사
  const camTo = new THREE.Vector3(0, 0.5, 6.6);
  const lookFrom = new THREE.Vector3(0, -0.6, 0);
  const lookTo = new THREE.Vector3(0, 0.15, 0);
  const camPos = new THREE.Vector3();
  const look = new THREE.Vector3();

  let localP = 0;
  let active = false;

  function update(p) {
    localP = p;
    active = true;
    group.visible = true;

    // 카메라: 다이빙 앵글 → 수평 부유 앵글 (초반 30%에 감속 전환)
    const cp = easeOut(Math.min(1, p / 0.35));
    camPos.lerpVectors(camFrom, camTo, cp);
    look.lerpVectors(lookFrom, lookTo, cp);

    // 덕식이: 헤드다운 → 직립 부유, 카드 위 중앙으로
    const dp = easeOut(Math.min(1, p / 0.4));
    duck.pivot.rotation.x = THREE.MathUtils.lerp(Math.PI * 0.45, 0.05, dp);
    duck.group.position.set(0, THREE.MathUtils.lerp(-0.4, 1.95, dp), -0.6);
    duck.group.rotation.z = 0;
    duck.group.scale.setScalar(THREE.MathUtils.lerp(1, 0.72, dp));

    // 카드 스태거 등장
    for (const a of group.children) {
      const on = p >= a.userData.at;
      const elCard = cardsByAnchor.get(a);
      if (elCard) elCard.classList.toggle("deck-card--hidden", !on);
    }
  }

  const cardsByAnchor = new Map(cards.map((c) => [c.anchorObj, c.el]));

  function leave(toAct) {
    active = false;
    if (toAct === "arrival") {
      // 화이트아웃으로 가려지는 동안 카드 숨김
      for (const c of cards) c.el.classList.add("deck-card--hidden");
    }
  }

  function tickFrame(dt, elapsed) {
    if (!active) return;
    // 앵커 미세 부유 → 카드가 구름 위에서 살짝 떠다니는 느낌
    for (const a of group.children) {
      a.position.y += Math.sin(elapsed * 0.9 + a.userData.bobPhase) * 0.0009;
    }
    duck.group.position.y += Math.sin(elapsed * 1.2) * 0.004;
    camera.position.copy(camPos);
    camera.lookAt(look);
  }

  return { group, update, leave, tickFrame };
}
