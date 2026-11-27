import { crossingApproachActive } from '../src/world/crossings';

const series: [Parameters<typeof crossingApproachActive>[0], number, boolean][] = [
  ['title', 500, false], ['run', 500, true], ['run', 100, true],
  ['dwell', 100, true], ['dwell', 500, true], ['run', 500, true],
  ['run', 0, false], ['result', 100, false],
];
for (const [state, distance, expected] of series) {
  const actual = crossingApproachActive(state, distance);
  if (actual !== expected) throw new Error(`${state} ${distance}: expected ${expected}, got ${actual}`);
}
console.log(`踏切接近判定: ${series.length}時点を確認、停車中の鳴動を維持`);
