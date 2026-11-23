// 関西国際空港連絡橋。中央は道路の下を鉄道が通るトラス、両端は道路が線路の脇へ開く。
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import type { Track } from '../route/track';
import { airport } from '../route/routes/airport';
import { sectionFrame } from './section-frame';
import { AirportParts, airportRailCorridors, buildAirportJunction, setAirportRailCorridors } from './airport-junction';
import { buildAirportArchitecture } from './airport-architecture';
import { buildKixStation } from './kix-station';
import { getTerrain } from './terrain';
import { buildAirportAircraft } from './airport-aircraft';
import { airportLinkRoadLat, bridgeApproaches } from './airport-link-roads';
import { buildRinkuCanopy } from './rinku-canopy';

function airportInboundFrame(ctx: GameContext): GameContext | null {
  if (!ctx.route.airportBridge?.islandAtStart) return ctx;
  const frame = sectionFrame(airport, ctx.route);
  if (!frame) return null;
  const real = ctx.track, L = airport.extent.to;
  const map = (s: number) => frame.mapS(s);
  const unmap = (s: number) => {
    let lo = airport.extent.from, hi = L;
    for (let i = 0; i < 36; i++) { const mid = (lo + hi) / 2; if (map(mid) > s) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  };
  const track: Track = {
    trackAt(s) {
      const t = real.trackAt(map(s)), p = real.at(map(s), frame.mapL(0), 0);
      return { ...t, x: p.x, y: p.y, z: p.z, phi: t.phi + Math.PI, rx: -t.rx, rz: -t.rz };
    },
    at: (s, lat, y) => real.at(map(s), frame.mapL(lat), y),
    gradeAt: s => -real.gradeAt(map(s)), limitAt: s => real.limitAt(map(s)), length: L,
    pathLat: s => frame.mapL(real.pathLat(map(s))),
    pathAt: (s, lat, y) => real.pathAt(map(s), -lat, y),
  };
  const train = new Proxy(ctx.state.train, { get: (t, k) => k === 's' ? unmap(t.s) : Reflect.get(t, k) });
  const state = new Proxy(ctx.state, { get: (st, k) => k === 'train' ? train : Reflect.get(st, k) });
  return { ...ctx, route: airport, track, state };
}

export function buildAirportTerminal(ctx: GameContext): void {
  const base = airportInboundFrame(ctx);
  if (!base) return;
  const bridge = base.route.airportBridge;
  if (!bridge) return;
  buildAirportJunction(base);
  buildAirportArchitecture(base);
  buildKixStation(base);
  buildRinkuCanopy(base);
  buildAirportAircraft(base, ctx);
  if (base !== ctx) {
    const frame = sectionFrame(airport, ctx.route);
    if (frame) setAirportRailCorridors(ctx, airportRailCorridors(base).map(z => ({
      ...z, from: Math.min(frame.mapS(z.from), frame.mapS(z.to)), to: Math.max(frame.mapS(z.from), frame.mapS(z.to)),
      lat0: Math.min(frame.mapL(z.lat0), frame.mapL(z.lat1)), lat1: Math.max(frame.mapL(z.lat0), frame.mapL(z.lat1)),
    })));
  }
  const { from, to } = bridge, { track, scene } = base;
  const a = track.at(from, 2, 0), b = track.at(to, 2, 0);
  const sea = new THREE.Mesh(new THREE.BoxGeometry(14000, .1, Math.hypot(b.x-a.x,b.z-a.z)),
    new THREE.MeshPhongMaterial({ color: 0x749ba9, shininess: 55 }));
  sea.position.copy(a).lerp(b,.5); sea.position.y = -.64;
  sea.rotation.y = Math.atan2(a.x-b.x,a.z-b.z); sea.name = 'airport-sea'; scene.add(sea);

  const count = 30, span = (to-from)/count, steel = 0x85a5a6, concrete = 0xabaea7;
  const roadAt = (s: number, side: number) => airportLinkRoadLat(bridge, s, side);
  for (let i = 0; i < count; i++) {
    const start = from+i*span, parts = new AirportParts();
    const central = i >= 4 && i < count-4;
    for (let k = 0; k < 6; k++) {
      const s = start+k*span/6, t = s+span/6;
      for (const side of [-1,1]) {
        const road = (q:number,l:number,h:number) => track.at(q,roadAt(q,side)+l,h);
        const along = (l:number,h:number,w:number,d:number,col:number) =>
          parts.span(road(s,l,h),road(t,l,h),w,d,col);
        along(0,9.3,14.72,1.2,0x727f82);
        for (const l of [-7.12,7.12]) along(l,10.4,.42,1,0xbcc3be);
        for (const l of [-1.8,1.8]) parts.span(road(s,l,9.92),road(s+6,l,9.92),.15,.04,0xeae6cc);
        const lat = 2+side*5.7, truss = (q:number,h:number) => track.at(q,lat,h);
        if (central) {
          for (const h of [-1.45,8.45]) parts.span(truss(s,h),truss(t,h),.65,.72,steel);
          parts.span(truss(s,-1.45),truss(s,8.65),.52,.52,steel);
          parts.span(truss(s,k%2 ? 8.45 : -1.45),truss(t,k%2 ? -1.45 : 8.45),.45,.45,steel);
        } else along(0,8.3,3,1.2,steel);
      }
      if (central) parts.span(track.at(s,-12.4,8.45),track.at(s,16.4,8.45),.65,.62,steel);
    }
    for (const side of [-1,1]) {
      const l = central ? 2+side*4 : roadAt(start,side);
      const top = track.at(start,l,central ? -2.2 : 7.65), foot = top.clone(); foot.y = -2;
      parts.span(foot,top,3.6,4.6,concrete);
      if (!central) {
        const p = track.at(start,2+side*3,-1.55), base=p.clone(); base.y=-2;
        parts.span(base,p,2.4,3.2,concrete);
      }
    }
    parts.span(track.at(start,-4,-1.55),track.at(start,8,-1.55),3.2,1.35,steel);
    parts.draw(scene,'airport-link-bridge');
  }
  const terrain = getTerrain(base), approaches = new AirportParts();
  for (const points of bridgeApproaches(bridge)) {
    const first = points[0], last = points[points.length - 1];
    const startY = track.trackAt(first.s).y + 9.3, endY = terrain.groundY(last.s) + 12;
    const at = (p: typeof first, edge: number, h: number) => {
      const position = track.at(p.s, p.lat + edge * (p.width / 2 - .24), 0);
      const y = startY + (endY - startY) * p.blend;
      const railGap = Math.abs(p.lat - 2) - 2 - p.width / 2;
      const lift = 1 - THREE.MathUtils.smoothstep(railGap, 7, 17);
      position.y = y + lift * Math.max(0, track.trackAt(p.s).y + 9.3 - y) + h;
      return position;
    };
    for (let i = 1; i < points.length; i++) {
      const a = points[i-1], b = points[i];
      approaches.span(at(a,0,0), at(b,0,0), (a.width + b.width)/2, 1.2, 0x727f82);
      for (const side of [-1,1]) approaches.span(at(a,side,1.1), at(b,side,1.1), .42, 1, 0xbcc3be);
      if (i % 6 === 0 && (a.lat < -9 || a.lat > 13)) {
        const top = at(a,0,-.6), foot = top.clone();
        foot.y = Math.min(-2, terrain.groundY(a.s));
        approaches.span(foot,top,2.4,2.8,concrete);
      }
    }
  }
  approaches.draw(scene,'airport-road-approach');
}
