import type { Route } from '../route/types';
import { airport } from '../route/routes/airport';
import { sectionFrame } from './section-frame';
import type { RoadRow } from './road-collision';

type Bridge = NonNullable<Route['airportBridge']>;
export function airportLinkRoadLat(bridge: Bridge, s: number, side: number): number {
  const flare = Math.max(0, 1 - Math.min(s - bridge.from, bridge.to - s) / 520);
  return 2 + side * (7.4 + 17 * flare ** 2);
}

// airport.json の本土側10m道路・島側13.5m道路の接続点。橋側の幅と向きを滑らかにつなぐ。
export function bridgeApproaches(bridge: Bridge) {
  return [
    { shore: bridge.from, ds: -267, target: -35.7, width: 10, side: -1 },
    { shore: bridge.from, ds: -267, target: -23, width: 10, side: 1 },
    { shore: bridge.to, ds: 400, target: 203.5, width: 13.5, side: -1 },
    { shore: bridge.to, ds: 400, target: 236.7, width: 13.5, side: 1 },
  ].map(({shore, ds, target, width, side}) => {
    const start = airportLinkRoadLat(bridge, shore, side);
    const count = Math.ceil(Math.abs(ds) / 10);
    return Array.from({length: count + 1}, (_, i) => {
      const u = i / count, blend = u * u * (3 - 2 * u);
      return {s: shore + ds * u, lat: start + (target - start) * blend, width: 14.72 + (width - 14.72) * u, blend};
    });
  });
}

/** 専用桁に置き換えたOSM道路だけを外し、りんくうJCTの交差路と分岐を残す。 */
export function bridgeReplacesHighway(bridge: Bridge, s: number, lat: number, width: number): boolean {
  const d = bridge.islandAtStart ? bridge.to - s : s - bridge.from;
  if (width === 13.5) return d >= -25 && d <= bridge.to - bridge.from + 400;
  const l = bridge.islandAtStart ? 4 - lat : lat;
  return width === 10 && d >= -267 && d < 110 && l > -42 && l < 0;
}

export function airportLinkRoads(route: Route): RoadRow[] {
  const base = route.id === 'airport-namba-up' ? airport : route;
  if (!base.airportBridge) return [];
  const frame = base === route ? null : sectionFrame(base, route);
  return bridgeApproaches(base.airportBridge).flatMap(points => points.slice(1).map((b, i) => {
    const a = points[i];
    return [1, Math.max(a.width, b.width), 'airport-approach', [a,b].flatMap(p =>
      frame ? [frame.mapS(p.s), frame.mapL(p.lat)] : [p.s, p.lat])];
  }));
}

export function airportHighwayRows(data: { highways?: (number | number[])[][] }, bridge: Bridge): RoadRow[] {
  return (data.highways ?? []).flatMap(([w, raw]) => {
    const pts = raw as number[], width = w as number, rows: RoadRow[] = [];
    for (let i = 0; i + 5 < pts.length; i += 3) {
      const [s, l,, t, m] = pts.slice(i, i + 6);
      if (!bridgeReplacesHighway(bridge, (s+t)/2, (l+m)/2, width))
        rows.push([1, width, 'highway', [s, l, t, m]]);
    }
    return rows;
  });
}
