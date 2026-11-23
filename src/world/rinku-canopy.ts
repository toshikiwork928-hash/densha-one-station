// りんくうタウン駅の3階ホーム。左右の上屋を白い梁で結び、中央2線の上は空ける。
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import { GeoBatch, M, P } from './batch';
import { canvasTex } from './canvas-tex';

export function buildRinkuCanopy(ctx: GameContext): void {
  const sta = ctx.route.stations.find(s => s.name === 'りんくうタウン');
  if (!ctx.route.airportBridge || !sta) return;
  const center = (sta.platform.from + sta.platform.to) / 2;
  const group = new THREE.Group();
  group.name = 'airport-rinku-central-canopy';
  group.position.copy(ctx.track.at(center,0,0));
  group.rotation.y = -ctx.track.trackAt(center).phi;
  const labels = ['1','2','3','4'];
  const b = new GeoBatch(new Set(labels));
  function box(x:number,y:number,z:number,w:number,h:number,d:number,color:number, key='body', roll=0) {
    b.add(key,P.box,M(x,y,z,0,w,h,d,0,roll),color);
  }
  const steel = 0xd2d6d3;
  for (const x of [-4.6,8.6]) {
    box(x,6.84,0,6,.24,165,0xa8adae);
    box(x,6.67,0,5.9,.12,165,0x747774);
    for(const side of [-1,1]) {
      box(x+side*2.94,6.93,0,.15,.58,165,steel);
      box(x+side*2.55,6.54,0,.10,.10,164,0xfff4dc,'lamp');
    }
    for(let z=-78;z<=78;z+=12){
      if(Math.abs(z-5)>6){
        box(x,3.9,z,.46,5.6,.54,steel);
        box(x,1.65,z,.48,1.1,.56,0x626b6c);
      }
    }
    for(let z=-81;z<=81;z+=1.5) box(x,6.57,z,5.75,.1,.085,0x585e5d);
    for(const side of [-1,1]){
      box(x+side*1.08,1.96,5,.075,.095,8.9,0xa5abac);
      for(const z of [.55,3.5,6.5,9.45]) box(x+side*1.08,1.52,z,.07,.85,.07,0x8e989b);
    }
  }
  // アーチは中央2線の上で横梁と対になり、その間から空が見える。
  for(let z=-78;z<=78;z+=12){
    box(2,7.28,z,29.8,.40,.33,steel);
    for (const [mid,half,rise] of [[2,3.65,2.45],[-10.3,2.65,1.50],[14.3,2.65,1.50]]) {
      for(let i=0;i<12;i++){
        const a=Math.PI*i/12, c=Math.PI*(i+1)/12;
        const x0=mid-half*Math.cos(a), x1=mid-half*Math.cos(c);
        const y0=7.46+rise*Math.sin(a), y1=7.46+rise*Math.sin(c);
        box((x0+x1)/2,(y0+y1)/2,z,Math.hypot(x1-x0,y1-y0)+.035,.15,.2,steel,'body',Math.atan2(y1-y0,x1-x0));
      }
    }
  }
  for(const x of [-12.9,16.9]){
    box(x,4.0,0,.065,6.30,165,0xffffff,'glass');
    for(const y of [1.0,3.0,5.45,7.18]) box(x,y,0,.15,.12,165,steel);
    for(let z=-82;z<=82;z+=4) box(x,4,z,.18,6.5,.15,steel);
  }
  const materials: Record<string,THREE.Material> = {
    body:new THREE.MeshLambertMaterial({vertexColors:true,emissive:0x414540}),
    glass:new THREE.MeshLambertMaterial({color:0xc4d6df,transparent:true,opacity:.22,depthWrite:false}),
    lamp:new THREE.MeshBasicMaterial({vertexColors:true}),
  };
  for(const [i,x] of [-6.1,-3.1,7.1,10.1].entries()){
    const jr=i===1 || i===2;
    materials[labels[i]]=new THREE.MeshBasicMaterial({map:canvasTex(256,160,(g,w,h)=>{
      g.fillStyle='#fff';g.fillRect(0,0,w,h);g.fillStyle=jr?'#2c6190':'#365d57';g.fillRect(140,0,116,h);
      g.textAlign='center';g.fillStyle='#222';g.font='bold 82px sans-serif';g.fillText(labels[i],70,94);
      g.font='bold 17px sans-serif';g.fillText(i<2?'関西空港方面':jr?'日根野方面':'なんば方面',70,131);
      g.fillStyle='#fff';g.font='bold 32px sans-serif';g.fillText(jr?'JR':'南海',198,86);
    })});
    for(const z of [-52,35]){
      box(x,5.8,z,.06,1.5,.06,steel);
      box(x,4.74,z,1.25,.84,.18,0x606764);
      for(const side of [-1,1]) b.add(labels[i],P.plane,M(x,4.74,z+side*.10,side<0?Math.PI:0,1.20,.78,1));
    }
  }
  b.build(materials,group);
  ctx.scene.add(group);
}
