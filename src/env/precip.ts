// 降水パーティクル（雨 = 線分、雪 = ポイント）。カメラ周囲の箱内で座標をラップして再利用。
// 屋根の下には降らせない: カメラの周り（OCC_HALF の正方形）を真上から正射影で描いた深度（いちばん高い面の高さ）を3コマに1回作り、
// 粒がその面より下なら消す。駅の上屋・大屋根・高架・建物・車両の下がまとめて隠れる（屋根ごとの範囲を持たない）
import * as THREE from 'three';

export interface Precip {
  /** kind 切替と粒数（画質）。amount 0..1 は不透明度・表示粒数に反映 */
  configure(rainCount: number, snowCount: number): void;
  update(dt: number, cam: THREE.Vector3, trainVel: THREE.Vector3, rain: number, snow: number, light: number, pixelRatio: number): void;
}

const RAIN_BOX = new THREE.Vector3(70, 34, 70);
const SNOW_BOX = new THREE.Vector3(60, 30, 60);
const SNOW_VEL = new THREE.Vector3(.4, -1.3, .15);

/** 屋根の判定の範囲（カメラ中心の正方形の半分）[m]・解像度・真上のカメラの高さ（カメラの位置から）[m]・奥行き [m] */
const OCC_HALF = 38, OCC_RES = 256, OCC_UP = 120, OCC_FAR = 260;
/** 屋根の深度を読む部分（雨・雪で共通）。uOcc = (中心 x, 中心 z, 幅, 有効 0/1)、uOccTop = 真上のカメラの高さ */
const occGlsl = /* glsl */`
uniform sampler2D uOccTex;
uniform vec4 uOcc;
uniform float uOccTop;
float underRoof(vec3 p) {
  vec2 uv = vec2((p.x - uOcc.x) / uOcc.z + 0.5, 0.5 - (p.z - uOcc.y) / uOcc.z);
  if (uOcc.w < 0.5 || uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) return 0.0;
  float top = uOccTop - texture2D(uOccTex, uv).x * ${OCC_FAR.toFixed(1)};
  return step(p.y, top - 0.2);
}`;

const rainVert = /* glsl */`
attribute float aEnd;
attribute float aRnd;
uniform vec3 uBox, uOffset, uCam, uVel, uRel;
uniform float uLen;
varying float vA;
${occGlsl}
void main() {
  vec3 p = position * uBox + uOffset * (0.85 + aRnd * 0.3);
  p = mod(p - uCam + uBox * 0.5, uBox) + uCam - uBox * 0.5;
  p -= (uVel - uRel) * uLen * (0.7 + aRnd * 0.6) * aEnd; // 尾（列車の相対速度で傾く）
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = length(p - uCam);
  vA = (1.0 - aEnd * 0.85) * smoothstep(uBox.x * 0.5, uBox.x * 0.2, dist) * smoothstep(0.6, 2.0, dist) * (1.0 - underRoof(p));
  gl_Position = projectionMatrix * mv;
}`;
const rainFrag = /* glsl */`
uniform vec3 uColor; uniform float uOpacity;
varying float vA;
void main() { gl_FragColor = vec4(uColor, vA * uOpacity); }`;

const snowVert = /* glsl */`
attribute float aRnd;
uniform vec3 uBox, uOffset, uCam;
uniform float uTime, uSize;
varying float vA;
${occGlsl}
void main() {
  vec3 p = position * uBox + uOffset * (0.8 + aRnd * 0.4);
  p.x += sin(uTime * (0.6 + aRnd) + aRnd * 30.0) * 0.6;
  p.z += cos(uTime * (0.5 + aRnd * 0.8) + aRnd * 17.0) * 0.6;
  p = mod(p - uCam + uBox * 0.5, uBox) + uCam - uBox * 0.5;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = length(p - uCam);
  vA = smoothstep(uBox.x * 0.5, uBox.x * 0.2, dist) * smoothstep(0.3, 1.2, dist) * (1.0 - underRoof(p));
  gl_PointSize = uSize * (0.6 + aRnd * 0.8) / max(-mv.z, 0.1);
  gl_Position = projectionMatrix * mv;
}`;
const snowFrag = /* glsl */`
uniform vec3 uColor; uniform float uOpacity;
varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.15, r);
  gl_FragColor = vec4(uColor, a * vA * uOpacity);
}`;

function rainGeometry(n: number): THREE.BufferGeometry {
  const pos = new Float32Array(n * 6), end = new Float32Array(n * 2), rnd = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const x = Math.random(), y = Math.random(), z = Math.random(), r = Math.random();
    pos.set([x, y, z, x, y, z], i * 6); end[i * 2 + 1] = 1; rnd[i * 2] = rnd[i * 2 + 1] = r;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));
  return g;
}
function snowGeometry(n: number): THREE.BufferGeometry {
  const pos = new Float32Array(n * 3), rnd = new Float32Array(n);
  for (let i = 0; i < n * 3; i++) pos[i] = Math.random();
  for (let i = 0; i < n; i++) rnd[i] = Math.random();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));
  return g;
}

/** 屋根の判定から外すもの（カメラを囲む空・降水・積雪面） */
const OCC_HIDE = new Set(['env-sky', 'env-rain', 'env-snow', 'env-snow-ground']);

export function createPrecip(scene: THREE.Scene, renderer: THREE.WebGLRenderer): Precip {
  // 真上からの深度（正射影なので深度の値は距離に比例）
  const occRT = new THREE.WebGLRenderTarget(OCC_RES, OCC_RES, { depthBuffer: true, depthTexture: new THREE.DepthTexture(OCC_RES, OCC_RES) });
  occRT.depthTexture!.minFilter = occRT.depthTexture!.magFilter = THREE.NearestFilter;
  const occCam = new THREE.OrthographicCamera(-OCC_HALF, OCC_HALF, OCC_HALF, -OCC_HALF, 0, OCC_FAR);
  occCam.up.set(0, 0, -1);
  const occMat = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
  const occ = { uOccTex: { value: occRT.depthTexture as THREE.Texture }, uOcc: { value: new THREE.Vector4() }, uOccTop: { value: 0 } };
  let occFrame = 0;
  const renderOcclusion = (cam: THREE.Vector3) => {
    const texel = OCC_HALF * 2 / OCC_RES, cx = Math.round(cam.x / texel) * texel, cz = Math.round(cam.z / texel) * texel, top = cam.y + OCC_UP;
    occCam.position.set(cx, top, cz); occCam.lookAt(cx, top - 1, cz); occCam.updateMatrixWorld();
    const hidden: THREE.Object3D[] = [];
    for (const o of scene.children) if (o.visible && OCC_HIDE.has(o.name)) { o.visible = false; hidden.push(o); }
    const prevRT = renderer.getRenderTarget(), prevOverride = scene.overrideMaterial, sm = renderer.shadowMap, auto = sm.autoUpdate, need = sm.needsUpdate;
    sm.autoUpdate = false; sm.needsUpdate = false; // 影の再計算をしない
    scene.overrideMaterial = occMat;
    renderer.setRenderTarget(occRT); renderer.clear(); renderer.render(scene, occCam);
    renderer.setRenderTarget(prevRT); scene.overrideMaterial = prevOverride;
    sm.autoUpdate = auto; sm.needsUpdate = need;
    for (const o of hidden) o.visible = true;
    occ.uOcc.value.set(cx, cz, OCC_HALF * 2, import.meta.env?.DEV && (globalThis as any).__precipNoRoof ? 0 : 1); occ.uOccTop.value = top; // 開発時の比較用: __precipNoRoof = true で判定を切る
  };
  const rainU = {
    ...occ,
    uBox: { value: RAIN_BOX }, uOffset: { value: new THREE.Vector3() }, uCam: { value: new THREE.Vector3() },
    uVel: { value: new THREE.Vector3(1.2, -11, .4) }, uRel: { value: new THREE.Vector3() }, uLen: { value: .045 },
    uColor: { value: new THREE.Color(0xb8c4d0) }, uOpacity: { value: 0 },
  };
  const snowU = {
    ...occ,
    uBox: { value: SNOW_BOX }, uOffset: { value: new THREE.Vector3() }, uCam: { value: new THREE.Vector3() },
    uTime: { value: 0 }, uSize: { value: 90 }, uColor: { value: new THREE.Color(0xffffff) }, uOpacity: { value: 0 },
  };
  const common = { transparent: true, depthWrite: false, fog: false };
  const rain = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.ShaderMaterial({ uniforms: rainU, vertexShader: rainVert, fragmentShader: rainFrag, ...common }));
  const snow = new THREE.Points(new THREE.BufferGeometry(), new THREE.ShaderMaterial({ uniforms: snowU, vertexShader: snowVert, fragmentShader: snowFrag, ...common }));
  for (const o of [rain, snow]) { o.frustumCulled = false; o.visible = false; o.renderOrder = 10; o.userData.noShadow = true; scene.add(o); }
  rain.name = 'env-rain'; snow.name = 'env-snow';
  let rainN = 0, snowN = 0, time = 0;

  return {
    configure(rc, sc) {
      if (rc !== rainN) { rain.geometry.dispose(); rain.geometry = rainGeometry(rc); rainN = rc; }
      if (sc !== snowN) { snow.geometry.dispose(); snow.geometry = snowGeometry(sc); snowN = sc; }
    },
    update(dt, cam, trainVel, rainAmt, snowAmt, light, pr) {
      time += dt;
      rain.visible = rainAmt > .01; snow.visible = snowAmt > .01;
      if ((rain.visible || snow.visible) && occFrame++ % 3 === 0) renderOcclusion(cam);
      if (rain.visible) {
        const o = rainU.uOffset.value.addScaledVector(rainU.uVel.value, dt);
        // 精度維持のため箱サイズで巻き戻す
        o.set(o.x % (RAIN_BOX.x * 10), o.y % (RAIN_BOX.y * 10), o.z % (RAIN_BOX.z * 10));
        rainU.uCam.value.copy(cam); rainU.uRel.value.copy(trainVel);
        rainU.uOpacity.value = .55 * rainAmt;
        rainU.uColor.value.setRGB(.55 + .35 * light, .6 + .35 * light, .66 + .34 * light);
        rain.geometry.setDrawRange(0, Math.floor(rainN * (.35 + .65 * rainAmt)) * 2);
      }
      if (snow.visible) {
        const o = snowU.uOffset.value.addScaledVector(SNOW_VEL, dt);
        o.set(o.x % (SNOW_BOX.x * 10), o.y % (SNOW_BOX.y * 10), o.z % (SNOW_BOX.z * 10));
        snowU.uCam.value.copy(cam); snowU.uTime.value = time;
        snowU.uSize.value = 120 * pr;
        snowU.uOpacity.value = .9 * Math.min(1, snowAmt * 1.3);
        const l = .35 + .65 * light; snowU.uColor.value.setRGB(l, l, l * 1.03);
        snow.geometry.setDrawRange(0, Math.floor(snowN * (.35 + .65 * snowAmt)));
      }
    },
  };
}
