// [순수] 전역 스크롤 진행도 t(0..1) → 막(act)별 로컬 진행도 매핑.
// three/gsap 의존 없음 — node:test로 검증한다.

/** 3막 구간: 스카이다이브 → 클라우드 덱 → 마을 도착 */
export const ACTS = { skydive: [0, 0.3], deck: [0.3, 0.55], arrival: [0.55, 1] };

/** 구간 [a,b] 안에서 t를 0..1 선형 매핑, 구간 밖은 클램프 */
export const segment = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));

/** 전역 t → { act: 막 이름, p: 막 로컬 진행도 0..1 } */
export function actProgress(t) {
  for (const [act, [a, b]] of Object.entries(ACTS))
    if (t <= b) return { act, p: segment(t, a, b) };
  return { act: "arrival", p: 1 };
}
