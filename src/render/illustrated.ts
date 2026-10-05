// 元の材質・色・ゲーム進行を保持したまま、描画だけ切り替える試作。
import * as THREE from 'three';
import type { GameContext } from '../core/context';

const PREFIX = /* glsl */`
uniform float illustrationStrength;
uniform float illustrationDay;
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

export function attachIllustratedLook(ctx: GameContext): void {
  const strength = { value: new URL(location.href).searchParams.get('look') === 'standard' ? 0 : 1 };
  const day = { value: 1 };
  const seen = new WeakSet<THREE.Material>();
  const shadows = new Set<THREE.Material>();
  const outlined = new WeakSet<THREE.Mesh>();
  const edgeCache = new WeakMap<THREE.BufferGeometry, THREE.EdgesGeometry>();
  const contours: THREE.LineSegments[] = [];
  const contourMat = new THREE.LineBasicMaterial({ color: 0x263444, transparent: true, opacity: .38, depthWrite: false });
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
          float detail = 1.0 - smoothstep(18.0, 85.0, length(vViewPosition));
          vec3 grass = diffuseColor.rgb * vec3(0.87, 0.94, 0.88);
          grass *= 0.84 + 0.24 * broad + 0.10 * (fine - 0.5) * detail;
          diffuseColor.rgb = mix(diffuseColor.rgb, grass, illustrationAmount);
        ` : ''}
      `);
      // 色を量子化せず、直射光の強さだけを柔らかな3段階へ寄せる。
      // 信号色・発光・夜間の視認性は既存の計算を保持する。
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `
        #include <lights_fragment_end>
        float albedoLuma = max(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.035);
        float directLuma = dot(reflectedLight.directDiffuse, vec3(0.2126, 0.7152, 0.0722));
        float directLevel = directLuma / albedoLuma;
        float bandLevel = 0.16 + 0.28 * smoothstep(0.19, 0.27, directLevel)
          + 0.34 * smoothstep(0.46, 0.55, directLevel);
        float bandRatio = mix(1.0, bandLevel / max(directLevel, 0.001),
          0.55 * illustrationAmount * smoothstep(0.015, 0.07, directLevel));
        reflectedLight.directDiffuse *= bandRatio;
        reflectedLight.indirectDiffuse *= mix(vec3(1.0), vec3(0.78, 0.87, 1.02), illustrationAmount);
      `);
      if (physical) {
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
          float illustrationRim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 4.0);
          outgoingLight *= 1.0 - 0.17 * illustrationAmount * illustrationRim;
          #include <opaque_fragment>
        `);
      }
    };
    mat.customProgramCacheKey = () => `${originalKey}|illustration-v1:${ground}:${physical}`;
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
  let timer = 0;
  ctx.events.on('frame', ({ dt }) => {
    day.value = (1 - ctx.light.night * 0.85) * (1 - ctx.light.tunnel);
    // 環境モジュールが毎フレーム設定した値へ加算せず乗算するため、切替時も累積しない。
    const amount = strength.value * day.value;
    ctx.renderer.toneMappingExposure *= 1 + .07 * amount;
    ctx.env.fog.far *= 1 - .18 * amount;
    contourMat.opacity = .38 * day.value;
    for (const mat of shadows) mat.opacity = 0.24 * strength.value * day.value;
    if ((timer += dt) > 1) { timer = 0; scan(); }
  });
}
