// 성지덕 쇼케이스 v2 — 부트스트랩 + 베이스 씬
// 단일 WebGLRenderer/Scene. 막 전환은 카메라·포그·그룹 가시성으로 처리(씬 교체 없음).
// WebGL 불가/생성 실패 시 항상 DOM 문서 모드로 폴백해 콘텐츠 접근성을 보장한다.

import "./styles/main.css";
import "./styles/stations.css";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { segment, actProgress, ACTS } from "./core/timeline.js";
import { createSky } from "./scenes/sky.js";
import { createClouds } from "./scenes/clouds.js";
import { loadDuck } from "./scenes/duck.js";
import { createAct1 } from "./acts/act1-skydive.js";
import { createAct2 } from "./acts/act2-deck.js";
import { createAct3 } from "./acts/act3-arrival.js";
import { buildVillage } from "./scenes/village.js";
import { createRoad } from "./core/path.js";
import { createBicycle } from "./scenes/bicycle.js";
import { createFlag } from "./scenes/flag.js";
import { createOverlay } from "./ui/overlay.js";
import {
  buildDeckCards,
  buildStationPanels,
  buildFinalePanel,
  loadJSON,
} from "./ui/panels.js";
import { createLoading } from "./ui/loading.js";
import { createSound } from "./ui/sound.js";

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

/** WebGL 불가/로드 실패 → DOM 전용 문서 모드 (콘텐츠는 정적 패널로 전부 렌더) */
let fallbackRendered = false;
export function useFallback(reason) {
  console.warn("3D 여정 폴백:", reason);
  document.documentElement.classList.remove("scene-ready");
  document.documentElement.classList.add("no-webgl", "loading-done");
  const fallback = document.getElementById("fallback");
  if (fallback) fallback.hidden = false;
  renderFallbackContent(fallback);
}

async function renderFallbackContent(container) {
  if (!container || fallbackRendered) return;
  fallbackRendered = true;
  const [team, progress, schedule, apiSpec, ts] = await Promise.all(
    ["team", "progress", "schedule", "api-spec", "troubleshooting"].map((n) =>
      loadJSON(`data/${n}.json`).catch(() => null)
    )
  );
  const stack = document.createElement("div");
  stack.className = "fallback-stack";
  for (const card of buildDeckCards({ team, progress })) stack.appendChild(card.el);
  const panels = buildStationPanels({
    schedule,
    progress,
    apiSpec,
    troubleshooting: ts,
  });
  for (const key of ["PLAN", "PROGRESS", "API", "TS"]) {
    if (panels[key]) stack.appendChild(panels[key]);
  }
  stack.appendChild(buildFinalePanel(team?.project?.links));
  container.appendChild(stack);
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
  renderer.shadowMap.enabled = !isSmall; // 모바일은 그림자 생략(성능)
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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
  key.position.set(24, 36, 18);
  key.castShadow = !isSmall;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -50;
  key.shadow.camera.right = 50;
  key.shadow.camera.top = 60;
  key.shadow.camera.bottom = -60;
  key.shadow.camera.far = 120;
  key.shadow.bias = -0.0006;
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

  // 포스트 프로세싱: 은은한 블룸 (모바일은 성능 위해 생략)
  let composer = null;
  if (!isSmall) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.22, // strength — 창문·석양 하이라이트만 살짝
      0.55, // radius
      0.85 // threshold
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  const timer = new THREE.Timer();
  let raf = 0;
  function renderOnce() {
    if (composer) composer.render();
    else renderer.render(scene, camera);
  }
  function animate() {
    raf = requestAnimationFrame(animate);
    timer.update();
    // 탭 전환/스로틀 복귀 시 dt 스파이크가 이동 로직을 폭주시키지 않도록 클램프
    const dt = Math.min(timer.getDelta(), 0.05);
    for (const cb of callbacks) cb(dt, timer.getElapsed());
    renderOnce();
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
    composer?.setSize(window.innerWidth, window.innerHeight);
    if (prefersReduced) renderOnce();
  });

  return { renderer, scene, camera, tick, renderOnce };
}

async function boot() {
  if (!hasWebGL()) return useFallback("no-webgl");

  const loading = createLoading();
  const sound = createSound();
  const ctx = initScene();
  if (!ctx) return; // initScene이 폴백 처리 완료

  const { scene, camera, tick, renderOnce } = ctx;
  const sky = createSky(scene);
  const clouds = createClouds(scene, camera, {
    clusterCount: isSmall ? 7 : 16, // 모바일 경량화
    spread: 13,
    zNear: -2,
    zDepth: 14, // 카메라가 내려다보는 낙하 컬럼 안에 배치
  });

  // 덕식이 로드(loading.manager → 완료 시 로딩 스크린 자동 종료) + 카드 데이터
  let duck = null;
  let act1 = null;
  let act2 = null;
  let act3 = null;
  const overlay = createOverlay(camera);
  try {
    const [duckLoaded, teamRes, progressRes, scheduleRes, apiRes, tsRes] =
      await Promise.all([
        loadDuck(loading.manager),
        loadJSON("data/team.json").catch(() => null),
        loadJSON("data/progress.json").catch(() => null),
        loadJSON("data/schedule.json").catch(() => null),
        loadJSON("data/api-spec.json").catch(() => null),
        loadJSON("data/troubleshooting.json").catch(() => null),
      ]);
    duck = duckLoaded;
    duck.setPose("skydive");
    scene.add(duck.group);
    act1 = createAct1({ camera, duck, clouds });
    const cards = buildDeckCards({ team: teamRes, progress: progressRes });
    act2 = createAct2({ camera, duck, clouds, overlay, cards });
    scene.add(act2.group);

    // ACT3: 마을 + 도로 + 자전거 + 깃발 + 정거장 패널
    const village = buildVillage(scene);
    const road = createRoad(village.roadPoints);
    road.length = road.curve.getLength();
    const stationPanels = buildStationPanels({
      schedule: scheduleRes,
      progress: progressRes,
      apiSpec: apiRes,
      troubleshooting: tsRes,
    });
    stationPanels.FINALE = buildFinalePanel(teamRes?.project?.links);
    act3 = createAct3({
      camera,
      duck,
      clouds,
      overlay,
      village,
      road,
      bicycle: createBicycle(),
      flag: createFlag(),
      panels: stationPanels,
    });

    // 그림자 플래그 (자전거·깃발은 village.group 자식이라 함께 순회됨)
    if (!isSmall) {
      duck.group.traverse((o) => {
        if (o.isMesh) o.castShadow = true;
      });
      village.group.traverse((o) => {
        if (o.isMesh || o.isInstancedMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
    }
  } catch (err) {
    return useFallback(err);
  }

  tick((dt, elapsed) => {
    sky.update(dt);
    clouds.update(dt);
    act1?.tickFrame(dt, elapsed);
    act2?.tickFrame(dt, elapsed);
    act3?.tickFrame(dt, elapsed);
    overlay.update();
  });

  // --- 스크롤 배선: GSAP ScrollTrigger 스크럽 ---
  const state = { t: 0 };
  let lastAct = "skydive";
  function updateFromScroll(t) {
    state.t = t;
    const { act, p } = actProgress(t);
    // 살짝 고고도 틴트에서 시작 → 하강하며 밝은 새벽 하늘로
    sky.setBlend(0.12 * (1 - segment(t, 0, ACTS.deck[1])));
    // 구름: 낙하 내내 짙고, 덱에서 최대, 화이트아웃 뒤 마을에선 걷힘
    clouds.setDensity(
      0.7 + 0.3 * segment(t, 0, ACTS.deck[1]) - segment(t, 0.68, 0.85)
    );
    // ACT3 진입 화이트아웃: 0.55 부근 급증 → 마을 페이드 인
    clouds.whiteout(
      segment(t, ACTS.arrival[0], 0.63) * (1 - segment(t, 0.66, 0.8))
    );

    // 막 전환은 인접 이동뿐 아니라 점프(빠른 스크롤/앵커)도 가능 — 이전 막을 항상 정리
    const actsMap = { skydive: act1, deck: act2, arrival: act3 };
    if (act !== lastAct) actsMap[lastAct]?.leave?.(act);
    actsMap[act]?.update(p);
    lastAct = act;
    document.body.dataset.act = act;
    sound.setAct(act);
  }

  if (!prefersReduced) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.create({
      trigger: "#scroll-space",
      start: "top top",
      end: "bottom bottom",
      scrub: 0.6,
      invalidateOnRefresh: true,
      onUpdate: (self) => updateFromScroll(self.progress),
    });
    // 비동기 DOM 높이 변화(패널 렌더 등) → 스크롤 범위 재측정 (v1 교훈)
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);
    if ("ResizeObserver" in window) {
      let lastH = document.body.scrollHeight;
      new ResizeObserver(() => {
        const h = document.body.scrollHeight;
        if (Math.abs(h - lastH) > 40) {
          lastH = h;
          refresh();
        }
      }).observe(document.body);
    }
    updateFromScroll(0);
  } else {
    updateFromScroll(0);
  }

  requestAnimationFrame(() => {
    renderOnce();
    document.documentElement.classList.add("scene-ready");
  });

  // 디버그/프리뷰 검증용 핸들 (앱 로직은 의존하지 않음)
  window.__sjd = { ...ctx, sky, clouds, duck, act1, act2, act3, overlay, state, updateFromScroll };
}

boot();
