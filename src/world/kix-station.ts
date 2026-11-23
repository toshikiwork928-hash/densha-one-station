// 関西空港駅の掘割、道路の下を通るボックス、人工地盤下のホームを下り基準の座標で描く。
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import { GeoBatch, M, P, onLight } from './batch';
import { canvasTex } from './canvas-tex';
import { extrudeFn } from './track-mesh';

export function buildKixStation(ctx: GameContext): void {
  const station = ctx.route.stations.find(s => s.name === '関西空港');
  if (!station || !ctx.route.airportBridge) return;
  const center = (station.platform.from + station.platform.to) / 2;
  const signs = ['1', '2', '3', '4'];
  const batch = new GeoBatch(new Set(signs));
  const group = new THREE.Group();
  group.name = 'airport-kix-cut-and-cover-station';
  // 各部材の縦断勾配を線路に合わせる。重なる端面は曲線と勾配の変化による隙間を防ぐ。
  function slab(key: string, a: number, b: number, left: number, right: number, bottom: number, top: number, color: number) {
    const count = Math.ceil((b - a) / 24);
    for (let i = 0; i < count; i++) {
      const s = center + a + (i + .5) * (b - a) / count;
      const p = ctx.track.at(s, (left + right) / 2, (top + bottom) / 2);
      const pitch = Math.atan(ctx.track.gradeAt(s) / 1000);
      const length = (b - a) / count;
      batch.add(key, P.box, M(p.x, p.y, p.z, -ctx.track.trackAt(s).phi, right - left, top - bottom, length / Math.cos(pitch) + .035, pitch), color);
    }
  }
  const concrete = 0xa0a7a4, fascia = 0x899496;
  slab('body', -950, 130, -17, 26, -.55, -.25, 0x777977);
  for (let a = -950; a < -180; a += 12) {
    const b = Math.min(-180, a + 12);
    const height = 6.55 * THREE.MathUtils.smoothstep((a + b) / 2, -950, -720);
    for (const [left, right, outside] of [[-17.8, -17, -1], [26, 26.8, 1]]) {
      slab('body', a, b, left, right, -.55, height, concrete);
      const edge = outside < 0 ? left : right;
      slab('body', a, b, Math.min(edge, edge + outside * 13), Math.max(edge, edge + outside * 13), -.60, height - .10, fascia);
    }
  }
  slab('body', -720, -540, -17.8, 26.8, 6.15, 6.95, concrete);
  const left = -17.8, right = 26.8, end = 130;
  for (const [lo, hi] of [[left, -17], [26, right]]) {
    slab('body', -180, end, lo, hi, -.55, 2.35, concrete);
    slab('body', -180, end, lo, hi, 5.82, 7.8, concrete);
    for (let ds = -180; ds < end; ds += 8) {
      slab('body', ds, ds + .9, lo, hi, 2.35, 5.82, fascia);
      slab('glass', ds + .9, Math.min(ds + 8, end), lo + .3, hi - .3, 2.35, 5.82, 0xffffff);
    }
  }
  // 2階に通じる2か所の階段上だけに開口を設ける。
  slab('body', -180, -16, left, right, 6.80, 7.80, concrete);
  slab('body', -4, end, left, right, 6.80, 7.80, concrete);
  for (const [lo, hi] of [[left, -1.85], [.65, 13.35], [15.85, right]]) {
    slab('body', -16, -4, lo, hi, 6.80, 7.80, concrete);
  }
  // 2・3番線の間に角柱を並べる。各線中心から柱面までは2.42 m。
  for (let ds = -105; ds < 108; ds += 12) {
    slab('column', ds, ds + 1.5, 6.42, 7.58, -.25, 6.84, 0xc4c5bd);
    slab('body', ds - .08, ds + 1.58, 6.34, 7.66, -.25, .32, 0x888982);
  }
  const soffit = new THREE.MeshLambertMaterial({color:0xb8b8b6, emissive:0x6c6968, side:THREE.DoubleSide});
  for (const lat of [-.6, 14.6]) {
    for (const [a,b] of [[-109,-16],[-4,109]]) {
      const section: [number, number][] = Array.from({length:13}, (_, i) => {
        const u = i / 6 - 1;
        return [lat + u * 2.9, 5.15 + .72 * (1 - u*u)];
      });
      group.add(extrudeFn(ctx.track, () => section, center+a, center+b, 12, soffit));
      for (const x of [lat-2.82,lat+2.82]) slab('light', a, b, x-.07, x+.07, 5.10, 5.18, 0xfff4de);
      for (let ds=a+3;ds<b-1;ds+=8) slab('light',ds,ds+.25,lat-.16,lat+.16,5.80,5.88,0xfff8e7);
    }
  }
  for (const ds of [-72, 4, 65]) {
    for (const [i,lat] of [-2.4,1.2,12.8,16.4].entries()) {
      const s=center+ds, p=ctx.track.at(s,lat,4.32), yaw=-ctx.track.trackAt(s).phi;
      slab('body',ds-.04,ds+.04,lat-.035,lat+.035,4.77,5.64,fascia);
      slab('body',ds-.11,ds+.11,lat-.44,lat+.44,3.84,4.80,0x404548);
      for (const side of [-1,1]) {
        const face=ctx.track.at(s + side*.13,lat,4.32);
        batch.add(signs[i], P.plane, M(face.x,p.y,face.z,yaw+(side>0?Math.PI:0),.8,.88,1));
      }
    }
  }
  slab('body', end, end + .8, left, right, -.5, 7.8, concrete);
  const glass = new THREE.MeshBasicMaterial({color:0xf1f2e8, transparent:true, opacity:.72, depthWrite:false});
  onLight(ctx, night => { glass.color.set(0xf1f2e8).lerp(new THREE.Color(0x44505b), night); });
  const signMats = Object.fromEntries(signs.map((n,i)=>[n,new THREE.MeshBasicMaterial({
    map:canvasTex(192,208,(g,w,h)=>{
      g.fillStyle=i<2?'#41846d':'#3975a1'; g.fillRect(0,0,w,h);
      g.fillStyle='#fff'; g.textAlign='center'; g.font='bold 134px sans-serif'; g.fillText(n,w/2,143);
      g.fillRect(0,160,w,48);
      g.fillStyle='#273038'; g.font='bold 21px sans-serif'; g.fillText(i<2?'南海電鉄':'JR 関西空港線',w/2,192);
    }),
  })]));
  batch.build({
    ...signMats, glass,
    body: new THREE.MeshLambertMaterial({vertexColors:true, emissive:0x596160}),
    column: new THREE.MeshLambertMaterial({vertexColors:true, emissive:0x757775}),
    light: new THREE.MeshBasicMaterial({vertexColors:true}),
  }, group);
  ctx.scene.add(group);
}
