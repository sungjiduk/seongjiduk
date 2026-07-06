// [순수] CatmullRom 도로 경로 — 진행도 p(0..1) → 위치/탄젠트.
// three의 CatmullRomCurve3만 사용(렌더러 무관)하므로 node:test로 검증 가능.

import { CatmullRomCurve3, Vector3 } from "three";

/**
 * 컨트롤 포인트 배열로 도로 경로를 만든다.
 * @param {number[][]} points [[x,y,z], ...] 최소 2개
 * @returns {{ curve: CatmullRomCurve3, at(p:number): { pos: number[], tangent: number[] } }}
 *   pos: 월드 좌표 [x,y,z], tangent: 진행 방향 단위 벡터 [x,y,z]
 */
export function createRoad(points) {
  const curve = new CatmullRomCurve3(
    points.map(([x, y, z]) => new Vector3(x, y, z)),
    false,
    "centripetal"
  );

  const pos = new Vector3();
  const tan = new Vector3();

  function at(p) {
    const t = Math.min(1, Math.max(0, p));
    // getPointAt/getTangentAt: 호 길이 기준 균등 파라미터(정거장 간격 왜곡 방지)
    curve.getPointAt(t, pos);
    curve.getTangentAt(t, tan).normalize();
    return { pos: pos.toArray(), tangent: tan.toArray() };
  }

  return { curve, at };
}
