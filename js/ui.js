/* ═══ ui.js ═══════════════════════════════════════════════════════════════
 * Node interaction, card display, editing, and connection management.
 *
 * KEY FUNCTIONS:
 *   selectNode(id)        — highlights node, opens card, zooms to it
 *   fillCard(p)           — populates the overlay card with Person data
 *   editCard(id)          — switches card to edit mode with form fields
 *   saveCard(id)          — saves edited fields back to the Person object
 *   removePerson(id)      — deletes a node with cascade/orphan choice
 *   editConnRel()         — inline connection type editing (pencil icon)
 *   removeConnFromCard()  — deletes a specific connection between two nodes
 *   openConnModal(id)     — opens the Add Connection modal for a node
 *   saveConnection()      — saves a new connection between two nodes
 *
 * READS: people[], peopleById{}, selectedNodeId, BLOOD_LABELS
 * ═══════════════════════════════════════════════════════════════════════════ */
// ─── NODE DRAG ────────────────────────────────────────────────────────────────
let nodeDragState=null;

// Node collision avoidance during drag (skip Traditional + Immersive)
function pushNodesFromDragged(draggedId){
  if(layoutMode==='traditional'||layoutMode==='immersive') return;
  const dragged=peopleById[draggedId]; if(!dragged) return;
  const NODE_R=28, PUSH_DIST=NODE_R*3, PASSES=4;
  for(let pass=0;pass<PASSES;pass++){
    people.forEach(p=>{
      if(p.id===draggedId) return;
      const dx=p.x-dragged.x, dy=p.y-dragged.y;
      const dist=Math.sqrt(dx*dx+dy*dy)||0.1;
      if(dist<PUSH_DIST){
        const push=(PUSH_DIST-dist)*0.35;
        const nx=dx/dist, ny=dy/dist;
        p.x+=nx*push; p.y+=ny*push;
      }
    });
    // Also push non-dragged nodes apart from each other
    for(let i=0;i<people.length;i++){
      if(people[i].id===draggedId) continue;
      for(let j=i+1;j<people.length;j++){
        if(people[j].id===draggedId) continue;
        const a=people[i], b=people[j];
        const dx=b.x-a.x, dy=b.y-a.y;
        const dist=Math.sqrt(dx*dx+dy*dy)||0.1;
        const minDist=NODE_R*2.5;
        if(dist<minDist){
          const push=(minDist-dist)/2*0.2;
          const nx=dx/dist, ny=dy/dist;
          a.x-=nx*push; a.y-=ny*push;
          b.x+=nx*push; b.y+=ny*push;
        }
      }
    }
  }
}

function onNodeMouseDown(e,id){
  e.stopPropagation();
  const p=peopleById[id]; if(!p) return;
  nodeDragState={id,startX:e.clientX,startY:e.clientY,origX:p.x,origY:p.y,moved:false};
}

function onNodeTouchStart(e,id){
  if(e.touches.length!==1) return;
  const p=peopleById[id]; if(!p) return;
  nodeDragState={id,startX:e.touches[0].clientX,startY:e.touches[0].clientY,origX:p.x,origY:p.y,moved:false,touch:true};
}

function getLeafPosition(l){
  if(l.x!=null&&l.y!=null) return {x:l.x,y:l.y};
  const primary=peopleById[(l.twygs||[])[0]];
  if(!primary) return {x:0,y:0};
  const hash=(l.id||'').split('').reduce((a,c)=>a+c.charCodeAt(0),0);
  const sibs=leafs.filter(x=>(x.twygs||[])[0]===(l.twygs||[])[0]);
  const idx=sibs.indexOf(l);
  const count=sibs.length||1;
  const angle=((idx/count)*Math.PI*2)+(hash%60)*0.01;
  const dist=45+(hash%15);
  return {x:primary.x+Math.cos(angle)*dist, y:primary.y+Math.sin(angle)*dist};
}

document.addEventListener('mousemove',e=>{
  if(leafDragActive) return; // engine handles leaf drag
  if(nodeDragState){
    const dx=e.clientX-nodeDragState.startX, dy=e.clientY-nodeDragState.startY;
    if(!nodeDragState.moved&&Math.hypot(dx,dy)>6) nodeDragState.moved=true;
    if(nodeDragState.moved){
      hideTooltip();
      const p=peopleById[nodeDragState.id]; if(!p) return;
      p.x=nodeDragState.origX+dx/scale; p.y=nodeDragState.origY+dy/scale;
      pushNodesFromDragged(nodeDragState.id);
      render();
      if(selectedNodeId) highlightConnected(selectedNodeId);
    }
    return;
  }
  if(isDragging){ panX=e.clientX-dragStartX; panY=e.clientY-dragStartY; applyTransform(); }
});

document.addEventListener('mouseup',e=>{
  if(nodeDragState){
    if(!nodeDragState.moved) selectNode(nodeDragState.id);
    else scheduleSave();
    nodeDragState=null; return;
  }
  isDragging=false; document.getElementById('wrap').style.cursor='';
});

document.addEventListener('touchmove',e=>{
  if(leafDragActive) return; // engine handles leaf drag
  if(nodeDragState&&nodeDragState.touch&&e.touches.length===1){
    const dx=e.touches[0].clientX-nodeDragState.startX, dy=e.touches[0].clientY-nodeDragState.startY;
    if(!nodeDragState.moved&&Math.hypot(dx,dy)>8) nodeDragState.moved=true;
    if(nodeDragState.moved){
      const p=peopleById[nodeDragState.id]; if(!p) return;
      p.x=nodeDragState.origX+dx/scale; p.y=nodeDragState.origY+dy/scale;
      pushNodesFromDragged(nodeDragState.id);
      render();
    }
  }
},{passive:true});

document.addEventListener('touchend',()=>{
  if(nodeDragState){
    if(!nodeDragState.moved) selectNode(nodeDragState.id);
    else scheduleSave();
    nodeDragState=null;
  }
  isTouchPanning=false;
});

// ─── SELECTION ────────────────────────────────────────────────────────────────
let selectedNodeId=null;

function highlightConnected(id){
  const p=peopleById[id]; if(!p) return;
  const conn=new Set([id]);
  (p.parents||[]).forEach(pid=>conn.add(pid));
  people.filter(x=>(x.parents||[]).includes(id)).forEach(x=>conn.add(x.id));
  const myP=new Set(p.parents||[]);
  people.filter(x=>x.id!==id&&(x.parents||[]).some(pp=>myP.has(pp))).forEach(x=>conn.add(x.id));
  if(p.spouseOf) conn.add(p.spouseOf);
  const sp=people.find(x=>x.spouseOf===id); if(sp) conn.add(sp.id);
  // Include connections from relationships[] and legacy customLinks
  (p.relationships||[]).forEach(r=>conn.add(r.targetId));
  Object.keys(p.customLinks||{}).forEach(tid=>conn.add(tid));
  people.filter(x=>(x.relationships||[]).some(r=>r.targetId===id)).forEach(x=>conn.add(x.id));
  people.filter(x=>x.customLinks&&x.customLinks[id]).forEach(x=>conn.add(x.id));

  document.querySelectorAll('.nd').forEach(n=>{
    n.classList.toggle('dim',!conn.has(n.dataset.id));
    n.classList.toggle('sel',n.dataset.id===id);
  });
  document.querySelectorAll('.br').forEach(b=>{
    const lit=conn.has(b.dataset.src)&&conn.has(b.dataset.dst);
    b.classList.toggle('dim',!lit); b.classList.toggle('lit',lit);
  });
}

function selectNode(id){
  selectedNodeId=id; hideTooltip();
  highlightConnected(id);
  zoomTo(peopleById[id]);
  fillCard(peopleById[id]);
  document.getElementById('card').classList.add('open');
  document.getElementById('scrim').classList.add('on');
}

function zoomTo(p){
  if(!p) return;
  const s=2.1;
  panX=window.innerWidth/2-p.x*s;
  panY=window.innerHeight/2-p.y*s;
  scale=s; applyTransform(true);
}

function fillCard(p){
  if(!p) return;
  const c=getNodeColor(p);
  document.getElementById('cbar').style.cssText=`background:${c};box-shadow:0 0 10px ${c}`;
  const av=document.getElementById('cavatar');
  av.style.borderColor=c;
  av.innerHTML=p.photo?`<img src="${p.photo}"/>`:`<span style="color:${c}">${initials(p)}</span>`;
  document.getElementById('cname').textContent=p.isYou?'You':fullName(p);
  // Show birth + death dates
  let dateText=dobDisplay(p);
  if(p.death||(p.dod&&p.dod.year)){
    const months=['','January','February','March','April','May','June','July','August','September','October','November','December'];
    const dod=p.dod||{};
    const dParts=[];
    if(dod.month) dParts.push(months[parseInt(dod.month)]||'');
    if(dod.day) dParts.push(dod.day+(dod.year?',':''));
    if(dod.year) dParts.push(dod.year);
    else if(p.death) dParts.push(p.death);
    if(dParts.length) dateText+=' — d. '+dParts.join(' ');
  }
  document.getElementById('cdob').textContent=dateText;
  document.getElementById('cplace').textContent=placeDisplay(p);

  // Anniversary display
  const annivEl=document.getElementById('canniv');
  const spNode=p.spouseOf?peopleById[p.spouseOf]:people.find(x=>x.spouseOf===p.id);
  const wd=p.weddingDate||(spNode&&spNode.weddingDate)||null;
  if(wd&&(wd.month||wd.day||wd.year)){
    const months=['','January','February','March','April','May','June','July','August','September','October','November','December'];
    const parts=[];
    if(wd.month)parts.push(months[parseInt(wd.month)]||'');
    if(wd.day)parts.push(wd.day+(wd.year?',':''));
    if(wd.year)parts.push(wd.year);
    let annivText='💍 Married '+parts.join(' ');
    if(wd.year){
      const yrs=new Date().getFullYear()-parseInt(wd.year);
      if(yrs>0) annivText+=` · ${yrs} year${yrs>1?'s':''}`
    }
    annivEl.textContent=annivText;
  } else {
    annivEl.textContent='';
  }

  const rel=getRelToYou(p.id);
  const relBadge=document.getElementById('crel-badge');
  relBadge.innerHTML=(!p.isYou&&rel)?`<span class="crel-badge">${rel}</span>`:'';

  // Bridge badge — show if this node is linked to another user's tree
  const bridge=getBridgeInfo(p.id);
  if(bridge){
    relBadge.innerHTML+= `<div class="bridge-badge">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      Linked with ${bridge.otherUserName}'s tree
    </div>`;
  }

  // Connections
  const parentsArr=(p.parents||[]).map(pid=>{
    const par=peopleById[pid]; if(!par) return null;
    // Label is always from the PERSPECTIVE of person p (who is the child)
    const lbl=genderedRel('Parent',par.gender);
    return {p:par,rel:lbl,connType:'parent'};
  }).filter(Boolean);

  const children=people.filter(x=>(x.parents||[]).includes(p.id)).map(x=>({
    p:x, rel: x.relLabel?genderedRel(x.relLabel,x.gender):genderedRel('Child',x.gender)
  }));

  const myP2=new Set(p.parents||[]);
  const sibs=people.filter(x=>x.id!==p.id&&(x.parents||[]).some(pp=>myP2.has(pp))).map(x=>({
    p:x, rel:genderedRel('Sibling',x.gender), connType:'sibling'
  }));

  const spouseNode=p.spouseOf?peopleById[p.spouseOf]:people.find(x=>x.spouseOf===p.id);
  const spouses=spouseNode?[{p:spouseNode,rel:genderedRel('Spouse',spouseNode.gender),connType:'spouse'}]:[];
  // Include labeled connections from relationships[] (v2) with customLinks fallback
  const labeledSet=new Set(); // track to avoid duplicates
  const labeled=[];
  (p.relationships||[]).forEach(r=>{
    const cp=peopleById[r.targetId]; if(!cp) return;
    labeledSet.add(r.targetId);
    labeled.push({p:cp, rel:r.label, targetId:r.targetId, connType:r.category||'custom'});
  });
  // Fallback: legacy customLinks not yet migrated
  Object.entries(p.customLinks||{}).forEach(([tid,v])=>{
    if(labeledSet.has(tid)) return;
    const cp=peopleById[tid]; if(!cp) return;
    labeled.push({p:cp, rel:typeof v==='string'?v:v.label, targetId:tid, connType:typeof v==='string'?'labeled':v.lineType||'labeled'});
  });
  const conns=[...spouses,...parentsArr,...children,...sibs,...labeled];

  let html='';
  if(p.note) html+=`<div class="csec">Story</div><p class="cbio">${p.note}</p>`;
  if(conns.length){
    html+=`<div class="csec">Connections</div><div class="frow" id="conn-list-${p.id}">`;
    const MAX_SHOW=5;
    conns.forEach(({p:cp,rel,targetId,connType},idx)=>{
      const cc=getNodeColor(cp);
      const chipPhoto=cp.photo
        ?`<div class="fchip-photo"><img src="${cp.photo}"/></div>`
        :`<div class="fdot" style="background:${cc};box-shadow:0 0 5px ${cc}"></div>`;
      const hidden=idx>=MAX_SHOW?` style="position:relative;display:none" data-extra-conn`:`style="position:relative"`;
      html+=`<div class="fchip" id="chip-${p.id}-${cp.id}" ${hidden}>
        <div style="flex:1;display:flex;align-items:center;gap:8px;cursor:pointer" onclick="selectNode('${cp.id}')">
          ${chipPhoto}
          <div class="fi2"><div class="fn2">${fullName(cp)}</div><div class="frel" id="frel-${p.id}-${cp.id}">${rel}</div></div>
          <div class="fyr">${dobDisplay(cp).replace('b. ','')}</div>
        </div>
        <button class="fchip-edit-btn" onclick="editConnRel('${p.id}','${cp.id}','${connType||'labeled'}');event.stopPropagation()" title="Edit relationship">✎</button>
        <button onclick="removeConnFromCard('${p.id}','${cp.id}','${connType||'labeled'}');event.stopPropagation()" title="Remove this connection" style="background:transparent;border:none;cursor:pointer;color:rgba(200,100,100,.35);font-size:16px;padding:0 4px;line-height:1;flex-shrink:0;transition:color .2s" onmouseover="this.style.color='rgba(220,120,120,.9)'" onmouseout="this.style.color='rgba(200,100,100,.35)'">×</button>
      </div>`;
    });
    if(conns.length>MAX_SHOW){
      html+=`<button id="see-more-${p.id}" onclick="document.querySelectorAll('#conn-list-${p.id} [data-extra-conn]').forEach(el=>el.style.display='');this.remove()" style="width:100%;padding:8px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:8px;color:var(--gold);font-size:.76rem;cursor:pointer;font-family:'Outfit',sans-serif">See all ${conns.length} connections</button>`;
    }
    html+=`</div>`;
  }

  // ── Leafs section ──
  const nodeLeafs=getLeafsForNode(p.id);
  html+=`<div class="csec" style="display:flex;justify-content:space-between;align-items:center">Leafs${nodeLeafs.length?` <span style="font-size:.7rem;color:var(--muted);font-weight:400;text-transform:none">${nodeLeafs.length}</span>`:''}<button class="leaf-add-btn" onclick="openLeafModal('${p.id}')" style="font-size:.68rem;padding:3px 10px;border-radius:100px;background:rgba(100,180,100,.1);border:1px solid rgba(100,180,100,.25);color:rgba(140,210,140,.9);cursor:pointer;font-family:'Outfit',sans-serif;font-weight:500">+ Add Leaf</button></div>`;
  if(nodeLeafs.length){
    const showLeafs=nodeLeafs.slice(0,3);
    html+=`<div class="leaf-list">`;
    showLeafs.forEach(l=>{
      const t=LEAF_TYPES[l.type]||LEAF_TYPES.moment;
      const dateStr=l.date&&l.date.year?l.date.year:'';
      html+=`<div class="leaf-card" onclick="openLeafDetail('${l.id}')">
        <div class="leaf-icon">${t.icon}</div>
        <div class="leaf-body">
          <div class="leaf-title">${l.title||t.label}</div>
          <div class="leaf-preview">${(l.content||'').slice(0,80)}${(l.content||'').length>80?'…':''}</div>
        </div>
        ${dateStr?`<div class="leaf-date">${dateStr}</div>`:''}
      </div>`;
    });
    if(nodeLeafs.length>3){
      html+=`<button class="leaf-see-all" onclick="openLeafList('${p.id}')">See all ${nodeLeafs.length} Leafs</button>`;
    }
    html+=`</div>`;
  } else {
    html+=`<div style="padding:8px 0;font-size:.76rem;color:var(--muted);font-style:italic">No Leafs yet — add a story, moment, or quote.</div>`;
  }

  // Bridge info for this node
  const bridgeLink=getBridgeInfo(p.id);

  html+=`<div class="card-actions">
    <button class="btn-sm btn-edit" onclick="editCard('${p.id}')">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      Edit
    </button>
    <button class="btn-sm btn-twyg" onclick="closeCard();openModal('${p.id}')">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
      Add a Twyg
    </button>
    <button class="btn-sm btn-conn" onclick="openConnModal('${p.id}')">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      Add Connection
    </button>
    ${p.isYou?`<button class="btn-sm" onclick="generateLinkCode('${p.id}')" style="background:rgba(200,168,75,.08);border-color:rgba(200,168,75,.2);color:var(--gold)">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      Link Tree
    </button>`:`<button class="btn-sm" onclick="closeCard();openLinkCard()" style="background:rgba(200,168,75,.08);border-color:rgba(200,168,75,.2);color:var(--gold)">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      Link Twyg
    </button>`}
    ${p.isYou&&activeLinks.length?`<button class="btn-sm" onclick="openUnlinkModal()" style="background:rgba(180,80,80,.06);border-color:rgba(180,80,80,.2);color:rgba(200,100,100,.7)">Unlink</button>`:''}
    ${!p.isYou&&bridgeLink?`<button class="btn-sm" onclick="revokeLink('${bridgeLink.linkId}')" style="background:rgba(180,80,80,.06);border-color:rgba(180,80,80,.2);color:rgba(200,100,100,.7)">Unlink</button>`:''}
    ${!p.isYou?`<button class="btn-sm btn-del" onclick="removePerson('${p.id}')">Remove</button>`:''}
  </div>`;

  document.getElementById('cbody').innerHTML=html;
}

// ─── EDIT CARD ────────────────────────────────────────────────────────────────
function stateSelectOpts(current){
  const states=['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming','Washington D.C.','Puerto Rico','Other / International'];
  return '<option value="">Select state…</option>'+states.map(s=>`<option value="${s}"${s===current?' selected':''}>${s}</option>`).join('');
}

function editCard(id){
  const p=peopleById[id]; if(!p) return;
  const months=['','January','February','March','April','May','June','July','August','September','October','November','December'];
  const mOpts=months.map((m,i)=>m?`<option value="${i}" ${p.dob&&p.dob.month==i?'selected':''}>${m}</option>`:'<option value="">Month</option>').join('');
  const photoPreview=p.photo?`<img src="${p.photo}"/>`:`<span style="font-size:.65rem;color:var(--muted)">None</span>`;
  const gOpts=['','male','female','nonbinary'].map(v=>`<option value="${v}" ${p.gender===v?'selected':''}>${{'':"Prefer not to say",male:'Male',female:'Female',nonbinary:'Non-binary'}[v]}</option>`).join('');

  document.getElementById('cbody').innerHTML=`<div class="edit-form">
    <div class="ef ef-row c2">
      <div><label class="el">First Name</label><input class="ei" id="ei-first" value="${(p.firstName||'').replace(/"/g,'&quot;')}" placeholder="First"/></div>
      <div><label class="el">Last Name</label><input class="ei" id="ei-last" value="${(p.lastName||'').replace(/"/g,'&quot;')}" placeholder="Last"/></div>
    </div>
    <div class="ef"><label class="el">Gender</label>
      <select class="ei" style="appearance:none"  id="ei-gender">${gOpts}</select>
    </div>
    <div class="ef"><label class="el">Date of Birth</label>
      <div class="ef-row c3">
        <select class="ei" id="ei-dob-month" style="appearance:none">${mOpts}</select>
        <input class="ei" id="ei-dob-day" type="number" value="${p.dob&&p.dob.day||''}" placeholder="Day" min="1" max="31"/>
        <input class="ei" id="ei-dob-year" type="number" value="${p.dob&&p.dob.year||p.birth||''}" placeholder="Year"/>
      </div>
    </div>
    <div class="ef"><label class="el" style="display:flex;align-items:center;gap:8px;cursor:pointer">
      <span>Deceased</span>
      <span class="toggle-wrap-sm">
        <input type="checkbox" id="ei-deceased" class="toggle-hidden" ${(p.death||(p.dod&&p.dod.year))?'checked':''}/>
        <span id="ei-deceased-track" class="toggle-track${(p.death||(p.dod&&p.dod.year))?' toggle-track-on':''}" style="cursor:pointer"></span>
        <span id="ei-deceased-thumb" class="toggle-thumb-sm${(p.death||(p.dod&&p.dod.year))?' on':''}"></span>
      </span>
    </label>
    <div id="ei-death-fields" class="death-fields" style="${(p.death||(p.dod&&p.dod.year))?'display:block':''}">
      <div class="ef-row c3">
        <select class="ei" id="ei-dod-month" style="appearance:none">
          <option value="">Month</option>
          ${months.slice(1).map((m,i)=>`<option value="${i+1}" ${(p.dod&&p.dod.month)==(i+1)?'selected':''}>${m}</option>`).join('')}
        </select>
        <input class="ei" id="ei-dod-day" type="number" value="${p.dod&&p.dod.day||''}" placeholder="Day" min="1" max="31"/>
        <input class="ei" id="ei-dod-year" type="number" value="${p.dod&&p.dod.year||p.death||''}" placeholder="Year"/>
      </div>
    </div></div>
    <div class="ef ef-row c2">
      <div><label class="el">City</label><input class="ei" id="ei-city" value="${(p.city||'').replace(/"/g,'&quot;')}" placeholder="City"/></div>
      <div><label class="el">State</label><select class="ei" id="ei-state" style="appearance:none">${stateSelectOpts(p.state||"")}</select></div>
    </div>
    <div class="ef"><label class="el">Photo</label>
      <div class="photo-upload">
        <div class="photo-preview" id="edit-photo-preview">${photoPreview}</div>
        <label class="photo-btn" for="photo-file-input">${p.photo?'Change photo':'Upload photo'}</label>
        <input type="file" id="photo-file-input" accept="image/*" onchange="handlePhotoUpload(event,'${id}')"/>
        ${p.photo?`<button onclick="removePhoto('${id}')" style="padding:5px 9px;background:transparent;border:1px solid rgba(180,80,80,.3);border-radius:6px;color:rgba(200,100,100,.6);font-size:.72rem;cursor:pointer;white-space:nowrap;flex-shrink:0">✕</button>`:''}
      </div>
    </div>
    <div class="ef"><label class="el">Story</label>
      <textarea class="ei" id="ei-note" rows="3" style="resize:vertical" placeholder="A brief memory or note…">${p.note||''}</textarea></div>
    ${(p.spouseOf||people.find(x=>x.spouseOf===p.id))?`
    <div class="ef"><label class="el">💍 Wedding Date</label>
      <div class="ef-row c3">
        <select class="ei" id="ei-wd-month" style="appearance:none">
          <option value="">Month</option>
          ${months.slice(1).map((m,i)=>`<option value="${i+1}" ${(p.weddingDate&&p.weddingDate.month)==(i+1)?'selected':''}>${m}</option>`).join('')}
        </select>
        <input class="ei" id="ei-wd-day" type="number" value="${p.weddingDate&&p.weddingDate.day||''}" placeholder="Day" min="1" max="31"/>
        <input class="ei" id="ei-wd-year" type="number" value="${p.weddingDate&&p.weddingDate.year||''}" placeholder="Year"/>
      </div>
    </div>`:''}
    <button class="savebtn" onclick="saveCard('${id}')">Save changes</button>
    <button class="cancelbtn" onclick="fillCard(peopleById['${id}'])">Cancel</button>
  </div>`;
  document.getElementById('ei-first').focus();
  // Wire up deceased toggle
  const decCb=document.getElementById('ei-deceased');
  const decTrack=document.getElementById('ei-deceased-track');
  const decThumb=document.getElementById('ei-deceased-thumb');
  const decFields=document.getElementById('ei-death-fields');
  if(decTrack) decTrack.addEventListener('click',()=>{ decCb.checked=!decCb.checked; syncDeceasedToggle(); });
  if(decCb) decCb.addEventListener('change', syncDeceasedToggle);
  function syncDeceasedToggle(){
    if(decTrack) decTrack.classList.toggle('toggle-track-on',decCb.checked);
    if(decThumb) decThumb.classList.toggle('on',decCb.checked);
    if(decFields) decFields.style.display=decCb.checked?'block':'none';
  }
}

function handlePhotoUpload(event,id){
  const file=event.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    const p=peopleById[id]; if(!p) return;
    p.photo=e.target.result;
    const prev=document.getElementById('edit-photo-preview');
    if(prev) prev.innerHTML=`<img src="${p.photo}"/>`;
    render(); scheduleSave();
  };
  reader.readAsDataURL(file);
}
function removePhoto(id){ const p=peopleById[id]; if(!p) return; delete p.photo; render(); scheduleSave(); editCard(id); }

function saveCard(id){
  const p=peopleById[id]; if(!p) return;
  const first=document.getElementById('ei-first').value.trim();
  const last=document.getElementById('ei-last').value.trim();
  p.firstName=first; p.lastName=last;
  p.name=[first,last].filter(Boolean).join(' ')||p.name;
  p.gender=document.getElementById('ei-gender').value;
  p.dob={
    month:document.getElementById('ei-dob-month').value,
    day:document.getElementById('ei-dob-day').value,
    year:document.getElementById('ei-dob-year').value
  };
  p.birth=parseInt(p.dob.year)||p.birth||null;
  // Save deceased state + death date
  const decCb=document.getElementById('ei-deceased');
  if(decCb){
    if(decCb.checked){
      p.dod={
        month:document.getElementById('ei-dod-month')?.value||'',
        day:document.getElementById('ei-dod-day')?.value||'',
        year:document.getElementById('ei-dod-year')?.value||''
      };
      p.death=parseInt(p.dod.year)||null;
    } else {
      p.dod=null;
      p.death=null;
    }
  }
  p.city=document.getElementById('ei-city').value.trim();
  p.state=document.getElementById('ei-state').value||'';
  p.note=document.getElementById('ei-note').value.trim();
  // Save wedding date if fields exist
  const wdMonth=document.getElementById('ei-wd-month');
  if(wdMonth){
    const wd={month:wdMonth.value,day:document.getElementById('ei-wd-day').value,year:document.getElementById('ei-wd-year').value};
    if(wd.month||wd.day||wd.year){
      p.weddingDate=wd;
      const spouse=p.spouseOf?peopleById[p.spouseOf]:people.find(x=>x.spouseOf===p.id);
      if(spouse) spouse.weddingDate=wd;
    }
  }
  rebuild([]); render(); scheduleSave(); selectNode(id);
}

function closeCard(){
  document.getElementById('card').classList.remove('open');
  if(!document.getElementById('members-panel').classList.contains('open'))
    document.getElementById('scrim').classList.remove('on');
  selectedNodeId=null;
  document.querySelectorAll('.nd').forEach(n=>n.classList.remove('dim','sel'));
  document.querySelectorAll('.br').forEach(b=>b.classList.remove('dim','lit'));
  // Zoom back out in immersive mode
  if(layoutMode==='immersive'&&typeof immTargetLookAt!=='undefined'){
    immSelectedId=null;
    immTargetLookAt=new THREE.Vector3(0,0,0);
    immTargetRadius=350;
    immZooming=true;
  } else {
    resetView();
  }
}

async function removePerson(id){
  const p=peopleById[id]; if(!p) return;
  const children=people.filter(x=>(x.parents||[]).includes(id));
  
  let cascade=false;
  if(children.length){
    const descendants=[];
    function countDesc(pid){ people.filter(x=>(x.parents||[]).includes(pid)).forEach(x=>{descendants.push(x.id);countDesc(x.id);}); }
    countDesc(id);

    if(descendants.length){
      const choice=await appChoice(
        `Remove <strong>${fullName(p)}</strong> from the tree?<br><br><span style="font-size:.78rem;color:var(--muted)">${fullName(p)} has ${descendants.length} connected Twyg${descendants.length>1?'s':''} below them.</span>`,
        'Remove All','Remove Only '+fullName(p).split(' ')[0],'Cancel'
      );
      if(!choice) return;
      cascade=(choice==='a');
    } else {
      if(!await appConfirm(`Remove <strong>${fullName(p)}</strong> from the tree?`,'Remove','Cancel')) return;
    }
  } else {
    if(!await appConfirm(`Remove <strong>${fullName(p)}</strong> from the tree?`,'Remove','Cancel')) return;
  }

  const rm=new Set([id]);
  if(cascade){
    function collect(pid){ people.filter(x=>(x.parents||[]).includes(pid)).forEach(x=>{rm.add(x.id);collect(x.id);}); }
    collect(id);
  } else {
    // Just unlink children from this parent
    people.forEach(x=>{
      if((x.parents||[]).includes(id)) x.parents=x.parents.filter(pid=>pid!==id);
    });
  }
  people=people.filter(p=>!rm.has(p.id));
  // Clean up spouse, customLink, and relationships[] references
  people.forEach(p=>{
    if(p.spouseOf&&rm.has(p.spouseOf)) delete p.spouseOf;
    if(p.customLinks) Object.keys(p.customLinks).forEach(k=>{ if(rm.has(k)) delete p.customLinks[k]; });
    if(p.relationships) p.relationships=p.relationships.filter(r=>!rm.has(r.targetId));
  });
  rebuild([]); closeCard(); render(); scheduleSave();
}

function editConnRel(fromId, toId, connType){
  const chip=document.getElementById(`chip-${fromId}-${toId}`);
  if(!chip) return;
  // Build select with all relationship options
  const from=people.find(p=>p.id===fromId);
  const fname=from?(from.firstName||fullName(from).split(' ')[0]):'them';
  const sel=document.createElement('select');
  sel.className='fchip-edit-select';

  const groups=[
    ['Parents',['Father','Mother','Stepfather','Stepmother']],
    ['Children',['Son','Daughter','Stepson','Stepdaughter']],
    ['Siblings',['Brother','Sister','Half-brother','Half-sister']],
    ['Spouse',['Husband','Wife','Partner']],
    ['Grandparents',['Grandfather','Grandmother','Great-grandfather','Great-grandmother']],
    ['Grandchildren',['Grandson','Granddaughter','Great-grandson','Great-granddaughter']],
    ['Aunts & Uncles',['Uncle','Aunt','Great-uncle','Great-aunt']],
    ['Nephews & Nieces',['Nephew','Niece','Grand-nephew','Grand-niece']],
    ['First Cousins',['First Cousin','First Cousin Once Removed','First Cousin Twice Removed']],
    ['Second Cousins',['Second Cousin','Second Cousin Once Removed','Second Cousin Twice Removed']],
    ['In-Laws',['Father-in-law','Mother-in-law','Son-in-law','Daughter-in-law','Brother-in-law','Sister-in-law','Uncle-in-law','Aunt-in-law','Nephew-in-law','Niece-in-law']],
    ['Other',['Godfather','Godmother','Godchild','Guardian','Family Friend','Other']],
  ];

  // Get current rel label to pre-select
  const to=people.find(p=>p.id===toId);
  const currentLabel=to?.relLabel||(to?.customLinks?.[fromId]?.label)||'';

  groups.forEach(([grpLabel,opts])=>{
    const og=document.createElement('optgroup');
    og.label=grpLabel;
    opts.forEach(lbl=>{
      const o=document.createElement('option');
      o.value=lbl; o.textContent=lbl;
      if(lbl===currentLabel) o.selected=true;
      og.appendChild(o);
    });
    sel.appendChild(og);
  });

  sel.onchange=()=>{
    const newLabel=sel.value;
    saveEditedConnRel(fromId,toId,connType,newLabel);
    sel.remove();
  };
  sel.onblur=()=>{ setTimeout(()=>sel.remove(),200); };
  chip.appendChild(sel);
  setTimeout(()=>sel.focus(),30);
}

function saveEditedConnRel(fromId, toId, connType, newLabel){
  const from=people.find(p=>p.id===fromId);
  const to=people.find(p=>p.id===toId); if(!from||!to) return;

  const ltype=BLOOD_LABELS.has(newLabel)?'blood':'labeled';

  // Determine if it's a structural change (parent↔child) or just a label change
  const newIsParent=['Father','Mother','Stepfather','Stepmother'].includes(newLabel);
  const newIsChild=['Son','Daughter','Stepson','Stepdaughter'].includes(newLabel);
  const newIsSpouse=['Husband','Wife','Partner'].includes(newLabel);
  const newIsSibling=['Brother','Sister','Half-brother','Half-sister'].includes(newLabel);

  // Remove old connection first
  removeRel(from, to);
  if(connType==='parent') from.parents=(from.parents||[]).filter(pid=>pid!==toId);
  else if(connType==='child') to.parents=(to.parents||[]).filter(pid=>pid!==fromId);
  else if(connType==='spouse'){ if(from.spouseOf===toId) delete from.spouseOf; if(to.spouseOf===fromId) delete to.spouseOf; }
  else { if(from.customLinks) delete from.customLinks[toId]; if(to.customLinks) delete to.customLinks[fromId]; }

  // Apply new connection type
  if(newIsParent){
    if(!(from.parents||[]).includes(toId)) from.parents=[...(from.parents||[]),toId];
  } else if(newIsChild){
    if(!(to.parents||[]).includes(fromId)) to.parents=[...(to.parents||[]),fromId];
  } else if(newIsSpouse){
    to.spouseOf=fromId;
  } else {
    if(!from.customLinks) from.customLinks={};
    if(!to.customLinks) to.customLinks={};
    const sibLtype=newIsSibling?'sibling':ltype;
    from.customLinks[toId]={label:newLabel,lineType:sibLtype};
    to.customLinks[fromId]={label:newLabel,lineType:sibLtype};
    // Write to v2 relationships[]
    addRel(from, to, newLabel);
  }

  // Update gender hint
  const mGender={'father':'male','grandfather':'male','son':'male','grandson':'male','brother':'male','husband':'male','uncle':'male','nephew':'male'};
  const fGender={'mother':'female','grandmother':'female','daughter':'female','granddaughter':'female','sister':'female','wife':'female','aunt':'female','niece':'female'};
  const lk=newLabel.toLowerCase();
  if(!to.gender){ if(mGender[lk]) to.gender='male'; else if(fGender[lk]) to.gender='female'; }
  to.relLabel=newLabel;

  rebuild(); render(); scheduleSave();
  selectNode(fromId);
}

async function removeConnFromCard(fromId, toId, connType){
  if(!await appConfirm('Remove this connection?','Remove','Keep')) return;
  // Always get fresh references from people (peopleById may be stale)
  const from=people.find(p=>p.id===fromId);
  const to=people.find(p=>p.id===toId);
  if(!from||!to){ console.warn('removeConn: node not found',fromId,toId); return; }

  switch(connType){
    case 'spouse':
      if(from.spouseOf===toId) delete from.spouseOf;
      if(to.spouseOf===fromId) delete to.spouseOf;
      delete from.relLabel; delete to.relLabel;
      break;
    case 'parent':
      // to is the parent of from — remove from from.parents
      from.parents=(from.parents||[]).filter(pid=>pid!==toId);
      break;
    case 'child':
      // to is the child of from — remove fromId from to.parents
      to.parents=(to.parents||[]).filter(pid=>pid!==fromId);
      break;
    case 'sibling':
      // Remove from customLinks on both sides (explicit sibling links)
      if(from.customLinks) delete from.customLinks[toId];
      if(to.customLinks) delete to.customLinks[fromId];
      // Also remove shared parents if that's the only connection
      // (user explicitly removing the sibling relationship)
      from.parents=(from.parents||[]).filter(pid=>!(to.parents||[]).includes(pid));
      break;
    case 'labeled':
    default:
      // Remove from customLinks on both sides
      if(from.customLinks) delete from.customLinks[toId];
      if(to.customLinks) delete to.customLinks[fromId];
      delete from.relLabel; delete to.relLabel;
      // Clean up any YOU → node customLink too
      const you=people.find(p=>p.isYou);
      if(you&&you.id!==fromId&&you.id!==toId){
        if(you.customLinks) { delete you.customLinks[toId]; delete you.customLinks[fromId]; }
      }
      break;
  }
  // Also remove from v2 relationships[]
  removeRel(from, to);
  rebuild(); render(); scheduleSave();
  selectNode(fromId);
}


// ─── ADD CONNECTION MODAL ────────────────────────────────────────────────────
let connectionForNodeId=null, connectionSelectedNodeId=null;

function buildConnRelOptions(name){
  const n=name||'them';
  function og(label,type,pairs){
    return `<optgroup label="${label}">${pairs.map(([lbl,text])=>`<option value="${type}-${lbl}">${text||lbl+' of '+n}</option>`).join('')}</optgroup>`;
  }
  return [
    og('── They are a parent ──','parent',[
      ['Father',`Father of ${n}`],['Mother',`Mother of ${n}`],
      ['Stepfather',`Stepfather of ${n}`],['Stepmother',`Stepmother of ${n}`],
    ]),
    og('── They are a grandparent ──','parent',[
      ['Grandfather',`Grandfather of ${n}`],['Grandmother',`Grandmother of ${n}`],
      ['Great-grandfather',`Great-grandfather of ${n}`],['Great-grandmother',`Great-grandmother of ${n}`],
      ['Great-great-grandfather',`Great-great-grandfather of ${n}`],['Great-great-grandmother',`Great-great-grandmother of ${n}`],
    ]),
    og('── They are a child ──','child',[
      ['Son',`Son of ${n}`],['Daughter',`Daughter of ${n}`],
      ['Stepson',`Stepson of ${n}`],['Stepdaughter',`Stepdaughter of ${n}`],
    ]),
    og('── They are a grandchild ──','child',[
      ['Grandson',`Grandson of ${n}`],['Granddaughter',`Granddaughter of ${n}`],
      ['Great-grandson',`Great-grandson of ${n}`],['Great-granddaughter',`Great-granddaughter of ${n}`],
      ['Great-great-grandson',`Great-great-grandson of ${n}`],['Great-great-granddaughter',`Great-great-granddaughter of ${n}`],
    ]),
    og('── They are a sibling ──','sibling',[
      ['Brother',`Brother of ${n}`],['Sister',`Sister of ${n}`],
      ['Half-brother',`Half-brother of ${n}`],['Half-sister',`Half-sister of ${n}`],
      ['Stepbrother',`Stepbrother of ${n}`],['Stepsister',`Stepsister of ${n}`],
    ]),
    og('── They are a spouse ──','spouse',[
      ['Husband',`Husband of ${n}`],['Wife',`Wife of ${n}`],['Partner',`Partner of ${n}`],
    ]),
    og('── Aunts &amp; Uncles ──','labeled',[
      ['Uncle',`Uncle of ${n}`],['Aunt',`Aunt of ${n}`],
      ['Great-uncle',`Great-uncle of ${n}`],['Great-aunt',`Great-aunt of ${n}`],
      ['Great-grand-uncle',`Great-grand-uncle of ${n}`],['Great-grand-aunt',`Great-grand-aunt of ${n}`],
    ]),
    og('── Nephews &amp; Nieces ──','labeled',[
      ['Nephew',`Nephew of ${n}`],['Niece',`Niece of ${n}`],
      ['Grand-nephew',`Grand-nephew of ${n}`],['Grand-niece',`Grand-niece of ${n}`],
      ['Great-grand-nephew',`Great-grand-nephew of ${n}`],['Great-grand-niece',`Great-grand-niece of ${n}`],
    ]),
    og('── First Cousins ──','labeled',[
      ['First Cousin',`First Cousin of ${n}`],
      ['First Cousin Once Removed',`First Cousin Once Removed of ${n}`],
      ['First Cousin Twice Removed',`First Cousin Twice Removed of ${n}`],
      ['First Cousin Thrice Removed',`First Cousin Thrice Removed of ${n}`],
    ]),
    og('── Second &amp; Third Cousins ──','labeled',[
      ['Second Cousin',`Second Cousin of ${n}`],
      ['Second Cousin Once Removed',`Second Cousin Once Removed of ${n}`],
      ['Second Cousin Twice Removed',`Second Cousin Twice Removed of ${n}`],
      ['Third Cousin',`Third Cousin of ${n}`],
      ['Third Cousin Once Removed',`Third Cousin Once Removed of ${n}`],
      ['Third Cousin Twice Removed',`Third Cousin Twice Removed of ${n}`],
    ]),
    og('── In-Laws ──','labeled',[
      ['Father-in-law',`Father-in-law of ${n}`],['Mother-in-law',`Mother-in-law of ${n}`],
      ['Son-in-law',`Son-in-law of ${n}`],['Daughter-in-law',`Daughter-in-law of ${n}`],
      ['Brother-in-law',`Brother-in-law of ${n}`],['Sister-in-law',`Sister-in-law of ${n}`],
      ['Uncle-in-law',`Uncle-in-law of ${n}`],['Aunt-in-law',`Aunt-in-law of ${n}`],
      ['Nephew-in-law',`Nephew-in-law of ${n}`],['Niece-in-law',`Niece-in-law of ${n}`],
      ['Grandfather-in-law',`Grandfather-in-law of ${n}`],['Grandmother-in-law',`Grandmother-in-law of ${n}`],
    ]),
    og('── Other ──','labeled',[
      ['Godfather',`Godfather of ${n}`],['Godmother',`Godmother of ${n}`],['Godchild',`Godchild of ${n}`],
      ['Guardian',`Guardian of ${n}`],['Family Friend',`Family Friend of ${n}`],['Other',`Other connection to ${n}`],
    ]),
  ].join('');
}

function openConnModal(id){
  connectionForNodeId=id; connectionSelectedNodeId=null;
  const p=peopleById[id];
  const firstName=p.firstName||fullName(p).split(' ')[0];
  document.getElementById('conn-sub').textContent=`Link another member's relationship to ${fullName(p)}`;
  document.getElementById('conn-rel').innerHTML=buildConnRelOptions(firstName);
  document.getElementById('conn-search').value='';
  renderConnList('');
  document.getElementById('conn-bg').classList.add('open');
}
function closeConnModal(){ document.getElementById('conn-bg').classList.remove('open'); connectionForNodeId=null; connectionSelectedNodeId=null; }

function filterConnList(){ renderConnList(document.getElementById('conn-search').value||''); }

function renderConnList(query){
  const q=query.toLowerCase();
  const list=people.filter(p=>p.id!==connectionForNodeId&&(!q||fullName(p).toLowerCase().includes(q)));
  document.getElementById('conn-list').innerHTML=list.map(p=>`
    <div class="conn-item${connectionSelectedNodeId===p.id?' selected':''}" onclick="selectConnNode('${p.id}')">
      <div class="conn-item-dot" style="background:${getNodeColor(p)}"></div>
      <div>
        <div class="conn-item-name">${fullName(p)}${p.isYou?' <span style="font-size:.72rem;color:var(--gold);font-weight:500">(You)</span>':''}</div>
        <div class="conn-item-sub">${getRelToYou(p.id)||dobDisplay(p)}</div>
      </div>
    </div>`).join('');
}

function selectConnNode(id){
  connectionSelectedNodeId=id;
  document.querySelectorAll('.conn-item').forEach(el=>el.classList.remove('selected'));
  document.querySelectorAll('.conn-item').forEach(el=>{
    if(el.querySelector('.conn-item-name').textContent===fullName(peopleById[id])) el.classList.add('selected');
  });
}

function saveConnection(){
  if(!connectionForNodeId||!connectionSelectedNodeId){ appAlert('Please select a member.'); return; }
  const target=peopleById[connectionForNodeId];   // the node the card is about
  const other=peopleById[connectionSelectedNodeId]; // the node we're connecting to it
  const rel=document.getElementById('conn-rel').value;

  const dashIdx=rel.indexOf('-');
  const type=rel.slice(0,dashIdx);
  const label=rel.slice(dashIdx+1);

  const mGender={'father':'male','grandfather':'male','stepfather':'male','son':'male','grandson':'male','stepson':'male','brother':'male','half-brother':'male','husband':'male','uncle':'male','nephew':'male','brother-in-law':'male','uncle-in-law':'male','nephew-in-law':'male','godfather':'male'};
  const fGender={'mother':'female','grandmother':'female','stepmother':'female','daughter':'female','granddaughter':'female','stepdaughter':'female','sister':'female','half-sister':'female','wife':'female','aunt':'female','niece':'female','sister-in-law':'female','aunt-in-law':'female','niece-in-law':'female','godmother':'female'};
  const lkey=label.toLowerCase();
  if(!other.gender){ if(mGender[lkey]) other.gender='male'; else if(fGender[lkey]) other.gender='female'; }

  // Labels that are DIRECT parents (add to parents[])
  const directParentLabels=['Father','Mother','Stepfather','Stepmother','Parent'];
  // Labels that are DIRECT children (add to parents[])
  const directChildLabels=['Son','Daughter','Stepson','Stepdaughter','Child'];
  // Grandparent/grandchild and others → labeled customLink only

  if(type==='parent'){
    if(directParentLabels.includes(label)){
      if(!(target.parents||[]).includes(other.id)) target.parents=[...(target.parents||[]),other.id];
      // CASCADE B: parent-to-sibling — add parent to all of target's siblings
      const tSibs=new Set();
      (target.relationships||[]).forEach(r=>{ if(SIBLING_LABELS.has(r.label)) tSibs.add(r.targetId); });
      Object.entries(target.customLinks||{}).forEach(([tid,v])=>{ const l=typeof v==='string'?v:v.label||''; if(SIBLING_LABELS.has(l)) tSibs.add(tid); });
      tSibs.forEach(sibId=>{ const s=peopleById[sibId]; if(s&&!(s.parents||[]).includes(other.id)) s.parents=[...(s.parents||[]),other.id]; });
    } else {
      if(!target.customLinks) target.customLinks={};
      if(!other.customLinks) other.customLinks={};
      const ltype=BLOOD_LABELS.has(label)?'blood':'labeled';
      target.customLinks[other.id]={label,lineType:ltype};
      other.customLinks[target.id]={label,lineType:ltype};
    }
    other.relLabel=label;
  } else if(type==='child'){
    if(directChildLabels.includes(label)){
      if(!(other.parents||[]).includes(target.id)) other.parents=[...(other.parents||[]),target.id];
      // CASCADE B: parent-to-sibling — add parent (target) to all of other's siblings
      const oSibs=new Set();
      (other.relationships||[]).forEach(r=>{ if(SIBLING_LABELS.has(r.label)) oSibs.add(r.targetId); });
      Object.entries(other.customLinks||{}).forEach(([tid,v])=>{ const l=typeof v==='string'?v:v.label||''; if(SIBLING_LABELS.has(l)) oSibs.add(tid); });
      oSibs.forEach(sibId=>{ const s=peopleById[sibId]; if(s&&!(s.parents||[]).includes(target.id)) s.parents=[...(s.parents||[]),target.id]; });
    } else {
      if(!target.customLinks) target.customLinks={};
      if(!other.customLinks) other.customLinks={};
      const ltype2=BLOOD_LABELS.has(label)?'blood':'labeled';
      target.customLinks[other.id]={label,lineType:ltype2};
      other.customLinks[target.id]={label,lineType:ltype2};
    }
    other.relLabel=label;
  } else if(type==='sibling'){
    if(!target.customLinks) target.customLinks={};
    if(!other.customLinks) other.customLinks={};
    const sLbl=label||'Sibling';
    target.customLinks[other.id]={label:sLbl,lineType:'sibling'};
    other.customLinks[target.id]={label:sLbl,lineType:'sibling'};
    if(!other.relLabel) other.relLabel=sLbl;
    // Share parents between the two siblings
    (target.parents||[]).forEach(pid=>{ if(!(other.parents||[]).includes(pid)) other.parents=[...(other.parents||[]),pid]; });
    (other.parents||[]).forEach(pid=>{ if(!(target.parents||[]).includes(pid)) target.parents=[...(target.parents||[]),pid]; });
    // CASCADE A: sibling-of-sibling — connect other to all of target's existing siblings
    const tSibs2=new Set();
    (target.relationships||[]).forEach(r=>{ if(SIBLING_LABELS.has(r.label)&&r.targetId!==other.id) tSibs2.add(r.targetId); });
    Object.entries(target.customLinks||{}).forEach(([tid,v])=>{ if(tid===other.id) return; const l=typeof v==='string'?v:v.label||''; if(SIBLING_LABELS.has(l)) tSibs2.add(tid); });
    tSibs2.forEach(sibId=>{
      const sib=peopleById[sibId]; if(!sib) return;
      if(!other.customLinks[sibId]){
        const sl=sib.gender==='male'?'Brother':sib.gender==='female'?'Sister':'Sibling';
        other.customLinks[sibId]={label:sl,lineType:'sibling'};
        if(!sib.customLinks) sib.customLinks={};
        sib.customLinks[other.id]={label:other.gender==='male'?'Brother':other.gender==='female'?'Sister':'Sibling',lineType:'sibling'};
        addRel(other, sib, sl);
      }
      // Share parents
      (sib.parents||[]).forEach(pid=>{ if(!(other.parents||[]).includes(pid)) other.parents=[...(other.parents||[]),pid]; });
    });
  } else if(type==='spouse'){
    other.spouseOf=target.id;
    target.spouseOf=other.id;
    if(!other.gender&&label.toLowerCase()==='husband') other.gender='male';
    if(!other.gender&&label==='wife') other.gender='female';
    other.relLabel=label;
    // Structural: target's existing children become new spouse's children too
    people.filter(x=>(x.parents||[]).includes(target.id)).forEach(child=>{
      if(!(child.parents||[]).includes(other.id)) child.parents=[...(child.parents||[]),other.id];
    });
  } else if(type==='labeled'){
    if(!target.customLinks) target.customLinks={};
    if(!other.customLinks) other.customLinks={};
    const ltype3=BLOOD_LABELS.has(label)?'blood':'labeled';
    target.customLinks[other.id]={label,lineType:ltype3};
    other.customLinks[target.id]={label,lineType:ltype3};
    other.relLabel=label;
  }

  // Write to v2 relationships[] (unless spouse — handled by spouseOf)
  if(type!=='spouse'){
    addRel(target, other, label);
  }

  // Auto-assign inferred relationship to isYou
  autoAssignToYou(connectionSelectedNodeId, connectionForNodeId, label);
  autoAssignToYou(connectionForNodeId, connectionSelectedNodeId, label);
  rebuild([]); render(); scheduleSave();
  closeConnModal();
  selectNode(connectionForNodeId);
}

// ═══ LEAFS UI ════════════════════════════════════════════════════════════════

let leafModalForId=null;
let leafEditId=null;

function openLeafModal(personId, editId){
  leafModalForId=personId;
  leafEditId=editId||null;
  const bg=document.getElementById('leaf-bg');
  const p=peopleById[personId];
  if(!bg||!p) return;

  // Header
  document.getElementById('leaf-for-name').textContent=`For ${p.isYou?'You':fullName(p)}`;
  document.getElementById('leaf-for-id').value=personId;

  // Build type picker
  const picker=document.getElementById('leaf-type-picker');
  picker.innerHTML=Object.entries(LEAF_TYPES).map(([key,t])=>
    `<div class="leaf-type-btn${key==='moment'?' active':''}" data-type="${key}">
      <span class="lt-icon">${t.icon}</span><span class="lt-label">${t.label}</span>
    </div>`
  ).join('');
  document.getElementById('leaf-type-val').value='moment';

  // Type picker clicks
  picker.querySelectorAll('.leaf-type-btn').forEach(btn=>{
    btn.onclick=()=>{
      picker.querySelectorAll('.leaf-type-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('leaf-type-val').value=btn.dataset.type;
      const t=LEAF_TYPES[btn.dataset.type];
      document.getElementById('leaf-content').placeholder=t.placeholder;
    };
  });

  // Emoji picker
  document.getElementById('leaf-emoji-val').value='';
  document.querySelectorAll('.leaf-emoji-pick').forEach(em=>{
    em.classList.remove('active');
    em.onclick=()=>{
      const wasActive=em.classList.contains('active');
      document.querySelectorAll('.leaf-emoji-pick').forEach(e=>e.classList.remove('active'));
      if(!wasActive){em.classList.add('active');document.getElementById('leaf-emoji-val').value=em.dataset.em;}
      else{document.getElementById('leaf-emoji-val').value='';}
    };
  });

  // Twyg tags — show other people to optionally tag
  const tagsEl=document.getElementById('leaf-twyg-tags');
  const others=people.filter(x=>x.id!==personId).slice(0,12);
  if(others.length){
    tagsEl.innerHTML=`<div style="font-size:.7rem;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em">Tag other Twygs</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">${others.map(o=>{
        const nm=(o.isYou?'You':fullName(o)).split(' ')[0];
        const c=getNodeColor(o);
        return `<button type="button" class="leaf-tag-btn" data-tid="${o.id}" style="display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:100px;background:rgba(255,255,255,.04);border:1px solid var(--border);font-size:.74rem;color:var(--muted);cursor:pointer;font-family:'Outfit',sans-serif;transition:all .15s">
          <span style="width:8px;height:8px;border-radius:50%;background:${c};display:inline-block"></span> ${nm}
        </button>`;
      }).join('')}</div>`;
    tagsEl.querySelectorAll('.leaf-tag-btn').forEach(btn=>{
      btn.onclick=()=>{
        const isActive=btn.classList.toggle('active');
        btn.style.background=isActive?'rgba(100,180,100,.15)':'rgba(255,255,255,.04)';
        btn.style.borderColor=isActive?'rgba(100,180,100,.35)':'var(--border)';
        btn.style.color=isActive?'rgba(140,210,140,.9)':'var(--muted)';
      };
    });
  } else { tagsEl.innerHTML=''; }

  // Clear or populate for edit
  if(leafEditId){
    const l=leafs.find(x=>x.id===leafEditId);
    if(l){
      document.querySelector(`.leaf-type-btn[data-type="${l.type}"]`)?.click();
      document.getElementById('leaf-title').value=l.title||'';
      document.getElementById('leaf-content').value=l.content||'';
      document.getElementById('leaf-date-year').value=l.date?.year||'';
      document.getElementById('leaf-date-month').value=l.date?.month||'';
      document.getElementById('leaf-date-day').value=l.date?.day||'';
      if(l.emoji){
        const em=document.querySelector(`.leaf-emoji-pick[data-em="${l.emoji}"]`);
        if(em){em.classList.add('active');document.getElementById('leaf-emoji-val').value=l.emoji;}
      }
      // Activate tagged twygs
      (l.twygs||[]).forEach(tid=>{
        const btn=document.querySelector(`.leaf-tag-btn[data-tid="${tid}"]`);
        if(btn){btn.classList.add('active');btn.style.background='rgba(100,180,100,.15)';btn.style.borderColor='rgba(100,180,100,.35)';btn.style.color='rgba(140,210,140,.9)';}
      });
      document.querySelector('.leaf-modal-title').textContent='Edit Leaf';
      document.getElementById('btn-submit-leaf').textContent='Save Changes';
    }
  } else {
    document.getElementById('leaf-title').value='';
    document.getElementById('leaf-content').value='';
    document.getElementById('leaf-date-year').value='';
    document.getElementById('leaf-date-month').value='';
    document.getElementById('leaf-date-day').value='';
    document.getElementById('leaf-content').placeholder=LEAF_TYPES.moment.placeholder;
    document.querySelector('.leaf-modal-title').textContent='Add a Leaf';
    document.getElementById('btn-submit-leaf').textContent='Save Leaf';
  }

  bg.classList.add('open');
}

function closeLeafModal(){
  document.getElementById('leaf-bg').classList.remove('open');
  leafModalForId=null;
  leafEditId=null;
}

async function submitLeaf(){
  const personId=document.getElementById('leaf-for-id').value;
  if(!personId) return;

  const type=document.getElementById('leaf-type-val').value;
  const title=document.getElementById('leaf-title').value.trim();
  const content=document.getElementById('leaf-content').value.trim();
  if(!content&&!title){
    document.getElementById('leaf-content').style.borderColor='rgba(200,80,80,.6)';
    setTimeout(()=>{document.getElementById('leaf-content').style.borderColor='';},2000);
    return;
  }

  const year=parseInt(document.getElementById('leaf-date-year').value)||0;
  const month=parseInt(document.getElementById('leaf-date-month').value)||0;
  const day=parseInt(document.getElementById('leaf-date-day').value)||0;
  const date=year?{year,month,day}:null;

  const emoji=document.getElementById('leaf-emoji-val').value||null;

  // Collect tagged twygs
  const twygs=[personId];
  document.querySelectorAll('.leaf-tag-btn.active').forEach(btn=>{
    if(!twygs.includes(btn.dataset.tid)) twygs.push(btn.dataset.tid);
  });

  if(leafEditId){
    await editLeaf(leafEditId,{type,title,content,date,emoji,twygs});
  } else {
    await addLeaf({type,title,content,date,emoji,twygs,media:[]});
  }

  closeLeafModal();
  // Refresh card if open
  if(selectedNodeId) selectNode(selectedNodeId);
}

function openLeafDetail(leafId){
  const l=leafs.find(x=>x.id===leafId);
  if(!l) return;
  const t=LEAF_TYPES[l.type]||LEAF_TYPES.moment;
  const dateStr=l.date&&l.date.year?formatLeafDate(l.date):'';
  const taggedNames=(l.twygs||[]).map(tid=>{const p=peopleById[tid];return p?(p.isYou?'You':fullName(p)):null;}).filter(Boolean);

  const msg=`
    <div style="text-align:left">
      <div style="font-size:1.8rem;margin-bottom:4px">${t.icon}${l.emoji?' '+l.emoji:''}</div>
      <div style="font-size:1.1rem;font-weight:600;margin-bottom:4px;color:var(--text)">${l.title||t.label}</div>
      ${dateStr?`<div style="font-size:.78rem;color:var(--muted);margin-bottom:10px">${dateStr}</div>`:''}
      <div style="font-size:.88rem;line-height:1.6;color:var(--text);white-space:pre-wrap;margin-bottom:12px">${l.content||''}</div>
      ${taggedNames.length>1?`<div style="font-size:.72rem;color:var(--muted)">Tagged: ${taggedNames.join(', ')}</div>`:''}
    </div>
  `;

  appChoice(msg, '✏️ Edit', '🗑 Delete', 'Close').then(choice=>{
    if(choice==='a'){
      // Edit
      const firstTwyg=l.twygs&&l.twygs[0]?l.twygs[0]:null;
      if(firstTwyg) openLeafModal(firstTwyg, l.id);
    } else if(choice==='b'){
      // Delete
      appConfirm('Delete this Leaf? This can\'t be undone.','Delete','Cancel').then(yes=>{
        if(yes){
          deleteLeaf(l.id);
          if(selectedNodeId) selectNode(selectedNodeId);
        }
      });
    }
  });
}

function openLeafList(personId){
  const nodeLeafs=getLeafsForNode(personId);
  if(!nodeLeafs.length) return;
  const p=peopleById[personId];
  const name=p?(p.isYou?'You':fullName(p)):'Unknown';

  let cards='';
  nodeLeafs.forEach(l=>{
    const t=LEAF_TYPES[l.type]||LEAF_TYPES.moment;
    const dateStr=l.date&&l.date.year?l.date.year:'';
    cards+=`<div onclick="closeAllModals();openLeafDetail('${l.id}')" style="display:flex;align-items:flex-start;gap:10px;padding:10px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid var(--border);cursor:pointer;transition:all .15s;margin-bottom:6px">
      <span style="font-size:1.1rem">${t.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:.84rem;font-weight:500;color:var(--text)">${l.title||t.label}</div>
        <div style="font-size:.72rem;color:var(--muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(l.content||'').slice(0,100)}</div>
      </div>
      ${dateStr?`<span style="font-size:.66rem;color:var(--muted)">${dateStr}</span>`:''}
    </div>`;
  });

  appAlert(`<div style="text-align:left"><div style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">All Leafs for ${name}</div>${cards}</div>`);
}

function closeAllModals(){
  document.getElementById('app-modal-bg').classList.remove('open');
}

function formatLeafDate(d){
  if(!d||!d.year) return '';
  const months=['','January','February','March','April','May','June','July','August','September','October','November','December'];
  let s='';
  if(d.month&&months[d.month]) s+=months[d.month]+' ';
  if(d.day) s+=d.day+', ';
  s+=d.year;
  return s;
}

