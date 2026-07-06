// 3D 앵커 ↔ DOM 패널 동기화.
// 월드 좌표를 매 프레임 project()해서 #overlay-root 안의 요소를 CSS transform으로 배치한다.
// (텍스트는 항상 DOM — v1 가독성 교훈. 3D엔 앵커만 존재한다.)

import * as THREE from "three";

export function createOverlay(camera, root = document.getElementById("overlay-root")) {
  const items = []; // { obj, el }
  const v = new THREE.Vector3();

  /** object3d(또는 Vector3를 가진 더미)를 DOM 요소와 묶는다 */
  function anchor(obj, el) {
    root.appendChild(el);
    items.push({ obj, el });
    return el;
  }

  /** 매 프레임 호출: 스크린 좌표 갱신 + 카메라 뒤/프러스텀 밖 숨김 */
  function update() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const { obj, el } of items) {
      obj.getWorldPosition(v);
      v.project(camera);
      const off = v.z > 1 || v.x < -1.3 || v.x > 1.3 || v.y < -1.3 || v.y > 1.3;
      if (off) {
        el.style.visibility = "hidden";
        continue;
      }
      el.style.visibility = "visible";
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  }

  function clear() {
    for (const { el } of items) el.remove();
    items.length = 0;
  }

  return { anchor, update, clear };
}
