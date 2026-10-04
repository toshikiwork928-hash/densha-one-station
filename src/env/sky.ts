// スカイドーム: グラデーション空 + 太陽(月) + 手続き的な雲 + 星。カメラに追従（平行移動を無視）
import * as THREE from 'three';
import type { Look } from './look';

export interface SkyDome {
  mesh: THREE.Mesh;
  apply(look: Look, fogColor: THREE.Color, time: number, dim?: number): void;
  setOctaves(n: number): void;
}

const vert = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = p.xyww; // 常に最遠
}`;

const frag = /* glsl */`
uniform vec3 uZenith, uHorizon, uFog, uSunDir, uSunColor, uCloudLit, uCloudShade;
uniform float uSunSize, uSunDisc, uCover, uStars, uTime, uDim;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int k = 0; k < OCT; k++) { s += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return s;
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.55));
  float sd = max(dot(d, uSunDir), 0.0);
  // 太陽周辺の散乱光（雲量で弱まる）
  float clear = 1.0 - uCover * 0.85;
  col += uSunColor * (pow(sd, 6.0) * 0.18 + pow(sd, 64.0) * 0.35) * clear * min(uSunDisc, 1.0);
  // 星
  if (uStars > 0.01 && h > 0.0) {
    vec3 sp = d * 260.0; vec3 ip = floor(sp);
    float r = hash3(ip);
    float tw = 0.6 + 0.4 * sin(uTime * (1.5 + r * 3.0) + r * 40.0);
    float star = step(0.9965, r) * smoothstep(0.42, 0.0, length(fract(sp) - 0.5)) * tw;
    col += vec3(0.85, 0.9, 1.0) * star * uStars * smoothstep(0.0, 0.25, h) * 1.4;
  }
  // 太陽・月の円盤
  float disc = smoothstep(cos(uSunSize), cos(uSunSize * 0.7), sd);
  col += uSunColor * disc * uSunDisc;
  // 雲（平面投影の fbm）
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.12) * 0.55 + vec2(uTime * 0.006, uTime * 0.0025);
    float n = fbm(uv);
    float c = smoothstep(1.0 - uCover - 0.05, 1.05 - uCover * 0.55, n);
    float shade = fbm(uv * 1.7 + 3.1);
    vec3 cc = mix(uCloudLit, uCloudShade, clamp(shade * 1.3 - 0.15 + uCover * 0.3, 0.0, 1.0));
    cc += uSunColor * pow(sd, 10.0) * 0.35 * clear;
    col = mix(col, cc, c * smoothstep(0.0, 0.12, h) * 0.95);
  }
  // 地平線付近・下半分は霧の色に合わせる
  col = mix(col, uFog, 1.0 - smoothstep(-0.02, 0.1, h));
  col = mix(col, uFog, uDim); // トンネル内
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createSkyDome(scene: THREE.Scene, octaves: number): SkyDome {
  const uniforms = {
    uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uFog: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color() },
    uCloudLit: { value: new THREE.Color() }, uCloudShade: { value: new THREE.Color() },
    uSunSize: { value: .04 }, uSunDisc: { value: 1 }, uCover: { value: .3 }, uStars: { value: 0 }, uTime: { value: 0 }, uDim: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: vert, fragmentShader: frag, defines: { OCT: octaves },
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), mat);
  mesh.frustumCulled = false; mesh.renderOrder = -1000; mesh.name = 'env-sky';
  mesh.userData.noShadow = true;
  scene.add(mesh);
  return {
    mesh,
    apply(look, fogColor, time, dim = 0) {
      uniforms.uDim.value = dim;
      uniforms.uZenith.value.copy(look.zenith); uniforms.uHorizon.value.copy(look.horizon); uniforms.uFog.value.copy(fogColor);
      uniforms.uSunDir.value.copy(look.sunDir); uniforms.uSunColor.value.copy(look.sunColor);
      uniforms.uCloudLit.value.copy(look.cloudLit); uniforms.uCloudShade.value.copy(look.cloudShade);
      uniforms.uSunSize.value = look.sunSize; uniforms.uSunDisc.value = look.sunDisc;
      uniforms.uCover.value = look.cloudCover; uniforms.uStars.value = look.stars; uniforms.uTime.value = time;
    },
    setOctaves(n) { if (mat.defines.OCT !== n) { mat.defines.OCT = n; mat.needsUpdate = true; } },
  };
}
