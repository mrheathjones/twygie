/* ═══ render.js ═══════════════════════════════════════════════════════════
 * SVG tree rendering: nodes, branches, glow effects, and visual helpers.
 *
 * DEFINES (globals):
 *   SVG_NS              — SVG namespace string
 *   DEFAULT_NODE_COLORS  — default color palette for node categories
 *   DEFAULT_LINE_COLORS  — default color palette for connection lines
 *   nodeColors, lineColors — current (possibly user-customized) palettes
 *
 * KEY FUNCTIONS:
 *   render()            — main render loop: clears + redraws branches + nodes
 *   drawBranches()      — draws all connection lines (color-coded by type)
 *   drawNodes()         — draws all node circles with glow, photos, labels
 *   relCategory(p)      — classifies a Person into a visual category
 *   getNodeColor(p)     — returns the fill color for a node
 *   getGlowRadius(p)    — returns glow halo size based on connection count
 *
 * READS: people[], peopleById{}, treeMode, BLOOD_LABELS, nodeColors, lineColors
 * ═══════════════════════════════════════════════════════════════════════════ */
// ─── GENDER-AWARE RELATIONSHIP LABELS ────────────────────────────────────────
function genderedRel(baseRel, gender){
  const m=gender==='male', f=gender==='female';
  const map={
    'Parent': m?'Father':f?'Mother':'Parent',
    'Child':  m?'Son':f?'Daughter':'Child',
    'Sibling':m?'Brother':f?'Sister':'Sibling',
    'Spouse': m?'Husband':f?'Wife':'Partner',
    'Grandparent':m?'Grandfather':f?'Grandmother':'Grandparent',
    'Grandchild': m?'Grandson':f?'Granddaughter':'Grandchild',
  };
  return map[baseRel]||baseRel;
}

function getRelToYou(id){
  const you=people.find(p=>p.isYou); if(!you||id===you.id) return '';
  const p=peopleById[id]; if(!p) return '';

  // Check v2 relationships[] first (fastest, pre-computed)
  const rel=getRel(you, p);
  if(rel) return rel.label;

  // Structural compute (catches anything not yet in relationships[])
  const computed=computeRelationship(you.id, id);
  if(computed) return computed.label;

  // Legacy fallback
  if(p.relLabel) return p.relLabel;
  return '';
}

const SVG_NS='http://www.w3.org/2000/svg';
function createSvgElement(t){ return document.createElementNS(SVG_NS,t); }

// ─── RENDER ───────────────────────────────────────────────────────────────────
function render(){
  document.getElementById('lG').innerHTML='';
  document.getElementById('bG').innerHTML='';
  setTimeout(()=>{ syncLegend(); syncNodeLegend(); },0);
  document.getElementById('nG').innerHTML='';
  document.getElementById('defs-clips').innerHTML='';
  drawBranches();
  drawNodes();
  if(showLeafs) drawLeafs();
}

function getBranchStyle(dy){
  // Blood parent-child lines — solid, bold
  const a=Math.abs(dy);
  if(a>280) return {w:10,o:.65};
  if(a>180) return {w:7.5,o:.58};
  if(a>100) return {w:5,o:.50};
  return {w:3.5,o:.42};
}

// ─── BRANCH COLOR THEME (user-customizable) ────────────────────────────────
const DEFAULT_NODE_COLORS = {
  you:         '#f0efeb',
  spouse:      '#e8a838',
  parent:      '#7ab8e8',
  child:       '#6ecb8a',
  sibling:     '#e87a5a',
  grandparent: '#b89ae8',
  extended:    '#e8c87a',
  deceased:    '#c27070',
  young:       '#4ecdb4',
  default:     '#f0b845',
};
let nodeColors = {...DEFAULT_NODE_COLORS};

function relCategory(p){
  if(p.isYou) return 'you';
  if(p.death||(p.dod&&p.dod.year)) return 'deceased';
  const birthYear=parseInt(p.dob&&p.dob.year)||p.birth||0;
  const currentYear=new Date().getFullYear();
  if(birthYear>0 && (currentYear-birthYear)<=youngAge) return 'young';
  const you=peopleById&&Object.values(peopleById).find(x=>x.isYou);
  if(!you) return 'default';
  // Structural checks
  if((p.parents||[]).includes(you.id)) return 'child';
  if((you.parents||[]).includes(p.id)) return 'parent';
  if(p.spouseOf===you.id||you.spouseOf===p.id) return 'spouse';
  const myP=new Set(you.parents||[]);
  if(myP.size&&(p.parents||[]).some(pp=>myP.has(pp))) return 'sibling';
  // Check relationships[] (v2)
  const rel=getRel(you, p)||getRel(p, you);
  if(rel){
    const lbl=rel.label||'';
    if(SIBLING_LABELS.has(lbl)) return 'sibling';
    if(['Grandfather','Grandmother','Grandparent','Great-grandfather','Great-grandmother','Great-grandparent'].includes(lbl)) return 'grandparent';
    return 'extended';
  }
  // Legacy customLinks fallback
  const ycl=you.customLinks&&you.customLinks[p.id];
  if(ycl){ const lt=typeof ycl==='string'?'labeled':ycl.lineType; if(lt==='sibling') return 'sibling'; return 'extended'; }
  const pcl=p.customLinks&&p.customLinks[you.id];
  if(pcl) return 'extended';
  // Structural grandparent check
  const grandIds=new Set();
  (you.parents||[]).forEach(pid=>{ const par=peopleById[pid]; if(par)(par.parents||[]).forEach(gid=>grandIds.add(gid)); });
  if(grandIds.has(p.id)) return 'grandparent';
  return 'default';
}

const DEFAULT_LINE_COLORS = {
  parentChild: '#64b464',
  spouse:      '#648cdc',
  sibling:     '#dc8c3c',
  labeled:     '#a064dc',
  inlaw:       '#dc6488',
};
let lineColors = {...DEFAULT_LINE_COLORS};

function hexToRgb(hex){
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return [r,g,b];
}
function getBranchRgba(key, o){
  const [r,g,b]=hexToRgb(lineColors[key]||DEFAULT_LINE_COLORS[key]);
  return `rgba(${r},${g},${b},${o})`;
}

// BLOOD_LABELS moved to constants.js

function drawBranches(){
  const bG=document.getElementById('bG');
  const simple=treeMode==='simple';
  // Mode flags: what to show
  const showBlood=treeMode!=='bonds';      // parent-child, sibling, extended blood
  const showNonBlood=treeMode!=='bloodline'; // spouse, in-law, non-blood labeled
  const showExtended=treeMode==='complex'||treeMode==='bloodline'||treeMode==='bonds'; // extended connections

  // ── Parent-child lines (BLOOD: solid, bold) ──
  const isTraditional=layoutMode==='traditional';
  if(showBlood) people.forEach(child=>{
    (child.parents||[]).forEach(pid=>{
      const par=peopleById[pid]; if(!par) return;
      const dy=par.y-child.y;
      const {w,o}=getBranchStyle(dy);
      let d;
      if(isTraditional){
        // Straight angular: vertical from parent down to midpoint, horizontal, vertical down to child
        const midY=(par.y+child.y)/2;
        d=`M ${par.x} ${par.y} L ${par.x} ${midY} L ${child.x} ${midY} L ${child.x} ${child.y}`;
      } else {
        const ox=deterministicOffset(pid,child.id);
        const r=Math.abs(dy)*.3;
        d=`M ${par.x} ${par.y} C ${par.x+ox*.3} ${par.y+r} ${child.x+ox*.2} ${child.y-r} ${child.x} ${child.y}`;
      }
      const path=createSvgElement('path');
      path.setAttribute('d',d);
      path.setAttribute('stroke', getBranchRgba('parentChild', o));
      path.setAttribute('stroke-width',String(isTraditional?2:w));
      path.setAttribute('fill','none');
      path.setAttribute('stroke-linecap','round');
      path.setAttribute('class','br');
      path.dataset.src=pid; path.dataset.dst=child.id;
      bG.appendChild(path);
    });
  });

  // ── Spouse lines (NON-BLOOD: dashed) ──
  const spouseDrawn=new Set();
  if(showNonBlood){
    // Draw from spouseOf property
    people.forEach(p=>{
      if(!p.spouseOf) return;
      const key=[p.id,p.spouseOf].sort().join('|');
      if(spouseDrawn.has(key)) return;
      spouseDrawn.add(key);
      const sp=peopleById[p.spouseOf]; if(!sp) return;
      const path=createSvgElement('path');
      path.setAttribute('d',`M ${p.x} ${p.y} L ${sp.x} ${sp.y}`);
      path.setAttribute('stroke', getBranchRgba('spouse', .55));
      path.setAttribute('stroke-width','2.5');
      path.setAttribute('stroke-dasharray','8,5');
      path.setAttribute('fill','none');
      path.setAttribute('class','br');
      path.dataset.src=p.id; path.dataset.dst=sp.id;
      bG.appendChild(path);
    });
    // Also draw from customLinks with spouse-type labels (Husband/Wife/Partner)
    people.forEach(p=>{
      Object.entries(p.customLinks||{}).forEach(([tid,v])=>{
        const lbl=typeof v==='string'?v:v.label||'';
        if(!SPOUSE_SET.has(lbl)) return;
        const key=[p.id,tid].sort().join('|');
        if(spouseDrawn.has(key)) return;
        spouseDrawn.add(key);
        const sp=peopleById[tid]; if(!sp) return;
        // Also fix the data: set spouseOf if missing
        if(!p.spouseOf) p.spouseOf=tid;
        if(!sp.spouseOf) sp.spouseOf=p.id;
        const path=createSvgElement('path');
        path.setAttribute('d',`M ${p.x} ${p.y} L ${sp.x} ${sp.y}`);
        path.setAttribute('stroke', getBranchRgba('spouse', .55));
        path.setAttribute('stroke-width','2.5');
        path.setAttribute('stroke-dasharray','8,5');
        path.setAttribute('fill','none');
        path.setAttribute('class','br');
        path.dataset.src=p.id; path.dataset.dst=tid;
        bG.appendChild(path);
      });
    });
  }

  // ── Relationship lines from relationships[] (v2 engine) ──
  const relDrawn=new Set();
  people.forEach(p=>{
    (p.relationships||[]).forEach(rel=>{
      const key=[p.id,rel.targetId].sort().join('|');
      if(relDrawn.has(key)) return;
      relDrawn.add(key);
      const other=peopleById[rel.targetId]; if(!other) return;
      let cat=rel.category||getRelCategory(rel.label);
      let isSib=SIBLING_LABELS.has(rel.label);

      // Structural validation: if labeled as sibling, verify they share a parent
      // If they don't, one is likely a spouse who was incorrectly assigned "Sister"
      if(isSib){
        const pA=new Set(p.parents||[]);
        const sharesParent=pA.size>0 && (other.parents||[]).some(pid=>pA.has(pid));
        if(!sharesParent){
          // Check if one is married to the other's actual sibling
          const pSpId=p.spouseOf;
          const oSpId=other.spouseOf;
          const pSpIsOSib=pSpId && (other.parents||[]).some(pid=>(peopleById[pSpId]?.parents||[]).includes(pid));
          const oSpIsPSib=oSpId && (p.parents||[]).some(pid=>(peopleById[oSpId]?.parents||[]).includes(pid));
          if(pSpIsOSib||oSpIsPSib){
            isSib=false;
            cat='bond';
          }
        }
      }

      // View mode filtering
      if(isSib && !showBlood) return;                    // siblings are blood
      if(cat==='blood' && !showBlood) return;            // blood connections
      if(cat==='bond' && !showNonBlood) return;          // bonds/in-laws
      if(cat==='custom' && !showNonBlood) return;        // custom connections
      if(!isSib && cat==='blood' && !showExtended) return; // extended blood only in extended views
      if(cat!=='blood' && !showExtended) return;          // bonds/custom only in extended views

      const mx=(p.x+other.x)/2, my=(p.y+other.y)/2-(isSib?22:cat==='blood'?22:30);
      const path=createSvgElement('path');
      if(isTraditional){
        // Straight angular line for Traditional
        const midY=(p.y+other.y)/2;
        path.setAttribute('d',`M ${p.x} ${p.y} L ${p.x} ${midY} L ${other.x} ${midY} L ${other.x} ${other.y}`);
      } else {
        path.setAttribute('d',`M ${p.x} ${p.y} Q ${mx} ${my} ${other.x} ${other.y}`);
      }

      if(isSib){
        // Sibling: solid orange
        path.setAttribute('stroke', getBranchRgba('sibling',.72));
        path.setAttribute('stroke-width','3.5');
      } else if(cat==='blood'){
        // Extended Roots: solid purple
        path.setAttribute('stroke', getBranchRgba('labeled',.72));
        path.setAttribute('stroke-width','3');
      } else if(cat==='bond'){
        // Extended Bonds: dashed pink
        path.setAttribute('stroke', getBranchRgba('inlaw',.68));
        path.setAttribute('stroke-width','2.5');
        path.setAttribute('stroke-dasharray','8,4');
      } else {
        // Custom/Bonds: dashed purple
        path.setAttribute('stroke', getBranchRgba('labeled',.68));
        path.setAttribute('stroke-width','2');
        path.setAttribute('stroke-dasharray','7,5');
      }
      path.setAttribute('fill','none');
      path.setAttribute('stroke-linecap','round');
      path.setAttribute('class','br');
      path.dataset.src=p.id; path.dataset.dst=rel.targetId;
      bG.appendChild(path);
    });
  });
  // Auto-detected siblings removed — v2 engine stores all sibling relationships
  // in relationships[] which are drawn by the renderer above.

  // ── Extended sections: only for All Twygs, Roots, Bonds ──
  // (Already handled by relationships[] reader above — the view mode filtering
  // in the reader handles showExtended. This return only gates auto-detected siblings.)
  // Note: auto-detected siblings always draw (showBlood handles their gating)
}
function drawNodes(){
  const nG=document.getElementById('nG');
  const defs=document.getElementById('defs-clips');
  people.forEach(p=>{
    const R=getNodeRadius(p), GR=getGlowRadius(p), c=getNodeColor(p);
    const delay=((p.x*.04+p.y*.02)%3.5).toFixed(2);

    if(p.photo){
      const cp=createSvgElement('clipPath'); cp.setAttribute('id',`cp-${p.id}`);
      const ci=createSvgElement('circle'); ci.setAttribute('r',String(R)); cp.appendChild(ci);
      defs.appendChild(cp);
    }

    const G=createSvgElement('g');
    G.setAttribute('class','nd');
    G.setAttribute('transform',`translate(${p.x},${p.y})`);
    G.dataset.id=p.id;

    // Extra wide glow for isYou
    if(p.isYou){
      const outerGlow=createSvgElement('circle');
      outerGlow.setAttribute('r',String(GR+16));
      outerGlow.setAttribute('fill',c);
      outerGlow.setAttribute('fill-opacity','.06');
      outerGlow.setAttribute('filter',`url(#${getGlowFilter(p)})`);
      G.appendChild(outerGlow);
    }

    // Connection count → pulse intensity
    const cc=getConnectionCount(p);
    // Scale opacity with connections (more = brighter glow)
    const baseOp=Math.min(0.45, 0.18 + cc*0.04);

    // Pulsing halo — standard for all nodes
    const halo=createSvgElement('circle');
    halo.setAttribute('r',String(GR));
    halo.setAttribute('fill',c);
    halo.setAttribute('fill-opacity',String(baseOp.toFixed(2)));
    halo.setAttribute('filter',`url(#${getGlowFilter(p)})`);
    halo.setAttribute('class',`gp hi ${getGlowClass(p)}`);
    halo.style.animationDelay=`-${delay}s`;

    // Soft inner ring — brighter for highly-connected nodes
    const ring=createSvgElement('circle');
    ring.setAttribute('r',String(R+4));
    ring.setAttribute('fill',c);
    ring.setAttribute('fill-opacity',String(Math.min(0.5, 0.22+cc*0.04).toFixed(2)));

    // Core
    const core=createSvgElement('circle');
    core.setAttribute('r',String(R));
    core.setAttribute('fill',p.photo?'rgba(0,0,0,.35)':c);
    core.setAttribute('class','core');

    G.append(halo,ring,core);

    // Photo
    if(p.photo){
      const img=createSvgElement('image');
      img.setAttribute('href',p.photo);
      img.setAttribute('x',String(-R)); img.setAttribute('y',String(-R));
      img.setAttribute('width',String(R*2)); img.setAttribute('height',String(R*2));
      img.setAttribute('clip-path',`url(#cp-${p.id})`);
      img.setAttribute('preserveAspectRatio','xMidYMid slice');
      img.setAttribute('class','core');
      G.appendChild(img);
    }

    // Label
    const lbl=createSvgElement('text');
    lbl.textContent=p.isYou?'You':(p.firstName||fullName(p).split(' ')[0]);
    lbl.setAttribute('class',`nlbl${p.isYou?' you':''}`);
    lbl.setAttribute('text-anchor','middle');
    lbl.setAttribute('y',String(R+15));
    G.appendChild(lbl);

    // Bridge node indicator — gold dashed ring
    const bridge=getBridgeInfo(p.id);
    if(bridge){
      const bRing=createSvgElement('circle');
      bRing.setAttribute('r',String(R+8));
      bRing.setAttribute('fill','none');
      bRing.setAttribute('stroke','rgba(200,168,75,0.5)');
      bRing.setAttribute('stroke-width','1.5');
      bRing.setAttribute('stroke-dasharray','4,3');
      bRing.setAttribute('class','bridge-ring');
      G.appendChild(bRing);
    }

    // Adopted node indicator — double ring with spinning outer
    if(p._adopted){
      const outerA=createSvgElement('circle');
      outerA.setAttribute('r',String(R+10));
      outerA.setAttribute('fill','none');
      outerA.setAttribute('stroke','rgba(200,168,75,0.6)');
      outerA.setAttribute('stroke-width','2');
      outerA.setAttribute('stroke-dasharray','6,4');
      outerA.setAttribute('class','adopted-ring');
      G.appendChild(outerA);
      const innerA=createSvgElement('circle');
      innerA.setAttribute('r',String(R+6));
      innerA.setAttribute('fill','none');
      innerA.setAttribute('stroke','rgba(200,168,75,0.35)');
      innerA.setAttribute('stroke-width','1.5');
      G.appendChild(innerA);
    }

    // Managed account indicator — green dashed ring (same style as bridge ring)
    if(typeof managedAccounts!=='undefined'){
      const ma=managedAccounts.find(a=>a.childNodeId===p.id);
      if(ma){
        const tierStroke={seedling:'rgba(100,180,100,0.5)',sprouted:'rgba(200,168,75,0.5)',full:'rgba(120,160,220,0.5)'}[ma.tier]||'rgba(100,180,100,0.5)';
        const mRing=createSvgElement('circle');
        mRing.setAttribute('r',String(R+8));
        mRing.setAttribute('fill','none');
        mRing.setAttribute('stroke',tierStroke);
        mRing.setAttribute('stroke-width','1.5');
        mRing.setAttribute('stroke-dasharray','4,3');
        mRing.setAttribute('class','managed-ring');
        G.appendChild(mRing);
      }
    }

    // Events
    G.addEventListener('mousedown',e=>onNodeMouseDown(e,p.id));
    G.addEventListener('touchstart',e=>onNodeTouchStart(e,p.id),{passive:true});
    G.addEventListener('mouseenter',e=>showTooltip(e,p));
    G.addEventListener('mouseleave',hideTooltip);
    nG.appendChild(G);
  });

  // ── Draw shared nodes (from linked users) — ghost/faded style ──
  if(sharedNodes.length){
    // Calculate offset: position shared nodes relative to our bridge node
    sharedNodes.forEach(sn=>{
      const link=activeLinks.find(l=>l.id===sn._linkId);
      if(!link) return;
      const myBridgeId=link.userA===currentUser.uid?link.bridgeNodeIdA:link.bridgeNodeIdB;
      const myBridge=peopleById[myBridgeId];
      if(!myBridge) return;

      // Position shared nodes offset from bridge
      const ox=myBridge.x+(sn.x||0)*0.6-300;
      const oy=myBridge.y+(sn.y||0)*0.6-200;

      const R=18; // smaller than normal nodes
      const c='rgba(200,168,75,0.4)';

      const G=createSvgElement('g');
      G.setAttribute('class','nd shared-node');
      G.setAttribute('transform',`translate(${ox},${oy})`);
      G.setAttribute('opacity','0.5');

      // Dashed circle
      const ring=createSvgElement('circle');
      ring.setAttribute('r',String(R));
      ring.setAttribute('fill','rgba(200,168,75,0.06)');
      ring.setAttribute('stroke','rgba(200,168,75,0.25)');
      ring.setAttribute('stroke-width','1.5');
      ring.setAttribute('stroke-dasharray','3,2');
      G.appendChild(ring);

      // Photo or initials
      if(sn.photo){
        const clipId=`cp-shared-${sn.id}`;
        const cp=createSvgElement('clipPath');cp.setAttribute('id',clipId);
        const ci=createSvgElement('circle');ci.setAttribute('r',String(R));cp.appendChild(ci);
        defs.appendChild(cp);
        const img=createSvgElement('image');
        img.setAttribute('href',sn.photo);
        img.setAttribute('x',String(-R));img.setAttribute('y',String(-R));
        img.setAttribute('width',String(R*2));img.setAttribute('height',String(R*2));
        img.setAttribute('clip-path',`url(#${clipId})`);
        img.setAttribute('preserveAspectRatio','xMidYMid slice');
        img.setAttribute('opacity','0.6');
        G.appendChild(img);
      } else {
        const txt=createSvgElement('text');
        txt.textContent=(sn.firstName||sn.name||'?').charAt(0).toUpperCase();
        txt.setAttribute('text-anchor','middle');txt.setAttribute('dominant-baseline','central');
        txt.setAttribute('fill','rgba(200,168,75,0.5)');txt.setAttribute('font-size','11');
        txt.setAttribute('font-weight','600');txt.setAttribute('font-family','Outfit, sans-serif');
        G.appendChild(txt);
      }

      // Label
      const lbl=createSvgElement('text');
      lbl.textContent=sn.firstName||sn.name||'?';
      lbl.setAttribute('text-anchor','middle');lbl.setAttribute('y',String(R+12));
      lbl.setAttribute('fill','rgba(200,168,75,0.35)');lbl.setAttribute('font-size','9');
      lbl.setAttribute('font-family','Outfit, sans-serif');
      G.appendChild(lbl);

      // Tooltip on hover
      G.addEventListener('mouseenter',e=>{
        const tip=document.getElementById('tip');
        if(tip){
          tip.textContent=`${sn.name||sn.firstName} · From ${sn._sharedByName}'s tree`;
          tip.style.left=(e.clientX+12)+'px';tip.style.top=(e.clientY-24)+'px';
          tip.classList.add('show');
        }
      });
      G.addEventListener('mouseleave',hideTooltip);
      // Click shared node — show styled popup card
      G.addEventListener('click',()=>{
        const nm=sn.name||sn.firstName||'Unknown';
        const by=sn.dob?.year||sn.birth||'';
        const dy=sn.dod?.year||sn.death||'';
        const story=(sn.note&&!sn.note.includes('Tap Edit'))?sn.note:'';
        const ini=(nm.split(' ').map(w=>w[0]).join('').slice(0,2)).toUpperCase();
        const photoHtml=sn.photo
          ?`<div style="width:60px;height:60px;border-radius:50%;overflow:hidden;margin:0 auto 10px;border:2px solid rgba(200,168,75,.3)"><img src="${sn.photo}" style="width:100%;height:100%;object-fit:cover"/></div>`
          :`<div style="width:60px;height:60px;border-radius:50%;background:rgba(200,168,75,.15);margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:600;color:var(--gold)">${ini}</div>`;
        let dateStr='';
        if(by) dateStr=`Born ${by}`;
        if(dy) dateStr+=` · Died ${dy}`;
        const modal=document.getElementById('link-modal-content');
        modal.innerHTML=`
          ${photoHtml}
          <div style="font-family:'Cormorant Garamond',serif;font-size:1.3rem;font-weight:600;color:var(--text);text-align:center">${nm}</div>
          ${sn.relLabel?`<div style="font-size:.68rem;color:rgba(200,168,75,.4);text-align:center;margin-top:2px;font-style:italic">${sn.relLabel} in ${sn._sharedByName}'s tree</div>`:''}
          ${dateStr?`<div style="font-size:.72rem;color:var(--muted);text-align:center;margin-top:6px">${dateStr}</div>`:''}
          ${story?`<div style="font-size:.75rem;color:rgba(255,255,255,.35);font-style:italic;text-align:center;margin-top:10px;line-height:1.5">"${story}"</div>`:''}
          <div style="height:16px"></div>
          <button onclick="adoptSharedNode('${sn.id}')" style="width:100%;padding:8px;background:rgba(200,168,75,.1);border:1px solid rgba(200,168,75,.25);border-radius:100px;color:var(--gold);font-family:'Outfit',sans-serif;font-size:.78rem;cursor:pointer;margin-bottom:8px">Adopt to My Tree</button>
          <button onclick="closeLinkModal()" style="width:100%;padding:8px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:100px;color:var(--muted);font-family:'Outfit',sans-serif;font-size:.76rem;cursor:pointer">Close</button>
        `;
        document.getElementById('link-bg').classList.add('open');
      });

      nG.appendChild(G);

      // Draw connection lines from shared node to parents and spouse
      const bG=document.getElementById('bG');
      const drawSharedLine=(targetX,targetY,color)=>{
        const path=createSvgElement('path');
        path.setAttribute('d',`M ${ox} ${oy} L ${targetX} ${targetY}`);
        path.setAttribute('stroke',color||'rgba(200,168,75,0.15)');
        path.setAttribute('stroke-width','1.5');
        path.setAttribute('stroke-dasharray','4,3');
        path.setAttribute('fill','none');
        bG.appendChild(path);
      };

      // Parent connections
      (sn.parents||[]).forEach(pid=>{
        let parent=peopleById[pid];
        if(parent){drawSharedLine(parent.x,parent.y,'rgba(100,180,100,0.2)');return}
        const sp=sharedNodes.find(s=>s.id===pid);
        if(!sp) return;
        const spLink=activeLinks.find(l=>l.id===sp._linkId);
        const spBridge=spLink?peopleById[spLink.userA===currentUser.uid?spLink.bridgeNodeIdA:spLink.bridgeNodeIdB]:null;
        if(!spBridge) return;
        drawSharedLine(spBridge.x+(sp.x||0)*0.6-300, spBridge.y+(sp.y||0)*0.6-200);
      });

      // Spouse connection
      if(sn.spouseOf){
        const spouse=peopleById[sn.spouseOf];
        if(spouse){drawSharedLine(spouse.x,spouse.y,'rgba(100,140,220,0.2)')}
        else{
          const sp=sharedNodes.find(s=>s.id===sn.spouseOf);
          if(sp){
            const spLink=activeLinks.find(l=>l.id===sp._linkId);
            const spBridge=spLink?peopleById[spLink.userA===currentUser.uid?spLink.bridgeNodeIdA:spLink.bridgeNodeIdB]:null;
            if(spBridge) drawSharedLine(spBridge.x+(sp.x||0)*0.6-300, spBridge.y+(sp.y||0)*0.6-200,'rgba(100,140,220,0.2)');
          }
        }
      }
    });
  }
}


// ─── LEAF ENGINE INTEGRATION ─────────────────────────────────────────────────
let leafEngine=null;
let leafSvgElements=new Map(); // leafId → {group, lines:[]}

function initLeafEngine(){
  if(leafEngine){ leafEngine.stop(); }
  leafEngine=new OrbEngine({
    repulsionRadius: 60,      // wider influence zone for dragged orb
    minimumSeparation: 28,    // meaningful gap between orbs
    springStrength: 0.04,
    damping: 0.75,
    pushStrength: 1.2,        // strong push from dragged orb
    maxVelocity: 12,
    returnBias: 0.03,
    dragInfluenceFalloff: 1.5, // gentler falloff = wider soft push
    onUpdate: updateLeafPositions
  });
  return leafEngine;
}

// Snap position away from twyg nodes AND other leafs on drop
function snapLeafFromNodes(x, y, leafId){
  var NODE_SNAP=60, LEAF_SNAP=30;
  var origX=x, origY=y, MAX_DRIFT=150;

  // Phase 1: iterative push away from overlaps
  for(var pass=0;pass<6;pass++){
    var moved=false;
    people.forEach(function(p){
      var dx=x-p.x, dy=y-p.y;
      var dist=Math.sqrt(dx*dx+dy*dy)||0.1;
      if(dist<NODE_SNAP){
        var push=(NODE_SNAP-dist)*0.7;
        x+=dx/dist*push; y+=dy/dist*push;
        moved=true;
      }
    });
    if(leafEngine){
      leafEngine.getAllOrbs().forEach(function(orb){
        if(orb.id===leafId) return;
        var dx=x-orb.x, dy=y-orb.y;
        var dist=Math.sqrt(dx*dx+dy*dy)||0.1;
        if(dist<LEAF_SNAP){
          var push=(LEAF_SNAP-dist)*0.6;
          x+=dx/dist*push; y+=dy/dist*push;
          moved=true;
        }
      });
    }
    if(!moved) break;
  }

  // Phase 2: verify no overlaps remain — if still overlapping, find clear angle
  var stillBlocked=false;
  people.forEach(function(p){
    var d=Math.sqrt((x-p.x)*(x-p.x)+(y-p.y)*(y-p.y));
    if(d<NODE_SNAP*0.8) stillBlocked=true;
  });
  if(stillBlocked){
    // Find the primary twyg and orbit to a clear angle
    var bestX=x, bestY=y, bestScore=-1;
    var primary=null;
    leafs.forEach(function(l){ if(l.id===leafId){ primary=peopleById[(l.twygs||[])[0]]; }});
    if(!primary) primary=people[0];
    if(primary){
      for(var angle=0;angle<Math.PI*2;angle+=Math.PI/12){
        var tx=primary.x+Math.cos(angle)*NODE_SNAP*1.2;
        var ty=primary.y+Math.sin(angle)*NODE_SNAP*1.2;
        var minD=9999;
        people.forEach(function(p){
          var d=Math.sqrt((tx-p.x)*(tx-p.x)+(ty-p.y)*(ty-p.y));
          if(d<minD) minD=d;
        });
        if(leafEngine) leafEngine.getAllOrbs().forEach(function(orb){
          if(orb.id===leafId) return;
          var d=Math.sqrt((tx-orb.x)*(tx-orb.x)+(ty-orb.y)*(ty-orb.y));
          if(d<minD) minD=d;
        });
        if(minD>bestScore){ bestScore=minD; bestX=tx; bestY=ty; }
      }
      x=bestX; y=bestY;
    }
  }

  // Cap total displacement
  var driftDx=x-origX, driftDy=y-origY;
  var driftDist=Math.sqrt(driftDx*driftDx+driftDy*driftDy);
  if(driftDist>MAX_DRIFT){
    x=origX+driftDx/driftDist*MAX_DRIFT;
    y=origY+driftDy/driftDist*MAX_DRIFT;
  }

  return {x:x, y:y};
}

function drawLeafs(){
  if(!leafs||!leafs.length) return;
  const lG=document.getElementById('lG');
  const LEAF_R=8;
  const NODE_MIN_DIST=45;

  const engine=initLeafEngine();
  leafSvgElements.clear();

  // Register all twyg nodes as static obstacles
  people.forEach(function(p){
    engine.addObstacle(p.x, p.y, 50); // 50px radius keeps leafs clear of node glows
  });

  leafs.forEach(l=>{
    const twygs=(l.twygs||[]).map(tid=>peopleById[tid]).filter(Boolean);
    if(!twygs.length) return;

    // Calculate home position
    const pos=getLeafPosition(l);
    let hx=pos.x, hy=pos.y;

    // Push home away from nodes (static, one-time)
    for(let pass=0;pass<3;pass++){
      people.forEach(p=>{
        const dx=hx-p.x, dy=hy-p.y;
        const dist=Math.sqrt(dx*dx+dy*dy)||0.1;
        if(dist<NODE_MIN_DIST){
          hx+=dx/dist*(NODE_MIN_DIST-dist);
          hy+=dy/dist*(NODE_MIN_DIST-dist);
        }
      });
    }

    // Register orb in engine
    engine.addOrb({id:l.id, x:hx, y:hy, radius:LEAF_R+4});

    // Create SVG group
    const G=createSvgElement('g');
    G.setAttribute('transform','translate('+hx+','+hy+')');
    G.setAttribute('class','nd leaf-nd');
    G.style.cursor='pointer';

    // Drag handlers → engine
    G.addEventListener('mousedown',function(e){
      e.stopPropagation();
      var orb=engine.getOrb(l.id);
      engine.dragStart(l.id);
      leafDragActive=l.id;
      leafDragStartX=e.clientX; leafDragStartY=e.clientY;
      leafDragOrigX=orb?orb.x:hx; leafDragOrigY=orb?orb.y:hy;
      leafDragMoved=false;
    });
    G.addEventListener('touchstart',function(e){
      if(e.touches.length!==1) return;
      e.stopPropagation();
      var orb=engine.getOrb(l.id);
      engine.dragStart(l.id);
      leafDragActive=l.id;
      leafDragStartX=e.touches[0].clientX; leafDragStartY=e.touches[0].clientY;
      leafDragOrigX=orb?orb.x:hx; leafDragOrigY=orb?orb.y:hy;
      leafDragMoved=false;
    },{passive:true});

    // Brightness scales with tag count: more tags = brighter
    // t = 0→0, 1→0.17, 3→0.38, 5→0.5, 10→0.67, 50→0.91, 100→0.95
    var tagCount=(l.twygs||[]).length;
    var t=tagCount/(tagCount+5);
    var glowOp=(0.05+t*0.25).toFixed(3);   // 0.05 → 0.30
    var dotOp=(0.15+t*0.45).toFixed(3);     // 0.15 → 0.60
    var strokeOp=(0.25+t*0.50).toFixed(3);  // 0.25 → 0.75
    var labelOp=(0.40+t*0.40).toFixed(3);   // 0.40 → 0.80
    var lineOp=(0.10+t*0.25).toFixed(3);    // 0.10 → 0.35
    var glowR=LEAF_R*(2.0+t*2.0);           // 16 → 32

    // Glow
    var glow=createSvgElement('circle');
    glow.setAttribute('r',String(glowR));
    glow.setAttribute('fill','rgba(100,180,100,'+glowOp+')');
    G.appendChild(glow);

    // Dot
    var dot=createSvgElement('circle');
    dot.setAttribute('r',String(LEAF_R));
    dot.setAttribute('fill','rgba(100,180,100,'+dotOp+')');
    dot.setAttribute('stroke','rgba(100,180,100,'+strokeOp+')');
    dot.setAttribute('stroke-width','1');
    G.appendChild(dot);

    // Emoji
    var fo=createSvgElement('foreignObject');
    fo.setAttribute('x',String(-LEAF_R));
    fo.setAttribute('y',String(-LEAF_R));
    fo.setAttribute('width',String(LEAF_R*2));
    fo.setAttribute('height',String(LEAF_R*2));
    fo.setAttribute('style','pointer-events:none');
    fo.innerHTML='<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:10px;line-height:1;pointer-events:none">🍃</div>';
    G.appendChild(fo);

    // Title
    var title=(l.title||'').slice(0,20);
    if(title){
      var label=createSvgElement('text');
      label.setAttribute('y',String(LEAF_R+12));
      label.setAttribute('text-anchor','middle');
      label.setAttribute('font-family','Outfit, sans-serif');
      label.setAttribute('font-size','8');
      label.setAttribute('fill','rgba(100,180,100,'+labelOp+')');
      label.setAttribute('style','pointer-events:none');
      label.textContent=title;
      G.appendChild(label);
    }

    lG.appendChild(G);

    // Connection lines
    var svgLines=[];
    twygs.forEach(function(t){
      var line=createSvgElement('path');
      line.setAttribute('d','M '+hx+' '+hy+' L '+t.x+' '+t.y);
      line.setAttribute('stroke','rgba(100,180,100,'+lineOp+')');
      line.setAttribute('stroke-width','1');
      line.setAttribute('stroke-dasharray','3,4');
      line.setAttribute('fill','none');
      lG.insertBefore(line, lG.firstChild);
      svgLines.push({el:line, tx:t.x, ty:t.y});
    });

    leafSvgElements.set(l.id, {group:G, lines:svgLines, leafRef:l, homeX:hx, homeY:hy});
  });
}

// Called by engine onUpdate — moves SVG without full re-render
function updateLeafPositions(orbs){
  orbs.forEach(function(orb){
    var el=leafSvgElements.get(orb.id);
    if(!el) return;
    el.group.setAttribute('transform','translate('+orb.x+','+orb.y+')');
    el.lines.forEach(function(ln){
      ln.el.setAttribute('d','M '+orb.x+' '+orb.y+' L '+ln.tx+' '+ln.ty);
    });
  });
}

// ─── LEAF DRAG (engine-driven) ───────────────────────────────────────────────
var leafDragActive=null, leafDragStartX=0, leafDragStartY=0;
var leafDragOrigX=0, leafDragOrigY=0, leafDragMoved=false;

document.addEventListener('mousemove',function(e){
  if(leafDragActive&&leafEngine){
    var dx=e.clientX-leafDragStartX, dy=e.clientY-leafDragStartY;
    if(!leafDragMoved&&Math.hypot(dx,dy)>6) leafDragMoved=true;
    if(leafDragMoved){
      leafEngine.dragMove(leafDragOrigX+dx/scale, leafDragOrigY+dy/scale);
    }
  }
},{capture:true});

document.addEventListener('mouseup',function(){
  if(leafDragActive&&leafEngine){
    if(!leafDragMoved){
      openLeafDetail(leafDragActive);
    } else {
      var orb=leafEngine.getOrb(leafDragActive);
      var el=leafSvgElements.get(leafDragActive);
      if(orb&&el){
        var snapped=snapLeafFromNodes(orb.x, orb.y, leafDragActive);
        el.leafRef.x=snapped.x; el.leafRef.y=snapped.y;
        orb.x=snapped.x; orb.y=snapped.y;
        leafEngine.updateHome(leafDragActive, snapped.x, snapped.y);
        saveLeafs();
      }
    }
    leafEngine.dragEnd();
    leafDragActive=null;
  }
},{capture:true});

document.addEventListener('touchmove',function(e){
  if(leafDragActive&&leafEngine&&e.touches.length===1){
    var dx=e.touches[0].clientX-leafDragStartX, dy=e.touches[0].clientY-leafDragStartY;
    if(!leafDragMoved&&Math.hypot(dx,dy)>8) leafDragMoved=true;
    if(leafDragMoved){
      leafEngine.dragMove(leafDragOrigX+dx/scale, leafDragOrigY+dy/scale);
    }
  }
},{capture:true,passive:true});

document.addEventListener('touchend',function(){
  if(leafDragActive&&leafEngine){
    if(!leafDragMoved) openLeafDetail(leafDragActive);
    else {
      var orb=leafEngine.getOrb(leafDragActive);
      var el=leafSvgElements.get(leafDragActive);
      if(orb&&el){
        var snapped=snapLeafFromNodes(orb.x, orb.y, leafDragActive);
        el.leafRef.x=snapped.x; el.leafRef.y=snapped.y;
        orb.x=snapped.x; orb.y=snapped.y;
        leafEngine.updateHome(leafDragActive, snapped.x, snapped.y);
        saveLeafs();
      }
    }
    leafEngine.dragEnd();
    leafDragActive=null;
  }
},{capture:true});
