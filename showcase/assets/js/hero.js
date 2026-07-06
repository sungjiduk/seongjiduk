// 성지덕 쇼케이스 — Three.js 스크롤 구동 히어로 (실제 3D 덕식이 GLB)
// 덕식이 부유 → 비행기 캐치 "슝" → 회전 지구본(성지 핀) 안착.
// GLB(meshopt+webp, ~0.4MB)를 로드하고, 실패/reduced-motion/모바일에서는 우아하게 폴백한다.

const prefersReduced = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;
const isSmall = window.matchMedia("(max-width: 640px)").matches;

const DUCK_MODEL_URL = "assets/models/duck.glb";

// 스크롤 구간 → 배경 zone 전환 (3D 여부와 무관하게 항상 동작)
function setupZones() {
  const zones = [
    ["#gate", "dawn"],
    ["#takeoff", "mid"],
    ["#cruise", "altitude"],
    ["#route", "altitude"],
    ["#arrival", "space"],
  ];
  const map = new Map(
    zones.map(([sel, z]) => [document.querySelector(sel), z]).filter(([el]) => el)
  );
  if (!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting && map.has(en.target)) {
          document.body.dataset.zone = map.get(en.target);
        }
      });
    },
    { rootMargin: "-45% 0px -45% 0px" }
  );
  map.forEach((_, el) => io.observe(el));
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext("webgl") || c.getContext("experimental-webgl"))
    );
  } catch (e) {
    return false;
  }
}

function useFallback() {
  document.documentElement.classList.remove("hero-loading", "hero-ready");
  document.documentElement.classList.add("no-webgl");
}

/** 소프트 구름 텍스처(라디얼 그라디언트). 텍스처 없는 Sprite는 흰 사각형으로 보인다. */
function makeCloudTexture(THREE) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.55, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

async function initHero() {
  setupZones();

  // reduced-motion: 3D는 정적으로 렌더(스크롤 연출·부유 애니메이션만 끔)
  if (!hasWebGL()) return useFallback("nowebgl");

  // 로딩 시작: 2D 덕식이를 플레이스홀더로 표시 (모델 준비되면 페이드아웃)
  document.documentElement.classList.add("hero-loading");

  let THREE, GLTFLoader, MeshoptDecoder, RoomEnvironment;
  try {
    THREE = await import("three");
    ({ GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js"));
    ({ MeshoptDecoder } = await import(
      "three/addons/libs/meshopt_decoder.module.js"
    ));
    ({ RoomEnvironment } = await import(
      "three/addons/environments/RoomEnvironment.js"
    ));
  } catch (err) {
    console.warn("three 모듈 로드 실패, 폴백:", err);
    return useFallback("nowebgl");
  }

  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return useFallback("nowebgl");

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !isSmall,
      powerPreference: "high-performance",
    });
  } catch (err) {
    console.warn("WebGLRenderer 실패, 폴백:", err);
    return useFallback("nowebgl");
  }

  // 컨텍스트가 실제로 생성됐는지 재확인 (일부 환경은 throw 없이 null 반환)
  if (
    !renderer ||
    typeof renderer.getContext !== "function" ||
    !renderer.getContext()
  ) {
    console.warn("WebGL 컨텍스트 없음, 폴백");
    return useFallback("nowebgl");
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 0, 6);

  // PBR 환경광: RoomEnvironment로 부드러운 스튜디오 반사 (덕 텍스처/스페큘러 표현)
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xfff2d6, 1.4);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9ec7ff, 0.6);
  rim.position.set(-4, 1, -3);
  scene.add(rim);

  const texLoader = new THREE.TextureLoader();

  // --- 덕식이: 실제 3D GLB (로드 전엔 비어있음; 2D 폴백이 자리 유지) ---
  const duckGroup = new THREE.Group(); // 스크롤로 위치/스케일 제어
  const duckPivot = new THREE.Group(); // 부유/회전 애니메이션
  duckGroup.add(duckPivot);
  scene.add(duckGroup);
  let duckModel = null;
  const DUCK_BASE_SCALE = isSmall ? 1.7 : 1.95; // 오토스케일 후 목표 크기(단위)
  const DUCK_BASE_YAW = 0; // 카메라를 향하도록 기본 회전(정면)
  // 휴식 위치는 현재 폭 기준으로 매번 계산 (리사이즈·프리뷰 초기폭 고정 방지)
  const duckRestX = () => (window.innerWidth <= 640 ? 0 : 3.0); // 헤드라인 비우는 우측
  const duckRestY = () => (window.innerWidth <= 640 ? 1.75 : 0.7); // 모바일: 카피 위로
  const duckRestS = () => (window.innerWidth <= 640 ? 0.72 : 1); // 모바일: 축소

  const gltfLoader = new GLTFLoader();
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  gltfLoader.load(
    DUCK_MODEL_URL,
    (gltf) => {
      const model = gltf.scene;
      // 바운딩 박스로 중심 정렬 + 목표 크기로 정규화
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const norm = DUCK_BASE_SCALE / maxDim;
      model.position.sub(center); // 원점 중심으로
      model.scale.setScalar(norm);
      model.rotation.y = DUCK_BASE_YAW;
      model.traverse((o) => {
        if (o.isMesh && o.material) o.material.envMapIntensity = 0.8;
      });
      duckPivot.add(model);
      duckModel = model;
      updateFromScroll(state.t); // 현재 스크롤 위치 반영
      document.documentElement.classList.add("hero-ready"); // 캔버스 페이드인 + 2D 폴백 페이드아웃
      if (prefersReduced) renderOnce(); // 정적 모드: 로드 시점에 한 번 그림
    },
    undefined,
    (err) => {
      console.warn("덕식이 GLB 로드 실패, 폴백:", err);
      useFallback("nowebgl");
    }
  );

  // --- 구름(평면 스프라이트 파티클) ---
  const clouds = new THREE.Group();
  scene.add(clouds);
  const cloudMat = new THREE.SpriteMaterial({
    map: makeCloudTexture(THREE),
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const cloudCount = isSmall ? 8 : 16;
  for (let i = 0; i < cloudCount; i++) {
    const c = new THREE.Sprite(cloudMat.clone());
    const s = 1.5 + Math.random() * 2.5;
    c.scale.set(s * 1.6, s, 1);
    c.position.set(
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 8,
      -2 - Math.random() * 4
    );
    c.userData.speed = 0.1 + Math.random() * 0.2;
    clouds.add(c);
  }

  // --- 비행기(간단한 저폴리 몸체) ---
  const plane = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xeaf3fb,
    metalness: 0.3,
    roughness: 0.5,
  });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.2, 8), bodyMat);
  body.rotation.z = -Math.PI / 2;
  plane.add(body);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.3), bodyMat);
  plane.add(wing);
  plane.position.set(8, 2, -1);
  scene.add(plane);

  // --- 지구본(저폴리 sphere + 성지 핀) ---
  const globe = new THREE.Group();
  const sphere = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.6, isSmall ? 2 : 4),
    new THREE.MeshStandardMaterial({
      color: 0x2f6fb0,
      emissive: 0x0b1026,
      flatShading: true,
      roughness: 0.8,
    })
  );
  globe.add(sphere);
  const pinMat = new THREE.MeshBasicMaterial({ color: 0xffc24b });
  const pinCoords = [
    [35.68, 139.76], // 도쿄
    [35.7, 139.77], // 간다묘진
    [35.7, 139.77], // 아키하바라
  ];
  pinCoords.forEach(([lat, lng]) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    const r = 1.66;
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), pinMat);
    pin.position.set(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
    globe.add(pin);
  });
  globe.position.set(0, -0.5, 0);
  globe.scale.setScalar(0);
  globe.visible = false;
  scene.add(globe);

  // --- 별(우주 구간) ---
  const starGeo = new THREE.BufferGeometry();
  const starCount = isSmall ? 200 : 500;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 40;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 40;
    starPos[i * 3 + 2] = -10 - Math.random() * 20;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.06,
      transparent: true,
      opacity: 0,
    })
  );
  scene.add(stars);

  // 스크롤 진행도 0..1
  const state = { t: 0 };

  function updateFromScroll(t) {
    state.t = t;
    // 0.00–0.45: 부유 → 비행기 쪽으로 이동/캐치
    // 0.45–0.70: "슝" (스케일 축소 + 화면 밖으로)
    // 0.62–1.00: 지구본 등장 + 덕식이 안착
    const catchP = Math.min(1, t / 0.45);
    const dash = t > 0.45 ? Math.min(1, (t - 0.45) / 0.25) : 0;
    const gp = t > 0.62 ? Math.min(1, (t - 0.62) / 0.38) : 0;
    const globeY = -0.5 + (1 - gp) * -1.5;

    // 비행기: 왼쪽으로 진입해 덕식이를 지나침
    plane.position.x = 8 - catchP * 5.8;
    plane.position.y = 2;
    plane.visible = t < 0.68;

    // 덕식이: 상태에 따라 위치/스케일 (모델 로드 전이면 스킵)
    if (duckModel) {
      if (t < 0.7) {
        // 부유 → 캐치 → 슝 (오른쪽 휴식 위치에서 비행기 쪽으로 → 화면 밖으로)
        const flyX = duckRestX() + catchP * 1.2 + dash * 9;
        duckGroup.position.set(flyX, duckRestY() + Math.sin(t * Math.PI) * 0.5, 0);
        duckGroup.scale.setScalar(Math.max(0.001, (1 - dash) * duckRestS())); // 슝 하며 작아짐
        duckPivot.rotation.z = -catchP * 0.5; // 비행 뱅크
      } else {
        // 지구본 앞면에 안착: 슝 직후 다시 커지며 등장 (t 0.70→0.92 풀사이즈)
        const land = Math.min(1, (t - 0.7) / 0.22);
        duckGroup.position.set(0, globeY + 1.2, 1.7);
        duckGroup.scale.setScalar(0.62 * land);
        duckPivot.rotation.z = 0;
      }
    }

    // 지구본
    globe.visible = gp > 0;
    globe.scale.setScalar(gp * 1.1);
    globe.position.y = globeY;
    camera.position.z = 6 - gp * 1.2;

    // 별 페이드 + 구름 페이드아웃
    stars.material.opacity = gp;
    clouds.children.forEach((c) => (c.material.opacity = 0.55 * (1 - gp)));
  }

  // GSAP ScrollTrigger 스크럽 (로드됐을 때만)
  function wireScroll() {
    if (window.gsap && window.ScrollTrigger) {
      window.gsap.registerPlugin(window.ScrollTrigger);
      window.ScrollTrigger.create({
        trigger: "#main",
        start: "top top",
        end: "bottom bottom",
        scrub: 0.6,
        invalidateOnRefresh: true,
        onUpdate: (self) => updateFromScroll(self.progress),
      });
      // data.js가 크루·노선도·타임라인을 비동기로 렌더하면 문서 높이가 커진다.
      // ScrollTrigger의 스크롤 범위를 그때 다시 측정하지 않으면 진행도가 갱신되지 않음.
      const refresh = () => window.ScrollTrigger.refresh();
      window.addEventListener("load", refresh);
      setTimeout(refresh, 400);
      if ("ResizeObserver" in window) {
        let lastH = document.body.scrollHeight;
        const ro = new ResizeObserver(() => {
          const h = document.body.scrollHeight;
          if (Math.abs(h - lastH) > 40) {
            lastH = h;
            refresh();
          }
        });
        ro.observe(document.body);
      }
    } else {
      const onScroll = () => {
        const max = document.body.scrollHeight - window.innerHeight;
        updateFromScroll(max > 0 ? window.scrollY / max : 0);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }
  }

  function renderOnce() {
    renderer.render(scene, camera);
  }

  let raf = 0;
  const clock = new THREE.Clock();
  function animate() {
    raf = requestAnimationFrame(animate);
    const dt = clock.getDelta();
    clouds.children.forEach((c) => {
      c.position.x -= c.userData.speed * dt;
      if (c.position.x < -8) c.position.x = 8;
    });
    globe.rotation.y += dt * 0.25;
    // 부유 중 은은한 상하 흔들림 + 느린 요잉
    if (duckModel && state.t < 0.45) {
      duckPivot.position.y = Math.sin(clock.elapsedTime * 1.4) * 0.08;
      duckModel.rotation.y = DUCK_BASE_YAW + Math.sin(clock.elapsedTime * 0.5) * 0.3;
    }
    renderer.render(scene, camera);
  }

  if (prefersReduced) {
    // 정적 모드: 스크롤 연출·애니메이션 루프 없이 휴식 포즈만 렌더
    renderOnce();
  } else {
    if (window.gsap) wireScroll();
    else window.addEventListener("load", wireScroll);
    animate();

    // 탭 비가시 시 렌더 정지(성능)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else animate();
    });
  }

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    updateFromScroll(state.t); // 휴식 위치 등 폭 의존 값 재계산
    if (prefersReduced) renderOnce();
  });
}

initHero();
