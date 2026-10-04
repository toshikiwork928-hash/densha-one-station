// 先行列車（見えない仮想列車）と閉そく信号の現示計算。純関数のみ（テスト・調整用に DOM 非依存）
import type { SignalAspect } from '../core/events';
import type { Route } from '../route/types';

/** 先行列車の自列車に対する時隔 [s] */
const HEADWAY = 240;
/** 先行（各駅停車）が通過駅に停車する時間 [s]。ここで詰まって Y/YG が出る */
const LOCAL_STOP = 75;
/** 先行（各駅停車）の停車駅での追加停車 [s] */
const EXTRA_DWELL = 15;
/** 先行列車の編成長 [m] */
const PREC_LEN = 120;
/** 最後の信号の閉そく長 [m]（終端側の閉そくを有限にする） */
const LAST_BLOCK = 500;

interface Key { t: number; s: number }

/** 先行列車の走行計画 (t, s) キー。区間内は smoothstep で加減速を近似 */
export function buildPrecedingKeys(route: Route): Key[] {
  const keys: Key[] = [];
  let extra = 0;
  route.stations.forEach((sta, i) => {
    const arr = sta.scheduledArrival - HEADWAY + extra;
    if (i === 0) { keys.push({ t: -1e6, s: sta.stopS }, { t: -HEADWAY, s: sta.stopS }); return; }
    keys.push({ t: arr, s: sta.stopS });
    const dw = sta.pass ? LOCAL_STOP : (sta.dwell ?? 20) + EXTRA_DWELL;
    extra += sta.pass ? LOCAL_STOP : EXTRA_DWELL; // 停車分 + 加減速の損失
    keys.push({ t: arr + dw, s: sta.stopS });
  });
  // 終着後は先へ抜けて消える
  const last = keys[keys.length - 1];
  keys.push({ t: last.t + 140, s: last.s + 2500 }, { t: 1e6, s: last.s + 2500 });
  return keys;
}

/** 時刻 t の先行列車先頭位置 */
export function precedingHead(keys: Key[], t: number): number {
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t < b.t) {
      if (b.s === a.s) return a.s;
      const u = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
      return a.s + (b.s - a.s) * u * u * (3 - 2 * u);
    }
  }
  return keys[keys.length - 1].s;
}

/** 列車（先頭 head, 長さ len）が閉そく j を占有しているか */
function occupies(sigS: number[], j: number, head: number, len: number): boolean {
  const from = sigS[j], to = j + 1 < sigS.length ? sigS[j + 1] : sigS[j] + LAST_BLOCK;
  return head >= from && head - len < to;
}

/** 信号 i の現示。trains = 占有判定する列車 [head, len][] */
export function aspectOf(sigS: number[], i: number, trains: [number, number][]): SignalAspect {
  for (let k = 0; k < 3; k++) {
    const j = i + k;
    if (j >= sigS.length) break;
    if (trains.some(([h, l]) => occupies(sigS, j, h, l))) return k === 0 ? 'R' : k === 1 ? 'Y' : 'YG';
  }
  return 'G';
}

export const PRECEDING_LENGTH = PREC_LEN;

/** 現示ごとの速度制限 [km/h]（R は 0 = 停止） */
export const ASPECT_LIMIT: Record<SignalAspect, number> = { R: 0, Y: 45, YG: 65, G: Infinity };
export const ASPECT_LABEL: Record<SignalAspect, string> = { R: '停止', Y: '注意', YG: '減速', G: '進行' };
