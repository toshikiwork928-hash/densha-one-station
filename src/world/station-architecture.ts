import type { Station, Route } from '../route/types';
import { customPlatformEdges, trackSpan } from '../route/service';
import { GeoBatch, M, P } from './batch';

export type CanopyProfile = {
  kind: 'platform-wall' | 'canopy';
  Yroof: number;
  roofRatio: number;
  supportSpacing: number;
  roofColor: number;
  wallColor: number;
  supportColor?: number;
  roofShape?: 'gable' | 'butterfly';
  braces?: boolean;
};
export type PlatformWallProfile = CanopyProfile & { kind: 'platform-wall' };

export type HallProfile = {
  kind: 'hall';
  roofColor: number;
  wallColor: number;
  roofOpening?: number;
  roofOpeningOffsets?: number[];
};

export type StationArchitectureProfile = CanopyProfile | HallProfile;

const HALLS: Record<string, HallProfile> = {
  '新今宮': { kind: 'hall', roofColor: 0x59646e, wallColor: 0x7b858c },
  '天下茶屋': { kind: 'hall', roofColor: 0x79838a, wallColor: 0xd2d0c8, roofOpening: 3.5, roofOpeningOffsets: [-5.2, 5.2] },
};

const PLATFORM_WALLS: Record<string, PlatformWallProfile> = {
  '羽衣': { kind: 'platform-wall', Yroof: 4.35, roofRatio: .78, supportSpacing: 10, roofColor: 0x68747d, wallColor: 0x8d969b },
  '石津川': { kind: 'platform-wall', Yroof: 4.35, roofRatio: .72, supportSpacing: 10, roofColor: 0x68747d, wallColor: 0x8d969b },
  '松ノ浜': { kind: 'platform-wall', Yroof: 4.35, roofRatio: .86, supportSpacing: 10, roofColor: 0x68747d, wallColor: 0xe3dfd2, supportColor: 0x9c6847 },
  '北助松': { kind: 'platform-wall', Yroof: 4.35, roofRatio: .78, supportSpacing: 8, roofColor: 0x68747d, wallColor: 0xe2e0d8, supportColor: 0xd6d4c9, braces: true },
  '忠岡': { kind: 'platform-wall', Yroof: 4.35, roofRatio: .72, supportSpacing: 8, roofColor: 0x6c706b, wallColor: 0xe1dfd5, supportColor: 0xc8c6b8, braces: true },
  '和泉大宮': { kind: 'platform-wall', Yroof: 4.35, roofRatio: .72, supportSpacing: 8, roofColor: 0x78766d, wallColor: 0xe4dfd2, supportColor: 0xd7d0bc, braces: true },
};

const CANOPIES: Record<string, CanopyProfile> = {
  '岸里玉出': { kind: 'canopy', Yroof: 4.35, roofRatio: .8, supportSpacing: 10, roofColor: 0x79817d, wallColor: 0xdad9cf, supportColor: 0xdad9cf, roofShape: 'gable', braces: true },
  '住吉大社': { kind: 'canopy', Yroof: 4.35, roofRatio: .75, supportSpacing: 10, roofColor: 0x656b66, wallColor: 0xcccccc, supportColor: 0xac4633 },
  '泉大津': { kind: 'canopy', Yroof: 4.35, roofRatio: .85, supportSpacing: 10, roofColor: 0x5c7a8e, wallColor: 0xcccccc, supportColor: 0x6c91ad, braces: true },
  '高石': { kind: 'canopy', Yroof: 4.35, roofRatio: .85, supportSpacing: 10, roofColor: 0x798183, wallColor: 0xcccccc, supportColor: 0xb6b6aa, roofShape: 'butterfly' },
  '春木': { kind: 'canopy', Yroof: 4.35, roofRatio: .72, supportSpacing: 8, roofColor: 0x737970, wallColor: 0xcccccc, supportColor: 0xa6b2a0, braces: true },
  '橋本': { kind: 'canopy', Yroof: 4.35, roofRatio: .75, supportSpacing: 8, roofColor: 0x77786d, wallColor: 0xcccccc, supportColor: 0xd6d1c4, roofShape: 'gable', braces: true },
  '九度山': { kind: 'canopy', Yroof: 4.35, roofRatio: .4, supportSpacing: 8, roofColor: 0x77786d, wallColor: 0xcccccc, supportColor: 0xd6d1c4, braces: true },
  '高野下': { kind: 'canopy', Yroof: 4.35, roofRatio: .4, supportSpacing: 8, roofColor: 0x77786d, wallColor: 0xcccccc, supportColor: 0x9d8673, roofShape: 'gable', braces: true },
  '極楽橋': { kind: 'canopy', Yroof: 4.35, roofRatio: .85, supportSpacing: 8, roofColor: 0x77786d, wallColor: 0xcccccc, supportColor: 0x63503d, roofShape: 'gable', braces: true },
};

export function architectureOf(name: string): StationArchitectureProfile | undefined {
  return HALLS[name] ?? PLATFORM_WALLS[name] ?? CANOPIES[name];
}

/** 写真で確認した切妻・V字上屋。線路上へ広げず既存ホームの屋根幅を使う。 */
export function addCanopyRoof(b: GeoBatch, x: number, width: number, len: number, profile: CanopyProfile): void {
  const rise = profile.roofShape === 'gable' ? .55 : -.55;
  for (const sign of [-1, 1]) {
    const half = width / 2, angle = Math.atan2(-sign * rise, half);
    const w = Math.hypot(half, rise);
    const y = profile.Yroof + (profile.roofShape === 'butterfly' ? .55 : 0) + rise / 2;
    b.add('body', P.box, M(x + sign * width / 4, y, 0, 0, w, .14, len, 0, angle), profile.roofColor);
    b.add('body', P.box, M(x + sign * width / 4, y - .13, 0, 0, w, .08, len, 0, angle), 0xdcdcd8);
  }
}

export function addCanopyBraces(b: GeoBatch, x: number, width: number, len: number, profile: CanopyProfile): void {
  if (!profile.braces) return;
  for (let z = -len / 2 + 4; z <= len / 2 - 4; z += profile.supportSpacing) for (const sign of [-1, 1]) {
    const dx = sign * Math.min(width / 3, 1.35), dy = .8;
    b.add('body', P.box, M(x + dx / 2, profile.Yroof - .85, z, 0, Math.hypot(dx, dy), .12, .12, 0, Math.atan2(dy, dx)), profile.supportColor ?? profile.roofColor);
  }
}

export function hallBounds(route: Route, sta: Station): { from: number; to: number; left: number; right: number } {
  const sc = (sta.platform.from + sta.platform.to) / 2;
  const span = trackSpan(route, sc);
  const platform = customPlatformEdges(route, sc, 0);
  const left = Math.min(span[0] - 4.2, (platform?.[0] ?? Infinity) - .25);
  const right = Math.max(span[1] + 4.2, (platform?.[1] ?? -Infinity) + .25);
  const from = Math.min(sta.platform.from, ...(sta.customPlatforms ?? []).map(p => p.from ?? sta.platform.from)) - 10;
  const to = Math.max(sta.platform.to, ...(sta.customPlatforms ?? []).map(p => p.to ?? sta.platform.to)) + 10;
  return { from, to, left, right };
}

export function addHallArchitecture(b: GeoBatch, bounds: { from: number; to: number; left: number; right: number }, profile: HallProfile): void {
  const len = bounds.to - bounds.from, z = (bounds.from + bounds.to) / 2;
  const width = bounds.right - bounds.left;
  const roofY = 9.8;
  const mid = (bounds.left + bounds.right) / 2, rise = 1.6;
  const opening = profile.roofOpening ?? 0;
  const gaps = opening ? (profile.roofOpeningOffsets ?? [0]).map(x => [mid + x - opening / 2, mid + x + opening / 2]) : [];
  const cuts = [...new Set([bounds.left, mid, bounds.right, ...gaps.flat().filter(x => x > bounds.left && x < bounds.right)])].sort((a, c) => a - c);
  const roofAt = (x: number) => roofY + rise * (1 - Math.abs(x - mid) / (width / 2));
  for (let i = 1; i < cuts.length; i++) {
    const a = cuts[i - 1], c = cuts[i], x = (a + c) / 2;
    if (gaps.some(([lo, hi]) => x > lo && x < hi)) continue;
    const slope = Math.atan2(roofAt(c) - roofAt(a), c - a);
    const w = Math.hypot(c - a, roofAt(c) - roofAt(a));
    b.add('body', P.box, M(x, roofAt(x), z, 0, w, .18, len, 0, slope), profile.roofColor);
    b.add('body', P.box, M(x, roofAt(x) - .16, z, 0, w, .08, len, 0, slope), 0xe3e2dc);
  }
  for (const x of [bounds.left, bounds.right]) {
    b.add('body', P.box, M(x, 1.925, z, 0, .18, 1.65, len), profile.wallColor);
    b.add('body', P.box, M(x, 6.55, z, 0, .18, 6.3, len), profile.wallColor);
    for (let zz = bounds.from + 4; zz <= bounds.to - 4; zz += 10) {
      b.add('body', P.box, M(x, 5.5, zz, 0, .24, 8.8, .24), profile.roofColor);
    }
  }
  // 線路上の柱を避け、両外周の柱から三角形の鉄骨を渡す。
  for (let zz = bounds.from + 4; zz <= bounds.to - 4; zz += 10) {
    b.add('body', P.box, M(mid, 9.4, zz, 0, width, .18, .18), 0xbfc3c3);
    for (const x of [bounds.left, bounds.right]) {
      const dx = mid - x, dy = rise;
      b.add('body', P.box, M((mid + x) / 2, 9.55 + dy / 2, zz, 0, Math.hypot(dx, dy), .16, .16, 0, Math.atan2(dy, dx)), 0xbfc3c3);
    }
    b.add('body', P.box, M(mid, 10.3, zz, 0, .14, 1.8, .14), 0xbfc3c3);
  }
  for (const zz of [bounds.from + 1, bounds.to - 1]) b.add('body', P.box, M((bounds.left + bounds.right) / 2, roofY, zz, 0, width, .18, .18), profile.roofColor);
}

export function addPlatformWall(b: GeoBatch, x: number, len: number, profile: CanopyProfile): void {
  // 腰壁と屋根に接続する上部パネルの間は帯窓の開口。窓帯を箱で埋めない。
  b.add('body', P.box, M(x, 1.65, 0, 0, .12, 1.1, len), profile.wallColor);
  b.add('body', P.box, M(x, (3.4 + profile.Yroof) / 2, 0, 0, .12, profile.Yroof - 3.4, len), profile.wallColor);
  for (let z = -len / 2 + 4; z <= len / 2 - 4; z += profile.supportSpacing) {
    b.add('body', P.box, M(x, 2.75, z, 0, .2, 3.25, .2), profile.wallColor);
  }
}
