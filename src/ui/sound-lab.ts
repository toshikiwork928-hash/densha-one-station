import type { TrainKind } from '../route/types';
import { downloadWav } from '../audio/wav-download';
import { defaultStartHz, defaultTuning, loadTuning, saveTuning, parseTuning, isResistance, soundLabels, type VehicleTuning } from '../audio/vehicle-tuning';
import { createPreview, renderSweep, sweepState, SWEEP_SECONDS, type Track } from './sound-lab-preview';

const field = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const select = (id: string) => field<HTMLSelectElement>(id);
const range = (id: string) => field<HTMLInputElement>(id);
const button = (id: string) => field<HTMLButtonElement>(id);
const vehicle = select('vehicle'), drive = select('drive'), track = select('track'), model = select('model');
const speed = range('speed'), frequency = range('frequency'), transition = range('transition');
const play = button('play'), sweep = button('sweep'), wav = button('wav');
const status = field('state'), notice = field('message');
let ac: AudioContext | null = null;
let graph: ReturnType<typeof createPreview> | null = null;
let frame = 0, lastTick = 0, sweepStart: number | null = null;
let playbackSession = 0;
let manualSpeed = speed.value;
const selected = () => vehicle.value as TrainKind;
const vehicleNames: Record<TrainKind, string> = {
  'commuter-1000': '1000系', 'commuter-new': '8300系', 'commuter-old': '7100系',
  'commuter-7100-restored': '7100系 7169編成', 'commuter-9000': '9000系（更新車）',
  'commuter-2300': '2300系', 'southern-10000': '10000系 サザン', 'southern-12000': '12000系 サザン',
  limited: '50000系 ラピート', 'commuter-2000': '2000系', 'commuter-6300': '6300系',
  'limited-30000': '30000系 こうや',
};
for (const [key, name] of Object.entries(vehicleNames)) vehicle.add(new Option(name, key));
for (const [key, name] of Object.entries(soundLabels)) {
  model.add(new Option(name, key));
}

function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function layerControl(name: string, level: number, muted: boolean, soloed: boolean,
  gainChanged: (value: number) => void, muteClicked: () => void, soloClicked: () => void) {
  const row = document.createElement('div');
  row.className = 'layer';
  const label = document.createElement('label'), input = document.createElement('input');
  label.textContent = name;
  input.type = 'range';
  input.min = '0'; input.max = '200'; input.step = '1';
  input.value = String(Math.round(level * 100));
  input.id = 'level-' + field('layers').childElementCount;
  label.htmlFor = input.id;
  const percent = document.createElement('output');
  percent.className = 'percent';
  percent.htmlFor.add(input.id);
  percent.textContent = input.value + '%';
  input.oninput = () => {
    percent.textContent = input.value + '%';
    gainChanged(input.valueAsNumber / 100);
  };
  const makeToggle = (text: string, pressed: boolean, callback: () => void) => {
    const toggle = document.createElement('button');
    toggle.textContent = text;
    toggle.setAttribute('aria-label', name + 'を' + text);
    toggle.setAttribute('aria-pressed', String(pressed));
    toggle.onclick = callback;
    return toggle;
  };
  row.append(label, input, percent, makeToggle('単独', soloed, soloClicked), makeToggle('消音', muted, muteClicked));
  return row;
}

const driveNames = { motor:'主電動機の電磁音', hum:'低いうなり', gear:'歯車音', carrier:'キャリア音', sideband:'側帯波', hiss:'インバータのノイズ' };
const trackNames = { roll:'車輪の転動音', rail:'レール表面の摩擦音', wind:'風切り音', joint:'継ぎ目の打音', bridge:'鉄橋の反響音', flange:'急曲線のきしみ' };
type Layer = keyof typeof driveNames | keyof typeof trackNames | 'cam';
const labels: Record<Layer,string> = { ...driveNames, ...trackNames, cam:'カム接触器の切替音' };
const keys = Object.keys(labels) as Layer[];
let tuning: VehicleTuning = defaultTuning(selected());
let effective: VehicleTuning = tuning;
let solo: Layer | null = null;
let mutes = new Set<Layer>();
type CarrierSettings = Pick<VehicleTuning['vvvf'], 'startHz' | 'transitionKmh'>;
let carrierSettings: Partial<Record<VehicleTuning['sound'], CarrierSettings>> = {};
const draftKey = (train: TrainKind) => 'densha-one-station.sound-lab.draft.v1.' + train;
function targetLevel(t: VehicleTuning, key: Layer, next?: number): number {
  if (key === 'cam') {
    if (next !== undefined) t.cam = next;
    return t.cam;
  }
  if (key in driveNames) {
    const k = key as keyof typeof driveNames;
    if (next !== undefined) t.vvvf[k] = next;
    return t.vvvf[k];
  }
  const k = key as keyof typeof trackNames;
  if (next !== undefined) t.track[k] = next;
  return t.track[k];
}
function mix(only: Layer | null) {
  const value = structuredClone(tuning);
  for (const key of keys) if (only ? only !== key : mutes.has(key)) targetLevel(value, key, 0);
  return value;
}
function previewTuning() { return effective; }
function changed() {
  effective = mix(solo);
  try {
    localStorage.setItem(draftKey(selected()), JSON.stringify({ tuning, mutes:[...mutes], carrierSettings }));
    notice.textContent = '';
  } catch { notice.textContent = '下書きを保存できません。設定を書き出すと手元に残せます。'; }
}
function restore() {
  tuning = loadTuning(selected()); mutes = new Set(); solo = null; carrierSettings = {};
  try {
    const raw = localStorage.getItem(draftKey(selected()));
    if (raw) {
      const draft = JSON.parse(raw);
      const parsed = parseTuning(draft.tuning);
      if (Array.isArray(draft.mutes)) mutes = new Set(keys.filter(k => draft.mutes.includes(k)));
      tuning = parsed;
      for (const sound of Object.keys(soundLabels) as VehicleTuning['sound'][]) {
        const remembered = draft.carrierSettings?.[sound];
        if (Number.isFinite(remembered?.startHz) && remembered.startHz >= 80 && remembered.startHz <= 1800 &&
            Number.isFinite(remembered.transitionKmh) && remembered.transitionKmh >= 8 && remembered.transitionKmh <= 28) {
          carrierSettings[sound] = { startHz: remembered.startHz, transitionKmh: remembered.transitionKmh };
        }
      }
    }
  } catch { notice.textContent = '下書きを読み込めなかったため、ゲームの設定を表示します。'; }
  effective = mix(null);
}
function showControls() {
  const resist = isResistance(selected());
  model.value = tuning.sound;
  field('model-field').hidden = resist;
  field('carrier-fields').hidden = resist;
  field('transition-field').hidden = tuning.sound !== 'gto' && tuning.sound !== 'nankai-1000';
  button('vehicle-sound').hidden = resist || tuning.sound === defaultTuning(selected()).sound;
  field('reference').hidden = resist || !tuning.sound.startsWith('nankai-');
  field('reference-note').textContent = tuning.sound === 'nankai-1000'
    ? '1000系の機器未更新車を参考に合成します。標準のキャリア周波数は400 Hzで、起動時にはその約2倍の800 Hz付近に音が現れます。'
    : tuning.sound === 'nankai-8000'
      ? '8000系の解析を参考に合成します。12000系と機器更新後の50000系にはこの音色を使います。'
      : soundLabels[tuning.sound] + 'の解析に基づき、速度に伴う音の変化を合成します。';
  frequency.value = String(tuning.vvvf.startHz);
  transition.value = String(tuning.vvvf.transitionKmh);
  field('frequency-value').textContent = frequency.value + ' Hz';
  field('transition-value').textContent = transition.value + ' km/h';
  button('clear-solo').hidden = !solo;
  const hint = field('solo-hint');
  hint.hidden = !solo;
  if (solo) {
    const condition = solo === 'bridge' ? '線路を「鉄橋」にすると反響を聞けます。'
      : solo === 'flange' ? '線路を「急曲線」にし、速度を上げるときしみが聞こえます。'
      : solo === 'cam' ? '「発車から停車まで」で加速中の切替音を聞けます。'
      : solo === 'joint' ? '走行中に25 m間隔で鳴ります。'
      : ['carrier','sideband','hiss','motor','hum'].includes(solo) ? '力行を選ぶと速度ごとの音色を聞けます。' : '';
    hint.textContent = labels[solo] + 'を単独試聴します。' + condition;
  }
  const layers = field('layers');
  const activeName = layers.contains(document.activeElement) ? document.activeElement?.getAttribute('aria-label') : null;
  layers.replaceChildren();
  const visible = keys.filter(k => resist ? k !== 'carrier' && k !== 'sideband' && k !== 'hiss' : k !== 'cam');
  for (const k of visible) {
    layers.append(layerControl(labels[k], targetLevel(tuning,k), mutes.has(k), solo === k,
      value => { targetLevel(tuning, k, value); changed(); },
      () => { if (mutes.has(k)) mutes.delete(k); else mutes.add(k); changed(); showControls(); },
      () => { solo = solo === k ? null : k; effective = mix(solo); showControls(); }));
  }
  if (activeName) [...layers.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === activeName)?.focus();
}
function selectSound(sound: VehicleTuning['sound']) {
  const { startHz, transitionKmh } = tuning.vvvf;
  carrierSettings[tuning.sound] = { startHz, transitionKmh };
  Object.assign(tuning.vvvf, carrierSettings[sound] ?? { startHz: defaultStartHz(sound), transitionKmh: 10 });
  tuning.sound = sound; changed(); showControls();
}
model.onchange = () => selectSound(model.value as VehicleTuning['sound']);
button('vehicle-sound').onclick = () => selectSound(defaultTuning(selected()).sound);
frequency.oninput = () => { tuning.vvvf.startHz = frequency.valueAsNumber; field('frequency-value').textContent = frequency.value + ' Hz'; changed(); };
transition.oninput = () => { tuning.vvvf.transitionKmh = transition.valueAsNumber; field('transition-value').textContent = transition.value + ' km/h'; changed(); };
vehicle.onchange = () => {
  const restart = ac !== null;
  stop(); notice.textContent = ''; restore(); showControls();
  if (restart) void start(false);
};
button('clear-solo').onclick = () => { solo = null; effective = mix(null); showControls(); };
button('apply').onclick = () => {
  try {
    saveTuning(selected(), mix(null));
    notice.textContent = vehicleNames[selected()] + 'の設定を、このブラウザーのゲームに反映しました。';
  } catch { notice.textContent = 'ゲームの設定を保存できません。設定を書き出して保管してください。'; }
};
button('export').onclick = () => downloadJson({version:1, vehicle:selected(), tuning:mix(null)}, selected() + '-sound.json');
const file = range('file');
button('import').onclick = () => file.click();
file.onchange = async () => {
  const chosen = file.files?.[0];
  file.value = '';
  if (!chosen) return;
  try {
    if (chosen.size > 65536) throw new Error('ファイルが大きすぎます。');
    const record = JSON.parse(await chosen.text());
    if (record?.version !== 1 || !Object.hasOwn(vehicleNames, record.vehicle)) throw new Error('車両または形式が合いません。');
    const parsed = parseTuning(record.tuning);
    stop(); vehicle.value = record.vehicle; tuning = parsed; mutes.clear(); solo = null; carrierSettings = {};
    changed(); showControls();
    notice.textContent = vehicleNames[selected()] + 'の設定を読み込みました。';
  } catch (error) { notice.textContent = '設定を読み込めません。' + String(error); }
};
restore();
showControls();

function speedText(kmh: number) {
  field('speed-value').textContent = Number(kmh.toFixed(1)) + ' km/h';
}

function stop() {
  playbackSession++;
  cancelAnimationFrame(frame);
  graph = null;
  if (ac) void ac.close();
  ac = null;
  sweepStart = null;
  play.textContent = '再生';
  play.setAttribute('aria-pressed', 'false');
  sweep.setAttribute('aria-pressed', 'false');
  status.textContent = '停止中';
  speed.value = manualSpeed;
  speedText(speed.valueAsNumber);
}

async function start(auto: boolean) {
  stop();
  const version = playbackSession;
  try {
    const context = new AudioContext();
    ac = context;
    await context.resume();
    if (version !== playbackSession) return;
    graph = createPreview(context, selected(), () => previewTuning(), () => track.value as Track);
    sweepStart = auto ? context.currentTime : null;
    lastTick = context.currentTime;
    play.textContent = '停止';
    play.setAttribute('aria-pressed', 'true');
    sweep.setAttribute('aria-pressed', String(auto));
    status.textContent = auto ? '走行例を再生中' : '試聴中';
    const tick = () => {
      if (version !== playbackSession || !graph) return;
      const now = context.currentTime;
      const elapsed = sweepStart === null ? null : now - sweepStart;
      if (elapsed !== null && elapsed >= SWEEP_SECONDS) { stop(); return; }
      const point = elapsed === null ? { kmh: speed.valueAsNumber, notch: Number(drive.value) } : sweepState(elapsed);
      if (elapsed !== null) {
        speed.value = String(point.kmh);
        speedText(point.kmh);
        status.textContent = point.notch > 0 ? '走行例 · 力行' : point.notch < 0 ? '走行例 · 制動' : '走行例 · 惰行';
      }
      graph.update(point.kmh, point.notch, Math.min(.15, now - lastTick));
      lastTick = now;
      frame = requestAnimationFrame(tick);
    };
    tick();
  } catch (error) {
    if (version === playbackSession) { stop(); notice.textContent = '試聴を開始できません。' + String(error); }
  }
}

play.onclick = () => { if (ac) stop(); else void start(false); };
sweep.onclick = () => { if (sweepStart !== null) stop(); else void start(true); };
speed.oninput = () => { manualSpeed = speed.value; speedText(speed.valueAsNumber); if (sweepStart !== null) void start(false); };
drive.onchange = () => { if (sweepStart !== null) void start(false); };
window.addEventListener('pagehide', stop);
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });

wav.onclick = async () => {
  const train = selected(), chosenTrack = track.value as Track;
  const snapshot = structuredClone(previewTuning());
  wav.disabled = true;
  notice.textContent = '現在の試聴設定で24秒の走行例を生成しています。';
  try {
    const rendered = await renderSweep(train, snapshot, chosenTrack);
    downloadWav(rendered, train + '-' + chosenTrack + '.wav');
    notice.textContent = 'WAVを作成しました。';
  } catch (error) {
    notice.textContent = 'WAVの生成に失敗しました。' + String(error);
  } finally { wav.disabled = false; }
};
