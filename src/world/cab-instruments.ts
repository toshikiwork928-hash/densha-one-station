import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { FONT, NOTCH_EB } from '../core/config';
import type { GameContext } from '../core/context';
import type { TrainKind } from '../route/types';
import { createCabMonitor } from './cab-monitor';

type Instrument = 'speed' | 'brake' | 'reservoir' | 'current' | 'voltage';
const scales: Record<Instrument, [number, string]> = {
  speed: [120, 'km/h'], brake: [600, 'kPa'], reservoir: [1000, 'kPa'], current: [600, 'A'], voltage: [2000, 'V'],
};
interface Desk {
  color: number;
  dial: string;
  width: number;
  gauges: Instrument[];
  pillar?: boolean;
  upperScreen?: boolean;
  digital?: boolean;
  low?: boolean;
  panelY?: number;
}
const oldDesk: Desk = { color: 0xaaa9a2, dial: '#dedfda', width: 1.15, gauges: ['brake', 'reservoir', 'speed', 'current', 'voltage'] };
const threeDial: Desk = { color: 0x353737, dial: '#d9d7bd', width: .98, gauges: ['brake', 'speed', 'reservoir'] };
const digitalDesk: Desk = { color: 0x353638, dial: '#d9d5c2', width: 1.17, gauges: [], digital: true };
const desks: Record<TrainKind, Desk> = {
  'commuter-old': { ...oldDesk, panelY: 2.57 },
  'commuter-7100-restored': { ...oldDesk, panelY: 2.57 },
  'commuter-6300': { ...oldDesk, color: 0x414249 },
  'commuter-new': { ...threeDial, color: 0x262a29, dial: '#c7cfc1', upperScreen: true },
  'commuter-1000': { ...digitalDesk, width: 1.38, panelY: 2.73, color: 0x262727 },
  'commuter-9000': { ...threeDial, color: 0x292f40, gauges: ['speed', 'brake'], pillar: true },
  'commuter-2000': { ...threeDial, pillar: true },
  'commuter-2300': { ...threeDial, width: 1.08, color: 0x52504b },
  'southern-10000': { ...oldDesk, color: 0x2d3348, dial: '#e7cfa5' },
  'southern-12000': { ...threeDial, width: 1.12, color: 0x484c4c, dial: '#ddddcd' },
  limited: { ...digitalDesk, width: 1.34 },
  'limited-30000': { ...threeDial, width: 1.24, dial: '#e0d6bd', color: 0x444345, low: true },
};

function artwork(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d')!;
  paint(g);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { g, texture };
}

function dialArt(type: Instrument, paper: string) {
  const [max, unit] = scales[type];
  return artwork(256, 256, g => {
    const gradient = g.createRadialGradient(96, 83, 4, 128, 128, 128);
    gradient.addColorStop(0, '#f4f0e4'); gradient.addColorStop(.78, paper); gradient.addColorStop(1, '#8c8e82');
    g.fillStyle = gradient; g.fillRect(0, 0, 256, 256);
    g.translate(128, 128);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 17px Arial';
    for (let i = 0; i <= 60; i++) {
      const angle = (-135 + i * 4.5) * Math.PI / 180;
      g.save(); g.rotate(angle);
      g.fillStyle = i >= 54 && type === 'speed' ? '#96382e' : '#272928';
      g.fillRect(-1.1, -113, i % 5 === 0 ? 3 : 1.5, i % 5 === 0 ? 15 : 6);
      g.restore();
      if (i % 10 === 0) {
        g.fillStyle = '#242624';
        g.fillText(String(Math.round(max * i / 60)), 82 * Math.sin(angle), -82 * Math.cos(angle));
      }
    }
    g.font = '16px Arial'; g.fillText(unit, 0, 52);
  }).texture;
}

export function createCabInstruments(ctx: GameContext, root: THREE.Group, kind: TrainKind) {
  const spec = desks[kind];
  const paint = new THREE.MeshStandardMaterial({ color: spec.color, roughness: .69 });
  // 結晶塗装の細かな濃淡と、筐体の縁に回る光を表す。
  const finish = artwork(512, 128, g => {
    const shade = g.createLinearGradient(0, 0, 0, 128);
    shade.addColorStop(0, '#ffffff'); shade.addColorStop(.12, '#efefef');
    shade.addColorStop(.85, '#dedede'); shade.addColorStop(1, '#aaaaaa');
    g.fillStyle = shade; g.fillRect(0, 0, 512, 128);
    let seed = 19;
    for (let i = 0; i < 14000; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      g.fillStyle = i % 2 ? 'rgba(35,35,35,.10)' : 'rgba(255,255,255,.24)';
      g.fillRect(seed & 511, (seed >>> 16) & 127, 1, 1);
    }
  });
  paint.map = finish.texture;
  const rubber = new THREE.MeshStandardMaterial({ color: 0x292a27, roughness: .84 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xa5a7a1, roughness: .38, metalness: .32 });
  const lampFaces: THREE.MeshStandardMaterial[] = [];
  const needles: { type: Instrument; mesh: THREE.Mesh }[] = [];
  function part(parent: THREE.Object3D, geometry: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z); parent.add(mesh);
    return mesh;
  }
  function housing(parent: THREE.Object3D, w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, radius = .018) {
    return part(parent, new RoundedBoxGeometry(w, h, d, 2, radius), mat, x, y, z);
  }
  function cylinder(parent: THREE.Object3D, r: number, h: number, mat: THREE.Material, x: number, y: number, z: number) {
    return part(parent, new THREE.CylinderGeometry(r, r, h, 32), mat, x, y, z);
  }
  function gauge(parent: THREE.Object3D, type: Instrument, x: number, y: number, r: number) {
    const tex = dialArt(type, spec.dial);
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: .22, roughness: .55 });
    lampFaces.push(mat);
    part(parent, new THREE.CircleGeometry(r, 48), mat, x, y, .006);
    part(parent, new THREE.TorusGeometry(r, .0055, 8, 48), rubber, x, y, .007);
    part(parent, new THREE.TorusGeometry(r + .0055, .0022, 6, 48), steel, x, y, .006);
    const arm = new THREE.Shape();
    arm.moveTo(-.0032, -r * .19); arm.lineTo(.0032, -r * .19); arm.lineTo(.001, r * .87); arm.lineTo(-.001, r * .87); arm.closePath();
    needles.push({ type, mesh: part(parent, new THREE.ShapeGeometry(arm), new THREE.MeshBasicMaterial({color: type === 'brake' ? 0xac382b : 0x24282b}), x, y, .011) });
    part(parent, new THREE.CircleGeometry(.006, 16), rubber, x, y, .012);
  }

  // 傾いた筐体に、計器面と各部品を同じ座標系で取り付ける。
  const panel = new THREE.Group();
  const integrated = kind === 'commuter-1000';
  const is7100 = kind === 'commuter-old' || kind === 'commuter-7100-restored';
  panel.position.set(-.46, spec.panelY ?? (spec.low ? 2.58 : 2.635), -1.045);
  panel.rotation.x = integrated ? -.28 : -.43;
  root.add(panel);
  const height = integrated ? .44 : spec.low ? .215 : .266;
  housing(panel, spec.width, height, .14, paint, 0, 0, -.07, .035);
  const left = -spec.width / 2;
  const dialRadius = spec.gauges.length === 5 ? .088 : .092;
  const step = 2 * dialRadius + .024;
  spec.gauges.forEach((type, i, all) => {
    const center = spec.pillar && all.length === 2 ? .09 : spec.low ? -.14 : 0;
    gauge(panel, type, center + (i - (all.length - 1) / 2) * step, .012, dialRadius);
  });
  if (spec.pillar) {
    const pod = new THREE.Group();
    pod.position.set(-1.01, 3.04, -1.215); root.add(pod);
    housing(pod, .202, .41, .083, paint, 0, 0, -.042);
    gauge(pod, 'current', 0, .098, .076); gauge(pod, 'voltage', 0, -.098, .076);
  }
  // 隅の留めねじと計器名板。
  for (const x of [left + .025, -left - .025]) for (const y of [-1, 1]) {
    part(panel, new THREE.CircleGeometry(.006, 10), steel, x, y * (height / 2 - .027), .001);
  }
  const labels = artwork(512, 48, g => {
    g.fillStyle = '#c5b994'; g.fillRect(0, 0, 512, 48);
    g.fillStyle = '#302f2d'; g.textAlign = 'center'; g.font = `22px ${FONT}`; g.fillText('計 器 灯　　運 転 台', 256, 32);
  });
  part(panel, new THREE.PlaneGeometry(.15, .014), new THREE.MeshBasicMaterial({map: labels.texture}), -.06, -height / 2 + .015, .001);

  // 行路表示器と運転支援モニター。形状と明るさを分け、前方の視界を空ける。
  const monitorX = spec.digital ? panel.position.x + spec.width / 2 - .085 : .255;
  const redrawCard = integrated ? createCabMonitor(ctx, panel, .445, .005, -.031, .32, .342, 'flush')
    : is7100 ? createCabMonitor(ctx, root, .045, 2.92, -1.17, .36, .535, 'classic')
    : createCabMonitor(ctx, root, monitorX, spec.digital ? 2.65 : 2.85,
      spec.digital ? -.973 : -1.13, spec.digital ? .185 : .245, spec.digital ? .218 : .36);
  if (spec.upperScreen) {
    housing(root, .33, .205, .09, rubber, .37, 3.31, -1.22);
    const lcd = artwork(256, 144, g => {
      g.fillStyle = '#203132'; g.fillRect(0, 0, 256, 144);
      g.fillStyle = '#aacfc1'; g.font = `13px ${FONT}`; g.fillText('車両モニタ', 12, 20);
      for (let i = 0; i < 6; i++) {
        g.strokeStyle = '#9aafa4'; g.strokeRect(10 + 40 * i, 48, 34, 19);
        g.fillStyle = '#8eb08f'; g.fillRect(14 + 40 * i, 71, 26, 5);
      }
      g.fillStyle = '#405975'; g.fillRect(6, 116, 244, 17);
    });
    part(root, new THREE.PlaneGeometry(.285, .158), new THREE.MeshBasicMaterial({map: lcd.texture}), .37, 3.31, -1.171);
    housing(root, .05, .34, .06, rubber, .37, 3.52, -1.25);
  }

  const readout = is7100 ? undefined : artwork(512, 192, () => {});
  const displayW = integrated ? .88 : spec.digital ? .69 : .145;
  const clockPanel = spec.digital ? panel : new THREE.Group();
  if (!spec.digital && !is7100) {
    clockPanel.position.set(-1.13, 2.61, -1.04);
    clockPanel.rotation.x = -.34;
    root.add(clockPanel);
    housing(clockPanel, .17, .082, .095, rubber, 0, 0, -.046);
    housing(clockPanel, .086, .123, .073, paint, 0, -.087, -.055);
  }
  if (readout) part(clockPanel, new THREE.PlaneGeometry(displayW, integrated ? .323 : spec.digital ? .193 : .048),
    new THREE.MeshBasicMaterial({ map: readout.texture }), integrated ? -.185 : spec.digital ? -.08 : 0, 0, .009);
  let lastDigits = '';
  function drawReadout(kmh: number) {
    if (!readout) return;
    const minutes = Math.floor((ctx.route.startClock + ctx.state.t) / 60);
    const clock = `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    const bars = Math.round(pressure / 30);
    const key = integrated ? [clock, kmh, bars, ctx.state.train.notch].join('/') : spec.digital ? clock + kmh : clock;
    if (key === lastDigits) return;
    lastDigits = key;
    const g = readout.g;
    g.fillStyle = '#191b19'; g.fillRect(0, 0, 512, 192);
    g.fillStyle = '#d6ad68'; g.font = spec.digital ? '26px monospace' : '116px monospace';
    g.fillText(clock, spec.digital ? 14 : 62, spec.digital ? 44 : 136);
    if (spec.digital) {
      for (let i = 0; i <= 36; i++) {
        const a = (-132 + 264 * i / 36) * Math.PI / 180;
        g.save(); g.translate(244, 110); g.rotate(a);
        g.fillStyle = i / 36 <= kmh / 120 ? '#d5a75c' : '#595b53';
        g.fillRect(-2, -95, 4, i % 3 === 0 ? 12 : 6); g.restore();
      }
      g.textAlign = 'center'; g.fillStyle = '#e3b770'; g.font = 'bold 51px monospace'; g.fillText(String(kmh), 244, 121);
      g.font = '19px sans-serif'; g.fillText('km/h', 244, 149); g.textAlign = 'left';
      g.strokeStyle = '#63675c'; g.strokeRect(365, 22, 123, 71); g.strokeRect(365, 101, 123, 65);
      g.fillStyle = '#b5bea5'; g.font = '19px sans-serif'; g.fillText('ATS', 377, 52);
      if (integrated) {
        g.fillStyle = '#191b19'; g.fillRect(0, 0, 133, 192); g.fillRect(353, 0, 159, 192);
        g.font = '13px sans-serif'; g.fillStyle = '#a8aaa3';
        g.fillText('架線電圧', 15, 27); g.fillText('主回路電流', 15, 97); g.fillText('ATS', 356, 34);
        g.strokeStyle = '#717571'; g.strokeRect(11, 32, 109, 33); g.strokeRect(11, 101, 109, 33);
        g.font = '23px monospace'; g.fillStyle = '#f29441'; g.fillText('1500', 25, 58);
        g.fillText(String(Math.max(0, ctx.state.train.notch) * 87), 25, 127);
        g.font = '14px monospace'; g.fillText(clock, 15, 169);
        for (const [index, value] of [bars, 16].entries()) {
          const x = 423 + index * 46;
          g.strokeStyle = '#636961'; g.strokeRect(x, 18, 31, 137);
          for (let tick = 0; tick < 20; tick++) {
            g.fillStyle = tick < value ? '#dd903e' : '#393a37';
            g.fillRect(x + 12, 146 - 6 * tick, 13, 4);
            if (tick % 2 === 0) { g.fillStyle = '#b4b4a8'; g.fillRect(x + 3, 147 - 6 * tick, 6, 1); }
          }
          g.fillStyle = '#aaa99c'; g.font = '13px monospace'; g.fillText(index === 0 ? 'BC' : 'MR', x + 5, 176);
        }
      }
    }
    readout.texture.needsUpdate = true;
  }
  const door = new THREE.MeshBasicMaterial();
  const lampX = spec.digital ? .44 : -left - .085;
  part(panel, new THREE.CircleGeometry(.013, 20), rubber, lampX, -.087, .007);
  part(panel, new THREE.CircleGeometry(.009, 20), door, lampX, -.087, .009);
  if (spec.gauges.length < 5 && !spec.digital) {
    const switches = artwork(512, 64, g => {
      g.fillStyle = '#242725'; g.fillRect(0, 0, 512, 64);
      for (let i = 0; i < 9; i++) {
        const x = 15 + i * 54;
        g.fillStyle = '#090c0b'; g.fillRect(x, 8, 34, 48);
        g.fillStyle = i === 3 ? '#b18d50' : i === 6 ? '#778e6d' : '#575c57';
        g.fillRect(x + 5, 14, 24, 12);
        g.fillStyle = '#373c38'; g.fillRect(x + 5, 32, 24, 13);
      }
    });
    part(panel, new THREE.PlaneGeometry(.37, .033), new THREE.MeshBasicMaterial({ map: switches.texture }), 0, -.098, .005);
  }

  // 手前の左右にある主幹制御器とブレーキ弁は、それぞれの操作域で動かす。
  function controller(x: number, right: boolean) {
    const z = right ? -.69 : -.755;
    cylinder(root, right ? .09 : .105, .067, paint, x, 2.503, z);
    cylinder(root, .058, .035, steel, x, 2.548, z);
    const pivot = new THREE.Group(); pivot.position.set(x, 2.577, z); root.add(pivot);
    const dir = right ? -1 : 1;
    housing(pivot, .138, .027, .032, steel, dir * .063, 0, 0, .01);
    housing(pivot, .084, .055, .048, rubber, dir * .142, .01, 0);
    return pivot;
  }
  const master = controller(-.99, false), brake = controller(.015, true);
  let pressure = 0;
  return {
    redrawCard,
    update(dt: number, time: number) {
      const { v, notch } = ctx.state.train;
      const kmh = v * 3.6, braking = notch === NOTCH_EB ? 480 : Math.max(0, -notch) * 45;
      const blend = Math.min(1, dt * 12);
      pressure += (braking - pressure) * Math.min(1, dt * 1.6);
      master.rotation.y += (-Math.max(0, notch) * .14 - master.rotation.y) * blend;
      brake.rotation.y += (Math.max(0, -notch) * .105 - brake.rotation.y) * blend;
      const values = {speed: kmh, brake: pressure, reservoir: 780 + 18 * Math.sin(time * .3), current: Math.max(0, notch) * 87, voltage: 1500};
      for (const {type, mesh} of needles)
        mesh.rotation.z = THREE.MathUtils.degToRad(135 - 270 * Math.min(1, values[type] / scales[type][0]));
      for (const mat of lampFaces) mat.emissiveIntensity = .18 + .49 * Math.max(ctx.light.night, ctx.light.tunnel);
      door.color.setHex(ctx.state.doors === 'closed' ? 0xe8aa53 : 0x573e28);
      drawReadout(Math.round(kmh));
    },
  };
}
