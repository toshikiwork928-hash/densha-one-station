import type { Route, SpeedLimit } from './types';

/** この位置から適用する速度。予告位置は減速が必要な場合だけ持つ。 */
export interface LimitChange {
  s: number; kmh: number; previous: number; label?: string; notice?: number;
}

const cache = new WeakMap<SpeedLimit[], { lineLimit: number; changes: LimitChange[] }>();

function noticeDistance(route: Route, start: number, kmh: number): number {
  // 連続する短い制限でも間に合うよう、線区最高速度から常用制動で減速する距離を取る。
  const v = route.lineLimit / 3.6, target = kmh / 3.6;
  const distance = (grade: number) => {
    const downhill = -9.81 * grade / 1000;
    // 反応とブレーキの立ち上がりの間も、下りでは速度が上がる。
    const reaction = 9, brakingSpeed = v + downhill * reaction;
    return (v + brakingSpeed) / 2 * reaction
      + (brakingSpeed * brakingSpeed - target * target) / (2 * Math.max(.2, .70 - downhill)) + 30;
  };
  let grade = 0;
  for (;;) {
    const from = start - distance(grade);
    const worst = Math.min(grade, ...(route.gradients ?? []).filter(g => g.from < start && g.to > from).map(g => g.permil));
    if (worst === grade) return Math.ceil(distance(grade));
    grade = worst;
  }
}

/** 重複区間を合成し、実際に速度が変わる境界だけを案内・標識・HUDで共有する。 */
export function limitChanges(route: Route): LimitChange[] {
  const cached = cache.get(route.limits);
  if (cached?.lineLimit === route.lineLimit) return cached.changes;
  const changes: LimitChange[] = [];
  let previous = route.lineLimit;
  const ends = new Set(route.limits.flatMap(l => [l.from, l.to]));
  for (const s of [...ends].sort((a, b) => a - b)) {
    let kmh = route.lineLimit, label: string | undefined;
    for (const l of route.limits) if (l.from <= s && s < l.to && l.kmh < kmh) {
      kmh = l.kmh; label = l.label;
    }
    if (kmh === previous) continue;
    changes.push({ s, kmh, previous, label, notice: kmh < previous ? s - noticeDistance(route, s, kmh) : undefined });
    previous = kmh;
  }
  cache.set(route.limits, { lineLimit: route.lineLimit, changes });
  return changes;
}
