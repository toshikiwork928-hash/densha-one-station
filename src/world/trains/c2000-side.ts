import { paintDoor, sideSheet, sweepBand, Y0 } from './common';

// モハ2039の海側写真で、車体両端を0と1にそろえて扉とサッシの位置を読んだ。
export const FRONT_2039_BLUE: [number, number] = [1.48, 2.04];
export const FRONT_2039_ORANGE: [number, number] = [1.345, 1.425];

export function paint2039Side(length: number, head: boolean, open: boolean) {
  const s = sideSheet(length, 3.8);
  const z = (fraction: number) => (fraction - .5) * length;
  const blue = '#263f8d', orange = '#e39420';
  const metal = s.c.createLinearGradient(0, 0, 0, s.H);
  metal.addColorStop(0, '#cbd0cf'); metal.addColorStop(.44, '#dee0dc'); metal.addColorStop(1, '#a8acae');
  s.base(metal, .36, .71);
  s.rect(z(0), z(1), 3.45, 3.81, '#bac0c2', .55, .52);
  const doors = [.244, .763], doorWidth = length * .078;
  for (const f of doors) paintDoor(s, z(f), doorWidth, 3.02, [2.03, 2.90], '#c8cbc9', open, true);
  const win = (left: number, right: number, split: boolean) => {
    const a = z(left), b = z(right), mid = (a + b) / 2;
    s.rect(a - .039, b + .039, 1.985, 2.946, '#e1e1d8', .32, .65, .065);
    s.glass(a, b, 2.02, 2.91, '', .045, ['#627b7e', '#303f47']);
    s.rect(a + .02, b - .02, 2.08, 2.14, '#43505a');
    if (split) s.rect(mid - .027, mid + .027, 2.02, 2.91, '#c6c9c1', .40, .58);
  };
  if (head) paintDoor(s, z(.052), length * .036, 3.02, [2.01, 2.9], '#bfc4c4', false, false);
  win(head ? .107 : .030, .160, !head);
  for (const [l, r] of [[.325, .435], [.448, .557], [.571, .680], [.861, .970]]) win(l, r, true);
  if (head) {
    sweepBand(s, length, FRONT_2039_ORANGE, [3.047, 3.14], z(.063), .56, orange, .35, .1);
    sweepBand(s, length, FRONT_2039_BLUE, [3.18, 3.39], z(.058), .55, blue, .35, .1, -.04);
  } else {
    s.rect(z(0), z(1), 3.047, 3.14, orange, .35, .1);
    s.rect(z(0), z(1), 3.18, 3.39, blue, .35, .1);
  }
  // 閉じた後方の客用扉まで腰帯が通る。開口部の内側は塗らない。
  for (const [start, end] of open ? [[.36, doors[1] - .041], [doors[1] + .041, 1]] : [[.36, 1]]) {
    s.rect(z(start), z(end), 1.58, 1.65, blue, .35, .1);
    s.rect(z(start), z(end), 1.50, 1.565, orange, .35, .1);
  }
  s.rect(z(0), z(1), Y0 + .11, Y0 + .126, '#c7cac6', .38, .63);
  return s.textures();
}
