// 元の材質・色・ゲーム進行を保持したまま、描画だけ切り替える試作。
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import type { TimeOfDay } from '../core/events';

const PREFIX = /* glsl */`
uniform float illustrationStrength;
uniform float illustrationDay;
uniform float illustrationSunMax;
uniform float illustrationBand;
uniform vec3 illustrationShade;
uniform vec3 illustrationRimColor;
`;

const GROUND_NOISE = /* glsl */`
varying vec2 illustrationWorld;
float illustrationHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float illustrationNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(illustrationHash(i), illustrationHash(i + vec2(1.0, 0.0)), f.x),
    mix(illustrationHash(i + vec2(0.0, 1.0)), illustrationHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

/** 時間帯ごとの陰の色（環境光へ乗算）。昼は冷たい青、朝は青灰、夕は青紫 */
const SHADE: Record<TimeOfDay, number[]> = {
  morning: [.80, .86, 1.03],
  noon: [.78, .87, 1.02],
  evening: [.84, .79, 1.0],
  night: [.86, .88, 1.0],
};
/** 悪天候時の陰の色（色味を抑えた灰青） */
const SHADE_OVERCAST = new THREE.Vector3(.84, .88, .97);
/** 建物の接地影の色 */
const CONTACT: Record<TimeOfDay, number> = { morning: 0x1c2a42, noon: 0x18283b, evening: 0x2a2242, night: 0x141a2a };
const CONTOUR = new THREE.Color(0x263444);

export function attachIllustratedLook(ctx: GameContext): void {
  const strength = { value: new URL(location.href).searchParams.get('look') === 'standard' ? 0 : 1 };
  const day = { value: 1 };
  // 直射光の強さ（帯の基準）と、帯の効き。時間帯で光量が違っても同じ割合で段が付くようにする
  const sunMax = { value: .5 };
  const band = { value: .6 };
  const shade = { value: new THREE.Vector3(...SHADE.noon) };
  const rimColor = { value: new THREE.Color(0, 0, 0) };
  const seen = new WeakSet<THREE.Material>();
  const shadows = new Set<THREE.Material>();
  const outlined = new WeakSet<THREE.Mesh>();
  const edgeCache = new WeakMap<THREE.BufferGeometry, THREE.EdgesGeometry>();
  const contours: THREE.LineSegments[] = [];
  const contourMat = new THREE.LineBasicMaterial({ color: 0x263444, transparent: true, opacity: .38, depthWrite: false });
  // 輪郭線は遠いほど淡く。線幅は WebGL で変えられないため、濃さで細く見せる
  contourMat.onBeforeCompile = shader => {
    shader.vertexShader = 'varying float illustrationDepth;\n' + shader.vertexShader.replace('#include <fog_vertex>', `
      #include <fog_vertex>
      illustrationDepth = -mvPosition.z;
    `);
    shader.fragmentShader = 'varying float illustrationDepth;\n' + shader.fragmentShader.replace('#include <opaque_fragment>', `
      diffuseColor.a *= 1.0 - 0.72 * smoothstep(14.0, 140.0, illustrationDepth);
      #include <opaque_fragment>
    `);
  };
  contourMat.customProgramCacheKey = () => 'illustration-contour-v2';
  const button = document.createElement('button');
  button.type = 'button';
  button.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:30;padding:7px 12px;border:1px solid #ffffff40;border-radius:8px;background:#14202de0;color:#edf3f6;font:600 12px system-ui;cursor:pointer';
  button.title = '描画を切替。走行状態はそのまま';
  const refreshButton = () => {
    button.textContent = strength.value ? '描画：イラスト' : '描画：標準';
    button.setAttribute('aria-pressed', String(!!strength.value));
    for (const line of contours) line.visible = !!strength.value;
  };
  button.addEventListener('click', () => {
    strength.value = 1 - strength.value;
    const url = new URL(location.href);
    url.searchParams.set('look', strength.value ? 'illustrated' : 'standard');
    history.replaceState(null, '', url);
    refreshButton();
  });
  refreshButton(); document.body.appendChild(button);

  function patch(mat: THREE.Material) {
    if (mat.userData.illustrationShadow) shadows.add(mat);
    if (seen.has(mat)) return;
    seen.add(mat);
    if (!(mat instanceof THREE.MeshLambertMaterial || mat instanceof THREE.MeshStandardMaterial)) return;
    // 透過の柵・雨雪・発光表示には適用しない。
    if (mat.transparent) return;
    const ground = mat.name === 'ground';
    const physical = mat instanceof THREE.MeshStandardMaterial;
    const before = mat.onBeforeCompile;
    const originalKey = mat.customProgramCacheKey();
    mat.onBeforeCompile = (shader, renderer) => {
      before.call(mat, shader, renderer);
      shader.uniforms.illustrationStrength = strength;
      shader.uniforms.illustrationDay = day;
      shader.uniforms.illustrationSunMax = sunMax;
      shader.uniforms.illustrationBand = band;
      shader.uniforms.illustrationShade = shade;
      shader.uniforms.illustrationRimColor = rimColor;
      shader.fragmentShader = PREFIX + (ground ? GROUND_NOISE : '') + shader.fragmentShader;
      if (ground) {
        shader.vertexShader = 'varying vec2 illustrationWorld;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `
          #include <worldpos_vertex>
          illustrationWorld = (modelMatrix * vec4(transformed, 1.0)).xz;
        `);
      }
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        float illustrationAmount = illustrationStrength * illustrationDay;
        float illustrationLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(illustrationLuma), 0.09 * illustrationAmount);
        ${ground ? `
          float broad = illustrationNoise(illustrationWorld * 0.13);
          float fine = illustrationNoise(illustrationWorld * 2.4);
          float hue = illustrationNoise(illustrationWorld * 0.037 + 17.0);
          float detail = 1.0 - smoothstep(18.0, 85.0, length(vViewPosition));
          vec3 grass = diffuseColor.rgb * vec3(0.87, 0.94, 0.88);
          // 明るさだけでなく、黄緑寄り・青緑寄りの大きな色むらで面のまとまりを作る
          grass *= mix(vec3(1.05, 1.0, 0.9), vec3(0.94, 0.99, 1.05), hue);
          grass *= 0.84 + 0.24 * broad + 0.10 * (fine - 0.5) * detail;
          diffuseColor.rgb = mix(diffuseColor.rgb, grass, illustrationAmount);
        ` : ''}
      `);
      // 色を量子化せず、直射光の強さだけを柔らかな3段階へ寄せる。
      // 段の境目は太陽の強さに対する割合で決め、朝・昼・夕で同じ見え方にする。
      // 街灯など太陽より強い光は圧縮しない。信号色・発光・夜間の視認性は既存の計算を保持する。
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `
        #include <lights_fragment_end>
        float albedoLuma = max(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.035);
        float directLuma = dot(reflectedLight.directDiffuse, vec3(0.2126, 0.7152, 0.0722));
        float directRel = directLuma / albedoLuma / illustrationSunMax;
        float bandTop = 1.06 * max(directRel, 1.0);
        float bandLevel = 0.24 + 0.38 * smoothstep(0.13, 0.24, directRel)
          + (bandTop - 0.62) * smoothstep(0.44, 0.58, directRel);
        float bandRatio = mix(1.0, bandLevel / max(directRel, 0.001),
          illustrationBand * illustrationAmount * smoothstep(0.03, 0.11, directRel));
        reflectedLight.directDiffuse *= bandRatio;
        reflectedLight.indirectDiffuse *= mix(vec3(1.0), illustrationShade, illustrationAmount);
      `);
      if (physical) {
        // 縁: 日の当たらない側は少し暗く、当たる側は日の色で細く光らせる
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
          float illustrationRim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.5);
          float illustrationSunSide = 0.0;
          #if NUM_DIR_LIGHTS > 0
            illustrationSunSide = smoothstep(-0.05, 0.45, dot(normal, directionalLights[0].direction));
          #endif
          outgoingLight *= 1.0 - 0.17 * illustrationAmount * illustrationRim * (1.0 - 0.6 * illustrationSunSide);
          outgoingLight += illustrationRimColor * (illustrationAmount * illustrationRim * illustrationSunSide);
          #include <opaque_fragment>
        `);
      }
    };
    mat.customProgramCacheKey = () => `${originalKey}|illustration-v2:${ground}:${physical}`;
    mat.needsUpdate = true;
  }

  const scan = () => ctx.scene.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) patch(mat);
    if (mesh.name === 'train-shell' && !outlined.has(mesh)) {
      outlined.add(mesh);
      let edges = edgeCache.get(mesh.geometry);
      if (!edges) { edges = new THREE.EdgesGeometry(mesh.geometry, 32); edgeCache.set(mesh.geometry, edges); }
      const line = new THREE.LineSegments(edges, contourMat);
      line.name = 'illustration-contour'; line.userData.noShadow = true;
      line.visible = !!strength.value; mesh.add(line); contours.push(line);
    }
  });
  scan();
  ctx.events.on('assetsReady', scan);
  ctx.events.on('start', scan);

  // 時間帯・天候の切替は環境側と同じく徐々に移す
  const shadeTarget = new THREE.Vector3(), contactCol = new THREE.Color(CONTACT.noon), contactTarget = new THREE.Color();
  const sunLin = new THREE.Color(), camPos = new THREE.Vector3(), linePos = new THREE.Vector3();
  let timer = 0;
  ctx.events.on('frame', ({ dt }) => {
    day.value = (1 - ctx.light.night * 0.85) * (1 - ctx.light.tunnel);
    // 環境モジュールが毎フレーム設定した値へ加算せず乗算するため、切替時も累積しない。
    const amount = strength.value * day.value;
    const sun = ctx.env.sun, env = ctx.envState;
    sunLin.copy(sun.color);
    sunMax.value = Math.max(.02, (.2126 * sunLin.r + .7152 * sunLin.g + .0722 * sunLin.b) * sun.intensity / Math.PI);
    // 曇り・雨・霧で日差しが弱いときは段を付けない（平板な曇天の柔らかさを残す）
    band.value = .6 * THREE.MathUtils.smoothstep(sun.intensity, .35, 1.2);
    rimColor.value.copy(sunLin).multiplyScalar(.13 * Math.min(1, sun.intensity / 1.5));
    const overcast = env.weather === 'clear' ? 0 : .35 + .5 * env.intensity;
    const base = SHADE[env.timeOfDay];
    shadeTarget.set(base[0], base[1], base[2]).lerp(SHADE_OVERCAST, overcast);
    const k = 1 - Math.exp(-dt * 1.6);
    shade.value.lerp(shadeTarget, k);
    contactTarget.setHex(CONTACT[env.timeOfDay]); contactCol.lerp(contactTarget, k);

    ctx.renderer.toneMappingExposure *= 1 + .07 * amount;
    // 遠景の霞。霧・強い雨では視界がすでに短いので重ねない（信号の視認性を保つ）
    ctx.env.fog.far *= 1 - .18 * amount * THREE.MathUtils.smoothstep(ctx.env.fog.far, 500, 1500);
    // 輪郭線: 日の色をわずかに混ぜ、夕方は暖色の暗い線に
    contourMat.color.copy(CONTOUR).lerp(sunLin.multiplyScalar(.22), .25);
    contourMat.opacity = .38 * day.value * (1 - .35 * overcast);
    for (const mat of shadows) {
      mat.opacity = 0.24 * strength.value * day.value;
      if (mat instanceof THREE.MeshBasicMaterial) mat.color.copy(contactCol);
    }
    // 遠い車両の輪郭線は描かない（描画コール削減。遠景ではほぼ見えない）
    if (strength.value) {
      camPos.setFromMatrixPosition(ctx.camera.matrixWorld);
      for (const line of contours) {
        linePos.setFromMatrixPosition(line.matrixWorld);
        line.visible = linePos.distanceToSquared(camPos) < 260 * 260;
      }
    }
    if ((timer += dt) > 1) { timer = 0; scan(); }
  });
}
