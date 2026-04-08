/* ═══ ui.js ═══ Node drag, selection, card display, editing, connection management ═══ */

// ─── NODE DRAG ────────────────────────────────────────────────────────────────
let nodeDragState=null;

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

document.addEventListener('mousemove',e=>{
  if(nodeDragState){
    const dx=e.clientX-nodeDragState.startX, dy=e.clientY-nodeDragState.startY;
    if(!nodeDragState.moved&&Math.hypot(dx,dy)>6) nodeDragState.moved=true;
    if(nodeDragState.moved){
      hideTooltip();
      const p=peopleById[nodeDragState.id]; if(!p) return;
      p.x=nodeDragState.origX+dx/scale; p.y=nodeDragState.origY+dy/scale;
      render();
      // Update branch dims if card open
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
  if(nodeDragState&&nodeDragState.touch&&e.touches.length===1){
    const dx=e.touches[0].clientX-nodeDragState.startX, dy=e.touches[0].clientY-nodeDragState.startY;
    if(!nodeDragState.moved&&Math.hypot(dx,dy)>8) nodeDragState.moved=true;
    if(nodeDragState.moved){
      const p=peopleById[nodeDragState.id]; if(!p) return;
      p.x=nodeDragState.origX+dx/scale; p.y=nodeDragState.origY+dy/scale;
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
  // Include labeled connections (customLinks)
  Object.keys(p.customLinks||{}).forEach(tid=>conn.add(tid));
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
  document.getElementById('cdob').textContent=dobDisplay(p);
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
  // Include labeled connections (in-laws, etc.)
  const labeled=Object.entries(p.customLinks||{}).map(([tid,v])=>({p:peopleById[tid],rel:typeof v==='string'?v:v.label,targetId:tid,connType:typeof v==='string'?'labeled':v.lineType||'labeled'})).filter(x=>x.p);
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
  resetView();
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
  // Clean up spouse and customLink references
  people.forEach(p=>{
    if(p.spouseOf&&rm.has(p.spouseOf)) delete p.spouseOf;
    if(p.customLinks) Object.keys(p.customLinks).forEach(k=>{ if(rm.has(k)) delete p.customLinks[k]; });
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
    ['In-Laws',['Father-in-law','Mother-in-law','Son-in-law','Daughter-in-law','Brother-in-law','Sister-in-law']],
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

  const mGender={'father':'male','grandfather':'male','stepfather':'male','son':'male','grandson':'male','stepson':'male','brother':'male','half-brother':'male','husband':'male','uncle':'male','nephew':'male','brother-in-law':'male','godfather':'male'};
  const fGender={'mother':'female','grandmother':'female','stepmother':'female','daughter':'female','granddaughter':'female','stepdaughter':'female','sister':'female','half-sister':'female','wife':'female','aunt':'female','niece':'female','sister-in-law':'female','godmother':'female'};
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
    } else {
      // Grandparent, uncle, etc. → store as customLink with correct line type
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
    } else {
      // Grandchild, nephew, etc. → customLink with correct line type
      if(!target.customLinks) target.customLinks={};
      if(!other.customLinks) other.customLinks={};
      const ltype2=BLOOD_LABELS.has(label)?'blood':'labeled';
      target.customLinks[other.id]={label,lineType:ltype2};
      other.customLinks[target.id]={label,lineType:ltype2};
    }
    other.relLabel=label;
  } else if(type==='sibling'){
    // Do NOT copy parents — avoids false grandparent connections
    if(!target.customLinks) target.customLinks={};
    if(!other.customLinks) other.customLinks={};
    const sLbl=label||'Sibling';
    target.customLinks[other.id]={label:sLbl,lineType:'sibling'};
    other.customLinks[target.id]={label:sLbl,lineType:'sibling'};
    if(!other.relLabel) other.relLabel=sLbl;
  } else if(type==='spouse'){
    other.spouseOf=target.id;
    if(!other.gender&&label.toLowerCase()==='husband') other.gender='male';
    if(!other.gender&&label==='wife') other.gender='female';
    if(!other.relLabel) other.relLabel='Spouse';
    other.relLabel=label;
  } else if(type==='labeled'){
    if(!target.customLinks) target.customLinks={};
    if(!other.customLinks) other.customLinks={};
    const ltype3=BLOOD_LABELS.has(label)?'blood':'labeled';
    target.customLinks[other.id]={label,lineType:ltype3};
    other.customLinks[target.id]={label,lineType:ltype3};
    other.relLabel=label;
  }

  // Auto-assign inferred relationship to isYou
  autoAssignToYou(connectionSelectedNodeId, connectionForNodeId, label);
  autoAssignToYou(connectionForNodeId, connectionSelectedNodeId, label);
  rebuild([]); render(); scheduleSave();
  closeConnModal();
  selectNode(connectionForNodeId);
}

