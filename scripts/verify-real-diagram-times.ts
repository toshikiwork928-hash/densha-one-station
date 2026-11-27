import assert from 'node:assert/strict';
import { ROUTES } from '../src/route';
import { applyRealDiagram, realDayOf, realTrainFor } from '../src/route/real-diagram';
import { createState, departureTime } from '../src/game/state';
import { playerPathLat } from '../src/route/service';

const down = ROUTES['misaki-wakayamako'];
assert(down, 'misaki-wakayamako route is missing');
const southern = realTrainFor(down, 'southern', 0, down.stations.length - 1, 'evening');
assert(southern, 'evening southern train is missing');
assert.equal(southern.no, '0603');
assert.equal(Math.floor((southern.start + southern.dep['和歌山大学前']) / 60), 18 * 60 + 33);
assert.equal(southern.start + southern.dep['和歌山市'], 18 * 3600 + 41 * 60);
assert.equal(southern.start + southern.arr, 18 * 3600 + 45 * 60);
down.timeOfDay = 'evening';
applyRealDiagram(down, 'southern', 0, down.stations.length - 1);
const wakayamashi = down.stations.find(s => s.name === '和歌山市')!;
assert.equal(down.startClock + wakayamashi.scheduledArrival, 18 * 3600 + 39 * 60, '0603 arrives Wakayamashi at 18:39');
assert.equal(down.startClock + wakayamashi.scheduledArrival + wakayamashi.dwell!, 18 * 3600 + 41 * 60, '0603 departs Wakayamashi at 18:41');

const up = ROUTES['misaki-wakayamako-up'];
assert(up, 'misaki-wakayamako-up route is missing');
const upSouthern = realTrainFor(up, 'southern', 0, up.stations.length - 1, 'night');
assert(upSouthern, 'night up southern train is missing');
assert.equal(upSouthern.no, '0606');
assert.equal(upSouthern.dep['和歌山市'], 420);
assert.equal(upSouthern.arrAt?.['和歌山市'], 300, '064号は和歌山市に21:30着');
assert.equal(Math.floor((southern.start + southern.arrAt!['和歌山大学前']) / 60), 18 * 60 + 32);

// 分割コースの境界でも同じ列車が走り、みさき公園の発車時刻を引き継ぐ。
const through = ROUTES['izumisano-wakayamako'];
const throughUp = ROUTES['izumisano-wakayamako-up'];
for (const [route, first, second] of [
  [through, ROUTES['izumisano-misaki'], down],
  [throughUp, up, ROUTES['izumisano-misaki-up']],
]) {
  for (const tod of ['morning', 'noon', 'evening', 'night'] as const) {
    const trains = realDayOf(route, tod)!.trains;
    const entries = realDayOf(first, tod)!.trains, exits = realDayOf(second, tod)!.trains;
    assert.deepEqual(trains.map(t => t.no), entries.map(t => t.no));
    for (const train of trains) {
      const entry = entries.find(t => t.no === train.no)!;
      const exit = exits.find(t => t.no === train.no)!;
      assert.equal(train.from, entry.from);
      assert.equal(train.end, exit.end);
      assert.equal(train.start, entry.start);
      assert.equal(train.start + train.dep['みさき公園'], exit.start);
      assert.equal(train.start + train.arr, exit.start + exit.arr);
    }
  }
}

// 堺で終わる区間・堺から始まる区間・堺をまたぐ区間で、同じ普通車の待避前後の時刻を照合する。
for (const id of ['namba-up', 'shiokaze-up', 'namba-kishiwada-up']) {
  const route = structuredClone(ROUTES[id]);
  route.timeOfDay = 'morning';
  const state = createState(route, { stageId: 'all', service: 'local', vehicles: {}, mode: 'normal' });
  const i = route.stations.findIndex(s => s.name === '堺');
  assert(i >= state.fromIndex && i <= state.endIndex);
  if (i > state.fromIndex) assert.equal(Math.floor((route.startClock + route.stations[i].scheduledArrival) / 60), 7 * 60 + 47);
  if (i < state.endIndex) assert.equal(Math.floor((route.startClock + departureTime(route, i)) / 60), 7 * 60 + 55);
}

// 空港線の分割コースでも、泉佐野到着と本線への発車を別々に引き継ぐ。
for (const routeId of ['airport-up', 'airport-through-up', 'airport-namba-up']) {
  const route = structuredClone(ROUTES[routeId]);
  route.timeOfDay = 'morning';
  const state = createState(route, { stageId: 'all', service: 'airport', vehicles: {}, mode: 'normal' });
  const i = route.stations.findIndex(s => s.name === '泉佐野');
  assert.equal(route.startClock, (7 * 60 + 24) * 60);
  assert.equal(Math.floor((route.startClock + route.stations[i].scheduledArrival) / 60), 7 * 60 + 33);
  if (i < state.endIndex) assert.equal(Math.floor((route.startClock + departureTime(route, i)) / 60), 7 * 60 + 34);
}

// 同じコースの種別を選び直しても、αとβが各列車の停車駅に戻る。
for (const [id, alpha] of [['airport-namba', 'morning'], ['airport-namba-up', 'night']] as const) {
  const route = structuredClone(ROUTES[id]);
  for (const time of [alpha, 'noon', alpha] as const) {
    route.timeOfDay = time;
    createState(route, { stageId: 'all', service: 'limited', vehicles: {}, mode: 'normal' });
    for (const name of ['堺', '岸和田']) assert.equal(!!route.stations.find(s => s.name === name)!.pass, time === alpha);
    assert.ok(route.services!.find(v => v.id === 'limited')!.name.includes(time === alpha ? 'α' : 'β'));
  }
}

// 同じ岸和田でも18:03のサザンと待ち合わせるのは夕方の下り空港急行だけ。
const airportCourse = structuredClone(ROUTES['airport-namba']);
let siding: number | undefined;
for (const time of ['evening', 'morning', 'noon', 'night', 'evening'] as const) {
  airportCourse.timeOfDay = time;
  createState(airportCourse, { stageId: 'all', service: 'airport', vehicles: {}, mode: 'normal' });
  const station = airportCourse.stations.find(s => s.name === '岸和田')!;
  const train = realDayOf(airportCourse)!.trains.find(t => t.svc === 'airport')!;
  const waiting = train.encounters?.find(e => e.station === '岸和田' && e.role === 'waiting' && e.no === '0603');
  const track = station.enterLoop ? station.loopTrack : station.mainTrack;
  const lat = playerPathLat(airportCourse, station.stopS);
  if (time === 'evening') {
    assert.ok(waiting);
    assert.equal(Math.floor(waiting.departure / 60), 18 * 60 + 3);
    assert.equal(track, '1番線');
    assert.ok(train.encounters!.some(e => e.station === '泉大津' && e.role === 'passing' && e.no === '6513'));
    assert.ok(!train.encounters!.some(e => e.station === '堺' && e.no === '6601'));
    if (siding !== undefined) assert.equal(lat, siding);
    siding = lat;
  } else {
    assert.equal(waiting, undefined);
    assert.equal(track, '2番線');
    assert.ok(Math.abs(lat - siding!) >= 3.4);
  }
}
const southernCourse = ROUTES['namba-kishiwada-up'];
const southern43 = realDayOf(southernCourse, 'evening')!.trains.find(t => t.no === '0603')!;
assert.ok(southern43.encounters?.some(e => e.station === '岸和田' && e.role === 'passing' && e.no === '2197'));
assert.ok(southern43.encounters?.some(e => e.station === '堺' && e.role === 'passing' && e.no === '6601'));

console.log('real diagram connection times: OK');
