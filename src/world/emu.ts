// 手続き生成の通勤形電車（20m級4扉ステンレス車、架空塗装）。自列車・対向列車で共用
// 座標: 原点 = 車両中心のレール面、前 = -Z、右 = +X
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { FONT } from '../core/config';
import { GeoBatch, M, P, basePart } from './batch';

export type CarKind = 'head' | 'mid' | 'pan';
export type CarRole = 'front' | 'rear' | 'mid';

export interface EmuLivery { band: string; line: string }
/** 架空路線色（桜色＋紺）。実在社局の配色は使わない */
export const DEFAULT_LIVERY: EmuLivery = { band: '#e0588c', line: '#1d2a5a' };

const Y0 = 1.05, Y1 = 3.55, HW = 1.475; // 車体下端・肩・半幅
const DOORS = [-7.2, -2.4, 2.4, 7.2], DOOR_W = 1.3;

let envTex: THREE.Texture | null = null;
function envMap(renderer: THREE.WebGLRenderer): THREE.Texture {
  if (!envTex) {
    const pm = new THREE.PMREMGenerator(renderer);
    envTex = pm.fromScene(new RoomEnvironment(), .04).texture;
    pm.dispose();
  }
  return envTex;
}

function cv(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}

interface SideMaps { map: THREE.Texture; emissive: THREE.Texture; rm: THREE.Texture; normal: THREE.Texture }

/** 側面テクスチャ（色・窓発光マスク・粗さ金属度・法線）を描く */
function paintSide(Lb: number, head: boolean, liv: EmuLivery): SideMaps {
  const W = 2048, H = 256;
  const X = (z: number) => (z + Lb / 2) / Lb * W, Y = (y: number) => (Y1 - y) / (Y1 - Y0) * H;
  const rect = (g: CanvasRenderingContext2D, z0: number, z1: number, y0: number, y1: number) => g.fillRect(X(z0), Y(y1), X(z1) - X(z0), Y(y0) - Y(y1));
  const [cc, c] = cv(W, H), [ec, e] = cv(W, H), [rc, r] = cv(W, H), [nc, n] = cv(W, H);
  // 地: ステンレス
  const grd = c.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#d4d8dc'); grd.addColorStop(.6, '#c3c8ce'); grd.addColorStop(1, '#aeb4bb');
  c.fillStyle = grd; c.fillRect(0, 0, W, H);
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  r.fillStyle = 'rgb(0,90,170)'; r.fillRect(0, 0, W, H); // G=粗さ, B=金属度
  n.fillStyle = 'rgb(128,128,255)'; n.fillRect(0, 0, W, H);
  // コルゲート（縦ビード）: 窓下と幕板
  for (const [ya, yb] of [[Y0 + .05, 1.6], [3.18, Y1 - .04]] as const) {
    for (let x = 0; x < W; x += 9) {
      n.fillStyle = 'rgb(90,128,255)'; n.fillRect(x, Y(yb), 3, Y(ya) - Y(yb));
      n.fillStyle = 'rgb(166,128,255)'; n.fillRect(x + 4, Y(yb), 3, Y(ya) - Y(yb));
      c.fillStyle = 'rgba(0,0,0,.05)'; c.fillRect(x + 4, Y(yb), 3, Y(ya) - Y(yb));
    }
  }
  // 帯
  c.fillStyle = liv.band; rect(c, -Lb / 2, Lb / 2, 1.64, 1.86);
  c.fillStyle = liv.line; rect(c, -Lb / 2, Lb / 2, 3.12, 3.17);
  r.fillStyle = 'rgb(0,150,40)'; rect(r, -Lb / 2, Lb / 2, 1.64, 1.86); rect(r, -Lb / 2, Lb / 2, 3.12, 3.17);
  const glass = (z0: number, z1: number, y0: number, y1: number) => {
    const gg = c.createLinearGradient(0, Y(y1), 0, Y(y0)); gg.addColorStop(0, '#3b4a58'); gg.addColorStop(1, '#1b232c');
    c.fillStyle = '#4c5258'; rect(c, z0 - .04, z1 + .04, y0 - .04, y1 + .04); // 窓枠ゴム
    c.fillStyle = gg; rect(c, z0, z1, y0, y1);
    e.fillStyle = '#fff'; rect(e, z0, z1, y0, y1);
    r.fillStyle = 'rgb(0,18,30)'; rect(r, z0, z1, y0, y1);
  };
  const door = (zc: number, w: number) => {
    c.fillStyle = '#9aa1a8'; rect(c, zc - w / 2, zc + w / 2, 1.15, 3.07);
    c.fillStyle = '#c9cdd2'; rect(c, zc - w / 2 + .03, zc + w / 2 - .03, 1.17, 3.04);
    c.fillStyle = '#5e646b'; rect(c, zc - .012, zc + .012, 1.17, 3.04); // 戸当たり
    n.fillStyle = 'rgb(128,128,255)'; rect(n, zc - w / 2, zc + w / 2, 1.15, 3.07);
    c.fillStyle = liv.band; rect(c, zc - w / 2 + .03, zc + w / 2 - .03, 1.64, 1.86);
    for (const sgn of [-1, 1]) glass(zc + sgn * w / 4 - .17, zc + sgn * w / 4 + .17, 2.08, 2.92);
  };
  for (const d of DOORS) door(d, DOOR_W);
  // 側窓（2枚組）
  for (let i = 0; i < DOORS.length - 1; i++) {
    const zc = (DOORS[i] + DOORS[i + 1]) / 2, half = 1.32;
    glass(zc - half, zc - .04, 1.98, 3.0); glass(zc + .04, zc + half, 1.98, 3.0);
  }
  glass(DOORS[3] + DOOR_W / 2 + .3, Lb / 2 - .35, 1.98, 3.0);
  if (head) {
    // 乗務員扉＋窓
    const zc = -Lb / 2 + .75;
    c.fillStyle = '#8d949b'; rect(c, zc - .3, zc + .3, 1.2, 3.07);
    glass(zc - .22, zc + .22, 2.15, 2.9);
    glass(-Lb / 2 + 1.25, DOORS[0] - DOOR_W / 2 - .25, 2.05, 3.0);
  } else glass(-Lb / 2 + .35, DOORS[0] - DOOR_W / 2 - .3, 1.98, 3.0);
  // 号車札・弱冷房などの小表示（架空）
  c.fillStyle = '#2b3138'; rect(c, DOORS[1] + .9, DOORS[1] + 1.2, 3.25, 3.4);
  const tex = (k: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(k); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  return { map: tex(cc, true), emissive: tex(ec, true), rm: tex(rc, false), normal: tex(nc, false) };
}

/** 行先表示（LED風） */
function destTexture(text: string, kind: string): THREE.CanvasTexture {
  const [k, g] = cv(512, 128);
  g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#f08a18'; g.fillRect(14, 22, 120, 84);
  g.fillStyle = '#111'; g.font = `800 52px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(kind, 74, 66);
  g.fillStyle = '#ffb347'; g.font = `700 64px ${FONT}`; g.fillText(text, 320, 68);
  // ドット感
  g.fillStyle = 'rgba(0,0,0,.45)';
  for (let x = 0; x < 512; x += 4) g.fillRect(x, 0, 1, 128);
  for (let y = 0; y < 128; y += 4) g.fillRect(0, y, 512, 1);
  const t = new THREE.CanvasTexture(k); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** 発光グロー用の放射グラデーション */
let glowTex: THREE.Texture | null = null;
export function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const [k, g] = cv(128, 128);
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.15, 'rgba(255,255,255,.8)'); r.addColorStop(.4, 'rgba(255,255,255,.18)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(k); glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

// 押し出し: profile[x,y] を z0..z1 へ。sideUV なら u=z, v=y（側面テクスチャ用）
function profileGeo(profile: [number, number][], z0: number, z1: number, flip: boolean, Lb: number): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const [xa, ya] = profile[i], [xb, yb] = profile[i + 1];
    const A = [xa, ya, z0], B = [xb, yb, z0], C = [xb, yb, z1], D = [xa, ya, z1];
    const quad = flip ? [A, C, B, A, D, C] : [A, B, C, A, C, D];
    for (const q of quad) { pos.push(...q); uv.push((q[2] + Lb / 2) / Lb, (q[1] - Y0) / (Y1 - Y0)); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

interface CarGeo { side: THREE.BufferGeometry; paint: THREE.BufferGeometry; glass?: THREE.BufferGeometry; dest?: THREE.BufferGeometry; head?: THREE.BufferGeometry; tail?: THREE.BufferGeometry }

function buildCarGeo(kind: CarKind, L: number, liv: EmuLivery): CarGeo {
  const Lb = L - .5, hz = Lb / 2;
  // 側面（下部は少し絞る）
  const right: [number, number][] = [[HW - .07, Y0], [HW, 1.7], [HW, Y1]];
  const left = right.map(([x, y]) => [-x, y] as [number, number]);
  const side = mergeGeos([profileGeo(right, -hz, hz, false, Lb), profileGeo(left, -hz, hz, true, Lb)]);

  const b = new GeoBatch();
  const add = (k: string, x: number, y: number, z: number, w: number, h: number, d: number, col: number | string, part = P.box, ry = 0, rx = 0) =>
    b.add(k, part, M(x, y, z, ry, w, h, d, rx), col);
  // 屋根（弧）
  const roofPts: [number, number][] = [];
  for (let i = 0; i <= 10; i++) { const a = Math.PI * (i / 10); roofPts.push([Math.cos(a) * HW, Y1 + Math.sin(a) * .26]); }
  b.add('paint', basePart(profileGeo(roofPts, -hz, hz, false, Lb)), M(0, 0, 0), 0x9aa0a6);
  // 雨樋
  for (const sx of [-1, 1]) add('paint', sx * (HW + .01), Y1 + .02, 0, .04, .05, Lb, 0x8d939a);
  // 妻面（後端は常に、前端は中間車のみ）
  const endCap = (z: number) => {
    add('paint', 0, (Y0 + Y1) / 2 + .1, z, HW * 2 - .02, Y1 - Y0 + .22, .06, 0xb9bec4);
    add('paint', 0, 2.1, z + Math.sign(z) * .04, .9, 1.9, .04, 0x5d646c); // 貫通扉
    add('paint', 0, 2.55, z + Math.sign(z) * .06, .55, .7, .02, 0x26303a);
    add('paint', 0, 2.1, z + Math.sign(z) * .2, 1.25, 2.1, .35, 0x2b2e33); // 幌
  };
  endCap(hz);
  let glass: THREE.BufferGeometry | undefined, dest: THREE.BufferGeometry | undefined, head: THREE.BufferGeometry | undefined, tail: THREE.BufferGeometry | undefined;
  if (kind === 'head') {
    const zf = -hz;
    // 前面: 下部ステンレス＋帯、上部ブラックフェイス
    add('paint', 0, 1.42, zf - .03, HW * 2, .78, .1, 0xc3c8ce);
    add('paint', 0, 1.79, zf - .09, HW * 2 - .06, .26, .04, liv.band);
    add('paint', 0, 1.9 + .02, zf - .09, HW * 2 - .06, .04, .04, liv.line);
    add('paint', 0, Y1 + .05, zf - .03, HW * 2, .18, .1, 0xc3c8ce);
    const gb = new GeoBatch();
    gb.add('g', P.box, M(0, 2.73, zf - .05, 0, HW * 2 - .04, 1.46, .1, -.05), 0xffffff);
    glass = gb.geometry('g')!;
    // ブラックフェイス内の前面窓（やや明るい）と縁取り
    for (const [x, w] of [[-.62, 1.45], [.78, 1.15]] as const) add('paint', x, 2.62, zf - .155, w, .95, .02, 0x34404c, P.box, 0, -.05);
    add('paint', 0, 2.0, zf - .1, HW * 2, .05, .08, 0xb9bec4);
    // 行先表示
    dest = new THREE.PlaneGeometry(1.15, .29).rotateY(Math.PI).translate(0, 3.27, zf - .17);
    // 前照灯・尾灯
    const lb = new GeoBatch(), tb = new GeoBatch();
    for (const sx of [-1, 1]) {
      add('paint', sx * 1.0, 1.72, zf - .1, .72, .26, .06, 0x1a1d21);
      lb.add('l', P.box, M(sx * 1.16, 1.72, zf - .14, 0, .3, .17, .04), 0xffffff);
      tb.add('l', P.box, M(sx * .8, 1.72, zf - .14, 0, .22, .13, .04), 0xffffff);
    }
    head = lb.geometry('l')!; tail = tb.geometry('l')!;
    // スカート・連結器
    add('paint', 0, .72, zf - .15, 2.5, .5, .1, 0x30343a, P.box, 0, -.2);
    add('paint', 0, .88, zf - .1, .3, .22, .4, 0x22252a);
    // ワイパー基部
    for (const sx of [-.45, .5]) add('paint', sx, 2.12, zf - .12, .5, .03, .03, 0x111111, P.box, 0, 0);
  } else endCap(-hz);
  // 台枠・床下機器
  add('paint', 0, Y0 - .05, 0, HW * 2 - .2, .12, Lb, 0x3a3d42);
  const boxes: [number, number][] = kind === 'pan' ? [[-3.3, 3.4], [.8, 2.2], [3.6, 1.6]] : kind === 'head' ? [[-2.6, 2.2], [1.2, 3.0]] : [[-3.2, 1.8], [-.4, 2.6], [3.2, 2.2]];
  for (const [z, l] of boxes) add('paint', 0, .82, z, 2.2, .42, l, 0x2b2e33);
  // 台車
  const bz = hz - 2.6;
  for (const z of [-bz, bz]) {
    add('paint', 0, .66, z, 1.9, .26, 1.0, 0x24272b);
    for (const sx of [-1, 1]) {
      add('paint', sx * .82, .52, z, .16, .32, 2.6, 0x2a2d31);
      for (const dz of [-1.05, 1.05]) {
        b.add('paint', P.cyl, M(sx * .6, .43, z + dz, 0, .86, .12, .86, 0, Math.PI / 2), 0x3c3f44);
        add('paint', sx * .9, .43, z + dz, .1, .2, .3, 0x1c1e21);
      }
      add('paint', sx * .9, .62, z, .22, .22, .5, 0x1c1e21); // 空気ばね
    }
  }
  // 屋根上: 冷房装置・パンタグラフ
  const roofTop = Y1 + .26;
  add('paint', 0, roofTop + .16, 0, 2.0, .34, 4.6, 0xb5bac0);
  for (let i = -1; i <= 1; i++) add('paint', 0, roofTop + .34, i * 1.4, 1.5, .02, 1.0, 0x50565c);
  add('paint', 0, roofTop + .03, 0, .5, .06, Lb - 2, 0x868b91); // 配管
  if (kind === 'pan') {
    const pz = -hz + 4.2;
    add('paint', 0, roofTop + .1, pz, 1.6, .12, 1.4, 0x5a5f66);
    for (const sx of [-.6, .6]) for (const dz of [-.5, .5]) add('paint', sx, roofTop + .05, pz + dz, .12, .2, .12, 0x9a6b4b, P.cyl);
    // シングルアーム
    const arm = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, t: number) => {
      const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, len = Math.hypot(dx, dy, dz);
      b.add('paint', P.box, M((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 0, t, len, t, Math.atan2(-dz, dy) * -1), 0x3d4248);
    };
    const hy = 5.3, ky = roofTop + .75;
    arm(0, roofTop + .18, pz + .55, 0, ky, pz - .9, .09);
    arm(0, ky, pz - .9, 0, hy - .05, pz + .1, .06);
    add('paint', 0, hy, pz + .1, 1.9, .05, .12, 0x2a2d31);
    for (const sx of [-1, 1]) add('paint', sx * 1.0, hy - .08, pz + .1, .25, .04, .08, 0x2a2d31, P.box, 0, 0);
  }
  const paint = b.geometry('paint')!;
  return { side, paint, glass, dest, head, tail };
}

function mergeGeos(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [];
  for (const g of gs) {
    pos.push(...(g.attributes.position.array as Float32Array));
    nrm.push(...(g.attributes.normal.array as Float32Array));
    uv.push(...(g.attributes.uv.array as Float32Array));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}

export interface EmuKit {
  /** 1両分のグループ（原点 = 車体中心レール面、前 = -Z）。role で灯火を切り替え */
  makeCar(kind: CarKind, role: CarRole): THREE.Group;
  /** 夜間係数 0..1（窓・前照灯の明るさ） */
  setNight(f: number): void;
  readonly carLen: number;
}

export interface EmuOptions { carLen: number; dest: string; kind?: string; livery?: EmuLivery; renderer: THREE.WebGLRenderer }

export function createEmuKit(o: EmuOptions): EmuKit {
  const L = o.carLen, Lb = L - .5, liv = o.livery ?? DEFAULT_LIVERY;
  const env = envMap(o.renderer);
  const sideMat = (head: boolean) => {
    const m = paintSide(Lb, head, liv);
    return new THREE.MeshStandardMaterial({
      map: m.map, roughnessMap: m.rm, metalnessMap: m.rm, normalMap: m.normal, normalScale: new THREE.Vector2(.6, .6),
      emissiveMap: m.emissive, emissive: 0xfff1d6, emissiveIntensity: 0, roughness: 1, metalness: 1, envMap: env, envMapIntensity: .9,
    });
  };
  const mats = {
    sideHead: sideMat(true), sideMid: sideMat(false),
    paint: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, metalness: .25, envMap: env, envMapIntensity: .6 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0c0f13, roughness: .08, metalness: .3, envMap: env, envMapIntensity: 1.2 }),
    dest: new THREE.MeshBasicMaterial({ map: destTexture(o.dest, o.kind ?? '各停'), toneMapped: false }),
    headOn: new THREE.MeshBasicMaterial({ color: 0xfff6e0, toneMapped: false }),
    tailOn: new THREE.MeshBasicMaterial({ color: 0xff2414, toneMapped: false }),
    off: new THREE.MeshStandardMaterial({ color: 0x8a8f95, roughness: .2, metalness: .5, envMap: env }),
  };
  const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff2d8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .25, fog: true });
  const geos: Partial<Record<CarKind, CarGeo>> = {};
  const geo = (k: CarKind) => (geos[k] ??= buildCarGeo(k, L, liv));

  return {
    carLen: L,
    makeCar(kind, role) {
      const g = geo(kind), car = new THREE.Group(), body = new THREE.Group();
      body.add(new THREE.Mesh(g.side, kind === 'head' ? mats.sideHead : mats.sideMid));
      body.add(new THREE.Mesh(g.paint, mats.paint));
      if (kind === 'head') {
        body.add(new THREE.Mesh(g.glass!, mats.glass), new THREE.Mesh(g.dest!, role === 'front' ? mats.dest : mats.off));
        body.add(new THREE.Mesh(g.head!, role === 'front' ? mats.headOn : mats.off));
        body.add(new THREE.Mesh(g.tail!, role === 'rear' ? mats.tailOn : mats.off));
        if (role === 'front') for (const sx of [-1, 1]) {
          const s = new THREE.Sprite(glowMat); s.position.set(sx * 1.16, 1.72, -Lb / 2 - .3); s.scale.setScalar(1.6); s.name = 'glow'; body.add(s);
        }
        if (role === 'rear') body.rotation.y = Math.PI;
      }
      car.add(body);
      return car;
    },
    setNight(f) {
      for (const m of [mats.sideHead, mats.sideMid]) { m.emissiveIntensity = f * 1.1; m.envMapIntensity = .9 - f * .7; }
      mats.paint.envMapIntensity = .6 - f * .45; mats.glass.envMapIntensity = 1.2 - f * .9;
      glowMat.opacity = .25 + f * .75;
    },
  };
}

/** 2台車の位置から車体の位置・向きを決める（曲線・勾配で自然に見えるよう弦で近似） */
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _mm = new THREE.Matrix4();
export function placeCar(obj: THREE.Object3D, front: THREE.Vector3, rear: THREE.Vector3): void {
  _a.copy(front); _b.copy(rear);
  obj.position.addVectors(_a, _b).multiplyScalar(.5);
  _mm.lookAt(_b, _a, _up); // z 軸 = 後ろ向き → 前 = -Z
  obj.quaternion.setFromRotationMatrix(_mm);
}
