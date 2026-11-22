import * as THREE from 'three';
import type { GameContext } from '../core/context';
import type { Route } from '../route/types';
import { namba } from '../route/routes/namba';
import { shiokaze } from '../route/routes/shiokaze';
import { kishiwada } from '../route/routes/kishiwada';
import { izumisano } from '../route/routes/izumisano';
import { izumisanoMisaki } from '../route/routes/izumisano-misaki';
import { misakiWakayamako } from '../route/routes/misaki-wakayamako';
import { GeoBatch, M } from './batch';
import { cullByDistance } from './cull';
import { getTerrain } from './terrain';
import { sectionFrame } from './section-frame';
import { osakaModels, osakaSites } from './express-osaka';
import { northModels, northSites } from './express-north';
import { southModels, southSites } from './express-south';

/** 区間の沿線データと同じ座標。width は横幅、depth は線路方向の奥行き、angle は度。 */
export interface LandmarkSite {
  routeId: string; kind: string; s: number; lat: number;
  width: number; depth: number; angle: number;
  keepRoads?: boolean;
}
export type LandmarkModel = (batch: GeoBatch, site: LandmarkSite) => void;

const bases = [namba, shiokaze, kishiwada, izumisano, izumisanoMisaki, misakiWakayamako];
const sites = [...osakaSites, ...northSites, ...southSites];
const models = { ...osakaModels, ...northModels, ...southModels };

function sitesFor(route: Route) {
  return bases.flatMap(base => {
    const frame = sectionFrame(base, route);
    if (!frame) return [];
    return sites.filter(site => site.routeId === base.id && frame.inR(site.s)).map(site => ({
      ...site, s: frame.mapS(site.s), lat: frame.mapL(site.lat),
      rotation: site.angle * Math.PI / 180 + (frame.rev ? Math.PI : 0),
    }));
  });
}

/** 専用モデルの敷地と同じ範囲から自動生成の建物や木を除く。 */
export function landmarkReservations(route: Route) {
  return sitesFor(route).flatMap(({ s, lat, rotation, width, depth, keepRoads = true }) => {
    const cos = Math.cos(rotation), sin = Math.sin(rotation);
    // 斜めに延びるアーケードや連絡通路は分割し、通りに面する店をできるだけ残す。
    const alongTrack = depth >= width;
    const long = Math.max(width, depth), short = Math.min(width, depth);
    const count = long > 4 * short ? Math.ceil(long / 12) : 1;
    const w = alongTrack ? width : width / count, d = alongTrack ? depth / count : depth;
    const ds = (d * Math.abs(cos) + w * Math.abs(sin)) / 2;
    const dl = (w * Math.abs(cos) + d * Math.abs(sin)) / 2;
    return Array.from({ length: count }, (_, i) => {
      const offset = long * ((i + .5) / count - .5);
      const sc = s + offset * (alongTrack ? cos : -sin), lc = lat + offset * (alongTrack ? sin : cos);
      return { from: sc - ds, to: sc + ds, lat0: lc - dl, lat1: lc + dl, keepRoads };
    });
  });
}

export function buildStationLandmarks(ctx: GameContext): void {
  const locations = sitesFor(ctx.route);
  if (!locations.length) return;
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const terrain = getTerrain(ctx);
  for (const site of locations) {
    const point = ctx.track.at(site.s, site.lat, 0);
    const ground = terrain.groundY(site.s) + terrain.reliefY(site.s, site.lat);
    const batch = new GeoBatch();
    batch.parent = M(point.x, ground, point.z, -ctx.track.trackAt(site.s).phi - site.rotation).clone();
    models[site.kind](batch, site);
    for (const mesh of batch.build({ body: material }, ctx.scene)) {
      mesh.name = site.kind;
      cullByDistance(ctx, mesh, 1600);
    }
  }
}
