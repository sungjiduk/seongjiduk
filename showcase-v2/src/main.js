// 성지덕 쇼케이스 v2 — 부트스트랩 + 베이스 씬
// 단일 WebGLRenderer/Scene. 막 전환은 카메라·포그·그룹 가시성으로 처리(씬 교체 없음).
// WebGL 불가/생성 실패 시 항상 DOM 문서 모드로 폴백해 콘텐츠 접근성을 보장한다.

import "./styles/main.css";
import * as THREE from "three";
import { segment, actProgress, ACTS } from "./core/timeline.js";
import { createSky } from "./scenes/sky.js";
import { createClouds } from "./scenes/clouds.js";
import { createLoading } from "./ui/loading.js";

export const prefersReduced = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;
export const isSmall = window.matchMedia("(max-width: 640px)").matches;

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

/**
 * 렌더러/씬/카메라/프레임 루프를 구성한다. (v1 hero.js 방어 패턴 이식)
 * @returns {{renderer, scene, camera, tick(cb):()=>void} | null} 실패 시 null(폴백은 호출부 책임 아님 — 여기서 처리)
 */
export function initScene() {
  const canvas = document.getElementById("scene-canvas");
  if (!canvas) {
    useFallback("canvas 없음");
    return null;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isSmall,
      powerPreference: "high-performance",
    });
  } catch (err) {
    useFallback(err);
    return null;
  }
  // 일부 환경은 throw 없이 컨텍스트 null을 반환한다 (v1 교훈)
  if (!renderer || typeof renderer.getContext !== "function" || !renderer.getContext()) {
    useFallback("WebGL 컨텍스트 없음");
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 2)); // DPR cap
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    120
  );
  camera.position.set(0, 0, 8);
  scene.add(camera); // 카메라 자식(화이트아웃 쿼드 등) 렌더를 위해 필수

  // 라이팅: 석양 키 + 하늘/지면 헤미 (마을·덕식이 공용 베이스)
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x3a2c22, 0.7));
  const key = new THREE.DirectionalLight(0xffd9a0, 1.3);
  key.position.set(4, 6, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9ec7ff, 0.5);
  rim.position.set(-5, 2, -4);
  scene.add(rim);

  // 프레임 콜백 레지스트리
  const callbacks = new Set();
  /** 매 프레임 cb(dt, elapsed) 호출을 등록. 반환 함수로 해제. */
  function tick(cb) {
    callbacks.add(cb);
    return () => callbacks.delete(cb);
  }

  const timer = new THREE.Timer();
  let raf = 0;
  function renderOnce() {
    renderer.render(scene, camera);
  }
  function animate() {
    raf = requestAnimationFrame(animate);
    timer.update();
    const dt = timer.getDelta();
    for (const cb of callbacks) cb(dt, timer.getElapsed());
    renderer.render(scene, camera);
  }

  if (prefersReduced) {
    // 정적 모드: 루프 없이 1프레임 (스크럽 연출은 Task 3+에서도 미배선)
    requestAnimationFrame(renderOnce);
  } else {
    animate();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else animate();
    });
  }

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (prefersReduced) renderOnce();
  });

  return { renderer, scene, camera, tick, renderOnce };
}

async function boot() {
  if (!hasWebGL()) return useFallback("no-webgl");

  const loading = createLoading();
  const ctx = initScene();
  if (!ctx) return; // initScene이 폴백 처리 완료

  const { scene, camera, tick, renderOnce } = ctx;
  const sky = createSky(scene);
  const clouds = createClouds(scene, camera, {
    clusterCount: isSmall ? 5 : 10, // 모바일 경량화
  });

  tick((dt) => {
    sky.update(dt);
    clouds.update(dt);
  });

  // --- 임시 스크롤 배선 (Task 3에서 GSAP ScrollTrigger 스크럽으로 교체) ---
  // 전역 t: #scroll-space가 만드는 문서 스크롤 진행도 0..1
  const state = { t: 0 };
  function updateFromScroll(t) {
    state.t = t;
    const { act } = actProgress(t);
    // 고고도(space) → 하강하며 새벽 하늘로
    sky.setBlend(1 - segment(t, 0, ACTS.deck[1]));
    // 구름: 낙하 중 짙어지고, 덱에서 최대, 화이트아웃 뒤 마을에선 걷힘
    clouds.setDensity(0.45 + 0.55 * segment(t, 0, ACTS.deck[1]) - segment(t, 0.68, 0.85));
    // ACT3 진입 화이트아웃: 0.55 부근 급증 → 마을 페이드 인
    clouds.whiteout(segment(t, ACTS.arrival[0], 0.63) * (1 - segment(t, 0.66, 0.8)));
    document.body.dataset.act = act;
  }
  if (!prefersReduced) {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      updateFromScroll(max > 0 ? window.scrollY / max : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  } else {
    updateFromScroll(0);
  }

  // 베이스 씬은 GLB 로드가 없으므로 첫 프레임 직후 로딩 종료
  // (Task 3에서 duck.glb가 loading.manager를 사용하면 onLoad가 이어받는다)
  requestAnimationFrame(() => {
    renderOnce();
    document.documentElement.classList.add("scene-ready");
    loading.done();
  });

  // 디버그/프리뷰 검증용 핸들 (앱 로직은 의존하지 않음)
  window.__sjd = { ...ctx, sky, clouds, state, updateFromScroll };
}

boot();
