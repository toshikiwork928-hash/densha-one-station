import type { ExtraTrack, LatProfile, Route } from '../types';
import { IZUMISANO_PLATFORMS } from './izumisano';

/** 泉佐野のホーム始端を起点に、どちらのコースにも同じ空港線の配線を置く。 */
export function configureAirportLayout(route: Route): void {
  const k = route.stations.length - 3;
  const [sano, rinku, kansai] = route.stations.slice(k);
  const offset = sano.platform.from;
  route.airportBridge = { from: offset + 2700, to: offset + 6450 };
  const shift = (profile: LatProfile): LatProfile => profile.map(([s, lat]) => [offset + s, lat]);
  const end = kansai.platform.to + 12;
  route.extent.to = end;
  const down = shift([[-300, 0], [-50, -9.2], [260, -9.2], [470, -15.2], [650, -15.2], [950, 0], [1300, 0],
    [1680, -9.2], [2210, -9.2], [2420, 0], [8400, 0], [8660, -5.2]]);
  const up = shift([[-350, 4], [-50, 18.4], [260, 18.4], [470, 19], [650, 19], [950, 4], [1300, 4],
    [1680, 13.2], [2210, 13.2], [2420, 4]]);
  route.trackProfiles = { 0: down, 4: up };
  const extra = (id: string, knots: LatProfile, bumpers: number[] = []): ExtraTrack => {
    const lat = shift(knots);
    return { id, from: lat[0][0], to: lat[lat.length - 1][0], lat, ownDeck: false, bumpers };
  };
  const qEnd = end - offset;
  route.extraTracks = [
    // 泉佐野の内側2線は和歌山市方面へ続く。空港線のカーブから見て左へ離れる。
    // 本線の続きは分岐直後で切らず、空港線から離れて画面外へ抜ける。終端の車止めは置かない。
    extra('main-down', [[-300, 0], [260, 0]]),
    extra('main-up', [[-350, 4], [-50, 9.2], [260, 9.2]]),
    // りんくうタウンの内側2線はJR。空港側で南海の上下線に合流する。
    extra('jr-rinku-down', [[1380, -40], [1730, 0], [2210, 0], [2420, 0]]),
    extra('jr-rinku-up', [[1380, -36], [1730, 4], [2210, 4], [2420, 4]]),
    extra('jr-kansai-down', [[8170, 0], [8580, 10], [qEnd, 10]], [end]),
    extra('jr-kansai-up', [[8230, 4], [8660, 19.2], [qEnd, 19.2]], [end]),
  ];
  // 駅前の商業地と埋立地には、地図にない戸建住宅を補わない。
  route.noInfill = [...(route.noInfill ?? []), { from: rinku.platform.from - 320, to: end + 60 }];
  route.deckJoin = [{ from: offset - 350, to: offset + 310 },
    { from: offset + 1380, to: offset + 2420 }, { from: offset + 8170, to: end }];
  route.reserved = [...(route.reserved ?? []),
    {from: offset + 575, to: offset + 645, lat0: -35, lat1: 35, noPiers: true},
    {from: offset + 2700, to: offset + 6450, lat0: -24, lat1: 24, noPiers: true}];
  route.structures = route.structures?.flatMap(st => {
    if (st.kind !== 'viaduct' || st.from > offset + 260 || st.to < offset + 925) return [st];
    return [{ ...st, to: offset + 260 },
      { ...st, from: offset + 260, to: offset + 925, split: true },
      { ...st, from: offset + 925 }];
  });
  sano.customPlatforms = IZUMISANO_PLATFORMS;
  rinku.customPlatforms = [{ kind: 'island', lat: -4.6, width: 5.8 }, { kind: 'island', lat: 8.6, width: 5.8 }];
  // 関西空港駅は人工地盤の下にホームが収まる屋内駅。専用外形が屋根と壁を描くため、
  // ホーム個別の上屋・階段箱は indoor オプションで抑制する。
  kansai.indoor = true;
  kansai.customPlatforms = [{ kind: 'island', lat: -.6, width: 5.8 }, { kind: 'island', lat: 14.6, width: 5.8 }];
  for (const service of route.services ?? []) {
    // 分岐から終点まで、自列車の軌跡と描画用の下り線を一致させる。
    service.lane = down;
    service.trackNames = { ...service.trackNames, [k]: '1番線', [k + 1]: '1番線', [k + 2]: '1番線' };
    service.platformSides = { ...service.platformSides, [k]: 'R', [k + 1]: 'R', [k + 2]: 'R' };
  }
}
