// 성지덕 쇼케이스 v2 — 부트스트랩
// WebGL 판정 → 씬 초기화(Task 2에서 구현) → 스크럽 배선(Task 3에서 구현).
// 실패 시 항상 DOM 문서 모드로 폴백해 콘텐츠 접근성을 보장한다.

import "./styles/main.css";
import { actProgress } from "./core/timeline.js";

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext("webgl2") || c.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

/** WebGL 불가/로드 실패 → DOM 전용 문서 모드 */
export function useFallback(reason) {
  console.warn("3D 여정 폴백:", reason);
  document.documentElement.classList.remove("scene-ready");
  document.documentElement.classList.add("no-webgl", "loading-done");
  const fallback = document.getElementById("fallback");
  if (fallback) fallback.hidden = false;
}

async function boot() {
  if (!hasWebGL()) return useFallback("no-webgl");
  // Task 2: initScene()이 렌더러/스카이/구름/로딩을 구성한다.
  console.debug("boot ok — 현재 막:", actProgress(0));
}

boot();
