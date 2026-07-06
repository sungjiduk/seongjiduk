// 가이드 깃발 — 폴 + cloth wave 버텍스 셰이더 평면.
// 깃발 텍스처는 캔버스(덕 옐로우 바탕 + "성지덕" + 위치핀)로 그린다. 외부 에셋 없음.

import * as THREE from "three";

function makeFlagTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 160;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f5a80c";
  ctx.fillRect(0, 0, 256, 160);
  // 위치핀 아이콘
  ctx.fillStyle = "#10203b";
  ctx.beginPath();
  ctx.arc(52, 66, 26, Math.PI * 0.75, Math.PI * 2.25);
  ctx.lineTo(52, 112);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f5a80c";
  ctx.beginPath();
  ctx.arc(52, 62, 11, 0, Math.PI * 2);
  ctx.fill();
  // 텍스트
  ctx.fillStyle = "#10203b";
  ctx.font = "700 52px Pretendard, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("성지덕", 96, 82);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createFlag() {
  const group = new THREE.Group();
  group.name = "guide-flag";

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.045, 2.4, 8),
    new THREE.MeshStandardMaterial({ color: 0xdcd6c9, roughness: 0.6 })
  );
  pole.position.y = 1.2;
  group.add(pole);

  const uniforms = { uTime: { value: 0 } };
  const flagMat = new THREE.MeshStandardMaterial({
    map: makeFlagTexture(),
    side: THREE.DoubleSide,
    roughness: 0.85,
  });
  // cloth wave: 표준 머티리얼에 onBeforeCompile로 버텍스 웨이브 주입
  flagMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uTime;"
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        // 폴에서 멀수록(uv.x 클수록) 크게 출렁이는 웨이브
        float wamp = position.x; // 0(폴 쪽)..~1.1
        transformed.z += sin(position.x * 4.0 - uTime * 5.0) * 0.09 * wamp;
        transformed.y += sin(position.x * 3.0 - uTime * 4.2) * 0.03 * wamp;`
      );
  };
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.68, 16, 8), flagMat);
  // 좌측 변을 x=0(폴)에 붙이고, 웨이브 진폭(wamp=position.x)이 항상 양수가 되게
  flag.geometry.translate(0.55, 0, 0);
  flag.position.set(0.035, 2.0, 0);
  group.add(flag);

  function update(dt) {
    uniforms.uTime.value += dt;
  }

  return { group, update };
}
