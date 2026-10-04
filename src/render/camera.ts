// カメラ: 運転台視点（走行揺れ付き）/ 外部視点（後方追従・側面）/ リプレイ（沿線カメラの切替演出）
import * as THREE from 'three';
import type { GameContext } from '../core/context';

export interface CabCamera {
  update(time: number): void;
}

const CAB_FOV = 58;

/** リプレイのショット種別 */
type ShotKind = 'trackside' | 'low' | 'chase' | 'heli' | 'platform';
interface Shot { kind: ShotKind; s: number; lat: number; h: number; t0: number; fov: number }
const SHOT_ORDER: ShotKind[] = ['trackside', 'chase', 'low', 'heli', 'trackside', 'trackside'];

export function createCabCamera(ctx: GameContext): CabCamera {
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  const smPos = new THREE.Vector3(), smLook = new THREE.Vector3();
  const lat = -.45; // 運転席は左寄り
  const { events, route } = ctx;
  let outsideVariant = 0, prevMode = ctx.cameraMode, snap = true;
  let shot: Shot | null = null, shotN = 0;

  events.on('cameraMode', ({ mode }) => {
    outsideVariant = mode === 'outside' && prevMode === 'outside' ? (outsideVariant + 1) % 2 : 0;
    prevMode = mode; snap = true; shot = null; shotN = 0;
    setFov(CAB_FOV);
    document.body.classList.toggle('cam-outside', mode !== 'cab');
    document.body.classList.toggle('cam-replay', mode === 'replay');
  });

  function setFov(f: number) {
    if (Math.abs(ctx.camera.fov - f) < .01) return;
    ctx.camera.fov = f; ctx.camera.updateProjectionMatrix();
  }

  /** 次の停車駅 index（リプレイでは位置から推定） */
  const nearStation = (s: number) => route.stations.find(x => !x.pass && x.stopS - s > 0 && x.stopS - s < 420);

  function nextShot(s: number, v: number, time: number): Shot {
    const L = route.trainLength;
    const sta = nearStation(s);
    if (sta && v > 1) return { kind: 'platform', s: sta.stopS + 12, lat: -4.2, h: 2.4, t0: time, fov: 40 };
    const kind = SHOT_ORDER[shotN++ % SHOT_ORDER.length];
    const ahead = Math.max(120, v * 7);
    const side = shotN % 2 ? -1 : 1;
    switch (kind) {
      case 'trackside': return { kind, s: s + ahead, lat: side * (9 + (shotN % 3) * 4), h: 1.8 + (shotN % 2) * 3, t0: time, fov: 32 };
      case 'low': return { kind, s: s + ahead * .8, lat: -2.7, h: .5, t0: time, fov: 50 };
      case 'chase': return { kind, s: 0, lat: side * 6, h: 5, t0: time, fov: 55 };
      case 'heli': return { kind, s: 0, lat: 40, h: 45, t0: time, fov: 45 };
      default: return { kind: 'chase', s: 0, lat: -L * 0, h: 5, t0: time, fov: 55 };
    }
  }

  function updateReplay(s: number, v: number, time: number) {
    const L = route.trainLength, at = ctx.track.at;
    const dur = time - (shot?.t0 ?? 0);
    const fixedPassed = shot && (shot.kind === 'trackside' || shot.kind === 'low' || shot.kind === 'platform') && s - L > shot.s + 10;
    const moveDone = shot && (shot.kind === 'chase' || shot.kind === 'heli') && dur > 7;
    const stalled = shot && dur > 14;
    if (!shot || fixedPassed || moveDone || stalled) { shot = nextShot(s, v, time); snap = true; }
    setFov(shot.fov);
    const mid = s - L * .35;
    switch (shot.kind) {
      case 'trackside': case 'low': case 'platform':
        camPos.copy(at(shot.s, shot.lat, shot.h));
        camLook.copy(at(Math.min(s - 10, shot.s + 30), 0, 2));
        break;
      case 'chase':
        camPos.copy(at(s - L - 28, shot.lat, shot.h));
        camLook.copy(at(s + 40, 0, 1.5));
        break;
      case 'heli': {
        const a = dur * .12;
        camPos.copy(at(mid + Math.cos(a) * 60, shot.lat + Math.sin(a) * 20, shot.h));
        camLook.copy(at(mid, 0, 1));
        break;
      }
    }
  }

  const cam: CabCamera = {
    update(time) {
      const { s, v } = ctx.state.train, at = ctx.track.at, mode = ctx.cameraMode;
      const L = route.trainLength;
      if (mode === 'cab') {
        const shake = Math.min(1, v / 22);
        camPos.copy(at(s, lat, 3.0));
        camPos.y += Math.sin(time * 11.3) * .006 * shake + Math.sin(time * 3.1) * .012 * shake;
        camLook.copy(at(s + 60, lat * .3, 2.4));
        camLook.x += Math.sin(time * 2.3) * .06 * shake;
        ctx.camera.position.copy(camPos);
        ctx.camera.lookAt(camLook);
        return;
      }
      if (mode === 'outside') {
        // ホームと駅舎は進行左側にあるので、外部視点は線路間〜右側から撮る（屋根・駅舎で列車が隠れないように）
        if (outsideVariant === 0) { // 後方斜め上から追従
          camPos.copy(at(s - L - 16, 2.2, 6));
          camLook.copy(at(s + 30, 0, 1.5));
        } else { // 先頭付近の側面
          camPos.copy(at(s - 25, 12, 3.2));
          camLook.copy(at(s - 30, 0, 2));
        }
      } else updateReplay(s, v, time);
      // 追従系はなめらかに（切替直後は即時）
      const k = snap ? 1 : mode === 'replay' && shot && (shot.kind === 'trackside' || shot.kind === 'low' || shot.kind === 'platform') ? 1 : .15;
      smPos.lerp(camPos, k); smLook.lerp(camLook, k);
      if (snap) { smPos.copy(camPos); smLook.copy(camLook); snap = false; }
      ctx.camera.position.copy(smPos);
      ctx.camera.lookAt(smLook);
    },
  };
  return cam;
}
