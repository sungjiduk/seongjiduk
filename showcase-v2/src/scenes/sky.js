// 스카이돔 — 버텍스 그라디언트 셰이더(dawn ↔ 고고도/space 램프) + 별 + 씬 포그.
// setBlend(p): 0 = 새벽 하늘(마을 고도), 1 = 검푸른 고고도(다이빙 시작점).

import * as THREE from "three";

export const SKY = {
  dawnTop: new THREE.Color("#7fb2e6"), // --sky-mid
  dawnBottom: new THREE.Color("#eaf3fb"), // --sky-dawn
  spaceTop: new THREE.Color("#0b1026"), // --space
  spaceBottom: new THREE.Color("#1b2a4a"), // --altitude
  fogDawn: new THREE.Color("#dcecf9"),
  fogSpace: new THREE.Color("#141d3a"),
};

const VERT = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uDawnTop;
  uniform vec3 uDawnBottom;
  uniform vec3 uSpaceTop;
  uniform vec3 uSpaceBottom;
  uniform float uBlend;   // 0=dawn, 1=space
  uniform float uRadius;
  varying vec3 vWorldPos;
  void main() {
    // 돔 높이(-1..1) → 0..1, 지평선 부근을 부드럽게
    float h = clamp(vWorldPos.y / uRadius, -1.0, 1.0);
    float grad = smoothstep(-0.15, 0.65, h);
    vec3 top = mix(uDawnTop, uSpaceTop, uBlend);
    vec3 bottom = mix(uDawnBottom, uSpaceBottom, uBlend);
    gl_FragColor = vec4(mix(bottom, top, grad), 1.0);
  }
`;

/**
 * 스카이돔 + 별 + 포그를 씬에 설치한다.
 * @returns {{ group, setBlend(p:number):void, update(dt:number):void }}
 */
export function createSky(scene, { radius = 60, starCount = 400 } = {}) {
  const group = new THREE.Group();
  group.name = "sky";

  const uniforms = {
    uDawnTop: { value: SKY.dawnTop },
    uDawnBottom: { value: SKY.dawnBottom },
    uSpaceTop: { value: SKY.spaceTop },
    uSpaceBottom: { value: SKY.spaceBottom },
    uBlend: { value: 0 },
    uRadius: { value: radius },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 24),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    })
  );
  dome.renderOrder = -10;
  group.add(dome);

  // 별: 돔 상반부에 뿌리고, space 블렌드일 때만 보인다
  const starGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    // 상반구 균등 분포
    const u = Math.random();
    const v = Math.random() * 0.5; // 위쪽 절반
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(1 - v);
    const r = radius * 0.95;
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.cos(phi);
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.35,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    })
  );
  group.add(stars);

  // 포그: 색은 블렌드 따라, near/far는 whiteout(clouds)이 추가 조정
  scene.fog = new THREE.Fog(SKY.fogDawn.clone(), 12, radius * 0.9);

  scene.add(group);

  function setBlend(p) {
    const b = Math.min(1, Math.max(0, p));
    uniforms.uBlend.value = b;
    stars.material.opacity = Math.max(0, b - 0.45) / 0.55;
    if (scene.fog) scene.fog.color.copy(SKY.fogDawn).lerp(SKY.fogSpace, b);
  }

  function update(dt) {
    stars.rotation.y += dt * 0.005; // 아주 느린 성야 회전
  }

  setBlend(0);
  return { group, setBlend, update };
}
