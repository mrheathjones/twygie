/* ═══ app.js ═══════════════════════════════════════════════════════════════
 * Application entry point: pan/zoom controls, add member form, and
 * event listeners. This file loads last and wires everything together.
 *
 * KEY FUNCTIONS:
 *   resetView()          — fits tree to screen with padding
 *   zoomBy(factor)       — zooms in/out centered on viewport
 *   openModal(forId)     — opens the Add a Twyg form (optionally pre-linked)
 *   submitMember()       — validates form, creates Person, runs auto-assign
 *   promptWeddingDate()  — optional wedding date entry after spouse addition
 *
 * EVENT LISTENERS:
 *   mousedown/mousemove/mouseup — canvas panning
 *   wheel                       — scroll zoom
 *   touchstart/touchmove/touchend — mobile pan + pinch-to-zoom
 * ═══════════════════════════════════════════════════════════════════════════ */
// ─── VIEW ────────────────────────────────────────────────────────────────────

function resetView(){
  if(!people.length) return;
  const xs=people.map(p=>p.x), ys=people.map(p=>p.y);
  const x0=Math.min(...xs)-90, x1=Math.max(...xs)+90;
  const y0=Math.min(...ys)-70, y1=Math.max(...ys)+100;
  const W=window.innerWidth, H=window.innerHeight;
  scale=Math.min(1,W/(x1-x0),(H-80)/(y1-y0))*.88;
  panX=(W-(x1-x0)*scale)/2-x0*scale;
  panY=(H-(y1-y0)*scale)/2-y0*scale+18;
  applyTransform(true);
}
function zoomBy(f){
  const cx=window.innerWidth/2, cy=window.innerHeight/2;
  panX=cx-(cx-panX)*f; panY=cy-(cy-panY)*f;
  scale=Math.max(.12,Math.min(6,scale*f)); applyTransform();
}

// ─── PAN ─────────────────────────────────────────────────────────────────────
let isDragging=false, dragStartX=0, dragStartY=0;
const wrap=document.getElementById('wrap');

wrap.addEventListener('mousedown',e=>{
  if(e.target.closest('.nd')) return;
  isDragging=true; dragStartX=e.clientX-panX; dragStartY=e.clientY-panY;
  wrap.style.cursor='grabbing'; hideTooltip();
});

wrap.addEventListener('wheel',e=>{
  e.preventDefault();
  const f=e.deltaY<0?1.11:.9;
  const r=wrap.getBoundingClientRect();
  const mx=e.clientX-r.left, my=e.clientY-r.top;
  panX=mx-(mx-panX)*f; panY=my-(my-panY)*f;
  scale=Math.max(.12,Math.min(6,scale*f)); applyTransform();
},{passive:false});

let lastPinchDist=0, isTouchPanning=false, touchStartX=0, touchStartY=0;
wrap.addEventListener('touchstart',e=>{
  if(e.target.closest('.nd')) return;
  if(e.touches.length===1){ isTouchPanning=true; touchStartX=e.touches[0].clientX-panX; touchStartY=e.touches[0].clientY-panY; }
  else if(e.touches.length===2){ isTouchPanning=false; lastPinchDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY); }
},{passive:true});
wrap.addEventListener('touchmove',e=>{
  if(nodeDragState) return;
  if(e.touches.length===1&&isTouchPanning){ panX=e.touches[0].clientX-touchStartX; panY=e.touches[0].clientY-touchStartY; applyTransform(); }
  else if(e.touches.length===2){
    const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
    const f=d/lastPinchDist; lastPinchDist=d;
    const cx=(e.touches[0].clientX+e.touches[1].clientX)/2;
    const cy2=(e.touches[0].clientY+e.touches[1].clientY)/2;
    panX=cx-(cx-panX)*f; panY=cy2-(cy2-panY)*f;
    scale=Math.max(.12,Math.min(6,scale*f)); applyTransform();
  }
},{passive:true});

// ─── ADD MEMBER ───────────────────────────────────────────────────────────────
let addForNodeId=null;
let modalPhotoData=null;
function handleModalPhoto(event){
  const file=event.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    modalPhotoData=e.target.result;
    const prev=document.getElementById('modal-photo-preview');
    if(prev) prev.innerHTML=`<img src="${modalPhotoData}" style="width:100%;height:100%;object-fit:cover"/>`;
  };
  reader.readAsDataURL(file);
}


function toggleDeathDate(){
  const cb=document.getElementById('f-deceased');
  const fields=document.getElementById('f-death-fields');
  const track=document.getElementById('f-deceased-track');
  const thumb=document.getElementById('f-deceased-thumb');
  if(!fields||!cb) return;
  fields.style.display=cb.checked?'block':'none';
  if(track) track.classList.toggle('toggle-track-on',cb.checked);
  if(thumb) thumb.classList.toggle('on',cb.checked);
}

function refreshModalRelOptions(){
  const fr=document.getElementById('fr'); if(!fr) return;
  // Remove any existing custom optgroup
  const existing=fr.querySelector('optgroup[data-custom]');
  if(existing) fr.removeChild(existing);
  // Add custom types if any exist
  if(customLineTypes&&customLineTypes.length){
    const og=document.createElement('optgroup');
    og.label='Custom'; og.dataset.custom='1';
    customLineTypes.forEach(t=>{
      const o=document.createElement('option');
      o.value='custom-'+t.name; o.textContent=t.name;
      og.appendChild(o);
    });
    fr.appendChild(og);
  }
}

function openModal(forId){
  addForNodeId=forId;
  const fp=forId?peopleById[forId]:null;
  document.getElementById('msub').textContent=fp?`Connected to ${fullName(fp)}`:'Add someone to your tree';
  document.getElementById('rel-to-label').textContent=fp?(fp.firstName||fullName(fp)):'the tree';
  ['fn-first','fn-last','fdob-day','fdob-year','fcity','fstory','fdod-day','fdod-year'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  ['fdob-month','fgender','fr','fstate','fdod-month'].forEach(id=>{const e=document.getElementById(id);if(e)e.selectedIndex=0;});
  const dec=document.getElementById('f-deceased'); if(dec){dec.checked=false; toggleDeathDate();}
  modalPhotoData=null;
  const prev=document.getElementById('modal-photo-preview'); if(prev) prev.innerHTML='<span>+</span>';
  const fi=document.getElementById('modal-photo-file'); if(fi) fi.value='';
  refreshModalRelOptions();
  document.getElementById('mbg').classList.add('open');
}
function closeModal(){ document.getElementById('mbg').classList.remove('open'); }

function submitMember(){
  try {
  const first=document.getElementById('fn-first').value.trim();
  const last=document.getElementById('fn-last').value.trim();
  const name=[first,last].filter(Boolean).join(' ');
  if(!name){ document.getElementById('fn-first').focus(); return; }

  const gender=document.getElementById('fgender').value;
  const dob={
    month:document.getElementById('fdob-month').value,
    day:document.getElementById('fdob-day').value,
    year:document.getElementById('fdob-year').value
  };
  const birth=parseInt(dob.year)||null;
  const deceased=document.getElementById('f-deceased')?.checked;
  const dod=deceased?{month:document.getElementById('fdod-month')?.value||'',day:document.getElementById('fdod-day')?.value||'',year:document.getElementById('fdod-year')?.value||''}:null;
  const death=dod?parseInt(dod.year)||null:null;
  const city=document.getElementById('fcity').value.trim();
  const state=document.getElementById('fstate').value||'';
  const note=document.getElementById('fstory').value.trim();
  const rel=document.getElementById('fr').value;

  // Infer base rel category
  if(!rel){ // No relationship — just add as standalone node
    people.push({id:`u${nextNodeId++}`,name,firstName:first,lastName:last,gender,dob,birth,dod,death,city,state,note,parents:[],customLinks:{},relationships:[],x:600+Math.random()*100-50,y:400+Math.random()*100-50});
    if(modalPhotoData){ people[people.length-1].photo=modalPhotoData; }
    rebuild([]); closeModal(); render(); scheduleSave();
    setTimeout(()=>selectNode(people[people.length-1].id),90); return;
  }
  const baseRel=CHILD_RELS.includes(rel)?'Child':PARENT_RELS.includes(rel)?'Parent':SPOUSE_RELS.includes(rel)?'Spouse':SIBLING_RELS.includes(rel)?'Sibling':'Other';

  const id=`u${nextNodeId++}`;
  const np={id,name,firstName:first,lastName:last,gender,dob,birth,dod,death,city,state,note,parents:[],relationships:[],relLabel:baseRel,x:600,y:400};
  if(modalPhotoData) np.photo=modalPhotoData;

  // Infer gender from relationship label
  if(!np.gender){
    if(['Son','Grandson','Stepson','Nephew','Brother','Brother-in-law','Uncle','Father','Grandfather','Stepfather','Father-in-law','Husband'].includes(rel)) np.gender='male';
    if(['Daughter','Granddaughter','Stepdaughter','Niece','Sister','Sister-in-law','Aunt','Mother','Grandmother','Stepmother','Mother-in-law','Wife'].includes(rel)) np.gender='female';
  }

  if(addForNodeId){
    const target=peopleById[addForNodeId];
    if(baseRel==='Child'){
      const directChildSet=new Set(['Son','Daughter','Stepson','Stepdaughter','Child']);
      if(directChildSet.has(rel)){
        np.parents=[addForNodeId];
      } else {
        // Grandchild, nephew, etc — customLink only
        np.parents=[];
        if(!np.customLinks) np.customLinks={};
        if(!target.customLinks) target.customLinks={};
        const ltype4=BLOOD_LABELS.has(rel)?'blood':'labeled';
        np.customLinks[addForNodeId]={label:rel,lineType:ltype4};
        target.customLinks[id]={label:rel,lineType:ltype4};
      }
    }
    else if(baseRel==='Parent'){
      np.parents=[];
      const directParentLabelsSet=new Set(['Father','Mother','Stepfather','Stepmother','Parent']);
      if(directParentLabelsSet.has(rel)){
        // Direct parent — add to target's parents array
        if(target) target.parents=[...(target.parents||[]),id];

        // CASCADE B: parent-to-sibling — add this parent to ALL of target's siblings
        if(target){
          const targetSibs=new Set();
          // From shared parents
          (target.parents||[]).forEach(pid=>{
            if(pid===id) return; // skip the parent we just added
            people.filter(s=>s.id!==target.id&&(s.parents||[]).includes(pid)).forEach(s=>targetSibs.add(s.id));
          });
          // From sibling relationships/customLinks
          (target.relationships||[]).forEach(r=>{
            if(SIBLING_LABELS.has(r.label)) targetSibs.add(r.targetId);
          });
          Object.entries(target.customLinks||{}).forEach(([tid,v])=>{
            const lbl=typeof v==='string'?v:v.label||'';
            if(SIBLING_LABELS.has(lbl)) targetSibs.add(tid);
          });
          targetSibs.forEach(sibId=>{
            const sib=peopleById[sibId]; if(!sib) return;
            if(!(sib.parents||[]).includes(id)){
              sib.parents=[...(sib.parents||[]),id];
            }
          });
        }
      } else {
        // Grandparent, uncle, etc — store as customLink only
        if(!np.customLinks) np.customLinks={};
        if(!target.customLinks) target.customLinks={};
        const ltype=BLOOD_LABELS.has(rel)?'blood':'labeled';
        np.customLinks[addForNodeId]={label:rel,lineType:ltype};
        target.customLinks[id]={label:rel,lineType:ltype};
      }
    }
    else if(baseRel==='Sibling'){
      const directSibSet=new Set(['Brother','Sister','Half-brother','Half-sister','Stepbrother','Stepsister','Sibling']);
      if(directSibSet.has(rel)){
        // Direct siblings share parents — copy target's parents
        np.parents=[...(target?.parents||[])];
        if(!np.customLinks) np.customLinks={};
        if(!target.customLinks) target.customLinks={};
        const sibLabel=np.gender==='male'?'Brother':np.gender==='female'?'Sister':'Sibling';
        np.customLinks[addForNodeId]={label:sibLabel,lineType:'sibling'};
        target.customLinks[id]={label:sibLabel,lineType:'sibling'};

        // CASCADE A: sibling-of-sibling — find ALL of target's existing siblings
        // and make the new node their sibling too
        const targetSibs=new Set();
        // From shared parents
        (target.parents||[]).forEach(pid=>{
          people.filter(s=>s.id!==target.id&&s.id!==id&&(s.parents||[]).includes(pid)).forEach(s=>targetSibs.add(s.id));
        });
        // From sibling relationships/customLinks
        (target.relationships||[]).forEach(r=>{
          if(SIBLING_LABELS.has(r.label)&&r.targetId!==id) targetSibs.add(r.targetId);
        });
        Object.entries(target.customLinks||{}).forEach(([tid,v])=>{
          if(tid===id) return;
          const lbl=typeof v==='string'?v:v.label||'';
          if(SIBLING_LABELS.has(lbl)) targetSibs.add(tid);
        });
        // Create sibling relationships between new node and each existing sibling
        targetSibs.forEach(sibId=>{
          const sib=peopleById[sibId]; if(!sib) return;
          const sl=sib.gender==='male'?'Brother':sib.gender==='female'?'Sister':'Sibling';
          if(!np.customLinks) np.customLinks={};
          if(!sib.customLinks) sib.customLinks={};
          np.customLinks[sibId]={label:sl,lineType:'sibling'};
          sib.customLinks[id]={label:sibLabel,lineType:'sibling'};
          addRel(np, sib, sibLabel);
          // Also share parents
          (sib.parents||[]).forEach(pid=>{
            if(!(np.parents||[]).includes(pid)) np.parents=[...(np.parents||[]),pid];
          });
        });
      } else {
        // Cousins, in-laws, etc — customLink only (don't copy parents)
        np.parents=[];
        if(!np.customLinks) np.customLinks={};
        if(!target.customLinks) target.customLinks={};
        const ltype=BLOOD_LABELS.has(rel)?'blood':'labeled';
        np.customLinks[addForNodeId]={label:rel,lineType:ltype};
        target.customLinks[id]={label:inverseLabel(rel),lineType:ltype};
      }
    }
        else if(baseRel==='Spouse'){
          np.spouseOf=addForNodeId; if(target) target.spouseOf=id;
          // Structural: anchor's existing children become new spouse's children too
          people.filter(x=>(x.parents||[]).includes(addForNodeId)).forEach(child=>{
            if(!(child.parents||[]).includes(id)){
              child.parents=[...(child.parents||[]),id];
            }
          });
        }
    else if(rel&&rel.startsWith('custom-')){
      // Custom relationship type — store as customLink
      const customLabel=rel.slice(7); // remove 'custom-' prefix
      np.parents=[];
      if(!np.customLinks) np.customLinks={};
      if(!target.customLinks) target.customLinks={};
      np.customLinks[addForNodeId]={label:customLabel,lineType:'labeled'};
      target.customLinks[id]={label:customLabel,lineType:'labeled'};
      np.relLabel=customLabel;
    }
    else np.parents=[addForNodeId];
  }

  people.push(np);
  // Lightweight peopleById sync before auto-assign (full rebuild happens next)
  people.forEach(p=>{ if(!peopleById[p.id]) peopleById[p.id]=p; });
  // Sync customLinks → relationships[] for new node and target
  if(addForNodeId){
    const target=peopleById[addForNodeId];
    if(np.customLinks) Object.entries(np.customLinks).forEach(([tid,v])=>{
      const lbl=typeof v==='string'?v:v.label||'';
      if(lbl && !np.relationships.some(r=>r.targetId===tid)){
        np.relationships.push({targetId:tid, label:lbl, category:getRelCategory(lbl), structural:false});
      }
    });
    if(target && target.customLinks && target.customLinks[id]){
      if(!target.relationships) target.relationships=[];
      const tv=target.customLinks[id];
      const tlbl=typeof tv==='string'?tv:tv.label||'';
      if(tlbl && !target.relationships.some(r=>r.targetId===id)){
        target.relationships.push({targetId:id, label:tlbl, category:getRelCategory(tlbl), structural:false});
      }
    }
  }
  // Auto-assign relationship to isYou if addForNodeId is set
  if(addForNodeId && rel){
    if(baseRel==='Sibling' && np.parents.length>0){
      // For siblings: run auto-assign as child of each parent — triggers full
      // isDirChild cascade (grandparents, uncles, in-laws, etc.)
      np.parents.forEach(pid=>{
        const childLabel=genderedRel('Child',np.gender);
        autoAssignToYou(id, pid, childLabel);
      });
    } else {
      autoAssignToYou(id, addForNodeId, rel);
    }
  }
  rebuild([id]); closeModal(); render(); scheduleSave();
  setTimeout(()=>{
    selectNode(id);
    // Prompt for wedding date if spouse connection was just created
    if(baseRel==='Spouse') promptWeddingDate(id);
    // Warn about missing birthdate (affects timeline)
    const newP=peopleById[id];
    const hasDob=newP&&((parseInt(newP.dob&&newP.dob.year)||newP.birth||0)>0);
    if(!hasDob&&!dobWarnDismissed){
      setTimeout(async ()=>{
        const confirmed=await appConfirm(
          'This member has no birthdate. They won\'t appear on the Timeline until a birthdate is added.<br><br><label style="display:flex;align-items:center;gap:8px;font-size:.78rem;color:var(--muted);cursor:pointer"><input type="checkbox" id="dob-warn-dismiss-cb"/> Don\'t remind me again</label>',
          'Got it','Edit now'
        );
        const cb=document.getElementById('dob-warn-dismiss-cb');
        if(cb&&cb.checked){ dobWarnDismissed=true; persistDobWarn(); }
        if(!confirmed){
          // User chose "Edit now" — open edit mode
          const editBtn=document.querySelector('#card .cbtn-edit');
          if(editBtn) editBtn.click();
        }
      },400);
    }
  },90);
  } catch(e) { console.error('submitMember error:', e); appAlert('Error adding member: ' + e.message); }
}

// ─── WEDDING DATE PROMPT ────────────────────────────────────────────────────
function promptWeddingDate(nodeId){
  const p=peopleById[nodeId]; if(!p) return;
  const spouseName=p.spouseOf?fullName(peopleById[p.spouseOf]):fullName(people.find(x=>x.spouseOf===nodeId)||{});
  const nodeName=fullName(p);
  const modal=document.getElementById('link-modal-content');
  modal.innerHTML=`
    <div style="font-size:.88rem;color:var(--text);margin-bottom:4px">💍 Wedding Date</div>
    <div style="font-size:.78rem;color:var(--muted);margin-bottom:16px;line-height:1.5">
      When did <strong>${nodeName}</strong> and <strong>${spouseName}</strong> get married?
    </div>
    <div style="display:flex;gap:6px;margin-bottom:16px">
      <select id="wd-month" style="flex:1.2;padding:8px;background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:'Outfit',sans-serif;font-size:.82rem">
        <option value="">Month</option>
        <option value="1">January</option><option value="2">February</option><option value="3">March</option>
        <option value="4">April</option><option value="5">May</option><option value="6">June</option>
        <option value="7">July</option><option value="8">August</option><option value="9">September</option>
        <option value="10">October</option><option value="11">November</option><option value="12">December</option>
      </select>
      <input id="wd-day" type="number" min="1" max="31" placeholder="Day" style="flex:.7;padding:8px;background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:'Outfit',sans-serif;font-size:.82rem"/>
      <input id="wd-year" type="number" min="1900" max="2100" placeholder="Year" style="flex:.8;padding:8px;background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:'Outfit',sans-serif;font-size:.82rem"/>
    </div>
    <div style="display:flex;gap:6px">
      <button onclick="saveWeddingDate('${nodeId}')" style="flex:1;padding:8px;background:var(--gold);border:none;border-radius:100px;color:#04070c;font-family:'Outfit',sans-serif;font-size:.82rem;font-weight:600;cursor:pointer">Save</button>
      <button onclick="closeLinkModal()" style="flex:1;padding:8px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:100px;color:var(--muted);font-family:'Outfit',sans-serif;font-size:.82rem;cursor:pointer">Skip</button>
    </div>
  `;
  document.getElementById('link-bg').classList.add('open');
}

function saveWeddingDate(nodeId){
  const p=peopleById[nodeId]; if(!p) return;
  const month=document.getElementById('wd-month').value;
  const day=document.getElementById('wd-day').value;
  const year=document.getElementById('wd-year').value;
  if(!month&&!day&&!year){closeLinkModal();return}
  p.weddingDate={month,day,year};
  // Also set on spouse for easy access
  const spouse=p.spouseOf?peopleById[p.spouseOf]:people.find(x=>x.spouseOf===p.id);
  if(spouse) spouse.weddingDate={month,day,year};
  closeLinkModal();
  scheduleSave();
  if(selectedNodeId) selectNode(selectedNodeId); // refresh card
}

// ─── EVENT LISTENER WIRING ───────────────────────────────────────────────────
// All static HTML event handlers in one place (replaces inline onclick/oninput)

function initEventListeners() {
  const on = (id, event, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, fn);
  };

  // --- Header ---
  on('mcount',       'click', openMembersPanel);
  on('btn-tree',     'click', () => setTreeMode('simple'));
  on('btn-all',      'click', () => setTreeMode('complex'));
  on('btn-blood',    'click', () => setTreeMode('bloodline'));
  on('btn-bonds',    'click', () => setTreeMode('bonds'));

  // --- Layout mode toggle ---
  async function requestLayoutChange(mode){
    if(mode===layoutMode) return;
    if(!layoutWarnDismissed){
      const confirmed=await appConfirm(
        'This will reposition all nodes to fit the new layout. Any manual positioning will be reset.<br><br><label style="display:flex;align-items:center;gap:8px;font-size:.78rem;color:var(--muted);cursor:pointer"><input type="checkbox" id="layout-warn-dismiss-cb"/> Don\'t warn me again</label>',
        'Change Layout','Cancel'
      );
      if(!confirmed) return;
      const cb=document.getElementById('layout-warn-dismiss-cb');
      if(cb&&cb.checked) layoutWarnDismissed=true;
    }
    setLayoutMode(mode);
    persistLayoutMode();
  }
  on('btn-compact',     'click', () => requestLayoutChange('compact'));
  on('btn-relaxed',     'click', () => requestLayoutChange('relaxed'));
  on('btn-expanded',    'click', () => requestLayoutChange('expanded'));
  on('btn-traditional', 'click', () => requestLayoutChange('traditional'));
  on('btn-immersive',   'click', () => requestLayoutChange('immersive'));

  on('btn-exit-immersive', 'click', () => {
    setLayoutMode('relaxed');
    persistLayoutMode();
  });
  on('btn-export-png','click', () => exportTree('png'));
  on('btn-export-pdf','click', () => exportTree('pdf'));
  on('btn-add-member','click', () => openModal(null));
  on('btn-settings-gear','click', openSettings);

  // --- Zoom controls ---
  on('btn-zoom-in',  'click', () => zoomBy(1.25));
  on('btn-zoom-out', 'click', () => zoomBy(0.8));
  on('btn-zoom-fit', 'click', resetView);

  // --- Scrim ---
  on('scrim',        'click', handleScrimClick);

  // --- Card overlay ---
  on('btn-close-card','click', closeCard);

  // --- Members panel ---
  on('btn-close-members','click', closeMembersPanel);
  on('mp-search-input',  'input', renderMembersList);

  // --- Timeline panel ---
  on('btn-close-timeline','click', closeTimeline);

  // --- Connection modal (close on backdrop click) ---
  document.getElementById('conn-bg')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeConnModal();
  });
  on('conn-search',    'input', filterConnList);
  on('btn-conn-cancel','click', closeConnModal);
  on('btn-conn-save',  'click', saveConnection);

  // --- Link modal (close on backdrop click) ---
  document.getElementById('link-bg')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeLinkModal();
  });

  // --- Settings panel ---
  on('btn-close-settings','click', closeSettings);
  on('btn-signout',       'click', signOut);
  on('sp-save-btn',       'click', saveSettings);
  on('sp-opt-simple',     'click', () => setSettingsMode('simple'));
  on('sp-opt-complex',    'click', () => setSettingsMode('complex'));
  on('sp-opt-bloodline',  'click', () => setSettingsMode('bloodline'));
  on('sp-opt-bonds',      'click', () => setSettingsMode('bonds'));
  on('sp-autoconn',       'click', toggleAutoConn);
  on('sp-demo',           'click', toggleDemoMode);

  // --- Settings: collapse headers ---
  on('hdr-sec-view',   'click', () => toggleSection('sec-view'));
  on('hdr-sec-links',  'click', () => toggleSection('sec-links'));
  on('hdr-sec-conn',   'click', () => toggleSection('sec-conn'));
  on('hdr-sec-appear', 'click', () => toggleSection('sec-appear'));
  on('hdr-sec-export', 'click', () => toggleSection('sec-export'));
  on('hdr-sec-adv',    'click', () => toggleSection('sec-adv'));

  // --- Settings: action buttons ---
  on('btn-manage-links',    'click', () => { closeSettings(); openLinkCard(); });
  on('btn-add-custom-type', 'click', addCustomLineType);
  on('btn-recalc',          'click', recalcAllRelationships);
  on('btn-reset-node-colors','click', resetNodeColors);
  on('btn-reset-line-colors','click', resetLineColors);
  on('btn-burn-twygs',      'click', burnTwygs);
  on('btn-reset-layout-warn','click', () => {
    layoutWarnDismissed=false;
    persistLayoutMode();
    const btn=document.getElementById('btn-reset-layout-warn');
    if(btn){ btn.textContent='✓ Reset'; setTimeout(()=>{ btn.textContent='Reset'; },1500); }
  });
  on('btn-reset-dob-warn','click', () => {
    dobWarnDismissed=false;
    persistDobWarn();
    const btn=document.getElementById('btn-reset-dob-warn');
    if(btn){ btn.textContent='✓ Reset'; setTimeout(()=>{ btn.textContent='Reset'; },1500); }
  });

  // --- Settings: color pickers (node colors) ---
  ['you','spouse','parent','child','sibling','grandparent','extended','deceased','young'].forEach(key => {
    on('ncolor-' + key, 'input', e => previewNodeColor(key, e.target.value));
  });

  // --- Settings: color pickers (line colors) ---
  ['parentChild','spouse','sibling','labeled','inlaw'].forEach(key => {
    on('color-' + key, 'input', e => previewLineColor(key, e.target.value));
  });

  // --- Add member modal (close on backdrop click) ---
  document.getElementById('mbg')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  on('btn-modal-cancel', 'click', closeModal);
  on('btn-modal-submit', 'click', submitMember);
  on('f-deceased',       'change', toggleDeathDate);
  on('modal-photo-file', 'change', handleModalPhoto);

  // --- Deceased toggle track (clicks the hidden checkbox) ---
  document.getElementById('f-deceased-track')?.addEventListener('click', () => {
    document.getElementById('f-deceased').click();
  });
}

// Run after DOM is ready (scripts are at bottom of body)
try {
  initEventListeners();
} catch(e) {
  console.error('initEventListeners failed:', e);
  // Fallback: retry on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    try { initEventListeners(); } catch(e2) { console.error('initEventListeners retry failed:', e2); }
  });
}
