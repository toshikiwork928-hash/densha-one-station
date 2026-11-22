import type { Route, TimeOfDay } from './types';

type MountainTimes = { no: string; abs: number[] };

const t = (h: number, m: number) => h * 3600 + m * 60;
// 鉄道運用Hub 高野線（2026-03-28改正、平日）の橋本・九度山・高野下・紀伊神谷・極楽橋。
const DOWN: Record<TimeOfDay, MountainTimes> = {
  morning: { no: '7507', abs: [t(7, 22), t(7, 33), t(7, 40), t(8, 2), t(8, 6)] },
  noon: { no: '7517', abs: [t(10, 24), t(10, 35), t(10, 39), t(11, 7), t(11, 11)] },
  evening: { no: '7537', abs: [t(17, 33), t(17, 45), t(17, 48), t(18, 9), t(18, 12)] },
  night: { no: '7549', abs: [t(21, 57), t(22, 8), t(22, 12), t(22, 32), t(22, 35)] },
};
const UP: Record<TimeOfDay, MountainTimes> = {
  morning: { no: '7508', abs: [t(7, 15), t(7, 18), t(7, 40), t(7, 43), t(7, 55)] },
  noon: { no: '7518', abs: [t(10, 12), t(10, 16), t(10, 47), t(10, 51), t(11, 4)] },
  evening: { no: '7536', abs: [t(17, 9), t(17, 12), t(17, 34), t(17, 37), t(17, 50)] },
  night: { no: '7552', abs: [t(21, 47), t(21, 50), t(22, 12), t(22, 15), t(22, 28)] },
};

/** 実列車の駅間時分をゲーム内の線路長に換算し、選択した開始駅の時計を実発車時刻に合わせる。 */
export function applyMountainRealDiagram(route: Route, from: number): void {
  if (route.id !== 'mountain' && route.id !== 'mountain-up') return;
  const down = route.id === 'mountain';
  const { abs } = (down ? DOWN : UP)[route.timeOfDay ?? 'noon'];
  const realMeters = down ? [7500, 2000, 8800, 1500] : [1500, 8800, 2000, 7500];
  const stations = route.stations;
  const base = stations.map(s => s.scheduledArrival);
  let departure = 0;
  for (let i = 1; i < stations.length; i++) {
    const dwell = stations[i].dwell ?? 0;
    const distance = stations[i].stopS - stations[i - 1].stopS;
    const run = (abs[i] - abs[i - 1] - dwell) * distance / realMeters[i - 1];
    const previousDwell = i > 1 ? stations[i - 1].dwell ?? 0 : 0;
    const gameRun = base[i] - base[i - 1] - previousDwell;
    stations[i].scheduledArrival = departure + Math.round(Math.max(gameRun, run));
    departure = stations[i].scheduledArrival + dwell;
  }
  route.startClock = abs[from] - stations[from].scheduledArrival - (from ? stations[from].dwell ?? 0 : 0);
}
