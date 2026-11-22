// 切替境界は電動機の電気周波数（Hz）。段順と搬送波はVVVF名鑑の南海各形式の解析図による。
// 図に数値のない境界は代表値とし、架線電圧などによる変動は含めない。
export interface InverterMode { until: number; pulses: number; wide?: boolean }
export interface NankaiInverterProfile {
  carrierHz: number;
  power: InverterMode[];
  regen: InverterMode[];
}
type Stage = [untilHz: number, pulses: number, wide?: boolean];
const stages = (...entries: Stage[]): InverterMode[] =>
  [...entries.map(([until, pulses, wide]) => ({ until, pulses, wide })), { until: Infinity, pulses: 1 }];

const hitachiIgbt = (carrierHz: number, asyncEnd: number): NankaiInverterProfile => ({
  carrierHz,
  power: stages([asyncEnd, 0], [53, 9], [66, 3, true]),
  regen: stages([asyncEnd, 0], [52, 9], [66, 3, true]),
});

const profiles = {
  'nankai-1000': {
    carrierHz: 400,
    power: stages([16, 0], [30, 15], [42, 11], [56, 7], [62, 3], [67, 3, true]),
    regen: stages([19, 21], [29, 15], [41, 11], [54, 7], [60, 3], [67, 3, true]),
  },
  'nankai-2000': {
    carrierHz: 200,
    power: stages([5, 0], [6.8, 45], [11, 27], [16, 15], [23, 9], [26, 5], [32, 3], [34, 3, true]),
    regen: stages([12, 27], [17, 15], [23, 9], [28, 5], [41, 3], [45, 3, true]),
  },
  'nankai-2300': {
    carrierHz: 1055,
    // 力行の9P区間では過変調による5パルス成分が現れる。
    power: stages([20, 0], [41, 15], [54, 5]),
    regen: stages([18.2, 0], [37, 15], [54, 9]),
  },
  'nankai-8300': hitachiIgbt(445, 35),
  'nankai-9000': hitachiIgbt(600, 36),
  'nankai-8000': hitachiIgbt(720, 39),
} satisfies Record<string, NankaiInverterProfile>;

export type NankaiInverterId = keyof typeof profiles;
export function nankaiInverterProfile(id: string): NankaiInverterProfile | undefined {
  return Object.hasOwn(profiles, id) ? profiles[id as NankaiInverterId] : undefined;
}
