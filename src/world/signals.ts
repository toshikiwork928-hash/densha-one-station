// 閉そく信号機（4灯式・自線左側）。現示は ctx.state.signals（game/signals.ts が更新）を毎フレーム反映
// 2面4線駅の構内（待避線区間）は本線用（線間）と待避線用（待避線の左）の2基。場内信号には進路表示機
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import type { SignalAspect } from '../core/events';
import { loopZones } from '../route/service';
import { GeoBatch, M, P, basePart } from './batch';
import { canvasTex } from './canvas-tex';
import { cullByDistance } from './cull';

const LAT = -2.7; // 自線左側
const LAT_BETWEEN = -2.5; // 本線と待避線の線間
// 灯の並び（上から）: 緑, 黄1, 赤, 黄2。YG = 緑 + 黄2
const LAMPS: { color: number; on: SignalAspect[] }[] = [
  { color: 0x3dff8a, on: ['G', 'YG'] },
  { color: 0xffc53d, on: ['Y'] },
  { color: 0xff3b30, on: ['R'] },
  { color: 0xffc53d, on: ['YG'] },
];
const OFF = 0x1d2024;

export function buildSignals(ctx: GameContext): void {
  const sigs = ctx.route.signals ?? [];
  if (!sigs.length) return;
  const { scene, track } = ctx;
  const glowTex = makeGlowTexture();
  const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const lampMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const lampPart = basePart(new THREE.CircleGeometry(.15, 16));
  const glowMats = LAMPS.map(L => new THREE.SpriteMaterial({ map: glowTex, color: L.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));

  const zones = loopZones(ctx.route);
  // 信号ごとの灯器: single = 通常, main = 構内の本線用, loop = 構内の待避線用
  type Role = 'single' | 'main' | 'loop';
  const heads: { i: number; role: Role; station: number; lat: number }[] = [];
  const homes = new Map<number, number>(); // 信号 index → 場内信号として守る駅
  sigs.forEach((sg, i) => {
    const z = zones.find(q => sg.s >= q.inTo && sg.s <= q.outFrom);
    if (z) {
      heads.push({ i, role: 'main', station: z.index, lat: LAT_BETWEEN }, { i, role: 'loop', station: z.index, lat: z.lat + LAT });
    } else heads.push({ i, role: 'single', station: -1, lat: LAT });
  });
  for (const z of zones) {
    let h = -1;
    sigs.forEach((g, i) => { if (g.s < z.inFrom) h = i; });
    if (h >= 0) homes.set(h, z.index);
  }
  // 進路表示機（分岐側へ進むとき白く点灯）
  const indTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff'; g.lineWidth = 16; g.lineCap = 'round';
    g.beginPath(); g.moveTo(w * .75, h * .8); g.lineTo(w * .3, h * .3); g.stroke();
    g.beginPath(); g.moveTo(w * .3, h * .62); g.lineTo(w * .3, h * .3); g.lineTo(w * .58, h * .3); g.stroke();
  });
  const indOn = new THREE.MeshBasicMaterial({ map: indTex, toneMapped: false });
  const indOff = new THREE.MeshBasicMaterial({ color: 0x15171a });
  const indicators: { mesh: THREE.Mesh; station: number }[] = [];

  const items = heads.map(hd => {
    const sg = sigs[hd.i];
    const t = track.trackAt(sg.s), grp = new THREE.Group();
    grp.position.copy(track.at(sg.s, hd.lat, 0)); grp.rotation.y = -t.phi;
    // 柱・灯箱・背板・ひさしは1メッシュ、灯は頂点色の1メッシュ（現示変化時に色を書き換え）
    const b = new GeoBatch();
    b.add('body', P.cyl, M(0, 2.6, 0, 0, .2, 5.2, .2), 0x8c9196);
    b.add('body', P.box, M(0, 5.6, 0, 0, .5, 1.75, .28), 0x15171a);
    b.add('body', P.box, M(0, 5.6, -.15, 0, .9, 2.2, .01), 0x15171a);
    LAMPS.forEach((_, k) => {
      const y = 6.25 - k * .43;
      b.add('body', P.box, M(0, y + .17, .25, 0, .46, .04, .22), 0x15171a);
      b.add('lamp', lampPart, M(0, y, .145), OFF);
    });
    const [body, lamp] = b.build({ body: bodyMat, lamp: lampMat }, grp);
    lamp.userData.noShadow = true; body.name = 'signal';
    const glows = LAMPS.map((_, k) => {
      const sp = new THREE.Sprite(glowMats[k]); sp.position.set(0, 6.25 - k * .43, .2); sp.scale.set(1.1, 1.1, 1); sp.visible = false; grp.add(sp);
      return sp;
    });
    const home = homes.get(hd.i);
    if (home != null) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(.6, .6, .25), bodyMat); box.position.set(0, 6.95, 0);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(.5, .5), indOff); face.position.set(0, 6.95, .13);
      grp.add(box, face); indicators.push({ mesh: face, station: home });
    }
    scene.add(grp);
    cullByDistance(ctx, grp, 1200);
    return { hd, col: lamp.geometry.attributes.color as THREE.BufferAttribute, per: lampPart.count, glows, aspect: '' as SignalAspect | '' };
  });

  // 灯器ごとの表示現示。自列車が使わない側の灯器は、待避中の通過列車が来るときだけ進行
  const st = ctx.state;
  const shown = (hd: (typeof heads)[number]): SignalAspect => {
    const a = st.signals?.[hd.i] ?? 'G', sS = sigs[hd.i].s, o = st.overtake;
    const passing = !!o && o.phase === 'run' && o.head < sS + 2;
    if (hd.role === 'single') return passing && sS < st.train.s ? 'G' : a; // 自列車の後方を通過列車が進む
    const onLoop = !ctx.route.stations[hd.station].pass;
    if (hd.role === 'loop') return onLoop ? a : 'R';
    return onLoop ? (passing ? 'G' : 'R') : a;
  };
  const c = new THREE.Color();
  ctx.events.on('frame', () => {
    for (const d of indicators) d.mesh.material = ctx.route.stations[d.station].pass ? indOff : indOn;
    items.forEach(it => {
      const a = shown(it.hd);
      if (a === it.aspect) return;
      it.aspect = a;
      LAMPS.forEach((L, k) => {
        const on = L.on.includes(a);
        c.set(on ? L.color : OFF);
        for (let v = k * it.per; v < (k + 1) * it.per; v++) it.col.setXYZ(v, c.r, c.g, c.b);
        it.glows[k].visible = on;
      });
      it.col.needsUpdate = true;
    });
  });
}

function makeGlowTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
