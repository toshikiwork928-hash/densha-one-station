// 抵抗制御（カム軸式）の旧型通勤電車の主回路音
// - 直流直巻電動機のうなり（回転数に比例して音程が上がる）＋整流子の細い鳴き＋ブラシ雑音
// - 力行中は速度上昇に合わせてカム軸が1段ずつ進み「カチッ」。直列 → 並列の渡りは少し大きく、一瞬電流が抜ける
// - 惰行は歯車音だけ。ブレーキは空気ブレーキのみ（発電・回生のうなりは無し）。ノッチを切るとカムが戻る音
// Vvvf と同じインターフェイスで差し替える
import { harmonicWave, type AudioCore } from './engine';
import type { Vvvf } from './vvvf';

const HZ_PER_KMH = 1.45 * .5; // 電動機回転周波数 [Hz/(km/h)]（2極対相当のうなりの基本）
const GEAR_RATIO = 6.07;

/** カム段の切替速度 [km/h]: 直列 → 渡り → 並列 → 弱め界磁 */
const SERIES = Array.from({ length: 11 }, (_, i) => 3 + i * 3.6);   // 3 .. 39
const TRANSITION = 44;
const PARALLEL = Array.from({ length: 8 }, (_, i) => 47 + i * 3.2); // 47 .. 69.4
const FIELD = [73, 77, 81, 85];
/** ノッチ別の到達可能な最終段（P1 = 起動段のみ、P2 = 直列、P3 = 並列、P4/P5 = 弱め界磁） */
const STEPS = [...SERIES, TRANSITION, ...PARALLEL, ...FIELD];
const maxStep = (notch: number) => notch <= 1 ? 1 : notch === 2 ? SERIES.length : notch === 3 ? SERIES.length + 1 + PARALLEL.length : notch === 4 ? STEPS.length - 2 : STEPS.length;

export function createResistance(core: AudioCore, dest: AudioNode = core.run): Vvvf {
  const { ac } = core;
  const out = ac.createGain(); out.gain.value = 0;
  const tone = ac.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 3200; tone.Q.value = .5;
  out.connect(tone).connect(dest);

  // うなり本体（低次の倍音が多い唸り）
  const growl = ac.createOscillator(); growl.setPeriodicWave(harmonicWave(ac, { 1: .5, 2: 1, 3: .7, 4: .55, 6: .35, 8: .22, 10: .12, 12: .08 }));
  const growlG = ac.createGain(); growlG.gain.value = .9;
  const growlLp = ac.createBiquadFilter(); growlLp.type = 'lowpass'; growlLp.frequency.value = 900; growlLp.Q.value = 2.5;
  growl.connect(growlLp).connect(growlG).connect(out);
  // 振幅のゆらぎ（トルク脈動）
  const wob = ac.createOscillator(); wob.frequency.value = 6;
  const wobG = ac.createGain(); wobG.gain.value = .12;
  wob.connect(wobG).connect(growlG.gain);
  // 整流子の細い鳴き（高め・弱め）
  const comm = ac.createOscillator(); comm.type = 'triangle';
  const commG = ac.createGain(); commG.gain.value = .07;
  comm.connect(commG).connect(out);
  // ブラシ雑音
  const brush = core.noiseSrc('pink');
  const brushBp = ac.createBiquadFilter(); brushBp.type = 'bandpass'; brushBp.Q.value = 1.2; brushBp.frequency.value = 400;
  const brushG = ac.createGain(); brushG.gain.value = .18;
  brush.connect(brushBp).connect(brushG).connect(out);

  // 歯車音（惰行中も鳴る）
  const gearOut = ac.createGain(); gearOut.gain.value = 0; gearOut.connect(dest);
  const gear = ac.createOscillator(); gear.setPeriodicWave(harmonicWave(ac, { 1: 1, 2: .4, 3: .12 }));
  const gearToneG = ac.createGain(); gearToneG.gain.value = .5;
  gear.connect(gearToneG).connect(gearOut);
  const gearNoise = core.noiseSrc('white');
  const gearBp = ac.createBiquadFilter(); gearBp.type = 'bandpass'; gearBp.Q.value = 14; gearBp.frequency.value = 100;
  const gearNG = ac.createGain(); gearNG.gain.value = 2.4;
  gearNoise.connect(gearBp).connect(gearNG).connect(gearOut);

  for (const o of [growl, wob, comm, gear]) o.start();

  // カム軸の音（運転台の床下から聞こえる機械音）は走行系バスへ
  const camBus = ac.createGain(); camBus.gain.value = 1; camBus.connect(dest);
  function camClick(loud: number, when = core.now()) {
    core.burst(camBus, { when, dur: .045, vol: .05 * loud, type: 'bandpass', f: 2600, q: 2.5 });
    core.burst(camBus, { when: when + .012, dur: .09, vol: .035 * loud, type: 'bandpass', f: 700, q: 1.5 });
    core.tone(camBus, 140, .08, .03 * loud, when, 'triangle');
  }

  let step = 0, active = false, surge = 1, surgeT = 0, gap = 0, lastT = core.now();

  function update(v: number, notch: number) {
    const now = core.now(), dt = Math.min(.1, Math.max(0, now - lastT)); lastT = now;
    const kmh = Math.max(0, v * 3.6), power = notch > 0;

    // カム軸: 力行中は速度に応じて1段ずつ進む（1回の更新で最大1段）
    if (power) {
      if (step === 0) { step = 1; camClick(1); surge = 1.15; }
      const lim = maxStep(notch);
      if (step < lim && kmh >= STEPS[step - 1]) {
        step++;
        const isTransition = STEPS[step - 2] === TRANSITION;
        if (isTransition) { camClick(2.2); camClick(1.2, now + .12); gap = .35; }
        else camClick(1);
        surge = isTransition ? 1.25 : 1.12; surgeT = 0;
      } else if (step > lim) step = lim; // ノッチを戻した
    } else if (step > 0) {
      // ノッチオフ: カムが戻る（ガラガラ）
      const n = Math.min(6, 2 + Math.floor(step / 4));
      for (let i = 0; i < n; i++) camClick(.45, now + .05 + i * .05);
      step = 0;
    }
    surgeT += dt; surge = 1 + (surge - 1) * Math.exp(-dt / .35);
    gap = Math.max(0, gap - dt);

    // 電動機の回転・音程
    const fr = Math.max(.5, kmh * HZ_PER_KMH);
    growl.frequency.setTargetAtTime(Math.max(8, fr * 2), now, .04);
    growlLp.frequency.setTargetAtTime(380 + kmh * 12, now, .1);
    comm.frequency.setTargetAtTime(Math.max(30, fr * 24), now, .05);
    brushBp.frequency.setTargetAtTime(250 + kmh * 9, now, .1);
    wob.frequency.setTargetAtTime(3 + kmh * .12, now, .2);

    // 電流: 直列・並列の抵抗段では大きく、弱め界磁以降は速度とともに減る
    const notchI = power ? Math.min(1, .45 + notch * .14) : 0;
    const highV = kmh > 85 ? Math.max(.45, 1 - (kmh - 85) / 50) : 1;
    // 起動直後は控えめに（速度 0〜15km/h で 35%→100%）
    const lt = Math.min(1, kmh / 15), start = .35 + .65 * lt * lt * (3 - 2 * lt);
    const vol = power && gap <= 0 ? .1 * notchI * highV * start * surge : 0;
    out.gain.setTargetAtTime(vol, now, power && !active ? .05 : gap > 0 ? .03 : power ? .08 : .12);
    active = power;

    // 歯車音
    const gf = GEAR_RATIO * kmh * 1.45 * .55;
    gear.frequency.setTargetAtTime(Math.max(20, gf), now, .03);
    gearBp.frequency.setTargetAtTime(Math.max(20, gf), now, .03);
    const gv = kmh < 3 ? 0 : .016 * Math.min(1, kmh / 60) * (1 + .8 * (power ? notchI : 0));
    gearOut.gain.setTargetAtTime(gv, now, .08);
  }

  return {
    update,
    silence() {
      const now = core.now();
      out.gain.cancelScheduledValues(now); out.gain.setTargetAtTime(0, now, .05); gearOut.gain.setTargetAtTime(0, now, .05);
      active = false; step = 0;
    },
    get mode() { return step === 0 ? 'off' : step <= SERIES.length ? `直列${step}` : step <= SERIES.length + 1 ? '渡り' : step <= SERIES.length + 1 + PARALLEL.length ? `並列${step - SERIES.length - 1}` : `弱め界磁${step - SERIES.length - 1 - PARALLEL.length}`; },
  };
}
