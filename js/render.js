/* ═══ render.js ═══ SVG rendering: nodes, branches, glow, layout, visual helpers ═══ */

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
  const you=P.find(p=>p.isYou); if(!you||id===you.id) return '';
  const p=byId[id]; if(!p) return '';
  // Check structural relationships FIRST (these are always correct)
  if((p.parents||[]).includes(you.id)) return genderedRel('Child',p.gender);
  if((you.parents||[]).includes(id)) return genderedRel('Parent',p.gender);
  if(p.spouseOf===you.id||you.spouseOf===id) return genderedRel('Spouse',p.gender);
  // Then check explicit custom links
  const ycl=you.customLinks&&you.customLinks[id];
  if(ycl) return typeof ycl==='string'?ycl:ycl.label;
  const pcl=p.customLinks&&p.customLinks[you.id];
  if(pcl) return typeof pcl==='string'?pcl:pcl.label;
  // Use stored relLabel — already specific ('Sister','Brother') just return as-is
  if(p.relLabel){
    // If it's already a specific label (not generic), return directly
    const specific=['Father','Mother','Son','Daughter','Brother','Sister','Husband','Wife','Partner',
      'Grandfather','Grandmother','Grandson','Granddaughter','Uncle','Aunt','Nephew','Niece','Cousin',
      'Father-in-law','Mother-in-law','Brother-in-law','Sister-in-law','Godfather','Godmother',
      'Stepfather','Stepmother','Stepson','Stepdaughter','Half-brother','Half-sister'];
    if(specific.includes(p.relLabel)) return p.relLabel;
    return genderedRel(p.relLabel,p.gender)||p.relLabel;
  }
  // Infer from tree structure (sibling check)
  const myP=new Set(you.parents||[]);
  if(myP.size&&(p.parents||[]).some(pp=>myP.has(pp))) return genderedRel('Sibling',p.gender);
  const grandIds=new Set();
  (you.parents||[]).forEach(pid=>{ const par=byId[pid]; if(par)(par.parents||[]).forEach(gid=>grandIds.add(gid)); });
  if(grandIds.has(id)) return genderedRel('Grandparent',p.gender);
  const myChildren=P.filter(x=>(x.parents||[]).includes(you.id));
  for(const c of myChildren){ if((p.parents||[]).includes(c.id)) return genderedRel('Grandchild',p.gender); }
  // Infer in-law: parent of spouse's parent
  const spouseId=you.spouseOf||(P.find(x=>x.spouseOf===you.id)||{}).id;
  if(spouseId){
    const sp=byId[spouseId];
    if(sp){
      if((sp.parents||[]).includes(id)) return genderedRel('Parent',p.gender)+'-in-law';
      const spSibs=P.filter(x=>x.id!==spouseId&&(x.parents||[]).some(pp=>(sp.parents||[]).includes(pp)));
      if(spSibs.some(s=>s.id===id)) return genderedRel('Sibling',p.gender)+'-in-law';
    }
  }
  return '';
}

const NS='http://www.w3.org/2000/svg';
function se(t){ return document.createElementNS(NS,t); }

// ─── RENDER ───────────────────────────────────────────────────────────────────
function render(){
  document.getElementById('bG').innerHTML='';
  setTimeout(()=>{ syncLegend(); syncNodeLegend(); },0);
  document.getElementById('nG').innerHTML='';
  document.getElementById('defs-clips').innerHTML='';
  drawBranches();
  drawNodes();
}

function bstyle(dy){
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
  deceased:    '#6b9ec2',
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
  const you=byId&&Object.values(byId).find(x=>x.isYou);
  if(!you) return 'default';
  if((p.parents||[]).includes(you.id)) return 'child';
  if((you.parents||[]).includes(p.id)) return 'parent';
  if(p.spouseOf===you.id||you.spouseOf===p.id) return 'spouse';
  const myP=new Set(you.parents||[]);
  if(myP.size&&(p.parents||[]).some(pp=>myP.has(pp))) return 'sibling';
  const ycl=you.customLinks&&you.customLinks[p.id];
  if(ycl){ const lt=typeof ycl==='string'?'labeled':ycl.lineType; if(lt==='sibling') return 'sibling'; return 'extended'; }
  const pcl=p.customLinks&&p.customLinks[you.id];
  if(pcl) return 'extended';
  const grandIds=new Set();
  (you.parents||[]).forEach(pid=>{ const par=byId[pid]; if(par)(par.parents||[]).forEach(gid=>grandIds.add(gid)); });
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

function hexToAlpha(hex, a){
  const [r,g,b]=hexToRgb(hex); return `rgba(${r},${g},${b},${a})`;
}
function hexToRgb(hex){
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return [r,g,b];
}
function brRgba(key, o){
  const [r,g,b]=hexToRgb(lineColors[key]||DEFAULT_LINE_COLORS[key]);
  return `rgba(${r},${g},${b},${o})`;
}

const BLOOD_LABELS=new Set([
  // Direct line — ascending
  'Father','Mother','Parent','Stepfather','Stepmother','Stepparent',
  'Grandfather','Grandmother','Grandparent',
  'Great-grandfather','Great-grandmother','Great-grandparent',
  'Great-great-grandfather','Great-great-grandmother','Great-great-grandparent',
  // Direct line — descending
  'Son','Daughter','Child','Stepson','Stepdaughter','Stepchild',
  'Grandson','Granddaughter','Grandchild',
  'Great-grandson','Great-granddaughter','Great-grandchild',
  'Great-great-grandson','Great-great-granddaughter','Great-great-grandchild',
  // Siblings
  'Brother','Sister','Sibling','Half-brother','Half-sister','Stepbrother','Stepsister',
  // Aunts/Uncles
  'Uncle','Aunt',
  'Great-uncle','Great-aunt',
  'Great-grand-uncle','Great-grand-aunt',
  // Nephews/Nieces
  'Nephew','Niece',
  'Grand-nephew','Grand-niece',
  'Great-grand-nephew','Great-grand-niece',
  // In-laws (connected by marriage)
  'Father-in-law','Mother-in-law','Parent-in-law',
  'Son-in-law','Daughter-in-law','Child-in-law',
  'Brother-in-law','Sister-in-law','Sibling-in-law',
  // Godparents
  'Godfather','Godmother',
  // Cousins (all degrees and removes — blood by consanguinity)
  'Cousin','First Cousin',
  'First Cousin Once Removed','First Cousin Twice Removed','First Cousin Thrice Removed',
  'Second Cousin',
  'Second Cousin Once Removed','Second Cousin Twice Removed','Second Cousin Thrice Removed',
  'Third Cousin',
  'Third Cousin Once Removed','Third Cousin Twice Removed','Third Cousin Thrice Removed',
]);

function drawBranches(){
  const bG=document.getElementById('bG');
  const simple=treeMode==='simple';

  // ── Parent-child lines (BLOOD: solid, bold) ──
  P.forEach(child=>{
    (child.parents||[]).forEach(pid=>{
      const par=byId[pid]; if(!par) return;
      const dy=par.y-child.y;
      const {w,o}=bstyle(dy);
      const ox=orb(pid,child.id);
      const r=Math.abs(dy)*.3;
      const d=`M ${par.x} ${par.y} C ${par.x+ox*.3} ${par.y+r} ${child.x+ox*.2} ${child.y-r} ${child.x} ${child.y}`;
      const path=se('path');
      path.setAttribute('d',d);
      path.setAttribute('stroke', brRgba('parentChild', o));
      path.setAttribute('stroke-width',String(w));
      path.setAttribute('fill','none');
      path.setAttribute('stroke-linecap','round');
      path.setAttribute('class','br');
      path.dataset.src=pid; path.dataset.dst=child.id;
      bG.appendChild(path);
    });
  });

  // ── Spouse lines (NON-BLOOD: dashed) ──
  const spouseDrawn=new Set();
  P.forEach(p=>{
    if(!p.spouseOf) return;
    const key=[p.id,p.spouseOf].sort().join('|');
    if(spouseDrawn.has(key)) return;
    spouseDrawn.add(key);
    const sp=byId[p.spouseOf]; if(!sp) return;
    const path=se('path');
    path.setAttribute('d',`M ${p.x} ${p.y} L ${sp.x} ${sp.y}`);
    path.setAttribute('stroke', brRgba('spouse', .55));
    path.setAttribute('stroke-width','2.5');
    path.setAttribute('stroke-dasharray','8,5');
    path.setAttribute('fill','none');
    path.setAttribute('class','br');
    path.dataset.src=p.id; path.dataset.dst=sp.id;
    bG.appendChild(path);
  });

  // ── Sibling customLinks (solid) — Tree View; Blood extended (solid) + labeled (dashed) — All Twygs ──
  const sibDrawn=new Set();
  P.forEach(p=>{
    Object.entries(p.customLinks||{}).forEach(([tid,v])=>{
      const label=typeof v==='string'?v:v.label||'';
      // ALWAYS derive lineType from current BLOOD_LABELS — never trust stored lineType
      const isSibLabel=['Brother','Sister','Half-brother','Half-sister'].includes(label);
      const isInLaw=label.includes('-in-law');
      const lineType=isSibLabel?'sibling':isInLaw?'inlaw':BLOOD_LABELS.has(label)?'blood':'labeled';
      // Siblings: show in both modes. Blood extended: All Twygs only. In-law/labeled: drawn below
      if(lineType!=='sibling'&&lineType!=='blood') return;
      if(lineType==='blood'&&simple) return;
      const key=[p.id,tid].sort().join('|');
      if(sibDrawn.has(key)) return;
      sibDrawn.add(key);
      const other=byId[tid]; if(!other) return;
      const mx=(p.x+other.x)/2, my=(p.y+other.y)/2-22;
      const isSib=lineType==='sibling';
      const path=se('path');
      path.setAttribute('d',`M ${p.x} ${p.y} Q ${mx} ${my} ${other.x} ${other.y}`);
      // Siblings: sibling color. Other blood (grandparent, aunt, etc): labeled/extended color but SOLID
      path.setAttribute('stroke', isSib ? brRgba('sibling',.72) : brRgba('labeled',.72));
      path.setAttribute('stroke-width',isSib?'3.5':'3');
      path.setAttribute('fill','none'); // NO dash — solid for all blood
      path.setAttribute('stroke-linecap','round');
      path.setAttribute('class','br');
      path.dataset.src=p.id; path.dataset.dst=tid;
      bG.appendChild(path);
    });
  });

  // ── Auto-detected sibling lines (All Twygs only) ──
  if(simple) return; // Tree View ends here — All Twygs continues below

  // ── Auto-detected sibling lines from shared parents (BLOOD: solid bold, All Twygs only) ──
  const autoSibDrawn=new Set();
  P.forEach(p=>{
    const pars=p.parents||[];
    if(!pars.length) return;
    P.filter(x=>x.id!==p.id&&(x.parents||[]).some(pp=>pars.includes(pp))).forEach(sib=>{
      const key=[p.id,sib.id].sort().join('|');
      if(autoSibDrawn.has(key)) return;
      autoSibDrawn.add(key);
      // Skip if already drawn as a customLink sibling
      if(sibDrawn.has(key)) return;
      const mx=(p.x+sib.x)/2, my=(p.y+sib.y)/2-20;
      const path=se('path');
      path.setAttribute('d',`M ${p.x} ${p.y} Q ${mx} ${my} ${sib.x} ${sib.y}`);
      path.setAttribute('stroke', brRgba('sibling', .55));
      path.setAttribute('stroke-width','3');
      path.setAttribute('fill','none');
      path.setAttribute('stroke-linecap','round');
      path.setAttribute('class','br');
      path.dataset.src=p.id; path.dataset.dst=sib.id;
      bG.appendChild(path);
    });
  });

  // ── In-law + non-blood labeled customLinks (dashed, All Twygs only) ──
  const extDrawn=new Set();
  P.forEach(p=>{
    Object.entries(p.customLinks||{}).forEach(([tid,v])=>{
      const label=typeof v==='string'?v:v.label||'';
      const isSibLabel=['Brother','Sister','Half-brother','Half-sister'].includes(label);
      const isInLaw=label.includes('-in-law');
      const lineType=isSibLabel?'sibling':isInLaw?'inlaw':BLOOD_LABELS.has(label)?'blood':'labeled';
      // Skip blood types (drawn above) and siblings
      if(lineType==='sibling'||lineType==='blood') return;
      const key=[p.id,tid].sort().join('|');
      if(extDrawn.has(key)) return;
      extDrawn.add(key);
      const other=byId[tid]; if(!other) return;
      const mx=(p.x+other.x)/2, my=(p.y+other.y)/2-30;
      const path=se('path');
      path.setAttribute('d',`M ${p.x} ${p.y} Q ${mx} ${my} ${other.x} ${other.y}`);
      path.setAttribute('stroke', brRgba(isInLaw?'inlaw':'labeled', .68));
      path.setAttribute('stroke-width',isInLaw?'2.5':'2');
      path.setAttribute('stroke-dasharray',isInLaw?'8,4':'7,5');
      path.setAttribute('fill','none');
      path.setAttribute('class','br');
      path.dataset.src=p.id; path.dataset.dst=tid;
      bG.appendChild(path);
    });
  });
}
function drawNodes(){
  const nG=document.getElementById('nG');
  const defs=document.getElementById('defs-clips');
  P.forEach(p=>{
    const R=nr(p), GR=gr(p), c=col(p);
    const delay=((p.x*.04+p.y*.02)%3.5).toFixed(2);

    if(p.photo){
      const cp=se('clipPath'); cp.setAttribute('id',`cp-${p.id}`);
      const ci=se('circle'); ci.setAttribute('r',String(R)); cp.appendChild(ci);
      defs.appendChild(cp);
    }

    const G=se('g');
    G.setAttribute('class','nd');
    G.setAttribute('transform',`translate(${p.x},${p.y})`);
    G.dataset.id=p.id;

    // Extra wide glow for isYou
    if(p.isYou){
      const outerGlow=se('circle');
      outerGlow.setAttribute('r',String(GR+16));
      outerGlow.setAttribute('fill',c);
      outerGlow.setAttribute('fill-opacity','.06');
      outerGlow.setAttribute('filter',`url(#${gfilt(p)})`);
      G.appendChild(outerGlow);
    }

    // Connection count → pulse intensity
    const cc=connCount(p);
    // Scale opacity with connections (more = brighter glow)
    const baseOp=Math.min(0.45, 0.18 + cc*0.04);

    // Pulsing halo — standard for all nodes
    const halo=se('circle');
    halo.setAttribute('r',String(GR));
    halo.setAttribute('fill',c);
    halo.setAttribute('fill-opacity',String(baseOp.toFixed(2)));
    halo.setAttribute('filter',`url(#${gfilt(p)})`);
    halo.setAttribute('class',`gp hi ${gclass(p)}`);
    halo.style.animationDelay=`-${delay}s`;

    // Soft inner ring — brighter for highly-connected nodes
    const ring=se('circle');
    ring.setAttribute('r',String(R+4));
    ring.setAttribute('fill',c);
    ring.setAttribute('fill-opacity',String(Math.min(0.5, 0.22+cc*0.04).toFixed(2)));

    // Core
    const core=se('circle');
    core.setAttribute('r',String(R));
    core.setAttribute('fill',p.photo?'rgba(0,0,0,.35)':c);
    core.setAttribute('class','core');

    G.append(halo,ring,core);

    // Photo
    if(p.photo){
      const img=se('image');
      img.setAttribute('href',p.photo);
      img.setAttribute('x',String(-R)); img.setAttribute('y',String(-R));
      img.setAttribute('width',String(R*2)); img.setAttribute('height',String(R*2));
      img.setAttribute('clip-path',`url(#cp-${p.id})`);
      img.setAttribute('preserveAspectRatio','xMidYMid slice');
      img.setAttribute('class','core');
      G.appendChild(img);
    }

    // Label
    const lbl=se('text');
    lbl.textContent=p.isYou?'You':(p.firstName||fullName(p).split(' ')[0]);
    lbl.setAttribute('class',`nlbl${p.isYou?' you':''}`);
    lbl.setAttribute('text-anchor','middle');
    lbl.setAttribute('y',String(R+15));
    G.appendChild(lbl);

    // Bridge node indicator — gold dashed ring
    const bridge=getBridgeInfo(p.id);
    if(bridge){
      const bRing=se('circle');
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
      const outerA=se('circle');
      outerA.setAttribute('r',String(R+10));
      outerA.setAttribute('fill','none');
      outerA.setAttribute('stroke','rgba(200,168,75,0.6)');
      outerA.setAttribute('stroke-width','2');
      outerA.setAttribute('stroke-dasharray','6,4');
      outerA.setAttribute('class','adopted-ring');
      G.appendChild(outerA);
      const innerA=se('circle');
      innerA.setAttribute('r',String(R+6));
      innerA.setAttribute('fill','none');
      innerA.setAttribute('stroke','rgba(200,168,75,0.35)');
      innerA.setAttribute('stroke-width','1.5');
      G.appendChild(innerA);
    }

    // Events
    G.addEventListener('mousedown',e=>onNodeMouseDown(e,p.id));
    G.addEventListener('touchstart',e=>onNodeTouchStart(e,p.id),{passive:true});
    G.addEventListener('mouseenter',e=>showTip(e,p));
    G.addEventListener('mouseleave',hideTip);
    nG.appendChild(G);
  });

  // ── Draw shared nodes (from linked users) — ghost/faded style ──
  if(sharedNodes.length){
    // Calculate offset: position shared nodes relative to our bridge node
    sharedNodes.forEach(sn=>{
      const link=activeLinks.find(l=>l.id===sn._linkId);
      if(!link) return;
      const myBridgeId=link.userA===currentUser.uid?link.bridgeNodeIdA:link.bridgeNodeIdB;
      const myBridge=byId[myBridgeId];
      if(!myBridge) return;

      // Position shared nodes offset from bridge
      const ox=myBridge.x+(sn.x||0)*0.6-300;
      const oy=myBridge.y+(sn.y||0)*0.6-200;

      const R=18; // smaller than normal nodes
      const c='rgba(200,168,75,0.4)';

      const G=se('g');
      G.setAttribute('class','nd shared-node');
      G.setAttribute('transform',`translate(${ox},${oy})`);
      G.setAttribute('opacity','0.5');

      // Dashed circle
      const ring=se('circle');
      ring.setAttribute('r',String(R));
      ring.setAttribute('fill','rgba(200,168,75,0.06)');
      ring.setAttribute('stroke','rgba(200,168,75,0.25)');
      ring.setAttribute('stroke-width','1.5');
      ring.setAttribute('stroke-dasharray','3,2');
      G.appendChild(ring);

      // Photo or initials
      if(sn.photo){
        const clipId=`cp-shared-${sn.id}`;
        const cp=se('clipPath');cp.setAttribute('id',clipId);
        const ci=se('circle');ci.setAttribute('r',String(R));cp.appendChild(ci);
        defs.appendChild(cp);
        const img=se('image');
        img.setAttribute('href',sn.photo);
        img.setAttribute('x',String(-R));img.setAttribute('y',String(-R));
        img.setAttribute('width',String(R*2));img.setAttribute('height',String(R*2));
        img.setAttribute('clip-path',`url(#${clipId})`);
        img.setAttribute('preserveAspectRatio','xMidYMid slice');
        img.setAttribute('opacity','0.6');
        G.appendChild(img);
      } else {
        const txt=se('text');
        txt.textContent=(sn.firstName||sn.name||'?').charAt(0).toUpperCase();
        txt.setAttribute('text-anchor','middle');txt.setAttribute('dominant-baseline','central');
        txt.setAttribute('fill','rgba(200,168,75,0.5)');txt.setAttribute('font-size','11');
        txt.setAttribute('font-weight','600');txt.setAttribute('font-family','Outfit, sans-serif');
        G.appendChild(txt);
      }

      // Label
      const lbl=se('text');
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
          tip.style.opacity='1';
        }
      });
      G.addEventListener('mouseleave',hideTip);
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
      const drawSharedLine=(tx,ty,color)=>{
        const path=se('path');
        path.setAttribute('d',`M ${ox} ${oy} L ${tx} ${ty}`);
        path.setAttribute('stroke',color||'rgba(200,168,75,0.15)');
        path.setAttribute('stroke-width','1.5');
        path.setAttribute('stroke-dasharray','4,3');
        path.setAttribute('fill','none');
        bG.appendChild(path);
      };

      // Parent connections
      (sn.parents||[]).forEach(pid=>{
        let parent=byId[pid];
        if(parent){drawSharedLine(parent.x,parent.y,'rgba(100,180,100,0.2)');return}
        const sp=sharedNodes.find(s=>s.id===pid);
        if(!sp) return;
        const spLink=activeLinks.find(l=>l.id===sp._linkId);
        const spBridge=spLink?byId[spLink.userA===currentUser.uid?spLink.bridgeNodeIdA:spLink.bridgeNodeIdB]:null;
        if(!spBridge) return;
        drawSharedLine(spBridge.x+(sp.x||0)*0.6-300, spBridge.y+(sp.y||0)*0.6-200);
      });

      // Spouse connection
      if(sn.spouseOf){
        const spouse=byId[sn.spouseOf];
        if(spouse){drawSharedLine(spouse.x,spouse.y,'rgba(100,140,220,0.2)')}
        else{
          const sp=sharedNodes.find(s=>s.id===sn.spouseOf);
          if(sp){
            const spLink=activeLinks.find(l=>l.id===sp._linkId);
            const spBridge=spLink?byId[spLink.userA===currentUser.uid?spLink.bridgeNodeIdA:spLink.bridgeNodeIdB]:null;
            if(spBridge) drawSharedLine(spBridge.x+(sp.x||0)*0.6-300, spBridge.y+(sp.y||0)*0.6-200,'rgba(100,140,220,0.2)');
          }
        }
      }
    });
  }
}

