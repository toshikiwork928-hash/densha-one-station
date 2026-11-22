import { type Sheet, type V2 } from './common';

// 左右のワイパー下にある手掛けは外板に合わせて薄く描く。
export function windowSill(s: Sheet, x: number, y: number) {
  const pts: V2[] = [[x - .135, y], [x + .135, y], [x + .12, y + .017], [x - .11, y + .019]];
  s.poly(pts, '#aeb6b7', .29, .65);
}
