/* ═══ settings.js ═══ Settings panel, color pickers, custom connection types ═══ */

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

function previewLineColor(key, hex){
  lineColors[key]=hex;
  const prev=document.getElementById(`preview-${key}`);
  if(prev) prev.style.background=hex;
  render(); // live preview
}

function previewNodeColor(key, hex){
  nodeColors[key]=hex;
  const prev=document.getElementById(`npreview-${key}`);
  if(prev) prev.style.background=hex;
  syncNodeLegend();
  render();
}

function syncNodeColorPickers(){
  Object.keys(DEFAULT_NODE_COLORS).forEach(key=>{
    const input=document.getElementById(`ncolor-${key}`);
    const prev=document.getElementById(`npreview-${key}`);
    const c=nodeColors[key]||DEFAULT_NODE_COLORS[key];
    if(input) input.value=c;
    if(prev) prev.style.background=c;
  });
}

function resetNodeColors(){
  nodeColors={...DEFAULT_NODE_COLORS};
  syncNodeColorPickers();
  syncNodeLegend();
  render();
}

function syncNodeLegend(){
  const legMap={you:'ln-you',spouse:'ln-spouse',parent:'ln-parent',child:'ln-child',sibling:'ln-sibling',extended:'ln-extended'};
  Object.entries(legMap).forEach(([key,elId])=>{
    const el=document.getElementById(elId);
    if(el){ const c=nodeColors[key]||DEFAULT_NODE_COLORS[key]; el.style.background=c; el.style.boxShadow=`0 0 5px ${c}`; }
  });
}

function syncLegend(){
  ['parentChild','sibling'].forEach(key=>{
    const el=document.getElementById(`leg-${key}`);
    if(!el) return;
    const c=lineColors[key]||DEFAULT_LINE_COLORS[key];
    el.style.background=c; el.style.height='3px'; el.style.borderTop='none'; el.style.borderRadius='2px';
  });
  ['spouse'].forEach(key=>{
    const el=document.getElementById(`leg-${key}`);
    if(!el) return;
    const c=lineColors[key]||DEFAULT_LINE_COLORS[key];
    el.style.background='transparent'; el.style.height='0'; el.style.borderTop=`2px dashed ${c}`;
  });
  // Extended blood = labeled color but solid
  const eb=document.getElementById('leg-blood-ext');
  if(eb){ const c=lineColors.labeled||DEFAULT_LINE_COLORS.labeled; eb.style.background=c; eb.style.height='3px'; eb.style.borderTop='none'; eb.style.borderRadius='2px'; }
  // Non-blood = labeled color dashed
  const lb=document.getElementById('leg-labeled');
  if(lb){ const c=lineColors.labeled||DEFAULT_LINE_COLORS.labeled; lb.style.background='transparent'; lb.style.height='0'; lb.style.borderTop=`2px dashed ${c}`; }
  // Extended non-blood (in-laws) = inlaw color dashed
  const il=document.getElementById('leg-inlaw');
  if(il){ const c=lineColors.inlaw||DEFAULT_LINE_COLORS.inlaw; il.style.background='transparent'; il.style.height='0'; il.style.borderTop=`2px dashed ${c}`; }
}
function syncColorPickers(){
  ['parentChild','spouse','sibling','labeled','inlaw'].forEach(key=>{
    const input=document.getElementById(`color-${key}`);
    const prev=document.getElementById(`preview-${key}`);
    if(input){ input.value=lineColors[key]||DEFAULT_LINE_COLORS[key]; }
    if(prev){ prev.style.background=lineColors[key]||DEFAULT_LINE_COLORS[key]; }
  });
}

function resetLineColors(){
  lineColors={...DEFAULT_LINE_COLORS};
  syncColorPickers();
  render();
}

// ── Custom connection line types ──────────────────────────────────────────────
let customLineTypes = []; // [{id, name, color}]

function renderCustomLineList(){
  const list=document.getElementById('custom-line-list');
  if(!list) return;
  if(!customLineTypes.length){
    list.innerHTML='<div style="font-size:.78rem;color:var(--muted);padding:8px 0">No custom types yet.</div>';
    return;
  }
  list.innerHTML=customLineTypes.map((t,i)=>`
    <div class="sp-color-row" style="margin-bottom:8px">
      <div class="sp-color-info">
        <input class="ei" value="${t.name}" oninput="customLineTypes[${i}].name=this.value;syncCustomConnOptions()"
          style="padding:5px 8px;font-size:.82rem;background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:6px;color:var(--text);outline:none;width:100%"/>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;margin-left:8px">
        <div class="sp-color-swatch" style="width:30px;height:30px">
          <input type="color" value="${t.color}" oninput="customLineTypes[${i}].color=this.value;syncCustomConnOptions();render()"/>
          <div class="sp-color-preview" style="background:${t.color}"></div>
        </div>
        <button onclick="removeCustomLineType(${i})" style="background:transparent;border:none;color:rgba(200,100,100,.6);cursor:pointer;font-size:16px;padding:0 2px">×</button>
      </div>
    </div>`).join('');
}

function addCustomLineType(){
  const id='cl_'+Date.now();
  customLineTypes.push({id,name:'New type',color:'#c8a84b'});
  renderCustomLineList();
  syncCustomConnOptions();
}

function removeCustomLineType(i){
  customLineTypes.splice(i,1);
  renderCustomLineList();
  syncCustomConnOptions();
}

function syncCustomConnOptions(){
  // Add custom line types to the Add Connection modal dropdown
  const existing=document.getElementById('conn-rel');
  if(!existing) return;
  // Remove old custom optgroup if present
  const oldGrp=existing.querySelector('optgroup[data-custom]');
  if(oldGrp) oldGrp.remove();
  if(!customLineTypes.length) return;
  // Re-build optgroup
  const grp=document.createElement('optgroup');
  grp.label='Custom connection types';
  grp.setAttribute('data-custom','1');
  customLineTypes.forEach(t=>{
    const opt=document.createElement('option');
    opt.value=`labeled-${t.name}`;
    opt.textContent=t.name;
    grp.appendChild(opt);
  });
  existing.appendChild(grp);
}
let settingsMode = 'simple'; // local setting, loaded from Firestore

function settingsDoc(){ return db.collection('userSettings').doc(currentUser.uid); }

async function loadSettings(){
  try{
    const snap=await settingsDoc().get();
    if(snap.exists){
      const d=snap.data();
      if(d.defaultView){
        settingsMode=d.defaultView;
        treeMode=settingsMode;
        // setTreeMode called after DOM ready in render cycle
      }
      if(d.lineColors) lineColors={...DEFAULT_LINE_COLORS,...d.lineColors};
      if(d.nodeColors) nodeColors={...DEFAULT_NODE_COLORS,...d.nodeColors};
      if(d.customLineTypes) customLineTypes=d.customLineTypes;
      if(d.youngAge!=null) youngAge=parseInt(d.youngAge)||17;
      if(d.autoConnections!=null) autoConnections=!!d.autoConnections;
      if(d.demoMode!=null) demoMode=!!d.demoMode;
    }
  }catch(e){}
}

function saveSettings(){
  // 1. Grab values
  youngAge=parseInt(document.getElementById('sp-young-age')?.value)||17;
  treeMode=settingsMode;
  setTreeMode(settingsMode);
  render();

  // 2. Show immediate feedback — no async blocking
  const saveBtn=document.getElementById('sp-save-btn');
  if(saveBtn){
    saveBtn.textContent='✓  Saved!';
    saveBtn.style.background='#4caf7d';
    saveBtn.style.color='#fff';
    saveBtn.disabled=true;
    setTimeout(()=>{
      saveBtn.textContent='Save preferences';
      saveBtn.style.background='';
      saveBtn.style.color='';
      saveBtn.disabled=false;
      closeSettings();
      flashSaved();
    },1500);
  } else {
    closeSettings();
    flashSaved();
  }

  // 3. Persist to Firestore in the background — don't block UI
  if(currentUser){
    settingsDoc().set({
      defaultView:settingsMode, lineColors, nodeColors,
      customLineTypes, youngAge, autoConnections, demoMode,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    }).catch(e=>console.warn('Settings save failed:',e));
  }
}


function setSettingsMode(mode){
  settingsMode=mode;
  document.getElementById('sp-opt-simple').classList.toggle('active', mode==='simple');
  document.getElementById('sp-opt-complex').classList.toggle('active', mode==='complex');
  render();
}

function openSettings(){
  // Populate user info
  const u=currentUser;
  const spAv=document.getElementById('sp-avatar');
  if(u.photoURL) spAv.innerHTML=`<img src="${u.photoURL}"/>`;
  else spAv.textContent=(u.displayName||u.email||'?')[0].toUpperCase();
  document.getElementById('sp-name').textContent=u.displayName||'';
  document.getElementById('sp-email').textContent=u.email||'';
  // Sync current setting
  setSettingsMode(settingsMode);
  // Count generations
  const genSet=new Set();
  const youNode=people.find(p=>p.isYou);
  if(youNode){
    const q=[{id:youNode.id,g:0}]; const vis=new Set();
    while(q.length){ const {id,g}=q.shift(); if(vis.has(id)) continue; vis.add(id); genSet.add(g);
      const p=peopleById[id]; if(!p) continue;
      (p.parents||[]).forEach(pid=>{ if(!vis.has(pid)) q.push({id:pid,g:g-1}); });
      people.filter(x=>(x.parents||[]).includes(id)).forEach(c=>{ if(!vis.has(c.id)) q.push({id:c.id,g:g+1}); });
    }
  }
  document.getElementById('sp-member-count').textContent=people.length;
  document.getElementById('sp-gen-count').textContent=genSet.size||1;
  syncColorPickers();
  syncNodeColorPickers();
  renderCustomLineList();
  syncCustomConnOptions();
  const yaInput=document.getElementById('sp-young-age');
  if(yaInput) yaInput.value=youngAge;
  syncAutoConnToggle();
  syncDemoToggle();
  loadLinkedTrees();
  document.getElementById('settings-panel').classList.add('open');
  document.getElementById('scrim').classList.add('on');
}

function closeSettings(){
  document.getElementById('settings-panel').classList.remove('open');
  if(!selectedNodeId&&!document.getElementById('members-panel').classList.contains('open'))
    document.getElementById('scrim').classList.remove('on');
}

