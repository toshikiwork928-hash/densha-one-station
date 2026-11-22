import { Y0, sideSheet, sweepBand, type Sheet, type V2 } from './common';

export const BLUE_7100 = '#303f99', ORANGE_7100 = '#ee791e';
export const RESTORED_UPPER = '#839a80', RESTORED_LOWER = '#174833', RESTORED_SPLIT = 1.96;
export const FRONT_BLUE_7100: V2 = [1.53, 1.96], FRONT_ORANGE_7100: V2 = [1.38, 1.47];

/** 銀色のサッシ、窓上の浅い影、ガラス越しの座席を同じ窓枠に収める。 */
function passengerWindow(s: Sheet, z: number, half: number, door = false) {
  const lo = 2.01, hi = 2.89;
  const left = z - half, right = z + half;
  s.rect(left - .035, right + .035, lo - .035, hi + .035, door ? '#8a8f92' : '#9ca1a5', .34, .45, .055);
  s.glass(left, right, lo, hi, '', .045, ['#576e73', '#303b43']);
  s.rect(left + .02, right - .02, hi - .065, hi - .017, '#435255');
  s.poly([[left + .02, hi - .1], [right - .04, hi - .1], [right - .13, hi - .32], [left + .02, hi - .4]], 'rgba(197,219,219,.13)');
  s.rect(left + .025, right - .025, lo + .045, lo + .13, '#3d4a4d');
  s.line(left, lo - .02, right, lo - .02, '#e0dedd', 1.3);
  if (!door) s.line(left + .015, lo + .17, right - .015, lo + .17, 'rgba(184,194,192,.35)', 1);
}

/** モハ7189・サハ7847の側面写真を基に、戸袋と車端の窓を配置する。 */
export function paint7100Side(length: number, top: number, head: boolean, open: boolean, restored = false) {
  const s = sideSheet(length, top), end = length / 2;
  const silver = s.c.createLinearGradient(0, s.Y(3.65), 0, s.Y(Y0));
  silver.addColorStop(0, '#d1d4d8');
  silver.addColorStop(.46, '#c4c7ce');
  silver.addColorStop(1, '#b7bcc2');
  if (restored) {
    s.base(RESTORED_UPPER, .45, .12);
  } else s.base(silver, .43, .14);
  s.rect(-end, end, 3.66, top, '#9da3aa', .7, .12);
  s.rect(-end, end, Y0, Y0 + .045, '#787e82');

  const doors = (head ? [.185, .417, .649, .88] : [.13, .362, .594, .826]).map(f => f * length - end);
  const crew = -end + .046 * length;
  function doorPanel(z: number, width: number) {
    s.rect(z - width / 2, z + width / 2, 1.16, 3.08, restored ? '#486549' : '#898d94', .48, .15, .055);
    s.rect(z - width / 2 + .018, z + width / 2 - .018, 1.19, 3.05, restored ? RESTORED_UPPER : '#c2c5ca', .42, .16, .045);
    s.line(z - width / 2, 1.17, z + width / 2, 1.17, '#e5e4e2', 1.5);
  }
  for (const z of doors) doorPanel(z, 1.3);
  if (head) doorPanel(crew, .56);

  const highBlue: V2 = [3.29, 3.50], highOrange: V2 = [3.16, 3.23];
  if (head && !restored) {
    const start = crew - .13;
    sweepBand(s, length, FRONT_BLUE_7100, highBlue, start, .54, BLUE_7100, .38, .12, -.11);
    sweepBand(s, length, FRONT_ORANGE_7100, highOrange, start + .13, .54, ORANGE_7100, .38, .12);
  } else if (!restored) {
    s.rect(-end, end, ...highBlue, BLUE_7100);
    s.rect(-end, end, ...highOrange, ORANGE_7100);
  }
  if (restored) {
    s.rect(-end, end, Y0, RESTORED_SPLIT, RESTORED_LOWER, .45, .12);
  } else {
    const lowStart = head ? -.245 * length + .53 : -end;
    s.rect(lowStart, end, 1.55, 1.615, BLUE_7100);
    s.rect(lowStart, end, 1.455, 1.525, ORANGE_7100);
  }

  if (head) {
    s.glass(crew - .155, crew + .155, 2.05, 2.9, '#9a9fa6', .025);
    s.rect(crew + .185, crew + .22, 1.89, 2.02, '#777f84', .3, .4);
  }
  for (const z of doors) {
    if (open) {
      s.glass(z - .62, z + .62, 1.19, 3.04, '', .03, ['#4e524c', '#252b30']);
      s.rect(z - .61, z + .61, 1.19, 1.30, '#626664');
      s.rect(z - .61, z + .61, 2.96, 3.02, '#bbb9a8');
      s.emit(z - .62, z + .62, 1.19, 3.04, s.emitGrad(1.19, 3.04, '#f4ecdc', '#343433'));
    } else {
      for (const sign of [-1, 1]) passengerWindow(s, z + sign * .325, .19, true);
      s.rect(z - .015, z + .015, 1.19, 3.05, '#5e6367');
    }
  }
  for (let i = 1; i < doors.length; i++) {
    const center = (doors[i - 1] + doors[i]) / 2;
    for (const offset of [-.48, .48]) passengerWindow(s, center + offset, .425);
  }
  if (head) passengerWindow(s, -end + length * .094, .42);
  else passengerWindow(s, -end + length * .04, .42);
  const rear = end - length * .03;
  passengerWindow(s, rear, .425);
  if (!head) passengerWindow(s, rear - .96, .425);

  return s.textures();
}
