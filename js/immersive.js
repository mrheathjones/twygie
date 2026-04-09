/* ═══ immersive.js ═══ Three.js 3D Immersive Mode ═══
 *
 * DEFINES: enterImmersive(), exitImmersive()
 * READS:   people, peopleById, getNodeColor(), fullName(), getRelToYou()
 * WRITES:  nothing persistent — purely visual
 *
 * Spherical shell layout: isYou at center, family on sphere surface
 * Animated expand from center (Iron Man 2 style)
 * Mouse drag to orbit, scroll to zoom, click to select
 */

let immScene, immCamera, immRenderer, immAnimId;
let immNodes=[], immLines=[], immLabels=[];
let immMouse={x:0,y:0}, immDragging=false, immDragStart={x:0,y:0};
let immTheta=0, immPhi=Math.PI/4, immRadius=350;
let immTargetTheta=0, immTargetPhi=Math.PI/4, immTargetRadius=350;
let immExpandProgress=0, immExpanding=false;
const IMM_SPHERE_RADIUS=200;
const IMM_NODE_SIZE=4;

function enterImmersive(){
  const wrap=document.getElementById('immersive-wrap');
  const canvas=document.getElementById('immersive-canvas');
  if(!wrap||!canvas||typeof THREE==='undefined') return;

  wrap.style.display='block';
  document.getElementById('wrap')&&(document.getElementById('wrap').style.display='none');

  // Scene
  immScene=new THREE.Scene();
  immScene.background=new THREE.Color(0x050508);
  immScene.fog=new THREE.FogExp2(0x050508,0.0008);

  // Camera
  immCamera=new THREE.PerspectiveCamera(60,window.innerWidth/window.innerHeight,1,2000);
  updateCameraPosition();

  // Renderer
  immRenderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
  immRenderer.setSize(window.innerWidth,window.innerHeight);
  immRenderer.setPixelRatio(Math.min(window.devicePixelRatio,2));

  // Lighting
  const ambient=new THREE.AmbientLight(0x334466,0.6);
  immScene.add(ambient);
  const point=new THREE.PointLight(0xffffff,1.2,800);
  point.position.set(0,100,200);
  immScene.add(point);
  const point2=new THREE.PointLight(0x4488ff,0.5,600);
  point2.position.set(-200,-100,-100);
  immScene.add(point2);

  // Build nodes and connections
  buildImmersiveNodes();
  buildImmersiveLines();

  // Start expand animation
  immExpandProgress=0;
  immExpanding=true;

  // Event listeners
  canvas.addEventListener('mousedown',immOnMouseDown);
  canvas.addEventListener('mousemove',immOnMouseMove);
  canvas.addEventListener('mouseup',immOnMouseUp);
  canvas.addEventListener('wheel',immOnWheel,{passive:false});
  canvas.addEventListener('touchstart',immOnTouchStart,{passive:false});
  canvas.addEventListener('touchmove',immOnTouchMove,{passive:false});
  canvas.addEventListener('touchend',immOnTouchEnd);
  canvas.addEventListener('click',immOnClick);
  window.addEventListener('resize',immOnResize);

  // Start render loop
  immAnimate();
}

function exitImmersive(){
  const wrap=document.getElementById('immersive-wrap');
  if(wrap) wrap.style.display='none';
  document.getElementById('wrap')&&(document.getElementById('wrap').style.display='');

  if(immAnimId) cancelAnimationFrame(immAnimId);
  immAnimId=null;

  // Clean up
  const canvas=document.getElementById('immersive-canvas');
  if(canvas){
    canvas.removeEventListener('mousedown',immOnMouseDown);
    canvas.removeEventListener('mousemove',immOnMouseMove);
    canvas.removeEventListener('mouseup',immOnMouseUp);
    canvas.removeEventListener('wheel',immOnWheel);
    canvas.removeEventListener('touchstart',immOnTouchStart);
    canvas.removeEventListener('touchmove',immOnTouchMove);
    canvas.removeEventListener('touchend',immOnTouchEnd);
    canvas.removeEventListener('click',immOnClick);
  }
  window.removeEventListener('resize',immOnResize);

  // Dispose Three.js objects
  immNodes.forEach(n=>{
    if(n.mesh) immScene.remove(n.mesh);
    if(n.glow) immScene.remove(n.glow);
    if(n.label) immScene.remove(n.label);
  });
  immLines.forEach(l=>{ if(l.line) immScene.remove(l.line); });
  immNodes=[]; immLines=[]; immLabels=[];
  if(immRenderer) immRenderer.dispose();
  immScene=null; immCamera=null; immRenderer=null;
}

// ─── BUILD 3D NODES ──────────────────────────────────────────────────────────

function buildImmersiveNodes(){
  if(!people.length) return;
  const youNode=people.find(p=>p.isYou);

  // Assign 3D positions on spherical shell
  // isYou at center (0,0,0), everyone else on sphere surface
  const others=people.filter(p=>!p.isYou);
  const positions=distributeOnSphere(others.length, IMM_SPHERE_RADIUS);

  people.forEach((p,i)=>{
    const color=new THREE.Color(getNodeColor(p));
    const isYou=p.isYou;
    const size=isYou?IMM_NODE_SIZE*1.8:IMM_NODE_SIZE;

    // Target position
    const target=isYou?new THREE.Vector3(0,0,0):positions[others.indexOf(p)];

    // Core sphere
    const geo=new THREE.SphereGeometry(size,24,24);
    const mat=new THREE.MeshPhongMaterial({
      color:color,
      emissive:color,
      emissiveIntensity:isYou?0.8:0.4,
      transparent:true,
      opacity:0.95,
      shininess:80
    });
    const mesh=new THREE.Mesh(geo,mat);
    mesh.position.set(0,0,0); // Start at center for animation
    mesh.userData={personId:p.id, targetPos:target};
    immScene.add(mesh);

    // Outer glow sphere
    const glowGeo=new THREE.SphereGeometry(size*(isYou?3.5:2.5),16,16);
    const glowMat=new THREE.MeshBasicMaterial({
      color:color,
      transparent:true,
      opacity:isYou?0.12:0.06,
      side:THREE.BackSide
    });
    const glow=new THREE.Mesh(glowGeo,glowMat);
    glow.position.copy(mesh.position);
    glow.userData={followMesh:mesh};
    immScene.add(glow);

    // Text label (using sprite)
    const label=makeTextSprite(isYou?'You':fullName(p), color);
    label.position.copy(mesh.position);
    label.position.y-=size*2.5;
    label.userData={followMesh:mesh, offsetY:-size*2.5};
    immScene.add(label);

    immNodes.push({mesh, glow, label, personId:p.id, isYou});
  });
}

function distributeOnSphere(count, radius){
  // Fibonacci sphere for even distribution
  const positions=[];
  const goldenAngle=Math.PI*(3-Math.sqrt(5));
  for(let i=0;i<count;i++){
    const y=1-(i/(count-1||1))*2; // -1 to 1
    const r=Math.sqrt(1-y*y);
    const theta=goldenAngle*i;
    positions.push(new THREE.Vector3(
      r*Math.cos(theta)*radius,
      y*radius,
      r*Math.sin(theta)*radius
    ));
  }
  return positions;
}

function makeTextSprite(text, color){
  const canvas=document.createElement('canvas');
  const ctx=canvas.getContext('2d');
  canvas.width=256; canvas.height=64;
  ctx.font='bold 24px Outfit, sans-serif';
  ctx.textAlign='center';
  ctx.fillStyle='#'+color.getHexString();
  ctx.globalAlpha=0.9;
  ctx.fillText(text,128,40);
  const tex=new THREE.CanvasTexture(canvas);
  tex.needsUpdate=true;
  const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false});
  const sprite=new THREE.Sprite(mat);
  sprite.scale.set(40,10,1);
  return sprite;
}

// ─── BUILD 3D CONNECTIONS ────────────────────────────────────────────────────

function buildImmersiveLines(){
  const drawn=new Set();

  // Parent-child lines
  people.forEach(p=>{
    (p.parents||[]).forEach(pid=>{
      const key=[p.id,pid].sort().join('|');
      if(drawn.has(key)) return; drawn.add(key);
      addImmLine(p.id, pid, 0x64b464, 2, false); // green
    });
  });

  // Spouse lines
  people.forEach(p=>{
    if(!p.spouseOf) return;
    const key=[p.id,p.spouseOf].sort().join('|');
    if(drawn.has(key)) return; drawn.add(key);
    addImmLine(p.id, p.spouseOf, 0x648cdc, 1.5, true); // blue dashed
  });

  // Relationship lines
  people.forEach(p=>{
    (p.relationships||[]).forEach(rel=>{
      const key=[p.id,rel.targetId].sort().join('|');
      if(drawn.has(key)) return; drawn.add(key);
      const cat=rel.category||'custom';
      const isSib=SIBLING_LABELS.has(rel.label);
      if(isSib) addImmLine(p.id, rel.targetId, 0xdc8c3c, 1.5, false); // orange
      else if(cat==='blood') addImmLine(p.id, rel.targetId, 0xa064dc, 1.5, false); // purple
      else if(cat==='bond') addImmLine(p.id, rel.targetId, 0xdc6488, 1, true); // pink
      else addImmLine(p.id, rel.targetId, 0xa064dc, 1, true); // purple dashed
    });
  });
}

function addImmLine(idA, idB, color, width, dashed){
  const nodeA=immNodes.find(n=>n.personId===idA);
  const nodeB=immNodes.find(n=>n.personId===idB);
  if(!nodeA||!nodeB) return;

  const geo=new THREE.BufferGeometry().setFromPoints([
    nodeA.mesh.position.clone(),
    nodeB.mesh.position.clone()
  ]);

  let mat;
  if(dashed){
    mat=new THREE.LineDashedMaterial({color,linewidth:width,dashSize:6,gapSize:3,transparent:true,opacity:0.5});
  } else {
    mat=new THREE.LineBasicMaterial({color,linewidth:width,transparent:true,opacity:0.6});
  }

  const line=new THREE.Line(geo,mat);
  if(dashed) line.computeLineDistances();
  line.userData={idA,idB};
  immScene.add(line);
  immLines.push({line,idA,idB});
}

// ─── CAMERA & ORBIT ──────────────────────────────────────────────────────────

function updateCameraPosition(){
  if(!immCamera) return;
  immCamera.position.x=immRadius*Math.sin(immPhi)*Math.cos(immTheta);
  immCamera.position.y=immRadius*Math.cos(immPhi);
  immCamera.position.z=immRadius*Math.sin(immPhi)*Math.sin(immTheta);
  immCamera.lookAt(0,0,0);
}

function immOnMouseDown(e){
  immDragging=true;
  immDragStart={x:e.clientX,y:e.clientY};
}
function immOnMouseMove(e){
  if(!immDragging) return;
  const dx=e.clientX-immDragStart.x;
  const dy=e.clientY-immDragStart.y;
  immTargetTheta-=dx*0.005;
  immTargetPhi=Math.max(0.1,Math.min(Math.PI-0.1, immTargetPhi+dy*0.005));
  immDragStart={x:e.clientX,y:e.clientY};
}
function immOnMouseUp(){ immDragging=false; }
function immOnWheel(e){
  e.preventDefault();
  immTargetRadius=Math.max(100,Math.min(800, immTargetRadius+e.deltaY*0.5));
}

// Touch support
let immTouchStart={x:0,y:0};
function immOnTouchStart(e){
  if(e.touches.length===1){
    immDragging=true;
    immTouchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};
    immDragStart={...immTouchStart};
  }
}
function immOnTouchMove(e){
  e.preventDefault();
  if(!immDragging||e.touches.length!==1) return;
  const dx=e.touches[0].clientX-immDragStart.x;
  const dy=e.touches[0].clientY-immDragStart.y;
  immTargetTheta-=dx*0.005;
  immTargetPhi=Math.max(0.1,Math.min(Math.PI-0.1, immTargetPhi+dy*0.005));
  immDragStart={x:e.touches[0].clientX,y:e.touches[0].clientY};
}
function immOnTouchEnd(){ immDragging=false; }

function immOnClick(e){
  if(!immCamera||!immRenderer) return;
  // Check if mouse moved significantly (was a drag, not a click)
  const rect=immRenderer.domElement.getBoundingClientRect();
  const mouse=new THREE.Vector2(
    ((e.clientX-rect.left)/rect.width)*2-1,
    -((e.clientY-rect.top)/rect.height)*2+1
  );
  const raycaster=new THREE.Raycaster();
  raycaster.setFromCamera(mouse, immCamera);
  const meshes=immNodes.map(n=>n.mesh);
  const hits=raycaster.intersectObjects(meshes);
  if(hits.length>0){
    const personId=hits[0].object.userData.personId;
    if(personId){
      // Exit immersive temporarily to show card
      exitImmersive();
      setLayoutMode('relaxed',false);
      setTimeout(()=>selectNode(personId),100);
    }
  }
}

function immOnResize(){
  if(!immCamera||!immRenderer) return;
  immCamera.aspect=window.innerWidth/window.innerHeight;
  immCamera.updateProjectionMatrix();
  immRenderer.setSize(window.innerWidth,window.innerHeight);
}

// ─── ANIMATION LOOP ──────────────────────────────────────────────────────────

function immAnimate(){
  immAnimId=requestAnimationFrame(immAnimate);
  if(!immScene||!immCamera||!immRenderer) return;

  // Smooth orbit
  immTheta+=(immTargetTheta-immTheta)*0.08;
  immPhi+=(immTargetPhi-immPhi)*0.08;
  immRadius+=(immTargetRadius-immRadius)*0.08;
  updateCameraPosition();

  // Expand animation (0→1 over ~2 seconds)
  if(immExpanding){
    immExpandProgress=Math.min(1, immExpandProgress+0.012);
    if(immExpandProgress>=1) immExpanding=false;

    // Ease function (cubic ease out)
    const t=1-Math.pow(1-immExpandProgress,3);

    immNodes.forEach(n=>{
      const target=n.mesh.userData.targetPos;
      if(target){
        n.mesh.position.lerpVectors(new THREE.Vector3(0,0,0), target, t);
      }
    });
  }

  // Update glow and label positions to follow their meshes
  immNodes.forEach(n=>{
    if(n.glow) n.glow.position.copy(n.mesh.position);
    if(n.label){
      n.label.position.copy(n.mesh.position);
      n.label.position.y+=n.label.userData.offsetY||0;
    }
  });

  // Update connection lines to follow node positions
  immLines.forEach(l=>{
    const a=immNodes.find(n=>n.personId===l.idA);
    const b=immNodes.find(n=>n.personId===l.idB);
    if(a&&b&&l.line){
      const positions=l.line.geometry.attributes.position;
      positions.setXYZ(0, a.mesh.position.x, a.mesh.position.y, a.mesh.position.z);
      positions.setXYZ(1, b.mesh.position.x, b.mesh.position.y, b.mesh.position.z);
      positions.needsUpdate=true;
      if(l.line.material.isLineDashedMaterial) l.line.computeLineDistances();
    }
  });

  // Gentle node pulse (emissive intensity oscillation)
  const time=Date.now()*0.001;
  immNodes.forEach((n,i)=>{
    const mat=n.mesh.material;
    const base=n.isYou?0.8:0.4;
    mat.emissiveIntensity=base+Math.sin(time*1.5+i*0.7)*0.15;
  });

  // Slow auto-rotation when not dragging
  if(!immDragging){
    immTargetTheta+=0.001;
  }

  immRenderer.render(immScene, immCamera);
}
