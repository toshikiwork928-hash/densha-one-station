// 運転台卓上の時刻表モニター。配置と破棄は親の運転台モジュールが担当する。
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import { FONT } from '../core/config';

function timetableTexture(ctx: GameContext): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = 360; canvas.height = 540;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#f7f4e9'; g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#264d60'; g.fillRect(157, 8, 187, 42);
  g.fillStyle = '#faf9ef'; g.font = `800 29px ${FONT}`; g.fillText(ctx.service?.name ?? '普通', 167, 39, 169);
  g.fillStyle = '#202426'; g.font = `700 23px ${FONT}`; g.fillText('運行時刻表', 12, 36);
  g.font = `500 17px ${FONT}`;
  ctx.route.stations.slice(0, 13).forEach((station, i) => {
    const t = ctx.route.startClock + station.scheduledArrival;
    const hh = Math.floor(t / 3600) % 24, mm = Math.floor(t / 60) % 60;
    const y = 70 + i * 35;
    g.fillStyle = station.pass ? '#858585' : '#202426';
    g.fillText(station.name, 18, y);
    g.textAlign = 'right'; g.fillText(station.pass ? '通過' : `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, 338, y); g.textAlign = 'left';
    g.strokeStyle = '#c8c4b8'; g.lineWidth = 1; g.beginPath(); g.moveTo(16, y + 10); g.lineTo(344, y + 10); g.stroke();
  });
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

/** 卓上モニターを配置し、呼び出し時に時刻表テクスチャを再描画する関数を返す。 */
export function createCabMonitor(ctx: GameContext, root: THREE.Group, x: number, y: number, z: number, w: number, h: number,
  mount: 'stand' | 'classic' | 'flush' = 'stand'): () => void {
  const monitor = new THREE.Group(); monitor.name = 'cab-timetable-monitor'; monitor.position.set(x, y, z); root.add(monitor);
  const dark = new THREE.MeshLambertMaterial({ color: 0x15191c });
  const edge = new THREE.MeshLambertMaterial({ color: 0x30373b });
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, .075), dark); box.name = 'monitor-housing'; monitor.add(box);

  const screenW = w * (mount === 'stand' ? .57 : .68), screenH = h * (mount === 'classic' ? .66 : .82);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), new THREE.MeshLambertMaterial({ map: timetableTexture(ctx), side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: .08 }));
  screen.name = 'timetable-screen'; screen.position.set(-w * .10, mount === 'classic' ? h * .085 : 0, .041); monitor.add(screen);
  // 右側の縦長表示器。黒ガラスと細い青緑の状態線で質感を出す。
  const vertical = new THREE.Mesh(new THREE.PlaneGeometry(w * .16, h * .64), new THREE.MeshBasicMaterial({ color: 0x071014 }));
  vertical.name = 'right-vertical-display'; vertical.position.set(w * .36, h * .04, .043); monitor.add(vertical);
  const status = new THREE.Mesh(new THREE.PlaneGeometry(w * .1, h * .025), new THREE.MeshBasicMaterial({ color: 0x35b9a5 }));
  status.position.set(w * .36, -h * .27, .046); monitor.add(status);
  // 時刻表の下にある丸時計。黒枠と淡い文字盤を分けて、直立箱の下端を実機らしく見せる。
  if (mount === 'classic') {
    const clockR = w * .142;
    const dial = document.createElement('canvas'); dial.width = dial.height = 144;
    const g = dial.getContext('2d')!;
    g.fillStyle = '#dedbcf'; g.fillRect(0, 0, 144, 144); g.translate(72, 72);
    for (let i = 0; i < 60; i++) {
      g.save(); g.rotate(i * Math.PI / 30); g.fillStyle = '#373930';
      g.fillRect(-1, -66, i % 5 ? 1 : 3, i % 5 ? 4 : 9); g.restore();
    }
    const tex = new THREE.CanvasTexture(dial); tex.colorSpace = THREE.SRGBColorSpace;
    const frame = new THREE.Mesh(new THREE.CircleGeometry(clockR + .006, 32), dark);
    frame.position.set(-w * .18, -h * .36, .046); monitor.add(frame);
    const face = new THREE.Mesh(new THREE.CircleGeometry(clockR, 32), new THREE.MeshBasicMaterial({map: tex}));
    face.position.z = .003; frame.add(face);
    const hands = [.49, .77].map(length => {
      const geom = new THREE.BoxGeometry(.0024, clockR * length, .001);
      geom.translate(0, clockR * length / 2, 0);
      const hand = new THREE.Mesh(geom, dark); hand.position.z = .002; face.add(hand); return hand;
    });
    face.onBeforeRender = () => {
      const now = ctx.route.startClock + ctx.state.t;
      hands[0].rotation.z = -now * Math.PI / 21600;
      hands[1].rotation.z = -now * Math.PI / 1800;
      for (const hand of hands) hand.updateMatrixWorld(true);
    };
  }
  // 前面の小札と固定ねじ。
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(w * .19, h * .055), new THREE.MeshBasicMaterial({ color: 0xb8b4a5 }));
  tag.position.set(-w * .12, -h * .45, .046); monitor.add(tag);
  for (const sx of [-.46, .46]) for (const sy of [-.44, .44]) {
    const screw = new THREE.Mesh(new THREE.CircleGeometry(.008, 12), new THREE.MeshBasicMaterial({ color: 0xb7bbb8 }));
    screw.position.set(w * sx, h * sy, .047); monitor.add(screw);
  }

  // 取付脚の下端は机面にそろえる。
  const footHeight = Math.max(.012, y - h / 2 - 2.48);
  for (const sx of mount === 'flush' ? [] : [-.36, .36]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(w * .08, footHeight, .08), edge);
    foot.position.set(w * sx, -(h + footHeight) / 2, -.015); monitor.add(foot);
    const stay = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, h * .42, 8), edge); stay.position.set(w * sx, -h * .35, -.055); stay.rotation.z = sx < 0 ? -.16 : .16; monitor.add(stay);
  }
  // 右下の小型スイッチ列。
  for (let i = 0; i < 3; i++) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(w * .045, h * .07, .025), new THREE.MeshLambertMaterial({ color: i === 1 ? 0xa67c2e : 0x60676a }));
    sw.position.set(w * (.25 + i * .07), -h * .38, .05); sw.rotation.x = -.25; monitor.add(sw);
  }

  return () => {
    const mat = screen.material as THREE.MeshLambertMaterial;
    const old = mat.map;
    mat.map = timetableTexture(ctx); mat.needsUpdate = true;
    old?.dispose();
  };
}
