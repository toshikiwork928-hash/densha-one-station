// スカイドーム: グラデーション空 + 太陽(月) + 手続き的な雲 + 星。カメラに追従（平行移動を無視）
import * as THREE from 'three';
import type { Look } from './look';
import { createRidgeTexture } from './ridges';

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
uniform float uSunSize, uSunDisc, uCover, uStars, uTime, uDim, uMtnVis, uSunLow, uSnow;
uniform vec3 uMtn;
uniform vec2 uSunH;
uniform sampler2D uRidge;
varying vec3 vDir;
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  mat2 R = mat2(1.6, -1.2, 1.2, 1.6); // 回転 + 拡大（格子の軸が見えないように）
  for (int k = 0; k < OCT; k++) { s += a * noise(p); p = R * p + vec2(1.7, 9.2); a *= 0.5; }
  return s / (1.0 - pow(0.5, float(OCT)));
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
  // 雲（平面投影の fbm。ドメインワープで塊感、太陽側へずらした密度との差で縁を明るく・底を暗く。地平線へ向けて霞む）
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.14) * 0.5 + vec2(uTime * 0.006, uTime * 0.0025);
    uv += 0.45 * vec2(noise(uv * 0.9 + 4.0), noise(uv * 0.9 + 11.0)) - 0.2;
    float n = fbm(uv);
    float th0 = 1.0 - uCover * 1.3 - 0.12, th1 = th0 + 0.28;
    float c = smoothstep(th0, th1, n);
    vec2 toSun = normalize(uSunDir.xz + 1e-4) * 0.1;
    float n2 = fbm(uv + toSun);
    float rim = clamp((n - n2) * 4.0, -1.0, 1.0);            // 太陽に面した縁が正
    float body = smoothstep(th0, th0 + 0.5, n);               // 厚い所ほど 1
    float shade = clamp(0.2 + body * 0.5 - rim * 0.4 + uCover * 0.25, 0.0, 1.0);
    vec3 cc = mix(uCloudLit, uCloudShade, shade);
    cc += uSunColor * (pow(sd, 8.0) * 0.3 + max(rim, 0.0) * 0.15) * clear;
    float far = 1.0 - smoothstep(0.02, 0.38, h);              // 遠い雲ほど霞んで地平線の色へ
    cc = mix(cc, uFog, far * 0.7);
    col = mix(col, cc, c * smoothstep(0.0, 0.16, h) * 0.96);
  }
  // 地平線付近・下半分は霧の色に合わせる
  col = mix(col, uFog, 1.0 - smoothstep(-0.02, 0.1, h));
  // 遠景の山並み（4 層。奥ほど霞んで空色寄り、谷は霧に沈む。夕は逆光側が染まる）
  if (h < 0.3) {
    float u = atan(d.x, -d.z) * 0.15915494 + 0.5;
    vec4 rg = texture2D(uRidge, vec2(u, 0.5));
    float az = dot(normalize(d.xz + 1e-5), uSunH);               // 太陽方位との一致度 -1..1
    for (int i = 0; i < 4; i++) {
      float rh = i == 0 ? rg.x : i == 1 ? rg.y : i == 2 ? rg.z : rg.w;
      float t = float(i) / 3.0;
      float cov = smoothstep(0.0, max(fwidth(h) * 1.6, 1e-5), rh - h);
      if (cov <= 0.0) continue;
      float up = clamp((rh - h) / max(rh, 1e-3), 0.0, 1.0);        // 0 = 稜線, 1 = 麓
      float haze = mix(0.55, 0.06, t) + (1.0 - uMtnVis) * (1.0 - 0.5 * t);
      haze = clamp(haze + up * up * 0.55 * (1.0 - t * 0.4), 0.0, 1.0);
      float tex = noise(vec2(u * 1300.0 + float(i) * 31.0, h * 260.0)) * 0.5 + noise(vec2(u * 420.0, h * 90.0 + float(i))) * 0.5;
      vec3 m = uMtn * mix(1.12, 0.66, t) * (0.9 + 0.2 * tex);
      m *= 1.0 - 0.45 * max(az, 0.0) * uSunLow;                     // 逆光側は暗いシルエット
      m += uSunColor * pow(max(az, 0.0), 3.0) * uSunLow * 0.22 * (1.0 - t * 0.3); // 稜線の染まり
      m = mix(m, min(uMtn * 2.4, vec3(0.92, 0.95, 1.0)), uSnow * smoothstep(0.35, 0.0, up) * 0.85);
      vec3 hz = uFog + uSunColor * pow(max(az, 0.0), 4.0) * uSunLow * 0.2;
      col = mix(col, mix(m, hz, haze), cov);
    }
  }
  col = mix(col, uFog, uDim); // トンネル内
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const MTN = new THREE.Color(0x4a6a58);

export function createSkyDome(scene: THREE.Scene, octaves: number): SkyDome {
  const uniforms = {
    uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uFog: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color() },
    uCloudLit: { value: new THREE.Color() }, uCloudShade: { value: new THREE.Color() },
    uMtn: { value: new THREE.Color() }, uSunH: { value: new THREE.Vector2(0, -1) }, uRidge: { value: createRidgeTexture() },
    uMtnVis: { value: 1 }, uSunLow: { value: 0 }, uSnow: { value: 0 },
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
      // 山: 明るさは光量に追従、霧・悪天候で霞みが増し見えなくなる
      const light = Math.min(1, Math.max(.1, (look.sunInt * .45 + look.hemiInt * .6) / 1.4));
      uniforms.uMtn.value.copy(MTN).multiplyScalar(light).lerp(look.zenith, .18);
      uniforms.uMtnVis.value = Math.min(1, Math.max(0, (look.fogFar - 300) / 1800));
      uniforms.uSunH.value.set(look.sunDir.x, look.sunDir.z).normalize();
      uniforms.uSunLow.value = (1 - Math.min(1, Math.max(0, (look.sunDir.y - .05) / .4))) * Math.min(1, look.sunInt / 1.2);
      uniforms.uSnow.value = look.snow;
      uniforms.uSunSize.value = look.sunSize; uniforms.uSunDisc.value = look.sunDisc;
      uniforms.uCover.value = look.cloudCover; uniforms.uStars.value = look.stars; uniforms.uTime.value = time;
    },
    setOctaves(n) { if (mat.defines.OCT !== n) { mat.defines.OCT = n; mat.needsUpdate = true; } },
  };
}
