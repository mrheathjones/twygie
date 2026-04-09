/* ═══ immersive.js ═══ Three.js 3D Immersive Mode ═══
 *
 * DEFINES: enterImmersive(), exitImmersive(), immRefreshLines()
 * READS:   people, peopleById, getNodeColor(), fullName(), treeMode
 * WRITES:  nothing persistent — purely visual
 */

let immScene, immCamera, immRenderer, immAnimId;
let immNodes=[], immLines=[];
let immDragging=false, immDragStart={x:0,y:0}, immDragMoved=false;
let immTheta=0, immPhi=Math.PI/4, immRadius=350;
let immTargetTheta=0, immTargetPhi=Math.PI/4, immTargetRadius=350;
let immLookAt, immTargetLookAt;
let immExpandProgress=0, immExpanding=false;
let immSelectedId=null, immZooming=false;
const IMM_SPHERE_R=200, IMM_NODE_SZ=4;

function enterImmersive(){
  const wrap=document.getElementById('immersive-wrap');
  const canvas=document.getElementById('immersive-canvas');
  if(!wrap||!canvas||typeof THREE==='undefined') return;

  wrap.style.display='block';
  const mw=document.getElementById('wrap'); if(mw) mw.style.display='none';
  // Float view toggle over 3D
  const ts=document.querySelector('.toggle-stack');
  if(ts) ts.style.cssText='position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:60';
  const lt=document.querySelector('.layout-toggle');
  if(lt) lt.style.display='none';

  immScene=new THREE.Scene();
  immScene.background=new THREE.Color(0x050508);
  immScene.fog=new THREE.FogExp2(0x050508,0.0006);
  immCamera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,1,2000);
  immLookAt=new THREE.Vector3(0,0,0);
  immTargetLookAt=new THREE.Vector3(0,0,0);
  updateImmCam();

  immRenderer=new THREE.WebGLRenderer({canvas,antialias:true});
  immRenderer.setSize(innerWidth,innerHeight);
  immRenderer.setPixelRatio(Math.min(devicePixelRatio,2));

  // Lights
  immScene.add(new THREE.AmbientLight(0x334466,0.6));
  const L1=new THREE.PointLight(0xffffff,1.2,800); L1.position.set(0,100,200); immScene.add(L1);
  const L2=new THREE.PointLight(0x4488ff,0.5,600); L2.position.set(-200,-100,-100); immScene.add(L2);

  // Stars
  const sg=new THREE.BufferGeometry(), sv=[];
  for(let i=0;i<800;i++) sv.push((Math.random()-.5)*1500,(Math.random()-.5)*1500,(Math.random()-.5)*1500);
  sg.setAttribute('position',new THREE.Float32BufferAttribute(sv,3));
  immScene.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0x555577,size:0.8,transparent:true,opacity:0.5})));

  buildImmNodes(); buildImmLines();
  immExpandProgress=0; immExpanding=true;
  immSelectedId=null; immZooming=false;
  immTheta=0; immPhi=Math.PI/4; immRadius=350;
  immTargetTheta=0; immTargetPhi=Math.PI/4; immTargetRadius=350;

  canvas.addEventListener('mousedown',immMD); canvas.addEventListener('mousemove',immMM);
  canvas.addEventListener('mouseup',immMU); canvas.addEventListener('wheel',immWH,{passive:false});
  canvas.addEventListener('touchstart',immTS,{passive:false}); canvas.addEventListener('touchmove',immTM,{passive:false});
  canvas.addEventListener('touchend',immTE); canvas.addEventListener('click',immCK);
  addEventListener('resize',immRZ);
  immAnimate();
}

function exitImmersive(){
  const wrap=document.getElementById('immersive-wrap'); if(wrap) wrap.style.display='none';
  const mw=document.getElementById('wrap'); if(mw) mw.style.display='';
  const ts=document.querySelector('.toggle-stack'); if(ts) ts.style.cssText='';
  const lt=document.querySelector('.layout-toggle'); if(lt) lt.style.display='';
  const ic=document.getElementById('imm-card'); if(ic) ic.remove();
  if(immAnimId) cancelAnimationFrame(immAnimId); immAnimId=null;
  const c=document.getElementById('immersive-canvas');
  if(c){c.removeEventListener('mousedown',immMD);c.removeEventListener('mousemove',immMM);
    c.removeEventListener('mouseup',immMU);c.removeEventListener('wheel',immWH);
    c.removeEventListener('touchstart',immTS);c.removeEventListener('touchmove',immTM);
    c.removeEventListener('touchend',immTE);c.removeEventListener('click',immCK);}
  removeEventListener('resize',immRZ);
  immNodes.forEach(n=>{immScene.remove(n.mesh);immScene.remove(n.glow);immScene.remove(n.label);});
  immLines.forEach(l=>{immScene.remove(l.line);});
  immNodes=[]; immLines=[];
  if(immRenderer) immRenderer.dispose();
  immScene=immCamera=immRenderer=null;
}

// ─── NODES ───────────────────────────────────────────────────────────────────
function buildImmNodes(){
  const others=people.filter(p=>!p.isYou);
  const pts=fibSphere(others.length, IMM_SPHERE_R);
  people.forEach(p=>{
    const col=new THREE.Color(getNodeColor(p));
    const iy=p.isYou, sz=iy?IMM_NODE_SZ*1.8:IMM_NODE_SZ;
    const tgt=iy?new THREE.Vector3(0,0,0):pts[others.indexOf(p)];
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(sz,24,24),
      new THREE.MeshPhongMaterial({color:col,emissive:col,emissiveIntensity:iy?1.0:.6,transparent:true,opacity:.95,shininess:80}));
    mesh.userData={personId:p.id,targetPos:tgt}; immScene.add(mesh);
    const glow=new THREE.Mesh(new THREE.SphereGeometry(sz*(iy?3.5:2.5),16,16),
      new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:iy?.22:.12,side:THREE.BackSide}));
    immScene.add(glow);
    const label=immSprite(iy?'You':fullName(p),col);
    label.userData={offsetY:-sz*2.5}; immScene.add(label);
    immNodes.push({mesh,glow,label,personId:p.id,isYou:iy,size:sz});
  });
}
function fibSphere(n,r){
  const pts=[],ga=Math.PI*(3-Math.sqrt(5));
  for(let i=0;i<n;i++){const y=1-(i/((n-1)||1))*2,rr=Math.sqrt(1-y*y),t=ga*i;
    pts.push(new THREE.Vector3(rr*Math.cos(t)*r,y*r,rr*Math.sin(t)*r));}
  return pts;
}
function immSprite(text,col){
  const c=document.createElement('canvas'),x=c.getContext('2d');
  c.width=256;c.height=64;x.font='bold 24px Outfit,sans-serif';x.textAlign='center';
  x.fillStyle='#'+col.getHexString();x.globalAlpha=.9;x.fillText(text,128,40);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false}));
  s.scale.set(40,10,1); return s;
}

// ─── CONNECTIONS ─────────────────────────────────────────────────────────────
function buildImmLines(){
  immLines.forEach(l=>immScene.remove(l.line)); immLines=[];
  const drawn=new Set();
  const showB=treeMode!=='bonds', showNB=treeMode!=='bloodline';
  const showExt=treeMode==='complex'||treeMode==='bloodline'||treeMode==='bonds';

  if(showB) people.forEach(p=>{(p.parents||[]).forEach(pid=>{
    const k=[p.id,pid].sort().join('|'); if(drawn.has(k))return; drawn.add(k);
    mkLine(p.id,pid,0x64b464,false);
  });});
  if(showNB) people.forEach(p=>{if(!p.spouseOf)return;
    const k=[p.id,p.spouseOf].sort().join('|'); if(drawn.has(k))return; drawn.add(k);
    mkLine(p.id,p.spouseOf,0x648cdc,true);
  });
  people.forEach(p=>{(p.relationships||[]).forEach(rel=>{
    const k=[p.id,rel.targetId].sort().join('|'); if(drawn.has(k))return; drawn.add(k);
    const cat=rel.category||'custom', isSib=SIBLING_LABELS.has(rel.label);
    if(isSib&&!showB)return; if(cat==='blood'&&!showB)return;
    if(cat==='bond'&&!showNB)return; if(cat==='custom'&&!showNB)return;
    if(!isSib&&cat==='blood'&&!showExt)return; if(cat!=='blood'&&!showExt)return;
    if(isSib) mkLine(p.id,rel.targetId,0xdc8c3c,false);
    else if(cat==='blood') mkLine(p.id,rel.targetId,0xa064dc,false);
    else if(cat==='bond') mkLine(p.id,rel.targetId,0xdc6488,true);
    else mkLine(p.id,rel.targetId,0xa064dc,true);
  });});
}
function mkLine(idA,idB,color,dashed){
  const nA=immNodes.find(n=>n.personId===idA), nB=immNodes.find(n=>n.personId===idB);
  if(!nA||!nB)return;
  const geo=new THREE.BufferGeometry().setFromPoints([nA.mesh.position.clone(),nB.mesh.position.clone()]);
  const mat=dashed?new THREE.LineDashedMaterial({color,dashSize:6,gapSize:3,transparent:true,opacity:.65})
    :new THREE.LineBasicMaterial({color,transparent:true,opacity:.7});
  const line=new THREE.Line(geo,mat); if(dashed)line.computeLineDistances();
  line.userData={idA,idB}; immScene.add(line); immLines.push({line,idA,idB});
}
function immRefreshLines(){if(immScene)buildImmLines();}

// ─── CAMERA ──────────────────────────────────────────────────────────────────
function updateImmCam(){
  if(!immCamera)return;
  immCamera.position.set(
    immLookAt.x+immRadius*Math.sin(immPhi)*Math.cos(immTheta),
    immLookAt.y+immRadius*Math.cos(immPhi),
    immLookAt.z+immRadius*Math.sin(immPhi)*Math.sin(immTheta));
  immCamera.lookAt(immLookAt);
}

// ─── INPUT ───────────────────────────────────────────────────────────────────
function immMD(e){immDragging=true;immDragMoved=false;immDragStart={x:e.clientX,y:e.clientY};}
function immMM(e){if(!immDragging)return;const dx=e.clientX-immDragStart.x,dy=e.clientY-immDragStart.y;
  if(Math.abs(dx)>3||Math.abs(dy)>3)immDragMoved=true;
  immTargetTheta-=dx*.005;immTargetPhi=Math.max(.1,Math.min(Math.PI-.1,immTargetPhi+dy*.005));
  immDragStart={x:e.clientX,y:e.clientY};}
function immMU(){immDragging=false;}
function immWH(e){e.preventDefault();immTargetRadius=Math.max(50,Math.min(800,immTargetRadius+e.deltaY*.5));}
let immTP={x:0,y:0};
function immTS(e){if(e.touches.length===1){immDragging=true;immDragMoved=false;immTP={x:e.touches[0].clientX,y:e.touches[0].clientY};immDragStart={...immTP};}}
function immTM(e){e.preventDefault();if(!immDragging||e.touches.length!==1)return;
  const dx=e.touches[0].clientX-immTP.x,dy=e.touches[0].clientY-immTP.y;
  if(Math.abs(dx)>3||Math.abs(dy)>3)immDragMoved=true;
  immTargetTheta-=dx*.005;immTargetPhi=Math.max(.1,Math.min(Math.PI-.1,immTargetPhi+dy*.005));
  immTP={x:e.touches[0].clientX,y:e.touches[0].clientY};}
function immTE(){immDragging=false;}

function immCK(e){
  if(immDragMoved)return;
  if(!immCamera||!immRenderer)return;
  const r=immRenderer.domElement.getBoundingClientRect();
  const m=new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
  const rc=new THREE.Raycaster(); rc.setFromCamera(m,immCamera);
  const hits=rc.intersectObjects(immNodes.map(n=>n.mesh));
  if(hits.length>0){const pid=hits[0].object.userData.personId; if(pid)immZoomTo(pid);}
  else if(immSelectedId){ if(typeof closeCard==='function') closeCard(); }
}

function immZoomTo(personId){
  const nd=immNodes.find(n=>n.personId===personId); if(!nd)return;
  immSelectedId=personId;
  immTargetLookAt=nd.mesh.userData.targetPos.clone();
  immTargetRadius=80; immZooming=true;
  setTimeout(()=>{ if(typeof selectNode==='function') selectNode(personId); },800);
}



function immRZ(){if(!immCamera||!immRenderer)return;immCamera.aspect=innerWidth/innerHeight;immCamera.updateProjectionMatrix();immRenderer.setSize(innerWidth,innerHeight);}

// ─── RENDER LOOP ─────────────────────────────────────────────────────────────
function immAnimate(){
  immAnimId=requestAnimationFrame(immAnimate);
  if(!immScene||!immCamera||!immRenderer)return;
  const t=Date.now()*.001;

  immTheta+=(immTargetTheta-immTheta)*.08;
  immPhi+=(immTargetPhi-immPhi)*.08;
  immRadius+=(immTargetRadius-immRadius)*.06;
  immLookAt.lerp(immTargetLookAt,.06);
  updateImmCam();

  if(immExpanding){
    immExpandProgress=Math.min(1,immExpandProgress+.012);
    if(immExpandProgress>=1)immExpanding=false;
    const e=1-Math.pow(1-immExpandProgress,3);
    immNodes.forEach(n=>{const tp=n.mesh.userData.targetPos;if(tp)n.mesh.position.lerpVectors(new THREE.Vector3(0,0,0),tp,e);});
  }

  immNodes.forEach((n,i)=>{
    n.glow.position.copy(n.mesh.position);
    n.label.position.copy(n.mesh.position); n.label.position.y+=n.label.userData.offsetY||0;
    n.mesh.material.emissiveIntensity=(n.isYou?1.0:.6)+Math.sin(t*1.5+i*.7)*.25;
    n.glow.material.opacity=immSelectedId===n.personId?(.35+Math.sin(t*3)*.12):(n.isYou?.22:.12);
  });

  immLines.forEach((l,i)=>{
    const a=immNodes.find(n=>n.personId===l.idA), b=immNodes.find(n=>n.personId===l.idB);
    if(a&&b&&l.line){
      const pos=l.line.geometry.attributes.position;
      pos.setXYZ(0,a.mesh.position.x,a.mesh.position.y,a.mesh.position.z);
      pos.setXYZ(1,b.mesh.position.x,b.mesh.position.y,b.mesh.position.z);
      pos.needsUpdate=true;
      if(l.line.material.isLineDashedMaterial)l.line.computeLineDistances();
      const bo=l.line.material.isLineDashedMaterial?.5:.6;
      l.line.material.opacity=bo+Math.sin(t*1.2+i*.5)*.2;
    }
  });

  if(!immDragging&&!immZooming)immTargetTheta+=.0008;
  if(immZooming&&Math.abs(immRadius-immTargetRadius)<1)immZooming=false;
  immRenderer.render(immScene,immCamera);
}
