// 車両モデルの窓口。種別ごとの外観を手続き生成する（通勤形 新・旧、特急形）
// 1両 = 材質別に結合したメッシュ数個。ジオメトリ・材質・テクスチャは種別ごとに共有し、行先 LED のみ編成ごと
import * as THREE from 'three';
import type { TrainKind } from '../route/types';
import { envMap, glowTexture, ledTexture, type CarKind, type CarParts, type SheetMaps } from './trains/common';
import { buildCommuterCar, paintCommuterFace, paintCommuterSide, HW, YTOP } from './trains/commuter';
import { buildLimitedCar, paintLimitedSide, HW_L } from './trains/limited';

/** 1両分の生成結果。原点 = 車体中心・レール面高さ、前 = -Z */
export interface TrainCar { object: THREE.Object3D; length: number }

/** 行先表示などの任意指定 */
export interface TrainSetOptions {
  /** 行先（既定 海浜公園） */
  dest?: string;
  /** 種別表示（既定は車種から 各停/急行/特急） */
  label?: string;
}

/** 編成を生成（先頭車 index 0、最後尾は逆向きの先頭車） */
export type CreateTrainSet = (kind: TrainKind, cars: number, renderer: THREE.WebGLRenderer, opts?: TrainSetOptions) => TrainCar[];

export const TRAIN_KINDS: Record<TrainKind, { label: string; service: string }> = {
  'commuter-new': { label: '通勤形（ステンレス・黒顔）', service: '各停' },
  'commuter-old': { label: '通勤形（鋼製・貫通扉）', service: '急行' },
  limited: { label: '特急形', service: '特急' },
};

export const CAR_LEN = 20;
const LB = CAR_LEN - .5; // 車体長（連結面間隔 0.5m）

/** n 両編成の車種並び（両端 = 先頭車、所々にパンタ付き） */
export function formation(n: number): CarKind[] {
  return Array.from({ length: n }, (_, i): CarKind => i === 0 || i === n - 1 ? 'head' : i % 3 === 2 ? 'pan' : 'mid');
}

interface KindKit {
  geo(k: CarKind): CarParts;
  side: { head: THREE.MeshStandardMaterial; mid: THREE.MeshStandardMaterial };
  face?: THREE.MeshStandardMaterial;
  paint: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  base: { env: number; paintEnv: number };
}

const kindKits = new Map<TrainKind, KindKit>();
const shared = {
  headOn: new THREE.MeshBasicMaterial({ color: 0xfff6e0, vertexColors: true, toneMapped: false }),
  tailOn: new THREE.MeshBasicMaterial({ color: 0xff2414, toneMapped: false }),
  off: null as THREE.MeshStandardMaterial | null,
  glow: new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff2d8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .25, fog: true }),
};
const ledMats = new Map<string, THREE.MeshBasicMaterial>();
let night = 0;

function sheetMat(m: SheetMaps, env: THREE.Texture, physical: boolean, envI: number): THREE.MeshStandardMaterial {
  const p = {
    map: m.map, roughnessMap: m.rm, metalnessMap: m.rm, emissiveMap: m.emissive, emissive: 0xfff1d6, emissiveIntensity: 0,
    roughness: 1, metalness: 1, envMap: env, envMapIntensity: envI,
  };
  return physical ? new THREE.MeshPhysicalMaterial({ ...p, clearcoat: 1, clearcoatRoughness: .07 }) : new THREE.MeshStandardMaterial(p);
}

function kindKit(kind: TrainKind, renderer: THREE.WebGLRenderer): KindKit {
  let k = kindKits.get(kind);
  if (k) return k;
  const env = envMap(renderer), geos = new Map<CarKind, CarParts>();
  shared.off ??= new THREE.MeshStandardMaterial({ color: 0x8a8f95, roughness: .2, metalness: .5, envMap: env });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0c0f13, roughness: .06, metalness: .3, envMap: env, envMapIntensity: 1.2, emissive: 0xfff1d6, emissiveIntensity: 0 });
  if (kind === 'limited') {
    const paint = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .22, metalness: .5, clearcoat: 1, clearcoatRoughness: .07, envMap: env, envMapIntensity: 1.2, side: THREE.DoubleSide });
    k = {
      geo: c => geos.get(c) ?? (geos.set(c, buildLimitedCar(c, LB)), geos.get(c)!),
      side: { head: sheetMat(paintLimitedSide(LB, true), env, true, 1.2), mid: sheetMat(paintLimitedSide(LB, false), env, true, 1.2) },
      paint, glass, base: { env: 1.2, paintEnv: 1.2 },
    };
  } else {
    const v = kind === 'commuter-new' ? 'new' : 'old', envI = v === 'new' ? .9 : .6;
    const paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5, metalness: v === 'new' ? .35 : .15, envMap: env, envMapIntensity: .6 });
    k = {
      geo: c => geos.get(c) ?? (geos.set(c, buildCommuterCar(v, c, LB)), geos.get(c)!),
      side: { head: sheetMat(paintCommuterSide(v, LB, true), env, false, envI), mid: sheetMat(paintCommuterSide(v, LB, false), env, false, envI) },
      face: sheetMat(paintCommuterFace(v), env, false, envI),
      paint, glass, base: { env: envI, paintEnv: .6 },
    };
  }
  kindKits.set(kind, k);
  applyNight(k);
  return k;
}

function ledMat(label: string, dest: string): THREE.MeshBasicMaterial {
  const key = `${label}|${dest}`;
  let m = ledMats.get(key);
  if (!m) { m = new THREE.MeshBasicMaterial({ map: ledTexture(label, dest), toneMapped: false }); ledMats.set(key, m); }
  return m;
}

function makeCar(kit: KindKit, kind: CarKind, role: 'front' | 'rear' | 'mid', led: THREE.Material): THREE.Group {
  const g = kit.geo(kind), car = new THREE.Group(), body = new THREE.Group();
  body.add(new THREE.Mesh(g.shell, kind === 'head' ? kit.side.head : kit.side.mid));
  body.add(new THREE.Mesh(g.paint, kit.paint));
  if (g.face && kit.face) body.add(new THREE.Mesh(g.face, kit.face));
  if (g.glass) body.add(new THREE.Mesh(g.glass, kit.glass));
  if (g.led) body.add(new THREE.Mesh(g.led, led));
  if (kind === 'head') {
    // 前: 前照灯点灯（尾灯は付けない）、後: 尾灯点灯・前照灯は消灯色
    if (role === 'front' && g.head) body.add(new THREE.Mesh(g.head, shared.headOn));
    if (role !== 'front' && g.head) body.add(new THREE.Mesh(g.head, shared.off!));
    if (role === 'rear' && g.tail) body.add(new THREE.Mesh(g.tail, shared.tailOn));
    if (role === 'front') for (const p of g.glows) {
      const s = new THREE.Sprite(shared.glow); s.position.copy(p); s.scale.setScalar(1.4); s.name = 'glow'; body.add(s);
    }
    if (role === 'rear') body.rotation.y = Math.PI;
  }
  for (const o of body.children) { o.matrixAutoUpdate = false; o.updateMatrix(); }
  car.add(body);
  return car;
}

export const createTrainSet: CreateTrainSet = (kind, cars, renderer, opts = {}) => {
  const n = Math.max(1, cars), kit = kindKit(kind, renderer);
  const led = ledMat(opts.label ?? TRAIN_KINDS[kind].service, opts.dest ?? '海浜公園');
  return formation(n).map((k, i) => ({
    object: makeCar(kit, n === 1 ? 'head' : k, i === 0 ? 'front' : i === n - 1 ? 'rear' : 'mid', led),
    length: CAR_LEN,
  }));
};

function applyNight(k: KindKit) {
  for (const m of [k.side.head, k.side.mid, k.face]) if (m) { m.emissiveIntensity = night * 1.1; m.envMapIntensity = k.base.env * (1 - night * .75); }
  k.paint.envMapIntensity = k.base.paintEnv * (1 - night * .75);
  k.glass.envMapIntensity = 1.2 - night * .9; k.glass.emissiveIntensity = night * .5;
}

/** 夜間係数 0..1（窓明かり・灯具のグロー・環境反射）。全編成で共通 */
export function setTrainNight(f: number): void {
  night = f;
  for (const k of kindKits.values()) applyNight(k);
  shared.glow.opacity = .25 + f * .75;
}
/** 互換: 編成指定版（材質は種別で共有のため全体に効く） */
export function setTrainSetNight(_set: readonly TrainCar[], f: number): void { setTrainNight(f); }

/** 車体寸法（カメラ・当たり判定などの参考） */
export const TRAIN_DIMS = { halfWidth: Math.max(HW, HW_L), height: YTOP };
