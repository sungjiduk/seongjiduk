// 정거장 접근도 — ACT3 로컬 진행도 p가 정거장 중심(center)에 얼마나 가까운지 0..1.
// 카메라 감속·패널 도킹 페이드의 공용 커브.

/** |p-center| >= width 에서 0, 중심에서 1. smoothstep 대칭 창. */
export function stationWindow(p, center, width = 0.08) {
  const d = Math.abs(p - center);
  if (d >= width) return 0;
  const x = 1 - d / width; // 0..1
  return x * x * (3 - 2 * x); // smoothstep
}
