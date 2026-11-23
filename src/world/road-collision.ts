/** OSM 道路と景観オブジェクトの衝突判定。座標は route の s/lat 系。 */
export type RoadRow = (number | string | number[])[];

export function drawnRoadWidth(cls: number, w: number): number {
  return Math.min(cls === 1 ? 22 : 14, Math.max(cls === 4 ? 2.5 : cls === 3 ? 4.5 : 6, w));
}

type Segment = [number, number, number, number, number];

/** 道路帯の点判定と、回転矩形との交差判定を提供する。 */
export function buildRoadCollisionIndex(roads: RoadRow[]) {
  const G = 8, cells = new Map<string, number[]>(), segments: Segment[] = [];
  for (const r of roads) {
    const width = drawnRoadWidth(r[0] as number, r[1] as number), pts = r[3] as number[];
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const index = segments.push([pts[i], pts[i + 1], pts[i + 2], pts[i + 3], width / 2]) - 1;
      const x0 = Math.min(pts[i], pts[i + 2]) - width, x1 = Math.max(pts[i], pts[i + 2]) + width;
      const y0 = Math.min(pts[i + 1], pts[i + 3]) - width, y1 = Math.max(pts[i + 1], pts[i + 3]) + width;
      for (let gx = Math.floor(x0 / G); gx <= Math.floor(x1 / G); gx++) for (let gy = Math.floor(y0 / G); gy <= Math.floor(y1 / G); gy++) {
        const key = `${gx},${gy}`, list = cells.get(key); if (list) list.push(index); else cells.set(key, [index]);
      }
    }
  }
  const candidates = (s0: number, s1: number, l0: number, l1: number) => {
    const out = new Set<number>();
    for (let gx = Math.floor(s0 / G); gx <= Math.floor(s1 / G); gx++) for (let gy = Math.floor(l0 / G); gy <= Math.floor(l1 / G); gy++)
      for (const i of cells.get(`${gx},${gy}`) ?? []) out.add(i);
    return out;
  };
  const point = (s: number, l: number) => {
    for (const i of cells.get(`${Math.floor(s / G)},${Math.floor(l / G)}`) ?? []) {
      const [x, y, x2, y2, radius] = segments[i], dx = x2 - x, dy = y2 - y, len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((s - x) * dx + (l - y) * dy) / len2));
      if (Math.hypot(s - x - dx * t, l - y - dy * t) < radius) return true;
    }
    return false;
  };
  const intersectsBuilding = (s: number, l: number, len: number, wid: number, angle: number) => {
    const ca = Math.cos(angle), sa = Math.sin(angle);
    // 回転矩形の s/lat 外接範囲で候補を拾う。軸平行の len/2, wid/2 だけでは長軸回転時に漏れる。
    const extentS = (len * Math.abs(ca) + wid * Math.abs(sa)) / 2;
    const extentL = (len * Math.abs(sa) + wid * Math.abs(ca)) / 2;
    for (const i of candidates(s - extentS, s + extentS, l - extentL, l + extentL)) {
      const [x, y, x2, y2, radius] = segments[i];
      const dx = x2 - x, dy = y2 - y, length = Math.hypot(dx,dy);
      if (!length) continue;
      // 建物の座標で、道路帯と建物それぞれの2軸に投影して離隔を調べる。
      const u = (dx * ca + dy * sa) / length, v = (-dx * sa + dy * ca) / length;
      const cx = (x + x2) / 2 - s, cy = (y + y2) / 2 - l;
      const along = cx * ca + cy * sa, across = -cx * sa + cy * ca;
      const hu = Math.abs(u), hv = Math.abs(v), half = length / 2;
      if (Math.abs(along) > len / 2 + half * hu + radius * hv) continue;
      if (Math.abs(across) > wid / 2 + half * hv + radius * hu) continue;
      if (Math.abs(along*u + across*v) > half + (len*hu + wid*hv)/2) continue;
      if (Math.abs(across*u - along*v) <= radius + (len*hv + wid*hu)/2) return true;
    }
    return false;
  };
  return { point, intersectsBuilding };
}
