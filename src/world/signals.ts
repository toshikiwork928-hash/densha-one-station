// 閉そく信号機（4灯式・自線左側）。現示は ctx.state.signals（game/signals.ts が更新）を毎フレーム反映
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import type { SignalAspect } from '../core/events';
import { GeoBatch, M, P, basePart } from './batch';
import { cullByDistance } from './cull';

const LAT = -2.7; // 自線左側
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

  const items = sigs.map(sg => {
    const t = track.trackAt(sg.s), grp = new THREE.Group();
    grp.position.copy(track.at(sg.s, LAT, 0)); grp.rotation.y = -t.phi;
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
    scene.add(grp);
    cullByDistance(ctx, grp, 1200);
    return { col: lamp.geometry.attributes.color as THREE.BufferAttribute, per: lampPart.count, glows, aspect: '' as SignalAspect | '' };
  });

  const c = new THREE.Color();
  ctx.events.on('frame', () => {
    const asp = ctx.state.signals;
    items.forEach((it, i) => {
      const a = asp?.[i] ?? 'G';
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
