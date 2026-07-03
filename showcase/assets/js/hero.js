// 성지덕 쇼케이스 — Three.js 스크롤 구동 히어로
// 덕식이 부유 → 비행기 캐치 "슝" → 회전 지구본(성지 핀) 안착.
// 실패/reduced-motion/모바일에서는 우아하게 폴백한다.

const prefersReduced = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;
const isSmall = window.matchMedia("(max-width: 640px)").matches;

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

function useFallback(reason) {
  document.documentElement.classList.add(
    reason === "reduced" ? "reduced" : "no-webgl"
  );
}

async function initHero() {
  setupZones();

  if (prefersReduced) return useFallback("reduced");
  if (!hasWebGL()) return useFallback("nowebgl");

  let THREE;
  try {
    THREE = await import("three");
  } catch (err) {
    console.warn("three 로드 실패, 폴백:", err);
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
      powerPreference: "low-power",
    });
  } catch (err) {
    console.warn("WebGLRenderer 실패, 폴백:", err);
    return useFallback("nowebgl");
  }

  // 컨텍스트가 실제로 생성됐는지 재확인 (일부 환경은 throw 없이 null 반환)
  if (!renderer || typeof renderer.getContext !== "function" || !renderer.getContext()) {
    console.warn("WebGL 컨텍스트 없음, 폴백");
    return useFallback("nowebgl");
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 0, 6);

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const dir = new THREE.DirectionalLight(0xffffff, 0.7);
  dir.position.set(3, 4, 5);
  scene.add(dir);

  const loader = new THREE.TextureLoader();

  // --- 덕식이 스프라이트(빌보드) ---
  const duckGroup = new THREE.Group();
  scene.add(duckGroup);
  const duckMat = new THREE.SpriteMaterial({
    map: loader.load("assets/img/duck.png"),
    transparent: true,
  });
  const duck = new THREE.Sprite(duckMat);
  duck.scale.set(1.8, 1.8, 1);
  duckGroup.add(duck);

  // --- 구름(평면 스프라이트 파티클) ---
  const clouds = new THREE.Group();
  scene.add(clouds);
  const cloudMat = new THREE.SpriteMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.55,
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

  // --- 비행기(간단한 저폴리 삼각 몸체) ---
  const plane = new THREE.Group();
  const bodyGeo = new THREE.ConeGeometry(0.25, 1.2, 8);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xeaf3fb,
    metalness: 0.3,
    roughness: 0.5,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.rotation.z = -Math.PI / 2;
  plane.add(body);
  const wingGeo = new THREE.BoxGeometry(0.8, 0.05, 0.3);
  const wing = new THREE.Mesh(wingGeo, bodyMat);
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
  // 성지 핀 (도쿄·간다묘진·아키하바라 근사 위치)
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
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0 })
  );
  scene.add(stars);

  // 스크롤 진행도 0..1
  const state = { t: 0 };

  function updateFromScroll(t) {
    state.t = t;
    // 0.0–0.45: 부유 → 비행기로 이동/캐치
    // 0.45–0.7: "슝" 사라짐
    // 0.7–1.0: 지구본 등장 + 안착
    const catchP = Math.min(1, t / 0.45);
    duckGroup.position.x = catchP * 5.5; // 비행기 쪽으로
    duckGroup.position.y = 1 + Math.sin(t * Math.PI) * 0.6;

    plane.position.x = 8 - catchP * 5.8;
    plane.position.y = 2;

    // 슝 구간: 덕 스케일/투명
    const dash = t > 0.45 ? Math.min(1, (t - 0.45) / 0.25) : 0;
    duck.material.opacity = 1 - dash;
    duckGroup.position.x = 5.5 + dash * 8; // 화면 밖으로 슝
    plane.material.opacity = 1;

    // 지구본
    const gp = t > 0.62 ? Math.min(1, (t - 0.62) / 0.38) : 0;
    globe.visible = gp > 0;
    globe.scale.setScalar(gp * 1.1);
    globe.position.y = -0.5 + (1 - gp) * -1.5;
    camera.position.z = 6 - gp * 1.2;

    // 안착한 덕(지구본 위)
    if (gp > 0.5) {
      duck.material.opacity = (gp - 0.5) * 2;
      duckGroup.position.set(0, 1.1 + (globe.position.y || 0), 1.6);
      duck.scale.set(1.1, 1.1, 1);
    }

    // 별 페이드인
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
        onUpdate: (self) => updateFromScroll(self.progress),
      });
    } else {
      // 폴백: 네이티브 스크롤 비율
      const onScroll = () => {
        const max = document.body.scrollHeight - window.innerHeight;
        updateFromScroll(max > 0 ? window.scrollY / max : 0);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }
  }

  // gsap는 defer 로드 → 약간 지연 후 배선
  if (window.gsap) wireScroll();
  else window.addEventListener("load", wireScroll);

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
    duckGroup.rotation.z = Math.sin(clock.elapsedTime * 1.5) * 0.05;
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // 탭 비가시 시 렌더 정지(성능)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else animate();
  });
}

initHero();
