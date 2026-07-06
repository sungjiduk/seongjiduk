// 로딩 스크린 — 보딩패스 UI + THREE.LoadingManager 연동.
// manager를 로더(GLTFLoader 등)에 물리면 진행률이 자동 반영되고,
// 아무것도 로드하지 않는 부트 경로에서는 loading.done()을 직접 호출한다.

import * as THREE from "three";

/**
 * @returns {{ manager: THREE.LoadingManager, setProgress(r:number):void, done():void }}
 */
export function createLoading() {
  const fill = document.querySelector("[data-loading-fill]");
  const pct = document.querySelector("[data-loading-pct]");
  let finished = false;

  function setProgress(ratio) {
    const r = Math.min(1, Math.max(0, ratio));
    if (fill) fill.style.width = `${Math.round(r * 100)}%`;
    if (pct) pct.textContent = `${Math.round(r * 100)}%`;
  }

  /** 로딩 완료 — 바 100% 채우고 스크린 페이드아웃 (중복 호출 안전) */
  function done() {
    if (finished) return;
    finished = true;
    setProgress(1);
    // 100%가 잠깐 보이도록 다음 프레임에 페이드
    requestAnimationFrame(() => {
      document.documentElement.classList.add("loading-done");
    });
  }

  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => {
    if (total > 0) setProgress(loaded / total);
  };
  manager.onLoad = () => done();

  return { manager, setProgress, done };
}
