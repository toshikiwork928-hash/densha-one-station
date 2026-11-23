import { buildRoadCollisionIndex } from '../src/world/road-collision';
import { airport, airportThrough } from '../src/route/routes/airport';
import { airportInbound } from '../src/route/routes/airport-inbound';
import { sectionFrame } from '../src/world/section-frame';
import { airportLinkRoads, bridgeApproaches } from '../src/world/airport-link-roads';
import data from '../src/data/osm/airport.json';

const roads = [[2, 8, 'residential', [0, 0, 100, 0]]] as (number | string | number[])[][];
const index = buildRoadCollisionIndex(roads);
const check = (name: string, value: boolean) => { if (!value) throw new Error(`road collision regression: ${name}`); };

// 道路の両端に建物角だけがかかるケースを、道路の向きに関係なく除外する。
check('axis-aligned corner', index.intersectsBuilding(8, 5.8, 16, 10, 0));
check('rotated corner', index.intersectsBuilding(35, 5.5, 18, 8, Math.PI / 4));
check('reverse direction', buildRoadCollisionIndex([[2, 8, 'residential', [100, 0, 0, 0]]]).intersectsBuilding(35, -5.5, 18, 8, -Math.PI / 4));
check('clear setback', !index.intersectsBuilding(50, 12, 12, 8, 0));
check('point width', index.point(50, 3.9) && !index.point(50, 4.1));

for (const route of [airport, airportThrough, airportInbound]) {
  const frame = sectionFrame(airport, route)!;
  const ramps = buildRoadCollisionIndex(airportLinkRoads(route));
  for (const approach of bridgeApproaches(airport.airportBridge!)) {
    for (const p of approach) {
      check(route.id + ' bridge approach', ramps.intersectsBuilding(frame.mapS(p.s), frame.mapL(p.lat), 4, 4, 0));
    }
  }
  const roads = data.roads.map(([cls,width,type,coords]) => {
    const points = (coords as number[]).map((v,i) => i%2 === 0 ? frame.mapS(v) : frame.mapL(v));
    return [cls, width, type, points];
  });
  const streets = buildRoadCollisionIndex(roads);
  const buildings = data.buildings.filter(b => b[0] >= 1600 && b[0] <= 2450);
  const overlap = buildings.filter(([s,lat,len,wid,ang]) =>
    streets.intersectsBuilding(frame.mapS(s),frame.mapL(lat),len,wid,ang*Math.PI/180));
  check(route.id + ' rinku source collisions', overlap.length > 0 && overlap.length < buildings.length);
  console.log(route.id, 'りんくう駅周辺の元データ', buildings.length, '棟のうち道路帯に重なる候補', overlap.length, '棟');
}
console.log('road collision verification: ok');
