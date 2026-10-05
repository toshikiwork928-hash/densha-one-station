// エントリポイント: 各モジュールを組み立てて描画ループを回すだけ
import './ui/styles.css';
import * as THREE from 'three';
import { MAX_DT } from './core/config';
import type { GameContext } from './core/context';
import { $ } from './core/dom';
import { EventBus } from './core/events';
import { createRng } from './core/rng';
import { buildTrack } from './route/track';
import { createTrainEnv } from './sim/train';
import { createState } from './game/state';
import { loadSelection } from './game/ranking';
import { createGame } from './game/loop';
import { createRenderCore } from './render/renderer';
import { attachIllustratedLook } from './render/illustrated';
import { createCabCamera } from './render/camera';
import { createEnvironment } from './env/environment';
import { attachEnvSystem } from './env';
import { buildWorld } from './world';
import { attachSfx } from './audio/sfx';
import { attachHud } from './ui/hud';
import { attachOverlay } from './ui/overlay';
import { lineOfRoute, resolveRoute } from './ui/lines';
import { attachKeyboard } from './input/keyboard';
import { attachTouch } from './input/touch';
import { attachGamepad } from './input/gamepad';

const saved = loadSelection();
const route = resolveRoute(saved?.routeId);
document.title = `${lineOfRoute(route.id).name} 運転シミュレーター`;
const { renderer, scene, camera } = createRenderCore($<HTMLCanvasElement>('c'));
const env = createEnvironment(scene);

const ctx: GameContext = {
  route,
  track: buildTrack(route),
  events: new EventBus(),
  state: createState(route, saved),
  trainEnv: createTrainEnv(),
  scene, camera, renderer, env,
  rng: createRng(12345),
  assetsReady: false,
  envState: { timeOfDay: 'noon', weather: 'clear', intensity: 0 },
  light: { night: 0, tunnel: 0 },
  cameraMode: 'cab',
  actions: undefined as unknown as GameContext['actions'], // createGame で設定
};
ctx.state.sel.routeId = route.id; // 選択の保存（路線ごと）に使う

const world = buildWorld(ctx);
const game = createGame(ctx);
const cab = createCabCamera(ctx);
attachEnvSystem(ctx); // [B] 空・時間帯・天候・影・夜間照明
attachIllustratedLook(ctx);
attachSfx(ctx.events, ctx);
attachHud(ctx);
attachOverlay(ctx);
attachKeyboard(ctx.actions);
attachTouch(ctx.actions);
attachGamepad(ctx); // [A]

world.loadAssets()
  .catch((e: unknown) => { console.error(e); return -1; })
  .then(failed => { ctx.assetsReady = true; ctx.events.emit('assetsReady', { failed: Math.max(0, failed) }); });

const clock = new THREE.Clock();
function step(dt: number, time: number) {
  game.update(dt);
  ctx.events.emit('frame', { dt, time, state: ctx.state.state });
  env.update(dt, time);
  cab.update(time);
  renderer.render(scene, camera);
}
function loop() {
  const dt = Math.min(MAX_DT, clock.getDelta());
  step(dt, clock.elapsedTime);
  requestAnimationFrame(loop);
}
loop();

// デバッグ用（開発時のみ）
if (import.meta.env.DEV) {
  (window as any).__densha = ctx;
  // 描画せずにゲーム時間を進める（QA 用）
  let simT = 0;
  (window as any).__advance = (sec: number, dt = 1 / 30, hook?: () => boolean | void) => {
    for (let k = 0; k < sec / dt; k++) {
      if (hook?.()) return;
      simT += dt; game.update(dt); ctx.events.emit('frame', { dt, time: simT, state: ctx.state.state });
    }
  };
  void import('./debug/autodrive').then(m => m.attachAutodrive(ctx, (window as any).__advance));
}
